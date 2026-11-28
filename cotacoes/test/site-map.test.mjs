import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { buildSync } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { APP_SECTIONS } from '../src/appSections.js'
import { MORE_GROUPS } from '../src/navigationPriority.js'
import { SITE_MAP_BRANCHES, flattenSiteMap } from '../src/siteMap.js'
import { CEN_VIEWS } from '../src/cenariosViews.js'
import { CALCULATOR_GROUPS } from '../src/calculatorGroups.js'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
import { CONCEITOS } from '../src/educacao.js'
import { HISTORIAS } from '../src/historias.js'

// A tela real, com os catálogos das próprias calculadoras, Juros e BNDES.
const entry = fileURLToPath(new URL('../src/SiteMap.jsx', import.meta.url))
const result = buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', outdir: '/tmp/site-map-test', external: ['react', 'react/jsx-runtime', 'react-dom'], loader: { '.webp': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.json': 'json' }, logLevel: 'silent' })
const js = result.outputFiles.find(f => f.path.endsWith('.js')).text
const mod = { exports: {} }
new Function('require', 'module', 'exports', js)(createRequire(import.meta.url), mod, mod.exports)
const SiteMap = mod.exports.default
const html = renderToStaticMarkup(createElement(SiteMap, { goto: () => {} }))
const hrefs = [...html.matchAll(/href="#([^"]*)"/g)].map(m => m[1])
const src = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')

test('mapa do site: todas as seções visíveis entram, ocultas e o próprio mapa ficam de fora', () => {
  const visiveis = APP_SECTIONS.filter(s => !s.oculto && s.id !== 'mapa').map(s => s.id).sort()
  assert.deepEqual(SITE_MAP_BRANCHES.flatMap(b => b.sections).sort(), visiveis)
  for (const id of visiveis) assert.ok(hrefs.includes(id), `falta a seção ${id}`)
  assert.ok(!hrefs.some(h => /^(apresentar|config|mapa)\b/.test(h)))
  assert.deepEqual(SITE_MAP_BRANCHES.map(b => b.label), ['Mercado', 'Calculadoras', 'Empresas e setores', 'Conteúdo'])
})

test('mapa do site desce até o último item de cada catálogo', () => {
  for (const v of CEN_VIEWS) assert.ok(hrefs.includes(`cenarios/${v.id}`))
  assert.ok(hrefs.includes('cenarios/inflacao/fiscal') && hrefs.includes('cenarios/commodities/frete'))
  for (const id of CALCULATOR_GROUPS.flatMap(g => g.calculators)) assert.ok(hrefs.includes(`calculadora/${id}`), `falta a calculadora ${id}`)
  for (const id of ['bndes-tlp-exigivel', 'bndes-selic-lcd']) assert.ok(hrefs.includes(`calculadora/${id}`))
  assert.match(html, /Finame Veículos · Ônibus e caminhões/)
  for (const g of CATALOGO_SETORIAL) {
    assert.ok(hrefs.includes(`setores/pasta/${g.id}`))
    g.topics.forEach((_, i) => assert.ok(hrefs.includes(`setores/topico/${g.id}/${i}`)))
  }
  for (const c of CONCEITOS) assert.ok(hrefs.includes(`aprender/${c.id}`), `falta o conceito ${c.id}`)
  for (const h of HISTORIAS) assert.ok(hrefs.includes(`historias/${h.id}`))
  for (const f of ['tfb', 'tlp', 'tfc', 'moedas']) assert.ok(hrefs.includes(`bndes/${f}`))
  assert.ok(hrefs.includes('ma/visao-geral') && hrefs.includes('ma/transacoes') && hrefs.includes('aprender/mapa') && hrefs.includes('rpn'))
})

test('mapa do site: quadros sem endereço próprio existem na tela de destino', () => {
  const fontes = readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.jsx')).map(src).join('\n')
  const anchors = [...src('siteMap.js').matchAll(/\['([a-z-]+-title)'/g)].map(m => m[1])
  const juros = [...src('Juros.jsx').match(/export const ATALHOS = \[(.*)\]/)[1].matchAll(/\['(juros-[a-z-]+)'/g)].map(m => m[1])
  assert.ok(anchors.length >= 2 && juros.length >= 5)
  for (const id of [...anchors, ...juros]) assert.ok(fontes.includes(`id="${id}"`) || fontes.includes(`'${id}']`), `quadro ${id} não existe`)
})

test('mapa do site: coruja no centro, contagem e cada item é um link', () => {
  assert.match(html, /class="sm-owl"/)
  assert.match(html, /<abbr title="Painel Especializado no Mercado">PME<\/abbr>/)
  const total = Number(html.match(/(\d+) destinos em quatro ramos/)[1])
  assert.ok(total > 150, `só ${total} destinos`)
  assert.equal((html.match(/<a /g) || []).length, total - 3) // só Mercado, Empresas e Conteúdo não são links; Calculadoras abre o catálogo
  assert.doesNotMatch(html, /draggable="true"|onwheel|zoom/i)
})

test('mapa do site no menu Mais, na busca e na rota', () => {
  assert.ok(MORE_GROUPS.find(g => g.label === 'Consultar').ids.includes('mapa'))
  assert.match(src('searchCatalog.js'), /title:'Mapa do site',[^\n]*route:'mapa'/)
  assert.match(src('App.jsx'), /tab === 'mapa' && <SiteMap goto=\{goto\} \/>/)
  assert.equal(flattenSiteMap({ id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }] }).length, 3)
})

test('mapa do site abre recolhido, com seta em cada ramo e botões de expandir e recolher tudo', () => {
  const setas = html.match(/<button type="button" class="sm-toggle"[^>]*>/g) || []
  assert.ok(setas.length > 40, `só ${setas.length} setas`) // os 4 ramos e todos os itens com filhos
  assert.deepEqual(mod.exports.idsExpansiveis({ id: 'a', children: [{ id: 'b', children: [{ id: 'c' }] }, { id: 'd' }] }), ['a', 'b'])
  assert.ok(setas.every(b => b.includes('aria-expanded="false"') && /aria-controls="sm-lista-[^"]+"/.test(b) && /aria-label="Abrir /.test(b)))
  for (const b of setas) assert.ok(html.includes(`id="${b.match(/aria-controls="([^"]+)"/)[1]}" hidden=""`), 'cada seta controla uma lista escondida')
  assert.match(html, /<button type="button" class="sm-action"[^>]*>Expandir tudo<\/button>/)
  assert.match(html, /<button type="button" class="sm-action"[^>]*disabled=""[^>]*>Recolher tudo<\/button>/)
  assert.match(src('SiteMap.css'), /\.sm-center\{position:sticky;top:/)
  assert.match(html, /<section class="site-map sm-azul"/) // moldura azul das calculadoras
})
