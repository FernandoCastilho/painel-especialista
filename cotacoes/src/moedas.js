// Apresentação da TFC e das moedas contratuais do BNDES (arquivo moedas.json, coletado de /Moedas/um<código>.txt).
// O catálogo espelha scripts/moedas-lib.mjs (um teste trava a igualdade).
import { change } from './bndes.js'
import { nf, dmy, shiftMonths, atOrBefore } from './format.js'
import { JUMP_HINT, isJump } from './jumps.js'

export const TFC_SERIES = [
  ['C01', 'TFC_60.90'], ['C02', 'TFC_120.90'], ['C03', 'TFC_MPME_60.90'], ['C04', 'TFC_MPME_120.90'], ['C05', 'TFC_TR_60.90'], ['C06', 'TFC_TR_120.90'],
  ['C07', 'TFC_DIR_60_40_PMA66'], ['C08', 'TFC_CAM_PF_NOV'], ['C09', 'TFC_CAM_PF_SNV'], ['C10', 'TFC_CAM_PJ_REC'], ['C11', 'TFC_CAM_PJ_NOV'],
  ['C12', 'TFC_SOB_GRANDE_60.90'], ['C13', 'TFC_SOB_MPME_60.90'], ['C14', 'TFC_SOB_AEX'], ['C15', 'TFC_TR_MPME_60'], ['C16', 'TFC_TR_MPME_120'],
  ['C17', 'TFC_TR_GRANDE_60'], ['C18', 'TFC_TR_GRANDE_120'], ['C20', 'TFC_TR_MPME_DIR_108M'], ['C22', 'TFC_TR_GR_DIR_108'],
  ['C23', 'TFC_MOB_FR_REC_60.90'], ['C24', 'TFC_MOB_FR_NV_60.90'], ['C25', 'TFC_MOB_ONIB_REC_120'], ['C26', 'TFC_MOB_ONIB_NV_120'],
]
export const MOEDAS_SERIES = [
  { id: '604', name: 'US$', kind: 'level', unit: 'R$', note: 'Dólar norte-americano' },
  { id: '143', name: 'SELIC ACUM. D-2', kind: 'level', unit: 'índice', note: 'Índice acumulado do BNDES, com Selic defasada em dois dias úteis. Não é taxa anual nem código de série SGS/BCB.' },
  { id: 'LD1', name: 'SOBRETAXA LCD', kind: 'rate', unit: '% a.a.', note: 'Sobretaxa LCD para operações indiretas, fixa na contratação; referências para novas contratações atualizadas trimestralmente. Pode ser negativa.' },
  { id: '024', name: 'SOBRETAXA FIXA SELIC', kind: 'rate', unit: '% a.a.', note: 'Sobretaxa fixa para contratos indexados à Selic' },
  { id: '236', name: 'TLP-IPCA', kind: 'pct', unit: '% no mês', note: 'Componente IPCA da TLP' },
  { id: 'TR1', name: 'TFBTR60.90', kind: 'rate', unit: '% a.a.', note: 'TFB baseada em TR, 60 meses, liberação em 90 dias' },
  { id: 'TR2', name: 'TFBTR120.90', kind: 'rate', unit: '% a.a.', note: 'TFB baseada em TR, 120 meses, liberação em 90 dias' },
  { id: 'TD1', name: 'TFBD24.120', kind: 'rate', unit: '% a.a.', note: 'Taxa Fixa BNDES em Dólar (TFBD), operações indiretas, prazo total até 24 meses, liberação em até 120 dias. O saldo ainda varia com o dólar (moeda 604).' },
  { id: 'TD2', name: 'TFBD72.120', kind: 'rate', unit: '% a.a.', note: 'Taxa Fixa BNDES em Dólar (TFBD), operações indiretas, prazo total acima de 24 e até 72 meses, liberação em até 120 dias. O saldo ainda varia com o dólar (moeda 604).' },
  { id: 'TD3', name: 'TFBD120.120', kind: 'rate', unit: '% a.a.', note: 'Taxa Fixa BNDES em Dólar (TFBD), operações indiretas, prazo total acima de 72 e até 120 meses, liberação em até 120 dias. O saldo ainda varia com o dólar (moeda 604).' },
]
export const GROUPS = {
  tfc: TFC_SERIES.map(([id, name]) => ({ id, name, kind: 'rate', unit: '% a.a.', note: `Série ${name} (código ${id})` })),
  moedas: MOEDAS_SERIES,
}
export const TFC_DEFINICAO = 'Séries TFC publicadas pelo BNDES em Moedas Contratuais, uma por produto, porte e prazo (siglas e códigos C01 a C26 como na tabela do BNDES; o banco não detalha a sigla na consulta). Em % ao ano; valor diário em dia útil.'
export const MOEDAS_DEFINICAO = 'Moedas e indicadores contratuais usados em contratos do BNDES, com o código da tabela de Moedas Contratuais: dólar (604), índice Selic acumulada D-2 úteis (143), sobretaxa LCD para operações indiretas (LD1), sobretaxa fixa Selic (024), TLP-IPCA (236), as TFB baseadas em TR (TR1 e TR2) e a Taxa Fixa BNDES em Dólar das operações indiretas (TFBD: TD1 até 24 meses, TD2 até 72 e TD3 até 120). A TFBD é só a taxa em % ao ano; o saldo do contrato também acompanha o dólar (604). LD1 é uma taxa anual fixa na contratação, não o custo total; a série acompanha as referências trimestrais para novas contratações. A sobretaxa pode ser negativa.'

