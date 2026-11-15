// Liberação revisada de fontes suspensas por resultado incerto do executor (ANTT e MAPA, 10/11/2026)
// e correção do extrator que travou a ANTT num link com espaços.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { APPROVED_SOURCE_RELEASES, planSourceRelease, validSourceRelease } from '../scripts/sector-news-safe/source-release.mjs'
import { runSourceRelease, SOURCE_RELEASE_WORKFLOW } from '../scripts/sector-news-source-release.mjs'
import { createSimulationState, validateState, validateTransition, digest, STATE_REF } from '../scripts/sector-news-safe/state.mjs'
import { extractGovArticleLinks } from '../scripts/sector-news-lib.mjs'
import { SECTOR_NEWS_SOURCES } from '../src/sectorNews.js'

const T0 = Date.parse('2026-11-08T13:25:21.515Z')
const ANTT = { code: 'operation_outcome_uncertain', detectedAt: '2026-11-09T19:26:07.089Z' }
const MAPA = { code: 'operation_outcome_uncertain', detectedAt: '2026-11-10T18:06:33.856Z' }
const NOW = Date.parse('2026-11-10T20:00:00Z')
function blocked() {
  const s = { ...createSimulationState({ approvedIds: ['mapa', 'antt', 'mdic'], now: T0, storeId: 'fixture' }), environment: 'production' }
  s.revision = 3204; s.updatedAt = '2026-11-10T19:03:14.456Z'
  Object.assign(s.sources.antt, { status: 'suspended', block: { ...ANTT }, reason: 'operation_outcome_uncertain', lastCollectedAt: '2026-11-09T18:54:02.635Z', lastSuccessAt: '2026-11-09T18:54:02.635Z' })
  Object.assign(s.sources.mapa, { status: 'suspended', block: { ...MAPA }, reason: 'encerrada' })
  return s
}
const grant = (extra = {}) => ({ reviewId: 'fixture-release', reviewedAt: '2026-11-10T19:15:00.000Z', sources: [{ id: 'antt', block: ANTT }, { id: 'mapa', block: MAPA }], ...extra })

test('concessão exata libera só ANTT e MAPA, guarda o registro e preserva todo o resto', () => {
  const before = blocked(), g = grant()
  const after = planSourceRelease(before, g, NOW, [g])
  for (const id of ['antt', 'mapa']) { assert.equal(after.sources[id].status, 'ready'); assert.equal(after.sources[id].block, null) }
  assert.equal(after.sources.antt.lastSuccessAt, before.sources.antt.lastSuccessAt)
  for (const id of Object.keys(before.sources)) if (!['antt', 'mapa'].includes(id)) assert.deepEqual(after.sources[id], before.sources[id], id)
  assert.deepEqual(after.sourceReleases, [g])
  validateTransition(before, after, { allowProduction: true, sourceReleaseGrants: [g] })
  validateState(after, { allowProduction: true, sourceReleaseGrants: [g] })
})

test('recusa concessão fora do código, bloqueio diferente, outro código, rodada em voo ou repetição', () => {
  const before = blocked(), g = grant()
  assert.throws(() => planSourceRelease(before, g, NOW), /not_approved/)
  const later = blocked(); later.sources.antt.block.detectedAt = '2026-11-10T19:10:00.000Z'
  assert.throws(() => planSourceRelease(later, g, NOW, [g]), /block_changed:antt/)
  const denial = grant({ sources: [{ id: 'antt', block: { code: 'http_403', detectedAt: ANTT.detectedAt } }] })
  assert.equal(validSourceRelease(denial, [denial]), false, 'negação do site nunca é liberável')
  const busy = blocked(); busy.run = { id: 'r-1', status: 'in_flight', startedAt: '2026-11-10T19:00:00.000Z', requests: 0, sourceIds: ['mdic'] }
  assert.throws(() => planSourceRelease(busy, g, NOW, [g]), /inflight/)
  assert.throws(() => planSourceRelease(before, g, Date.parse('2026-11-10T19:00:00Z'), [g]), /time_regression/)
  const after = planSourceRelease(before, g, NOW, [g])
  assert.throws(() => planSourceRelease(after, g, NOW + 1000, [g]), /already_applied/)
})

