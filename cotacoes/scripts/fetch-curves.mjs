import { b3CollectionDecision } from './data-schedules.mjs'
import { collectB3Curve } from './b3-collector.mjs'
// Coleta as curvas de juros (DI x pré da B3 e Treasuries dos EUA) e grava public/curves.json. Rodado a cada hora pelo GitHub Actions.
import { mkdir, writeFile } from 'node:fs/promises'
import { fillFromPrevious, loadPreviousOrFail } from './prev-lib.mjs'
import { parseTreasury, pickDates } from './curves-lib.mjs'
import { addToHistory, emptyHistory, withHistory } from './curves-history.mjs'

const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', accept: 'application/json, text/csv, */*' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []

async function get(url, label, text = false, tries = 4) {
  let last
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      if (!body.trim()) throw new Error(`resposta vazia (HTTP ${res.status})`)
      return text ? body : JSON.parse(body)
    } catch (e) {
      last = e
      await sleep(2000 * i)
    }
  }
  errors.push(`${label}: ${last.message}`)
  return null
}

// Publicado ilegível (diferente de inexistente) interrompe a coleta: sem ele, fora do horário da B3 as curvas DI x pré e cupom sairiam do painel.
const previous = await loadPreviousOrFail('curves.json')
const out = { generatedAt: Date.now(), br: null, cc: null, us: null, errors }

// Brasil (B3, Taxas referenciais): PRE = DI x pré; DOL = DI x dólar (cupom cambial). minDays corta os vértices curtos, muito ruidosos no cupom.
async function b3Curve(id,minDays,key) {
  try {
    const data=await collectB3Curve(id,minDays,{previous:previous?.[key],now:out.generatedAt})
    errors.push(...data.warnings)
    console.log('B3 '+id+': '+data.sourceDate+'; '+data.curves[data.sourceDate].length+' vértices; catálogo pendente='+data.discoveryPending)
    return data
  } catch(error) { errors.push(error.message); return null }
}
const decision=b3CollectionDecision(out.generatedAt,previous?.br?.checkedAt)
out.b3Schedule=decision
if(decision.reason==='calendário B3 do ano não verificado')errors.push(decision.reason)
if(decision.run) { out.br=await b3Curve('PRE',1,'br');out.cc=await b3Curve('DOL',21,'cc') }
else {out.br=previous?.br ?? null;out.cc=previous?.cc ?? null;console.log('B3: '+decision.reason)}

// EUA: Treasury par yield curve (Tesouro dos EUA)
{
  const year = new Date().getUTCFullYear()
  let all = {}
  for (const y of [year - 1, year]) {
    const csv = await get(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`, `Treasury ${y}`, true)
    if (csv) all = { ...all, ...parseTreasury(csv) }
  }
  const picks = pickDates(Object.keys(all))
  const curves = Object.fromEntries(picks.map((p) => [p.date, all[p.date].map(([years, rate, label]) => [years, rate, label])]))
  out.us = picks.length ? { compare: picks, curves } : null
  console.log('Treasuries:', picks.map((p) => p.date).join(', ') || 'sem dados')
}

fillFromPrevious(out, previous, ['br', 'cc', 'us'])

// Histórico próprio das curvas da B3 (a B3 só entrega o último dia). Falha de rede ao ler o histórico interrompe a coleta
// (o deploy da hora falha e a próxima tenta de novo), para nunca publicar um histórico zerado por engano.
async function loadHistory(repo = process.env.GITHUB_REPOSITORY) {
  const [owner, name] = (repo ?? '').split('/')
  if (!owner || !name) return emptyHistory()
  let last
  for (let i = 1; i <= 4; i++) {
    try {
      const res = await fetch(`https://${owner.toLowerCase()}.github.io/${name}/curves-history.json?t=${Date.now()}`, { signal: AbortSignal.timeout(20000) })
      if (res.status === 404) return emptyHistory()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const j = await res.json()
      if (!j || typeof j !== 'object') throw new Error('arquivo inválido')
      return { ...emptyHistory(), ...j }
    } catch (e) { last = e; await sleep(2000 * i) }
  }
  throw new Error(`histórico das curvas indisponível: ${last.message}`)
}
let history = await loadHistory()
for (const key of ['br', 'cc']) {
  // semente: a curva mais recente já publicada é real (as comparações antigas eram cópias e não entram)
  const prev = previous?.[key]
  if (prev?.sourceDate && prev.curves?.[prev.sourceDate] && !history[key]?.[prev.sourceDate]) history = addToHistory(history, key, prev.sourceDate, prev.curves[prev.sourceDate])
  const cur = out[key]
  if (cur?.sourceDate && cur.curves?.[cur.sourceDate] && !out.stale?.[key]) history = addToHistory(history, key, cur.sourceDate, cur.curves[cur.sourceDate])
  if (cur) out[key] = withHistory(cur, history[key])
}
history.updatedAt = Date.now()
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/curves-history.json', import.meta.url), JSON.stringify(history))
console.log('Histórico das curvas B3:', ['br', 'cc'].map((k) => `${k} ${Object.keys(history[k] || {}).length} dias`).join(', '))
if(decision.reason==='calendário B3 do ano não verificado')for(const key of ['br','cc'])if(out[key])out.stale[key]=previous?.stale?.[key] ?? previous?.generatedAt ?? null
for(const key of ['br','cc']) if(!decision.run && previous?.stale?.[key])out.stale[key]=previous.stale[key]
for(const key of ['br','cc']) if(out[key]?.discoveryPending) out.stale[key]=previous?.stale?.[key] ?? previous?.generatedAt ?? null
if (Object.keys(out.stale).length) console.log('Reaproveitado do último publicado:', Object.keys(out.stale).join(', '))
if (!out.br && !out.us && process.env.CURVES_STRICT === 'true') {
  console.error('Nenhuma curva coletada:', errors)
  process.exit(1)
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/curves.json', import.meta.url), JSON.stringify(out))
if (errors.length) console.log('Avisos:', errors.join(' | '))