// Variação percentual com seta (níveis: dólar, índice da Selic); null quando falta a referência.
// id: código da série quando a variação é a de um dia (só ela leva o selo de salto).
export function changePct(value, ref, id = null) {
  if (!Number.isFinite(value) || !ref || !ref[1]) return null
  const diff = (value / ref[1] - 1) * 100
  const flat = Math.abs(diff) < 0.005
  return { diff, ref: ref[0], dir: flat ? 'same' : diff > 0 ? 'up' : 'down', text: flat ? '= 0,00%' : `${diff > 0 ? '▲ +' : '▼ −'}${nf(Math.abs(diff), 2)}%`, jump: id != null && isJump('level', diff, id), hint: JUMP_HINT }
}
// Pontos até `now` (dia de São Paulo): o BNDES publica valores de datas futuras (Selic acumulada de amanhã, TR do mês seguinte)
// e o valor vigente hoje é o último com data até hoje.
const today = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
export const pointsOf = (data, id, now = Date.now()) => (Array.isArray(data?.series?.[id]?.points) ? data.series[id].points.filter((p) => p[0] <= today(now)) : [])
const decimals = (s) => (s.id === 'LD1' ? 6 : s.kind === 'level' ? (s.id === '143' ? 6 : 4) : 2)

// LD1 publica vigências, não observações diárias. Preserve a última mudança
// efetiva entre duas vigências, sem rotulá-la como variação de dia/mês/ano.
function lastLcdChange(points) {
  for (let i = points.length - 1; i > 0; i--) {
    const [date, value] = points[i], [ref, previous] = points[i - 1]
    if (value === previous) continue
    const diff = value - previous
    return { diff, ref, date, dir: diff > 0 ? 'up' : 'down', text: `${diff > 0 ? '▲ +' : '▼ −'}${nf(Math.abs(diff), 6)} p.p.`, jump: false }
  }
  return null
}

// Linhas de um grupo: último valor, data e variações periódicas quando aplicáveis; série ausente fica marcada.
export function groupRows(data, group, now = Date.now()) {
  return GROUPS[group].map((s) => {
    const points = pointsOf(data, s.id, now)
    if (!points.length) return { ...s, missing: true }
    const [date, value] = points.at(-1)
    const lcd = s.id === 'LD1'
    const delta = s.kind === 'level' ? (v, r, day) => changePct(v, r, day ? s.id : null) : (v, r, day) => change(v, r, day ? s.kind : null)
    return { ...s, date, value, text: s.kind === 'rate' ? `${nf(value, decimals(s))}% a.a.` : s.kind === 'pct' ? `${nf(value, 2)}%` : `${s.unit === 'R$' ? 'R$ ' : ''}${nf(value, decimals(s))}`, day: lcd ? null : delta(value, points.length > 1 ? points.at(-2) : null, true), month: lcd ? null : delta(value, atOrBefore(points, shiftMonths(date, -1))), year: lcd ? null : delta(value, atOrBefore(points, shiftMonths(date, -12))), ...(lcd ? { lastChange: lastLcdChange(points) } : {}), stale: data?.stale?.[s.id] ?? null, points: points.length }
  })
}
export { dmy }
