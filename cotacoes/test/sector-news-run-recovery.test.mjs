// Encerramento revisado de rodada interrompida: só a concessão exata grava, a fonte incerta fica suspensa
// e a coleta seguinte volta a rodar para as demais fontes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { APPROVED_RUN_RECOVERIES, planRunRecovery, validRunRecovery } from '../scripts/sector-news-safe/run-recovery.mjs'
import { runRecovery, RECOVERY_WORKFLOW } from '../scripts/sector-news-run-recovery.mjs'
import { createSimulationState, validateTransition, digest, STATE_REF } from '../scripts/sector-news-safe/state.mjs'

const T0 = Date.parse('2026-11-10T16:00:00Z')
const token = 'a'.repeat(40)
function stuckState() {
  const s = { ...createSimulationState({ approvedIds: ['mapa', 'mdic', 'anp'], now: T0, storeId: 'fixture' }), environment: 'production' }
  s.revision = 10; s.updatedAt = '2026-11-10T16:01:20.184Z'
  s.run = { id: 'github-1-1', status: 'in_flight', startedAt: '2026-11-10T16:00:47.985Z', requests: 4, sourceIds: ['mapa', 'mdic', 'anp'] }
  Object.assign(s.sources.mapa, { status: 'collecting', activeRun: 'github-1-1', checkedAt: '2026-11-10T16:00:51.992Z',
    request: { id: 'github-1-1.4', kind: 'article', url: 'https://www.gov.br/agricultura/pt-br/assuntos/noticias/x', startedAt: '2026-11-10T16:01:20.184Z' } })
  return s
}
const grantFor = (state, extra = {}) => ({ beforeDigest: digest(state), parentToken: token, reviewId: 'fixture-recovery', reviewedAt: '2026-11-10T17:00:00.000Z', runId: 'github-1-1', suspend: ['mapa'], ...extra })
const NOW = Date.parse('2026-11-10T17:10:00Z')

test('concessão exata encerra a rodada e suspende só a fonte incerta, sem liberar nenhum bloqueio', () => {
  const before = stuckState(), grant = grantFor(before)
  const after = planRunRecovery(before, token, grant, NOW, [grant])
  assert.equal(after.run, null)
  assert.equal(after.revision, before.revision + 1)
  assert.equal(after.sources.mapa.status, 'suspended')
  assert.equal(after.sources.mapa.block.code, 'operation_outcome_uncertain')
  assert.equal(after.sources.mapa.activeRun, null)
  assert.equal(after.sources.mapa.request, null)
  assert.equal(after.sources.mapa.lastSuccessAt, before.sources.mapa.lastSuccessAt, 'datas preservadas')
  for (const id of Object.keys(before.sources)) if (id !== 'mapa') assert.deepEqual(after.sources[id], before.sources[id], id)
  assert.deepEqual(after.feed, before.feed)
  validateTransition(before, after, { allowProduction: true })
})

test('concessão fora do código, estado mudado, outra rodada, fontes diferentes ou relógio para trás: recusa', () => {
  const before = stuckState(), grant = grantFor(before)
  assert.throws(() => planRunRecovery(before, token, grant, NOW), /not_approved/)
  assert.throws(() => planRunRecovery(before, 'b'.repeat(40), grant, NOW, [grant]), /stale/)
  const changed = structuredClone(before); changed.run.requests = 5
  assert.throws(() => planRunRecovery(changed, token, grant, NOW, [grant]), /stale/)
  const other = grantFor(before, { runId: 'github-2-1' })
  assert.throws(() => planRunRecovery(before, token, other, NOW, [other]), /wrong_run/)
  const wider = grantFor(before, { suspend: ['mapa', 'mdic'] })
  assert.throws(() => planRunRecovery(before, token, wider, NOW, [wider]), /sources_mismatch/)
  assert.throws(() => planRunRecovery(before, token, grant, Date.parse('2026-11-10T16:30:00Z'), [grant]), /time_regression/)
  const shared = structuredClone(before); shared.sharedBlocks['https://www.gov.br'] = { code: 'http_403', detectedAt: '2026-11-10T16:01:00.000Z' }
  const g2 = grantFor(shared)
  assert.throws(() => planRunRecovery(shared, token, g2, NOW, [g2]), /shared_block/)
  assert.equal(validRunRecovery({ ...grant, extra: 1 }, [grant]), false)
})

test('a fonte suspensa pela recuperação não pode ser liberada depois por uma transição comum', () => {
  const before = stuckState(), grant = grantFor(before)
  const after = planRunRecovery(before, token, grant, NOW, [grant])
  const reopen = structuredClone(after); reopen.revision++; reopen.updatedAt = '2026-11-10T18:00:00.000Z'
  Object.assign(reopen.sources.mapa, { status: 'ready', block: null })
  assert.throws(() => validateTransition(after, reopen, { allowProduction: true }), /block_cannot_be_cleared:mapa/)
})

