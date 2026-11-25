import { useEffect, useRef, useState } from 'react'
import { numeroPt } from './investimentos.js'
import FundoCvmPicker, { useCotasCvm } from './FundoCvmPicker.jsx'
import { FONTE_CVM, isFundoCvm, LICENCA_CVM } from './fundosCvm.js'
import {
  PUBLIC_SERIES, PERIODS, CURRENCIES, MAX_SERIES, parseSeriesCsv, loadBcb, compareHistory,
  metrics, simulateHistory, comparisonCsv, resumoFundo,
} from './investmentHistory.js'

const COLORS = ['#0131ff', '#ff6200', '#00847e', '#9668bd', '#8e5400', '#396c9b']
const DEFAULT_IDS = ['cdi', 'dolar', 'ipca']
const STORAGE = 'peme-investimentos-v1'
const SERIES_URL = 'https://www3.bcb.gov.br/sgspub/'
const EUR = { id: 'eur', code: 21619, kind: 'level' }
const value = n => n === null ? '—' : n.toLocaleString('pt-BR', {
  style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
})
const money = (n, currency) => n.toLocaleString('pt-BR', { style: 'currency', currency })
const dateText = date => date?.split('-').reverse().join('/') ?? '—'
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

function initialConfig(link, saved) {
  const params = new URLSearchParams(link || saved || '')
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

function HistoryChart({ comparison, tracks = comparison.tracks, title = 'Rentabilidade acumulada' }) {
  const [hover, setHover] = useState(null)
  const [width, setWidth] = useState(750)
  const chart = useRef(null)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.max(230, Math.round(entry.contentRect.width)))
    })
    observer.observe(chart.current)
    return () => observer.disconnect()
  }, [])
  const chartRight = width - 15
  const chartLeft = 72
  const index = hover === null ? comparison.timeline.length - 1 : Math.min(hover, comparison.timeline.length - 1)
  const totals = tracks.flatMap(track => track.values.map(level => level - 1))
  const min = Math.min(0, ...totals)
  const span = (Math.max(0, ...totals) - min) || 0.01
  const x = i => chartLeft + i * (chartRight - chartLeft) / (comparison.timeline.length - 1)
  const y = level => 183 - (level - min) / span * 160
  const ticks = [...new Set([0, Math.floor(comparison.timeline.length / 2), comparison.timeline.length - 1])]
  return <section className="inv-panel inv-chart" aria-label={title}>
    <h3>{title}</h3>
    <svg ref={chart} viewBox={`0 0 ${width} 220`} role="img" aria-label="Gráfico da variação acumulada por mês">
      {[0, 1, 2, 3, 4].map(i => {
        const level = min + i * span / 4
        return <g key={i}><line className="inv-gridline" x1={chartLeft} x2={chartRight} y1={y(level)} y2={y(level)} />
          <text x={chartLeft - 6} y={y(level) + 4} textAnchor="end">{value(level)}</text></g>
      })}
      {tracks.map(track => <polyline key={track.id} fill="none" stroke={track.color} strokeWidth="2.6"
        points={track.values.map((level, i) => x(i) + ',' + y(level - 1)).join(' ')} />)}
      <line className="inv-guide" x1={x(index)} x2={x(index)} y1="23" y2="183" />
      {tracks.map(track => <circle key={track.id} cx={x(index)} cy={y(track.values[index] - 1)} r="4" fill={track.color} />)}
      {ticks.map((i, position) => <text key={i} x={x(i)} y="208"
        textAnchor={position === 0 ? 'start' : position === ticks.length - 1 ? 'end' : 'middle'}>
        {comparison.timeline[i].split('-').reverse().join('/')}
      </text>)}
    </svg>
    <label className="inv-month">Mês de referência · {comparison.timeline[index].split('-').reverse().join('/')}
      <input type="range" min="0" max={comparison.timeline.length - 1} value={index} onChange={e => setHover(Number(e.target.value))} />
    </label>
    <ul className="inv-legend">{tracks.map(track => <li key={track.id}><Dot color={track.color} />{track.name} <strong>{value(track.values[index] - 1)}</strong></li>)}</ul>
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

