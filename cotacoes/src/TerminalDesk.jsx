import RefreshButton from './RefreshButton.jsx'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { fromInput, useIntraday } from './useHistory.js'
import { marketDate } from './marketReturns.js'
import { marketPreviews } from './marketPreviews.js'
import { upcoming } from './agenda.js'
import Sparkline from './Sparkline.jsx'
import { formatoComo } from './chartMarcas.js'
import { FINIMP_MARGEM, FINIMP_MODOS, SPARK_NOTE, finimpConverte, finimpParidade, ibovSpark, kpiItems, kpiSparks, sparkTone, tapeItems } from './terminal.js'
import HelpDialog from './HelpDialog.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import Flag from './Flag.jsx'
import InsightAprender from './InsightAprender.jsx'
import RollingNumber from './RollingNumber.jsx'

const KPI_CURRENCY_PAIRS = { USD: ['USD', 'BRL'], EUR: ['EUR', 'BRL'], PAR: ['EUR', 'USD'] }
const MARK = { up: '▲', down: '▼', flat: '■' }

// Faixa corrida sob a barra superior (só no computador). Se os itens não cabem, ela rola devagar e pausa sob o mouse.
export function Tape({ quotes, rates, oil, showFxFlags = false }) {
  const items = tapeItems(quotes, rates, oil)
  const box = useRef(null)
  const set = useRef(null)
  const [run, setRun] = useState(false)
  const [secs, setSecs] = useState(60)
  const sig = items.map((i) => `${i.key}${i.value}${i.text ?? ''}`).join('|')
  useLayoutEffect(() => {
    const check = () => {
      if (!box.current || !set.current) return
      const w = set.current.scrollWidth
      setRun(w > box.current.clientWidth + 2)
      setSecs(Math.max(30, Math.round(w / 40)))
    }
    check()
    const ro = new ResizeObserver(check)
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [sig, showFxFlags])
  if (!items.length) return <div className="tape" aria-hidden="true" />
  const list = (hidden) => (
    <div className="tape-set" ref={hidden ? undefined : set} aria-hidden={hidden || undefined}>
      {items.map((i) => (
        <span key={i.key} className="tape-item">
          <b className={showFxFlags && (i.code === 'USD' || i.code === 'EUR') ? 'tape-fx-label' : undefined}>
            {showFxFlags && (i.code === 'USD' || i.code === 'EUR') && <Flag code={i.code} width={16} height={11} />}
            {i.label}
          </b>
          {i.value}
          {i.text && <em className={i.tone}>{i.text}</em>}
          {i.note && <em className="flat">{i.note}</em>}
        </span>
      ))}
    </div>
  )
  return (
    <div className="tape" ref={box} role="region" aria-label="Cotações e juros de referência" tabIndex={run ? 0 : undefined}>
      <div className={`tape-track${run ? ' run' : ''}`} style={{ '--tape-secs': `${secs}s` }}>
        {list(false)}
        {run && list(true)}
      </div>
    </div>
  )
}

// Minigráficos dos indicadores: o dia atual em cada moeda (arquivo intraday já usado pelo quadro de câmbio). Sem amostras de hoje
// (madrugada, fim de semana), usa o último pregão com amostras, que o arquivo indica em `previousDay`.
function useDaySeries() {
  const today = fromInput(marketDate(Date.now()))
  const usd = useIntraday('USD', today)
  const eur = useIntraday('EUR', today)
  return marketPreviews(usd.retainedPoints, eur.retainedPoints, marketDate(Date.now()))
}

// Indicadores do topo do Mercado: quadros com o título "Mapa de variação – dia",
// a linha da última consulta (`status`) e, por último, os avisos
// (`aviso`: feriados; e a linha "Aprender"). Clique num quadro abre o gráfico da moeda ou a aba de juros.
// Enquanto as cotações não chegam (`loading`), os quadros aparecem como formas vazias no lugar de um texto de espera.
export function KpiRow({ quotes, rates, ipca, ibov, macro, colors, onOpen, onRate, goto, status, aviso, loading }) {
  const series = useDaySeries()
  const items = kpiItems(quotes, rates, ipca, ibov)
  const sparks = { ...kpiSparks({ macro, ipca }), IBOV: ibovSpark(ibov) }
  if (!items.length) {
    if (!loading) return <>{status ?? null}{aviso}</>
    return (
      <section className="kpi-block" aria-busy="true">
        <p className="sr-only" role="status">Carregando cotações…</p>
        <div className="kpis kpis-espera" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((n) => <span key={n} className="kpi kpi-espera" />)}</div>
        {status}
        {aviso}
      </section>
    )
  }
  return (
    <section className="kpi-block" aria-labelledby="kpi-title">
      <h2 id="kpi-title" className="kpi-title">Mapa de variação – dia</h2>
    <div className="kpis" role="group" aria-label="Indicadores principais">
      {items.map((i, ordem) => {
        const pair = KPI_CURRENCY_PAIRS[i.code]
        const preview = series[i.code]
        const points = preview?.points ?? sparks[i.key]
        const note = !series[i.code] && sparks[i.key]?.length && SPARK_NOTE[i.key] ? `${i.label.replace(/ 12m$/, '')}: ${SPARK_NOTE[i.key]}` : null
        const card = (
          <button key={i.key} type="button" className={`kpi${i.rate ? ' kpi-taxa' : ''}`} style={{ '--i': ordem, '--series': i.rate || i.key === 'IPCA' || i.key === 'IBOV' ? 'var(--amber)' : colors?.[i.code] || 'var(--amber)' }} onClick={() => (i.rate ? onRate(i.key) : i.key === 'IPCA' ? goto('cenarios', 'inflacao') : i.key === 'IBOV' ? goto('noticias') : onOpen(i.code))} aria-label={`${i.label} ${i.value}${i.text ? `, ${i.text}` : ''}: ${i.key === 'IBOV' ? 'abrir notícias' : 'abrir gráfico'}`}>
            <span className="kpi-label"><span className="kpi-name" title={pair ? i.label : undefined}>{pair ? pair.map(code => <Flag key={code} code={code} width={16} height={11} />) : <><Flag code="BRL" width={16} height={11} />{i.label}</>}</span>{i.rate && <small>{i.key === 'di1' ? 'B3' : i.key === 'selic' ? 'meta a.a.' : 'a.a.'}</small>}{i.key === 'IPCA' && <small>IBGE{i.note ? ` · ${i.note}` : ''}</small>}{i.key === 'IBOV' && <small>pontos · fech.{i.note ? ` ${i.note}` : ''}{i.stale ? ' · sem atualização' : ''}</small>}</span>
            <RollingNumber className="kpi-value" value={i.value} />
            <span className={`kpi-change ${i.tone}`}>
              {i.text ? <><span aria-hidden="true">{MARK[i.tone]}</span> {i.text}</> : <span className="muted" title={i.reason || undefined}>var. indisponível</span>}
            </span>
            {points?.length > 1 && <span className="kpi-spark" {...(note ? { role: 'img', 'aria-label': note, title: note } : {})}><Sparkline points={points} label={i.label} rate={!!i.rate || i.key==='IPCA'} tone={preview || note ? sparkTone(points) : i.tone} height={44} fmt={formatoComo(i.value)} /></span>}
            {['USD', 'EUR', 'PAR'].includes(i.code) && <span className="kpi-chart-date" title={preview ? `${preview.source} · amostras observadas; a cor indica a variação do gráfico` : undefined}>{preview ? `Gráfico: ${preview.day.split('-').reverse().join('/')}${i.code === 'PAR' ? ' · cruzado' : ''}` : 'Gráfico sem amostras suficientes'}</span>}
          </button>
        )
        const fin = i.key === 'EURUSD' ? finimpParidade(i.raw) : null
        if (!fin) return card
        // "?" fica fora do botão do quadro (botão dentro de botão não é válido), no canto superior direito
        return (
          <div key={i.key} className="kpi-cell" style={{ '--i': ordem }}>
            {card}
            <span className="kpi-help"><FinimpHelp fin={fin} at={i.at} comparable={i.comparable} direct={i.direct} /></span>
          </div>
        )
      })}
    </div>
      {status}
      {aviso}
      <InsightAprender goto={goto} />
    </section>
  )
}

