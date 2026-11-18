// Manchete do Mercado: uma frase curta montada só com os números que os quadros logo abaixo já mostram
// (os mesmos textos, da mesma leitura). Não calcula nada nem escreve texto livre. Sem o dólar, não há manchete.
// Devolve pedaços de texto; `tone` (up, down, flat) pinta a variação e `num` marca número.
export function manchete(items) {
  const by = Object.fromEntries((items ?? []).filter(Boolean).map((i) => [i.key, i]))
  const usd = by.USDBRL
  if (!usd?.value) return null
  const out = [{ text: 'Dólar a ' }, { text: usd.value, num: true }]
  if (usd.text) out.push({ text: ', ' }, { text: usd.text, num: true, tone: usd.tone }, { text: ' no dia' })
  out.push({ text: '.' })
  const ibov = by.IBOV
  if (ibov?.text && !ibov.stale) {
    out.push({ text: ' Ibovespa ' }, { text: ibov.text, num: true, tone: ibov.tone })
    if (ibov.note) out.push({ text: ` no fechamento de ${ibov.note}` })
    out.push({ text: '.' })
  }
  return out
}
