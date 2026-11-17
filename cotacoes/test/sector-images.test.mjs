import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { CATALOGO_SETORIAL } from '../src/centralSetorial.js'
import { SECTOR_IMAGES, getSectorImage } from '../src/sectorImages.js'

test('all fifteen sectors and every topic have local, explicit image bindings', () => {
  assert.equal(Object.keys(SECTOR_IMAGES).length, 15)
  for (const group of CATALOGO_SETORIAL) {
    const cover = getSectorImage(group.id)
    assert.equal(cover.cell, 0)
    assert.ok(existsSync(new URL(`../public/${cover.src}`, import.meta.url)))
    const cells = group.topics.map(topic => getSectorImage(group.id, topic).cell)
    assert.equal(new Set(cells).size, cells.length)
    for (const cell of cells) assert.ok(Number.isInteger(cell) && cell > 0 && cell < 9)
  }
})

test('reordering topics does not change their image, unknown topics use fallback', () => {
  for (const group of CATALOGO_SETORIAL) {
    const original = new Map(group.topics.map(topic => [topic, getSectorImage(group.id, topic)]))
    for (const topic of [...group.topics].reverse()) assert.deepEqual(getSectorImage(group.id, topic), original.get(topic))
  }
  assert.equal(getSectorImage('unknown'), null)
  assert.equal(getSectorImage('pet', 'Unknown future topic'), null)
})

test('component retains decorative accessibility and explicit failure fallback', () => {
  const component = readFileSync(new URL('../src/SectorImage.jsx', import.meta.url), 'utf8')
  assert.match(component, /aria-hidden="true"/)
  assert.match(component, /alt=""/)
  assert.match(component, /central-image-fallback/)
  assert.match(component, /onError=\{\(\) => setFailedSource\(asset.src\)\}/)
  const sectors = readFileSync(new URL('../src/Setores.jsx', import.meta.url), 'utf8')
  assert.match(sectors, /groupId=\{group.id\} topic=\{topic\}/)
  assert.match(sectors, /Imagens ilustrativas geradas por IA/)
})
