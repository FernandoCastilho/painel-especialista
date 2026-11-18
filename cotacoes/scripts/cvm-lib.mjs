import { CVM_METRICS, CVM_METRIC_KEYS } from '../src/bancosCvm.js'

export const CVM_BASE = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/'
export const cvmZipUrl = (kind, year) => `${CVM_BASE}${kind.toUpperCase()}/DADOS/${kind.toLowerCase()}_cia_aberta_${year}.zip`
export const cvmEntry = (kind, statement, year) => `${kind.toLowerCase()}_cia_aberta_${statement}_con_${year}.csv`

// Lê o CSV da CVM (separado por ponto e vírgula, ISO-8859-1 já decodificado) e guarda só as
// linhas dos bancos pedidos. Filtrar antes de separar os campos poupa memória: o arquivo cobre todas as companhias.
export function readCvmRows(text, cvmCodes) {
  const lines = text.split(/\r?\n/)
  const header = (lines.shift() || '').split(';')
  const col = name => header.indexOf(name)
  const idx = { cvm: col('CD_CVM'), refer: col('DT_REFER'), version: col('VERSAO'), scale: col('ESCALA_MOEDA'), order: col('ORDEM_EXERC'), ini: col('DT_INI_EXERC'), end: col('DT_FIM_EXERC'), code: col('CD_CONTA'), name: col('DS_CONTA'), value: col('VL_CONTA') }
  if ([idx.cvm, idx.version, idx.scale, idx.order, idx.end, idx.code, idx.name, idx.value].some(i => i < 0)) throw new Error('Layout do arquivo da CVM mudou: coluna esperada ausente')
  const wanted = new Set(cvmCodes.map(Number))
  const rows = []
  for (const line of lines) {
    if (!line) continue
    const f = line.split(';')
    if (!wanted.has(Number(f[idx.cvm]))) continue
    rows.push({ cvm: Number(f[idx.cvm]), refer: f[idx.refer], version: Number(f[idx.version]) || 0, scale: f[idx.scale], current: /^.LTIMO$/.test(f[idx.order]), ini: idx.ini >= 0 ? f[idx.ini] : '', end: f[idx.end], code: f[idx.code], name: f[idx.name], value: f[idx.value] })
  }
  return rows
}

// Valor em reais de uma linha. A CVM publica em MIL (milhares) ou UNIDADE.
export function cvmValue(row) {
  const n = Number(row.value)
  if (!Number.isFinite(n)) return null
  if (row.scale === 'MIL') return n * 1000
  if (row.scale === 'UNIDADE') return n
  throw new Error(`Escala desconhecida na CVM: ${row.scale}`)
}

// Valor do indicador numa janela de datas. Havendo reapresentação, vale a versão mais alta.
function metricValue(rows, key, { ini = null, end }) {
  const spec = CVM_METRICS[key]
  const hits = rows.filter(r => r.current && r.end === end && (ini === null || r.ini === ini) && spec.match(r.code, r.name))
  if (!hits.length) return null
  const top = Math.max(...hits.map(r => r.version))
  const values = [...new Set(hits.filter(r => r.version === top).map(cvmValue))]
  // Duas contas diferentes com o mesmo nome no mesmo nível seriam ambíguas: melhor não publicar.
  return values.length === 1 ? values[0] : null
}

const pad = n => String(n).padStart(2, '0')
const quarterEnd = (year, q) => `${year}-${['03-31', '06-30', '09-30', '12-31'][q - 1]}`
const quarterStart = (year, q) => `${year}-${['01-01', '04-01', '07-01', '10-01'][q - 1]}`

// rows = { dfp: { [ano]: linhas }, itr: { [ano]: linhas } } com as linhas de BPA, BPP e DRE juntas.
export function buildBankCvm(bank, rows) {
  const annual = [], quarterly = []
  for (const year of Object.keys(rows.dfp || {}).map(Number).sort()) {
    const set = rows.dfp[year].filter(r => r.cvm === bank.cvmCode)
    const end = `${year}-12-31`, metrics = {}
    for (const key of CVM_METRIC_KEYS) {
      const v = metricValue(set, key, { end, ini: CVM_METRICS[key].kind === 'flow' ? `${year}-01-01` : null })
      if (v !== null) metrics[key] = v
    }
    if (Object.keys(metrics).length) annual.push({ year, metrics, source: `DFP ${year}` })
  }
  const years = [...new Set([...Object.keys(rows.itr || {}), ...Object.keys(rows.dfp || {})].map(Number))].sort()
  for (const year of years) {
    const itr = (rows.itr?.[year] || []).filter(r => r.cvm === bank.cvmCode), dfp = (rows.dfp?.[year] || []).filter(r => r.cvm === bank.cvmCode)
    for (let q = 1; q <= 4; q++) {
      const metrics = {}, derived = []
      const stockSet = q === 4 ? dfp : itr, flowSet = itr
      for (const key of CVM_METRIC_KEYS) {
        const spec = CVM_METRICS[key]
        if (spec.kind === 'stock') {
          const v = metricValue(stockSet, key, { end: quarterEnd(year, q) })
          if (v !== null) metrics[key] = v
        } else if (q < 4) {
          const v = metricValue(flowSet, key, { ini: quarterStart(year, q), end: quarterEnd(year, q) })
          if (v !== null) metrics[key] = v
        } else {
          // A CVM não publica o 4º trimestre isolado: sai do ano (DFP) menos os nove meses (ITR).
          const whole = metricValue(dfp, key, { ini: `${year}-01-01`, end: `${year}-12-31` })
          const nine = metricValue(itr, key, { ini: `${year}-01-01`, end: `${year}-09-30` })
          if (whole !== null && nine !== null) { metrics[key] = whole - nine; derived.push(key) }
        }
      }
      if (Object.keys(metrics).length) quarterly.push({ period: Number(`${year}${pad(q * 3)}`), metrics, ...(derived.length ? { derived } : {}), source: q === 4 ? `DFP ${year}${derived.length ? ' − ITR ' + year : ''}` : `ITR ${year}` })
    }
  }
  return { id: bank.id, name: bank.name, cvmCode: bank.cvmCode, annual, quarterly }
}

// Junta o resultado novo com o que já estava publicado: período novo vence; o que não veio é mantido.
export function mergeBankCvm(previous, fresh) {
  const merge = (oldList = [], newList = [], key) => {
    const map = new Map(oldList.map(p => [p[key], p]))
    for (const p of newList) map.set(p[key], { ...(map.get(p[key]) || {}), ...p, metrics: { ...(map.get(p[key])?.metrics || {}), ...p.metrics } })
    return [...map.values()].sort((a, b) => a[key] - b[key])
  }
  return { ...fresh, annual: merge(previous?.annual, fresh.annual, 'year'), quarterly: merge(previous?.quarterly, fresh.quarterly, 'period') }
}
