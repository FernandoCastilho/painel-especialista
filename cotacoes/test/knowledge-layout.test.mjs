import test from 'node:test'
import assert from 'node:assert/strict'
import { createKnowledgeLayout, stepKnowledgeLayout, focusKnowledgeLayout, fitKnowledgeCamera } from '../src/knowledgeLayout.js'

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

test('a local neighborhood gets its own centered, deterministic composition', () => {
  const localNodes = Array.from({ length: 13 }, (_, index) => ({ id: `local-${index}`, type: index ? 'concept' : 'sector' }))
  const localLinks = localNodes.slice(1).map(node => ({ source: localNodes[0].id, target: node.id }))
  const original = structuredClone(localNodes)
  const layout = createKnowledgeLayout(localNodes, localLinks, 320, 420)
  const otherOrder = createKnowledgeLayout([...localNodes].reverse(), localLinks, 320, 420)
  focusKnowledgeLayout(layout, 'local-0')
  focusKnowledgeLayout(otherOrder, 'local-0')
  assert.equal(layout.focusId, 'local-0')
  const central = layout.nodes.find(node => node.id === 'local-0')
  assert.equal(central.x, 160)
  assert.equal(central.y, 210)
  const positions = value => value.nodes.map(({ id, x, y }) => ({ id, x, y })).sort((a, b) => a.id.localeCompare(b.id))
  assert.deepEqual(positions(layout), positions(otherOrder))
  for (let left = 0; left < layout.nodes.length; left++) for (let right = left + 1; right < layout.nodes.length; right++) {
    const a = layout.nodes[left], b = layout.nodes[right]
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 40, 'local points have usable starting separation')
  }
  assert.deepEqual(localNodes, original, 'source graph remains untouched')
  const before = structuredClone(layout)
  assert.equal(focusKnowledgeLayout(layout, 'absent'), layout)
  assert.deepEqual(layout, before)
  assert.equal(focusKnowledgeLayout(null, 'absent'), null)
})

test('the focused network still reacts to dragging and settles near its selected point', () => {
  const layout = focusKnowledgeLayout(createKnowledgeLayout(nodes, links, 320, 420), nodes[1].id)
  const central = layout.nodes.find(node => node.id === nodes[1].id)
  const original = { x: layout.nodes[0].x, y: layout.nodes[0].y }
  for (let frame = 0; frame < 80; frame++) stepKnowledgeLayout(layout, { pinnedId: central.id, pinnedPosition: { x: 80, y: 120 } })
  assert.equal(central.x, 80)
  assert.equal(central.y, 120)
  assert.ok(Math.hypot(layout.nodes[0].x - original.x, layout.nodes[0].y - original.y) > 1)
  for (let frame = 0; frame < 180; frame++) stepKnowledgeLayout(layout)
  assert.ok(Math.hypot(central.x - 160, central.y - 210) < 15, 'selected point returns gently to the middle')
  assert.ok(layout.nodes.every(node => node.x >= 28 && node.x <= 292 && node.y >= 28 && node.y <= 392))
})

function renderedNodeBounds(node, camera, selectedId, labelMaxLength, minLabelFontSize = 0) {
  const selected = node.id === selectedId
  const radius = selected ? 11 : node.type === 'sector' && node.subtype !== 'subsector' ? 8 : node.type === 'news' ? 5 : 6
  const font = selected ? 12 : node.type === 'sector' && node.subtype !== 'subsector' ? 10.5 : 9.5
  const screenFont = Math.max(font * Math.sqrt(camera.k), minLabelFontSize)
  const labelLength = Math.min(labelMaxLength, node.label?.length || 0)
  const halfWidth = Math.max(radius * camera.k, labelLength * screenFont * 0.58 / 2)
  const x = node.x * camera.k + camera.x, y = node.y * camera.k + camera.y
  return { left: x - halfWidth, right: x + halfWidth, top: Math.min(y - radius * camera.k, labelLength ? y + radius * camera.k + 15 * Math.sqrt(camera.k) - screenFont * 0.85 : Infinity), bottom: y + radius * camera.k + (labelLength ? 15 * Math.sqrt(camera.k) + screenFont * 0.4 : 0), screenFont }
}

