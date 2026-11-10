import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { b3CalendarStatus, b3CollectionDecision } from '../scripts/data-schedules.mjs'
import { normalizeSectorNews } from '../src/sectorNews.js'
const pages = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
const ci = await readFile(new URL('../../.github/workflows/cotacoes-ci.yml', import.meta.url), 'utf8')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

test('code releases require reusable actual CI; hourly schedules avoid the browser suite', () => {
  assert.match(ci, /on:\n {2}workflow_call:/)
  assert.match(pages, /verify-source:\n[\s\S]*?if: github.event_name != 'schedule'\n {4}uses: \.\/\.github\/workflows\/cotacoes-ci.yml/)
  assert.match(pages, /deploy:\n {4}needs: \[approve-source, institutional-news\]\n {4}if: \$\{\{ always\(\) && !cancelled\(\) \}\}/)
  const gate = pages.indexOf('name: Exigir verificações antes de publicar código')
  assert.ok(gate > 0 && gate < pages.indexOf('uses: actions/checkout@v4'))
  assert.match(pages, /if: github.event_name != 'schedule' && needs.verify-source.result != 'success'/)
  for (const gate of ['npm run lint', 'npm test', 'npm run build', 'node scripts/smoke-']) assert.ok(ci.includes(gate))
  assert.ok(pages.indexOf('id: deployment') < pages.indexOf('name: Conferir a interface no endereço publicado'))
})

test('actual failure notification distinguishes before, uncertain and after deployment', async () => {
  const section = pages.split('name: Avisar falha do deploy')[1].split('      - name:')[0]
  const script = section.split('          script: |\n')[1].split('\n').map(line => line.replace(/^ {12}/, '')).join('\n')
  for (const [outcome, expected] of [['skipped', /antes da publicação/], ['failure', /estado no ar precisa ser conferido/], ['success', /nova versão pode estar no ar/]]) {
    let issue
    const github = { rest: { issues: { listForRepo: async () => ({ data: [] }), create: async input => { issue = input } } } }
    const context = { serverUrl: 'https://github.com', repo: { owner: 'fixture', repo: 'fixture' }, runId: 123, eventName: 'push' }
    await new AsyncFunction('github', 'context', 'process', 'core', script)(github, context, { env: { DEPLOYMENT_OUTCOME: outcome } }, { warning() {} }) // sem segredo do Teams: só registra o aviso
    assert.match(issue.body, expected)
    assert.doesNotMatch(issue.body, /continua com os dados anteriores/)
  }
})

