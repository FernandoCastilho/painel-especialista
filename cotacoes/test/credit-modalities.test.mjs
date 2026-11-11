import test from 'node:test'
import assert from 'node:assert/strict'
import * as m from '../src/creditModalities.js'
import { creditOperation } from '../src/creditComparison.js'
import { finimpCost } from '../src/finimpComparison.js'
import { discountOperation } from '../src/analiseDesconto.js'
import { simular, IOF_ZERO } from '../src/finameMateriais.js'
import { simulateContaGarantida } from '../src/contaGarantida.js'

const shared = m.initialShared('2026-11-10')
const col = (modality, extra = {}) => ({ ...m.newColumn(modality), ...extra })
const run = (c, s = shared, ctx = { cdi: 12 }) => m.evaluateColumn(c, s, ctx)

test('toda modalidade devolve o formato comum com CET, líquido e fluxo', () => {
  for (const { id } of m.MODALITIES) {
    const r = run(col(id))
    assert.equal(r.ok, true, `${id}: ${r.error}`)
    assert.ok(r.net > 0 && r.rows.length > 0 && r.cet > 0, id)
    assert.ok(Math.abs(r.cost - (r.paid - r.net)) < 1e-6, id)
    // Desconto já paga o nominal (juros e IOF saem dele na liberação); nas demais o que sai da liberação soma ao total.
    assert.ok(Math.abs(r.total - (id === 'desconto' ? r.paid : r.paid + r.value - r.net)) < 1e-6, id)
    assert.equal(r.rows.at(-1).date, r.lastDate)
  }
})
test('Giro prefixado repete o motor do Capital de Giro', () => {
  const r = run(col('giro-pre'))
  const base = creditOperation({ value: 500000, n: 24, rate: 1.45, unit: 'am', system: 'price', start: '2026-11-10', firstDue: '2026-12-10', profile: 'pj', eligible: false, rateType: 'fixed', cdi: 0, cdiPercent: 100, fees: 0, monthlyFees: 0, holidays: [], guaranteeValue: null })
  assert.equal(r.net, base.net); assert.equal(r.cet, base.cet); assert.equal(r.cost, base.cost)
})
test('Giro pós-CDI exige CDI e reage ao cenário', () => {
  const c = col('giro-cdi')
  assert.equal(run(c, shared, { cdi: NaN }).ok, false)
  assert.ok(run(c, shared, { cdi: 14 }).cost > run(c, shared, { cdi: 12 }).cost)
})
test('carência e prazo comuns chegam a cada coluna; Bullet usa vencimento único', () => {
  const grace = run(col('giro-pre'), { ...shared, grace: '6' })
  assert.equal(grace.rows.length, 18); assert.ok(grace.graceNote.includes('capitalizada'))
  const bullet = run(col('giro-pre'), { ...shared, system: 'bullet' })
  assert.equal(bullet.rows.length, 1); assert.equal(bullet.rows[0].date, '2028-11-10')
  assert.equal(run(col('giro-pre'), { ...shared, grace: '24' }).ok, false)
})
test('campo próprio da coluna prevalece sobre o comum', () => {
  const r = run(col('giro-pre', { value: '100.000,00', term: '12' }))
  assert.equal(r.value, 100000); assert.equal(r.rows.length, 12)
})
test('BNDES repete o motor BNDES, com os limites de prazo e carência', () => {
  const c = col('bndes'), r = run(c)
  const sim = simular({ valor: 500000, participacao: 100, prazo: 24, carencia: 0, custo: 'tfb', custoFinanceiro: 10, taxaBndes: 1.25, taxaAgente: 3, sistema: 'price', periodicidade: 1, composicao: 'capitalizada', iof: IOF_ZERO, tac: 0, dataLiberacao: new Date('2026-11-10T12:00:00'), feriados: {} })
  // Mesmo calendário real do BNDES: vencimentos dia 15 ou próximo dia útil e juros por dias corridos.
  assert.equal(sim.calendario, 'datas-reais-act-act')
  assert.ok(Math.abs(r.paid - sim.parcelas.reduce((s, p) => s + p.parcela, 0)) < 1e-6)
  assert.equal(r.interest, sim.juros + sim.correcao)
  assert.equal(run(c, { ...shared, system: 'bullet' }).ok, false)
  assert.match(run(c, { ...shared, grace: '18' }).error, /Carência acima/)
  assert.match(run(c, { ...shared, term: '96' }).error, /máximo/)
  const tac = run(col('bndes', { bTac: '1.000,00' }))
  assert.equal(tac.net, 499000)
  assert.ok(run(col('bndes', { bIof: 'pj' })).iof > 0)
  assert.equal(run(col('bndes', { bFgi: '80' })).ok, true)
  // FGI Tradicional (Circular SUP/ADIG 62/2026): múltiplos de 10, limite de R$ 20 milhões e vedação à TLP capitalizada
  assert.match(run(col('bndes', { bFgi: '75' })).error, /múltiplos de 10/)
  assert.match(run(col('bndes', { bLine: 'tlp', bFgi: '80' })).error, /Retire a garantia do FGI: esta linha usa TLP capitalizada/)
  assert.match(run(col('bndes', { bFgi: '80' }), { ...shared, value: '25.000.000,00' }).error, /limitado a R\$\s*20\.000\.000,00 por cliente/)
  assert.equal(run(col('bndes'), { ...shared, value: '25.000.000,00' }).ok, true)
  // Art. 7º, I: FGI só para MEI, micro, pequena e média empresa
  assert.match(run(col('bndes', { bPorte: 'grande', bFgi: '80' })).error, /Retire a garantia do FGI: ela atende micro, pequenas e médias empresas/)
  assert.equal(run(col('bndes', { bPorte: 'grande' })).ok, true)
  assert.equal(run(col('bndes', { bPorte: 'mpme-nne', bFgi: '80' })).ok, true)
  assert.equal(run(col('bndes', { bLine: 'tlp' })).ok, true)
})
test('BNDES com carência paga juros e mantém o fluxo datado', () => {
  const r = run(col('bndes', { bPeriod: '6' }), { ...shared, grace: '6' })
  assert.equal(r.ok, true); assert.ok(r.graceNote.includes('juros pagos'))
  // Juros da carência pagos no 6º mês: 15/05/2027 é sábado, vence na segunda, 17/05/2027 (188 dias da liberação).
  assert.equal(r.rows[0].date, '2027-05-17'); assert.equal(r.rows[0].days, 188)
})
test('FINIMP repete a conta da calculadora e exige moeda, câmbio e prazo válidos', () => {
  const r = run(col('finimp')), base = finimpCost({ principal: 500000, annualRate: 6, flatRate: 0.5, tac: 0, days: 180 })
  assert.ok(Math.abs(r.cost - base.cost) < 1e-6)
  assert.equal(r.net, 500000 - base.flat); assert.equal(r.interest, base.interest)
  assert.equal(r.iof, 0)
  assert.equal(run(col('finimp', { fFx: '' })).ok, false)
  assert.equal(run(col('finimp', { fCurrency: 'BRL', fFx: '' })).ok, true)
  assert.equal(run(col('finimp', { fDays: 'auto' })).ok, false)
  assert.equal(run(col('finimp', { fDays: 'auto' }), { ...shared, term: '6' }).rows[0].days, 180)
})
test('Conta Garantida repete juros e IOF do simulador de saldo', () => {
  const r = run(col('conta-garantida', { cDays: '30' }))
  const base = simulateContaGarantida({ start: '2026-11-10', end: '2026-12-10', rate: 2, rateBase: 30, conversion: 'proportional', dayCount: 'calendar', events: [{ date: '2026-11-10', draw: 500000, payment: 0 }], settleAllAtEnd: true, taxProfile: 'pj', eligible: false, operationValue: 500000 })
  assert.ok(Math.abs(r.interest - base.totals.interest) < 1e-6); assert.ok(Math.abs(r.iof - base.totals.iof) < 1e-6)
  assert.equal(r.net, 500000)
  assert.equal(run(col('conta-garantida', { cDays: '0' })).ok, false)
})
test('Desconto de duplicata repete a conta do desconto', () => {
  const r = run(col('desconto', { dDays: '60', dTac: '260,00', dFee: '564' }))
  const base = discountOperation({ titleRows: [{ value: 500000, count: 1, dueDate: '2027-01-09' }], date: '2026-11-10', rate: 1.83, convention: 'commercial30', taxProfile: 'pj', eligible: false, feeMode: 'total', fee: 564, tac: 260 })
  assert.equal(r.net, base.net); assert.ok(Math.abs(r.cost - base.cost) < 1e-6)
  assert.ok(Math.abs(r.fees - (base.tac + base.titleFee)) < 1e-9)
})
test('mesmo valor líquido: todas as colunas fecham no líquido comum', () => {
  for (const { id } of m.MODALITIES) {
    const r = run(col(id), shared, { cdi: 12, targetNet: 300000 })
    assert.equal(r.ok, true, `${id}: ${r.error}`)
    assert.ok(Math.abs(r.net - 300000) < 0.011, id)
  }
  assert.equal(run(col('giro-pre'), shared, { cdi: 12, targetNet: -1 }).ok, false)
})
test('destaques só apontam menores valores, sem vencedor absoluto', () => {
  const results = m.evaluateAll([col('giro-pre'), col('bndes'), col('finimp')], shared, { cdi: 12 })
  const h = m.highlights(results)
  assert.equal(results[h.lowestCet].cet, Math.min(...results.map(r => r.cet)))
  assert.equal(results[h.lowestCost].cost, Math.min(...results.map(r => r.cost)))
  assert.equal(m.highlights([results[0]]).lowestCet, null)
})
test('Outra modalidade aceita nome, indexador livre e CET informado', () => {
  const r = run(col('outra', { name: 'Cédula', declaredCet: '20' }))
  assert.equal(r.label, 'Cédula'); assert.equal(r.declaredCet, 20)
  assert.equal(run(col('outra', { rateType: 'cdi' }), shared, { cdi: NaN }).ok, false)
})
test('valores inválidos viram erro em vez de número', () => {
  assert.equal(run(col('giro-pre'), { ...shared, value: '' }).ok, false)
  assert.equal(run(col('giro-pre', { guaranteeValue: 'abc' })).ok, false)
  assert.equal(run(col('giro-pre'), { ...shared, start: '2024-01-01' }).ok, false)
})
test('Desconto: total desembolsado é o nominal pago, sem repetir juros e IOF', () => {
  const r = run(col('desconto', { dDays: '60' }), { ...shared, value: '100.000,00' })
  assert.equal(r.total, 100000); assert.ok(Math.abs(r.cost - (r.total - r.net)) < 1e-6)
})
test('modalidades de pagamento único avisam que carência e amortização comuns não se aplicam', () => {
  for (const id of ['finimp', 'conta-garantida', 'desconto']) assert.ok(run(col(id), { ...shared, grace: '6' }).notes.some(n => n.includes('não se aplicam')), id)
})
test('Giro pós-CDI mostra CET da parte fixa (regra do BC) e custo com CDI projetado; prefixado coincide', () => {
  const cdi = run(col('giro-cdi'), shared, { cdi: 14.9 }), pre = run(col('giro-pre'))
  assert.equal(cdi.floating, true); assert.equal(pre.floating, false)
  assert.equal(pre.cet, pre.projectedCost)
  // CET regulatório = mesmo contrato com CDI zero (só o spread de 0,35% a.m.), pelo motor do Capital de Giro.
  const fixed = creditOperation({ value: 500000, n: 24, rate: 0.35, unit: 'am', system: 'price', start: '2026-11-10', firstDue: '2026-12-10', profile: 'pj', eligible: false, rateType: 'cdi', cdi: 0, cdiPercent: 100, fees: 0, monthlyFees: 0, holidays: [], guaranteeValue: null })
  assert.equal(cdi.cet, fixed.cet)
  // Custo projetado: taxa que iguala o líquido ao fluxo com CDI de 14,9% (dias corridos/365), conferida à parte.
  const pv = rate => cdi.rows.reduce((s, r) => s + r.payment / (1 + rate) ** (r.days / 365), 0)
  assert.ok(Math.abs(pv(cdi.projectedCost) - cdi.net) < 1e-4)
  assert.ok(cdi.projectedCost > cdi.cet)
  // O cenário do CDI muda o custo projetado, não o CET regulatório.
  const high = run(col('giro-cdi'), shared, { cdi: 16.9 })
  assert.equal(high.cet, cdi.cet); assert.ok(high.projectedCost > cdi.projectedCost)
  assert.ok(cdi.notes.some(n => n.includes('CDI zero')))
})
test('menor CET entre colunas usa o CET regulatório, não o custo com CDI projetado', () => {
  // Prefixado a 1,10% a.m. fica entre o CET da parte fixa do pós-CDI e o custo com CDI projetado.
  const results = m.evaluateAll([col('giro-pre', { rate: '1,10' }), col('giro-cdi')], shared, { cdi: 14.9 })
  assert.ok(results[1].cet < results[0].cet && results[0].cet < results[1].projectedCost)
  assert.equal(m.highlights(results).lowestCet, 1)
})

