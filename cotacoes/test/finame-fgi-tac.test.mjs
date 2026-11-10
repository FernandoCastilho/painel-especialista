import test from 'node:test'
import assert from 'node:assert/strict'
import { FGI, ecgFgi, fatorKFgi, periodos30, periodos30Datas, simular } from '../src/finameMateriais.js'

const base = { valor: 500000, participacao: 100, prazo: 60, carencia: 12, custo: 'tfc', custoFinanceiro: 12, taxaBndes: 1.25, taxaAgente: 3, sistema: 'sac', periodicidade: 3, composicao: 'capitalizada' }
const perto = (a, b, d = 0.005) => assert.ok(Math.abs(a - b) < d, `${a} ≠ ${b}`)

test('fator K do FGI segue a tabela do Anexo V (Circular SUP/ADIG 65/2026) nas bordas de cada faixa', () => {
  const esperado = [[1, 1.42], [3, 1.42], [4, 0.62], [6, 0.62], [7, 0.42], [12, 0.31], [13, 0.27], [24, 0.20], [36, 0.15], [37, 0.14], [39, 0.14], [40, 0.13], [45, 0.13], [46, 0.12], [48, 0.12], [49, 0.11], [60, 0.10], [61, 0.09], [69, 0.09], [70, 0.08], [78, 0.08], [79, 0.07], [84, 0.07], [90, 0.07], [91, 0.06], [102, 0.06], [103, 0.05], [120, 0.05]]
  for (const [prazo, k] of esperado) assert.equal(fatorKFgi(prazo), k, `prazo ${prazo}`)
})

test('ECG à vista = %G × K × VL × P; incorporado = mesma conta dividida por (1 − %G × K × P)', () => {
  const aVista = ecgFgi({ valor: 500000, percentual: 80, prazo: 60, periodos: 60, incorporar: false })
  perto(aVista.ecg, 0.8 * 0.001 * 500000 * 60) // 24.000,00
  const incorporado = ecgFgi({ valor: 500000, percentual: 80, prazo: 60, periodos: 60, incorporar: true })
  perto(incorporado.ecg, (0.8 * 0.001 * 500000 * 60) / (1 - 0.8 * 0.001 * 60)) // 25.210,08
  // O incorporado é o ECG sobre (valor + ECG): %G × K × P × (VL + ECG)
  perto(incorporado.ecg, 0.8 * 0.001 * 60 * (500000 + incorporado.ecg), 0.01)
  assert.equal(periodos30(60), 60)
  assert.equal(periodos30(84), 85)
})

test('sem TAC e sem FGI o resultado é o mesmo de antes', () => {
  const antes = simular(base)
  const comZeros = simular({ ...base, tac: 0, fgi: null })
  assert.equal(comZeros.total, antes.total)
  assert.equal(comZeros.tac, 0)
  assert.equal(comZeros.fgi, null)
})

test('TAC entra no pagamento final à vista, sem mexer em juros nem no cronograma', () => {
  const sem = simular(base), com = simular({ ...base, tac: 2600 })
  perto(com.total - sem.total, 2600)
  assert.equal(com.juros, sem.juros)
  assert.equal(com.parcelas.length, sem.parcelas.length)
  assert.equal(com.tac, 2600)
})

test('FGI pago à vista soma o ECG ao pagamento final e não altera juros', () => {
  const sem = simular(base)
  const com = simular({ ...base, fgi: { percentual: 80, incorporar: false, periodos: 60 } })
  assert.equal(com.fgi.incorporado, false)
  perto(com.fgi.ecg, 24000)
  perto(com.total - sem.total, 24000)
  assert.equal(com.juros, sem.juros)
  assert.equal(com.financiado, sem.financiado)
})

test('FGI incorporado entra no saldo devedor, rende juros e fecha com o total', () => {
  const sem = simular(base)
  const com = simular({ ...base, fgi: { percentual: 80, incorporar: true, periodos: 60 } })
  assert.equal(com.fgi.incorporado, true)
  perto(com.fgi.ecg, 25210.08)
  perto(com.financiado, 500000 + com.fgi.ecg) // principal do cronograma
  assert.equal(com.liberado, 500000)
  assert.ok(com.juros > sem.juros)
  perto(com.total, com.financiado + com.correcao + com.juros + com.iof)
  assert.equal(com.recursosProprios, 0) // o ECG financiado não conta como recurso próprio
  assert.ok(com.parcelas.at(-1).saldo === 0)
})

