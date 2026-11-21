// Necessidade do Cliente no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reordena e repete números que a conta já devolve. Aqui fica provado, chamando a conta de cada modalidade,
// que o que o quadro de respostas mostra fecha em centavos e que a linha do tempo da demanda bate com o cronograma apurado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { MODALITIES, evaluateAll, evaluateColumn, initialShared, newColumn } from '../src/creditModalities.js'
import { demandTimeline, followsDemand } from '../src/comparadorRoteiro.js'

const cents = value => Math.round(value * 100)
const br = iso => iso.split('-').reverse().join('/')
const daysBetween = (from, to) => (Date.parse(to) - Date.parse(from)) / 864e5
const shared = (extra = {}) => ({ ...initialShared('2026-11-21', '1.000.000,00'), ...extra })
const ctx = { cdi: 14.9 }

for (const { id, label } of MODALITIES) test(`respostas fecham em centavos: ${label}`, () => {
  const r = evaluateColumn({ ...newColumn(id), ...(id === 'finimp' ? { fDays: '180' } : {}), fees: '3.150,00', monthlyFees: '12,50' }, shared(), ctx)
  assert.equal(r.ok, true, r.error)
  // "Quanto custa", em reais: o que se paga menos o que entra no caixa.
  assert.equal(cents(r.cost), cents(r.paid) - cents(r.net))
  // "Quanto paga no total" = valor contratado + custo. No desconto de duplicata o total é o nominal dos títulos:
  // o custo já saiu na liberação, então total − líquido = custo.
  if (id === 'desconto') assert.equal(cents(r.total) - cents(r.net), cents(r.cost))
  else assert.equal(cents(r.total), cents(r.value) + cents(r.cost))
  // "Quanto entra no caixa" nunca passa do valor contratado; "Quanto paga por mês" é a primeira linha do cronograma.
  assert.ok(cents(r.net) <= cents(r.value) && r.net > 0)
  assert.equal(r.firstPayment, r.rows[0].payment)
  assert.equal(r.lastDate, r.rows.at(-1).date)
})

test('exemplo de abertura da tela: R$ 1 milhão, 24 meses, Price, prefixado a 1,45% a.m. e 100% do CDI + 0,35% a.m.', () => {
  const [pre, pos] = evaluateAll([newColumn('giro-pre'), newColumn('giro-cdi')], shared(), ctx)
  const answers = r => [r.net, r.firstPayment, r.total, r.cost].map(v => v.toFixed(2))
  assert.deepEqual(answers(pre), ['972343.78', '49756.95', '1221823.14', '221823.14'])
  assert.deepEqual(answers(pos), ['972347.19', '49940.08', '1226214.72', '226214.72'])
  assert.deepEqual([pre.cet, pos.cet, pos.projectedCost].map(v => (v * 100).toFixed(2)), ['22.60', '7.07', '23.07'])
})

const demands = [
  ['Price, 24 meses, sem carência', {}],
  ['SAC, 36 meses, 6 de carência', { system: 'sac', term: '36', grace: '6' }],
  ['Price, 12 meses, 11 de carência (uma parcela)', { term: '12', grace: '11' }],
  ['Bullet, 12 meses', { system: 'bullet', term: '12' }],
  ['liberação no fim do mês', { start: '2027-01-31', term: '13' }],
  ['praça com feriados locais e liberação no Natal', { praca: 'SP', start: '2026-12-25', term: '18', grace: '3' }],
]
for (const [name, extra] of demands) test(`linha do tempo da demanda bate com o cronograma da conta: ${name}`, () => {
  const demand = shared(extra), bullet = demand.system === 'bullet'
  const base = demandTimeline(demand)
  assert.ok(base, 'cronograma montado')
  assert.doesNotMatch(JSON.stringify(base), /R\$/, 'sem valores em reais')
  for (const column of [newColumn('giro-pre'), newColumn('giro-cdi')]) {
    assert.equal(followsDemand(column), true)
    const r = evaluateColumn(column, demand, ctx)
    assert.equal(r.ok, true, r.error)
    const paid = { first: r.rows[0].date, last: r.lastDate }
    const shown = demandTimeline(demand, paid)
    assert.deepEqual(shown.map(e => e.label), bullet ? ['Liberação', 'Vencimento único'] : ['Liberação', 'Carência', 'Parcelas', 'Quitação'])
    assert.equal(shown[0].when, br(demand.start))
    assert.equal(shown.at(-1).when, br(r.lastDate))
    if (!bullet) {
      const n = Number(demand.term) - Number(demand.grace)
      assert.equal(r.rows.length, n, 'parcelas = prazo − carência')
      assert.equal(shown[2].value, n === 1 ? '1 parcela' : `${n} parcelas mensais`)
      assert.equal(shown[1].when, `1ª parcela em ${br(r.rows[0].date)}`)
      assert.equal(shown[1].empty, Number(demand.grace) === 0)
    }
    // Sem operação de referência valem as datas do calendário: a conta só as adia até o próximo dia útil.
    const calendar = when => when.match(/\d{2}\/\d{2}\/\d{4}/)[0].split('/').reverse().join('-')
    for (const [expected, actual] of [[calendar(base[1].when), paid.first], [calendar(base.at(-1).when), paid.last]]) {
      const delay = daysBetween(expected, actual)
      assert.ok(delay >= 0 && delay <= 5, `${expected} → ${actual}`)
    }
  }
})

test('linha do tempo não aparece com demanda incompleta; coluna com condição própria não serve de referência', () => {
  for (const extra of [{ term: '' }, { grace: '24' }, { start: '' }]) assert.equal(demandTimeline(shared(extra)), null)
  assert.equal(followsDemand({ ...newColumn('giro-pre'), term: '12' }), false)
  assert.equal(followsDemand({ ...newColumn('giro-pre'), system: 'sac' }), false)
  assert.equal(followsDemand({ ...newColumn('giro-pre'), value: '300.000,00' }), true, 'valor próprio não muda as datas')
  for (const id of ['bndes', 'finimp', 'conta-garantida', 'desconto']) assert.equal(followsDemand(newColumn(id)), false, id)
})
