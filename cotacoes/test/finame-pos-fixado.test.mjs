import assert from 'node:assert/strict'
import test from 'node:test'
import { simularPos, cambioNaData, valorDoAno, trajetoriaFocus, trajetoriaSelicMedia, codigoTfbd } from '../src/finamePosFixado.js'
import { ecgFgi } from '../src/finameMateriais.js'
import { compareFinamePair, resolvePosRate, parseSignedDecimal } from '../src/finameFunding.js'

// Contas de conferência feitas à parte, sem o motor: dias úteis contados à mão (seg-sex, sem feriados no período escolhido).
const lib = new Date(2027, 2, 15, 12) // 15/03/2027, segunda
const base = { valor: 1_000_000, prazo: 1, carencia: 0, taxaBndes: 1.25, taxaAgente: 3, periodicidade: 1, tac: 0, dataLiberacao: lib }
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const fixo = (j, b = 1.25, a = 3) => (1 + j / 100) * (1 + b / 100) * (1 + a / 100) - 1
// 15/03/2027 → 15/04/2027 (quinta). Dias úteis de 16/03 a 15/04: 23 dias de semana; 26/03/2027 é Sexta-feira Santa (feriado nacional) → 22.
const DU_MAR_ABR = 22

test('TLP exigível: IPCA cobrado nos juros, sem corrigir o saldo, em dias úteis/252', () => {
  const r = simularPos({ ...base, custo: 'tlp', taxaFixa: 7.72, trajetoria: [{ ano: 2027, valor: 5 }] })
  assert.equal(r.ok, true, r.erros?.join())
  assert.equal(r.parcelas[0].du, DU_MAR_ABR)
  const esperado = 1_000_000 * ((1.05 * (1 + fixo(7.72))) ** (DU_MAR_ABR / 252) - 1)
  perto(r.juros, esperado)
  assert.equal(r.correcao, 0)
  perto(r.parcelas[0].amortizacao, 1_000_000)
  perto(r.total, 1_000_000 + esperado)
  assert.equal(r.baseJuros, 'dias úteis/252')
})

test('Taxa LCD: Selic capitaliza o saldo e a parte fixa (com LD1 negativa) incide sobre o saldo corrigido', () => {
  const r = simularPos({ ...base, custo: 'lcd', taxaFixa: -0.11, trajetoria: [{ ano: 2027, valor: 12.75 }] })
  assert.equal(r.ok, true, r.erros?.join())
  const corrigido = 1_000_000 * 1.1275 ** (DU_MAR_ABR / 252)
  perto(r.correcao, corrigido - 1_000_000)
  perto(r.juros, corrigido * ((1 + fixo(-0.11)) ** (DU_MAR_ABR / 252) - 1))
  perto(r.parcelas[0].amortizacao, corrigido)
  perto(r.total, corrigido + r.juros)
})

test('TFBD: saldo pelo dólar e juros proporcionais em dias corridos/360', () => {
  const constante = simularPos({ ...base, custo: 'tfbd', taxaFixa: 6.04, trajetoria: [{ ano: 2027, valor: 5.5 }], cambioInicial: 5.5 })
  assert.equal(constante.ok, true, constante.erros?.join())
  assert.equal(constante.correcao, 0)
  perto(constante.juros, 1_000_000 * fixo(6.04) * (31 / 360))
  assert.equal(constante.baseJuros, 'dias corridos/360')
  assert.ok(constante.avisos.some(a => /Itaú/.test(a)))
  // Dólar subindo de 5,50 para 6,05 ao fim de 2027 (+10%): a correção do primeiro mês segue a interpolação geométrica.
  const sobe = simularPos({ ...base, custo: 'tfbd', taxaFixa: 6.04, trajetoria: [{ ano: 2027, valor: 6.05 }], cambioInicial: 5.5 })
  const fator = cambioNaData(5.5, '2027-03-15', [{ ano: 2027, valor: 6.05 }], '2027-04-15') / 5.5
  perto(fator, Math.exp(Math.log(1.1) * (31 / 291)), 1e-12) // 15/03 → 31/12/2027 = 291 dias
  perto(sobe.correcao, 1_000_000 * (fator - 1))
  perto(sobe.juros, 1_000_000 * fator * fixo(6.04) * (31 / 360))
  // Dólar caindo: correção negativa, saldo menor.
  const cai = simularPos({ ...base, prazo: 12, custo: 'tfbd', taxaFixa: 6.04, trajetoria: [{ ano: 2027, valor: 5 }], cambioInicial: 5.5 })
  assert.ok(cai.correcao < 0)
})

