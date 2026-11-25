import { useEffect, useMemo, useRef, useState } from 'react'
import { numeroPt } from './investimentos.js'
import FundoCvmPicker, { useCotasCvm } from './FundoCvmPicker.jsx'
import { FONTE_CVM, isFundoCvm, LICENCA_CVM } from './fundosCvm.js'
import {
  PUBLIC_SERIES, PERIODS, CURRENCIES, MAX_SERIES, parseSeriesCsv, loadBcb, compareHistory, compareDailyHistory,
  metrics, simulateHistory, comparisonCsv, resumoFundo,
} from './investmentHistory.js'

const COLORS = ['#4671ee', '#e56b23', '#00958d', '#9668bd', '#aa6a16', '#4b7eac']
const DEFAULT_IDS = ['cdi']
const STORAGE = 'peme-investimentos-v1'
const SERIES_URL = 'https://www3.bcb.gov.br/sgspub/'
const EUR = { id: 'eur', code: 21619, kind: 'level' }
const value = n => n === null ? '—' : n.toLocaleString('pt-BR', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const money = (n, currency) => n.toLocaleString('pt-BR', { style: 'currency', currency })
const dateText = date => date?.split('-').reverse().join('/') ?? '—'
const monthText = month => month.split('-').reverse().join('/')
const publicSeries = PUBLIC_SERIES.map(item => ({ ...item, currency: 'BRL', source: 'SGS ' + item.code }))

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) ?? {}
  } catch {
    return {}
  }
}

function writeLocal(state) {
  localStorage.setItem(STORAGE, JSON.stringify(state))
}

function initialConfig(link) {
  const params = new URLSearchParams(link || '')
  const period = Number(params.get('periodo'))
  const currency = params.get('moeda')
  const ids = [...new Set((params.get('ativos') ?? '').split(',').filter(id =>
    /^(cdi|ipca|dolar|csv-[\da-f-]{36})$/.test(id) || isFundoCvm(id)))]
  return {
    ids: params.has('ativos') ? ids.slice(0, MAX_SERIES) : DEFAULT_IDS,
    period: PERIODS.includes(period) ? period : 12,
    currency: CURRENCIES.includes(currency) ? currency : 'BRL',
  }
}

function encodeConfig(config) {
  return new URLSearchParams({ ativos: config.ids.join(','), periodo: config.period, moeda: config.currency }).toString()
}

function useBcbHistory(retry) {
  const [state, setState] = useState({ data: {}, errors: [], loading: true })
  const [today] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }))
  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18000)])
    const items = [...PUBLIC_SERIES, EUR]
    Promise.allSettled(items.map(item => loadBcb(item, today, signal))).then(results => {
      if (controller.signal.aborted) return
      const data = Object.fromEntries(items.map((item, index) => [item.id, results[index].value]))
      const errors = items.filter((_, index) => results[index].status === 'rejected').map(item => item.id)
      setState({ data, errors, loading: false })
    })
    return () => controller.abort()
  }, [retry, today])
  return [state, today]
}

