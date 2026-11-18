// Balanço contábil consolidado dos bancos listados, vindo dos dados abertos da CVM.
// Base separada da do Banco Central: perímetro e critério são outros (contábil, não prudencial).
// Valores monetários em reais; a tela mostra R$ bilhões.
export const CVM_SOURCE_PAGE = 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp'
export const CVM_ITR_PAGE = 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr'
// Caixa e Safra não têm registro de companhia aberta na CVM e ficam só na base do Banco Central.
export const CVM_BANKS = [
  ['itau', 'Itaú', 19348], ['bb', 'Banco do Brasil', 1023], ['bradesco', 'Bradesco', 906],
  ['santander', 'Santander', 20532], ['btg', 'BTG Pactual', 22616],
].map(([id, name, cvmCode]) => ({ id, name, cvmCode }))
export const CVM_NOT_LISTED = ['Caixa', 'Safra']

// O plano de contas muda de banco para banco (o número 2.03 é "Provisões" em uns e "Passivos
// financeiros" em outros). Por isso cada indicador é reconhecido pelo nome da conta, não pelo código.
const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
export const CVM_METRICS = {
  assets: { label: 'Ativo total', statement: 'BPA', kind: 'stock', match: (code, name) => code === '1' && plain(name) === 'ativo total' },
  funding: { label: 'Passivos financeiros ao custo amortizado', short: 'Passivos financeiros', statement: 'BPP', kind: 'stock', match: (code, name) => /^2\.\d\d$/.test(code) && plain(name) === 'passivos financeiros ao custo amortizado' },
  equity: { label: 'Patrimônio líquido consolidado', short: 'Patrimônio líquido', statement: 'BPP', kind: 'stock', match: (code, name) => /^2\.\d\d$/.test(code) && plain(name) === 'patrimonio liquido consolidado' },
  revenue: { label: 'Receitas da intermediação financeira', short: 'Receita de intermediação', statement: 'DRE', kind: 'flow', match: (code, name) => code === '3.01' && /^receitas? (da|de) intermediacao financeira$/.test(plain(name)) },
  profit: { label: 'Lucro líquido consolidado (contábil)', short: 'Lucro líquido', statement: 'DRE', kind: 'flow', match: (code, name) => /^3\.\d\d$/.test(code) && /^lucro(\/| ou )prejuizo (liquido )?consolidado do periodo$/.test(plain(name)) },
}
export const CVM_METRIC_KEYS = Object.keys(CVM_METRICS)

export const cvmMoney = value => Number.isFinite(value) ? (value / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Não disponível'
export const cvmQuarterLabel = period => /^\d{6}$/.test(String(period)) ? `${Number(String(period).slice(4)) / 3}T${String(period).slice(0, 4)}` : 'Sem período'

// Série de um indicador para um banco: [{ key, label, value, derived, source }], em ordem de data.
// Lacunas continuam como value null; nada é estimado nem preenchido com dado de outro período.
export function cvmSeries(bank, metric, frequency = 'annual') {
  const list = frequency === 'quarterly' ? bank?.quarterly : bank?.annual
  return (list || []).map(point => {
    const key = frequency === 'quarterly' ? String(point.period) : String(point.year)
    const value = point.metrics?.[metric]
    return { key, label: frequency === 'quarterly' ? cvmQuarterLabel(key) : key, value: Number.isFinite(value) ? value : null, derived: Boolean(point.derived?.includes(metric)), source: point.source || '' }
  }).sort((a, b) => a.key.localeCompare(b.key))
}

// Variação contra o ponto equivalente anterior (ano anterior; ou mesmo trimestre do ano anterior).
export function cvmYearOverYear(series, frequency = 'annual') {
  const step = frequency === 'quarterly' ? 4 : 1
  return series.map((point, i) => {
    const previous = series[i - step]
    if (!Number.isFinite(point.value) || !Number.isFinite(previous?.value) || previous.value <= 0) return null
    // Confere que o ponto de comparação é mesmo o período equivalente (sem lacuna no meio).
    const expected = frequency === 'quarterly' ? `${Number(point.key.slice(0, 4)) - 1}${point.key.slice(4)}` : String(Number(point.key) - 1)
    if (previous.key !== expected) return null
    return (point.value / previous.value - 1) * 100
  })
}
