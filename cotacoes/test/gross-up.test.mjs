import test from 'node:test'
import assert from 'node:assert/strict'
import { CONCEITOS, buscarConceitos, conexoesDe, porTopico } from '../src/educacao.js'
import { parseCommand } from '../src/terminal.js'

test('gross-up: registro, busca, terminal e conexões', () => {
  assert.equal(CONCEITOS.filter(c => c.id === 'gross-up').length, 1)
  for (const q of ['gross-up', 'gross up', 'grossup', 'retenção']) assert.ok(buscarConceitos(q).some(c => c.id === 'gross-up'))
  for (const q of ['gross-up', 'grossup']) assert.deepEqual(parseCommand(q), { kind: 'tab', id: 'aprender', sub: 'gross-up' })
  assert.ok(porTopico(CONCEITOS).find(x => x.topico === 'Operações de crédito').itens.some(c => c.id === 'gross-up'))
  assert.ok(conexoesDe('gross-up').some(x => x.id === 'cet'))
})
test('gross-up: aritmética didática e ressalvas sem incidência universal', () => {
  const c = CONCEITOS.find(c => c.id === 'gross-up')
  assert.equal(800 / (1 - 0.2), 1000)
  assert.equal(1000 * 0.2, 200)
  assert.equal(960 * 0.8, 768)
  assert.equal(200 / 800, 0.25)
  assert.match(c.exemplo.resultado, /25%/)
  assert.match(c.lacunas.join(' '), /20%.*hipotética/)
  assert.match(c.lacunas.join(' '), /761, § 1º/)
  assert.match(c.lacunas.join(' '), /crédito fictício/)
  assert.match(c.preciso.texto, /0 ≤ t < 1/)
  assert.equal(c.fontes.length, 2)
})
