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

test('manchete Com Maiúscula Em Cada Palavra volta para a escrita normal, preservando nomes e siglas', async () => {
  const { limparManchete, emCaixaDeTitulo } = await import('../src/newsTitle.js')
  assert.equal(limparManchete('Ibovespa Tem Leve Ganho; Dólar Fecha Estável ante Ao Real'), 'Ibovespa tem leve ganho; Dólar fecha estável ante ao real')
  assert.equal(limparManchete('Petrobras Anuncia Dividendos De R$ 10 Bi Após Lucro No 3T26'), 'Petrobras anuncia dividendos de R$ 10 bi após lucro no 3T26')
  assert.equal(limparManchete('Fed Mantém Juros E Powell Fala Em Cautela Nos EUA'), 'Fed mantém juros e Powell fala em cautela nos EUA')
  // manchete normal não muda
  assert.equal(limparManchete('Dólar sobe a R$ 5,65, maior valor desde junho de 2025'), 'Dólar sobe a R$ 5,65, maior valor desde junho de 2025')
  assert.equal(emCaixaDeTitulo('Lucro da B3 vai a R$ 1,38 bi e administração espera ressaca'), false)
  // toda em caixa alta também não muda
  assert.equal(limparManchete('URGENTE: COPOM MANTÉM SELIC'), 'URGENTE: COPOM MANTÉM SELIC')
})
