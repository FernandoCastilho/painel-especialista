// Leitura do arquivo já publicado: tentativas, e a diferença entre "não existe" e "não consegui ler".
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PREV_TENTATIVAS, loadPrevious, loadPreviousOrFail, readPrevious } from '../scripts/prev-lib.mjs'

// fetch simulado: cada chamada consome a próxima resposta da fila (a última se repete)
function fila(...respostas) {
  const chamadas = []
  const fetchImpl = async (url) => {
    chamadas.push(url)
    const r = respostas[Math.min(chamadas.length - 1, respostas.length - 1)]
    if (r instanceof Error) throw r
    return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => r.body ?? '' }
  }
  return { fetchImpl, chamadas }
}
const esperas = () => { const feitas = []; return { feitas, wait: async (i) => { feitas.push(i) } } }
const sem = (f) => ({ fetchImpl: f.fetchImpl, wait: async () => {} })

test('leitura do publicado: sucesso de primeira não repete nem espera', async () => {
  const f = fila({ status: 200, body: '{"generatedAt":1}' }), e = esperas()
  assert.deepEqual(await readPrevious('macro.json', 'Dono/painel', { fetchImpl: f.fetchImpl, wait: e.wait }), { status: 'ok', data: { generatedAt: 1 } })
  assert.deepEqual(f.chamadas, ['https://dono.github.io/painel/macro.json'])
  assert.deepEqual(e.feitas, [])
})

test('leitura do publicado: oscilação de rede é vencida na 2ª ou 3ª tentativa, com espera crescente', async () => {
  const f = fila(new Error('rede'), { status: 502 }, { status: 200, body: '{"focus":{"date":"x"}}' }), e = esperas()
  const r = await readPrevious('macro.json', 'a/b', { fetchImpl: f.fetchImpl, wait: e.wait })
  assert.equal(r.status, 'ok')
  assert.deepEqual(r.data.focus, { date: 'x' })
  assert.equal(f.chamadas.length, 3)
  assert.deepEqual(e.feitas, [1, 2]) // espera 1 (2 s) e espera 2 (4 s)
  assert.equal(PREV_TENTATIVAS, 3)
})

test('leitura do publicado: 404 é "não existe" (primeira publicação) e não gasta tentativas', async () => {
  const f = fila({ status: 404 }), e = esperas()
  assert.deepEqual(await readPrevious('curves.json', 'a/b', { fetchImpl: f.fetchImpl, wait: e.wait }), { status: 'missing', data: null })
  assert.equal(f.chamadas.length, 1)
  assert.deepEqual(await readPrevious('curves.json', '', { fetchImpl: f.fetchImpl, wait: e.wait }), { status: 'missing', data: null }) // execução local, sem repositório
  assert.equal(f.chamadas.length, 1)
  assert.deepEqual(e.feitas, [])
})

test('leitura do publicado: rede, tempo esgotado, erro do servidor, resposta vazia e JSON inválido são "não consegui ler"', async () => {
  const tempo = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
  for (const [resposta, motivo] of [[new Error('fetch failed'), /fetch failed/], [tempo, /timeout/], [{ status: 503 }, /HTTP 503/], [{ status: 200, body: '  ' }, /resposta vazia/], [{ status: 200, body: '<html>' }, /JSON|token/i]]) {
    const f = fila(resposta), e = esperas()
    const r = await readPrevious('macro.json', 'a/b', { fetchImpl: f.fetchImpl, wait: e.wait })
    assert.equal(r.status, 'unreadable')
    assert.equal(r.data, null)
    assert.match(r.error, motivo)
    assert.equal(f.chamadas.length, 3)
    assert.deepEqual(e.feitas, [1, 2]) // não espera depois da última tentativa
  }
})

test('loadPrevious continua devolvendo o conteúdo ou null (compatível com todos os coletores)', async () => {
  assert.deepEqual(await loadPrevious('x.json', 'a/b', sem(fila({ status: 200, body: '{"a":1}' }))), { a: 1 })
  assert.equal(await loadPrevious('x.json', 'a/b', sem(fila({ status: 404 }))), null)
  assert.equal(await loadPrevious('x.json', 'a/b', sem(fila({ status: 500 }))), null)
})

test('loadPreviousOrFail: "não existe" segue com null; "não consegui ler" interrompe a coleta', async () => {
  assert.equal(await loadPreviousOrFail('macro.json', 'a/b', sem(fila({ status: 404 }))), null)
  assert.deepEqual(await loadPreviousOrFail('macro.json', 'a/b', sem(fila({ status: 200, body: '{"a":1}' }))), { a: 1 })
  await assert.rejects(loadPreviousOrFail('macro.json', 'a/b', sem(fila({ status: 503 }))), /macro\.json: não foi possível ler o arquivo publicado \(HTTP 503\)/)
  // saída de emergência documentada
  process.env.PREV_IGNORAR_ILEGIVEL = 'true'
  try { assert.equal(await loadPreviousOrFail('macro.json', 'a/b', sem(fila({ status: 503 }))), null) }
  finally { delete process.env.PREV_IGNORAR_ILEGIVEL }
})

test('coletores que dependem do publicado param em leitura falha, e a publicação não segue sem eles', () => {
  const ler = (f) => readFileSync(new URL(f, import.meta.url), 'utf8')
  assert.match(ler('../scripts/fetch-macro.mjs'), /await loadPreviousOrFail\('macro\.json'\)/)
  assert.match(ler('../scripts/fetch-curves.mjs'), /await loadPreviousOrFail\('curves\.json'\)/)
  assert.match(ler('../scripts/fetch-focus-history.mjs'), /remote\.status === 'unreadable' && !local[\s\S]*?process\.exit\(1\)/)
  // macro.json, curves.json e focus-history.json não estão no git: se o passo falhasse e a publicação seguisse, o arquivo sumiria do site.
  const pages = ler('../../.github/workflows/pages.yml')
  for (const script of ['fetch-focus-history.mjs', 'fetch-macro.mjs', 'fetch-curves.mjs']) {
    const passo = pages.split(`run: node scripts/${script}`)[1].split('      - ')[0]
    assert.doesNotMatch(passo, /continue-on-error/, `${script}: falha precisa interromper a publicação`)
  }
})
