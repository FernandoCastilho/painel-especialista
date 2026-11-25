import test from 'node:test'
import assert from 'node:assert/strict'
import { cdcConta, cdcCronograma, cdcVencimentos } from '../src/cdcConta.js'
import { cdcEmailLink, cdcEmailText } from '../src/cdcEmail.js'

// Caso de referência: planilha de CDC enviada por Fernando em 25/11/2026 (sem dados de identificação do cliente).
// Liberação 25/11/2026, carência 30 dias, 48 parcelas, valor liberado R$ 500.000,00, tarifa de cadastro R$ 2.523,00.
const SALDOS = [511341.95, 504061.07, 496663.54, 488371.91, 480723.02, 472701.23, 464801.28, 456532.70, 448373.71,
  440084.00, 431432.29, 422871.16, 413952.64, 405111.48, 396128.66, 386589.42, 377309.85, 367685.11]
const AMORT = [7431.99, 7280.88, 7397.53, 8291.63, 7648.89, 8021.79, 7899.95, 8268.58, 8158.99, 8289.71, 8651.71, 8561.13]

test('cronograma igual ao da planilha: datas, juros por dias corridos e parcela fixa', () => {
  const dues = cdcVencimentos('2026-12-25', 48)
  assert.equal(dues[3], '2027-03-25')
  assert.equal(dues.at(-1), '2030-11-25')
  // A planilha mostra 1,55%; os juros dela fecham com 1,550042% (casas escondidas na célula da taxa).
  const { pmt, rows } = cdcCronograma(518773.94, 0.01550042, '2026-11-25', dues)
  assert.equal(pmt, 15473.20)
  assert.equal(rows[0].interest, 8041.21)
  assert.equal(rows[3].interest, 7181.57)
  SALDOS.forEach((saldo, k) => assert.ok(Math.abs(rows[k].balance - saldo) <= 0.011, `saldo ${k + 1}: ${rows[k].balance} x ${saldo}`))
  AMORT.forEach((a, k) => assert.ok(Math.abs(rows[k].amortization - a) <= 0.011, `amortização ${k + 1}`))
  assert.equal(rows.at(-1).balance, 0)
})

test('saída da planilha: IOF adicional, coeficiente, datas e entrada', () => {
  const r = cdcConta({ valorBem: 500000, valorLiberado: 500000, tarifas: 2523, taxa: 1.55, prazo: 48, carenciaDias: 30, inicio: '2026-11-25' })
  assert.ok(r.ok)
  assert.equal(r.iofAdicional, 1909.59)
  assert.equal(r.primeira, '2026-12-25')
  assert.equal(r.ultima, '2030-11-25')
  assert.equal(r.pctEntrada, 0)
  assert.equal(r.coeficiente.toFixed(5), (r.parcela / 502523).toFixed(5))
  // Fechamento do IOF financiado: saldo = base + IOF, em centavos.
  assert.equal(r.principal, Math.round((502523 + r.iof) * 100) / 100)
  // Regra legal do painel (0,0082% ao dia, limite 365): R$ 14.243,60; a planilha mostra R$ 14.341,35 (diferença em aberto).
  assert.equal(r.iofDiario, 14243.6)
  assert.equal(r.parcela, 15470.14)
  assert.equal(r.rows.length, 48)
})

test('erros de entrada', () => {
  const base = { valorBem: 100000, valorLiberado: 80000, taxa: 2, prazo: 24, carenciaDias: 30, inicio: '2026-11-25' }
  assert.ok(cdcConta(base).ok)
  assert.equal(cdcConta(base).pctEntrada, 0.2)
  assert.equal(cdcConta({ ...base, valorBem: 50000 }).ok, false)
  assert.equal(cdcConta({ ...base, prazo: 0 }).ok, false)
  assert.equal(cdcConta({ ...base, carenciaDias: NaN }).ok, false)
  assert.equal(cdcConta({ ...base, inicio: '' }).ok, false)
})

