// Detalhamento local sem outro diálogo ou botão de maximizar.
export default function BndesDetails({ title, children, className = '' }) {
  return <details className={`expandable-panel bndes-details ${className}`} data-painel={title}>
    <summary className="expandable-heading">{title}</summary>
    <div className="expandable-content">{children}</div>
  </details>
}
