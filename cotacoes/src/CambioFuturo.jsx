import { useState } from 'react'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import CalculatorHelp from './CalculatorHelp.jsx'
import CalcBack from './CalcBack.jsx'
import { parseDecimal } from './cdiDolar.js'
import { parseMoneyInput } from './moneyInput.js'
import { cambioMeta, MAX_PARCELAS, MOEDAS_CF } from './cambioFuturo.js'

import { contarParcelasCf, montarFluxoCf, principalCf } from './cambioFuturoInput.js'

const num = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const brl = (n) => `R$ ${num(n)}`
const pct = (n) => `${num(n)}%`
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }
const blank = () => ({ cotacao: '', tac: '', dates: [], futuros: [] })

export function CambioFuturoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M8 14.5h7M13 12.5l2 2-2 2" />
    </svg>
  )
}

export default function CambioFuturo({ onBack }) {
  const [op, setOp] = useState({ quantidade: '', usd: '', taxa: '', parcelas: '', start: todayIso(), meta: '' })
  const [slots, setSlots] = useState(['', '', ''])
  const [moedas, setMoedas] = useState(() => Object.fromEntries(MOEDAS_CF.map(m => [m.id, blank()])))
  const set = (key, value) => setOp(old => ({ ...old, [key]: value }))
  const setMoeda = (id, key, value) => setMoedas(old => ({ ...old, [id]: { ...old[id], [key]: value } }))
  const setParcela = (id, i, key, value) => setMoedas(old => {
    const next = [...old[id][key]]
    if ((next[i] ?? '') === value) return old
    next[i] = value
    const futuros = [...old[id].futuros]
    if (key === 'dates') futuros[i] = ''
    return { ...old, [id]: { ...old[id], ...(key === 'dates' ? { futuros } : {}), [key]: next } }
  })
  const active = slots.slice(0, Number(op.quantidade))
  const trimParcelas = event => {
    const n = contarParcelasCf(event.target.value)
    if (Number.isInteger(n) && n >= 1 && n <= MAX_PARCELAS) {
      setMoedas(old => Object.fromEntries(Object.entries(old).map(([id, m]) => [id, { ...m, dates: m.dates.slice(0, n), futuros: m.futuros.slice(0, n) }])))
    }
  }
  const count = contarParcelasCf(op.parcelas)
  const countOk = Number.isInteger(count) && count >= 1 && count <= MAX_PARCELAS
  const rows = countOk ? Array.from({ length: count }, (_, i) => i) : []
  const usdSpot = parseDecimal(moedas.USD.cotacao)
  const selected = active.map(id => MOEDAS_CF.find(m => m.id === id))
  const completed = selected.filter(Boolean).map(m => ({ ...m, f: montarFluxoCf(op, m.id, usdSpot, moedas[m.id]) }))
    .filter(({ f }) => f.ok && f.completo && f.tir != null)
  const best = completed.length > 1 ? completed.reduce((a, b) => b.f.tir < a.f.tir ? b : a).id : null
  const input = (id, label, value, onChange, attrs = {}) => (
    <div className="cx-field"><label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={value} onChange={e => onChange(e.target.value)} {...attrs} />
    </div>
  )
  const spot = (id, label) => input(`cf-${id}-spot`, label, moedas[id].cotacao, v => setMoeda(id, 'cotacao', v), { placeholder: 'ex.: 5,9160' })
  const changeSlot = (i, id) => setSlots(old => old.map((value, index) => index === i ? id : Number(op.quantidade) <= index && value === id ? '' : value))
  const hasForeign = active.some(id => id && id !== 'USD')

  return <section className="cx cf cf-pattern bw calc-standard calc-workspace" aria-labelledby="cf-heading">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-heading" className="cx-title"><span>Câmbio futuro</span></h2></div>
      <CalculatorHelp title="Câmbio futuro"><p>Compare o mesmo empréstimo em até três moedas. Informe os vencimentos e o câmbio futuro da mesa. A TIR é a taxa que zera o fluxo em reais, em dias corridos/365.</p></CalculatorHelp>
    </div>
    <p className="cf-notice">Simulação com as cotações que você digitar. Não considera IR sobre juros, IOF nem outras tarifas além da TAC. Os dados ficam só nesta tela.</p>

    <article className="desk-panel cx-panel cf-input">
      <header className="cx-heading"><h3>1. Operação</h3></header>
      <div className="cx-form cf-fields">
        <div className="cx-field"><label htmlFor="cf-quantidade">Quantas moedas?</label>
          <select id="cf-quantidade" value={op.quantidade} onChange={e => set('quantidade', e.target.value)}>
            <option value="">Selecione</option>{MOEDAS_CF.map((m, i) => <option key={m.id} value={i + 1}>{i + 1}</option>)}
          </select>
        </div>
        {input('cf-usd', 'Valor do empréstimo (USD)', op.usd, v => set('usd', v), { placeholder: 'ex.: 100.000,00' })}
        {input('cf-taxa', 'Taxa all-in do empréstimo (% a.a.)', op.taxa, v => set('taxa', v), { placeholder: 'ex.: 11,20' })}
        {input('cf-parcelas', 'Quantidade de parcelas', op.parcelas, v => set('parcelas', v), { inputMode: 'numeric', onBlur: trimParcelas, placeholder: `1 a ${MAX_PARCELAS}` })}
        {input('cf-start', 'Data de desembolso', op.start, v => set('start', v), { type: 'date', inputMode: undefined })}
        {hasForeign && !active.includes('USD') && spot('USD', 'Cotação de referência do USD (R$/US$)')}
      </div>
      {op.parcelas && !countOk && <p className="cf-error" role="alert">Informe um número inteiro de 1 a {MAX_PARCELAS} parcelas.</p>}
    </article>

    {selected.map((m, i) => {
      const heading = `cf-moeda-${i}-heading`
      const dados = m && moedas[m.id]
      const principal = m && principalCf(parseMoneyInput(op.usd).value, usdSpot, m.id, parseDecimal(dados.cotacao))
      const flow = m && montarFluxoCf(op, m.id, usdSpot, dados)
      return <article key={i} className="desk-panel cx-panel cf-input" aria-labelledby={heading}>
        <header className="cx-heading"><h3 id={heading}>Moeda {String(i + 1).padStart(2, '0')}{m ? ` · ${m.nome}` : ''}</h3></header>
        <div className="cx-form cf-fields">
          <div className="cx-field"><label htmlFor={`cf-moeda-${i}`}>Selecionar moeda {i + 1}</label>
            <select id={`cf-moeda-${i}`} value={active[i]} onChange={e => changeSlot(i, e.target.value)}>
              <option value="">Selecione</option>{MOEDAS_CF.map(x => <option key={x.id} value={x.id} disabled={active.some((id, j) => j !== i && id === x.id)}>{x.nome}</option>)}
            </select>
          </div>
          {m && <>
            {spot(m.id, `Cotação de partida (R$/${m.id})`)}
            <div className="cx-field"><label htmlFor={`cf-principal-${i}`}>Saldo devedor inicial ({m.id})</label>
              <input id={`cf-principal-${i}`} readOnly value={principal != null ? `${m.sym} ${num(principal)}` : '—'} />
            </div>
          </>}
        </div>
        {m && <>
          <details className="cf-options"><summary>Tarifa opcional</summary>
            {input(`cf-${m.id}-tac`, 'TAC (R$)', dados.tac, v => setMoeda(m.id, 'tac', v), { placeholder: '0,00' })}
          </details>
          {countOk && <div className="cf-installments">
            <p className="cf-notice">Ao mudar um vencimento, informe novamente o câmbio futuro daquela parcela.</p>
            {rows.map(j => {
              const item = flow.ok ? flow.linhas[j] : null
              return <fieldset key={j} className="cf-installment"><legend>Parcela {j + 1}</legend>
                {input(`cf-${m.id}-data-${j}`, 'Vencimento', dados.dates[j] ?? '', v => setParcela(m.id, j, 'dates', v), { type: 'date', inputMode: undefined })}
                {input(`cf-${m.id}-futuro-${j}`, `Câmbio futuro (R$/${m.id})`, dados.futuros[j] ?? '', v => setParcela(m.id, j, 'futuros', v), { placeholder: 'ex.: 6,5027' })}
                <dl className="cf-values">
                  <div><dt>Saldo devedor antes da parcela</dt><dd>{item ? `${m.sym} ${num(item.saldo)}` : '—'}</dd></div>
                  <div><dt>Parcela na moeda</dt><dd>{item ? `${m.sym} ${num(item.parcela)}` : '—'}</dd></div>
                  <div><dt>Parcela em reais</dt><dd>{item?.parcelaBrl != null ? brl(item.parcelaBrl) : '—'}</dd></div>
                </dl>
              </fieldset>
            })}
          </div>}
          {countOk && !flow.ok && <p className="cf-error" role="status">{flow.error}</p>}
          {flow.ok && <p className="cf-card-tir" aria-live="polite"><b>TIR em reais (% a.a.):</b> {flow.tir != null ? pct(flow.tir) : flow.completo ? 'A TIR não foi encontrada na faixa de cálculo disponível (−99% a 1.000% a.a.). Revise os valores e vencimentos.' : 'Preencha todos os câmbios futuros com valores maiores que zero.'}</p>}
        </>}
      </article>
    })}

    <article className="desk-panel cx-panel cf-quote">
      <header className="cx-heading"><h3>Resultado em reais</h3>
        <CalculatorHelp title="Resultado"><p>A TIR anual é obtida encontrando a taxa que zera o fluxo com os câmbios digitados. A meta opcional faz o inverso: encontra um câmbio único para todos os vencimentos.</p></CalculatorHelp>
      </header>
      <details className="cf-options"><summary>Câmbio para uma meta de TIR (opcional)</summary>
        {input('cf-meta', 'Meta de TIR (% a.a.)', op.meta, v => set('meta', v), { placeholder: 'ex.: 22,00' })}
      </details>
      {!completed.length ? <p className="cf-notice">Preencha os dados de uma moeda para ver a TIR.</p> : <div className="cx-wrap cf-results" tabIndex="0" role="region" aria-label="Comparação em reais">
        <table className="cx-matrix cf-table"><caption className="sr-only">Comparação entre moedas em reais</caption>
          <thead><tr>{['Moeda', 'Recebe (R$)', 'Paga (R$)', 'No período', 'TIR a.a.', 'Câmbio para a meta'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{completed.map(({ id, nome, f }) => {
            const alvo = cambioMeta(f, parseDecimal(op.meta))
            return <tr key={id} className={id === best ? 'cf-best' : undefined}>
              <th scope="row">{nome}{id === best && <small> · menor custo</small>}</th><td>{brl(f.liquido)}</td><td>{brl(f.totalBrl)}</td>
              <td>{pct(f.periodo)}</td><td><b>{pct(f.tir)}</b></td><td>{alvo ? `R$ ${num(alvo, 4)}` : '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </article>
  </section>
}
