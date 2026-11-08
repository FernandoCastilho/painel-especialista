// Quais blocos conservam dados anteriores há mais de `hours` horas.
// Retenção não comprova indisponibilidade da fonte: algumas coletas estão desativadas.
import { BNDES_SERIES } from './bndes-lib.mjs'
import { MOEDAS_CATALOG, SOURCE_STATUS } from './moedas-lib.mjs'
const LABELS = {
  macro: { cdi: 'CDI', selic: 'Selic', sofr: 'SOFR', sofrAvg: 'médias da SOFR', focus: 'Boletim Focus', ptax: 'PTAX' },
  curves: { br: 'DI x pré', cc: 'cupom cambial', us: 'Treasuries' },
  indexadores: { TR: 'TR', TBF: 'TBF', TLP: 'TLP' },
  bndes: { ...Object.fromEntries(BNDES_SERIES.map((s) => [s.key, `TFB ${s.prazo} meses, liberação em ${s.liberacao} dias`])), TLP: 'TLP (BNDES)' },
  moedas: Object.fromEntries(MOEDAS_CATALOG.map((c) => [c.id, `${c.name} (${c.id})`])),
  news: { USD: 'notícias do USD', EUR: 'notícias do EUR', JPY: 'notícias do JPY', CNH: 'notícias do CNH' },
}

export function describeStaleItem(item) {
  const age = item.hours == null ? 'data da coleta desconhecida' : `${item.hours} h sem atualizar`
  if (item.collectionDisabled) return `${item.label}: ${item.reason}; ${age}. O dado anterior foi preservado; este alerta não comprova falha da fonte.`
  return `${item.label}: ${age}`
}

// files = conteúdo dos JSON gerados. O alerta inclui o motivo quando a coleta
// está deliberadamente desativada. A idade e o limiar não são suprimidos.
export function staleReport(files, now = Date.now(), hours = 6) {
  const items = []
  for (const [file, labels] of Object.entries(LABELS)) {
    for (const [key, since] of Object.entries(files?.[file]?.stale ?? {})) {
      const h = since ? (now - since) / 36e5 : Infinity
      if (h > hours) {
        const policy = file === 'moedas' ? SOURCE_STATUS[key] : null
        const item = { file, key, label: labels[key] ?? key, since: since ?? null, hours: Number.isFinite(h) ? Math.round(h * 10) / 10 : null }
        if (policy?.automaticCollectionEnabled === false) {
          item.collectionDisabled = true
          item.reason = policy.reason
        }
        item.detail = describeStaleItem(item)
        items.push(item)
      }
    }
  }
  return items
}