test('e-mail leva entrada, saída e parcelas; cronograma longo vai para a área de transferência', () => {
  const result = cdcConta({ valorBem: 500000, valorLiberado: 500000, tarifas: 2523, taxa: 1.55, prazo: 48, carenciaDias: 30, inicio: '2026-11-25' })
  const info = { categoria: 'Pesado', anoModelo: '2026', zeroKm: true, carenciaDias: 30, inicio: '2026-11-25', cadastro: 2523, avaliacao: 0, registro: 0, spf: 0, seguroAuto: 0, socorro: 0 }
  const { body, subject } = cdcEmailText({ result, info })
  assert.match(subject, /^CDC/)
  for (const parte of ['ENTRADA', 'SAÍDA', 'PARCELAS', 'IOF total', 'Coeficiente', '48 | 25/11/2030']) assert.ok(body.includes(parte), parte)
  const link = cdcEmailLink({ result, info })
  assert.ok(link.href.startsWith('https://outlook.office.com/'))
  assert.ok(link.copiar.includes('25/11/2030'))
})

test('IOF pela lei: Simples até R$ 30 mil usa 0,00274% ao dia; acima, 0,0082%', () => {
  const base = { valorBem: 25000, valorLiberado: 25000, taxa: 2, prazo: 24, carenciaDias: 30, inicio: '2026-11-25' }
  const pj = cdcConta(base), simples = cdcConta({ ...base, perfil: 'simples' })
  assert.equal(cdcConta({ ...base, valorBem: 40000, valorLiberado: 40000, perfil: 'simples' }).tax.daily, 0.0082)
  assert.equal(pj.tax.daily, 0.0082)
  assert.equal(simples.tax.daily, 0.00274)
  assert.ok(simples.iofDiario < pj.iofDiario)
  assert.equal(simples.iofAdicional, pj.iofAdicional)
})

test('spread composto sobre o funding do prazo', async () => {
  const { fundingDoPrazo, spreadDaOperacao, FUNDING } = await import('../src/cdcFunding.js')
  assert.equal(FUNDING[0].label, '19/11 até 25/11')
  assert.equal(fundingDoPrazo('2026-11-19', 48).taxa, 15.58)
  assert.equal(fundingDoPrazo('2026-11-11', 48).taxa, 15.44)
  assert.ok(Math.abs(fundingDoPrazo('2026-11-19', 54).taxa - 15.655) < 1e-9)
  assert.equal(fundingDoPrazo('2026-11-19', 3).taxa, 13.80)
  assert.equal(fundingDoPrazo('2026-11-19', 96).taxa, 15.84)
  const s = spreadDaOperacao({ taxaAm: 1.55, prazo: 48, vigenciaId: '2026-11-19' })
  // 1,55% a.m. = 20,27% a.a.; (1,202692 / 1,1558) − 1 = 4,06% a.a.
  assert.equal((s.taxaAa * 100).toFixed(2), '20.27')
  assert.equal((s.spreadAa * 100).toFixed(2), '4.06')
  assert.ok(Math.abs((1 + s.fundingAa) * (1 + s.spreadAa) - (1 + s.taxaAa)) < 1e-12)
})

test('bordas: fim de mês, limite de 365 dias do IOF e carência que não cabe na 1ª parcela', () => {
  const r = cdcConta({ valorBem: 100000, valorLiberado: 100000, taxa: 1, prazo: 3, carenciaDias: 30, inicio: '2027-01-01' })
  assert.deepEqual(r.rows.map(x => x.date), ['2027-01-31', '2027-02-28', '2027-03-31'])
  const longo = cdcConta({ valorBem: 100000, valorLiberado: 100000, taxa: 1, prazo: 1, carenciaDias: 180, inicio: '2026-11-25' })
  assert.equal(longo.iofDiario, Math.round(longo.principal * 0.000082 * 180 * 100) / 100)
  const ano = cdcConta({ valorBem: 100000, valorLiberado: 100000, taxa: 0, prazo: 24, carenciaDias: 30, inicio: '2026-11-25' })
  const esperado = ano.rows.reduce((s, x) => s + x.amortization * Math.min(x.days, 365) * 0.000082, 0)
  assert.ok(Math.abs(ano.iofDiario - esperado) < 0.01)
  assert.equal(cdcConta({ valorBem: 1e5, valorLiberado: 1e5, taxa: 3, prazo: 120, carenciaDias: 180, inicio: '2026-11-25' }).ok, false)
  assert.equal(cdcConta({ valorBem: 100000.1, valorLiberado: 80000.05, taxa: 2, prazo: 12, carenciaDias: 30, inicio: '2026-11-25' }).entrada, 20000.05)
})
