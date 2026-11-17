// Número que "rola": quando um valor da tela muda, os valores intermediários entre o antigo e o novo aparecem por menos de meio segundo.
// Só vale entre dois textos com o mesmo formato (mesmas casas decimais, mesmo prefixo e sufixo); senão, o valor novo entra direto.
const PARTS = /^(\D*?)(-?\d[\d.]*)(?:,(\d+))?(\D*)$/
function parse(text) {
  const m = PARTS.exec(String(text ?? ''))
  if (!m) return null
  const decimals = m[3]?.length ?? 0
  const value = Number(`${m[2].replace(/\./g, '')}${decimals ? `.${m[3]}` : ''}`)
  return Number.isFinite(value) ? { prefix: m[1], value, decimals, suffix: m[4], grouped: m[2].includes('.') } : null
}

// Plano da passagem de `from` para `to`: `at(p)`, com p de 0 a 1, devolve o texto daquele instante. `at(1)` é sempre o texto novo, sem refazer a conta.
export function rollPlan(from, to) {
  if (from === to) return null
  const a = parse(from), b = parse(to)
  if (!a || !b || a.decimals !== b.decimals || a.prefix !== b.prefix || a.suffix !== b.suffix || a.value === b.value) return null
  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: b.decimals, maximumFractionDigits: b.decimals, useGrouping: b.grouped || a.grouped })
  return {
    up: b.value > a.value,
    at: (p) => (p >= 1 ? String(to) : `${b.prefix}${fmt(a.value + (b.value - a.value) * Math.max(0, p))}${b.suffix}`),
  }
}
