export const BANK_SOURCE_PAGE = 'https://www3.bcb.gov.br/ifdata/'
// Valores monetários em reais; índices em percentual (15,4 representa 15,4%).
export const BANKS = [
  ['itau', 'Itaú', 'C0080099', 'https://www.itau.com.br/relacoes-com-investidores/resultados-e-relatorios/central-de-resultados/'],
  ['bb', 'Banco do Brasil', 'C0080329', 'https://ri.bb.com.br/informacoes-financeiras/central-de-resultados/'],
  ['bradesco', 'Bradesco', 'C0080075', 'https://www.bradescori.com.br/informacoes-ao-mercado/central-de-resultados/'],
  ['santander', 'Santander', 'C0080185', 'https://www.santander.com.br/ri/'],
  ['caixa', 'Caixa', 'C0080738', 'https://ri.caixa.gov.br/'],
  ['safra', 'Safra', 'C0080109', 'https://www.safra.com.br/sobre/relacoes-com-investidores/informacoes-financeiras.htm'],
  ['btg', 'BTG Pactual', 'C0080336', 'https://ri.btgpactual.com/'],
].map(([id, name, code, ri]) => ({ id, name, code, ri, logo: `bank-logos/${id}.png` }))

export const BANK_METRICS = {
  basel: ['Basileia', '%', 'capital'], cet1: ['Capital principal (CET1)', '%', 'capital'],
  assets: ['Ativos totais', 'BRL'], creditTotal: ['Carteira total', 'BRL'],
  creditPJ: ['Carteira PJ', 'BRL'], creditPF: ['Carteira PF', 'BRL'],
  provisionTotal: ['Provisão total', 'BRL'], provisionPJ: ['Provisão PJ', 'BRL'], provisionPF: ['Provisão PF', 'BRL'],
  provisionRatioTotal: ['Provisão / carteira total', '%'], provisionRatioPJ: ['Provisão / carteira PJ', '%'], provisionRatioPF: ['Provisão / carteira PF', '%'],
  nplTotal: ['Inadimplência total', '%', 'risk'], nplPJ: ['Inadimplência PJ', '%', 'risk'], nplPF: ['Inadimplência PF', '%', 'risk'],
  profit: ['Lucro líquido trimestral', 'BRL', 'profit'], roe: ['ROE / ROAE', '%', 'profit'],
}
export const quarterLabel = period => /^\d{6}$/.test(String(period)) ? `${Number(String(period).slice(4)) / 3}T${String(period).slice(0, 4)}` : 'Sem período'
export function shiftQuarter(period, delta) {
  const year = Math.floor(period / 100), month = period % 100
  const d = new Date(Date.UTC(year, month - 1 + delta * 3, 1))
  return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1
}
export const bankNumber = (v, unit = 'BRL') => Number.isFinite(v) ? `${(unit === 'BRL' ? v / 1e9 : v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit === '%' ? '%' : ''}` : 'Não disponível'

export function latestBankPoint(bank, mode = 'latest') {
  const list = mode === 'bc' ? bank?.observations : [...(bank?.observations || []), ...(bank?.releases || [])]
  return [...(list || [])].sort((a, b) => b.period - a.period || (b.origin === 'ri' ? 1 : 0) - (a.origin === 'ri' ? 1 : 0))[0] || null
}

export function metricChange(current, previous, key) {
  const a = current?.metrics?.[key], b = previous?.metrics?.[key]
  if (!Number.isFinite(a?.value) || !Number.isFinite(b?.value) || !a.basis || a.basis !== b.basis) return null
  const unit = BANK_METRICS[key][1] === '%' ? 'p.p.' : '%'
  // Variação percentual do lucro com base negativa/zero não tem interpretação usual.
  if (unit === '%' && b.value <= 0) return null
  const value = unit === 'p.p.' ? a.value - b.value : (a.value / b.value - 1) * 100
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100
  const direction = rounded === 0 ? 'estável' : value > 0 ? 'subiu' : 'caiu'
  const kind = BANK_METRICS[key][2]
  const assessment = direction === 'estável' ? 'estável' : kind === 'risk' ? (value < 0 ? 'melhora' : 'piora') : kind === 'profit' ? (value > 0 ? 'melhora' : 'piora') : 'neutro'
  return { value: rounded === 0 ? 0 : value, unit, direction, assessment }
}
export function bankComparison(bank, current, delta) {
  const target = shiftQuarter(current?.period, delta)
  // Jamais comparar RI com BC ou trocar silenciosamente o perímetro da série.
  return [...(bank?.releases || []), ...(bank?.observations || [])].find(p => p.period === target && p.origin === current?.origin) || null
}
export function bankSummary(bank, current, delta = -1, segment = 'Total') {
  const previous = bankComparison(bank, current, delta)
  const parts = [`credit${segment}`, `npl${segment}`, 'basel', 'roe'].flatMap(key => {
    const change = metricChange(current, previous, key)
    if (!change) return []
    const label = BANK_METRICS[key][0]
    return [`${label} ${change.direction}${change.direction === 'estável' ? '' : ` ${bankNumber(Math.abs(change.value), '%').replace('%', '')} ${change.unit}`}${change.assessment === 'melhora' ? ' (melhora)' : change.assessment === 'piora' ? ' (piora)' : ''}`]
  })
  return parts.length ? parts.join('; ') + '.' : 'Sem base equivalente para analisar a evolução neste período.'
}
