import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cgInitialForm, parseContaGarantidaForm } from '../src/contaGarantida.js'
import { discountOperation } from '../src/analiseDesconto.js'
import { newFinimpDraft } from '../src/calculatorDraft.js'
import { validateFinimpInputs, FINIMP_CURRENCIES } from '../src/finimpInputs.js'
import { compareFinimp, solveFinimpRate } from '../src/finimpComparison.js'
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.005, `${actual} ≠ ${expected}`)
const doc = name => readFileSync(new URL(`../../docs/${name}.md`, import.meta.url), 'utf8')

test('F5: exemplos CG de dez e quarenta dias sem capitalizar encargos', () => {
  for (const [duration, interest, dailyIof, cost] of [[10, 1000, 82, 1462], [40, 4000, 328, 4708]]) {
    const r = parseContaGarantidaForm({ ...cgInitialForm('2026-11-06'), amount: '100.000,00', rate: '3', rateBase: '30', conversion: 'proportional', duration: String(duration) }).result
    assert.equal(r.ok, true)
    near(r.totals.interest, interest); near(r.totals.dailyIof, dailyIof)
    near(r.totals.additionalIof, 380); near(r.totals.cost, cost)
    assert.equal(r.balance, 0)
    assert.ok(r.rows.slice(0, -1).every(row => row.balance === 100000))
  }
  const text = doc('conta-garantida')
  assert.match(text, /mensal, proporcional, divisor 30/)
  assert.match(text, /Datas anteriores a 17\/07\/2025 são \*\*bloqueadas\*\*/)
})

test('CET da conta garantida (art. 6º): exemplo da documentação confere com o motor', () => {
  const { cet } = parseContaGarantidaForm({ ...cgInitialForm('2026-11-06'), amount: '100.000,00', rate: '3', limit: '100.000,00' })
  assert.equal(cet.ok, true)
  near(cet.payment, 103626)
  near(cet.annual * 100, Math.pow(1.03626, 365 / 30) * 100 - 100)
  assert.equal((cet.annual * 100).toFixed(2), '54.24'); assert.equal((cet.monthly * 100).toFixed(2), '3.68')
  const text = doc('conta-garantida')
  assert.match(text, /R\$ 103\.626,00 → CET 54,24% a\.a\. \(3,68% a\.m\.\)/)
  assert.match(text, /conferida no texto oficial da norma/)
})

test('F5: exemplo atual do desconto usa juros e IOF automáticos', () => {
  const r = discountOperation({ date: '2026-11-05', titleRows: [{ value: 225600.43, count: 30, dueDate: '2026-12-05' }], rate: 1.83, convention: 'commercial30', taxProfile: 'pj', feeMode: 'total', fee: 564, tac: 260 })
  assert.equal(r.ok, true)
  near(r.interest, 4128.49); near(r.base, 221471.94); near(r.iof, 1386.41)
  near(r.cost, 6338.90); near(r.net, 219261.53)
  assert.match(doc('analise-desconto'), /recalcula juros e IOF/)
  assert.match(doc('analise-desconto'), /não validam a versão atual automática/)
})

test('F5: exemplo FINIMP usa cinco moedas, TAC em reais convertida e meta coerente', () => {
  const draft = { ...newFinimpDraft(), principalText: '100.000,00', currency: 'USD', useTac: true, tacFxText: '5', competitor: { annualRate: '6', flatRate: '1', tac: '1.000,00' }, itau: { annualRate: '8', flatRate: '0,5', tac: '1.500,00' } }
  const p = validateFinimpInputs(draft)
  assert.equal(p.conditionsReady, true)
  assert.equal(p.competitor.tac, 200); assert.equal(p.itau.tac, 300)
  const r = compareFinimp({ principal: p.principal, days: 180, competitor: p.competitor, itau: p.itau })
  assert.equal(r.ok, true); near(r.competitor.cost, 4200); near(r.itau.cost, 4800)
  const solved = solveFinimpRate({ principal: p.principal, days: 180, flatRate: p.itau.flatRate, tac: p.itau.tac, targetCost: r.competitor.cost })
  assert.equal(solved.ok, true); near(solved.annualRate, 6.8)
  for (const currency of FINIMP_CURRENCIES) assert.ok(doc('finimp-comparacao').includes(currency))
  assert.match(doc('finimp-comparacao'), /TAC opcional informada em reais/)
})


test('documentação CG preserva e separa o comparativo paralelo de alongamento e NCG', () => {
  const text = doc('conta-garantida')
  assert.match(text, /Comparar com parcelado/)
  assert.match(text, /conta-garantida-alongamento\.md/)
  assert.match(text, /regras de apuração abaixo descrevem os dois primeiros modos/)
  assert.match(text, /carência do novo giro tem regras próprias/)
})
