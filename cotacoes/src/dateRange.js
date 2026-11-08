// Lógica pura do seletor de intervalo. Valores são texto ISO ('AAAA-MM-DD' no modo dia, 'AAAA-MM' no modo mês):
// a comparação lexicográfica equivale à cronológica e dispensa fuso horário.
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const monthName = (m) => MONTHS[m]
export const monthShort = (m) => SHORT[m]
const p2 = (n) => String(n).padStart(2, '0')

export const monthKey = (y, m) => `${y}-${p2(m + 1)}`
export const dayKey = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`
export const parts = (v) => {
  const [y, m, d] = String(v).split('-').map(Number)
  return { y, m: m - 1, d: d || 1 }
}
export const valid = (v, mode) => {
  if (!(mode === 'month' ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-\d{2}-\d{2}$/).test(String(v ?? ''))) return false
  const { y, m, d } = parts(v)
  return mode === 'month' || (m >= 0 && m < 12 && d >= 1 && d <= new Date(y, m + 1, 0).getDate())
}

// Texto curto do botão: dd/mm/aa ou mmm/aa.
export function short(v, mode) {
  if (!valid(v, mode)) return '—'
  const { y, m, d } = parts(v)
  return mode === 'month' ? `${SHORT[m]}/${String(y).slice(2)}` : `${p2(d)}/${p2(m + 1)}/${String(y).slice(2)}`
}
export function long(v, mode) {
  const { y, m, d } = parts(v)
  return mode === 'month' ? `${MONTHS[m]} de ${y}` : `${d} de ${MONTHS[m]} de ${y}`
}

// Células de um mês, começando no domingo: null = vazio antes do dia 1.
export function monthCells(y, m) {
  const lead = new Date(y, m, 1).getDay(), count = new Date(y, m + 1, 0).getDate()
  return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => dayKey(y, m, i + 1))]
}

export const clamp = (v, min, max) => (min && v < min ? min : max && v > max ? max : v)
export const outside = (v, min, max) => (min != null && v < min) || (max != null && v > max)

// Soma n dias/meses a um valor ISO.
export function shift(v, mode, n) {
  const { y, m, d } = parts(v)
  if (mode === 'month') { const t = y * 12 + m + n; return monthKey(Math.floor(t / 12), ((t % 12) + 12) % 12) }
  const dt = new Date(y, m, d + n, 12)
  return dayKey(dt.getFullYear(), dt.getMonth(), dt.getDate())
}
export function shiftMonth(v, mode, n) {
  const { y, m, d } = parts(v)
  if (mode === 'month') return monthKey(y + n, m)
  const last = new Date(y, m + n + 1, 0).getDate(), t = y * 12 + m + n
  return dayKey(Math.floor(t / 12), ((t % 12) + 12) % 12, Math.min(d, last))
}

// A troca de mês/ano mantém uma célula válida como entrada do teclado.
export function navigateCalendarView(view, focus, mode, n, min, max) {
  return {
    view: clamp(shiftMonth(view, mode, n), min, max),
    focus: clamp(shiftMonth(valid(focus, mode) ? focus : view, mode, n), min, max),
  }
}

// Segundo clique: ordena o par (clicar numa data anterior ao início inverte) e devolve [início, fim].
export const pair = (anchor, v) => (v < anchor ? [v, anchor] : [anchor, v])

// Intervalo em destaque: durante a escolha, âncora até a data sob o cursor; fora dela, o intervalo aplicado.
export function preview({ anchor, hover, start, end }) {
  if (anchor) return pair(anchor, hover ?? anchor)
  return [start, end]
}

// Digitação no calendário: "dd/mm/aaaa" (ou dd/mm/aa, com ponto ou hífen; também só os dígitos) e, no modo mensal, "mm/aaaa".
const fullYear = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y))
export function parseTyped(text, mode) {
  const t = String(text ?? '').trim()
  if (mode === 'month') {
    const m = t.match(/^(\d{1,2})[/.-](\d{2}|\d{4})$/) || t.match(/^(\d{2})(\d{4})$/)
    if (!m) return null
    const v = monthKey(fullYear(m[2]), Number(m[1]) - 1)
    return valid(v, mode) ? v : null
  }
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/) || t.match(/^(\d{2})(\d{2})(\d{4}|\d{2})$/)
  if (!m) return null
  const v = dayKey(fullYear(m[3]), Number(m[2]) - 1, Number(m[1]))
  return valid(v, mode) ? v : null
}
// Máscara enquanto digita só números: 31102026 → 31/10/2026 (102026 → 10/2026 no modo mensal).
export function maskTyped(text, mode) {
  const s = String(text ?? '')
  if (!/^[\d/]*$/.test(s)) return s
  const d = s.replace(/\D/g, '').slice(0, mode === 'month' ? 6 : 8)
  return mode === 'month' ? (d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d)
    : d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
export function typedText(v, mode) {
  if (!valid(v, mode)) return ''
  const { y, m, d } = parts(v)
  return mode === 'month' ? `${p2(m + 1)}/${y}` : `${p2(d)}/${p2(m + 1)}/${y}`
}
