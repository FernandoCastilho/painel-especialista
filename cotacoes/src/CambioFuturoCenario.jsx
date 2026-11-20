import { useMemo, useState } from 'react'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import './CambioFuturoCenario.css'
import CalcBack from './CalcBack.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import Flag from './Flag.jsx'
import { Plot, useWidth } from './HistoryChart.jsx'
import { ReferenciaMesa } from './CambioFuturo.jsx'
import { parseDecimal } from './cdiDolar.js'
import { parseMoneyInput } from './moneyInput.js'
import { marketDate } from './marketReturns.js'
import { spotDayPlan } from './cambioFuturoSpot.js'
import { useCentralDaily } from './useHistory.js'
import { simularParcelasCambiais } from './cambioFuturoCenario.js'

const MOEDAS = { EUR: 'Euro (EUR)', CNH: 'Yuan offshore (CNH)' }
const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quoteFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const currencyFmt = value => Number.isFinite(value) ? brlFormatter.format(value) : '—'
const pct = value => Number.isFinite(value) ? decimal.format(value) + '%' : '—'
const dateBr = date => date ? date.split('-').reverse().join('/') : '—'
const positive = n => Number.isFinite(n) && n > 0
const today = () => marketDate(Date.now())

function rowVazia(id, vencimento = '') {
  return { id, vencimento, valorMoeda: '', taxaTrava: '', taxaCenario: '', custoTravaBrl: '', custoSemTravaBrl: '' }
}

function parcelasExemplo(inicio) {
  const base = Date.parse(inicio + 'T12:00:00Z')
  return [[180, '6,55', '6,70'], [270, '6,60', '6,80'], [365, '6,65', '6,75']].map(([dias, trava, cenario], i) => ({
    ...rowVazia('p' + (i + 1), new Date(base + dias * 864e5).toISOString().slice(0, 10)),
    valorMoeda: '10.000,00', taxaTrava: trava, taxaCenario: cenario,
  }))
}

function moedaInformada(text, optional = false) {
  if (!text.trim()) return { value: null }
  const result = parseMoneyInput(text)
  if (!result.ok) return { value: null, error: result.error }
  if (!optional && !positive(result.value)) return { value: null, error: 'Informe um valor maior que zero.' }
  return { value: result.value }
}

function taxaInformada(text) {
  if (!text.trim()) return { value: null }
  const value = parseDecimal(text)
  return positive(value) ? { value } : { value: null, error: 'Informe uma cotação maior que zero.' }
}

export function historicoCenario(file, code, days, end) {
  if ((code !== 'EUR' && code !== 'CNH') || file?.source !== 'AwesomeAPI' || file.series?.[code]?.source !== code ||
      !Array.isArray(file.series?.[code]?.points)) return []
  const desde = new Date(Date.parse(end + 'T12:00:00Z') - days * 864e5).toISOString().slice(0, 10)
  const byDay = new Map()
  for (const p of file.series[code].points) {
    if (!positive(p?.t) || !Number.isFinite(new Date(p.t).getTime()) || !positive(p?.bid)) continue
    const date = marketDate(p.t)
    if (date < desde || date >= end || p.t <= (byDay.get(date)?.t ?? 0)) continue
    byDay.set(date, p)
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t)
}

function Historico({ code, end }) {
  const [days, setDays] = useState(30)
  const [anchor, width] = useWidth()
  const { status, data } = useCentralDaily()
  const points = useMemo(() => historicoCenario(data, code, days, end), [data, code, days, end])
  const dateLabel = t => dateBr(marketDate(t)).slice(0, 5)
  return <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-c-historico">
    <header className="cx-heading"><h3 id="cf-c-historico">4. Histórico · {code}/BRL</h3></header>
    <div className="cf-c-section-body">
      <div className="cf-c-toolbar" role="group" aria-label="Período do histórico">
        {[30, 90].map(n => <button type="button" key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} dias</button>)}
      </div>
      <div className="cf-c-graph" ref={anchor}>
        {points.length >= 2
          ? <Plot points={points} width={width} color="#1683d5" code={code} label={`${code}/BRL · cotação diária`} intraday={false}
              fmt={v => 'R$ ' + quoteFmt.format(v)} dateLabel={dateLabel} compare={false} scales={false} />
          : <p className="cf-notice" role="status">{status === 'loading' ? 'Consultando histórico…' : 'Histórico indisponível neste período.'}</p>}
      </div>
      <p className="cf-notice">Histórico diário da AwesomeAPI{code === 'CNH' ? ', yuan offshore por cruzamento diário' : ''}. Não é projeção.</p>
      {points.length >= 2 && <p className="cf-notice">Dados de {dateBr(marketDate(points[0].t))} a {dateBr(marketDate(points.at(-1).t))} (Brasília).</p>}
    </div>
  </article>
}

