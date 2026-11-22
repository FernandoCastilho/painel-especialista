import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePastedCet } from '../src/rpnPastedCet.mjs'

test('cola duas colunas do Excel PT-BR e calcula 10% em 365 dias', () => {
  const result = calculatePastedCet({ releaseDate: '2025-01-01', net: 'R$ 1.000,00', payments: 'Vencimento\tValor\r\n01/01/2026\tR$ 1.100,00' })
  assert.equal(result.ok, true)
  assert.ok(Math.abs(result.annualRate - .1) < 1e-10)
  assert.equal(result.total, 1100)
  assert.equal(result.count, 1)
})
test('usa dias corridos e aceita parcelas fora de ordem na mesma data', () => {
  const result = calculatePastedCet({ releaseDate: '2025-01-01', net: '1000', payments: '2026-01-01;605,00\n01/01/2025;100,00' })
  assert.equal(result.ok, false)
  const valid = calculatePastedCet({ releaseDate: '2025-01-01', net: '1.000,00', payments: '01/01/2027;605,00\n01/01/2026;550,00' })
  assert.equal(valid.ok, true)
  assert.ok(Math.abs(valid.annualRate - .1) < 1e-10)
})
test('não produz taxa com entrada faltante, data inválida ou linhas ambíguas', () => {
  for (const v of [
    { releaseDate: '', net: '1000', payments: '01/01/2026\t1100' },
    { releaseDate: '2025-01-01', net: '1000', payments: '31/02/2026\t1100' },
    { releaseDate: '2025-01-01', net: '1000', payments: '01/01/2026\t1100\n01/02/2026\t-90' },
    { releaseDate: '2025-01-01', net: '1000', payments: '01/01/2026\t1100\t2' },
    { releaseDate: '2025-01-01', net: '1000', payments: '01/01/2026\t990' },
  ]) assert.equal(calculatePastedCet(v).ok, false)
})
test('aceita zero por cento e várias obrigações no mesmo vencimento', () => {
  const result = calculatePastedCet({ releaseDate: '2025-01-01', net: '1.000,00', payments: '2026-01-01;500,00\n2026-01-01;500,00' })
  assert.equal(result.ok, true)
  assert.equal(result.annualRate, 0)
  assert.equal(result.count, 2)
})

test('inclui TAC e fee pagos na liberação sem modificar a lista de parcelas', () => {
  const result = calculatePastedCet({ releaseDate: '2025-01-01', net: '1.000,00', costs: '50,00', payments: '01/01/2026\t1045,00' })
  assert.equal(result.ok, true)
  assert.equal(result.netAfterCosts, 950)
  assert.ok(Math.abs(result.annualRate - .1) < 1e-10)
  assert.equal(calculatePastedCet({ releaseDate: '2025-01-01', net: '100', costs: '100', payments: '01/01/2026\t200' }).ok, false)
})
test('não arredonda dias de calendário nem inclui juros e tarifas de novo', () => {
  const result = calculatePastedCet({ releaseDate: '2026-01-01', net: '1000', payments: '31/01/2026\t1010' })
  assert.equal(result.ok, true)
  assert.ok(Math.abs(result.annualRate - Math.expm1(Math.log(1.01) * 365 / 30)) < 1e-10)
})
