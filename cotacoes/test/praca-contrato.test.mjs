// Praça do contrato (feriados) nas calculadoras de crédito. Datas conferidas em src/holidays.js:
// 25/01 só na cidade de São Paulo (SP/SPC); 09/07 no estado de SP (SP/SPE); 15/08 em Belo Horizonte (MG) e Sorocaba;
// 08/12 em Belo Horizonte (MG) e Campinas (CPS), não em Curitiba (que tem 08/09); 20/11 é nacional desde 2024 (BR).
// Os valores esperados são recalculados aqui de forma independente (fórmula fechada), sem reaproveitar o motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { PRACAS_CONTRATO, PRACA_PADRAO, contractCalendars, pracaCalendars } from '../src/pracaContrato.js'
import { CALENDARS, nextBusinessDay } from '../src/holidays.js'
import { creditBusinessDays, creditOperation, giroOperation } from '../src/creditComparison.js'
import { simular, vencimentoDia15, calendarioFiname } from '../src/finameMateriais.js'
import { discountOperation, discountGiro, parseDiscountForm, DISCOUNT_INITIAL_FORM } from '../src/analiseDesconto.js'
import { evaluateColumn, initialShared, newColumn } from '../src/creditModalities.js'

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const civil = s => Date.parse(`${s}T00:00:00Z`) / 86400000
const daysBetween = (a, b) => civil(b) - civil(a)

test('lista de praças: padrão Nacional (BR), só calendários brasileiros já cadastrados e BR sempre incluído', () => {
  assert.equal(PRACA_PADRAO, 'BR')
  assert.equal(PRACAS_CONTRATO[0].label, 'Nacional (BR)')
  assert.deepEqual(pracaCalendars('BR'), ['BR'])
  const ids = new Set(CALENDARS.map(c => c.id))
  for (const p of PRACAS_CONTRATO) {
    assert.equal(p.calendars[0], 'BR', p.id)
    assert.ok(p.calendars.every(c => ids.has(c) && !['NY', 'UK', 'JP', 'CN'].includes(c)), p.id)
    assert.ok(p.label.length > 3)
  }
  assert.deepEqual(contractCalendars(['SP']), ['BR', 'SP'])
  assert.deepEqual(contractCalendars(['BR', 'SP', 'SP']), ['BR', 'SP'])
  assert.equal(contractCalendars(['NY']), null)
  assert.equal(contractCalendars(['XX']), null)
  assert.equal(contractCalendars('SP'), null)
  assert.deepEqual(pracaCalendars('inexistente'), ['BR'])
})

test('datas de referência: 25/01, 09/07, 15/08, 20/11 e 08/12 conforme o calendário de cada praça', () => {
  // 25/01/2027 é segunda-feira: só a capital paulista adia.
  assert.equal(nextBusinessDay('2027-01-25', pracaCalendars('BR')), '2027-01-25')
  assert.equal(nextBusinessDay('2027-01-25', pracaCalendars('SP')), '2027-01-26')
  assert.equal(nextBusinessDay('2027-01-25', pracaCalendars('SPE')), '2027-01-25')
  assert.equal(nextBusinessDay('2027-01-25', pracaCalendars('CPS')), '2027-01-25')
  // 09/07/2027 é sexta-feira: feriado estadual de SP, inclusive nas cidades do interior; segue para segunda, 12/07.
  for (const id of ['SP', 'SPE', 'CPS', 'SOR', 'BAR']) assert.equal(nextBusinessDay('2027-07-09', pracaCalendars(id)), '2027-07-12', id)
  for (const id of ['BR', 'MG', 'PR', 'LDA']) assert.equal(nextBusinessDay('2027-07-09', pracaCalendars(id)), '2027-07-09', id)
  // 20/11/2026 é sexta-feira e já é feriado nacional: todas as praças, inclusive a nacional, vão para 23/11.
  for (const p of PRACAS_CONTRATO) assert.equal(nextBusinessDay('2026-11-20', p.calendars), '2026-11-23', p.id)
  // 08/12/2026 é terça-feira: Belo Horizonte e Campinas adiam; Curitiba não tem 08/12 no calendário (tem 08/09).
  assert.equal(nextBusinessDay('2026-12-08', pracaCalendars('MG')), '2026-12-09')
  assert.equal(nextBusinessDay('2026-12-08', pracaCalendars('CPS')), '2026-12-09')
  assert.equal(nextBusinessDay('2026-12-08', pracaCalendars('PR')), '2026-12-08')
  assert.equal(nextBusinessDay('2026-09-08', pracaCalendars('PR')), '2026-09-09')
  assert.equal(nextBusinessDay('2026-09-08', pracaCalendars('BR')), '2026-09-08')
})

