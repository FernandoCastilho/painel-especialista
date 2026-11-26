// Finame Veículos · Ônibus e caminhões (26/11/2026): mesma conta do Finame Materiais, com prazo de até 120 meses, sem tetos e sem TFBD
// na tela. Os cenários de 120 meses são conferidos por fórmula fechada, sem o motor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { REGRAS, REGRAS_VEICULOS, regrasFiname, conferir, simular, faixaTfb, codigoTfc, ecgFgi, avisoFatorKFgi } from '../src/finameMateriais.js'
import { simularPos } from '../src/finamePosFixado.js'
import { FINAME_FUNDING_OPTIONS, finameFundingOptionsDo } from '../src/finameFunding.js'
import { PERFIS_PAINEL, avaliarCusto, produtoBndes } from '../src/bndesCustosPorProduto.js'

const perto = (a, b, tol = 0.01, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ${b}, obtido ${a}`)
const mensal = (aa) => (1 + aa / 100) ** (1 / 12) - 1
const SEM_IOF = { fixed: 0, daily: 0 }
const VEI = { produto: 'veiculos-onibus' }

test('regras: Veículos aceita até 120 meses; Materiais continua em 84', () => {
  assert.equal(regrasFiname('veiculos-onibus'), REGRAS_VEICULOS)
  assert.equal(regrasFiname('materiais'), REGRAS); assert.equal(regrasFiname(undefined), REGRAS)
  assert.equal(REGRAS.prazoMaxMeses, 84); assert.equal(REGRAS_VEICULOS.prazoMaxMeses, 120)
  assert.equal(REGRAS_VEICULOS.carenciaMaxMeses, 24); assert.equal(REGRAS_VEICULOS.carenciaMaxTfbMeses, 12)
  assert.deepEqual(REGRAS_VEICULOS.taxaBndes, REGRAS.taxaBndes)
  const base = { valor: 1e6, participacao: 100, carencia: 0, custo: 'tlp' }
  assert.deepEqual(conferir({ ...base, prazo: 120, ...VEI }).erros, [])
  assert.match(conferir({ ...base, prazo: 121, ...VEI }).erros[0], /acima do máximo do produto: 120 meses \(10 anos\)/)
  assert.match(conferir({ ...base, prazo: 85 }).erros[0], /acima do máximo do produto: 84 meses \(7 anos\)/)
  assert.match(conferir({ ...base, prazo: 85, produto: 'materiais' }).erros[0], /84/)
  // Carência com TFB ou TFC continua limitada a 12 meses.
  assert.match(conferir({ ...base, prazo: 120, carencia: 13, custo: 'tfb', ...VEI }).erros[0], /12 meses com TFB/)
  // Sem teto por operação nem por cliente em Veículos; no Materiais os avisos seguem.
  assert.equal(conferir({ ...base, valor: 200e6, prazo: 60, custo: 'tfb', ...VEI }).avisos.length, 0)
  assert.equal(conferir({ ...base, valor: 200e6, prazo: 60, custo: 'tfb' }).avisos.length, 2)
})

test('séries de 120 meses: TFB faixa 120 e TFC C02/C04 de 85 a 120 meses', () => {
  assert.deepEqual([85, 96, 120].map(faixaTfb), [120, 120, 120])
  assert.deepEqual([['grande', 120], ['mpme', 120], ['mpme-nne', 100]].map(([p, m]) => codigoTfc(p, m)), ['C02', 'C04', 'C04'])
})

test('cenário Veículos · TFB, SAC, 120 meses com carência de 12 e juros trimestrais (fórmula fechada)', () => {
  const r = simular({ valor: 800_000, participacao: 100, prazo: 120, carencia: 12, custo: 'tfb', custoFinanceiro: 14.2, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 3, iof: SEM_IOF, ...VEI })
  assert.ok(r.ok, r.erros?.join())
  const F = 800_000, taxa = (1.142 * 1.0125 * 1.03 - 1) * 100, i = mensal(taxa), n = 108
  perto(r.taxa, taxa, 1e-9, 'taxa')
  assert.equal(r.parcelas.length, 120)
  perto(r.jurosCarencia, 4 * F * ((1 + i) ** 3 - 1), 1e-6, 'carência')
  perto(r.primeiraParcela, F / n + F * i, 1e-6, 'P1')
  perto(r.ultimaParcela, (F / n) * (1 + i), 1e-6, 'Pn')
  perto(r.juros, r.jurosCarencia + (i * F * (n + 1)) / 2, 1e-6, 'juros totais')
  perto(r.total, F + r.juros, 1e-6, 'total')
  perto(r.parcelas.at(-1).saldo, 0, 1e-6, 'saldo zera')
})

test('cenário Veículos · TFC, Price, 120 meses sem carência (fórmula fechada)', () => {
  const r = simular({ valor: 1_000_000, participacao: 90, prazo: 120, carencia: 0, custo: 'tfc', custoFinanceiro: 13.8, taxaBndes: 0.95, taxaAgente: 2.5, sistema: 'price', periodicidade: 1, iof: SEM_IOF, ...VEI })
  assert.ok(r.ok, r.erros?.join())
  const F = 900_000, i = mensal((1.138 * 1.0095 * 1.025 - 1) * 100), n = 120, pmt = (F * i) / (1 - (1 + i) ** -n)
  assert.ok(r.parcelas.every((p) => Math.abs(p.parcela - pmt) < 1e-6), 'Price: todas iguais')
  perto(r.juros, pmt * n - F, 1e-6, 'juros do Price')
})

test('o mesmo pedido de 120 meses no Materiais é recusado', () => {
  const r = simular({ valor: 800_000, participacao: 100, prazo: 120, carencia: 12, custo: 'tfb', custoFinanceiro: 14.2, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 3, iof: SEM_IOF })
  assert.equal(r.ok, false)
})

test('pós-fixado: TLP e Taxa LCD aceitam 120 meses em Veículos e recusam no Materiais', () => {
  const base = { valor: 1_000_000, prazo: 120, carencia: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 1, tac: 0, dataLiberacao: new Date(2027, 2, 15, 12) }
  const trajetoria = [{ ano: 2027, valor: 5 }]
  const tlp = simularPos({ ...base, custo: 'tlp', taxaFixa: 7.72, trajetoria, ...VEI })
  assert.equal(tlp.ok, true, tlp.erros?.join()); assert.equal(tlp.parcelas.length, 120)
  perto(tlp.parcelas.reduce((s, p) => s + p.amortizacao, 0), 1_000_000, 0.05, 'TLP devolve o principal')
  const lcd = simularPos({ ...base, custo: 'lcd', taxaFixa: -0.11, trajetoria: [{ ano: 2027, valor: 12.75 }], ...VEI })
  assert.equal(lcd.ok, true, lcd.erros?.join()); assert.equal(lcd.parcelas.length, 120)
  const materiais = simularPos({ ...base, custo: 'tlp', taxaFixa: 7.72, trajetoria })
  assert.equal(materiais.ok, false); assert.match(materiais.erros[0], /1 a 84 meses/)
})

test('FGI: acima de 102 meses avisa que o fator K de 0,05% não foi conferido', () => {
  assert.equal(avisoFatorKFgi(84), null); assert.equal(avisoFatorKFgi(102), null)
  assert.match(avisoFatorKFgi(103), /0,05%/)
  assert.equal(ecgFgi({ valor: 1e6, percentual: 80, prazo: 120, periodos: 121, incorporar: false }).k, 0.05)
  const base = { valor: 1_000_000, prazo: 120, carencia: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 1, tac: 0, dataLiberacao: new Date(2027, 2, 15, 12), custo: 'tlp', taxaFixa: 7.72, trajetoria: [{ ano: 2027, valor: 5 }], ...VEI }
  assert.ok(simularPos({ ...base, fgi: { percentual: 80 } }).avisos.some(a => /fator K/.test(a)))
  assert.ok(!simularPos({ ...base, prazo: 60, fgi: { percentual: 80 } }).avisos.some(a => /fator K/.test(a)))
})

test('custos: Veículos não oferece TFBD; Materiais continua oferecendo', () => {
  assert.ok(FINAME_FUNDING_OPTIONS.some(o => o.id === 'tfbd'))
  assert.equal(finameFundingOptionsDo('materiais'), FINAME_FUNDING_OPTIONS)
  assert.deepEqual(finameFundingOptionsDo('veiculos-onibus').map(o => o.id), FINAME_FUNDING_OPTIONS.map(o => o.id).filter(id => id !== 'tfbd'))
  const perfil = PERFIS_PAINEL.find(p => p.perfil === 'finame-veiculos')
  assert.deepEqual(perfil.produtos, ['finame-veiculos-onibus'])
  assert.ok(!perfil.custos.includes('tfbd'))
  assert.equal(avaliarCusto('finame-veiculos-onibus', 'pre5').permitido, false)
  assert.equal(avaliarCusto('finame-veiculos-onibus', 'tfcMpme', { mpme: false }).permitido, false)
  assert.match(produtoBndes('finame-veiculos-onibus').fonte, /23\/11\/2026/)
})

test('série da TFC em Veículos: geral por padrão; C25/C26 só na faixa de 120 meses', async () => {
  const { codigoTfcSerie, codigoTfc, nomeTfc, TFC_SERIES_ONIBUS } = await import('../src/finameMateriais.js')
  const { TFC_SERIES } = await import('../src/moedas.js')
  assert.equal(codigoTfcSerie('grande', 120), codigoTfc('grande', 120))
  assert.equal(codigoTfcSerie('mpme', 96, 'geral'), 'C04')
  assert.equal(codigoTfcSerie('grande', 120, 'C25'), 'C25'); assert.equal(codigoTfcSerie('mpme', 61, 'C26'), 'C26')
  assert.equal(codigoTfcSerie('grande', 60, 'C25'), 'C01', 'até 60 meses vale a geral')
  assert.equal(codigoTfcSerie('grande', 120, 'C12'), 'C02', 'série fora da lista de ônibus vale a geral')
  // Nomes iguais aos do catálogo das Moedas Contratuais.
  for (const [codigo, nome] of Object.entries(TFC_SERIES_ONIBUS)) assert.deepEqual(TFC_SERIES.find(([c]) => c === codigo), [codigo, nome])
  assert.equal(nomeTfc('C02'), 'TFC_120.90'); assert.equal(nomeTfc('C26'), 'TFC_MOB_ONIB_NV_120')
})
