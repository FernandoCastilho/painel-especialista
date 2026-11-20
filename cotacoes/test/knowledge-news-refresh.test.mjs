import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refreshKnowledgeNews } from '../scripts/refresh-knowledge-news.mjs'
import { RELEASE_FILES } from '../scripts/pages-release-data.mjs'

const NOW = Date.parse('2026-11-07T15:00:00Z')
const DAY = 86400000
const article = (suffix, t, extras = {}) => ({
  title: `CDI e juros: ${suffix}`,
  link: `https://agenciabrasil.ebc.com.br/economia/noticia/2026-11/${suffix}`,
  source: 'Agência Brasil', sourceUrl: 'https://agenciabrasil.ebc.com.br',
  origin: 'news', topicIds: ['MERCADO'], t, ...extras,
})
const archive = items => ({ schemaVersion: 1, windowDays: 7, generatedAt: NOW - DAY, items })
const writeJson = (directory, file, data) => writeFile(join(directory, file), JSON.stringify(data))
async function temporary(run) {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-retention-'))
  try { await run(directory) } finally { await rm(directory, { recursive: true, force: true }) }
}

test('retains six-day published history without renewing publication and drops expired/future entries', async () => temporary(async directory => {
  await writeJson(directory, 'news.json', { generatedAt: NOW - 3600000, stale: {}, news: { MERCADO: [article('nova', NOW - DAY)] } })
  const published = archive([
    article('sexto-dia', NOW - 6 * DAY),
    article('limite', NOW - 7 * DAY),
    article('expirada', NOW - 7 * DAY - 1),
    article('futura', NOW + 1),
  ])
  const snapshot = await refreshKnowledgeNews({ directory, now: NOW, load: async file => { assert.equal(file, 'knowledge-news.json'); return published } })
  assert.equal(snapshot.archiveStatus.published, 'available')
  assert.equal(snapshot.items.find(item => item.title.includes('sexto-dia'))?.t, NOW - 6 * DAY)
  assert.equal(snapshot.items.find(item => item.title.includes('limite'))?.t, NOW - 7 * DAY)
  assert.equal(snapshot.items.some(item => /expirada|futura/.test(item.title)), false)
  assert.equal(snapshot.generatedAt, NOW)
  assert.equal(snapshot.sourceStates['news.json'].generatedAt, NOW - 3600000)
  assert.equal(snapshot.sourceStates['news.json'].stale, false)
  assert.match(snapshot.generatedAtMeaning, /não é data de publicação/)
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'knowledge-news.json'), 'utf8')), snapshot)
}))

test('failed published read keeps local eligible articles and exposes partial history', async () => temporary(async directory => {
  const retained = article('local-valida', NOW - 6 * DAY)
  await writeJson(directory, 'knowledge-news.json', archive([retained]))
  await writeFile(join(directory, 'news.json'), '<html>erro</html>')
  const snapshot = await refreshKnowledgeNews({ directory, now: NOW, load: async () => { throw new Error('offline') } })
  assert.equal(snapshot.items.length, 1)
  assert.equal(snapshot.items[0].t, retained.t)
  assert.equal(snapshot.archiveStatus.local, 'available')
  assert.equal(snapshot.archiveStatus.published, 'unavailable')
  assert.equal(snapshot.sourceStates['news.json'].status, 'invalid')
  assert.equal(snapshot.status, 'partial')
  assert.equal(snapshot.stale, true)
  assert.ok(snapshot.coverageNotes.some(note => /Histórico publicado.*indisponível/.test(note)))
}))

test('bootstrap explicitly reports missing history and never invents articles', async () => temporary(async directory => {
  const snapshot = await refreshKnowledgeNews({ directory, now: NOW, load: async () => null })
  assert.deepEqual(snapshot.items, [])
  assert.equal(snapshot.status, 'partial')
  assert.equal(snapshot.archiveStatus.local, 'missing')
  assert.ok(snapshot.coverageNotes.some(note => /sem recuperação retroativa/.test(note)))
  assert.equal(snapshot.sourceUpdatedAt, null)
}))

