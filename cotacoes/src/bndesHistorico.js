import { diRate, DU_PER_MONTH } from './spread.js'

export function bndesDiNoPrazo(br, prazo) {
  const data = br?.sourceDate || br?.compare?.[0]?.date
  const pontos = br?.curves?.[data]
  if (!data || !Array.isArray(pontos) || !Number.isFinite(prazo) || prazo <= 0) return null
  const taxa = diRate(pontos, prazo * DU_PER_MONTH)
  return taxa == null ? null : { data, taxa }
}
