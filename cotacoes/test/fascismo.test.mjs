import test from 'node:test'
import assert from 'node:assert/strict'
import { CONCEITOS, buscarConceitos, porTopico, conexoesDe } from '../src/educacao.js'
import { parseCommand } from '../src/terminal.js'
import { readFileSync } from 'node:fs'

test('fascismo aparece uma vez, com categoria própria e busca pelo erro comum', () => {
  assert.equal(CONCEITOS.filter(c => c.id === 'fascismo').length, 1)
  for (const term of ['fascismo', 'facismo', 'Mussolini', 'pluralismo']) assert.ok(buscarConceitos(term).some(c => c.id === 'fascismo'))
  assert.ok(porTopico(CONCEITOS).find(g => g.topico === 'História e instituições').itens.some(c => c.id === 'fascismo'))
  assert.deepEqual(parseCommand('facismo'), { kind: 'tab', id: 'aprender', sub: 'fascismo' })
  assert.deepEqual(parseCommand('fascismo'), { kind: 'tab', id: 'aprender', sub: 'fascismo' })
})
test('fascismo usa exemplo histórico, fontes e limites sem criar fórmula financeira', () => {
  const c = CONCEITOS.find(c => c.id === 'fascismo')
  assert.equal(c.exemplo.tipo, 'histórico')
  assert.equal(c.preciso.tipo, 'conceitual')
  assert.equal(c.fontes.length, 3)
  assert.ok(c.fontes.every(f => f.url.startsWith('https://')))
  assert.match(c.lacunas.join(' '), /Nem toda ditadura é fascista/)
  assert.match(c.teste.resposta, /medida econômica isolada não/)
  assert.ok(conexoesDe(c.id).some(x => x.id === 'juros-forcados'))
  const view = readFileSync(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  assert.match(view, /Exemplo histórico/)
  assert.match(view, /conceitual.*undefined.*math/)
})
