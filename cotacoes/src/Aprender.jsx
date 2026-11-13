import { Aviso } from './Avisos.jsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CONCEITOS, CONEXAO, LIGACOES, buscarConceitos, conexoesDe, porTopico } from './educacao.js'
import Help from './Help.jsx'
import './Aprender.css'
import IcmsStDiagram from './IcmsStDiagram.jsx'
import KnowledgeMap from './KnowledgeMap.jsx'

const nomeCurto = (id) => CONCEITOS.find((c) => c.id === id)?.nome.replace(/ \(.*\)/, '') ?? id
import { Panel } from './TerminalDesk.jsx'

function AprenderAudio() {
  const [failed, setFailed] = useState(false)
  const audioUrl = './audio/cupom-cambial-explicacao-notebooklm-v2-2026-11-08.m4a'
  return <section aria-label="Cupom cambial em áudio" className="learn-audio">
    <h3>Ouça a explicação</h3>
    <p>Resumo em Audio 🎧</p>
    <audio controls preload="metadata" aria-label="Ouvir explicação sobre cupom cambial" src={audioUrl} onError={() => setFailed(true)} />
    {failed && <p role="alert">Não foi possível carregar o áudio. Você pode baixar o arquivo ou continuar lendo a explicação abaixo.</p>}
    <a href={audioUrl} download>Baixar áudio (M4A)</a>
  </section>
}

// Aba Aprender: lista de conceitos à esquerda; o conceito escolhido abre à direita (frase, explicação simples, lacunas, versão precisa, exemplo, teste).
function Concept({ c, goto }) {
  if (c.diagramaIcms) return <IcmsStDiagram goto={goto} />
  return (
    <div className="learn-card is-focus">
      <Panel title={c.nome} note={c.ajuda && <Help label={`Sobre ${c.nome}`} wide>{c.ajuda.map((t) => <p key={t}>{t}</p>)}</Help>}>
        <div className="learn-body">
          <p className="learn-sentence"><span className="learn-tag">Em uma frase</span>{c.frase}</p>

          {c.id === 'cupom-cambial' && <AprenderAudio />}

          <h3>Explicação simples</h3>
          {c.crianca.map((t) => <p key={t}>{t}</p>)}
          <p className="learn-analogy"><span className="learn-tag">Analogia</span>{c.analogia}</p>

          {c.estudoHistorico && <section className="learn-history" aria-label={c.estudoHistorico.titulo}>
            <h3>{c.estudoHistorico.titulo}</h3>
            <p className="learn-history-scope">{c.estudoHistorico.escopo}</p>
            {c.estudoHistorico.casos.map((caso) => <details className="learn-history-case" key={caso.id}>
              <summary><strong>{caso.pais}</strong><span>{caso.periodo} · {caso.tipo}</span></summary>
              <p className="learn-history-takeaway">{caso.chamada}</p>
              <ol className="learn-history-timeline">{caso.marcos.map(marco => <li key={marco}>{marco}</li>)}</ol>
              <h4>O contexto</h4><p>{caso.contexto}</p>
              <h4>Como seguraram os juros</h4><p>{caso.mecanismo}</p>
              <h4>O que aconteceu</h4><p>{caso.resultado}</p>
              <h4>O que a história não prova</h4><p>{caso.limite}</p>
              <ul className="learn-history-sources">{caso.fontes.map(id => {
                const fonte = c.fontes.find(f => f.id === id)
                return fonte && <li key={id}><a href={fonte.url} target="_blank" rel="noopener noreferrer">{fonte.nome}</a></li>
              })}</ul>
            </details>)}
            <h3>Por que os resultados foram diferentes</h3>
            <div className="learn-history-comparison">{c.estudoHistorico.comparacao.map(item => <section key={item.titulo}><h4>{item.titulo}</h4><p>{item.texto}</p></section>)}</div>
            <h3>Como usar essa história numa análise de crédito</h3>
            <ul>{c.estudoHistorico.checklist.map(item => <li key={item}>{item}</li>)}</ul>
            <p className="learn-history-conclusion">{c.estudoHistorico.conclusao}</p>
          </section>}

          <details>
            <summary>Onde você pode travar</summary>
            <ul>{c.lacunas.map((t) => <li key={t}>{t}</li>)}</ul>
          </details>

          <details>
            <summary>Versão precisa</summary>
            <p>{c.preciso.texto}</p>
            <p className="learn-formula" role={c.preciso.tipo === 'conceitual' ? undefined : 'math'} aria-label={c.preciso.formula}>{c.preciso.formula}</p>
          </details>

          <details>
            <summary>{c.exemplo.tipo === 'histórico' ? 'Exemplo histórico' : 'Exemplo numérico'} · {c.exemplo.titulo}</summary>
            <ol>{c.exemplo.passos.map((t) => <li key={t}>{t}</li>)}</ol>
            <p className="learn-result"><strong>Resultado:</strong> {c.exemplo.resultado}</p>
          </details>

          <details>
            <summary>Teste: explique com as suas palavras</summary>
            <p><strong>{c.teste.pergunta}</strong></p>
            <details className="learn-answer">
              <summary>Ver resposta</summary>
              <p>{c.teste.resposta}</p>
            </details>
          </details>

          <details>
            <summary>Conecta com</summary>
            <ul className="learn-conecta">
              {conexoesDe(c.id).map((x) => (
                <li key={x.id}><button type="button" className="learn-link" onClick={() => goto('aprender', x.id)}>{nomeCurto(x.id)} ›</button> {x.porque}</li>
              ))}
            </ul>
          </details>

          {c.fontes?.length > 0 && <details><summary>Fontes</summary>{c.revisadoEm && <p>Revisão do conteúdo: {c.revisadoEm.split('-').reverse().join('/')}.</p>}<ul>{c.fontes.map(f=><li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.nome}</a></li>)}</ul></details>}
          <p className="learn-app">
            <span className="learn-tag">No app</span>{c.noApp.texto}{' '}
            <button type="button" className="learn-go" onClick={() => goto(c.noApp.tab, c.noApp.view)}>Abrir ›</button>
          </p>
        </div>
      </Panel>
    </div>
  )
}

