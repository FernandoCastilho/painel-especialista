import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
const marker = '      - name: Exigir código já aprovado nas agendas de dados'
const step = workflow.split(marker)[1]?.split('\n  institutional-news:')[0]
assert.ok(step, 'etapa de aprovação da agenda existe')
const script = step.split('          script: |\n')[1].split('\n').map(l => l.replace(/^ {12}/, '')).join('\n')
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
const runGate = new AsyncFunction('github', 'context', 'core', script)
const sha = 'eef3916dfc15af173eef47b59967d481e526dddc'
const branch = 'claude/obsidian-plugin-analysis-bagjz3'
const good = { id: 45612639276, head_sha: sha, head_branch: branch, status: 'completed', conclusion: 'success', event: 'push' }
const schedule = { ...good, id: 45619943869, event: 'schedule' }
const jobsOk = ['test-build', 'smoke', 'bndes-workspace'].map(id => ({ name: 'verify-source / ' + id, conclusion: 'success' }))

async function evaluate(runs, jobs = jobsOk) {
  const calls = [], info = [], fails = []
  const listWorkflowRuns = () => {}, listJobsForWorkflowRun = () => {}
  const github = {
    rest: { actions: { listWorkflowRuns, listJobsForWorkflowRun } },
    paginate: async (api, args) => {
      if (api === listWorkflowRuns) {
        assert.equal(args.workflow_id, 'pages.yml')
        assert.equal(args.branch, branch)
        assert.equal(args.head_sha, sha)
        assert.equal(args.per_page, 100)
        // Reproduz o falso negativo observado: a busca com status omitiu o push aprovado.
        return args.status === undefined ? runs : [schedule]
      }
      assert.equal(api, listJobsForWorkflowRun)
      assert.equal(args.filter, 'latest')
      assert.equal(args.per_page, 100)
      calls.push(args.run_id)
      return jobs
    },
  }
  await runGate(github, { repo: { owner: 'owner', repo: 'repo' }, runId: schedule.id, ref: 'refs/heads/' + branch, sha }, {
    info: x => info.push(x), setFailed: x => fails.push(x),
  })
  return { calls, info, fails }
}

test('agenda acha aprovação do push mesmo se busca filtrada por status o omitir', async () => {
  const out = await evaluate([schedule, good])
  assert.deepEqual(out.fails, [])
  assert.deepEqual(out.calls, [good.id])
  assert.match(out.info[0], /45612639276/)
})

test('agenda não aceita SHA, ramo, status, conclusão ou tipo de execução divergente', async () => {
  for (const invalido of [
    { head_sha: 'outro' }, { head_branch: 'outro' }, { status: 'in_progress' },
    { conclusion: 'failure' }, { id: schedule.id }, { event: 'schedule' }, { event: 'pull_request' },
  ]) {
    const out = await evaluate([{ ...good, ...invalido }])
    assert.deepEqual(out.calls, [], JSON.stringify(invalido))
    assert.match(out.fails[0], /Agenda bloqueada/)
  }
})

test('workflow_dispatch válido exige cada job da última tentativa com sucesso', async () => {
  const manual = { ...good, event: 'workflow_dispatch' }
  assert.deepEqual((await evaluate([manual])).fails, [])
  for (const job of jobsOk) {
    const out = await evaluate([manual], jobsOk.map(x => x.name === job.name ? { ...x, conclusion: 'skipped' } : x))
    assert.deepEqual(out.calls, [manual.id])
    assert.match(out.fails[0], /Agenda bloqueada/)
  }
})
