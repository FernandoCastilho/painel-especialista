import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { LCDCAP_PROFILE, lcdQuoteAt, parseLcdSchedule, simulateLcdCap } from '../src/bndesLcdCap.js'
const input = () => ({ mode: 'projection', principalCents: 100000000, contractDate: '2026-10-05', releaseDate: '2026-10-15', ld1: { annualPct: '0.5', fixingDate: '2026-10-01', source: 'Fixture sintético, não cotação oficial', confirmed: true }, spreads: { bndes: '1.25', intermediation: '0.25', agent: '3' }, selicScenario: { annualPct: '10', acknowledged: true }, schedule: { source: 'Cronograma sintético para testes', confirmed: true, events: [{ date: '2027-10-15', businessDays: 252, amortize: true }, { date: '2028-10-16', businessDays: 252, amortize: true }] } })
const blocked = (data, code) => { const result = simulateLcdCap(data); assert.equal(result.ok, false); assert.equal(result.error.code, code); assert.deepEqual(result.rows, []); assert.equal(result.totals, null); assert.equal(result.cet, null) }

test('projeção anual independente: Selic no saldo, remunerações + LCD somadas e exigíveis', () => {
  const result = simulateLcdCap(input()); assert.equal(result.ok, true)
  assert.equal(result.fixedAnnualPct, 5); assert.equal(result.status, 'projection-not-contract-validated')
  assert.deepEqual(result.rows.map(row => [row.openingCents, row.correctedCents, row.interestCents, row.amortizationCents, row.paymentCents, row.closingCents]), [[100000000, 110000000, 5500000, 55000000, 60500000, 55000000], [55000000, 60500000, 3025000, 60500000, 63525000, 0]])
  assert.deepEqual(result.totals, { principalCents: 100000000, capitalizedSelicCents: 15500000, interestCents: 8525000, amortizationCents: 115500000, paymentCents: 124025000, closingCents: 0 })
  // CET é só taxa derivada do fluxo; o cronograma e os totais acima continuam idênticos.
  assert.equal(typeof result.cet.fixedAnnualRate, 'number'); assert.equal(result.cet.netReleaseCents, 100000000)
})

test('carência capitaliza Selic, cobra apenas componente fixo, depois divide saldo atualizado', () => {
  const data = input(); data.schedule.events = [{ date: '2027-10-15', businessDays: 252, amortize: false }, { date: '2028-10-16', businessDays: 252, amortize: true }, { date: '2029-10-15', businessDays: 252, amortize: true }]
  const r = simulateLcdCap(data); assert.equal(r.ok, true)
  assert.equal(r.rows[0].amortizationCents, 0); assert.equal(r.rows[0].closingCents, 110000000); assert.equal(r.rows[0].paymentCents, 5500000)
  assert.equal(r.rows[1].amortizationCents, 60500000); assert.equal(r.rows[2].amortizationCents, 66550000)
})

test('fatores fracionários usam252, não365 e não multiplicam spreads', () => {
  const data = input(); data.schedule.events = [{ date: '2027-04-15', businessDays: 126, amortize: true }]
  const r = simulateLcdCap(data); assert.equal(r.ok, true)
  assert.ok(Math.abs(r.rows[0].selicFactor - Math.sqrt(1.1)) < 1e-14)
  assert.ok(Math.abs(r.rows[0].fixedFactor - Math.sqrt(1.05)) < 1e-14)
  assert.equal(r.rows[0].interestCents, Math.round(Math.round(100000000 * Math.sqrt(1.1)) * (Math.sqrt(1.05) - 1)))
})

test('zero é entrada válida quando explícita; não há custos inventados e CET zero', () => {
  const data = input(); data.selicScenario.annualPct = '0'; data.ld1.annualPct = '0'; data.spreads = { bndes: '0', intermediation: '0', agent: '0' }
  const r = simulateLcdCap(data); assert.equal(r.ok, true); assert.equal(r.totals.paymentCents, data.principalCents); assert.equal(r.totals.capitalizedSelicCents, 0)
  assert.ok(Math.abs(r.cet.fixedAnnualRate) < 1e-9); assert.ok(Math.abs(r.cet.projectedAnnualRate) < 1e-9); assert.equal(r.cet.releaseFeeCents, 0)
})

test('meio centavo conhecido na amortização tem arredondamento racional para cima', () => {
  const data = input(); data.principalCents = 101; data.selicScenario.annualPct = '0'; data.ld1.annualPct = '0'; data.spreads = { bndes: '0', intermediation: '0', agent: '0' }
  const r = simulateLcdCap(data); assert.equal(r.ok, true); assert.deepEqual(r.rows.map(row => row.amortizationCents), [51, 50])
})