test('coluna BNDES dá o mesmo CET da calculadora BNDES, com ECG contado pelas datas', async () => {
  const { periodos30Datas, vencimentoDia15 } = await import('../src/finameMateriais.js')
  const r = run(col('bndes', { bFgi: '80', bTac: '2.600,00' }))
  assert.equal(r.ok, true, r.error)
  const release = new Date('2026-11-10T12:00:00')
  const periods = periodos30Datas(release, vencimentoDia15(release, 24))
  const sim = simular({ valor: 500000, participacao: 100, prazo: 24, carencia: 0, custo: 'tfb', custoFinanceiro: 10, taxaBndes: 1.25, taxaAgente: 3, sistema: 'price', periodicidade: 1, composicao: 'capitalizada', iof: IOF_ZERO, tac: 2600, fgi: { percentual: 80, incorporar: false, periodos: periods }, dataLiberacao: release, feriados: {} })
  assert.ok(Math.abs(r.cet * 100 - sim.cet.anual) < 1e-6, `${r.cet * 100} × ${sim.cet.anual}`)
})

test('CET acima de 1.000% a.a. é não mensurável, sem número absurdo', async () => {
  const { creditCet } = await import('../src/creditComparison.js')
  assert.equal(creditCet(1, [{ days: 30, payment: 100000 }]), null)
  assert.ok(creditCet(90000, [{ days: 365, payment: 100000 }]) > 0.11)
})

