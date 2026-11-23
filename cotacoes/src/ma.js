export const MA_STATUSES = ['Anunciada', 'Em aprovação', 'Concluída', 'Cancelada']
export const MA_UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value
export const maDate = row => row.announcementDate || row.publicationDate
export const maDateLabel = value => value ? value.split('-').reverse().join('/') : 'Não informada'
export const maBubbleRadius = (count, max) => max > 0 ? 26 * Math.sqrt(Math.max(0,count) / max) : 0
export function validateMa(rows) {
  if (!Array.isArray(rows)) throw new Error('Catálogo de M&A inválido')
  const ids = new Set()
  for (const row of rows) {
    if (!row || !/^[a-z0-9-]+$/.test(row.id) || ids.has(row.id)) throw new Error('Identidade de transação inválida ou repetida')
    ids.add(row.id)
    for (const key of ['buyer','target','sector','sectorId','segment','summary','locationNote']) if (typeof row[key] !== 'string' || !row[key].trim()) throw new Error(`Campo de M&A ausente: ${key}`)
    if (!MA_STATUSES.includes(row.status) || (row.uf !== null && !MA_UFS.includes(row.uf))) throw new Error('Situação ou UF inválida')
    for (const key of ['publicationDate','announcementDate','completionDate','updatedDate']) if ((key === 'publicationDate' || row[key] !== null) && !validDate(row[key])) throw new Error(`Data inválida: ${key}`)
    if (!['announcement','publication'].includes(row.dateBasis) || (row.dateBasis === 'announcement') !== Boolean(row.announcementDate)) throw new Error('Referência da data inconsistente')
    if (row.value !== null && (!Number.isFinite(row.value) || row.value < 0 || !['BRL','USD','EUR'].includes(row.currency))) throw new Error('Valor inválido')
    if (!/^https:\/\//.test(row.sourceUrl) || [row.locationSource,row.supportingSource].some(url => url && !/^https:\/\//.test(url))) throw new Error('Fonte inválida')
    if (!Array.isArray(row.history) || !row.history.length || row.history.some(event => !validDate(event.date) || !event.text?.trim())) throw new Error('Histórico inválido')
    if (row.completionDate && row.announcementDate && row.completionDate < row.announcementDate) throw new Error('Conclusão anterior ao anúncio')
  }
  return true
}
export function filterMa(rows, filters = {}) {
  const query = normalize(filters.query).trim()
  return rows.filter(row => (!filters.year || maDate(row).slice(0,4) === filters.year)
    && (!filters.month || maDate(row).slice(5,7) === filters.month)
    && (!filters.sector || row.sectorId === filters.sector)
    && (!filters.uf || (row.uf || 'unknown') === filters.uf)
    && (!filters.status || row.status === filters.status)
    && (!query || normalize([row.buyer,row.target,row.seller,row.sector,row.segment].join(' ')).includes(query)))
    .sort((a,b) => maDate(b).localeCompare(maDate(a)) || a.id.localeCompare(b.id))
}
export function summarizeMa(rows) {
  const groups = key => {
    const result = new Map()
    for (const row of rows) {
      const id = row[key]
      if (id) result.set(id, { id, label:key === 'sectorId' ? row.sector : id, count:(result.get(id)?.count || 0) + 1 })
    }
    return [...result.values()].sort((a,b) => b.count - a.count || a.label.localeCompare(b.label,'pt-BR'))
  }
  const states = groups('uf')
  const located = states.reduce((sum,state) => sum + state.count,0)
  return { total:rows.length, located, unknown:rows.length - located, states, sectors:groups('sectorId') }
}
export function readMaRoute(view = '') {
  const [tab,search = ''] = view.split('?')
  const params = new URLSearchParams(search)
  const value = key => params.get(key) || ''
  return { tab:tab === 'transacoes' ? tab : 'visao-geral', year:/^\d{4}$/.test(value('year')) ? value('year') : '', month:/^(0[1-9]|1[0-2])$/.test(value('month')) ? value('month') : '', sector:value('sector'), uf:[...MA_UFS,'unknown'].includes(value('uf')) ? value('uf') : '', status:MA_STATUSES.includes(value('status')) ? value('status') : '', query:value('query'), selected:value('selected'), page:Math.max(1,Math.min(100000,Number.parseInt(value('page'),10) || 1)) }
}
export function maRoute(state = {}) {
  const params = new URLSearchParams()
  for (const key of ['year','month','sector','uf','status','query','selected','page']) if (state[key] && (key !== 'page' || state.page > 1)) params.set(key,state[key])
  return `${state.tab === 'transacoes' ? 'transacoes' : 'visao-geral'}${params.size ? `?${params}` : ''}`
}
