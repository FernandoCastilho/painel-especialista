import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { lerValor } from '../src/simulacaoCambio.js'

const chart = readFileSync(new URL('../src/HistoryChart.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('mantém notícias e maior movimento ao agrupar as cotações', () => {
  assert.doesNotMatch(chart, /eventos=\{active \? undefined|movimento=\{active \? undefined/)
  assert.match(chart, /<PlotView \{\.\.\.props\}/)
  assert.match(chart, /Math\.max\(g\.t0, Math\.min\(g\.t1, ev\.t\)\)/)
})

test('o balão usa a posição da própria bandeira e links com contraste local', () => {
  assert.match(chart, /posicaoBalaoNoticia\(naTela\(bandeiraAberta\.x, bandeiraAberta\.yb\)/)
  assert.match(css, /:root\[data-theme\] \.plot \.fx-balao a\s*\{[^}]*color:#1f2a6b/)
})

test('os dois eixos de câmbio são compactos e intraday prioriza apenas hora', () => {
  assert.match(chart, /intraday \? fmtTime\(t\) : dateLabel \? dateLabel\(t\) : rotuloData/)
  assert.equal((chart.match(/className="tick"/g) ?? []).length, 2)
  assert.match(css, /\.plot-fx\s+\.tick\s*\{\s*font-size:9px/)
})

test('o campo USD abre editável com cem mil na notação do painel', () => {
  const valor = chart.match(/useState\(\(\) => simular === 'USD' \? '([^']+)' : ''\)/)?.[1]
  assert.equal(lerValor(valor), 100000)
  assert.match(chart, /value=\{valorTxt\} onChange=\{\(e\) => setValorTxt\(e\.target\.value\)\}/)
})

test('a escala de 5 minutos marca cada observação e não liga intervalos vazios', async () => {
  const { caminhoCincoMinutos } = await import('../src/chartLinePath.js')
  const p = [{t: 60000, bid: 5}, {t: 340000, bid: 6}, {t: 920000, bid: 4}, {t: 1220000, bid: 4}]
  assert.equal(caminhoCincoMinutos(p, t => t / 60000, v => v), 'M1.0,5.0L5.7,6.0M15.3,4.0L20.3,4.0')
  assert.match(chart, /className="fx-ponto-5min"/)
})

test('balão fica a 8 px abaixo da bandeira ou acima se faltar espaço', async () => {
  const { posicaoBalaoNoticia } = await import('../src/chartToque.js')
  const normal = posicaoBalaoNoticia({left: 160, top: 48}, {w: 720, top: 0, h: 240})
  assert.equal(normal.top, 56)
  assert.equal(normal.left, 8)
  const canto = posicaoBalaoNoticia({left: 380, top: 190}, {w: 390, top: 0, h: 240}, true)
  assert.equal(canto.top, 152)
  assert.equal(canto.left + canto.width, 382)
  assert.equal(canto.transform, 'translateY(-100%)')
})
