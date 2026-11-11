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
