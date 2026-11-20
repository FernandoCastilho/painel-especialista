import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { RELEASE_FILES, downloadPublished, snapshotRelease, verifyRelease, prepareCbs, verifyPublishedMarker } from '../scripts/pages-release-data.mjs'
import { HEADER } from '../scripts/csv-lib.mjs'

const text = file => file.endsWith('.json') ? '{"generatedAt":1,"payload":[]}' : '\ufeff' + HEADER.join(',') + '\nlinha,1\n'
const sha = 'a'.repeat(40), blob = 'b'.repeat(40)
const cbs = JSON.stringify({ schemaVersion: 1, datasets: ['comercio', 'industria', 'servicos'].map(kind => ({ kind, year: 2024, groups: Array(5).fill({}) })) })
const cbsHash = createHash('sha256').update(cbs).digest('hex')
const value = payload => new Response(payload, { status: 200 })

test('snapshot completo inclui extras; falha não salva parte; artefato alterado é bloqueado', async t => {
  assert.ok(RELEASE_FILES.includes('fx-noticias.json'))
  assert.ok(RELEASE_FILES.includes('knowledge-news.json'))
  for (const n of ['quotes.json', 'intraday.json', 'recuperacao-historico.json']) assert.ok(!RELEASE_FILES.includes(n))
  let saves = 0
  await assert.rejects(snapshotRelease(async file => file === 'knowledge-news.json' ? '<html>' : text(file), () => { saves++ }), /JSON inválido/)
  assert.equal(saves, 0)
  const dir = await mkdtemp(join(tmpdir(), 'release-fixture-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const snapshot = await snapshotRelease(async file => text(file), async (file, body) => {
    const path = join(dir, file)
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, body)
  })
  await verifyRelease(dir, snapshot)
  await writeFile(join(dir, 'knowledge-news.json'), text('knowledge-news.json') + '\n')
  await assert.rejects(verifyRelease(dir, snapshot), /knowledge-news.json: conteúdo mudou/)
})

test('retry somente em timeout ou HTTP transitório; preserva BOM', async () => {
  const options = { repo: 'fixture/painel', wait: async () => {} }
  let calls = 0
  const body = '\ufeffarquivo'
  const fetched = await downloadPublished('data.csv', { ...options, fetchImpl: async () => {
    if (++calls === 1) throw new DOMException('tempo', 'TimeoutError')
    if (calls === 2) return new Response(null, { status: 503 })
    return value(body)
  } })
  assert.equal(fetched, body)
  assert.equal(calls, 3)
  for (const status of [403, 404]) {
    calls = 0
    await assert.rejects(downloadPublished('data.csv', { ...options, fetchImpl: async () => {
      calls++; return new Response(null, { status })
    } }), new RegExp('HTTP ' + status))
    assert.equal(calls, 1)
  }
})

test('cron recusa release diverso; CBS preserva blob ou aceita novo versionado explícito', async () => {
  const marker = JSON.stringify({ sha, cbsBlob: blob, cbsHash })
  let writes = 0
  const load = async file => file === 'painel-release.json' ? marker : cbs
  const read = async () => cbs
  const write = async text => { assert.equal(text, cbs); writes++ }
  await assert.rejects(prepareCbs({ sha: 'c'.repeat(40), blob, scheduled: true, load, read, write }), /SHA diferente/)
  await prepareCbs({ sha, blob, scheduled: true, load, read, write })
  await prepareCbs({ sha, blob: 'd'.repeat(40), scheduled: false, load, read, write })
  assert.equal(writes, 1)
  const missing = async () => { throw Object.assign(new Error('404'), { status: 404 }) }
  await prepareCbs({ sha, blob, scheduled: false, load: missing, read, write })
  await assert.rejects(prepareCbs({ sha, blob, scheduled: true, load: missing, read, write }), /404/)
  await assert.rejects(prepareCbs({ sha, blob, scheduled: false, load: async file => file === 'painel-release.json' ? marker : cbs + '\n', read, write }), /não corresponde/)
})

