import { useState } from 'react'
import { bndesEmailLink } from './bndesEmail.js'

export default function EmailEnvelope({ result, alternatives }) {
  const [notice, setNotice] = useState('')
  const email = bndesEmailLink({ result, alternatives })
  const copy = async event => {
    if (!email.requiresCopy) return
    event.preventDefault()
    try { await navigator.clipboard.writeText(email.fullText); setNotice('Cronograma completo copiado.') }
    catch { setNotice('Não foi possível copiar o cronograma completo.') }
  }
  return <span className="bndes-email"><a className="credit-email" href={email.href} onClick={copy} aria-label="Preparar e-mail da cotação" title="Preparar e-mail da cotação">✉</a>{notice && <small role="status">{notice}</small>}</span>
}
