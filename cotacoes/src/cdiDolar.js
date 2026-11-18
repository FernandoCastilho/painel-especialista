// CDI x Dólar: em quantos dias úteis o ganho LÍQUIDO de uma aplicação em % do CDI alcança a alta do dólar
// entre o câmbio atual e o câmbio alvo de saída.
//
// Regras copiadas da planilha "Simulador_Dolar_x_CDI_Liquido" (abas Simulador, Fórmulas e Motor), enviada por Fernando em 18/11/2026:
// - Oscilação necessária = câmbio alvo ÷ câmbio atual − 1.
// - CDI diário = (1 + CDI a.a.)^(1/252) − 1; retorno diário do produto = CDI diário × % do CDI.
// - Rentabilidade bruta em n dias úteis = (1 + retorno diário)^n − 1.
// - Dias corridos estimados = arredondar para cima(n × 7/5); data final = data de início + dias corridos.
// - IOF: tabela regressiva até 29 dias corridos; zero a partir de 30. IR renda fixa: 22,5% até 180 dias; 20% de 181 a 360;
//   17,5% de 361 a 720; 15% acima de 720 (dias corridos estimados).
// - Ganho líquido = ganho bruto × (1 − IOF) × (1 − IR) (o IR incide sobre o rendimento já descontado do IOF).
// - Prazo necessário = primeiro dia útil em que ganho líquido ÷ valor aplicado ≥ oscilação necessária. Busca até 5.000 dias úteis.
import { iofRate, irRate } from './aplicacaoPj.js'

export const MAX_BUSINESS_DAYS = 5000
const DAY = 864e5

export const calendarDays = (n) => Math.ceil((n * 7) / 5)
export const addCalendarDays = (iso, days) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10)

// Resultado bruto e líquido no dia útil n.
export function returnAt(n, { amount, dailyProduct }) {
  const days = calendarDays(n)
  const gross = (1 + dailyProduct) ** n - 1
  const iof = iofRate(days)
  const ir = irRate(days, 'cdb-pos')
  const grossGain = amount * gross
  const netGain = grossGain * (1 - iof) * (1 - ir)
  return { n, days, gross, iof, ir, grossGain, netGain, grossValue: amount + grossGain, netValue: amount + netGain, net: netGain / amount }
}

function validate({ spot, target, amount, cdi, pct, start }) {
  if (!(Number.isFinite(spot) && spot > 0)) return 'Informe o dólar atual (R$ por US$ 1).'
  if (!(Number.isFinite(target) && target > 0)) return 'Informe o dólar alvo de saída (R$ por US$ 1).'
  if (!(Number.isFinite(amount) && amount > 0)) return 'Informe o valor aplicado.'
  if (!(Number.isFinite(cdi) && cdi > 0 && cdi < 1)) return 'Informe o CDI ao ano, entre 0% e 100%.'
  if (!(Number.isFinite(pct) && pct > 0 && pct <= 5)) return 'Informe o percentual do CDI que o produto rende, entre 0% e 500%.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? '') || Number.isNaN(Date.parse(`${start}T12:00:00Z`))) return 'Informe a data de início.'
  return null
}

// Taxas em fração: cdi 0,1415 = 14,15% a.a.; pct 0,98 = 98% do CDI.
export function simulateCdiDolar(p) {
  const error = validate(p)
  if (error) return { ok: false, error }
  const { spot, target, amount, cdi, pct, start } = p
  const oscillation = target / spot - 1
  const dailyCdi = (1 + cdi) ** (1 / 252) - 1
  const dailyProduct = dailyCdi * pct
  const base = { ok: true, oscillation, variation: target - spot, dailyCdi, dailyProduct }
  // Dólar alvo igual ou abaixo do atual: a aplicação já supera o câmbio sem prazo mínimo.
  if (oscillation <= 0) return { ...base, already: true }
  for (let n = 1; n <= MAX_BUSINESS_DAYS; n++) {
    const r = returnAt(n, { amount, dailyProduct })
    if (r.net >= oscillation) return { ...base, ...r, end: addCalendarDays(start, r.days) }
  }
  return { ok: false, error: `Com essas taxas, o CDI líquido não alcança a alta do dólar em ${MAX_BUSINESS_DAYS.toLocaleString('pt-BR')} dias úteis (cerca de 20 anos).`, oscillation }
}

// Número decimal digitado no padrão brasileiro ("5,20", "14,15", "1.234,5") ou com ponto decimal simples ("5.2").
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(/\s|%|R\$/g, '')
  if (!t) return NaN
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t)
  if (/^(\d+|\d{1,3}(\.\d{3})+)(,\d+)?$/.test(t)) return Number(t.replaceAll('.', '').replace(',', '.'))
  return NaN
}
