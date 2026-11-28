import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseTaxas, median, pct, brDate, matchesBank, modalityLabel, bankBrand, rankRows, TAXAS_SEGMENTS } from '../src/taxasJuros.js'
import { indexSearchData } from '../src/globalSearch.js'
import { CEN_VIEWS } from '../src/cenariosViews.js'

const period = { inicio: '2026-11-06', fim: '2026-11-12' }
const row = (Modalidade, InstituicaoFinanceira, TaxaJurosAoMes, TaxaJurosAoAno) => ({ Modalidade, InstituicaoFinanceira, TaxaJurosAoMes, TaxaJurosAoAno })
const GIRO = TAXAS_SEGMENTS[0].defaultModality

test('Juros bancários fica em Cenários, logo depois de Projeções e antes do Calendário econômico', () => {
  const ids = CEN_VIEWS.map(v => v.id)
  assert.deepEqual(ids.slice(0, 3), ['projecoes', 'juros-bancarios', 'calendario'])
  assert.equal(CEN_VIEWS[1].label, 'Juros bancários')
})

test('taxas do BC ficam agrupadas por modalidade, da menor para a maior taxa, na ordem fixa das modalidades', () => {
  const data = parseTaxas([
    row('Vendor - Prefixado', 'BANCO B', 1.5, 19.56),
    row(GIRO, 'BANCO C', 2.1, 28.32),
    row(GIRO, 'BANCO A', 1.17, 15.04),
    row('Modalidade nova - Prefixado', 'BANCO D', 3, 42.58),
  ], period)
  assert.deepEqual(data.period, period)
  assert.deepEqual(data.modalities.map(m => m.name), [GIRO, 'Vendor - Prefixado', 'Modalidade nova - Prefixado'])
  assert.deepEqual(data.modalities[0].rows, [['BANCO A', 1.17, 15.04], ['BANCO C', 2.1, 28.32]])
  assert.equal(modalityLabel('Modalidade nova - Prefixado'), 'Modalidade nova - Prefixado')
  assert.equal(modalityLabel(GIRO), 'Capital de giro acima de 365 dias · pré')
})

test('resposta vazia, linha incompleta, taxa fora da faixa ou período inválido não substituem a base', () => {
  assert.throws(() => parseTaxas([], period), /sem taxas/)
  assert.throws(() => parseTaxas([row(GIRO, '', 1, 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(GIRO, 'BANCO', 'x', 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(GIRO, 'BANCO', 120, 12)], period), /inválida/)
  assert.throws(() => parseTaxas([row(GIRO, 'BANCO', 1, 12)], { inicio: '2026-11-12', fim: '2026-11-06' }), /Período/)
})

test('mediana, posição com empate, porcentagem com duas casas, data brasileira e busca sem acento', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([1, 2, 3, 4]), 2.5)
  assert.equal(median([]), null)
  assert.deepEqual(rankRows([['A', 1, 12], ['B', 1, 12], ['C', 2, 26]]).map(r => r.pos), [1, 1, 3])
  assert.equal(pct(1.2), '1,20%')
  assert.equal(pct(450.47), '450,47%')
  assert.equal(pct(null), '—')
  assert.equal(brDate('2026-11-06'), '06/11/2026')
  assert.ok(matchesBank('ITAÚ UNIBANCO S.A.', ' itau '))
  assert.ok(matchesBank('BCO DO ESTADO DO RS S.A.', 'banrisul'))
  assert.ok(matchesBank('BCO DO BRASIL S.A.', ''))
  assert.ok(!matchesBank('BCO SAFRA S.A.', 'itau'))
})

test('marca de cada banco: logotipo dos grandes, iniciais para os demais, sem destaque para nenhum', () => {
  const logos = ['ITAÚ UNIBANCO S.A.', 'BCO DO BRASIL S.A.', 'BCO BRADESCO S.A.', 'BCO SANTANDER (BRASIL) S.A.', 'CAIXA ECONOMICA FEDERAL', 'BCO SAFRA S.A.', 'BANCO BTG PACTUAL S.A.']
  for (const name of logos) { const b = bankBrand(name); assert.ok(b.logo?.startsWith('bank-logos/') && b.major, name) }
  assert.equal(bankBrand('BCO DAYCOVAL S.A').major, false)
  assert.equal(bankBrand('BCO DO ESTADO DO RS S.A.').short, 'Banrisul')
  assert.deepEqual([bankBrand('BCO PINE S.A.').initials, bankBrand('ZEMA CFI S/A').initials, bankBrand('BCO DO NORDESTE DO BRASIL S.A.').initials], ['PI', 'ZE', 'BN'])
  assert.equal(bankBrand('BCO PINE S.A.').logo, null)
})

test('base inicial do BC: janela de 06/11 a 12/11/2026, empresas (12 modalidades) e pessoas (10), taxas coerentes', async () => {
  const data = JSON.parse(await readFile(new URL('../public/taxas-juros.json', import.meta.url), 'utf8'))
  assert.ok(data.generatedAt)
  assert.deepEqual(data.segments.map(s => [s.id, s.label]), [['pj', 'Empresas'], ['pf', 'Pessoas']])
  const [pj, pf] = data.segments
  for (const s of data.segments) assert.deepEqual(s.period, period)
  assert.equal(pj.modalities.length, 12)
  assert.equal(pj.modalities.reduce((n, m) => n + m.rows.length, 0), 333)
  assert.equal(pf.modalities.length, 10)
  assert.equal(pf.modalities.reduce((n, m) => n + m.rows.length, 0), 449)
  for (const s of data.segments) for (const m of s.modalities) {
    assert.ok(m.rows.every(([bank, am, aa], i) => bank && am >= 0 && aa >= am && (i === 0 || am >= m.rows[i - 1][1])), m.name)
  }
  assert.deepEqual(pj.modalities.find(m => m.name === GIRO).rows[0], ['BCO DO NORDESTE DO BRASIL S.A.', 1.17, 15.04])
  for (const s of TAXAS_SEGMENTS) assert.ok(data.segments.find(x => x.id === s.id).modalities.some(m => m.name === s.defaultModality), s.id)
})

test('busca do painel: um resultado por público e modalidade, que abre a tela já nele', async () => {
  const data = JSON.parse(await readFile(new URL('../public/taxas-juros.json', import.meta.url), 'utf8'))
  const { docs } = indexSearchData('taxas-juros.json', data, 'cenarios/juros-bancarios', 'Juros bancários')
  assert.equal(docs.length, 22)
  const giro = docs.find(d => d.context?.segment === 'pj' && d.context?.modality === GIRO)
  assert.equal(giro.route, 'cenarios/juros-bancarios')
  assert.match(giro.title, /Juros bancários · Empresas · Capital de giro acima de 365 dias/)
  assert.match(giro.body, /Banco do Nordeste/)
})

test('coletor busca empresas e pessoas, não volta para janela anterior e preserva cada público com aviso em falha', async () => {
  const source = await readFile(new URL('../scripts/fetch-taxas-juros.mjs', import.meta.url), 'utf8')
  assert.match(source, /TAXAS_SEGMENTS/)
  assert.match(source, /janela anterior à preservada/)
  assert.match(source, /stale: true, error: error\.message/)
  assert.match(source, /AbortSignal\.timeout\(25000\)/)
})
