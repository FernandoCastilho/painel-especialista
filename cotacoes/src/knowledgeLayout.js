// A small, deterministic force layout. The caller owns animation timing and may
// stop stepping at any point; this module never schedules background work.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const dimension = (value, fallback) => Number.isFinite(value) && value >= 80 ? value : fallback
const nodeId = value => typeof value === 'string' && value.trim() ? value : null
const endpoint = value => nodeId(typeof value === 'object' && value ? value.id : value)

function fraction(value) {
  let hash = 2166136261
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967296
}

function bounds(layout) {
  const margin = Math.min(28, layout.width / 6, layout.height / 6)
  return { left: margin, right: layout.width - margin, top: margin, bottom: layout.height - margin }
}

export function createKnowledgeLayout(nodes = [], links = [], width = 1000, height = 650) {
  width = dimension(width, 1000)
  height = dimension(height, 650)
  const seen = new Set()
  const validNodes = (Array.isArray(nodes) ? nodes : []).filter(node => {
    const id = nodeId(node?.id)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
  const groupOf = node => String(node.group || node.type || 'knowledge')
  const groups = [...new Set(validNodes.map(groupOf))].sort()
  const groupNodes = new Map(groups.map(group => [group, validNodes.filter(node => groupOf(node) === group)]))
  const maxGroupSize = Math.max(1, ...[...groupNodes.values()].map(group => group.length))
  const minDimension = Math.min(width, height)
  const anchors = new Map(groups.map((group, index) => {
    const angle = groups.length <= 5 ? -Math.PI / 2 + index * 2 * Math.PI / groups.length : index * GOLDEN_ANGLE
    const radius = groups.length <= 1 ? 0 : groups.length <= 5 ? 0.23 : 0.31 * Math.sqrt((index + 0.5) / groups.length)
    return [group, { x: width / 2 + Math.cos(angle) * width * radius, y: height / 2 + Math.sin(angle) * height * radius }]
  }))
  const groupPositions = new Map(groups.map(group => [group, 0]))
  const layout = { width, height, nodes: [], links: [], motion: 0 }
  const box = bounds(layout)
  layout.nodes = validNodes.map(node => {
    const group = groupOf(node), anchor = anchors.get(group)
    const position = groupPositions.get(group)
    groupPositions.set(group, position + 1)
    const count = groupNodes.get(group).length
    const radius = count === 1 ? 0 : minDimension * 0.25 * Math.sqrt(count / maxGroupSize) * Math.sqrt((position + 0.5) / count)
    const angle = position * GOLDEN_ANGLE + fraction(group) * 2 * Math.PI
    return {
      ...node,
      x: clamp(anchor.x + Math.cos(angle) * radius, box.left, box.right),
      y: clamp(anchor.y + Math.sin(angle) * radius, box.top, box.bottom),
      vx: 0, vy: 0,
      anchorX: anchor.x, anchorY: anchor.y,
    }
  })
  layout.links = (Array.isArray(links) ? links : []).flatMap(link => {
    const source = endpoint(link?.source), target = endpoint(link?.target)
    return source && target && source !== target && seen.has(source) && seen.has(target) ? [{ ...link, source, target }] : []
  })
  return layout
}

export function stepKnowledgeLayout(layout, { pinnedId, pinnedPosition, energy = 1 } = {}) {
  if (!layout || !Array.isArray(layout.nodes)) return layout
  layout.width = dimension(layout.width, 1000)
  layout.height = dimension(layout.height, 650)
  const box = bounds(layout)
  const intensity = Number.isFinite(energy) ? clamp(energy, 0, 1) : 1
  const nodes = layout.nodes
  // Repulsion is local: a distant cluster must not push every outer node into
  // a rectangular boundary. Dense/narrow views use a smaller natural spacing.
  const spacing = clamp(Math.sqrt(layout.width * layout.height / Math.max(1, nodes.length)) * 0.55, 14, 34)
  const interactionRange = Math.min(layout.width, layout.height) * 0.42
  const linkLength = clamp(spacing * 3, 48, 100)
  const byId = new Map(nodes.map((node, index) => [node.id, index]))
  const fx = new Float64Array(nodes.length), fy = new Float64Array(nodes.length)

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    node.x = clamp(Number.isFinite(node.x) ? node.x : layout.width / 2, box.left, box.right)
    node.y = clamp(Number.isFinite(node.y) ? node.y : layout.height / 2, box.top, box.bottom)
    node.vx = Number.isFinite(node.vx) ? node.vx : 0
    node.vy = Number.isFinite(node.vy) ? node.vy : 0
    if (node.id === pinnedId && Number.isFinite(pinnedPosition?.x) && Number.isFinite(pinnedPosition?.y)) {
      node.x = clamp(pinnedPosition.x, box.left, box.right)
      node.y = clamp(pinnedPosition.y, box.top, box.bottom)
      node.vx = 0
      node.vy = 0
    }
  }

  for (let left = 0; left < nodes.length; left++) {
    for (let right = left + 1; right < nodes.length; right++) {
      let dx = nodes[right].x - nodes[left].x, dy = nodes[right].y - nodes[left].y
      let distance = Math.hypot(dx, dy)
      if (distance < 0.01) {
        const angle = fraction(`${nodes[left].id}:${nodes[right].id}`) * 2 * Math.PI
        dx = Math.cos(angle)
        dy = Math.sin(angle)
        distance = 1
      }
      const falloff = Math.max(0, 1 - distance / interactionRange)
      const repel = Math.min(3, spacing * spacing * 1.7 / (distance * distance + 200)) * falloff * falloff + Math.max(0, spacing - distance) * 0.09
      const x = dx / distance * repel, y = dy / distance * repel
      fx[left] -= x
      fy[left] -= y
      fx[right] += x
      fy[right] += y
    }
  }

  for (const link of Array.isArray(layout.links) ? layout.links : []) {
    const left = byId.get(endpoint(link.source)), right = byId.get(endpoint(link.target))
    if (left === undefined || right === undefined || left === right) continue
    const dx = nodes[right].x - nodes[left].x, dy = nodes[right].y - nodes[left].y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const targetLength = nodes[left].type === 'news' || nodes[right].type === 'news' ? linkLength * 0.86 : linkLength
    const spring = (distance - targetLength) * 0.014
    const x = dx / distance * spring, y = dy / distance * spring
    fx[left] += x
    fy[left] += y
    fx[right] -= x
    fy[right] -= y
  }

  let motion = 0
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]
    if (node.id === pinnedId) {
      node.vx = 0
      node.vy = 0
      continue
    }
    const anchorX = Number.isFinite(node.anchorX) ? node.anchorX : layout.width / 2
    const anchorY = Number.isFinite(node.anchorY) ? node.anchorY : layout.height / 2
    const dx = node.x - layout.width / 2, dy = node.y - layout.height / 2
    const radius = Math.max(1, Math.hypot(dx, dy))
    const ellipse = Math.hypot(dx / (layout.width * 0.45), dy / (layout.height * 0.45))
    const containment = Math.max(0, ellipse - 0.8) * 12
    fx[index] += -dx * 0.0025 + (anchorX - node.x) * 0.001 - dx / radius * containment
    fy[index] += -dy * 0.0025 + (anchorY - node.y) * 0.001 - dy / radius * containment
    node.vx = clamp((node.vx + fx[index] * intensity) * 0.78, -7, 7)
    node.vy = clamp((node.vy + fy[index] * intensity) * 0.78, -7, 7)
    const nextX = clamp(node.x + node.vx, box.left, box.right)
    const nextY = clamp(node.y + node.vy, box.top, box.bottom)
    motion = Math.max(motion, Math.hypot(nextX - node.x, nextY - node.y))
    if (nextX === box.left || nextX === box.right) node.vx = 0
    if (nextY === box.top || nextY === box.bottom) node.vy = 0
    node.x = nextX
    node.y = nextY
  }
  layout.motion = motion
  return layout
}