test('entradas inválidas de TAC e FGI são recusadas com mensagem', () => {
  assert.equal(simular({ ...base, tac: -1 }).ok, false)
  assert.equal(simular({ ...base, tac: Number.NaN }).ok, false)
  for (const percentual of [0, 9.9, 15, 75, 80.1, 100, Number.NaN]) {
    const r = simular({ ...base, fgi: { percentual, incorporar: true } })
    assert.equal(r.ok, false, `percentual ${percentual}`)
    assert.match(r.erros.join(' '), /percentual garantido pelo FGI/)
  }
  assert.equal(FGI.percentualMin, 10)
  assert.equal(FGI.percentualMax, 80)
})

test('P do ECG com data fixa: liberação em 09/11/2026, 60 meses, último vencimento dia 15', () => {
  // 09/11/2026 até 15/11/2031 = 1832 dias; 61 períodos completos de 30 dias. O motor aceita o P calculado pela tela.
  const dias = Math.round((Date.UTC(2031, 10, 15) - Date.UTC(2026, 10, 9)) / 86400000)
  assert.equal(Math.floor(dias / 30), 61)
  const r = simular({ ...base, fgi: { percentual: 80, incorporar: false, periodos: 61 } })
  assert.equal(r.fgi.periodos, 61)
  perto(r.fgi.ecg, 0.8 * 0.001 * 500000 * 61)
  // P zero (prazo menor que 30 dias) dá ECG zero, sem erro.
  assert.equal(ecgFgi({ valor: 500000, percentual: 80, prazo: 1, periodos: 0, incorporar: true }).ecg, 0)
})

test('periodos30Datas conta períodos completos de 30 dias entre as datas (como o P da tela)', () => {
  const d = (y, m, dia) => new Date(y, m - 1, dia, 12)
  assert.equal(periodos30Datas(d(2026, 11, 9), d(2031, 11, 15)), 61) // sábado: o vencimento real é o próximo dia útil (17/11/2031), mesmo P
  assert.equal(periodos30Datas(d(2026, 11, 9), d(2031, 11, 17)), 61)
  assert.equal(periodos30Datas(d(2026, 11, 9), d(2026, 12, 15)), 1)
  assert.equal(periodos30Datas(d(2026, 11, 9), d(2026, 11, 20)), 0)
  assert.equal(periodos30Datas(d(2026, 11, 20), d(2026, 11, 9)), 0) // nunca negativo
})

test('FGI só aceita percentual garantido em múltiplos de 10 (art. 15 do Regulamento do FGI Tradicional)', () => {
  for (const percentual of [10, 20, 30, 40, 50, 60, 70, 80]) assert.equal(simular({ ...base, fgi: { percentual, incorporar: false } }).ok, true, `percentual ${percentual}`)
  assert.equal(FGI.percentualMultiplo, 10)
})

test('FGI limita o crédito garantido a R$ 20 milhões por cliente em cada agente', () => {
  assert.equal(FGI.limiteCredito, 20_000_000)
  const noLimite = simular({ ...base, valor: 20_000_000, fgi: { percentual: 80, incorporar: false, periodos: 60 } })
  assert.equal(noLimite.ok, true)
  const acima = simular({ ...base, valor: 20_000_000.01, fgi: { percentual: 80, incorporar: false, periodos: 60 } })
  assert.equal(acima.ok, false)
  assert.match(acima.erros.join(' '), /limitado a R\$\s*20\.000\.000,00 por cliente/)
  // ECG incorporado entra no crédito contratado: R$ 20 milhões liberados passam do limite quando o ECG é financiado.
  assert.equal(simular({ ...base, valor: 20_000_000, fgi: { percentual: 80, incorporar: true, periodos: 60 } }).ok, false)
  // Sem FGI não há esse limite.
  assert.equal(simular({ ...base, valor: 25_000_000 }).ok, true)
})

test('FGI é recusado em linha com TLP capitalizada (vedação do Anexo I do Regulamento)', () => {
  const tlp = { ...base, custo: 'tlp', perfilTlp: 'tlpcap', custoFinanceiro: 7, ipca: 4 }
  assert.equal(simular(tlp).ok, true)
  const r = simular({ ...tlp, fgi: { percentual: 80, incorporar: false } })
  assert.equal(r.ok, false)
  assert.match(r.erros.join(' '), /Retire a garantia do FGI: esta linha usa TLP capitalizada/)
  assert.match(FGI.vedacoes, /TLP capitalizada.*Selic capitalizada.*TR capitalizada.*TFBD.*capitalização de juros na carência/)
})