test('transição comum não pode liberar bloqueio, nem mexer no registro de liberações', () => {
  const before = blocked(), g = grant()
  const sneaky = structuredClone(before); sneaky.revision++; sneaky.updatedAt = '2026-11-10T20:00:00.000Z'
  Object.assign(sneaky.sources.antt, { status: 'ready', block: null })
  assert.throws(() => validateTransition(before, sneaky, { allowProduction: true, sourceReleaseGrants: [g] }), /block_cannot_be_cleared:antt/)
  const after = planSourceRelease(before, g, NOW, [g])
  const tamper = structuredClone(after); tamper.revision++; tamper.updatedAt = '2026-11-10T20:01:00.000Z'; tamper.sourceReleases = []
  assert.throws(() => validateTransition(after, tamper, { allowProduction: true, sourceReleaseGrants: [g] }), /source_release/)
  // Uma nova suspensão depois da liberação não pode ser desfeita reaplicando a mesma concessão.
  const again = structuredClone(after); again.revision++; again.updatedAt = '2026-11-10T21:00:00.000Z'
  Object.assign(again.sources.antt, { status: 'suspended', block: { code: 'operation_outcome_uncertain', detectedAt: '2026-11-10T21:00:00.000Z' } })
  validateTransition(after, again, { allowProduction: true, sourceReleaseGrants: [g] })
  assert.throws(() => planSourceRelease(again, g, NOW + 7200_000, [g]), /already_applied/)
})

test('plano só lê; aplicar grava uma vez pela operação dedicada e confere a releitura', async () => {
  const before = blocked(), g = grant()
  let state = before, token = 'a'.repeat(40), writes = 0
  const service = {
    store: { read: async () => ({ state: structuredClone(state), token, confirmed: true, ref: STATE_REF }) },
    applySourceRelease: async (t, review, now) => { writes++; assert.equal(t, token); state = planSourceRelease(state, review, now, [g]); token = 'b'.repeat(40); return { state, token, confirmed: true, ref: STATE_REF } },
  }
  const clock = () => NOW
  assert.equal((await runSourceRelease({ mode: 'plan', service, grants: [g], clock })).applied, false)
  assert.equal(writes, 0)
  const done = await runSourceRelease({ mode: 'apply', service, grants: [g], clock })
  assert.equal(done.applied, true); assert.equal(writes, 1)
  assert.deepEqual(done.sources, ['antt', 'mapa'])
  await assert.rejects(runSourceRelease({ mode: 'apply', service, grants: [g], clock }), /already_applied/)
  assert.equal(writes, 1)
})

test('concessão de produção: só ANTT e MAPA, com os bloqueios exatos lidos no journal', () => {
  assert.equal(APPROVED_SOURCE_RELEASES.length, 1)
  const g = APPROVED_SOURCE_RELEASES[0]
  assert.equal(validSourceRelease(g), true)
  assert.deepEqual(g.sources.map(s => s.id), ['antt', 'mapa'])
  assert.deepEqual({ ...g.sources[0].block }, ANTT)
  assert.deepEqual({ ...g.sources[1].block }, MAPA)
})

test('extrator ignora link com espaço codificado, que o transporte recusaria antes de acessar', () => {
  const source = SECTOR_NEWS_SOURCES.find(s => s.id === 'antt')
  const html = `<a href="/antt/pt-br/assuntos/ultimas-noticias-antt/nova-serra-das-araras-uma-das-maiores-obras-rodovirias -do -pais-tem -conclusao-prevista-para-2027">Nova Serra das Araras: obra rodoviária de infraestrutura tem conclusão prevista</a>
    <a href="/antt/pt-br/assuntos/ultimas-noticias-antt/antt-aprova-regras-para-transporte-rodoviario-de-cargas">ANTT aprova regras para transporte rodoviário de cargas</a>`
  const links = extractGovArticleLinks(html, source).map(l => l.link)
  assert.ok(links.every(l => !/%/.test(l)), links.join('\n'))
  assert.ok(links.some(l => l.endsWith('antt-aprova-regras-para-transporte-rodoviario-de-cargas')), 'link bom continua')
})