function HistoryChart({ comparison, tracks = comparison.tracks, title = 'Rentabilidade acumulada', controls }) {
  const [point, setPoint] = useState(null)
  const [pointer, setPointer] = useState(null)
  const [width, setWidth] = useState(750)
  const chart = useRef(null)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(230, Math.round(entry.contentRect.width)))
    })
    observer.observe(chart.current)
    return () => observer.disconnect()
  }, [])
  const chartRight = width - 16
  const chartLeft = width < 420 ? 62 : 78
  const height = controls ? (width < 560 ? 260 : 338) : 220
  const bottom = height - 31
  const top = 22
  const last = comparison.timeline.length - 1
  const index = Math.min(pointer ?? point ?? last, last)
  const tooltipWidth = Math.min(310, width)
  const daily = comparison.daily
  const formatDate = daily ? dateText : monthText
  const axis = useMemo(() => comparison.timeline.map((date, i) => daily ? Date.parse(date) : i), [comparison.timeline, daily])
  const { x, y, min, span, lines } = useMemo(() => {
    const totals = tracks.flatMap(track => track.values.filter(level => level !== null).map(level => level - 1))
    const min = Math.min(0, ...totals)
    const span = (Math.max(0, ...totals) - min) || 0.01
    const x = i => chartLeft + (axis[i] - axis[0]) * (chartRight - chartLeft) / (axis[last] - axis[0])
    const y = level => bottom - (level - min) / span * (bottom - top)
    const lines = tracks.map(track => track.values.flatMap((level, i) =>
      level === null ? [] : [x(i) + ',' + y(level - 1)]).join(' '))
    return { x, y, min, span, lines }
  }, [axis, tracks, last, chartLeft, chartRight, bottom, top])
  const divisions = width < 560 ? 2 : 4
  function nearest(position) {
    const target = axis[0] + (position - chartLeft) / (chartRight - chartLeft) * (axis[last] - axis[0])
    const next = axis.findIndex(point => point >= target)
    if (next < 0) return last
    return next > 0 && target - axis[next - 1] <= axis[next] - target ? next - 1 : next
  }
  const ticks = [...new Set(Array.from({ length: divisions + 1 }, (_, i) =>
    nearest(chartLeft + i * (chartRight - chartLeft) / divisions)))]
  function locate(event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const position = (event.clientX - bounds.left) * width / bounds.width
    return nearest(position)
  }
  function valuesAt(i) {
    return tracks.map(track => <li key={track.id}><span><Dot color={track.color} />{track.name}</span>
      <span className="inv-chart-values">
        <strong>{value(track.values[i] === null ? null : track.values[i] - 1)}</strong>
        {daily && <small>{track.changes[i] === null ? 'Sem dado no dia' : value(track.changes[i]) + ' no dia'}</small>}
      </span></li>)
  }
  return <section className="inv-panel inv-chart" aria-label={title}>
    <header className="inv-chart-header"><h3>{title}</h3>{controls}</header>
    <div className="inv-plot">
      <svg ref={chart} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={daily ? 'Gráfico da rentabilidade acumulada por dia' : 'Gráfico da variação acumulada por mês'}
        onPointerMove={event => { if (event.pointerType !== 'touch') setPointer(locate(event)) }}
        onPointerLeave={() => setPointer(null)}
        onPointerDown={event => { if (event.pointerType === 'touch') setPoint(locate(event)) }}>
        {[0, 1, 2, 3, 4].map(i => {
          const level = min + i * span / 4
          return <g key={i}><line className="inv-gridline" x1={chartLeft} x2={chartRight} y1={y(level)} y2={y(level)} />
            <text x={chartLeft - 6} y={y(level) + 4} textAnchor="end">{value(level)}</text></g>
        })}
        {tracks.map((track, i) => <polyline key={track.id} fill="none" stroke={track.color} strokeWidth="2.6" points={lines[i]} />)}
        <line className="inv-guide" x1={x(index)} x2={x(index)} y1={top} y2={bottom} />
        {tracks.filter(track => track.values[index] !== null).map(track =>
          <circle key={track.id} cx={x(index)} cy={y(track.values[index] - 1)} r="4" fill={track.color} />)}
        {ticks.map((i, position) => <text key={i} x={x(i)} y={height - 8}
          textAnchor={position === 0 ? 'start' : position === ticks.length - 1 ? 'end' : 'middle'}>
          {formatDate(comparison.timeline[i])}
        </text>)}
      </svg>
      {pointer !== null && <div className="inv-chart-tooltip" aria-hidden="true" style={{
        width: tooltipWidth, left: x(index) + tooltipWidth + 16 <= width ? x(index) + 12 : Math.max(0, x(index) - tooltipWidth - 12),
      }}>
        <strong>{formatDate(comparison.timeline[index])}</strong>
        <ul>{valuesAt(index)}</ul>
      </div>}
    </div>
    <label className="inv-month">{daily ? 'Data' : 'Mês de referência'} · {formatDate(comparison.timeline[index])}
      <input type="range" min="0" max={last} value={index} aria-valuetext={formatDate(comparison.timeline[index])}
        onChange={e => { setPointer(null); setPoint(Number(e.target.value)) }} />
    </label>
    <ul className="inv-legend" aria-label={daily ? 'Rentabilidade dos ativos na data selecionada'
      : 'Rentabilidade dos ativos no mês selecionado'}>{valuesAt(index)}</ul>
  </section>
}

function Dot({ color }) {
  return <span className="inv-dot" style={{ background: color }} aria-hidden="true" />
}

