import { useState } from 'react'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import CalculatorHelp from './CalculatorHelp.jsx'
import CalcBack from './CalcBack.jsx'
import { parseDecimal } from './cdiDolar.js'
import { cambioMeta, daysBetween, fluxoMoeda, MOEDAS_CF, vencimentos } from './cambioFuturo.js'

const num = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const brl = (n) => `R$ ${num(n)}`
const pct = (n) => `${num(n)}%`
const dateLabel = (iso) => iso.split('-').reverse().join('/')
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }
const blank = { valor: '', cotacao: '', taxa: '', tac: '0', futuros: [] }

export function CambioFuturoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M8 14.5h7M13 12.5l2 2-2 2" />
    </svg>
  )
}

// Câmbio futuro: o dólar é a base; euro e yuan entram com a cotação da mesa. Cada moeda recebe o câmbio futuro de cada
// vencimento e a tela compara a TIR em reais, com o câmbio que atinge a meta.
export default function CambioFuturo({ onBack }) {
  const [op, setOp] = useState({ start: todayIso(), end: '', parcelas: '1', meta: '' })
  const [moedas, setMoedas] = useState({ USD: { ...blank, valor: '100.000,00' }, EUR: blank, CNH: blank })
  const setMoeda = (id, key, value) => setMoedas((old) => ({ ...old, [id]: { ...old[id], [key]: value } }))
  const setFuturo = (id, i, value) => setMoedas((old) => { const futuros = [...old[id].futuros]; futuros[i] = value; return { ...old, [id]: { ...old[id], futuros } } })

  const venc = op.end ? vencimentos(op.start, op.end, Number(op.parcelas)) : null
  const dates = venc?.ok ? venc.dates : []
  const meta = parseDecimal(op.meta)
  const usd = moedas.USD
  const brlBase = parseDecimal(usd.valor) * parseDecimal(usd.cotacao)
  // Euro e yuan: sem valor digitado, usa o mesmo R$ do dólar convertido pela cotação da moeda.
  const valorDe = (id) => {
    const m = moedas[id]
    const own = parseDecimal(m.valor)
    if (id === 'USD' || own > 0) return own
    const c = parseDecimal(m.cotacao)
    return brlBase > 0 && c > 0 ? Math.round(brlBase / c * 100) / 100 : NaN
  }
  const fluxos = Object.fromEntries(MOEDAS_CF.map(({ id }) => {
    const m = moedas[id]
    const started = m.cotacao.trim() || m.taxa.trim()
    if (!dates.length || !started) return [id, null]
    return [id, fluxoMoeda({ valor: valorDe(id), cotacao: parseDecimal(m.cotacao), taxa: parseDecimal(m.taxa), tac: parseDecimal(m.tac || '0'), start: op.start, dates, futuros: dates.map((_, i) => parseDecimal(m.futuros[i] ?? '')) })]
  }))
  const prontos = MOEDAS_CF.filter(({ id }) => fluxos[id]?.completo && fluxos[id].tir != null)
  const melhor = prontos.length > 1 ? prontos.reduce((a, b) => (fluxos[b.id].tir < fluxos[a.id].tir ? b : a)).id : null

  const input = (id, label, value, onChange, placeholder, hint) => (
    <div className="cx-field">
      <div className="cx-field-label"><label htmlFor={id}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )

  return (
    <section className="cx cf bw calc-standard calc-workspace" aria-labelledby="cf-heading">
      <div className="bw-heading calc-workspace-heading">
        <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-heading" className="cx-title"><span>Câmbio futuro</span></h2></div>
        <CalculatorHelp title="Câmbio futuro"><p>Compara o mesmo empréstimo cotado pela mesa em dólar, euro e yuan. Você informa a cotação de partida, a taxa all-in e o câmbio futuro de cada vencimento; a tela mostra a TIR em reais e o câmbio futuro que atinge a meta.</p></CalculatorHelp>
      </div>
      <p className="cf-notice">Simulação com as cotações que você digitar. Não considera IR sobre juros, IOF nem outras tarifas além da TAC. Os dados ficam só nesta tela.</p>

      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>1. Operação</h3></header>
        <div className="cx-form">
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cf-start">Desembolso</label></div><input id="cf-start" type="date" value={op.start} onChange={(e) => setOp({ ...op, start: e.target.value })} /></div>
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cf-end">Vencimento final</label></div><input id="cf-end" type="date" value={op.end} onChange={(e) => setOp({ ...op, end: e.target.value })} /></div>
          {input('cf-parcelas', 'Parcelas', op.parcelas, (v) => setOp({ ...op, parcelas: v }), '1', 'Amortização constante. Com mais de uma parcela, os vencimentos ficam espaçados por igual entre o desembolso e o vencimento final.')}
          {input('cf-meta', 'Meta de TIR (% a.a.)', op.meta, (v) => setOp({ ...op, meta: v }), 'ex.: 22,00', 'Atingir meta: a tela calcula o câmbio futuro (o mesmo em todos os vencimentos) que deixa a TIR ao ano igual a esta meta.')}
        </div>
        {venc && !venc.ok && <p className="cx-error cx-pad" role="alert">{venc.error}</p>}
      </article>

      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>2. Cotação da mesa</h3><CalculatorHelp title="Cotação da mesa"><p>Comece pelo dólar. Euro e yuan: se o valor na moeda ficar em branco, a tela usa o mesmo valor em reais do dólar convertido pela cotação da moeda.</p></CalculatorHelp></header>
        <div className="cf-moedas">
          {MOEDAS_CF.map(({ id, sym, nome }) => {
            const m = moedas[id]
            const sugerido = id !== 'USD' && !m.valor.trim() ? valorDe(id) : NaN
            const auto = sugerido > 0 ? num(sugerido) : ''
            const f = fluxos[id]
            return (
              <fieldset key={id} className="cf-moeda">
                <legend>{nome}</legend>
                {input(`cf-${id}-valor`, `Valor em ${sym}`, m.valor, (v) => setMoeda(id, 'valor', v), auto || 'ex.: 100.000,00')}
                {input(`cf-${id}-cot`, `Cotação de partida (R$ por ${sym} 1)`, m.cotacao, (v) => setMoeda(id, 'cotacao', v), 'ex.: 5,9160')}
                {input(`cf-${id}-taxa`, 'Taxa all-in (% a.a.)', m.taxa, (v) => setMoeda(id, 'taxa', v), 'ex.: 11,20', 'Juros lineares: saldo × taxa × dias corridos ÷ 360.')}
                {input(`cf-${id}-tac`, 'TAC (R$)', m.tac, (v) => setMoeda(id, 'tac', v), '0')}
                <p className="cf-brl">{f?.ok ? <>Valor em reais: <b>{brl(f.brl)}</b></> : f ? <span role="alert">{f.error}</span> : 'Preencha cotação e taxa.'}</p>
              </fieldset>
            )
          })}
        </div>
      </article>

      {dates.length > 0 && (
        <article className="desk-panel cx-panel">
          <header className="cx-heading"><h3>3. Câmbio futuro por vencimento</h3><CalculatorHelp title="Câmbio futuro"><p>R$ por unidade da moeda em cada vencimento, como a mesa passar. Cada parcela vira reais por esse câmbio.</p></CalculatorHelp></header>
          <div className="cx-wrap"><table className="cx-matrix cf-table"><caption className="sr-only">Câmbio futuro por vencimento e moeda</caption>
            <thead><tr><th scope="col">Vencimento</th><th scope="col">Prazo</th>{MOEDAS_CF.map(({ id, sym }) => <th key={id} scope="col">{sym}</th>)}</tr></thead>
            <tbody>{dates.map((d, i) => (
              <tr key={d}><th scope="row">{dateLabel(d)}</th><td>{daysBetween(op.start, d)} dias</td>
                {MOEDAS_CF.map(({ id, sym }) => <td key={id}><input type="text" inputMode="decimal" autoComplete="off" aria-label={`Câmbio futuro ${sym} em ${dateLabel(d)}`} placeholder="R$" value={moedas[id].futuros[i] ?? ''} onChange={(e) => setFuturo(id, i, e.target.value)} /></td>)}
              </tr>
            ))}</tbody>
          </table></div>
        </article>
      )}

      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>4. Resultado</h3><CalculatorHelp title="Resultado"><ul>
          <li>Fluxo em reais: entra o valor em R$ menos a TAC; sai cada parcela na moeda × câmbio futuro.</li>
          <li>TIR ao ano: taxa que zera esse fluxo, em dias corridos/365.</li>
          <li>No período: total pago em R$ ÷ valor recebido − 1, sem anualizar.</li>
          <li>Câmbio para a meta: câmbio futuro único que deixa a TIR ao ano igual à meta. Acima dele, a operação custa mais que a meta.</li>
        </ul></CalculatorHelp></header>
        {!prontos.length ? <p className="cf-notice cx-pad">Preencha a operação, a cotação e o câmbio futuro de cada vencimento para ver a TIR.</p> : (
          <div className="cx-wrap"><table className="cx-matrix cf-table"><caption className="sr-only">Comparação entre moedas</caption>
            <thead><tr><th scope="col">Moeda</th><th scope="col">Recebe (R$)</th><th scope="col">Paga (R$)</th><th scope="col">No período</th><th scope="col">TIR a.a.</th><th scope="col">Câmbio para a meta</th></tr></thead>
            <tbody>{prontos.map(({ id, nome }) => {
              const f = fluxos[id]
              const alvo = cambioMeta(f, meta)
              return (
                <tr key={id} className={id === melhor ? 'cf-best' : undefined}>
                  <th scope="row">{nome}{id === melhor && <small> · menor custo</small>}</th>
                  <td>{brl(f.liquido)}</td><td>{brl(f.totalBrl)}</td><td>{pct(f.periodo)}</td><td><b>{pct(f.tir)}</b></td>
                  <td>{alvo ? `R$ ${num(alvo, 4)}` : '—'}</td>
                </tr>
              )
            })}</tbody>
          </table></div>
        )}
      </article>

      {MOEDAS_CF.filter(({ id }) => fluxos[id]?.ok).map(({ id, sym, nome }) => {
        const f = fluxos[id]
        return (
          <details key={id} className="desk-panel cx-panel cf-fluxo">
            <summary>Fluxo · {nome} · juros {sym} {num(f.juros)} · total {sym} {num(f.totalMoeda)}</summary>
            <div className="cx-wrap"><table className="cx-matrix cf-table"><caption className="sr-only">Fluxo em {nome}</caption>
              <thead><tr><th scope="col">Prazo</th><th scope="col">Vencimento</th><th scope="col">Saldo devedor</th><th scope="col">Amortização</th><th scope="col">Juros ({num(f.taxa)}%)</th><th scope="col">Parcela</th><th scope="col">Câmbio futuro</th><th scope="col">Parcela (R$)</th></tr></thead>
              <tbody>
                <tr><td>0</td><td>{dateLabel(op.start)}</td><td colSpan="5">Desembolso: {sym} {num(f.valor)} × {num(f.cotacao, 4)}{f.tac > 0 && ` − TAC ${brl(f.tac)}`}</td><td>{brl(f.liquido)}</td></tr>
                {f.linhas.map((l) => (
                  <tr key={l.date}><td>{l.prazo}</td><td>{dateLabel(l.date)}</td><td>{sym} {num(l.saldo)}</td><td>{sym} {num(l.amort)}</td><td>{sym} {num(l.juros)}</td><td>{sym} {num(l.parcela)}</td><td>{l.futuro ? num(l.futuro, 4) : '—'}</td><td>{l.parcelaBrl ? brl(l.parcelaBrl) : '—'}</td></tr>
                ))}
              </tbody>
            </table></div>
          </details>
        )
      })}
    </section>
  )
}
