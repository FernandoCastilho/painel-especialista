import { APP_SECTIONS } from '../src/appSections.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/Nav.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
test('tablet navigation reuses More and phone layout preserves existing breakpoints', () => {
  assert.match(source, /import '\.\/Nav\.css'/)
  assert.match(css, /@media \(min-width: 700px\) and \(max-width: 999px\)/)
  assert.equal((css.match(/@media/g) || []).length, 2)
  assert.match(css, /\.nav-top nav\.tabs > button\.sec \{ display: none; \}/)
  assert.match(css, /\.nav-top nav\.tabs > \.more-tab \{ display: flex; \}/)
  assert.match(css, /overflow: visible/)
  assert.match(css, /min-height: 48px/)
  assert.match(css, /@media \(max-width:699px\)/)
  assert.match(css, /grid-template-columns:minmax\(44px,1fr\) minmax\(44px,1fr\) 44px minmax\(70px,1\.6fr\) minmax\(44px,1fr\) 44px/)
  assert.match(css, /min-height:54px/)
})
test('More destinations and dismissal remain available', () => {
  for (const id of ['cenarios', 'noticias', 'config']) assert.ok(APP_SECTIONS.some(section => section.id === id))
  assert.match(source, /aria-expanded=\{more\}/)
  assert.match(source, /e\.key === 'Escape'/)
  assert.match(source, /setMore\(false\), trigger\.current\?\.focus\(\), onTab\(t\.id\)/)
})
