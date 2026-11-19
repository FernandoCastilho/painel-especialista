import './CalcBack.css'

// Ícone pequeno de voltar, dentro do cabeçalho da calculadora, ao lado do nome. Leva à lista de calculadoras.
export default function CalcBack({ onBack }) {
  if (!onBack) return null
  return (
    <button type="button" className="calc-back" onClick={onBack} aria-label="Voltar para a lista de calculadoras" title="Voltar para a lista de calculadoras">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  )
}
