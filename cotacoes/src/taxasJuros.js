// Juros bancários: taxas médias por banco e modalidade (empresas e pessoas) · Banco Central, serviço taxaJuros v2.
// Compartilhado pelo coletor (scripts/fetch-taxas-juros.mjs), pela busca e pela tela Cenários › Juros bancários.
export const TAXAS_SOURCE_PAGE = 'https://www.bcb.gov.br/estatisticas/reporttxjuros'
export const TAXAS_METHOD_PAGE = 'https://dadosabertos.bcb.gov.br/dataset/taxas-de-juros-de-operacoes-de-credito'
export const TAXAS_API = 'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo'
// Empresas primeiro: é o público principal do painel.
export const TAXAS_SEGMENTS = [
  { id: 'pj', bc: 'PESSOA JURÍDICA', label: 'Empresas', defaultModality: 'Capital de giro com prazo superior a 365 dias - Prefixado' },
  { id: 'pf', bc: 'PESSOA FÍSICA', label: 'Pessoas', defaultModality: 'Crédito pessoal não consignado - Prefixado' },
]

// Nome do BC -> rótulo curto, na ordem da lista. Modalidade nova do BC aparece com o nome original, sem quebrar a tela.
const LABELS = {
  'Capital de giro com prazo superior a 365 dias - Prefixado': 'Capital de giro acima de 365 dias · pré',
  'Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes': 'Capital de giro acima de 365 dias · pós',
  'Capital de giro com prazo até 365 dias - Prefixado': 'Capital de giro até 365 dias · pré',
  'Capital de giro com prazo até 365 dias - Pós-fixado referenciado em juros flutuantes': 'Capital de giro até 365 dias · pós',
  'Desconto de duplicatas - Prefixado': 'Desconto de duplicatas · pré',
  'Conta garantida - Prefixado': 'Conta garantida · pré',
  'Conta garantida - Pós-fixado referenciado em juros flutuantes': 'Conta garantida · pós',
  'Adiantamento sobre contratos de câmbio (ACC) - Pós-fixado referenciado em moeda estrangeira': 'ACC · pós (moeda estrangeira)',
  'Antecipação de faturas de cartão de crédito - Prefixado': 'Antecipação de faturas de cartão · pré',
  'Vendor - Prefixado': 'Vendor · pré',
  'Cheque especial - Prefixado': 'Cheque especial · pré',
  'Desconto de cheques - Prefixado': 'Desconto de cheques · pré',
  'Crédito pessoal não consignado - Prefixado': 'Crédito pessoal não consignado · pré',
  'Crédito pessoal consignado privado - Prefixado': 'Consignado privado · pré',
  'Crédito pessoal consignado público - Prefixado': 'Consignado público · pré',
  'Crédito pessoal consignado INSS - Prefixado': 'Consignado INSS · pré',
  'Aquisição de veículos - Prefixado': 'Aquisição de veículos · pré',
  'Aquisição de outros bens - Prefixado': 'Aquisição de outros bens · pré',
  'Cartão de crédito - parcelado - Prefixado': 'Cartão de crédito parcelado · pré',
  'Cartão de crédito - rotativo total - Prefixado': 'Cartão de crédito rotativo · pré',
}
export const modalityLabel = name => LABELS[name] || name
const order = name => { const i = Object.keys(LABELS).indexOf(name); return i < 0 ? 99 : i }

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

