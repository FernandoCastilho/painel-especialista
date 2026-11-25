// Envelope do Outlook usado no Capital de Giro e no CDC.
// `copiar`: cronograma completo que não coube no rascunho; vai para a área de transferência no clique, para colar no e-mail.
// Se a cópia falhar, `onFalha` avisa na tela (o rascunho abre mesmo assim, com o resumo das parcelas).
export default function EmailEnvelope({ href, copiar, onFalha }) {
  const label = 'Preparar e-mail com o resultado'
  const onClick = copiar ? () => {
    const copia = navigator.clipboard?.writeText(copiar)
    if (copia) copia.then(() => onFalha(false), () => onFalha(true)); else onFalha(true)
  } : undefined
  return <a className="credit-email giro-email" role="link" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
    aria-label={label} aria-disabled={href ? undefined : true} title={href ? label : 'Gere um resultado válido para preparar o e-mail'}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" />
    </svg>
  </a>
}
