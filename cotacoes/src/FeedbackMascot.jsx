import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import config from './feedbackConfig.json'
import { EMPTY_FEEDBACK, FEEDBACK_LIMITS, FEEDBACK_TYPES, feedbackEndpoint, sendFeedback, validateFeedback } from './feedback.js'
import './FeedbackMascot.css'
import MascotDock from './MascotDock.jsx'
import owl from './assets/mascot-owl.webp'
import owlWing from './assets/mascot-owl-wing.webp'

export function MascotIcon() {
  return <span className="feedback-mascot-icon" aria-hidden="true">
    <img src={owl} alt="" className="mascot-body" width="384" height="408" draggable="false" />
    <img src={owlWing} alt="" className="mascot-wing" width="384" height="408" draggable="false" />
  </span>
}

export default function FeedbackMascot({ configuration = config, onSearch }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState({ ...EMPTY_FEEDBACK })
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const dialog = useRef(null), trigger = useRef(null), message = useRef(null)
  const inFlight = useRef(false), alive = useRef(true), controller = useRef(null), restoreFocus = useRef(true)
  const enabled = !!feedbackEndpoint(configuration)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; controller.current?.abort() }
  }, [])
  useEffect(() => {
    if (!open) return
    const element = dialog.current, opener = trigger.current
    element.showModal()
    message.current?.focus()
    const navigate = () => { restoreFocus.current = false; setOpen(false) }
    window.addEventListener('hashchange', navigate)
    window.addEventListener('popstate', navigate)
    return () => {
      element.close()
      window.removeEventListener('hashchange', navigate)
      window.removeEventListener('popstate', navigate)
      if (restoreFocus.current) opener?.focus({ preventScroll: true })
    }
  }, [open])
  const change = event => {
    setValues(current => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
    if (status === 'success') setStatus('idle')
  }
  const submit = async event => {
    event.preventDefault()
    if (inFlight.current || !enabled) return
    const invalid = validateFeedback(values)
    if (invalid) { setError(invalid); return }
    inFlight.current = true
    setStatus('sending'); setError('')
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), 20000)
    try {
      await sendFeedback(configuration, values, { signal: abort.signal })
      if (alive.current) { setValues({ ...EMPTY_FEEDBACK }); setStatus('success') }
    } catch (failure) {
      if (alive.current) {
        setStatus('error')
        setError(failure instanceof TypeError || failure.name === 'AbortError'
          ? 'A conexão não confirmou o recebimento. Seu texto foi preservado. Aguarde antes de reenviar para evitar duplicidade.'
          : failure.message)
      }
    } finally { clearTimeout(timeout); inFlight.current = false; controller.current = null }
  }
  return <>
    <MascotDock onSearch={onSearch}><button className="feedback-trigger" type="button" ref={trigger} aria-label="Abrir caixa de sugestões" aria-haspopup="dialog" aria-expanded={open} aria-controls="feedback-dialog" onClick={() => { restoreFocus.current = true; setOpen(true) }}>
      <MascotIcon /><span>Sugestões</span>
    </button></MascotDock>
    {createPortal(<dialog id="feedback-dialog" className="feedback-dialog" ref={dialog} aria-labelledby="feedback-title" aria-describedby="feedback-privacy" onCancel={event => { event.preventDefault(); setOpen(false) }} onClose={() => { if (!dialog.current?.open) setOpen(false) }}>
      <header className="feedback-heading"><MascotIcon /><div><span>PEME</span><h2 id="feedback-title">Sua ideia faz diferença</h2></div><button type="button" className="feedback-close" aria-label="Fechar caixa de sugestões" onClick={() => setOpen(false)}>×</button></header>
      <p id="feedback-privacy" className="feedback-privacy">Envie uma sugestão, dica ou problema para Fernando. Não inclua dados de clientes, senhas ou informações confidenciais.</p>
      {!enabled && <p className="feedback-notice" role="status">O envio está em configuração. Nada será enviado por esta janela enquanto o serviço não estiver ativado.</p>}
      <form onSubmit={submit} aria-busy={status === 'sending'}>
        <fieldset disabled={status === 'sending'} className="feedback-fields">
          <label htmlFor="feedback-type">Tipo<select id="feedback-type" name="type" value={values.type} onChange={change}>{FEEDBACK_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
          <label htmlFor="feedback-message">Mensagem <span>(obrigatória)</span><textarea ref={message} id="feedback-message" name="message" required rows="5" maxLength={FEEDBACK_LIMITS.message} value={values.message} onChange={change} aria-describedby="feedback-count" /></label>
          <small id="feedback-count">{values.message.length.toLocaleString('pt-BR')} / 4.000 caracteres</small>
          <div className="feedback-contact"><label htmlFor="feedback-name">Nome <span>(opcional)</span><input id="feedback-name" name="name" autoComplete="name" maxLength={FEEDBACK_LIMITS.name} value={values.name} onChange={change} /></label><label htmlFor="feedback-email">E-mail <span>(opcional)</span><input id="feedback-email" name="email" type="email" autoComplete="email" maxLength={FEEDBACK_LIMITS.email} value={values.email} onChange={change} /></label></div>
          <div className="feedback-honeypot" aria-hidden="true"><label>Deixe em branco<input name="website" value={values.website} onChange={change} autoComplete="off" tabIndex={-1} /></label></div>
        </fieldset>
        <p className="feedback-provider">Ao enviar, a mensagem e os campos preenchidos serão processados pelo <a href="https://formspree.io/legal/privacy-policy/" target="_blank" rel="noreferrer">Formspree</a> e encaminhados por e-mail a Fernando. Preencha nome e e-mail somente se quiser uma resposta.</p>
        {error && <p role="alert" className="feedback-error">{error}</p>}
        <p role="status" aria-live="polite" className="feedback-status">{status === 'sending' ? 'Enviando… Você pode fechar esta janela; o envio continuará.' : status === 'success' ? 'Mensagem recebida pelo serviço. Obrigado pela contribuição!' : ''}</p>
        <button className="feedback-submit" type="submit" disabled={!enabled || status === 'sending'}>{status === 'sending' ? 'Enviando…' : 'Enviar mensagem'}</button>
        <small className="feedback-session">O rascunho fica só nesta página e se perde ao recarregar ou sair do painel.</small>
      </form>
    </dialog>, document.body)}
  </>
}
