// Finame BK · Máquinas e equipamentos e Brasil Soberano · Bens de capital (26/11/2026): mesma conta do Finame Materiais, com as regras
// de cada produto. Os cenários são conferidos por fórmula fechada, sem o motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REGRAS, REGRAS_BK, REGRAS_SOBERANO, CUSTOS_EXTRAS, regrasFiname, conferir, simular } from '../src/finameMateriais.js'
import { simularPos } from '../src/finamePosFixado.js'
import { finameFundingOptionsDo, finameFundingOption, siglaCusto, compareFinamePair } from '../src/finameFunding.js'
import { PERFIS_PAINEL, avaliarCusto, produtoBndes } from '../src/bndesCustosPorProduto.js'

const perto = (a, b, tol = 0.01, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ${b}, obtido ${a}`)
const mensal = (aa) => (1 + aa / 100) ** (1 / 12) - 1
const SEM_IOF = { fixed: 0, daily: 0 }
const BK = { produto: 'bk-maquinas' }
const SOB = { produto: 'brasil-soberano-bk' }

test('regras do Finame BK: 120 meses, carência de 24 (12 com TFB), BNDES 0,75 N/NE e 0,95 nas demais regiões', () => {
  assert.equal(regrasFiname('bk-maquinas'), REGRAS_BK)
  assert.equal(REGRAS_BK.prazoMaxMeses, 120); assert.equal(REGRAS_BK.carenciaMaxMeses, 24); assert.equal(REGRAS_BK.carenciaMaxTfbMeses, 12)
  assert.deepEqual(REGRAS_BK.taxaBndes, { 'mpme-nne': 0.75, mpme: 0.95, grande: 0.95 })
  assert.equal(REGRAS_BK.tetoOperacao, null); assert.equal(REGRAS_BK.tetoCliente12m, null)
  const base = { valor: 1e6, participacao: 100, carencia: 0, ...BK }
  assert.deepEqual(conferir({ ...base, prazo: 120, carencia: 24, custo: 'pre5' }).erros, [])
  assert.deepEqual(conferir({ ...base, prazo: 120, carencia: 24, custo: 'pre3' }).erros, [])
  assert.match(conferir({ ...base, prazo: 120, carencia: 13, custo: 'tfb' }).erros[0], /12 meses com TFB \(1 ano\)/)
  assert.match(conferir({ ...base, prazo: 120, carencia: 25, custo: 'pre5' }).erros[0], /24 meses \(2 anos\)/)
  assert.match(conferir({ ...base, prazo: 121, custo: 'tfb' }).erros[0], /120 meses \(10 anos\)/)
  // A TFC não é aceita para máquinas; o Materiais continua recusando os custos novos.
  assert.match(conferir({ ...base, prazo: 60, custo: 'tfc' }).erros[0], /aceito em Finame BK/)
  assert.match(conferir({ valor: 1e6, participacao: 100, prazo: 60, carencia: 0, custo: 'pre5' }).erros[0], /TFC, TFB ou TLPCAP/)
  assert.equal(conferir({ ...base, valor: 300e6, prazo: 60, custo: 'tfb' }).avisos.length, 0)
})

test('regras do Brasil Soberano: 60 meses, carência de 12, BNDES 1,5%, custo fixo 8% ou 3%, agente até 5%', () => {
  assert.equal(regrasFiname('brasil-soberano-bk'), REGRAS_SOBERANO)
  assert.equal(REGRAS_SOBERANO.prazoMaxMeses, 60); assert.equal(REGRAS_SOBERANO.carenciaMaxMeses, 12)
  assert.deepEqual(REGRAS_SOBERANO.taxaBndes, { 'mpme-nne': 1.5, mpme: 1.5, grande: 1.5 })
  assert.deepEqual(REGRAS_SOBERANO.custoFixo, { demais: 8, ait: 3 })
  assert.equal(REGRAS_SOBERANO.taxaAgenteMax, 5)
  const base = { valor: 1e6, participacao: 100, custo: 'cf', ...SOB }
  // O protocolo sempre aparece como aviso.
  assert.deepEqual(conferir({ ...base, prazo: 60, carencia: 12 }).erros, [])
  assert.match(conferir({ ...base, prazo: 60, carencia: 12 }).avisos.join(' '), /11\/11\/2026/)
  assert.match(conferir({ ...base, prazo: 61, carencia: 0 }).erros[0], /60 meses \(5 anos\)/)
  assert.match(conferir({ ...base, prazo: 60, carencia: 13 }).erros[0], /12 meses \(1 ano\)/)
  assert.match(conferir({ ...base, prazo: 60, carencia: 0, custo: 'tfb' }).erros[0], /aceito em Brasil Soberano/)
  assert.match(conferir({ ...base, valor: 51e6, prazo: 60, carencia: 0 }).avisos.join(' '), /R\$ 50 milhões/)
  assert.doesNotMatch(conferir({ ...base, valor: 50e6, prazo: 60, carencia: 0 }).avisos.join(' '), /R\$ 50 milhões/)
})

test('Brasil Soberano: agente acima de 5%, juros mensais na carência e custo fixo fora do programa', () => {
  const op = { valor: 2e6, participacao: 100, prazo: 60, carencia: 12, custo: 'cf', custoFinanceiro: 8, taxaBndes: 1.5, taxaAgente: 5, sistema: 'sac', periodicidade: 3, iof: SEM_IOF, ...SOB }
  assert.ok(simular(op).ok)
  assert.match(simular({ ...op, taxaAgente: 5.01 }).erros.join(' '), /acima de 5% a\.a\..*5\.336/)
  assert.match(simular({ ...op, periodicidade: 1 }).erros.join(' '), /trimestrais ou semestrais/)
  assert.ok(simular({ ...op, periodicidade: 6 }).ok)
  // Sem carência, a periodicidade não importa.
  assert.ok(simular({ ...op, carencia: 0, periodicidade: 1 }).ok)
  assert.match(simular({ ...op, custoFinanceiro: 7 }).avisos.join(' '), /diferente do programa/)
  assert.doesNotMatch(simular({ ...op, custoFinanceiro: 3 }).avisos.join(' '), /diferente do programa/)
})

test('cenário Brasil Soberano · custo fixo 8%, SAC, 60 meses com 12 de carência e juros trimestrais (fórmula fechada)', () => {
  const r = simular({ valor: 5_000_000, participacao: 100, prazo: 60, carencia: 12, custo: 'cf', custoFinanceiro: 8, taxaBndes: 1.5, taxaAgente: 4, sistema: 'sac', periodicidade: 3, iof: SEM_IOF, ...SOB })
  assert.ok(r.ok, r.erros?.join())
  const F = 5_000_000, taxa = (1.08 * 1.015 * 1.04 - 1) * 100, i = mensal(taxa), n = 48
  perto(r.taxa, taxa, 1e-9, 'taxa')
  perto(r.taxa, 14.0048, 1e-4, 'taxa final')
  assert.equal(r.parcelas.length, 60)
  // Sem capitalização: quatro pagamentos trimestrais de juros na carência, e o saldo não cresce.
  assert.deepEqual(r.parcelas.filter(p => p.carencia && p.juros > 0).map(p => p.mes), [3, 6, 9, 12])
  assert.ok(r.parcelas.filter(p => p.carencia).every(p => p.saldo === F))
  perto(r.jurosCarencia, 4 * F * ((1 + i) ** 3 - 1), 1e-6, 'carência')
  perto(r.primeiraParcela, F / n + F * i, 1e-6, 'P1')
  perto(r.ultimaParcela, (F / n) * (1 + i), 1e-6, 'Pn')
  perto(r.juros, r.jurosCarencia + (i * F * (n + 1)) / 2, 1e-6, 'juros totais')
  perto(r.total, F + r.juros, 1e-6, 'total')
})

test('cenário Finame BK · Pré 5, Price, 120 meses com 24 de carência semestral (fórmula fechada)', () => {
  const r = simular({ valor: 3_000_000, participacao: 80, prazo: 120, carencia: 24, custo: 'pre5', custoFinanceiro: 13.5, taxaBndes: 0.95, taxaAgente: 2.5, sistema: 'price', periodicidade: 6, iof: SEM_IOF, ...BK })
  assert.ok(r.ok, r.erros?.join())
  const F = 2_400_000, i = mensal((1.135 * 1.0095 * 1.025 - 1) * 100), n = 96, pmt = (F * i) / (1 - (1 + i) ** -n)
  perto(r.jurosCarencia, 4 * F * ((1 + i) ** 6 - 1), 1e-6, 'carência')
  assert.ok(r.parcelas.filter(p => !p.carencia).every(p => Math.abs(p.parcela - pmt) < 1e-6), 'Price: todas iguais')
  perto(r.juros, r.jurosCarencia + pmt * n - F, 1e-6, 'juros totais')
})

test('Finame BK com TLP e Taxa LCD usa o prazo e a carência do BK', () => {
  const trajetoria = [{ ano: 2026, valor: 4.5 }, { ano: 2027, valor: 4 }]
  const comum = { valor: 1e6, participacao: 100, prazo: 120, carencia: 24, taxaFixa: 5, taxaBndes: 0.95, taxaAgente: 2, trajetoria, periodicidade: 3, dataLiberacao: new Date(2026, 10, 26, 12), ...BK }
  assert.ok(simularPos({ ...comum, custo: 'tlp' }).ok)
  assert.ok(simularPos({ ...comum, custo: 'lcd' }).ok)
  assert.equal(simularPos({ ...comum, custo: 'tlp', produto: 'materiais' }).ok, false)
})

test('custos oferecidos por linha e nomes curtos', () => {
  assert.deepEqual(finameFundingOptionsDo('bk-maquinas').map(o => o.id), ['tfb', 'pre5', 'pre3', 'tlp', 'lcd'])
  assert.deepEqual(finameFundingOptionsDo('brasil-soberano-bk').map(o => o.id), ['cf'])
  assert.deepEqual(finameFundingOptionsDo('materiais').map(o => o.id), ['tfc', 'tfb', 'tlp', 'lcd', 'tfbd'])
  assert.ok(finameFundingOptionsDo('bk-maquinas').every(o => ['inline', 'pos'].includes(o.mode)))
  assert.deepEqual(['tfc', 'pre5', 'pre3', 'cf', 'lcd'].map(siglaCusto), ['TFC', 'Pré 5', 'Pré 3', 'Custo fixo', 'LCD'])
  assert.equal(finameFundingOption('pre3').soMpme, true)
  assert.deepEqual(CUSTOS_EXTRAS.map(c => c.id), ['pre5', 'pre3', 'cf'])
  // O comparativo aceita Pré 5 × Pré 3 com o motor de cada custo.
  const params = { valor: 1e6, participacao: 100, prazo: 60, carencia: 0, taxaBndes: 0.95, taxaAgente: 2, sistema: 'sac', periodicidade: 1, iof: SEM_IOF, ...BK }
  const cmp = compareFinamePair(['pre5', 'pre3'], params, {}, {}, id => {
    const result = simular({ ...params, custo: id, custoFinanceiro: id === 'pre5' ? 13 : 12 })
    return result.ok ? { custo: id, rate: { value: id === 'pre5' ? 13 : 12 }, result } : null
  })
  assert.ok(cmp.ok); assert.ok(cmp.totalDifference < 0)
})

test('tabela de custos: Brasil Soberano com custo fixo e Finame BK no perfil das demais BKs', () => {
  assert.equal(avaliarCusto('brasil-soberano-bk', 'custoFixo').permitido, true)
  assert.equal(avaliarCusto('brasil-soberano-bk', 'tfb').permitido, false)
  assert.match(produtoBndes('brasil-soberano-bk').fonte, /Perguntas e Respostas/)
  assert.deepEqual(PERFIS_PAINEL.find(p => p.perfil === 'finame-bk').custos, ['tfb', 'pre5', 'pre3', 'tlp', 'selicLcd'])
  assert.deepEqual(PERFIS_PAINEL.find(p => p.perfil === 'brasil-soberano-bk').produtos, ['brasil-soberano-bk'])
  // A TFC pedida na sugestão não é aceita nas demais BKs.
  assert.equal(avaliarCusto('finame-demais-bks', 'tfc').permitido, false)
})

test('seletor Linha mostra Finame BK e Brasil Soberano com o produto de cada um', () => {
  const src = readFileSync(new URL('../src/BndesWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(src, /\['finame-bk', 'Finame BK · Máquinas e equipamentos'\]/)
  assert.match(src, /\['brasil-soberano-bk', 'Brasil Soberano · Bens de capital'\]/)
  assert.match(src, /'finame-bk': 'bk-maquinas'/)
  assert.match(src, /'brasil-soberano-bk': 'brasil-soberano-bk'/)
  // Materiais e Veículos não mudaram de regra.
  assert.equal(REGRAS.prazoMaxMeses, 84)
  assert.deepEqual(REGRAS.taxaBndes, { 'mpme-nne': 0.95, mpme: 1.25, grande: 1.25 })
})
