import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit))
    else if (value && typeof value === 'object') walk(value, visit)
  }
}
for (const file of ['Aprender.jsx', 'IcmsStDiagram.jsx']) {
  test(`${file}: content callouts start collapsed and retain native summaries`, () => {
    const ast = parse(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'), { sourceType: 'module', plugins: ['jsx'] })
    let callouts = 0
    walk(ast, node => {
      if (node.type !== 'JSXElement' || node.openingElement.name.name !== 'details') return
      const attrs = node.openingElement.attributes
      // Navigation categories are controlled separately from content callouts.
      if (attrs.some(a => a.name?.name === 'className' && a.value?.value === 'learn-group')) return
      callouts++
      assert.equal(attrs.some(a => a.name?.name === 'open'), false)
      assert.ok(node.children.some(c => c.type === 'JSXElement' && c.openingElement.name.name === 'summary'))
    })
    assert.ok(callouts > 0)
  })
}
test('switching concepts remounts callouts, resetting manually opened content', () => {
  const source = readFileSync(new URL('../src/Aprender.jsx', import.meta.url), 'utf8')
  assert.match(source, /<Concept key=\{chosen\.id\}/)
})
