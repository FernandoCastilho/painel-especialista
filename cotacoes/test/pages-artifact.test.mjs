import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { waitForPagesArtifact } from '../scripts/wait-pages-artifact.cjs'

const expected = { id: '123', name: 'github-pages-10-2', expired: false }
const older = { id: 122, name: 'github-pages-10-1', expired: false }

test('confirma o ID da tentativa atual em duas leituras espaçadas', async () => {
  const responses = [[older], [expected], [expected]]
  const sleeps = []
  await waitForPagesArtifact({
    name: expected.name, id: expected.id,
    list: async () => responses.shift(), sleep: async ms => sleeps.push(ms), delays: [2000, 5000],
  })
  assert.deepEqual(sleeps, [2000, 5000])
  assert.deepEqual(responses, [])
})

test('recusa pacote incorreto, duplicado ou expirado', async () => {
  for (const rows of [[older], [{ ...expected, id: '0' }], [{ ...expected, expired: true }], [expected, expected]]) {
    await assert.rejects(waitForPagesArtifact({ name: expected.name, id: expected.id, list: async () => rows, sleep: async () => {}, delays: [5000] }), /não confirmado/)
  }
  await assert.rejects(waitForPagesArtifact({ name: expected.name, id: '', list: async () => [expected] }), /ID inválido/)
})

test('tolera falha transitória, mas não confunde erro de permissão com atraso', async () => {
  let attempts = 0
  await waitForPagesArtifact({
    name: expected.name, id: expected.id, sleep: async () => {}, delays: [2000, 5000],
    list: async () => {
      if (++attempts === 1) throw Object.assign(new Error('transitório'), { status: 503 })
      return [expected]
    },
  })
  assert.equal(attempts, 3)
  await assert.rejects(waitForPagesArtifact({
    name: expected.name, id: expected.id,
    list: async () => { throw Object.assign(new Error('sem acesso'), { status: 403 }) },
  }), /sem acesso/)
})

test('Pages confirma o pacote da tentativa antes de reconferir SHA e publicar', () => {
  const pages = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const upload = pages.indexOf('id: pages-package')
  const guard = pages.indexOf('name: Confirmar disponibilidade do pacote desta tentativa')
  const head = pages.indexOf('name: Confirmar SHA atual imediatamente antes de publicar')
  const deploy = pages.indexOf('uses: actions/deploy-pages@v4')
  assert.ok(upload >= 0 && upload < guard && guard < head && head < deploy)
  assert.match(pages, /PAGES_ARTIFACT_ID: \$\{\{ steps\.pages-package\.outputs\.artifact_id \}\}/)
  assert.match(pages, /listWorkflowRunArtifacts\(\{ \.\.\.context\.repo, run_id: context\.runId, name \}\)/)
})