test('guard sob fila e pré-deploy bloqueia SHA obsoleto, mantendo cron e recuperação manual explícita', async () => {
  const pages = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.match(pages, /group: pages\n\s+queue: max[^\n]*\n\s+cancel-in-progress: false/)
  assert.match(pages, /refresh_data:[\s\S]*?default: false/)
  const prefix = /name: Confirmar SHA atual[^\n]*\n[\s\S]*?script: \|\n((?: {12}[^\n]*\n)+)/g
  const guards = [...pages.matchAll(prefix)].map(m => m[1].replace(/^ {12}/gm, ''))
  assert.equal(guards.length, 2)
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  for (const script of guards) {
    const canonical = 'refs/heads/claude/obsidian-plugin-analysis-bagjz3'
    for (const [ref, remote, failed] of [[canonical, sha, false], [canonical, blob, true], ['refs/heads/main', sha, true], ['refs/heads/feature', sha, true], ['refs/tags/old', sha, true]]) {
      let failure
      let requests = 0
      const github = { rest: { git: { getRef: async opts => { requests++; assert.equal(opts.ref, canonical.slice(5)); return { data: { object: { sha: remote } } } } } } }
      await new AsyncFunction('context', 'core', 'github', script)({ ref, sha, repo: {} }, { setFailed: error => { failure = error } }, github)
      assert.equal(Boolean(failure), failed)
      assert.equal(requests, ref === canonical ? 1 : 0)
    }
  }
  for (const lines of ['fetch-trends.mjs', 'fetch-curves.mjs', 'fetch-news.mjs', 'refresh-knowledge-news.mjs']) {
    const step = pages.slice(0, pages.indexOf('node scripts/' + lines)).split('      - name: ').at(-1)
    assert.match(step, /env\.PAGES_REFRESH_DATA == 'true'/)
  }
  assert.match(pages, /if: github.event_name == 'workflow_dispatch' && inputs.refresh_data == true\n\s+run: python3 scripts\/fetch-ibge-cbs\.py/)
})

test('push somente no ramo canônico e PR inclusive docs-only; recuperação Focus explícita sem IBGE', async () => {
  const load = file => readFile(new URL('../../.github/workflows/' + file + '.yml', import.meta.url), 'utf8')
  const [pages, ci, focus] = await Promise.all(['pages', 'cotacoes-ci', 'focus'].map(load))
  const branch = 'claude/obsidian-plugin-analysis-bagjz3'
  assert.equal(pages.match(/^  push:\n((?: {4}.*\n)+)/m)[1], `    branches: [${branch}]\n`)
  assert.match(ci, /^  pull_request:\npermissions:/m) // sem paths: documentação e workflow-only também são testados
  for (const job of ['verify-source', 'approve-source', 'deploy']) {
    assert.ok(pages.split(`  ${job}:\n`)[1].split(/^  [\w-]+:/m)[0].includes(`github.ref == 'refs/heads/${branch}'`))
  }
  assert.ok(focus.includes(`github.ref == 'refs/heads/${branch}'`))
  assert.match(focus, /gh workflow run pages\.yml --ref "\$GITHUB_REF_NAME" -f focus_retry=true/)
  assert.match(pages, /PAGES_REFRESH_DATA:.*inputs\.focus_retry == true/)
  assert.match(pages, /Confirmar marcador servido[\s\S]*?conferir-publicado dist\n      - name: Conferir a interface/)
  assert.match(pages, /SMOKE_PUBLISHED_URL: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/)
})

test('verificação pública aguarda propagação e exige nova execução/tentativa mesmo no mesmo SHA', async () => {
  const expected = { sha, cbsBlob: blob, cbsHash, runId: '1221', runAttempt: '2' }
  const opts = { expected, sha, runId: expected.runId, runAttempt: expected.runAttempt, pageUrl: 'https://example.test/painel', wait: async () => {} }
  const urls = []
  const responses = [new Response(null, { status: 404 }), value(JSON.stringify({ ...expected, sha: blob })),
    value(JSON.stringify({ ...expected, runAttempt: '1' })), value(JSON.stringify(expected))]
  await verifyPublishedMarker({ ...opts, fetchImpl: async (url, request) => {
    assert.equal(url.pathname, '/painel/painel-release.json')
    assert.equal(request.cache, 'no-store')
    assert.equal(request.redirect, 'error')
    urls.push(url.searchParams.get('release-check'))
    return responses.shift()
  } })
  assert.equal(new Set(urls).size, 4)
  let calls = 0
  await assert.rejects(verifyPublishedMarker({ ...opts, fetchImpl: async () => {
    calls++; return value(JSON.stringify({ ...expected, runId: '1220' }))
  } }), /não corresponde/)
  assert.equal(calls, 8)
  for (const [status, bad, result] of [[403, '', /HTTP 403/], [200, 'null', /Marcador Pages inválido/], [200, '<html>', /JSON/]]) {
    calls = 0
    await assert.rejects(verifyPublishedMarker({ ...opts, fetchImpl: async () => { calls++; return new Response(bad, { status }) } }), result)
    assert.equal(calls, 1)
  }
  await assert.rejects(verifyPublishedMarker({ ...opts, sha: blob, fetchImpl: () => assert.fail('marcador local errado') }), /Marcador local/)
  await assert.rejects(verifyPublishedMarker({ ...opts, pageUrl: 'http://example.test/painel', fetchImpl: () => assert.fail('URL insegura') }), /Endereço público/)
})
