import { createLatestRequest } from './latestRequest.js'
import { recentNews, newsCollectionStale } from './newsWindow.js'
import { useNewsClock } from './useNewsClock.js'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './Apresentacao.css'
import { Panel } from './TerminalDesk.jsx'
import Estado from './Estado.jsx'
import Sparkline from './Sparkline.jsx'
import { useDataFile } from './useDataFile.js'
import { parseEcbSeries, useCentralDaily } from './useHistory.js'
import { normalizeTemas } from './reforma.js'
import { cascade, fadeIn } from './motion.js'
import { Plot, useWidth } from './HistoryChart.jsx'
import MultiLinhas from './MultiLinhas.jsx'
import { nf } from './format.js'
import { DOMINIO, GRUPOS_SETORES, ITENS, PERIODOS, SETORES_APRESENTACAO, buscarCapa, candidatosSite, faviconUrl, itensDaMontagem, itensPadrao, montarRoteiro, setorPorId, sinal, tom } from './apresentacao.js'

const MARK = { up: '▲', down: '▼', flat: '■' }
const dataHora = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', ' ·')
const dia = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

// Ano anterior das moedas: a cotação central cobre 360 dias; para comparar um trecho com o mesmo trecho do ano anterior,
// busca 2 anos de referências diárias do BCE (Frankfurter), uma vez por moeda. Só no navegador, nada é guardado.
const ECB_CODE = { USD: 'USD', EUR: 'EUR', JPY: 'JPY', CNH: 'CNY' }
function useEcbLongo(codes) {
  const [series, setSeries] = useState({})
  const chave = codes.join(',')
  useEffect(() => {
    const ctrl = new AbortController()
    const fim = new Date(), ini = new Date(); ini.setFullYear(ini.getFullYear() - 2)
    const iso = (d) => d.toISOString().slice(0, 10)
    for (const code of chave ? chave.split(',') : []) {
      if (!ECB_CODE[code]) continue
      fetch(`https://api.frankfurter.dev/v1/${iso(ini)}..${iso(fim)}?base=${ECB_CODE[code]}&symbols=BRL`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { const pts = j ? parseEcbSeries(j) : []; if (pts.length) setSeries((cur) => ({ ...cur, [code]: pts })) })
        .catch(() => {})
    }
    return () => ctrl.abort()
  }, [chave])
  return series
}

