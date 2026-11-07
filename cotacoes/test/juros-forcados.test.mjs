import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as educacao from '../src/educacao.js'
import { CASOS_JUROS, FONTES_JUROS, CONCEITO_JUROS_FORCADOS, exemploJuroForcado } from '../src/jurosForcados.js'
import { makeSearchDoc, plainContent, searchDocuments } from '../src/globalSearch.js'

test('estudo histórico contém seis casos com fontes, instrumentos e limites distintos', () => {
  assert.equal(CASOS_JUROS.length, 6)
  assert.equal(new Set(CASOS_JUROS.map(c => c.id)).size, 6)
  for (const c of CASOS_JUROS) {
    for (const key of ['contexto', 'mecanismo', 'resultado', 'limite']) assert.ok(c[key].length > 100, `${c.id}: ${key}`)
    assert.ok(c.marcos.length >= 2)
    assert.ok(c.fontes.length > 0)
    for (const id of c.fontes) {
      const f = FONTES_JUROS[id]
      assert.ok(f, `${c.id}: fonte ${id}`)
      assert.equal(new URL(f.url).protocol, 'https:')
      assert.ok(CONCEITO_JUROS_FORCADOS.fontes.some(item => item.id === id && item.url === f.url))
    }
  }
  assert.match(CASOS_JUROS.find(c => c.id === 'brasil-2012').tipo, /Contraste/)
  assert.match(CASOS_JUROS.find(c => c.id === 'japao-ycc').limite, /não por hiperinflação/)
  assert.match(CASOS_JUROS.find(c => c.id === 'australia-pandemia').limite, /benefícios.*custos/)
  assert.match(CASOS_JUROS.find(c => c.id === 'reino-unido-pos-guerra').limite, /não recomendação oficial/)
})

test('datas e unidades históricas são explícitas e não viram taxas atuais', () => {
  const c = CONCEITO_JUROS_FORCADOS
  assert.equal(c.revisadoEm, '2026-11-06')
  assert.match(c.estudoHistorico.escopo, /1942 a 2024/)
  assert.match(c.estudoHistorico.escopo, /não.*taxas vigentes/i)
  assert.match(CASOS_JUROS.find(x => x.id === 'eua-guerra').resultado, /entre junho de 1946 e junho de 1947/)
  assert.match(CASOS_JUROS.find(x => x.id === 'turquia-cortes').marcos.join(' '), /inflação em 12 meses/)
})

test('exemplo de perda real é calculado e não confunde aproximação com resultado exato', () => {
  const ex = exemploJuroForcado({ nominal: .05, inflacao: .10, capital: 1000 })
  assert.equal(ex.saldoNominal, 1050)
  assert.ok(Math.abs(ex.saldoReal - 954.5454545454545) < 1e-9)
  assert.ok(Math.abs(ex.taxaReal - (-.045454545454545525)) < 1e-9)
  assert.match(CONCEITO_JUROS_FORCADOS.exemplo.passos.join(' '), /954,55/)
  assert.match(CONCEITO_JUROS_FORCADOS.exemplo.passos.join(' '), /-4,55%/)
})

test('busca de Aprender acha os países e termos dentro da história', () => {
  for (const termo of ['Turquia', 'Japao', 'repressao financeira', '1942', 'Austrália', 'Reino Unido', 'Copom 2012', 'controle forçado']) {
    assert.ok(educacao.buscarConceitos(termo).some(c => c.id === 'juros-forcados'), termo)
  }
  const catalog = educacao.CONCEITOS.map(c => makeSearchDoc({ id: 'concept:' + c.id, title: c.nome, body: plainContent(c), route: 'aprender/' + c.id }))
  const doc = catalog.find(c => c.id === 'concept:juros-forcados')
  assert.ok(doc)
  assert.equal(doc.route, 'aprender/juros-forcados')
  assert.match(doc.body, /Turquia/)
  assert.ok(searchDocuments(catalog, 'YCC').some(c => c.id === 'concept:juros-forcados'))
})

test('Aprender renderiza casos acessíveis, links primários e o aviso histórico', async () => {
  const source = await readFile(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }, require = createRequire(import.meta.url)
  const passthrough = ({ children }) => React.createElement('div', {}, children)
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (name === 'react') return React
    if (name === './educacao.js') return educacao
    if (name === './Aprender.css') return {}
    if (name === './Avisos.jsx') return { Aviso: passthrough }
    if (name === './TerminalDesk.jsx') return { Panel: passthrough }
    if (name === './Help.jsx') return { __esModule: true, default: passthrough }
    if (name === './KnowledgeMap.jsx') return { __esModule: true, default: () => null }
    return require(name)
  } })
  const html = renderToStaticMarkup(React.createElement(module.exports.default, { view: 'juros-forcados', goto: () => {} }))
  assert.equal((html.match(/class="learn-history-case"/g) || []).length, 6)
  assert.equal((html.match(/O que a história não prova/g) || []).length, 6)
  assert.match(html, /Seis histórias, mecanismos diferentes/)
  assert.match(html, /aria-label="Seis histórias, mecanismos diferentes"/)
  for (const fonte of Object.values(FONTES_JUROS)) assert.ok(html.includes(fonte.url), fonte.url)
  assert.match(html, /rel="noopener noreferrer"/)
  assert.match(html, /não.*taxas vigentes/i)
})
