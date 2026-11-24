import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Pedido do Fernando (24/11/2026): histórico em 12 meses com média, referência de mercado e premissas recolhidas,
// e o ícone do WhatsApp ao lado do envelope copiando o quadro da cotação como imagem.
const finame = readFileSync(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
const compara = readFileSync(new URL('../src/BndesCompare.jsx', import.meta.url), 'utf8')
const imagem = readFileSync(new URL('../src/cotacaoImagem.js', import.meta.url), 'utf8')

test('histórico dos indexadores fica em 12 meses, sem filtros, com média no rodapé', () => {
  assert.match(finame, /<ComparaSeries compactHelp fixo items=\{historyItems\}[^>]*period=\{\{ preset: 12, custom: null \}\}/)
  assert.match(compara, /\{!fixo && <ChartFilters/)
  assert.match(compara, /Média dos últimos 12 meses/)
})

test('referência de mercado e premissas viram blocos recolhíveis', () => {
  assert.match(finame, /<ReferenciaMercado callout /)
  assert.match(finame, /<BndesDetails title="Premissas e limites da simulação"/)
})

test('WhatsApp fica ao lado do envelope e só na cotação única', () => {
  assert.match(finame, /emailAlternatives : undefined} \/>\}\{res && !comparar && <WhatsAppCotacao dados=\{imagemDados\} \/>\}/)
})

test('a imagem só desenha textos prontos, sem conta nova', () => {
  assert.doesNotMatch(imagem, /import .*(finame|cet|simular)/i)
})
