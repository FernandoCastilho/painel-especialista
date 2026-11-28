import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TV_CANAIS, TV_EVENTO, TV_TAMANHOS, gravarPreferencia, lerPreferencia, tvEmbedUrl } from './tvCanais.js'
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

  const salvar = mudanca => setPref(atual => { const nova = { ...atual, ...mudanca }; gravarPreferencia(nova); return nova })
  const escolher = id => { setCanalId(id); salvar({ canal: id }) }
  const fechar = () => {
    setAberta(false)
    ;[...document.querySelectorAll('[data-tv-trigger]')].find(b => b.offsetParent)?.focus()
  }
  if (!aberta) return null

  const canal = TV_CANAIS.find(c => c.id === canalId)
  const tamanho = TV_TAMANHOS.find(t => t.id === pref.tamanho)
  return createPortal(
    <section ref={painel} className="tv-dock" role="dialog" aria-label="TV ao vivo" tabIndex={-1}
      style={{ '--tv-largura': `${tamanho.largura}px`, ...(base ? { bottom: base } : {}) }}
      onKeyDown={e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); fechar() } }}>
      <header className="tv-dock-bar">
        <span className="tv-dock-title">{canal ? <><b className="tv-dock-live">Ao vivo</b> {canal.nome}</> : 'TV ao vivo'}</span>
        <div className="tv-dock-tools">
          {canal && <div role="group" aria-label="Tamanho da TV">
            {TV_TAMANHOS.map(t => <button key={t.id} type="button" className="tv-dock-size" aria-pressed={t.id === tamanho.id}
              aria-label={`TV ${t.nome.toLowerCase()}`} title={t.nome} onClick={() => salvar({ tamanho: t.id })}>{t.rotulo}</button>)}
          </div>}
          {canal && document.fullscreenEnabled && <button type="button" aria-label="Ver em tela cheia" title="Tela cheia"
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
          <iframe ref={video} key={canal.id} src={tvEmbedUrl(canal)} title={`${canal.nome} ao vivo no YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox" />
        </div>
        <p className="tv-dock-note">Começa sem som: toque no ícone de som do vídeo. Se não abrir, <a href={canal.youtube} target="_blank" rel="noopener noreferrer">assista no YouTube</a>.</p>
      </> : <p className="tv-dock-note">Escolha o canal para começar. O vídeo só carrega depois da escolha.</p>}
    </section>, document.body)
}
