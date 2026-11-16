// Moedas contratuais do BNDES: arquivos /Moedas/um<código>.txt com "data;<espaços>valor" (data dd/mm/aaaa, vírgula decimal; o sinal
// negativo vem antes dos espaços: "-      0,320000"; a ordem das linhas varia entre arquivos). Códigos da tabela "Consulta de Moedas" do BNDES.
// kind: 'rate' (% a.a., variação em p.p.), 'level' (índice ou preço, variação em %), 'pct' (percentual do período, variação em p.p.).
export const TFC_SERIES = [
  ['C01', 'TFC_60.90'], ['C02', 'TFC_120.90'], ['C03', 'TFC_MPME_60.90'], ['C04', 'TFC_MPME_120.90'], ['C05', 'TFC_TR_60.90'], ['C06', 'TFC_TR_120.90'],
  ['C07', 'TFC_DIR_60_40_PMA66'], ['C08', 'TFC_CAM_PF_NOV'], ['C09', 'TFC_CAM_PF_SNV'], ['C10', 'TFC_CAM_PJ_REC'], ['C11', 'TFC_CAM_PJ_NOV'],
  ['C12', 'TFC_SOB_GRANDE_60.90'], ['C13', 'TFC_SOB_MPME_60.90'], ['C14', 'TFC_SOB_AEX'], ['C15', 'TFC_TR_MPME_60'], ['C16', 'TFC_TR_MPME_120'],
  ['C17', 'TFC_TR_GRANDE_60'], ['C18', 'TFC_TR_GRANDE_120'], ['C20', 'TFC_TR_MPME_DIR_108M'], ['C22', 'TFC_TR_GR_DIR_108'],
  ['C23', 'TFC_MOB_FR_REC_60.90'], ['C24', 'TFC_MOB_FR_NV_60.90'], ['C25', 'TFC_MOB_ONIB_REC_120'], ['C26', 'TFC_MOB_ONIB_NV_120'],
]
export const MOEDAS_SERIES = [
  { id: '604', name: 'US$', kind: 'level', unit: 'R$' },
  { id: '143', name: 'SELIC ACUM. D-2', kind: 'level', unit: 'índice' },
  { id: 'LD1', name: 'SOBRETAXA LCD', kind: 'rate', unit: '% a.a.' },
  { id: '024', name: 'SOBRETAXA FIXA SELIC', kind: 'rate', unit: '% a.a.' },
  { id: '236', name: 'TLP-IPCA', kind: 'pct', unit: '% no mês' },
  { id: 'TR1', name: 'TFBTR60.90', kind: 'rate', unit: '% a.a.' },
  { id: 'TR2', name: 'TFBTR120.90', kind: 'rate', unit: '% a.a.' },
  { id: 'TD1', name: 'TFBD24.120', kind: 'rate', unit: '% a.a.' },
  { id: 'TD2', name: 'TFBD72.120', kind: 'rate', unit: '% a.a.' },
  { id: 'TD3', name: 'TFBD120.120', kind: 'rate', unit: '% a.a.' },
]
export const MOEDAS_CATALOG = [
  ...TFC_SERIES.map(([id, name]) => ({ id, name, group: 'tfc', kind: 'rate', unit: '% a.a.' })),
  ...MOEDAS_SERIES.map((s) => ({ ...s, group: 'moedas' })),
]
// Endpoint LD1 exposto pela consulta oficial e histórico verificado em 05/11/2026.
export const SOURCE_STATUS = Object.freeze({ LD1: Object.freeze({ endpointConfirmed: true, automaticCollectionEnabled: false, reason: 'coleta automática LD1 pendente de revisão de segurança e termos', verifiedAt: '2026-11-05T14:52:00Z', source: 'https://www.bndes.gov.br/Moedas/umLD1.txt' }) })
export const moedaUrl = (id) => SOURCE_STATUS[id]?.endpointConfirmed === false ? null : `https://www.bndes.gov.br/Moedas/um${id}.txt`

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/
export function isMoedaDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value
}

export const moedaDateInBrasilia = now => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

// O BNDES pode antecipar fixings; as cópias oficiais preservam os arquivos brutos.
export function onlyEffectiveMoedas(data, now) {
  if (!data?.series || typeof data.series !== 'object') return data
  const cutoff = moedaDateInBrasilia(now)
  const series = { ...data.series }, stale = { ...data.stale }
  let changed = false
  for (const [id, entry] of Object.entries(series)) {
    if (!validMoedaPoints(entry?.points) || !entry.points.some(([date]) => date > cutoff)) continue
    changed = true
    const points = entry.points.filter(([date]) => date <= cutoff)
    if (points.length) series[id] = { ...entry, points }
    else {
      delete series[id]
      delete stale[id]
    }
  }
  return changed ? { ...data, series, stale } : data
}

export const validMoedaPoints = points => Array.isArray(points) && points.every((point, i) =>
  Array.isArray(point) && point.length === 2 && isMoedaDate(point[0]) && Number.isFinite(point[1]) &&
  (!i || point[0] > points[i - 1][0]))

// Texto do arquivo -> [[AAAA-MM-DD, valor]] em ordem crescente, sem datas repetidas, sem linhas inválidas.
export function parseMoeda(text) {
  const byDay = new Map()
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const i = line.indexOf(';')
    if (i < 0) continue
    const m = DATE.exec(line.slice(0, i).trim())
    const value = Number(line.slice(i + 1).replace(/\s+/g, '').replace(/\./g, '').replace(',', '.'))
    if (!m || line.slice(i + 1).trim() === '' || !Number.isFinite(value) || Math.abs(value) > 1e6) continue
    const iso = `${m[3]}-${m[2]}-${m[1]}`
    if (!isMoedaDate(iso)) continue // 31/02 e afins
    byDay.set(iso, value)
  }
  return [...byDay].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

// results = { C01: texto|null, ... } -> arquivo public/moedas.json (valores com 6 casas, como o BNDES publica)
export function buildMoedas(results, errors = [], now = Date.now()) {
  const series = {}
  for (const { id } of MOEDAS_CATALOG) {
    const points = parseMoeda(results?.[id])
    if (points.length) series[id] = { points: points.map(([d, v]) => [d, Math.round(v * 1e6) / 1e6]), ...(id === 'LD1' && SOURCE_STATUS.LD1.endpointConfirmed ? { sourceValidated: true, source: moedaUrl(id) } : {}) }
  }
  return { schemaVersion: 1, generatedAt: now, series, errors }
}

// Conserva o histórico íntegro. Uma coleta ausente ou mais antiga não substitui o último dado nem sua data original.
export function fillSeriesFromPrevious(out, prev) {
  const stale = {}
  for (const { id } of MOEDAS_CATALOG) {
    if (SOURCE_STATUS[id]?.endpointConfirmed === false) continue
    if (id === 'LD1' && !(prev?.series?.LD1?.sourceValidated === true && prev.series.LD1.source === moedaUrl('LD1'))) continue
    const previous = prev?.series?.[id]
    if (previous === undefined) continue
    if (!validMoedaPoints(previous?.points)) throw new Error(`Série publicada ${id} inválida`)
    if (!previous.points.length) continue
    const current = out.series[id]
    if (!current?.points.length || current.points.at(-1)[0] < previous.points.at(-1)[0]) {
      out.series[id] = previous
      stale[id] = prev.stale?.[id] ?? prev.generatedAt ?? null
      continue
    }
    const history = new Map([...previous.points, ...current.points])
    current.points = [...history].sort(([a], [b]) => a.localeCompare(b))
  }
  out.stale = stale
  return out
}
