import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import * as schema from '../src/sectorStudySchema.js'
const require = createRequire(import.meta.url)
const studies = JSON.parse(await readFile(new URL('../src/sectorStudies/studies.json', import.meta.url), 'utf8'))
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : []

test('validador aceita os 67 estudos e rejeita identidade/esquema incompletos em campos usados', () => {
  for (const study of studies) assert.equal(schema.validSectorStudy(study, study.group, study.topicIndex), true, study.title)
  const study = studies[0], valid = value => schema.validSectorStudy(value, study.group, study.topicIndex)
  assert.equal(valid({ group: study.group, topicIndex: study.topicIndex }), false)
  assert.equal(valid({ ...study, group: 'outra' }), false)
  for (const patch of [{ summary: {} }, { sections: [{ id: 'x', title: 'X', rows: [[]] }] }, { canvasQuestions: null }, { charts: [{ ...study.charts[0], series: [] }] }, { diagram: { nodes: [], edges: [{}] } }]) assert.equal(valid({ ...study, ...patch }), false)
})

test('loader real apresenta carregamento, erro seguro, nova tentativa e só aprova refresh válido', async () => {
  let state = { status: 'loading' }, next, lastRequest
  const study = studies[0], group = { id: study.group, label: 'Grupo', topics: [study.title] }
  const Refresh = () => null, Renderer = () => null
  const source = await readFile(new URL('../src/SectorStudyLoader.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' }), module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === './sectorStudySchema.js') return schema
    if (name === './useDataFile.js') return { useDataFile: () => state, loadDataFile: async (...args) => { lastRequest = args; state = next; return next } }
    if (name === './ResearchedSectorStudy.jsx') return Renderer
    if (name === './RefreshButton.jsx') return Refresh
    if (name === './centralSetorial.js') return { TOPICOS_ESTUDO: ['Estrutura'] }
    if (name === './sectorStudies/catalog.generated.json') return studies.map(study => `${study.group}-${study.topicIndex}`)
    return require(name)
  } })
  const render = () => { const available = module.exports.default({ group, topicIndex: 0 }); return available.type(available.props) }
  assert.match(JSON.stringify(render()), /Carregando estudo/)
  for (const bad of [undefined, { group: study.group, topicIndex: 0 }, { ...study, group: 'outra' }, { ...study, charts: null }]) {
    state = { status: 'ok', data: bad }
    const tree = render()
    assert.match(JSON.stringify(tree), /Não foi possível carregar/)
    assert.ok(!nodes(tree).some(node => node.type === Renderer))
    const retry = nodes(tree).find(node => node.type === Refresh)
    next = { status: 'ok', data: bad }
    assert.equal(await retry.props.custom.run(), false)
    assert.equal(lastRequest[0], `sector-studies/${study.group}-0.json`)
    assert.equal(lastRequest[2], true)
    next = { status: 'ok', data: study }
    assert.equal(await retry.props.custom.run(), true)
    assert.ok(nodes(render()).some(node => node.type === Renderer && node.props.study === study))
    next = { status: 'ok', stale: true, data: study }
    assert.equal(await retry.props.custom.run(), false)
  }
  state = { status: 'ok', stale: true, data: study }
  assert.match(JSON.stringify(render()), /Mantido o conteúdo anterior/)
})