test('preserves the newest real source update across archive-only refreshes, never packaging time', async () => temporary(async directory => {
  const retained = article('historico', NOW - DAY)
  await writeJson(directory, 'knowledge-news.json', { ...archive([retained]), generatedAt: NOW, sourceUpdatedAt: NOW - 3 * DAY })
  const published = { ...archive([retained]), generatedAt: NOW, sourceUpdatedAt: NOW - 2 * DAY }
  const first = await refreshKnowledgeNews({ directory, now: NOW, load: async () => published })
  assert.equal(first.items.length, 1)
  assert.equal(first.sourceUpdatedAt, NOW - 2 * DAY)
  assert.equal(first.generatedAt, NOW)
  assert.ok(Object.values(first.sourceStates).every(state => state.status === 'missing'))
  const second = await refreshKnowledgeNews({ directory, now: NOW + 1000, load: async () => null })
  assert.equal(second.sourceUpdatedAt, first.sourceUpdatedAt)
  assert.equal(second.items[0].t, retained.t)
}))

test('ignores future, invalid and absent source update metadata in archives', async () => temporary(async directory => {
  const retained = article('historico', NOW - DAY)
  await writeJson(directory, 'knowledge-news.json', { ...archive([retained]), generatedAt: NOW, sourceUpdatedAt: NOW - DAY })
  const first = await refreshKnowledgeNews({ directory, now: NOW, load: async () => ({ ...archive([retained]), sourceUpdatedAt: NOW + 1 }) })
  assert.equal(first.sourceUpdatedAt, NOW - DAY)
  await writeJson(directory, 'knowledge-news.json', { ...archive([retained]), generatedAt: NOW, sourceUpdatedAt: 'inválida' })
  const second = await refreshKnowledgeNews({ directory, now: NOW, load: async () => ({ ...archive([retained]), sourceUpdatedAt: null }) })
  assert.equal(second.sourceUpdatedAt, null)
  assert.equal(second.items.length, 1)
}))

test('merges local and published snapshots, deduplicates and revalidates hostile URLs', async () => temporary(async directory => {
  const good = article('valida', NOW - DAY)
  await writeJson(directory, 'knowledge-news.json', archive([good, article('invalida', NOW, { link: 'javascript:alert(1)' })]))
  const snapshot = await refreshKnowledgeNews({ directory, now: NOW, load: async () => archive([good, article('outra', NOW - 2 * DAY)]) })
  assert.equal(snapshot.items.length, 2)
  assert.ok(snapshot.items.every(item => item.link.startsWith('https://')))
}))

test('revalidates each rerun against its actual time and rejects invalid assembly times', async () => temporary(async directory => {
  await writeJson(directory, 'knowledge-news.json', archive([article('limite', NOW - 7 * DAY)]))
  const first = await refreshKnowledgeNews({ directory, now: NOW, load: async () => null })
  assert.equal(first.items.length, 1)
  const second = await refreshKnowledgeNews({ directory, now: NOW + 1, load: async () => null })
  assert.equal(second.items.length, 0)
  await assert.rejects(refreshKnowledgeNews({ directory, now: NaN, load: async () => null }), /Instante/)
}))

test('coletas retêm o histórico antes do build; release sem coleta preserva e verifica o mesmo arquivo', async () => {
  const text = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const steps = text.split(/^ {6}- (?:name: |uses: |id: )/m)
  const find = cmd => steps.findIndex(step => step.includes(`        run: ${cmd}\n`))
  const refresh = find('node scripts/refresh-knowledge-news.mjs')
  const capture = find('node scripts/pages-release-data.mjs capturar "$RUNNER_TEMP/pages-release-data.json"')
  const verify = find('node scripts/pages-release-data.mjs conferir "$RUNNER_TEMP/pages-release-data.json" dist')
  const build = find('npm run build')
  const sector = find('node scripts/sector-news-live.mjs --snapshot')

  // Todo schedule (inclusive Trends e Focus) e as recuperações explícitas rodam este passo.
  assert.match(text, /^ {6}PAGES_REFRESH_DATA: \$\{\{ github\.event_name == 'schedule' \|\| inputs\.refresh_data == true \|\| inputs\.focus_retry == true \}\}$/m)
  assert.ok(capture > 0 && refresh > capture && sector > refresh && build > sector && verify > build)
  const condition = step => steps[step].split('\n').filter(line => line.trimStart().startsWith('if:'))
  assert.deepEqual(condition(refresh), ["        if: env.PAGES_REFRESH_DATA == 'true'"])
  assert.deepEqual(condition(capture), ["        if: env.PAGES_REFRESH_DATA != 'true'"])
  assert.deepEqual(condition(verify), condition(capture))
  assert.ok(RELEASE_FILES.includes('knowledge-news.json'), 'release sem coleta deve conservar o arquivo do mapa')
})
