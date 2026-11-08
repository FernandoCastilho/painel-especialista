import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGitHubStore } from './sector-news-safe/git-store.mjs'
import { createLiveTransport } from './sector-news-safe/live-transport.mjs'
import { runSectorNewsProduction } from './sector-news-safe/runner.mjs'
import { digest } from './sector-news-safe/state.mjs'
import { PRODUCTION_SOURCE_IDS } from './sector-news-safe/production-state.mjs'
import { parserMaintenanceEnabled } from './sector-news-safe/maintenance.mjs'
import { normalizeSectorNews } from '../src/sectorNews.js'

export function confirmedSnapshot(state, savedFeed, now = Date.now()) {
  const confirmation = state.feed.lastPublication
  if (!confirmation || savedFeed.token !== confirmation.receipt || digest(savedFeed.payload) !== confirmation.digest) throw new Error('last_publication_not_confirmed')
  const feed = structuredClone(savedFeed.payload)
  feed.delivery = { ...feed.delivery, publishedAt: confirmation.publishedAt, receipt: confirmation.receipt, digest: confirmation.digest }
  feed.collection = normalizeSectorNews(feed, now).collection
  return feed
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--collect', '--snapshot'].includes(args[0])) throw new Error('Use --collect or --snapshot; no arbitrary sources or bootstrap.')
  const config = JSON.parse(await readFile(new URL('./sector-news-safe/production-config.json', import.meta.url), 'utf8'))
  const service = createGitHubStore(config)
  try {
  await service.verifyProtection()
  let state = (await service.store.read()).state
  let collectionResult = null
  if (args[0] === '--collect') {
    const previous = await service.readFeed()
    const result = await runSectorNewsProduction({ store: service.store, publisher: service.publisher, previousFeed: previous.payload,
      sourceIds: PRODUCTION_SOURCE_IDS, verifiedSince: config.verifiedSince, runId: `github-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT || '1'}`,
      transport: createLiveTransport({ sourceIds: PRODUCTION_SOURCE_IDS }) })
    collectionResult = result
    state = result.state || (await service.store.read()).state
  }
  const savedFeed = await service.readFeed()
  const feed = confirmedSnapshot(state, savedFeed)
  const maintenance = parserMaintenanceEnabled()
  if (maintenance) {
    feed.collectionPolicy = { ...feed.collectionPolicy, maintenanceActive: true }
    feed.collection = normalizeSectorNews(feed).collection
  }
  const output = fileURLToPath(new URL('../public/sector-news.json', import.meta.url))
  const temp = `${output}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(feed, null, 2) + '\n')
  await rename(temp, output)
  const summary = { checkedAt: new Date().toISOString(), mode: args[0].slice(2), maintenance, collectionAttempted: args[0] === '--collect' && collectionResult?.status !== 'maintenance', publication: state.feed.lastPublication,
    sources: Object.fromEntries(Object.entries(state.sources).map(([id, value]) => [id, { status: value.status, checkedAt: value.checkedAt, lastSuccessAt: value.lastSuccessAt, reason: value.reason }])),
    uniqueItems: new Set(Object.values(feed.topics).flatMap(topic => topic.items.map(item => item.link))).size }
  if (process.env.INSTITUTIONAL_NEWS_REPORT) {
    await mkdir(dirname(process.env.INSTITUTIONAL_NEWS_REPORT), { recursive: true })
    await writeFile(process.env.INSTITUTIONAL_NEWS_REPORT, JSON.stringify(summary, null, 2) + '\n')
  }
  console.log(JSON.stringify(summary, null, 2))
  return summary
  } finally { await service.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
