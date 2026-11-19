import { useCallback, useEffect, useRef, useState } from 'react'
import { useHolidays } from './useHolidays.js'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { useDataFile } from './useDataFile.js'
import { useMacro } from './useMacro.js'
import { keyOf, pointsOf } from './bndes.js'
import { CUSTOS_FIXOS, FGI, FONTES, PERIODICIDADES, PORTES, REGRAS, ecgFgi, erroPercentualFgi, fatorKFgi, TFC_NOMES, codigoTfc, faixaTfb, faixaTfc, periodos30Datas, simular, spreadSobreCdi, vencimentoDia15 } from './finameMateriais.js'
import { FINAME_FUNDING_OPTIONS, FINAME_FUNDING_SOURCES, finameFundingOption, compareFinamePair, FINAME_PREMISES, resolveFinameRate, resolvePosRate, isFinamePos, parseSignedDecimal, finameSimulationParams, validFinameQuote, validPosQuote, finameCet } from './finameFunding.js'
import { CUSTOS_POS, INDICE_POS, codigoTfbd, simularPos, trajetoriaFocus, trajetoriaSelicMedia } from './finamePosFixado.js'
import { nf, nbr5891 } from './format.js'
import Estado from './Estado.jsx'
import { GLOSSARY } from './glossary.js'
import Help from './CalculatorHelp.jsx'
import BndesIcon from './BndesIcon.jsx'
import ExpandablePanel from './ExpandablePanel.jsx'
import ComparaSeries from './BndesCompare.jsx'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA, pracaCalendars } from './pracaContrato.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v, d = 2) => `${nf(nbr5891(v, d), d)}%` // NBR 5891 (Res. CMN 4.881, art. 4º, par. único)
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
const data = (d) => d.toLocaleDateString('pt-BR')
// Exemplos da ajuda do ECG: [valor liberado em R$, % garantido, prazo total em meses], calculados pela fórmula do Anexo V.
const ECG_EXEMPLOS = [[500000, 80, 60], [1000000, 80, 84], [300000, 50, 36]]

// Ícone: caixa de materiais com a marca do BNDES (barras) ao lado.
export function FinameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" />
    </svg>
  )
}

