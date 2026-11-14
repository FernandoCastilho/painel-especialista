import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parse } from '@babel/parser'
import { CONCEITO_MAQUILA, tributoMaquila } from '../src/maquila.js'
import { CONCEITOS, CONEXAO, buscarConceitos, conexoesDe, porTopico } from '../src/educacao.js'
import { makeSearchDoc, plainContent, searchDocuments } from '../src/globalSearch.js'
import { parseCommand } from '../src/terminal.js'
import { conceitoDoDia } from '../src/conceitoDiario.js'

const id = 'lei-de-maquila'

test('Maquila: 1% incide sobre a maior base, não a menor, a soma ou o lucro', () => {
  assert.equal(tributoMaquila({ valorAgregado: 40_000, faturaExportacao: 50_000 }), 500)
  assert.equal(tributoMaquila({ valorAgregado: 60_000, faturaExportacao: 50_000 }), 600)
  assert.equal(tributoMaquila({ valorAgregado: 50_000, faturaExportacao: 50_000 }), 500)
  assert.equal(tributoMaquila({ valorAgregado: 0, faturaExportacao: 0 }), 0)
  assert.equal(tributoMaquila({ valorAgregado: 0, faturaExportacao: 50_000 }), 500)
  assert.equal(tributoMaquila({ valorAgregado: 50_000, faturaExportacao: 0 }), 500)
})

test('Maquila: valores ausentes, negativos ou não finitos não viram tributo zero', () => {
  for (const value of [null, undefined, '', '40000', -1, NaN, Infinity, -Infinity]) {
    assert.equal(tributoMaquila({ valorAgregado: value, faturaExportacao: 50_000 }), null)
    assert.equal(tributoMaquila({ valorAgregado: 40_000, faturaExportacao: value }), null)
  }
})

test('Maquila: exemplo identifica bases hipotéticas e mantém conta sincronizada', () => {
  const example = JSON.stringify(CONCEITO_MAQUILA.exemplo)
  for (const value of ['40.000', '50.000', '60.000', '500', '600']) assert.ok(example.includes(value), value)
  assert.match(example, /mesma moeda/)
  assert.match(example, /não calcula a composição fiscal da fatura/)
  assert.match(example, /não estima o custo total da operação nem os tributos no destino/)
})

test('Maquila: marco atual, condições e limites permanecem explícitos', () => {
  const text = plainContent(CONCEITO_MAQUILA)
  for (const value of ['7.547/2025', '5.714/2026', '05/11/2026', '1.064/1997', 'marco anterior', '180 dias', '10%', '12 meses', 'Mercosul', 'NCM', 'VUE/SIMEX']) assert.ok(text.includes(value), value)
  assert.match(text, /maior entre o valor agregado/)
  assert.match(text, /Não é simplesmente 1% do lucro/)
  assert.match(text, /não garante origem Mercosul/)
  assert.match(text, /Não são 24 meses automáticos/)
  assert.match(text, /180 dias contados da resolução que aprova o programa, sob pena de caducidade da aprovação/)
  assert.match(text, /12 meses de transição/)
  assert.match(text, /incorporados de pleno direito ao novo regime, sem ato adicional/)
  assert.match(text, /Em 05\/11\/2026, esse prazo já havia transcorrido/)
  assert.match(text, /São preservados os direitos indicados no art\. 42/)
  assert.match(text, /vigência indefinida dos programas anteriores abrangidos/)
  assert.match(text, /não substituem validação jurídica, tributária e aduaneira/)
})

test('Maquila: agrupamento, mapa recíproco e conceito diário incluem o conceito', () => {
  assert.equal(CONCEITOS.filter((concept) => concept.id === id).length, 1)
  assert.equal(CONCEITOS.find((concept) => concept.id === id), CONCEITO_MAQUILA)
  assert.deepEqual(porTopico(CONCEITOS).find((group) => group.topico === 'Comércio exterior').itens.map((concept) => concept.id), ['drawback', 'acc', id])
  assert.ok(CONEXAO.itens.some((item) => item.id === id))
  for (const related of ['drawback', 'custo-de-funding', 'commodities-e-cambio']) {
    assert.ok(conexoesDe(id).some((item) => item.id === related), related)
    assert.ok(conexoesDe(related).some((item) => item.id === id), related)
  }
  const daily = Array.from({ length: CONCEITOS.length }, (_, day) => conceitoDoDia(new Date(Date.UTC(2026, 10, 5 + day, 12))).conceito.id)
  assert.ok(daily.includes(id))
})

test('Maquila: busca local e global abrem a rota exata pelo nome e pelo conteúdo', () => {
  const docs = CONCEITOS.map((concept) => makeSearchDoc({ id: concept.id, title: concept.nome, body: plainContent(concept), route: `aprender/${concept.id}`, kind: 'Conceito' }))
  for (const query of ['MAQUILA', 'Lei de Maquila no Paraguai', 'tributo único Paraguai', 'Mercosul NCM', '7.547/2025']) {
    assert.ok(buscarConceitos(query).some((concept) => concept.id === id), query)
    assert.ok(searchDocuments(docs, query).some((doc) => doc.route === `aprender/${id}`), query)
  }
  assert.equal(searchDocuments(docs, 'Maquila')[0].route, `aprender/${id}`)
  for (const query of ['maquila', 'Lei de Maquila', 'maquila paraguai', 'Lei de Maquila no Paraguai', 'LEI-DE-MAQUILA <GO>']) {
    assert.deepEqual(parseCommand(query), { kind: 'tab', id: 'aprender', sub: id }, query)
  }
})

test('Maquila: fontes são oficiais e ajuda contextual reutiliza o componente acessível', async () => {
  const officialHosts = new Set(['www.bacn.gov.py', 'www.mic.gov.py', 'www.mercosur.int', 'www.gov.br', 'normas.receita.fazenda.gov.br'])
  assert.ok(CONCEITO_MAQUILA.fontes.length >= 5)
  assert.equal(new Set(CONCEITO_MAQUILA.fontes.map((source) => source.url)).size, CONCEITO_MAQUILA.fontes.length)
  for (const source of CONCEITO_MAQUILA.fontes) {
    const url = new URL(source.url)
    assert.equal(url.protocol, 'https:')
    assert.ok(officialHosts.has(url.hostname), source.url)
    assert.ok(source.nome.length > 10)
  }
  assert.ok(CONCEITO_MAQUILA.ajuda.length >= 2)
  const source = await readFile(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }))
  assert.match(source, /import Help from '\.\/Help\.jsx'/)
  assert.match(source, /note=\{c\.ajuda && <Help label=\{/)
  assert.match(source, /target="_blank" rel="noopener noreferrer"/)
})