test('plano só lê; aplicar grava uma vez e confere a releitura, sem nova tentativa', async () => {
  const before = stuckState(), grant = grantFor(before)
  let state = before, current = token, writes = 0
  const store = {
    read: async () => ({ state: structuredClone(state), token: current, confirmed: true, ref: STATE_REF }),
    compareAndSwap: async (t, next) => { writes++; assert.equal(t, current); state = next; current = 'c'.repeat(40); return { state: structuredClone(next), token: current, confirmed: true, ref: STATE_REF } },
  }
  const clock = () => NOW
  const plan = await runRecovery({ mode: 'plan', store, grants: [grant], clock })
  assert.equal(plan.applied, false); assert.equal(writes, 0)
  const done = await runRecovery({ mode: 'apply', store, grants: [grant], clock })
  assert.equal(done.applied, true); assert.equal(writes, 1)
  assert.equal(state.run, null)
  await assert.rejects(runRecovery({ mode: 'apply', store, grants: [grant], clock }), /stale|wrong_run/)
  assert.equal(writes, 1, 'segunda aplicação não grava')
  await assert.rejects(runRecovery({ mode: 'automatic', store, grants: [grant], clock }), /mode/)
})

test('falha na gravação não é repetida', async () => {
  const before = stuckState(), grant = grantFor(before)
  let writes = 0
  const store = { read: async () => ({ state: structuredClone(before), token, confirmed: true, ref: STATE_REF }), compareAndSwap: async () => { writes++; throw Error('git_write_outcome_uncertain') } }
  await assert.rejects(runRecovery({ mode: 'apply', store, grants: [grant], clock: () => NOW }), /uncertain/)
  assert.equal(writes, 1)
})

test('concessão de produção: uma só, presa à rodada github-42846100438-1 e ao MAPA', () => {
  assert.equal(APPROVED_RUN_RECOVERIES.length, 1)
  const g = APPROVED_RUN_RECOVERIES[0]
  assert.equal(validRunRecovery(g), true)
  assert.equal(g.runId, 'github-42846100438-1')
  assert.deepEqual([...g.suspend], ['mapa'])
  assert.ok(Object.isFrozen(g) && Object.isFrozen(g.suspend))
})

test('workflow de encerramento é manual, padrão só leitura e divide a fila com a coleta', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/institutional-news-recovery.yml', import.meta.url), 'utf8')
  assert.match(workflow, new RegExp(`^name: ${RECOVERY_WORKFLOW}$`, 'm'))
  assert.match(workflow, /group: institutional-news-collector/)
  assert.match(workflow, /cancel-in-progress: false/)
  assert.match(workflow, /default: false/)
  assert.doesNotMatch(workflow, /schedule:|push:|workflow_call:/)
  const plan = workflow.split('\n  plan:\n')[1].split('\n  apply:\n')[0]
  assert.match(plan, /--plan/); assert.doesNotMatch(plan, /contents: write/)
  assert.match(workflow.split('\n  apply:\n')[1], /--apply/)
})

test('journal Git real: encerra a rodada, histórico continua válido e a coleta seguinte não fica travada', async t => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createLocalGitStoreForTests } = await import('../scripts/sector-news-safe/git-store.mjs')
  const { FEED_REF } = await import('../scripts/sector-news-safe/state.mjs')
  const exec = promisify(execFile)
  const dir = await mkdtemp(join(tmpdir(), 'run-recovery-')), remote = join(dir, 'remote.git'), work = join(dir, 'seed')
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(work)
  const git = async (args, cwd = work) => (await exec('git', args, { cwd, env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } })).stdout.trim()
  await git(['init', '--bare', '--quiet', remote]); await git(['init', '--quiet'])
  await git(['config', 'user.name', 'Fixture']); await git(['config', 'user.email', 'fixture@example.invalid'])
  const root = { ...createSimulationState({ approvedIds: ['mapa', 'mdic', 'anp'], now: T0, storeId: 'git-test' }), environment: 'production' }
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
  // Rodada interrompida: run em voo e pedido do MAPA pendente.
  let head = await c.store.read()
  const stuck = structuredClone(head.state); stuck.revision = 1; stuck.updatedAt = '2026-11-10T16:01:20.184Z'
  stuck.run = { id: 'github-1-1', status: 'in_flight', startedAt: '2026-11-10T16:00:47.985Z', requests: 1, sourceIds: ['mapa'] }
  Object.assign(stuck.sources.mapa, { status: 'collecting', activeRun: 'github-1-1', checkedAt: '2026-11-10T16:00:51.992Z',
    request: { id: 'github-1-1.1', kind: 'article', url: 'https://www.gov.br/agricultura/pt-br/assuntos/noticias/x', startedAt: '2026-11-10T16:01:20.184Z' } })
  head = await c.store.compareAndSwap(head.token, stuck)
  const grant = { beforeDigest: digest(head.state), parentToken: head.token, reviewId: 'fixture-recovery', reviewedAt: '2026-11-10T17:00:00.000Z', runId: 'github-1-1', suspend: ['mapa'] }
  const done = await runRecovery({ mode: 'apply', store: c.store, grants: [grant], clock: () => NOW })
  assert.equal(done.applied, true)
  // Uma conexão nova relê todo o histórico até a raiz e aceita o encerramento.
  const fresh = connect(); t.after(() => fresh.close())
  const reread = await fresh.store.read()
  assert.equal(reread.token, done.stateToken)
  assert.equal(reread.state.run, null)
  assert.equal(reread.state.sources.mapa.status, 'suspended')
  assert.equal(reread.state.sources.mdic.status, 'ready')
})
