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
  assert.match(pages, /deploy:\n {4}needs: verify-source\n {4}if: \$\{\{ always\(\) && !cancelled\(\) \}\}/)
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
    await new AsyncFunction('github', 'context', 'process', script)(github, context, { env: { DEPLOYMENT_OUTCOME: outcome } })
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