test('revisão final: Comparador igual às telas próprias (TLP sem IPCA no CET, desconto em dia útil, conta garantida pelo art. 6º)', async () => {
  // TLP capitalizada: o CET (art. 5º) não muda com o IPCA projetado; o custo com IPCA muda.
  const tlp = ipca => run(col('bndes', { bLine: 'tlp', bIpca: ipca }))
  const [a, b] = [tlp('0'), tlp('10')]
  assert.equal(a.ok && b.ok, true, a.error || b.error)
  assert.ok(Math.abs(a.cet - b.cet) < 1e-12); assert.ok(b.projectedCost > a.projectedCost)
  assert.equal(b.projectedLabel, 'Custo com IPCA projetado')
  // Desconto: o nominal sai na data ajustada ao dia útil, igual à Análise de desconto.
  const d = run(col('desconto'))
  const own = discountOperation({ titleRows: [{ value: 500000, count: 1, dueDate: d.rows[0].date }], date: '2026-11-10', rate: 1.75, convention: 'commercial30', taxProfile: 'pj', eligible: false, feeMode: 'percent', fee: 0, tac: 0 })
  assert.equal(d.rows[0].date, own.rows[0].paymentDate)
  // Conta garantida: CET de 30 dias sobre o limite, independente do prazo de uso.
  const { contaGarantidaCet } = await import('../src/contaGarantida.js')
  const short = run(col('conta-garantida', { cDays: '30' })), long = run(col('conta-garantida', { cDays: '360' }))
  assert.ok(Math.abs(short.cet - long.cet) < 1e-12)
  const ref = contaGarantidaCet({ limit: 500000, start: '2026-11-10', rate: 2, rateBase: 30, conversion: 'proportional', dayCount: 'calendar', holidays: [], taxProfile: 'pj', eligible: false, operationValue: 500000 })
  assert.ok(Math.abs(long.cet - ref.annual) < 1e-12)
})
