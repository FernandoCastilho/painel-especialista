import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Pedido do Fernando (28/11/2026): ícone do WhatsApp do BNDES e do CDC sem aviso escrito na tela,
// com o mesmo retorno do Faturamento (o ícone vira um visto) e dica + rótulo acessível.
const whats = readFileSync(new URL('../src/WhatsAppCotacao.jsx', import.meta.url), 'utf8')

test('sem aviso escrito do WhatsApp na tela', () => {
  assert.doesNotMatch(whats, /Cole na conversa/)
  assert.doesNotMatch(whats, /<small/)
  assert.match(whats, /<span role="status" style=\{ESCONDIDO\}>\{aviso\.texto\}<\/span>/)
})

test('copiar troca o ícone por um visto por 2 segundos', () => {
  assert.match(whats, /setAviso\('Imagem copiada\.', true\)/)
  assert.match(whats, /\{aviso\.ok\s*\?\s*<svg[^>]*><path d="M5 12\.5l4\.5 4\.5L19 7\.5" \/><\/svg>/)
  assert.match(whats, /, 2000\)/)
})

test('mantém dica e rótulo acessível', () => {
  assert.match(whats, /aria-label=\{label\} title=\{label\}/)
})
