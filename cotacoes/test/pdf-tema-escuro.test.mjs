import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// O PDF do BNDES e do 4131 sai branco mesmo com o painel no tema escuro:
// a cor de fundo da página inteira (inclusive as margens da folha) e os rótulos não seguem o tema.
const css = readFileSync(new URL('../src/BndesPrint.css', import.meta.url), 'utf8')
const impressao = css.slice(css.indexOf('@media print'))

test('PDF: margens da folha ficam brancas no tema escuro', () => {
  assert.match(impressao, /html:has\(body\.bnprint-active\)\s*\{[^}]*background:white !important/)
})

test('PDF: rótulos dos dados da operação têm cor própria, sem herdar do tema', () => {
  assert.match(css, /\.bnprint-facts dt \{[^}]*color:#33465f/)
})