test('unsupported B3 year stays blocked and verified year identifies its official source', () => {
  assert.equal(b3CalendarStatus(2026).verified, true)
  assert.match(b3CalendarStatus(2026).source, /^https:\/\/www.b3.com.br\//)
  assert.deepEqual(b3CalendarStatus(2027), { verified: false, year: 2027, source: null, reason: 'calendário B3 do ano não verificado' })
  assert.equal(b3CollectionDecision('2027-01-04T15:00:00Z').run, false)
})

test('institutional snapshot cannot claim that automatic live collection is enabled', () => {
  const snapshot = normalizeSectorNews({ schemaVersion: 1, generatedAt: '2026-11-08T10:00:00Z', topics: {}, sourceStates: {}, collectionPolicy: { automaticScheduleEnabled: true } }, Date.parse('2026-11-08T11:00:00Z'))
  assert.equal(snapshot.collection.automaticCollectionEnabled, false)
  assert.equal(snapshot.collection.mode, 'offline-revalidation')
  assert.match(snapshot.collection.notice, /desativada/)
})

test('scheduled deployment executes exact-SHA approval guard before checkout and refuses unapproved code', async () => {
  const marker = 'name: Exigir código já aprovado nas agendas de dados'
  assert.ok(pages.indexOf(marker) < pages.indexOf('uses: actions/checkout@v4'))
  const section = pages.split(marker)[1].split('\n  institutional-news:')[0]
  assert.match(section, /if: github.event_name == 'schedule'/)
  const script = section.split('          script: |\n')[1].split('\n').map(line => line.replace(/^ {12}/, '')).join('\n')
  const approved = { id: 20, head_sha: 'approved-sha', conclusion: 'success', event: 'push' }
  const complete = ['test-build', 'smoke', 'bndes-workspace'].map(id => ({ name: `verify-source / ${id}`, conclusion: 'success' }))
  const scenarios = [
    { runs: [], jobs: [], allowed: false },
    { runs: [{ ...approved, conclusion: 'failure' }], jobs: complete, allowed: false },
    { runs: [{ ...approved, head_sha: 'older-sha' }], jobs: complete, allowed: false },
    { runs: [{ ...approved, event: 'schedule' }], jobs: complete, allowed: false },
    { runs: [approved], jobs: complete.slice(0, 2), allowed: false },
    { runs: [approved], jobs: complete.map(job => ({ ...job, conclusion: 'skipped' })), allowed: false },
    { runs: [approved], jobs: complete, allowed: true },
  ]
  for (const scenario of scenarios) {
    let failed = false, confirmed = false
    const listWorkflowRuns = Symbol('runs'), listJobsForWorkflowRun = Symbol('jobs')
    const github = { rest: { actions: { listWorkflowRuns, listJobsForWorkflowRun } }, paginate: async (method, params) => {
      if (method === listWorkflowRuns) {
        assert.equal(params.head_sha, 'approved-sha')
        assert.equal(params.workflow_id, 'pages.yml')
        return scenario.runs
      }
      assert.equal(method, listJobsForWorkflowRun)
      assert.equal(params.filter, 'latest')
      return scenario.jobs
    } }
    const core = { setFailed: () => { failed = true }, info: () => { confirmed = true } }
    await new AsyncFunction('github', 'context', 'core', script)(github, { repo: { owner: 'fixture', repo: 'fixture' }, sha: 'approved-sha', runId: 30 }, core)
    assert.equal(confirmed, scenario.allowed, JSON.stringify(scenario))
    assert.equal(failed, !scenario.allowed, JSON.stringify(scenario))
  }
  await assert.rejects(new AsyncFunction('github', 'context', 'core', script)({ rest: { actions: {} }, paginate: async () => { throw Error('API unavailable') } }, { repo: {}, sha: 'approved-sha' }, {}), /API unavailable/)
})


test('institutional live collection waits for exact source approval and cannot grant write to Pages', () => {
  const approve = pages.split('  approve-source:\n')[1].split('\n  institutional-news:')[0]
  const collect = pages.split('  institutional-news:\n')[1].split('\n  deploy:')[0]
  const deploy = pages.split('  deploy:\n')[1]
  const global = pages.split('permissions:\n')[1].split('\nconcurrency:')[0]
  assert.match(approve, /needs: verify-source/)
  assert.match(approve, /if: \$\{\{ always\(\) && !cancelled\(\) \}\}/)
  assert.match(collect, /needs: approve-source/)
  assert.match(collect, /needs.approve-source.result == 'success'/)
  for (const agenda of ["github.event.schedule != '0 11,18 * * *'", "github.event.schedule != '30 11 * * 1,2'"]) assert.ok(collect.includes(agenda))
  assert.match(collect, /uses: \.\/\.github\/workflows\/institutional-news.yml/)
  assert.match(collect, /contents: write/)
  assert.match(global, /contents: read/)
  assert.doesNotMatch(deploy, /contents: write/)
  assert.match(deploy, /if: needs.approve-source.result != 'success'/)
  assert.ok(deploy.indexOf('name: Bloquear publicação sem aprovação do código') < deploy.indexOf('uses: actions/checkout@v4'))
  assert.match(deploy, /run: node scripts\/sector-news-live.mjs --snapshot/)
  assert.doesNotMatch(deploy, /fetch-sector-news.mjs --offline/)
  assert.match(deploy, /GITHUB_TOKEN: \$\{\{ secrets.GITHUB_TOKEN \}\}/)
})
