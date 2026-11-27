import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseTaxas, median, pct, brDate, matchesBank, modalityLabel, DEFAULT_MODALITY } from '../src/taxasJuros.js'

const period = { inicio: '2026-11-06', fim: '2026-11-12' }
const row = (Modalidade, InstituicaoFinanceira, TaxaJurosAoMes, TaxaJurosAoAno) => ({ Modalidade, InstituicaoFinanceira, TaxaJurosAoMes, TaxaJurosAoAno })

test('taxas do BC ficam agrupadas por modalidade, da menor para a maior taxa, na ordem fixa das modalidades', () => {
  const data = parseTaxas([
    row('Vendor - Prefixado', 'BANCO B', 1.5, 19.56),
    row(DEFAULT_MODALITY, 'BANCO C', 2.1, 28.32),
    row(DEFAULT_MODALITY, 'BANCO A', 1.17, 15.04),
    row('Modalidade nova - Prefixado', 'BANCO D', 3, 42.58),
  ], period)
  assert.deepEqual(data.period, period)
  assert.deepEqual(data.modalities.map(m => m.name), [DEFAULT_MODALITY, 'Vendor - Prefixado', 'Modalidade nova - Prefixado'])
  assert.deepEqual(data.modalities[0].rows, [['BANCO A', 1.17, 15.04], ['BANCO C', 2.1, 28.32]])
  assert.equal(modalityLabel('Modalidade nova - Prefixado'), 'Modalidade nova - Prefixado')
  assert.equal(modalityLabel(DEFAULT_MODALITY), 'Capital de giro acima de 365 dias · pré')
})

test('resposta vazia, linha incompleta, taxa fora da faixa ou período inválido não substituem a base', () => {
  assert.throws(() => parseTaxas([], period), /sem taxas/)
  assert.throws(() => parseTaxas([row(DEFAULT_MODALITY, '', 1, 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(DEFAULT_MODALITY, 'BANCO', 'x', 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(DEFAULT_MODALITY, 'BANCO', 120, 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(DEFAULT_MODALITY, 'BANCO', 1, 12)], { inicio: '2026-11-12', fim: '2026-11-06' }), /Período/)
})

test('mediana, porcentagem com vírgula e duas casas, data brasileira e busca sem acento', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([]), null)
  assert.equal(pct(1.2), '1,20%')
  assert.equal(pct(450.47), '450,47%')
  assert.equal(pct(null), '—')
  assert.equal(brDate('2026-11-06'), '06/11/2026')
  assert.ok(matchesBank('ITAÚ UNIBANCO S.A.', ' itau '))
  assert.ok(matchesBank('BCO DO BRASIL S.A.', ''))
  assert.ok(!matchesBank('BCO SAFRA S.A.', 'itau'))
})

test('base inicial do BC: janela de 06/11 a 12/11/2026, 12 modalidades PJ e taxas coerentes', async () => {
  const data = JSON.parse(await readFile(new URL('../public/taxas-juros.json', import.meta.url), 'utf8'))
  assert.ok(data.generatedAt)
  assert.deepEqual(data.period, period)
  assert.equal(data.modalities.length, 12)
  assert.equal(data.modalities.reduce((n, m) => n + m.rows.length, 0), 333)
  for (const m of data.modalities) {
    assert.ok(m.rows.every(([bank, am, aa], i) => bank && am >= 0 && aa >= am && (i === 0 || am >= m.rows[i - 1][1])), m.name)
  }
  assert.deepEqual(data.modalities.find(m => m.name === DEFAULT_MODALITY).rows[0], ['BCO DO NORDESTE DO BRASIL S.A.', 1.17, 15.04])
})

test('coletor busca só pessoa jurídica, não volta para janela anterior e preserva a base com aviso em falha', async () => {
  const source = await readFile(new URL('../scripts/fetch-taxas-juros.mjs', import.meta.url), 'utf8')
  assert.match(source, /TAXAS_SEGMENT/)
  assert.match(source, /janela anterior à preservada/)
  assert.match(source, /stale: true, error: error\.message/)
  assert.match(source, /AbortSignal\.timeout\(25000\)/)
})
