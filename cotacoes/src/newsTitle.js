// Tira do fim da manchete a assinatura que o agregador cola no título ("... Por Investing.com", "... - Investing.com").
// Só mexe no fim; se a manchete for só a assinatura, devolve como veio.
const SOBRA_AGREGADOR = /\s*(?:[-–—|·:]\s*|\s(?:por|by)\s+)investing\.com(?:\s+(?:brasil|brazil|br))?\s*\.?\s*$/i
export function limparManchete(title) {
  if (typeof title !== 'string') return title
  const limpo = title.replace(SOBRA_AGREGADOR, '').trim()
  return limpo || title
}