// Apresentar: monta uma apresentação para o cliente a partir do setor e dos itens de mercado escolhidos, com os dados que o painel já tem.
// Nada é guardado: fechar a apresentação descarta a montagem.
export default function Apresentacao({ quotes, macro }) {
  const [site, setSite] = useState('')
  const coverRequests = useRef(null)
  if (!coverRequests.current) coverRequests.current = createLatestRequest()
  useEffect(() => () => coverRequests.current.cancel(), [])
  const [nome, setNome] = useState('')
  const [capa, setCapa] = useState(null) // { titulo, descricao, logo, imagem, dominio }
  const [capaEstado, setCapaEstado] = useState('') // '', 'lendo', 'ok', 'erro'
  const [capaErro, setCapaErro] = useState(null) // { tentativas, motivo }
  const [setorId, setSetorId] = useState(SETORES_APRESENTACAO[0].id)
  const [itens, setItens] = useState(() => itensPadrao(SETORES_APRESENTACAO[0].id))
  const [periodo, setPeriodo] = useState(PERIODOS[1])
  const [aberta, setAberta] = useState(null) // roteiro em exibição, ou null
  const hist = useCentralDaily()
  const comm = useDataFile('commodities.json')
  const diario = useDataFile('insumos-precos.json')
  const temasFile = useDataFile('temas.json')
  const oil = useDataFile('oil.json')
  const ipca = useDataFile('ipca.json')
  const frete = useDataFile('freight.json')
  const indicadores = useDataFile('indicator-history.json')
  const ecb = useEcbLongo(itens.map((id) => ITENS[id]?.code).filter(Boolean))
  const inadimplencia = useDataFile('inadimplencia.json')
  const newsNow = useNewsClock()
  const temas = useMemo(() => { try { return temasFile.data ? normalizeTemas({ ...temasFile.data, stale: temasFile.data.stale || temasFile.stale || temasFile.status === 'error' }, newsNow) : {} } catch { return {} } }, [temasFile.data, temasFile.stale, temasFile.status, newsNow])
  const setor = setorPorId(setorId)
  const lista = itensDaMontagem(setorId)
  const escolherSetor = (id) => { setSetorId(id); setItens(itensPadrao(id)) }
  const alternar = (id) => setItens((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const lerSite = async () => {
    if (!site.trim()) return
    const request = coverRequests.current.start()
    setCapaEstado('lendo')
    try {
      const result = await buscarCapa(site.trim(), request.signal)
      if (!request.isCurrent()) return
      setCapa(result); setCapaEstado('ok'); setCapaErro(null)
    }
    catch (e) {
      if (!request.isCurrent()) return
      // Sem metadados: a capa ainda leva o domínio e o ícone do site (se existir), com o nome digitado.
      const tentativas = e.tentativas ?? candidatosSite(site.trim()).map(DOMINIO)
      const dominio = tentativas[0] ?? ''
      setCapa(dominio ? { titulo: '', descricao: '', logo: faviconUrl(dominio), imagem: null, dominio, semMetadados: true } : null)
      setCapaErro({ tentativas, motivo: e.message }); setCapaEstado('erro')
    }
  }
  const dados = { quotes, hist: hist.data, commodities: comm.data?.commodities ?? [], diario: diario.data, oil: oil.data, frete: frete.data?.series, temas, macro: macro?.data, ipca: ipca.data?.series, indicadores: indicadores.data?.series, inadimplencia: inadimplencia.data?.series, ecb, agora: Date.now() }
  const pronto = (capa?.titulo || nome.trim()) && itens.length > 0
  // O roteiro é montado na hora de apresentar, com os dados daquele momento; fechar descarta.
  const apresentar = () => setAberta(montarRoteiro({ nome: nome.trim(), site, capa, setorId, itens, periodo }, dados))
  return (
    <div className="apr">
      <Panel title="Montar apresentação" note="Escolha o cliente, o setor e os itens: os slides saem dos dados do painel. Nada fica guardado." semAtualizar>
        <div className="apr-form">
          <section className="apr-bloco" aria-labelledby="apr-cliente">
            <h3 id="apr-cliente">1. Cliente</h3>
            <div className="apr-site">
              <label>Site da empresa
                <input type="url" inputMode="url" value={site} onChange={(e) => { coverRequests.current.cancel(); setSite(e.target.value); setCapaEstado(''); setCapa(null); setCapaErro(null) }} placeholder="empresa.com.br" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), lerSite())} />
              </label>
              <button type="button" className="apr-btn" onClick={lerSite} disabled={!site.trim() || capaEstado === 'lendo'}>{capaEstado === 'lendo' ? 'Lendo…' : 'Ler site'}</button>
            </div>
            {capaEstado === 'ok' && capa && <Estado>Capa com os dados do site: <b>{capa.titulo}</b>{capa.descricao ? ` · ${capa.descricao.slice(0, 90)}${capa.descricao.length > 90 ? '…' : ''}` : ''}</Estado>}
            {capaEstado === 'erro' && <Estado tipo="aviso" erro={capaErro?.motivo}>Não consegui ler {capaErro?.tentativas?.length > 1 ? `${capaErro.tentativas.join(' nem ')}` : capaErro?.tentativas?.[0] || 'o site'}. {!/\./.test(site.trim()) ? 'Digite o endereço completo (ex.: empresa.com.br). ' : ''}A capa usa o nome digitado abaixo{capa?.dominio ? ` e o ícone de ${capa.dominio}, se existir` : ''}.</Estado>}
            <label className="apr-nome">Nome da empresa {capa?.titulo ? <small className="muted">(opcional: o site já informou)</small> : <small className="muted">(usado na capa quando o site não é lido)</small>}
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Metalúrgica Exemplo" />
            </label>
          </section>
          <section className="apr-bloco" aria-labelledby="apr-setor">
            <h3 id="apr-setor">2. Setor</h3>
            {GRUPOS_SETORES.map((g) => (
              <div key={g} className="apr-grupo">
                <span className="apr-grupo-nome">{g}</span>
                <div className="chips" role="group" aria-label={g}>
                  {SETORES_APRESENTACAO.filter((s) => s.grupo === g).map((s) => (
                    <button key={s.id} type="button" aria-pressed={s.id === setorId} onClick={() => escolherSetor(s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </section>
          <section className="apr-bloco" aria-labelledby="apr-itens">
            <h3 id="apr-itens">3. Itens de mercado <small className="muted">· os do setor já vêm marcados</small></h3>
            <div className="chips apr-itens" role="group" aria-label="Itens da apresentação">
              {lista.map((i) => (
                <button key={i.id} type="button" aria-pressed={itens.includes(i.id)} disabled={i.tipo === 'planejado'} title={i.tipo === 'planejado' ? 'Coleta ainda não existe no painel' : undefined} onClick={() => alternar(i.id)}>
                  {i.label}{i.tipo === 'planejado' && <small> · em breve</small>}{i.tipo === 'noticia' && <small> · só matérias</small>}
                </button>
              ))}
            </div>
            <p className="muted apr-dica">Selic, CDI, IPCA e o Focus entram sempre, no slide de cenário.</p>
          </section>
          <section className="apr-bloco" aria-labelledby="apr-periodo">
            <h3 id="apr-periodo">4. Período de comparação</h3>
            <div className="seg" role="group" aria-label="Período">
              {PERIODOS.map((p) => <button key={p.dias} type="button" aria-pressed={p.dias === periodo.dias} onClick={() => setPeriodo(p)}>{p.label}</button>)}
            </div>
          </section>
          <div className="apr-acoes">
            <button type="button" className="apr-btn apr-btn-primario" disabled={!pronto} onClick={apresentar}>Apresentar</button>
            <span className="muted">{setor.label} · {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {periodo.label}{!pronto && ' · informe o site ou o nome da empresa'}</span>
          </div>
        </div>
      </Panel>
      {aberta && <Player roteiro={aberta} onClose={() => setAberta(null)} />}
    </div>
  )
}

// Apresentação em tela: um slide por vez, setas do teclado, toque (deslizar) e botões; Escape sai. Tela cheia opcional.
function Player({ roteiro, onClose }) {
  const [i, setI] = useState(0)
  const ref = useRef(null)
  const slideRef = useRef(null)
  const anim = useRef(null)
  const n = roteiro.length
  const ir = (k) => setI((cur) => Math.max(0, Math.min(n - 1, typeof k === 'function' ? k(cur) : k)))
  useEffect(() => {
    const el = ref.current
    const trigger = document.activeElement
    el?.focus()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])
  useLayoutEffect(() => { anim.current = fadeIn(slideRef.current, anim.current) }, [i])
  // Teclado na janela inteira: o foco pode ter ficado num gráfico que saiu com o slide. Na apresentação, as setas sempre
  // trocam de slide (mesmo com um gráfico em foco, depois de arrastar); Escape sempre sai.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key === 'Tab') {
        const controls = [...ref.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length && !el.closest('[inert]'))
        const first = controls[0], last = controls.at(-1)
        if (!first) { e.preventDefault(); ref.current.focus(); return }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current || !ref.current.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) { e.preventDefault(); first.focus() }
        return
      }
      if (e.defaultPrevented || e.target.closest?.('input, select, textarea, button, a[href], [contenteditable="true"]')) return
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir((c) => c + 1) }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir((c) => c - 1) }
      else if (e.key === 'Home') ir(0)
      else if (e.key === 'End') ir(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, onClose]) // eslint-disable-line react-hooks/exhaustive-deps
  const touch = useRef(null)
  // Deslizar troca de slide, exceto quando o gesto começa num gráfico: ali, arrastar seleciona um trecho.
  const onPointerDown = (e) => { touch.current = e.target.closest?.('.plot, .ml, .apr-barras, .apr-barra') ? null : { x: e.clientX, y: e.clientY } }
  const onPointerUp = (e) => {
    const t = touch.current; touch.current = null
    if (!t) return
    const dx = e.clientX - t.x, dy = e.clientY - t.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir((c) => c + (dx < 0 ? 1 : -1))
  }
  const telaCheia = () => { const el = ref.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {}) }
  const s = roteiro[i]
  return (
    <div className="apr-player" role="dialog" aria-modal="true" aria-label="Apresentação" tabIndex={-1} ref={ref} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { touch.current = null }} onLostPointerCapture={() => { touch.current = null }}>
      <div className={`apr-slide apr-s-${s.kind}`} ref={slideRef} key={i} aria-live="polite" aria-atomic="true">
        <Slide s={s} />
      </div>
      <div className="apr-barra">
        <button type="button" onClick={() => ir((c) => c - 1)} disabled={i === 0} aria-label="Slide anterior">‹</button>
        <span className="apr-contador" aria-label={`Slide ${i + 1} de ${n}`}>{i + 1} / {n}</span>
        <button type="button" onClick={() => ir((c) => c + 1)} disabled={i === n - 1} aria-label="Próximo slide">›</button>
        <span className="apr-barra-sep" />
        <button type="button" onClick={telaCheia}>Tela cheia</button>
        <button type="button" onClick={onClose}>Sair</button>
      </div>
    </div>
  )
}

function Slide({ s }) {
  if (s.kind === 'perguntas') return <Perguntas s={s} />
  if (s.kind === 'capa') return <Capa s={s} />
  if (s.kind === 'cenario') return <Cenario s={s} />
  if (s.kind === 'cadeia') return <Cadeia s={s} />
  if (s.kind === 'item') return <Item s={s} />
  if (s.kind === 'agenda') return <Agenda s={s} />
  return <Fim s={s} />
}

const Rodape = ({ children }) => <footer className="apr-rodape">{children}</footer>
// Entrada discreta por bloco: cada bloco esmaece e sobe, um depois do outro (90 ms), tudo abaixo de 1 s; some com "reduzir movimento".
const anim = (i, cls = '') => ({ className: `apr-anim ${cls}`.trim(), style: cascade(i, 90, 720) })

// Gráfico de um item: clique e arraste um trecho para ver a variação e o mesmo trecho do ano anterior (mesmo gráfico do painel).
function Grafico({ g, cor = '#1e40af', rotulo }) {
  const [ref, width] = useWidth()
  const fmt = (v) => `${g.prefixo}${nf(v, g.casas)}${g.sufixo}`
  return (
    <div className="apr-grafico" ref={ref}>
      <Plot points={g.pontos} history={g.historico} width={width} color={cor} code={`apr-${rotulo}`} intraday={false} fmt={fmt} vfmt={fmt} labels label={rotulo} nice={false} light scales={false} compare step={false} />
      <small className="apr-grafico-dica">Clique e arraste um trecho para ver a variação e o mesmo trecho do ano anterior.</small>
    </div>
  )
}

// Barras mensais (saldo do CAGED): positivas para cima, negativas para baixo, com o rótulo do mês.
function Barras({ pontos, rotulo }) {
  const W = 560, H = 150, M = { t: 10, b: 24, l: 8, r: 8 }
  const max = Math.max(...pontos.map((p) => Math.abs(p.v)), 1)
  const iw = W - M.l - M.r, ih = H - M.t - M.b, zero = M.t + ih / 2, bw = iw / pontos.length
  return (
    <svg className="apr-barras" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} preserveAspectRatio="none">
      <line x1={M.l} x2={W - M.r} y1={zero} y2={zero} stroke="var(--line)" />
      {pontos.map((p, i) => {
        const h = (Math.abs(p.v) / max) * (ih / 2)
        return <g key={p.period}>
          <rect className={`bar-grow-y${p.v < 0 ? ' neg' : ''}`} style={cascade(i, 40, 440)} x={M.l + i * bw + bw * 0.18} y={p.v >= 0 ? zero - h : zero} width={bw * 0.64} height={h} rx="2" fill={p.v >= 0 ? 'var(--up)' : 'var(--down)'} />
          <text x={M.l + i * bw + bw / 2} y={H - 7} textAnchor="middle" fontSize="11" fill="var(--mut)">{p.rotulo}</text>
        </g>
      })}
    </svg>
  )
}

