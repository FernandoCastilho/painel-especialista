import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('ajuda compartilhada abre por clique e mantém fechamento explícito', async () => {
  const source = await readFile(new URL('../src/FinimpHelp.jsx', import.meta.url), 'utf8')
  assert.match(source, /onClick=\{\(\)=>\{[^}]*setOpen\(true\)/)
  assert.match(source, /popup\.showModal\(\)/)
  assert.match(source, /onCancel=\{event=>\{event\.preventDefault\(\);close\(\)/)
  assert.match(source, /className="fi-help-close" onClick=\{close\}>Fechar ajuda/)
  assert.doesNotMatch(source, /event\.clientX/)
  assert.match(source, /button\.current\?\.focus\(\)/)
  const adapter = await readFile(new URL('../src/CalculatorHelp.jsx', import.meta.url), 'utf8')
  assert.match(adapter, /<FinimpHelp title=\{heading\}>\{children\}<\/FinimpHelp>/)
})
