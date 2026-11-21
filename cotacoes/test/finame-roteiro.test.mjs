// BNDES Finame Materiais no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026).
// A tela só reordena e renomeia números que a conta já devolve; aqui fica provado que o que a linha do tempo conta
// (datas, carência, parcelas e quitação) bate com o fluxo da própria conta, em centavos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { simular } from '../src/finameMateriais.js'
import { simularPos } from '../src/finamePosFixado.js'
import { finameSimulationParams } from '../src/finameFunding.js'

const cents = value => Math.round(value * 100)
const soma = values => values.reduce((total, value) => total + value, 0)
const liberacao = new Date(2026, 10, 21, 12)
// Exemplo de abertura da tela: R$ 1.000.000,00, 48 meses, 3 de carência, juros trimestrais na carência, TAC de R$ 2.600,00.
const base = { valor: 1_000_000, participacao: 100, prazo: 48, carencia: 3, custo: 'tfc', custoFinanceiro: 14.1497, ipca: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3, tac: 2600, fgi: null, dataLiberacao: liberacao, feriados: {}, calendarios: ['BR'] }
const fixo = extra => simular(finameSimulationParams({ ...base, ...extra }))
const pos = (custo, extra = {}) => simularPos({ custo, valor: 1_000_000, participacao: 100, prazo: 48, carencia: 3, taxaFixa: 6, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 3, composicao: 'capitalizada', tac: 2600, fgi: null,
  trajetoria: custo === 'tfbd' ? [{ ano: 2026, valor: 5.5 }, { ano: 2027, valor: 5.6 }, { ano: 2028, valor: 5.7 }] : [{ ano: 2026, valor: 5 }, { ano: 2027, valor: 4.5 }, { ano: 2028, valor: 4 }],
  cambioInicial: custo === 'tfbd' ? 5.4 : null, dataLiberacao: liberacao, feriados: {}, calendarios: ['BR'], ...extra })

const cases = [
  ['TFC, exemplo de abertura', () => fixo({}), 48, 3],
  ['TFB sem carência', () => fixo({ custo: 'tfb', custoFinanceiro: 16.4869, carencia: 0 }), 48, 0],
  ['TFC com 80% financiado e juros mensais na carência', () => fixo({ valor: 1_234_567.89, participacao: 80, carencia: 12, periodicidade: 1 }), 48, 12],
  ['TFC com FGI e juros semestrais na carência', () => fixo({ prazo: 84, carencia: 12, periodicidade: 6, fgi: { percentual: 80, incorporar: false, periodos: 85 } }), 84, 12],
  ['TFC sem TAC, com uma parcela só', () => fixo({ prazo: 4, carencia: 3, tac: 0 }), 4, 3],
  ['TLP (pós-fixada)', () => pos('tlp'), 48, 3],
  ['Taxa LCD (pós-fixada)', () => pos('lcd', { taxaFixa: -0.11, carencia: 24 }), 48, 24],
  ['TFBD (dólar)', () => pos('tfbd', { carencia: 0 }), 48, 0],
]

for (const [name, run, prazo, carencia] of cases) test(`linha do tempo bate com o fluxo: ${name}`, () => {
  const r = run()
  assert.equal(r.ok, true)
  const naCarencia = r.parcelas.filter(p => p.carencia), pagas = r.parcelas.filter(p => !p.carencia)
  // Datas em ordem: liberação, vencimentos da carência, parcelas e quitação no último vencimento.
  const datas = r.parcelas.map(p => p.vencimento)
  assert.ok(datas.every(date => /^\d{4}-\d{2}-\d{2}$/.test(date)), 'todo vencimento tem data')
  assert.deepEqual(datas, [...datas].sort(), 'vencimentos em ordem')
  assert.ok(r.liberacao < datas[0], 'liberação antes do primeiro vencimento')
  // Carência: os meses combinados, sem amortização, e os juros do período são o que se paga nesses meses.
  assert.equal(naCarencia.length, carencia)
  assert.ok(naCarencia.every(p => p.amortizacao === 0))
  assert.equal(cents(soma(naCarencia.map(p => p.parcela))), cents(r.jurosCarencia))
  // Parcelas: prazo menos carência, mensais, da primeira à última do fluxo, com os valores que a tela mostra.
  assert.equal(r.parcelasAmortizacao, prazo - carencia)
  assert.equal(pagas.length, r.parcelasAmortizacao)
  assert.deepEqual(pagas, r.parcelas.slice(carencia), 'as parcelas vêm depois da carência, até o fim')
  assert.equal(cents(pagas[0].parcela), cents(r.primeiraParcela))
  assert.equal(cents(pagas.at(-1).parcela), cents(r.ultimaParcela))
  // Quitação: o saldo zera e o total é tudo o que o cliente paga, à vista (TAC, IOF e ECG do FGI) e nos vencimentos.
  assert.equal(cents(r.parcelas.at(-1).saldo), 0)
  const aVista = r.tac + r.iof + (r.fgi && !r.fgi.incorporado ? r.fgi.ecg : 0)
  assert.equal(cents(aVista + soma(r.parcelas.map(p => p.pago))), cents(r.total))
  // Nesta tela o IOF é zero e o ECG do FGI nunca é financiado: o valor financiado é o valor liberado.
  assert.equal(r.iof, 0)
  assert.equal(cents(r.financiado), cents(r.liberado))
})