export default function Aprender({ view = '', goto }) {
  const chosen = CONCEITOS.find((c) => c.id === view)
  const detail = useRef(null)
  const [termo, setTermo] = useState('')
  const [abertos, setAbertos] = useState(() => new Set(chosen ? [chosen.topico] : []))
  const antesDaBusca = useRef(null)
  const achados = useMemo(() => buscarConceitos(termo), [termo])
  const grupos = useMemo(() => porTopico(achados), [achados])
  function buscar(valor) {
    if (valor.trim()) {
      if (!termo.trim()) antesDaBusca.current = abertos
      setAbertos(new Set(porTopico(buscarConceitos(valor)).map((g) => g.topico)))
    } else if (termo.trim()) {
      setAbertos(antesDaBusca.current ?? new Set())
      antesDaBusca.current = null
    }
    setTermo(valor)
  }
  function alternarGrupo(topico, aberto) {
    setAbertos((anteriores) => {
      if (anteriores.has(topico) === aberto) return anteriores
      const proximos = new Set(anteriores)
      if (aberto) proximos.add(topico)
      else proximos.delete(topico)
      return proximos
    })
  }
  // no celular a explicação fica abaixo da lista: leva a tela até ela ao escolher um conceito
  useEffect(() => {
    if (chosen) setAbertos((anteriores) => anteriores.has(chosen.topico) ? anteriores : new Set([...anteriores, chosen.topico]))
    if (chosen) detail.current?.focus({ preventScroll: true })
    if (chosen && detail.current && window.matchMedia?.('(max-width: 999px)').matches) {
      detail.current.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [chosen])
  const mapMode = !view || view === 'mapa'
  return (
    <div className="learn">
      <nav className="learn-mode" aria-label="Explorar Aprender"><button type="button" aria-pressed={mapMode} onClick={() => goto('aprender', 'mapa')}>Mapa do conhecimento</button><button type="button" aria-pressed={!mapMode} onClick={() => goto('aprender', chosen?.id || 'conceitos')}>Conceitos</button></nav>
      {mapMode ? <KnowledgeMap goto={goto} /> : <>
      <Aviso title="Aprender · exemplos didáticos"><p>Os exemplos usam números redondos para facilitar a conta; não são cotações de mercado.</p></Aviso>
      <div className="learn-split">
        <nav className="learn-list" aria-label="Conceitos">
          <h2 className="learn-list-title">Conceitos</h2>
          <div className="learn-search" role="search">
            <input type="search" value={termo} onChange={(e) => buscar(e.target.value)} placeholder="Buscar conceito…" aria-label="Buscar conceito" autoComplete="off" />
            {termo && <button type="button" className="learn-clear" onClick={() => buscar('')} aria-label="Limpar busca">×</button>}
          </div>
          <p className="learn-count" role="status">{termo.trim() ? (achados.length ? `${achados.length} ${achados.length === 1 ? 'conceito encontrado' : 'conceitos encontrados'}` : 'Nenhum conceito encontrado. Tente outra palavra.') : `${CONCEITOS.length} conceitos em ${grupos.length} tópicos`}</p>
          {grupos.length > 0 && <div className="learn-group-actions" aria-label="Categorias de conceitos">
            <button type="button" onClick={() => setAbertos(new Set(grupos.map((g) => g.topico)))} disabled={grupos.every((g) => abertos.has(g.topico))}>Expandir todas</button>
            <button type="button" onClick={() => setAbertos(new Set())} disabled={grupos.every((g) => !abertos.has(g.topico))}>Recolher todas</button>
          </div>}
          {grupos.map((g) => (
            <details key={g.topico} className="learn-group" open={abertos.has(g.topico)} onToggle={(e) => alternarGrupo(g.topico, e.currentTarget.open)}>
              <summary className="learn-topic"><span>{g.topico}</span><small>{g.itens.length}</small></summary>
              <ul>
                {g.itens.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={view === c.id ? 'on' : ''} aria-current={view === c.id ? 'true' : undefined} onClick={() => goto('aprender', c.id)}>
                      <b>{c.nome.replace(/ \(.*\)/, '')}</b>
                      <small>{c.frase.length > 70 ? `${c.frase.slice(0, 68).trimEnd()}…` : c.frase}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </nav>
        <section className="learn-detail" ref={detail} tabIndex={-1} aria-live="polite" aria-label="Explicação do conceito">
          {chosen ? <Concept key={chosen.id} c={chosen} goto={goto} /> : (
            <Panel title={CONEXAO.titulo} note="escolha um conceito ao lado">
              <div className="learn-body">
                <ul className="learn-links">
                  {CONEXAO.itens.map((i) => <li key={i.id}><button type="button" className="learn-link" onClick={() => goto('aprender', i.id)}>{nomeCurto(i.id)}</button> {i.texto}</li>)}
                </ul>
                <h3>O caminho de ponta a ponta</h3>
                <p>{CONEXAO.cadeia}</p>
                <h3>Quem se liga a quem</h3>
                <ul className="learn-links">
                  {LIGACOES.map(([a, b, porque]) => <li key={`${a}-${b}`}><strong>{nomeCurto(a)} ↔ {nomeCurto(b)}</strong> {porque}</li>)}
                </ul>
                <p className="learn-note">Escolha um conceito na lista para abrir a explicação.</p>
              </div>
            </Panel>
          )}
        </section>
      </div>
      </>}
    </div>
  )
}
