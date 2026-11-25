import test from 'node:test'
import assert from 'node:assert/strict'
import { cdcConta, cdcCronograma, cdcVencimentos } from '../src/cdcConta.js'
import { AVISOS_CDC, cdcEmlConteudo } from '../src/cdcEmail.js'
import { fundingDoPrazo, lerFunding, spreadDaTaxa, taxaDoSpread } from '../src/cdcFunding.js'

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
  // 0,38% sobre o valor financiado com o próprio IOF (decisão de Fernando, 25/11/2026); a planilha dá 1.909,59, sem o IOF.
  assert.equal(r.iofAdicional, Math.round(r.principal * 0.38) / 100)
  assert.equal(r.iofAdicional, 1971.21)
  assert.equal(r.primeira, '2026-12-25')
  assert.equal(r.ultima, '2030-11-25')
  assert.equal(r.pctEntrada, 0)
  assert.equal(r.coeficiente.toFixed(5), (r.parcela / 502523).toFixed(5))
  // Fechamento do IOF financiado: saldo = base + IOF, em centavos.
  assert.equal(r.principal, Math.round((502523 + r.iof) * 100) / 100)
  // Regra legal do painel (0,0082% ao dia, limite 365): R$ 14.245,34 (com o adicional sobre o valor já com IOF); a planilha mostra R$ 14.341,35 (diferença em aberto).
  assert.equal(r.iofDiario, 14245.34)
  assert.equal(r.parcela, 15472.03)
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

test('e-mail em arquivo: resumo, parcelas e avisos de cotação indicativa, sem spread', () => {
  const result = cdcConta({ valorBem: 500000, valorLiberado: 500000, tarifas: 2523, taxa: 1.55, prazo: 48, carenciaDias: 30, inicio: '2026-11-25' })
  const c = cdcEmlConteudo({ result, info: { categoria: 'Pesado', carenciaDias: 30, dataSimulacao: '2026-11-25' } })
  assert.match(c.assunto, /^CDC · cotação indicativa/)
  assert.ok(c.nome.endsWith('.eml'))
  for (const parte of ['Valor da parcela', 'IOF total', '48 | 25/11/2030', 'AVISOS IMPORTANTES', 'Não constitui proposta']) assert.ok(c.texto.includes(parte), parte)
  for (const aviso of AVISOS_CDC) assert.ok(c.texto.includes(aviso))
  assert.ok(!/spread/i.test(c.texto + c.html), 'spread é interno')
})

// Tabela fictícia no formato da planilha FUNDING (cabeçalho com vigências ao ano e ao mês, linha SELIC no fim).
const COLADA = [
  'FUNDING', '\tTaxas a.a.\t\tTaxa a.m.',
  '\t01/12 até 07/12\t24/11 até 30/11\t01/12 até 07/12\t24/11 até 30/11',
  '6\t10,00%\t9,50%\t0,80%\t0,76%',
  '12\t11,00%\t10,50%\t0,87%\t0,83%',
  '48\t12,00%\t11,50%\t0,95%\t0,91%',
  'SELIC\t10,00%\t10,00%\t0,80%\t0,80%',
].join('\n')

test('tabela de funding colada do Excel: usa só as colunas ao ano, a vigência mais recente primeiro', () => {
  const lido = lerFunding(COLADA, '2026-11-25')
  assert.ok(lido.ok)
  assert.equal(lido.tabela.length, 2)
  assert.equal(lido.tabela[0].label, '01/12 até 07/12')
  assert.equal(lido.tabela[0].fim, '2026-12-07')
  assert.deepEqual(lido.tabela[0].taxas, { 6: 10, 12: 11, 48: 12 })
  assert.deepEqual(lido.tabela[1].taxas, { 6: 9.5, 12: 10.5, 48: 11.5 })
  assert.equal(lido.tabela[0].taxas.SELIC, undefined)
  // Sem cabeçalho: uma coluna só.
  const solta = lerFunding('6\t10,00%\n12\t11,00%', '2026-11-25')
  assert.deepEqual(solta.tabela[0].taxas, { 6: 10, 12: 11 })
  assert.equal(lerFunding('qualquer coisa', '2026-11-25').ok, false)
  assert.equal(lerFunding('6\t10,00%\n12\tabc', '2026-11-25').ok, false)
  // Vigência que vira o ano.
  assert.equal(lerFunding('\t29/12 até 04/01\n6\t10%\n12\t11%', '2026-12-29').tabela[0].fim, '2027-01-04')
})

