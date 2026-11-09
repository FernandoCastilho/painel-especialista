import { readFile, writeFile } from 'node:fs/promises'

const path = process.argv[2]
if (!path) throw new Error('Uso: node scripts/export-recovery-geography.mjs <malha-UF.geojson>')
const geo = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
const codes = {11:'RO',12:'AC',13:'AM',14:'RR',15:'PA',16:'AP',17:'TO',21:'MA',22:'PI',23:'CE',24:'RN',25:'PB',26:'PE',27:'AL',28:'SE',29:'BA',31:'MG',32:'ES',33:'RJ',35:'SP',41:'PR',42:'SC',43:'RS',50:'MS',51:'MT',52:'GO',53:'DF'}
const coord = ([lon, lat]) => [Math.round((lon + 75) * 150) / 10, Math.round((6 - lat) * 150) / 10]
const bounds = points => {
  const xs = points.map(point => point[0]), ys = points.map(point => point[1])
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}
function viewBox(points, minSize, padding) {
  const [left, top, right, bottom] = bounds(points)
  const w = Math.max(minSize, right - left + padding * 2), h = Math.max(minSize, bottom - top + padding * 2)
  return [Math.round((left + right - w) / 2), Math.round((top + bottom - h) / 2), Math.ceil(w), Math.ceil(h)].join(' ')
}
function areaAndCenter(ring) {
  let sum = 0, x = 0, y = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1,y1] = ring[i], [x2,y2] = ring[i + 1]
    const delta = x1 * y2 - x2 * y1
    sum += delta
    x += (x1 + x2) * delta
    y += (y1 + y2) * delta
  }
  return { area: Math.abs(sum), x: x / (3 * sum), y: y / (3 * sum) }
}

const allPoints = [], states = []
for (const feature of geo.features) {
  const uf = codes[feature.properties.codarea]
  if (!uf || !['Polygon','MultiPolygon'].includes(feature.geometry.type)) throw new Error('Geometria de UF inválida')
  const raw = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates
  const polygons = raw.map(polygon => polygon.map(ring => ring.map(coord)))
  const rings = polygons.flat()
  const points = rings.flat()
  const centers = polygons.map(polygon => areaAndCenter(polygon[0])).sort((a,b) => b.area - a.area)
  const { x, y } = centers[0]
  if (![x,y].every(Number.isFinite)) throw new Error(`Centro inválido para ${uf}`)
  allPoints.push(...points)
  states.push({
    uf, x: Math.round(x), y: Math.round(y), viewBox: viewBox(points, 190, 35),
    path: rings.map(ring => 'M' + ring.map(point => point.join(',')).join('L') + 'Z').join(''),
  })
}
if (states.length !== 27 || new Set(states.map(state => state.uf)).size !== 27) throw new Error('A malha precisa conter as 27 UFs')
const output = { source: 'IBGE – Malhas Territoriais', viewBox: viewBox(allPoints, 0, 23), states }
await writeFile(new URL('../src/recovery-geography.json', import.meta.url), JSON.stringify(output) + '\n', 'utf8')
