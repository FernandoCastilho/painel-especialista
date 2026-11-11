import { useState } from 'react'
import './Calculadora.css'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { SYSTEMS, parseDecimal } from './emprestimo.js'
import { giroOperation } from './creditComparison.js'
import { cgToday, cgAddDays } from './contaGarantida.js'
import { resolveCreditIof } from './iofRules.js'
import FinimpComparacao, { FinimpIcon } from './FinimpComparacao.jsx'
import { FinameIcon } from './FinameMateriais.jsx'
import BndesWorkspace from './BndesWorkspace.jsx'
import ContaGarantida, { ContaGarantidaIcon } from './ContaGarantida.jsx'
import AnaliseDesconto, { DescontoIcon } from './AnaliseDesconto.jsx'
import Help from './CalculatorHelp.jsx'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA, pracaCalendars } from './pracaContrato.js'
import './CalculatorLayout.css'
import CreditComparison, { CreditIcon } from './CreditComparison.jsx'
import CbsCaixa, { CbsIcon } from './CbsCaixa.jsx'
import OperacaoDi, { OperacaoDiIcon } from './OperacaoDi.jsx'
import './CalculatorTheme.css'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Ícone do Capital de Giro: pilha de moedas com a seta de retorno do caixa.
function GiroIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="9" cy="6.5" rx="5.5" ry="2.5" />
      <path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
      <path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5 1 0 1.9-.1 2.7-.4" />
      <path d="M21 13.5a4.5 4.5 0 10-1.3 3.2" />
      <path d="M21 10.5v3h-3" />
    </svg>
  )
}

const CALCS = [
  { id: 'comparador-credito', title: 'Comparador de Crédito', sub: 'De 2 a 5 modalidades lado a lado: custo, CET e fluxo', Icon: CreditIcon },
  { id: 'operacao-di', title: 'Operação x DI', sub: 'Pré, % do CDI ou CDI + spread contra o DI da curva B3', Icon: OperacaoDiIcon },
  { id: 'cbs-caixa', title: 'Reforma tributária · caixa', sub: 'CBS, créditos e necessidade adicional de giro', Icon: CbsIcon },
  { id: 'finame-materiais', title: 'BNDES', sub: 'Simular, comparar custos e consultar taxas', Icon: FinameIcon },
  { id: 'conta-garantida', title: 'Conta Garantida', sub: 'Juros e IOF sobre saldos', Icon: ContaGarantidaIcon },
  { id: 'finimp', title: 'FINIMP', sub: 'Compare propostas e atinja sua meta', Icon: FinimpIcon },
  { id: 'giro', title: 'Capital de Giro', sub: 'Parcelas, juros e total a pagar', Icon: GiroIcon },
  { id: 'analise-desconto', title: 'Análise de desconto', sub: 'Compare títulos com giro Price', Icon: DescontoIcon },
]

