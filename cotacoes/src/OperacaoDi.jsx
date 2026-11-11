import { useState } from 'react'
import './Calculadora.css'
import './CalculatorLayout.css'
import './CalculatorTheme.css'
import MoneyInput from './MoneyInput.jsx'
import Help from './CalculatorHelp.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { useCurves } from './useCurves.js'
import { useHolidays } from './useHolidays.js'
import { busDaysIn } from './holidays.js'
import { PRE_UNITS, RATE_KINDS, compareWithDi } from './operacaoDi.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v, d = 2) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const signed = (v, f) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`
const dm = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const isoPlus = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 864e5).toISOString().slice(0, 10)

// Ícone: duas barras lado a lado (operação e DI) com a linha da curva.
export function OperacaoDiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16" />
      <rect x="6" y="11" width="4" height="9" rx="1" />
      <rect x="14" y="8" width="4" height="12" rx="1" />
      <path d="M3 8c4-1 7-3 9-5 2 2 5 3 9 3" />
    </svg>
  )
}

// Operação x DI: custo ou rendimento de uma operação contra aplicar o mesmo valor no DI pelo mesmo prazo.
export default function OperacaoDi({ onBack }) {
  const curves = useCurves()
  const hol = useHolidays()
  const br = curves.data?.br
  const today = br?.compare?.find((c) => c.id === 'hoje')
  const pts = today ? br.curves?.[today.date] : null
  const base = today?.date ?? null
  const maxDu = pts?.length ? Math.max(...pts.map((p) => p[0])) : 0
  const maxIso = base ? isoPlus(base, Math.floor((maxDu / 252) * 365)) : ''

  const [valueText, setValueText] = useState('1.000.000,00')
  const [kind, setKind] = useState('pre')
  const [rateText, setRateText] = useState('15,00')
  const [unit, setUnit] = useState('aa')
  const [startPick, setStartPick] = useState('')
  const [endPick, setEndPick] = useState('')
  const [view, setView] = useState('credito')

  const start = startPick || base || ''
  const end = endPick || (base ? (isoPlus(base, 365) < maxIso ? isoPlus(base, 365) : maxIso) : '')
  const money = parseMoneyInput(valueText)
  const rate = parseDecimal(rateText)
  const errors = {
    value: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    rate: rate === null ? (kind === 'pct' ? 'Informe o percentual, por exemplo 105,00.' : 'Informe a taxa em %, por exemplo 15,00.') : null,
    start: !base ? null : !start ? 'Informe a data de início.' : base && start < base ? `A curva começa em ${dm(base)}: escolha o início a partir dessa data.` : null,
    end: !base ? null : !end ? 'Informe o vencimento.' : maxIso && end > maxIso ? `A curva vai até cerca de ${dm(maxIso)}: escolha um vencimento até essa data.` : start && end <= start ? 'O vencimento precisa ser depois do início.' : null,
  }
  const d1 = base && start ? busDaysIn(base, start, ['BR'], hol.ctx) : 0
  const d2 = base && end ? busDaysIn(base, end, ['BR'], hol.ctx) : 0
  const result = pts && !Object.values(errors).some(Boolean) ? compareWithDi({ value: money.value, kind, rate, unit, pts, d1, d2 }) : null
  const r = result?.ok ? result : null
  const k = RATE_KINDS.find((x) => x.id === kind)
  const credit = view === 'credito'

  const field = (key, label, control) => (
    <div className="cx-field">
      <div className="cx-field-label"><label htmlFor={`od-${key}`}>{label}</label></div>
      {control}
      <p className="cx-error" id={`od-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  const rows = r && [
    { label: 'Taxa no período', op: pct(r.opPeriod, 4), di: pct(r.cdiPeriod, 4) },
    { label: 'Taxa equivalente ao ano (252 d.u.)', op: pct(r.opAa), di: pct(r.cdiAa) },
    { label: credit ? 'Juros' : 'Rendimento', op: brl(r.interestOp), di: brl(r.interestDi) },
    { label: 'Valor no vencimento', op: brl(r.finalOp), di: brl(r.finalDi) },
  ]
  const same = r && Math.abs(r.diff) < 0.005
  const more = r && r.diff > 0

  return (
    <section className="cx" aria-labelledby="od-h">
      <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
      <h2 id="od-h" className="cx-title cx-heading">
        <span className="cx-heading-text"><span className="cx-icon" aria-hidden="true"><OperacaoDiIcon /></span><span>Operação x DI</span></span>
        <Help title="Operação x DI: cálculo e premissas">
          <p>Compara a operação com aplicar o mesmo valor no DI, do início ao vencimento. O DI de cada dia vem da curva DI x pré da B3 da data-base: é a expectativa do mercado naquele dia, não uma garantia.</p>
          <p>Dias úteis contados com os feriados nacionais. Entre dois vértices da curva, a taxa a termo é constante (interpolação do logaritmo do fator).</p>
          <p>Pré: ao ano em base 252 dias úteis; ao mês, convertida para o ano por (1 + taxa)^12; no período, usada como está. % do CDI: o percentual multiplica o DI de cada dia útil antes de acumular. CDI + spread: fator do DI vezes (1 + spread)^(dias úteis/252).</p>
          <p>Pagamento único no vencimento, sem IOF, IR, tarifas ou garantias. Não é CET nem rentabilidade líquida.</p>
        </Help>
      </h2>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>Operação</span></h3></header>
        <div className="cx-form">
          <div className="cx-field">
            <div className="cx-field-label"><span className="cx-label" id="od-view-l">A operação é</span></div>
            <div className="seg" role="group" aria-labelledby="od-view-l">
              <button type="button" aria-pressed={credit} onClick={() => setView('credito')}>Crédito (custo)</button>
              <button type="button" aria-pressed={!credit} onClick={() => setView('aplicacao')}>Aplicação (rendimento)</button>
            </div>
          </div>
          {field('value', 'Valor', <MoneyInput id="od-value" aria-invalid={!!errors.value} aria-describedby="od-value-err" value={valueText} onChange={setValueText} />)}
          <div className="cx-field">
            <div className="cx-field-label"><span className="cx-label" id="od-kind-l">Tipo de taxa</span><Help title={`Tipo de taxa: ${k.label}`}><p>{k.hint}</p></Help></div>
            <div className="seg" role="group" aria-labelledby="od-kind-l">
              {RATE_KINDS.map((x) => <button key={x.id} type="button" aria-pressed={kind === x.id} onClick={() => setKind(x.id)}>{x.label}</button>)}
            </div>
          </div>
          {field('rate', kind === 'pct' ? 'Percentual do CDI (%)' : kind === 'spread' ? 'Spread (% a.a.)' : 'Taxa (%)', (
            <div className="cx-rate">
              <input id="od-rate" inputMode="decimal" autoComplete="off" aria-invalid={!!errors.rate} aria-describedby="od-rate-err" value={rateText} onChange={(e) => setRateText(e.target.value)} onFocus={(e) => e.target.select()} />
              {kind === 'pre' && (
                <div className="seg" role="group" aria-label="Período da taxa">
                  {PRE_UNITS.map((u) => <button key={u.id} type="button" aria-pressed={unit === u.id} onClick={() => setUnit(u.id)}>{u.label}</button>)}
                </div>
              )}
            </div>
          ))}
          {field('start', 'Início', <input id="od-start" type="date" min={base ?? undefined} max={maxIso || '9999-12-31'} aria-invalid={!!errors.start} aria-describedby="od-start-err" value={start} onChange={(e) => setStartPick(e.target.value)} />)}
          {field('end', 'Vencimento', <input id="od-end" type="date" min={start || undefined} max={maxIso || '9999-12-31'} aria-invalid={!!errors.end} aria-describedby="od-end-err" value={end} onChange={(e) => setEndPick(e.target.value)} />)}
          <p className="cx-hint">
            {base ? <>Curva DI x pré da B3 de {dm(base)}, até cerca de {dm(maxIso)}.{r && <> Período: {r.du} dias úteis.</>}</> : curves.status === 'loading' ? 'Carregando a curva DI…' : 'Curva DI indisponível na última atualização: a comparação volta quando ela for coletada.'}
          </p>
        </div>
      </article>

      <div className="cx-gap" aria-hidden="true" />

      <article className="desk-panel cx-panel" aria-live="polite">
        <header><h3 className="cx-heading"><span>Resultado</span><Help title="Como ler o resultado"><p>A coluna DI mostra quanto o mesmo valor renderia no DI projetado pela curva no mesmo período. A diferença em pontos-base (bps; 100 bps = 1 ponto percentual) compara as taxas equivalentes ao ano.</p><p>Os equivalentes dizem qual % do CDI ou qual CDI + spread dariam o mesmo resultado da operação.</p></Help></h3></header>
        {r ? (
          <>
            <div className="cx-wrap" role="region" aria-label="Operação e DI lado a lado" tabIndex={0}>
              <table className="cx-matrix">
                <thead><tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col" className="cx-selected">Operação</th><th scope="col">DI (curva B3)</th></tr></thead>
                <tbody>
                  {rows.map((x) => <tr key={x.label}><th scope="row">{x.label}</th><td className="cx-selected">{x.op}</td><td>{x.di}</td></tr>)}
                </tbody>
              </table>
            </div>
            <ul className="cx-diff">
              <li>
                {same ? <>A operação fica <b>igual ao DI</b> no período.</> : credit
                  ? <>A operação custa <b>{brl(Math.abs(r.diff))}</b> {more ? 'a mais' : 'a menos'} que o DI no período ({signed(r.bps, (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} bps`)} ao ano).</>
                  : <>A aplicação rende <b>{brl(Math.abs(r.diff))}</b> {more ? 'a mais' : 'a menos'} que o DI no período ({signed(r.bps, (v) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} bps`)} ao ano).</>}
              </li>
              {kind !== 'pct' && <li>Equivale a <b>{r.pctEq == null ? '—' : pct(r.pctEq)} do CDI</b>.</li>}
              {kind !== 'spread' && <li>Equivale a <b>CDI {signed(r.spreadEq, (v) => `${pct(v)} a.a.`)}</b></li>}
            </ul>
          </>
        ) : (
          <p className="cx-hint cx-pad" role={result?.error ? 'alert' : undefined}>{result?.error || (base ? 'Preencha a operação.' : 'A comparação aparece quando a curva DI estiver disponível.')}</p>
        )}
      </article>
      <p className="status">Projeção pela curva DI da data-base · Sem IOF, IR e tarifas · Não é CET</p>
    </section>
  )
}
