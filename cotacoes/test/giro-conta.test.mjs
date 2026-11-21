// Conta do Capital de Giro com as opções de 21/11/2026 (giroConta.js): periodicidade, juros pagos na carência, Fee em % e
// parcela flex. Primeiro prova que, nas opções de hoje, o resultado é idêntico ao do giroOperation (a conta de 66fb42e, que
// continua em creditComparison.js para o Comparador e a Análise de desconto); depois confere cada novidade e os casos de borda.
import test from 'node:test'
import assert from 'node:assert/strict'
import { giroConta, giroFee, giroParcelas } from '../src/giroConta.js'
import { giroOperation } from '../src/creditComparison.js'
import { addMonths } from '../src/creditModalities.js'
import { isBusinessDayAll } from '../src/holidays.js'
import { cgAddDays } from '../src/contaGarantida.js'

const cents = value => Math.round(value * 100)
const base = { value: 1000000, n: 24, rate: 2, unit: 'am', system: 'price', start: '2026-11-21', firstDue: '2026-12-21', calendars: ['BR'] }

// Sorteio reproduzível (mesma semente, mesmas operações).
function sorteio(seed) {
  let s = seed >>> 0
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

test('opções de hoje: idêntico ao giroOperation, centavo a centavo, em 600 operações sorteadas', () => {
  const r = sorteio(20261121)
  const pick = list => list[Math.floor(r() * list.length)]
  const pracas = [['BR'], ['BR', 'SP'], ['BR', 'SPE'], ['BR', 'MG'], ['BR', 'PR'], ['BR', 'SPE', 'CPS']]
  let ok = 0
  for (let i = 0; i < 600; i++) {
    const system = pick(['price', 'price', 'sac', 'sac', 'bullet'])
    const term = 1 + Math.floor(r() * 72)
    const grace = system === 'bullet' || term < 2 ? 0 : Math.floor(r() * Math.min(12, term - 1))
    const start = addMonths('2025-01-01', Math.floor(r() * 48)).slice(0, 8) + String(1 + Math.floor(r() * 28)).padStart(2, '0')
    const manual = r() < 0.2
    const firstDue = manual ? addMonths(start, 1 + Math.floor(r() * 4)).slice(0, 8) + String(1 + Math.floor(r() * 28)).padStart(2, '0')
      : addMonths(start, system === 'bullet' ? term : grace + 1)
    const profile = r() < 0.2 ? 'simples' : 'pj'
    const p = {
      value: Math.round((1000 + r() * pick([30000, 1e6, 5e7])) * 100) / 100,
      n: system === 'bullet' ? 1 : term - grace, rate: Math.round(r() * 400) / 100, unit: pick(['am', 'aa']), system, start, firstDue,
      profile, eligible: profile === 'simples' && r() < 0.7, fees: r() < 0.5 ? Math.round(r() * 20000 * 100) / 100 : 0,
      financedFees: r() < 0.4 ? Math.round(r() * 15000 * 100) / 100 : 0, financeIof: r() < 0.4, calendars: pick(pracas),
    }
    const old = giroOperation(p)
    assert.deepStrictEqual(giroConta(p), old, JSON.stringify(p))
    assert.deepStrictEqual(giroConta({ ...p, periodicidade: 1, jurosNaCarencia: false, flex: {} }), old, JSON.stringify(p))
    if (old.ok) ok++
  }
  assert.ok(ok > 400, `operações válidas comparadas: ${ok}`)
})

test('opções de hoje: exemplo de abertura da tela (R$ 1 milhão, 24 meses, Price, 2% a.m.) não muda', () => {
  const r = giroConta(base)
  assert.deepEqual([r.net, r.rows[0].payment, r.total, r.cost, r.interest, r.iof], [972057.48, 53046.05, 1301047.61, 301047.61, 273105.09, 27942.52])
})

// Somas que a tela mostra: juros + IOF + despesas = custo; total = solicitado + custo; saldo final zero; amortizações = saldo inicial.
function confereSomas(r, label) {
  assert.equal(r.ok, true, `${label}: ${r.error}`)
  assert.equal(cents(r.interest) + cents(r.iof) + cents(r.fees + r.financedFees), cents(r.cost), `${label}: partes do custo`)
  assert.equal(cents(r.total), cents(r.value) + cents(r.cost), `${label}: total`)
  assert.equal(r.rows.at(-1).balance, 0, `${label}: saldo final`)
  const opening = r.rows.reduce((sum, row) => sum + cents(row.amortization), 0)
  assert.equal(opening, cents(r.financedBalance) + cents(r.capitalizedGrace), `${label}: amortizações = saldo`)
  assert.equal(r.rows.reduce((sum, row) => sum + cents(row.originalAmortization), 0), cents(r.financedBalance), `${label}: principal do IOF`)
  assert.equal(r.rows.reduce((sum, row) => sum + cents(row.payment), 0), cents(r.paid), `${label}: pagamentos`)
  for (const row of r.rows) {
    assert.equal(cents(row.payment), cents(row.amortization) + cents(row.interest), `${label}: parcela ${row.number}`)
    assert.ok(isBusinessDayAll(row.date, ['BR']), `${label}: ${row.date} em dia útil`)
  }
}

test('periodicidade: trimestral, bimestral, quadrimestral e semestral em Price e SAC', () => {
  for (const [p, label] of [[2, 'bimestral'], [3, 'trimestral'], [4, 'quadrimestral'], [6, 'semestral']]) for (const system of ['price', 'sac']) {
    const n = 24 / p
    const r = giroConta({ ...base, system, n, periodicidade: p, firstDue: addMonths(base.start, p) })
    confereSomas(r, `${label} ${system}`)
    assert.equal(r.rows.length, n)
    // Vencimentos a cada p meses (antes do ajuste para o dia útil) e juros por dias corridos na base de 30.
    let previous = base.start, balance = r.financedBalance + r.capitalizedGrace
    r.rows.forEach((row, k) => {
      const contractual = addMonths(base.start, p * (k + 1))
      assert.ok(row.date >= contractual && row.days - (Date.parse(contractual) - Date.parse(base.start)) / 864e5 <= 4, `${label} ${row.date}`)
      const d = (Date.parse(row.date) - Date.parse(previous)) / 864e5
      if (k > 0 || r.graceDays === 0) assert.equal(row.interest, Math.round(balance * (1.02 ** (d / 30) - 1) * 100) / 100)
      balance = Math.round((balance - row.amortization) * 100) / 100; previous = row.date
    })
    if (system === 'sac') for (const row of r.rows.slice(0, -1)) assert.ok(Math.abs(row.amortization - (r.financedBalance + r.capitalizedGrace) / n) < 0.02)
  }
  // Mensal (p = 1) com o parâmetro explícito é o mesmo de hoje.
  assert.deepStrictEqual(giroConta({ ...base, periodicidade: 1 }), giroOperation(base))
})

test('prazo menos carência que não é múltiplo da periodicidade: erro explica os prazos possíveis', () => {
  assert.deepEqual(giroParcelas(24, 0, 3), { ok: true, n: 8 })
  assert.deepEqual(giroParcelas(24, 6, 6), { ok: true, n: 3 })
  const e = giroParcelas(25, 0, 3)
  assert.equal(e.ok, false)
  assert.match(e.error, /múltiplo de 3 meses/)
  assert.match(e.error, /24 ou 27 meses/)
  assert.match(giroParcelas(20, 3, 6).error, /prazo de 15 ou 21 meses/)
  assert.equal(giroConta({ ...base, periodicidade: 5 }).ok, false)
})

test('juros na carência: trimestral com 6 meses de carência paga só juros a cada 3 meses e não capitaliza', () => {
  const p = { ...base, n: 6, periodicidade: 3, firstDue: addMonths(base.start, 9), jurosNaCarencia: true }
  const r = giroConta(p)
  confereSomas(r, 'carência trimestral')
  const juros = r.rows.filter(row => row.juros)
  assert.deepEqual(juros.map(row => row.date), ['2027-02-22', '2027-05-21']) // 21/02/2027 é domingo
  for (const row of juros) { assert.equal(row.amortization, 0); assert.equal(row.balance, 1000000); assert.equal(row.payment, row.interest) }
  assert.equal(r.capitalizedGrace, 0)
  assert.equal(r.rows.length, 8)
  assert.equal(r.installment, r.rows[2].payment)
  // Comparado com somar os juros ao saldo: paga menos juros no total e a parcela é menor.
  const capitalized = giroConta({ ...p, jurosNaCarencia: false })
  assert.ok(capitalized.capitalizedGrace > 0 && capitalized.interest > r.interest && capitalized.installment > r.installment)
  // IOF: só sobre as amortizações e seus prazos. No SAC o principal amortizado é o mesmo nas mesmas datas: IOF igual.
  assert.equal(giroConta({ ...p, system: 'sac' }).iof, giroConta({ ...p, system: 'sac', jurosNaCarencia: false }).iof)
  // Carência que não é múltipla da periodicidade: juros a cada 3 meses e um último no fim da carência.
  const odd = giroConta({ ...base, n: 6, periodicidade: 3, firstDue: addMonths(base.start, 7), jurosNaCarencia: true })
  confereSomas(odd, 'carência de 4 meses')
  assert.deepEqual(odd.rows.filter(row => row.juros).map(row => row.date), ['2027-02-22', '2027-03-22'])
  // Sem carência, a opção não muda nada.
  assert.deepStrictEqual(giroConta({ ...base, jurosNaCarencia: true }), giroOperation(base))
})

test('Fee em %: percentual do valor solicitado, em centavos, e daí igual ao Fee em R$', () => {
  assert.equal(giroFee(1000000, 1.5), 15000)
  assert.equal(giroFee(333333.33, 0.75), 2500)
  assert.equal(giroFee(123456.78, 0.333), 411.11)
  const pct = giroConta({ ...base, fees: giroFee(base.value, 1.5) })
  assert.deepStrictEqual(pct, giroConta({ ...base, fees: 15000 }))
  confereSomas(pct, 'Fee em %')
  confereSomas(giroConta({ ...base, financedFees: giroFee(base.value, 1.5) }), 'Fee em % financiado')
})

test('flex Price: anteriores iguais, seguintes com o mesmo pagamento, saldo zero no fim', () => {
  const plain = giroConta(base)
  const r = giroConta({ ...base, flex: { 5: { payment: 100000 } } })
  confereSomas(r, 'flex Price')
  assert.deepStrictEqual(r.rows.slice(0, 4).map(row => [row.date, row.payment, row.balance]), plain.rows.slice(0, 4).map(row => [row.date, row.payment, row.balance]))
  assert.equal(r.rows[4].payment, 100000); assert.equal(r.rows[4].fixed, true)
  const after = r.rows.slice(5, -1).map(row => row.payment)
  assert.ok(after.every(payment => payment === after[0]), 'mesmo pagamento nas seguintes')
  assert.ok(Math.abs(r.rows.at(-1).payment - after[0]) < 0.1, 'a última só absorve centavos')
  assert.ok(after[0] < plain.rows[5].payment)
})

test('flex SAC com várias fixas e data alterada: mesma amortização nas livres depois da primeira fixa', () => {
  const plain = giroConta({ ...base, system: 'sac' })
  const r = giroConta({ ...base, system: 'sac', flex: { 3: { date: '2027-02-26' }, 8: { payment: 80000 }, 15: { payment: 60000, date: '2028-02-16' } } })
  confereSomas(r, 'flex SAC')
  assert.deepStrictEqual(r.rows.slice(0, 2), plain.rows.slice(0, 2))
  // A data alterada muda só os juros por dias daquela parcela e da seguinte; a amortização dela fica.
  assert.equal(r.rows[2].date, '2027-02-26'); assert.equal(r.rows[2].amortization, plain.rows[2].amortization)
  assert.ok(r.rows[2].interest > plain.rows[2].interest && r.rows[3].interest < plain.rows[3].interest)
  const free = r.rows.filter((row, k) => k > 2 && !row.fixed && k < r.rows.length - 1).map(row => row.amortization)
  assert.ok(free.every(a => a === free[0]), 'mesma amortização nas livres')
  assert.equal(r.rows[7].payment, 80000); assert.equal(r.rows[14].payment, 60000); assert.equal(r.rows[14].date, '2028-02-16')
})

test('flex que quita antes: as parcelas restantes saem e o fim é avisado', () => {
  const r = giroConta({ ...base, flex: { 6: { payment: 2000000 } } })
  confereSomas(r, 'quita antes')
  assert.equal(r.rows.length, 6)
  assert.deepEqual(r.earlyEnd, { number: 6, date: r.rows[5].date })
  assert.ok(r.rows[5].payment < 2000000)
  // Várias fixas que juntas quitam antes: as livres entre elas ficam só com os juros.
  const two = giroConta({ ...base, flex: { 3: { payment: 500000 }, 6: { payment: 600000 } } })
  confereSomas(two, 'duas fixas quitam')
  assert.equal(two.rows.length, 6); assert.equal(two.earlyEnd.number, 6)
  assert.equal(two.rows[3].amortization, 0); assert.equal(two.rows[4].amortization, 0)
})

test('flex: erros de data fora de ordem, valor menor que os juros e Bullet', () => {
  assert.match(giroConta({ ...base, flex: { 4: { date: '2027-01-10' } } }).error, /Parcela 4: o vencimento precisa ficar entre 22\/02\/2027 e 22\/04\/2027/)
  assert.match(giroConta({ ...base, flex: { 4: { date: '2027-04-30' } } }).error, /Parcela 4: o vencimento precisa ficar entre/)
  assert.match(giroConta({ ...base, flex: { 4: { payment: 1000 } } }).error, /Parcela 4: o valor não cobre os juros do período \(R\$/)
  assert.match(giroConta({ ...base, system: 'bullet', n: 1, firstDue: '2028-11-21', flex: { 1: { payment: 1 } } }).error, /Bullet/)
  // Todas as seguintes fixadas sem fechar o saldo: a última precisa bater.
  const flex = Object.fromEntries(Array.from({ length: 20 }, (_, k) => [k + 5, { payment: 40000 }]))
  assert.match(giroConta({ ...base, flex }).error, /o saldo não fecha/)
})

test('flex com periodicidade trimestral e juros na carência', () => {
  const p = { ...base, n: 6, periodicidade: 3, firstDue: addMonths(base.start, 9), jurosNaCarencia: true }
  const plain = giroConta(p)
  const r = giroConta({ ...p, flex: { 3: { payment: 250000 } } })
  confereSomas(r, 'trimestral + carência + flex')
  assert.deepStrictEqual(r.rows.slice(0, 2), plain.rows.slice(0, 2))
  assert.equal(r.rows[2].payment, 250000)
  // Linha de juros da carência também pode ser ajustada: pagar mais que os juros amortiza.
  const g = giroConta({ ...p, flex: { 1: { payment: 100000 } } })
  confereSomas(g, 'juros da carência ajustados')
  assert.ok(g.rows[0].amortization > 0 && g.rows[1].juros && g.rows[1].amortization === 0)
  assert.ok(g.rows[0].fixed)
  // CET, IOF e total usam o fluxo ajustado.
  assert.notEqual(r.cet, plain.cet); assert.notEqual(r.iof, plain.iof)
})

test('Bullet: periodicidade e juros na carência não se aplicam', () => {
  const p = { ...base, system: 'bullet', n: 1, firstDue: '2028-11-21' }
  assert.deepStrictEqual(giroConta({ ...p, periodicidade: 3, jurosNaCarencia: true }), giroOperation(p))
})

test('opções novas sorteadas: quando há resultado, as somas fecham; quando não há, a mensagem é clara', () => {
  const r = sorteio(42)
  const pick = list => list[Math.floor(r() * list.length)]
  let ok = 0
  for (let i = 0; i < 300; i++) {
    const system = pick(['price', 'sac'])
    const p = pick([1, 2, 3, 4, 6])
    const n = 1 + Math.floor(r() * 12), grace = pick([0, 0, p, 2 * p, 5])
    const start = addMonths('2026-01-01', Math.floor(r() * 24)).slice(0, 8) + String(1 + Math.floor(r() * 28)).padStart(2, '0')
    const input = { value: Math.round((50000 + r() * 5e6) * 100) / 100, n, rate: Math.round(r() * 300) / 100, unit: 'am', system, start,
      firstDue: addMonths(start, grace + p), periodicidade: p, jurosNaCarencia: r() < 0.5, fees: r() < 0.5 ? 1000 : 0,
      financedFees: r() < 0.3 ? 2000 : 0, financeIof: r() < 0.3, calendars: ['BR'] }
    const plain = giroConta(input)
    assert.equal(plain.ok, true, plain.error)
    confereSomas(plain, `sorteio ${i}`)
    const flex = {}
    for (const row of plain.rows) if (r() < 0.2) flex[row.number] = r() < 0.5
      ? { payment: Math.round(row.payment * (0.8 + r() * 0.8) * 100) / 100 } : { date: cgAddDays(row.date, Math.floor(r() * 11) - 5) }
    const adjusted = giroConta({ ...input, flex })
    if (adjusted.ok) { confereSomas(adjusted, `sorteio flex ${i}`); ok++ } else assert.match(adjusted.error, /^(Parcela \d+|Com )/)
  }
  assert.ok(ok > 120, `fluxos ajustados válidos: ${ok}`)
})
