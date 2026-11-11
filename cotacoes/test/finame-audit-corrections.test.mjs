import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LIMITE_MONETARIO, cronograma, simular, taxaFinal } from '../src/finameMateriais.js'
import { simulateTlpExigivel } from '../src/bndesTlpExigivel.js'

const base = { valor: 100000, prazo: 12, carencia: 0, custo: 'tfb', custoFinanceiro: 12, taxaBndes: 0, taxaAgente: 0, sistema: 'sac' }
const near = (a, b, message = '') => assert.ok(Math.abs(a - b) < 0.005, `${message}: ${a} != ${b}`)
const verify = result => {
  assert.equal(result.ok, true, JSON.stringify(result.erros))
  const sum = field => result.parcelas.reduce((total, row) => total + row[field], 0)
  assert.equal(result.parcelas.at(-1).saldo, 0)
  near(sum('principal'), result.financiado, 'principal')
  near(sum('amortizacao'), result.financiado + result.correcao, 'amortização')
  near(sum('pago') + result.iofFixo, result.total, 'pagamentos')
  near(result.financiado + result.correcao + result.juros + result.iof, result.total, 'total')
  for (const row of result.parcelas) for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value) && Math.abs(value) <= LIMITE_MONETARIO, key)
  }
}

test('F1: TLP ambígua ou exigível nunca executa capitalização no motor Finame', () => {
  for (const perfilTlp of [undefined, null, '', 'tlp', 'exigivel', 'TLPCAP']) {
    const result = simular({ ...base, custo: 'tlp', ipca: 10.29, perfilTlp })
    assert.equal(result.ok, false)
    assert.match(result.erros.join(' '), /TLP exigível.*TLPCAP/)
    assert.equal(result.parcelas, undefined)
  }
})

test('F1: exemplos separados confirmam TLPCAP e TLP exigível sem confundir caixa ou saldo', () => {
  const capitalizado = simular({ ...base, prazo: 24, carencia: 12, periodicidade: 3, custo: 'tlp', perfilTlp: 'tlpcap', custoFinanceiro: 8.12, taxaBndes: 1.25, taxaAgente: 2, ipca: 10.29 })
  verify(capitalizado)
  assert.equal(capitalizado.perfil, 'tlpcap')
  near(capitalizado.parcelas[2].pago, 2841.72)
  near(capitalizado.parcelas[2].saldo, 102478.80)
  // Cenário sintético com 63 DU = 1/4 do ano: equivalência apenas para comparar os perfis.
  const exigivel = simulateTlpExigivel({ mode: 'projection', principalCents: 10000000, releaseDate: '2026-10-15', j: { annualPct: '8.12', source: 'Hipótese sintética de teste', confirmed: true }, spreads: { bndes: '1.25', agent: '2' }, ipcaScenario: { annualPct: '10.29', acknowledged: true }, schedule: { source: 'Calendário sintético de teste', confirmed: true, events: [{ date: '2027-01-15', businessDays: 63, amortize: false }, { date: '2027-04-15', businessDays: 63, amortize: true }] } })
  assert.equal(exigivel.ok, true)
  assert.equal(exigivel.rows[0].paymentCents, 534389)
  assert.equal(exigivel.rows[0].closingCents, 10000000)
  assert.equal(exigivel.totals.closingCents, 0)
})

test('F2: carência retroativa cobre 5 e 7 meses, mensal/trimestral/semestral e extremos', () => {
  for (const [carencia, periodicidade, expected] of [
    [5, 3, [2, 5]], [7, 3, [1, 4, 7]], [5, 6, [5]], [7, 6, [1, 7]],
    [5, 1, [1, 2, 3, 4, 5]], [7, 1, [1, 2, 3, 4, 5, 6, 7]],
    [0, 3, []], [1, 6, [1]], [12, 6, [6, 12]], [24, 6, [6, 12, 18, 24]],
  ]) {
    const result = simular({ ...base, custo: 'tlp', perfilTlp: 'tlpcap', prazo: Math.max(12, carencia + 1), carencia, periodicidade, ipca: 0 })
    verify(result)
    assert.deepEqual(result.parcelas.filter(row => row.carencia && row.pago > 0).map(row => row.mes), expected)
    let previous = 0
    for (const month of expected) {
      const expectedInterest = base.valor * Math.expm1(Math.log1p(0.12) * (month - previous) / 12)
      near(result.parcelas[month - 1].pago, expectedInterest, `${carencia}/${periodicidade}/${month}`)
      previous = month
    }
  }
  const five = simular({ ...base, carencia: 5, periodicidade: 3 })
  near(five.parcelas[1].pago, 1906.76)
  near(five.parcelas[4].pago, 2873.73)
  assert.equal(simular({ ...base, carencia: 12 }).ok, false, 'Carência não pode ocupar todo o prazo')
})