function SeriesPicker({ remaining, add, importSeries }) {
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('BRL')
  const matches = remaining.filter(item => item.name.toLowerCase().includes(search.trim().toLowerCase()))
  return <details className="inv-import">
    <summary>Adicionar ativo</summary>
    <label>Buscar referência pública<input type="search" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <div className="inv-flex">{matches.map(item => <button type="button" key={item.id} onClick={() => add(item.id)}>{item.name}</button>)}</div>
    {!matches.length && <p>Nenhuma referência disponível para esta busca.</p>}
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

function FichaFundo({ fundo, cdi, cdiLoading, cdiFalhou, repetir, add, jaAdicionado, lotado }) {
  const resumo = resumoFundo(fundo.rows, cdi)
  return <section className="inv-ficha" aria-labelledby="inv-ficha-titulo">
    <h4 id="inv-ficha-titulo">Ficha do fundo</h4>
    <p><strong>{fundo.name}</strong></p>
    <p className="inv-nota">Cotas de {dateText(fundo.rows[0][0])} a {dateText(fundo.rows.at(-1)[0])} · CVM</p>
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
    <button type="button" disabled={jaAdicionado || lotado} onClick={() => add(fundo.id)}>
      {jaAdicionado ? 'Já está na comparação' : lotado ? 'Limite de seis ativos atingido' : 'Adicionar à comparação'}
    </button>
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

export default function InvestmentWorkspace({ mode, link, showPortfolio, visible }) {
  const [local] = useState(readLocal)
  const [config, setConfig] = useState(() => initialConfig(link, local.favorites?.[0]?.config))
  const [custom, setCustom] = useState(() => Array.isArray(local.series) ? local.series : [])
  const [favorites, setFavorites] = useState(() => Array.isArray(local.favorites) ? local.favorites : [])
  const [activeFavorite, setActiveFavorite] = useState('')
  const [status, setStatus] = useState('')
  const [retry, setRetry] = useState(0)
  const [fichaId, setFichaId] = useState('')
  const [source, today] = useBcbHistory(retry)
  const fundosIds = config.ids.filter(isFundoCvm)
  const fundos = useCotasCvm(fichaId && !fundosIds.includes(fichaId) ? [...fundosIds, fichaId] : fundosIds, retry)
  const fundoFicha = fundos.dados[fichaId]
  const catalog = [...publicSeries, ...custom]
  const selected = config.ids.map((id, index) => {
    const fundo = isFundoCvm(id)
    const item = fundo ? fundos.dados[id] : catalog.find(entry => entry.id === id)
    return { ...(item ?? { id, name: fundo ? 'Fundo CVM · ' + id.slice(6) : 'Série importada indisponível' }),
      rows: item?.rows ?? source.data[id], color: COLORS[index] }
  })
  const conversion = [...new Set(selected.flatMap(item => item.currency && item.currency !== config.currency
    ? [item.currency, config.currency].filter(code => code !== 'BRL') : []))]
  const missing = selected.filter(item => !item.rows)
  const cvmLoading = missing.some(item => isFundoCvm(item.id) && !fundos.erros.includes(item.id))
  const fxError = conversion.some(code => source.errors.includes(code === 'USD' ? 'dolar' : 'eur'))
  const retryNeeded = fxError || missing.some(item => source.errors.includes(item.id) || fundos.erros.includes(item.id))
  const comparison = compareHistory(selected, config.period, config.currency,
    { USD: source.data.dolar, EUR: source.data.eur }, today.slice(0, 7))
  const change = next => {
    setConfig(next)
    setActiveFavorite('')
    setStatus('')
  }
  const add = id => {
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
  return <div hidden={!visible} className="inv-study">
    <div className="inv-controls">
      <div className="inv-flex" role="group" aria-label="Período">
        {PERIODS.map(period => <button type="button" key={period} aria-pressed={config.period === period}
          onClick={() => change({ ...config, period })}>{period === 6 ? '6M' : period / 12 + 'A'}</button>)}
      </div>
      <label className="inv-currency">Moeda<select value={config.currency} onChange={e => change({ ...config, currency: e.target.value })}>
        {CURRENCIES.map(code => <option key={code}>{code}</option>)}
      </select></label>
      {mode === 'comparar' && <div className="inv-actions inv-flex">
        <button type="button" onClick={save} disabled={!config.ids.length || !!missing.length}>Salvar</button>
        {favorites.length > 0 && <label className="inv-favorites">Comparações salvas
          <select value={activeFavorite} onChange={event => {
            const next = event.target.value
            if (next) change(initialConfig(next))
            setActiveFavorite(next)
          }}><option value="">Escolher comparação</option>
            {favorites.map(item => <option key={item.config} value={item.config}>{item.label}</option>)}
          </select>
        </label>}
        <button type="button" onClick={copy} disabled={!config.ids.length}>Copiar link</button>
        <button type="button" onClick={download} disabled={!comparison}>Exportar CSV</button>
      </div>}
    </div>
    {status && <p role="status">{status}</p>}
    <div className="inv-dashboard">
      {mode === 'comparar' && comparison
        ? <HistoryChart comparison={comparison} />
        : <section className="inv-panel inv-state" aria-live="polite">
          <h3>{mode === 'simular' ? 'Base histórica da simulação' : 'Rentabilidade acumulada'}</h3>
          {comparison ? <p>{comparison.timeline[0]} a {comparison.timeline.at(-1)} · {config.currency}</p>
            : <p>{!selected.length ? 'Adicione uma série para começar.' : cvmLoading ? 'Carregando cotas da CVM…'
              : source.loading ? 'Carregando dados do Banco Central…'
              : missing.length || fxError ? 'Há séries indisponíveis. Atualize os dados ou ajuste a seleção.'
              : 'Não há dois meses consecutivos em comum, ou existem lacunas no período selecionado.'}</p>}
          {retryNeeded &&
            <button type="button" onClick={() => setRetry(count => count + 1)}>Atualizar dados</button>}
        </section>}
      <section className="inv-panel inv-assets" aria-labelledby="inv-assets">
        <h3 id="inv-assets">Ativos em comparação</h3>
        <ul>{selected.map(item => {
          const track = comparison?.tracks.find(entry => entry.id === item.id)
          return <li key={item.id}>
            <div><strong><Dot color={item.color} />{item.name}</strong>
              <small>{item.currency ?? '—'} · {item.source ?? (isFundoCvm(item.id) ? 'CVM · Informe Diário' : 'CSV deste navegador')}</small>
              {track ? <small>Base {dateText(track.start)} · Último ponto {dateText(track.end)}</small>
                : source.loading && item.source?.startsWith('SGS') ? null : <small>Última observação {dateText(item.rows?.at(-1)?.[0])}</small>}</div>
            <button type="button" aria-label={'Remover ' + item.name} onClick={() => change({ ...config, ids: config.ids.filter(id => id !== item.id) })}>×</button>
          </li>
        })}</ul>
        <FundoCvmPicker onSelect={setFichaId} selecionado={fichaId} />
        {fichaId && (fundoFicha
          ? <FichaFundo fundo={fundoFicha} cdi={source.data.cdi} cdiLoading={source.loading} cdiFalhou={source.errors.includes('cdi')}
              repetir={() => setRetry(n => n + 1)} add={add} jaAdicionado={config.ids.includes(fichaId)} lotado={selected.length >= MAX_SERIES} />
          : fundos.erros.includes(fichaId)
            ? <p role="status">Cotas indisponíveis. <button type="button" onClick={() => setRetry(n => n + 1)}>Tentar novamente</button></p>
            : <p role="status">Carregando a ficha do fundo…</p>)}
        {selected.length < MAX_SERIES
          ? <SeriesPicker remaining={catalog.filter(item => !config.ids.includes(item.id))} add={add} importSeries={importSeries} />
          : <p className="inv-nota">Até {MAX_SERIES} séries por comparação.</p>}
        {mode === 'comparar' && <button className="inv-primary" type="button" onClick={showPortfolio}>Simular carteira</button>}
      </section>
    </div>
    {comparison && <p className="inv-nota">
      Janela efetiva {comparison.timeline[0].split('-').reverse().join('/')} a {comparison.timeline.at(-1).split('-').reverse().join('/')} · {config.currency}.
      {comparison.endsEarly ? ' A última observação mensal em comum é anterior ao último mês fechado.' : ''}
    </p>}
    {comparison && !comparison.fullPeriod && <p className="inv-nota" role="status">
      O histórico em comum cobre {comparison.timeline.length - 1} dos {config.period} meses solicitados.</p>}
    {comparison && (mode === 'comparar'
      ? <Results tracks={comparison.tracks} />
      : <Portfolio comparison={comparison} currency={config.currency} />)}
    <p className="inv-nota">Base comum por mês fechado, com a última observação disponível de cada série. As datas podem diferir. Em CSV, prefira valores de fechamento.
      Volatilidade anualizada usa retornos mensais. Maior queda é medida nos fechamentos mensais.
      Conversão por PTAX venda do último dia disponível no mês.
      {' '}<a href={SERIES_URL} target="_blank" rel="noreferrer">Consultar fontes no Banco Central</a>.</p>
    {fundosIds.length > 0 && <p className="inv-nota">A variação das cotas não inclui distribuições nem impostos do cotista.
      Dados adaptados do <a href={FONTE_CVM} target="_blank" rel="noreferrer">Informe Diário da CVM</a>,
      sob <a href={LICENCA_CVM} target="_blank" rel="noreferrer">licença ODbL</a>.</p>}
  </div>
}