function Perguntas({ s }) {
  return (
    <>
      <p {...anim(0, 'apr-kicker apr-kicker-escuro')}>Antes de começar · para quem apresenta</p>
      <h2 {...anim(1)}>Para a conversa com {s.nome}</h2>
      <p {...anim(2, 'apr-sub')}>{s.setor.label}: o que vale perguntar e ouvir antes de mostrar o cenário. Este slide é seu; avance quando estiver pronto.</p>
      <ol {...anim(3, 'apr-perguntas')}>{s.perguntas.map((p) => <li key={p}>{p}</li>)}</ol>
      <Rodape>Perguntas de partida; o cliente diz o que pesa de verdade.</Rodape>
    </>
  )
}

function Capa({ s }) {
  return (
    <div className="apr-capa-grade">
      <div className="apr-capa-texto">
        <p {...anim(0, 'apr-kicker')}>Cenário de mercado para</p>
        <h1 {...anim(1)}>{s.nome}</h1>
        {s.capa?.descricao && <p {...anim(2, 'apr-capa-desc')}>{s.capa.descricao}</p>}
        <p {...anim(3, 'apr-capa-setor')}>{s.setor.label}{s.capa?.dominio ? ` · ${s.capa.dominio}` : ''}</p>
      </div>
      {s.capa?.logo && <img className="apr-capa-logo apr-anim" style={cascade(2, 90, 720)} src={s.capa.logo} alt={`Logotipo de ${s.nome}`} onError={(e) => { e.currentTarget.hidden = true }} />}
      <Rodape>Apresentação montada em {dataHora(s.agora)} · comparações de {s.periodo.label} · fontes públicas, conferir antes de decidir. Datas de referência nos indicadores e snapshots.</Rodape>
    </div>
  )
}

