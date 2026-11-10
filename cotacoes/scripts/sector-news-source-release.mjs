import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createGitHubStore } from './sector-news-safe/git-store.mjs'
import { APPROVED_SOURCE_RELEASES, planSourceRelease } from './sector-news-safe/source-release.mjs'
import { validateState, digest, STATE_REF } from './sector-news-safe/state.mjs'

export const SOURCE_RELEASE_WORKFLOW = 'Liberar fontes de notícias revisadas'

// Plano só lê. Aplicar exige a concessão do código e grava uma única vez, sem nova tentativa.
export async function runSourceRelease({ mode, service, grants = APPROVED_SOURCE_RELEASES, clock = Date.now }) {
  if (!['plan', 'apply'].includes(mode)) throw Error('explicit_release_mode_required')
  if (grants.length < 1) throw Error('source_release_grant_required')
  const review = grants.at(-1)
  if (Date.parse(review.reviewedAt) > clock()) throw Error('source_release_review_in_future')
  const before = await service.store.read()
  if (!before?.confirmed || before.ref !== STATE_REF || !/^[a-f0-9]{40}$/.test(before.token || '')) throw Error('source_release_read_not_confirmed')
  validateState(before.state, { allowProduction: true, sourceReleaseGrants: grants })
  const now = clock()
  const next = planSourceRelease(before.state, review, now, grants)
  const plan = { mode, reviewId: review.reviewId, sources: review.sources.map(s => s.id), stateToken: before.token,
    previousDigest: digest(before.state), proposedDigest: digest(next), previousRevision: before.state.revision, proposedRevision: next.revision, applied: false }
  if (mode === 'plan') return plan
  const result = await service.applySourceRelease(before.token, review, now)
  const observed = await service.store.read()
  if (!result?.confirmed || !observed?.confirmed || observed.token !== result.token || observed.token === before.token || digest(observed.state) !== digest(next)) throw Error('source_release_final_read_not_confirmed')
  return { ...plan, applied: true, stateToken: observed.token }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--plan', '--apply'].includes(args[0])) throw Error('Use --plan or --apply; no arbitrary grant or repository.')
  if (args[0] === '--apply' && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_WORKFLOW !== SOURCE_RELEASE_WORKFLOW)) throw Error('shared_concurrency_workflow_required')
  const config = JSON.parse(await readFile(new URL('./sector-news-safe/production-config.json', import.meta.url), 'utf8'))
  const service = createGitHubStore(config)
  try {
    const report = await runSourceRelease({ mode: args[0].slice(2), service })
    if (process.env.INSTITUTIONAL_RELEASE_REPORT) await writeFile(process.env.INSTITUTIONAL_RELEASE_REPORT, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
    return report
  } finally { await service.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
