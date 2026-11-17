import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { flagSvg } from '../src/flags.js'

const zones = { BRL: ['São Paulo', 'America/Sao_Paulo'], USD: ['Nova York', 'America/New_York'], GBP: ['Londres', 'Europe/London'], JPY: ['Tóquio', 'Asia/Tokyo'] }
test('desktop clocks pair each market with its local SVG flag, preserving clock labels and zones', async () => {
  const src = await readFile(new URL('../src/TopBar.jsx', import.meta.url), 'utf8')
  const { code } = await transform(src + '\nexport { Clocks }', { loader: 'jsx', format: 'cjs' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, React, Date, Intl,
    require(name) {
      if (name === 'react') return React
      if (name === './Clock.jsx') return { ZONES: Object.fromEntries(Object.entries(zones).map(([c, [city, tz]]) => [c, { city, tz }])) }
      if (name === './Flag.jsx') return { __esModule: true, default: ({ code, width, height }) => React.createElement('span', { className: 'flag', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: flagSvg(code, `width="${width}" height="${height}"`) } }) }
      return {}
    },
  })
  const html = renderToStaticMarkup(React.createElement(module.exports.Clocks))
  assert.equal((html.match(/<svg /g) || []).length, 4)
  for (const [c, [city]] of Object.entries(zones)) {
    assert.ok(html.includes(`title="${city}"`))
    assert.ok(html.includes(flagSvg(c, 'width="18" height="12"')))
  }
  for (const label of ['BRT', 'NYC', 'LDN', 'TYO']) assert.ok(html.includes(`<b>${label}</b>`))
})
test('responsive clock selectors target clocks only, never nested flag spans', async () => {
  const css = await readFile(new URL('../src/Terminal.css', import.meta.url), 'utf8')
  assert.ok(!css.includes('.topbar-clocks span:nth-child'))
  assert.ok(css.includes('.topbar-clocks > .topbar-clock:nth-child(n+2)'))
  assert.ok(css.includes('.topbar-clocks > .topbar-clock:nth-child(n+3)'))
})
