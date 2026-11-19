import test from 'node:test'
import assert from 'node:assert/strict'
import { CONCEITOS, buscarConceitos, conexoesDe } from '../src/educacao.js'
import { parseCommand } from '../src/terminal.js'
test('ambidestria está integrada, sem duplicidade, à busca, rota e mapa', () => {
 const id='ambidestria-organizacional'
 assert.equal(CONCEITOS.filter(c=>c.id===id).length,1)
 for(const query of ['ambidestria','exploration','exploitation']) assert.ok(buscarConceitos(query).some(c=>c.id===id))
 assert.deepEqual(parseCommand('ambidestria'),{kind:'tab',id:'aprender',sub:id})
 assert.ok(conexoesDe(id).some(c=>c.id==='cet'))
 const c=CONCEITOS.find(c=>c.id===id)
 assert.equal(c.preciso.tipo,'conceitual')
 assert.match(c.noApp.texto,/não substitui análise de capacidade de pagamento/)
 assert.match(c.fontes[0].url,/working-papers\/organizational-ambidexterity-past-present-future$/)
})
