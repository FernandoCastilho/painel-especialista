import CaptureButton from './CaptureButton.jsx'
import Help from './Help.jsx'
import { GLOSSARY } from './glossary.js'

// Botão "?" com a explicação do indicador ou gráfico (texto em glossary.js).
// `grafico`: o "?" está num gráfico; mostra também "Como ler o gráfico" (campo l do glossário).
export default function Explain({ id, align = 'left', fixed = false, tipo, grafico = false }) {
  const g = GLOSSARY[id]
  if (!g) return null
  return (
    <>{grafico && <CaptureButton label={g.t} />}<Help label={`O que é: ${g.t}`} align={align} wide fixed={fixed}>
      <b className="ex-t">{g.t}</b>
      <span className="ex">{g.a}</span>
      {tipo && <span className="ex"><i>{tipo.t}:</i> {tipo.a}</span>}
      {grafico && g.l && <span className="ex ex-ler"><i>Como ler o gráfico:</i> {g.l}</span>}
      <span className="ex"><i>Exemplo:</i> {g.b}</span>
      <span className="ex"><i>Na prática:</i> {g.c}</span>
      {g.d && <span className="ex"><i>Para dominar:</i> {g.d}</span>}
    </Help></>
  )
}