function Results({ tracks }) {
  return <section className="inv-panel" aria-labelledby="inv-risk">
    <h3 id="inv-risk">Retorno e risco</h3>
    <div className="inv-table"><table>
      <thead><tr><th scope="col">Ativo</th><th scope="col">Retorno no período</th>
        <th scope="col">Volatilidade anualizada</th><th scope="col">Maior queda</th></tr></thead>
      <tbody>{tracks.map(track => {
        const { total, volatility, drawdown } = metrics(track.values)
        return <tr key={track.id}><th scope="row"><Dot color={track.color} />{track.name}</th>
          <td>{value(total)}</td><td>{value(volatility)}</td><td>{value(drawdown)}</td></tr>
      })}</tbody>
    </table></div>
  </section>
}

function SeriesImport({ importSeries }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('BRL')
  return <details className="inv-import">
    <summary>Importar série em CSV</summary>
    <div className="inv-grade">
      <label>Nome da série<input maxLength="60" value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Moeda da série<select value={currency} onChange={e => setCurrency(e.target.value)}>
        {CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></label>
      <label>Importar CSV<input type="file" accept=".csv,text/csv" onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void importSeries(file, name, currency)
      }} /></label>
    </div>
    <p className="inv-nota">Use data;valor, com datas AAAA-MM-DD e valores positivos de preço, cota ou índice. Informe a moeda original. Para ações ou ETFs, prefira uma série ajustada. O arquivo é lido neste navegador.</p>
  </details>
}

function FichaFundo({ fundo, cdi, cdiLoading, cdiFalhou, repetir, comparar, simular, jaAdicionado, lotado }) {
  const resumo = resumoFundo(fundo.rows, cdi)
  const bloqueado = lotado && !jaAdicionado
  const titulo = useRef(null)
  useEffect(() => {
    if (document.activeElement === document.body) titulo.current?.focus({ preventScroll: true })
  }, [fundo.id])
  return <section className="inv-panel inv-ficha" aria-label="Ficha do fundo">
    <header className="inv-ficha-cabecalho">
      <div>
        <h3 ref={titulo} tabIndex={-1}>{fundo.name}</h3>
        <p className="inv-nota">Cotas de {dateText(fundo.rows[0][0])} a {dateText(fundo.rows.at(-1)[0])} · CVM</p>
      </div>
      <div className="inv-flex">
        <button className="inv-primary" type="button" disabled={bloqueado} onClick={comparar}>
          {jaAdicionado ? 'Ver comparação' : 'Adicionar à comparação'}
        </button>
        <button type="button" disabled={bloqueado} onClick={simular}>Simular carteira</button>
      </div>
    </header>
    {bloqueado && <p className="inv-nota" role="status">Remova um ativo da comparação para incluir este fundo. O limite é de seis.</p>}
    <div className="inv-table"><table aria-label="Rentabilidade do fundo e do CDI">
      <thead><tr><th scope="col">Período</th><th scope="col">Fundo</th><th scope="col">CDI</th></tr></thead>
      <tbody>{resumo.map(linha => <tr key={linha.meses}>
        <th scope="row">{linha.meses} {linha.meses === 1 ? 'mês' : 'meses'}
          {linha.inicio && <small>{dateText(linha.inicio)} a {dateText(linha.fim)}</small>}
        </th>
        <td>{value(linha.fundo)}</td><td>{value(linha.cdi)}</td>
      </tr>)}</tbody>
    </table></div>
    {cdiLoading && <p className="inv-nota" role="status">Carregando CDI…</p>}
    {cdiFalhou && <button type="button" onClick={repetir}>Tentar carregar CDI novamente</button>}
    <p className="inv-nota">Variação da cota, sem distribuições nem tributos do cotista.
      A cota inicial pode recuar até sete dias corridos. O CDI acumula da data inicial até a véspera da final.
      O traço indica dado indisponível.</p>
  </section>
}

