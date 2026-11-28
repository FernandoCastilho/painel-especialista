import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TV_CANAIS, TV_EVENTO, TV_TAMANHOS, gravarPreferencia, lerPreferencia, tvDadosUrl, tvFonte } from './tvCanais.js'
import { DATA_BASE } from './useQuotes.js'
import './TvDock.css'

// Telinha de TV ao vivo, aberta pelo botão TV do menu. Continua aberta ao trocar de seção, até a pessoa fechar.
// O vídeo só carrega depois que a pessoa escolhe o canal, e fechar descarrega (não gasta internet escondido).
export default function TvDock() {
  const [aberta, setAberta] = useState(false)
  const [canalId, setCanalId] = useState(null)
  const [pref, setPref] = useState(lerPreferencia)
  const painel = useRef(null), video = useRef(null)

  useEffect(() => {
    const alternar = () => setAberta(a => !a)
    window.addEventListener(TV_EVENTO, alternar)
    return () => window.removeEventListener(TV_EVENTO, alternar)
  }, [])
  useEffect(() => {
    if (aberta) painel.current?.focus()
    else setCanalId(null)
  }, [aberta])

  // Vídeo que o robô da TV achou para cada canal (tv.json). Lido ao abrir e de 10 em 10 min com a TV aberta.
  // undefined: lendo (até 4 s); null: sem dado, e a TV usa o endereço do canal.
  const [dados, setDados] = useState(undefined)
  useEffect(() => {
    const url = tvDadosUrl(DATA_BASE)
    if (!aberta || !url) { setDados(aberta ? null : undefined); return undefined }
    let vivo = true
    const ler = () => fetch(`${url}?t=${Math.floor(Date.now() / 300000)}`, { signal: AbortSignal.timeout?.(4000) })
      .then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => { if (vivo) setDados(d) })
    ler()
    const id = setInterval(ler, 10 * 60 * 1000)
    return () => { vivo = false; clearInterval(id) }
  }, [aberta])

  // Abaixo de 1000 px o menu fica fixo na base e muda de altura com a tela: a TV fica logo acima dele.
  const [base, setBase] = useState(null)
  useLayoutEffect(() => {
    if (!aberta) return undefined
    const medir = () => {
      // Menu de baixo: no celular quem fica preso embaixo é o próprio nav; no tablet, a caixa .nav-top em volta dele.
      const menu = document.querySelector('.nav-top > nav')
      const fixo = menu?.offsetHeight && [menu, menu.parentElement].some(el => getComputedStyle(el).position === 'fixed')
      setBase(fixo ? window.innerHeight - menu.getBoundingClientRect().top + 8 : null)
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [aberta])

  // Arrastar pela barra de cima (mouse ou dedo) ou mover com as setas no puxador. A posição fica salva; Home volta ao canto.
  const [pos, setPos] = useState(() => pref.posicao || null)
  const arraste = useRef(null)
  const limitar = ({ x, y }) => {
    const caixa = painel.current?.getBoundingClientRect()
    if (!caixa) return { x, y }
    const chao = base ? window.innerHeight - base : window.innerHeight
    return {
      x: Math.round(Math.min(Math.max(x, 0), Math.max(0, window.innerWidth - caixa.width))),
      y: Math.round(Math.min(Math.max(y, 0), Math.max(0, chao - caixa.height))),
    }
  }
  // Ao mudar a tela ou o tamanho da TV, ela não pode ficar para fora.
  useLayoutEffect(() => {
    if (!aberta || !pos) return undefined
    const ajustar = () => setPos(p => { const n = limitar(p); return n.x === p.x && n.y === p.y ? p : n })
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [aberta, pref.tamanho, canalId, base, Boolean(pos)]) // eslint-disable-line react-hooks/exhaustive-deps
  const moverPara = nova => { const n = nova && limitar(nova); setPos(n); salvar({ posicao: n }) }
  const comecarArraste = e => {
    if (e.button !== 0 || e.target.closest('button:not(.tv-dock-grip)')) return
    const caixa = painel.current.getBoundingClientRect()
    arraste.current = { dx: e.clientX - caixa.left, dy: e.clientY - caixa.top, x: caixa.left, y: caixa.top }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.preventDefault()
  }
  const arrastar = e => {
    const a = arraste.current
    if (!a) return
    const n = limitar({ x: e.clientX - a.dx, y: e.clientY - a.dy })
    a.x = n.x; a.y = n.y
    setPos(n)
  }
  const soltar = () => {
    const a = arraste.current
    if (!a) return
    arraste.current = null
    salvar({ posicao: { x: a.x, y: a.y } })
  }
  const teclaPuxador = e => {
    const passo = e.shiftKey ? 60 : 20
    const atual = pos || (() => { const c = painel.current.getBoundingClientRect(); return { x: c.left, y: c.top } })()
    const mapa = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }
    if (e.key === 'Home') { e.preventDefault(); moverPara(null) }
    else if (mapa[e.key]) { e.preventDefault(); moverPara({ x: atual.x + mapa[e.key][0], y: atual.y + mapa[e.key][1] }) }
  }

  const salvar = mudanca => setPref(atual => { const nova = { ...atual, ...mudanca }; gravarPreferencia(nova); return nova })
  const escolher = id => { setCanalId(id); salvar({ canal: id }) }
  const fechar = () => {
    setAberta(false)
    ;[...document.querySelectorAll('[data-tv-trigger]')].find(b => b.offsetParent)?.focus()
  }
  if (!aberta) return null

  const canal = TV_CANAIS.find(c => c.id === canalId)
  const fonte = canal && dados !== undefined ? tvFonte(canal, dados) : null
  const comVideo = fonte?.url
  const tamanho = TV_TAMANHOS.find(t => t.id === pref.tamanho)
  return createPortal(
    <section ref={painel} className="tv-dock" role="dialog" aria-label="TV ao vivo" tabIndex={-1}
      style={{ '--tv-largura': `${tamanho.largura}px`, ...(pos ? { left: pos.x, top: pos.y, bottom: 'auto' } : base ? { bottom: base } : {}) }}
      onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); fechar() } }}>
      <header className="tv-dock-bar" onPointerDown={comecarArraste} onPointerMove={arrastar} onPointerUp={soltar} onPointerCancel={soltar}
        onDoubleClick={e => { if (!e.target.closest('button')) moverPara(null) }}>
        <button type="button" className="tv-dock-grip" aria-label="Mover TV: arraste ou use as setas; Home volta ao canto" title="Arraste para mover"
          onKeyDown={teclaPuxador}>⠿</button>
        <span className="tv-dock-title">{comVideo ? <><b className="tv-dock-live">Ao vivo</b> {canal.nome}</> : canal ? canal.nome : 'TV ao vivo'}</span>
        <div className="tv-dock-tools">
          {canal && <div role="group" aria-label="Tamanho da TV">
            {TV_TAMANHOS.map(t => <button key={t.id} type="button" className="tv-dock-size" aria-pressed={t.id === tamanho.id}
              aria-label={`TV ${t.nome.toLowerCase()}`} title={t.nome} onClick={() => salvar({ tamanho: t.id })}>{t.rotulo}</button>)}
          </div>}
          {comVideo && document.fullscreenEnabled && <button type="button" aria-label="Ver em tela cheia" title="Tela cheia"
            onClick={() => video.current?.requestFullscreen?.().catch(() => {})}>⛶</button>}
          <button type="button" aria-label="Fechar TV" title="Fechar" onClick={fechar}>×</button>
        </div>
      </header>
      <div className="tv-dock-channels" role="group" aria-label="Canal">
        {TV_CANAIS.map(c => <button key={c.id} type="button" aria-pressed={c.id === canalId} onClick={() => escolher(c.id)}>
          <b>{c.nome}</b><small>{c.idioma}{!canal && c.id === pref.canal ? ' · último assistido' : ''}</small>
        </button>)}
      </div>
      {canal ? <>
        <div className="tv-dock-screen">
          {comVideo ? <iframe ref={video} key={`${canal.id}-${fonte.url}`} src={fonte.url} title={`${canal.nome} ao vivo no YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" />
            : <p className="tv-dock-aviso" role="status">{!fonte ? 'Procurando a transmissão ao vivo…'
              : fonte.tipo === 'sem-live' ? `A ${canal.nome} não está ao vivo no YouTube agora. Quando começar uma transmissão, ela aparece aqui sozinha.`
                : `A transmissão de agora da ${canal.nome} só pode ser vista no YouTube.`}</p>}
        </div>
        {comVideo && <p className="tv-dock-note">{fonte.tipo === 'video' ? 'Começa sem som: toque no ícone de som do vídeo.'
          : 'Começa sem som: toque no ícone de som do vídeo. Se aparecer “vídeo indisponível”, o canal não liberou a transmissão para fora do YouTube agora.'}</p>}
        <a className="tv-dock-youtube" href={canal.youtube} target="_blank" rel="noopener noreferrer">Abrir {canal.nome} no YouTube</a>
      </> : <p className="tv-dock-note">Escolha o canal para começar. O vídeo só carrega depois da escolha.</p>}
    </section>, document.body)
}
