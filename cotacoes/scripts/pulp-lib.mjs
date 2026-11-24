import { COMMODITIES } from './commodities-lib.mjs'
export const PULP_API = 'https://api-comexstat.mdic.gov.br'
export const PULP_HEADINGS = ['4701', '4702', '4703', '4704', '4705', '4706']
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const integer = value => typeof value === 'string' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN
export function pulpPublication(response, now = new Date()) {
  const d = response?.data
  if (response?.success !== true || !dateValid(d?.updated) || d.updated > now.toISOString().slice(0, 10) || !/^\d{4}$/.test(d?.year ?? '') || !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(d?.monthNumber ?? '')) throw new Error('Comex Stat: publicação inválida')
  const period = `${d.year}-${String(d.monthNumber).padStart(2, '0')}`
  if (period >= now.toISOString().slice(0, 7) || period > d.updated.slice(0, 7)) throw new Error('Comex Stat: competência futura ou incompleta')
  return { period, releaseDate: d.updated }
}
// A API trata meses como janela dentro de cada ano: consultar anos separadamente evita lacunas.
export function pulpQueries(publication) {
  const [year, month] = publication.period.split('-')
  return [{ from: `${Number(year) - 1}-${month}`, to: `${Number(year) - 1}-12` }, { from: `${year}-01`, to: publication.period }].map(period => ({
    flow: 'export', monthDetail: true, period,
    filters: [{ filter: 'heading', values: PULP_HEADINGS.map(Number) }],
    details: ['heading'], metrics: ['metricFOB', 'metricKG'],
  }))
}
export const pulpAggregateQueries = publication => pulpQueries(publication).map(query => ({ ...query, details: [] }))
export function buildPulp(responses, publication, now = new Date(), aggregateResponses) {
  const queries = pulpQueries(publication)
  if (!Array.isArray(responses) || responses.length !== queries.length) throw new Error('Comex Stat: respostas incompletas')
  const totals = new Map(), seen = new Set()
  responses.forEach((response, index) => {
    if (response?.success !== true || !Array.isArray(response?.data?.list) || !response.data.list.length) throw new Error('Comex Stat: consulta sem dados válidos')
    for (const row of response.data.list) {
      if (!PULP_HEADINGS.includes(row.headingCode)) throw new Error('Comex Stat: produto fora do escopo da celulose')
      if (!/^\d{4}$/.test(row.year ?? '') || !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(row.monthNumber ?? '')) throw new Error('Comex Stat: competência inválida')
      const period = `${row.year}-${String(row.monthNumber).padStart(2, '0')}`
      const key = `${period}:${row.headingCode}`
      if (period < queries[index].period.from || period > queries[index].period.to || seen.has(key)) throw new Error('Comex Stat: competência fora da consulta ou registro duplicado')
      seen.add(key)
      const fob = integer(row.metricFOB), kg = integer(row.metricKG)
      if (!(fob > 0) || !(kg > 0)) throw new Error('Comex Stat: valor FOB ou massa líquida inválidos')
      const total = totals.get(period) ?? { fob: 0, kg: 0 }
      total.fob += fob; total.kg += kg
      if (!Number.isSafeInteger(total.fob) || !Number.isSafeInteger(total.kg)) throw new Error('Comex Stat: total fora do intervalo seguro')
      totals.set(period, total)
    }
  })
  const history = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([period, total]) => ({ period, value: total.fob / total.kg * 1000, fobUSD: total.fob, netKg: total.kg }))
  if (history.length !== 13 || history.at(-1).period !== publication.period) throw new Error('Comex Stat: faltam meses no histórico de 13 meses')
  // Reconcilia com outra consulta, sem detalhamento: código ausente pode indicar
  // ausência de transações ou resposta parcial. Não adivinha qual das duas.
  if (!Array.isArray(aggregateResponses) || aggregateResponses.length !== queries.length) throw new Error('Comex Stat: totais independentes ausentes')
  const aggregateTotals = new Map()
  aggregateResponses.forEach((response, index) => {
    if (response?.success !== true || !Array.isArray(response?.data?.list) || !response.data.list.length) throw new Error('Comex Stat: total agregado inválido')
    for (const row of response.data.list) {
      if (row.headingCode !== undefined || !/^\d{4}$/.test(row.year ?? '') || !/^(?:[1-9]|0[1-9]|1[0-2])$/.test(row.monthNumber ?? '')) throw new Error('Comex Stat: total agregado inesperado')
      const period = `${row.year}-${String(row.monthNumber).padStart(2, '0')}`
      const fob = integer(row.metricFOB), kg = integer(row.metricKG)
      if (period < queries[index].period.from || period > queries[index].period.to || aggregateTotals.has(period) || !(fob > 0) || !(kg > 0)) throw new Error('Comex Stat: total agregado inconsistente')
      aggregateTotals.set(period, { fob, kg })
    }
  })
  if (aggregateTotals.size !== totals.size || [...totals].some(([period, total]) => aggregateTotals.get(period)?.fob !== total.fob || aggregateTotals.get(period)?.kg !== total.kg)) throw new Error('Comex Stat: detalhamento não confere com total agregado; possível resposta parcial')
  const latest = history.at(-1), previous = history.at(-2)
  const stale = Date.parse(`${latest.period}-01`) < Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1)
  return { ...COMMODITIES.find(c => c.id === 'pulp-br'), value: latest.value, period: latest.period,
    releaseDate: publication.releaseDate, checkedAt: now.toISOString(), stale, error: stale ? 'Referência mensal antiga; conferir divulgação do MDIC' : null,
    previousValue: previous.value, previousPeriod: previous.period, variationPct: (latest.value / previous.value - 1) * 100,
    variationBasis: 'mês anterior', history, methodology: 'Soma do valor FOB em US$ dividida pela soma do peso líquido em kg, multiplicada por 1000. SH4 4701–4706; exclui aparas SH4 4707.',
    queryUrl: `${PULP_API}/general`, publicationUrl: `${PULP_API}/general/dates/updated`, queries, reconciliationQueries: pulpAggregateQueries(publication) }
}
export async function collectPulpApi(getJson, now = new Date()) {
  const publication = pulpPublication(await getJson(`${PULP_API}/general/dates/updated`), now)
  const [responses, aggregateResponses] = await Promise.all([pulpQueries(publication), pulpAggregateQueries(publication)].map(queries => Promise.all(queries.map(body => getJson(`${PULP_API}/general`, body)))))
  return buildPulp(responses, publication, now, aggregateResponses)
}
