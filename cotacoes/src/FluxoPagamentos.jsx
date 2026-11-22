import { useState } from 'react'
import { linhasDoFluxoBndes } from './bndesFluxo.js'
import Help from './CalculatorHelp.jsx'
import './BndesPecas.css'

const brl = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export default function FluxoPagamentos({ rows = [], inicio }) {
  const [selection, setSelection] = useState(null)
  const items = linhasDoFluxoBndes(rows)
  const max = Math.max(1, ...items.map(row => row.payment))
  const selected = selection ? items.slice(Math.min(selection[0], selection[1]), Math.max(selection[0], selection[1]) + 1) : []
  const begin = index => setSelection([index, index])
  const extend = index => setSelection(current => current ? [current[0], index] : current)
  const total = key => selected.reduce((sum, row) => sum + row[key], 0)
  return <section className="bndes-flow" aria-labelledby="bndes-flow-title">
    <header><h3 id="bndes-flow-title">Fluxo de pagamentos <Help label="Fluxo de pagamentos"><p>Selecione um trecho arrastando pelas barras. O principal é parcela menos juros; em TLP, LCD e TFBD ele inclui a correção do saldo. Data de início: {inicio || 'data da liberação'}.</p></Help></h3><span className="bndes-flow-legend"><i /> Juros <i /> Amortização</span></header>
    <div className="bndes-flow-chart" role="list" aria-label="Parcelas mensais">
      {items.map((row, index) => <button type="button" role="listitem" key={`${row.date}-${index}`} className={`bndes-flow-bar${row.juros ? ' is-interest-only' : ''}`} aria-label={`Parcela ${row.number}, ${brl(row.payment)}`} onPointerDown={() => begin(index)} onPointerEnter={() => extend(index)} style={{ '--payment-height': `${Math.max(2, row.payment / max * 100)}%` }}><span className="bndes-flow-stack"><i style={{ height: `${row.amortization / row.payment * 100}%` }} /><i style={{ height: `${row.interest / row.payment * 100}%` }} /></span><small>{row.number}</small></button>)}
    </div>
    {selected.length > 0 && <aside className="bndes-flow-tip" role="status"><b>{selected.length} parcelas</b><span>Parcelas {brl(total('payment'))}</span><span>Juros {brl(total('interest'))}</span><span>Principal {brl(total('amortization'))}</span></aside>}
  </section>
}
