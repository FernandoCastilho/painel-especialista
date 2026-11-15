import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useEffect, useRef, useState } from 'react'
import './Calculadora.css'
import './CalculatorLayout.css'
import './CalculatorTheme.css'
import './BndesWorkspace.css'
import './Emprestimo4131.css'
import MoneyInput from './MoneyInput.jsx'
import Help from './CalculatorHelp.jsx'
import BndesIcon from './BndesIcon.jsx'
import Emprestimo4131Presentation from './Emprestimo4131Presentation.jsx'
import Emprestimo4131Print from './Emprestimo4131Print.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { useHolidays } from './useHolidays.js'
import { useCurves } from './useCurves.js'
import { addDays, busDaysIn, nextBusinessDay } from './holidays.js'
import { AMORTS, CALENDARIOS, FREQS, IOF_SHORT_TERM, IRRF_OPTIONS, MAX_MONTHS, METAS, MOEDAS, curveFactors, diDoPrazo, fronteiraIof, hedge4131, lerTaxasFuturas, loan4131, metaTaxa4131, moedaOf, unhedged4131 } from './emprestimo4131.js'
import { E4_FX_SCENARIOS, E4_QUOTE_NOTE, E4_SOURCES, condicoesE4, resumoE4 } from './emprestimo4131Presentation.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
// Resíduo numérico perto de zero não vira "-0,00%".
const pct = (v, d = 2) => `${(Math.abs(v) < 0.5 / 10 ** d ? 0 : v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const fx = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const signed = (v, f) => `${v >= 0 ? '+' : '−'} ${f(Math.abs(v))}`
const dm = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const quando = (at) => new Date(at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '')
// Valores de exemplo, usados só enquanto o Painel não entrega a cotação ou a curva (o cupom nunca vem do Painel).
const EXEMPLO = { USD: { spot: '5,4000', cupom: '5,20' }, EUR: { spot: '6,2000', cupom: '3,50' } }
const CONFERIDO_EM = '11/11/2026'
const IOF_RELIDO_EM = '15/11/2026'
const IR_PAYERS = [{ id: 'nao', label: 'Já incluído na taxa all-in' }, { id: 'sim', label: 'Somar à taxa (gross-up)' }]
const FEE_PLACES = [{ id: 'nao', label: 'Banco no Brasil · sem IR' }, { id: 'sim', label: 'Exterior · IR sobre a comissão' }]
const CURVE_MODES = [{ id: 'painel', label: 'Curvas do Painel (B3)' }, { id: 'manual', label: 'Digitar DI e cupom' }]
const DAY = 864e5
// Quantidade de taxas coladas diferente do número de pagamentos: diz quantas faltam ou sobram.
const faltaOuSobra = (coladas, total) => {
  const n = Math.abs(total - coladas)
  const verbo = coladas < total ? (n === 1 ? 'Falta' : 'Faltam') : (n === 1 ? 'Sobra' : 'Sobram')
  return `${verbo} ${n} ${n === 1 ? 'taxa' : 'taxas'}: você colou ${coladas} e a operação tem ${total} ${total === 1 ? 'pagamento' : 'pagamentos'}.`
}
// Taxa futura de cada parcela: estimada pelo DI e pelo juro da moeda, ou colada da cotação da mesa.
const FWD_MODES = [{ id: 'estimar', label: 'Estimar' }, { id: 'mesa', label: 'Colar as da mesa' }]
const FREQ_PLURAL = { 1: 'mensais', 3: 'trimestrais', 6: 'semestrais', 12: 'anuais', 0: 'no vencimento' }
// Desligado em 11/11/2026: a curva de cupom do Painel é o cupom sujo da B3 (DI x dólar, referido à PTAX do dia anterior).
// Usá-la com o câmbio do dia distorce o câmbio a termo. Religar só depois de limpar o cupom (ver docs/emprestimo-4131.md).
const CURVAS_DO_PAINEL = false
// Curva mais recente de um conjunto do Painel: { date, pts } ou null.
const hojeOf = (set) => { const today = set?.compare?.find((c) => c.id === 'hoje'); const pts = today ? set.curves?.[today.date] : null; return pts?.length ? { date: today.date, pts } : null }
// Regras levantadas nas fontes oficiais; detalhes e pontos não confirmados em docs/emprestimo-4131.md.
const REGRAS = [
  ['Contratação', 'Livre, em qualquer moeda, sem aprovação prévia do Banco Central. Custos compatíveis com o mercado internacional e claros no contrato.', 'Res. BCB 278/2022, arts. 5º e 6º'],
  ['Declaração ao Banco Central', 'O devedor declara no SCE-Crédito a operação a partir de US$ 1 milhão, até a entrada dos recursos, e informa o cronograma de pagamento em até 30 dias depois. O código gerado vai em toda remessa. Mudança de prazo ou de condições: declarar em 30 dias.', 'Res. BCB 278, arts. 17, 21, 23, 25, 28 e 29 (versão em vigor, atualizada em 30/09/2026)'],
  ['Remessas', 'Limitadas a principal, juros e encargos. Liquidação antecipada é permitida.', 'Res. BCB 278, arts. 7º e 8º'],
  ['IOF de crédito', 'Não incide sobre empréstimo tomado no exterior. O imposto desta operação é o IOF sobre o câmbio.', 'Decreto 6.306/2007, art. 2º, § 2º'],
  ['IOF-câmbio na entrada', 'Empréstimo externo sujeito a registro no Banco Central, contratado direto ou por emissão de títulos, com prazo médio mínimo de até 364 dias: 3,5% sobre o valor que entra, inclusive em operações simultâneas de câmbio. Acima desse prazo: zero. A alíquota de 3,5% vale por decisão provisória do STF, de julho de 2025; não achamos notícia de julgamento definitivo até novembro de 2026.', 'Decreto 6.306/2007, art. 15-B, XI e XII (o XII com a redação do Decreto 12.499/2025); ADC 96'],
  ['IOF-câmbio na saída', 'Zero no câmbio de saída de recursos do empréstimo externo. A aplicação aos juros não foi confirmada em texto oficial.', 'Decreto 6.306/2007, art. 15-B, XI'],
  ['Quem cobra e quando', 'O imposto é devido e cobrado na liquidação do câmbio, sobre o valor em reais da operação. Quem paga é a empresa que vende a moeda na entrada. Quem cobra e recolhe é o banco que opera o câmbio, até o terceiro dia útil depois do decêndio.', 'Decreto 6.306/2007, arts. 11 a 14 e 17'],
  ['Prazo médio', 'Média dos prazos das parcelas de principal, ponderada pelo valor de cada parcela. A fórmula do ato é a soma de (parcela × prazo) dividida pelo principal. Só entram as parcelas de principal; os juros ficam de fora. Com o principal pago de uma vez, o prazo médio é o prazo total; em parcelas, fica bem abaixo dele. Vale também para empréstimo entre empresas do mesmo grupo, qualquer que seja a participação. O ato não diz como contar o prazo de cada parcela nem como arredondar: a tela conta em dias corridos desde a entrada, decide pelo prazo exato (até 364 dias paga; qualquer fração acima não paga) e mostra o número arredondado para cima.', 'ADI RFB 41/2011, art. 1º, §§ 1º e 2º (DOU de 02/08/2011, seção 1, p. 19); Solução de Consulta Disit/SRRF08 234/2012 (ementa)'],
  ['Liquidação antecipada', 'Total ou parcial. Se a antecipação descumprir o prazo médio mínimo, perde-se o IOF zero desde a entrada: o imposto é devido pela alíquota da data da entrada (hoje 3,5%), com juros de mora e multa, além das penalidades cambiais. Se o prazo médio cair, mas continuar acima do mínimo, vale a alíquota em vigor na data do câmbio do pagamento.', 'Decreto 6.306/2007, art. 15-B, §§ 2º e 3º; Solução de Consulta Cosit 61/2014 (ementa, regra anterior)'],
  ['Renovação e conversão em capital', 'Hoje a norma do Banco Central pede nova declaração em 30 dias quando muda o vencimento, a condição financeira ou o devedor, e também quando o empréstimo é convertido em capital. Decisões da Receita de 2014 a 2017, dadas sob normas de câmbio já revogadas, tratavam renovação e repactuação como operações de câmbio para o imposto, e a conversão em capital antes do prazo médio mínimo como liquidação antecipada. O tratamento atual pela Receita não foi confirmado: consultar o tributário.', 'Res. BCB 278, arts. 5º, 25 e 25-A; Soluções de Consulta Cosit 248/2014, 261/2014 e 597/2017 e Disit/SRRF10 10001/2015 (ementas)'],
  ['Títulos com opção de antecipação', 'Em empréstimo por emissão de títulos com cláusula de antecipação do vencimento, pelo credor ou pelo devedor, a primeira data de exercício define a incidência do imposto.', 'Decreto 6.306/2007, art. 15-B, § 1º'],
  ['IR na fonte sobre os juros', '15%, só sobre os juros. Quando o tomador assume o imposto, a base é reajustada: 100 de juros viram 117,65. País com tributação favorecida: 25% (a confirmar com o tributário).', 'RIR/2018, arts. 760 e 786; IN RFB 1.455/2014, art. 1º'],
  ['Swap', 'IR na fonte sobre o ganho na liquidação, de 22,5% a 15% conforme o prazo, compensável no IRPJ. IOF sobre derivativos: zero desde 2013.', 'IN RFB 1.585/2015, arts. 46, 50 e 70; Decreto 6.306, art. 32-C, § 15; IN RFB 1.969/2020, art. 18'],
  ['NDF', 'Sem ajuste diário e sem margem. Liquida pela diferença no vencimento, com a PTAX do dia útil anterior. Exige contrato geral de derivativos. IR na fonte de 0,005%.', 'Ficha B3 do Termo de Moeda; Lei 11.033/2004, art. 2º; IN RFB 1.585/2015, art. 63'],
  ['PIS/Cofins', '4,65% sobre ganho financeiro, inclusive de hedge. Zero sobre a variação cambial do empréstimo e sobre hedge de proteção em bolsa ou balcão organizado. Vale até 2026: segundo fontes de terceiros, em 2027 a reforma tributária extingue o PIS/Cofins; o tratamento do ganho financeiro deve ser confirmado com o tributário.', 'Decreto 8.426/2015, art. 1º, §§ 3º e 4º'],
  ['Perdas no hedge', 'Dedutíveis sem o limite dos ganhos quando a operação protege obrigação da empresa.', 'Lei 8.981/1995, art. 77; IN RFB 1.585, art. 71'],
  ['IOF do capital de giro (comparação)', 'Empréstimo em reais para pessoa jurídica: 0,38% sobre o valor mais 0,0082% ao dia sobre cada parcela de principal, limitado a 365 dias. É o imposto que a tela mostra como economia de IOF; o empréstimo externo não paga esse IOF. A alíquota diária tem a redação de 2025, que depende da mesma decisão provisória do STF.', 'Decreto 6.306/2007, art. 7º, I, b, e § 15 (redação do Decreto 12.499/2025), e § 1º · mesma regra das calculadoras de crédito do Painel'],
]

// Ícone: globo (recurso de fora) com a seta de entrada no país.
export function Emprestimo4131Icon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="10" r="7" />
      <path d="M3 10h14M10 3c2.2 2 2.2 12 0 14M10 3c-2.2 2-2.2 12 0 14" />
      <path d="M14.5 14.5 21 21M21 16.5V21h-4.5" />
    </svg>
  )
}

// Empréstimo externo (4131) no padrão da calculadora BNDES: dados à esquerda, cotação à direita, apresentação e PDF
// congelados. A tela abre no formato das cotações de banco de 4131 com NDF: poucos campos (valor em reais, moeda,
// cotação de partida, parcelas, taxa all-in e data) e o resto no padrão (principal e juros mensais, parcelas iguais,
// datas a cada 30 dias em dia útil, sem carência, IR já na taxa). O que foge do padrão fica em "Mais opções".
// `quotes`: cotações do Painel (dólar e euro); o câmbio do campo usa a primeira que chegar e só troca a pedido.
export default function Emprestimo4131({ onBack, quotes }) {
  const hol = useHolidays()
  const curves = useCurves()
  const [area, setArea] = useState('simulate')
  const [curveMode, setCurveMode] = useState(CURVAS_DO_PAINEL ? 'painel' : 'manual')
  const [feesAbroad, setFeesAbroad] = useState('nao')
  const [ampliada, setAmpliada] = useState(false)
  const ampliarRef = useRef(null)
  const [valorText, setValorText] = useState('10.000.000,00')
  const [rateText, setRateText] = useState('5,80')
  const [currency, setCurrency] = useState('USD')
  const [amort, setAmort] = useState('parcelas')
  const [graceText, setGraceText] = useState('0')
  const [calendar, setCalendar] = useState('30d')
  const [spotText, setSpotText] = useState('')
  const [spotOwn, setSpotOwn] = useState(false)
  const [spotSrc, setSpotSrc] = useState({})
  const [start, setStart] = useState(cgToday)
  const [monthsText, setMonthsText] = useState('36')
  const [freq, setFreq] = useState('1')
  const [irrf, setIrrf] = useState('15')
  const [grossUp, setGrossUp] = useState('nao')
  const [flatText, setFlatText] = useState('0,00')
  const [guaranteeText, setGuaranteeText] = useState('0,00')
  const [diText, setDiText] = useState('12,75')
  const [diOwn, setDiOwn] = useState(false)
  const [cupomText, setCupomText] = useState('')
  const [cupomOwn, setCupomOwn] = useState(false)
  const [swapText, setSwapText] = useState('0,00')
  const [ndfText, setNdfText] = useState('0,00')
  // Atingir meta: o custo desejado e a taxa que a tela calculou para chegar nele (ou o motivo de não ter chegado).
  const [fwdMode, setFwdMode] = useState('estimar')
  const [fwdText, setFwdText] = useState('')
  const [metaKind, setMetaKind] = useState('cetMes')
  const [metaText, setMetaText] = useState('')
  const [meta, setMeta] = useState(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!ampliada) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) setAmpliada(false) }
    const previous = document.body.style.overflow, trigger = ampliarRef.current
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', onKey); trigger?.focus()
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; trigger?.focus() }
  }, [ampliada])

  const cur = moedaOf(currency)
  const usd = (v) => `${cur.sym}\u00a0${dec(v)}`
  // Câmbio do dia: a primeira cotação do Painel que chegar para a moeda fica no campo; novas cotações não mexem no
  // resultado sozinhas (botão Atualizar). Digitou, vale o digitado.
  const quote = quotes?.[currency]
  const painel = quote && quote.bid > 0 && quote.timestamp > 0 ? quote : null
  useEffect(() => {
    if (painel) setSpotSrc((prev) => (prev[currency] ? prev : { ...prev, [currency]: { bid: painel.bid, at: painel.timestamp, ref: !!(painel.fallback || painel.stale) } }))
  }, [painel, currency])
  const src = spotSrc[currency] ?? null
  const usarPainel = () => { if (painel) setSpotSrc((prev) => ({ ...prev, [currency]: { bid: painel.bid, at: painel.timestamp, ref: !!(painel.fallback || painel.stale) } })); setSpotOwn(false) }
  const spotShown = spotOwn ? spotText : src ? fx(src.bid) : EXEMPLO[currency].spot
  const cupomShown = cupomOwn ? cupomText : EXEMPLO[currency].cupom

  // Como na cotação: o valor entra em reais e o principal na moeda sai pela cotação de partida.
  const money = parseMoneyInput(valorText)
  const rate = parseDecimal(rateText)
  const spot = parseDecimal(spotShown)
  const months = /^\d+$/.test(monthsText.trim()) ? Number(monthsText) : null
  const grace = /^\d+$/.test(graceText.trim()) ? Number(graceText) : null
  const optional = (text) => (text.trim() === '' ? 0 : parseDecimal(text))
  const flat = optional(flatText)
  const guarantee = optional(guaranteeText)
  const cupom = parseDecimal(cupomShown)
  const swapSpread = optional(swapText)
  const ndfMarkup = optional(ndfText)
  const errors = {
    valor: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    rate: rate !== null && rate <= 100 ? null : 'Informe a taxa em % ao ano, por exemplo 5,80.',
    spot: spot !== null && spot > 0 ? null : 'Informe a cotação, por exemplo 5,4000.',
    start: start ? null : 'Informe a data da cotação.',
    months: months !== null && months >= 1 && months <= MAX_MONTHS ? null : `Informe o prazo em meses, número inteiro de 1 a ${MAX_MONTHS}.`,
    grace: amort !== 'parcelas' || grace !== null ? null : 'Informe quantos pagamentos são só de juros (zero se não houver).',
    flat: flat !== null && flat < 100 ? null : 'Informe o flat em % (zero se não houver).',
    guarantee: guarantee !== null && guarantee <= 100 ? null : 'Informe a fiança em % ao ano (zero se não houver).',
    di: null,
    cupom: cupom !== null ? null : `Informe o ${cur.juro.toLowerCase()} em % ao ano, por exemplo ${EXEMPLO[currency].cupom}.`,
    swap: swapSpread !== null ? null : 'Informe o spread do banco em % ao ano (zero se não houver).',
    ndf: ndfMarkup !== null ? null : 'Informe o acréscimo do banco em % (zero se não houver).',
  }
  // Curvas DI x pré e cupom cambial da B3 já coletadas pelo Painel. Sem elas, ou com desembolso antes da data-base, vale o modo manual.
  const diCurve = hojeOf(curves.data?.br)
  const ccCurve = hojeOf(curves.data?.cc)
  const curveBase = diCurve && ccCurve ? diCurve.date : null
  const curveBlocked = !curveBase ? (curves.status === 'loading' ? 'Carregando as curvas do Painel…' : 'Curvas do Painel indisponíveis: usando DI e cupom digitados.') : start && start < curveBase ? `As curvas começam em ${dm(curveBase)}: para desembolso anterior, usando DI e cupom digitados.` : null
  const usingCurve = curveMode === 'painel' && !curveBlocked && !!start
  // Operação sem a taxa: prazos, datas e prazo médio não dependem dela. Serve ao DI do prazo, à conferência das taxas
  // coladas e ao Atingir meta, que funciona mesmo com o campo da taxa vazio.
  const baseErrors = ['valor', 'spot', 'start', 'months', 'grace', 'flat', 'guarantee'].some((k) => errors[k])
  const baseParams = baseErrors ? null : { currency, principal: money.value / spot, spot, start, months, freq: Number(freq), irrf: Number(irrf), grossUp: grossUp === 'sim', flat, guarantee, feesAbroad: feesAbroad === 'sim', amort, grace: amort === 'parcelas' ? grace : 0, calendar, nextBusDay: (d) => nextBusinessDay(d, ['BR'], hol.ctx) }
  const esqueletoResult = baseParams ? loan4131({ ...baseParams, rate: 0 }) : null
  const esqueleto = esqueletoResult?.ok ? esqueletoResult : null
  const loanResult = baseParams && !errors.rate ? loan4131({ ...baseParams, rate }) : esqueletoResult && !esqueletoResult.ok ? esqueletoResult : null
  const loan = loanResult?.ok ? loanResult : null
  // DI pré do prazo médio, lido da curva DI x pré da B3 que o Painel coleta. Digitou, vale o digitado.
  const diAuto = esqueleto && diCurve && esqueleto.start >= diCurve.date ? diDoPrazo(diCurve.pts, busDaysIn(diCurve.date, esqueleto.start, ['BR'], hol.ctx), busDaysIn(esqueleto.start, addDays(esqueleto.start, esqueleto.avgTermDays), ['BR'], hol.ctx)) : null
  const diDoPainel = !diOwn && diAuto != null
  const diShown = diDoPainel ? dec(diAuto) : diText
  const di = parseDecimal(diShown)
  errors.di = di !== null && di > 0 ? null : 'Informe o DI pré em % ao ano, por exemplo 12,75.'
  if (usingCurve) { errors.di = null; errors.cupom = null }
  // Taxas futuras coladas da mesa: uma por pagamento, na ordem dos vencimentos. Com elas, o juro da moeda não é usado.
  const mesa = fwdMode === 'mesa' && !usingCurve
  const coladas = lerTaxasFuturas(fwdText)
  errors.fwd = !mesa ? null
    : coladas.bad ? `"${coladas.bad}" não é uma taxa. Cole só os números, um por linha, por exemplo 5,4321.`
      : !coladas.rates.length ? 'Cole as taxas futuras da cotação, uma por linha, na ordem dos vencimentos.'
        : coladas.rates.some((v) => !(v > 0)) ? 'As taxas futuras precisam ser maiores que zero.'
          : esqueleto && coladas.rates.length !== esqueleto.flows.length ? faltaOuSobra(coladas.rates.length, esqueleto.flows.length)
            : null
  if (mesa) errors.cupom = null
  const hedgeErrors = ['di', 'cupom', 'fwd', 'swap', 'ndf'].some((k) => errors[k])
  // Dias úteis de cada pagamento com os feriados nacionais.
  const curve = usingCurve && loan ? curveFactors({ diPts: diCurve.pts, ccPts: ccCurve.pts, d0: busDaysIn(curveBase, start, ['BR'], hol.ctx), dc0: Math.round((Date.parse(`${start}T12:00:00Z`) - Date.parse(`${curveBase}T12:00:00Z`)) / DAY) }) : null
  const hedgeParams = { di, cupom, swapSpread, ndfMarkup, curve, busDays: (a, b) => busDaysIn(a, b, ['BR'], hol.ctx), forwards: mesa ? coladas.rates : null }
  const hedgeResult = loan && !hedgeErrors ? hedge4131(loan, hedgeParams) : null
  const hedge = hedgeResult?.ok ? hedgeResult : null
  const scenarios = loan ? E4_FX_SCENARIOS.map((s) => unhedged4131(loan, s)).filter((s) => s.ok) : []
  const parado = scenarios.find((s) => s.fxChange === 0) ?? null
  const juro = cur.juro.toLowerCase()
  const origemDi = diDoPainel ? `DI da curva B3 de ${dm(diCurve.date)}` : diOwn ? 'DI digitado' : 'DI de exemplo'
  const curveLabel = usingCurve ? `Curvas do Painel (B3) de ${dm(curveBase)}` : mesa ? `Taxas futuras da mesa, coladas; ${origemDi} para o equivalente em CDI` : `${origemDi} e ${juro} ${cupomOwn ? 'digitado' : 'de exemplo'}, iguais para todos os prazos`
  const parcelas = loan ? loan.flows.filter((f) => f.principal > 0).length : 0
  const amortLabel = loan?.amort === 'parcelas' ? `Em ${parcelas} parcelas iguais${loan.grace ? `, depois de ${loan.grace} ${loan.grace === 1 ? 'pagamento' : 'pagamentos'} só de juros` : ''}` : 'No vencimento'
  const datesLabel = calendar === '30d' ? 'A cada 30 dias corridos, no próximo dia útil' : 'Mesmo dia do mês, sem ajuste para dia útil'
  const labels = { freq: FREQS.find((f) => f.id === freq)?.label, irPayer: IR_PAYERS.find((p) => p.id === grossUp)?.label, curve: curveLabel, fees: FEE_PLACES.find((p) => p.id === feesAbroad)?.label, amort: amortLabel, dates: datesLabel }
  // Avisos de fronteira: a conta não muda, mas o resultado depende de detalhe que vale confirmar.
  const passo = Number(freq) || months
  // Taxas coladas: juro da moeda implícito em cada pagamento (com o DI informado) e sinais de colagem errada.
  const colado = hedge?.source === 'mesa'
  const implicitos = colado ? hedge.flows.map((f) => (f.ccFactor - 1) * 360 / f.dc * 100) : []
  const implMin = Math.min(...implicitos)
  const implMax = Math.max(...implicitos)
  const fora = colado ? hedge.flows.findIndex((f, i) => i > 0 && f.forward < hedge.flows[i - 1].forward) : -1
  const avisosMesa = colado ? [
    fora > 0 && `A ${fora + 1}ª taxa colada é menor que a anterior: confira a ordem e os valores.`,
    (implMin < -20 || implMax > 40) && `As taxas coladas levam a um ${juro} implícito entre ${pct(implMin)} e ${pct(implMax)} a.a.: confira se são taxas futuras cheias (não pontos de termo) e se a cotação de partida é a da mesa.`,
    hedge.ndf.cetMes < 0 && 'O custo efetivo ficou negativo: confira as taxas coladas.',
    ndfMarkup > 0 && `Há um acréscimo do banco de ${pct(ndfMarkup)} por cima das taxas coladas (em Mais opções). Se elas já são as taxas fechadas, deixe o acréscimo em zero.`,
  ].filter(Boolean) : []
  const avisos = loan ? [
    loan.iofRate > 0 && loan.avgTermExact >= 355 && `Prazo médio de ${dec(loan.avgTermExact, 1)} dias corridos, dentro do limite de ${IOF_SHORT_TERM.maxDays}: a tela aplica o IOF-câmbio de ${pct(IOF_SHORT_TERM.rate)}.${calendar === '30d' ? ' Na regra de 30 dias, 12 meses somam 360 dias.' : ''} Poucos dias a mais levam o IOF a zero: confirme o prazo médio com o câmbio do banco.`,
    fronteiraIof(loan) && `Prazo médio de ${dec(loan.avgTermExact, 2)} dias corridos, entre ${IOF_SHORT_TERM.maxDays} e ${IOF_SHORT_TERM.maxDays + 1}: a tela usa o prazo exato, mostra ${loan.avgTermDays} (arredondado para cima) e aplica IOF-câmbio zero. Não localizamos regra oficial de arredondamento: se o banco ou a Receita desprezarem a fração, o IOF é de ${pct(IOF_SHORT_TERM.rate)} do valor. Confirme com o câmbio do banco antes de fechar.`,
    loan.amort === 'parcelas' && months % passo !== 0 && `O prazo de ${months} meses não é múltiplo do período dos pagamentos: a última parcela vence em intervalo mais curto que as demais.`,
    loan.start < '2025-07-17' && 'Desembolso anterior a 17/07/2025: o IOF-câmbio e a economia de IOF usam as alíquotas atuais, que não valiam nessa data.',
  ].filter(Boolean).concat(avisosMesa) : []
  // De onde veio cada cotação do campo, com o caminho de volta para a do Painel.
  const link = (texto, onClick) => <button type="button" className="e4-link" onClick={onClick}>{texto}</button>
  const spotNote = spotOwn ? <>Digitado.{painel && <> {link(`Usar o do Painel (${fx(painel.bid)})`, usarPainel)}</>}</>
    : src ? <>Painel · {quando(src.at)}{src.ref ? ' · referência do dia' : ''}{painel && painel.timestamp !== src.at && <> · {link('Atualizar', usarPainel)}</>}</>
      : <><span className="e4-exemplo">Valor de exemplo</span>: sem a cotação do Painel agora.</>
  const diNote = diOwn ? <>digitado.{diAuto != null && <> {link(`Usar o do Painel (${pct(diAuto)})`, () => setDiOwn(false))}</>}</>
    : diAuto != null ? `do Painel, curva DI da B3 de ${dm(diCurve.date)}, para o prazo médio de ${esqueleto.avgTermDays} dias.`
      : <><span className="e4-exemplo">valor de exemplo</span>, {!diCurve ? 'sem a curva DI do Painel agora' : !esqueleto ? 'complete os dados da operação' : esqueleto.start < diCurve.date ? `a curva do Painel começa em ${dm(diCurve.date)}` : 'a curva do Painel não cobre este prazo'}.</>
  const cupomNote = mesa || cupomOwn ? null : <><span className="e4-exemplo">valor de exemplo</span>; digite o da sua cotação.</>
  const pendencia = loanResult?.error || (hedgeResult?.error && mesa ? `${hedgeResult.error} Revise as taxas coladas.` : hedgeResult?.error) || (Object.values(errors).some(Boolean) ? 'Complete os campos indicados para calcular.' : null)

  // Atingir meta: procura a taxa all-in que leva o resultado à meta e a coloca no campo da taxa.
  const metaAtual = METAS.find((m) => m.id === metaKind)
  const atingir = () => {
    // A meta em CDI + pode ser negativa (CDI − x); as de custo efetivo, não.
    const texto0 = metaText.trim().replace('−', '-')
    const negativa = metaKind === 'spread' && texto0.startsWith('-')
    const lido = parseDecimal(negativa ? texto0.slice(1) : texto0)
    if (lido === null) return setMeta({ erro: `Informe a meta em %, por exemplo ${metaKind === 'spread' ? '3,20' : '1,30'}.` })
    const alvo = negativa ? -lido : lido
    if (!baseParams || hedgeErrors) return setMeta({ erro: 'Complete os dados da operação antes de calcular.' })
    const r = metaTaxa4131(baseParams, hedgeParams, metaKind, alvo)
    if (!r.ok) return setMeta({ erro: r.error })
    const texto = dec(r.rate, 4)
    const meta4 = (v) => `${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`
    setRateText(texto)
    setMeta({ rateText: texto, alvo: { cetMes: `custo efetivo de ${meta4(alvo)} ao mês`, cetAno: `custo efetivo de ${meta4(alvo)} ao ano`, spread: `CDI ${alvo < 0 ? '−' : '+'} ${meta4(alvo)}` }[metaKind] })
  }
  const metaNote = meta?.erro ? <span className="e4-exemplo">{meta.erro}</span>
    : meta && meta.rateText === rateText && hedge ? `Taxa all-in de ${cur.Nome} + ${meta.rateText}% a.a., calculada para chegar ao ${meta.alvo}.`
      : null
  const copiar = async () => {
    const texto = resumoE4({ loan, hedge })
    if (!texto) return
    try { await navigator.clipboard.writeText(texto) } catch {
      const area = document.createElement('textarea')
      area.value = texto; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'
      document.body.appendChild(area); area.select()
      try { document.execCommand('copy') } finally { area.remove() }
    }
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }
  // Padrão da cotação de banco e o que está fora dele (aparece no resumo de "Mais opções").
  const padrao = freq === '1' && amort === 'parcelas'
  const foraDoPadrao = [freq !== '1', calendar !== '30d', amort !== 'parcelas', amort === 'parcelas' && grace !== 0, grossUp !== 'nao', flat !== 0, guarantee !== 0, feesAbroad !== 'nao', ndfMarkup !== 0, swapSpread !== 0].filter(Boolean).length
  const [maisAberto, setMaisAberto] = useState(false)
  const entrada = loan ? loan.flatUsd + loan.iofUsd + loan.flatIrUsd : 0
  const ajuda = (label, texto) => (texto ? <Help label={`Ajuda: ${label}`}>{texto}</Help> : null)
  const field = (key, slot, label, control, hint, note) => (
    <div className={`cx-field fm-field-${slot}`}>
      <span className="fm-rotulo"><label htmlFor={`e4-${key}`}>{label}</label>{ajuda(label, hint)}</span>
      {control}
      {note && <p className="e4-origem" id={`e4-${key}-origem`}>{note}</p>}
      <p className="cx-error" id={`e4-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`e4-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!errors[key]} aria-describedby={`e4-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...extra} />
  const rateInput = (key, value, onChange, unit = '% a.a.') => <div className="cx-rate">{input(key, value, onChange)}<span className="fm-unidade">{unit}</span></div>
  const select = (key, value, onChange, options, disabled = false) => <select id={`e4-${key}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
  const quadros = loan ? [
    [`Custo all-in em ${cur.nome}`, `${pct(loan.allIn)} a.a.`, 'dias corridos/365', `Taxa ao ano que iguala o valor líquido recebido aos pagamentos em ${cur.nome}: juros, IR do tomador, fiança e principal.`],
    ['Taxa com o IR por cima', `${pct(loan.grossedRate)} a.a.`, `contratual ${pct(loan.rate)}`, 'Taxa contratual dividida por (1 − alíquota do IR), quando o tomador assume o imposto.'],
    ['Valor líquido recebido', brl(loan.netBrl), usd(loan.netUsd), 'Principal menos flat, IOF e IR sobre o flat (quando pago ao exterior), convertido pelo câmbio de entrada.'],
    ['Flat na entrada', usd(loan.flatUsd), pct(loan.flat)],
    ['IOF-câmbio na entrada', usd(loan.iofUsd), pct(loan.iofRate), `Prazo médio de ${loan.avgTermDays} dias corridos: ${pct(IOF_SHORT_TERM.rate)} até ${IOF_SHORT_TERM.maxDays} dias e zero acima (Decreto 6.306/2007, art. 15-B).`],
    ['IR pago pelo tomador', usd(loan.totals.irrf + loan.flatIrUsd), loan.grossUp ? `${pct(loan.irrf, 0)} sobre a base reajustada` : 'imposto suportado pelo credor', 'Com gross-up, o IR é a alíquota sobre o valor reajustado: valor × alíquota ÷ (1 − alíquota). Incide sobre os juros e, quando flat e fiança são pagos ao exterior, também sobre essas comissões.'],
    ['Juros totais', usd(loan.totals.interest), `prazo médio de ${loan.avgTermDays} dias`],
    ['Total a pagar', usd(loan.totals.usd), `em ${cur.nome}`],
  ] : []

  return (
    <section className="cx bw e4 calc-standard" aria-labelledby="bw-title">
      <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <div className="bw-heading"><h2 id="bw-title"><strong>4131</strong><span>Empréstimo externo</span></h2>
        <nav className="bw-nav" aria-label="Área do empréstimo externo">
          <button type="button" aria-pressed={area === 'simulate'} onClick={() => setArea('simulate')} aria-label="Simular empréstimo">Simular</button>
          <button type="button" aria-pressed={area === 'rules'} onClick={() => setArea('rules')}>Regras e fontes</button>
        </nav></div>

      <div hidden={area !== 'simulate'} className="bw-simulation">
        <section className="cx cx-finame" aria-label="Simulação">
          <div className="fm-workspace">
            <article className="desk-panel cx-panel fm-input-panel">
              <header className="fm-rules"><h3 className="cx-heading sr-only">Dados da operação</h3><small>Regras conferidas em {CONFERIDO_EM} · IOF relido em {IOF_RELIDO_EM}</small>{ajuda('Regras e fontes', <><p>Regras do Banco Central, da Receita Federal e da B3 lidas nas fontes oficiais, salvo as indicadas em Regras e fontes. As do IOF foram relidas em {IOF_RELIDO_EM}.</p><ul>{E4_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></>)}</header>
              <div className="cx-form">
                <section className="e4-meta" aria-labelledby="e4-meta-h">
                  <h3 id="e4-meta-h">Atingir meta{ajuda('Atingir meta', 'Digite o custo que você quer chegar e a tela calcula a taxa all-in (moeda + % ao ano) que leva a ele, mantendo valor, parcelas, cotação, DI e juro da moeda. A taxa calculada vai para o campo Taxa all-in, com quatro casas, e todo o resto é recalculado.')}</h3>
                  <div className="e4-meta-campos">
                    <select id="e4-meta-kind" aria-label="Meta" value={metaKind} onChange={(e) => { setMetaKind(e.target.value); setMeta(null) }}>{METAS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
                    <div className="cx-rate"><input id="e4-meta" aria-label={`Meta em ${metaAtual.unit}`} aria-describedby="e4-meta-status" inputMode="decimal" autoComplete="off" placeholder={metaKind === 'spread' ? 'ex.: 3,20' : 'ex.: 1,30'} value={metaText} onChange={(e) => setMetaText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') atingir() }} onFocus={(e) => e.target.select()} /><span className="fm-unidade">{metaAtual.unit}</span></div>
                    <button type="button" className="e4-meta-btn" onClick={atingir}>Calcular taxa</button>
                  </div>
                  <p className="e4-origem" id="e4-meta-status" role="status">{metaNote}</p>
                </section>
                <section className="fm-group fm-operation" aria-labelledby="e4-operation-h"><h3 id="e4-operation-h"><BndesIcon kind="operation" />Operação</h3><div className="fm-group-fields">
                  {field('valor', 'valor', 'Principal (R$)', <MoneyInput prefix="R$" id="e4-valor" aria-invalid={!!errors.valor} aria-describedby="e4-valor-err" value={valorText} onChange={setValorText} />, 'Principal da operação, sempre em reais. O valor na moeda sai dele pela cotação de partida, como na cotação do banco.')}
                  {field('currency', 'moeda', 'Moeda', select('currency', currency, (v) => { setCurrency(v); setSpotOwn(false); setCupomOwn(false) }, MOEDAS.map((m) => ({ id: m.id, label: m.Nome }))), 'Moeda do empréstimo: dólar ou euro. A conta é a mesma nas duas.')}
                  <div className="cx-field fm-field-convertido">
                    <span className="fm-rotulo"><label htmlFor="e4-convertido">Valor em {cur.nome}</label>{ajuda(`Valor em ${cur.nome}`, 'Calculado pela tela: principal em reais dividido pela cotação de partida. É sobre ele que correm os juros.')}</span>
                    <input id="e4-convertido" readOnly aria-readonly="true" tabIndex={0} value={loan ? usd(loan.principal) : esqueleto ? usd(esqueleto.principal) : '—'} />
                  </div>
                  {field('spot', 'car', `Cotação de partida (R$/${cur.sym})`, input('spot', spotShown, (v) => { setSpotText(v); setSpotOwn(true) }, { 'aria-describedby': 'e4-spot-origem e4-spot-err' }), `Reais por ${cur.nome} no dia do desembolso. Converte o principal e é a base da taxa futura. Já vem com a cotação do Painel; você pode trocar.`, spotNote)}
                  {field('months', 'prazo', padrao ? 'Parcelas mensais' : 'Prazo total (meses)', input('months', monthsText, setMonthsText, { inputMode: 'numeric' }), `De 1 a ${MAX_MONTHS}. No padrão, cada mês tem uma parcela de principal e juros. O prazo médio define o IOF na entrada: até ${IOF_SHORT_TERM.maxDays} dias, ${pct(IOF_SHORT_TERM.rate)}.`)}
                  {field('rate', 'part', `Taxa all-in (${cur.Nome} +)`, rateInput('rate', rateText, setRateText), 'Taxa ao ano sobre a moeda, como vem na cotação, já com IR e comissões. Juros lineares sobre o saldo: saldo × taxa × dias corridos ÷ 360. Se a sua taxa ainda não tem o IR, abra Mais opções e escolha somar o IR à taxa.', meta && !meta.erro && meta.rateText === rateText ? 'Calculada pela meta.' : null)}
                  {field('start', 'data-lib', 'Data da cotação', input('start', start, setStart, { type: 'date', inputMode: undefined, min: '2000-01-01', max: '2100-12-31' }), 'Data da cotação e do desembolso. Os vencimentos contam a partir dela.')}
                  {start > cgToday() && <p className="cx-hint e4-future" role="status">Desembolso em data futura: informe a cotação esperada para esse dia, não a de hoje. O DI e o juro da moeda (ou as taxas futuras coladas) também devem ser os do período a partir do desembolso.</p>}
                  <ul className="fm-pills" aria-label="Condições da operação">{freq !== '1' && <li>Pagamentos <b>{FREQ_PLURAL[freq]}</b></li>}<li>Principal <b>{amort === 'parcelas' ? `em parcelas iguais${loan?.grace ? `, carência de ${loan.grace}` : ''}` : 'no vencimento'}</b></li><li>Datas <b>{calendar === '30d' ? 'a cada 30 dias, em dia útil' : 'no dia fixo do mês'}</b></li><li>IOF na entrada <b>{loan ? pct(loan.iofRate) : 'automático'}</b></li></ul>
                </div></section>
                <section className="fm-group fm-payment e4-hedge" aria-labelledby="e4-hedge-h"><h3 id="e4-hedge-h"><BndesIcon kind="chart" />Proteção cambial (NDF)</h3><div className="fm-group-fields">
                  {CURVAS_DO_PAINEL && field('curve', 'curve', 'DI e cupom cambial', select('curve', curveMode, setCurveMode, CURVE_MODES), 'Curvas do Painel: cada pagamento usa o DI e o cupom cambial do seu prazo, das curvas da B3 já coletadas. Digitar: um DI e um cupom para todos os prazos; em prazo longo, o cupom linear único tende a encarecer a leitura.')}
                  {!usingCurve && field('fwdMode', 'modo', 'Taxa futura', select('fwdMode', fwdMode, setFwdMode, FWD_MODES), 'Estimar: a tela calcula a taxa futura de cada parcela com o DI e o juro da moeda. Colar as da mesa: você cola as taxas futuras fechadas da cotação do banco, uma por parcela, e o resultado passa a usar exatamente essas taxas.')}
                  {usingCurve ? <p className="fm-financed e4-curve" aria-live="polite"><span>Até o vencimento · {dm(curveBase)}</span><b>{hedge ? `DI ${pct(hedge.di)} · cupom ${pct(hedge.cupom)}` : '—'}</b></p> : <>
                    {field('di', 'di', 'DI pré do prazo', rateInput('di', diShown, (v) => { setDiText(v); setDiOwn(true) }), mesa ? 'Taxa DI prefixada do prazo médio da operação, ao ano, base 252 dias úteis. Com as taxas da mesa coladas, o DI serve só para o equivalente em CDI, que muda quase ponto por ponto com ele: use o DI do momento da cotação da mesa. Já vem da curva DI da B3 que o Painel coleta; você pode trocar.' : 'Taxa DI prefixada do prazo médio da operação, ao ano, base 252 dias úteis. Já vem da curva DI da B3 que o Painel coleta; você pode trocar.')}
                    {!mesa && field('cupom', 'cupom', cur.juro, rateInput('cupom', cupomShown, (v) => { setCupomText(v); setCupomOwn(true) }), `Juro em ${cur.nome} no Brasil para o prazo médio, ao ano, linear, base 360 dias corridos. Com o DI, define a taxa futura de cada parcela. Na cotação do banco, a taxa futura vem fechada pela mesa; aqui ela é estimada. O Painel não tem essa taxa confiável: digite a da sua cotação.`)}
                    {mesa && <div className="cx-field e4-colar">
                      <span className="fm-rotulo"><label htmlFor="e4-fwd">Taxas futuras da mesa</label>{ajuda('Taxas futuras da mesa', 'Copie a coluna de taxa futura da planilha ou do e-mail de cotação e cole aqui: uma taxa por linha, na ordem dos vencimentos, uma para cada pagamento. Vale vírgula ou ponto decimal.')}</span>
                      <textarea id="e4-fwd" rows={Math.min(12, Math.max(4, fwdText.split('\n').length))} inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={'5,4321\n5,4688\n5,5012'} aria-invalid={!!errors.fwd} aria-describedby="e4-fwd-origem e4-fwd-err" value={fwdText} onChange={(e) => setFwdText(e.target.value)} />
                      <p className="e4-origem e4-ok" id="e4-fwd-origem">{errors.fwd ? '' : `✓ ${coladas.rates.length} de ${esqueleto ? esqueleto.flows.length : '—'} ${esqueleto?.flows.length === 1 ? 'taxa' : 'taxas'}${colado ? ` · ${juro} implícito ${implicitos.length > 1 ? `de ${pct(implMin)} a ${pct(implMax)}` : `de ${pct(implMin)}`} a.a., com o DI informado` : ''}`}</p>
                      <p className="cx-error" id="e4-fwd-err" role={errors.fwd ? 'alert' : undefined}>{errors.fwd ?? ''}</p>
                    </div>}
                  </>}
                  {!usingCurve && <p className="e4-origem" id="e4-protecao-origem"><b>DI:</b> {diNote}{cupomNote && <> <b>{cur.juro}:</b> {cupomNote}</>}</p>}
                  {curveMode === 'painel' && curveBlocked && <p className="cx-hint e4-curve-note" role="status">{curveBlocked}</p>}
                </div></section>
                <details className="e4-mais" open={maisAberto} onToggle={(e) => setMaisAberto(e.currentTarget.open)}>
                  <summary>Mais opções{foraDoPadrao > 0 && <small>{foraDoPadrao === 1 ? '1 item fora do padrão' : `${foraDoPadrao} itens fora do padrão`}</small>}</summary>
                  <div className="cx-field-label cx-hint"><span>Condições padrão</span>{ajuda('Condições padrão', 'O padrão segue a cotação de banco: principal e juros mensais, parcelas iguais, datas a cada 30 dias em dia útil, sem carência, sem tarifa e IR já dentro da taxa all-in. Mude só o que for diferente na sua operação.')}</div>
                  <section className="fm-group fm-operation e4-opcoes" aria-label="Mais opções da operação"><div className="fm-group-fields">
                    {field('freq', 'per', 'Pagamentos', select('freq', freq, setFreq, FREQS), 'Frequência dos pagamentos de juros. As parcelas de principal, quando houver, caem nas mesmas datas.')}
                    {field('calendar', 'datas', 'Regra das datas', select('calendar', calendar, setCalendar, CALENDARIOS), 'Cada 30 dias: como nas cotações de banco, cada mês conta 30 dias corridos (30 no mensal, 90 no trimestral, 180 no semestral). O primeiro pagamento vai para o próximo dia útil e os demais contam a partir dele, também em dia útil. Atenção: 12 meses somam 360 dias. Dia fixo: datas pelo dia do desembolso, mês a mês, sem ajuste para dia útil.')}
                    {field('amort', 'amort', 'Amortização', select('amort', amort, setAmort, AMORTS), 'Em parcelas: amortização constante, em parcelas iguais a cada pagamento, com juros sobre o saldo que resta. No vencimento: o principal é pago de uma vez, no fim.')}
                    {field('grace', 'carencia', 'Carência (pagamentos)', input('grace', amort === 'parcelas' ? graceText : '', setGraceText, { inputMode: 'numeric', disabled: amort !== 'parcelas', placeholder: amort === 'parcelas' ? undefined : 'Só em parcelas' }), 'Número de pagamentos só de juros antes da primeira parcela de principal. Vale para principal em parcelas. Use zero se não houver.')}
                    {field('gross', 'porte', 'IR na fonte sobre os juros', select('gross', grossUp, setGrossUp, IR_PAYERS), 'Já incluído: a taxa all-in da cotação já traz o imposto, e nada é somado. Somar à taxa: o tomador paga o imposto por cima dos juros (gross-up), com a base reajustada (RIR/2018, art. 786).')}
                    {field('irrf', 'custo', 'Alíquota do IR', select('irrf', irrf, setIrrf, IRRF_OPTIONS, grossUp !== 'sim'), 'Usada só quando o IR é somado à taxa. Regra geral: 15% sobre os juros pagos ao exterior (RIR/2018, art. 760). Credor em país com tributação favorecida: 25%. Tratado ou isenção podem reduzir: confirme com o tributário.')}
                    {field('flat', 'bndes', 'Tarifa · flat', rateInput('flat', flatText, setFlatText, '%'), 'Comissão cobrada na entrada, em % do principal. Sai do valor recebido. Use zero se não houver.')}
                    {field('guarantee', 'agente', 'Fiança ou SBLC', rateInput('guarantee', guaranteeText, setGuaranteeText), 'Custo da garantia bancária, em % ao ano sobre o saldo, pago junto com os juros. Use zero se não houver.')}
                    {field('fees', 'pagos', 'Tarifa e fiança pagas a', select('fees', feesAbroad, setFeesAbroad, FEE_PLACES), 'Comissão paga a banco no exterior sofre o mesmo IR na fonte dos juros (RIR/2018, art. 760), quando o IR é somado à taxa. Comissão paga a banco no Brasil não tem esse IR. Confirme com o tributário.')}
                    {field('ndf', 'ndf', 'Acréscimo do banco no NDF', rateInput('ndf', ndfText, setNdfText, '%'), 'Percentual que o banco soma à taxa futura de cada pagamento, seja a estimada, seja a colada. O efeito ao ano é maior em prazo curto e menor em prazo longo. Com as taxas fechadas da mesa coladas, deixe zero.')}
                    {field('swap', 'swap', 'Spread do banco no swap', rateInput('swap', swapText, setSwapText), 'Vale só para a comparação com swap. Taxa ao ano do banco no swap, composta com o custo: (1 + custo) × (1 + spread). Deixe zero para ver o custo teórico.')}
                  </div></section>
                </details>
                <button type="button" className="fm-show-result" disabled={!hedge} onClick={() => { const element = document.getElementById('fm-result'); element?.focus(); element?.scrollIntoView({ block: 'start' }) }}>{hedge ? <><span>Custo <b>{pct(hedge.ndf.cetMes)} a.m.</b></span><span>Ver resultado ↓</span></> : 'Ver resultado da simulação'}</button>
              </div>
            </article>

            <div className={ampliada ? 'fm-results fm-zoomed' : 'fm-results'}>
              <div className="fm-print-actions"><Emprestimo4131Presentation loan={loan} hedge={hedge} labels={labels} /><Emprestimo4131Print loan={loan} hedge={hedge} labels={labels} /></div>

              {ampliada && <div className="fm-zoom-backdrop" onClick={() => setAmpliada(false)} aria-hidden="true" />}
              <article className={ampliada ? 'desk-panel cx-panel fm-zoom' : 'desk-panel cx-panel'} aria-live="polite" id="fm-result" tabIndex={-1} role={ampliada ? 'dialog' : undefined} aria-modal={ampliada ? 'true' : undefined} aria-label={ampliada ? 'Cotação ampliada' : undefined}>
                <header className="fm-hero"><h3 className="cx-heading">Cotação · 4131 com NDF</h3><small>{hedge?.source === 'mesa' ? 'Com as taxas futuras da mesa' : 'Projeção · custo estimado'}</small>{ajuda('Limites da projeção', colado ? 'Simulação com as taxas futuras coladas da cotação da mesa: as parcelas em reais usam exatamente essas taxas. O equivalente em CDI depende do DI informado. Não inclui IR nem PIS/Cofins sobre ajuste positivo do NDF. A cotação confirmada pelo banco e o contrato prevalecem.' : 'Estimativa no formato das cotações de banco. A taxa futura de cada parcela é teórica, com um DI e um juro da moeda iguais para todos os prazos; a mesa do banco fecha uma taxa futura para cada vencimento e acrescenta o spread do derivativo e o risco de crédito. Não inclui IR nem PIS/Cofins sobre ajuste positivo do NDF. A cotação do banco e o contrato prevalecem.')}<button type="button" ref={ampliarRef} className="fm-zoom-toggle" disabled={!loan} aria-pressed={ampliada} aria-label={ampliada ? 'Fechar a cotação ampliada' : 'Ampliar a cotação na tela'} title={ampliada ? 'Fechar (Esc)' : 'Ampliar na tela'} onClick={() => setAmpliada((value) => !value)}><BndesIcon kind={ampliada ? 'collapse' : 'expand'} /></button></header>
                {hedge && <div className="fm-headline" aria-label="Custo efetivo total">
                  <div><span>Custo efetivo total{ajuda('Custo efetivo total', 'Taxa que iguala o valor líquido recebido em reais às parcelas travadas no NDF, por dias corridos. Ao mês: taxa de 30 dias. Ao ano: 12 meses de 30 dias (exp/360), como nas cotações de banco. ' + `Em ano de 365 dias, a mesma taxa é ${pct(hedge.ndf.cost365)} a.a.`)}</span><b>{pct(hedge.ndf.cetMes)} a.m.</b><small>{pct(hedge.ndf.cetAno)} a.a. · exp/360 · prefixado em reais</small></div>
                  <div><span>Equivalente a{ajuda('Equivalente em CDI', 'Spread sobre o CDI que leva ao mesmo custo, com cada parcela descontada pelo DI informado. É uma estimativa: o custo com NDF é fixo e não acompanha o CDI.')}</span><b>CDI {signed(hedge.ndf.spread, pct)}</b><small>Total das parcelas {brl(hedge.ndf.totalBrl)}</small><small>com DI de {pct(hedge.di)} a.a.{!diOwn && diAuto == null && !usingCurve ? ' (de exemplo)' : ''}</small></div>
                </div>}
                {hedge && <dl className="e4-cotacao" aria-label="Economia de IOF e equivalente em capital de giro">
                  <div><dt>Economia de IOF{ajuda('Economia de IOF', 'IOF de crédito que um capital de giro em reais, com o mesmo valor e as mesmas datas de principal, pagaria: 0,38% do valor mais 0,0082% ao dia sobre cada parcela, limitado a 365 dias (pessoa jurídica fora do Simples). O empréstimo externo não paga esse IOF. O IOF-câmbio da entrada, quando houver, é outro imposto: não é descontado aqui e já está no custo.')}</dt><dd><b>{brl(hedge.ndf.iofGiro)}</b><small>{loan.iofRate > 0 ? `IOF que o giro em reais pagaria. Não desconta o IOF-câmbio de ${pct(loan.iofRate)} desta operação, que já está no custo.` : 'IOF que um capital de giro em reais pagaria'}</small></dd></div>
                  <div><dt>Equivalente em capital de giro{ajuda('Equivalente em capital de giro', 'Taxa de um capital de giro em reais que leva ao mesmo custo final: a mesma conta do custo efetivo, com o IOF do giro somado ao valor recebido. Giro com taxa abaixo desta sai mais barato que o empréstimo externo com NDF. A comparação vale para um giro com as mesmas datas e parcelas iguais de principal, taxa em dias corridos (exp/360) e sem tarifa; não considera reciprocidade nem o limite de crédito do NDF.')}</dt><dd><b>{pct(hedge.ndf.giroMes)} a.m.</b><small>{pct(hedge.ndf.giroAno)} a.a. · exp/360</small></dd></div>
                </dl>}
                {loan && <section className="e4-condicoes" aria-labelledby="e4-condicoes-h">
                  <header><h4 id="e4-condicoes-h">Condições da operação</h4><button type="button" className="e4-copiar" disabled={!hedge} onClick={copiar}>{copiado ? 'Resumo copiado' : 'Copiar resumo'}</button><span className="sr-only" role="status">{copiado ? 'Resumo copiado para a área de transferência.' : ''}</span></header>
                  <dl>{condicoesE4(loan, hedge).map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl>
                </section>}
                <p className="fm-iof-premise">{loan ? `IOF-câmbio de ${pct(loan.iofRate)} na entrada: prazo médio de ${loan.avgTermDays} dias corridos. Liquidar antes do prazo pode gerar o IOF com multa e juros.` : `IOF-câmbio na entrada: ${pct(IOF_SHORT_TERM.rate)} com prazo médio até ${IOF_SHORT_TERM.maxDays} dias; zero acima.`}</p>
                {avisos.map((texto) => <p className="cx-hint cx-pad e4-aviso" role="status" key={texto}>{texto}</p>)}
                {pendencia && <p className="cx-hint cx-pad" role="status">{pendencia}</p>}
              </article>

              {loan && (
                <details className="desk-panel cx-panel e4-comparar">
                  <summary>Comparar com swap e sem proteção</summary>
                  <div className="fm-comparison" aria-label="Sem proteção, com swap e com NDF">
                    <div className="cx-wrap" role="region" tabIndex={0} aria-label="Resultados dos três caminhos"><table className="cx-matrix"><thead><tr><th scope="col">% a.a. ou R$</th><th scope="col">Sem proteção</th><th scope="col">Com swap</th><th scope="col">Com NDF</th></tr></thead><tbody>
                      <tr><th scope="row">A dívida fica em</th><td>{cur.Nome}</td><td>CDI</td><td>Reais, pré</td></tr>
                      <tr className="fm-cet-row"><th scope="row">Custo em reais ao ano{ajuda('Custo em reais ao ano', `Sem proteção: custo com o ${cur.nome} parado, em dias corridos/365; muda com o câmbio de cada pagamento. Com swap: custo com o DI informado, base 252. Com NDF: custo fixo, base 252. Por usar dias úteis, o custo com NDF desta linha difere do custo efetivo da cotação, que usa dias corridos (exp/360): é a mesma operação em duas convenções.`)}</th><td>{parado ? pct(parado.cost) : '—'}</td><td>{hedge ? pct(hedge.swap.pre) : '—'}</td><td>{hedge ? pct(hedge.ndf.pre) : '—'}</td></tr>
                      <tr><th scope="row">Spread do swap{ajuda('Spread do swap', 'Spread sobre o CDI calculado sobre o principal, sem os custos da entrada (tarifa, IOF e IR sobre a tarifa). Inclui juros, IR do tomador, fiança e o spread do banco. Sem fiança, é o número mais próximo da cotação da mesa. Com as taxas da mesa coladas, ele já traz a margem embutida nelas.')}</th><td>—</td><td>{hedge ? `CDI ${signed(hedge.swap.runSpread, pct)}` : '—'}</td><td>—</td></tr>
                      <tr><th scope="row">Custo total em CDI{ajuda('Custo total em CDI', 'Custo total equivalente em CDI: já inclui tarifa, IOF, IR e fiança diluídos no prazo. Por isso fica acima do spread que a mesa cota para o swap, que não traz os custos de entrada. Com NDF, o custo é fixo: a leitura em CDI vale só para comparar hoje e não acompanha o CDI.')}</th><td>—</td><td>{hedge ? `CDI ${signed(hedge.swap.spread, pct)}` : '—'}</td><td>{hedge ? `CDI ${signed(hedge.ndf.spread, pct)}` : '—'}</td></tr>
                      <tr><th scope="row">Custo total em % do CDI</th><td>—</td><td>{hedge ? pct(hedge.swap.pctCdi, 1) : '—'}</td><td>{hedge ? pct(hedge.ndf.pctCdi, 1) : '—'}</td></tr>
                      <tr><th scope="row">Risco que sobra</th><td>Câmbio</td><td>Alta do CDI</td><td>Desfazer antes</td></tr>
                      <tr className="fm-total-row"><th scope="row">Total a pagar em reais</th><td>{parado ? brl(parado.totalBrl) : '—'}</td><td>Segue o CDI</td><td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}</td></tr>
                    </tbody></table></div>
                    {hedge && <p className="fm-difference">O NDF compensa se o {cur.nome} subir mais de <b>{pct(hedge.ndf.breakeven)} ao ano</b>. Abaixo disso, ficar sem proteção sai mais barato, com o risco do câmbio.</p>}
                    <p className="fm-reference-sources">Custo all-in em {cur.nome}: {pct(loan.allIn)} a.a. · {hedge ? <>DI {pct(hedge.di)} a.a. e {juro}{colado ? ' implícito' : ''} {pct(hedge.cupom)} a.a. até o vencimento · {curveLabel}. </> : null}{colado ? 'Com as taxas da mesa coladas, a coluna Com swap é o mesmo fluxo do NDF lido em CDI: não é cotação de swap. ' : ''}Sem proteção considera o {cur.nome} parado, em dias corridos/365; swap e NDF em base 252 dias úteis. O custo total em CDI inclui tarifa e IOF da entrada diluídos no prazo; o spread do swap, não.</p>
                  </div>
                  <details className="fm-details"><summary>Composição do custo em {cur.nome}</summary>
                    <div className="fm-grade">{quadros.map(([rotulo, valor, nota, texto]) => <div className="fm-kpi" key={rotulo}><span className="fm-rotulo">{rotulo}{ajuda(rotulo, texto)}</span><b>{valor}</b>{nota && <small>{nota}</small>}</div>)}</div>
                  </details>
                  {scenarios.length > 0 && <details className="fm-details"><summary>Sem proteção · custo conforme o {cur.nome}</summary>
                    <div className="cx-wrap" role="region" tabIndex={0} aria-label="Custo sem proteção por cenário de câmbio"><table className="cx-matrix"><thead><tr><th scope="col">{cur.Nome} ao ano</th><th scope="col">Câmbio final</th><th scope="col">Total a pagar</th><th scope="col">Custo a.a.</th></tr></thead><tbody>
                      {scenarios.map((s) => <tr key={s.fxChange}><th scope="row">{s.fxChange === 0 ? 'Parado' : signed(s.fxChange, (v) => pct(v, 0))}</th><td>{fx(s.fxEnd)}</td><td>{brl(s.totalBrl)}</td><td>{pct(s.cost)}</td></tr>)}
                    </tbody></table></div>
                    <p className="cx-hint cx-pad">Variação constante do {cur.nome} ao ano, do desembolso a cada pagamento. Custo em dias corridos/365.</p>
                  </details>}
                </details>
              )}

              <details className="fm-premises"><summary>Premissas e limites da simulação</summary><p>Principal: {amortLabel.toLowerCase()} · datas: {datesLabel.toLowerCase()} · juros lineares sobre o saldo, por dias corridos/360 · IR na fonte e IOF-câmbio pelas regras vigentes em {CONFERIDO_EM}.</p><p>{colado ? 'Taxas futuras coladas da cotação da mesa, uma por pagamento; o equivalente em CDI usa o DI informado.' : 'Taxa futura teórica, com um DI e um juro da moeda iguais para todos os prazos; a mesa do banco fecha uma taxa futura para cada vencimento, então o custo real fica próximo, não igual. O juro linear único tende a encarecer a leitura acima de 5 anos.'} Não inclui IR nem PIS/Cofins sobre ganho do derivativo, nem custo de garantias.</p><p>{E4_QUOTE_NOTE}</p><p>Simulação indicativa, sujeita à análise e aprovação. Não constitui proposta ou compromisso de crédito.</p></details>
            </div>
          </div>
          {loan && (
            <details className="desk-panel cx-panel fm-fluxo-panel e4-parcelas" open>
              <summary>Parcelas</summary>
              <header><h3 className="cx-heading">Parcela a parcela{ajuda('Parcela a parcela', `Desembolso em ${dm(loan.start)}. Saldo devedor: saldo antes do pagamento da linha, base dos juros. Juros e encargos: juros pelos dias corridos desde o pagamento anterior, sobre 360, mais IR do tomador e fiança, quando houver. A taxa futura é a colada da mesa ou, na estimativa, a calculada com o DI e o juro da moeda informados; o acréscimo do banco, se houver, entra por cima. A parcela em reais é a parcela na moeda vezes a taxa futura.`)}</h3></header>
              <p className="cx-hint cx-pad" id="e4-calendario">{calendar === '30d' ? 'Datas a cada 30 dias corridos, no próximo dia útil (feriados nacionais).' : 'Datas pelo dia do desembolso, sem ajuste para dia útil.'} {hedge?.source === 'mesa' ? 'Taxas futuras coladas da cotação da mesa.' : 'Taxa futura teórica; a da mesa do banco prevalece.'} Não use como memória contratual.</p>
              <p className="cx-hint cx-pad e4-estreito">No celular aparecem vencimento, taxa futura e parcela em reais. Para ver amortização, saldo e juros na moeda, vire o aparelho ou abra no notebook.</p>
              <ExpandablePanel title="Memória das parcelas"><div className="cx-wrap fm-fluxo" role="region" aria-label="Parcela a parcela" aria-describedby="e4-calendario" tabIndex={0}>
                <table className="cx-matrix fm-tabela">
                  <thead><tr><th scope="col">Prazo (dias)</th><th scope="col">Vencimento</th><th scope="col">Amortização</th><th scope="col">Saldo devedor</th><th scope="col">Juros e encargos</th><th scope="col">Parcela em {cur.nome}</th><th scope="col">Taxa futura</th><th scope="col">Parcela em reais</th></tr></thead>
                  <tbody>
                    <tr className="fm-liberacao"><th scope="row">0<span className="e4-largo"> · desembolso</span></th><td>{dm(loan.start)}</td><td>—</td><td>{usd(loan.principal)}</td><td>{entrada > 0 ? usd(entrada) : '—'}</td><td>—</td><td>{fx(loan.spot)}</td><td>{brl(loan.netBrl)}</td></tr>
                    {loan.flows.map((f, i) => {
                      const h = hedge?.flows[i]
                      return <tr key={f.date}><th scope="row">{f.dc}</th><td>{dm(f.date)}</td><td>{usd(f.principal)}</td><td>{usd(f.balance)}</td><td>{usd(f.usd - f.principal)}</td><td>{usd(f.usd)}</td><td>{h ? fx(h.ndfRate) : '—'}</td><td>{h ? brl(h.brl) : '—'}</td></tr>
                    })}
                  </tbody>
                  <tfoot><tr><th scope="row">Total</th><td>{loan.flows.length} {loan.flows.length === 1 ? 'pagamento' : 'pagamentos'}</td><td>{usd(loan.totals.principal)}</td><td>—</td><td>{usd(loan.totals.usd - loan.totals.principal)}</td><td>{usd(loan.totals.usd)}</td><td>—</td><td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}</td></tr></tfoot>
                </table>
              </div></ExpandablePanel>
              <p className="cx-hint cx-pad">Prazo em dias corridos desde o desembolso. Na linha do desembolso, a última coluna é o valor líquido recebido{entrada > 0 ? ' e a coluna de encargos soma tarifa, IOF e IR da entrada, descontados desse valor' : ''}.</p>
            </details>
          )}
          <p className="status">Regras conferidas em {CONFERIDO_EM} · IOF relido em {IOF_RELIDO_EM} · {curveLabel} · A cotação da mesa do banco e o contrato prevalecem.</p>
        </section>
      </div>

      <div hidden={area !== 'rules'} className="bw-quotes">
        <p className="status">Regras lidas em fontes oficiais em {CONFERIDO_EM}; IOF relido em {IOF_RELIDO_EM}, com o ato da Receita sobre o prazo médio. As decisões da Receita citadas foram lidas pelo resumo oficial (ementa) e são, quase todas, da regra anterior, de 6% e prazo maior. Textos das normas reconferidos em {IOF_RELIDO_EM} nos sites da Câmara, da Receita e do Banco Central; a situação da decisão do STF não pôde ser conferida no site do tribunal. Pontos não confirmados estão indicados; confirme com o tributário e com a mesa do banco antes de cotar.</p>
        <dl className="e4-rules">{REGRAS.map(([tema, regra, fonte]) => <div key={tema}><dt>{tema}</dt><dd>{regra}<small>{fonte}</small></dd></div>)}</dl>
        <ul className="e4-sources">{E4_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul>
      </div>
    </section>
  )
}