const pp = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v), 2)} p.p.`
function Cenario({ s }) {
  const { emprego, inadimplencia } = s.graficos ?? {}
  const [refInad, wInad] = useWidth()
  const inadSeries = inadimplencia ? ['PF', 'PJ'].map((k, i) => ({ key: k, name: k === 'PF' ? 'Pessoa física' : 'Pessoa jurídica', color: ['#ff8200', '#1e40af'][i], points: inadimplencia[k] })).filter((x) => x.points.length > 1) : []
  return (
    <>
      <h2 {...anim(0)}>O cenário em uma linha</h2>
      {s.linhas.length ? (
        <ul className="apr-cenario">
          {s.linhas.map((l, i) => <li key={l.key} {...anim(i + 1)}><span className="apr-cen-label">{l.label}</span><b className="apr-cen-valor">{l.valor}</b><small>{l.nota}</small>{l.leitura && <span className="apr-cen-leitura">{l.leitura}</span>}</li>)}
        </ul>
      ) : <p className="apr-vazio">Indicadores indisponíveis no momento.</p>}
      <div className="apr-cen-graficos">
        <section {...anim(s.linhas.length + 1)} aria-label="Emprego formal nos últimos 12 meses">
          <h3>Emprego formal <small>saldo mensal do CAGED · 12 meses</small></h3>
          {emprego ? <><p className="apr-cen-mini"><b className={tom(emprego.ultimo.v)}>{emprego.ultimo.v >= 0 ? '+' : '−'}{nf(Math.abs(emprego.ultimo.v), 0)}</b> vagas em {emprego.ultimo.rotulo} · {nf(emprego.acumulado, 0)} no acumulado</p><Barras pontos={emprego.pontos} rotulo="Saldo mensal de vagas formais (CAGED), últimos 12 meses" /><p className="apr-cen-leitura">{s.linhas.length ? 'Saldo de vagas formais: demanda do consumidor e pressão salarial.' : ''}</p></> : <p className="apr-vazio">Série do CAGED indisponível.</p>}
        </section>
        <section {...anim(s.linhas.length + 2)} aria-label="Inadimplência nos últimos 12 meses" ref={refInad}>
          <h3>Inadimplência <small>acima de 90 dias · carteira total · 12 meses</small></h3>
          {inadSeries.length ? <><p className="apr-cen-mini">{['PF', 'PJ'].filter((k) => inadimplencia.ultimo[k]).map((k) => <span key={k}><b>{k}</b> {nf(inadimplencia.ultimo[k].v, 2)}%{inadimplencia[k].length > 1 ? ` (${pp(inadimplencia.ultimo[k].v - inadimplencia[k][0].v)} em 12 meses)` : ''}</span>)}</p><MultiLinhas series={inadSeries} width={wInad} fmt={(v) => `${nf(v, 2)}%`} ariaLabel="Inadimplência PF e PJ, percentual do saldo com atraso acima de 90 dias, últimos 12 meses" /><p className="apr-cen-leitura">Risco de crédito ao cliente e apetite dos bancos para emprestar.</p></> : <p className="apr-vazio">Série de inadimplência indisponível.</p>}
        </section>
      </div>
      <Rodape>Juros, inflação, câmbio, Focus, CAGED e inadimplência · Apresentação montada em {dataHora(s.agora)}. Datas de referência nos indicadores e snapshots.</Rodape>
    </>
  )
}

function Cadeia({ s }) {
  const c = s.setor.cadeia
  return (
    <>
      <h2 {...anim(0)}>A cadeia de {s.setor.label.toLowerCase()}</h2>
      <div className="apr-cadeia">
        <div {...anim(1, 'apr-cad-col')}><span className="apr-cad-titulo">O que entra</span>{c.entradas.map((e) => <span key={e} className="apr-cad-chip">{e}</span>)}</div>
        <span className="apr-cad-seta apr-anim" style={cascade(2, 90, 720)} aria-hidden="true">→</span>
        <div {...anim(2, 'apr-cad-col apr-cad-meio')}><span className="apr-cad-titulo">A empresa</span><span className="apr-cad-chip apr-cad-chip-forte">{c.processo}</span></div>
        <span className="apr-cad-seta apr-anim" style={cascade(3, 90, 720)} aria-hidden="true">→</span>
        <div {...anim(3, 'apr-cad-col')}><span className="apr-cad-titulo">Para quem vende</span>{c.saidas.map((e) => <span key={e} className="apr-cad-chip">{e}</span>)}</div>
      </div>
      <div {...anim(4, 'apr-cad-trans')}>
        <b>Atravessam toda a cadeia</b>
        <ul>{s.transversais.map((t) => <li key={t.id}><b>{t.label}.</b> {t.texto}</li>)}</ul>
      </div>
      <Rodape>Cadeia típica do setor; a conversa com o cliente ajusta o que pesa mais.</Rodape>
    </>
  )
}

function Item({ s }) {
  const { item, dado, move, periodo } = s
  const now = useNewsClock()
  const manchetes = recentNews(s.manchetes, now)
  const hasNewsCoverage = Boolean(item.tema)
  const newsStale = hasNewsCoverage && newsCollectionStale(s.newsState, now)
  const per = dado.periodo
  return (
    <>
      <h2 {...anim(0)}>{item.label}</h2>
      <div className="apr-item">
        <div {...anim(1, 'apr-item-num')}>
          {dado.indisponivel ? <p className="apr-vazio">{dado.indisponivel}</p> : dado.semSerie ? <p className="apr-vazio">{dado.semSerie}</p> : (
            <>
              <p className="apr-valor">{dado.valorTexto}{dado.unidadeCurta && <small>{dado.unidadeCurta}</small>}</p>
              <p className="apr-quando">{dado.quando}{dado.stale ? ' · sem atualização na última coleta' : ''}</p>
              <ul className="apr-vars">
                {Number.isFinite(dado.dia) && <li className={tom(dado.dia)}><span aria-hidden="true">{MARK[tom(dado.dia)]}</span> {sinal(dado.dia, 2)} <small>hoje</small></li>}
                {Number.isFinite(dado.mes) && <li className={tom(dado.mes)}><span aria-hidden="true">{MARK[tom(dado.mes)]}</span> {sinal(dado.mes)} <small>mês anterior</small></li>}
                <li className={per ? tom(per.pct) : 'flat'}><span aria-hidden="true">{MARK[per ? tom(per.pct) : 'flat']}</span> {per ? sinal(per.pct) : '—'} <small>{periodo.label}</small></li>
                {dado.emReais != null && <li className={tom(dado.emReais)}><span aria-hidden="true">{MARK[tom(dado.emReais)]}</span> {sinal(dado.emReais)} <small>{periodo.label} em reais</small></li>}
              </ul>
            </>
          )}
          {dado.frase && dado.frase !== dado.semSerie && <p className="apr-frase">{dado.frase}</p>}
          {dado.grafico && <Grafico g={dado.grafico} rotulo={item.label} />}
          {dado.grafico && <small className="apr-grafico-nota">{dado.grafico.mensal ? 'média mensal' : dado.pontosNota ?? 'cotação diária'}{dado.grafico.mensal && periodo.dias < 365 ? ' · gráfico de 12 meses; a variação acima é do período escolhido' : ''}{dado.grafico.bce ? ' · ano anterior pela referência diária do BCE' : ''}</small>}
        </div>
        <div className="apr-item-texto">
          {move.length > 0 && <section {...anim(2)}><h3>O que mexe no preço</h3><ul>{move.slice(0, 4).map((m) => <li key={m}>{m}</li>)}</ul></section>}
          <section {...anim(3)}><h3>Na imprensa · últimos 5 dias</h3>
            {newsStale && <p className="apr-vazio">Atualização das notícias incompleta, atrasada ou não confirmada.</p>}
            {!hasNewsCoverage ? <p className="apr-vazio">Cobertura de notícias não configurada para este item.</p> : manchetes.length ? <ul className="apr-manchetes">{manchetes.map((m) => <li key={m.link}><time dateTime={new Date(m.t).toISOString()}>{dia(m.t)} {hora(m.t)}</time> {m.title} <small>{m.source}</small></li>)}</ul> : <p className="apr-vazio">Nenhuma publicação válida nas últimas 120 horas no arquivo disponível.</p>}
          </section>
        </div>
      </div>
      <Rodape>Matérias: títulos da imprensa, sem resumo nem análise{dado.emReais != null ? ' · em reais: conversão simples pelo dólar do período, sem prêmio, frete nem impostos' : ''}</Rodape>
    </>
  )
}

function Agenda({ s }) {
  return (
    <>
      <h2 {...anim(0)}>O que pode mexer nas próximas semanas</h2>
      {s.eventos.length ? (
        <ul className="apr-agenda">
          {s.eventos.map((e, i) => <li key={e.kind + e.t} {...anim(i + 1)}><time dateTime={new Date(e.t).toISOString()}>{dia(e.t)} <b>{hora(e.t)}</b></time><span className="apr-tag">{e.kind}</span><span className="apr-agenda-texto">{e.label}{e.leitura && <small>{e.leitura}</small>}</span></li>)}
        </ul>
      ) : <p className="apr-vazio">Sem eventos na agenda dos próximos 30 dias.</p>}
      <Rodape>Horário de Brasília · datas conferidas nas fontes oficiais; "previsto" ainda depende de confirmação</Rodape>
    </>
  )
}

function Fim({ s }) {
  return (
    <div className="apr-capa-grade">
      <p {...anim(0, 'apr-kicker')}>Em resumo</p>
      {s.pontos.length ? <ul {...anim(1, 'apr-fim-pontos')}>{s.pontos.map((p) => <li key={p}>{p}</li>)}</ul> : <p {...anim(1, 'apr-capa-desc')}>Os dados de período não estavam disponíveis para resumir.</p>}
      {s.minis?.length > 0 && (
        <div className="apr-fim-grade" role="list" aria-label="Minigráficos do que foi apresentado">
          {s.minis.map((m, i) => (
            <div key={m.key} role="listitem" {...anim(i + 2, 'apr-mini')}>
              <span className="apr-mini-label">{m.label}</span>
              <b className="apr-mini-valor">{m.valor}</b>
              <small className={`apr-mini-var ${m.tom}`}>{m.variacao}</small>
              {m.pontos.length > 1 && <Sparkline points={m.pontos} tone={m.tom} height={36} />}
            </div>
          ))}
        </div>
      )}
      <p className="apr-capa-setor apr-anim" style={cascade((s.minis?.length ?? 0) + 2, 90, 720)}>Próximo passo: medir o que o cenário muda no caixa de {s.nome}.</p>
      <Rodape>Conteúdo informativo, com fontes públicas; não é recomendação. Apresentação montada em {dataHora(s.agora)}. Datas de referência nos indicadores e snapshots.</Rodape>
    </div>
  )
}
