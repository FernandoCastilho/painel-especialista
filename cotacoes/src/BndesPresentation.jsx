import { useCallback, useEffect, useRef, useState } from 'react'
import { BNDES_SLIDES, buildBndesSlides, captureBndesPresentation, presentationStep } from './bndesPresentation.js'
import './Apresentacao.css'
import './BndesPresentation.css'

const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = value => `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
const day = value => value ? value.split('-').reverse().join('/') : 'Não informada'
const stamp = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

function PresentationIcon() {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h18v12H3zM12 16v5m-5 0 5-5 5 5M7 12l3-3 3 2 4-4" /></svg>
}

export default function BndesPresentation({ result, comparison, conditions }) {
  const [snapshot, setSnapshot] = useState(null)
  const close = useCallback(() => setSnapshot(null), [])
  return <>
    <button type="button" className="bnp-launch" disabled={!result} onClick={() => setSnapshot(captureBndesPresentation({ result, comparison, conditions }))}><PresentationIcon />Apresentar simulação</button>
    {snapshot && <PresentationDialog snapshot={snapshot} onClose={close} />}
  </>
}

function PresentationDialog({ snapshot, onClose }) {
  const dialog = useRef(null), player = useRef(null), fullscreenHost = useRef(null), slide = useRef(null), titleInput = useRef(null)
  const [title, setTitle] = useState('BNDES · Finame Materiais')
  const [mode, setMode] = useState(snapshot.alternatives.length === 2 ? 'compare' : 'simple')
  const [sections, setSections] = useState(BNDES_SLIDES.map(item => item.id))
  const [textSize, setTextSize] = useState('normal')
  const [deck, setDeck] = useState(null), [index, setIndex] = useState(0), [fullscreenError, setFullscreenError] = useState('')
  const count = deck?.slides.length ?? 0
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement
    const overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    window.addEventListener('hashchange', onClose)
    return () => {
      window.removeEventListener('hashchange', onClose)
      if (document.fullscreenElement && document.fullscreenElement === fullscreenHost.current) document.exitFullscreen?.().catch(() => {})
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
  const keyDown = event => {
    if (event.key === 'Tab') {
      const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')].filter(element => element.getClientRects().length)
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
  const choices = deck?.mode === 'compare' ? snapshot.alternatives : [{ custo: snapshot.conditions.custo, quote: snapshot.conditions.quote, rate: snapshot.conditions.rate, result: snapshot.result }]
  return <dialog ref={dialog} className={`bnp-dialog${deck ? ' bnp-presenting' : ''}`} aria-label={deck ? 'Apresentação BNDES' : 'Configurar apresentação BNDES'} onCancel={event => { event.preventDefault(); onClose() }} onKeyDown={keyDown}>
    {!deck ? <div className="bnp-settings">
      <header><h2>Apresentar simulação</h2><button type="button" onClick={onClose} aria-label="Fechar configuração">×</button></header>
      <p>Dados congelados em {stamp(snapshot.capturedAt)} (Brasília). Alterações no painel não modificam esta apresentação.</p>
      <label htmlFor="bnp-title">Título<input id="bnp-title" ref={titleInput} value={title} maxLength={100} onChange={event => setTitle(event.target.value)} /></label>
      <fieldset><legend>Slides incluídos</legend>{BNDES_SLIDES.map(item => <label key={item.id}><input type="checkbox" checked={sections.includes(item.id)} disabled={item.required} onChange={event => setSections(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id))} />{item.label}{item.required && ' · obrigatório'}</label>)}</fieldset>
      <details><summary>Ajustes de apresentação</summary><label htmlFor="bnp-mode">Conteúdo<select id="bnp-mode" value={mode} onChange={event => setMode(event.target.value)}><option value="simple">Somente a alternativa selecionada</option><option value="compare" disabled={snapshot.alternatives.length !== 2}>Comparar TFC e TFB</option></select></label>{snapshot.alternatives.length !== 2 && <p>Para apresentar as duas alternativas, primeiro gere uma comparação válida na calculadora.</p>}<label htmlFor="bnp-size">Tamanho dos textos<select id="bnp-size" value={textSize} onChange={event => setTextSize(event.target.value)}><option value="normal">Normal</option><option value="large">Grande</option><option value="xl">Extra grande</option></select></label></details>
      <p className="bnp-limit">{snapshot.notice}</p>
      <button type="button" className="bnp-primary" onClick={() => setDeck(buildBndesSlides(snapshot, { title, mode, sections, textSize }))}>Iniciar apresentação</button>
    </div> : <div ref={player} tabIndex={-1} className={`apr-player bnp-player bnp-text-${deck.textSize}`} data-laser-host>
      <div ref={slide} className="apr-slide bnp-slide" aria-live="polite" aria-atomic="true">
        <div className="bnp-slide-top"><span>{deck.title}</span><span>{index + 1} / {count}</span></div>
        <BndesSlide kind={deck.slides[index]} snapshot={snapshot} choices={choices} mode={deck.mode} />
        <footer className="bnp-slide-footer"><span>{snapshot.notice}</span>{snapshot.conditions.retained && <strong>Referência retida ou atualização indisponível. Confira as datas antes de cotar.</strong>}<small>Dados congelados em {stamp(snapshot.capturedAt)} (Brasília) · Finame Materiais Industrializados</small></footer>
      </div>
      {fullscreenError && <p className="bnp-fullscreen-status" role="status">{fullscreenError}</p>}
      <div className="apr-barra bnp-controls"><button type="button" disabled={index === 0} onClick={() => setIndex(value => Math.max(0, value - 1))} aria-label="Slide anterior">‹</button><span aria-label={`Slide ${index + 1} de ${count}`}>{index + 1} / {count}</span><button type="button" disabled={index === count - 1} onClick={() => setIndex(value => Math.min(count - 1, value + 1))} aria-label="Próximo slide">›</button><button type="button" onClick={fullscreen}>Tela cheia</button><button type="button" onClick={configure}>Configurar</button><span className="laser-slot" /><button type="button" onClick={onClose}>Sair da apresentação</button><small>← → navegar · Esc sair</small></div>
    </div>}
  </dialog>
}

function BndesSlide({ kind, snapshot, choices, mode }) {
  const c = snapshot.conditions
  if (kind === 'operation') return <><h2>Condições da operação</h2><dl className="bnp-facts">{[['Valor financiado', money(snapshot.result.financiado)], ['Prazo total', `${c.prazo} meses`], ['Carência incluída no prazo', `${c.carencia} meses`], ['Amortização', c.sistema.toUpperCase()], ['Enquadramento', c.porte], ['Juros na carência', c.periodicidade]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>Há cobranças de juros durante a carência, conforme a periodicidade informada.</p></>
  if (kind === 'rates') return <><h2>Condições e referências</h2><div className="bnp-alternatives">{choices.map(item => <article key={item.custo}><h3>{item.custo.toUpperCase()}</h3><dl><div><dt>Custo financeiro{item.rate.manual && ' · taxa manual'}</dt><dd>{percent(item.rate.value)}</dd></div><div><dt>Remuneração BNDES</dt><dd>{percent(c.taxaBndes)}</dd></div><div><dt>Remuneração do agente</dt><dd>{percent(c.taxaAgente)}</dd></div><div><dt>Taxa final</dt><dd>{percent(item.result.taxa)}</dd></div></dl><p>{item.quote ? <>Cotação do painel: {percent(item.quote.valor)} · série {item.quote.codigo} · referência {day(item.quote.data)}.</> : 'Cotação do painel indisponível.'}{item.rate.manual && ' Taxa manual adotada somente nesta simulação.'}</p></article>)}</div><p>Composição capitalizada: os fatores das três taxas são multiplicados. Liberação em até 90 dias para TFC e TFB. Condições sujeitas à confirmação na contratação.</p></>
  if (kind === 'results') return <><h2>{mode === 'compare' ? 'TFC e TFB lado a lado' : `Resultado estimado · ${c.custo.toUpperCase()}`}</h2><p>{money(snapshot.result.financiado)} financiados · {c.prazo} meses, incluindo {c.carencia} de carência · {c.sistema.toUpperCase()}.</p><p className="bnp-table-hint">Deslize a tabela para ver todas as alternativas.</p><div className="bnp-table-wrap" role="region" tabIndex={0} aria-label="Resultados da simulação BNDES"><table><thead><tr><th scope="col">Indicador</th>{choices.map(item => <th scope="col" key={item.custo}>{item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{[['Taxa final', 'taxa'], ['CET estimado', 'cet'], ['Primeira parcela após a carência', 'primeiraParcela'], ['Juros totais', 'juros'], ['IOF', 'iof'], ['TAC', 'tac'], ...(choices.some(item => item.result.fgi) ? [['ECG do FGI', 'ecg']] : []), ['Total projetado', 'total']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{choices.map(item => <td key={item.custo}>{key === 'cet' ? (item.result.cet ? `${percent(item.result.cet.anual)} a.a.` : 'Não mensurável') : key === 'taxa' ? percent(item.result[key]) : key === 'ecg' ? money(item.result.fgi?.ecg ?? 0) : money(item.result[key] ?? 0)}</td>)}</tr>)}</tbody></table></div>{mode === 'compare' && <p className="bnp-difference">{Math.abs(snapshot.difference) < .005 ? 'Os totais projetados são iguais.' : <>O total em TFB é <strong>{money(Math.abs(snapshot.difference))}</strong> {snapshot.difference > 0 ? 'maior' : 'menor'} que em TFC.</>} Mesmas condições da operação; diferença estimada.</p>}<p>A primeira parcela após a carência não inclui as cobranças anteriores de juros.{choices.some(item => item.rate.manual) && ' Esta simulação usa taxa manual; consulte Condições e referências.'}</p></>
  if (kind === 'flow') return <><h2>Fluxo ilustrativo</h2><BalanceChart choices={choices} prazo={c.prazo} /><div className="bnp-alternatives">{choices.map(item => <article key={item.custo}><h3>{item.custo.toUpperCase()}</h3><p>Juros na carência: <strong>{money(item.result.jurosCarencia)}</strong></p><p>{item.result.parcelasAmortizacao} parcelas de amortização · primeira {money(item.result.primeiraParcela)} · última {money(item.result.ultimaParcela)}</p></article>)}</div><p>Vencimentos no dia 15 ou próximo dia útil, com juros pelos dias corridos. O gráfico mostra o saldo após as cobranças.</p></>
  return <><h2>Premissas e limites</h2><ul className="bnp-premises"><li>Produto: Finame Materiais Industrializados. As condições não se aplicam automaticamente a outras linhas BNDES.</li><li>Premissa de recursos FINAME elegíveis e IOF zero (art. 8º, IX). Confirme o enquadramento com a instituição na contratação.</li><li>SAC, composição capitalizada e liberação em até 90 dias. ECG do FGI, quando informado, pago à vista e sem juros sobre o encargo.</li><li>Referências: {choices.map(item => `${item.custo.toUpperCase()} · ${item.quote?.codigo || 'cotação indisponível'} · ${day(item.quote?.data)}${item.rate.manual ? ' · taxa manual adotada' : ''}`).join('; ')}.</li><li>Taxas mantidas constantes nesta projeção. Vencimentos no dia 15 ou próximo dia útil (feriados nacionais) e juros pelos dias corridos de cada período, sobre os dias do ano civil.</li><li>CET estimado pela Resolução CMN 4.881/2020, em dias corridos/365, com IOF, TAC e ECG à vista descontados na liberação. O CET do contrato prevalece.</li><li>A contratação depende da confirmação das condições, da elegibilidade e da proposta da instituição financeira.</li>{snapshot.result.avisos.map(warning => <li key={warning}>{warning}</li>)}</ul><section className="bnp-references"><p>Fontes: referências BNDES já carregadas no painel. Regras conferidas em {day(c.rulesDate)}. A apresentação não atualiza taxas nem substitui a proposta contratual.</p><div className="bnp-sources">{snapshot.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</div></section></>
}

function BalanceChart({ choices, prazo }) {
  const max = Math.max(...choices.map(item => item.result.financiado))
  return <figure className="bnp-chart"><figcaption>Saldo devedor projetado · {choices.map(item => item.custo.toUpperCase()).join(' / ')}</figcaption><p>Prazo total: {prazo} meses · saldo final projetado: {money(choices[0].result.parcelas.at(-1).saldo)}.</p><svg viewBox="0 0 960 260" role="img" aria-label="Saldo projetado durante a carência e a amortização. Valores das primeiras e últimas parcelas apresentados abaixo."><path d="M70 20V220H920" fill="none" stroke="#949bad" /><text x="70" y="15">{money(max)}</text><text x="70" y="245">Liberação</text><text x="920" y="245" textAnchor="end">{prazo} meses · saldo zero</text>{choices.map((item, i) => <polyline key={item.custo} points={[{ mes: 0, saldo: item.result.financiado }, ...item.result.parcelas].map(row => `${70 + row.mes / prazo * 850},${220 - row.saldo / max * 190}`).join(' ')} fill="none" stroke={i === 0 ? '#0131ff' : '#b44500'} strokeWidth="4" strokeDasharray={i === 0 ? undefined : '10 6'}><title>{item.custo.toUpperCase()}</title></polyline>)}</svg><div className="bnp-chart-legend">{choices.map((item, i) => <span key={item.custo}>{i === 0 ? 'Linha contínua' : 'Linha tracejada'}: {item.custo.toUpperCase()}</span>)}</div></figure>
}
