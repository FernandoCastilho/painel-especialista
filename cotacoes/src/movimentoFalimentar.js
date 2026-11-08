const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '))
const types = new Set(['pedido', 'deferimento', 'concessao', 'cumprimento', 'desistencia', 'indeferimento', 'other'])
const validDay = day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(day + 'T12:00:00Z').toISOString().slice(0, 10) === day

export function normalizeMovement(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.editions) || !data.editions.length || !Number.isFinite(data.generatedAt)) throw new Error('Compilação editorial inválida')
  const editions = new Set()
  for (const edition of data.editions) {
    const s = edition?.source
    if (!s?.id || editions.has(s.id) || !validDay(s.publicationDate) || !Number.isFinite(Date.parse(s.consultedAt)) || !s.url?.startsWith('https://valor.globo.com/') || !s.coverage || !Array.isArray(edition.events) || !edition.events.length) throw new Error('Edição editorial inválida')
    editions.add(s.id)
    const keys = new Set()
    for (const event of edition.events) {
      if (!event.companyName?.trim() || !/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(event.cnpjRaw) || !types.has(event.eventType) || !event.sourceStage?.trim() || (event.historicalUf !== null && !UFS.has(event.historicalUf))) throw new Error('Menção empresarial inválida')
      const key = `${event.cnpjRaw}|${event.sourceStage}`
      if (keys.has(key)) throw new Error('Menção repetida na mesma edição')
      keys.add(key)
    }
  }
  return data
}

export function latestMovement(data) {
  return [...normalizeMovement(data).editions].sort((a, b) => b.source.publicationDate.localeCompare(a.source.publicationDate))[0]
}

export function movementSummary(edition) {
  const counts = {pedido: 0, deferimento: 0, concessao: 0}
  for (const e of edition.events) if (Object.hasOwn(counts, e.eventType)) counts[e.eventType]++
  const requests = edition.events.filter(e => e.eventType === 'pedido')
  const byUf = new Map()
  for (const e of requests) byUf.set(e.historicalUf, (byUf.get(e.historicalUf) || 0) + 1)
  return {counts, requests, byUf: [...byUf].map(([uf, count]) => ({uf, count, share: requests.length ? count / requests.length * 100 : null})).sort((a, b) => b.count - a.count)}
}
