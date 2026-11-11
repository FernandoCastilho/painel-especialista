import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CHAVE_RECARGA, JANELA_RECARGA_MS, deveRecarregar, ehErroDeCarregamentoDeModulo, recarregarUmaVez, reiniciarRecargaParaTeste } from '../src/falhaCarregamento.js'

const guarda = (inicial = {}) => {
  const dados = { ...inicial }
  return { dados, getItem: (k) => (k in dados ? dados[k] : null), setItem: (k, v) => { dados[k] = String(v) } }
}

test('falha de carregamento: reconhece as mensagens do Chrome, do Firefox e do Safari', () => {
  assert.equal(ehErroDeCarregamentoDeModulo(new TypeError('Failed to fetch dynamically imported module: https://site/assets/Bancos-abc.js')), true)
  assert.equal(ehErroDeCarregamentoDeModulo(new TypeError('error loading dynamically imported module: https://site/assets/Bancos-abc.js')), true)
  assert.equal(ehErroDeCarregamentoDeModulo(new TypeError('Importing a module script failed.')), true)
  assert.equal(ehErroDeCarregamentoDeModulo(new Error('Unable to preload CSS for /assets/Bancos-abc.css')), true)
  assert.equal(ehErroDeCarregamentoDeModulo('Failed to fetch dynamically imported module'), true)
})

test('falha de carregamento: outros erros seguem o tratamento antigo', () => {
  assert.equal(ehErroDeCarregamentoDeModulo(new TypeError("Cannot read properties of undefined (reading 'map')")), false)
  assert.equal(ehErroDeCarregamentoDeModulo(new TypeError('Failed to fetch')), false)
  assert.equal(ehErroDeCarregamentoDeModulo(null), false)
  assert.equal(ehErroDeCarregamentoDeModulo(undefined), false)
  assert.equal(ehErroDeCarregamentoDeModulo({}), false)
})

test('falha de carregamento: recarrega só se ainda não tentou há pouco', () => {
  const agora = 1_000_000_000
  assert.equal(deveRecarregar(null, agora), true)
  assert.equal(deveRecarregar('', agora), true)
  assert.equal(deveRecarregar(String(agora - 1000), agora), false)
  assert.equal(deveRecarregar(String(agora - JANELA_RECARGA_MS + 1), agora), false)
  assert.equal(deveRecarregar(String(agora - JANELA_RECARGA_MS), agora), true)
  assert.equal(deveRecarregar('lixo', agora), false)
})

test('falha de carregamento: recarrega uma vez, grava a marca e não entra em laço', () => {
  reiniciarRecargaParaTeste()
  const storage = guarda()
  let recargas = 0
  const recarregar = () => { recargas += 1 }
  assert.equal(recarregarUmaVez({ storage, agora: 5000, recarregar }), true)
  // Segunda chamada na mesma página (o mesmo erro visto duas vezes): não dispara outra recarga.
  assert.equal(recarregarUmaVez({ storage, agora: 5001, recarregar }), true)
  assert.equal(recargas, 1)
  assert.equal(storage.dados[CHAVE_RECARGA], '5000')
  // Página já recarregada (memória zerada, marca guardada): falhou de novo, não recarrega.
  reiniciarRecargaParaTeste()
  assert.equal(recarregarUmaVez({ storage, agora: 9000, recarregar }), false)
  assert.equal(recargas, 1)
  // Muito tempo depois (outra publicação), volta a poder recarregar uma vez.
  assert.equal(recarregarUmaVez({ storage, agora: 5000 + JANELA_RECARGA_MS, recarregar }), true)
  assert.equal(recargas, 2)
  reiniciarRecargaParaTeste()
})

test('falha de carregamento: sem conseguir guardar a marca, não recarrega', () => {
  reiniciarRecargaParaTeste()
  let recargas = 0
  const recarregar = () => { recargas += 1 }
  const quebraNaLeitura = { getItem: () => { throw new Error('bloqueado') }, setItem: () => {} }
  const quebraNaEscrita = { getItem: () => null, setItem: () => { throw new Error('cheio') } }
  const naoGuarda = { getItem: () => null, setItem: () => {} }
  assert.equal(recarregarUmaVez({ storage: quebraNaLeitura, agora: 1, recarregar }), false)
  assert.equal(recarregarUmaVez({ storage: quebraNaEscrita, agora: 1, recarregar }), false)
  assert.equal(recarregarUmaVez({ storage: naoGuarda, agora: 1, recarregar }), false)
  assert.equal(recargas, 0)
})

test('falha de carregamento: a tela de erro oferece recarregar e mantém o tratamento dos outros erros', () => {
  const tela = readFileSync(new URL('../src/ErrorBoundary.jsx', import.meta.url), 'utf8')
  assert.match(tela, /ehErroDeCarregamentoDeModulo\(error\)/)
  assert.match(tela, /<h1>Não foi possível carregar esta tela<\/h1>\s*<p>Confira sua conexão e recarregue a página\.<\/p>/)
  assert.match(tela, /window\.location\.reload\(\)\}>Recarregar página</)
  assert.match(tela, /Tentar novamente/)
})

test('falha de carregamento: não há recarregamento periódico nem em segundo plano', () => {
  const logica = readFileSync(new URL('../src/falhaCarregamento.js', import.meta.url), 'utf8')
  assert.doesNotMatch(logica, /setInterval|setTimeout|visibilitychange/)
})

test('falha de carregamento: ao recarregar, a página vem da rede antes do cache', () => {
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  assert.match(sw, /req\.mode === 'navigate'\) \{\s*event\.respondWith\(networkFirst\(req\)/)
  assert.match(sw, /fetch\(req, \{ cache: 'no-cache' \}\)/)
})
