export const WTI_URL = 'https://www.eia.gov/dnav/pet/hist/RWTCD.htm'
export const PINK_PAGE_URL = 'https://www.worldbank.org/en/research/commodity-markets'
export const HENRY_HUB_URL = 'https://www.eia.gov/dnav/ng/hist/rngwhhdd.htm'
export const NY_DIESEL_URL = 'https://www.eia.gov/dnav/pet/hist/EER_EPD2DXL0_PF4_Y35NY_DPGD.htm'
export const NY_GASOLINE_URL = 'https://www.eia.gov/dnav/pet/hist/EER_EPMRU_PF4_Y35NY_DPGD.htm'
// US¢/libra-peso a partir de USD/kg (1 lb = 0,45359237 kg): convenção de mercado para açúcar e café.
export const CENTS_PER_LB = 100 * 0.45359237
export const PULP_URL = 'https://comexstat.mdic.gov.br/pt/geral'
export const COMMODITIES = [
  { id: 'pulp-br', label: 'Celulose · exportação Brasil', unit: 'USD/tonelada', nature: 'preço médio FOB mensal', sourceName: 'MDIC/SECEX', sourceUrl: PULP_URL, benchmark: 'Exportações brasileiras • não é cotação spot nem preço por tipo de fibra', decimals: 2 },
  { id: 'wti', label: 'Petróleo WTI', unit: 'USD/barril', nature: 'spot diário', sourceName: 'EIA', sourceUrl: WTI_URL, benchmark: 'Cushing, Oklahoma • FOB' },
  { id: 'iron-ore', label: 'Minério de ferro', unit: 'USD/tonelada seca', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: '62% Fe • CFR China • spot' },
  { id: 'soybeans', label: 'Soja', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'FOB US Gulf' },
  { id: 'corn', label: 'Milho', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'FOB US Gulf' },
  { id: 'gold', label: 'Ouro', unit: 'USD/onça troy', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Spot • média mensal' },
  { id: 'henry-hub', label: 'Gás natural · Henry Hub', unit: 'USD/MMBtu', nature: 'spot diário', sourceName: 'EIA', sourceUrl: HENRY_HUB_URL, benchmark: 'Henry Hub, Louisiana • spot' },
  { id: 'ny-diesel', label: 'Diesel · Nova York', unit: 'USD/galão', nature: 'spot diário', sourceName: 'EIA', sourceUrl: NY_DIESEL_URL, benchmark: 'ULSD nº 2 • New York Harbor', decimals: 3 },
  { id: 'ny-gasoline', label: 'Gasolina · Nova York', unit: 'USD/galão', nature: 'spot diário', sourceName: 'EIA', sourceUrl: NY_GASOLINE_URL, benchmark: 'Convencional regular • FOB New York Harbor', decimals: 3 },
  { id: 'copper', label: 'Cobre', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Grau A • LME' },
  { id: 'aluminum', label: 'Alumínio', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'LME • 99,5% de pureza' },
  { id: 'sugar', label: 'Açúcar', unit: 'US¢/libra-peso', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Preço mundial do açúcar bruto', decimals: 2 },
  { id: 'coffee', label: 'Café arábica', unit: 'US¢/libra-peso', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Arábica • indicador da ICO', decimals: 2 },
  { id: 'urea', label: 'Ureia', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Fertilizante nitrogenado • spot' },
  { id: 'dap', label: 'DAP (fosfato)', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Fosfato diamônico • spot' },
  // Itens da apresentação ao cliente (alimentos, confecção, proteína animal, siderurgia).
  { id: 'wheat', label: 'Trigo', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'US HRW • FOB Golfo EUA' },
  { id: 'beef', label: 'Carne bovina', unit: 'USD/kg', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Carne desossada • importação EUA (Austrália/NZ)', decimals: 2 },
  { id: 'cotton', label: 'Algodão', unit: 'US¢/libra-peso', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Cotlook A Index', decimals: 2 },
  { id: 'coal', label: 'Carvão', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'Térmico • Austrália • FOB Newcastle' },
  { id: 'cocoa', label: 'Cacau', unit: 'USD/kg', nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet', sourceUrl: PINK_PAGE_URL, benchmark: 'ICCO • média diária', decimals: 2 },
]
const meta = id => COMMODITIES.find(c => c.id === id)
// Séries diárias da EIA: página, título esperado (barreira contra mudança de série/unidade).
export const EIA_DAILY = {
  wti: /Cushing, OK WTI Spot Price FOB\s*\(Dollars per Barrel\)/i,
  'henry-hub': /Henry Hub Natural Gas Spot Price\s*\(Dollars per Million Btu\)/i,
  'ny-diesel': /New York Harbor Ultra-Low Sulfur No 2 Diesel Spot Price\s*\(Dollars per Gallon\)/i,
  'ny-gasoline': /New York Harbor Conventional Gasoline Regular Spot Price FOB\s*\(Dollars per Gallon\)/i,
}
export const isDaily = id => id in EIA_DAILY
export const HISTORY_DAILY = 1500
export const HISTORY_MONTHS = 240
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const positive = v => Number.isFinite(v) && v > 0
const isoDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s

export function discoverPinkSheetUrl(html) {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+CMO-Historical-Data-Monthly\.xlsx(?:\?[^"']*)?)["']/gi)]
  for (const [, link] of links) {
    const url = new URL(link.replace(/&amp;/g, '&'), PINK_PAGE_URL)
    if (url.protocol === 'https:' && url.hostname === 'thedocs.worldbank.org') return url.href
  }
  throw new Error('Banco Mundial: link XLSX mensal oficial não encontrado')
}

function item(meta, latest, previous, releaseDate, sourceUrl, now) {
  const checkedAt = now.toISOString()
  if (!isoDay(releaseDate) || releaseDate > checkedAt.slice(0,10) || latest.period > releaseDate) throw new Error('Fonte: datas futuras ou inconsistentes')
  return { ...meta, value: latest.value, period: latest.period, releaseDate, sourceUrl, checkedAt, stale: false, error: null,
    previousValue: previous?.value ?? null, previousPeriod: previous?.period ?? null,
    variationPct: previous ? (latest.value - previous.value) / Math.abs(previous.value) * 100 : null,
    variationBasis: isDaily(meta.id) ? 'observação diária anterior' : 'mês anterior' }
}

export const buildWti = (html, now = new Date()) => buildEiaDaily('wti', html, now)

export function buildEiaDaily(id, html, now = new Date()) {
  const def = meta(id)
  if (!EIA_DAILY[id].test(html.replace(/<[^>]*>/g, ''))) throw new Error(`EIA: série ${def.label}/unidade inesperada`)
  const clean = s => s.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim()
  const points = []
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => clean(m[1]))
    const date = cells[0]?.match(/^(\d{4})\s+([A-Za-z]{3})-\s*(\d{1,2})\s+to\s+/)
    if (!date || cells.length !== 6) continue
    const month = MONTHS.findIndex(m => m.slice(0,3) === date[2])
    const monday = new Date(Date.UTC(+date[1], month, +date[3]))
    if (month < 0 || monday.getUTCDay() !== 1 || monday.getUTCMonth() !== month) throw new Error(`EIA: semana ${def.label} inválida`)
    for (let i=1; i<=5; i++) {
      if (['', '-', '--', 'NA', 'W'].includes(cells[i])) continue
      // Negative WTI prices are legitimate (notably April 2020), not missing data.
      if (!/^-?\d+(?:\.\d+)?$/.test(cells[i]) || !Number.isFinite(Number(cells[i]))) throw new Error(`EIA: preço ${def.label} inválido`)
      const day = new Date(monday); day.setUTCDate(day.getUTCDate() + i - 1)
      points.push({ period: day.toISOString().slice(0,10), value: Number(cells[i]) })
    }
  }
  points.sort((a,b) => a.period.localeCompare(b.period))
  if (!points.length || new Set(points.map(p => p.period)).size !== points.length) throw new Error(`EIA: datas ${def.label} ausentes/duplicadas`)
  const readDate = label => {
    const match = html.match(new RegExp(`(?:^|>)\\s*${label}:\\s*(\\d{1,2})/(\\d{1,2})/(\\d{4})`, 'i'))
    const date = match ? `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}` : null
    if (!isoDay(date)) throw new Error(`EIA: ${label} inválida`)
    return date
  }
  const releaseDate = readDate('Release Date'), nextReleaseDate = readDate('Next Release Date')
  if (nextReleaseDate < releaseDate) throw new Error(`EIA: próxima publicação ${def.label} inválida`)
  // Missing cells are skipped, never coerced to zero. Zero prices also have no percentage base.
  const previous = points.at(-2)?.value !== 0 ? points.at(-2) : null
  // Série diária para o gráfico (últimos ~6 anos); célula sem dado nunca vira zero.
  return { ...item(def, points.at(-1), previous, releaseDate, def.sourceUrl, now), nextReleaseDate, history: points.slice(-HISTORY_DAILY) }
}

export function parsePinkRows(rows, sourceUrl, now = new Date()) {
  if (!Array.isArray(rows)) throw new Error('Banco Mundial: tabela inválida')
  const text = rows.slice(0,10).flatMap(Object.values).join(' ')
  if (!/World Bank Commodity Price Data/.test(text) || !/monthly prices in nominal US dollars/i.test(text)) throw new Error('Banco Mundial: planilha/série inesperada')
  const updated = text.match(/Updated on ([A-Za-z]+) (\d{1,2}), (\d{4})/)
  const month = updated ? MONTHS.indexOf(updated[1]) + 1 : 0
  if (!month) throw new Error('Banco Mundial: data de publicação ausente')
  const releaseDate = `${updated[3]}-${String(month).padStart(2,'0')}-${updated[2].padStart(2,'0')}`
  const headerIndex = rows.findIndex(r => Object.values(r).includes('Soybeans'))
  const header = rows[headerIndex], units = rows[headerIndex + 1]
  if (!header || !units) throw new Error('Banco Mundial: cabeçalho ausente')
  // [id, coluna (texto exato ou expressão regular: a carne vem como "Beef **", com asteriscos de nota), unidades aceitas, fator, obrigatória]. As quatro primeiras são obrigatórias; nas demais, se a coluna ou a unidade mudar,
  // a série fica de fora (o coletor preserva o último valor válido) em vez de derrubar a leitura inteira.
  const definitions = [
    ['iron-ore', 'Iron ore, cfr spot', ['($/dmtu)', '($/dmt)'], 1, true], ['soybeans', 'Soybeans', ['($/mt)'], 1, true], ['corn', 'Maize', ['($/mt)'], 1, true], ['gold', 'Gold', ['($/troy oz)'], 1, true],
    ['copper', 'Copper', ['($/mt)'], 1, false], ['aluminum', 'Aluminum', ['($/mt)'], 1, false], ['sugar', 'Sugar, world', ['($/kg)'], CENTS_PER_LB, false], ['coffee', 'Coffee, Arabica', ['($/kg)'], CENTS_PER_LB, false],
    ['urea', 'Urea', ['($/mt)'], 1, false], ['dap', 'DAP', ['($/mt)'], 1, false],
    ['wheat', 'Wheat, US HRW', ['($/mt)'], 1, false], ['beef', /^Beef(?:\s*\*+)?$/, ['($/kg)'], 1, false], ['cotton', 'Cotton, A Index', ['($/kg)'], CENTS_PER_LB, false], ['coal', 'Coal, Australian', ['($/mt)'], 1, false], ['cocoa', 'Cocoa', ['($/kg)'], 1, false],
  ]
  const dated = rows.filter(r => /^\d{4}M(?:0[1-9]|1[0-2])$/.test(r.A ?? '')).sort((a,b) => a.A.localeCompare(b.A))
  if (!dated.length || new Set(dated.map(r => r.A)).size !== dated.length) throw new Error('Banco Mundial: competências ausentes/duplicadas')
  const result = []
  for (const [id, name, allowedUnits, factor, required] of definitions) {
    try {
      const column = Object.keys(header).find(k => (typeof name === 'string' ? header[k].trim() === name : name.test(header[k].trim())))
      if (!column || !allowedUnits.includes(units[column]?.trim())) throw new Error(`Banco Mundial: série/unidade inesperada: ${name}`)
      const point = row => {
        const raw = row?.[column]?.trim()
        const value = raw && /^\d+(?:\.\d+)?(?:E[+-]?\d+)?$/i.test(raw) ? Number(raw) * factor : NaN
        if (!positive(value)) throw new Error(`Banco Mundial: último valor ausente/inválido: ${name}`)
        return { period: row.A.replace('M','-'), value }
      }
      const latest = point(dated.at(-1))
      // Modern iron-ore spot observations are USD/dry tonne, despite the legacy XLSX dmtu header.
      if (id === 'iron-ore' && latest.period < '2008-12') throw new Error('Banco Mundial: minério em unidade histórica incompatível')
      let previous = null
      if (dated.length > 1) { try { previous = point(dated.at(-2)) } catch { /* ignora */ } }
      if (previous) {
        const priorMonth = new Date(`${latest.period}-01T00:00:00Z`); priorMonth.setUTCMonth(priorMonth.getUTCMonth() - 1)
        if (previous.period !== priorMonth.toISOString().slice(0,7)) previous = null
      }
      // Série mensal para o gráfico (últimos 20 anos); mês sem valor válido fica de fora, nunca vira zero.
      const history = []
      for (const row of dated.slice(-HISTORY_MONTHS)) { try { history.push(point(row)) } catch { /* ignora */ } }
      result.push({ ...item(meta(id), latest, previous, releaseDate, sourceUrl, now), history })
    } catch (error) {
      if (required) throw error
    }
  }
  return result
}

export function validCommodity(value, id) {
  const def = meta(id)
  if (!def || value?.id !== id || value.unit !== def.unit || value.nature !== def.nature || !(id === 'wti' ? Number.isFinite(value.value) : positive(value.value))) return false
  if (!(isDaily(id) ? isoDay(value.period) : /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value.period ?? ''))) return false
  if (id === 'pulp-br') return value.sourceUrl === def.sourceUrl && isoDay(value.releaseDate) && value.period <= value.releaseDate && Number.isFinite(Date.parse(value.checkedAt)) && value.period <= value.checkedAt.slice(0, 7)
  if (!isoDay(value.releaseDate) || value.period > value.releaseDate || !Number.isFinite(Date.parse(value.checkedAt))) return false
  try { const url = new URL(value.sourceUrl); return url.protocol === 'https:' && (isDaily(id) ? url.href === def.sourceUrl : url.hostname === 'thedocs.worldbank.org') } catch { return false }
}

export function commodityFallback(id, candidates, error) {
  const previous = candidates.filter(v => validCommodity(v, id)).sort((a,b) => b.period.localeCompare(a.period) || b.checkedAt.localeCompare(a.checkedAt))[0]
  const message = error instanceof Error ? error.message : String(error)
  if (previous) return { ...previous, stale: true, error: message }
  return { ...meta(id), value: null, period: null, releaseDate: null, checkedAt: null, stale: true, error: message, previousValue: null, previousPeriod: null, variationPct: null, variationBasis: isDaily(id) ? 'observação diária anterior' : 'mês anterior' }
}
