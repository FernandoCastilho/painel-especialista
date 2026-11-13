// Coleta manchetes por moeda e grava public/news.json. Rodado pelo GitHub Actions a cada hora.
import { mkdir, writeFile } from 'node:fs/promises'
import { fillNewsFromPrevious, loadPrevious } from './prev-lib.mjs'
import { GTX, MARKET_QUERIES, balance, canonicalSource, freshOnly, fromLingva, fromMyMemory, googleUrl, gtxBody, isEnglish, lingvaUrl, mentionsCurrency, myMemoryUrl, parseRss, pick, splitBatch } from './news-lib.mjs'

const SITES = {
  valor: 'site:valor.globo.com',
  investing: '(site:br.investing.com OR site:investing.com)',
}

// termos por moeda: [português, inglês]
const TOPICS = {
  USD: ['dólar câmbio', 'US dollar Fed forex'],
  EUR: ['euro câmbio BCE', 'euro ECB EUR/USD'],
  JPY: ['iene Banco do Japão', 'yen Bank of Japan USD/JPY'],
  CNH: ['yuan China câmbio PBOC', 'yuan PBOC offshore CNH'],
}

// grupo → [consultas], limite de manchetes por grupo
const groups = (pt, en) => [
  { id: 'google', limit: 5, requests: [[pt, 'pt'], [en, 'en']] },
  { id: 'valor', limit: 4, requests: [[`${pt} ${SITES.valor}`, 'pt']] },
  { id: 'investing', limit: 4, requests: [[`${pt} ${SITES.investing}`, 'pt'], [`${en} ${SITES.investing}`, 'en']] },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function get(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-news)' }, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

const errors = []
const news = {}

const HEADERS = { 'user-agent': 'Mozilla/5.0 (cotacoes-news)' }

async function withRetry(fn, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      await sleep(2000 * (i + 1) ** 2)
    }
  }
  throw last
}

async function postBatch(titles) {
  const res = await fetch(GTX, {
    method: 'POST',
    headers: { ...HEADERS, 'content-type': 'application/x-www-form-urlencoded' },
    body: gtxBody(titles),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const lines = splitBatch(await res.json(), titles.length)
  if (!lines) throw new Error('resposta fora do formato')
  return lines
}

// Traduz títulos em inglês: lote único no Google Tradutor; se falhar, uma manchete por vez em serviços de reserva.
async function translateAll(titles) {
  const out = new Map()
  const todo = [...new Set(titles.filter(isEnglish))]
  if (!todo.length) return out
  try {
    const lines = await withRetry(() => postBatch(todo))
    todo.forEach((t, i) => out.set(t, lines[i]))
    console.log('traducao: lote Google,', todo.length, 'títulos')
    return out
  } catch (e) {
    errors.push(`traducao (lote): ${e.message}`)
  }
  const backups = [
    ['lingva', lingvaUrl, fromLingva],
    ['mymemory', myMemoryUrl, fromMyMemory],
  ]
  for (const t of todo) {
    for (const [name, url, parse] of backups) {
      try {
        const text = parse(JSON.parse(await get(url(t))))
        if (text && text.toLowerCase() !== t.toLowerCase()) {
          out.set(t, text)
          break
        }
      } catch (e) {
        errors.push(`traducao (${name}): ${e.message}`)
      }
    }
    await sleep(300)
  }
  console.log('traducao: reservas,', out.size, 'de', todo.length)
  return out
}

for (const [code, [pt, en]] of Object.entries(TOPICS)) {
  const all = []
  for (const g of groups(pt, en)) {
    const items = []
    for (const [q, lang] of g.requests) {
      try {
        items.push(...parseRss(await get(googleUrl(q, lang))))
      } catch (e) {
        errors.push(`${code}/${g.id}/${lang}: ${e.message}`)
      }
      await sleep(400)
    }
    for (const it of pick(freshOnly(items).filter((it) => mentionsCurrency(code, it.title)), g.limit)) all.push({ title: it.title, link: it.link, source: canonicalSource(it), t: it.t, via: g.id })
  }
  news[code] = balance(all, 5).map((it) => ({ title: it.title, link: it.link, source: it.source, t: it.t }))
  console.log(code, news[code].length, 'manchetes')
}

// "Mercado hoje" (Valor Econômico e demais veículos): janela de busca de 2 dias, sem matéria com mais de 3 dias (subconjunto do teto de 5 dias).
const marketAll = []
for (const g of [{ id: 'valor', limit: 8, site: SITES.valor, queries: MARKET_QUERIES }, { id: 'google', limit: 4, site: '', queries: MARKET_QUERIES.slice(0, 2) }]) {
  const items = []
  for (const q of g.queries) {
    try {
      items.push(...parseRss(await get(googleUrl(g.site ? `${q} ${g.site}` : q, 'pt', '2d'))))
    } catch (e) {
      errors.push(`MERCADO/${g.id}: ${e.message}`)
    }
    await sleep(400)
  }
  for (const it of pick(freshOnly(items, Date.now(), 3 * 864e5), g.limit)) marketAll.push({ title: it.title, link: it.link, source: canonicalSource(it), t: it.t, via: g.id })
}
news.MERCADO = balance(marketAll, 8).map((it) => ({ title: it.title, link: it.link, source: it.source, t: it.t }))
console.log('MERCADO', news.MERCADO.length, 'manchetes')

const translated = await translateAll(Object.values(news).flat().map((n) => n.title))
for (const n of Object.values(news).flat()) {
  const tr = translated.get(n.title)
  if (tr) Object.assign(n, { original: n.title, title: tr })
}

// Moeda sem manchetes novas: mantém as anteriores (e avisa na tela).
const stale = fillNewsFromPrevious(news, await loadPrevious('news.json'))
if (Object.keys(stale).length) console.log('Manchetes mantidas do último publicado:', Object.keys(stale).join(', '))
const total = Object.values(news).reduce((n, a) => n + a.length, 0)
if (errors.length) console.warn('Falhas:', errors.join(' | '))
if (!total && process.env.NEWS_STRICT === 'true') {
  console.error('Nenhuma manchete coletada; abortando para manter as notícias anteriores no ar.')
  process.exit(1)
}

await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/news.json', import.meta.url), JSON.stringify({ generatedAt: Date.now(), news, stale, errors }))
console.log('news.json gravado:', total, 'manchetes;', translated.size, 'traduzidas')
