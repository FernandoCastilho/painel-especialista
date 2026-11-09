import { useEffect, useRef, useState } from 'react'
import './AvisoInicial.css'
import { ENTRIES } from './Novidades.jsx'
import { novidadesDaSemana } from './novidadesSemana.js'

// Aviso exibido a cada entrada no aplicativo (não a cada troca de aba). Navegador automatizado (testes) não o recebe,
// para não cobrir a tela dos smokes; o smoke próprio do aviso desliga essa exceção.
export default function AvisoInicial({ onDismiss }) {
  const [open, setOpen] = useState(() => !(typeof navigator !== 'undefined' && navigator.webdriver))
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!open || !el) return undefined
    el.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { el.close(); document.body.style.overflow = previous }
  }, [open])
  if (!open) return null
  const fechar = () => { setOpen(false); onDismiss?.() }
  const semana = novidadesDaSemana(ENTRIES)
  return (
    <dialog ref={ref} className="aviso-inicial" aria-labelledby="aviso-inicial-title" aria-describedby="aviso-inicial-text" onCancel={(e) => { e.preventDefault(); fechar() }}>
      <h2 id="aviso-inicial-title">Aviso</h2>
      <div id="aviso-inicial-text">
        <p>Aplicativo educacional, com informação ilustrativa. Não é recomendação de crédito.</p>
        <ul className="aviso-fontes">
          <li><b>Quase ao vivo:</b> câmbio, a cada poucos minutos em dias úteis (9h30 às 18h), sem garantia de tempo real.</li>
          <li><b>Diário:</b> curvas de juros da B3, uma referência por dia útil.</li>
          <li><b>Semanal:</b> Focus, às segundas.</li>
          <li><b>Manual:</b> projeções dos bancos, conferidas à mão; cada uma mostra a sua data.</li>
        </ul>
      </div>
      {semana.length > 0 && (
        <div className="aviso-novidades">
          <h3>Novidades da semana</h3>
          <ul>{semana.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <button type="button" className="btn" autoFocus onClick={fechar}>Entendi</button>
    </dialog>
  )
}
