import test from 'node:test'
import assert from 'node:assert/strict'
import { CONCEITOS, TOPICOS, buscarConceitos, conexoesDe, porTopico } from '../src/educacao.js'
import { parseCommand } from '../src/terminal.js'
import { alavancagem, dividaLiquida } from '../src/tvm.js'
import { mesmoAluguelDuasRegras } from '../src/brGaap.js'

const byId = (id) => CONCEITOS.find(c => c.id === id)
const text = (c) => JSON.stringify(c)

test('TVM e BR GAAP: registro, tópico, busca, terminal e conexões', () => {
  assert.ok(TOPICOS.includes('Contabilidade e balanços'))
  assert.deepEqual(porTopico(CONCEITOS).find(g => g.topico === 'Contabilidade e balanços').itens.map(c => c.id), ['tvm', 'br-gaap'])
  for (const q of ['tvm', 'titulos e valores mobiliarios', 'custo amortizado', 'circular 3.068']) assert.ok(buscarConceitos(q).some(c => c.id === 'tvm'), q)
  for (const q of ['br gaap', 'brgaap', 'br gap', 'cpc pme', 'ifrs 16']) assert.ok(buscarConceitos(q).some(c => c.id === 'br-gaap'), q)
  for (const q of ['tvm', 'TVM <GO>']) assert.deepEqual(parseCommand(q), { kind: 'tab', id: 'aprender', sub: 'tvm' })
  for (const q of ['br gaap', 'BRGAAP', 'br-gap', 'gaap']) assert.deepEqual(parseCommand(q), { kind: 'tab', id: 'aprender', sub: 'br-gaap' })
  assert.ok(conexoesDe('tvm').some(x => x.id === 'marcacao-a-mercado'))
  assert.ok(conexoesDe('tvm').some(x => x.id === 'br-gaap'))
  assert.ok(conexoesDe('br-gaap').some(x => x.id === 'dividendos'))
})

test('TVM: dívida líquida tira só a aplicação vinculada e o texto traz os mesmos números', () => {
  const base = { divida: 30, caixa: 2, aplicacoes: 8, vinculadas: 3 }
  assert.equal(dividaLiquida({ ...base, vinculadas: 0 }), 20)
  assert.equal(dividaLiquida(base), 23)
  assert.equal(alavancagem(20, 10), 2)
  assert.equal(alavancagem(23, 10), 2.3)
  const c = byId('tvm'), ex = text(c.exemplo)
  for (const n of ['R\\$ 20,0 mi', 'R\\$ 23,0 mi', '2,00x', '2,30x']) assert.match(ex, new RegExp(n))
  assert.match(c.exemplo.resultado, /0,30x/)
  assert.match(text(c.lacunas), /Resolução CMN 4\.966\/2021, que revogou a Circular 3\.068\/2001/)
  assert.match(text(c.lacunas), /time value of money/)
  assert.equal(c.fontes.length, 3)
})

test('BR GAAP: mesmo aluguel em duas regras muda EBITDA e alavancagem, não o caixa', () => {
  const r = mesmoAluguelDuasRegras({ ebitdaAntesAluguel: 11.2, aluguel: 1.2, divida: 20, arrendamento: 5 })
  assert.ok(Math.abs(r.pme.ebitda - 10) < 1e-9)
  assert.ok(Math.abs(r.pme.alavancagem - 2) < 1e-9)
  assert.equal(r.completo.divida, 25)
  assert.ok(Math.abs(r.completo.alavancagem - 25 / 11.2) < 1e-12)
  const c = byId('br-gaap'), ex = text(c.exemplo)
  for (const n of ['R\\$ 10,0 mi', 'R\\$ 11,2 mi', 'R\\$ 25,0 mi', '2,00x', '2,23x']) assert.match(ex, new RegExp(n))
  assert.match(c.exemplo.resultado, /R\$ 1,2 mi.*0,23x/)
  assert.match(text(c.lacunas), /não “gap”/)
  assert.equal(c.fontes.length, 2)
})
