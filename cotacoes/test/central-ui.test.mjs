import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
const require = createRequire(import.meta.url)
async function getComponent() {
  const result = await build({ entryPoints:['src/Setores.jsx'], bundle:true, write:false, jsx:'automatic', format:'cjs', platform:'node', external:['react','react-dom'], loader:{'.css':'empty'} })
  const module = {exports:{}}
  runInNewContext(result.outputFiles[0].text, {module,exports:module.exports,require,URL,console,Date,Intl, setTimeout,clearTimeout})
  return module.exports.default
}
test('catálogo, detalhes, rota antiga B3 e insumos aparecem sem classificação separada', async () => {
  const Component = await getComponent()
  const html = view => renderToStaticMarkup(createElement(Component,{view}))
  const initial = html('')
  assert.match(initial,/Explore por setor/)
  assert.match(initial,/Base florestal e madeira/)
  assert.match(initial,/Insumos e Indicadores/)
  assert.doesNotMatch(initial,/Roteiros existentes|Catálogo de tópicos\./)
  const topic=html('topico/base-florestal/3')
  assert.match(topic,/>Compensados</)
  const studies = JSON.parse(readFileSync('src/sectorStudies/studies.json', 'utf8'))
  if (studies.some(study => study.group === 'base-florestal' && study.topicIndex === 3)) {
    assert.match(topic,/Carregando estudo/, 'static render keeps the catalog usable while the selected study loads separately')
  } else assert.match(topic,/Estudo setorial não incluído/)
  const b3=html('b3')
  assert.match(b3,/antiga classificação B3 foi substituída/)
  assert.doesNotMatch(b3,/Visão bancária/)
})


test('pastas, seletor compacto e rotas antigas preservam a hierarquia', async () => {
  const Component = await getComponent()
  const html = view => renderToStaticMarkup(createElement(Component, { view }))
  const catalog = html('central')
  assert.equal((catalog.match(/class="central-folder"/g) || []).length, 15)
  assert.match(catalog, /Explorar Base florestal e madeira, 6 subsetores/)
  assert.equal((catalog.match(/class="central-card-photo(?: central-sector-symbol)?"/g) || []).length, 15)
  assert.doesNotMatch(catalog, /central-folder-back|central-folder-sheet|central-folder-front/)
  assert.doesNotMatch(catalog, /Escolha um subsetor<\/h3>/)
  const folder = html('pasta/base-florestal')
  assert.match(folder, />SETOR</)
  assert.equal((folder.match(/class="central-card-photo(?: central-sector-symbol)?"/g) || []).length, 6)
  assert.match(folder, />Compensados</)
  assert.match(folder, /Caminho do setor/)
  assert.doesNotMatch(folder, /central-folder-tone-/)
  let imageBytes = 0
  for (const group of CATALOGO_SETORIAL) {
    const sector = html(`pasta/${group.id}`)
    assert.equal((sector.match(/class="central-card-photo(?: central-sector-symbol)?"/g) || []).length, group.topics.length, `${group.id}: cada subsetor tem uma foto`)
    if (['turismo', 'varejo', 'saude', 'pet'].includes(group.id)) {
      assert.match(sector, /central-sector-symbol/)
      assert.ok(!sector.includes(`./sector-images/${group.id}.jpg`), 'ícone editorial sem foto inexistente')
      continue
    }
    assert.ok(sector.includes(`./sector-images/${group.id}.jpg`))
    const asset = readFileSync(`public/sector-images/${group.id}.jpg`)
    assert.equal(asset[0], 0xff)
    assert.equal(asset[1], 0xd8, `${group.id}: ativo JPEG local válido`)
    assert.ok(asset.length < 768 * 1024, `${group.id}: imagem dentro do orçamento`)
    imageBytes += asset.length
  }
  assert.ok(imageBytes < 6 * 1024 * 1024, 'quinze atlas somam menos de 6 MiB')
  const study = html('topico/base-florestal/3')
  assert.match(study, /Trocar subsetor/)
  assert.match(study, /<select aria-label="Trocar subsetor"/, 'seletor tem nome explícito sem concatenar as opções do label implícito')
  assert.match(study, /<optgroup label="Base florestal e madeira">/)
  assert.match(study, /class="central-detail central-detail-selected"/)
  assert.doesNotMatch(study, /class="central-folders"/)
  assert.doesNotMatch(study, /class="central-catalog"/)
  for (const route of ['pasta/inexistente', 'topico/base-florestal/999', 'topico/base-florestal/']) {
    const invalid = html(route)
    assert.match(invalid, /Este setor ou subsetor não foi encontrado/)
    assert.doesNotMatch(invalid, /central-detail-selected/)
  }
})


test('cada setor apresenta síntese executiva antes dos subsetores, sem alterar rotas existentes', async () => {
  const Component = await getComponent()
  for (const group of CATALOGO_SETORIAL) {
    const html = renderToStaticMarkup(createElement(Component, { view: `pasta/${group.id}` }))
    assert.match(html, /LEITURA EXECUTIVA/)
    assert.match(html, /O que acompanhar/)
    assert.ok(html.indexOf('central-highlight') < html.indexOf('central-topics central-subsectors'))
  }
  assert.deepEqual(CATALOGO_SETORIAL.find(group => group.id === 'varejo').topics, ['Alimentos','Bebidas','Vestuário'])
  assert.equal(CATALOGO_SETORIAL.find(group => group.id === 'tic').topics[0], 'Integração de TI e infraestrutura digital')
})
