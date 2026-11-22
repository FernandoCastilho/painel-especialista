// Ajustes do Capital de Giro de 22/11/2026: prazo padrão de 36 meses, gráfico de juros até o prazo digitado e fluxo de pagamentos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { giroConta } from '../src/giroConta.js'
import { fluxoMensal, mesDaOperacao, rotuloDoMes } from '../src/fluxoPagamentos.js'
import { faixaDaCurva, mesesDoEixo } from '../src/faixaCurva.js'
import { lmDefaults, lmSanitize } from '../src/linhaMestra.js'

const base = { value: 3000000, rate: 2, unit: 'am', start: '2026-11-22', calendars: ['BR'], fees: 0 }

test('prazo padrão próprio: 36 meses no Capital de Giro, 24 nas demais; o que foi digitado vale', () => {
  assert.equal(lmDefaults('2026-11-22').term, '24')
  assert.equal(lmDefaults('2026-11-22', { term: '36' }).term, '36')
  assert.equal(lmSanitize(null, '2026-11-22', { term: '36' }).term, '36')
  assert.equal(lmSanitize({ term: '18' }, '2026-11-22', { term: '36' }).term, '18')
})

test('gráfico de juros termina no prazo digitado; sem prazo válido, 12 a 48 meses', () => {
  assert.deepEqual(faixaDaCurva(36), { de: 12, ate: 36, propria: true })
  assert.deepEqual(faixaDaCurva(6), { de: 0, ate: 6, propria: true })
  assert.deepEqual(faixaDaCurva(undefined), { de: 12, ate: 48, propria: false })
  assert.deepEqual(mesesDoEixo(12, 48), [12, 18, 24, 30, 36, 42, 48])
  assert.deepEqual(mesesDoEixo(12, 36), [12, 18, 24, 30, 36])
  assert.deepEqual(mesesDoEixo(0, 6), [0, 1, 2, 3, 4, 5, 6])
  for (const [de, ate] of [[12, 13], [12, 25], [12, 120], [0, 1]]) {
    const meses = mesesDoEixo(de, ate)
    assert.equal(meses.at(-1), ate, 'sempre termina no prazo')
    assert.ok(meses.length <= 7 && meses.every((m, i) => i === 0 || m > meses[i - 1]))
  }
})

test('fluxo bimestral em 48 meses: 48 meses no eixo, barra só nos meses de pagamento, valores do cronograma', () => {
  const result = giroConta({ ...base, n: 24, periodicidade: 2, system: 'price', firstDue: '2027-01-22' })
  assert.ok(result.ok, result.error)
  const meses = fluxoMensal(result.rows, base.start)
  assert.equal(meses.length, 48)
  assert.deepEqual(meses.filter(m => m.linhas.length).map(m => m.mes), Array.from({ length: 24 }, (_, i) => 2 * (i + 1)))
  assert.ok(meses.filter(m => !m.linhas.length).every(m => m.pagamento === 0 && m.juros === 0))
  // Nada é refeito: a soma das barras é o total das parcelas e cada barra é a linha do cronograma.
  assert.equal(Math.round(meses.reduce((t, m) => t + m.pagamento, 0) * 100), Math.round(result.paid * 100))
  const segunda = meses[3]
  assert.equal(segunda.pagamento, result.rows[1].payment)
  assert.equal(segunda.juros, result.rows[1].interest)
  assert.equal(meses[0].rotulo, 'dez/26')
  assert.equal(meses.at(-1).rotulo, 'nov/30')
})

test('cada barra: pagamento = juros + amortização, em Price, SAC, carência com juros pagos e Bullet', () => {
  for (const extra of [{ system: 'price', n: 36 }, { system: 'sac', n: 36 }, { system: 'price', n: 8, periodicidade: 3, jurosNaCarencia: true, firstDue: '2027-08-23' },
    { system: 'bullet', n: 1, periodicidade: 3, firstDue: '2027-11-22' }]) {
    const result = giroConta({ ...base, firstDue: extra.firstDue ?? '2026-12-22', ...extra })
    assert.ok(result.ok, `${JSON.stringify(extra)}: ${result.error}`)
    if (extra.jurosNaCarencia || extra.system === 'bullet') assert.ok(result.rows.some(row => row.juros), 'tem pagamentos só de juros')
    for (const m of fluxoMensal(result.rows, base.start)) {
      if (!m.linhas.length) continue
      assert.ok(Math.abs(m.pagamento - m.juros - m.amortizacao) < 0.005, `${JSON.stringify(extra)} mês ${m.mes}`)
    }
  }
})

test('mês da operação pelos dias corridos: vencimento empurrado para o dia útil seguinte fica no mesmo mês', () => {
  assert.equal(mesDaOperacao('2026-01-31', '2026-03-02'), 1)
  assert.equal(mesDaOperacao('2026-11-22', '2026-12-22'), 1)
  assert.equal(mesDaOperacao('2026-11-22', '2028-11-22'), 24)
  assert.equal(rotuloDoMes('2026-11-22', 2), 'jan/27')
  assert.deepEqual(fluxoMensal([], '2026-11-22'), [])
})
