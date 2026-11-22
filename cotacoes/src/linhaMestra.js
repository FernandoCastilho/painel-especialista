// Linha mestra: a necessidade do cliente, comum às calculadoras de empréstimo (Comparador de Crédito, Capital de Giro,
// Conta Garantida e Análise de desconto). Pedido do Fernando em 19/11/2026: o que se digita numa calculadora já aparece nas outras.
// Só guarda texto digitado; nenhuma regra de cálculo mora aqui.
// Fica na sessão do navegador (sessionStorage): some ao fechar a aba e nunca sai do aparelho.
import { PRACA_PADRAO, PRACAS_CONTRATO } from './pracaContrato.js'

export const LM_KEY = 'painel-linha-mestra'
export const LM_SYSTEMS = Object.freeze(['price', 'sac', 'bullet'])
// Padrão: 24 meses, sem carência (19/11/2026); valor de R$ 3.000.000,00 (pedido do Fernando em 21/11/2026; antes, R$ 1 milhão).
export const lmDefaults = today => ({ value: '3.000.000,00', term: '24', grace: '0', system: 'price', start: today, praca: PRACA_PADRAO })

const ISO = /^\d{4}-\d{2}-\d{2}$/
const text = (v, max = 40) => typeof v === 'string' && v.length <= max

// Aceita só o que tem o formato de cada campo. Data guardada anterior a hoje volta para hoje: a simulação é sempre de agora em diante.
export function lmSanitize(raw, today) {
  const base = lmDefaults(today)
  if (!raw || typeof raw !== 'object') return base
  const out = { ...base }
  if (text(raw.value) && /^[\d.,\s]*$/.test(raw.value)) out.value = raw.value
  if (text(raw.term, 4) && /^\d*$/.test(raw.term)) out.term = raw.term
  if (text(raw.grace, 4) && /^\d*$/.test(raw.grace)) out.grace = raw.grace
  if (LM_SYSTEMS.includes(raw.system)) out.system = raw.system
  if (text(raw.start, 10) && ISO.test(raw.start) && raw.start >= today) out.start = raw.start
  if (PRACAS_CONTRATO.some(p => p.id === raw.praca)) out.praca = raw.praca
  return out
}

const store = () => { try { return globalThis.sessionStorage ?? null } catch { return null } }

export function lmLoad(today) {
  try { return lmSanitize(JSON.parse(store()?.getItem(LM_KEY) ?? 'null'), today) } catch { return lmDefaults(today) }
}

export function lmSave(values) {
  try { store()?.setItem(LM_KEY, JSON.stringify(values)) } catch { /* navegador sem armazenamento: segue sem levar os valores */ }
}

export function lmClear() {
  try { store()?.removeItem(LM_KEY) } catch { /* idem */ }
}

// Regra do Comparador (decisão de 19/11/2026, vale também no Capital de Giro): prazo total em meses, carência em meses dentro do prazo.
// Parcelas = prazo − carência; 1º vencimento = liberação + carência + 1 mês. Bullet: pagamento único no fim do prazo.
export function lmSchedule({ term, grace, system }) {
  const t = /^\d+$/.test(String(term ?? '').trim()) ? Number(term) : null
  const g = String(grace ?? '').trim() === '' ? 0 : /^\d+$/.test(String(grace).trim()) ? Number(grace) : null
  if (t === null || t < 1 || t > 600) return { ok: false, error: 'Informe o prazo em meses, de 1 a 600.' }
  if (g === null || g < 0) return { ok: false, error: 'Informe a carência em meses (0 se não houver).' }
  if (system === 'bullet') return { ok: true, n: 1, dueMonths: t, term: t, grace: 0 }
  if (g >= t) return { ok: false, error: 'A carência precisa ser menor que o prazo.' }
  return { ok: true, n: t - g, dueMonths: g + 1, term: t, grace: g }
}