const n4 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const n2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const hm = (t) => (Number.isFinite(t) && t > 0 ? new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—')
const SIMBOLO = { EUR: '€', USD: 'US$' }
// Paridade para a Finimp: as duas paridades, o horário da cotação e uma calculadora (valor do pagamento → valor a financiar).
function FinimpHelp({ fin, at, comparable, direct }) {
  const groupId = useId(), selectedMode = useRef(null)
  const [modo, setModo] = useState('eur-usd')
  const [texto, setTexto] = useState('')
  const lido = parseMoneyInput(texto)
  const conta = lido.ok ? finimpConverte(lido.value, modo, fin) : null
  const quando = direct ? at?.PAR : Math.min(at?.EUR ?? Infinity, at?.USD ?? Infinity)
  const m = FINIMP_MODOS[modo]
  return (
    <HelpDialog title="Paridade para a Finimp" initialFocusRef={selectedMode}>
      <span className="ex">Paridade EUR/USD: <b className="fin-num">{n4(fin.base)}</b> <span className="fin-hora">· cotação de {hm(quando)}</span></span>
      <span className="ex fin-linha"><i>Pagamento em EUR e financiamento em USD (+{n2(FINIMP_MARGEM)}):</i> <b className="fin-num">{n4(fin.eurUsd)}</b></span>
      <span className="ex fin-linha"><i>Pagamento em USD e financiamento em EUR (−{n2(FINIMP_MARGEM)}):</i> <b className="fin-num">{n4(fin.usdEur)}</b></span>
      {!comparable && <span className="ex fin-alerta" role="note">⚠ Cotações de horários diferentes; confirme na mesa.</span>}
      <div className="fin-calc" role="group" aria-label="Calcular o valor a financiar">
        <fieldset className="fin-modos">
          <legend className="sr-only">Combinação de pagamento e financiamento</legend>
          {Object.entries(FINIMP_MODOS).map(([id, o]) => (
            <label key={id} className={modo === id ? 'on' : ''}>
              <input ref={modo === id ? selectedMode : undefined} type="radio" name={groupId} value={id} checked={modo === id} onChange={() => setModo(id)} />
              <span>{o.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="fin-campo">Valor do pagamento ({m.paga})
          <MoneyInput prefix={SIMBOLO[m.paga]} value={texto} onChange={setTexto} placeholder="100.000,00" aria-invalid={!!texto && !lido.ok} />
        </label>
        <span className="fin-result" aria-live="polite">{conta ? <>Valor a financiar: <b className="fin-num">{SIMBOLO[conta.moeda]} {n2(conta.valor)}</b></> : texto && !lido.ok ? 'Use o formato 100.000,00 ou 100000.' : 'Digite o valor para ver o valor a financiar.'}</span>
      </div>
    </HelpDialog>
  )
}

// `tabs` ([{ id, label, note, refresh }], com `tab` e `onTab`): vários assuntos no mesmo quadro, lado a lado no cabeçalho.
export function Panel({ title, note, className = '', refresh, tabs, tab, onTab, semAtualizar = false, children }) {
  const id = useId()
  const tabRefs = useRef([])
  const active = tabs?.find((t) => t.id === tab) ?? tabs?.[0]
  const selectTab = (e, index) => {
    let next
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    else return
    e.preventDefault()
    onTab(tabs[next].id)
    tabRefs.current[next]?.focus()
  }
  return (
    <section className={`desk-panel ${className}`}>
      <header>
        {tabs ? (
          <>
            <h2 className="sr-only">{active.label}</h2>
            <div className="desk-tabs" role="tablist" aria-label={title}>
              {tabs.map((t, i) => [
                t.grupo && t.grupo !== tabs[i - 1]?.grupo ? <span key={`g-${t.grupo}`} className="desk-tabs-grupo" aria-hidden="true">{t.icone && <span className="desk-tabs-icone">{t.icone}</span>}{t.grupo}</span> : null,
                <button key={t.id} ref={el => { tabRefs.current[i] = el }} id={`${id}-tab-${t.id}`} type="button" role="tab" aria-selected={t.id === active.id} aria-controls={`${id}-panel`} tabIndex={t.id === active.id ? 0 : -1} title={t.grupo ? `${t.grupo}: ${t.label}` : undefined} onKeyDown={e => selectTab(e, i)} onClick={() => onTab(t.id)}>{t.label}</button>,
              ])}
            </div>
            {(active.note ?? note) && <small>{active.note ?? note}</small>}
            {(active.refresh ?? refresh) && <RefreshButton files={active.refresh ?? refresh} label={active.label} somenteData={semAtualizar} />}
          </>
        ) : (
          <>
            <h2>{title}</h2>
            {note && <small>{note}</small>}
            {refresh && <RefreshButton files={refresh} label={title} somenteData={semAtualizar} />}
          </>
        )}
      </header>
      <div className="desk-panel-body" {...(tabs ? { id: `${id}-panel`, role: 'tabpanel', 'aria-labelledby': `${id}-tab-${active.id}`, tabIndex: 0 } : {})}>{children}</div>
    </section>
  )
}

const day = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const hour = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export function AgendaList({ goto, limit = 5 }) {
  const events = upcoming(new Date(), 21).slice(0, limit)
  if (!events.length) return <p className="status">Sem eventos nos próximos dias.</p>
  return (
    <ul className="desk-agenda">
      {events.map((e) => (
        <li key={e.kind + e.t}>
          <button type="button" onClick={() => goto('cenarios', 'calendario')}>
            <time dateTime={new Date(e.t).toISOString()}>{day(e.t)} <b>{hour(e.t)}</b></time>
            <span className="tag">{e.kind}</span>
            <span>{e.label}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
