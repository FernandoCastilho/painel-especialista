// Vários slides podem usar a mesma peça do painel, e cada peça traz identificadores fixos para ligar um quadro ao seu título
// (aria-labelledby, aria-describedby, rótulo de campo). Com a peça repetida na página, o leitor de tela anunciaria o título
// do primeiro slide em todos. Aqui cada slide ganha um prefixo próprio nos identificadores que são alvo dessas ligações.
// Só entram os identificadores referenciados dentro do próprio slide; os demais (e os de dentro de gráficos) ficam como estão.
const LIGACOES = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'for']
const SELETOR = LIGACOES.map((a) => `[${a}]`).join(',')

export function isolarIds(raiz, prefixo) {
  const alvos = new Set()
  const ligados = [...raiz.querySelectorAll(SELETOR)]
  for (const el of ligados) for (const a of LIGACOES) for (const id of (el.getAttribute(a) ?? '').split(/\s+/)) if (id && !id.startsWith(prefixo)) alvos.add(id)
  if (!alvos.size) return 0
  const trocas = new Map()
  for (const el of raiz.querySelectorAll('[id]')) {
    if (!alvos.has(el.id) || el.closest('svg')) continue
    trocas.set(el.id, prefixo + el.id)
    el.id = prefixo + el.id
  }
  if (!trocas.size) return 0
  for (const el of ligados) for (const a of LIGACOES) {
    const valor = el.getAttribute(a)
    if (!valor) continue
    const novo = valor.split(/\s+/).map((id) => trocas.get(id) ?? id).join(' ')
    if (novo !== valor) el.setAttribute(a, novo)
  }
  return trocas.size
}