test('automatic framing includes long labels and respects asymmetric phone/fullscreen insets', () => {
  const localNodes = Array.from({ length: 31 }, (_, index) => ({ id: `point-${index}`, type: ['sector', 'concept', 'news'][index % 3], label: `Título extenso para a relação ${index} com a página de conhecimento completo` }))
  const localLinks = localNodes.slice(1).map(node => ({ source: 'point-0', target: node.id }))
  for (const [width, height] of [[320, 420], [740, 560], [1440, 850]]) {
    const layout = focusKnowledgeLayout(createKnowledgeLayout(localNodes, localLinks, width, height), 'point-0')
    for (let frame = 0; frame < 65; frame++) stepKnowledgeLayout(layout, { energy: 0.7 })
    const options = { selectedId: 'point-0', labelMaxLength: 52, padding: { left: 24, right: 64, top: 24, bottom: 72 } }
    const before = structuredClone(layout.nodes)
    const camera = fitKnowledgeCamera(layout.nodes, width, height, options)
    assert.ok(camera.k >= 0.15 && camera.k <= 2.2)
    for (const node of layout.nodes) {
      const box = renderedNodeBounds(node, camera, options.selectedId, 52)
      assert.ok(box.left >= 24 - 0.001 && box.right <= width - 64 + 0.001, `${width}px: label fits horizontally`)
      assert.ok(box.top >= 24 - 0.001 && box.bottom <= height - 72 + 0.001, `${width}px: label fits vertically`)
    }
    assert.deepEqual(layout.nodes, before, 'framing does not move the simulation')
    assert.deepEqual(camera, fitKnowledgeCamera(layout.nodes, width, height, options), 'camera is deterministic')
  }
})

test('framing handles empty, singleton, malformed points and invalid dimensions without NaN', () => {
  assert.deepEqual(fitKnowledgeCamera([], 320, 420), { x: 0, y: 0, k: 1 })
  assert.deepEqual(fitKnowledgeCamera(null), { x: 0, y: 0, k: 1 })
  const valid = { id: 'only', x: 130, y: 42, type: 'concept', label: 'Uma página' }
  const camera = fitKnowledgeCamera([valid, null, { x: Infinity, y: 80 }, { x: 22, y: NaN }], 320, 420)
  assert.deepEqual(camera, fitKnowledgeCamera([valid], 320, 420))
  assert.ok(camera.k > 1, 'a singleton can use the available space')
  const broken = fitKnowledgeCamera([valid], NaN, -20, { padding: { left: Infinity, right: 90000, top: -1, bottom: 90000 }, minZoom: NaN, maxZoom: -8 })
  assert.ok(Object.values(broken).every(Number.isFinite))
})

test('phone framing reserves readable 11px labels in both compact and tall local stages', () => {
  const localNodes = Array.from({ length: 7 }, (_, index) => ({ id: `phone-${index}`, type: ['sector', 'concept', 'news'][index % 3], label: `Título extenso do ponto ${index} que será abreviado no celular` }))
  const localLinks = localNodes.slice(1).map(node => ({ source: 'phone-0', target: node.id }))
  const padding = { top: 12, right: 54, bottom: 48, left: 20 }
  for (const height of [260, 440]) {
    const layout = focusKnowledgeLayout(createKnowledgeLayout(localNodes, localLinks, 320, height), 'phone-0')
    for (let frame = 0; frame < 65; frame++) stepKnowledgeLayout(layout, { energy: 0.7 })
    const options = { padding, selectedId: 'phone-0', labelMaxLength: 26, minLabelFontSize: 11 }
    const camera = fitKnowledgeCamera(layout.nodes, 320, height, options)
    for (const node of layout.nodes) {
      const box = renderedNodeBounds(node, camera, 'phone-0', 26, 11)
      assert.ok(box.screenFont >= 11)
      assert.ok(box.left >= padding.left - 0.001 && box.right <= 320 - padding.right + 0.001, `${height}px stage: readable label fits width`)
      assert.ok(box.top >= padding.top - 0.001 && box.bottom <= height - padding.bottom + 0.001, `${height}px stage: readable label fits height`)
    }
    const smallerLabels = fitKnowledgeCamera(layout.nodes, 320, height, { ...options, minLabelFontSize: 0 })
    assert.ok(camera.k < smallerLabels.k, 'framing makes extra room for the readable text floor')
  }
})

test('the readable-font option is opt-in and invalid minima preserve standard framing', () => {
  const layout = createKnowledgeLayout(nodes.map(node => ({ ...node, label: 'Título do ponto' })), links, 320, 420)
  const baseline = fitKnowledgeCamera(layout.nodes, 320, 420)
  for (const minimum of [0, -11, NaN, Infinity]) assert.deepEqual(fitKnowledgeCamera(layout.nodes, 320, 420, { minLabelFontSize: minimum }), baseline)
})
