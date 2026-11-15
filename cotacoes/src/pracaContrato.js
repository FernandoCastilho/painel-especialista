// Praça do contrato nas calculadoras de crédito: escolhe os calendários de feriados (holidays.js) que adiam vencimentos.
// Só usa calendários já cadastrados no painel; nenhum feriado é criado aqui. O nacional (BR) entra sempre.
// Cidades paulistas do interior somam o feriado estadual de SP (09/07, calendário SPE) ao calendário da cidade.
import { CALENDARS } from './holidays.js'

export const PRACA_PADRAO = 'BR'
export const PRACAS_CONTRATO = Object.freeze([
  { id: 'BR', label: 'Nacional (BR)', calendars: ['BR'] },
  { id: 'SP', label: 'São Paulo · capital', calendars: ['BR', 'SP'] },
  { id: 'SPE', label: 'Estado de São Paulo · demais cidades', calendars: ['BR', 'SPE'] },
  { id: 'CPS', label: 'Campinas (SP)', calendars: ['BR', 'SPE', 'CPS'] },
  { id: 'SOR', label: 'Sorocaba (SP)', calendars: ['BR', 'SPE', 'SOR'] },
  { id: 'BAR', label: 'Barueri · Alphaville (SP)', calendars: ['BR', 'SPE', 'BAR'] },
  { id: 'MG', label: 'Belo Horizonte (MG)', calendars: ['BR', 'MG'] },
  { id: 'PR', label: 'Curitiba (PR)', calendars: ['BR', 'PR'] },
  { id: 'LDA', label: 'Londrina (PR)', calendars: ['BR', 'LDA'] },
  { id: 'MGA', label: 'Maringá (PR)', calendars: ['BR', 'MGA'] },
  { id: 'CVL', label: 'Cascavel (PR)', calendars: ['BR', 'CVL'] },
].map(Object.freeze))

export const PRACA_AJUDA = 'A praça define os feriados locais que adiam vencimentos: o que cai em fim de semana, feriado nacional, feriado da praça ou 31/12 (sem expediente bancário) passa para o próximo dia útil. Nas taxas pós-fixadas, esses feriados também saem da contagem de dias úteis. Padrão: só feriados nacionais.'
export const PRACA_RESSALVA = 'Feriados locais conforme o calendário do painel (aba Feriados). No Paraná, os feriados estaduais não estão completos na base; confira o calendário do contrato.'

export const pracaContrato = id => PRACAS_CONTRATO.find(p => p.id === id) ?? null
export const pracaCalendars = id => (pracaContrato(id) ?? pracaContrato(PRACA_PADRAO)).calendars

// Lista de calendários aceita pelos motores: ids brasileiros conhecidos, sem repetição, com o BR sempre presente.
// Devolve null quando a lista é inválida (o motor recusa em vez de supor).
const BRASILEIROS = new Set(CALENDARS.filter(c => !['NY', 'UK', 'JP', 'CN', 'BANCO'].includes(c.id)).map(c => c.id))
export function contractCalendars(calendars = ['BR']) {
  if (!Array.isArray(calendars) || calendars.some(c => !BRASILEIROS.has(c))) return null
  return ['BR', ...new Set(calendars.filter(c => c !== 'BR'))]
}
