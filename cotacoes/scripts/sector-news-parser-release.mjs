import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createGitHubStore } from './sector-news-safe/git-store.mjs'
import { APPROVED_PARSER_RELEASES, planParserRelease, validParserRelease } from './sector-news-safe/parser-release.mjs'
import { validateState, digest, STATE_REF } from './sector-news-safe/state.mjs'

// A dry run may inspect the candidate; only a code-reviewed production grant can write.
export async function runParserMaintenance({ mode, service, candidate, clock = Date.now }) {
  if (!['plan', 'apply'].includes(mode)) throw Error('explicit_maintenance_mode_required')
  if (Date.parse(candidate?.reviewedAt) > clock()) throw Error('parser_review_is_in_future')
  if (mode === 'apply' && !validParserRelease(candidate)) throw Error('parser_release_not_approved')
  const before = await service.store.read()
  if (!before?.confirmed || before.ref !== STATE_REF || !/^[a-f0-9]{40}$/.test(before.token || '')) throw Error('parser_state_read_not_confirmed')
  validateState(before.state, { allowProduction: true })
  const next = planParserRelease(before.state, before.token, candidate, mode === 'plan' ? [candidate] : APPROVED_PARSER_RELEASES)
  const plan = { mode, stateToken: before.token, previousDigest: digest(before.state), proposedDigest: digest(next),
    previousRevision: before.state.revision, proposedRevision: next.revision, review: candidate, applied: false }
  if (mode === 'plan') return plan
  const result = await service.applyParserRelease(before.token, candidate)
  const observed = await service.store.read()
  if (!result?.confirmed || !observed?.confirmed || observed.token !== result.token || observed.token === before.token || digest(observed.state) !== digest(next)) throw Error('parser_release_final_read_not_confirmed')
  return { ...plan, applied: true, stateToken: observed.token }
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--plan', '--apply'].includes(args[0])) throw Error('Use --plan or --apply; no arbitrary grant or repository.')
  if (args[0] === '--apply' && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_WORKFLOW !== 'Revisar liberação ANEEL e Susep')) throw Error('shared_concurrency_workflow_required')
  const config = JSON.parse(await readFile(new URL('./sector-news-safe/production-config.json', import.meta.url), 'utf8'))
  const candidate = JSON.parse(await readFile(new URL('./sector-news-safe/parser-release-candidate.json', import.meta.url), 'utf8'))
  const service = createGitHubStore(config)
  try {
    const report = await runParserMaintenance({ mode: args[0].slice(2), service, candidate })
    if (process.env.INSTITUTIONAL_RELEASE_REPORT) await writeFile(process.env.INSTITUTIONAL_RELEASE_REPORT, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report, null, 2))
    return report
  } finally { await service.close() }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1 })
