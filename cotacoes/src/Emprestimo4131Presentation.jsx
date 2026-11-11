import { useCallback, useEffect, useRef, useState } from 'react'
import { presentationStep } from './bndesPresentation.js'
import { E4_SLIDES, E4_TITLE, buildE4Slides, captureE4 } from './emprestimo4131Presentation.js'
import './Apresentacao.css'
import './BndesPresentation.css'

const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const usd = (value) => `US$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (value, digits = 2) => `${(Math.abs(value) < 0.5 / 10 ** digits ? 0 : value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
const fx = (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const signed = (value, format) => `${value >= 0 ? '+' : '−'} ${format(Math.abs(value))}`
const day = (value) => (value ? value.split('-').reverse().join('/') : 'Não informada')
const stamp = (value) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

function PresentationIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h18v12H3zM12 16v5m-5 0 5-5 5 5M7 12l3-3 3 2 4-4" /></svg>
}

// Mesmo padrão da apresentação do BNDES: dados congelados, slides escolhidos e navegação por teclado.
export default function Emprestimo4131Presentation({ loan, hedge, labels }) {
  const [snapshot, setSnapshot] = useState(null)
  const close = useCallback(() => setSnapshot(null), [])
  return <>
    <button type="button" className="bnp-launch" disabled={!loan || !hedge} onClick={() => setSnapshot(captureE4({ loan, hedge, labels }))}><PresentationIcon />Apresentar simulação</button>
    {snapshot && <PresentationDialog snapshot={snapshot} onClose={close} />}
  </>
}

function PresentationDialog({ snapshot, onClose }) {
  const dialog = useRef(null), player = useRef(null), fullscreenHost = useRef(null), slide = useRef(null), titleInput = useRef(null)
  const [title, setTitle] = useState(E4_TITLE)
  const [sections, setSections] = useState(E4_SLIDES.map((item) => item.id))
  const [textSize, setTextSize] = useState('normal')
  const [deck, setDeck] = useState(null), [index, setIndex] = useState(0), [fullscreenError, setFullscreenError] = useState('')
  const count = deck?.slides.length ?? 0
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement
    const overflow = document.body.style.overflow
    const host = fullscreenHost
    element.showModal(); document.body.style.overflow = 'hidden'
    window.addEventListener('hashchange', onClose)
    return () => {
      window.removeEventListener('hashchange', onClose)
      if (document.fullscreenElement && document.fullscreenElement === host.current) document.exitFullscreen?.().catch(() => {})
      element.close(); document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [onClose])
  useEffect(() => { if (deck) player.current?.focus(); else titleInput.current?.focus() }, [deck])
  useEffect(() => {
    if (slide.current) { slide.current.scrollTop = 0; slide.current.scrollLeft = 0 }
    if (deck && !dialog.current?.contains(document.activeElement)) player.current?.focus()
  }, [index, deck])
  const fullscreen = async () => {
    setFullscreenError('')
    try {
      if (document.fullscreenElement === player.current) { await document.exitFullscreen(); player.current?.focus() }
      else if (player.current?.requestFullscreen) { fullscreenHost.current = player.current; await player.current.requestFullscreen() }
      else setFullscreenError('Tela cheia não está disponível neste navegador. A apresentação continua nesta janela.')
    } catch { setFullscreenError('O navegador não permitiu tela cheia. A apresentação continua nesta janela.') }
  }
  const configure = async () => {
    if (document.fullscreenElement === player.current) await document.exitFullscreen?.().catch(() => {})
    setDeck(null); setIndex(0); setFullscreenError('')
  }
  const keyDown = (event) => {
    if (event.key === 'Tab') {
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')].filter((element) => element.getClientRects().length)
      const first = focusable[0], last = focusable.at(-1)
      if (first && event.shiftKey && (event.target === first || event.target === player.current)) { event.preventDefault(); last.focus() }
      else if (last && !event.shiftKey && event.target === last) { event.preventDefault(); first.focus() }
      return
    }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return }
    if (['ArrowLeft', 'ArrowRight'].includes(event.key) && event.target.closest('.bnp-table-wrap')) return
    if (!deck || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input, select, textarea, [contenteditable=true]')) return
    if (event.key === ' ' && event.target.closest('button')) return
    const next = presentationStep(index, event.key, count)
    if (next !== index || ['Home', 'End', 'ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' '].includes(event.key)) { event.preventDefault(); setIndex(next) }
  }
  return <dialog ref={dialog} className={`bnp-dialog${deck ? ' bnp-presenting' : ''}`} aria-label={deck ? 'Apresentação do empréstimo externo' : 'Configurar apresentação do empréstimo externo'} onCancel={(event) => { event.preventDefault(); onClose() }} onKeyDown={keyDown}>
    {!deck ? <div className="bnp-settings">
      <header><h2>Apresentar simulação</h2><button type="button" onClick={onClose} aria-label="Fechar configuração">×</button></header>
      <p>Dados congelados em {stamp(snapshot.capturedAt)} (Brasília). Alterações no painel não modificam esta apresentação.</p>
      <label htmlFor="e4p-title">Título<input id="e4p-title" ref={titleInput} value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} /></label>
      <fieldset><legend>Slides incluídos</legend>{E4_SLIDES.map((item) => <label key={item.id}><input type="checkbox" checked={sections.includes(item.id)} disabled={item.required} onChange={(event) => setSections((previous) => (event.target.checked ? [...previous, item.id] : previous.filter((id) => id !== item.id)))} />{item.label}{item.required && ' · obrigatório'}</label>)}</fieldset>
      <details><summary>Ajustes de apresentação</summary><label htmlFor="e4p-size">Tamanho dos textos<select id="e4p-size" value={textSize} onChange={(event) => setTextSize(event.target.value)}><option value="normal">Normal</option><option value="large">Grande</option><option value="xl">Muito grande</option></select></label></details>
      <p className="bnp-limit">{snapshot.notice}</p>
      <button type="button" className="bnp-primary" onClick={() => setDeck(buildE4Slides(snapshot, { title, sections, textSize }))}>Iniciar apresentação</button>
    </div> : <div ref={player} tabIndex={-1} className={`apr-player bnp-player bnp-text-${deck.textSize}`} data-laser-host>
      <div ref={slide} className="apr-slide bnp-slide" aria-live="polite" aria-atomic="true">
        <div className="bnp-slide-top"><span>{deck.title}</span><span>{index + 1} / {count}</span></div>
        <E4Slide kind={deck.slides[index]} snapshot={snapshot} />
        <footer className="bnp-slide-footer"><span>{snapshot.notice}</span><small>Dados congelados em {stamp(snapshot.capturedAt)} (Brasília) · Empréstimo externo direto (Lei 4.131/62)</small></footer>
      </div>
      {fullscreenError && <p className="bnp-fullscreen-status" role="status">{fullscreenError}</p>}
      <div className="apr-barra bnp-controls"><button type="button" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} aria-label="Slide anterior">‹</button><span aria-label={`Slide ${index + 1} de ${count}`}>{index + 1} / {count}</span><button type="button" disabled={index === count - 1} onClick={() => setIndex((value) => Math.min(count - 1, value + 1))} aria-label="Próximo slide">›</button><button type="button" onClick={fullscreen}>Tela cheia</button><button type="button" onClick={configure}>Configurar</button><span className="laser-slot" /><button type="button" onClick={onClose}>Sair da apresentação</button><small>← → navegar · Esc sair</small></div>
    </div>}
  </dialog>
}

function E4Slide({ kind, snapshot }) {
  const { loan, hedge, scenarios, labels } = snapshot
  const facts = (items) => <dl className="bnp-facts">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  if (kind === 'operation') return <><h2>Condições da operação</h2>{facts([['Principal', usd(loan.principal)], ['Taxa contratual', `${pct(loan.rate)} a.a.`], ['Prazo', `${loan.months} meses`], ['Desembolso', day(loan.start)], ['Vencimento', day(loan.end)], ['Juros', labels.freq || '—'], ['Câmbio de entrada', `R$ ${fx(loan.spot)}`], ['IR na fonte', `${pct(loan.irrf, 0)} · ${labels.irPayer || '—'}`], ['Principal', 'No vencimento']])}<p>Juros lineares: principal × taxa × dias corridos ÷ 360.</p></>
  if (kind === 'cost') return <><h2>Custo em dólar</h2>{facts([['Custo all-in', `${pct(loan.allIn)} a.a.`], ['Taxa com o IR por cima', `${pct(loan.grossedRate)} a.a.`], ['Valor líquido recebido', brl(loan.netBrl)], ['Flat na entrada', `${usd(loan.flatUsd)} · ${pct(loan.flat)}`], ['IOF-câmbio na entrada', `${usd(loan.iofUsd)} · ${pct(loan.iofRate)}`], ['IR pago pelo tomador', usd(loan.totals.irrf + loan.flatIrUsd)], ['Fiança ou SBLC', `${usd(loan.totals.guarantee)} · ${pct(loan.guarantee)} a.a.`], ['Flat e fiança pagos a', labels.fees || '—'], ['Total a pagar', usd(loan.totals.usd)]])}<p>Custo all-in: taxa ao ano que iguala o valor líquido aos pagamentos, em dias corridos/365. Prazo médio de {loan.avgTermDays} dias corridos.</p></>
  if (kind === 'results') return <><h2>Três caminhos em reais</h2><p>{usd(loan.principal)} · {loan.months} meses · DI {pct(hedge.di)} a.a. e cupom cambial {pct(hedge.cupom)} a.a. até o vencimento · {labels.curve}</p><p className="bnp-table-hint">Deslize a tabela para ver todos os caminhos.</p><div className="bnp-table-wrap" role="region" tabIndex={0} aria-label="Sem proteção, com swap e com NDF"><table><thead><tr><th scope="col">Indicador</th><th scope="col">Sem proteção</th><th scope="col">Com swap</th><th scope="col">Com NDF</th></tr></thead><tbody>
    <tr><th scope="row">A dívida fica em</th><td>Dólar</td><td>CDI</td><td>Reais, prefixada</td></tr>
    <tr><th scope="row">Spread do swap, sem custos de entrada</th><td>—</td><td>CDI {signed(hedge.swap.runSpread, pct)}</td><td>—</td></tr>
    <tr><th scope="row">Custo total em CDI</th><td>—</td><td>CDI {signed(hedge.swap.spread, pct)} · {pct(hedge.swap.pctCdi, 1)} do CDI</td><td>CDI {signed(hedge.ndf.spread, pct)} hoje</td></tr>
    <tr><th scope="row">Total a pagar em reais</th><td>{brl(scenarios.find((item) => item.fxChange === 0).totalBrl)}</td><td>Segue o CDI</td><td>{brl(hedge.ndf.totalBrl)}</td></tr>
    <tr><th scope="row">Custo em reais ao ano</th><td>{pct(scenarios.find((item) => item.fxChange === 0).cost)} com o dólar parado</td><td>{pct(hedge.swap.pre)}</td><td>{pct(hedge.ndf.pre)}</td></tr>
  </tbody></table></div><p className="bnp-difference">O NDF compensa se o dólar subir mais de <strong>{pct(hedge.ndf.breakeven)} ao ano</strong>. Abaixo disso, ficar sem proteção sai mais barato, com o risco do câmbio.</p></>
  if (kind === 'scenarios') return <><h2>Sem proteção: custo conforme o dólar</h2><div className="bnp-table-wrap" role="region" tabIndex={0} aria-label="Custo sem proteção por cenário de câmbio"><table><thead><tr><th scope="col">Dólar ao ano</th><th scope="col">Câmbio no vencimento</th><th scope="col">Total a pagar</th><th scope="col">Custo em reais ao ano</th></tr></thead><tbody>{scenarios.map((item) => <tr key={item.fxChange}><th scope="row">{item.fxChange === 0 ? 'Parado' : signed(item.fxChange, (value) => pct(value, 0))}</th><td>{fx(item.fxEnd)}</td><td>{brl(item.totalBrl)}</td><td>{pct(item.cost)}</td></tr>)}</tbody></table></div><p>Variação constante do dólar ao ano, do desembolso a cada pagamento. Custo em dias corridos/365.</p></>
  if (kind === 'flow') return <><h2>Pagamentos</h2><div className="bnp-table-wrap" role="region" tabIndex={0} aria-label="Pagamentos do empréstimo"><table><thead><tr><th scope="col">Data</th><th scope="col">Juros</th><th scope="col">IR do tomador</th><th scope="col">Fiança</th><th scope="col">Principal</th><th scope="col">Total em dólar</th><th scope="col">Câmbio a termo</th><th scope="col">Total com NDF</th></tr></thead><tbody>{hedge.flows.slice(0, 8).map((flow) => <tr key={flow.date}><th scope="row">{day(flow.date)}</th><td>{usd(flow.interest)}</td><td>{usd(flow.irrf)}</td><td>{usd(flow.guarantee)}</td><td>{usd(flow.principal)}</td><td>{usd(flow.usd)}</td><td>{fx(flow.ndfRate)}</td><td>{brl(flow.brl)}</td></tr>)}<tr><th scope="row">Total</th><td>{usd(loan.totals.interest)}</td><td>{usd(loan.totals.irrf)}</td><td>{usd(loan.totals.guarantee)}</td><td>{usd(loan.totals.principal)}</td><td>{usd(loan.totals.usd)}</td><td>—</td><td>{brl(hedge.ndf.totalBrl)}</td></tr></tbody></table></div>{hedge.flows.length > 8 && <p>Mostrados os 8 primeiros de {hedge.flows.length} pagamentos; o total considera todos. O PDF traz o cronograma completo.</p>}</>
  return <><h2>Premissas e limites</h2><ul className="bnp-premises">
    <li>Principal no vencimento; juros lineares por dias corridos/360. Datas sem ajuste para dia útil.</li>
    <li>IR na fonte de {pct(loan.irrf, 0)} sobre os juros (RIR/2018, art. 760){loan.grossUp ? ', pago pelo tomador com a base reajustada (art. 786)' : ', suportado pelo credor'}. IOF-câmbio de {pct(loan.iofRate)} na entrada (Decreto 6.306/2007, art. 15-B).</li>
    <li>Câmbio a termo teórico: {labels.curve}. Até o vencimento, DI de {pct(hedge.di)} a.a. e cupom cambial de {pct(hedge.cupom)} a.a. Spread do banco no swap: {pct(hedge.swapSpread)} a.a.; acréscimo no NDF: {pct(hedge.ndfMarkup)}.</li>
    <li>O custo total em CDI inclui flat e IOF da entrada diluídos no prazo. O spread do swap é calculado sobre o principal, sem esses custos, para comparar com a cotação da mesa.</li>
    <li>Fora da conta: IR na fonte e PIS/Cofins sobre ganho do swap ou do NDF, e custo de garantias do derivativo. Flat e fiança: {labels.fees}.</li>
    <li>Simulação indicativa. A cotação da mesa do banco e o contrato prevalecem.</li>
  </ul><p className="bnp-sources">{snapshot.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</p></>
}
