import { APP_SECTIONS } from '../src/appSections.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/Nav.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/Nav.jsx', import.meta.url), 'utf8')
test('tablet navigation reuses More and phone layout preserves existing breakpoints', () => {
  assert.match(source, /import '\.\/Nav\.css'/)
  assert.match(css, /@media \(min-width: 700px\) and \(max-width: 999px\)/)
  assert.equal((css.match(/@media/g) || []).length, 3)
  assert.match(css, /\.nav-top nav\.tabs > button\.sec \{ display: none; \}/)
  assert.match(css, /\.nav-top nav\.tabs > \.more-tab \{ display: flex; \}/)
  assert.match(css, /overflow: visible/)
  assert.match(css, /min-height: 48px/)
  assert.match(css, /@media \(max-width:699px\)/)
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(44px,1fr\)\) minmax\(44px,1\.55fr\) repeat\(3,minmax\(44px,1fr\)\)/)
  assert.match(css, /min-height:54px/)
  assert.match(css, /overflow-wrap:anywhere/)
})
test('More destinations and dismissal remain available', () => {
  for (const id of ['cenarios', 'noticias', 'config']) assert.ok(APP_SECTIONS.some(section => section.id === id))
  assert.match(source, /aria-expanded=\{more\}/)
  assert.match(source, /e\.key === 'Escape'/)
  assert.match(source, /setMore\(false\), trigger\.current\?\.focus\(\), onTab\(t\.id\)/)
})

test('desktop compacto preserva alvo mínimo de 44px também para Juros e Mais', () => {
  assert.match(css, /\.term-head \.topbar-tabs\.priority-desktop > button,[\s\S]*?\.term-head \.topbar-tabs\.priority-desktop > \.more-tab > button \{ min-width:44px; min-height:44px; flex-shrink:0; \}/)
})
