import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DECAY_MS, MAX_WIDTH, lifeOf, styleOf, prune, trim } from '../src/laser.js'

test('o traço se apaga aos poucos: mais fino e mais transparente com a idade, sem sumir de repente', () => {
  assert.equal(lifeOf(0), 1); assert.equal(lifeOf(DECAY_MS), 0); assert.equal(lifeOf(DECAY_MS * 3), 0)
  const novo = styleOf(0), meio = styleOf(DECAY_MS / 2), velho = styleOf(DECAY_MS * 0.95)
  assert.equal(novo.width, MAX_WIDTH); assert.equal(novo.alpha, 1)
  assert.ok(meio.width < novo.width && meio.alpha < novo.alpha && velho.width < meio.width && velho.alpha < meio.alpha)
  assert.ok(velho.width > 0 && styleOf(DECAY_MS).width > 0, 'a largura nunca chega a zero')
})
test('pontos velhos saem e traços vazios somem; o traço em andamento fica', () => {
  const now = 10_000, p = (age) => ({ x: 0, y: 0, t: now - age })
  assert.equal(trim([p(10), p(DECAY_MS + 1), p(DECAY_MS - 1)], now).length, 2)
  const out = prune([{ drawing: false, points: [p(DECAY_MS + 5), p(DECAY_MS + 9)] }, { drawing: false, points: [p(5), p(9)] }, { drawing: true, points: [] }], now)
  assert.equal(out.length, 2); assert.ok(out.some((s) => s.drawing))
})
test('botão discreto, atalho Ctrl+~ / Ctrl+" (Alt+L reserva) e Esc, camada dentro do diálogo modal aberto', () => {
  const src = readFileSync(new URL('../src/Laser.jsx', import.meta.url), 'utf8')
  assert.ok(src.includes('atalho(e)') && src.includes("e.key === 'Escape'") && src.includes('aria-pressed={on}') && src.includes('dialog[open]'))
  assert.match(readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8'), /<Laser \/>/)
  assert.match(readFileSync(new URL('../src/terminal.js', import.meta.url), 'utf8'), /Ctrl \+ ~/)
})

import { DRAG_PX, arrowHead, isDrag, kindOf, shapeAlpha } from '../src/laser.js'
test('gestos: clique simples passa; arrastar risca; Ctrl faz retângulo e Shift, seta (Ctrl vale mais)', () => {
  assert.equal(kindOf({}), 'free'); assert.equal(kindOf({ ctrlKey: true }), 'rect'); assert.equal(kindOf({ shiftKey: true }), 'arrow'); assert.equal(kindOf({ ctrlKey: true, shiftKey: true }), 'rect'); assert.equal(kindOf(), 'free')
  assert.equal(isDrag({ x: 0, y: 0 }, { x: 3, y: 3 }), false, 'tremida do clique não é arrasto')
  assert.equal(isDrag({ x: 0, y: 0 }, { x: DRAG_PX + 1, y: 0 }), true)
})
test('retângulo e seta: inteiros enquanto segura, apagam depois de soltar; cabeça da seta aponta para trás da ponta', () => {
  assert.equal(shapeAlpha(5000, undefined), 1); assert.equal(shapeAlpha(5000, 5000), 1); assert.equal(shapeAlpha(5000 + DECAY_MS, 5000), 0)
  const [h1, h2] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 16)
  assert.ok(h1.x < 100 && h2.x < 100 && h1.y * h2.y < 0, 'as duas pontas ficam antes da ponta, uma de cada lado')
  assert.ok(Math.abs(Math.hypot(h1.x - 100, h1.y) - 16) < 1e-9)
})

import { atalho } from '../src/laser.js'
test('atalho do laser: Ctrl + ~ ou Ctrl + " (qualquer teclado), Alt + L de reserva; nada de Ctrl + Alt nem Meta', () => {
  assert.equal(atalho({ ctrlKey: true, code: 'Backquote', key: '~' }), true, 'EUA: Ctrl + ~')
  assert.equal(atalho({ ctrlKey: true, code: 'Backquote', key: '"' }), true, 'ABNT2: Ctrl + "')
  assert.equal(atalho({ ctrlKey: true, code: 'Quote', key: 'Dead' }), true, 'ABNT2: tecla do ~ (tecla morta)')
  assert.equal(atalho({ ctrlKey: true, key: '~' }), true); assert.equal(atalho({ ctrlKey: true, key: '"' }), true)
  assert.equal(atalho({ altKey: true, key: 'L' }), true); assert.equal(atalho({ altKey: true, key: 'x' }), false)
  assert.equal(atalho({ ctrlKey: true, altKey: true, code: 'Backquote' }), false); assert.equal(atalho({ ctrlKey: true, metaKey: true, code: 'Backquote' }), false)
  assert.equal(atalho({ ctrlKey: true, key: 'a', code: 'KeyA' }), false); assert.equal(atalho({}), false)
})


test('diagramas usam a instância global, com portal, foco estável e Escape priorizando o laser', () => {
  const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
  const laser = source('Laser.jsx')
  assert.match(laser, /dialog\[open\], \[data-laser-host\]/)
  assert.match(laser, /!host.contains\(slot\) \? host : slot/)
  assert.match(laser, /stopImmediatePropagation\(\); setOn\(false\)/)
  for (const file of ['TechnologyIntegrationDiagram.jsx', 'SectorValueChain.jsx']) {
    const jsx = source(file)
    assert.match(jsx, /data-laser-host="true"/)
    assert.match(jsx, /laser-slot tic-flow-laser-slot/)
    assert.match(source('useDiagramPresentation.js'), /!event.defaultPrevented/)
    assert.doesNotMatch(jsx, /setLaser|pointerRef|tic-flow-laser-toggle/)
    assert.doesNotMatch(jsx, /Pausar animação do diagrama|Retomar animação do diagrama/)
  }
})
