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
import { evaluateCrossCurrencyHedge } from './cambioFuturoMoedaCruzada.mjs'
import { mostrarBrutoTravaCruzada, simularParcelasCambiais, simularParcelasCambiaisComTravaCruzada } from './cambioFuturoCenario.js'

const MOEDAS = { USD: 'Dólar americano (USD)', EUR: 'Euro (EUR)', CNH: 'Yuan offshore (CNH)' }
const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quoteFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const currencyFmt = value => Number.isFinite(value) ? brlFormatter.format(value) : '—'
const pct = value => Number.isFinite(value) ? decimal.format(value) + '%' : '—'
const dateBr = date => date ? date.split('-').reverse().join('/') : '—'
const positive = n => Number.isFinite(n) && n > 0
const today = () => marketDate(Date.now())

function rowVazia(id, vencimento = '') {
  return { id, vencimento, valorMoeda: '', taxaCruzada: '', statusCruzada: 'nao-informada', contratadaBrl: false, taxaTrava: '', taxaCenario: '', custoTravaBrl: '', custoSemTravaBrl: '' }
}

function parcelasExemplo(inicio) {
  const base = Date.parse(inicio + 'T12:00:00Z')
  return [[180, '0,91', '6,70'], [270, '0,92', '6,80'], [365, '0,93', '6,75']].map(([dias, trava, cenario], i) => ({
    ...rowVazia('p' + (i + 1), new Date(base + dias * 864e5).toISOString().slice(0, 10)),
    valorMoeda: '100.000,00', taxaCruzada: '7,20', statusCruzada: 'contratada', contratadaBrl: true,
    taxaTrava: trava, taxaCenario: cenario,
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
  if (!Object.hasOwn(MOEDAS, code) || file?.source !== 'AwesomeAPI' || file.series?.[code]?.source !== code ||
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

export function historicoComparado(operacao, trava) {
  const porDia = new Map(trava.map(p => [marketDate(p.t), p.bid]))
  const dias = operacao.flatMap(p => {
    const data = marketDate(p.t)
    const taxa = porDia.get(data)
    return positive(taxa) ? [{ data, operacao: p.bid, trava: taxa }] : []
  })
  if (dias.length < 2) return []
  const base = dias[0]
  return dias.map(p => ({ ...p, operacaoIndice: (p.operacao / base.operacao) * 100, travaIndice: (p.trava / base.trava) * 100 }))
}

function ComparacaoHistorico({ code, hedge, pontos, width }) {
  const colors = ['#1683d5', '#c5680b']
  const height = 155
  const left = 40, right = width - 12, top = 12, bottom = height - 27
  const primeiro = pontos[0], ultimo = pontos.at(-1)
  const indice = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
  const valores = pontos.flatMap(p => [p.operacaoIndice, p.travaIndice])
  const amplitude = Math.max(.5, ...valores.map(v => Math.abs(v - 100)))
  const max = 100 + amplitude, min = 100 - amplitude
  const ts = data => Date.parse(data + 'T12:00:00Z')
  const primeiroDia = ts(primeiro.data)
  const intervalo = ts(ultimo.data) - primeiroDia
  const x = p => left + ((ts(p.data) - primeiroDia) / intervalo) * (right - left)
  const y = v => top + ((max - v) / (max - min)) * (bottom - top)
  return <>
    <svg className="cf-c-compare-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Comparação ${code}/BRL e ${hedge}/BRL em base 100`}>
      {[max, 100, min].map((v, i) => <g key={i}>
        <line x1={left} x2={right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity=".23" />
        <text x={left - 5} y={y(v)} textAnchor="end" dominantBaseline="middle">{indice.format(v)}</text>
      </g>)}
      {['operacaoIndice', 'travaIndice'].map((key, i) =>
        <polyline key={key} points={pontos.map(p => `${x(p)},${y(p[key])}`).join(' ')} fill="none"
          stroke={colors[i]} strokeWidth="2.5" strokeDasharray={i === 1 ? '6 4' : undefined} vectorEffect="non-scaling-stroke" />)}
      <text x={left} y={height - 8}>{dateBr(primeiro.data).slice(0, 5)}</text>
      <text x={right} y={height - 8} textAnchor="end">{dateBr(ultimo.data).slice(0, 5)}</text>
    </svg>
    <ul className="cf-c-compare-legend" aria-label={`Últimas cotações em comum, em ${dateBr(ultimo.data)}`}>
      <li><span className="cf-c-compare-key" style={{ color: colors[0] }} aria-hidden="true" />{code}/BRL · Operação: R$ {quoteFmt.format(ultimo.operacao)}</li>
      <li><span className="cf-c-compare-key cf-c-compare-key-trava" style={{ color: colors[1] }} aria-hidden="true" />{hedge}/BRL · Trava: R$ {quoteFmt.format(ultimo.trava)}</li>
    </ul>
    <p className="cf-notice">As duas linhas começam em 100 para comparar a variação. Apenas datas com cotação para ambas: {dateBr(primeiro.data)} a {dateBr(ultimo.data)} (Brasília).</p>
  </>
}

function Historico({ code, hedge, end }) {
  const [days, setDays] = useState(30)
  const [anchor, width] = useWidth()
  const { status, data } = useCentralDaily()
  const operacao = useMemo(() => historicoCenario(data, code, days, end), [data, code, days, end])
  const trava = useMemo(() => code === hedge ? [] : historicoCenario(data, hedge, days, end), [data, code, hedge, days, end])
  const comparacao = useMemo(() => historicoComparado(operacao, trava), [operacao, trava])
  const dateLabel = t => dateBr(marketDate(t)).slice(0, 5)
  const cruzado = code !== hedge
  const titulo = cruzado ? `${code}/BRL e ${hedge}/BRL` : `${code}/BRL`
  const series = cruzado ? [[code, operacao, '#1683d5'], [hedge, trava, '#c5680b']] : [[code, operacao, '#1683d5']]
  const temPontos = series.some(([, points]) => points.length >= 2)
  return <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-c-historico">
    <header className="cx-heading"><h3 id="cf-c-historico">4. Histórico · {titulo}</h3></header>
    <div className="cf-c-section-body">
      <div className="cf-c-toolbar" role="group" aria-label="Período do histórico">
        {[30, 90].map(n => <button type="button" key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n} dias</button>)}
      </div>
      <div className="cf-c-graph" ref={anchor}>
        {comparacao.length >= 2 ? <ComparacaoHistorico code={code} hedge={hedge} pontos={comparacao} width={width} /> : <>
          {cruzado && status !== 'loading' && <p className="cf-notice" role="status">Sem datas em comum suficientes para comparar {titulo} neste período.</p>}
          {!temPontos ? <p className="cf-notice" role="status">{status === 'loading' ? 'Consultando histórico…' : 'Histórico indisponível neste período.'}</p> :
            series.map(([moeda, points, color]) => points.length >= 2 ?
              <section key={moeda} aria-label={`Histórico ${moeda}/BRL`}>
                <Plot points={points} width={width} color={color} code={moeda} label={`${moeda}/BRL · cotação diária`} intraday={false}
                  fmt={v => 'R$ ' + quoteFmt.format(v)} dateLabel={dateLabel} compare={false} scales={false} />
                <p className="cf-notice">Dados de {dateBr(marketDate(points[0].t))} a {dateBr(marketDate(points.at(-1).t))} (Brasília).</p>
              </section>
              : <p key={moeda} className="cf-notice">Histórico {moeda}/BRL indisponível neste período.</p>)}
        </>}
      </div>
      <p className="cf-notice">Histórico diário da AwesomeAPI{code === 'CNH' || hedge === 'CNH' ? ', yuan offshore por cruzamento diário' : ''}. Não é projeção.</p>
    </div>
  </article>
}

function formatMoneyText(text) {
  if (!parseMoneyInput(text).ok) return text
  // Só muda a apresentação: preserva cada dígito informado, sem passar pelo Number.
  const [integer, cents = ''] = text.trim().split(',')
  const amount = integer.replaceAll('.', '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return amount + ',' + cents.padEnd(2, '0')
}

export function Input({ id, label, value, change, type = 'text', error, compact, min, money }) {
  const [editing, setEditing] = useState(false)
  const displayed = money && !editing ? formatMoneyText(value) : value
  return <div className={`cx-field${compact ? ' cf-c-compact-field' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} min={min} inputMode={type === 'text' ? 'decimal' : undefined} autoComplete="off"
      value={displayed} onChange={event => change(event.target.value)}
      onFocus={money ? () => setEditing(true) : undefined} onBlur={money ? () => setEditing(false) : undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? id + '-erro' : undefined} />
    {error && <small id={id + '-erro'} className="cf-resultado-status">{error}</small>}
  </div>
}

export function resumoClienteCambio({ result, code, hedge, count, exemplo }) {
  const { totalComTravaBrl: com, totalSemTravaBrl: sem, diferencaBrl: dif } = result
  const temCom = Number.isFinite(com), temSem = Number.isFinite(sem)
  if (!temCom && !temSem) return null
  const compara = temCom && temSem && Number.isFinite(dif)
  const amount = currencyFmt(Math.abs(dif))
  const quantidade = count === 1 ? '1 parcela' : count + ' parcelas'
  const descricao = `Simulação de ${quantidade} em ${code}${hedge !== code ? `, com proteção avaliada em ${hedge}` : ''}.`
  const explicacao = compara
    ? dif > 0 ? `Neste cenário, a trava reduziria o total em ${amount}.`
      : dif < 0 ? `Neste cenário, a trava custaria ${amount} a mais.`
        : 'Neste cenário, os totais com e sem trava seriam iguais.'
    : temCom ? 'O total com trava já está calculado. Falta completar o cenário sem trava para comparar.'
      : hedge === code ? 'O total sem trava usa o cenário informado. Falta completar os dados da trava para comparar.'
        : 'O total sem trava usa o cenário informado. Para comparar, revise os dados da trava e confirme as duas cotações contratadas de cada vencimento.'
  const linhas = [
    ['Total com trava', currencyFmt(com)],
    ['Total sem trava no cenário', currencyFmt(sem)],
    [compara && dif > 0 ? 'Economia neste cenário' : compara && dif < 0 ? 'Custo a mais neste cenário' : 'Diferença neste cenário',
      compara ? amount : '—'],
  ]
  const aviso = 'Os totais somam os pagamentos nos vencimentos e só incluem os custos informados. A trava dá previsibilidade, não garante economia.'
  const titulo = 'Resumo para o cliente'
  const texto = [exemplo ? 'Exemplo fictício de câmbio futuro' : 'Simulação de câmbio futuro', descricao, explicacao,
    'Resumo dos valores', ...linhas.map(([label, value]) => `${label}: ${value === '—' ? 'não calculado' : value}`), aviso].join('\n')
  return { titulo, descricao, explicacao, linhas, aviso, texto }
}

export function ResumoCliente({ resumo }) {
  const [copia, setCopia] = useState(null)
  if (!resumo) return null
  const status = copia?.texto === resumo.texto ? copia.status : null
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(resumo.texto)
      setCopia({ texto: resumo.texto, status: 'copiado' })
    } catch {
      setCopia({ texto: resumo.texto, status: 'manual' })
    }
  }
  return <section className="cf-c-client" aria-labelledby="cf-c-client-title">
    <div className="cf-c-client-heading">
      <h4 id="cf-c-client-title">{resumo.titulo}</h4>
      <button type="button" className="cf-c-copy" onClick={copiar}>Copiar resumo</button>
    </div>
    <p>{resumo.descricao} {resumo.explicacao}</p>
    <dl className="cf-c-client-totals">{resumo.linhas.map(([label, value]) =>
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="cf-notice">{resumo.aviso}</p>
    {status === 'manual' && <textarea readOnly rows={6} value={resumo.texto} aria-label="Resumo para cópia manual" onFocus={e => e.currentTarget.select()} />}
    <span role="status">{status === 'copiado' ? 'Resumo copiado.' : status === 'manual' ? 'Não foi possível copiar automaticamente. Selecione o resumo e copie manualmente.' : ''}</span>
  </section>
}

export default function CambioFuturoCenario({ onBack, quotes }) {
  const [code, setCode] = useState('USD')
  const [hedge, setHedge] = useState('USD')
  const crossed = code !== hedge
  const [inicio, setInicio] = useState(today)
  const [liquido, setLiquido] = useState('')
  const [rows, setRows] = useState(() => [rowVazia('p1')])
  const [rascunho, setRascunho] = useState(null)
  const emExemplo = rascunho !== null
  const rotuloExemplo = emExemplo ? 'Sair do exemplo fictício' : 'Gerar exemplo fictício'
  const alternarExemplo = () => {
    if (rascunho) {
      setCode(rascunho.code)
      setHedge(rascunho.hedge)
      setInicio(rascunho.inicio)
      setLiquido(rascunho.liquido)
      setRows(rascunho.rows)
      setRascunho(null)
      return
    }
    const base = today()
    setRascunho({ code, hedge, inicio, liquido, rows })
    setCode('USD')
    setHedge('CNH')
    setInicio(base)
    setLiquido('')
    setRows(parcelasExemplo(base))
  }
  const now = Date.now()
  const spotPlan = spotDayPlan(now)
  const vencimentoMin = inicio || undefined
  const escolherMoeda = event => {
    if (event.target.value === code) return
    if ((liquido || rows.some(row => row.valorMoeda || row.taxaTrava || row.taxaCenario || row.taxaCruzada ||
      row.custoTravaBrl || row.custoSemTravaBrl)) &&
      !window.confirm('Trocar a moeda da operação limpa valores e cotações. As datas não mudam. Continuar?')) return
    setCode(event.target.value)
    setHedge(event.target.value)
    setLiquido('')
    setRows(old => old.map(row => rowVazia(row.id, row.vencimento)))
  }
  const escolherTrava = event => {
    const next = event.target.value
    if (next === hedge) return
    if (rows.some(row => row.taxaTrava || row.taxaCruzada || row.custoTravaBrl) &&
      !window.confirm('Trocar a moeda da trava limpa as cotações e custos da trava. Valores da operação e datas não mudam. Continuar?')) return
    setHedge(next)
    setRows(old => old.map(row => ({ ...row, taxaTrava: '', taxaCruzada: '',
      statusCruzada: 'nao-informada', contratadaBrl: false, custoTravaBrl: '' })))
  }
  const escolherQuantidade = n => {
    if (n < rows.length && rows.slice(n).some(row => row.vencimento || row.valorMoeda || row.taxaTrava || row.taxaCenario ||
      row.taxaCruzada || row.custoTravaBrl || row.custoSemTravaBrl) &&
      !window.confirm('Diminuir a quantidade descarta as últimas parcelas preenchidas. Continuar?')) return
    setRows(old => Array.from({ length: n }, (_, i) => old[i] ?? rowVazia('p' + (i + 1))))
  }
  const mudarLinha = (id, key, value) => {
    const current = rows.find(row => row.id === id)
    if (key === 'vencimento' && current?.vencimento !== value && (current?.taxaTrava || current?.taxaCenario || current?.taxaCruzada) &&
      !window.confirm('Mudar este vencimento limpa as cotações da parcela. Continuar?')) return
    setRows(old => old.map(row => {
    if (row.id !== id || row[key] === value) return row
    return key === 'vencimento' ? { ...row, vencimento: value, taxaTrava: '', taxaCenario: '',
      taxaCruzada: '', statusCruzada: 'nao-informada', contratadaBrl: false }
      : key === 'taxaCruzada' ? { ...row, taxaCruzada: value, statusCruzada: 'nao-informada' }
      : key === 'valorMoeda' ? { ...row, valorMoeda: value, statusCruzada: 'nao-informada', contratadaBrl: false }
      : key === 'taxaTrava' ? { ...row, taxaTrava: value, contratadaBrl: false }
      : { ...row, [key]: value }
    }))
  }

  const validacao = rows.map(row => ({
    id: row.id, vencimento: row.vencimento, valorMoeda: moedaInformada(row.valorMoeda),
    taxaTrava: taxaInformada(row.taxaTrava), taxaCruzada: taxaInformada(row.taxaCruzada), taxaCenario: taxaInformada(row.taxaCenario),
    custoTravaBrl: moedaInformada(row.custoTravaBrl, true), custoSemTravaBrl: moedaInformada(row.custoSemTravaBrl, true),
  }))
  const liquidoValidado = moedaInformada(liquido)
  const crossResults = crossed ? rows.map((row, i) => {
    const v = validacao[i]
    if (!inicio || !row.vencimento || row.vencimento <= inicio || v.valorMoeda.value == null) return null
    return evaluateCrossCurrencyHedge({
      usdAmount: v.valorMoeda.value, maturity: row.vencimento, hedgeCurrency: hedge,
      scenarioUsdBrl: v.taxaCenario.value,
      usdToHedge: v.taxaCruzada.value == null || row.statusCruzada !== 'contratada' ? undefined
        : { rate: v.taxaCruzada.value, maturity: row.vencimento, contracted: true },
      hedgeToBrl: v.taxaTrava.value == null ? undefined
        : { rate: v.taxaTrava.value, maturity: row.vencimento, contracted: row.contratadaBrl },
      hypotheticalUsdToHedge: row.statusCruzada === 'cenario' ? v.taxaCruzada.value ?? undefined : undefined,
    })
  }) : []
  const simular = crossed ? simularParcelasCambiaisComTravaCruzada : simularParcelasCambiais
  const result = simular({
    inicio, liquidoBrl: liquidoValidado.value,
    parcelas: validacao.map((row, i) => ({
      id: row.id, vencimento: row.vencimento, valorMoeda: row.valorMoeda.value,
      // Tarifa inválida não pode virar tarifa zero silenciosamente.
      taxaTrava: row.custoTravaBrl.error ? null : crossed
        ? (crossResults[i]?.status === 'locked' ? row.taxaTrava.value : null)
        : row.taxaTrava.value,
      ...(crossed ? { taxaParidade: crossResults[i]?.status === 'locked' ? row.taxaCruzada.value : null } : {}),
      taxaCenario: row.custoSemTravaBrl.error ? null : row.taxaCenario.value,
      ...(row.custoTravaBrl.value == null ? {} : { custoTravaBrl: row.custoTravaBrl.value }),
      ...(row.custoSemTravaBrl.value == null ? {} : { custoSemTravaBrl: row.custoSemTravaBrl.value }),
    })),
  })
  const diferenca = result.diferencaBrl
  const tipoDiferenca = !Number.isFinite(diferenca) || diferenca === 0 ? 'Diferença neste cenário'
    : diferenca > 0 ? 'Economia neste cenário' : 'Custo a mais neste cenário'
  const resultados = new Map((result.parcelas ?? []).map(row => [row.id, row]))
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
      <header className="cx-heading cf-c-section-title"><h3 id="cf-c-operacao">1. Operação</h3>
        <CalculatorHelp title="Moedas e cotação indicativa">
          <p>A referência de compra à vista vem da AwesomeAPI. Para CNH offshore, é um cruzamento. Não preenche o cenário. Horário de Brasília, só quando comprovado pela fonte.</p>
          {hedge === 'USD' && <p><ReferenciaMesa code="USD" quote={quotes?.USD} plan={spotPlan} /></p>}
          <p>Trocar a moeda da operação limpa valores e cotações. Trocar só a moeda da trava preserva o valor original e o cenário. As datas não mudam. Diminuir a quantidade descarta as últimas parcelas.</p>
        </CalculatorHelp>
      </header>
      <div className="cf-c-section-body">
        <div className="cf-c-operation">
          <div className="cx-field">
            <label htmlFor="cf-c-moeda" className="cf-com-bandeira"><Flag code={code} width={20} height={14} /> Moeda da operação</label>
            <select id="cf-c-moeda" value={code} onChange={escolherMoeda}>
              {Object.entries(MOEDAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="cx-field">
            <label htmlFor="cf-c-trava-moeda" className="cf-com-bandeira"><Flag code={hedge} width={20} height={14} /> Moeda da trava</label>
            <select id="cf-c-trava-moeda" value={hedge} onChange={escolherTrava}>
              {(code === 'USD' ? Object.entries(MOEDAS) : [[code, MOEDAS[code]]]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div className="cx-field">
            <span id="cf-c-quantidade">Quantidade de parcelas</span>
            <div className="cf-c-count" role="group" aria-labelledby="cf-c-quantidade">
              {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} aria-pressed={rows.length === n}
                aria-label={n === 1 ? '1 parcela' : `${n} parcelas`} onClick={() => escolherQuantidade(n)}>{n}</button>)}
            </div>
          </div>
          <Input id="cf-c-inicio" label="Data inicial" value={inicio} change={setInicio} type="date" />
        </div>
        <small className="cf-observacao"><ReferenciaMesa code={hedge} quote={quotes?.[hedge]} plan={spotPlan} compact /></small>
        <details className="cf-c-details">
          <summary>Custos e valor líquido (opcionais)</summary>
          <p className="cf-notice">Informe o valor líquido recebido em reais, já descontados os custos iniciais. Ele é usado no custo do período e na TIR.</p>
          <p className="cf-notice">Custos de parcela são pagos no vencimento. Informe só os que ainda não estão na cotação nem no valor líquido, para não contar duas vezes.</p>
          <Input money id="cf-c-liquido" label="Valor líquido recebido (R$)" value={liquido} change={setLiquido} error={liquidoValidado.error} />
          {rows.map((row, i) => <fieldset className="cf-c-cost-row" key={row.id}>
            <legend>Parcela {i + 1}</legend>
            <Input money id={`cf-c-${row.id}-tarifa-trava`} label={`Custo com trava da parcela ${i + 1} (R$)`} value={row.custoTravaBrl}
              change={v => mudarLinha(row.id, 'custoTravaBrl', v)} error={validacao[i].custoTravaBrl.error} />
            <Input money id={`cf-c-${row.id}-tarifa-cenario`} label={`Custo sem trava da parcela ${i + 1} (R$)`} value={row.custoSemTravaBrl}
              change={v => mudarLinha(row.id, 'custoSemTravaBrl', v)} error={validacao[i].custoSemTravaBrl.error} />
          </fieldset>)}
        </details>
      </div>
    </article>

    <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-c-parcelas">
      <header className="cx-heading cf-c-section-title"><h3 id="cf-c-parcelas">2. Parcelas e cotações</h3>
        <CalculatorHelp title="Parcelas e cotações">
          <p>As cotações são de cada vencimento. Alterar a data limpa as cotações da parcela.</p>
          {crossed ? <p>Converta a parcela de USD para {hedge} e depois de {hedge} para reais. Só há valor integralmente travado quando as duas cotações estão contratadas para o mesmo vencimento e cobrirem o valor equivalente da parcela.</p>
            : <p>Sem o cenário, o total com trava ainda é calculado quando todas as parcelas estiverem preenchidas.</p>}
        </CalculatorHelp>
      </header>
      <div className="cf-c-section-body">
        {!crossed && <div className="cf-c-columns" aria-hidden="true"><span>Parcela</span><span>Vencimento</span><span>Valor ({code})</span><span>Cotação contratada (R$/{hedge})</span><span>Sem trava (R$/{code})</span></div>}
        {rows.map((row, i) => <fieldset key={row.id} className={`cf-c-row${crossed ? ' cf-c-row--cross' : ''}`}>
          <legend className="sr-only">Parcela {i + 1}</legend><span aria-hidden="true" className="cf-c-index"><span>Parcela </span>{i + 1}</span>
          <Input compact={!crossed} id={`cf-c-${row.id}-data`} label={`Vencimento da parcela ${i + 1}`} type="date" min={vencimentoMin} value={row.vencimento} change={v => mudarLinha(row.id, 'vencimento', v)}
            error={inicio && row.vencimento && row.vencimento <= inicio ? 'O vencimento deve ser posterior à data inicial.' : undefined} />
          <Input compact={!crossed} money id={`cf-c-${row.id}-valor`} label={`Valor da parcela ${i + 1} (${code})`} value={row.valorMoeda} change={v => mudarLinha(row.id, 'valorMoeda', v)} error={validacao[i].valorMoeda.error} />
          {!crossed ? <>
            <Input compact id={`cf-c-${row.id}-trava`} label={`Cotação contratada da parcela ${i + 1} (R$/${hedge})`} value={row.taxaTrava} change={v => mudarLinha(row.id, 'taxaTrava', v)} error={validacao[i].taxaTrava.error} />
            <Input compact id={`cf-c-${row.id}-cenario`} label={`Cenário sem trava da parcela ${i + 1} (R$/${code})`} value={row.taxaCenario} change={v => mudarLinha(row.id, 'taxaCenario', v)} error={validacao[i].taxaCenario.error} />
          </> : <div className="cf-c-cross-fields">
            <div className="cf-c-cross-step">
              <h4>1. Converter USD em {hedge}</h4>
              <Input id={`cf-c-${row.id}-cross`} label={`Cotação da conversão (${hedge} por USD)`} value={row.taxaCruzada} change={v => mudarLinha(row.id, 'taxaCruzada', v)} error={validacao[i].taxaCruzada.error} />
              <div className="cx-field">
                <label htmlFor={`cf-c-${row.id}-cross-status`}>Status da conversão</label>
                <select id={`cf-c-${row.id}-cross-status`} value={row.statusCruzada} onChange={e => mudarLinha(row.id, 'statusCruzada', e.target.value)}>
                  <option value="nao-informada">Não informada</option><option value="cenario">Hipótese de cenário</option>
                  <option value="contratada">Contratada para esta parcela</option>
                </select>
              </div>
            </div>
            <div className="cf-c-cross-step">
              <h4>2. Converter {hedge} em reais</h4>
              <Input id={`cf-c-${row.id}-trava`} label={`Cotação futura (R$ por ${hedge})`} value={row.taxaTrava} change={v => mudarLinha(row.id, 'taxaTrava', v)} error={validacao[i].taxaTrava.error} />
              <label className="cf-c-cross-check"><input type="checkbox" checked={row.contratadaBrl}
                onChange={e => mudarLinha(row.id, 'contratadaBrl', e.target.checked)} /> Trava em reais contratada para esta parcela</label>
            </div>
            <div className="cf-c-cross-step cf-c-cross-scenario">
              <h4>Comparação opcional</h4>
              <Input id={`cf-c-${row.id}-cenario`} label={`Cenário sem trava (R$ por ${code})`} value={row.taxaCenario} change={v => mudarLinha(row.id, 'taxaCenario', v)} error={validacao[i].taxaCenario.error} />
            </div>
          </div>}
        </fieldset>)}
      </div>
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-c-resultados">
      <header className="cx-heading cf-c-section-title"><h3 id="cf-c-resultados">3. Resultado geral</h3>
        <CalculatorHelp title="Resultado da comparação">
          {crossed ? <p>Detalhes cruzados mostram valores brutos por parcela. Os totais somam os pagamentos e custos informados, sem trazer a valor presente. Cenário hipotético nunca entra como trava.</p>
            : <><p>Preencha todas as parcelas para ver o total. Complete o cenário para comparar os totais.</p><p>Soma nominal das parcelas. Só entram os custos informados.</p></>}
        </CalculatorHelp>
      </header>
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
        {result.erro && inicio && <p className="cf-notice" role="status">{result.erro}</p>}
        {crossed && crossResults.some(value => value?.ok && value.status !== 'locked') &&
          <p className="cf-notice" role="status">Ainda há parcela sem trava integral. Abra os detalhes para conferir.</p>}
        <div className="cf-c-result-foot">
          <details className="cf-c-details">
            <summary>Ver detalhes por parcela</summary>
              {crossed && <div className="cf-c-detail-grid">
              {crossResults.map((value, i) => <section className="cf-c-detail-item" key={rows[i].id} aria-label={`Resultado cruzado da parcela ${i + 1}`}>
                <h4>Parcela {i + 1} · {dateBr(rows[i].vencimento)}</h4>
                {value?.ok ? <>
                  <p className="cf-notice" role="status">{value.status === 'locked' ? 'Cobertura integral indicada com os dados informados.' : `Exposição residual USD/${hedge}. Não é cobertura integral.`}</p>
                  <dl>
                    <div><dt>Sem trava no cenário USD/BRL</dt><dd>{currencyFmt(value.unhedgedBrl)}</dd></div>
                    {value.status === 'locked' && <div><dt>Pagamento travado</dt><dd>{currencyFmt(mostrarBrutoTravaCruzada(validacao[i].valorMoeda.value, validacao[i].taxaTrava.value, validacao[i].taxaCruzada.value))}</dd></div>}
                    {value.status === 'hypothetical' && <div><dt>Pagamento hipotético</dt><dd>{currencyFmt(mostrarBrutoTravaCruzada(validacao[i].valorMoeda.value, validacao[i].taxaTrava.value, validacao[i].taxaCruzada.value))}</dd></div>}
                    {Number.isFinite(value.notionalHedge) && <div><dt>Valor equivalente em {hedge}</dt><dd>{decimal.format(value.notionalHedge)}</dd></div>}
                  </dl>
                </> : <p className="cf-notice" role="status">{value?.error || ''}</p>}
              </section>)}
              </div>}
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
        <ResumoCliente resumo={resumoClienteCambio({ result, code, hedge, count: rows.length, exemplo: emExemplo })} />
      </div>
    </article>
    <Historico code={code} hedge={hedge} end={marketDate(now)} />
  </section>
}
