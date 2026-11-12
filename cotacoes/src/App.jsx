import GlobalSearch, { SearchDestination } from './GlobalSearch.jsx'
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dataTimestamp } from './dataTimestamp.js'
import ThemeControl from './ThemeControl.jsx'
import FeedbackMascot from './FeedbackMascot.jsx'
import { connectSystemTheme } from './systemTheme.js'
import { AvisosButton, AvisosProvider } from './Avisos.jsx'
import { marketDate } from './marketReturns.js'
import { quoteHealth } from './dataHealth.js'
const MarketContext = lazy(() => import('./MarketContext.jsx'))
const Outros = lazy(() => import('./Outros.jsx'))
const Calculadora = lazy(() => import('./Calculadora.jsx'))
const RecuperacaoJudicial = lazy(() => import('./RecuperacaoJudicial.jsx'))
const Inadimplencia = lazy(() => import('./Inadimplencia.jsx'))
const Calendario = lazy(() => import('./Calendario.jsx'))
import Expandable from './Expandable.jsx'
import ChartFilters from './ChartFilters.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import { fadeIn } from './motion.js'
import { CURRENCIES, REFRESH_DAILY_MAX, useQuotes } from './useQuotes.js'
import HistoryChart from './HistoryChart.jsx'
const Macro = lazy(() => import('./Macro.jsx'))
const RatesSnapshot = lazy(() => import('./RatesSnapshot.jsx'))
const Curves = lazy(() => import('./Curves.jsx'))
const CdiFuturo = lazy(() => import('./CdiFuturo.jsx'))
import HolidayNotice from './HolidayNotice.jsx'
import AvisoInicial from './AvisoInicial.jsx'
import MarketPopup from './MarketPopup.jsx'
import { usePanorama } from './usePanorama.js'
import { avisoPendente, marcarAvisoVisto } from './avisoInicial.js'
import Recado from './Recado.jsx'
import AlertaVariacao from './AlertaVariacao.jsx'
import { OnlineBadge } from './Acessos.jsx'
import Laser from './Laser.jsx'
const Feriados = lazy(() => import('./Feriados.jsx'))
import { useHolidays } from './useHolidays.js'
const Config = lazy(() => import('./Config.jsx'))
const Aprender = lazy(() => import('./Aprender.jsx'))
const Indexadores = lazy(() => import('./Indexadores.jsx'))
const Bndes = lazy(() => import('./Bndes.jsx'))
const Bancos = lazy(() => import('./Bancos.jsx'))
const Setores = lazy(() => import('./Setores.jsx'))
const Apresentacao = lazy(() => import('./Apresentacao.jsx'))
import { useDataFile } from './useDataFile.js'
import Nav, { TABS } from './Nav.jsx'
import Resumo from './Resumo.jsx'
import TopBar from './TopBar.jsx'
import { Tape } from './TerminalDesk.jsx'
import { rateTiles } from './snapshot.js'
import Clock from './Clock.jsx'
const News = lazy(() => import('./News.jsx'))
import { useMacro } from './useMacro.js'
import { useCurves } from './useCurves.js'
import ParityChart from './ParityChart.jsx'
const Projecoes = lazy(() => import('./Projecoes.jsx'))
import { DISCLAIMER } from './whatsapp.js'
import { MAX_DAYS, fromInput, fullWindow, historyRangeError, toInput } from './useHistory.js'

// Mesma identidade por moeda; os tons acompanham o contraste do tema do sistema.
const POLL_MS = 60000 // relê a coleta central a cada 1 min (o arquivo é renovado a cada 5 min; não gasta a cota da API)
const COLORS = { USD: 'var(--currency-usd)', EUR: 'var(--currency-eur)', JPY: 'var(--currency-jpy)', CNH: 'var(--currency-cnh)', PAR: 'var(--currency-par)' }
// Assuntos da aba Cenários (cada um com seu endereço: #cenarios/commodities etc.).
const CEN_VIEWS = [
  { id: 'projecoes', label: 'Projeções' },
  { id: 'calendario', label: 'Calendário econômico' },
  { id: 'inadimplencia', label: 'Inadimplência' },
  { id: 'recuperacao', label: 'Recuperação judicial' },
  { id: 'atividade', label: 'Atividade e emprego' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'frete', label: 'Frete marítimo' },
  { id: 'indexadores', label: 'Indexadores' },
  { id: 'inflacao', label: 'Inflação' },
  { id: 'fiscal', label: 'Fiscal' },
]
const PRESETS = [
  { id: 'day', label: 'Dia (intraday)', days: 0 },
  { id: '7', label: '7 dias', days: 7 },
  { id: '30', label: '30 dias', days: 30 },
  { id: '90', label: '90 dias', days: 90 },
  { id: '180', label: '6 meses', days: 180 },
  { id: '360', label: '1 ano', days: 360 },
]
const rangeFor = (days) => {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return { start, end }
}