test('sem praça escolhida os resultados são os mesmos de antes (só feriados nacionais)', () => {
  const giro = { value: 100000, n: 12, rate: 2, unit: 'am', system: 'price', start: '2026-12-28', firstDue: '2027-01-25', fees: 500 }
  assert.deepEqual(giroOperation(giro), giroOperation({ ...giro, calendars: ['BR'] }))
  const cdi = { ...giro, rateType: 'cdi', cdi: 14.9, cdiPercent: 110, rate: 0.3 }
  assert.deepEqual(creditOperation(cdi), creditOperation({ ...cdi, calendars: ['BR'] }))
  assert.equal(creditBusinessDays('2026-01-01', '2027-12-31'), creditBusinessDays('2026-01-01', '2027-12-31', [], true, ['BR']))
  const finame = { valor: 100000, participacao: 100, prazo: 24, carencia: 6, custo: 'tfc', custoFinanceiro: 8, taxaBndes: 1.25, taxaAgente: 3, dataLiberacao: new Date(2028, 6, 20, 12) }
  assert.deepEqual(simular(finame), simular({ ...finame, calendarios: ['BR'] }))
  assert.equal(+vencimentoDia15(new Date(2028, 6, 20, 12), 1), +vencimentoDia15(new Date(2028, 6, 20, 12), 1, {}, ['BR']))
  const form = { ...DISCOUNT_INITIAL_FORM, titleFeeMode: 'total' }
  const semPraca = { ...form }
  delete semPraca.praca
  assert.deepEqual(parseDiscountForm(semPraca).result, parseDiscountForm(form).result)
  const shared = initialShared('2026-12-25')
  const sharedSemPraca = { ...shared }
  delete sharedSemPraca.praca
  for (const modality of ['giro-pre', 'giro-cdi', 'bndes', 'desconto']) {
    const col = newColumn(modality)
    assert.deepEqual(evaluateColumn(col, sharedSemPraca, { cdi: 14.9 }), evaluateColumn(col, shared, { cdi: 14.9 }), modality)
  }
})

test('Capital de Giro: com praça SP, o vencimento de 25/01 vai para 26/01 e juros, IOF e CET acompanham (recálculo independente)', () => {
  const base = { value: 100000, n: 1, rate: 2, unit: 'am', system: 'price', start: '2026-12-28', firstDue: '2027-01-25', fees: 0 }
  for (const [calendars, date] of [[['BR'], '2027-01-25'], [['BR', 'SP'], '2027-01-26']]) {
    const r = giroOperation({ ...base, calendars })
    assert.ok(r.ok, r.error)
    assert.equal(r.rows[0].date, date)
    const D = daysBetween(base.start, date)
    // Uma parcela: juros compostos por dias corridos, (1 + 2%)^(D/30).
    const payment = 100000 * 1.02 ** (D / 30)
    close(r.rows[0].payment, payment, 1e-6)
    // IOF: adicional sobre o valor + diário pelos dias até o pagamento (alíquotas da própria regra legal da data).
    const iof = 100000 * r.tax.additional / 100 + 100000 * Math.min(D, 365) * r.tax.daily / 100
    close(r.iof, iof, 1e-6)
    // CET de um pagamento: (pagamento / líquido)^(365/D) − 1.
    close(r.cet, (payment / (100000 - iof)) ** (365 / D) - 1, 1e-9)
  }
})

