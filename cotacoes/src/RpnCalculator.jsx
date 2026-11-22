import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createClassicRpnController } from './rpnClassicController.mjs'
import { convertEquivalentRate } from './rpnRateConversion.mjs'
import { classicKeyRows, getClassicKeyState, portraitKeyRows } from './rpnClassicLayout.mjs'
import { rpnKeyFromEvent } from './rpnKeyboard.mjs'
import './RpnCalculator.css'
import RpnHistoryPanel from './RpnHistoryPanel.jsx'
import RpnCetPanel from './RpnCetPanel.jsx'
import { captureReportedRpnResult, createRpnHistoryCapture } from './rpnHistory.mjs'

const registers = [
  ['n', 'n', 'Número de períodos'], ['i', 'i', 'Taxa por período (%)'], ['pv', 'PV', 'Valor presente'],
  ['pmt', 'PMT', 'Pagamento periódico'], ['fv', 'FV', 'Valor futuro'],
]
const mobileLandscape = '(orientation: landscape) and (pointer: coarse) and (min-width: 500px) and (max-height: 520px)'
const fullLandscape = '(orientation: landscape) and (min-width: 500px) and (max-height: 560px)'
const options = [['day', 'Ao dia'], ['month', 'Ao mês'], ['year', 'Ao ano']]
const suffix = { day: 'a.d.', month: 'a.m.', year: 'a.a.' }
const fmt = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 12 })
const show = value => Number.isFinite(value) ? fmt.format(value) : '—'
const engineError = 'Não foi possível usar a calculadora. Abra a seção novamente para reiniciar.'

const numbers = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
const segments = {
  a: 'M5 1H34L38 4L33 8H7L2 4Z', b: 'M35 9L40 5V25L36 29L32 25V12Z',
  c: 'M35 34L40 30V50L36 55L32 50V37Z', d: 'M5 52H34L38 56L33 60H7L2 56Z',
  e: 'M3 34L8 30V50L4 55L0 50V37Z', f: 'M3 9L8 5V25L4 29L0 25V12Z',
  g: 'M5 26H34L38 30L33 34H7L2 30Z',
}
const characterWidth = char => ',.'.includes(char) ? 14 : 44

function LcdValue({ value }) {
  if (!/^[0-9,.+−-]{1,18}$/.test(value)) return <output aria-label="Resultado da calculadora">{value}</output>
  const chars = [...value]
  const width = chars.reduce((total, char) => total + characterWidth(char), 0)
  return <output aria-label="Resultado da calculadora" className="rpn-lcd-value">
    <span className="rpn-sr-only">{value}</span>
    <svg aria-hidden="true" focusable="false" viewBox={`0 0 ${width} 64`} style={{ width: `${width / 64}em` }}>
      {chars.map((char, index) => {
        const x = chars.slice(0, index).reduce((total, digit) => total + characterWidth(digit), 0)
        return <g key={index} transform={`translate(${x} 0)`} fill="currentColor">
          {/[0-9]/.test(char) ? Object.entries(segments).map(([letter,d]) =>
            <path key={letter} d={d} opacity={numbers[Number(char)].includes(letter) ? 1 : .06} />)
            : char === ',' ? <path d="M3 51H10V57L5 63H2L5 57H3Z" />
              : char === '.' ? <rect x="3" y="51" width="7" height="7" rx="1" />
                : <><path d={segments.g} />{char === '+' && <rect x="17" y="15" width="7" height="30" />}</>}
        </g>
      })}
    </svg>
  </output>
}

function KeyGrid({ controller, rows, mode, press, view, failed }) {
  return (
    <div className={`rpn-keypad rpn-keypad--${mode}`} role="group" aria-label="Teclado da calculadora">
      {rows.flatMap((row, rowIndex) => row.map((key, columnIndex) => {
        if (!key) return null
        const state = getClassicKeyState(controller, key, view)
        return <div className="rpn-key-slot" key={key.id}
          style={{ '--key-column': columnIndex + 1, '--key-row': rowIndex + 1 }} data-key={key.id}>
          <span className="rpn-key-alternate rpn-key-alternate--gold" aria-hidden="true">{key.gold}</span>
          <button type="button" className="rpn-key" data-key={key.id}
            aria-label={state.unavailable ? `${state.label}: indisponível` : state.label}
            aria-pressed={state.pressed} disabled={failed || state.disabled || state.unavailable}
            onClick={() => press(key.id)}
            title={state.unavailable ? `${state.label}: indisponível nesta versão` : state.label}>
            {key.id === 'enter'
              ? <span className="rpn-enter" aria-hidden="true">{[...key.label].map((letter, i) => <span key={i}>{letter}</span>)}</span>
              : <span className="rpn-key-primary" aria-hidden="true">{key.label}</span>}
            {key.blue && <span className="rpn-key-alternate rpn-key-alternate--blue" aria-hidden="true">{key.blue}</span>}
          </button>
        </div>
      }))}
    </div>
  )
}

