import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import config from './fredixConfig.json'
import { fredixEndpoint, partesDaResposta, perguntarAoFredix } from './fredix.js'
import { AVISO_DADO_SENSIVEL, FREDIX_LIMITES, temDadoSensivel } from './fredixSeguranca.js'
import './FredixChat.css'

const SCRIPT_ANTI_ROBO = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SUGESTOES = ['Como está o dólar hoje?', 'Qual a Selic e o CDI atuais?', 'O que diz o Focus para o IPCA?', 'Quais as notícias do agro?']

let carregando
function carregarAntiRobo() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  carregando ??= new Promise((resolve, reject) => {
    const script = Object.assign(document.createElement('script'), { src: SCRIPT_ANTI_ROBO, async: true })
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => { carregando = null; reject(new Error('anti-robô indisponível')) }
    document.head.append(script)
  })
  return carregando
}

function Resposta({ texto }) {
  return partesDaResposta(texto).map((parte, i) => parte.rota ? <a key={i} href={parte.rota}>{parte.texto}</a> : <span key={i}>{parte.texto}</span>)
}

export default function FredixChat({ configuration = config, icone }) {
  const [aberto, setAberto] = useState(false)
  const [conversa, setConversa] = useState([])
  const [rascunho, setRascunho] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const dialogo = useRef(null), gatilho = useRef(null), campo = useRef(null), fim = useRef(null)
  const caixaAntiRobo = useRef(null), widget = useRef(null), token = useRef('')
  const controle = useRef(null)
  const endpoint = fredixEndpoint(configuration), chavePublica = configuration?.turnstileSiteKey || ''

  useEffect(() => () => controle.current?.abort(), [])
  useEffect(() => {
    if (!aberto) return
    const elemento = dialogo.current, abridor = gatilho.current
    elemento.showModal()
    campo.current?.focus()
    const fechar = () => setAberto(false)
    window.addEventListener('hashchange', fechar)
    return () => { elemento.close(); window.removeEventListener('hashchange', fechar); abridor?.focus({ preventScroll: true }) }
  }, [aberto])
  useEffect(() => {
    if (!aberto || !endpoint || !chavePublica) return
    let ativo = true
    carregarAntiRobo().then(turnstile => {
      if (!ativo || !caixaAntiRobo.current || widget.current != null) return
      widget.current = turnstile.render(caixaAntiRobo.current, {
        sitekey: chavePublica, size: 'flexible', language: 'pt-br', appearance: 'interaction-only',
        callback: t => { token.current = t }, 'expired-callback': () => { token.current = '' },
      })
    }).catch(() => ativo && setErro('Não consegui carregar a checagem anti-robô. Recarregue a página.'))
    return () => {
      ativo = false
      if (widget.current != null) { window.turnstile?.remove(widget.current); widget.current = null; token.current = '' }
    }
  }, [aberto, endpoint, chavePublica])
  useEffect(() => { fim.current?.scrollIntoView?.({ block: 'end' }) }, [conversa, enviando])

  const enviar = async texto => {
    const pergunta = texto.trim()
    if (!pergunta || enviando || !endpoint) return
    if (temDadoSensivel(pergunta)) { setErro(AVISO_DADO_SENSIVEL); return }
    if (chavePublica && !token.current) { setErro('Aguarde a checagem anti-robô terminar e envie de novo.'); return }
    // Guarda só as últimas trocas, dentro do limite do servidor.
    const mensagens = [...conversa, { role: 'user', content: pergunta }].slice(-(FREDIX_LIMITES.mensagens - 1))
    if (mensagens[0].role !== 'user') mensagens.shift()
    setConversa(mensagens); setRascunho(''); setErro(''); setEnviando(true)
    const abortar = new AbortController()
    controle.current = abortar
    const prazo = setTimeout(() => abortar.abort(), 60000)
    try {
      const resposta = await perguntarAoFredix(configuration, mensagens, { antiRobo: token.current, signal: abortar.signal })
      setConversa(atual => [...atual, { role: 'assistant', content: resposta }])
    } catch (falha) {
      setConversa(atual => atual.slice(0, -1)); setRascunho(pergunta)
      setErro(falha.name === 'AbortError' ? 'O Fredix demorou a responder. Tente de novo.' : falha.message)
    } finally {
      clearTimeout(prazo); controle.current = null; setEnviando(false)
      token.current = ''
      if (widget.current != null) window.turnstile?.reset(widget.current)
      campo.current?.focus()
    }
  }

  return <>
    <button className="feedback-trigger fredix-trigger" type="button" ref={gatilho} aria-haspopup="dialog" aria-expanded={aberto} aria-controls="fredix-dialog" title="Fredix — perguntar sobre o mercado e o painel" onClick={() => setAberto(true)}>💬 Pergunte</button>
    {createPortal(<dialog id="fredix-dialog" className="feedback-dialog fredix-dialog" ref={dialogo} aria-labelledby="fredix-title" aria-describedby="fredix-aviso" onCancel={event => { event.preventDefault(); setAberto(false) }} onClose={() => { if (!dialogo.current?.open) setAberto(false) }}>
      <header className="feedback-heading">{icone}<div><span>PME</span><h2 id="fredix-title">Pergunte ao Fredix</h2></div><button type="button" className="feedback-close" aria-label="Fechar conversa com o Fredix" onClick={() => setAberto(false)}>×</button></header>
      <p id="fredix-aviso" className="feedback-privacy">Respondo com os dados do painel e digo a fonte. Não faço contas de taxa, CET ou IOF: para isso, use as calculadoras. Não digite dados de clientes, CPF, CNPJ, telefone ou e-mail. A conversa não fica gravada.</p>
      {!endpoint && <p className="feedback-notice" role="status">O Fredix está em configuração. Em breve ele responde por aqui.</p>}
      <div className="fredix-conversa" role="log" aria-live="polite" aria-busy={enviando}>
        {!conversa.length && endpoint && <div className="fredix-sugestoes">{SUGESTOES.map(s => <button key={s} type="button" disabled={enviando} onClick={() => enviar(s)}>{s}</button>)}</div>}
        {conversa.map((m, i) => m.role === 'user'
          ? <p key={i} className="fredix-msg fredix-voce"><b className="mascot-sr-only">Você:</b>{m.content}</p>
          : <p key={i} className="fredix-msg fredix-fredix"><b className="mascot-sr-only">Fredix:</b><Resposta texto={m.content} /></p>)}
        {enviando && <p className="fredix-msg fredix-fredix fredix-pensando">Pesquisando no painel…</p>}
        <span ref={fim} />
      </div>
      <form className="fredix-form" onSubmit={event => { event.preventDefault(); enviar(rascunho) }}>
        <label htmlFor="fredix-pergunta" className="mascot-sr-only">Sua pergunta</label>
        <textarea ref={campo} id="fredix-pergunta" rows="2" maxLength={FREDIX_LIMITES.pergunta} value={rascunho} disabled={!endpoint} placeholder="Ex.: como fechou o dólar?"
          onChange={event => { setRascunho(event.target.value); setErro('') }}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); enviar(rascunho) } }} />
        <button className="feedback-submit" type="submit" disabled={!endpoint || enviando || !rascunho.trim()}>{enviando ? 'Aguarde…' : 'Enviar'}</button>
      </form>
      <div ref={caixaAntiRobo} className="fredix-anti-robo" />
      {erro && <p role="alert" className="feedback-error">{erro}</p>}
      {conversa.length > 0 && !enviando && <button type="button" className="fredix-nova" onClick={() => { setConversa([]); setErro('') }}>Nova conversa</button>}
    </dialog>, document.body)}
  </>
}
