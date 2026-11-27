import test from 'node:test'
import { bndesEmlConteudo } from '../src/bndesEml.js'
import assert from 'node:assert/strict'
import { simular } from '../src/finameMateriais.js'
import { simularPos } from '../src/finamePosFixado.js'

const data = (mes, dia) => new Date(2026, mes - 1, dia, 12)
const base = { valor: 100000, prazo: 12, carencia: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3 }
const pre = p => simular({ ...base, custo: 'tfb', custoFinanceiro: 10, ...p })
const pos = p => simularPos({ ...base, custo: 'tlp', taxaFixa: 7, trajetoria: [{ ano: 2026, valor: 4 }, { ano: 2027, valor: 4 }], ...p })
for (const [nome, simular] of [['prefixado', pre], ['pós-fixado', pos]]) {
  test(`${nome}: formalização no dia 13 ou 14 mantém dezembro; 15 ou 27 desloca para janeiro`, () => {
    for (const dia of [13, 14, 15, 27]) {
      const r = simular({ dataLiberacao: data(11, dia), dataFormalizacao: data(11, dia) })
      assert.equal(r.ok, true, JSON.stringify(r.erros))
      assert.equal(r.parcelas[0].vencimento, dia < 15 ? '2026-12-15' : '2027-01-15')
    }
  })
  test(`${nome}: carência trimestral separa juros de amortização`, () => {
    const r = simular({ dataLiberacao: data(11, 27), dataFormalizacao: data(11, 27), carencia: 3 })
    assert.equal(r.ok, true, JSON.stringify(r.erros))
    assert.equal(r.parcelas.find(p => p.juros > 0).vencimento, '2027-03-15')
    assert.equal(r.parcelas.find(p => p.amortizacao > 0).vencimento, '2027-04-15')
  })
  test(`${nome}: formalização define os vencimentos e liberação define o início dos juros`, () => {
    const p = { dataFormalizacao: data(11, 13), dataLiberacao: data(11, 27) }
    const r = simular(p)
    const antes = simular({ ...p, dataLiberacao: data(11, 13) })
    assert.equal(r.ok, true, JSON.stringify(r.erros))
    assert.equal(r.parcelas[0].vencimento, '2026-12-15')
    assert.ok(r.parcelas[0].juros < antes.parcelas[0].juros)
    assert.ok(simular({ ...p, dataFormalizacao: data(11, 28) }).ok === false)
    assert.ok(simular({ ...p, dataLiberacao: data(12, 1) }).ok === false)
  })
}
test('CET prefixado recalcula sobre os dias reais das novas parcelas', () => {
  const r = pre({ dataLiberacao: data(11, 27), dataFormalizacao: data(11, 27), tac: 1800 })
  assert.equal(r.ok, true)
  assert.equal(r.parcelas[0].dias, 49)
  assert.ok(r.cet?.anual > 0)
  const residual = r.parcelas.reduce((total,p) => total + p.parcela / (1 + r.cet.anual / 100) ** (p.dias / 365), -r.cet.liquido)
  assert.ok(Math.abs(residual) < 0.001)
  assert.ok(Math.abs((1 + r.cet.mensal / 100) ** 12 - (1 + r.cet.anual / 100)) < 1e-10)
})


test('o e-mail da simulação usa as datas do fluxo corrigido', () => {
  const r = pre({ dataLiberacao: data(11, 27), dataFormalizacao: data(11, 27), carencia: 3 })
  const eml = bndesEmlConteudo({ itens: [{ ...r, custo: 'tfb', valor: 100000, prazo: 12, carencia: 3, formalizacao: '27/11/2026', liberacao: '27/11/2026', cet: r.cet.anual }] })
  assert.match(JSON.stringify(eml), /Formalização/)
  assert.match(JSON.stringify(eml), /15\/03\/2027/)
  assert.match(JSON.stringify(eml), /15\/04\/2027/)
  assert.doesNotMatch(JSON.stringify(eml), /15\/02\/2027/)
})


// Sugestão do Painel (27/11/2026): sem data de formalização (Comparador de Crédito, CET e impressão sem cronograma),
// a regra é a mesma da tela do BNDES com o campo em branco: formalização = liberação.
test('sem formalização, o 1º vencimento segue a liberação: até o dia 14, mês seguinte; do dia 15 em diante, dois meses à frente', async () => {
  const { vencimentoDia15, calendarioFiname } = await import('../src/finameMateriais.js')
  const d = (a, m, dia) => new Date(a, m - 1, dia, 12)
  const iso = x => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const casos = [
    [d(2026, 11, 1), '2026-12-15'], [d(2026, 11, 13), '2026-12-15'], [d(2026, 11, 14), '2026-12-15'],
    [d(2026, 11, 15), '2027-01-15'], [d(2026, 11, 27), '2027-01-15'], [d(2026, 11, 30), '2027-01-15'],
    [d(2026, 12, 14), '2027-01-15'], [d(2026, 12, 15), '2027-02-15'], [d(2026, 12, 31), '2027-02-15'],
    [d(2027, 1, 31), '2027-03-15'], [d(2027, 2, 28), '2027-04-15'], [d(2028, 2, 29), '2028-04-17'], // 15/04/2028 é sábado
  ]
  for (const [liberacao, primeiro] of casos) {
    assert.equal(iso(vencimentoDia15(liberacao, 1)), primeiro, iso(liberacao))
    assert.equal(calendarioFiname(liberacao, 2).datas[0], primeiro, iso(liberacao))
  }
  // Em branco e formalização = liberação dão o mesmo calendário, dia a dia, de 2026 a 2028.
  for (let t = d(2026, 1, 1); t < d(2029, 1, 1); t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 12)) {
    assert.deepEqual(calendarioFiname(t, 6), calendarioFiname(t, 6, {}, ['BR'], t), iso(t))
  }
})

test('Comparador de Crédito: a coluna do BNDES usa a mesma regra do 1º vencimento', async () => {
  const { evaluateColumn, newColumn, initialShared } = await import('../src/creditModalities.js')
  for (const [start, juros, amortiza] of [['2026-11-13', '2027-02-15', '2027-03-15'], ['2026-11-27', '2027-03-15', '2027-04-15']]) {
    const r = evaluateColumn({ ...newColumn('bndes'), bPeriod: '3' }, { ...initialShared(start), term: '24', grace: '3', system: 'price' })
    assert.ok(r.ok, r.error)
    // Juros trimestrais na carência de 3 meses: um pagamento de juros no 3º vencimento; amortização a partir do 4º.
    assert.deepEqual([r.rows[0].date, r.rows[1].date], [juros, amortiza], start)
  }
})
