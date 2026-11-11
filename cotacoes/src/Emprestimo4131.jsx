import { useState } from 'react'
import './Calculadora.css'
import './CalculatorLayout.css'
import './CalculatorTheme.css'
import MoneyInput from './MoneyInput.jsx'
import Help from './CalculatorHelp.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { useHolidays } from './useHolidays.js'
import { busDaysIn } from './holidays.js'
import { FREQS, IOF_SHORT_TERM, IOF_SOURCE, IRRF_OPTIONS, MAX_MONTHS, hedge4131, loan4131, unhedged4131 } from './emprestimo4131.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const usd = (v) => `US$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v, d = 2) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const fx = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const signed = (v, f) => `${v >= 0 ? '+' : '−'} ${f(Math.abs(v))}`
const dm = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
// Cenários de variação do dólar ao ano para a leitura sem proteção.
const FX_SCENARIOS = [-10, 0, 5, 10, 20]

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

// Empréstimo externo (4131): custo em dólar e três caminhos em reais (sem proteção, swap e NDF).
export default function Emprestimo4131({ onBack }) {
  const hol = useHolidays()
  const [principalText, setPrincipalText] = useState('10.000.000,00')
  const [rateText, setRateText] = useState('5,80')
  const [spotText, setSpotText] = useState('5,4000')
  const [start, setStart] = useState(cgToday)
  const [monthsText, setMonthsText] = useState('24')
  const [freq, setFreq] = useState('6')
  const [irrf, setIrrf] = useState('15')
  const [grossUp, setGrossUp] = useState(true)
  const [flatText, setFlatText] = useState('0,50')
  const [guaranteeText, setGuaranteeText] = useState('0,00')
  const [diText, setDiText] = useState('12,75')
  const [cupomText, setCupomText] = useState('5,20')
  const [swapText, setSwapText] = useState('0,00')
  const [ndfText, setNdfText] = useState('0,00')

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
  const loanResult = loanErrors ? null : loan4131({ principal: money.value, rate, spot, start, months, freq: Number(freq), irrf: Number(irrf), grossUp, flat, guarantee })
  const loan = loanResult?.ok ? loanResult : null
  // Dias úteis de cada pagamento com os feriados nacionais.
  const hedgeResult = loan && !hedgeErrors ? hedge4131(loan, { di, cupom, swapSpread, ndfMarkup, busDays: (a, b) => busDaysIn(a, b, ['BR'], hol.ctx) }) : null
  const hedge = hedgeResult?.ok ? hedgeResult : null
  const flat0 = loan ? unhedged4131(loan, 0) : null
  const scenarios = loan ? FX_SCENARIOS.map((s) => unhedged4131(loan, s)).filter((s) => s.ok) : []

  const field = (key, label, control, help) => (
    <div className="cx-field">
      <div className="cx-field-label"><label htmlFor={`e4-${key}`}>{label}</label>{help}</div>
      {control}
      <p className="cx-error" id={`e4-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  const text = (key, value, onChange, mode = 'decimal') => (
    <input id={`e4-${key}`} inputMode={mode} autoComplete="off" aria-invalid={!!errors[key]} aria-describedby={`e4-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} />
  )
  const seg = (labelId, options, value, onChange) => (
    <div className="seg" role="group" aria-labelledby={labelId}>
      {options.map((o) => <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  )

  return (
    <section className="cx" aria-labelledby="e4-h">
      <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
      <h2 id="e4-h" className="cx-title cx-heading">
        <span className="cx-heading-text"><span className="cx-icon" aria-hidden="true"><Emprestimo4131Icon /></span><span>Empréstimo externo (4131)</span></span>
        <Help title="Empréstimo externo (4131): cálculo e premissas">
          <p>Estimativa para comparar propostas de empréstimo em dólar tomado direto no exterior (Lei 4.131/62; hoje Lei 14.286/2021 e Resolução BCB 278/2022). Principal pago no vencimento. Juros lineares: principal × taxa × dias corridos ÷ 360.</p>
          <p>IR na fonte sobre os juros: 15% (RIR/2018, art. 760). Quando o tomador assume o imposto, a base é reajustada (art. 786): IR = juros × alíquota ÷ (1 − alíquota). IOF-câmbio na entrada: 3,5% com prazo médio até 364 dias e zero acima (Decreto 6.306/2007, art. 15-B). Flat e IOF saem do valor recebido. Custo all-in em dólar: taxa ao ano que iguala o valor líquido aos pagamentos, em dias corridos/365.</p>
          <p>Câmbio a termo teórico de cada pagamento: câmbio de entrada × fator do DI (dias úteis/252) ÷ fator do cupom cambial (linear, dias corridos/360). Usamos um DI e um cupom para todos os vencimentos; a mesa do banco usa uma taxa para cada prazo.</p>
          <p>Swap: troca a dívida em dólar por CDI. O custo em reais dos pagamentos a termo, mais o spread do banco, é lido como CDI + spread e % do CDI contra o DI informado. NDF: um termo de dólar para cada pagamento; o câmbio fica travado e o custo, prefixado em reais.</p>
          <p>Fora da conta: IR na fonte sobre o ganho do swap ou do NDF (compensável no IRPJ), PIS/Cofins sobre ganho financeiro, custo de garantias do derivativo e ajuste de datas para dia útil. Operação a partir de US$ 1 milhão é declarada pelo devedor ao Banco Central (SCE-Crédito). A proposta do banco e o contrato prevalecem.</p>
        </Help>
      </h2>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>Operação</span></h3></header>
        <div className="cx-form">
          {field('principal', 'Principal (US$)', <MoneyInput prefix="US$" id="e4-principal" aria-invalid={!!errors.principal} aria-describedby="e4-principal-err" value={principalText} onChange={setPrincipalText} />)}
          {field('rate', 'Taxa (% a.a., linear 360)', text('rate', rateText, setRateText))}
          {field('spot', 'Câmbio de entrada (R$ por US$)', text('spot', spotText, setSpotText))}
          {field('start', 'Data do desembolso', <input id="e4-start" type="date" max="9999-12-31" aria-invalid={!!errors.start} aria-describedby="e4-start-err" value={start} onChange={(e) => setStart(e.target.value)} />)}
          {field('months', 'Prazo (meses)', text('months', monthsText, setMonthsText, 'numeric'))}
          <div className="cx-field">
            <div className="cx-field-label"><span className="cx-label" id="e4-freq-l">Pagamento de juros</span></div>
            {seg('e4-freq-l', FREQS, freq, setFreq)}
          </div>
          <div className="cx-field">
            <div className="cx-field-label"><label htmlFor="e4-irrf">IR na fonte sobre os juros</label><Help title="IR na fonte sobre os juros"><p>Regra geral: 15% sobre os juros pagos ao exterior (RIR/2018, art. 760). Credor em país com tributação favorecida: 25%. Tratado ou isenção podem reduzir: confirme com o tributário.</p></Help></div>
            <select id="e4-irrf" value={irrf} onChange={(e) => setIrrf(e.target.value)}>{IRRF_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
          </div>
          <div className="cx-field">
            <div className="cx-field-label"><span className="cx-label" id="e4-gross-l">Quem arca com o IR</span><Help title="Quem arca com o IR"><p>Tomador: o credor recebe os juros cheios e o tomador paga o imposto por cima (gross-up), com a base reajustada. Credor: o imposto sai dos juros e não aumenta o custo do tomador.</p></Help></div>
            {seg('e4-gross-l', [{ id: 'sim', label: 'Tomador' }, { id: 'nao', label: 'Credor' }], grossUp ? 'sim' : 'nao', (v) => setGrossUp(v === 'sim'))}
          </div>
          {field('flat', 'Flat · estruturação (%)', text('flat', flatText, setFlatText))}
          {field('guarantee', 'Fiança ou SBLC (% a.a.)', text('guarantee', guaranteeText, setGuaranteeText))}
          <div className="cx-iof">
            <p className="cx-hint">{loan ? `IOF-câmbio automático: ${pct(loan.iofRate)} na entrada. Prazo médio de ${loan.avgTermDays.toLocaleString('pt-BR')} dias corridos${loan.iofRate ? ` (até ${IOF_SHORT_TERM.maxDays} dias).` : ` (acima de ${IOF_SHORT_TERM.maxDays} dias).`}` : `IOF-câmbio na entrada: ${pct(IOF_SHORT_TERM.rate)} com prazo médio até ${IOF_SHORT_TERM.maxDays} dias; zero acima.`}</p>
            <p className="cx-hint"><a href={IOF_SOURCE} target="_blank" rel="noreferrer">Base legal: Decreto 6.306/2007, art. 15-B, XI e XII</a> · Alíquota de 3,5% vigente por decisão provisória do STF (2025). Liquidar antes do prazo pode gerar o IOF com multa e juros.</p>
          </div>
        </div>
      </article>

      <div className="cx-gap" aria-hidden="true" />

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>Proteção cambial</span><Help title="Proteção cambial: o que informar"><p>DI pré e cupom cambial do prazo médio da operação, na data da cotação. Com eles calculamos o câmbio a termo de cada pagamento.</p><p>Spread do banco no swap: taxa ao ano somada ao custo. Acréscimo no NDF: percentual que o banco soma à taxa a termo. Deixe zero para ver o custo teórico.</p></Help></h3></header>
        <div className="cx-form">
          {field('di', 'DI pré do prazo (% a.a., 252)', text('di', diText, setDiText))}
          {field('cupom', 'Cupom cambial (% a.a., linear 360)', text('cupom', cupomText, setCupomText))}
          {field('swap', 'Spread do banco no swap (% a.a.)', text('swap', swapText, setSwapText))}
          {field('ndf', 'Acréscimo do banco no NDF (%)', text('ndf', ndfText, setNdfText))}
        </div>
      </article>

      <div className="cx-gap" aria-hidden="true" />

      <article className="desk-panel cx-panel" aria-live="polite">
        <header><h3 className="cx-heading"><span>Três caminhos</span><Help title="Como ler os três caminhos"><p>Sem proteção: a dívida segue em dólar e o custo em reais depende do câmbio de cada pagamento. Com swap: a dívida passa a correr em CDI. Com NDF: o câmbio de cada pagamento fica travado e o custo é fixo em reais.</p><p>O ponto de equilíbrio mostra quanto o dólar precisa subir por ano para a proteção compensar.</p></Help></h3></header>
        {loan ? (
          <>
            <dl className="od-cet">
              <div><dt>Custo all-in em dólar</dt><dd><b>{pct(loan.allIn)} a.a.</b><small> dias corridos/365</small></dd></div>
              <div><dt>Taxa com o IR por cima</dt><dd><b>{pct(loan.grossedRate)} a.a.</b><small> contratual {pct(loan.rate)}</small></dd></div>
              <div><dt>Valor líquido recebido</dt><dd><b>{brl(loan.netBrl)}</b><small> {usd(loan.netUsd)}</small></dd></div>
            </dl>
            <div className="cx-wrap" role="region" aria-label="Sem proteção, com swap e com NDF lado a lado" tabIndex={0}>
              <table className="cx-matrix">
                <thead><tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col">Sem proteção</th><th scope="col" className="cx-selected">Com swap</th><th scope="col">Com NDF</th></tr></thead>
                <tbody>
                  <tr><th scope="row">A dívida fica em</th><td>Dólar</td><td className="cx-selected">CDI</td><td>Reais, prefixada</td></tr>
                  <tr>
                    <th scope="row">Custo em reais ao ano</th>
                    <td>{flat0?.ok ? pct(flat0.cost) : '—'}<small>com o dólar parado</small></td>
                    <td className="cx-selected">{hedge ? pct(hedge.swap.pre) : '—'}<small>com o DI informado, base 252</small></td>
                    <td>{hedge ? pct(hedge.ndf.pre) : '—'}<small>fixo, base 252</small></td>
                  </tr>
                  <tr>
                    <th scope="row">Leitura em CDI</th>
                    <td>—</td>
                    <td className="cx-selected">{hedge ? `CDI ${signed(hedge.swap.spread, (v) => pct(v))}` : '—'}<small>{hedge ? `${pct(hedge.swap.pctCdi, 1)} do CDI` : ''}</small></td>
                    <td>{hedge ? `CDI ${signed(hedge.ndf.spread, (v) => pct(v))}` : '—'}<small>{hedge ? 'equivalente hoje; não acompanha o CDI' : ''}</small></td>
                  </tr>
                  <tr>
                    <th scope="row">Total a pagar em reais</th>
                    <td>{flat0?.ok ? brl(flat0.totalBrl) : '—'}<small>com o dólar parado</small></td>
                    <td className="cx-selected">Varia<small>segue o CDI de cada período</small></td>
                    <td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}<small>travado</small></td>
                  </tr>
                  <tr><th scope="row">Risco que sobra</th><td>Câmbio</td><td className="cx-selected">Alta do CDI</td><td>Custo de desfazer antes</td></tr>
                </tbody>
              </table>
            </div>
            {hedge
              ? <ul className="cx-diff"><li>Ponto de equilíbrio: o NDF compensa se o dólar subir mais de <b>{pct(hedge.ndf.breakeven)} ao ano</b>. Abaixo disso, ficar sem proteção sai mais barato, com o risco do câmbio.</li></ul>
              : <p className="cx-hint cx-pad" role={hedgeResult?.error ? 'alert' : undefined}>{hedgeResult?.error || 'Preencha a proteção cambial para ver swap e NDF.'}</p>}
          </>
        ) : (
          <p className="cx-hint cx-pad" role={loanResult?.error ? 'alert' : undefined}>{loanResult?.error || 'Preencha a operação.'}</p>
        )}
      </article>

      {loan && scenarios.length > 0 && (
        <>
          <div className="cx-gap" aria-hidden="true" />
          <article className="desk-panel cx-panel">
            <header><h3 className="cx-heading"><span>Sem proteção: custo conforme o dólar</span></h3></header>
            <div className="cx-wrap" role="region" aria-label="Custo sem proteção por cenário de câmbio" tabIndex={0}>
              <table className="cx-matrix">
                <thead><tr><th scope="col">Dólar ao ano</th><th scope="col">Câmbio no vencimento</th><th scope="col">Total a pagar</th><th scope="col">Custo em reais ao ano</th></tr></thead>
                <tbody>
                  {scenarios.map((s) => <tr key={s.fxChange}><th scope="row">{s.fxChange === 0 ? 'Parado' : signed(s.fxChange, (v) => pct(v, 0))}</th><td>{fx(s.fxEnd)}</td><td>{brl(s.totalBrl)}</td><td>{pct(s.cost)}</td></tr>)}
                </tbody>
              </table>
            </div>
            <p className="cx-hint cx-pad">Variação constante do dólar ao ano, do desembolso a cada pagamento. Custo em dias corridos/365.</p>
          </article>
        </>
      )}

      {loan && (
        <>
          <div className="cx-gap" aria-hidden="true" />
          <article className="desk-panel cx-panel">
            <header><h3 className="cx-heading"><span>Pagamentos</span></h3></header>
            <div className="cx-wrap" role="region" aria-label="Pagamentos do empréstimo" tabIndex={0}>
              <table className="cx-matrix">
                <thead><tr><th scope="col">Data</th><th scope="col">Dias</th><th scope="col">Juros</th><th scope="col">IR do tomador</th><th scope="col">Fiança</th><th scope="col">Principal</th><th scope="col">Total em dólar</th><th scope="col">Câmbio a termo</th><th scope="col">Total com NDF</th></tr></thead>
                <tbody>
                  {loan.flows.map((f, i) => {
                    const h = hedge?.flows[i]
                    return <tr key={f.date}><th scope="row">{dm(f.date)}</th><td>{f.days}</td><td>{usd(f.interest)}</td><td>{usd(f.irrf)}</td><td>{usd(f.guarantee)}</td><td>{usd(f.principal)}</td><td>{usd(f.usd)}</td><td>{h ? fx(h.ndfRate) : '—'}</td><td>{h ? brl(h.brl) : '—'}</td></tr>
                  })}
                  <tr><th scope="row">Total</th><td>{loan.avgTermDays}</td><td>{usd(loan.totals.interest)}</td><td>{usd(loan.totals.irrf)}</td><td>{usd(loan.totals.guarantee)}</td><td>{usd(loan.totals.principal)}</td><td>{usd(loan.totals.usd)}</td><td>—</td><td>{hedge ? brl(hedge.ndf.totalBrl) : '—'}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="cx-hint cx-pad">Flat de {usd(loan.flatUsd)} e IOF de {usd(loan.iofUsd)} descontados na entrada. Datas sem ajuste para dia útil.</p>
          </article>
        </>
      )}
      <p className="status">Estimativa para comparar propostas · Um DI e um cupom para todos os prazos · A cotação da mesa do banco e o contrato prevalecem</p>
    </section>
  )
}
