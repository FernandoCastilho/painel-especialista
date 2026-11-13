import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
import { publicAgencySources } from '../src/sectorSourceVisibility.js'
import { EXPECTED_STUDIES } from '../scripts/sector-audio-release-lib.mjs'
const canonical = JSON.parse(readFileSync('../docs/sector-research/atacado.json', 'utf8'))
const studies = JSON.parse(readFileSync('src/sectorStudies/studies.json', 'utf8'))
const study = studies.find(study => study.group === 'atacado' && study.topicIndex === 5)

test('valve distribution is appended without changing existing catalog positions', () => {
  const group = CATALOGO_SETORIAL.find(group => group.id === 'atacado')
  assert.deepEqual(group.topics.slice(0, 5), ['Distribuição de alimentos','Distribuição de medicamentos','Distribuição de materiais de construção','Distribuição de insumos industriais','Distribuição de equipamentos'])
  assert.equal(group.topics[5], 'Distribuição de válvulas para óleo e gás')
  assert.equal(CATALOGO_SETORIAL.reduce((count, group) => count + group.topics.length, 0), 81)
  assert.equal(EXPECTED_STUDIES, 80)
  assert.equal(studies.length, EXPECTED_STUDIES)
  assert.equal(studies.filter(study => study.group === 'atacado' && study.topicIndex === 5).length, 1)
  assert.deepEqual(study, canonical[5])
})

test('valves scope distinguishes distribution, fuels, representation and services', () => {
  const prose = JSON.stringify([study.summary, study.sections, study.limitations, study.method])
  for (const term of ['Não é distribuição de combustíveis', 'Representação comercial', 'sob encomenda', 'retenções', 'Não foi encontrada uma série pública', 'consulta pública']) assert.ok(prose.includes(term), term)
  assert.equal(study.audio, undefined)
  assert.equal(study.canvasQuestions.length, 6)
  assert.ok(study.diagram.nodes.length >= 4)
  assert.equal(publicAgencySources(study.sources).length, study.sources.length)
  assert.doesNotMatch(prose, /Sotreq|Petrobras|Emerson|Flowserve|ASME|API 6D/)
})

test('every historical valve context chart point reconciles to all nonempty ANP rows in that year', () => {
  const csv = readFileSync('../docs/sector-research/evidence/valvulas/anp-tabela2-14.csv', 'utf8').trim().replace(/^\uFEFF/, '').split(/\r?\n/).slice(1).map(row => row.split(';'))
  const chart = study.charts[0]
  assert.deepEqual(chart.years, [2017,2018,2019,2020,2021,2022,2023,2024,2025])
  assert.match(chart.scope, /Não é mercado de válvulas/)
  const ledger = JSON.parse(readFileSync('../docs/sector-research/evidence/valvulas/numeric-ledger.json', 'utf8'))
  assert.equal(ledger.itemCount, ledger.items.length)
  for (const [index, year] of chart.years.entries()) {
    const rows = csv.filter(row => row[2] === String(year))
    assert.equal(rows.length, 17)
    assert.ok(rows.every(row => row[3] !== ''))
    assert.equal(new Set(rows.map(row => `${row[0]}/${row[1]}`)).size, 17)
    const calculated = Math.round(rows.reduce((sum, row) => sum + Number(row[3].replace(',', '.')), 0)) / 1000
    assert.equal(chart.series[0].values[index], calculated)
    assert.equal(ledger.items.find(item => item.id === `oil-${year}`).value, calculated)
  }
  assert.ok(csv.filter(row => row[2] === '2016').some(row => row[3] === ''))
})


test('global search does not label the published valve study as absent', () => {
  const search = readFileSync('src/searchCatalog.js', 'utf8')
  assert.doesNotMatch(search, /Tópico do catálogo setorial; estudo não incluído/)
  assert.match(search, /Abra o tópico para consultar o estudo ou o status da pesquisa/)
})


test('research charts reserve readable width and keep numeric values on one line', () => {
  const css = readFileSync('src/ResearchedSectorStudy.css', 'utf8')
  assert.match(css, /research-bar-row\{grid-template-columns:72px minmax\(0,1fr\) 112px\}/)
  assert.match(css, /research-bar-row strong\{white-space:nowrap;font-variant-numeric:tabular-nums\}/)
  const smoke = readFileSync('scripts/smoke-researched-sectors.cjs', 'utf8')
  assert.match(smoke, /value.lines === 1 && value.fits/)
})
