// Ícone único de "ampliar" (duas setas em diagonal), usado em todos os gráficos e quadros que abrem maiores.
// Decorativo: o nome do botão vem do aria-label de quem usa.
export default function ExpandIcon({ size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" /><path d="M20 4l-7 7" /><path d="M10 20H4v-6" /><path d="M4 20l7-7" />
    </svg>
  )
}
