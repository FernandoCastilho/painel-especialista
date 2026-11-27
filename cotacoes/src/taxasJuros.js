// Taxas médias de juros por banco e modalidade (PJ) · Banco Central, serviço taxaJuros v2.
// Compartilhado pelo coletor (scripts/fetch-taxas-juros.mjs) e pela visão "Taxas cobradas" da aba Bancos.
export const TAXAS_SOURCE_PAGE = 'https://www.bcb.gov.br/estatisticas/reporttxjuros'
export const TAXAS_METHOD_PAGE = 'https://dadosabertos.bcb.gov.br/dataset/taxas-de-juros-de-operacoes-de-credito'
export const TAXAS_API = 'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo'
export const TAXAS_SEGMENT = 'PESSOA JURÍDICA'

// Nome do BC -> rótulo curto. Modalidade nova do BC aparece com o nome original, sem quebrar a tela.
const LABELS = {
  'Adiantamento sobre contratos de câmbio (ACC) - Pós-fixado referenciado em moeda estrangeira': 'ACC · pós (moeda estrangeira)',
  'Antecipação de faturas de cartão de crédito - Prefixado': 'Antecipação de faturas de cartão · pré',
  'Capital de giro com prazo até 365 dias - Prefixado': 'Capital de giro até 365 dias · pré',
  'Capital de giro com prazo até 365 dias - Pós-fixado referenciado em juros flutuantes': 'Capital de giro até 365 dias · pós',
  'Capital de giro com prazo superior a 365 dias - Prefixado': 'Capital de giro acima de 365 dias · pré',
  'Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes': 'Capital de giro acima de 365 dias · pós',
  'Cheque especial - Prefixado': 'Cheque especial · pré',
  'Conta garantida - Prefixado': 'Conta garantida · pré',
  'Conta garantida - Pós-fixado referenciado em juros flutuantes': 'Conta garantida · pós',
  'Desconto de cheques - Prefixado': 'Desconto de cheques · pré',
  'Desconto de duplicatas - Prefixado': 'Desconto de duplicatas · pré',
  'Vendor - Prefixado': 'Vendor · pré',
}
export const modalityLabel = name => LABELS[name] || name
const order = name => { const i = Object.keys(LABELS).indexOf(name); return i < 0 ? 99 : i }
export const DEFAULT_MODALITY = 'Capital de giro com prazo superior a 365 dias - Prefixado'

const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value + 'T00:00:00Z'))

// Linhas do OData -> { period, modalities: [{ name, rows: [[instituição, % a.m., % a.a.]] }] }, ordenadas pela taxa a.m.
export function parseTaxas(values, period) {
  if (!isoDate(period?.inicio) || !isoDate(period?.fim) || period.inicio > period.fim) throw new Error('Período do BC inválido')
  if (!Array.isArray(values) || !values.length) throw new Error('BC sem taxas no período')
  const groups = new Map()
  for (const row of values) {
    const name = String(row?.Modalidade || '').trim(), bank = String(row?.InstituicaoFinanceira || '').trim()
    const am = Number(row?.TaxaJurosAoMes), aa = Number(row?.TaxaJurosAoAno)
    if (!name || !bank || !Number.isFinite(am) || !Number.isFinite(aa) || am < 0 || am > 100 || aa < 0) throw new Error('Linha de taxa inválida')
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push([bank, am, aa])
  }
  const modalities = [...groups].map(([name, rows]) => ({ name, rows: rows.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], 'pt-BR')) }))
    .sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name, 'pt-BR'))
  return { period: { inicio: period.inicio, fim: period.fim }, modalities }
}

export function median(numbers) {
  const sorted = numbers.filter(Number.isFinite).sort((a, b) => a - b), mid = sorted.length >> 1
  if (!sorted.length) return null
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const pct = value => Number.isFinite(value) ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
export const brDate = iso => isoDate(iso) ? iso.split('-').reverse().join('/') : '—'
const fold = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
export const matchesBank = (bank, query) => fold(bank).includes(fold(query.trim()))
