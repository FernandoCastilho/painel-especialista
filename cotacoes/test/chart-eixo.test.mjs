import test from 'node:test'
import assert from 'node:assert/strict'
import { marcasRedondas } from '../src/chartEixo.js'

// passo redondo: 1, 2, 2,5 ou 5 vezes uma potência de 10
const passoRedondo = (passo) => {
  const mantissa = passo / 10 ** Math.floor(Math.log10(passo) + 1e-9)
  return [1, 2, 2.5, 5].some((m) => Math.abs(mantissa - m) < 1e-9)
}
const confere = (lo, hi) => {
  const m = marcasRedondas(lo, hi)
  assert.ok(m.ticks.length >= 4 && m.ticks.length <= 6, `4 a 6 marcas em [${lo}, ${hi}]: ${m.ticks}`)
  assert.ok(passoRedondo(m.passo), `passo redondo em [${lo}, ${hi}]: ${m.passo}`)
  assert.ok(m.lo <= Math.min(lo, hi) + 1e-9 && m.hi >= Math.max(lo, hi) - 1e-9, `domínio cobre [${lo}, ${hi}]: ${m.lo} a ${m.hi}`)
  assert.equal(m.lo, m.ticks[0])
  assert.equal(m.hi, m.ticks.at(-1))
  for (const v of m.ticks) {
    assert.ok(Math.abs(v / m.passo - Math.round(v / m.passo)) < 1e-6, `marca ${v} é múltiplo do passo ${m.passo}`)
    assert.equal(Number(v.toFixed(m.casas)), v, `marca ${v} cabe em ${m.casas} casas`)
  }
  for (let i = 1; i < m.ticks.length; i++) assert.ok(Math.abs(m.ticks[i] - m.ticks[i - 1] - m.passo) < m.passo * 1e-6, 'marcas igualmente espaçadas')
  return m
}

test('eixo redondo: casos que apareciam quebrados na tela', () => {
  // histórico do BNDES (17,11 / 16,14 / 15,16)
  assert.deepEqual(confere(14.18, 17.11).ticks, [14, 15, 16, 17, 18])
  // curva DI x pré (15,44 / 14,95 / 14,45)
  assert.deepEqual(confere(13.46, 15.44).ticks, [13, 13.5, 14, 14.5, 15, 15.5])
  // câmbio intradiário (5,661 / 5,639 / 5,617)
  const cambio = confere(5.573, 5.661)
  assert.deepEqual(cambio.ticks, [5.55, 5.6, 5.65, 5.7])
  assert.equal(cambio.casas, 2)
  assert.deepEqual(confere(5.617, 5.661).ticks, [5.6, 5.62, 5.64, 5.66, 5.68])
})

test('eixo redondo: negativos e faixa que cruza o zero', () => {
  // cupom cambial (24,80 / 14,55 / 4,29 / −5,96)
  const cupom = confere(-16.2, 24.8)
  assert.deepEqual(cupom.ticks, [-20, -10, 0, 10, 20, 30])
  assert.equal(cupom.casas, 0)
  assert.deepEqual(confere(-1000000, 500000).ticks, [-1000000, -500000, 0, 500000])
  assert.deepEqual(confere(-0.42, -0.07).ticks, [-0.5, -0.4, -0.3, -0.2, -0.1, 0])
  assert.ok(confere(-3, 3).ticks.includes(0), 'o zero é uma marca quando a faixa cruza o zero')
})

test('eixo redondo: faixa minúscula, série constante e valores grandes', () => {
  const minuscula = confere(5.4321, 5.4329)
  assert.ok(minuscula.passo <= 0.0005 && minuscula.casas >= 4, JSON.stringify(minuscula))
  const constante = confere(15, 15)
  assert.ok(constante.lo < 15 && constante.hi > 15, 'série constante ganha faixa em volta do valor')
  assert.ok(constante.hi - constante.lo <= 1.5, 'a faixa em volta de um valor constante é pequena')
  const zero = confere(0, 0)
  assert.ok(zero.lo <= 0 && zero.hi > 0)
  confere(-7.5, -7.5)
  assert.equal(confere(182340, 197800).casas, 0)
  assert.deepEqual(confere(0, 100).ticks, [0, 20, 40, 60, 80, 100])
  // o passo 2,5 só aparece quando o 5 deixaria menos de 4 marcas
  assert.deepEqual(confere(2.5, 12.4).ticks, [0, 5, 10, 15])
  assert.deepEqual(confere(5.1, 14.9).ticks, [5, 7.5, 10, 12.5, 15])
  assert.equal(confere(5.1, 14.9).casas, 1)
})

test('eixo redondo: entradas invertidas ou inválidas não quebram o gráfico', () => {
  assert.deepEqual(marcasRedondas(17.11, 14.18).ticks, marcasRedondas(14.18, 17.11).ticks)
  for (const [lo, hi] of [[NaN, NaN], [NaN, 5], [3, Infinity], [undefined, undefined]]) {
    const m = marcasRedondas(lo, hi)
    assert.ok(m.ticks.length >= 4 && m.ticks.length <= 6 && m.ticks.every(Number.isFinite), `${lo}, ${hi}: ${m.ticks}`)
  }
})

test('eixo redondo: muitas faixas aleatórias mantêm 4 a 6 marcas redondas', () => {
  let semente = 42
  const sorteio = () => (semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296
  for (let i = 0; i < 3000; i++) {
    const ordem = 10 ** Math.floor(sorteio() * 12 - 5)
    const lo = (sorteio() - 0.5) * 2 * ordem
    const hi = lo + sorteio() * ordem * (sorteio() < 0.2 ? 0.001 : 1)
    if (hi - lo > Math.abs(hi) * 1e-9) confere(lo, hi)
  }
})
