import { useEffect, useRef } from 'react'
import './AvisoInicial.css'
import { NOVIDADES_RECENTES } from './novidadesRecentes.js'
import { novidadesDaSemana } from './novidadesSemana.js'
import { AVISO_FONTES, AVISO_RESUMO, exibirAvisoAutomatico, marcarAvisoVisto } from './avisoInicial.js'

// Aviso de entrada. Quem decide quando abrir é o App: sozinho, na primeira entrada do dia em Brasília
// (avisoInicial.js); depois disso, pelo botão "Ver o aviso de entrada" na janela do "i". Navegador automatizado (testes) não o
// recebe sozinho, para não cobrir a tela dos smokes; os smokes do aviso desligam essa exceção.
export default function AvisoInicial({ modo, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!modo || !el) return undefined
    let cancelado = false
    let restaurar
    const abrir = () => {
      if (cancelado) return false
      const origem = document.activeElement
      el.showModal()
      const previous = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      restaurar = () => {
        el.close()
        document.body.style.overflow = previous
        if (origem?.isConnected && origem !== document.body && origem.getClientRects().length) origem.focus({ preventScroll: true })
      }
      return true
    }
    if (modo === 'automatico') {
      exibirAvisoAutomatico(abrir).then((abriu) => {
        if (!abriu && !cancelado) onClose()
      }).catch(() => {
        if (!cancelado && !el.open) onClose()
      })
    } else if (abrir()) marcarAvisoVisto()
    return () => { cancelado = true; restaurar?.() }
  }, [modo, onClose])
  if (!modo) return null
  const semana = novidadesDaSemana(NOVIDADES_RECENTES).slice(0, 5)
  return (
    <dialog ref={ref} className="aviso-inicial aviso-inicial-compacto" aria-labelledby="aviso-inicial-title" aria-describedby="aviso-inicial-text" onCancel={(e) => { e.preventDefault(); onClose() }}>
      <h2 id="aviso-inicial-title">Aviso</h2>
      <div id="aviso-inicial-text">
        <p>{AVISO_RESUMO}</p>
      </div>
      <div className="aviso-novidades">
        <h3>Novidades da semana</h3>
        {semana.length > 0 && <ul>{semana.map(r => <li key={r}>{r}</li>)}</ul>}
        <a href="#novidades" onClick={onClose}>Ver todas as atualizações</a>
      </div>
      <details className="aviso-fontes-detalhes">
        <summary>Fontes e atualização dos dados</summary>
        <ul className="aviso-fontes">
          {AVISO_FONTES.map(([rotulo, texto]) => <li key={rotulo}><b>{rotulo}:</b> {texto}</li>)}
        </ul>
      </details>
      <button type="button" className="btn" autoFocus onClick={onClose}>Entendi</button>
    </dialog>
  )
}