test('exemplo de abertura da tela: R$ 1 milhão, 48 meses, 3 de carência, TFC de 14,1497% a.a.', () => {
  const r = fixo({})
  assert.deepEqual([r.liberado, r.jurosCarencia, r.primeiraParcela, r.ultimaParcela, r.juros, r.total].map(cents),
    [100000000, 4192827, 3568467, 2258602, 37812107, 138072107])
  assert.deepEqual([r.liberacao, r.parcelas[2].vencimento, r.parcelas[3].vencimento, r.parcelasAmortizacao], ['2026-11-21', '2027-02-15', '2027-03-15', 45])
  // Juros trimestrais na carência de 3 meses: um pagamento só, no fim do período.
  assert.deepEqual(r.parcelas.slice(0, 3).map(p => p.parcela > 0), [false, false, true])
})

test('a tela segue a ordem do roteiro e o histórico dos indexadores fecha a tela', async () => {
  const source = await readFile(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  const order = ["step(1, 'Demanda do cliente')", "step(2, 'Encargos')", '<LinhaDoTempo ', "step(4, 'Resultado · custo final para o cliente')",
    'id="fm-parcelas"', 'title="Memória completa do fluxo"', 'className="fm-premises"', 'title="Histórico dos indexadores"'].map(text => source.indexOf(text))
  assert.ok(order.every((at, k) => at > 0 && (k === 0 || at > order[k - 1])), `blocos na ordem do roteiro: ${order}`)
  const pieces = await readFile(new URL('../src/Roteiro.jsx', import.meta.url), 'utf8')
  assert.match(pieces, /LinhaDoTempo\(\{ id, number = 3, title = 'Linha do tempo da operação'/)
  // Demanda: data da liberação e praça ficam na gaveta "Detalhes do contrato"; porte e região continua à vista, fora dela.
  const gaveta = source.slice(source.indexOf('<details className="fm-contrato"'), source.indexOf('</details>', source.indexOf('<details className="fm-contrato"')))
  for (const campo of ["field('data-lib'", "field('praca'"]) assert.ok(gaveta.includes(campo), campo)
  assert.match(gaveta, /<summary>Detalhes do contrato<small> · liberação em /)
  assert.ok(source.indexOf("seg('porte'") < source.indexOf('<details className="fm-contrato"'), 'porte e região antes da gaveta')
  assert.ok(source.indexOf('<details className="fm-contrato"') < source.indexOf("step(2, 'Encargos')"), 'gaveta dentro da demanda')
  // Encargos mantêm os nomes do produto.
  for (const nome of ["field('custo', 'Custo financeiro'", "field('bndes', 'Taxa BNDES'", "field('agente', 'Spread do agente'", "field('tac', 'TAC (R$)'", "seg('per', 'Juros na carência'", '/>FGI Tradicional</label>', '/>Comparar com outro custo</label>']) {
    assert.ok(source.indexOf(nome) > source.indexOf("step(2, 'Encargos')") && source.indexOf(nome) < source.indexOf('<LinhaDoTempo '), nome)
  }
  // O resultado continua respondendo com os nomes que já usava.
  for (const linha of ['Valor financiado', 'Primeira parcela após carência', 'Última parcela', 'Custo total estimado', 'CET estimado']) assert.ok(source.includes(`<th scope="row">${linha}`), linha)
  // Referência de mercado desta tela: o histórico dos indexadores é o último bloco, e a tela não usa a referência comum.
  assert.match(source.slice(source.indexOf('title="Histórico dos indexadores"')), /<\/ExpandablePanel>\}\s*<\/section>\s*\)\s*\}\s*$/, 'nada depois do histórico')
  assert.doesNotMatch(source, /ReferenciaMercado/)
})