test('pós-fixado no CDI: o feriado da praça sai da contagem de dias úteis', () => {
  // Contagem independente: dias de 28/12/2026 (inclusive) a 01/02/2027 (exclusive), seg-sex, menos 01/01 (nacional) e 25/01 (SP).
  let weekdays = 0
  for (let d = civil('2026-12-28'); d < civil('2027-02-01'); d++) { const w = new Date(d * 86400000).getUTCDay(); if (w !== 0 && w !== 6) weekdays++ }
  const br = weekdays - 1, sp = weekdays - 2
  assert.equal(creditBusinessDays('2026-12-28', '2027-02-01'), br)
  assert.equal(creditBusinessDays('2026-12-28', '2027-02-01', [], true, ['BR', 'SP']), sp)
  // 25/01 + feriado extra informado (27/01): os dois saem.
  assert.equal(creditBusinessDays('2026-12-28', '2027-02-01', ['2027-01-27'], true, ['BR', 'SP']), sp - 1)
  // Bullet a 100% do CDI, spread zero, vencendo 01/02/2027 (segunda, dia útil nas duas praças): fator (1 + CDI)^(DU/252).
  const op = { value: 100000, n: 1, rate: 0, unit: 'am', system: 'bullet', start: '2026-12-28', firstDue: '2027-02-01', rateType: 'cdi', cdi: 15, cdiPercent: 100 }
  for (const [calendars, du] of [[['BR'], br], [['BR', 'SP'], sp]]) {
    const r = creditOperation({ ...op, calendars })
    assert.ok(r.ok, r.error)
    close(r.rows[0].payment, 100000 * 1.15 ** (du / 252), 1e-6)
  }
  // Feriado extra informado continua valendo para adiar o vencimento junto com a praça.
  const extra = creditOperation({ ...op, rateType: 'fixed', rate: 1, firstDue: '2027-01-25', holidays: ['2027-01-26'], calendars: ['BR', 'SP'] })
  assert.equal(extra.rows[0].date, '2027-01-27')
  assert.equal(creditOperation({ ...op, calendars: ['NY'] }).ok, false)
})

test('Finame: com praça Belo Horizonte, o dia 15/08/2028 (Assunção) vai para 16/08 e os juros contam um dia a mais', () => {
  const liberacao = new Date(2028, 6, 20, 12)
  assert.deepEqual(calendarioFiname(liberacao, 2, {}, ['BR', 'MG']).datas, ['2028-08-16', '2028-09-15'])
  assert.deepEqual(calendarioFiname(liberacao, 2).datas, ['2028-08-15', '2028-09-15'])
  const p = { valor: 100000, participacao: 100, prazo: 12, carencia: 0, custo: 'tfc', custoFinanceiro: 8, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 1, dataLiberacao: liberacao }
  const taxa = 1.08 * 1.0125 * 1.03 - 1 // composição capitalizada das três parcelas
  for (const [calendarios, venc, dias] of [[['BR'], '2028-08-15', 26], [['BR', 'MG'], '2028-08-16', 27], [['BR', 'SPE', 'SOR'], '2028-08-16', 27], [['BR', 'PR'], '2028-08-15', 26]]) {
    const r = simular({ ...p, calendarios })
    assert.ok(r.ok, r.erros?.join(' '))
    assert.equal(r.parcelas[0].vencimento, venc)
    assert.equal(r.parcelas[0].dias, dias)
    // Juros da 1ª parcela: saldo × ((1 + taxa)^(dias/366) − 1), ano bissexto de 2028.
    close(r.parcelas[0].juros, 100000 * ((1 + taxa) ** (dias / 366) - 1), 1e-6)
    close(r.parcelas[0].amortizacao, 100000 / 12, 1e-9)
  }
  assert.equal(simular({ ...p, calendarios: ['XX'] }).ok, false)
  assert.throws(() => vencimentoDia15(liberacao, 1, {}, ['XX']))
})

