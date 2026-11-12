// Tabelas das curvas de juros na aba Juros: só organiza para leitura as taxas já coletadas, sem conta nova.
// Brasil (prazo em dias úteis): prazos padrão lidos pela mesma interpolação linear da leitura do cupom (nunca extrapola).
// EUA e euro (um ponto por vencimento): o próprio vencimento publicado, casado pelo prazo exato em cada data.
import { interp } from './cupom.js'

export const PRAZOS_BR = [
  { du: 21, label: '1 mês' },
  { du: 63, label: '3 meses' },
  { du: 126, label: '6 meses' },
  { du: 252, label: '1 ano' },
  { du: 504, label: '2 anos' },
  { du: 756, label: '3 anos' },
  { du: 1260, label: '5 anos' },
  { du: 2520, label: '10 anos' },
]

const dia = (iso) => iso.split('-').reverse().join('/')

// "3 Mo", "1 Yr", "10 Yr" (Tesouro dos EUA) e "3M", "30A" (curva do euro) em português; rótulo fora desse formato fica como veio.
export function prazoEmPortugues(label) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(mo|m|yr|y|a)s?\.?\s*$/i.exec(label ?? '')
  if (!m) return label ?? ''
  const n = Number(m[1].replace(',', '.'))
  const texto = n.toLocaleString('pt-BR')
  return /^m/i.test(m[2]) ? `${texto} ${n === 1 ? 'mês' : 'meses'}` : `${texto} ${n === 1 ? 'ano' : 'anos'}`
}

// set: { compare: [{ date, label }], curves: { [date]: [[prazo, taxa, rótulo?]] } }; mode: 'br' (dias úteis) ou 'us' (vencimentos).
// Devolve { columns: [{ date, label, small }], rows: [{ id, name, sub, values: [taxa | null] }] }.
export function curveTable(set, mode) {
  const compare = (set?.compare ?? []).filter((c) => Array.isArray(set?.curves?.[c.date]) && set.curves[c.date].length)
  if (!compare.length) return { columns: [], rows: [] }
  const columns = compare.map((c) => ({ date: c.date, label: c.label, small: dia(c.date) }))
  const curvas = compare.map((c) => set.curves[c.date])
  const base = mode === 'us'
    ? [...curvas[0]].sort((a, b) => a[0] - b[0]).map((p) => ({ id: String(p[0]), name: prazoEmPortugues(p[2]), sub: '', read: (pts) => pts.find((q) => q[0] === p[0])?.[1] ?? null }))
    : PRAZOS_BR.map((h) => ({ id: String(h.du), name: h.label, sub: `${h.du} dias úteis`, read: (pts) => interp(pts, h.du) }))
  const rows = base
    .map(({ read, ...r }) => ({ ...r, values: curvas.map((pts) => { const v = read(pts); return Number.isFinite(v) ? v : null }) }))
    .filter((r) => r.values[0] != null) // prazo fora da curva mais recente não entra
  return { columns, rows }
}