test('143 é identificador de índice, não valor nem série SGS; LD1 permanece fixada', () => {
  assert.equal(LCDCAP_PROFILE.selicCode, '143'); assert.equal(LCDCAP_PROFILE.lcdCode, 'LD1')
  const data = input(); data.selicScenario.annualPct = '143'; blocked(data, 'INVALID_RATE')
  const normal = simulateLcdCap(input()); assert.equal(normal.rows[0].fixedFactor, normal.rows[1].fixedFactor)
})

test('precisão decimal das taxas evita soma binária no componente fixo', () => {
  const data = input(); data.ld1.annualPct = '0.1'; data.spreads = { bndes: '0.2', intermediation: '0', agent: '0' }
  assert.equal(simulateLcdCap(data).fixedAnnualPct, 0.3)
})

for (const [name, mutate, code] of [
  ['sem principal', d => { d.principalCents = null }, 'INVALID_MONEY'],
  ['principal fracionário em centavos', d => { d.principalCents = 1.1 }, 'INVALID_MONEY'],
  ['principal zero', d => { d.principalCents = 0 }, 'INVALID_MONEY'],
  ['principal infinito', d => { d.principalCents = Infinity }, 'INVALID_MONEY'],
  ['principal acima teto técnico', d => { d.principalCents = 1000000000001 }, 'INVALID_MONEY'],
  ['modo histórico sem série diária', d => { d.mode = 'historical' }, 'UNSUPPORTED_MODE'],
  ['taxa ausente', d => { d.spreads.agent = '' }, 'INVALID_RATE'],
  ['taxa nula', d => { d.spreads.agent = null }, 'INVALID_RATE'],
  ['taxa numérica em vez texto', d => { d.spreads.agent = 2 }, 'INVALID_RATE'],
  ['taxa negativa não suportada', d => { d.spreads.agent = '-1' }, 'INVALID_RATE'],
  ['taxa com sufixo', d => { d.spreads.agent = '2abc' }, 'INVALID_RATE'],
  ['taxa não finita textual', d => { d.spreads.agent = 'Infinity' }, 'INVALID_RATE'],
  ['taxa infinita', d => { d.spreads.agent = Infinity }, 'INVALID_RATE'],
  ['taxa com mais12casas', d => { d.spreads.agent = '0.1234567890123' }, 'INVALID_RATE'],
  ['remuneração ausente', d => { delete d.spreads.intermediation }, 'MISSING_SPREAD'],
  ['taxas acima teto técnico', d => { d.spreads.agent = '100' }, 'RATE_LIMIT'],
  ['LD1 não confirmada', d => { d.ld1.confirmed = false }, 'LCD_NOT_CONFIRMED'],
  ['LD1 sem fonte', d => { d.ld1.source = '' }, 'LCD_NOT_CONFIRMED'],
  ['LD1 posterior contratação', d => { d.ld1.fixingDate = '2026-10-06' }, 'LCD_FIXING_DATE'],
  ['cenário sem anuência', d => { d.selicScenario.acknowledged = false }, 'SCENARIO_NOT_CONFIRMED'],
  ['cronograma não confirmado', d => { d.schedule.confirmed = false }, 'SCHEDULE_NOT_CONFIRMED'],
  ['cronograma sem fonte', d => { d.schedule.source = '' }, 'SCHEDULE_NOT_CONFIRMED'],
  ['cronograma vazio', d => { d.schedule.events = [] }, 'MISSING_SCHEDULE'],
  ['apenas carência', d => { d.schedule.events.forEach(e => { e.amortize = false }) }, 'INCOMPLETE_SCHEDULE'],
  ['volta à carência', d => { d.schedule.events[1].amortize = false }, 'GRACE_AFTER_AMORTIZATION'],
  ['data inválida', d => { d.releaseDate = '2026-02-30' }, 'INVALID_DATE'],
  ['data sem ISO', d => { d.releaseDate = '15/10/2026' }, 'INVALID_DATE'],
  ['contratação depois liberação', d => { d.contractDate = '2026-10-16' }, 'DATE_ORDER'],
  ['evento antes liberação', d => { d.schedule.events[0].date = '2026-10-14' }, 'DATE_ORDER'],
  ['evento igual liberação', d => { d.schedule.events[0].date = d.releaseDate }, 'DATE_ORDER'],
  ['evento repetido', d => { d.schedule.events[1].date = d.schedule.events[0].date }, 'DATE_ORDER'],
  ['período maior400dias', d => { d.schedule.events[0].date = '2027-12-20' }, 'DATE_ORDER'],
  ['vencimento domingo', d => { d.schedule.events[0].date = '2027-10-17' }, 'NON_BUSINESS_DATE'],
  ['DU superior aos dias semanais', d => { d.schedule.events[0].businessDays = 300 }, 'INVALID_BUSINESS_DAYS'],
  ['DUzero', d => { d.schedule.events[0].businessDays = 0 }, 'INVALID_BUSINESS_DAYS'],
  ['DUfracionário', d => { d.schedule.events[0].businessDays = 1.5 }, 'INVALID_BUSINESS_DAYS'],
  ['DUmaior dias corridos', d => { d.schedule.events[0].businessDays = 366 }, 'INVALID_BUSINESS_DAYS'],
  ['evento booleano obrigatório', d => { d.schedule.events[0].amortize = 'A' }, 'INVALID_EVENT'],
  ['campo encargo ignorado proibido', d => { d.fee = 2200 }, 'UNSUPPORTED_FIELD'],
  ['campo IOF ignorado proibido', d => { d.schedule.events[0].iof = 0 }, 'UNSUPPORTED_FIELD'],
  ['tipo amortização não suportado', d => { d.amortizationMethod = 'price' }, 'UNSUPPORTED_FIELD'],
]) test(`bloqueio: ${name}`, () => { const d = input(); mutate(d); blocked(d, code) })