test('spread composto sobre o funding do prazo, e a conta reversa devolve a mesma taxa', () => {
  const vig = lerFunding(COLADA, '2026-11-25').tabela[0]
  assert.equal(fundingDoPrazo(vig, 12).taxa, 11)
  assert.equal(fundingDoPrazo(vig, 30).taxa, 11.5)
  assert.match(fundingDoPrazo(vig, 30).nota, /interpolado/)
  assert.equal(fundingDoPrazo(vig, 3).taxa, 10)
  assert.equal(fundingDoPrazo(vig, 72).taxa, 12)
  // 1,55% a.m. = 20,27% a.a.; sobre 12% a.a.: 1,202692 / 1,12 − 1 = 7,38% a.a.
  const s = spreadDaTaxa(1.55, 12)
  assert.equal(s.toFixed(2), '7.38')
  assert.ok(Math.abs(taxaDoSpread(s, 12) - 1.55) < 1e-12)
  assert.ok(Math.abs(spreadDaTaxa(taxaDoSpread(4, 15.58), 15.58) - 4) < 1e-12)
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

test('tabela colada: célula vazia não desloca colunas, sem a linha "Taxa a.m." e virada de ano', async () => {
  const { vigenciaDeHoje } = await import('../src/cdcFunding.js')
  // Coluna separadora vazia (oculta no Excel) e prazo de 72 sem taxa na 1ª vigência.
  const vazio = ['\t01/12 até 07/12\t24/11 até 30/11\t\t01/12 até 07/12\t24/11 até 30/11',
    '6\t10,00%\t9,50%\t\t0,80%\t0,76%', '48\t12,00%\t11,50%\t\t0,95%\t0,91%', '72\t\t13,10%\t\t1,05%\t1,04%'].join('\n')
  const a = lerFunding(vazio, '2026-11-25')
  assert.ok(a.ok)
  assert.equal(a.tabela.length, 2, 'rótulos repetidos: só as colunas ao ano')
  assert.deepEqual(a.tabela.find(v => v.label === '01/12 até 07/12').taxas, { 6: 10, 48: 12 })
  assert.deepEqual(a.tabela.find(v => v.label === '24/11 até 30/11').taxas, { 6: 9.5, 48: 11.5, 72: 13.1 })
  // Padrão: a vigência que vale hoje, não a mais recente (futura).
  assert.equal(vigenciaDeHoje(a.tabela, '2026-11-25').label, '24/11 até 30/11')
  // Virada de ano: em 05/01/2027, "29/12 até 04/01" é a semana passada.
  const b = lerFunding('\t29/12 até 04/01\t05/01 até 11/01\n6\t10%\t11%\n12\t10,5%\t11,5%', '2027-01-05').tabela
  assert.deepEqual(b.map(v => [v.inicio, v.fim]), [['2027-01-05', '2027-01-11'], ['2026-12-29', '2027-01-04']])
  assert.equal(vigenciaDeHoje(b, '2027-01-05').inicio, '2027-01-05')
  // Data inválida e linha SELIC com número não viram prazo.
  assert.equal(lerFunding('\t11/24 - 11/30\n6\t10%\n12\t11%', '2026-11-25').ok, false)
  assert.deepEqual(lerFunding('6\t10%\n12\t11%\nSELIC\t15\t15%', '2026-11-25').tabela[0].taxas, { 6: 10, 12: 11 })
})

test('IOF financiado fecha mesmo quando o centavo alterna (2% a.m., 36x, carência de 20 dias)', () => {
  const r = cdcConta({ valorBem: 500000, valorLiberado: 500000, tarifas: 2523, taxa: 2, prazo: 36, carenciaDias: 20, inicio: '2026-11-25' })
  assert.ok(r.ok, r.error)
  assert.equal(r.principal, Math.round((r.base + r.iof) * 100) / 100)
  const diario = r.rows.reduce((s, x) => s + x.amortization * Math.min(x.days, 365) * 0.000082, 0)
  assert.ok(Math.abs(r.iofDiario - diario) <= 0.015, `${r.iofDiario} x ${diario}`)
  assert.equal(r.iofAdicional, Math.round(r.principal * 0.38) / 100)
  let falhas = 0
  for (const valor of [50000, 287500, 500000]) for (const taxa of [1.2, 1.39, 1.55, 2]) for (const prazo of [12, 24, 36, 48, 60]) for (const carenciaDias of [15, 20, 30, 45]) {
    const x = cdcConta({ valorBem: valor, valorLiberado: valor, tarifas: 2523, taxa, prazo, carenciaDias, inicio: '2026-11-25' })
    if (!x.ok && /centavos/.test(x.error)) falhas++
  }
  assert.equal(falhas, 0)
})
