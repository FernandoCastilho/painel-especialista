// Encerramento revisado de uma rodada interrompida. Não existe destravamento genérico:
// cada concessão fixa o token do journal, o digest integral do estado, a rodada e as fontes
// que ficaram com operação incerta. Essas fontes passam a suspensas (nunca liberadas); só a
// marca de rodada em voo é encerrada, para que as demais fontes elegíveis voltem a ser consultadas.
import { createHash } from 'node:crypto'

const RECOVERY_CODE = 'operation_outcome_uncertain'

// Concessões revisadas no código. Uma por incidente; nenhuma curinga.
export const APPROVED_RUN_RECOVERIES = Object.freeze([
  Object.freeze({
    reviewId: 'run-github-42846100438-1-recovery-20261110',
    reviewedAt: '2026-11-10T17:30:00.000Z',
    parentToken: '603bd042bfcc0c9febbe5e0e82523a8ad7bb3ade',
    beforeDigest: '7f8c14149248262c3508905594a42c664211399a59f4e0939c35cb943072a454',
    runId: 'github-42846100438-1',
    suspend: Object.freeze(['mapa']),
  }),
])

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const KEYS = 'beforeDigest|parentToken|reviewId|reviewedAt|runId|suspend'

export function validRunRecovery(review, grants = APPROVED_RUN_RECOVERIES) {
  return Boolean(review && Object.keys(review).sort().join('|') === KEYS &&
    /^[a-f0-9]{40}$/.test(review.parentToken) && /^[a-f0-9]{64}$/.test(review.beforeDigest) &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(review.reviewId) && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(review.runId) &&
    typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)) &&
    Array.isArray(review.suspend) && review.suspend.length > 0 && new Set(review.suspend).size === review.suspend.length &&
    grants.some(grant => same(grant, review)))
}

// Plano puro: devolve o próximo estado ou recusa. `now` é o instante da aplicação.
export function planRunRecovery(before, token, review, now, grants = APPROVED_RUN_RECOVERIES) {
  if (!validRunRecovery(review, grants)) throw Error('run_recovery_not_approved')
  if (token !== review.parentToken || hash(before) !== review.beforeDigest) throw Error('run_recovery_stale_state')
  if (!before.run || before.run.id !== review.runId || before.run.status !== 'in_flight') throw Error('run_recovery_wrong_run')
  if (before.feed?.status === 'in_flight' || before.feed?.status === 'prepared') throw Error('run_recovery_publication_pending')
  if (Object.values(before.sharedBlocks).some(Boolean)) throw Error('run_recovery_shared_block')
  const active = Object.entries(before.sources).filter(([, s]) => s.activeRun || s.request).map(([id]) => id).sort()
  if (!same(active, [...review.suspend].sort())) throw Error('run_recovery_sources_mismatch')
  for (const id of active) if (before.sources[id].activeRun !== review.runId || before.sources[id].block) throw Error('run_recovery_sources_mismatch')
  if (!Number.isSafeInteger(now) || now < Date.parse(before.updatedAt) || now < Date.parse(review.reviewedAt)) throw Error('run_recovery_time_regression')
  const at = new Date(now).toISOString()
  const after = structuredClone(before)
  after.revision++; after.updatedAt = at
  after.run = null
  for (const id of active) {
    const source = after.sources[id]
    source.status = 'suspended'; source.activeRun = null; source.request = null
    source.block = { code: RECOVERY_CODE, detectedAt: at }
    source.reason = `Rodada ${review.runId} interrompida com gravação incerta; encerrada pela revisão ${review.reviewId}. Fonte suspensa até revisão própria.`
  }
  return after
}
