import { parseMoneyInput } from './moneyInput.js'
import { simulateCbsCash } from './cbsCash.js'

export const CBS_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Average balances at a steady, uniform rate; this is not a rolling cash forecast.
export function operatingWorkingCapital({ revenue, receiveDays, stockDays, payDays, monthlyCmv, monthlyPurchases }) {
  const required = [revenue, receiveDays, stockDays, payDays, monthlyCmv, monthlyPurchases]
  if (required.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0) || revenue <= 0 || revenue > 1e13) return null
  if ([receiveDays, stockDays, payDays].some(v => !Number.isInteger(v) || v > 365)) return null
  const receivables = revenue * receiveDays / 30
  const inventory = monthlyCmv * stockDays / 30
  const suppliers = monthlyPurchases * payDays / 30
  return { receivables, inventory, suppliers, total: receivables + inventory - suppliers }
}

// Independent scenarios: no accumulation of cash or credit balances between months.
export function buildCbsAnnual(revenue, overrides, inputs) {
  return CBS_MONTHS.map((month, index) => {
    const value = overrides[index] ?? revenue
    const parsed = parseMoneyInput(value)
    const result = simulateCbsCash({ ...inputs, revenue: parsed.ok ? parsed.value : NaN })
    return { month, value, revenue: parsed.ok ? parsed.value : NaN, result }
  })
}