function Portfolio({ comparison, currency }) {
  const [inputs, setInputs] = useState({})
  const allocation = track => inputs[track.id] ?? '1000'
  const amounts = comparison.tracks.map(track => numeroPt(allocation(track), true))
  const result = simulateHistory(comparison.tracks, amounts)
  const principal = amounts.reduce((sum, amount) => sum + amount, 0)
  const tracks = result ? [{ id: 'carteira', name: 'Carteira simulada', color: COLORS[0], values: result }] : []
  return <>
    <section className="inv-panel">
      <h3>Valor inicial por ativo em {currency}</h3>
      <div className="inv-grade inv-allocations">{comparison.tracks.map(track => <label key={track.id}>{track.name}
        <input inputMode="decimal" value={allocation(track)} onChange={e => setInputs(current => ({ ...current, [track.id]: e.target.value }))} />
      </label>)}</div>
      {result ? <dl>
        <div><dt>Valor inicial</dt><dd>{money(principal, currency)}</dd></div>
        <div><dt>Valor final</dt><dd>{money(principal * result.at(-1), currency)}</dd></div>
        <div><dt>Retorno no período</dt><dd>{value(result.at(-1) - 1)}</dd></div>
      </dl> : <p role="status">Informe um total inicial positivo. Cada valor deve ficar entre zero e 1 trilhão.</p>}
      <p className="inv-nota">Valores históricos, com aplicação única no início e sem rebalanceamento, impostos ou custos. CDI e IPCA servem como referências teóricas.</p>
    </section>
    {result && <><HistoryChart comparison={comparison} tracks={tracks} title="Evolução da carteira" /><Results tracks={tracks} /></>}
  </>
}

