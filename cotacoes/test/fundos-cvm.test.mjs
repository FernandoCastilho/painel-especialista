import assert from 'node:assert/strict'
import test from 'node:test'
import { compareHistory, simulateHistory } from '../src/investmentHistory.js'
import { buscarFundos, carregarCatalogoCvm, cotasDoFundo, isFundoCvm } from '../src/fundosCvm.js'

const classe = ['cvm-c-00017024000153', 'Classe Crédito Privado', '00017024000153']
const subclasse = ['cvm-c-00017024000153-A1', 'Classe Crédito Privado — Varejo', '00017024000153']

test('a busca começa com duas letras do nome', () => {
  assert.deepEqual(buscarFundos([classe, subclasse], 'Cl'), [classe, subclasse])
})
const rows = [['2026-09-30', 100], ['2026-10-15', 102], ['2026-10-30', 105], ['2026-11-20', 110]]

test('a busca gera siglas a partir dos nomes e prioriza a grafia literal', () => {
  const porSigla = ['cvm-c-00017024000153', 'Atlântico Fundo de Investimento em Cotas', '00017024000153']
  const literal = ['cvm-c-23731495000124', 'Atlântico FIC', '23731495000124']
  assert.deepEqual(buscarFundos([porSigla, literal], 'atlântico fic'), [literal, porSigla])
  assert.deepEqual(buscarFundos([porSigla], 'atlântico fzc'), [])
})

test('um prefixo do nome vem antes de ocorrências no meio de palavras', () => {
  const noMeio = ['cvm-c-00017024000153', 'Atlântico Responsabilidade Limitada', '00017024000153']
  const prefixo = ['cvm-c-23731495000124', 'Itaú Fundo de Investimento', '23731495000124']
  assert.deepEqual(buscarFundos([noMeio, prefixo], 'ita'), [prefixo, noMeio])
})

test('o CNPJ da própria classe tem prioridade sobre o CNPJ do fundo pai', () => {
  const cnpj = '23731495000124'
  const propria = ['cvm-c-' + cnpj, 'Classe principal', cnpj]
  const outra = ['cvm-c-00017024000153', 'Outra classe', '00017024000153', 'Fundo principal', cnpj]
  assert.deepEqual(buscarFundos([outra, propria], '23.731.495/0001-24'), [propria, outra])
})

test('a busca do Orion aceita o nome abreviado do Mais Retorno, a grafia do cadastro e o CNPJ', () => {
  const orion = ['cvm-c-23731495000124',
    'ITAÚ FUND OF FUNDS ORION MULT CRÉDITO PRIVADO INVESTIMENTO NO EXTERIOR FIF DA CIC RESP LIMITADA',
    '23731495000124']
  const semelhante = ['cvm-c-53671189000100', 'ITAÚ FOF PREMIUM ORION FIC MULT', '53671189000100']
  const catalogo = [semelhante, orion]
  for (const busca of ['Itaú Of Funds Orion Mult CP IE FIF DA CIC RL', 'Itaú Off Funds Orion',
    'Itaú Fund of Funds Orion', '23.731.495/0001-24', '23731495000124']) {
    assert.deepEqual(buscarFundos(catalogo, busca), [orion])
  }
})

test('o catálogo se recupera de um manifesto que aponta para um arquivo ausente', async t => {
  const antigo = 'catalogo-' + 'a'.repeat(64) + '.json.gz'
  const atual = 'catalogo-' + 'b'.repeat(64) + '.json.gz'
  const requisicoes = []
  globalThis.document = { baseURI: 'https://painel.example/cotacoes/' }
  t.after(() => { delete globalThis.document })
  t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
    requisicoes.push({ url, cache: opcoes.cache })
    if (url.pathname.endsWith('/manifest.json')) {
      return Response.json({
        version: 1, first: '2026-09-30', last: '2026-11-20',
        files: { catalogo: url.search ? atual : antigo },
      })
    }
    if (url.pathname.endsWith(atual.replace(/\.gz$/, ''))) return Response.json([classe])
    return new Response(null, { status: 404 })
  })
  assert.deepEqual((await carregarCatalogoCvm()).items, [classe])
  // Manifesto antigo, JSON comum e .gz ausentes; manifesto revalidado, JSON comum atual.
  assert.deepEqual(requisicoes.map(({ url }) => url.pathname.split('/').at(-1)),
    ['manifest.json', antigo.replace(/\.gz$/, ''), antigo, 'manifest.json', atual.replace(/\.gz$/, '')])
  assert.ok(requisicoes[3].url.search)
  assert.equal(requisicoes[3].url.search, requisicoes[4].url.search)
  assert.equal(requisicoes[4].cache, 'no-store')
})