function RatePanel({ id, open, onClose, onUse, canUse }) {
  const [raw, setRaw] = useState('')
  const [from, setFrom] = useState('month')
  const [to, setTo] = useState('year')
  const [basis, setBasis] = useState('')
  const input = useRef(null)
  useEffect(() => { if (open) input.current?.focus() }, [open])
  const needsBasis = from === 'day' || to === 'day'
  const parsed = /^[+−-]?(?:\d+(?:[,.]\d+)?|[,.]\d+)$/.test(raw.trim())
    ? Number(raw.trim().replace('−', '-').replace(',', '.')) : NaN
  const converted = target => Number.isFinite(parsed) && ((from !== 'day' && target !== 'day') || basis)
    ? convertEquivalentRate({ rate: parsed, from, to: target, dayBasis: basis ? Number(basis) : undefined }) : null
  const result = converted(to)
  const equivalences = Number.isFinite(parsed) && parsed > -100
    ? ['month', 'year', 'day'].map(unit => [unit, unit === to ? result : converted(unit)]) : []
  const error = raw.trim() !== '' && !Number.isFinite(parsed) ? 'Digite uma taxa válida, sem separador de milhar.'
    : result && !result.ok ? result.error : ''
  const swap = () => { setFrom(to); setTo(from) }
  return <section id={id} className="rpn-rates" hidden={!open} aria-labelledby={`${id}-heading`}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
    }}>
    <header>
      <div><h2 id={`${id}-heading`}>Converter taxas</h2><p>Taxas efetivas equivalentes</p></div>
      <button type="button" className="rpn-rates-close" aria-label="Fechar conversor" onClick={onClose}>×</button>
    </header>
    <label className="rpn-field">
      <span>Taxa de origem (%)</span>
      <input ref={input} inputMode="decimal" value={raw} onChange={e => setRaw(e.target.value)}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-issue` : undefined} placeholder="Ex.: 1,00" />
    </label>
    <div className="rpn-rates-periods">
      <div className="rpn-field">
        <label htmlFor={`${id}-from`}>De</label>
        <select id={`${id}-from`} value={from} onChange={e => setFrom(e.target.value)}>
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <button type="button" className="rpn-rates-swap" onClick={swap} aria-label="Inverter origem e destino">⇄</button>
      <div className="rpn-field">
        <label htmlFor={`${id}-to`}>Para</label>
        <select id={`${id}-to`} value={to} onChange={e => setTo(e.target.value)}>
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
    </div>
    <label className="rpn-field"><span>Base diária{!needsBasis && " (opcional)"}</span><select value={basis} onChange={e => setBasis(e.target.value)} aria-label="Base diária" aria-describedby={`${id}-basis-hint`}>
      <option value="">Escolha a base</option><option value="365">365 dias corridos/ano</option><option value="252">252 dias úteis/ano</option>
    </select><small id={`${id}-basis-hint`}>Escolha a base para calcular taxas ao dia. Mês médio: base anual dividida por 12.</small></label>
    <div className="rpn-rate-result" aria-live="polite" aria-atomic="true">
      <strong>Taxa equivalente</strong>
      {error ? <p id={`${id}-issue`} className="rpn-rate-error">{error}</p>
        : result?.ok ? <output aria-label="Taxa equivalente">{show(result.value)}% {suffix[to]}</output>
          : <p>{needsBasis && !basis ? 'Escolha a base diária para converter.' : 'Digite a taxa de origem.'}</p>}
    </div>
    {equivalences.length > 0 && <section className="rpn-rate-equivalences" aria-label="Equivalências por período" aria-live="polite" aria-atomic="true">
      <strong>Equivalências por período</strong>
      <dl>{equivalences.map(([unit, value]) => <div key={unit}>
        <dt>{options.find(([key]) => key === unit)[1]}</dt>
        <dd>{value?.ok ? `${show(value.value)}% ${suffix[unit]}`
          : value ? 'Fora da precisão disponível' : 'Escolha a base diária'}</dd>
      </div>)}</dl>
      {basis && <small>Taxa ao dia: base {basis === '252' ? '252 dias úteis' : '365 dias corridos'} por ano.</small>}
      <p>As taxas têm o mesmo efeito acumulado sob juros compostos. “Usar no visor” usa só a taxa escolhida em Para.</p>
    </section>}
    <button type="button" className="rpn-use-rate" disabled={!result?.ok || !canUse} onClick={() => onUse(result.value, { from, to, basis: needsBasis ? basis : null })}>Usar no visor</button>
    <small>Não altera o registro i. O visor usa suas casas decimais configuradas.</small>
  </section>
}

export default function RpnCalculator({ floating = false, onFloat } = {}) {
  const helpId = useId()
  const headingId = useId()
  const ratesId = useId()
  const trigger = useRef(null)
  const helpTrigger = useRef(null)
  const helpPanel = useRef(null)
  const workspace = useRef(null)
  const screenButton = useRef(null)
  const tryingFullscreen = useRef(false)
  const [screenMode, setScreenMode] = useState(null)
  useEffect(() => {
    const element = workspace.current
    const doc = element?.ownerDocument
    if (!doc) return
    const onChange = () => {
      const native = doc.fullscreenElement === element
      setScreenMode(mode => native ? 'native' : mode === 'native' ? null : mode)
    }
    doc.addEventListener('fullscreenchange', onChange)
    return () => doc.removeEventListener('fullscreenchange', onChange)
  }, [])
  useEffect(() => {
    if (floating) workspace.current?.focus({ preventScroll: true })
  }, [floating])
  const toggleScreen = async () => {
    const element = workspace.current
    if (!element || tryingFullscreen.current) return
    const doc = element.ownerDocument
    if (doc.fullscreenElement === element) {
      try { await doc.exitFullscreen() } catch { /* O navegador mantém o controle da saída nativa. */ }
      return
    }
    if (screenMode) { setScreenMode(null); return }
    if (doc.fullscreenEnabled && typeof element.requestFullscreen === 'function') {
      tryingFullscreen.current = true
      try {
        await element.requestFullscreen()
        if (doc.fullscreenElement === element) { setScreenMode('native'); return }
      } catch { /* Em visualizadores sem acesso à tela cheia, amplia dentro da página. */ }
      finally { tryingFullscreen.current = false }
    }
    if (workspace.current === element) {
      setScreenMode('page')
      doc.defaultView?.scrollTo(0, 0)
    }
  }
  const [ratesOpen, setRatesOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const historyId = useId(), historyTrigger = useRef(null), nextHistoryId = useRef(0)
  const [historyAside, setHistoryAside] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(min-width: 1120px) and (min-height: 540px)').matches))
  useEffect(() => {
    const media = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1120px) and (min-height: 540px)')
    if (!media?.addEventListener) return
    const update = event => setHistoryAside(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const [historyOpen, setHistoryOpen] = useState(false)
  const showHistoryAside = historyAside && !floating
  const [history, setHistory] = useState({ entries: [], removed: null })
  const [captureHistory] = useState(() => createRpnHistoryCapture())
  const appendHistory = useCallback(item => {
    if (!item) return
    const row = { ...item, id: String(++nextHistoryId.current) }
    setHistory(s => ({ ...s, entries: [row, ...s.entries] }))
  }, [])
  const closeHistory = () => { setHistoryOpen(false); historyTrigger.current?.focus() }
  const editHistory = edited => setHistory(s => ({ ...s, entries: s.entries.map(e => e.id === edited.id ? edited : e) }))
  const removeHistory = id => setHistory(s => {
    const index = s.entries.findIndex(e => e.id === id)
    return index < 0 ? s : { entries: s.entries.filter(e => e.id !== id), removed: { entry: s.entries[index] } }
  })
  const clearHistory = () => setHistory(s => s.entries.length
    ? { entries: [], removed: { all: s.entries } } : s)
  const undoHistory = () => setHistory(s => {
    if (!s.removed) return s
    if (s.removed.all) return { entries: [...s.entries, ...s.removed.all], removed: null }
    return { entries: [...s.entries, s.removed.entry].sort((a, b) => Number(b.id) - Number(a.id)), removed: null }
  })
  const [mobileCompact, setMobileCompact] = useState(() =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.(mobileLandscape).matches))
  useEffect(() => {
    const viewport = typeof window !== 'undefined' && window.matchMedia?.(mobileLandscape)
    if (!viewport?.addEventListener) return
    const update = event => setMobileCompact(event.matches)
    viewport.addEventListener('change', update)
    return () => viewport.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const viewport = window.matchMedia?.(screenMode ? fullLandscape : mobileLandscape)
    if (floating || !viewport?.addEventListener) return
    let frame = 0
    const onRotate = event => {
      cancelAnimationFrame(frame)
      if (event.matches && !ratesOpen && !helpOpen && !historyOpen) frame = requestAnimationFrame(() => window.scrollTo(0, 0))
    }
    viewport.addEventListener('change', onRotate)
    return () => {
      viewport.removeEventListener('change', onRotate)
      cancelAnimationFrame(frame)
    }
  }, [ratesOpen, helpOpen, historyOpen, screenMode, floating])
  useEffect(() => {
    if (helpOpen && typeof window !== 'undefined' && window.matchMedia?.(screenMode ? fullLandscape : mobileLandscape).matches) helpPanel.current?.focus()
  }, [helpOpen, screenMode])
  const closeHelp = () => { setHelpOpen(false); helpTrigger.current?.focus() }
  const [session] = useState(() => {
    try {
      const controller = createClassicRpnController()
      return { controller, initial: controller.snapshot() }
    } catch {
      return { controller: null, initial: { display: '—', message: engineError } }
    }
  })
  const [view, setView] = useState(session.initial)
  const [failed, setFailed] = useState(!session.controller)
  const controller = session.controller
  useEffect(() => {
    if (!controller?.subscribe) return
    let mounted = true
    const unsubscribe = controller.subscribe(snapshot => {
      if (!mounted) return
      setView(snapshot)
      appendHistory(captureReportedRpnResult(snapshot))
    })
    return () => {
      mounted = false
      try { unsubscribe() } finally { controller.dispose() }
    }
  }, [controller, appendHistory])
  const act = command => {
    if (failed) return
    try {
      const result = command(controller)
      setView(result ?? controller.snapshot())
    } catch {
      setView({ display: '—', message: engineError })
      setFailed(true)
    }
  }
  const press = id => act(c => {
    const before = c.snapshot(), next = c.press(id, { captureResult: true }) ?? c.snapshot()
    appendHistory(captureHistory(id, before, next))
    return next
  })
  const onKeyDown = event => {
    if (event.defaultPrevented || event.target?.closest?.('.rpn-history, .rpn-cet, .rpn-guide')) return
    if (floating && event.key === 'Escape') return
    if (event.key === 'Escape' && screenMode === 'page' && !helpOpen && !ratesOpen && !historyOpen && !event.target?.closest?.('input, select, textarea, [contenteditable="true"]')) {
      event.preventDefault()
      setScreenMode(null)
      screenButton.current?.focus()
      return
    }
    if (failed) return
    const key = rpnKeyFromEvent(event)
    if (!key || (view.indicators?.on === false && key !== 'on') || !controller.isSupported(key)) return
    event.preventDefault()
    press(key)
  }
  const closeRates = () => { setRatesOpen(false); trigger.current?.focus() }
  const shift = view.shift === 'f' || view.shift === 'g' ? view.shift : null
  const powered = view.indicators?.on !== false
  const display = powered ? view.display : ''

  return <section ref={workspace} className="rpn-workspace" data-screen-mode={screenMode || undefined} data-rpn-mobile-compact={mobileCompact || undefined} aria-labelledby={headingId} tabIndex={0} onKeyDown={onKeyDown}>
    <header className="rpn-heading">
      {floating ? <h2 id={headingId} className="rpn-sr-only">Calculadora RPN</h2> : <>
        <span>Calculadora financeira</span>
        <h1 id={headingId}>Calculadora RPN</h1>
        {!screenMode && <button type="button" className="rpn-float-action" onClick={onFloat}>Fixar como janela flutuante</button>}
      </>}
    </header>
    <div className={`rpn-layout${showHistoryAside ? ' rpn-layout--history' : ''}`}>
    <div className={`rpn-desk${ratesOpen ? ' rpn-desk--rates' : ''}`}>
      <div className="rpn-console" data-shift={shift ?? ''}>
        <div className="rpn-bezel">
          <div className="rpn-display">
            <div className="rpn-indicators" aria-label="Indicadores do visor">
              {powered && <><span>{view.indicators?.begin ? 'BEGIN' : 'END'}</span>
                {view.indicators?.program && <span>PRGM</span>}
                {view.indicators?.dmy && <span>D.MY</span>}
                {view.indicators?.compound && <span title="Juros compostos na fração de período">
                  <span aria-hidden="true">C</span>
                  <span className="rpn-sr-only">Juros compostos na fração de período</span>
                </span>}
                {view.indicators?.paused ? <span className="rpn-program-state">PAUSA</span>
                  : view.indicators?.running && <span className="rpn-program-state">EXECUTANDO</span>}
                {shift && <span data-prefix={shift}>{shift}</span>}</>}
              {!powered && <span>DESLIGADA</span>}
            </div>
            <LcdValue value={display} />
          </div>
          <div className="rpn-console-brand" aria-hidden="true"><span>Painel do</span><strong>Especialista</strong></div>
          <div className="rpn-bezel-tools">
            <a className="rpn-landscape-back" href="#resumo" aria-label="Voltar ao Mercado">‹</a>
            <button type="button" className="rpn-rates-trigger" ref={trigger} onClick={() => ratesOpen ? closeRates() : setRatesOpen(true)}
              aria-expanded={ratesOpen} aria-controls={ratesId}>
              <span aria-hidden="true">⇄ </span>Taxas
            </button>
            <button type="button" className="rpn-history-trigger" hidden={showHistoryAside || floating} ref={historyTrigger} aria-label="Histórico de contas"
              aria-expanded={historyOpen} aria-controls={historyId}
              onClick={() => historyOpen ? closeHistory() : setHistoryOpen(true)}>
              <span className="rpn-history-trigger-long" aria-hidden="true">Histórico</span>
              <span className="rpn-history-trigger-short" aria-hidden="true">Hist.</span>
            </button>
            <button type="button" aria-label="Ajuda da calculadora" className="rpn-help-trigger" ref={helpTrigger} aria-expanded={helpOpen}
              aria-controls={helpId} onClick={() => helpOpen ? closeHelp() : setHelpOpen(true)}>?</button>
            {!floating && <button type="button" ref={screenButton} className="rpn-screen-trigger"
              aria-label={screenMode ? 'Sair da tela cheia' : 'Tela cheia'} title={screenMode ? 'Sair da tela cheia' : 'Tela cheia'}
              aria-pressed={!!screenMode} onClick={() => { void toggleScreen() }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={screenMode ? 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5' : 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5'} />
              </svg>
            </button>}
          </div>
        </div>
        <p className="rpn-message" role="status">{view.message || (view.indicators?.paused ? <span className="rpn-sr-only">Programa em pausa.</span> : '')}</p>
        <KeyGrid controller={controller} rows={classicKeyRows} mode="wide" press={press} view={view} failed={failed} />
        <KeyGrid controller={controller} rows={portraitKeyRows} mode="portrait" press={press} view={view} failed={failed} />
        <p className="rpn-legend"><span>Branco: ação direta</span><span><b>f</b>: dourada</span><span><b>g</b>: azul</span></p>
      </div>
      <RatePanel id={ratesId} open={ratesOpen} onClose={closeRates} canUse={!failed && powered && !view.indicators?.program && !view.indicators?.running}
        onUse={(value, units) => { act(c => {
          const old = c.snapshot(), next = c.setDisplay(value) ?? c.snapshot()
          captureHistory('cancel', old, next)
          const item = captureReportedRpnResult({ ...next, resultOperation: 'equivalentRate' })
          const period = { day: 'a.d.', month: 'a.m.', year: 'a.a.' }
          if (item && units) {
            item.label = `Taxa equivalente (${period[units.from]} → ${period[units.to]}${units.basis ? `, base ${units.basis}` : ''})`
            item.text = `${String(item.result).replace('.', ',')}% ${period[units.to]}`
          }
          appendHistory(item)
          return next
        }); closeRates() }} />
    </div>
    {(showHistoryAside || historyOpen || floating) && <div className="rpn-side-tools"><RpnHistoryPanel id={historyId} entries={history.entries} draft={view.tapeInput} hasCleared={Boolean(history.removed?.all)}
      canUndo={Boolean(history.removed)} onEdit={editHistory} onRemove={removeHistory} onUndo={undoHistory}
      onClear={clearHistory} onClose={showHistoryAside || floating ? undefined : closeHistory} /><RpnCetPanel /></div>}
    </div>
    <div hidden={!helpOpen} ref={helpPanel} tabIndex={-1} role="region" className="rpn-help" id={helpId}
      aria-labelledby={helpId + '-heading'} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); closeHelp() }
      }}>
      <h2 id={helpId + '-heading'}>Como usar</h2>
      <button type="button" className="rpn-help-close" onClick={closeHelp}>Fechar ajuda</button>
      <p>Digite o primeiro valor, pressione ENTER, digite o segundo e escolha a operação. Exemplo: 2 ENTER 3 +.</p>
      <p>As teclas f e g selecionam a próxima função dourada ou azul. Teclas indisponíveis são identificadas. A taxa i e os pagamentos devem usar o mesmo período. Entradas são positivas e saídas, negativas.</p>
      <p>Com foco na calculadora: números, vírgula ou ponto, Enter, +, −, * e /. As teclas do conversor não alteram a pilha até você escolher “Usar no visor”.</p>
    </div>
    <details className="rpn-readouts">
      <summary>Pilha, registros e fluxo de caixa</summary>
      <div className="rpn-readout-grid">
        <aside aria-label="Pilha de valores">
          <h2>Pilha</h2>
          <dl>{['X', 'Y', 'Z', 'T'].map((name, index) => <div key={name}><dt>{name}</dt><dd>{index === 0 ? display || '—' : show(view.stack?.[index])}</dd></div>)}</dl>
        </aside>
        <div role="group" aria-label="Registros financeiros">
          <h2>Registros financeiros</h2>
          <dl>{registers.map(([id, name, label]) => <div key={id}><dt title={label}>{name}</dt><dd>{show(view.finance?.[id])}</dd></div>)}</dl>
        </div>
        <div role="group" aria-label="Fluxo de caixa">
          <h2>Fluxo de caixa</h2>
          <p>{view.cashFlows?.length ?? 0} registros</p>
          {!!view.cashFlows?.length && <ol start={0}>{view.cashFlows.map((value, index) => <li key={index}>{show(typeof value === 'number' ? value : value?.value)}</li>)}</ol>}
        </div>
      </div>
    </details>
    <details className="rpn-readouts rpn-guide">
      <summary>Guia rápido da HP 12C</summary>
      <ol>
        <li><strong>Faça uma conta:</strong> digite 200, toque em ENTER, digite 30 e toque em −. O resultado é 170. Não há tecla de igual no modo RPN.</li>
        <li><strong>Leia a pilha:</strong> X é o visor; Y é o valor logo abaixo na pilha. A tecla x↔y troca os dois. Para subtração e divisão, a ordem é Y − X ou Y ÷ X.</li>
        <li><strong>Use as funções financeiras:</strong> n é o número de períodos; i, a taxa por período; PV, o valor presente; PMT, a parcela; FV, o saldo futuro. Use a mesma unidade em n, i e PMT. Na visão de quem toma o crédito, recebido é positivo e pago é negativo.</li>
        <li><strong>Confira a fita:</strong> ela acompanha a digitação e registra as operações. As teclas f e g dão acesso às funções douradas e azuis.</li>
      </ol>
      <p><a href="https://h20331.www2.hp.com/Hpsub/downloads/HP12CRPNstack.pdf" target="_blank" rel="noreferrer">Leia o guia oficial da pilha RPN da HP</a>.</p>
    </details>
  </section>
}