function CapitalDeGiro({ onBack }) {
  const [valueText, setValueText] = useState('100.000,00')
  const [nText, setNText] = useState('12')
  const [rateText, setRateText] = useState('2,00')
  const [unit, setUnit] = useState('am')
  const [system, setSystem] = useState('price')
  const [start, setStart] = useState(cgToday)
  const [firstDue, setFirstDue] = useState(() => cgAddDays(cgToday(), 30))
  const [profile, setProfile] = useState('pj')
  const [eligible, setEligible] = useState(false)
  const [tacText, setTacText] = useState('0,00')
  const [praca, setPraca] = useState(PRACA_PADRAO)
  const money = parseMoneyInput(valueText)
  const tac = tacText.trim() === '' ? { ok: true, value: 0 } : parseMoneyInput(tacText)
  const n = /^\d+$/.test(nText.trim()) ? Number(nText) : null
  const rate = parseDecimal(rateText)
  const tax = resolveCreditIof({ date: start, profile, operationValue: money.value, eligible })
  const errors = {
    value: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    n: n !== null && n >= 1 && n <= 600 ? null : 'Informe o prazo em meses, número inteiro de 1 a 600.',
    rate: rate !== null && rate <= 1000 ? null : 'Informe a taxa em %, por exemplo 2,00.',
    iof: tax.ok ? null : tax.error,
    tac: tac.ok ? null : tac.error || 'Informe a TAC em R$ (zero se não houver).',
  }
  // Cada sistema roda no motor de juros por dias reais, com IOF e TAC na liberação e CET (Res. CMN 4.881).
  const params = { value: money.value, n, rate, unit, start, firstDue, profile, eligible, fees: tac.value, calendars: pracaCalendars(praca) }
  const runs = Object.values(errors).some(Boolean) ? {} : Object.fromEntries(SYSTEMS.filter(x => x.id !== 'bullet' || x.id === system).map(x => [x.id, giroOperation({ ...params, system: x.id })]))
  const result = runs[system]?.ok ? runs[system] : null
  const engineError = runs[system] && !runs[system].ok ? runs[system].error : null
  // Diferença do Pagamento Final de cada outro sistema em relação ao escolhido (mesmas condições).
  const compared = { others: result ? Object.entries(runs).filter(([id, r]) => id !== system && r.ok).map(([id, r]) => ({ system: id, label: SYSTEMS.find(x => x.id === id).label, result: r, totalDiff: r.total - result.total, interestDiff: r.interest - result.interest })) : [] }
  // Colunas na ordem Price, SAC e (só quando escolhido) Bullet; as de Price e SAC aparecem sempre, vazias enquanto a entrada é inválida.
  const byId = Object.fromEntries(result ? Object.entries(runs).filter(([, r]) => r.ok) : [])
  const cols = SYSTEMS.filter((x) => x.id !== 'bullet' || result?.system === 'bullet').map((x) => ({ system: x.id, label: x.label, result: byId[x.id] ?? null, selected: result?.system === x.id }))
  const rows = [
    { key: 'parcela', label: 'Parcela', cell: (r) => (r.installment == null ? { main: '—', sub: 'pagamento único' } : r.last == null ? { main: brl(r.installment), sub: `fixa, em ${r.n}x` } : { main: brl(r.installment), sub: `até ${brl(r.last)}` }) },
    { key: 'iof', label: 'IOF', cell: (r) => ({ main: brl(r.iof) }) },
    { key: 'tac', label: 'TAC', cell: (r) => ({ main: brl(r.fees) }) },
    { key: 'juros', label: 'Juros Totais', cell: (r) => ({ main: brl(r.interest), sub: `${(r.interest / money.value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do valor` }) },
    { key: 'total', label: 'Pagamento Final', cell: (r) => ({ main: brl(r.total) }) },
    { key: 'cet', label: 'CET', cell: (r) => ({ main: `${pct2(r.cet * 100)} a.a.`, sub: `${pct2(Math.expm1(Math.log1p(r.cet) / 12) * 100)} a.m.` }) },
  ]
  const sys = SYSTEMS.find((s) => s.id === system)
  const pct2 = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
  const field = (key, label, control) => (
    <div className="cx-field">
      <div className="cx-field-label"><label htmlFor={`cx-${key}`}>{label}</label></div>
      {control}
      <p className="cx-error" id={`cx-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  return (
    <section className="cx" aria-labelledby="calc-h">
      <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
      <h2 id="calc-h" className="cx-title cx-heading"><span className="cx-heading-text"><span className="cx-icon" aria-hidden="true"><GiroIcon /></span><span>Capital de Giro</span></span><Help title="Capital de Giro: cálculo e premissas"><p>Estimativa com a taxa e a TAC informadas, sem seguros nem outros encargos. O CET segue a Resolução CMN 4.881/2020: taxa anual que iguala o valor líquido liberado (valor menos IOF e TAC) às parcelas, em dias corridos/365. O CET do contrato prevalece.</p><p>Vencimentos mensais no dia do primeiro vencimento; se não for dia útil (fim de semana ou feriado nacional), no próximo dia útil. Juros de cada parcela por dias corridos desde o vencimento anterior, em juros compostos sobre a taxa ao mês ((1 + taxa)^(dias/30)); taxa ao ano convertida para ao mês por juros compostos. Primeiro vencimento além de 30 dias: os juros do período extra são capitalizados. O IOF de pessoa jurídica é cobrado na liberação: adicional sobre o valor e diário sobre o principal de cada parcela, pelos dias até o vencimento, limitados a 365.</p></Help></h2>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>Condições gerais</span></h3></header>
        <div className="cx-form">
          {field('value', 'Valor', <MoneyInput id="cx-value" aria-invalid={!!errors.value} aria-describedby="cx-value-err" value={valueText} onChange={setValueText} />)}
          {field('n', 'Prazo (meses)', <input id="cx-n" inputMode="numeric" autoComplete="off" aria-invalid={!!errors.n} aria-describedby="cx-n-err" value={nText} onChange={(e) => setNText(e.target.value)} onFocus={(e) => e.target.select()} />)}
          {field('rate', 'Taxa (%)', (
            <div className="cx-rate">
              <input id="cx-rate" inputMode="decimal" autoComplete="off" aria-invalid={!!errors.rate} aria-describedby="cx-rate-err" value={rateText} onChange={(e) => setRateText(e.target.value)} onFocus={(e) => e.target.select()} />
              <div className="seg" role="group" aria-label="Período da taxa">
                <button type="button" aria-pressed={unit === 'am'} onClick={() => setUnit('am')}>a.m.</button>
                <button type="button" aria-pressed={unit === 'aa'} onClick={() => setUnit('aa')}>a.a.</button>
              </div>
            </div>
          ))}
          {field('tac', 'TAC · tarifa de contratação (R$)', <MoneyInput id="cx-tac" aria-invalid={!!errors.tac} aria-describedby="cx-tac-err" value={tacText} onChange={setTacText} />)}
          <div className="cx-field">
            <div className="cx-field-label"><span className="cx-label" id="cx-system-l">Sistema de amortização</span><Help title={`Sistema de amortização: ${sys.label}`}><p>{sys.hint}</p></Help></div>
            <div className="seg" role="group" aria-labelledby="cx-system-l">
              {SYSTEMS.map((s) => <button key={s.id} type="button" aria-pressed={system === s.id} onClick={() => setSystem(s.id)}>{s.label}</button>)}
            </div>
          </div>
          {field('start', 'Data da liberação', <input id="cx-start" type="date" max="9999-12-31" value={start} onChange={e => setStart(e.target.value)} />)}
          {field('firstDue', 'Primeiro vencimento mensal', <input id="cx-firstDue" type="date" max="9999-12-31" value={firstDue} onChange={e => setFirstDue(e.target.value)} />)}
          <div className="cx-field">
            <div className="cx-field-label"><label htmlFor="cx-praca">Praça do contrato (feriados)</label><Help title="Praça do contrato (feriados)"><p>{PRACA_AJUDA}</p><p>{PRACA_RESSALVA}</p></Help></div>
            <select id="cx-praca" value={praca} onChange={e => setPraca(e.target.value)}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
            <p className="cx-hint">A praça define os feriados locais que adiam vencimentos.</p>
          </div>
          <div className="cx-iof">
            <label htmlFor="cx-profile">Enquadramento do IOF</label>
            <select id="cx-profile" value={profile} onChange={e => { setProfile(e.target.value); setEligible(false) }}><option value="pj">Pessoa jurídica geral</option><option value="simples">Simples/MEI: operação elegível até R$ 30 mil</option></select>
            {profile === 'simples' && <label><input type="checkbox" checked={eligible} onChange={e => setEligible(e.target.checked)} />Confirmo o enquadramento do tomador e a documentação da operação com a instituição.</label>}
            <p className="cx-hint">{tax.ok ? `IOF automático: ${tax.additional.toLocaleString('pt-BR')}% adicional + ${tax.daily.toLocaleString('pt-BR', { maximumFractionDigits: 5 })}% ao dia, até 365 dias por parcela.` : 'Alíquotas calculadas conforme data e enquadramento.'}</p>
            <p className="cx-error" role={errors.iof ? 'alert' : undefined}>{errors.iof}</p>
            {tax.ok && <p className="cx-hint"><a href={tax.source} target="_blank" rel="noreferrer">Base legal: Decreto 6.306/2007, art. 7º</a> · Enquadramento automático; mudanças futuras não são antecipadas.</p>}
            <p className="cx-hint">Juros por dias corridos; vencimento em dia não útil (fim de semana, feriado nacional ou da praça) passa para o próximo dia útil. No Bullet, paga-se no último vencimento mensal.</p>
          </div>
        </div>
      </article>

      <div className="cx-gap" aria-hidden="true" />

      <article className="desk-panel cx-panel" aria-live="polite">
        <header><h3 className="cx-heading"><span>Resultado</span><Help title="Como comparar os resultados"><p>As colunas usam o mesmo valor, prazo, taxa, TAC e IOF; muda apenas o sistema de amortização. O pagamento final soma parcelas, IOF e TAC. O CET compara o custo de cada sistema pela regra do Banco Central.</p></Help></h3></header>
        <div className="cx-wrap" role="region" aria-label="Resultado por sistema de amortização; role para ver todas as colunas" tabIndex={0}>
          <table className="cx-matrix">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Item</span></th>
                {cols.map((c) => <th key={c.system} scope="col" className={c.selected ? 'cx-selected' : undefined}>{c.label}{c.selected && <small>selecionado</small>}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row">{r.label}</th>
                  {cols.map((c) => {
                    const cell = c.result ? r.cell(c.result) : null
                    return (
                      <td key={c.system} className={c.selected ? 'cx-selected' : undefined}>
                        {cell ? <>{cell.main}{cell.sub && <small>{cell.sub}</small>}</> : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!result && <p className="cx-hint cx-pad" role={engineError ? 'alert' : undefined}>{engineError || 'Preencha as condições gerais.'}</p>}
        {result && compared.others.length > 0 && (
          <ul className="cx-diff">
            {compared.others.map((o) => (
              <li key={o.system}>
                No <b>{o.label}</b>, o Pagamento Final fica {Math.abs(o.totalDiff) < 0.005 ? <>igual ao do <b>{sys.label}</b></> : <><b>{brl(Math.abs(o.totalDiff))}</b> {o.totalDiff < 0 ? 'menor' : 'maior'} que no {sys.label}</>}
                {Math.abs(o.interestDiff) >= 0.005 && <> (juros {brl(Math.abs(o.interestDiff))} {o.interestDiff < 0 ? 'menores' : 'maiores'})</>}.
              </li>
            ))}
          </ul>
        )}
      </article>
      <p className="status">Estimativa sem tarifas e seguros · Não é CET</p>
    </section>
  )
}

// Aba Calculadoras: lista de calculadoras (ícones) e a calculadora aberta, com endereço próprio (#calculadora/giro).
export default function Calculadora({ view, onView }) {
  if (view === 'cbs-caixa') return <CbsCaixa onBack={() => onView('')} />
  if (view === 'bndes-tlp-exigivel') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-credito-tfb') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-selic-lcd') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'finimp') return <FinimpComparacao onBack={() => onView('')} />
  if (view === 'conta-garantida') return <ContaGarantida onBack={() => onView('')} />
  if (view === 'comparador-credito') return <CreditComparison onBack={() => onView('')} />
  if (view === 'operacao-di') return <OperacaoDi onBack={() => onView('')} />
  if (view === 'giro') return <CapitalDeGiro onBack={() => onView('')} />
  if (view === 'analise-desconto') return <AnaliseDesconto onBack={() => onView('')} />
  if (view === 'finame-materiais') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  return (
    <section className="cx" aria-labelledby="calc-title">
      <h2 id="calc-title" className="cx-title cx-heading"><span>Calculadoras</span></h2>
      <div className="cx-tiles">
        {CALCS.map(({ id, title, sub, Icon }) => (
          <button key={id} type="button" className="cx-tile" onClick={() => onView(id)} aria-label={`${title}: abrir calculadora`}>
            <span className="cx-icon" aria-hidden="true"><Icon /></span>
            <span className="cx-tile-text"><b>{title}</b><small>{sub}</small></span>
            <span className="cx-go" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </section>
  )
}
