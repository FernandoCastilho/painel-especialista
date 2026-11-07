import test from 'node:test'
import assert from 'node:assert/strict'
import { createKnowledgeLayout, stepKnowledgeLayout } from '../src/knowledgeLayout.js'

const nodes = [
  { id: 'sector/industry', type: 'sector', group: 'industry' },
  { id: 'concept/fx', type: 'concept', group: 'fx' },
  { id: 'news/latest', type: 'news', group: 'fx' },
]
const links = [{ source: nodes[0].id, target: nodes[1].id }, { source: nodes[1].id, target: nodes[2].id }]

test('initial positions and simulation are deterministic and leave input untouched', () => {
  const input = structuredClone(nodes), edges = structuredClone(links)
  const first = createKnowledgeLayout(input, edges), second = createKnowledgeLayout(input, edges)
  assert.deepEqual(first, second)
  for (let frame = 0; frame < 150; frame++) {
    stepKnowledgeLayout(first)
    stepKnowledgeLayout(second)
  }
  assert.deepEqual(first, second)
  assert.deepEqual(input, nodes)
  assert.deepEqual(edges, links)
})

test('empty/single-node graphs and malformed data remain finite', () => {
  assert.equal(stepKnowledgeLayout(createKnowledgeLayout([], [])).nodes.length, 0)
  assert.equal(createKnowledgeLayout(null, null).nodes.length, 0)
  assert.equal(stepKnowledgeLayout(null), null)
  const layout = createKnowledgeLayout([null, {}, nodes[0], nodes[0]], [{ source: nodes[0].id, target: 'absent' }, null], NaN, -1)
  assert.equal(layout.nodes.length, 1)
  assert.equal(layout.links.length, 0)
  assert.equal(layout.width, 1000)
  assert.equal(layout.height, 650)
  layout.nodes[0].x = Infinity
  layout.nodes[0].y = NaN
  layout.nodes[0].vx = Infinity
  for (let frame = 0; frame < 10; frame++) stepKnowledgeLayout(layout)
  for (const field of ['x', 'y', 'vx', 'vy']) assert.ok(Number.isFinite(layout.nodes[0][field]))
})

test('dangling/self links are discarded while valid links retain metadata', () => {
  const layout = createKnowledgeLayout(nodes, [...links, { source: nodes[0].id, target: 'missing' }, { source: nodes[0].id, target: nodes[0].id }, { source: { id: nodes[0].id }, target: { id: nodes[2].id }, reason: 'Theme' }])
  assert.equal(layout.links.length, 3)
  assert.deepEqual(layout.links[2], { source: nodes[0].id, target: nodes[2].id, reason: 'Theme' })
})

test('dragged node stays pinned while its neighbours respond', () => {
  const layout = createKnowledgeLayout(nodes, links)
  const original = { x: layout.nodes[1].x, y: layout.nodes[1].y }
  for (let frame = 0; frame < 80; frame++) stepKnowledgeLayout(layout, { pinnedId: nodes[0].id, pinnedPosition: { x: 130, y: 230 } })
  assert.equal(layout.nodes[0].x, 130)
  assert.equal(layout.nodes[0].y, 230)
  assert.equal(layout.nodes[0].vx, 0)
  assert.ok(Math.hypot(layout.nodes[1].x - original.x, layout.nodes[1].y - original.y) > 1)
  stepKnowledgeLayout(layout, { pinnedId: nodes[0].id, pinnedPosition: { x: -100, y: 5000 } })
  assert.equal(layout.nodes[0].x, 28)
  assert.equal(layout.nodes[0].y, 622)
})

test('dense graph stays bounded and calms as simulation energy decays', () => {
  const denseNodes = Array.from({ length: 350 }, (_, index) => ({ id: `node-${index}`, type: ['sector', 'concept', 'news'][index % 3], group: `group-${index % 12}` }))
  const denseLinks = denseNodes.slice(1).map((node, index) => ({ source: node.id, target: denseNodes[Math.floor(index / 3)].id }))
  const layout = createKnowledgeLayout(denseNodes, denseLinks, 900, 600)
  for (let frame = 0; frame < 350; frame++) stepKnowledgeLayout(layout, { energy: Math.pow(0.98, frame) })
  for (const node of layout.nodes) {
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y))
    assert.ok(node.x >= 28 && node.x <= 872)
    assert.ok(node.y >= 28 && node.y <= 572)
  }
  assert.ok(layout.motion < 0.2, `maximum movement ${layout.motion}`)
})

test('coincident nodes separate without randomness or unbounded velocity', () => {
  const layout = createKnowledgeLayout(nodes, links, 300, 300)
  for (const node of layout.nodes) { node.x = 150; node.y = 150 }
  for (let frame = 0; frame < 80; frame++) stepKnowledgeLayout(layout)
  const positions = new Set(layout.nodes.map(node => `${node.x.toFixed(2)},${node.y.toFixed(2)}`))
  assert.equal(positions.size, 3)
  assert.ok(layout.nodes.every(node => Math.abs(node.vx) <= 7 && Math.abs(node.vy) <= 7))
})

test('a sparse network forms a cloud instead of rows against the stage borders', () => {
  const cloudNodes = Array.from({ length: 170 }, (_, index) => ({ id: `cloud-${index}`, type: index < 130 ? 'sector' : 'concept', group: `group-${index % 12}` }))
  const cloudLinks = cloudNodes.slice(1).map((node, index) => ({ source: node.id, target: cloudNodes[Math.floor(index / 6)].id }))
  for (const [width, height] of [[1000, 540], [350, 420]]) {
    const layout = createKnowledgeLayout(cloudNodes, cloudLinks, width, height)
    for (let frame = 0; frame < 65; frame++) stepKnowledgeLayout(layout, { energy: 0.7 })
    for (let frame = 0; frame < 380; frame++) stepKnowledgeLayout(layout, { energy: Math.max(0.035, Math.exp(-frame / 90)) })
    const onBorder = layout.nodes.filter(node => node.x <= 28.01 || node.x >= width - 28.01 || node.y <= 28.01 || node.y >= height - 28.01)
    assert.ok(onBorder.length <= 3, `${width}px: ${onBorder.length} nodes on hard border`)
    assert.ok(layout.nodes.some(node => Math.abs(node.x - width / 2) > width * 0.15), 'network still has horizontal spread')
    assert.ok(layout.nodes.some(node => Math.abs(node.y - height / 2) > height * 0.15), 'network still has vertical spread')
  }
})
