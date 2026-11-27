import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { APP_SECTIONS } from '../src/appSections.js'
import { MORE_GROUPS, shortcutTitle } from '../src/navigationPriority.js'
import { SEARCH_SECTIONS } from '../src/globalSearch.js'

test('Histórias é uma seção navegável no menu Mais, sem mudar atalhos', () => {
  assert.equal(APP_SECTIONS.find(({ id }) => id === 'historias')?.label, 'Histórias')
  assert.ok(MORE_GROUPS.find(({ label }) => label === 'Aprender').ids.includes('historias'))
  assert.equal(shortcutTitle('historias'), undefined)
  assert.equal(SEARCH_SECTIONS.historias, 'Histórias')
  assert.match(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), /tab === 'historias' && <Historias view=\{sub\}/)
})

test('os sete casos têm data, marcos e fontes; os temas ligam somente casos pertinentes', async () => {
  const { HISTORIAS, TEMAS_HISTORIAS, casosDoTema } = await import('../src/historias.js')
  assert.deepEqual(HISTORIAS.map(({ id, fundacao, anoLancamento }) => [id, fundacao ?? anoLancamento]), [['ifood', '2011'], ['netflix', '1997'], ['blockbuster', '1985'], ['spotify', '2006'], ['uber', '2009'], ['apple-iphone', '2007'], ['catupiry', '1911']])
  for (const historia of HISTORIAS) {
    assert.ok(historia.marcos.length >= 4)
    assert.ok(historia.fontes.length >= 2)
    assert.ok(historia.fontes.every(({ url }) => /^https:\/\//.test(url)))
  }
  assert.deepEqual(Object.fromEntries(TEMAS_HISTORIAS.map(tema => [
    tema.id, casosDoTema(tema.id).map(({ id }) => id),
  ])), {
    'origem-fisica': ['ifood', 'netflix', 'blockbuster'],
    logistica: ['ifood', 'netflix'],
    'locacao-video': ['netflix', 'blockbuster'],
    streaming: ['netflix', 'spotify'],
    'plataformas-locais': ['ifood', 'uber'],
    'ecossistema-mobile': ['ifood', 'uber', 'apple-iphone'],
  })
  for (const tema of TEMAS_HISTORIAS) {
    assert.ok(casosDoTema(tema.id).every(h => h.conexoes[tema.id].length > 30))
  }
  const catalogo = readFileSync(new URL('../src/searchCatalog.js', import.meta.url), 'utf8')
  assert.match(catalogo, /HISTORIAS\.map\(caso => makeSearchDoc/)
  assert.match(catalogo, /route: 'historias\/' \+ caso.id/)
})

test('o iPhone é apresentado pelo seu lançamento, não pela fundação da Apple', async () => {
  const { HISTORIAS } = await import('../src/historias.js')
  assert.equal(HISTORIAS.find(({ id }) => id === 'apple-iphone')?.rotuloData, 'Lançamento do iPhone')
})
