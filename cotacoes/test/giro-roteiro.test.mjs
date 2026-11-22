// Capital de Giro no roteiro Demanda, Encargos, Linha do tempo, Resultado (piloto de 21/11/2026).
// A tela só reparte e reordena números que a conta já devolve; aqui fica provado que as repartições fecham em centavos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { giroOperation } from '../src/creditComparison.js'

const cents = value => Math.round(value * 100)
const base = { value: 1000000, n: 24, rate: 2, unit: 'am', start: '2026-11-21', firstDue: '2026-12-21', calendars: ['BR'] }
const cases = [
  ['Price sem despesas', { system: 'price' }],
  ['SAC com despesas à vista', { system: 'sac', fees: 3150 }],
  ['Price com despesas financiadas', { system: 'price', financedFees: 5000 }],
  ['Price com IOF financiado', { system: 'price', financeIof: true, fees: 800, financedFees: 1200 }],
  ['Price com carência de 6 meses', { system: 'price', n: 18, firstDue: '2027-06-21', fees: 5000 }],
  ['Bullet', { system: 'bullet', n: 1, firstDue: '2028-11-21' }],
]

for (const [name, extra] of cases) test(`resultado fecha em centavos: ${name}`, () => {
  const r = giroOperation({ ...base, ...extra })
  assert.equal(r.ok, true)
  // "Do que é feito o custo": juros + IOF + despesas (à vista e financiadas) = custo total.
  assert.equal(cents(r.interest) + cents(r.iof) + cents(r.fees + r.financedFees), cents(r.cost))
  // "Quanto paga no total" = valor solicitado + custo total.
  assert.equal(cents(r.total), cents(r.value) + cents(r.cost))
  // Linha do tempo, liberação: valor solicitado menos o que é pago na liberação (despesas e IOF à vista) = líquido.
  assert.equal(cents(r.value) - cents(r.fees) - (r.financeIof ? 0 : cents(r.iof)), cents(r.net))
})

test('exemplo de abertura da tela: R$ 1 milhão, 24 meses, Price, 2% a.m.', () => {
  const r = giroOperation({ ...base, system: 'price' })
  assert.deepEqual([r.net, r.rows[0].payment, r.total, r.cost, r.interest, r.iof], [972057.48, 53046.05, 1301047.61, 301047.61, 273105.09, 27942.52])
  assert.equal(r.rows.at(-1).date, '2028-11-21')
})

test('carência entra na linha do tempo com os juros somados ao saldo', () => {
  const r = giroOperation({ ...base, system: 'price', n: 18, firstDue: '2027-06-21' })
  assert.ok(r.graceDays > 0 && r.capitalizedGrace > 0)
  assert.equal(giroOperation({ ...base, system: 'price' }).capitalizedGrace, 0)
})

test('a tela segue a ordem do roteiro e usa os nomes padrão dos encargos', async () => {
  const source = await readFile(new URL('../src/CapitalDeGiro.jsx', import.meta.url), 'utf8')
  // Ajustes de 21/11/2026: a linha do tempo saiu; o resultado (peça comum, que traz o título) passa a ser o bloco 3.
  const order = ["step(1, 'Demanda do cliente')", "step(2, 'Encargos')", '<Resultado id="giro-result-title" number={3} '].map(text => source.indexOf(text))
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), 'blocos na ordem 1 a 3')
  assert.doesNotMatch(source, /<LinhaDoTempo/)
  const pieces = await readFile(new URL('../src/Roteiro.jsx', import.meta.url), 'utf8')
  // Sem a linha do tempo nas sete calculadoras, a peça comum numera o resultado como bloco 3 e não tem mais a LinhaDoTempo.
  assert.match(pieces, /Resultado\(\{ id, number = 3, title = 'Resultado · custo final para o cliente'/)
  assert.doesNotMatch(pieces, /LinhaDoTempo/)
  assert.deepEqual([...source.matchAll(/\{ id: '(\w+)', label: '([^']+)' \},/g)].map(match => match[2]), ['IOF', 'Fee', 'TAC', 'Outros'])
  for (const question of ['Quanto entra no caixa', 'Quanto paga no total', 'Quanto custa']) assert.ok(source.includes(`'${question}'`), question)
  // "Quanto paga por mês" (mensal) ou por bimestre, trimestre, quadrimestre, semestre.
  assert.ok(source.includes('`Quanto paga por ${per}`') && source.includes("1: ['mensais', 'mês']"))
  assert.doesNotMatch(source, /Taxas, tributos e despesas|Condições do produto|Fee de estruturação|Outras despesas/)
})

test('a referência de mercado é o último bloco da tela e mostra a curva prefixada', async () => {
  const source = await readFile(new URL('../src/CapitalDeGiro.jsx', import.meta.url), 'utf8')
  const at = source.indexOf("<ReferenciaMercado tipos={['pre']} />")
  assert.ok(at > source.indexOf('Ver parcelas'), 'depois das parcelas')
  assert.match(source.slice(at), /^<ReferenciaMercado tipos=\{\['pre'\]\} \/>\s*<\/section>\s*\}\s*$/, 'nada depois dela')
})

test('textos de borda: parcela única e pagamento único não falam em "parcelas"', async () => {
  const source = await readFile(new URL('../src/CapitalDeGiro.jsx', import.meta.url), 'utf8')
  assert.match(source, /installments === 1 \? 'Parcela única' : `1ª de \$\{installments\} parcelas \$\{plural\}`/)
  assert.match(source, /const single = isBullet \|\| installments === 1 \? 'Pagamento único' : null/)
  // Com uma parcela só, a conta devolve um único pagamento: a nota não pode dizer "soma das parcelas".
  const one = giroOperation({ ...base, system: 'price', n: 1 })
  assert.equal(one.rows.length, 1)
})