function Input({ id, label, value, change, type = 'text', error, compact, min }) {
  return <div className={`cx-field${compact ? ' cf-c-compact-field' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} min={min} inputMode={type === 'text' ? 'decimal' : undefined} autoComplete="off"
      value={value} onChange={event => change(event.target.value)} aria-invalid={error ? true : undefined}
      aria-describedby={error ? id + '-erro' : undefined} />
    {error && <small id={id + '-erro'} className="cf-resultado-status">{error}</small>}
  </div>
}

export default function CambioFuturoCenario({ onBack, quotes }) {
  const [code, setCode] = useState('EUR')
  const [inicio, setInicio] = useState(today)
  const [liquido, setLiquido] = useState('')
  const [rows, setRows] = useState(() => [rowVazia('p1')])
  const [rascunho, setRascunho] = useState(null)
  const emExemplo = rascunho !== null
  const rotuloExemplo = emExemplo ? 'Sair do exemplo fictício' : 'Gerar exemplo fictício'
  const alternarExemplo = () => {
    if (rascunho) {
      setCode(rascunho.code)
      setInicio(rascunho.inicio)
      setLiquido(rascunho.liquido)
      setRows(rascunho.rows)
      setRascunho(null)
      return
    }
    const base = today()
    setRascunho({ code, inicio, liquido, rows })
    setCode('EUR')
    setInicio(base)
    setLiquido('')
    setRows(parcelasExemplo(base))
  }
  const now = Date.now()
  const vencimentoMin = inicio || undefined
  const escolherMoeda = event => {
    if (event.target.value === code) return
    setCode(event.target.value)
    setLiquido('')
    setRows(old => old.map(row => rowVazia(row.id, row.vencimento)))
  }
  const escolherQuantidade = n => setRows(old => Array.from({ length: n }, (_, i) => old[i] ?? rowVazia('p' + (i + 1))))
  const mudarLinha = (id, key, value) => setRows(old => old.map(row => {
    if (row.id !== id || row[key] === value) return row
    return key === 'vencimento' ? { ...row, vencimento: value, taxaTrava: '', taxaCenario: '' } : { ...row, [key]: value }
  }))

  const validacao = rows.map(row => ({
    id: row.id, vencimento: row.vencimento, valorMoeda: moedaInformada(row.valorMoeda),
    taxaTrava: taxaInformada(row.taxaTrava), taxaCenario: taxaInformada(row.taxaCenario),
    custoTravaBrl: moedaInformada(row.custoTravaBrl, true), custoSemTravaBrl: moedaInformada(row.custoSemTravaBrl, true),
  }))
  const liquidoValidado = moedaInformada(liquido)
  const result = simularParcelasCambiais({
    inicio, liquidoBrl: liquidoValidado.value,
    parcelas: validacao.map(row => ({
      id: row.id, vencimento: row.vencimento, valorMoeda: row.valorMoeda.value,
      // Tarifa inválida não pode virar tarifa zero silenciosamente.
      taxaTrava: row.custoTravaBrl.error ? null : row.taxaTrava.value,
      taxaCenario: row.custoSemTravaBrl.error ? null : row.taxaCenario.value,
      ...(row.custoTravaBrl.value == null ? {} : { custoTravaBrl: row.custoTravaBrl.value }),
      ...(row.custoSemTravaBrl.value == null ? {} : { custoSemTravaBrl: row.custoSemTravaBrl.value }),
    })),
  })
  const diferenca = result.diferencaBrl
  const tipoDiferenca = !Number.isFinite(diferenca) || diferenca === 0 ? 'Diferença neste cenário'
    : diferenca > 0 ? 'Economia neste cenário' : 'Custo a mais neste cenário'
  const resultados = new Map((result.parcelas ?? []).map(row => [row.id, row]))
  const temResultado = Number.isFinite(result.totalComTravaBrl) || Number.isFinite(result.totalSemTravaBrl)
  const mostrarCredito = liquido.trim() !== ''
  const equilibrio = rows.length === 1 ? resultados.get(rows[0].id)?.equilibrio : null
  return <section className="cx cf cf-pattern cf-cenario bw calc-standard calc-workspace" aria-labelledby="cf-c-heading">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-c-heading" className="cx-title"><span>Câmbio futuro</span></h2></div>
      <div className="cf-c-heading-actions">
        <button type="button" className="cf-c-example-btn" aria-label={rotuloExemplo} title={rotuloExemplo}
          aria-pressed={emExemplo} onClick={alternarExemplo}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={emExemplo ? 'M6 6l12 12M18 6L6 18' : 'M21 12a9 9 0 1 1-2.63-6.36L21 8M21 3v5h-5'} />
          </svg>
        </button>
        <CalculatorHelp title="Câmbio futuro">
          <p>Compare o pagamento travado com um cenário que você informa. A cotação histórica é só uma referência e não preenche o cenário.</p>
          <p>Os totais são nominais, sem trazer parcelas a valor presente. Custos entram somente quando informados.</p>
        </CalculatorHelp>
      </div>
    </div>
    {emExemplo && <p className="cf-c-example-note" role="status"><strong>Exemplo fictício.</strong> Valores e cotações das parcelas são hipotéticos. Referência à vista e histórico são separados.</p>}
    <p className="cf-c-secondary"><a href="#calculadora/cambio-futuro/tir-usd">Simular TIR da parcela em USD</a></p>
    <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-c-operacao">
      <header className="cx-heading"><h3 id="cf-c-operacao">1. Operação</h3></header>
      <div className="cf-c-section-body">
        <div className="cf-c-operation">
          <div className="cx-field">
            <label htmlFor="cf-c-moeda" className="cf-com-bandeira"><Flag code={code} width={20} height={14} /> Moeda</label>
            <select id="cf-c-moeda" value={code} onChange={escolherMoeda} aria-describedby="cf-c-moeda-nota">
              {Object.entries(MOEDAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="cx-field">
            <span id="cf-c-quantidade">Quantidade de parcelas</span>
            <div className="cf-c-count" role="group" aria-labelledby="cf-c-quantidade" aria-describedby="cf-c-q-nota">
              {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-pressed={rows.length === n}
                aria-label={n === 1 ? '1 parcela' : `${n} parcelas`} onClick={() => escolherQuantidade(n)}>{n}</button>)}
            </div>
          </div>
          <Input id="cf-c-inicio" label="Data inicial" value={inicio} change={setInicio} type="date" />
        </div>
        <small id="cf-c-moeda-nota" className="cf-observacao">Trocar a moeda limpa valores e cotações. As datas são mantidas.</small>
        <small id="cf-c-q-nota" className="cf-observacao">Diminuir a quantidade descarta as últimas parcelas.</small>
        <small className="cf-observacao"><ReferenciaMesa code={code} quote={quotes?.[code]} plan={spotDayPlan(now)} /> A referência à vista não preenche o cenário.</small>
        <details className="cf-c-details">
          <summary>Custos e valor líquido (opcionais)</summary>
          <p className="cf-notice">Informe o valor líquido recebido em reais, já descontados os custos iniciais. Ele é usado no custo do período e na TIR.</p>
          <p className="cf-notice">Custos de parcela são pagos no vencimento. Informe só os que ainda não estão na cotação nem no valor líquido, para não contar duas vezes.</p>
          <Input id="cf-c-liquido" label="Valor líquido recebido (R$)" value={liquido} change={setLiquido} error={liquidoValidado.error} />
          {rows.map((row, i) => <fieldset className="cf-c-cost-row" key={row.id}>
            <legend>Parcela {i + 1}</legend>
            <Input id={`cf-c-${row.id}-tarifa-trava`} label={`Custo com trava da parcela ${i + 1} (R$)`} value={row.custoTravaBrl}
              change={v => mudarLinha(row.id, 'custoTravaBrl', v)} error={validacao[i].custoTravaBrl.error} />
            <Input id={`cf-c-${row.id}-tarifa-cenario`} label={`Custo sem trava da parcela ${i + 1} (R$)`} value={row.custoSemTravaBrl}
              change={v => mudarLinha(row.id, 'custoSemTravaBrl', v)} error={validacao[i].custoSemTravaBrl.error} />
          </fieldset>)}
        </details>
      </div>
    </article>

    <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-c-parcelas">
      <header className="cx-heading"><h3 id="cf-c-parcelas">2. Parcelas e cotações</h3></header>
      <div className="cf-c-section-body">
        <p className="cf-notice">As cotações são para cada vencimento. Ao mudar uma data, as duas cotações daquela parcela são limpas.</p>
        <p className="cf-notice">Sem o cenário, o total com trava ainda é calculado quando todas as parcelas estiverem preenchidas.</p>
        <div className="cf-c-columns" aria-hidden="true"><span>Parcela</span><span>Vencimento</span><span>Valor ({code})</span><span>Com trava (R$/{code})</span><span>Sem trava (R$/{code})</span></div>
        {rows.map((row, i) => <fieldset key={row.id} className="cf-c-row">
          <legend className="sr-only">Parcela {i + 1}</legend><span aria-hidden="true" className="cf-c-index"><span>Parcela </span>{i + 1}</span>
          <Input compact id={`cf-c-${row.id}-data`} label={`Vencimento da parcela ${i + 1}`} type="date" min={vencimentoMin} value={row.vencimento} change={v => mudarLinha(row.id, 'vencimento', v)}
            error={inicio && row.vencimento && row.vencimento <= inicio ? 'O vencimento deve ser posterior à data inicial.' : undefined} />
          <Input compact id={`cf-c-${row.id}-valor`} label={`Valor da parcela ${i + 1} (${code})`} value={row.valorMoeda} change={v => mudarLinha(row.id, 'valorMoeda', v)} error={validacao[i].valorMoeda.error} />
          <Input compact id={`cf-c-${row.id}-trava`} label={`Com trava da parcela ${i + 1} (R$/${code})`} value={row.taxaTrava} change={v => mudarLinha(row.id, 'taxaTrava', v)} error={validacao[i].taxaTrava.error} />
          <Input compact id={`cf-c-${row.id}-cenario`} label={`Cenário sem trava da parcela ${i + 1} (R$/${code})`} value={row.taxaCenario} change={v => mudarLinha(row.id, 'taxaCenario', v)} error={validacao[i].taxaCenario.error} />
        </fieldset>)}
      </div>
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-c-resultados">
      <header className="cx-heading"><h3 id="cf-c-resultados">3. Resultado geral</h3></header>
      <div className="cf-c-section-body">
        <dl className="cf-c-metrics">
          <div><dt>Total com trava</dt><dd id="cf-c-total-trava">{currencyFmt(result.totalComTravaBrl)}</dd></div>
          <div><dt>Total sem trava no cenário</dt><dd id="cf-c-total-cenario">{currencyFmt(result.totalSemTravaBrl)}</dd></div>
          <div><dt>{tipoDiferenca}</dt><dd id="cf-c-diferenca">{currencyFmt(Number.isFinite(diferenca) ? Math.abs(diferenca) : null)}</dd></div>
        </dl>
        {Number.isFinite(equilibrio) && <dl className="cf-c-equilibrio">
          <div><dt>Cotação de equilíbrio (R$/{code})</dt><dd>{quoteFmt.format(equilibrio)}</dd></div>
        </dl>}
        {mostrarCredito && <dl className="cf-c-metrics cf-c-credit-metrics">
          {rows.length === 1 && <div><dt>Custo com trava no período</dt><dd>{pct(result.custoNoPeriodoPct)}</dd></div>}
          <div><dt>TIR anual com trava</dt><dd>{pct(result.tirComTravaPct)}</dd></div>
          <div><dt>TIR anual sem trava no cenário</dt><dd>{pct(result.tirSemTravaPct)}</dd></div>
        </dl>}
        <p className="cf-notice" role="status">{result.erro || (!temResultado ? 'Preencha todas as parcelas para ver o total.' : !Number.isFinite(diferenca) ? 'Complete o cenário para comparar os totais.' : '')}</p>
        <div className="cf-c-result-foot">
          <p className="cf-notice">Soma nominal das parcelas. Só entram os custos informados.</p>
          <details className="cf-c-details">
            <summary>Ver detalhes por parcela</summary>
            <div className="cf-c-detail-grid">{rows.map((row, i) => {
              const values = resultados.get(row.id)
              return <section className="cf-c-detail-item" key={row.id} aria-label={`Detalhes da parcela ${i + 1}`}>
                <h4>Parcela {i + 1} · {dateBr(row.vencimento)}</h4>
                <dl>
                  <div><dt>Com trava</dt><dd>{currencyFmt(values?.comTravaBrl)}</dd></div>
                  <div><dt>Sem trava no cenário</dt><dd>{currencyFmt(values?.semTravaBrl)}</dd></div>
                  <div><dt>Diferença (sem trava − com trava)</dt><dd>{currencyFmt(values?.diferencaBrl)}</dd></div>
                  <div><dt>Cotação de equilíbrio (R$/{code})</dt><dd>{Number.isFinite(values?.equilibrio) ? quoteFmt.format(values.equilibrio) : '—'}</dd></div>
                </dl>
              </section>
            })}</div>
          </details>
        </div>
        <p className="cf-notice">A trava dá previsibilidade, não garante economia.</p>
      </div>
    </article>
    <Historico code={code} end={marketDate(now)} />
  </section>
}
