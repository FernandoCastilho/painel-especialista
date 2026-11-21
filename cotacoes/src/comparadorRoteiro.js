// Roteiro da Necessidade do Cliente (21/11/2026): 1 Demanda, 2 Encargos, 3 Linha do tempo, 4 Resultado.
// Só apresentação: monta a linha do tempo da demanda comum.
// Nenhuma regra de cálculo mora aqui; prazo, carência e parcelas vêm da regra já usada pela linha mestra (lmSchedule).
import { lmSchedule } from './linhaMestra.js'
import { addMonths, SYSTEM_OPTIONS } from './creditModalities.js'
import { dmy } from './format.js'

const months = n => `${n} ${n === 1 ? 'mês' : 'meses'}`

// Coluna de giro (ou outra modalidade) sem prazo, carência nem amortização próprios: paga nas datas da demanda comum.
export const followsDemand = col => ['giro-pre', 'giro-cdi', 'outra'].includes(col.modality) && !col.term.trim() && !col.grace.trim() && !col.system

// Momentos da operação pela demanda comum: liberação, carência, parcelas e quitação. Sem valores em reais, porque cada
// operação tem os seus. `paid` traz o primeiro e o último vencimento de uma operação que segue a demanda (já no dia útil
// que a conta apurou); sem ela, valem as datas do calendário: liberação + carência + 1 mês e, daí, de mês em mês.
// Devolve null quando prazo, carência ou data da liberação não formam um cronograma.
export function demandTimeline(shared, paid) {
  const schedule = lmSchedule(shared)
  const baseFirst = schedule.ok ? addMonths(shared.start, schedule.dueMonths) : null
  const baseLast = baseFirst && addMonths(baseFirst, schedule.n - 1)
  if (!baseLast) return null
  const first = dmy(paid?.first ?? baseFirst), last = dmy(paid?.last ?? baseLast)
  const release = { label: 'Liberação', when: dmy(shared.start), value: 'Dinheiro no caixa', note: 'O valor líquido de cada operação está no resultado' }
  const term = `Prazo de ${months(schedule.term)}`
  if (shared.system === 'bullet') return [release,
    { label: 'Vencimento único', when: last, value: term, note: 'Principal e juros pagos de uma vez, no fim do prazo' }]
  return [release,
    { label: 'Carência', empty: schedule.grace === 0, when: `1ª parcela em ${first}`,
      value: schedule.grace ? months(schedule.grace) : 'Sem carência',
      note: schedule.grace ? 'Sem amortização do principal no período' : 'Não há período sem pagamento' },
    { label: 'Parcelas', when: schedule.n === 1 ? first : `de ${first} a ${last}`,
      value: schedule.n === 1 ? '1 parcela' : `${schedule.n} parcelas mensais`,
      note: `Amortização ${SYSTEM_OPTIONS.find(([id]) => id === shared.system)?.[1] ?? shared.system}` },
    { label: 'Quitação', when: last, value: term, note: 'Último vencimento' }]
}
