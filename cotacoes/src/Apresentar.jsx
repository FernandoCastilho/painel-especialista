import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './ApresentacaoBase.css'
import './Apresentar.css'
import { setThemeOverride } from './systemTheme.js'
import { fadeIn } from './motion.js'
import { PALCO, alternar, alternarVarios, buscarBlocos, contarPorGrupo, dataCapa, dataHora, escala, guardarMontagem, lerMontagem, mover, passoTecla, validos } from './apresentar.js'
import { BLOCOS, BLOCO_POR_ID, GRUPOS } from './apresentarBlocos.jsx'
import Ajuste from './ApresentarAjuste.jsx'
import { isolarIds } from './apresentarIds.js'

// Apresentar: o usuário marca blocos do painel e cada um vira um slide claro, em formato de apresentação.
// Os slides usam as próprias peças do painel, então os números são os mesmos das outras abas.
// A miniatura da montagem e a tela cheia são o mesmo slide (mesma instância): o que foi digitado ou
// selecionado dentro de um slide continua lá ao entrar e sair da apresentação.

// Uma falha em um bloco fica contida no slide dele; os demais continuam.
class QuadroSeguro extends Component {
  state = { falhou: false }
  static getDerivedStateFromError() { return { falhou: true } }
  render() { return this.state.falhou ? <p className="sl-aviso" role="alert">Não foi possível montar este slide agora. Os outros slides não foram afetados.</p> : this.props.children }
}

function Capa({ cliente, setor, agora }) {
  return (
    <article className="sl sl-capa">
      <div className="sl-capa-texto">
        <p className="sl-capa-chamada">Cenário de mercado{cliente ? ' para' : ''}</p>
        <h2>{cliente || 'Apresentação'}</h2>
        {setor && <p className="sl-capa-setor">{setor}</p>}
      </div>
      <footer className="sl-rodape"><span>{dataCapa(agora)}</span><span>Fontes públicas · conferir antes de decidir</span></footer>
    </article>
  )
}

function Slide({ bloco, ctx, numero, total, cliente, opcoes, onOpcoes, ativo }) {
  const Corpo = bloco.Corpo
  const corpo = useRef(null)
  // Identificadores próprios por slide (ver apresentarIds.js). As calculadoras ficam de fora: o visual delas depende dos identificadores originais.
  useEffect(() => {
    const el = corpo.current
    if (!el || bloco.semAjuste) return
    let quadro = 0
    const aplicar = () => isolarIds(el, `${bloco.id}--`)
    aplicar()
    const mo = new MutationObserver(() => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(aplicar) })
    mo.observe(el, { childList: true, subtree: true })
    return () => { mo.disconnect(); cancelAnimationFrame(quadro) }
  }, [bloco.id, bloco.semAjuste])
  return (
    <article className={`sl sl-g-${bloco.grupo}${bloco.classe ? ` ${bloco.classe}` : ''}`}>
      <header className="sl-topo">
        <p className="sl-secao">{GRUPOS.find((g) => g.id === bloco.grupo)?.label}</p>
        <h2>{bloco.titulo ?? bloco.label}</h2>
      </header>
      <div className="sl-corpo" ref={corpo}>
        <QuadroSeguro>
          <Suspense fallback={<p className="sl-aviso" role="status">Carregando…</p>}>
            {bloco.semAjuste ? <Corpo ctx={ctx} opcoes={opcoes} onOpcoes={onOpcoes} ativo={ativo} /> : <Ajuste min={bloco.zoomMin} max={bloco.zoomMax}><Corpo ctx={ctx} opcoes={opcoes} onOpcoes={onOpcoes} ativo={ativo} /></Ajuste>}
          </Suspense>
        </QuadroSeguro>
      </div>
      <footer className="sl-rodape">
        <span>{bloco.fonte ? `Fonte: ${bloco.fonte}` : 'Fontes públicas'} · montado em {dataHora(ctx.agora)}</span>
        <span>{cliente ? `${cliente} · ` : ''}{numero} / {total}</span>
      </footer>
    </article>
  )
}

