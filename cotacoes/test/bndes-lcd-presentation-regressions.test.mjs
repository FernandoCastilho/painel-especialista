import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import { groupRows } from '../src/moedas.js'
import * as viewModel from '../src/bndesView.js'
import * as snapshot from '../src/lcdOfficialSnapshot.js'
import * as route from '../src/bndesRoute.js'
import * as format from '../src/format.js'
import * as tlp from '../src/tlp.js'

const NOW = Date.parse('2026-11-05T15:00:00Z')
const lcdRow = (points) => groupRows({ series: { LD1: { points } } }, 'moedas', NOW).find(row => row.id === 'LD1')
const official = snapshot.withOfficialLcdSnapshot(null)

test('LD1: mudança entre julho e outubro não é apresentada como Dia, Mês ou Ano', () => {
  const row = groupRows(official, 'moedas', NOW).find(row => row.id === 'LD1')
  assert.deepEqual([row.day, row.month, row.year], [null, null, null])
  assert.equal(row.lastChange.ref, '2026-07-01')
  assert.equal(row.lastChange.date, '2026-10-01')
  assert.ok(Math.abs(row.lastChange.diff - 0.02) < 1e-12)
  assert.equal(row.lastChange.text, '▲ +0,020000 p.p.')
  assert.equal(row.lastChange.jump, false)
  assert.deepEqual(viewModel.familyRows('moedas', null, official, NOW).find(r => r.id === 'LD1').lastChange, row.lastChange)
})

test('LD1: última mudança efetiva ignora republicação igual e vigência futura', () => {
  const row = lcdRow([['2026-01-01', -0.11], ['2026-04-01', -0.13], ['2026-07-01', -0.13], ['2027-01-01', 8]])
  assert.equal(row.date, '2026-07-01')
  assert.equal(row.lastChange.ref, '2026-01-01')
  assert.equal(row.lastChange.date, '2026-04-01')
  assert.equal(row.lastChange.text, '▼ −0,020000 p.p.')
})

test('LD1: ausência, uma vigência, estabilidade e mudança pequena não viram dado fabricado', () => {
  assert.equal(lcdRow([]).missing, true)
  assert.equal(lcdRow([['2026-01-01', 0]]).lastChange, null)
  assert.equal(lcdRow([['2026-01-01', 0], ['2026-04-01', 0]]).lastChange, null)
  const small = lcdRow([['2026-01-01', 0], ['2026-04-01', -0.000001]])
  assert.equal(small.lastChange.text, '▼ −0,000001 p.p.')
  assert.equal(small.lastChange.dir, 'down')
})

test('outras moedas e TFC preservam suas variações e não recebem última mudança LD1', () => {
  const points = [['2025-11-04', 100], ['2026-10-04', 110], ['2026-11-03', 119], ['2026-11-04', 120]]
  const data = { series: Object.fromEntries(['143', '604', '024', 'C01'].map(id => [id, { points }])) }
  for (const row of [...groupRows(data, 'moedas', NOW), ...groupRows(data, 'tfc', NOW)].filter(row => !row.missing)) {
    assert.equal(row.day.ref, '2026-11-03')
    assert.equal(row.month.ref, '2026-10-04')
    assert.equal(row.year.ref, '2025-11-04')
    assert.equal(Object.hasOwn(row, 'lastChange'), false)
  }
})

