import { captureBndesPresentation } from './bndesPresentation.js'
import { vencimentoDia15 } from './finameMateriais.js'

export const BNDES_PRINT_NOTICE = 'Simulação indicativa, sujeita à análise e aprovação da instituição financeira. Não constitui proposta, oferta, garantia de aprovação ou compromisso de crédito. Não é documento emitido pelo BNDES. O CET indicado é estimado com os encargos informados; o CET do contrato prevalece.'
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
const isoDay = value => [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')

// Copia o motor já calculado. Usa o vencimento do próprio cronograma (que já considera a praça do contrato);
// sem ele, associa o calendário ilustrativo da tela.
// A impressão nunca busca uma taxa nova, recalcula ou completa valores ausentes com zero.
export function captureBndesPrint({ result, comparison, conditions, compareRequested = false, releaseDate, holidayCtx }, capturedAt = Date.now()) {
  const snapshot = captureBndesPresentation({ result, comparison, conditions }, capturedAt)
  if (!snapshot || !(releaseDate instanceof Date) || !Number.isFinite(releaseDate.getTime())) return null
  if (compareRequested && snapshot.alternatives.length !== 2) return null
  const choices = compareRequested ? snapshot.alternatives : [{ custo: conditions.custo, quote: snapshot.conditions.quote, rate: conditions.rate, result }]
  const numberKeys = ['financiado', 'liberado', 'recursosProprios', 'primeiraParcela', 'ultimaParcela', 'juros', 'jurosCarencia', 'iof', 'iofFixo', 'tac', 'total', 'taxa']
  if (!Number.isInteger(conditions.prazo) || conditions.prazo < 1 || !choices.every(item => numberKeys.every(key => Number.isFinite(item.result[key])) && (!item.result.fgi || Number.isFinite(item.result.fgi.ecg)) && Array.isArray(item.result.parcelas) && item.result.parcelas.length === conditions.prazo && item.result.parcelas.every((row, index) => row.mes === index + 1 && ['saldoInicial', 'juros', 'amortizacao', 'parcela', 'pago', 'saldo'].every(key => Number.isFinite(row[key]))))) return null
  return freeze(structuredClone({
    ...snapshot,
    notice: BNDES_PRINT_NOTICE,
    releaseDate: isoDay(releaseDate),
    choices: choices.map(item => ({ ...item, upfront: item.result.iof + item.result.tac + (item.result.fgi && !item.result.fgi.incorporado ? item.result.fgi.ecg : 0), schedule: item.result.parcelas.map(row => ({ ...row, pago: row.parcela, date: row.vencimento ?? isoDay(vencimentoDia15(releaseDate, row.mes, holidayCtx)) })) })),
  }))
}