test('período que cruza o ano usa a taxa de cada ano pelos dias úteis de cada lado', () => {
  const dez = new Date(2027, 11, 15, 12) // 15/12/2027 → 17/01/2028 (15/01/2028 é sábado)
  const r = simularPos({ ...base, dataLiberacao: dez, custo: 'tlp', taxaFixa: 0, taxaBndes: 0, taxaAgente: 0, trajetoria: [{ ano: 2027, valor: 10 }, { ano: 2028, valor: 0 }] })
  assert.equal(r.ok, true, r.erros?.join())
  assert.equal(r.parcelas[0].vencimento, '2028-01-17')
  // 16/12 a 31/12/2027: 12 dias de semana, menos 25/12 (sábado, não conta) → 12. 01/01 a 17/01/2028: 12 dias de semana, menos 01/01 (sábado) → 11.
  assert.equal(r.parcelas[0].du, 23)
  perto(r.juros, 1_000_000 * (1.1 ** (12 / 252) - 1))
})

test('carência, periodicidade e SAC fecham: amortizações = financiado + correção; total = amortizações + juros + TAC', () => {
  const traj = [{ ano: 2027, valor: 12 }, { ano: 2028, valor: 11 }, { ano: 2029, valor: 10 }]
  for (const custo of ['tlp', 'lcd', 'tfbd']) {
    const r = simularPos({ ...base, prazo: 36, carencia: 6, periodicidade: 3, tac: 2600, custo, taxaFixa: custo === 'lcd' ? -0.11 : 6, trajetoria: custo === 'tfbd' ? [{ ano: 2027, valor: 5.6 }, { ano: 2028, valor: 5.7 }] : traj, cambioInicial: 5.5 })
    assert.equal(r.ok, true, `${custo}: ${r.erros?.join()}`)
    assert.equal(r.parcelas.length, 36)
    assert.deepEqual(r.parcelas.filter(p => p.carencia && p.parcela > 0).map(p => p.mes), [3, 6])
    perto(r.parcelas.reduce((s, p) => s + p.amortizacao, 0), r.financiado + r.correcao)
    perto(r.total, r.financiado + r.correcao + r.juros + 2600)
    perto(r.atribuicao.custoFinanceiro + r.atribuicao.bndes + r.atribuicao.agente, r.juros)
    assert.equal(r.parcelas.at(-1).saldo, 0)
    assert.ok(r.cet && r.cetFixo, custo)
  }
})

test('CET da parte fixa tira o índice (Res. CMN 4.881, art. 5º)', () => {
  const r = simularPos({ ...base, prazo: 24, custo: 'tlp', taxaFixa: 7.72, trajetoria: [{ ano: 2027, valor: 5 }] })
  const semIpca = simularPos({ ...base, prazo: 24, custo: 'tlp', taxaFixa: 7.72, trajetoria: [{ ano: 2027, valor: 0 }] })
  perto(r.cetFixo.anual, semIpca.cet.anual, 1e-9)
  assert.ok(r.cet.anual > r.cetFixo.anual)
})

test('regras do produto: carência até 24 meses, sem FGI, taxas e projeções válidas', () => {
  const t = [{ ano: 2027, valor: 5 }]
  assert.equal(simularPos({ ...base, prazo: 48, carencia: 24, custo: 'tlp', taxaFixa: 7, trajetoria: t }).ok, true)
  assert.equal(simularPos({ ...base, prazo: 48, carencia: 25, custo: 'tlp', taxaFixa: 7, trajetoria: t }).ok, false)
  assert.match(simularPos({ ...base, custo: 'lcd', taxaFixa: 0, trajetoria: t, fgi: { percentual: 80 } }).erros.join(), /FGI/)
  assert.match(simularPos({ ...base, custo: 'tfbd', taxaFixa: 6, trajetoria: [{ ano: 2027, valor: 5.5 }], cambioInicial: 5.5, fgi: { percentual: 80 } }).erros.join(), /FGI/)
  // TLP exigível aceita FGI (o Anexo I veda só a TLP capitalizada): ECG à vista entra no total e sai do valor líquido do CET.
  const sem = simularPos({ ...base, prazo: 24, custo: 'tlp', taxaFixa: 7, trajetoria: t })
  const com = simularPos({ ...base, prazo: 24, custo: 'tlp', taxaFixa: 7, trajetoria: t, fgi: { percentual: 80 } })
  assert.equal(com.ok, true, com.erros?.join())
  const ecg = ecgFgi({ valor: 1_000_000, percentual: 80, prazo: 24, incorporar: false }).ecg
  perto(com.fgi.ecg, ecg); perto(com.total, sem.total + ecg); perto(com.juros, sem.juros)
  assert.ok(com.cet.anual > sem.cet.anual)
  assert.equal(simularPos({ ...base, custo: 'tlp', taxaFixa: 7, trajetoria: t, fgi: { percentual: 85 } }).ok, false)
  assert.equal(simularPos({ ...base, custo: 'tfbd', taxaFixa: 6, trajetoria: [{ ano: 2027, valor: 5.5 }] }).ok, false) // sem dólar do dia
  assert.equal(simularPos({ ...base, custo: 'tlp', taxaFixa: 7, trajetoria: [] }).ok, false)
  assert.equal(simularPos({ ...base, custo: 'tfc', taxaFixa: 7, trajetoria: t }).ok, false)
})

