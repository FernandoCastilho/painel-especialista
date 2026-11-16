import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')

// aria-label só vale em elemento com papel; sem ele o leitor de tela ignora a descrição (auditoria axe, 15/11/2026).
test('ponto de status do câmbio tem papel de imagem para o leitor de tela ler a descrição', () => {
  assert.match(src('App.jsx'), /className=\{`dot \$\{feed\}`\} role="img" aria-label=/)
})

test('variação dos bancos tem papel de imagem para o leitor de tela ler direção e valor', () => {
  assert.match(src('Bancos.jsx'), /bank-change--neutro' : ''\}`\} role="img" aria-label=/)
})

test('motivo do erro não fica transparente, para manter contraste de 4,5:1', () => {
  const regra = src('Terminal.css').match(/\.estado small \{[^}]*\}/)[0]
  assert.doesNotMatch(regra, /opacity/)
})
