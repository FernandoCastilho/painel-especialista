import { BANK_METRICS, bankNumber, latestBankPoint, quarterLabel, shiftQuarter, metricChange, bankComparison } from './bancos.js'

export function bankMetricHistory(bank, mode, metric) {
  const current = latestBankPoint(bank, mode), basis = current?.metrics?.[metric]?.basis
  if (!basis) return []
  const source = current.origin === 'ri' ? bank.releases : bank.observations
  const byPeriod = new Map()
  for (const point of source || []) {
    const item = point.metrics?.[metric]
    if (point.origin === current.origin && point.period <= current.period && Number.isFinite(item?.value) && item.basis === basis && !byPeriod.has(point.period)) byPeriod.set(point.period, { ...point, item })
  }
  if (!byPeriod.size) return []
  const periods = [...byPeriod.keys()].sort((a, b) => a - b), result = []
  for (let period = periods[0]; period <= current.period; period = shiftQuarter(period, 1)) result.push(byPeriod.get(period) || { period, item: null })
  return result
}

export const bankMetricRule = metric => metric.startsWith('provision') ? null : metric.startsWith('npl') ? { direction: 'min', label: 'Menor inadimplência' } : ({
  basel: { direction: 'max', label: 'Maior Basileia' }, cet1: { direction: 'max', label: 'Maior capital principal' },
  assets: { direction: 'max', label: 'Maior volume de ativos · porte' },
  creditTotal: { direction: 'max', label: 'Maior carteira total · porte' }, creditPJ: { direction: 'max', label: 'Maior carteira PJ · porte' }, creditPF: { direction: 'max', label: 'Maior carteira PF · porte' },
  profit: { direction: 'max', label: 'Maior resultado líquido' }, roe: { direction: 'max', label: 'Maior retorno sobre patrimônio' },
}[metric] || null)

// Só concorre o que está efetivamente na tela, com mesmo trimestre, origem e critério.
// Critérios próprios de ROE não são declarados equivalentes por terem o mesmo nome.
export function bankMetricLeaders(columns, metric) {
  const rule = bankMetricRule(metric), empty = { winners: [], growthWinners: [], eligible: [], rule, total: columns.length }
  if (!rule) return { ...empty, reason: 'Provisão maior ou menor, isoladamente, não define o melhor banco.' }
  const groups = new Map()
  for (const column of columns) {
    const item = column.point?.metrics?.[metric]
    if (!Number.isFinite(item?.value) || !item.basis || !column.point?.origin) continue
    const key = `${column.point.period}|${column.point.origin}|${item.basis}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(column)
  }
  const eligible = [...groups.values()].filter(group => group.length >= 2).sort((a, b) => b.length - a.length || b[0].point.period - a[0].point.period)[0]
  if (!eligible) return { ...empty, reason: 'Sem dois bancos com mesmo trimestre, origem e critério. Nenhum vencedor foi forçado.' }
  // Empate na precisão mostrada: não sugerir diferença que a tabela não permite ver.
  const score = column => Math.round(column.point.metrics[metric].value / (BANK_METRICS[metric][1] === 'BRL' ? 1e9 : 1) * 100)
  const best = (rule.direction === 'min' ? Math.min : Math.max)(...eligible.map(score))
  const winners = eligible.filter(column => score(column) === best).map(column => column.bank.id)
  const point = eligible[0].point
  // Segundo troféu: maior crescimento (variação % contra a referência escolhida), só em indicadores em R$.
  // Concorre quem está na mesma coorte e tem base equivalente; crescimento zero ou negativo não premia.
  let growthWinners = []
  if (rule.direction === 'max' && BANK_METRICS[metric][1] === 'BRL') {
    const growth = eligible.map(column => ({ id: column.bank.id, change: metricChange(column.point, column.previous, metric) })).filter(item => item.change && item.change.value > 0)
      .map(item => ({ ...item, score: Math.round(item.change.value * 100) }))
    const top = Math.max(...growth.map(item => item.score))
    if (growth.length >= 2) growthWinners = growth.filter(item => item.score === top).map(item => item.id)
  }
  return { winners, growthWinners, eligible, rule, total: columns.length, period: point.period, basis: point.metrics[metric].basis, origin: point.origin,
    scope: `${point.origin === 'bc' ? 'BC' : 'RI'} · ${quarterLabel(point.period)} · ${eligible.length}/${columns.length} bancos`,
    reason: `${rule.label}; ${eligible.length} de ${columns.length} bancos exibidos têm o mesmo trimestre, origem e critério. ${columns.length - eligible.length} fora desta comparação. Não é uma nota geral do banco.` }
}

export function bankMetricAnalysis(bank, mode, metric, delta) {
  const point = latestBankPoint(bank, mode), previous = bankComparison(bank, point, delta), change = metricChange(point, previous, metric)
  if (!Number.isFinite(point?.metrics?.[metric]?.value)) return 'Indicador não disponível nesta divulgação. Nenhum valor antigo foi usado para preencher o período atual.'
  const value = bankNumber(point.metrics[metric].value, BANK_METRICS[metric][1])
  if (!change) return `${quarterLabel(point.period)}: ${value}. Sem base equivalente para a comparação ${delta === -4 ? 'anual' : 'trimestral'} selecionada.`
  const movement = change.direction === 'estável' ? 'estável' : `${change.value > 0 ? 'alta' : 'queda'} de ${bankNumber(Math.abs(change.value), '%').replace('%', '')} ${change.unit}`
  const assessment = change.assessment === 'melhora' ? 'Sinal de melhora deste indicador.' : change.assessment === 'piora' ? 'Sinal de piora deste indicador.' : metric.startsWith('provision') ? 'O saldo pode mudar por risco, composição da carteira ou reforço de cobertura; não define melhora isoladamente.' : metric === 'basel' || metric === 'cet1' ? 'Capital relativo aos riscos. A variação isolada não comprova melhora ou deterioração do banco.' : 'O volume indica porte ou expansão; não mede sozinho a qualidade do banco.'
  return `${quarterLabel(point.period)}: ${value}; ${movement} versus ${quarterLabel(previous.period)}. ${assessment}`
}