test('Focus ano a ano, faixa da TFBD e taxa de referência que aceita LD1 negativa', () => {
  const focus = { rows: [{ indicator: 'IPCA', values: { 2025: { median: 4.5 }, 2026: { median: 5.1 }, 2027: { median: 5 }, 2028: { median: 4 } } }] }
  assert.deepEqual(trajetoriaFocus(focus, 'IPCA', 2026), [{ ano: 2026, valor: 5.1 }, { ano: 2027, valor: 5 }, { ano: 2028, valor: 4 }])
  assert.deepEqual(trajetoriaFocus(focus, 'Selic', 2026), [])
  assert.equal(valorDoAno([{ ano: 2026, valor: 5 }, { ano: 2027, valor: 4 }], 2030), 4)
  assert.equal(valorDoAno([{ ano: 2026, valor: 5 }, { ano: 2027, valor: 4 }], 2025), 5)
  // Selic da LCD: ano da liberação com a Selic atual; seguintes pela média dos fins de ano do Focus.
  const selic = { rows: [{ indicator: 'Selic', values: { 2026: { median: 13.75 }, 2027: { median: 12.75 }, 2028: { median: 11 } } }] }
  assert.deepEqual(trajetoriaSelicMedia(selic, 2026, 14), [{ ano: 2026, valor: 14 }, { ano: 2027, valor: 13.25 }, { ano: 2028, valor: 11.875 }])
  assert.deepEqual(trajetoriaSelicMedia(selic, 2027, null), [{ ano: 2027, valor: 13.25 }, { ano: 2028, valor: 11.875 }])
  assert.deepEqual([24, 25, 72, 73, 84].map(codigoTfbd), ['TD1', 'TD2', 'TD2', 'TD3', 'TD3'])
  assert.equal(resolvePosRate('lcd', { valor: -0.11 }).value, -0.11)
  assert.equal(resolvePosRate('lcd', null, '−0,11').value, -0.11)
  assert.equal(resolvePosRate('tfc', { valor: 10 }).value, null)
  assert.equal(parseSignedDecimal('-1,5'), -1.5)
})

test('comparativo aceita qualquer par e mantém as travas do par TFC × TFB', () => {
  const fake = id => ({ custo: id, quote: null, rate: { value: 1, manual: true }, result: { total: id === 'tlp' ? 100 : 150 } })
  const r = compareFinamePair(['tfc', 'tlp'], {}, {}, {}, fake)
  assert.equal(r.ok, true)
  assert.deepEqual(r.alternatives.map(a => a.custo), ['tfc', 'tlp'])
  assert.equal(r.totalDifference, -50)
  assert.equal(compareFinamePair(['tlp', 'tlp'], {}, {}, {}, fake).ok, false)
  assert.equal(compareFinamePair(['tfc', 'lcd'], {}, {}, {}, () => null).ok, false)
  // TFC × TFB passa pela regra antiga (mesma data de referência).
  const semData = compareFinamePair(['tfc', 'tfb'], { liberacao: 90, prazo: 48 }, { tfc: { data: '2026-11-18', valor: 10, codigo: 'C03' }, tfb: { data: '2026-11-17', valor: 11, codigo: 'TFB_60_90' } }, {}, fake)
  assert.match(semData.error, /mesma data/)
})
