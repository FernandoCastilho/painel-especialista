import { parseMoneyInput } from './moneyInput.js'
import { simulateCbsCash } from './cbsCash.js'

export const CBS_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Independent scenarios: no accumulation of cash or credit balances between months.
export function buildCbsAnnual(revenue, overrides, inputs) {
  return CBS_MONTHS.map((month, index) => {
    const value = overrides[index] ?? revenue
    const parsed = parseMoneyInput(value)
    const result = simulateCbsCash({ ...inputs, revenue: parsed.ok ? parsed.value : NaN })
    return { month, value, revenue: parsed.ok ? parsed.value : NaN, result }
  })
}
