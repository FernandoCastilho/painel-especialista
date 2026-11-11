import test from 'node:test'
import assert from 'node:assert/strict'
import { simular, vencimentoDia15 } from '../src/finameMateriais.js'
import { finameCet, finameSimulationParams } from '../src/finameFunding.js'

// Liberação fixa para o teste não depender do dia em que roda.
const release = new Date(2026, 10, 11, 12)
const base = { valor: 500000, participacao: 100, prazo: 60, carencia: 12, custo: 'tfc', custoFinanceiro: 11, ipca: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3, tac: 0, fgi: null }
const run = (over = {}) => simular(finameSimulationParams({ ...base, ...over }))

// Oráculo independente: valor presente em (1 + i)^(dias/365) e bisseção própria, sem reaproveitar creditCet.
function oracle(result) {
  const ecg = result.fgi && !result.fgi.incorporado ? result.fgi.ecg : 0
  const net = result.liberado - result.iofFixo - result.tac - ecg
  const flows = result.parcelas.filter(p => p.pago > 0).map(p => [p.pago, (vencimentoDia15(release, p.mes) - release) / 86400000])
  const pv = i => flows.reduce((sum, [v, d]) => sum + v / Math.pow(1 + i, Math.round(d) / 365), 0)
  let lo = 0, hi = 5
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (pv(mid) > net) lo = mid; else hi = mid }
  return { annual: (lo + hi) / 2 * 100, net, pv }
}

test('CET estimado reconcilia o valor líquido com as parcelas, em dias corridos/365', () => {
  for (const over of [{}, { tac: 2600 }, { tac: 2600, fgi: { percentual: 80, incorporar: false, periodos: 60 } }, { custo: 'tfb', custoFinanceiro: 12.5, carencia: 0, periodicidade: 1 }, { prazo: 84, carencia: 12, periodicidade: 6, tac: 15000 }]) {
    const result = run(over)
    assert.ok(result.ok, JSON.stringify(over))
    const cet = finameCet(result, release)
    const ref = oracle(result)
    assert.ok(cet, JSON.stringify(over))
    assert.ok(Math.abs(cet.anual - ref.annual) < 1e-6, `${cet.anual} × ${ref.annual}`)
    assert.ok(Math.abs(ref.pv(cet.anual / 100) - ref.net) < 0.01, 'valor presente das parcelas = valor líquido')
    assert.equal(cet.liquido, ref.net)
    assert.ok(Math.abs(Math.pow(1 + cet.mensal / 100, 12) - (1 + cet.anual / 100)) < 1e-12, 'a.m. equivalente ao a.a.')
  }
})

test('CET sobe com TAC e ECG à vista e fica perto da taxa final sem encargos', () => {
  const plain = run(), withTac = run({ tac: 2600 }), withFgi = run({ tac: 2600, fgi: { percentual: 80, incorporar: false, periodos: 60 } })
  const [a, b, c] = [plain, withTac, withFgi].map(r => finameCet(r, release).anual)
  assert.ok(b > a && c > b, `${a} < ${b} < ${c}`)
  // Sem TAC, ECG ou IOF, só as datas reais (dia 15) separam o CET da taxa final: diferença pequena.
  assert.ok(Math.abs(a - plain.taxa) < 0.5, `${a} × ${plain.taxa}`)
  // Valor líquido: liberado menos TAC e ECG.
  assert.equal(finameCet(withFgi, release).liquido, withFgi.liberado - 2600 - withFgi.fgi.ecg)
})

test('CET mantém a ordem das taxas na comparação TFC × TFB', () => {
  const tfc = finameCet(run({ custo: 'tfc', custoFinanceiro: 10, tac: 2600 }), release)
  const tfb = finameCet(run({ custo: 'tfb', custoFinanceiro: 11, tac: 2600 }), release)
  assert.ok(tfb.anual > tfc.anual)
})

test('CET não é inventado sem resultado válido', () => {
  assert.equal(finameCet(null, release), null)
  assert.equal(finameCet({ ok: false }, release), null)
  assert.equal(finameCet(run(), new Date(Number.NaN)), null)
  // TAC maior que o valor liberado: não há valor líquido positivo, CET não mensurável.
  assert.equal(finameCet(run({ valor: 1000, tac: 2000 }), release), null)
})

// Regra aprovada por Fernando em 11/11/2026: juros pelos dias reais entre vencimentos (dia 15 ou próximo dia útil) e CET da Res. CMN 4.881.
const withDate = (date, over = {}) => run({ dataLiberacao: date, ...over })
const civil = iso => Date.parse(`${iso}T00:00:00Z`) / 86400000

test('com data de liberação, sem encargos e sem ano bissexto, o CET é igual à taxa final em qualquer dia', () => {
  for (const day of [1, 11, 15, 16, 28, 30]) {
    const date = new Date(2026, 10, day, 12)
    const result = withDate(date, { prazo: 12, carencia: 0, periodicidade: 1 })
    assert.equal(result.calendario, 'datas-reais-act-act')
    const cet = finameCet(result, date)
    assert.ok(Math.abs(cet.anual - result.taxa) < 1e-6, `${day}: ${cet.anual} × ${result.taxa}`)
  }
})

test('juros de cada período pelos dias corridos sobre o ano civil, vencimento no dia 15 ou próximo dia útil', () => {
  const date = new Date(2026, 10, 11, 12)
  const result = withDate(date, { prazo: 24, carencia: 6, periodicidade: 1 })
  const rate = result.taxa / 100
  // Recalcula cada período por conta própria: dias corridos, separados por ano civil (365 ou 366).
  const leap = y => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const fraction = (from, to) => { let f = 0; for (let d = civil(from) + 1; d <= civil(to); d++) f += 1 / (leap(new Date(d * 86400000).getUTCFullYear()) ? 366 : 365); return f }
  let previous = '2026-11-11', balance = 500000, accrued = 0
  for (const p of result.parcelas) {
    const due = new Date(`${p.vencimento}T12:00:00Z`)
    assert.ok(due.getUTCDay() !== 0 && due.getUTCDay() !== 6, `${p.vencimento} é dia útil`)
    assert.ok(due.getUTCDate() >= 15 && due.getUTCDate() <= 18, `${p.vencimento} é o dia 15 ou o próximo dia útil`)
    const factor = Math.pow(1 + rate, fraction(previous, p.vencimento)) - 1
    if (p.carencia) { accrued = (balance + accrued) * factor + accrued; assert.ok(Math.abs(p.juros - accrued) < 1e-6); accrued = 0 }
    else { assert.ok(Math.abs(p.juros - balance * factor) < 1e-6, `${p.mes}: ${p.juros} × ${balance * factor}`); balance -= p.amortizacao }
    previous = p.vencimento
  }
  // 15/05/2027 é sábado: o vencimento vai para segunda-feira, 17/05/2027.
  assert.equal(result.parcelas.find(p => p.vencimento.startsWith('2027-05')).vencimento, '2027-05-17')
})

test('mudar a data da liberação muda os juros, mas não cria CET abaixo da taxa sem encargos', () => {
  for (const day of [1, 14, 16, 30]) {
    const date = new Date(2026, 10, day, 12)
    const result = withDate(date, { prazo: 6, carencia: 0, periodicidade: 1 })
    assert.ok(finameCet(result, date).anual >= result.taxa - 1e-6)
  }
})
