import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('primeira tela das calculadoras avisa que está em construção e é só para estudo', async () => {
  const src = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(src, /<p className="cx-construcao" role="note"><strong>Em construção!<\/strong> Os cálculos podem conter erros\. Use somente para estudo\.<\/p>\s*<div className="calc-catalog-groups">/)
})
