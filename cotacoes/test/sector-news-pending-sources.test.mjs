import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SECTOR_NEWS_SOURCES } from '../src/sectorNews.js'
import { extractGovArticleLinks } from '../scripts/sector-news-lib.mjs'
import { createProductionState, PRODUCTION_SOURCE_IDS } from '../scripts/sector-news-safe/production-state.mjs'

// Minimal configuration excerpts from successful public listing reads on 2026-11-08.
// These are NOT article fixtures and must never be promoted into the news feed.
for (const id of ['aneel', 'susep']) {
  test(`${id}: unloaded customSearch must not be mistaken for a validated empty news source`, async () => {
    const evidence = JSON.parse(await readFile(new URL(`./fixtures/institutional-review/${id}.json`, import.meta.url)))
    const source = SECTOR_NEWS_SOURCES.find(s => s.id === id)
    assert.equal(evidence.url, source.url)
    assert.equal(evidence.httpStatus, 200)
    assert.equal(evidence.licenseMarkerPresent, true)
    assert.match(evidence.htmlSha256, /^[a-f0-9]{64}$/)
    assert.ok(Object.values(evidence.blocks).some(block => block['@type'] === 'customSearch'))
    assert.equal(evidence.querystringsearch.loaded, false)
    assert.deepEqual(evidence.querystringsearch.items, [])
    const shell = `<script>window.__data=${JSON.stringify({ content: { data: { blocks: evidence.blocks } }, querystringsearch: evidence.querystringsearch })};</script>`
    assert.deepEqual(extractGovArticleLinks(shell, source), [])
    assert.equal(PRODUCTION_SOURCE_IDS.includes(id), true)
    const previousFeed = JSON.parse(await readFile(new URL('../public/sector-news.json', import.meta.url)))
    const state = createProductionState({ previousFeed })
    assert.equal(state.sources[id].status, 'suspended')
    assert.equal(state.sources[id].block.code, 'parser_review_required')
  })
}

test('production selection includes only nine original and two reviewed parser sources', () => {
  assert.deepEqual(PRODUCTION_SOURCE_IDS, ['mapa', 'antt', 'mdic', 'anp', 'anm', 'ana', 'cvm', 'ans', 'ipen', 'aneel', 'susep'])
})
