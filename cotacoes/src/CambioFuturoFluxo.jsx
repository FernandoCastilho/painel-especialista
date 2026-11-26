import { useState } from 'react'
import CalcBack from './CalcBack.jsx'
import { marketDate } from './marketReturns.js'
import { isBusinessDay } from './holidays.js'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './cdiDolar.js'
import { MAX_PARCELAS_FLUXO, MAX_PRAZO_DIAS, amortizacoesIguais, calcularFluxoCambio, vencimentoPorPrazo } from './cambioFuturoFluxo.js'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import './CambioFuturoJornada.css'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmt = (n, format = dec) => Number.isFinite(n) ? format.format(n) : '—'
const pct = n => Number.isFinite(n) ? dec.format(n) + '%' : '—'
const dataBrasil = data => data ? data.split('-').reverse().join('/') : '—'
const linhaVazia = () => ({ prazo: '', amortizacao: '', futuro: '' })
const dinheiro = texto => {
  if (!texto.trim()) return null
  const v = parseMoneyInput(texto)
  return v.ok ? v.value : null
}
const numero = texto => {
  if (!texto.trim()) return null
  const v = parseDecimal(texto)
  return Number.isFinite(v) ? v : null
}
const prazoDias = texto => /^\d{1,4}$/.test(texto.trim()) && Number(texto) >= 1 && Number(texto) <= MAX_PRAZO_DIAS ? Number(texto.trim()) : null
const rotuloTaxa = texto => texto.trim() ? ` (USD+${texto.trim().replace(/%$/, '')}%)` : ''

function Campo({ id, label, value, change, type = 'text', mode = 'decimal', placeholder, error }) {
  return <div className="cx-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} inputMode={type === 'text' ? mode : undefined} autoComplete="off"
      value={value} onChange={e => change(e.target.value)} placeholder={placeholder}
      aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-erro' : undefined} />
    {error && <small className="cf-j-error" id={id + '-erro'}>{error}</small>}
  </div>
}