test('workflow de liberação é manual, padrão só leitura e divide a fila com a coleta', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/institutional-news-source-release.yml', import.meta.url), 'utf8')
  assert.match(workflow, new RegExp(`^name: ${SOURCE_RELEASE_WORKFLOW}$`, 'm'))
  assert.match(workflow, /group: institutional-news-collector/)
  assert.match(workflow, /default: false/)
  assert.doesNotMatch(workflow, /schedule:|push:|workflow_call:/)
  const plan = workflow.split('\n  plan:\n')[1].split('\n  apply:\n')[0]
  assert.match(plan, /--plan/); assert.doesNotMatch(plan, /contents: write/)
  assert.match(workflow.split('\n  apply:\n')[1], /--apply/)
})

test('journal Git real: liberação dedicada passa, troca comum é barrada e o histórico relido aceita', async t => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createLocalGitStoreForTests } = await import('../scripts/sector-news-safe/git-store.mjs')
  const { FEED_REF } = await import('../scripts/sector-news-safe/state.mjs')
  const exec = promisify(execFile)
  const dir = await mkdtemp(join(tmpdir(), 'source-release-')), remote = join(dir, 'remote.git'), work = join(dir, 'seed')
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(work)
  const git = async (args, cwd = work) => (await exec('git', args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim()
  await git(['init', '--bare', '--quiet', remote]); await git(['init', '--quiet'])
  await git(['config', 'user.name', 'Fixture']); await git(['config', 'user.email', 'fixture@example.invalid'])
  const root = { ...createSimulationState({ approvedIds: ['mapa', 'antt', 'mdic'], now: T0, storeId: 'git-test' }), environment: 'production' }
  async function seed(kind, payload, ref) {
    await git(['checkout', '--quiet', '--orphan', kind])
    await writeFile(join(work, 'record.json'), JSON.stringify({ kind, parent: null, digest: digest(payload), payload }))
    await git(['add', 'record.json'])
    if (kind === 'feed') { await writeFile(join(work, 'sector-news.json'), JSON.stringify(payload)); await git(['add', 'sector-news.json']) }
    await git(['commit', '--quiet', '-m', 'fixture'])
    const sha = await git(['rev-parse', 'HEAD']); await git(['push', '--quiet', remote, `${sha}:${ref}`]); return sha
  }
  const rootToken = await seed('state', root, STATE_REF), feedRootToken = await seed('feed', { schemaVersion: 1, topics: {}, sourceStates: {} }, FEED_REF)
  const connect = () => createLocalGitStoreForTests({ remote, rootToken, feedRootToken, storeId: 'git-test', verifyProtection: async () => {} })
  const c = connect(); t.after(() => c.close())
  // Suspensões com os bloqueios exatos da concessão de produção.
  let head = await c.store.read()
  const susp = structuredClone(head.state); susp.revision = 1; susp.updatedAt = '2026-11-10T19:03:14.456Z'
  Object.assign(susp.sources.antt, { status: 'suspended', block: { ...ANTT }, reason: 'operation_outcome_uncertain' })
  Object.assign(susp.sources.mapa, { status: 'suspended', block: { ...MAPA }, reason: 'encerrada' })
  head = await c.store.compareAndSwap(head.token, susp)
  const g = APPROVED_SOURCE_RELEASES[0]
  const plain = planSourceRelease(head.state, g, NOW)
  await assert.rejects(c.store.compareAndSwap(head.token, plain), /dedicated_operation/)
  const done = await c.applySourceRelease(head.token, g, NOW)
  assert.equal(done.state.sources.antt.status, 'ready')
  const fresh = connect(); t.after(() => fresh.close())
  const reread = await fresh.store.read()
  assert.equal(reread.token, done.token)
  assert.deepEqual(reread.state.sourceReleases.map(r => r.reviewId), [g.reviewId])
  assert.equal(reread.state.sources.mapa.status, 'ready')
})
