// Ícones próprios da interface; não reproduzem a marca oficial do BNDES.
export default function BndesIcon({ kind = 'calculator' }) {
  const paths = {
    calculator: <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 10h1m3 0h1m3 0h.01M8 14h1m3 0h1m3 0h.01M8 18h1m3 0h1m3 0h.01" /></>,
    operation: <><ellipse cx="15" cy="5" rx="6" ry="3" /><path d="M9 5v5c0 4 12 4 12 0V5M12 15c4 1 9-1 9-3v-2" /><ellipse cx="8" cy="14" rx="6" ry="3" /><path d="M2 14v5c0 4 12 4 12 0v-5M2 17c0 4 12 4 12 0" /></>,
    costs: <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M3 21 21 3" /></>,
    payment: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 2v6M17 2v6M3 11h18M7 15h2m3 0h2m3 0h.01M7 18h2m3 0h2" /></>,
    chart: <><path d="M3 21h4V13H3zM10 21h4V8h-4zM17 21h4V3h-4z" /></>,
    expand: <><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6M3 3l7 7M21 3l-7 7M3 21l7-7M21 21l-7-7" /></>,
    collapse: <><path d="M4 10h6V4M20 10h-6V4M4 14h6v6M20 14h-6v6M10 10 3 3M14 10l7-7M10 14l-7 7M14 14l7 7" /></>,
    print: <><path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6zM17 11h1" /></>,
  }
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] || paths.calculator}</svg>
}