// Marca de cada instituição: logotipo oficial (cópias em public/bank-logos) dos grandes bancos e das
// empresas do mesmo grupo; as demais recebem as iniciais. `major` marca os grandes bancos do filtro.
const BRANDS = [
  [/ITA[UÚ] UNIBANCO|^FIN\. ITAU|INVESTCRED UNIBANCO/, 'Itaú Unibanco', 'bank-logos/itau.png', true],
  [/^BCO DO BRASIL S\.A\.$/, 'Banco do Brasil', 'bank-logos/bb.png', true],
  [/BRADESC/, 'Bradesco', 'bank-logos/bradesco.png', true],
  [/SANTANDER/, 'Santander', 'bank-logos/santander.png', true],
  [/^CAIXA ECONOMICA FEDERAL$/, 'Caixa', 'bank-logos/caixa.png', true],
  [/^BCO SAFRA S\.A\.$|^SAFRA SCFI/, 'Safra', 'bank-logos/safra.png', true],
  [/BTG PACTUAL/, 'BTG Pactual', 'bank-logos/btg.png', true],
  [/DAYCOVAL/, 'Daycoval', 'bank-logos/daycoval.ico', false],
  [/ABC BRASIL/, 'ABC Brasil', 'bank-logos/abc.svg', false],
  [/^NU FINANCEIRA|^NU PAGAMENTOS/, 'Nubank', null, false],
  [/^BANCO INTER\b/, 'Inter', null, false],
  [/^BCO C6/, 'C6 Bank', null, false],
  [/^BCO BV S\.A\.$|^BCO VOTORANTIM/, 'BV', null, false],
  [/^BCO DO ESTADO DO RS/, 'Banrisul', null, false],
  [/^BCO DO NORDESTE/, 'Banco do Nordeste', null, false],
  [/^BANCO SICOOB/, 'Sicoob', null, false],
  [/SICREDI/, 'Sicredi', null, false],
  [/^BCO XP/, 'XP', null, false],
  [/^BANCO PAN$|^PAN FINAN/, 'Pan', null, false],
  [/^BCO BANESTES/, 'Banestes', null, false],
  [/^BRB - /, 'BRB', null, false],
  [/^BCO DA AMAZONIA/, 'Banco da Amazônia', null, false],
  [/^BCO DO EST\. DO PA/, 'Banpará', null, false],
  [/^BCO DO EST\. DE SE/, 'Banese', null, false],
  [/^BCO MERCANTIL DO BRASIL/, 'Mercantil', null, false],
  [/^BCO SOFISA/, 'Sofisa', null, false],
  [/^BCO BMG/, 'BMG', null, false],
  [/^BCO AGIBANK/, 'Agibank', null, false],
  [/^PICPAY/, 'PicPay', null, false],
  [/^BANCO ORIGINAL/, 'Original', null, false],
  [/^BCO\. J\.SAFRA/, 'J. Safra', null, false],
]
// Fora das iniciais: preposições e siglas societárias (S.A., CFI, SCFI…).
const SKIP = new Set(['DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'S', 'A', 'SA', 'CFI', 'SCFI', 'BM', 'BI', 'C', 'F', 'I', 'LTDA'])
export function bankBrand(name) {
  const hit = BRANDS.find(([re]) => re.test(name))
  const short = hit?.[1] ?? null
  // Iniciais: do nome curto, ou das duas primeiras palavras do nome do BC sem "BCO"/"BANCO" no começo.
  const words = (short || name.replace(/^(BCO\.?|BANCO)\s+/i, '')).split(/[\s\-./]+/).filter(w => w && !SKIP.has(w.toUpperCase()) && /\p{L}|\d/u.test(w))
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toLocaleUpperCase('pt-BR')
  return { short, logo: hit?.[2] ?? null, major: Boolean(hit?.[3]), initials }
}

export function median(numbers) {
  const sorted = numbers.filter(Number.isFinite).sort((a, b) => a - b), mid = sorted.length >> 1
  if (!sorted.length) return null
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Posição na lista completa: taxas iguais dividem a posição.
export const rankRows = rows => rows.map(([bank, am, aa]) => ({ bank, am, aa, pos: 1 + rows.filter(r => r[1] < am).length }))

export const pct = value => Number.isFinite(value) ? `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
export const brDate = iso => isoDate(iso) ? iso.split('-').reverse().join('/') : '—'
const fold = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
export const matchesBank = (bank, query) => { const q = fold(query.trim()), short = bankBrand(bank).short; return fold(bank).includes(q) || (short ? fold(short).includes(q) : false) }