test('F2: TLPCAP com IPCA tem carência retroativa e capitalização verificada mês a mês', () => {
  for (const carencia of [5, 7]) for (const periodicidade of [1, 3, 6]) {
    const result = simular({ ...base, prazo: 24, custo: 'tlp', perfilTlp: 'tlpcap', ipca: 10, carencia, periodicidade })
    verify(result)
    const dates = []; for (let month = carencia; month > 0; month -= periodicidade) dates.unshift(month)
    let balance = 100000, accrued = 0
    const monthly = 1.12 ** (1 / 12) - 1, correction = 1.1 ** (1 / 12)
    for (let month = 1; month <= carencia; month++) {
      balance *= correction; accrued += (balance + accrued) * monthly
      near(result.parcelas[month - 1].saldo, balance)
      near(result.parcelas[month - 1].pago, dates.includes(month) ? accrued : 0)
      if (dates.includes(month)) accrued = 0
    }
  }
})

test('F3: calendário real pela data da liberação, juros por dias corridos e sem memória contratual', () => {
  const source = readFileSync(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  assert.match(source, /id="fm-calendario-hipotetico">Calendário pela data da liberação: vencimento todo dia 15, ou no próximo dia útil/)
  assert.match(source, /<th scope="col">Vencimento<\/th><th scope="col">Saldo inicial<\/th>/)
  assert.match(source, /0 · liberação</)
  assert.match(source, /Não use como memória contratual/)
  assert.match(source, /diferenças de dias podem alterar os juros totais mesmo que a soma anual de dias úteis coincida/)
  assert.match(source, /dataLiberacao: hoje, feriados: holidayCtx/)
  assert.doesNotMatch(source, /a diferença se compensa|se compensam ao longo|Os juros ainda são calculados em meses iguais/)
  // Sem data, o motor programático continua no modelo legado; com data, usa o calendário real (ACT/ACT).
  assert.equal(simular(base).calendario, 'meses-iguais-hipoteticos')
  assert.equal(simular({ ...base, dataLiberacao: new Date(2026, 10, 11, 12) }).calendario, 'datas-reais-act-act')
})

test('F4: taxas zero e ínfimas Price fecham sem NaN, cancelamento ou juros negativos', () => {
  for (const rate of [0, 1e-300, 1e-16, 1e-13, 1e-12, 1e-8]) {
    const result = simular({ ...base, custoFinanceiro: rate, sistema: 'price' })
    verify(result)
    near(result.primeiraParcela, 100000 / 12)
    assert.ok(result.juros >= 0)
    if (rate > 0) { assert.ok(result.juros > 0); assert.ok(taxaFinal(rate, 0, 0) > 0) }
    assert.ok(result.parcelas.every(row => Math.abs(row.parcela - result.primeiraParcela) < 0.005))
  }
})

test('F4: infinitos, magnitude excessiva e enums inválidos bloqueiam sem fluxo parcial', () => {
  for (const change of [
    { valor: Infinity }, { valor: NaN }, { valor: -1 }, { valor: 1e308 }, { valor: '100000' }, { valor: LIMITE_MONETARIO + 1 },
    { participacao: Infinity }, { participacao: '100' }, { prazo: Infinity }, { carencia: NaN },
    { custo: 'lcd' }, { sistema: 'bullet' }, { periodicidade: 2 }, { periodicidade: '3' }, { composicao: 'outra' },
    { custoFinanceiro: Infinity }, { taxaAgente: NaN }, { taxaBndes: 101 },
    { iof: { fixed: 0, daily: 0, maxDays: Infinity } }, { iof: { fixed: 0, daily: 0, maxDays: -1 } },
    { valor: LIMITE_MONETARIO, custoFinanceiro: 100, prazo: 84 },
  ]) {
    const result = simular({ ...base, ...change })
    assert.equal(result.ok, false, JSON.stringify(change))
    assert.ok(result.erros.length)
    assert.equal(result.parcelas, undefined)
    assert.equal(result.total, undefined)
  }
  assert.throws(() => cronograma({ financiado: Infinity, prazo: 12, carencia: 0, taxaAnual: 12, sistema: 'price' }), RangeError)
  assert.throws(() => cronograma({ financiado: 100000, prazo: 12, carencia: 0, taxaAnual: 12, sistema: 'bullet' }), RangeError)
})

test('F4: 216 combinações mantêm finitude, principal, pagamentos e saldo; teto comercial só avisa', () => {
  for (const valor of [0.01, 100000, 150000001]) for (const sistema of ['price', 'sac']) for (const custoFinanceiro of [0, 1e-12, 12, 100]) for (const carencia of [0, 5, 7]) for (const ipca of [-50, 0, 100]) {
    verify(simular({ ...base, valor, prazo: 84, custo: 'tlp', perfilTlp: 'tlpcap', custoFinanceiro, ipca, carencia, periodicidade: 3, sistema }))
  }
  const warning = simular({ ...base, valor: 150000001 })
  verify(warning)
  assert.match(warning.avisos.join(' '), /R\$ 150 milhões/)
  const atLimit = simular({ ...base, valor: LIMITE_MONETARIO, custoFinanceiro: 0 })
  verify(atLimit)
  assert.equal(atLimit.total, LIMITE_MONETARIO)
})
