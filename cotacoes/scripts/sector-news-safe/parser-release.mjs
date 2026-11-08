import { createHash } from 'node:crypto'

// Exact production grant reviewed against the stable journal during maintenance.
// A grant pins the old journal token, state digest and review timestamp. No wildcard.
export const APPROVED_PARSER_RELEASES = Object.freeze([{"beforeDigest":"ad93d21f94d95114b0267216a3785f7d9303dda7e2ea19b558f28603a55e8e80","parentToken":"d276718ab15085415a6e0a1d9b81c680200e2ffa","reviewId":"aneel-susep-parser-20261108-r485","reviewedAt":"2026-11-08T19:46:38.030Z","sources":["aneel","susep"]}])
const ids = ['aneel', 'susep']
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function validParserRelease(review, grants = APPROVED_PARSER_RELEASES) {
  return Boolean(review && Object.keys(review).sort().join('|') === 'beforeDigest|parentToken|reviewId|reviewedAt|sources' &&
    /^[a-f0-9]{40}$/.test(review.parentToken) && /^[a-f0-9]{64}$/.test(review.beforeDigest) &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(review.reviewId) &&
    typeof review.reviewedAt === 'string' && Number.isFinite(Date.parse(review.reviewedAt)) &&
    same(review.sources, ids) && grants.some(grant => same(grant, review)))
}
export function planParserRelease(before, token, review, grants = APPROVED_PARSER_RELEASES) {
  if (!validParserRelease(review, grants)) throw Error('parser_release_not_approved')
  if (token !== review.parentToken || hash(before) !== review.beforeDigest) throw Error('parser_release_stale_state')
  if (before.parserRelease || before.run || before.feed?.status === 'in_flight' || Object.values(before.sources).some(s => s.activeRun || s.request)) throw Error('parser_release_inflight_or_already_reviewed')
  if (Object.values(before.sharedBlocks).some(Boolean)) throw Error('parser_release_shared_block')
  if (Date.parse(review.reviewedAt) < Date.parse(before.updatedAt)) throw Error('parser_release_time_regression')
  for (const id of ids) if (before.sources[id]?.status !== 'suspended' || before.sources[id]?.block?.code !== 'parser_review_required') throw Error('parser_release_wrong_block')
  const after = structuredClone(before)
  after.revision++; after.updatedAt = review.reviewedAt
  after.parserRelease = structuredClone(review)
  for (const id of ids) {
    after.sources[id].status = 'ready'; after.sources[id].block = null
    after.sources[id].reason = 'Parser reviewed; awaiting first confirmed collection.'
  }
  return after
}
export function isExactParserRelease(before, after, grants = APPROVED_PARSER_RELEASES) {
  if (!after.parserRelease || before.parserRelease) return false
  const expected = planParserRelease(before, after.parserRelease.parentToken, after.parserRelease, grants)
  if (!same(after, expected)) throw Error('parser_release_unrelated_change')
  return true
}
