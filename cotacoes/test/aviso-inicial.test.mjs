import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AVISO_FONTES, AVISO_KEY, AVISO_RESUMO, avisoPendente, marcarAvisoVisto } from '../src/avisoInicial.js'

const read = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
const memoria = () => { const map = new Map(); return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) } }

test('o texto do aviso de entrada não mudou', () => {
  assert.equal(AVISO_RESUMO, 'Aplicativo educacional, com informação ilustrativa. Não é recomendação de crédito.')
  assert.deepEqual(AVISO_FONTES, [
    ['Quase ao vivo', 'câmbio, a cada poucos minutos em dias úteis (9h05 às 18h), sem garantia de tempo real.'],
    ['Diário', 'curvas de juros da B3, uma referência por dia útil.'],
    ['Semanal', 'Focus, às segundas.'],
    ['Manual', 'projeções dos bancos, conferidas à mão; cada uma mostra a sua data.'],
  ])
})

test('exibe automaticamente uma vez por data de Brasília e volta na primeira visita do dia seguinte', () => {
  const storage = memoria()
  const primeiroAcesso = new Date('2026-11-24T15:00:00Z')
  const antesDaVirada = new Date('2026-11-25T02:59:59Z')
  const depoisDaVirada = new Date('2026-11-25T03:00:00Z')
  assert.equal(avisoPendente(storage, primeiroAcesso), true)
  marcarAvisoVisto(storage, primeiroAcesso)
  assert.equal(storage.map.get(AVISO_KEY), '2026-11-24')
  assert.equal(avisoPendente(storage, primeiroAcesso), false)
  assert.equal(avisoPendente(storage, antesDaVirada), false, 'meia-noite em UTC não altera o dia de Brasília')
  assert.equal(avisoPendente(storage, depoisDaVirada), true)
  marcarAvisoVisto(storage, depoisDaVirada)
  assert.equal(avisoPendente(storage, depoisDaVirada), false)
})

test('a marca antiga por versão não é confundida com uma data de exibição', () => {
  const storage = memoria()
  storage.setItem(AVISO_KEY, 'v1-00000000')
  assert.equal(avisoPendente(storage, new Date('2026-11-24T15:00:00Z')), true)
})

test('armazenamento bloqueado ou ausente: o aviso aparece e nada quebra', () => {
  const bloqueado = { getItem() { throw new Error('bloqueado') }, setItem() { throw new Error('bloqueado') } }
  assert.equal(avisoPendente(bloqueado), true)
  assert.doesNotThrow(() => marcarAvisoVisto(bloqueado))
  assert.equal(avisoPendente(null), true)
  assert.doesNotThrow(() => marcarAvisoVisto(null))
})

test('App: aviso sozinho só quando pendente e fora de navegador automatizado; conceito e panorama não abrem sozinhos', () => {
  const app = read('App.jsx')
  assert.match(app, /useState\(\(\) => !navigator\.webdriver && avisoPendente\(\)\)/)
  assert.match(app, /const fecharAviso = \(\) => setAvisoAberto\(false\)/)
  assert.match(app, /<AvisoInicial open=\{avisoAberto\} onClose=\{fecharAviso\} onShow=\{marcarAvisoVisto\} \/>/)
  // O conteúdo do aviso continua a um clique, na janela do "i", presente em todas as telas.
  assert.match(app, /onClick=\{\(\) => setAvisoAberto\(true\)\}>Ver o aviso de entrada<\/button>/)
  assert.doesNotMatch(app, /<ConceitoDiario/)
  assert.match(app, /<MarketPopup open=\{panorama\.aberto\} slot=\{panorama\.momento\} onClose=\{panorama\.fechar\}/)
  const aviso = read('AvisoInicial.jsx')
  assert.match(aviso, /el\.showModal\(\)\s+onShow\(\)/)
  assert.match(aviso, /<p>\{AVISO_RESUMO\}<\/p>/)
  assert.match(aviso, /AVISO_FONTES\.map\(\(\[rotulo, texto\]\) => <li key=\{rotulo\}><b>\{rotulo\}:<\/b> \{texto\}<\/li>\)/)
  // Nenhum dos três componentes agenda abertura por tempo.
  for (const name of ['AvisoInicial.jsx', 'ConceitoDiario.jsx', 'MarketPopup.jsx']) assert.doesNotMatch(read(name), /setInterval|setTimeout|navigator\.locks/, name)
  // Quem não é desta entrega continua desligado em navegador automatizado.
  assert.match(read('Recado.jsx'), /navigator\.webdriver/)
  assert.match(read('AlertaVariacao.jsx'), /navigator\.webdriver/)
})