export default function InvestmentWorkspace({ mode, link, showComparison, showPortfolio, visible }) {
  const [local] = useState(readLocal)
  const [config, setConfig] = useState(() => initialConfig(link))
  const [custom, setCustom] = useState(() => Array.isArray(local.series) ? local.series : [])
  const [favorites, setFavorites] = useState(() => Array.isArray(local.favorites) ? local.favorites : [])
  const [activeFavorite, setActiveFavorite] = useState('')
  const [status, setStatus] = useState('')
  const [retry, setRetry] = useState(0)
  const [fichaId, setFichaId] = useState('')
  const [nomes, setNomes] = useState({})
  const [source, today] = useBcbHistory(retry)
  const fundosIds = config.ids.filter(isFundoCvm)
  const fundos = useCotasCvm(fichaId && !fundosIds.includes(fichaId) ? [...fundosIds, fichaId] : fundosIds, retry)
  const fundoFicha = fundos.dados[fichaId]
  const catalog = [...publicSeries, ...custom]
  const selected = config.ids.map((id, index) => {
    const fundo = isFundoCvm(id)
    const item = fundo ? fundos.dados[id] : catalog.find(entry => entry.id === id)
    return { ...(item ?? { id, name: nomes[id] ?? (fundo ? 'Fundo CVM · ' + id.slice(6) : 'Série importada indisponível') }),
      rows: item?.rows ?? source.data[id], color: COLORS[index] }
  })
  const conversion = [...new Set(selected.flatMap(item => item.currency && item.currency !== config.currency
    ? [item.currency, config.currency].filter(code => code !== 'BRL') : []))]
  const missing = selected.filter(item => !item.rows)
  const cvmLoading = missing.some(item => isFundoCvm(item.id) && !fundos.erros.includes(item.id))
  const fxError = conversion.some(code => source.errors.includes(code === 'USD' ? 'dolar' : 'eur'))
  const retryNeeded = fxError || missing.some(item => source.errors.includes(item.id) || fundos.erros.includes(item.id))
  const fx = { USD: source.data.dolar, EUR: source.data.eur }
  const monthly = compareHistory(selected, config.period, config.currency, fx, today.slice(0, 7))
  const comparando = mode === 'comparar'
  const comparison = comparando ? compareDailyHistory(selected, config.period, config.currency, fx) : monthly
  const change = next => {
    setConfig(next)
    setActiveFavorite('')
    setStatus('')
  }
  const add = (id, nome) => {
    if (nome && isFundoCvm(id)) setNomes(current => ({ ...current, [id]: nome }))
    if (!config.ids.includes(id) && config.ids.length < MAX_SERIES) change({ ...config, ids: [...config.ids, id] })
  }
  async function importSeries(file, name, currency) {
    if (file.size > 1024 * 1024) return setStatus('Use um CSV de até 1 MB.')
    try {
      const rows = parseSeriesCsv(await file.text())
      const id = 'csv-' + crypto.randomUUID()
      const item = { id, name: name.trim() || file.name.replace(/\.csv$/i, '').trim().slice(0, 60) || 'Série importada', currency, rows, source: 'CSV local' }
      setCustom(current => [...current, item])
      setConfig(current => current.ids.length < MAX_SERIES ? { ...current, ids: [...current.ids, id] } : current)
      setStatus('CSV importado. Use Salvar para guardar a seleção neste navegador.')
    } catch (error) {
      setStatus(error.message)
    }
  }
  function save() {
    try {
      const encoded = encodeConfig(config)
      const disk = readLocal()
      const saved = Array.isArray(disk.favorites) ? disk.favorites : favorites
      const label = selected.map(item => item.name).join(' + ') + ' · ' + config.period + ' meses · ' + config.currency
      const next = [{ config: encoded, label }, ...saved.filter(item => item.config !== encoded)]
      const savedSeries = new Map((disk.series ?? []).map(item => [item.id, item]))
      custom.filter(item => config.ids.includes(item.id)).forEach(item => savedSeries.set(item.id, item))
      writeLocal({ favorites: next, series: [...savedSeries.values()] })
      setFavorites(next)
      setActiveFavorite(encoded)
      setStatus('Comparação salva neste navegador.')
    } catch {
      setStatus('O navegador não conseguiu salvar esta comparação.')
    }
  }
  async function copy() {
    const url = new URL(window.location.href)
    url.hash = 'calculadora/investimentos?' + encodeConfig(config)
    try {
      await navigator.clipboard.writeText(url.href)
      setStatus(config.ids.some(id => id.startsWith('csv-'))
        ? 'Link copiado. Para reabrir séries CSV, salve a comparação e use este mesmo navegador.'
        : 'Link da comparação copiado.')
    } catch {
      setStatus('Este navegador não permitiu copiar o link.')
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', comparisonCsv(comparison, config.currency)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'comparacao-investimentos.csv'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (mode === 'fundos') return <div className="inv-study">
    <FundoCvmPicker inline onSelect={setFichaId} selecionado={fichaId} />
    {fichaId && (fundoFicha
      ? <FichaFundo fundo={fundoFicha} cdi={source.data.cdi} cdiLoading={source.loading} cdiFalhou={source.errors.includes('cdi')}
          repetir={() => setRetry(n => n + 1)}
          comparar={() => { add(fichaId, fundoFicha.name); showComparison() }}
          simular={() => { add(fichaId, fundoFicha.name); showPortfolio() }}
          jaAdicionado={config.ids.includes(fichaId)} lotado={selected.length >= MAX_SERIES} />
      : fundos.erros.includes(fichaId)
        ? <p role="status">Cotas indisponíveis. <button type="button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></p>
        : <p role="status">Carregando a ficha do fundo…</p>)}
  </div>
  const controls = <div className="inv-controls">
    <div className="inv-flex" role="group" aria-label="Período">
      {PERIODS.map(period => <button type="button" key={period} aria-pressed={config.period === period}
        onClick={() => change({ ...config, period })}>{period === 6 ? '6M' : period / 12 + 'A'}</button>)}
    </div>
    <label className="inv-currency">Moeda<select value={config.currency} onChange={e => change({ ...config, currency: e.target.value })}>
      {CURRENCIES.map(code => <option key={code}>{code}</option>)}
    </select></label>
  </div>
  return <div hidden={!visible} className="inv-study">
    {visible && <FundoCvmPicker key={mode} inline referencias={catalog} ativos={config.ids}
      lotado={selected.length >= MAX_SERIES} onSelect={add} />}
    <section className="inv-panel inv-assets" aria-labelledby="inv-assets">
      <header className="inv-assets-header">
        <h3 id="inv-assets">Ativos em comparação</h3>
        <span className="inv-nota" role="status">{selected.length} de {MAX_SERIES} ativos</span>
      </header>
      {selected.length > 0 && <ul>{selected.map(item => <li key={item.id}>
        <div><strong><Dot color={item.color} />{item.name}</strong>
          <small>{item.currency ?? '—'} · {item.source ?? (isFundoCvm(item.id) ? 'CVM · Informe Diário' : 'CSV deste navegador')}</small>
          {item.rows?.length > 0 && <small>{dateText(item.rows[0][0])} a {dateText(item.rows.at(-1)[0])}</small>}</div>
        <button type="button" aria-label={'Remover ' + item.name} onClick={() => change({ ...config, ids: config.ids.filter(id => id !== item.id) })}>×</button>
      </li>)}</ul>}
    </section>
    {comparando && comparison
      ? <HistoryChart comparison={comparison} controls={controls} />
      : <section className="inv-panel inv-state" aria-live="polite">
        <header className="inv-chart-header">
          <h3>{comparando ? 'Rentabilidade acumulada' : 'Base histórica da simulação'}</h3>
          {controls}
        </header>
        {comparison ? <p>{monthText(comparison.timeline[0])} a {monthText(comparison.timeline.at(-1))} · {config.currency}</p>
          : <p>{!selected.length ? 'Adicione um ativo para ver o gráfico.' : cvmLoading ? 'Carregando cotas da CVM…'
            : source.loading ? 'Carregando dados do Banco Central…'
            : missing.length || fxError ? 'Há séries indisponíveis. Atualize os dados ou ajuste a seleção.'
            : comparando ? 'Não há duas observações diárias para o período selecionado.'
              : 'Não há dois meses consecutivos em comum, ou existem lacunas no período selecionado.'}</p>}
        {retryNeeded &&
          <button type="button" onClick={() => setRetry(count => count + 1)}>Atualizar dados</button>}
      </section>}
    {comparison && <p className="inv-nota">
      {comparando ? <>Base em {dateText(comparison.start)} · Última data disponível {dateText(comparison.timeline.at(-1))}</>
        : <>Janela efetiva {monthText(comparison.timeline[0])} a {monthText(comparison.timeline.at(-1))}</>} · {config.currency}.
      {comparison.endsEarly ? ' A última observação mensal em comum é anterior ao último mês fechado.' : ''}
    </p>}
    {comparando && comparison && !comparison.fullPeriod && <p className="inv-nota">
      A cobertura disponível é menor que os {config.period} meses selecionados.</p>}
    {!comparando && comparison && !comparison.fullPeriod && <p className="inv-nota" role="status">
      O histórico em comum cobre {comparison.timeline.length - 1} dos {config.period} meses solicitados.</p>}
    {comparando && <div className="inv-flex">
      <button type="button" onClick={save} disabled={!config.ids.length || !!missing.length}>Salvar</button>
      <button type="button" onClick={copy} disabled={!config.ids.length}>Copiar link</button>
      <button type="button" onClick={download} disabled={!comparison}>Exportar CSV</button>
      <button className="inv-primary" type="button" onClick={showPortfolio}>Simular carteira</button>
      {favorites.length > 0 && <label className="inv-favorites">Comparações salvas
        <select value={activeFavorite} onChange={event => {
          const next = event.target.value
          if (next) change(initialConfig(next))
          setActiveFavorite(next)
        }}><option value="">Escolher comparação</option>
          {favorites.map(item => <option key={item.config} value={item.config}>{item.label}</option>)}
        </select>
      </label>}
    </div>}
    {status && <p role="status">{status}</p>}
    {comparando ? monthly && <Results tracks={monthly.tracks} /> : comparison &&
      <Portfolio comparison={comparison} currency={config.currency} />}
    {selected.length < MAX_SERIES && <SeriesImport importSeries={importSeries} />}
    {comparando && <p className="inv-nota">O gráfico usa as observações de cada dia e a última observação disponível até a data-base.
      O retorno no dia compara com a observação anterior. O traço indica valor indisponível.
      O IPCA tem observações mensais.</p>}
    <p className="inv-nota">A tabela de retorno e risco e a carteira usam os meses fechados em comum. As datas de fechamento podem diferir. Em CSV, prefira valores de fechamento.
      Volatilidade anualizada usa retornos mensais. Maior queda é medida nos fechamentos mensais.
      Conversão por PTAX venda da data do gráfico ou do último dia disponível no mês para a tabela e a carteira.
      {' '}<a href={SERIES_URL} target="_blank" rel="noreferrer">Consultar fontes no Banco Central</a>.</p>
    <p className="inv-nota">{fundosIds.length > 0 && 'A variação das cotas não inclui distribuições nem impostos do cotista. '}
      Dados dos fundos adaptados do <a href={FONTE_CVM} target="_blank" rel="noreferrer">Informe Diário da CVM</a>,
      sob <a href={LICENCA_CVM} target="_blank" rel="noreferrer">licença ODbL</a>.</p>
  </div>
}