test('a base de fundos abre em rede que barra .gz e, sem a cópia comum, usa o .gz', async t => {
  const catalogo = 'catalogo-' + 'c'.repeat(64) + '.json.gz'
  const bucket = [...classe[2]].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 128, 0)
  const cotas = 'cotas-' + bucket + '-' + 'd'.repeat(64) + '.json.gz'
  const comprimir = async objeto => new Uint8Array(await new Response(
    new Blob([JSON.stringify(objeto)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())
  const pedidos = []
  globalThis.document = { baseURI: 'https://painel.example/cotacoes/' }
  t.after(() => { delete globalThis.document })
  t.mock.method(globalThis, 'fetch', async url => {
    const nome = url.pathname.split('/').at(-1)
    pedidos.push(nome)
    if (nome === 'manifest.json') {
      return Response.json({ version: 1, first: '2026-09-30', last: '2026-11-20', files: { catalogo, [bucket]: cotas } })
    }
    // Proxy da empresa: 403 MediaTypeBlockedDownload em todo .gz.
    if (nome === catalogo.replace(/\.gz$/, '')) return Response.json([classe])
    if (nome.endsWith('.gz') && nome.startsWith('catalogo')) return new Response('bloqueado', { status: 403 })
    // Site publicado antes da cópia comum: só o .gz das cotas existe.
    if (nome === cotas) return new Response(await comprimir({ [classe[0]]: rows }))
    return new Response(null, { status: 404 })
  })
  // Módulo novo: o catálogo do teste anterior fica guardado no módulo já carregado.
  const cvm = await import('../src/fundosCvm.js?rede-que-barra-gz')
  assert.deepEqual((await cvm.carregarCatalogoCvm()).items, [classe])
  assert.deepEqual(pedidos, ['manifest.json', catalogo.replace(/\.gz$/, '')])
  assert.deepEqual((await cvm.carregarFundoCvm(classe[0])).rows, rows)
  assert.deepEqual(pedidos.slice(2), [cotas.replace(/\.gz$/, ''), cotas])
})

test('a busca encontra nome sem acentos e CNPJ formatado, distinguindo subclasses', () => {
  assert.deepEqual(buscarFundos([classe, subclasse], 'credito  privado'), [classe, subclasse])
  assert.deepEqual(buscarFundos([classe, subclasse], '00.017.024/0001-53'), [classe, subclasse])
  assert.deepEqual(buscarFundos([classe, subclasse], 'varejo'), [subclasse])
  assert.ok(isFundoCvm(subclasse[0]))
  assert.ok(!isFundoCvm('cvm-c-00017024000153/..'))
})

test('cotas diárias preservam a subclasse e alimentam comparação e carteira por mês fechado', () => {
  const item = cotasDoFundo({ [subclasse[0]]: rows, [classe[0]]: [['2026-10-30', 999]] }, subclasse)
  assert.deepEqual(item.rows, rows)
  const cdi = { id: 'cdi', currency: 'BRL', rows: [['2026-09-30', 1], ['2026-10-30', 1.01]] }
  const comparison = compareHistory([item, cdi], 6, 'BRL', {}, '2026-11')
  assert.deepEqual(comparison.timeline, ['2026-09', '2026-10'])
  assert.deepEqual(comparison.tracks[0].values, [1, 1.05])
  assert.deepEqual(simulateHistory(comparison.tracks, [500, 500]), [1, 1.03])
})

test('cotas inválidas, duplicadas ou indisponíveis não viram série de investimento', () => {
  assert.throws(() => cotasDoFundo({}, classe), /cotas/)
  assert.throws(() => cotasDoFundo({ [classe[0]]: [...rows, rows.at(-1)] }, classe), /cotas/)
  assert.throws(() => cotasDoFundo({ [classe[0]]: [...rows, ['2026-11-31', 5]] }, classe), /cotas/)
})