test('Análise de desconto: título de 25/01/2027 com praça SP é pago em 26/01, com juros e IOF de um dia a mais', () => {
  const op = { titleRows: [{ value: 100000, count: 1, dueDate: '2027-01-25' }], date: '2026-12-28', rate: 2, convention: 'commercial30', feeMode: 'total', fee: 0, tac: 0 }
  for (const [calendars, paid] of [[['BR'], '2027-01-25'], [['BR', 'SP'], '2027-01-26']]) {
    const r = discountOperation({ ...op, calendars })
    assert.ok(r.ok, r.error)
    assert.equal(r.rows[0].paymentDate, paid)
    const days = daysBetween(op.date, paid)
    const interest = 100000 * 0.02 * days / 30 // por fora, mês de 30 dias
    close(r.interest, interest, 1e-9)
    const baseIof = 100000 - interest
    close(r.iof, baseIof * r.tax.daily / 100 * Math.min(days, 365) + baseIof * r.tax.additional / 100, 1e-9)
    close(r.termCost, (100000 / r.net) ** (365 / days) - 1, 1e-9)
  }
  // O giro da comparação usa a mesma praça: liberação 25/12/2026, parcela de 25/01/2027 vai para 26/01 em SP.
  const giro = { principal: 100000, months: 12, rate: 1.83, tac: 0, date: '2026-12-25' }
  assert.equal(discountGiro(giro).schedule[0].dueDate, '2027-01-25')
  assert.equal(discountGiro({ ...giro, calendars: ['BR', 'SP'] }).schedule[0].dueDate, '2027-01-26')
  // Formulário: a praça escolhida chega aos títulos.
  const form = { ...DISCOUNT_INITIAL_FORM, titleFeeMode: 'total', date: '2026-12-28', titleRows: [{ value: '100.000,00', count: '1', dueDate: '2027-01-25' }] }
  assert.equal(parseDiscountForm({ ...form, praca: 'SP' }).operation.rows[0].paymentDate, '2027-01-26')
  assert.equal(parseDiscountForm({ ...form, praca: 'BR' }).operation.rows[0].paymentDate, '2027-01-25')
  assert.ok(parseDiscountForm({ ...form, praca: 'XX' }).errors.praca)
})

test('Comparador: a praça comum do topo adia giro, BNDES e desconto; FINIMP e Conta Garantida não mudam', () => {
  const shared = { ...initialShared('2026-12-25'), term: '12', system: 'price' }
  const giroBr = evaluateColumn(newColumn('giro-pre'), shared)
  const giroSp = evaluateColumn(newColumn('giro-pre'), { ...shared, praca: 'SP' })
  assert.equal(giroBr.rows[0].date, '2027-01-25')
  assert.equal(giroSp.rows[0].date, '2027-01-26')
  assert.ok(giroSp.cost > giroBr.cost, 'um dia a mais de juros')
  const cdiSp = evaluateColumn(newColumn('giro-cdi'), { ...shared, praca: 'SP' }, { cdi: 14.9 })
  assert.equal(cdiSp.rows[0].date, '2027-01-26')
  const bndesShared = { ...shared, start: '2028-07-20' }
  const bndesBr = evaluateColumn(newColumn('bndes'), bndesShared)
  const bndesMg = evaluateColumn(newColumn('bndes'), { ...bndesShared, praca: 'MG' })
  assert.equal(bndesBr.rows[0].date, '2028-08-15')
  assert.equal(bndesMg.rows[0].date, '2028-08-16')
  const desconto = { ...newColumn('desconto'), dDays: '31' } // 25/12/2026 + 31 dias = 25/01/2027
  assert.equal(evaluateColumn(desconto, shared).rows[0].date, '2027-01-25')
  assert.equal(evaluateColumn(desconto, { ...shared, praca: 'SP' }).rows[0].date, '2027-01-26')
  for (const modality of ['finimp', 'conta-garantida']) assert.deepEqual(evaluateColumn(newColumn(modality), { ...shared, praca: 'SP' }), evaluateColumn(newColumn(modality), shared), modality)
  assert.equal(evaluateColumn(newColumn('giro-pre'), { ...shared, praca: 'XX' }).ok, false)
})