export default function CambioFuturoFluxo({ onBack }) {
  const [op, setOp] = useState(() => ({ inicio: marketDate(Date.now()), valor: '', allIn: '', tac: '0', spot: '', externa: '', ir: '', local: '' }))
  const [quantidade, setQuantidade] = useState(1)
  const [linhas, setLinhas] = useState(() => Array.from({ length: MAX_PARCELAS_FLUXO }, linhaVazia))
  const mudar = chave => valor => setOp(old => ({ ...old, [chave]: valor }))
  const mudarLinha = (i, chave) => valor => setLinhas(old => old.map((l, j) => j === i ? { ...l, [chave]: valor } : l))

  const valorUsd = dinheiro(op.valor)
  const tacBrl = op.tac.trim() ? dinheiro(op.tac) ?? NaN : 0
  const padrao = amortizacoesIguais(valorUsd, quantidade)
  const ativas = linhas.slice(0, quantidade)
  const r = calcularFluxoCambio({
    inicio: op.inicio, valorUsd, tacBrl, spot: numero(op.spot),
    taxas: { externa: numero(op.externa), ir: numero(op.ir), local: numero(op.local) },
    parcelas: ativas.map((l, i) => ({ prazo: prazoDias(l.prazo), amortizacao: l.amortizacao.trim() ? dinheiro(l.amortizacao) : padrao[i], futuro: numero(l.futuro) })),
  })
  const allIn = numero(op.allIn)
  const somaDifere = Number.isFinite(allIn) && Number.isFinite(r.somaTaxas) && Math.abs(allIn - r.somaTaxas) >= 0.01
  const bullet = quantidade === 1
  const colunas = ['Prazo (dias)', 'Vencimento', 'Amortização em USD', 'Saldo devedor USD',
    'Comissão externa' + rotuloTaxa(op.externa), 'IR juros remissível' + rotuloTaxa(op.ir), 'Comissão local' + rotuloTaxa(op.local),
    'Juros total' + rotuloTaxa(op.allIn), 'Parcela USD', 'Câmbio futuro (R$/USD)', 'Fluxo em R$']

  return <section className="cx cf cf-pattern bw calc-standard calc-workspace cf-j cf-f" aria-labelledby="cf-f-title">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-f-title" className="cx-title">Câmbio futuro</h2></div>
    </div>
    <p className="cf-notice cf-j-links">
      <a href="#calculadora/cambio-futuro/euro-yuan">Cotar via euro ou yuan</a>
      <a href="#calculadora/cambio-futuro/cenarios">Comparar cenários com e sem trava</a>
      <a href="#calculadora/cambio-futuro/tir-usd">Simular TIR pela taxa all-in</a>
    </p>

    <article className="desk-panel cx-panel cf-input cf-j-azul" aria-labelledby="cf-f-op">
      <header className="cx-heading"><h3 id="cf-f-op">1. Dados da operação</h3></header>
      <div className="cf-j-grid">
        <Campo id="cf-f-inicio" label="Data de início" type="date" value={op.inicio} change={mudar('inicio')} />
        <Campo id="cf-f-valor" label="Valor em USD" value={op.valor} change={mudar('valor')} placeholder="ex.: 100.000,00"
          error={op.valor && !(valorUsd > 0) ? 'Informe um valor maior que zero.' : null} />
        <div className="cx-field"><label htmlFor="cf-f-parcelas">Parcelas</label>
          <select id="cf-f-parcelas" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))}>
            {Array.from({ length: MAX_PARCELAS_FLUXO }, (_, i) => <option key={i} value={i + 1}>{i + 1 === 1 ? '1 (bullet)' : i + 1}</option>)}
          </select></div>
        <Campo id="cf-f-allin" label="Taxa all-in da empresa (% a.a.)" value={op.allIn} change={mudar('allIn')} placeholder="ex.: 11,20" />
        <Campo id="cf-f-tac" label="TAC (R$)" value={op.tac} change={mudar('tac')} placeholder="0"
          error={Number.isNaN(tacBrl) ? 'Informe a TAC em reais, ex.: 1.500,00.' : null} />
      </div>
      <div className="cf-j-grid cf-f-taxas">
        <Campo id="cf-f-externa" label="Comissão externa (% a.a.)" value={op.externa} change={mudar('externa')} placeholder="ex.: 6,6581" />
        <Campo id="cf-f-ir" label="IR juros remissível (% a.a.)" value={op.ir} change={mudar('ir')} placeholder="ex.: 2,2194" />
        <Campo id="cf-f-local" label="Comissão local (% a.a.)" value={op.local} change={mudar('local')} placeholder="ex.: 2,3204" />
      </div>
      <p className="cf-notice" id="cf-f-soma">Soma das três taxas: {pct(r.somaTaxas)} a.a.{Number.isFinite(allIn) ? ` · all-in informado: ${pct(allIn)} a.a.` : ''}
        {somaDifere && <strong> A soma não bate com o all-in; confira as taxas.</strong>}</p>
    </article>

    <article className="desk-panel cx-panel cf-input cf-j-amarelo" aria-labelledby="cf-f-mesa">
      <header className="cx-heading"><h3 id="cf-f-mesa">2. Cotação da mesa</h3></header>
      <p className="cf-notice">O spot vale para a operação toda. O câmbio futuro de cada vencimento vai na tabela abaixo.</p>
      <div className="cf-j-grid"><Campo id="cf-f-spot" label="Spot (R$/USD)" value={op.spot} change={mudar('spot')} placeholder="ex.: 5,916"
        error={op.spot && !(numero(op.spot) > 0) ? 'Cotação inválida.' : null} /></div>
      <dl className="cf-j-grid cf-j-totais cf-f-mesa">
        <div><dt>Valor em R$</dt><dd id="cf-f-valor-brl">{fmt(r.valorBrl, brl)}</dd></div>
        <div><dt>Valor recebido (menos a TAC)</dt><dd id="cf-f-liquido">{fmt(r.liquidoBrl, brl)}</dd></div>
      </dl>
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-f-tabela">
      <header className="cx-heading"><h3 id="cf-f-tabela">3. Parcelas e fluxo em R$</h3></header>
      <p className="cf-notice">Informe o prazo de cada parcela e o câmbio futuro da mesa. Vencimento, saldo, comissões, juros e fluxo em R$ são calculados. A amortização já vem em partes iguais; mude se precisar.</p>
      <div className="cf-j-scroll" tabIndex={0} role="region" aria-label="Parcelas e fluxo em R$">
        <table className="cf-j-matriz cf-f-matriz">
          <thead><tr><th scope="col">Parcela</th>{colunas.map(t => <th scope="col" key={t} className={t === 'Fluxo em R$' ? 'cf-f-fc' : undefined}>{t}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Início</th><td>0</td><td>{dataBrasil(op.inicio)}</td><td colSpan={8} /><td className="cf-f-fc" id="cf-f-fc-0">{fmt(r.liquidoBrl == null ? null : -r.liquidoBrl, brl)}</td></tr>
            {ativas.map((l, i) => {
              const calc = r.linhas[i] ?? {}
              const venc = vencimentoPorPrazo(op.inicio, prazoDias(l.prazo))
              return <tr key={i}>
                <th scope="row">{bullet ? 'Bullet' : i + 1}</th>
                <td><Campo id={`cf-f-${i + 1}-prazo`} label={`Prazo em dias · parcela ${i + 1}`} mode="numeric" value={l.prazo} change={mudarLinha(i, 'prazo')} placeholder="ex.: 361"
                  error={l.prazo && prazoDias(l.prazo) == null ? `De 1 a ${MAX_PRAZO_DIAS} dias.` : null} /></td>
                <td>{dataBrasil(venc)}{venc && !isBusinessDay(venc, 'BR') && <small className="cf-j-error"><br />Dia não útil</small>}</td>
                <td><Campo id={`cf-f-${i + 1}-amort`} label={`Amortização em USD · parcela ${i + 1}`} value={l.amortizacao} change={mudarLinha(i, 'amortizacao')}
                  placeholder={fmt(padrao[i])} error={l.amortizacao && dinheiro(l.amortizacao) == null ? 'Valor inválido.' : null} /></td>
                <td>{fmt(calc.saldo)}</td>
                <td>{fmt(calc.externa)}</td>
                <td>{fmt(calc.ir)}</td>
                <td>{fmt(calc.local)}</td>
                <td>{fmt(calc.juros)}</td>
                <td id={`cf-f-${i + 1}-parcela`}>{fmt(calc.parcela)}</td>
                <td><Campo id={`cf-f-${i + 1}-futuro`} label={`Câmbio futuro · parcela ${i + 1}`} value={l.futuro} change={mudarLinha(i, 'futuro')} placeholder="ex.: 6,5027"
                  error={l.futuro && !(numero(l.futuro) > 0) ? 'Cotação inválida.' : null} /></td>
                <td className="cf-f-fc" id={`cf-f-${i + 1}-fc`}>{fmt(calc.fcBrl, brl)}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      {(r.erro || r.falta) && <p className="cf-notice" role="status">{r.erro || r.falta}</p>}

      <dl className="cf-j-grid cf-j-totais">
        <div><dt>Total em USD</dt><dd id="cf-f-total-usd">{fmt(r.totalUsd)}</dd></div>
        <div><dt>Total pago em R$</dt><dd id="cf-f-total-brl">{fmt(r.totalBrl, brl)}</dd></div>
        <div><dt>TIR ao ano (base 252)</dt><dd id="cf-f-tir">{pct(r.tirPct)}</dd></div>
        {bullet && <div><dt>Custo no período (sem anualizar)</dt><dd id="cf-f-periodo">{pct(r.periodoPct)}</dd></div>}
      </dl>
      <p className="cf-notice">A TIR usa as datas do fluxo: dias úteis (feriados nacionais) entre o início e cada vencimento, divididos por 252. Vencimento em dia não útil conta até o último dia útil antes dele. O fluxo em R$ converte a parcela em USD pelo câmbio futuro do vencimento. Não substitui o CET contratual.</p>
    </article>
  </section>
}