// Calculadoras › BNDES Finame Materiais: condições do produto (prazo, carência, custo financeiro, taxas), resultado e fluxo
// parcela a parcela. O custo financeiro vem do painel: TFC ou TFB da faixa de prazo (aba BNDES). TLP exigível tem projeção própria.
// As explicações ficam no "?" ao lado de cada rótulo; na tela só os valores.
// Valores que já vêm preenchidos (pedido do Fernando, 18/11/2026): operação de R$ 1.000.000,00, 48 meses de prazo e 3 de carência.
export default function FinameMateriais({ onBack, onFundingView, profileControl }) {
  const bndes = useDataFile('bndes.json')
  const moedas = useDataFile('moedas.json')
  const macro = useMacro()
  const { ctx: holidayCtx } = useHolidays()
  const [valorText, setValorText] = useState('1.000.000,00')
  const [partText, setPartText] = useState('100')
  const [prazoText, setPrazoText] = useState('48')
  const [carText, setCarText] = useState('3')
  const [custo, setCusto] = useState('tfc')
  const [comparar, setComparar] = useState(false)
  const [outro, setOutro] = useState('tfb') // segundo custo do comparativo (qualquer par, pedido de 19/11/2026)
  const [trajetoriaManual, setTrajetoriaManual] = useState({}) // { tlp: { 2027: '5,00' }, ... }: projeção editada por ano
  const [cambioManual, setCambioManual] = useState(null) // dólar do dia da liberação editado (TFBD)
  const parcelasRef = useRef(null)
  const [cotacaoAmpliada, setCotacaoAmpliada] = useState(false)
  const abrirAposRecolher = useRef(false)
  const mostrarParcelas = useCallback(() => {
    const detalhes = parcelasRef.current
    if (!detalhes) return
    detalhes.open = true
    detalhes.querySelector('summary')?.focus({ preventScroll: true })
    detalhes.scrollIntoView({ block: 'start' })
  }, [])
  const abrirParcelas = () => {
    if (!cotacaoAmpliada) return mostrarParcelas()
    abrirAposRecolher.current = true
    setCotacaoAmpliada(false)
  }
  useEffect(() => {
    if (cotacaoAmpliada || !abrirAposRecolher.current) return
    // Depois de fechar o diálogo nativo e da restauração de foco do acordeão ampliável.
    const frame = requestAnimationFrame(() => {
      abrirAposRecolher.current = false
      mostrarParcelas()
    })
    return () => cancelAnimationFrame(frame)
  }, [cotacaoAmpliada, mostrarParcelas])
  const [chartPreset, setChartPreset] = useState(12)
  const [chartCustom, setChartCustom] = useState(null)
  const { sistema, composicao, liberacao } = FINAME_PREMISES
  const [manualRates, setManualRates] = useState({})
  const [porte, setPorte] = useState('mpme')
  const [bndesText, setBndesText] = useState(String(REGRAS.taxaBndes.mpme).replace('.', ','))
  const [agenteText, setAgenteText] = useState('3,00')
  const [periodicidade, setPeriodicidade] = useState(3)
  const [tacText, setTacText] = useState('2.600,00') // TAC: tarifa de contratação, paga à vista; pré-preenchida e editável
  const [fgiOn, setFgiOn] = useState(false)
  const [praca, setPraca] = useState(PRACA_PADRAO) // praça do contrato: feriados locais que adiam vencimentos
  const calendarios = pracaCalendars(praca)
  const [fgiText, setFgiText] = useState(String(FGI.padraoPercentual))
  const [liberacaoText, setLiberacaoText] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  // Data da liberação: base do calendário real (vencimentos dia 15 ou próximo dia útil), dos juros por dias corridos e do CET.
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(liberacaoText) ? (([y, m, d]) => { const date = new Date(y, m - 1, d, 12); return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && y >= 2000 && y <= 2100 ? date : null })(liberacaoText.split('-').map(Number)) : null

  const money = parseMoneyInput(valorText)
  const participacao = parseDecimal(partText)
  const prazo = /^\d+$/.test(prazoText.trim()) ? Number(prazoText) : null
  const carencia = /^\d+$/.test(carText.trim()) ? Number(carText) : null
  const taxaBndes = parseDecimal(bndesText)
  const taxaAgente = parseDecimal(agenteText)
  const tac = tacText.trim() === '' ? { ok: true, value: 0 } : parseMoneyInput(tacText)
  const fgiPct = parseDecimal(fgiText)
  // P do ECG: períodos de 30 dias completos entre a liberação ilustrativa e o último vencimento (dia 15, próximo dia útil).
  const fgiPeriodos = prazo && hoje ? periodos30Datas(hoje, vencimentoDia15(hoje, prazo, holidayCtx, calendarios)) : undefined

  // Custo financeiro do painel
  const faixa = prazo ? faixaTfb(prazo) : 60
  const tfbPts = pointsOf(bndes.data, keyOf(faixa, liberacao))
  const rawTfb = tfbPts.length ? { data: tfbPts.at(-1)[0], valor: tfbPts.at(-1)[1], codigo: keyOf(faixa, liberacao) } : null
  const tfcCodigo = codigoTfc(porte, prazo ?? 60)
  const tfcPts = Array.isArray(moedas.data?.series?.[tfcCodigo]?.points) ? moedas.data.series[tfcCodigo].points : []
  const rawTfc = tfcPts.length ? { data: tfcPts.at(-1)[0], valor: tfcPts.at(-1)[1], codigo: tfcCodigo, nome: TFC_NOMES[tfcCodigo], faixa: faixaTfc(prazo ?? 60) } : null
  const tfc = validFinameQuote(rawTfc) ? rawTfc : null
  const tfb = validFinameQuote(rawTfb) ? rawTfb : null
  // Pós-fixados: J da TLP (moeda 777, mensal), LD1 (sobretaxa LCD, trimestral) e TFBD (TD1/TD2/TD3 pela faixa de prazo).
  const ultimo = (pts, codigo, extra = {}) => (Array.isArray(pts) && pts.length ? { data: pts.at(-1)[0].slice(0, 10), valor: pts.at(-1)[1], codigo, ...extra } : null)
  const tlpPts = Array.isArray(bndes.data?.tlp?.points) ? bndes.data.tlp.points : []
  const rawTlp = ultimo(tlpPts, '777', { nome: 'TLP · parte prefixada (J)' })
  const ld1Pts = Array.isArray(moedas.data?.series?.LD1?.points) ? moedas.data.series.LD1.points : []
  const rawLcd = ultimo(ld1Pts, 'LD1', { nome: 'Sobretaxa LCD' })
  const tdCodigo = codigoTfbd(prazo ?? 60)
  const tdPts = Array.isArray(moedas.data?.series?.[tdCodigo]?.points) ? moedas.data.series[tdCodigo].points : []
  const rawTfbd = ultimo(tdPts, tdCodigo, { nome: `TFBD ${tdCodigo}` })
  const dolarPts = Array.isArray(moedas.data?.series?.['604']?.points) ? moedas.data.series['604'].points : []
  const dolarPainel = ultimo(dolarPts, '604')
  // Carência de até 12 meses quando algum custo em uso é prefixado (TFB, TFC); só pós-fixados vão até 24.
  const fixa = (comparar ? [custo, outro] : [custo]).some(id => CUSTOS_FIXOS.has(id))
  const cdi = Array.isArray(macro.data?.cdi) && macro.data.cdi.length ? macro.data.cdi.at(-1)[1] : null
  // Na TFB, o custo financeiro é a própria TFB (nominal). A TLP exigível usa motor próprio, sem correção capitalizada do saldo.
  const funding = finameFundingOption(custo)
  const quotes = { tfc, tfb, tlp: validPosQuote(rawTlp) ? rawTlp : null, lcd: validPosQuote(rawLcd) ? rawLcd : null, tfbd: validPosQuote(rawTfbd) ? rawTfbd : null }
  const rates = Object.fromEntries(['tfc', 'tfb', ...CUSTOS_POS].map(id => [id, isFinamePos(id) ? resolvePosRate(id, quotes[id], manualRates[id] ?? null) : resolveFinameRate(id, quotes[id], manualRates[id] ?? null)]))
  const emUso = comparar ? [custo, outro] : [custo]
  // Projeção do índice (Focus ano a ano, editável): do ano da liberação até o último ano do Focus.
  const anoLib = hoje ? hoje.getFullYear() : new Date().getFullYear()
  const projecoes = Object.fromEntries(CUSTOS_POS.map(id => {
    const selicAtual = Array.isArray(macro.data?.selic) && macro.data.selic.length ? macro.data.selic.at(-1)[1] : null
    const focus = id === 'lcd' ? trajetoriaSelicMedia(macro.data?.focus, anoLib, selicAtual) : trajetoriaFocus(macro.data?.focus, INDICE_POS[id].focus, anoLib)
    const editada = trajetoriaManual[id] ?? {}
    const lista = focus.map(item => {
      const texto = editada[item.ano]
      const valor = texto == null ? item.valor : parseSignedDecimal(texto)
      return { ano: item.ano, valor, focus: item.valor, texto: texto ?? String(item.valor).replace('.', ','), manual: texto != null }
    })
    return [id, lista]
  }))
  const cambioInicial = cambioManual == null ? dolarPainel?.valor ?? null : parseDecimal(cambioManual)
  const trajetoriaDe = id => projecoes[id].map(({ ano, valor }) => ({ ano, valor }))
  const custoFinanceiro = rates[custo]?.value ?? null

  const erros = {
    valor: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    part: participacao !== null && participacao >= REGRAS.participacaoMinPct && participacao <= 100 ? null : 'Participação de 1 a 100%.',
    prazo: prazo !== null && prazo >= 1 && prazo <= REGRAS.prazoMaxMeses ? null : `Prazo de 1 a ${REGRAS.prazoMaxMeses} meses (7 anos).`,
    car: carencia !== null && carencia >= 0 && carencia <= (fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses) && (prazo === null || carencia < prazo) ? null : `Carência de 0 a ${fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses} meses${fixa ? ` com ${(comparar ? [custo, outro] : [custo]).filter(id => CUSTOS_FIXOS.has(id)).map(id => id.toUpperCase()).join(' e ')}` : ''}, menor que o prazo.`,
    bndes: taxaBndes !== null && taxaBndes <= 100 ? null : 'Informe a taxa do BNDES em % a.a.',
    agente: taxaAgente !== null && taxaAgente <= 100 ? null : 'Informe o spread da instituição em % a.a.',
    tac: tac.ok ? null : tac.error || 'Informe a TAC em R$ (zero se não houver).',
    'data-lib': hoje ? null : 'Informe a data da liberação (entre 2000 e 2100).',
    fgi: !fgiOn ? null : emUso.some(id => ['lcd', 'tfbd'].includes(id)) ? 'O FGI Tradicional não aceita Selic/LCD capitalizada nem TFBD (Anexo I do Regulamento, item 1). Desmarque a garantia.' : PORTES.find((p) => p.id === porte)?.mpme === false ? 'O FGI atende micro, pequenas e médias empresas (receita bruta de até R$ 300 milhões no ano anterior). Para grande empresa, desmarque a garantia.' : erroPercentualFgi(fgiPct ?? Number.NaN),
    ...Object.fromEntries(['tfc', 'tfb', ...CUSTOS_POS].map(id => [`rate-${id}`, emUso.includes(id) ? rates[id].error : null])),
    projecao: emUso.filter(isFinamePos).map(id => !projecoes[id].length ? `${INDICE_POS[id].rotulo}: projeção do Focus indisponível.` : projecoes[id].some(item => !Number.isFinite(item.valor) || (id === 'tfbd' ? item.valor <= 0 || item.valor > 100 : item.valor <= -50 || item.valor > 100)) ? `${INDICE_POS[id].rotulo}: revise a projeção de cada ano.` : null).find(Boolean) ?? (emUso.includes('tfbd') && !(cambioInicial > 0 && cambioInicial <= 100) ? 'Informe o dólar do dia da liberação (R$ por US$).' : null),
    comparar: comparar && outro === custo ? 'Escolha um segundo custo diferente do primeiro.' : null,
  }
  const garantiaFgi = fgiOn && !erros.fgi ? { percentual: fgiPct, incorporar: false, periodos: fgiPeriodos } : null
  const custosExtras = { tac: tac.ok ? tac.value : 0, fgi: garantiaFgi }
  const pronto = ['inline', 'pos'].includes(funding?.mode) && !Object.values(erros).some(Boolean) && Number.isFinite(custoFinanceiro)
  const params = finameSimulationParams({ valor: money.value, participacao, prazo, carencia, custo, custoFinanceiro, ipca: 0, taxaBndes, taxaAgente, periodicidade, dataLiberacao: hoje, feriados: holidayCtx, calendarios, ...custosExtras })
  // Pós-fixados: mesmo cronograma (dia 15, praça do contrato, SAC, periodicidade da carência) com o motor de finamePosFixado.js.
  const simularPara = (id, taxa) => isFinamePos(id)
    ? simularPos({ custo: id, valor: params.valor, participacao, prazo, carencia, taxaFixa: taxa, taxaBndes, taxaAgente, trajetoria: trajetoriaDe(id), cambioInicial, periodicidade, composicao, tac: params.tac, fgi: params.fgi, dataLiberacao: hoje, feriados: holidayCtx, calendarios })
    : simular({ ...params, custo: id, custoFinanceiro: taxa })
  const r = pronto ? simularPara(custo, custoFinanceiro) : null
  const res = r?.ok ? r : null
  const comparison = comparar && pronto ? compareFinamePair([custo, outro], params, quotes, manualRates, id => {
    const rate = rates[id]
    if (rate.value === null) return null
    const result = simularPara(id, rate.value)
    return result.ok ? { custo: id, quote: quotes[id], rate, result } : null
  }) : null
  // TFBD acompanha o dólar: a equivalência em CDI não se aplica.
  const spread = res && res.perfil !== 'tfbd' ? spreadSobreCdi(res.taxaNominal, cdi) : null
  const financiadoTela = res ? res.liberado : !erros.valor && !erros.part ? money.value * participacao / 100 : null
  // CET estimado do fluxo projetado (Res. CMN 4.881: dias corridos/365 desde a data da liberação informada).
  const cet = res ? finameCet(res, hoje, holidayCtx, calendarios) : null
  const cets = comparison?.ok ? comparison.alternatives.map(item => finameCet(item.result, hoje, holidayCtx, calendarios)) : []
  const cetTexto = (c, unidade = 'anual') => c ? `${pct(unidade === 'anual' ? c.anual : c.mensal, 2)} ${unidade === 'anual' ? 'a.a.' : 'a.m.'}` : 'Não mensurável'
  // Somente apresentação: reutiliza as equivalências já calculadas, sem conta nova.
  const parTaxas = (anual, mensal) => <span className="fm-rate-pair"><span>{anual}</span><span aria-hidden="true">·</span><span>{mensal}</span></span>
  const taxaResumo = resultado => parTaxas(`${pct(resultado.taxa, 2)} a.a.`, `${pct(resultado.taxaMensal, 3)} a.m.`)
  const cetResumo = valor => valor ? parTaxas(cetTexto(valor), cetTexto(valor, 'mensal')) : 'Não mensurável'
  const cetAjuda = 'CET estimado (Resolução CMN 4.881/2020): taxa anual que iguala o valor líquido recebido na liberação (valor liberado menos TAC, ECG do FGI à vista e IOF) às parcelas do cronograma, em dias corridos/365. Usa as datas hipotéticas do fluxo (dia 15 ou próximo dia útil) e não inclui seguros nem outras tarifas: o CET do contrato, informado pelo agente, prevalece.'
  const referenceRetained = !!((emUso.some(id => ['lcd', 'tfbd'].includes(id)) && (moedas.stale || moedas.status === 'error')) || (emUso.includes('tlp') && (bndes.stale || bndes.status === 'error')) || ((emUso.includes('tfc')) && (moedas.stale || moedas.status === 'error' || moedas.data?.stale?.[tfcCodigo])) || ((emUso.includes('tfb')) && (bndes.stale || bndes.status === 'error' || bndes.data?.stale?.[keyOf(faixa, liberacao)])))


  const ajuda = (label, texto) => (texto ? <Help label={`Ajuda: ${label}`}>{texto}</Help> : null)
  const field = (key, label, control, hint, valor) => (
    <div className={`cx-field fm-field-${key}`}>
      <span className="fm-rotulo"><label htmlFor={`fm-${key}`}>{label}</label>{ajuda(label, hint)}</span>
      {control}
      {valor && <p className="cx-hint fm-custo-valor">{valor}</p>}
      <p className="cx-error" id={`fm-${key}-err`} role={erros[key] ? 'alert' : undefined}>{erros[key] ?? ''}</p>
    </div>
  )
  const seg = (id, label, hint, botoes, extra = null) => (
    <div className={`cx-field fm-field-${id}`}>
      <span className="fm-rotulo"><span className="cx-label" id={`fm-${id}-l`}>{label}</span>{ajuda(label, hint)}</span>
      {id === 'lib' ? <div className="seg" role="group" aria-labelledby={`fm-${id}-l`}>{botoes}</div> : <select id={`fm-${id}`} aria-labelledby={`fm-${id}-l`} value={botoes.findIndex(button => button.props['aria-pressed'])} onChange={event => botoes[Number(event.target.value)].props.onClick()}>{botoes.map((button, index) => <option key={button.key} value={index}>{button.props.children}</option>)}</select>}
      {extra}
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`fm-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!erros[key]} aria-describedby={`fm-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...extra} />

  // Quadros do resultado. Os destaques do topo e a "Composição do resultado" usam esta mesma lista: mesmo rótulo, mesmo valor, mesma nota.
  const quadros = res ? [
    { id: 'taxa', rotulo: 'Taxa final', ajuda: <><p>{`Taxa final composta: (1 + custo financeiro) × (1 + taxa do BNDES) × (1 + spread da instituição) − 1. A taxa mensal é a equivalente em meses de 1/12 do ano.`}</p><p>{pct(res.taxaMensal, 3)} a.m. · {pct(custoFinanceiro, 2)} {custo.toUpperCase()} + {pct(taxaBndes, 2)} BNDES + {pct(taxaAgente, 2)} spread da instituição, capitalizadas</p></>, valor: <>{pct(res.taxa, 2)} a.a.</>, nota: <>{pct(res.taxaMensal, 3)} a.m.</> },
    { id: 'cet', rotulo: 'CET estimado', ajuda: cetAjuda, valor: cetTexto(cet), nota: cet ? <>{cetTexto(cet, 'mensal')} · líquido {brl(cet.liquido)}</> : 'fluxo sem solução' },
    res.indice && { id: 'indice', rotulo: `${res.indice.rotulo} projetado`, ajuda: `Hipótese usada na projeção: ${res.indice.trajetoria.map(item => `${item.ano} ${res.perfil === 'tfbd' ? `R$ ${nf(item.valor, 2)}` : pct(item.valor, 2)}`).join(' · ')}${res.perfil === 'tfbd' ? `; parte do dólar de R$ ${nf(res.indice.cambioInicial, 4)} na liberação` : ''}. Juros em ${res.baseJuros}.`, valor: res.perfil === 'tfbd' ? `${res.indice.primeiroAno >= 0 ? '+' : '−'}${pct(Math.abs(res.indice.primeiroAno), 2)} em 12 meses` : `${pct(res.indice.primeiroAno, 2)} a.a.`, nota: res.perfil === 'tfbd' ? 'variação do dólar projetada' : `Focus ${res.indice.trajetoria[0]?.ano ?? ''}` },
    res.cetFixo !== undefined && { id: 'cetfixo', rotulo: 'CET · parte fixa', ajuda: `Res. CMN 4.881/2020, art. 5º: o CET do contrato não inclui o índice (${res.indice?.rotulo ?? 'índice'}), só a parte fixa. Mesmo cronograma, com o índice zerado.`, valor: cetTexto(res.cetFixo), nota: `sem ${res.indice?.rotulo ?? 'índice'}` },
    res.correcao !== 0 && Number.isFinite(res.correcao) && { id: 'correcao', rotulo: 'Correção do saldo', ajuda: res.perfil === 'lcd' ? 'Selic capitalizada no saldo devedor ao longo da operação, devolvida nas amortizações.' : 'Variação do dólar aplicada ao saldo em reais, devolvida nas amortizações. Negativa quando o dólar projetado cai.', valor: brl(res.correcao), nota: res.perfil === 'lcd' ? 'Selic no saldo' : 'variação cambial' },
    { id: 'financiado', rotulo: 'Valor financiado', ajuda: 'Valor dos materiais × participação do BNDES; o restante é recursos próprios do cliente.', valor: brl(res.liberado), nota: <>{res.recursosProprios > 0 ? `${brl(res.recursosProprios)} de recursos próprios` : '100% dos itens financiáveis'}</> },
    { id: 'carencia', rotulo: 'Juros na carência', ajuda: 'Juros do período de carência, pagos na periodicidade escolhida (dentro do período, capitalizados mês a mês); sem amortização nesse período.', valor: brl(res.jurosCarencia), nota: <>{carencia} {carencia === 1 ? 'mês' : 'meses'} · {PERIODICIDADES.find((p) => p.id === periodicidade).label.toLowerCase()}</> },
    { id: 'parcelas', rotulo: 'Parcelas', ajuda: 'Primeira parcela após a carência (juros + amortização). No SAC as parcelas caem; cada parcela tem os juros dos dias corridos desde o vencimento anterior.', valor: brl(res.primeiraParcela), nota: <>{res.parcelasAmortizacao}x mensais{` · última ${brl(res.ultimaParcela)}`}</> },
    { id: 'spread', rotulo: 'Spread da instituição', ajuda: <><p>{'Remuneração do banco (a "taxa do agente financeiro" do BNDES). Em R$: juros com a taxa completa menos juros com custo financeiro + taxa do BNDES, no mesmo cronograma; a parte do BNDES é juros com custo + BNDES menos juros só com o custo, e o custo financeiro é o restante. Em pontos: quanto o spread acrescenta à taxa final, que na composição capitalizada é o spread multiplicado por (1 + custo) × (1 + BNDES).'}</p><p>{brl(res.atribuicao.agente)} dos juros ({pct(res.juros > 0 ? (res.atribuicao.agente / res.juros) * 100 : 0, 1)}) · +{nf(res.spreadAgentePp, 2)} p.p. sobre custo + BNDES · BNDES {brl(res.atribuicao.bndes)} · custo financeiro {brl(res.atribuicao.custoFinanceiro)}</p></>, valor: <>{pct(taxaAgente, 2)} a.a.</>, nota: <>+{nf(res.spreadAgentePp, 2)} p.p. na taxa final</> },
    { id: 'juros', rotulo: 'Juros totais', ajuda: 'Soma dos juros da carência e das parcelas desta projeção.', valor: brl(res.juros), nota: <>{pct((res.juros / res.financiado) * 100, 1)} do saldo financiado</> },
    { id: 'iof', rotulo: 'IOF', ajuda: 'Alíquota zero condicionada à confirmação de recursos FINAME elegíveis (Decreto 6.306/2007, art. 8º, IX).', valor: brl(res.iof), nota: res.iof > 0 ? `${brl(res.iofFixo)} adicional + ${brl(res.iofDiario)} diário` : 'Alíquota zero' },
    { id: 'tac', rotulo: 'TAC', ajuda: 'Tarifa de contratação paga à vista na liberação, pelo valor informado. Não entra no cronograma de juros.', valor: brl(res.tac), nota: res.tac > 0 ? 'paga à vista' : 'sem TAC' },
    res.fgi && { id: 'fgi', rotulo: 'FGI · ECG', ajuda: <><p>{`Encargo por Concessão de Garantia do FGI Tradicional: %G × K × VL × P, com %G = ${nf(res.fgi.percentual, 0)}%, K = ${nf(res.fgi.k, 2)}% por período de 30 dias, VL = ${brl(res.liberado)} e P = ${res.fgi.periodos} períodos de 30 dias até o último vencimento.`}</p><p>Pago à vista na liberação (item 2.1.3 do Anexo V), sem financiar o encargo. O cliente só paga se o agente repassar o custo. Garantia não é seguro de crédito.</p><p>{`Por que parece alto: o ECG é cobrado de uma vez, na liberação, pelo prazo inteiro da operação. Nesta simulação ele equivale a ${pct((res.fgi.ecg / res.liberado) * 100, 2)} do valor liberado. Com 80% de garantia, fica perto de 5% do valor liberado em quase qualquer prazo acima de 24 meses, porque o fator K cai quando o prazo aumenta.`}</p><p>Exemplos pela mesma fórmula (à vista):</p><ul>{ECG_EXEMPLOS.map(([v, g, n]) => { const a = ecgFgi({ valor: v, percentual: g, prazo: n, incorporar: false }); return <li key={`${v}-${g}-${n}`}>{`${brl(v)}, ${n} meses, ${g}% garantido: ${brl(a.ecg)} (${pct((a.ecg / v) * 100, 2)})`}</li> })}</ul><p>Os exemplos contam o prazo em períodos de 30 dias a partir do número de meses; na simulação, o P usa as datas, e o valor muda com o dia da liberação. Só FGI Tradicional: o FGI PEAC e a tabela comercial de cada banco têm regras próprias. A tabela de custo mensal do site do BNDES é ilustrativa e pode não coincidir com esta conta.</p></>, valor: brl(res.fgi.ecg), nota: <>{nf(res.fgi.percentual, 0)}% garantido · à vista</> },
    { id: 'total', rotulo: 'Pagamento final', ajuda: 'Valor financiado + juros totais + IOF + TAC + ECG do FGI (quando marcado): tudo o que o cliente paga nesta projeção, sem outras tarifas ou seguros. Em LCD e TFBD inclui também a correção do saldo pela Selic ou pelo dólar.', valor: brl(res.total), nota: null },
  ].filter(Boolean) : []
  const alternatives = comparison?.ok ? comparison.alternatives : res ? [{ custo, result: res }] : []
  // Tabelas de opções ocupam só o necessário e crescem a cada alternativa comparada (largura em FinameComparisonLayout.css).
  const fitStyle = { '--fm-opcoes': Math.max(1, alternatives.length) }
  // Comparação executiva: só apresenta os resultados já calculados (nenhuma conta nova além da diferença entre as colunas).
  const resumida = comparar && !!comparison?.ok
  const opcao = index => `Opção ${String.fromCharCode(65 + index)} · ${alternatives[index].custo.toUpperCase()}`
  const cetsOk = cets.length === alternatives.length && cets.every(Boolean)
  const custoDe = index => cetsOk ? cets[index].anual : alternatives[index].result.total
  const melhor = resumida ? alternatives.reduce((best, _, index) => custoDe(index) < custoDe(best) - .005 ? index : best, 0) : 0
  const empate = resumida && alternatives.every((_, index) => Math.abs(custoDe(index) - custoDe(melhor)) < .005)
  // A coluna de diferença só existe com duas opções (B − A); com mais opções, cada uma ganha a própria coluna.
  const comDiferenca = resumida && alternatives.length === 2
  const matrizStyle = { '--fm-opcoes': alternatives.length + (comDiferenca ? 1 : 0) }
  const diferenca = (valores, tipo) => {
    // Em reais, a diferença é entre os valores já arredondados para centavos, como aparecem na tela.
    const d = tipo === 'pct' ? valores[1] - valores[0] : (Math.round(valores[1] * 100) - Math.round(valores[0] * 100)) / 100
    if (!valores.every(Number.isFinite) || Math.abs(d) < .005) return <td className="fm-delta fm-delta-zero">—</td>
    return <td className="fm-delta">{d > 0 ? '+' : '−'}{tipo === 'pct' ? `${nf(Math.abs(d), 2)} p.p.` : brl(Math.abs(d))}</td>
  }
  const linhaComparada = (rotulo, valores, tipo, { className, textos, extra } = {}) => <tr key={rotulo} className={className}><th scope="row">{rotulo}{extra}</th>{alternatives.map((item, index) => <td key={item.custo} className={`fm-result-${item.custo}${!empate && index === melhor ? ' fm-best' : ''}`}>{textos ? textos[index] : tipo === 'pct' ? pct(valores[index], 2) : brl(valores[index])}</td>)}{comDiferenca && diferenca(valores, tipo)}</tr>
  const grupoComparado = rotulo => <tr key={rotulo} className="fm-grp"><th scope="colgroup" colSpan={alternatives.length + 1 + (comDiferenca ? 1 : 0)}>{rotulo}</th></tr>
  // Marcos das parcelas: primeiro pagamento na carência (quando houver), primeira parcela com amortização e a última.
  const marcos = resumida ? (() => {
    const base = alternatives[0].result.parcelas.filter(row => row.vencimento)
    const juros = base.find(row => row.carencia && row.parcela > .005), amort = base.find(row => !row.carencia), ultima = base.at(-1)
    return [juros && ['1º pagamento de juros', juros.vencimento], amort && ['1ª parcela após carência', amort.vencimento], ultima && ultima !== amort && ['Última parcela', ultima.vencimento]].filter(Boolean)
  })() : []
  const parcelDates = [...new Set(alternatives.flatMap(item => item.result.parcelas.map(row => row.vencimento)))].filter(Boolean).sort()
  const historyItems = [
    { id: 'tfc', name: `TFC · ${tfcCodigo}`, short: 'TFC', unit: '% a.a.', decimals: 2, list: tfcPts.map(([period, value]) => ({ period, value })) },
    { id: 'tfb', name: `TFB · ${keyOf(faixa, liberacao)}`, short: 'TFB', unit: '% a.a.', decimals: 2, list: tfbPts.map(([period, value]) => ({ period, value })) },
  ].filter(item => comparar || item.id === custo)
  const quadro = (q) => <div className="fm-kpi" key={q.id}><span className="fm-rotulo">{q.rotulo}{ajuda(q.rotulo, q.ajuda)}</span><b>{q.valor}</b>{q.nota && <small>{q.nota}</small>}</div>
  const detalhamento = <details className="fm-details"><summary>Detalhamento · {custo.toUpperCase()}</summary><div className="fm-grade">{quadros.map(quadro)}</div></details>

  const regrasAjuda = (
    <>
        <ul>
          <li><b>O que financia:</b> {REGRAS.itens}. Fora: {REGRAS.foraDoProduto}. Nacionalização: {REGRAS.nacionalizacao}.</li>
          <li><b>Quem pede:</b> empresas de qualquer porte sediadas no país, empresário individual, MEI, produtor rural pessoa física, administração pública, cooperativas, fundações e associações; operação indireta, por agente financeiro credenciado.</li>
          <li><b>Limites:</b> até {REGRAS.participacaoMaxPct}% dos itens; {brl(REGRAS.tetoCliente12m)} por cliente a cada 12 meses (da homologação); reembolso de notas emitidas até {REGRAS.reembolsoMeses} meses antes do protocolo. Teto de {brl(REGRAS.tetoOperacao)} por operação, pela Circular BNDES 14/2022 (item 6.2.2, com a redação da Circular 64/2023); a página do produto não repete esse teto. Acima dele, a calculadora só avisa; confirme com o agente.</li>
          <li><b>Nota fiscal no reembolso:</b> {REGRAS.notaReembolso}.</li>
          <li><b>Prazo:</b> até {REGRAS.prazoMaxMeses} meses, com até {REGRAS.carenciaMaxMeses} de carência ({REGRAS.carenciaMaxTfbMeses} com TFB, TFC ou TFC MPME). Juros exigíveis na carência; depois, SAC mensal com juros junto do principal.</li>
          <li><b>Taxa:</b> custo financeiro (TFB, TFBD, TLP, Taxa LCD, Taxa Fixa Composta ou Taxa Fixa Composta MPME; Selic suspensa pela {REGRAS.selicSuspensa}) + taxa do BNDES ({pct(REGRAS.taxaBndes['mpme-nne'])} MPME N/NE; {pct(REGRAS.taxaBndes.mpme)} MPME nas demais regiões e grandes) + spread da instituição financeira (a "taxa do agente financeiro" do BNDES), negociado. Todos usam este cronograma: TFC e TFB com a taxa do painel; TLP, Taxa LCD e TFBD com a taxa do painel mais o índice projetado pelo Focus (editável). As telas próprias de TLP exigível e Selic + LCD continuam disponíveis para cronogramas informados à mão.</li>
          <li><b>IOF:</b> Premissa de recursos FINAME elegíveis e alíquota zero (art. 8º, IX); confirmar o enquadramento na contratação.</li>
          <li><b>Garantias:</b> livre negociação entre o agente e o cliente, observadas as normas do Banco Central; admitida a garantia do FGI (Tradicional ou PEAC) ou do FG BNDES-SEBRAE. Seguro conforme a política do agente.</li>
          <li><b>Conta:</b> taxa composta das três parcelas (capitalizada, padrão do BNDES: o exemplo oficial da página "Taxa de juros" é 1,07 × 1,015 × 1,03 − 1 = 11,86%); juros de cada período por dias corridos entre vencimentos reais (dia 15 ou próximo dia útil, feriados nacionais), em juros compostos sobre os dias do ano civil (365 ou 366); a taxa mensal exibida é só a equivalente de 1/12 do ano. O contrato do agente prevalece: diferenças de dias podem alterar os juros totais mesmo que a soma anual de dias úteis coincida, pois o saldo muda; juros da carência capitalizados dentro do período e pagos no fim dele; a parte dos juros que remunera cada um é apurada em camadas, no mesmo cronograma: custo financeiro = juros só com o custo; BNDES = juros com custo + BNDES menos juros só com o custo; spread da instituição = juros com a taxa completa menos juros com custo + BNDES; SAC mensal apenas em TFC/TFB nesta tela. TLP exigível tem perfil próprio, sem capitalizar IPCA positivo no principal. Esta tela presume recursos FINAME elegíveis e IOF zero; confirme o enquadramento na contratação.</li>
          <li>O que ainda depende de conferência com o agente: valor mínimo, periodicidade padrão dos juros na carência e a origem elegível dos recursos FINAME para o IOF zero. A conta aqui é estimativa; a proposta do agente prevalece.</li>
        </ul>
        <p className="fm-fontes-titulo">{GLOSSARY.fgi.t}</p>
        <ul>
          <li><b>O que é:</b> {GLOSSARY.fgi.a}</li>
          <li><b>Exemplo:</b> {GLOSSARY.fgi.b}</li>
          <li><b>Na prática:</b> {GLOSSARY.fgi.c}</li>
          <li><b>Para dominar:</b> {GLOSSARY.fgi.d}</li>
        </ul>
        <p className="fm-fontes-titulo">Base legal e onde cada regra foi conferida</p>
        <ul>{FONTES.map((f) => <li key={f.regra}><b>{f.regra}.</b> <a href={f.url} target="_blank" rel="noopener noreferrer">{f.fonte}</a>.</li>)}</ul>
    </>
  )

  return (
    <section className="cx cx-finame" aria-labelledby="calc-h">
      <h2 id="calc-h" className="cx-title"><span className="cx-icon" aria-hidden="true"><FinameIcon /></span>BNDES Finame Materiais</h2>

      <div className={`fm-workspace fm-quote-layout${comparar ? ' fm-cmp' : ''}`}>
      <article className="desk-panel cx-panel fm-input-panel">
        <header className="fm-rules"><h3 className="cx-heading sr-only">Dados da operação</h3><small>Regras do produto conferidas em {dmy(REGRAS.conferidoEm)}</small>{ajuda('Regras do produto e fontes', regrasAjuda)}</header>
        <div className="cx-form">
          <section className="fm-group fm-operation" aria-labelledby="fm-operation-h"><h3 id="fm-operation-h"><BndesIcon kind="operation" />Operação</h3><div className="fm-group-fields">
          {profileControl && <div className="fm-field-linha">{profileControl}</div>}
          {field('valor', 'Valor dos materiais', <MoneyInput id="fm-valor" aria-invalid={!!erros.valor} aria-describedby="fm-valor-err" value={valorText} onChange={setValorText} />, 'Bens industrializados nacionais, enquadrados na lista NCM e nos critérios CST/CSOSN do Finame Materiais; não se trata do credenciamento CFI do Finame tradicional. Notas de até 12 meses antes do protocolo.')}
          {field('part', 'BNDES financia (%)', input('part', partText, setPartText), 'Até 100% dos itens financiáveis.')}
          <p className="fm-financed" aria-live="polite"><span>Valor financiado</span><b>{financiadoTela === null ? '—' : brl(financiadoTela)}</b></p>
          {field('prazo', 'Prazo total (meses)', input('prazo', prazoText, value => { setPrazoText(value); setManualRates({}) }, { inputMode: 'numeric' }), 'Até 84 meses (7 anos).')}
          {field('car', 'Carência (meses)', input('car', carText, setCarText, { inputMode: 'numeric' }), fixa ? `Até 12 meses com ${custo.toUpperCase()}; juros exigíveis durante a carência.` : 'Até 24 meses; juros exigíveis durante a carência.')}
          {field('data-lib', 'Data da liberação', input('data-lib', liberacaoText, setLiberacaoText, { type: 'date', inputMode: undefined, min: '2000-01-01', max: '2100-12-31' }), 'Data em que o dinheiro é liberado. Os vencimentos caem todo dia 15 a partir do mês seguinte (ou no próximo dia útil, considerando os feriados nacionais e os da praça do contrato); os juros de cada parcela contam os dias corridos desde o vencimento anterior, sobre os dias do ano civil (365 ou 366). Mudar a data muda os juros e o CET.')}
          {field('praca', 'Praça do contrato (feriados)', <select id="fm-praca" value={praca} onChange={event => setPraca(event.target.value)}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>, `${PRACA_AJUDA} ${PRACA_RESSALVA}`)}
          {seg('porte' , 'Porte e região', '0,95% a.a. para MPMEs no Norte e Nordeste; 1,25% a.a. para MPMEs nas demais regiões e para grandes empresas (página do produto em 04/11/2026; a mudança de 1,15% para 1,25% em 22/01/2026 é informada pela Abimaq). O porte também escolhe a série da TFC. Editável.',
            PORTES.map((p) => <button key={p.id} type="button" aria-pressed={porte === p.id} onClick={() => { setPorte(p.id); setManualRates({}); setBndesText(String(p.taxa).replace('.', ',')) }}>{p.label}</button>))}
          </div></section>
          <section className="fm-group fm-costs" aria-labelledby="fm-costs-h"><h3 id="fm-costs-h"><BndesIcon kind="costs" />Custos</h3><div className="fm-group-fields">
          {field('custo', 'Custo financeiro', <select id="fm-custo" value={custo} onChange={event => { const next = finameFundingOption(event.target.value); if (next) { setCusto(next.id); if (outro === next.id) setOutro(next.id === 'tfc' ? 'tfb' : 'tfc') } }}>{FINAME_FUNDING_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>,
            <><p>{funding?.hint} Selic pura suspensa como custo financeiro ({REGRAS.selicSuspensa}).</p><p>As moedas contratuais já exibidas pelo painel têm unidades diferentes: US$ (604) é nível cambial; 143 é índice Selic; LD1 é a sobretaxa LCD; 024 é sobretaxa Selic; 236 é o componente mensal TLP-IPCA; TR1 e TR2 são referências ligadas à TR; TD1, TD2 e TD3 são a taxa TFBD em % ao ano, sem a variação do dólar. Esses valores não podem substituir indistintamente uma taxa anual do Finame.</p><ul>{FINAME_FUNDING_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></>)}
          {['inline', 'pos'].includes(funding?.mode) ? <><div className="fm-rates">{emUso.filter((id, k, all) => all.indexOf(id) === k).map(id => <div className={`fm-rate-row fm-field-rate-${id}`} key={id}>
            <label htmlFor={`fm-rate-${id}`}>{id.toUpperCase()}<span className="sr-only"> · taxa de referência em % a.a.</span></label>
            {input(`rate-${id}`, manualRates[id] ?? (quotes[id] ? String(quotes[id].valor).replace('.', ',') : ''), value => setManualRates(previous => ({ ...previous, [id]: value })))}
            <span className={`fm-chip ${rates[id].manual ? 'fm-chip-manual' : quotes[id] ? 'fm-chip-painel' : 'fm-chip-falta'}`}>{rates[id].manual ? <>Taxa manual{quotes[id] && <button type="button" className="fm-rate-reset" onClick={() => setManualRates(previous => ({ ...previous, [id]: null }))}>Usar cotação<span className="sr-only"> {id.toUpperCase()}</span></button>}</> : quotes[id] ? `Painel · ${dmy(quotes[id].data)}` : 'Sem cotação'}</span>
            {ajuda(`Taxa ${id.toUpperCase()}`, <><p>Taxa de referência usada na simulação, em % a.a. Você pode digitar outra para refletir uma proposta: ela vale só nesta simulação e não altera a cotação do painel. Ao mudar prazo ou porte e região, a taxa volta à referência do painel.</p><p>{quotes[id] ? <>Cotação do painel: {pct(quotes[id].valor, 4)} a.a. em {dmy(quotes[id].data)} · {quotes[id].nome || 'TFB'} ({quotes[id].codigo}){isFinamePos(id) ? '' : <> · faixa {id === 'tfc' ? (quotes[id].faixa === 60 ? 'até 60' : '61 a 120') : faixa} meses</>}.</> : 'Cotação do painel indisponível: informe a taxa manualmente ou aguarde a referência.'}</p></>)}
            <p className="sr-only fm-custo-valor">{quotes[id] ? <>Painel: {pct(quotes[id].valor, 4)} a.a. em {dmy(quotes[id].data)} · {quotes[id].nome || 'TFB'} ({quotes[id].codigo}){isFinamePos(id) ? '' : <> · faixa {id === 'tfc' ? (quotes[id].faixa === 60 ? 'até 60' : '61 a 120') : faixa} meses</>}</> : 'Cotação do painel indisponível.'}</p>
            <p className="cx-error" id={`fm-rate-${id}-err`} role={erros[`rate-${id}`] ? 'alert' : undefined}>{erros[`rate-${id}`] ?? ''}</p>
          </div>)}</div>
          {emUso.filter((id, k, all) => isFinamePos(id) && all.indexOf(id) === k).map(id => <div className="cx-field fm-projecao" key={`proj-${id}`}>
            <span className="fm-rotulo"><span className="cx-label" id={`fm-proj-${id}-l`}>{id === 'tfbd' ? 'Dólar projetado (fim de ano)' : `${INDICE_POS[id].rotulo} projetado`} · {id.toUpperCase()}</span>{ajuda(`Projeção ${INDICE_POS[id].rotulo}`, <><p>{id === 'tfbd' ? 'Dólar de fim de cada ano, em R$ por US$: mediana do Focus (Banco Central). A trajetória parte do dólar do dia (moeda 604 do BNDES) e passa por esses valores; depois do último ano, fica constante.' : id === 'lcd' ? 'Selic média de cada ano, em % a.a.: no ano da liberação, a Selic atual; nos seguintes, a média entre a Selic de fim do ano anterior e a de fim do ano (mediana do Focus), porque o BNDES capitaliza a média diária. Depois do último ano, vale o último valor.' : `${INDICE_POS[id].rotulo} de cada ano, em % a.a.: mediana do Focus (Banco Central). Depois do último ano, vale o último valor.`}</p><p>É hipótese de projeção: edite para testar outro cenário. Não altera o Focus do painel. O CET da parte fixa tira o índice, como pede a Res. CMN 4.881/2020 (art. 5º).</p>{macro.data?.focus?.date && <p>Focus de {dmy(macro.data.focus.date)}.</p>}</>)}</span>
            <div className="fm-proj-anos" role="group" aria-labelledby={`fm-proj-${id}-l`}>
              {id === 'tfbd' && <label className="fm-proj-ano"><span>Hoje</span><input inputMode="decimal" autoComplete="off" aria-label="Dólar do dia da liberação (R$ por US$)" value={cambioManual ?? (dolarPainel ? String(dolarPainel.valor).replace('.', ',') : '')} onChange={event => setCambioManual(event.target.value)} /></label>}
              {projecoes[id].map(item => <label key={item.ano} className={`fm-proj-ano${item.manual ? ' fm-proj-manual' : ''}`}><span>{item.ano}</span><input inputMode="decimal" autoComplete="off" aria-label={`${INDICE_POS[id].rotulo} ${item.ano}${id === 'tfbd' ? ' (R$ por US$)' : ' (% a.a.)'}`} value={item.texto} onChange={event => setTrajetoriaManual(previous => ({ ...previous, [id]: { ...previous[id], [item.ano]: event.target.value } }))} /></label>)}
            </div>
            {(trajetoriaManual[id] && Object.keys(trajetoriaManual[id]).length > 0 || (id === 'tfbd' && cambioManual != null)) && <button type="button" className="fm-rate-reset" onClick={() => { setTrajetoriaManual(previous => ({ ...previous, [id]: {} })); if (id === 'tfbd') setCambioManual(null) }}>Usar Focus</button>}
            <p className="cx-hint">{projecoes[id].length ? `Focus ${macro.data?.focus?.date ? `de ${dmy(macro.data.focus.date)}` : ''} · ${id === 'tfbd' ? 'R$ por US$' : '% a.a.'}${id === 'tfbd' ? ' · não disponível no Itaú' : ''}` : 'Focus indisponível agora.'}</p>
          </div>)}
          {erros.projecao && <p className="cx-error" role="alert">{erros.projecao}</p>}
          {/* As telas próprias continuam disponíveis para cronogramas informados à mão (combinado de 19/11/2026). */}
          {['tlp', 'lcd'].includes(custo) && <p className="cx-hint fm-projecao-propria">Cronograma do contrato em mãos? <a className="cx-action" href={`#calculadora/${funding.calculatorId}`} onClick={event => { if (onFundingView) { event.preventDefault(); onFundingView(funding.calculatorId) } }}>{custo === 'lcd' ? 'Abrir projeção Selic + LCD' : 'Abrir projeção TLP exigível'}</a> (não transfere as condições do Finame).</p>}
          </> : <div className="cx-field"><span className="cx-label">{funding?.label}</span><p className="cx-hint" role="status">{funding?.notice}</p>{funding?.mode === 'dedicated' && <><p className="cx-hint">Usa condições próprias; os dados do Finame não serão transferidos.</p><a className="cx-action" href={`#calculadora/${funding.calculatorId}`} onClick={event => { if (onFundingView) { event.preventDefault(); onFundingView(funding.calculatorId) } }}>{custo === 'lcd' ? 'Abrir projeção Selic + LCD' : 'Abrir projeção TLP exigível'}</a></>}</div>}
          <div className="fm-compare-control">
            <label htmlFor="fm-compare"><input id="fm-compare" type="checkbox" role="switch" checked={comparar} disabled={!['inline', 'pos'].includes(funding?.mode)} onChange={event => setComparar(event.target.checked)} />Comparar com outro custo</label>
            {comparar && <div className="fm-compare-outro"><label htmlFor="fm-outro">Comparar {custo.toUpperCase()} com</label><select id="fm-outro" value={outro} onChange={event => setOutro(event.target.value)}>{FINAME_FUNDING_OPTIONS.filter(option => option.id !== custo).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>}
            {comparar && erros.comparar && <p className="cx-error" role="alert">{erros.comparar}</p>}
            {comparar && [custo, outro].every(id => ['tfc', 'tfb'].includes(id)) && <p className="cx-hint">Mesma faixa e data de referência; liberação em até 90 dias.</p>}
          </div>
          {field('bndes', 'Taxa BNDES', <div className="cx-rate">{input('bndes', bndesText, setBndesText, { 'aria-label': 'Taxa do BNDES (% a.a.)' })}<span className="fm-unidade">% a.a.</span></div>, 'Taxa do BNDES conforme porte e região; editável para refletir a proposta da instituição.')}
          {field('agente', 'Spread do agente', <div className="cx-rate">{input('agente', agenteText, setAgenteText)}<span className="fm-unidade">% a.a.</span></div>, 'É a "taxa do agente financeiro" na nomenclatura do BNDES: a remuneração do banco, negociada com o cliente conforme risco, garantias e relacionamento; não há teto público. Compõe a taxa final junto com o custo financeiro e a taxa do BNDES.')}
          {field('tac', 'TAC (R$)', <MoneyInput id="fm-tac" aria-invalid={!!erros.tac} aria-describedby="fm-tac-err" value={tacText} onChange={setTacText} />, 'Tarifa de abertura de crédito cobrada pelo agente financeiro na contratação. Pré-preenchida com R$ 2.600,00 e editável; use zero se não houver. É somada ao custo total como despesa à vista, na liberação, e não entra no cronograma de juros. Confirme o valor na proposta do agente.')}
          {seg('per', 'Juros na carência', 'Juros exigíveis durante a carência, pagos em vencimentos contados retroativamente desde o fim da carência (Anexo I, item 5.3). Exemplo: 5 meses com periodicidade trimestral paga nos meses 2 e 5. Dentro de cada período, capitalizados mês a mês.',
            PERIODICIDADES.map((p) => <button key={p.id} type="button" aria-pressed={periodicidade === p.id} onClick={() => setPeriodicidade(p.id)}>{p.label}</button>))}
          <div className="fm-fgi">
            <label htmlFor="fm-fgi"><input id="fm-fgi" type="checkbox" role="switch" checked={fgiOn} onChange={e => setFgiOn(e.target.checked)} />FGI Tradicional</label>
            {fgiOn && field('fgipct', '% garantido', <select id="fm-fgipct" aria-invalid={!!erros.fgi} aria-describedby="fm-fgipct-err" value={fgiText} onChange={event => setFgiText(event.target.value)}>{Array.from({ length: (FGI.percentualMax - FGI.percentualMin) / FGI.percentualMultiplo + 1 }, (_, k) => String(FGI.percentualMin + k * FGI.percentualMultiplo)).map(v => <option key={v} value={v}>{v}%</option>)}</select>,
              <><p>{`De ${FGI.percentualMin} a ${FGI.percentualMax}% do financiamento, em múltiplos de ${FGI.percentualMultiplo} (art. 15 do Regulamento do FGI Tradicional). O agente define o percentual dentro do regulamento.`}</p><p>O FGI cobre parte da perda do banco. O agente pode repassar o ECG (Encargo por Concessão de Garantia) ao cliente, e aqui ele entra no custo total e no CET como despesa à vista, sem financiamento.</p>{prazo ? <p>{`Fator K da faixa de ${prazo} meses: ${nf(fatorKFgi(prazo), 2)}% por período de 30 dias. P = ${fgiPeriodos} períodos de 30 dias entre a liberação (${data(hoje)}) e o último vencimento (${data(vencimentoDia15(hoje, prazo, holidayCtx))}); o ECG muda com a data da liberação.${fgiPeriodos === 0 ? ' Com P zero o ECG é zero: o prazo é menor que 30 dias.' : ''}`}</p> : null}<p>O ECG é pago à vista na liberação (item 2.1.3 do Anexo V), sem incorporar ao saldo devedor e sem juros sobre o encargo. Só vale o FGI Tradicional; o FGI PEAC tem regras próprias e não é calculado aqui. A garantia não é seguro de crédito e não isenta o cliente de pagar. Limites: crédito garantido de até {brl(FGI.limiteCredito)} por cliente em cada agente, somadas as outras operações; não há teto para o valor do ECG. {FGI.vedacoes} Por isso a garantia vale aqui para TFC e TFB, com juros pagos na carência.</p></>)}
            {fgiOn && erros.fgi && <p className="cx-error" role="alert">{erros.fgi}</p>}
          </div>
          <ul className="fm-pills" aria-label="Condições fixas"><li>Amortização <b>SAC</b></li><li>Liberação <b>até 90 dias</b></li><li>ECG <b>à vista{res?.fgi ? ` · ${brl(res.fgi.ecg)}` : ''}</b></li></ul>
          </div></section>
        </div>
      </article>

      <div className="fm-results">
      <ExpandablePanel title={comparar ? 'Cotação comparativa' : 'Cotação da operação'} className="fm-result-workspace" open={cotacaoAmpliada} onOpenChange={setCotacaoAmpliada}>
      {res && <ExpandablePanel title="Dados básicos da operação"><dl className="fm-operation-summary">{[
        ['Valor financiado', brl(res.liberado)], ['Prazo total', `${prazo} meses`], ['Carência', `${carencia} meses`],
        ['Data da liberação', dmy(liberacaoText)], ['Porte e região', PORTES.find(item => item.id === porte).label], ['Amortização', sistema.toUpperCase()],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></ExpandablePanel>}
      <article className="desk-panel cx-panel" aria-live="polite" id="fm-result" tabIndex={-1}>
        <header className={comparar ? 'fm-hero' : undefined}><h3 className="cx-heading">{comparar ? 'Cotação comparativa' : 'Cotação da operação'}</h3><small>Projeção · CET estimado</small>{ajuda('Limites da projeção', 'Estimativa com as regras do produto e os custos financeiros do painel. Inclui a TAC e o custo da garantia FGI quando informados; sem outras tarifas ou seguros. O CET mostrado é estimado a partir deste fluxo e não substitui o CET do contrato. A proposta do agente financeiro prevalece.')}</header>

        {!resumida && <p className="fm-iof-premise">IOF zero presume recursos FINAME elegíveis. Confirme o enquadramento com a instituição.</p>}
        {!res && <div className="fm-quote-empty cx-wrap"><table className="cx-matrix"><thead><tr><th scope="col">Indicador</th><th scope="col">TFC</th><th scope="col">TFB</th></tr></thead><tbody>{['Taxa de referência', 'Taxa final', 'CET estimado', 'Primeira parcela', 'Última parcela', 'Custo total estimado'].map(label => <tr key={label}><th scope="row">{label}</th><td>—</td><td>—</td></tr>)}</tbody></table></div>}
        {!res && <p className="cx-hint cx-pad" role="status">{funding?.mode !== 'inline' ? funding?.notice : r?.erros?.length ? r.erros.join(' ') : 'Complete os campos indicados para calcular.'}</p>}
        {res && (
          <>
            {referenceRetained && !resumida && <p className="status stale cx-pad" role="status">Referência retida ou atualização indisponível. Confira as datas em Taxas e históricos antes de cotar.</p>}
            {!comparar && <section className="fm-destaques" aria-labelledby="fm-destaques-h">
              <h4 id="fm-destaques-h" className="sr-only">Principais números · {custo.toUpperCase()}</h4>
              {/* Resposta principal primeiro; equivalência em seguida; depois taxas e valores em reais, agrupados. Só apresentação: nenhuma conta nova. */}
              <div className="fm-answer">
                <div className="fm-answer-main"><small>CET estimado</small><b>{cet ? pct(cet.anual, 2) : 'Não mensurável'}</b>{cet && <span>a.a. · {cetTexto(cet, 'mensal')}</span>}</div>
                <div className="fm-answer-side"><small>Custo total estimado</small><b>{brl(res.total)}</b><span>{res.parcelasAmortizacao}x · SAC</span></div>
              </div>
              {spread != null && <p className="fm-equiv fm-rotulo">Equivale a <b>CDI + {pct(spread, 2)} a.a.</b>{ajuda('Equivale a CDI +', `Spread capitalizado sobre o CDI de hoje (${pct(cdi, 2)}) que dá a mesma taxa nominal: serve para comparar com o capital de giro.`)}</p>}
              <div className="fm-quote-empty cx-wrap"><table className="cx-matrix fm-grouped"><thead><tr><th scope="col">Resultado</th><th scope="col" className={`fm-result-${custo}`}>{custo.toUpperCase()}</th></tr></thead><tbody>
                <tr className="fm-grp"><th scope="colgroup" colSpan={2}>Taxas</th></tr>
                <tr><th scope="row">Taxa de referência</th><td>{pct(custoFinanceiro, 2)} a.a.</td></tr>
                <tr><th scope="row">Taxa final</th><td>{taxaResumo(res)}</td></tr>
                <tr className="fm-cet-row"><th scope="row">CET estimado{ajuda('CET estimado', cetAjuda)}</th><td>{cetResumo(cet)}</td></tr>
                {res.indice && <tr><th scope="row">{res.indice.rotulo} projetado{ajuda(`${res.indice.rotulo} projetado`, quadros.find(item => item.id === 'indice')?.ajuda)}</th><td>{quadros.find(item => item.id === 'indice')?.valor}</td></tr>}
                {res.cetFixo !== undefined && <tr><th scope="row">CET · parte fixa{ajuda('CET · parte fixa', quadros.find(item => item.id === 'cetfixo')?.ajuda)}</th><td>{cetResumo(res.cetFixo)}</td></tr>}
                <tr className="fm-grp"><th scope="colgroup" colSpan={2}>Valores em reais</th></tr>
                <tr><th scope="row">Valor financiado</th><td>{brl(res.liberado)}</td></tr>
                <tr className="fm-summary-row"><th scope="row">Primeira parcela após carência{ajuda('Primeira parcela', 'Primeira parcela com amortização. Quando houver carência com juros, podem existir cobranças anteriores conforme a periodicidade informada.')}</th><td>{brl(res.primeiraParcela)}</td></tr>
                <tr><th scope="row">Última parcela</th><td>{brl(res.ultimaParcela)}</td></tr>
                <tr><th scope="row">Juros totais</th><td>{brl(res.juros)}</td></tr>
                {res.correcao !== 0 && Number.isFinite(res.correcao) && <tr><th scope="row">Correção do saldo</th><td>{brl(res.correcao)}</td></tr>}
                <tr><th scope="row">TAC à vista</th><td>{brl(res.tac)}</td></tr>
                <tr><th scope="row">IOF</th><td>{brl(res.iof)}</td></tr>
                {res.fgi && <tr><th scope="row">ECG à vista</th><td>{brl(res.fgi.ecg)}</td></tr>}
                <tr className="fm-total-row"><th scope="row">Custo total estimado{ajuda('Custo total estimado', quadros.find(item => item.id === 'total')?.ajuda)}</th><td>{brl(res.total)}</td></tr>
              </tbody></table></div>
            </section>}
            {comparar && <div className="fm-comparison" aria-label={`Comparação ${custo.toUpperCase()} e ${outro.toUpperCase()}`}>
              {comparison?.ok ? <>
                <div className="fm-verdict">
                  <div className="fm-verdict-main"><small>{empate ? 'Resultado' : 'Menor custo'}</small><strong>{empate ? 'Custos iguais nas opções' : opcao(melhor)}</strong></div>
                  <div className="fm-verdict-kpi"><small>CET estimado</small><b>{cetsOk ? pct(cets[melhor].anual, 2) : 'Não mensurável'}</b>{cetsOk && <span>a.a.</span>}</div>
                  {comDiferenca && !empate && <div className="fm-verdict-kpi"><small>Custo total {alternatives[melhor].result.total <= alternatives[1 - melhor].result.total ? 'a menos' : 'a mais'} que a {alternatives[1 - melhor].custo.toUpperCase()}</small><b>{brl(Math.abs(alternatives[1 - melhor].result.total - alternatives[melhor].result.total))}</b></div>}
                  {comDiferenca && !empate && cetsOk && <div className="fm-verdict-kpi"><small>CET abaixo da {alternatives[1 - melhor].custo.toUpperCase()}</small><b>{nf(Math.abs(cets[1 - melhor].anual - cets[melhor].anual), 2)}</b><span>p.p.</span></div>}
                </div>
                {referenceRetained && <p className="status stale" role="status">Referência retida ou atualização indisponível. Confira as datas em Taxas e históricos antes de cotar.</p>}
                <div className="fm-exec" style={matrizStyle}>
                  <div className="cx-wrap" role="region" tabIndex={0} aria-label={`Resultados ${custo.toUpperCase()} e ${outro.toUpperCase()}`}><table className="cx-matrix fm-fit fm-exec-matrix" style={matrizStyle}><thead><tr><th scope="col">Taxas e valores</th>{alternatives.map((item, index) => <th key={item.custo} scope="col" className={`fm-opt fm-result-${item.custo}${!empate && index === melhor ? ' fm-best' : ''}`}>{!empate && index === melhor && <span className="fm-badge">{cetsOk ? 'Menor CET' : 'Menor custo'}</span>}<span className="fm-opt-name">{opcao(index)}</span><b>{cetsOk ? pct(cets[index].anual, 2) : '—'}</b><span className="fm-opt-unit">CET estimado a.a.</span></th>)}{comDiferenca && <th scope="col" className="fm-delta-head">Diferença<br />B − A<br /><small>Taxas em p.p. a.a.</small></th>}</tr></thead><tbody>
                    {grupoComparado('Taxas')}
                    {linhaComparada('Taxa de referência a.a.', alternatives.map(item => item.rate.value), 'pct')}
                    {linhaComparada('Taxa final', alternatives.map(item => item.result.taxa), 'pct', { textos: alternatives.map(item => taxaResumo(item.result)) })}
                    {linhaComparada('CET estimado', cets.map(item => item?.anual), 'pct', { className: 'fm-cet-row', textos: cets.map(item => cetResumo(item)), extra: ajuda('CET estimado', cetAjuda) })}
                    {grupoComparado('Parcelas')}
                    {[['Primeira parcela após carência', 'primeiraParcela'], ['Última parcela', 'ultimaParcela']].map(([label, key]) => linhaComparada(label, alternatives.map(item => item.result[key]), 'brl'))}
                    {grupoComparado('Composição do custo')}
                    {[['Juros totais', 'juros'], ...(alternatives.some(item => item.result.correcao) ? [['Correção do saldo', 'correcao']] : []), ['TAC à vista', 'tac'], ['IOF', 'iof'], ['ECG à vista', 'ecg']].map(([label, key]) => linhaComparada(label, alternatives.map(item => key === 'ecg' ? item.result.fgi?.ecg ?? 0 : item.result[key]), 'brl'))}
                    {linhaComparada('Custo total estimado', alternatives.map(item => item.result.total), 'brl', { className: 'fm-total-row' })}
                  </tbody></table></div>
                  <div className="fm-exec-side">
                    {marcos.length > 0 && <section className="fm-marcos" aria-labelledby="fm-marcos-h">
                      <h4 id="fm-marcos-h">Parcelas · marcos</h4>
                      <div className="fm-marcos-grid" style={fitStyle}>
                        <span className="fm-marcos-head">Momento</span>{alternatives.map(item => <span key={item.custo} className="fm-marcos-head fm-marcos-valor">{item.custo.toUpperCase()}</span>)}
                        {marcos.map(([rotulo, data]) => [<span key={rotulo} className="fm-marcos-rotulo">{rotulo} · {dmy(data)}</span>, ...alternatives.map(item => { const row = item.result.parcelas.find(p => p.vencimento === data); return <span key={rotulo + item.custo} className="fm-marcos-valor">{row ? brl(row.parcela) : '—'}</span> })])}
                      </div>
                      <button type="button" className="fm-marcos-todas" onClick={abrirParcelas} aria-controls="fm-parcelas">Ver todas as parcelas</button>
                    </section>}
                    <section className="fm-leitura" aria-labelledby="fm-leitura-h">
                      <h4 id="fm-leitura-h">Leitura</h4>
                      <p className="fm-difference">{Math.abs(comparison.totalDifference) < .005 ? 'Os totais projetados são iguais.' : <>Na {alternatives[1].custo.toUpperCase()}, o total fica <b>{brl(Math.abs(comparison.totalDifference))} {comparison.totalDifference > 0 ? 'maior' : 'menor'}</b></>}{cets.every(Boolean) && <>{Math.abs(comparison.totalDifference) < .005 ? ' O CET' : ' e o CET'} {Math.abs(cets[1].anual - cets[0].anual) < .005 ? 'é igual nas duas' : <><b>{nf(Math.abs(cets[1].anual - cets[0].anual), 2)} p.p. {cets[1].anual > cets[0].anual ? 'acima' : 'abaixo'}</b></>}</>}. Mesmas condições; inclui TAC e ECG do FGI quando informados, sem outras tarifas ou seguros.</p>
                      <p className="fm-iof-premise">IOF zero presume recursos FINAME elegíveis. Confirme o enquadramento com a instituição.</p>
                    </section>
                  </div>
                </div>
                <p className="fm-reference-sources">Referências do painel: {comparison.alternatives.map(item => `${item.custo.toUpperCase()} ${pct(item.rate.value, 4)} a.a.${item.rate.manual ? ' (taxa manual)' : ''} · ${item.quote ? `referência ${item.quote.codigo} de ${dmy(item.quote.data)}` : 'sem cotação do painel'}`).join('; ')}. Taxas manuais, quando indicadas, substituem a referência apenas nesta simulação.</p>
              </> : <p className="status stale" role="status">{comparison?.error || 'Complete os dados para comparar as alternativas.'}</p>}
            </div>}
            {comparar && comparison?.ok && <details className="fm-comparison-details fm-details"><summary>Taxas com mais casas</summary><div className="cx-wrap"><table className="cx-matrix fm-fit" style={fitStyle}><thead><tr><th scope="col">Indicador</th>{comparison.alternatives.map(item => <th scope="col" key={item.custo}>{item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{[['Taxa final a.a.', 'taxa'], ['CET estimado a.m.', 'cet']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{comparison.alternatives.map(item => <td key={item.custo}>{key === 'cet' ? cetTexto(cets[comparison.alternatives.indexOf(item)], 'mensal') : key === 'taxa' ? `${pct(item.result.taxa)} a.a.` : brl(key === 'ecg' ? item.result.fgi?.ecg ?? 0 : item.result[key])}</td>)}</tr>)}</tbody></table></div></details>}
            {!comparar && <p className="fm-reference-sources">{custo.toUpperCase()}: {pct(custoFinanceiro, 4)} a.a. · {rates[custo].manual ? 'Taxa manual' : `Cotação de ${dmy(quotes[custo]?.data)}`}</p>}
            {resumida ? detalhamento : <ExpandablePanel title="Composição do resultado">
              <div className="fm-parcel-scroll fm-composicao" role="region" tabIndex={0} aria-label="Composição das alternativas"><table className="cx-matrix fm-fit" style={fitStyle}><thead><tr><th scope="col">Indicador</th>{alternatives.map((item, index) => <th key={item.custo} scope="col">Opção {index === 0 ? 'A' : 'B'} · {item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{[
                ['Juros totais', 'juros'], ...(alternatives.some(item => item.result.correcao) ? [['Correção do saldo', 'correcao']] : []), ['IOF', 'iof'], ['TAC à vista', 'tac'], ['ECG à vista', 'ecg'], ['Total projetado', 'total'],
              ].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{alternatives.map(item => <td key={item.custo}>{brl(key === 'ecg' ? item.result.fgi?.ecg ?? 0 : item.result[key])}</td>)}</tr>)}</tbody></table></div>
              {detalhamento}
            </ExpandablePanel>}
            {comparar && spread != null && <p className="cx-hint cx-pad fm-rotulo">Equivale a <b>CDI + {pct(spread, 2)} a.a.</b>{ajuda('Equivale a CDI +', `Spread capitalizado sobre o CDI de hoje (${pct(cdi, 2)}) que dá a mesma taxa nominal: serve para comparar com o capital de giro.`)}</p>}
            {res.avisos.map((a) => <Estado key={a} tipo="aviso">{a}</Estado>)}
          </>
        )}
      </article>

      </ExpandablePanel>
      </div>
      </div>

      {/* Detalhe abaixo, em largura total: parcelas, histórico, memória do fluxo e premissas (recolhidos). */}
      <div className="fm-secondary">
      {res && <details id="fm-parcelas" ref={parcelasRef} className="desk-panel cx-panel fm-parcels-callout fm-fluxo-panel">
        <summary>{resumida ? 'Parcelas · opções lado a lado' : 'Parcelas da operação'}</summary>
        <div className="fm-installments-content">
        <p className="cx-hint">Datas projetadas · inclui juros na carência.{ajuda('Leitura das parcelas', 'Despesas à vista permanecem na composição e na memória completa. Traço significa ausência de parcela nessa data. Os valores A e B estão alinhados pelo vencimento para comparação.')}</p>
        <div className="fm-parcel-scroll" role="region" tabIndex={0} aria-label="Datas e parcelas das alternativas"><table className="cx-matrix fm-fit" style={fitStyle}><thead><tr><th scope="col">Data</th>{alternatives.map((item, index) => <th key={item.custo} scope="col">Opção {index === 0 ? 'A' : 'B'} · {item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{parcelDates.map(date => <tr key={date}><th scope="row">{dmy(date)}</th>{alternatives.map(item => { const row = item.result.parcelas.find(p => p.vencimento === date); return <td key={item.custo}>{row ? brl(row.parcela) : '—'}</td> })}</tr>)}</tbody></table></div>
        </div>
      </details>}
      {funding?.mode === 'inline' && <ExpandablePanel title="Histórico dos indexadores" className="fm-indexers-callout">
        <p className="cx-hint">Histórico, não projeção futura.{ajuda('Histórico dos indexadores', 'Referências TFC/TFB carregadas no painel. Taxas manuais informadas na simulação não alteram estes históricos.')}</p>
        {referenceRetained && <p className="status stale">Referência retida ou atualização indisponível; confira as datas abaixo.</p>}
        <ComparaSeries compactHelp items={historyItems} loading={bndes.status === 'loading' || moedas.status === 'loading'} period={{ preset: chartPreset, setPreset: setChartPreset, custom: chartCustom, setCustom: setChartCustom }} />
      </ExpandablePanel>}


      {res && (
        <ExpandablePanel title="Memória completa do fluxo"><details className="desk-panel cx-panel fm-fluxo-panel">
          <summary>Cronograma ilustrativo · {custo.toUpperCase()}</summary>
          <header><h3 className="cx-heading">Fluxo parcela a parcela{ajuda('Fluxo parcela a parcela', `Liberação em ${data(hoje)}. Vencimentos todo dia 15; se não for dia útil (fim de semana ou feriado nacional), no próximo dia útil. Os juros de cada linha contam os dias corridos desde o vencimento anterior, sobre os dias do ano civil; não é memória contratual. O indexador é o da cotação em uso. Em TLP e LCD, os juros usam os dias úteis do período sobre 252 (feriados nacionais e da praça); em TFBD, os dias corridos sobre 360. "Juros pagos" é o que vence no mês: na carência, os juros acumulam e são pagos na periodicidade escolhida. IOF zero pela premissa de recursos FINAME elegíveis. Na linha de liberação, "Total pago" soma as despesas à vista: IOF, TAC e ECG do FGI quando pago à vista.`)}</h3></header>
          <p className="cx-hint cx-pad" id="fm-calendario-hipotetico">Calendário estimado. Não use como memória contratual.{ajuda('Calendário do fluxo', 'Calendário pela data da liberação: vencimento todo dia 15, ou no próximo dia útil, com juros por dias corridos.')}</p>
          <div className="cx-wrap fm-fluxo" role="region" aria-label="Fluxo parcela a parcela" aria-describedby="fm-calendario-hipotetico" tabIndex={0}>
            <table className="cx-matrix fm-tabela">
              <thead><tr><th scope="col">Nº</th><th scope="col">Vencimento</th><th scope="col">Saldo inicial</th>{res.correcao !== 0 && <th scope="col">Correção</th>}<th scope="col">Juros pagos</th><th scope="col">Amortização</th><th scope="col">Parcela</th><th scope="col">Total pago</th><th scope="col">Saldo final</th></tr></thead>
              <tbody>
                <tr className="fm-liberacao"><th scope="row">0 · liberação</th><td>{data(hoje)}</td><td>—</td>{res.correcao !== 0 && <td>—</td>}<td>—</td><td>—</td><td>—</td><td>{brl(res.iofFixo + res.tac + (res.fgi && !res.fgi.incorporado ? res.fgi.ecg : 0))}</td><td>{brl(res.financiado)}</td></tr>
                {res.parcelas.map((p) => <tr key={p.mes} className={p.carencia ? 'fm-carencia' : undefined}><th scope="row">{p.mes}{p.carencia ? ' · carência' : ''}</th><td>{p.vencimento ? dmy(p.vencimento) : data(vencimentoDia15(hoje, p.mes, holidayCtx))}</td><td>{brl(p.saldoInicial)}</td>{res.correcao !== 0 && <td>{brl(p.correcao)}</td>}<td>{brl(p.juros)}</td><td>{brl(p.amortizacao)}</td><td>{brl(p.parcela)}</td><td>{brl(p.pago)}</td><td>{brl(p.saldo)}</td></tr>)}
              </tbody>
              <tfoot><tr><th scope="row">Total</th><td>{res.parcelas.length} meses</td><td>—</td>{res.correcao !== 0 && <td>{brl(res.correcao)}</td>}<td>{brl(res.juros)}</td><td>{brl(res.financiado + res.correcao)}</td><td>{brl(res.juros + res.financiado + res.correcao)}</td><td>{brl(res.total)}</td><td>—</td></tr></tfoot>
            </table>
          </div>
        </details></ExpandablePanel>
      )}

      <details className="fm-premises"><summary>Premissas e limites da simulação</summary><p>SAC · taxa capitalizada · liberação em até 90 dias para TFC e TFB · ECG à vista, quando houver FGI.</p><p>TLP, Taxa LCD e TFBD: taxa do painel (J, LD1 ou TFBD) mais a hipótese do índice pelo Focus ano a ano, editável. TLP: IPCA cobrado com os juros, sem corrigir o saldo, dias úteis/252. LCD: Selic capitalizada no saldo (média dos fins de ano do Focus; no ano da liberação, a Selic atual), dias úteis/252. TFBD: saldo pela variação do dólar e juros proporcionais, dias corridos/360; não disponível no Itaú. FGI Tradicional só na TLP (o regulamento veda Selic/LCD capitalizada e TFBD). Projeção, não memória contratual: o contrato usa índices mensais defasados e arredondamentos próprios.</p><p>Recursos FINAME elegíveis e IOF zero (Decreto 6.306/2007, art. 8º, IX). Confirme o enquadramento com a instituição na contratação; outras origens de recursos exigem análise tributária.</p><p>Simulação indicativa, sujeita à análise e aprovação. Não constitui proposta ou compromisso de crédito.</p></details>
      </div>

      <p className="status">Base de regras: {dmy(REGRAS.conferidoEm)} · Custos: painel BNDES · Fontes em Configurações &gt; Base de dados.</p>
    </section>
  )
}
