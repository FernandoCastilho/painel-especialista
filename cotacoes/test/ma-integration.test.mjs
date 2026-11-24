import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { APP_SECTIONS } from '../src/appSections.js'
import { DESKTOP_PRIMARY, MOBILE_PRIMARY, MORE_GROUPS, shortcutTitle } from '../src/navigationPriority.js'
import { parseCommand } from '../src/terminal.js'
import { validateMa, summarizeMa, maDate } from '../src/ma.js'
const read = path => readFileSync(new URL(path,import.meta.url),'utf8')

test('M&A: fica após Setores no desktop, acessível em Mais no celular, preservando atalhos', () => {
  assert.equal(DESKTOP_PRIMARY[DESKTOP_PRIMARY.indexOf('setores') + 1],'ma')
  assert.ok(APP_SECTIONS.some(section => section.id === 'ma'))
  assert.ok([...MOBILE_PRIMARY,...MORE_GROUPS.flatMap(group=>group.ids)].includes('ma'))
  assert.equal(shortcutTitle('ma'),undefined)
  assert.equal(shortcutTitle('calculadora'),'Alt+0')
  for(const command of ['MA','M&A','Fusões e Aquisições']) assert.deepEqual(parseCommand(command),{kind:'tab',id:'ma',sub:''})
})
test('M&A: catálogo real validado, sem exemplos fictícios ou atualização promovida a anúncio', () => {
  const catalog = JSON.parse(read('../src/ma/transactions.json'))
  assert.equal(validateMa(catalog.transactions),true)
  assert.match(catalog.coverage,/parcial/)
  // acervo de 2025 continua em 2025 (data secundária de atualização não vira anúncio novo); 2026 só com anúncio ou publicação no ano
  assert.ok(catalog.transactions.filter(row => row.id.startsWith('2025-')).every(row => row.publicationDate.startsWith('2025') && maDate(row).startsWith('2025')))
  assert.ok(catalog.transactions.filter(row => row.id.startsWith('2026-')).every(row => maDate(row) >= '2026-01-01' && maDate(row) <= '2026-11-23'))
  assert.ok(catalog.transactions.every(row => /^202[56]-/.test(row.id)))
  assert.equal(summarizeMa(catalog.transactions).total,catalog.transactions.length)
  assert.ok(!JSON.stringify(catalog).includes('Clínica Aurora'))
})
test('M&A: integra App e ligação de ida e volta com setores sem expor armazenamento', () => {
  assert.match(read('../src/App.jsx'),/tab === 'ma'/)
  assert.match(read('../src/Setores.jsx'),/MaSectorLink/)
  assert.match(read('../src/Ma.jsx'),/goto\('setores',row.sectorRoute\)/)
  assert.doesNotMatch(read('../src/Ma.jsx'),/Obsidian|base de dados/)
})
