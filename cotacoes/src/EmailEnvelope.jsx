import { useState } from 'react'
import { bndesEmailLink } from './bndesEmail.js'

// Mesmo ícone e comportamento do envelope do Capital de Giro: aviso na tela só quando a cópia falha.
export default function EmailEnvelope({ result, alternatives }) {
  const [notice, setNotice] = useState('')
  const email = bndesEmailLink({ result, alternatives })
  const copy = async () => {
    if (!email.requiresCopy) return
    try { await navigator.clipboard.writeText(email.fullText); setNotice('') }
    catch { setNotice('O navegador não deixou copiar o cronograma para o e-mail. Copie de "Parcelas da operação".') }
  }
  return <span className="bndes-email"><a className="credit-email" href={email.href} target="_blank" rel="noopener noreferrer" onClick={copy} aria-label="Preparar e-mail da cotação" title="Preparar e-mail da cotação"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg></a>{notice && <small role="alert">{notice}</small>}</span>
}
