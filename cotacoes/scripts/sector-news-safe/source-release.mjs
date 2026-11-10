// Liberação revisada de fontes suspensas por resultado incerto do próprio executor.
// Cada concessão fixa, por fonte, o bloqueio exato (código e instante). Se a fonte foi
// suspensa de novo depois da revisão, o bloqueio é outro e a concessão não vale.
// Só libera `operation_outcome_uncertain`: negação do site, desafio, robots ou licença
// nunca entram por aqui. O registro da concessão fica no estado e não pode mudar depois.
const RELEASABLE = ['operation_outcome_uncertain']
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/

// 10/11/2026 (Fernando autorizou): ANTT parou em 09/11 num link com espaços que o transporte recusa antes de
// qualquer acesso (corrigido no extrator); MAPA ficou suspenso pelo encerramento da rodada github-42846100438-1.
export const APPROVED_SOURCE_RELEASES = Object.freeze([Object.freeze({
  reviewId: 'antt-mapa-uncertain-release-20261110',
  reviewedAt: '2026-11-10T19:15:00.000Z',
  sources: Object.freeze([
    Object.freeze({ id: 'antt', block: Object.freeze({ code: 'operation_outcome_uncertain', detectedAt: '2026-11-09T19:26:07.089Z' }) }),
    Object.freeze({ id: 'mapa', block: Object.freeze({ code: 'operation_outcome_uncertain', detectedAt: '2026-11-10T18:06:33.856Z' }) }),
  ]),
})])

export function validSourceRelease(review, grants = APPROVED_SOURCE_RELEASES) {
  return Boolean(review && Object.keys(review).sort().join('|') === 'reviewId|reviewedAt|sources' &&
    ID.test(review.reviewId) && typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)) &&
    Array.isArray(review.sources) && review.sources.length > 0 &&
    new Set(review.sources.map(s => s?.id)).size === review.sources.length &&
    review.sources.every(s => s && Object.keys(s).sort().join('|') === 'block|id' && ID.test(s.id) &&
      s.block && Object.keys(s.block).sort().join('|') === 'code|detectedAt' && RELEASABLE.includes(s.block.code) && Number.isFinite(Date.parse(s.block.detectedAt))) &&
    grants.some(grant => same(grant, review)))
}

export function planSourceRelease(before, review, now, grants = APPROVED_SOURCE_RELEASES) {
  if (!validSourceRelease(review, grants)) throw Error('source_release_not_approved')
  const previous = before.sourceReleases || []
  if (previous.some(r => r.reviewId === review.reviewId)) throw Error('source_release_already_applied')
  if (before.run || ['prepared', 'in_flight'].includes(before.feed?.status)) throw Error('source_release_inflight')
  if (Object.values(before.sharedBlocks).some(Boolean)) throw Error('source_release_shared_block')
  for (const { id, block } of review.sources) {
    const s = before.sources[id]
    if (!s || s.status !== 'suspended' || s.activeRun || s.request || !same(s.block, block)) throw Error(`source_release_block_changed:${id}`)
  }
  if (!Number.isSafeInteger(now) || now < Date.parse(before.updatedAt) || now < Date.parse(review.reviewedAt)) throw Error('source_release_time_regression')
  const after = structuredClone(before)
  after.revision++; after.updatedAt = new Date(now).toISOString()
  after.sourceReleases = [...structuredClone(previous), structuredClone(review)]
  for (const { id } of review.sources) {
    Object.assign(after.sources[id], { status: 'ready', block: null, reason: `Liberada pela revisão ${review.reviewId}; aguarda a primeira coleta confirmada.` })
  }
  return after
}

// Usado na validação de toda transição (inclusive ao reler o histórico).
// Devolve as fontes liberadas nesta transição, ou [] quando não há liberação.
export function exactSourceRelease(before, after, grants = APPROVED_SOURCE_RELEASES) {
  const old = before.sourceReleases || [], next = after.sourceReleases || []
  if (next.length === old.length) {
    if (!same(old, next)) throw Error('state_invalid: source_release_immutable')
    return []
  }
  if (next.length !== old.length + 1 || !same(next.slice(0, old.length), old)) throw Error('state_invalid: source_release_immutable')
  const review = next.at(-1)
  const expected = planSourceRelease(before, review, Date.parse(after.updatedAt), grants)
  if (!same(after, expected)) throw Error('state_invalid: source_release_unrelated_change')
  return review.sources.map(s => s.id)
}
