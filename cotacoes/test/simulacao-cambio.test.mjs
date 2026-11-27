import test from 'node:test'
import assert from 'node:assert/strict'
import { frase, lerValor, moeda, simular } from '../src/simulacaoCambio.js'
import { extremos, noPregao } from '../src/pregao.js'
const sp = (t) => t.replace(/\u00a0/g, ' ')

test('lê valores digitados em pt-BR', () => {
  for (const [t, v] of [['500.000', 500000], ['500000', 500000], ['1.250.000,50', 1250000.5], ['500 mil', 500000], ['1,5 mi', 1500000], ['2 milhões', 2e6], ['US$ 500.000', 500000], ['500,00', 500], ['1.500', 1500], ['1.5', 1.5], ['0.500', 0.5], ['500,5 mil', 500500], ['  500  ', 500], ['1,005 mi', 1005000]]) assert.equal(lerValor(t), v, t)
  for (const t of ['', '0', 'abc', '1,2,3', '-5', '−5', '(5)', '5,000.00', '500,000', 'US$']) assert.equal(lerValor(t), null, t)
})

test('pagar: alta do dólar é custo a mais; baixa é economia', () => {
  const s = simular({ valor: 500000, v0: 5.5073, v1: 5.5526, lado: 'pagar' })
  assert.equal(s.r0, 2753650); assert.equal(s.r1, 2776300); assert.equal(s.dif, 22650)
  assert.equal(s.efeito, 'custo'); assert.equal(s.favoravel, false)
  assert.equal(sp(frase(s)), 'você pagaria R$ 22.650,00 a mais')
  const b = simular({ valor: 500000, v0: 5.5526, v1: 5.5073 })
  assert.equal(b.efeito, 'economia'); assert.equal(b.favoravel, true); assert.equal(b.dif, -22650)
  assert.equal(sp(frase(b)), 'você pagaria R$ 22.650,00 a menos')
})

test('receber: alta é ganho; baixa é perda; sem variação, igual', () => {
  assert.equal(simular({ valor: 1000, v0: 5, v1: 5.1, lado: 'receber' }).efeito, 'ganho')
  const p = simular({ valor: 1000, v0: 5.1, v1: 5, lado: 'receber' })
  assert.equal(p.efeito, 'perda'); assert.equal(sp(frase(p)), 'você receberia R$ 100,00 a menos')
  assert.equal(simular({ valor: 1000, v0: 5, v1: 5 }).efeito, 'igual')
  assert.equal(simular({ valor: 0, v0: 5, v1: 5.1 }), null)
})

test('arredonda para centavos e formata a moeda estrangeira', () => {
  const s = simular({ valor: 1000, v0: 5.1234, v1: 5.1299 })
  assert.equal(s.r0, 5123.4); assert.equal(s.r1, 5129.9); assert.equal(s.dif, 6.5)
  const g = simular({ valor: 1000, v0: 5, v1: 5.1, lado: 'receber' })
  assert.equal(sp(frase(g)), 'você receberia R$ 100,00 a mais')
  assert.equal(frase(simular({ valor: 1000, v0: 5, v1: 5, lado: 'receber' })), 'você receberia o mesmo valor em reais')
  assert.equal(simular({ valor: 1000, v0: 5, v1: 5.1, lado: 'outro' }), null)
  assert.equal(sp(moeda(500000, 'USD')), 'US$ 500.000,00')
  assert.match(moeda(1000, 'CNH'), /CNH/)
})

test('pregão 9h às 18h de Brasília; máxima e mínima ignoram amostras fora dele', () => {
  assert.equal(noPregao(Date.parse('2026-11-27T08:15:00Z')), false) // 05h15
  assert.equal(noPregao(Date.parse('2026-11-27T12:00:00Z')), true) // 09h00
  assert.equal(noPregao(Date.parse('2026-11-27T21:00:00Z')), true) // 18h00
  assert.equal(noPregao(Date.parse('2026-11-27T21:05:00Z')), false) // 18h05
  const pts = [
    { t: Date.parse('2026-11-27T08:15:00Z'), bid: 5.65 },
    { t: Date.parse('2026-11-27T12:10:00Z'), bid: 5.50 },
    { t: Date.parse('2026-11-27T15:00:00Z'), bid: 5.58 },
    { t: Date.parse('2026-11-27T21:05:00Z'), bid: 5.40 },
  ]
  assert.deepEqual(extremos(pts, true), { hi: 2, lo: 1 })
  assert.deepEqual(extremos(pts, false), { hi: 0, lo: 3 })
  assert.equal(extremos(pts.slice(0, 1), true), null)
  assert.equal(noPregao(Date.parse('2026-11-28T15:00:00Z')), false) // sábado
  assert.equal(noPregao(NaN), false)
  assert.equal(extremos([pts[0], pts[3]], true), null) // tudo fora do pregão
})