function Period({ range, preset, onPreset, onDates, day, onDay }) {
  const today = toInput(new Date())
  return (
    <div className="period">
      <div className="seg" role="group" aria-label="Período">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => onPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="period-dates">
      {preset === 'day' ? (
        <label>
          Dia
          <input type="date" id="dia" max={today} value={toInput(day)} onChange={(e) => e.target.value && onDay(e.target.value)} />
        </label>
      ) : (
      <DateRangePicker label="Período do gráfico" start={toInput(range.start)} end={toInput(range.end)} max={today} min={toInput(fullWindow().start)} onChange={onDates} />
      )}
      </div>
    </div>
  )
}

// Efeitos visuais opcionais (brilho discreto nas linhas): desligados por padrão; a escolha fica só neste navegador.
const FX_KEY = 'cotacoes-fx'
function useFx() {
  const [fx, setFx] = useState(() => {
    try {
      return localStorage.getItem(FX_KEY) === 'neon' ? 'neon' : 'off'
    } catch {
      return 'off'
    }
  })
  useEffect(() => {
    if (fx === 'neon') document.documentElement.dataset.fx = 'neon'
    else delete document.documentElement.dataset.fx
    try {
      localStorage.setItem(FX_KEY, fx)
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }, [fx])
  return [fx, setFx]
}

// Detalhes de uma moeda (toque no quadro do resumo): o card completo, com compra/venda, máx./mín., PTAX e variações.
function Sheet({ onClose, children }) {
  return <Expandable modal label="detalhes da moeda" onClose={onClose}>{children}</Expandable>
}

export default function App() {
  useEffect(() => connectSystemTheme(), [])
  const { quotes, error, updatedAt, checkedAt, lastSuccessAt, via, refresh, refreshing, limits } = useQuotes(POLL_MS)
  const health = quoteHealth(quotes, { error, checkedAt, lastSuccessAt, collectedAt: updatedAt })
  const macro = useMacro()
  const curves = useCurves()
  const hol = useHolidays()
  const [fx, setFx] = useFx()
  const [update, setUpdate] = useState(false)
  useEffect(() => {
    const on = () => setUpdate(true)
    window.addEventListener('app-update', on)
    return () => window.removeEventListener('app-update', on)
  }, [])
  const [preset, setPreset] = useState('day')
  const [range, setRange] = useState(() => rangeFor(30))
  const [notice, setNotice] = useState('')
  const [day, setDay] = useState(() => fromInput(marketDate(Date.now())))

  const onPreset = (p) => {
    setPreset(p.id)
    if (p.id !== 'day') setRange(rangeFor(p.days))
    setNotice('')
  }
  const onDay = (v) => setDay(fromInput(v))
  const onDates = (a, b) => {
    let start = fromInput(a)
    let end = fromInput(b)
    const error = historyRangeError(start, end)
    if (error) { setNotice(error); return }
    const min = new Date(end)
    min.setDate(min.getDate() - MAX_DAYS)
    if (start < min) {
      start = min
      setNotice(`Período limitado a ${MAX_DAYS} dias.`)
    } else setNotice('')
    setPreset('custom')
    setRange({ start, end })
  }
  // Endereço da tela: #aba ou #aba/assunto (ex.: #cenarios/calendario), que dá para favoritar e enviar.
  const readHash = () => {
    const raw = window.location.hash.replace('#', '')
    const i = raw.indexOf('/')
    const h = i < 0 ? raw : raw.slice(0, i), sub = i < 0 ? '' : raw.slice(i + 1) // o BNDES guarda série e período depois da primeira barra
    return { tab: TABS.some((t) => t.id === h) ? h : 'resumo', sub }
  }
  const [mascotSearch, setMascotSearch] = useState(null)
  const [searchSelection, setSearchSelection] = useState(null)
  const [tab, setTab] = useState(() => readHash().tab)
  const [sub, setSub] = useState(() => readHash().sub)
  useEffect(() => {
    const onHash = () => {
      const h = readHash()
      setTab(h.tab)
      setSub(h.sub)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])
  const [open, setOpen] = useState(null) // código da moeda (ou 'PAR') com o detalhe aberto
  // Aviso de entrada: sozinho, só na primeira vez neste aparelho ou quando o texto mudar; navegador automatizado (smokes) não o recebe.
  const [avisoAberto, setAvisoAberto] = useState(() => !navigator.webdriver && avisoPendente())
  const fecharAviso = () => { marcarAvisoVisto(); setAvisoAberto(false) }
  const panorama = usePanorama()
  const cenView = sub === 'outros' ? 'inflacao' : CEN_VIEWS.some((v) => v.id === sub) ? sub : 'projecoes' // #cenarios/outros (endereço antigo) abre Inflação
  const goto = (id, to = '', replace = false) => {
    setTab(id)
    setSub(to)
    try {
      const hash = `#${id}${to ? `/${to}` : ''}`
      if (window.location.hash !== hash) window.history[replace ? 'replaceState' : 'pushState'](null, '', hash)
    } catch {
      /* sem histórico (ex.: arquivo local) */
    }
    if (!(id === 'bndes' && tab === 'bndes')) window.scrollTo({ top: 0 }) // escolher série e período na aba BNDES não leva ao topo
  }
  useEffect(() => { // endereço antigo (#cenarios/outros) vira o novo, sem nova entrada no histórico
    if (tab !== 'cenarios' || sub !== 'outros') return
    setSub('inflacao')
    try { window.history.replaceState(null, '', '#cenarios/inflacao') } catch { /* sem histórico */ }
  }, [tab, sub])
  // Troca de tela preservada da atualização publicada em paralelo.
  const viewKey = ['cenarios', 'setores', 'calculadora', 'aprender'].includes(tab) ? `${tab}/${tab !== 'cenarios' ? sub.split('/')[0] : cenView}` : tab
  const mainRef = useRef(null)
  const viewAnim = useRef(null)
  useLayoutEffect(() => { viewAnim.current = fadeIn(mainRef.current, viewAnim.current) }, [viewKey])
  const openCurrency = CURRENCIES.find((c) => c.code === open)
  const wait = limits.wait > 0 ? ` (${limits.wait}s)` : ''
  const quoteRefresh = { run: refresh, busy: refreshing, disabled: refreshing || limits.wait > 0 || limits.left <= 0, title: limits.left <= 0 ? 'Limite diário de atualizações manuais atingido neste navegador' : `Consulta a cotação agora, direto na fonte. Limite: 1 por minuto e ${REFRESH_DAILY_MAX} por dia (restam ${limits.left}).${wait}` }
  const rates = rateTiles(macro.data, curves.data)
  const oil = useDataFile('oil.json')
  const feed = health.feed
  const feedAt = health.observedAt ? new Date(health.observedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : null
  const quoteStatus = (
    <p className="status src">
          <span className={`dot ${feed}`} aria-label={health.detail} />
          {error
            ? `Falha ao atualizar as cotações de câmbio (${error}). Tentando novamente…`
            : `Câmbio — ${health.label}`}
          {health.observedAt && <> · Referência mais antiga: {dataTimestamp(health.observedAt)}</>}
          {health.checkedAt && <> · Conferido no painel: {dataTimestamp(health.checkedAt)}</>}
            <button
              type="button"
              className="refresh-mini"
              style={{ background: "none", border: "none", padding: 10, minWidth: 44, minHeight: 44, marginLeft: 6, verticalAlign: "middle", cursor: "pointer", color: "inherit" }}
              onClick={refresh}
              disabled={refreshing || limits.wait > 0 || limits.left <= 0}
              aria-label={`Atualizar cotações agora${wait}`}
              title={limits.left <= 0 ? 'Limite diário de atualizações manuais atingido neste navegador' : `Atualizar agora. Limite: 1 por minuto e ${REFRESH_DAILY_MAX} por dia (restam ${limits.left}).`}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? 'spin' : ''} aria-hidden="true">
                <path d="M20 11a8 8 0 00-14.5-4.6M4 4v4h4" />
                <path d="M4 13a8 8 0 0014.5 4.6M20 20v-4h-4" />
              </svg>
            </button>
        </p>
  )
  return (
    <AvisosProvider general={<>
        <p><strong>Aviso:</strong> Conteúdo meramente informativo e ilustrativo, baseado em fontes públicas. As simulações são hipotéticas e não constituem recomendação, oferta ou garantia de resultado. Os dados podem apresentar defasagens ou imprecisões e devem ser conferidos nas fontes oficiais antes de qualquer decisão. O uso é de responsabilidade do usuário, observadas as responsabilidades previstas na legislação aplicável.</p>
        <p>Yuan: CNH (offshore), por cruzamento USD/BRL ÷ USD/CNH. Origem, API e frequência de cada dado: Configurações › Base de dados.</p>
        <p><i>{DISCLAIMER}</i></p>
        <p><button type="button" className="linklike aviso-rever" aria-haspopup="dialog" onClick={() => setAvisoAberto(true)}>Ver o aviso de entrada</button></p>
      </>}>
    <a className="skip-link" href="#conteudo" onClick={(e) => { e.preventDefault(); mainRef.current?.focus() }}>Pular para o conteúdo</a>
    <AvisoInicial open={avisoAberto} onClose={fecharAviso} />
    <MarketPopup open={panorama.aberto} slot={panorama.momento} onClose={panorama.fechar} quotes={quotes} curves={curves.data} oil={oil.data} />
    <Recado />
    <Laser />
    <GlobalSearch request={mascotSearch} onNavigate={(doc, query) => { const [id,...rest]=doc.route.split('/'); goto(id,rest.join('/')); setSearchSelection({doc,query}) }} />
    <header className="term-head">
      <TopBar tab={tab} onTab={(id) => goto(id)} feed={feed} feedAt={feedAt} feedLabel={health.label} feedTitle={health.observedAt ? health.label + ' · Referência mais antiga: ' + dataTimestamp(health.observedAt) : health.detail} />
      <Tape quotes={quotes} rates={rates} oil={oil.data} />
    </header>
    <div className="nav-top"><Nav tab={tab} onTab={(id) => goto(id)} /></div>
    {tab === 'resumo' && (
      <div className="clocks-top">
        <Clock codes={['BRL', 'USD', 'GBP', 'JPY', 'CNH']} />
        <OnlineBadge /><AvisosButton className="clocks-info" /><span className="laser-slot laser-slot-m" /><ThemeControl className="theme-mobile" />
      </div>
    )}
    <main id="conteudo" tabIndex={-1} className={`app${tab === 'calculadora' ? ' app-calculators' : ''}`} ref={mainRef}>
      {['resumo', 'calculadora', 'noticias'].includes(tab) && <h1 className="sr-only">{TABS.find((t) => t.id === tab)?.label}</h1>}

      <Suspense fallback={<p className="status" role="status">Carregando seção…</p>}>
      {update && (
        <div className="update-notice" role="status">
          Nova versão disponível.{' '}
          <button type="button" onClick={() => window.location.reload()}>Recarregar</button>
        </div>
      )}
      <AlertaVariacao quotes={quotes} />
      <SearchDestination selection={searchSelection?.doc.route === `${tab}${sub ? '/' + sub : ''}` ? searchSelection : null} onClose={() => setSearchSelection(null)} />
      {tab !== 'resumo' && (
        <header className={`top${['calculadora', 'noticias', 'feriados'].includes(tab) ? ' top-min' : ''}`}>
          {!['calculadora', 'noticias', 'feriados'].includes(tab) && <h1>{tab === 'setores' ? 'Central de setores' : TABS.find((t) => t.id === tab).label}</h1>}
          <AvisosButton className="clocks-info" /><span className="laser-slot laser-slot-m" /><ThemeControl className="theme-mobile" />
        </header>
      )}

      {tab === 'resumo' && (
        <>
          <HolidayNotice hol={hol} pracas={['BR', 'NY', 'CN', 'JP']} expanded />
          <Resumo searchTarget={searchSelection?.doc} quotes={quotes} macro={macro} curves={curves} ptax={macro.data?.ptax} onOpen={(code, selection) => { if (selection) { setPreset(selection.intraday ? 'day' : ({ week: '7', month: '30', year: 'custom' })[selection.id] || selection.id); if (selection.range) setRange(selection.range); else if (!selection.intraday) setRange(rangeFor(selection.days)); else setDay(selection.day ? fromInput(selection.day) : fromInput(marketDate(Date.now()))); setNotice('') } setOpen(code) }} goto={goto} colors={COLORS} status={quoteStatus} quoteRefresh={quoteRefresh} panorama={panorama} />

        </>
      )}

      {tab === 'juros' && (
        <>
          <section aria-labelledby="juros-brasil">
            <h2 id="juros-brasil">Brasil</h2>
            <RatesSnapshot macro={macro} region="brasil" />
            <Macro macro={macro} region="brasil" />
            <CdiFuturo curves={curves} macro={macro.data} hol={hol} />
            <Curves curves={curves} region="brasil" />
          </section>
          <section aria-labelledby="juros-exterior">
            <h2 id="juros-exterior">Outros países</h2>
            <RatesSnapshot macro={macro} region="exterior" />
            <Macro macro={macro} region="exterior" />
            <Curves curves={curves} region="exterior" />
          </section>
        </>
      )}

      {tab === 'cenarios' && (
        <>
          <nav className="learn-nav cen-nav" aria-label="Assuntos de Cenários">
            {CEN_VIEWS.map((v) => (
              <button key={v.id} type="button" className={cenView === v.id ? 'on' : ''} aria-current={cenView === v.id ? 'true' : undefined} onClick={() => goto('cenarios', v.id)}>{v.label}</button>
            ))}
          </nav>
          {cenView === 'projecoes' ? <Projecoes macro={macro} searchTarget={searchSelection?.doc} /> : cenView === 'inflacao' || cenView === 'fiscal' ? <Outros macro={macro} part={cenView} /> : cenView === 'indexadores' ? <Indexadores onBndes={() => goto('bndes', 'tlp/TLP')} /> : cenView === 'calendario' ? <Calendario /> : cenView === 'inadimplencia' ? <Inadimplencia searchTarget={searchSelection?.doc} /> : cenView === 'recuperacao' ? <RecuperacaoJudicial onSources={() => goto('config')} /> : <MarketContext part={cenView} />}
        </>
      )}

      {tab === 'bndes' && <Bndes view={sub} onView={(v, replace) => goto('bndes', v, replace)} />}

      {tab === 'bancos' && <Bancos />}
      {tab === 'setores' && <Setores goto={goto} view={sub} onView={(v) => goto('setores', v)} quotes={quotes} />}

      {tab === 'calculadora' && <Calculadora view={sub} onView={(v) => goto('calculadora', v)} />}

      {tab === 'feriados' && <Feriados hol={hol} />}

      {tab === 'noticias' && (
        <>
          <News colors={COLORS} />
          <p className="noticias-agenda">Agenda da semana (Copom, IPCA, payroll…) em <button type="button" className="linklike" onClick={() => goto('cenarios', 'calendario')}>Cenários › Calendário econômico</button>.</p>
        </>
      )}

      {tab === 'aprender' && <Aprender view={sub} goto={goto} />}

      {tab === 'apresentar' && <Apresentacao quotes={quotes} macro={macro} />}

      {tab === 'config' && <Config quotesAt={updatedAt} quotesVia={via} quotes={quotes} quotesHealth={health} fx={fx} setFx={setFx} />}

      {open && (
        <Sheet onClose={() => setOpen(null)}>
          <ChartFilters><Period range={range} preset={preset} onPreset={onPreset} onDates={onDates} day={day} onDay={onDay} /></ChartFilters>
          {notice && <p role="status">{notice}</p>}
          {open === 'PAR' ? (
            <ParityChart color={COLORS.PAR} start={range.start} end={range.end} day={preset === 'day' ? day : null} />
          ) : (
            openCurrency && (
              <HistoryChart onDay={onDay} key={openCurrency.code} currency={openCurrency} color={COLORS[openCurrency.code]} start={range.start} end={range.end} day={preset === 'day' ? day : null} />
            )
          )}
        </Sheet>
      )}
      </Suspense>
    </main>
    <FeedbackMascot onSearch={setMascotSearch} />
    </AvisosProvider>
  )
}
