import FinimpHelp from './FinimpHelp.jsx'

// Uma única ajuda para as calculadoras: foco contido, Escape e retorno ao botão.
export default function CalculatorHelp({ title, label, trigger, children }) {
  const heading = (title || label || 'Informações da simulação').replace(/^Ajuda:\s*/, '')
  return <FinimpHelp title={heading} trigger={trigger}>{children}</FinimpHelp>
}
