import test from 'node:test'
import assert from 'node:assert/strict'
import { limparManchete } from '../src/newsTitle.js'

test('manchete sem a assinatura do agregador no fim', () => {
  const casos = [
    ['Dólar recua com dados dos EUA Por Investing.com', 'Dólar recua com dados dos EUA'],
    ['Dólar recua com dados dos EUA - Investing.com', 'Dólar recua com dados dos EUA'],
    ['Dólar recua – Investing.com Brasil', 'Dólar recua'],
    ['Oil rises by Investing.com', 'Oil rises'],
    ['Ibovespa sobe | Investing.com ', 'Ibovespa sobe'],
    ['Ibovespa sobe por investing.com.', 'Ibovespa sobe'],
  ]
  for (const [original, esperado] of casos) assert.equal(limparManchete(original), esperado, original)
})
test('manchete sem assinatura, com o nome no meio ou só com a assinatura fica como veio', () => {
  for (const titulo of ['Ibovespa sobe 1%', 'Investing.com lança nova ferramenta de análise', 'Analistas do Investing.com veem alta', 'Investing.com', 'Exportações sobem por Investing.company', '']) assert.equal(limparManchete(titulo), titulo)
  assert.equal(limparManchete(undefined), undefined)
})
