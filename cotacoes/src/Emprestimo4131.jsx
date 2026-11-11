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
import { busDaysIn } from './holidays.js'
import { FREQS, IOF_SHORT_TERM, IRRF_OPTIONS, MAX_MONTHS, hedge4131, loan4131, unhedged4131 } from './emprestimo4131.js'
import { E4_FX_SCENARIOS, E4_SOURCES } from './emprestimo4131Presentation.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const usd = (v) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v, d = 2) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const fx = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const signed = (v, f) => `${v >= 0 ? '+' : '−'} ${f(Math.abs(v))}`
const dm = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const CONFERIDO_EM = '11/11/2026'
const IR_PAYERS = [{ id: 'sim', label: 'Tomador (gross-up)' }, { id: 'nao', label: 'Credor' }]
// Regras levantadas nas fontes oficiais; detalhes e pontos não confirmados em docs/emprestimo-4131.md.
const REGRAS = [
  ['Contratação', 'Livre, em qualquer moeda, sem aprovação prévia do Banco Central. Custos compatíveis com o mercado internacional e claros no contrato.', 'Res. BCB 278/2022, arts. 5º e 6º'],
  ['Declaração ao Banco Central', 'O devedor declara no SCE-Crédito a operação a partir de US$ 1 milhão. O código gerado vai em toda remessa. Mudança de prazo ou de condições: declarar em 30 dias.', 'Res. BCB 278, arts. 17, 21, 23 e 25'],
  ['Remessas', 'Limitadas a principal, juros e encargos. Liquidação antecipada é permitida.', 'Res. BCB 278, arts. 7º e 8º'],
  ['IOF-câmbio na entrada', 'Prazo médio até 364 dias: 3,5%. Acima disso: zero, na entrada e na saída. Alíquota vigente por decisão provisória do STF (2025).', 'Decreto 6.306/2007, art. 15-B, XI e XII'],
  ['Liquidação antecipada', 'Se descumprir o prazo de 364 dias, o IOF de 3,5% é devido com multa e juros.', 'Decreto 6.306, art. 15-B, § 2º'],
  ['IR na fonte sobre os juros', '15%, só sobre os juros. Quando o tomador assume o imposto, a base é reajustada: 100 de juros viram 117,65. País com tributação favorecida: 25% (a confirmar com o tributário).', 'RIR/2018, arts. 760 e 786'],
  ['Swap', 'IR na fonte sobre o ganho na liquidação, de 22,5% a 15% conforme o prazo, compensável no IRPJ. IOF sobre derivativos: zero desde 2013.', 'IN RFB 1.585/2015, arts. 46, 50 e 70; Decreto 6.306, art. 32-C'],
  ['NDF', 'Sem ajuste diário e sem margem. Liquida pela diferença no vencimento, com a PTAX do dia útil anterior. Exige contrato geral de derivativos. IR na fonte de 0,005%.', 'Ficha B3 do Termo de Moeda; Lei 11.033/2004, art. 2º'],
  ['PIS/Cofins', '4,65% sobre ganho financeiro, inclusive de hedge. Zero sobre a variação cambial do empréstimo e sobre hedge de proteção em bolsa ou balcão organizado.', 'Decreto 8.426/2015, art. 1º, §§ 3º e 4º'],
  ['Perdas no hedge', 'Dedutíveis sem o limite dos ganhos quando a operação protege obrigação da empresa.', 'Lei 8.981/1995, art. 77; IN RFB 1.585, art. 71'],
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

// Empréstimo externo (4131) no padrão da calculadora BNDES: dados à esquerda, cotação à direita,
// apresentação e PDF congelados, cronograma e premissas recolhidos.
export default function Emprestimo4131({ onBack }) {
  const hol = useHolidays()
  const [area, setArea] = useState('simulate')
  const [ampliada, setAmpliada] = useState(false)
  const ampliarRef = useRef(null)
  const [principalText, setPrincipalText] = useState('10.000.000,00')
  const [rateText, setRateText] = useState('5,80')
  const [spotText, setSpotText] = useState('5,4000')
  const [start, setStart] = useState(cgToday)
  const [monthsText, setMonthsText] = useState('24')
  const [freq, setFreq] = useState('6')
  const [irrf, setIrrf] = useState('15')
  const [grossUp, setGrossUp] = useState('sim')
  const [flatText, setFlatText] = useState('0,50')
  const [guaranteeText, setGuaranteeText] = useState('0,00')
  const [diText, setDiText] = useState('12,75')
  const [cupomText, setCupomText] = useState('5,20')
  const [swapText, setSwapText] = useState('0,00')
  const [ndfText, setNdfText] = useState('0,00')

  useEffect(() => {
    if (!ampliada) return
    const onKey = (event) => { if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) setAmpliada(false) }
    const previous = document.body.style.overflow, trigger = ampliarRef.current
    document.body.style.overflow = 'hidden'; window.addEventListener('keydown', onKey); trigger?.focus()
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = previous; trigger?.focus() }
  }, [ampliada])

  const money = parseMoneyInput(principalText)
  const rate = parseDecimal(rateText)
  const spot = parseDecimal(spotText)
  const months = /^\d+$/.test(monthsText.trim()) ? Number(monthsText) : null
  const optional = (text) => (text.trim() === '' ? 0 : parseDecimal(text))
  const flat = optional(flatText)
  const guarantee = optional(guaranteeText)
  const di = parseDecimal(diText)
  const cupom = parseDecimal(cupomText)
  const swapSpread = optional(swapText)
  const ndfMarkup = optional(ndfText)
  const errors = {
    principal: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    rate: rate !== null && rate <= 100 ? null : 'Informe a taxa em % ao ano, por exemplo 5,80.',
    spot: spot !== null && spot > 0 ? null : 'Informe o câmbio, por exemplo 5,4000.',
    start: start ? null : 'Informe a data do desembolso.',
    months: months !== null && months >= 1 && months <= MAX_MONTHS ? null : `Informe o prazo em meses, número inteiro de 1 a ${MAX_MONTHS}.`,
    flat: flat !== null && flat < 100 ? null : 'Informe o flat em % (zero se não houver).',
    guarantee: guarantee !== null && guarantee <= 100 ? null : 'Informe a fiança em % ao ano (zero se não houver).',
    di: di !== null && di > 0 ? null : 'Informe o DI pré em % ao ano, por exemplo 12,75.',
    cupom: cupom !== null ? null : 'Informe o cupom cambial em % ao ano, por exemplo 5,20.',
    swap: swapSpread !== null ? null : 'Informe o spread do banco em % ao ano (zero se não houver).',
    ndf: ndfMarkup !== null ? null : 'Informe o acréscimo do banco em % (zero se não houver).',
  }
  const loanErrors = ['principal', 'rate', 'spot', 'start', 'months', 'flat', 'guarantee'].some((k) => errors[k])
  const hedgeErrors = ['di', 'cupom', 'swap', 'ndf'].some((k) => errors[k])
  const loanResult = loanErrors ? null : loan4131({ principal: money.value, rate, spot, start, months, freq: Number(freq), irrf: Number(irrf), grossUp: grossUp === 'sim', flat, guarantee })
  const loan = loanResult?.ok ? loanResult : null
  // Dias úteis de cada pagamento com os feriados nacionais.
  const hedgeResult = loan && !hedgeErrors ? hedge4131(loan, { di, cupom, swapSpread, ndfMarkup, busDays: (a, b) => busDaysIn(a, b, ['BR'], hol.ctx) }) : null
  const hedge = hedgeResult?.ok ? hedgeResult : null
  const scenarios = loan ? E4_FX_SCENARIOS.map((s) => unhedged4131(loan, s)).filter((s) => s.ok) : []
  const parado = scenarios.find((s) => s.fxChange === 0) ?? null
  const labels = { freq: FREQS.find((f) => f.id === freq)?.label, irPayer: IR_PAYERS.find((p) => p.id === grossUp)?.label }
  const pendencia = loanResult?.error || hedgeResult?.error || (Object.values(errors).some(Boolean) ? 'Complete os campos indicados para calcular.' : null)

  const ajuda = (label, texto) => (texto ? <Help label={`Ajuda: ${label}`}>{texto}</Help> : null)
  const field = (key, slot, label, control, hint) => (
    <div className={`cx-field fm-field-${slot}`}>
      <span className="fm-rotulo"><label htmlFor={`e4-${key}`}>{label}</label>{ajuda(label, hint)}</span>
      {control}
      <p className="cx-error" id={`e4-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`e4-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!errors[key]} aria-describedby={`e4-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...extra} />
  const rateInput = (key, value, onChange, unit = '% a.a.') => <div className="cx-rate">{input(key, value, onChange)}<span className="fm-unidade">{unit}</span></div>
  const select = (key, value, onChange, options) => <select id={`e4-${key}`} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
  const quadros = loan ? [
    ['Custo all-in em dólar', `${pct(loan.allIn)} a.a.`, 'dias corridos/365', 'Taxa ao ano que iguala o valor líquido recebido aos pagamentos em dólar: juros, IR do tomador, fiança e principal.'],
    ['Taxa com o IR por cima', `${pct(loan.grossedRate)} a.a.`, `contratual ${pct(loan.rate)}`, 'Taxa contratual dividida por (1 − alíquota do IR), quando o tomador assume o imposto.'],
    ['Valor líquido recebido', brl(loan.netBrl), usd(loan.netUsd), 'Principal menos flat e IOF, convertido pelo câmbio de entrada.'],
    ['Flat na entrada', usd(loan.flatUsd), pct(loan.flat)],
    ['IOF-câmbio na entrada', usd(loan.iofUsd), pct(loan.iofRate), `Prazo médio de ${loan.avgTermDays} dias corridos: ${pct(IOF_SHORT_TERM.rate)} até ${IOF_SHORT_TERM.maxDays} dias e zero acima (Decreto 6.306/2007, art. 15-B).`],
    ['IR pago pelo tomador', usd(loan.totals.irrf), `${pct(loan.irrf, 0)} sobre os juros`],
    ['Juros totais', usd(loan.totals.interest), `${loan.avgTermDays} dias`],
    ['Total a pagar', usd(loan.totals.usd), 'em dólar'],
  ] : []

  return (
    <section className="cx bw e4" aria-labelledby="bw-title">
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
              <header className="fm-rules"><h3 className="cx-heading sr-only">Dados da operação</h3><small>Regras conferidas em {CONFERIDO_EM}</small>{ajuda('Regras e fontes', <><p>Regras do Banco Central, da Receita Federal e da B3 lidas nas fontes oficiais. A lista completa está em Regras e fontes.</p><ul>{E4_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul></>)}</header>
              <div className="cx-form">
                <section className="fm-group fm-operation" aria-labelledby="e4-operation-h"><h3 id="e4-operation-h"><BndesIcon kind="operation" />Operação</h3><div className="fm-group-fields">
                  {field('principal', 'valor', 'Principal (US$)', <MoneyInput prefix="US$" id="e4-principal" aria-invalid={!!errors.principal} aria-describedby="e4-principal-err" value={principalText} onChange={setPrincipalText} />, 'Valor do empréstimo em dólar. O principal é pago de uma vez, no vencimento.')}
                  {field('rate', 'part', 'Taxa', rateInput('rate', rateText, setRateText), 'Taxa ao ano do contrato, linear: principal × taxa × dias corridos ÷ 360. Em taxa flutuante, some a referência (SOFR) e o spread.')}
                  {field('months', 'prazo', 'Prazo total (meses)', input('months', monthsText, setMonthsText, { inputMode: 'numeric' }), `De 1 a ${MAX_MONTHS} meses. O prazo define o IOF na entrada: até ${IOF_SHORT_TERM.maxDays} dias de prazo médio, ${pct(IOF_SHORT_TERM.rate)}.`)}
                  {field('spot', 'car', 'Câmbio (R$/US$)', input('spot', spotText, setSpotText), 'Câmbio do dia do desembolso. Converte o valor recebido e é a base do câmbio a termo.')}
                  {field('start', 'data-lib', 'Data do desembolso', input('start', start, setStart, { type: 'date', inputMode: undefined, min: '2000-01-01', max: '2100-12-31' }), 'Data em que o dinheiro entra. Os pagamentos caem no mesmo dia dos meses seguintes, sem ajuste para dia útil.')}
                  {field('freq', 'per', 'Pagamento de juros', select('freq', freq, setFreq, FREQS), 'Frequência dos juros. O principal é sempre pago no vencimento.')}
                  <p className="fm-financed" aria-live="polite"><span>Valor líquido recebido</span><b>{loan ? brl(loan.netBrl) : '—'}</b></p>
                </div></section>
                <section className="fm-group fm-costs" aria-labelledby="e4-costs-h"><h3 id="e4-costs-h"><BndesIcon kind="costs" />Custos e tributos</h3><div className="fm-group-fields">
                  {field('irrf', 'custo', 'IR na fonte sobre os juros', select('irrf', irrf, setIrrf, IRRF_OPTIONS), 'Regra geral: 15% sobre os juros pagos ao exterior (RIR/2018, art. 760). Credor em país com tributação favorecida: 25%. Tratado ou isenção podem reduzir: confirme com o tributário.')}
                  {field('gross', 'porte', 'Quem arca com o IR', select('gross', grossUp, setGrossUp, IR_PAYERS), 'Tomador: o credor recebe os juros cheios e o tomador paga o imposto por cima (gross-up), com a base reajustada (art. 786). Credor: o imposto sai dos juros e não aumenta o custo do tomador.')}
                  {field('flat', 'bndes', 'Flat · estruturação', rateInput('flat', flatText, setFlatText, '%'), 'Comissão cobrada na entrada, em % do principal. Sai do valor recebido. Use zero se não houver.')}
                  {field('guarantee', 'agente', 'Fiança ou SBLC', rateInput('guarantee', guaranteeText, setGuaranteeText), 'Custo da garantia bancária, em % ao ano sobre o principal, pago junto com os juros. Use zero se não houver.')}
                  <ul className="fm-pills" aria-label="Condições fixas"><li>Principal <b>no vencimento</b></li><li>Juros <b>linear 360</b></li><li>IOF na entrada <b>{loan ? pct(loan.iofRate) : 'automático'}</b></li></ul>
                </div></section>
                <section className="fm-group fm-payment e4-hedge" aria-labelledby="e4-hedge-h"><h3 id="e4-hedge-h"><BndesIcon kind="chart" />Proteção cambial</h3><div className="fm-group-fields">
                  {field('di', 'di', 'DI pré do prazo', rateInput('di', diText, setDiText), 'Taxa DI prefixada do prazo médio da operação, ao ano, base 252 dias úteis, na data da cotação.')}
                  {field('cupom', 'cupom', 'Cupom cambial', rateInput('cupom', cupomText, setCupomText), 'Juro em dólar no Brasil para o prazo médio, ao ano, linear, base 360 dias corridos. Com o DI, define o câmbio a termo de cada pagamento.')}
                  {field('swap', 'swap', 'Spread do banco no swap', rateInput('swap', swapText, setSwapText), 'Taxa ao ano que o banco soma ao custo do swap. Deixe zero para ver o custo teórico.')}
                  {field('ndf', 'ndf', 'Acréscimo do banco no NDF', rateInput('ndf', ndfText, setNdfText, '%'), 'Percentual que o banco soma à taxa a termo teórica. Deixe zero para ver o custo teórico.')}
                </div></section>
                <button type="button" className="fm-show-result" disabled={!hedge} onClick={() => { const element = document.getElementById('fm-result'); element?.focus(); element?.scrollIntoView({ block: 'start' }) }}>{hedge ? <><span>Com swap <b>CDI {signed(hedge.swap.spread, pct)}</b></span><span>Ver resultado ↓</span></> : 'Ver resultado da simulação'}</button>
              </div>
            </article>

            <div className={ampliada ? 'fm-results fm-zoomed' : 'fm-results'}>
              <div className="fm-print-actions"><Emprestimo4131Presentation loan={loan} hedge={hedge} labels={labels} /><Emprestimo4131Print loan={loan} hedge={hedge} labels={labels} /></div>

              {ampliada && <div className="fm-zoom-backdrop" onClick={() => setAmpliada(false)} aria-hidden="true" />}
              <article className={ampliada ? 'desk-panel cx-panel fm-zoom' : 'desk-panel cx-panel'} aria-live="polite" id="fm-result" tabIndex={-1} role={ampliada ? 'dialog' : undefined} aria-modal={ampliada ? 'true' : undefined} aria-label={ampliada ? 'Cotação comparativa ampliada' : undefined}>
                <header className="fm-hero"><h3 className="cx-heading">Cotação comparativa</h3><small>Projeção · custo estimado</small>{ajuda('Limites da projeção', 'Estimativa para comparar propostas. Usa um DI e um cupom cambial para todos os prazos; a mesa do banco usa uma taxa por prazo, o spread do derivativo e o risco de crédito. Não inclui IR nem PIS/Cofins sobre ganho do swap ou do NDF. A cotação do banco e o contrato prevalecem.')}<button type="button" ref={ampliarRef} className="fm-zoom-toggle" disabled={!loan} aria-pressed={ampliada} aria-label={ampliada ? 'Fechar a cotação ampliada' : 'Ampliar a cotação na tela'} title={ampliada ? 'Fechar (Esc)' : 'Ampliar na tela'} onClick={() => setAmpliada((value) => !value)}><BndesIcon kind={ampliada ? 'collapse' : 'expand'} /></button></header>
                {hedge && <div className="fm-headline" aria-label="Custo com swap e com NDF">
                  <div><span>Com swap · dívida em CDI</span><b>CDI {signed(hedge.swap.spread, pct)}</b><small>{pct(hedge.swap.pctCdi, 1)} do CDI</small></div>
                  <div><span>Com NDF · prefixado</span><b>{pct(hedge.ndf.pre)} a.a.</b><small>Total {brl(hedge.ndf.totalBrl)}</small></div>
                </div>}
                <p className="fm-iof-premise">{loan ? `IOF-câmbio de ${pct(loan.iofRate)} na entrada: prazo médio de ${loan.avgTermDays} dias corridos. Liquidar antes do prazo pode gerar o IOF com multa e juros.` : `IOF-câmbio na entrada: ${pct(IOF_SHORT_TERM.rate)} com prazo médio até ${IOF_SHORT_TERM.maxDays} dias; zero acima.`}</p>
                <div className="fm-comparison" aria-label="Sem proteção, com swap e com NDF">
                  <div className="cx-wrap" role="region" tabIndex={0} aria-label="Resultados dos três caminhos"><table className="cx-matrix"><thead><tr><th scope="col">% a.a. ou R$</th><th scope="col">Sem proteção</th><th scope="col">Com swap</th><th scope="col">Com NDF</th></tr></thead><tbody>
                    <tr><th scope="row">A dívida fica em</th><td>Dólar</td><td>CDI</td><td>Reais, pré</td></tr>
                    <tr className="fm-cet-row"><th scope="row">Custo em reais ao ano{ajuda('Custo em reais ao ano', 'Sem proteção: custo com o dólar parado, em dias corridos/365; muda com o câmbio de cada pagamento. Com swap: custo com o DI informado, base 252. Com NDF: custo fixo, base 252.')}</th><td>{parado ? pct(parado.cost) : '—'}</td><td>{hedge ? pct(hedge.swap.pre) : '—'}</td><td>{hedge ? pct(hedge.ndf.pre) : '—'}</td></tr>
                    <tr><th scope="row">Leitura em CDI{ajuda('Leitura em CDI', 'Com swap, a dívida corre em CDI mais o spread indicado. Com NDF, o custo é fixo: a leitura em CDI vale só para comparar hoje e não acompanha o CDI.')}</th><td>—</td><td>{hedge ? `CDI ${signed(hedge.swap.spread, pct)}` : '—'}</td><td>{hedge ? `CDI ${signed(hedge.ndf.spread, pct)}` : '—'}</td></tr>
                    <tr><th scope="row">% do CDI</th><td>—</td><td>{hedge ? pct(hedge.swap.pctCdi, 1) : '—'}</td><td>{hedge ? pct(hedge.ndf.pctCdi, 1) : '—'}</td></tr>
                    <tr><th scope="row">Risco que sobra</th><td>Câmbio</td><td>Alta do CDI</td><td>Desfazer antes</td></tr>
                    <tr className="fm-total-row"><th scope="row">Total a pagar em reais</th><td>{parado ? brl(parado.totalBrl) : '—'}</td><td>Segue o CDI</td><td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}</td></tr>
                  </tbody></table></div>
                  {hedge && <p className="fm-difference">O NDF compensa se o dólar subir mais de <b>{pct(hedge.ndf.breakeven)} ao ano</b>. Abaixo disso, ficar sem proteção sai mais barato, com o risco do câmbio.</p>}
                  {loan && <p className="fm-reference-sources">Custo all-in em dólar: {pct(loan.allIn)} a.a. · DI {di !== null ? pct(di) : '—'} a.a. e cupom cambial {cupom !== null ? pct(cupom) : '—'} a.a., informados na tela. Sem proteção considera o dólar parado.</p>}
                </div>
                {pendencia && <p className="cx-hint cx-pad" role="status">{pendencia}</p>}
                {loan && <details className="fm-details"><summary>Composição do custo em dólar</summary>
                  <div className="fm-grade">{quadros.map(([rotulo, valor, nota, texto]) => <div className="fm-kpi" key={rotulo}><span className="fm-rotulo">{rotulo}{ajuda(rotulo, texto)}</span><b>{valor}</b>{nota && <small>{nota}</small>}</div>)}</div>
                </details>}
                {loan && scenarios.length > 0 && <details className="fm-details"><summary>Sem proteção · custo conforme o dólar</summary>
                  <div className="cx-wrap" role="region" tabIndex={0} aria-label="Custo sem proteção por cenário de câmbio"><table className="cx-matrix"><thead><tr><th scope="col">Dólar ao ano</th><th scope="col">Câmbio final</th><th scope="col">Total a pagar</th><th scope="col">Custo a.a.</th></tr></thead><tbody>
                    {scenarios.map((s) => <tr key={s.fxChange}><th scope="row">{s.fxChange === 0 ? 'Parado' : signed(s.fxChange, (v) => pct(v, 0))}</th><td>{fx(s.fxEnd)}</td><td>{brl(s.totalBrl)}</td><td>{pct(s.cost)}</td></tr>)}
                  </tbody></table></div>
                  <p className="cx-hint cx-pad">Variação constante do dólar ao ano, do desembolso a cada pagamento. Custo em dias corridos/365.</p>
                </details>}
              </article>

              {loan && (
                <details className="desk-panel cx-panel fm-fluxo-panel">
                  <summary>Cronograma de pagamentos</summary>
                  <header><h3 className="cx-heading">Fluxo pagamento a pagamento{ajuda('Fluxo pagamento a pagamento', `Desembolso em ${dm(loan.start)}. Juros de cada linha pelos dias corridos desde o pagamento anterior, sobre 360. IR do tomador só quando ele assume o imposto. O câmbio a termo e o total com NDF usam o DI e o cupom informados, com o acréscimo do banco. Na linha de entrada, o total soma flat e IOF descontados do valor recebido.`)}</h3></header>
                  <p className="cx-hint cx-pad" id="e4-calendario">Datas pelo dia do desembolso, sem ajuste para dia útil. Não use como memória contratual.</p>
                  <div className="cx-wrap fm-fluxo" role="region" aria-label="Fluxo pagamento a pagamento" aria-describedby="e4-calendario" tabIndex={0}>
                    <table className="cx-matrix fm-tabela">
                      <thead><tr><th scope="col">Nº</th><th scope="col">Data</th><th scope="col">Dias</th><th scope="col">Juros</th><th scope="col">IR do tomador</th><th scope="col">Fiança</th><th scope="col">Principal</th><th scope="col">Total em dólar</th><th scope="col">Câmbio a termo</th><th scope="col">Total com NDF</th></tr></thead>
                      <tbody>
                        <tr className="fm-liberacao"><th scope="row">0 · entrada</th><td>{dm(loan.start)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{usd(loan.flatUsd + loan.iofUsd)}</td><td>{fx(loan.spot)}</td><td>{brl((loan.flatUsd + loan.iofUsd) * loan.spot)}</td></tr>
                        {loan.flows.map((f, i) => {
                          const h = hedge?.flows[i]
                          return <tr key={f.date}><th scope="row">{i + 1}</th><td>{dm(f.date)}</td><td>{f.days}</td><td>{usd(f.interest)}</td><td>{usd(f.irrf)}</td><td>{usd(f.guarantee)}</td><td>{usd(f.principal)}</td><td>{usd(f.usd)}</td><td>{h ? fx(h.ndfRate) : '—'}</td><td>{h ? brl(h.brl) : '—'}</td></tr>
                        })}
                      </tbody>
                      <tfoot><tr><th scope="row">Total</th><td>{loan.flows.length} pagamentos</td><td>{loan.avgTermDays}</td><td>{usd(loan.totals.interest)}</td><td>{usd(loan.totals.irrf)}</td><td>{usd(loan.totals.guarantee)}</td><td>{usd(loan.totals.principal)}</td><td>{usd(loan.totals.usd)}</td><td>—</td><td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}</td></tr></tfoot>
                    </table>
                  </div>
                </details>
              )}

              <details className="fm-premises"><summary>Premissas e limites da simulação</summary><p>Principal no vencimento · juros lineares por dias corridos/360 · IR na fonte e IOF-câmbio pelas regras vigentes em {CONFERIDO_EM}.</p><p>Swap e NDF teóricos, com um DI e um cupom cambial para todos os prazos. Não inclui IR nem PIS/Cofins sobre ganho do derivativo, nem custo de garantias.</p><p>Simulação indicativa, sujeita à análise e aprovação. Não constitui proposta ou compromisso de crédito.</p></details>
            </div>
          </div>
          <p className="status">Regras conferidas em {CONFERIDO_EM} · Câmbio, DI e cupom informados na tela · A cotação da mesa do banco e o contrato prevalecem.</p>
        </section>
      </div>

      <div hidden={area !== 'rules'} className="bw-quotes">
        <p className="status">Regras lidas em fontes oficiais em {CONFERIDO_EM}. Pontos não confirmados estão indicados; confirme com o tributário e com a mesa do banco antes de cotar.</p>
        <dl className="e4-rules">{REGRAS.map(([tema, regra, fonte]) => <div key={tema}><dt>{tema}</dt><dd>{regra}<small>{fonte}</small></dd></div>)}</dl>
        <ul className="e4-sources">{E4_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul>
      </div>
    </section>
  )
}
