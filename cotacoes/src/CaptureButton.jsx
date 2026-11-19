import { useRef, useState } from 'react'
import { copyCapture } from './captureImage.js'
import './CaptureButton.css'
export default function CaptureButton({ getTarget, label = 'gráfico' }) {
  const button = useRef(null)
  const [busy,setBusy] = useState(false)
  const [status,setStatus] = useState('')
  const copy = async e => {
    e.stopPropagation()
    if (busy) return
    setBusy(true);setStatus('')
    try {
      const target = getTarget ? getTarget() : button.current?.closest('[data-capture-surface], article.chart, .chart, .expandable-panel')
      await copyCapture(target)
      setStatus(target?.querySelector('iframe,video') ? 'Imagem copiada com aviso: conteúdo externo não incluído. Cole com Ctrl+V.' : 'Imagem copiada. Cole com Ctrl+V.')
    } catch (error) { setStatus(error.name === 'NotAllowedError' ? 'Cópia não autorizada pelo navegador. Confira a permissão da área de transferência e tente novamente.' : error.message || 'Não foi possível copiar. Confira a permissão da área de transferência.') }
    finally { setBusy(false) }
  }
  return <span className="capture-action" data-capture-ignore>
    <button ref={button} type="button" className="capture-button" disabled={busy} onClick={copy} aria-label={`Copiar imagem: ${label}`} title={`Copiar imagem de ${label} para a área de transferência`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v14H3z"/><circle cx="12" cy="13" r="4"/></svg>
    </button>
    {status && <span role="status" className="capture-status">{status}</span>}
  </span>
}