// Renderização React offline da tabela real. Fontes e gráficos são substitutos
// locais; nenhum hook de coleta, transporte de rede, navegador ou socket roda.
const require = createRequire(import.meta.url)
const React = require('react')
const source = (await readFile(new URL('../src/Bndes.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const children = ({ children }) => React.createElement('section', null, children)
const nullComponent = { __esModule: true, default: () => null }
const FixedDate = class extends Date { static now() { return NOW } }
function html(family, moedas, bndes = { status: 'error', error: 'bndes indisponível' }) {
  const imports = {
    react: { ...React, useMemo: fn => fn(), useState: initial => [initial, () => {}] },
    './Avisos.jsx': { Aviso: children },
    './Estado.jsx': { __esModule: true, default: ({ tipo, erro, children }) => React.createElement('section', { 'data-state': tipo }, erro, children) },
    './ChartFilters.jsx': { FilterScope: children },
    './BndesCompare.jsx': nullComponent,
    './BndesChart.jsx': nullComponent,
    './TerminalDesk.jsx': { Panel: children },
    './useDataFile.js': { useDataFile: file => file === 'bndes.json' ? bndes : moedas },
    './useCurves.js': { useCurves: () => ({ data: null }) },
    './format.js': format, './bndesView.js': viewModel, './bndesRoute.js': route,
    './tlp.js': tlp, './lcdOfficialSnapshot.js': snapshot,
  }
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, Date: FixedDate, URL, window: { location: { href: 'https://example.invalid/painel/' } }, require: name => imports[name] || require(name) })
  return renderToStaticMarkup(module.exports.default({ view: family }))
}
const failed = { status: 'error', error: 'HTTP 503', data: null }

test('TFC conserva erro de moedas.json apesar do snapshot LD1 disponível', () => {
  const result = html('tfc/C01', failed)
  assert.match(result, /data-state="erro"/)
  assert.match(result, /HTTP 503/)
  assert.doesNotMatch(result, /class="bn-table bn-main"/)
  assert.doesNotMatch(result, /Última mudança/)
})

test('Moedas conserva snapshot, aviso de falha e mudança LD1 com ambas as datas', () => {
  const result = html('moedas/LD1', failed)
  assert.doesNotMatch(result, /data-state="erro"/)
  assert.match(result, /Não foi possível atualizar as moedas contratuais/)
  assert.match(result, /-0,110000% a\.a\./)
  assert.match(result, /Última mudança:/)
  assert.match(result, /01\/07\/2026 e 01\/10\/2026/)
  assert.match(result, /as colunas Dia, Mês e Ano não se aplicam/)
  const row = result.match(/<tr class="bn-on">([\s\S]*?)<\/tr>/)?.[1]
  assert.ok(row)
  const variationCells = row.slice(row.indexOf('</th>') + 5)
  assert.equal((variationCells.match(/<span class="muted">—<\/span>/g) || []).length, 3)
  assert.match(row, /bn-reference-date/)
  assert.doesNotMatch(row, /bn-delta|0,020000/)
})

test('TFC com dado anterior continua visível e recuperação não mantém erro antigo', () => {
  const data = { series: { C01: { points: [['2026-11-04', 12.5]] } } }
  const stale = html('tfc/C01', { status: 'ok', stale: true, error: 'HTTP 503', data })
  assert.doesNotMatch(stale, /data-state="erro"/)
  assert.match(stale, /12,50% a\.a\./)
  assert.match(stale, /Não foi possível atualizar as séries TFC/)
  assert.match(html('tfc/C01', failed), /data-state="erro"/)
  const recovered = html('tfc/C01', { status: 'ok', data })
  assert.doesNotMatch(recovered, /data-state="erro"/)
  assert.match(recovered, /12,50% a\.a\./)
  assert.doesNotMatch(recovered, /Não foi possível atualizar as séries TFC/)
})

test('falhas TFB e TLP não são mascaradas pelo snapshot de outra fonte', () => {
  for (const family of ['tfb/TFB_60_90', 'tlp/TLP']) {
    const result = html(family, { status: 'ok', data: official })
    assert.match(result, /data-state="erro"/)
    assert.match(result, /bndes indisponível/)
  }
})

test('TFB/TLP retidas avisam falha da própria fonte e a recuperação limpa o aviso', () => {
  const data = { series: { TFB_60_90: { prazo: 60, liberacao: 90, points: [['2026-11-04', 10.5]] } }, tlp: { points: [['2026-11-01', 6.9]] } }
  for (const [family, label, value] of [['tfb/TFB_60_90', 'TFB', /10,50% a\.a\./], ['tlp/TLP', 'TLP', /6,90% a\.a\./]]) {
    const retained = html(family, failed, { status: 'ok', stale: true, error: 'HTTP 503', data })
    assert.doesNotMatch(retained, /data-state="erro"/)
    assert.match(retained, value)
    assert.match(retained, new RegExp(`Não foi possível atualizar as séries ${label}`))
    const recovered = html(family, failed, { status: 'ok', data })
    assert.match(recovered, value)
    assert.doesNotMatch(recovered, /Não foi possível atualizar as séries TFB|Não foi possível atualizar as séries TLP/)
  }
  const otherFamily = html('moedas/LD1', { status: 'ok', data: official }, { status: 'ok', stale: true, error: 'HTTP 503', data })
  assert.doesNotMatch(otherFamily, /Não foi possível atualizar as séries TFB|Não foi possível atualizar as séries TLP/)
})

test('BNDES: dois acessos oficiais continuam disponíveis em todas as famílias e com falha das fontes', () => {
  const destinations = [
    ['Materiais Industrializados', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados'],
    ['Máquinas e Equipamentos', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-finame-bk-aquisicao-comercializacao'],
  ]
  for (const family of ['tfb/TFB_60_90', 'tlp/TLP', 'tfc/C01', 'moedas/LD1']) {
    const navigation = html(family, failed).match(/<nav class="bn-official-links" aria-label="Linhas oficiais BNDES">([\s\S]*?)<\/nav>/)?.[1]
    assert.ok(navigation, `Acessos oficiais ausentes em ${family}`)
    assert.equal((navigation.match(/<a /g) || []).length, 2)
    for (const [label, href] of destinations) {
      const anchor = navigation.match(new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"([^>]*)>([\\s\\S]*?)<\\/a>`))
      assert.ok(anchor, `${label}: destino oficial incorreto`)
      assert.match(anchor[1], /target="_blank"/)
      assert.match(anchor[1], /rel="noopener noreferrer"/)
      assert.ok(anchor[2].includes(label))
      assert.ok(anchor[2].includes('abre em nova aba'))
    }
  }
})