test('entrada inválida retorna erro estruturado, sem cronograma parcial', () => { blocked(null, 'MISSING_INPUT'); blocked([], 'MISSING_INPUT'); blocked({}, 'UNSUPPORTED_MODE') })

test('conservação em variadas taxas, prazos e centavos, sem duplicação de Selic', () => {
  for (const principalCents of [100001, 10000000, 300000000]) for (const annual of ['0', '7.25', '13.75']) for (const n of [1, 2, 12]) {
    const d = input(); d.principalCents = principalCents; d.selicScenario.annualPct = annual
    d.schedule.events = Array.from({ length: n }, (_, i) => ({ date: (() => { const day = new Date(Date.UTC(2026, 10 + i, 15)); while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10) })(), businessDays: 20, amortize: true }))
    const r = simulateLcdCap(d); assert.equal(r.ok, true)
    const t = r.totals
    assert.equal(t.amortizationCents, t.principalCents + t.capitalizedSelicCents)
    assert.equal(t.paymentCents, t.amortizationCents + t.interestCents)
    assert.equal(t.closingCents, 0)
    for (const row of r.rows) { assert.equal(row.paymentCents, row.amortizationCents + row.interestCents); assert.equal(row.correctedCents, row.closingCents + row.amortizationCents) }
  }
})

test('parse cronograma sem preencher ausências; rótulos explícitos C/A', () => {
  assert.deepEqual(parseLcdSchedule('2026-11-15;20;c\n2026-12-15;21;A').events, [{ date: '2026-11-15', businessDays: 20, amortize: false }, { date: '2026-12-15', businessDays: 21, amortize: true }])
  for (const value of ['', null, '2026-11-15;20', '2026-11-15;20;PRICE', '2026-11-15;;A', '2026-02-30;20;A', '2026-11-15;20;A;extra']) { assert.equal(parseLcdSchedule(value).ok, false); assert.deepEqual(parseLcdSchedule(value).events, []) }
})

test('referência LD1 requer fonte validada e data de vigência, não usa futuro ou dado ausente', () => {
  const data = { series: { LD1: { source: 'fonte sintética', sourceValidated: true, points: [['2026-07-01', 0.8], ['2026-10-01', 0], ['2027-01-01', 0.5]] } } }
  assert.equal(lcdQuoteAt(data, '2026-10-15', '2026-11-05').annualPct, '0')
  assert.equal(lcdQuoteAt(data, '2027-01-01', '2026-11-05'), null)
  assert.equal(lcdQuoteAt(data, '2026-04-15', '2026-11-05'), null)
  assert.equal(lcdQuoteAt(null, '2026-10-15', '2026-11-05'), null)
  assert.equal(lcdQuoteAt(data, '2026-02-30', '2026-11-05'), null)
  delete data.series.LD1.sourceValidated; assert.equal(lcdQuoteAt(data, '2026-10-15', '2026-11-05'), null)
})

