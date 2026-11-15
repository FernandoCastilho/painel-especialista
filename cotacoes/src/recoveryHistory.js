export const UF_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}
export const UNKNOWN_UF = 'Sem UF'
export const UNKNOWN_SECTOR = 'Setor não identificado'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = value => {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const nullableLabel = value => value === null || typeof value === 'string' && value.length > 0 && value.length <= 240
const onlyKeys = (object, expected) => object && Object.keys(object).length === expected.length && expected.every(key => Object.hasOwn(object, key))

export function validateRecoveryHistory(input) {
  if (!onlyKeys(input, ['schemaVersion','generatedAt','editions','records']) || input.schemaVersion !== 1 ||
      typeof input.generatedAt !== 'string' || !Number.isFinite(Date.parse(input.generatedAt)) ||
      !Array.isArray(input.editions) || !input.editions.length || !Array.isArray(input.records)) {
    throw new Error('Base histórica inválida')
  }
  const editions = new Set(input.editions)
  if (editions.size !== input.editions.length || input.editions.some((day, index) => !validDate(day) || index > 0 && day <= input.editions[index - 1])) {
    throw new Error('Edições inválidas ou repetidas')
  }
  const ids = new Set()
  for (const row of input.records) {
    if (!onlyKeys(row, ['id','date','uf','sector','name']) || typeof row.id !== 'string' || !/^[a-f0-9]{24}$/.test(row.id) ||
        ids.has(row.id) || !editions.has(row.date) || !(row.uf === null || Object.hasOwn(UF_NAMES, row.uf)) ||
        !nullableLabel(row.sector) || !nullableLabel(row.name)) throw new Error('Menção inválida ou repetida')
    ids.add(row.id)
  }
  return input
}

const endOfMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate()
const dateFor = (year, month, day) => [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')

export function recoveryPeriod(data, year, firstMonth, lastMonth) {
  const yearDates = data.editions.filter(date => Number(date.slice(0, 4)) === year)
  const lastEdition = yearDates.at(-1)
  const monthEnd = endOfMonth(year, lastMonth)
  const editionMonth = Number(lastEdition?.slice(5, 7))
  const limit = lastMonth === editionMonth ? Math.min(monthEnd, Number(lastEdition.slice(8))) : monthEnd
  const start = dateFor(year, firstMonth, 1)
  const end = dateFor(year, lastMonth, limit)
  const previousStart = dateFor(year - 1, firstMonth, 1)
  const previousEnd = dateFor(year - 1, lastMonth, Math.min(limit, endOfMonth(year - 1, lastMonth)))
  const inRange = (date, from, through) => date >= from && date <= through
  return {
    start, end, previousStart, previousEnd,
    editionCount: yearDates.filter(date => inRange(date, start, end)).length,
    previousEditionCount: data.editions.filter(date => inRange(date, previousStart, previousEnd)).length,
    current: data.records.filter(row => inRange(row.date, start, end)),
    previous: data.records.filter(row => inRange(row.date, previousStart, previousEnd)),
  }
}

export const filterRecovery = (records, uf, sector) => records.filter(row =>
  (!uf || (row.uf ?? UNKNOWN_UF) === uf) && (!sector || (row.sector ?? UNKNOWN_SECTOR) === sector))

export function groupRecovery(records, field, fallback) {
  const counts = new Map()
  for (const row of records) {
    const label = row[field] ?? fallback
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}

// Cortes alternados mantêm a área exatamente proporcional e evitam faixas muito estreitas.
export function recoveryTreemap(items, width = 500, height = 320) {
  const output = []
  function divide(group, x, y, w, h) {
    if (!group.length) return
    if (group.length === 1) { output.push({ ...group[0], x, y, w, h }); return }
    const total = group.reduce((sum, item) => sum + item.count, 0)
    let split = 1
    let first = group[0].count
    while (split < group.length - 1 && first + group[split].count / 2 < total / 2) {
      first += group[split].count
      split++
    }
    const ratio = first / total
    if (w >= h) {
      divide(group.slice(0, split), x, y, w * ratio, h)
      divide(group.slice(split), x + w * ratio, y, w * (1 - ratio), h)
    } else {
      divide(group.slice(0, split), x, y, w, h * ratio)
      divide(group.slice(split), x, y + h * ratio, w, h * (1 - ratio))
    }
  }
  divide(items, 0, 0, width, height)
  return output
}

// Nome curto de atividade para as barras: corta no primeiro ", exceto" ou, em nome longo, na primeira vírgula depois do
// trecho inicial. O nome completo continua no filtro, na dica (title) e no nome acessível.
const SHORT_SECTOR_LIMIT = 60
const SHORT_SECTOR_MIN_CUT = 25
export function shortSectorName(label) {
  const text = String(label ?? '').trim().replace(/\.$/, '')
  const except = text.search(/,\s*exceto\b/i)
  if (except > 0) return text.slice(0, except)
  if (text.length <= SHORT_SECTOR_LIMIT) return text
  const comma = text.indexOf(',', SHORT_SECTOR_MIN_CUT)
  return comma > 0 ? text.slice(0, comma) : text
}
// Devolve Map(nome completo -> nome curto). Se dois setores da lista ficam com o mesmo nome curto, cada um ganha o
// trecho que os diferencia (ex.: "Transporte rodoviário de carga · municipal"), para não haver duas barras iguais.
export function shortSectorNames(labels) {
  const groups = new Map()
  for (const label of labels) {
    const short = shortSectorName(label)
    groups.set(short, [...(groups.get(short) ?? []), label])
  }
  const output = new Map()
  for (const [short, group] of groups) {
    if (group.length === 1) { output.set(group[0], short); continue }
    let common = group.reduce((prefix, label) => { let i = 0; while (i < prefix.length && prefix[i] === label[i]) i++; return prefix.slice(0, i) })
    common = common.slice(0, Math.max(common.lastIndexOf(' '), common.lastIndexOf(',')) + 1)
    for (const label of group) {
      const tail = label.slice(common.length).trim().replace(/^[-–,;]\s*/, '').replace(/\.$/, '')
      output.set(label, tail && common.length >= short.length ? `${short} · ${tail}` : label)
    }
  }
  return output
}
