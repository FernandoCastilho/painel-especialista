import test from 'node:test'
import assert from 'node:assert/strict'
import { runSearchQueue } from '../src/searchQueue.js'
import { createLatestRequest } from '../src/latestRequest.js'
import { deferred, flush } from './helpers/hooks.mjs'

test('fechar busca não inicia fontes restantes nem indexa leitura compartilhada em trânsito', async () => {
  const controller = new AbortController(), pending = deferred(), started = [], accepted = [], failures = []
  const sharedResult = { data: { value: 10 } }
  const finished = runSearchQueue([1, 2, 3, 4, 5, 6], {
    signal: controller.signal,
    load: source => { started.push(source); return pending.promise },
    accept: (...args) => accepted.push(args), fail: (...args) => failures.push(args), concurrency: 2,
  })
  assert.deepEqual(started, [1, 2])
  controller.abort()
  pending.resolve(sharedResult)
  await finished
  assert.deepEqual(started, [1, 2])
  assert.deepEqual(accepted, [])
  assert.deepEqual(failures, [])
  assert.equal(await pending.promise, sharedResult, 'consumidor compartilhado ainda recebe a leitura')
})

test('cancelamento chega ao fetch próprio, sem registrar falha ou iniciar nova fonte', async () => {
  const controller = new AbortController(), started = [], errors = []
  const done = runSearchQueue(['external', 'later'], {
    signal: controller.signal, concurrency: 1,
    load: (source, signal) => new Promise((resolve, reject) => {
      started.push(source)
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
    accept: () => assert.fail('cancelado não pode publicar'), fail: error => errors.push(error),
  })
  controller.abort()
  await done
  assert.deepEqual(started, ['external'])
  assert.deepEqual(errors, [])
})

test('fila mantém concorrência limitada, sucesso e falha por fonte', async () => {
  const successes = [], failures = []
  await runSearchQueue([1, 2, 3], { signal: new AbortController().signal, concurrency: 1,
    load: async source => { if (source === 2) throw Error('offline'); return source * 10 },
    accept: (source, result) => successes.push([source, result]), fail: source => failures.push(source),
  })
  assert.deepEqual(successes, [[1, 10], [3, 30]])
  assert.deepEqual(failures, [2])
})

test('capa descarta respostas antigas mesmo se provedor ignora cancelamento', async () => {
  const requests = createLatestRequest(), first = deferred(), second = deferred(), applied = []
  const read = async pending => { const request = requests.start(); const value = await pending.promise; if (request.isCurrent()) applied.push(value); return request }
  const oldRead = read(first), latestRead = read(second)
  second.resolve('Empresa atual'); await latestRead
  first.resolve('Empresa anterior'); const old = await oldRead
  assert.equal(old.signal.aborted, true)
  assert.deepEqual(applied, ['Empresa atual'])
  const editing = requests.start()
  requests.cancel()
  await flush()
  assert.equal(editing.signal.aborted, true)
  assert.equal(editing.isCurrent(), false, 'editar site ou desmontar invalida sucesso e erro antigos')
})

test('índice público não oferece a tela B3 retirada da navegação', async () => {
  const { SEARCH_PAGES } = await import('../scripts/build-search-index.mjs')
  assert.equal(SEARCH_PAGES['SetoresB3.jsx'], undefined)
  assert.ok(Object.values(SEARCH_PAGES).every(([route]) => route !== 'setores/b3'))
})