test('UI mantém modalidade separada, estado sem dados, distinção de143 e projeção explícita', () => {
  const ui = readFileSync(new URL('../src/BndesLcdCap.jsx', import.meta.url), 'utf8')
  const calc = readFileSync(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(calc, /view === 'bndes-selic-lcd'/)
  assert.match(ui, /Dados ausentes não são tratados como zero/)
  assert.match(ui, /É um índice, não uma taxa de 143%/)
  assert.match(ui, /TLP exigível é uma modalidade diferente/)
  assert.match(ui, /Ver gráfico 143/); assert.match(ui, /Ver gráfico LD1/)
  assert.match(ui, /constante de Selic/); assert.match(ui, /não reprecificam este contrato/)
  assert.match(ui, /CET · parte fixa \(regra do BC\)/); assert.match(ui, /Custo com Selic projetada/)
  assert.match(ui, /Pelo art\. 5º, a Selic fica fora/); assert.doesNotMatch(ui, /não é CET/)
})

test('LD1 oficial negativa é preservada: −0,110000% com vigência01/10/2026', () => {
  const data = input(); data.ld1.annualPct = '-0.110000'; data.ld1.fixingDate = '2026-10-01'; data.ld1.source = 'Consulta oficial BNDES, verificada 05/11/2026'
  const result = simulateLcdCap(data); assert.equal(result.ok, true); assert.equal(result.fixedAnnualPct, 4.39)
  assert.equal(result.rows[0].interestCents, 4829000)
  assert.equal(result.rows[0].capitalizedSelicCents, 10000000, 'LD1 não altera a Selic capitalizada')
  const quote = lcdQuoteAt({ series: { LD1: { source: 'https://www.bndes.gov.br/moedas', sourceValidated: true, points: [['2026-10-01', -0.11]] } } }, '2026-10-05', '2026-11-05')
  assert.equal(quote.annualPct, '-0.11')
})

test('LD1 negativa não autoriza inferir tratamento de juros líquidos negativos', () => {
  const data = input(); data.ld1.annualPct = '-0.11'; data.spreads = { bndes: '0', intermediation: '0', agent: '0' }
  blocked(data, 'RATE_LIMIT')
  data.ld1.annualPct = '-100'; blocked(data, 'INVALID_RATE')
})

 test('LD1 seleciona última vigência publicada, inclusive início fora do trimestre', () => {
  const data = { series: { LD1: { source: 'https://www.bndes.gov.br/Moedas/umLD1.txt', sourceValidated: true, points: [['2025-02-01', -0.25], ['2025-04-01', -0.25], ['2025-09-01', -0.25], ['2025-10-01', -0.22]] } } }
  assert.equal(lcdQuoteAt(data, '2025-01-31', '2026-11-05'), null)
  assert.equal(lcdQuoteAt(data, '2025-03-15', '2026-11-05').date, '2025-02-01')
  assert.equal(lcdQuoteAt(data, '2025-09-30', '2026-11-05').date, '2025-09-01')
  assert.equal(lcdQuoteAt(data, '2025-10-01', '2026-11-05').annualPct, '-0.22')
 })

test('snapshot oficial datado preserva9 pontos negativos e outras séries; não confirma datas futuras', async () => {
  const { LCD_SNAPSHOT_POINTS, withOfficialLcdSnapshot } = await import('../src/lcdOfficialSnapshot.js')
  const original = { series: { 143: { points: [['2026-11-04', 4.3]] } }, stale: { 143: 12 } }
  const data = withOfficialLcdSnapshot(original)
  assert.equal(LCD_SNAPSHOT_POINTS.length, 9); assert.equal(data.series.LD1.points.at(-1)[1], -0.11)
  assert.deepEqual(data.series['143'], original.series['143']); assert.equal(original.series.LD1, undefined)
  assert.equal(data.series.LD1.automaticUpdate, false)
  assert.equal(lcdQuoteAt(data, '2026-11-05', '2026-12-01').annualPct, '-0.11')
  assert.equal(lcdQuoteAt(data, '2026-11-06', '2026-12-01'), null)
  assert.equal(lcdQuoteAt(data, '2025-01-31', '2026-11-05'), null)
})

test('UI LCD começa em IOF PJ geral, oferece zero com enquadramento confirmado e Simples/MEI com confirmação, e avisa que não verifica o enquadramento', () => {
  const ui = readFileSync(new URL('../src/BndesLcdCap.jsx', import.meta.url), 'utf8')
  assert.match(ui, /useState\('pj'\)/); assert.match(ui, /Decreto 8\.511\/2015/); assert.match(ui, /BNDES_PROFILE_IOF_OPTIONS/)
  assert.match(ui, /Confirmo a opção pelo Simples\/MEI/); assert.match(ui, /o painel não verifica/)
  assert.match(ui, /art\. 8º, IX/); assert.match(ui, /IOF na liberação/)
  assert.doesNotMatch(ui, /não há IOF nesta calculadora|Sem IOF/i)
})