// Largura útil de um elemento (para dimensionar as miniaturas) e tamanho da janela (para a tela cheia).
function useLargura() {
  const [el, setEl] = useState(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}
function useJanela() {
  const [t, setT] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setT({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return t
}

const BARRA = 62 // altura reservada à barra de comandos na apresentação

function Palco({ slides, ctx, cliente, setor, opcoes, onOpcoes, onMover, onTirar, atual, onAtual }) {
  const on = atual != null
  const ref = useRef(null)
  const anim = useRef(null)
  const [gradeRef, largura] = useLargura()
  const janela = useJanela()
  const n = slides.length
  const colunas = largura >= 760 ? 2 : 1
  const kMini = escala((largura - 16 * (colunas - 1)) / colunas)
  const kTela = escala(janela.w, janela.h - BARRA)
  const k = on ? kTela : kMini
  const fechar = () => onAtual(null)
  const ultimo = useRef(0) // último slide mostrado: ao sair, o foco volta para a miniatura dele
  if (on) ultimo.current = atual
  const ir = (f) => onAtual((cur) => (cur == null ? cur : Math.max(0, Math.min(n - 1, f(cur)))))

  // Ao abrir: foco no palco, página de trás parada. Ao fechar: sai da tela cheia e devolve o foco.
  useEffect(() => {
    if (!on) return
    const origem = document.activeElement, palco = ref.current
    palco?.focus()
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      // Aberta pela miniatura, o botão de origem saiu da tela durante a apresentação: o foco vai para a miniatura do último slide.
      if (origem && origem !== document.body && origem.isConnected) origem.focus()
      else palco?.querySelectorAll('.apz-abrir')[ultimo.current]?.focus()
    }
  }, [on])
  useLayoutEffect(() => {
    if (!on) return
    anim.current = fadeIn(ref.current?.querySelector('.apz-atual .apz-escala'), anim.current)
  }, [on, atual])
  // Teclado na janela inteira: setas trocam de slide, Esc sai. Dentro de um campo (calculadoras), as teclas são do campo.
  useEffect(() => {
    if (!on) return
    const onKey = (e) => {
      // Com uma janela de detalhe aberta dentro do slide (histórico de um indicador, ajuda), as teclas são dela:
      // Esc fecha só a janela, e o slide não troca por baixo.
      if (document.querySelector('dialog[open]')) return
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return }
      if (e.key === 'Tab') {
        const alvo = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])')].filter((el) => el.getClientRects().length && !el.closest('[inert]'))
        const primeiro = alvo[0], ultimo = alvo.at(-1)
        if (!primeiro) { e.preventDefault(); ref.current.focus(); return }
        const fora = !ref.current.contains(document.activeElement) || document.activeElement === ref.current
        if (e.shiftKey && (document.activeElement === primeiro || fora)) { e.preventDefault(); ultimo.focus() }
        else if (!e.shiftKey && (document.activeElement === ultimo || fora)) { e.preventDefault(); primeiro.focus() }
        return
      }
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input, select, textarea, [contenteditable="true"]')) return
      // Num botão ou link, Enter e espaço acionam o próprio controle; as setas continuam trocando de slide.
      if ([' ', 'Enter'].includes(e.key) && e.target.closest?.('button, a[href], summary')) return
      const proximo = passoTecla(atual, e.key, n)
      if (proximo !== atual) { e.preventDefault(); onAtual(proximo) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on, atual, n]) // eslint-disable-line react-hooks/exhaustive-deps
  // Deslizar troca de slide, exceto quando o gesto começa num gráfico, tabela ou campo.
  const toque = useRef(null)
  const onPointerDown = (e) => { toque.current = !on || document.querySelector('dialog[open]') || e.target.closest?.('svg, table, input, select, textarea, button, a, .plot, .ml') ? null : { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e) => {
    const t = toque.current; toque.current = null
    if (!t) return
    const dx = e.clientX - t.x, dy = e.clientY - t.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir((c) => c + (dx < 0 ? 1 : -1))
  }
  const telaCheia = () => { const el = ref.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {}) }

  return (
    <div className={`apz-palco${on ? ' apz-on apr-player' : ''}`} ref={ref} tabIndex={-1} {...(on ? { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Apresentação', 'data-laser-host': '' } : {})}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { toque.current = null }}>
      <ol className="apz-grade" ref={gradeRef} style={{ '--colunas': colunas }} aria-label={on ? undefined : 'Slides da apresentação, na ordem'}>
        {slides.map((s, i) => {
          const titulo = s.capa ? 'Capa' : s.bloco.titulo ?? s.bloco.label
          const visivel = on && i === atual
          return (
            <li key={s.id} className={`apz-item${visivel ? ' apz-atual' : ''}`} aria-hidden={on && !visivel ? 'true' : undefined}>
              <div className="apz-quadro" style={{ width: PALCO.w * k, height: PALCO.h * k }}>
                <div className="apz-escala" style={{ width: PALCO.w, height: PALCO.h, transform: `scale(${k})` }} {...(visivel ? {} : { inert: '' })}>
                  {s.capa
                    ? <Capa cliente={cliente} setor={setor} agora={ctx.agora} />
                    : <Slide bloco={s.bloco} ctx={ctx} numero={i + 1} total={n} cliente={cliente} opcoes={opcoes[s.id]} onOpcoes={(v) => onOpcoes(s.id, v)} ativo={visivel} />}
                </div>
                {!on && <button type="button" className="apz-abrir" onClick={() => onAtual(i)} aria-label={`Apresentar a partir do slide ${i + 1}: ${titulo}`} />}
              </div>
              {!on && (
                <div className="apz-legenda">
                  <span className="apz-num">{i + 1}</span>
                  <span className="apz-nome">{titulo}</span>
                  {!s.capa && (
                    <span className="apz-ordem">
                      <button type="button" onClick={() => onMover(s.id, -1)} disabled={i <= 1} aria-label={`Subir o slide ${titulo}`} title="Subir na ordem">↑</button>
                      <button type="button" onClick={() => onMover(s.id, 1)} disabled={i === n - 1} aria-label={`Descer o slide ${titulo}`} title="Descer na ordem">↓</button>
                      <button type="button" onClick={() => onTirar(s.id)} aria-label={`Tirar o slide ${titulo}`} title="Tirar da apresentação">×</button>
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {on && (
        <div className="apr-barra apz-barra">
          <button type="button" onClick={() => ir((c) => c - 1)} disabled={atual === 0} aria-label="Slide anterior">‹</button>
          <span className="apr-contador" aria-label={`Slide ${atual + 1} de ${n}`}>{atual + 1} / {n}</span>
          <span className="sr-only" aria-live="polite">{`Slide ${atual + 1} de ${n}: ${slides[atual].capa ? 'Capa' : slides[atual].bloco.titulo ?? slides[atual].bloco.label}`}</span>
          <button type="button" onClick={() => ir((c) => c + 1)} disabled={atual === n - 1} aria-label="Próximo slide">›</button>
          <span className="apr-barra-sep" />
          <button type="button" onClick={telaCheia}>Tela cheia</button>
          <span className="laser-slot" />
          <button type="button" onClick={fechar}>Sair</button>
        </div>
      )}
    </div>
  )
}

function Seletor({ sel, onSel, opcoes, onOpcoes }) {
  const contagem = contarPorGrupo(sel, BLOCOS)
  const [busca, setBusca] = useState('')
  const achados = useMemo(() => buscarBlocos(BLOCOS, busca, (id) => GRUPOS.find((g) => g.id === id)?.label), [busca])
  return (
    <div className="apz-seletor">
      <label className="apz-busca">Buscar um bloco
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: dólar, Focus, serrarias" autoComplete="off" />
      </label>
      {achados && (
        <div className="apz-achados" role="group" aria-label="Blocos encontrados">
          {!achados.length && <p className="apz-ajuste-nota">Nenhum bloco com esse nome. Tente outra palavra ou abra as seções abaixo.</p>}
          {achados.map((b) => (
            <label key={b.id} className="apz-opcao">
              <input type="checkbox" checked={sel.includes(b.id)} onChange={() => onSel(alternar(sel, b.id))} />
              <span>{b.label}<small>{GRUPOS.find((g) => g.id === b.grupo)?.label}{b.sub ? ` · ${b.sub}` : ''}</small></span>
            </label>
          ))}
        </div>
      )}
      {!achados && GRUPOS.map((g) => {
        const todos = BLOCOS.filter((b) => b.grupo === g.id)
        if (!todos.length) return null
        const blocos = todos.filter((b) => !b.oculto) // os ocultos são escolhidos pelo seletor próprio do grupo (g.Extra)
        const subs = [...new Set(blocos.map((b) => b.sub ?? ''))]
        const ids = blocos.map((b) => b.id)
        const marcados = contagem[g.id] ?? 0
        return (
          <details key={g.id} className="apz-grupo" open={g.aberto || undefined}>
            <summary><span className="apz-grupo-nome">{g.label}</span><span className={`apz-grupo-conta${marcados ? ' on' : ''}`}>{marcados ? (g.Extra ? `${marcados}` : `${marcados} de ${blocos.length}`) : g.Extra ? '' : blocos.length}</span></summary>
            {g.nota && <p className="apz-grupo-nota">{g.nota}</p>}
            {g.Extra && <g.Extra sel={sel} onSel={onSel} />}
            {!g.Extra && blocos.length > 1 && <button type="button" className="apz-todos" onClick={() => onSel(alternarVarios(sel, ids))}>{ids.every((id) => sel.includes(id)) ? 'Desmarcar todos' : 'Marcar todos'}</button>}
            {subs.map((sub) => (
              <div key={sub} className="apz-sub" role="group" aria-label={sub || g.label}>
                {sub && <p className="apz-sub-nome">{sub}</p>}
                {blocos.filter((b) => (b.sub ?? '') === sub).map((b) => (
                  <div key={b.id} className="apz-linha">
                    <label className="apz-opcao">
                      <input type="checkbox" checked={sel.includes(b.id)} onChange={() => onSel(alternar(sel, b.id))} />
                      <span>{b.label}{b.dica && <small>{b.dica}</small>}</span>
                    </label>
                    {b.Ajustes && sel.includes(b.id) && <b.Ajustes opcoes={opcoes[b.id]} onOpcoes={(v) => onOpcoes(b.id, v)} />}
                  </div>
                ))}
              </div>
            ))}
          </details>
        )
      })}
    </div>
  )
}

export default function Apresentar({ quotes, macro, curves, hol, colors }) {
  const [m, setM] = useState(() => { const g = lerMontagem(); return { ...g, sel: validos(g.sel, new Set(BLOCOS.map((b) => b.id))) } })
  const [atual, setAtual] = useState(null)
  const [agora] = useState(() => Date.now())
  useEffect(() => { guardarMontagem(m) }, [m])
  // A apresentação é sempre clara: o painel inteiro passa para o tema claro enquanto esta aba está aberta.
  useEffect(() => {
    setThemeOverride('light')
    document.documentElement.dataset.temaFixo = 'claro' // esconde o seletor de tema enquanto ele não tem efeito
    return () => { setThemeOverride(null); delete document.documentElement.dataset.temaFixo }
  }, [])
  const ctx = useMemo(() => ({ quotes, macro, curves, hol, colors, agora }), [quotes, macro, curves, hol, colors, agora])
  const slides = useMemo(() => [{ id: 'capa', capa: true }, ...m.sel.map((id) => ({ id, bloco: BLOCO_POR_ID[id] }))], [m.sel])
  const setSel = (sel) => setM((cur) => ({ ...cur, sel }))
  const setOpcoes = (id, v) => setM((cur) => ({ ...cur, opcoes: { ...cur.opcoes, [id]: v } }))
  const cliente = m.cliente.trim(), setor = m.setor.trim()
  return (
    <div className="apz">
      <header className="apz-topo">
        <div className="apz-campos">
          <label>Cliente <small>(não é gravado; some ao limpar ou recarregar)</small>
            <input type="text" value={m.cliente} maxLength={80} autoComplete="off" onChange={(e) => setM((cur) => ({ ...cur, cliente: e.target.value }))} placeholder="Nome para a capa" />
          </label>
          <label>Setor <small>(opcional)</small>
            <input type="text" value={m.setor} maxLength={80} autoComplete="off" onChange={(e) => setM((cur) => ({ ...cur, setor: e.target.value }))} placeholder="Ex.: Indústria de madeira" />
          </label>
        </div>
        <div className="apz-acoes">
          <span className="apz-total" role="status">{m.sel.length ? `${slides.length} slides` : 'Nenhum bloco marcado'}</span>
          {(m.sel.length > 0 || m.cliente || m.setor) && <button type="button" className="apz-btn" title="Apaga o cliente, o setor e todos os slides" onClick={() => setM({ cliente: '', setor: '', sel: [], opcoes: {} })}>Limpar tudo</button>}
          <button type="button" className="apz-btn apz-btn-primario" disabled={!m.sel.length} onClick={() => setAtual(0)}>Iniciar apresentação</button>
        </div>
      </header>
      <div className="apz-corpo">
        <section className="apz-col-seletor" aria-labelledby="apz-t-seletor">
          <h2 id="apz-t-seletor">O que mostrar</h2>
          <Seletor sel={m.sel} onSel={setSel} opcoes={m.opcoes} onOpcoes={setOpcoes} />
        </section>
        <section className="apz-col-slides" aria-labelledby="apz-t-slides">
          <h2 id="apz-t-slides">Slides <small>· clique em um slide para apresentar a partir dele</small></h2>
          {!m.sel.length && <p className="apz-vazio">Marque ao lado o que quer levar para a visita. Cada item marcado aparece aqui como um slide, na ordem em que foi escolhido.</p>}
          <Palco slides={slides} ctx={ctx} cliente={cliente} setor={setor} opcoes={m.opcoes} onOpcoes={setOpcoes}
            onMover={(id, passo) => setSel(mover(m.sel, id, passo))} onTirar={(id) => setSel(m.sel.filter((x) => x !== id))} atual={atual} onAtual={setAtual} />
        </section>
      </div>
    </div>
  )
}
