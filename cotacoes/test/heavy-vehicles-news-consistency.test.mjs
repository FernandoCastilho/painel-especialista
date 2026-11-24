import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8')
const resumo = await source('Resumo.jsx')
const setores = await source('SetoresLegado.jsx')

// Veículos pesados e Eleições EUA saíram das Notícias do Mercado em 24/11/2026; o setor segue em Setores.
test('Veículos pesados fica só em Setores, com SectorNews e os indicadores da ANFAVEA', () => {
  assert.match(setores, /import SectorNews from '\.\/SectorNews\.jsx'/)
  assert.match(setores, /<SectorNews key=\{`news-\$\{id\}`\} id=\{id\}/)
  assert.match(setores, /id==='veiculos-pesados' \? \['sector-news.json','heavy-vehicles.json'\]/)
  assert.match(setores, /import HeavyVehicles from '\.\/HeavyVehicles\.jsx'/)
})

test('Notícias do Mercado não tem mais as abas Veículos pesados e Eleições EUA', () => {
  assert.doesNotMatch(resumo, /veiculos-pesados|HeavyVehicles|SectorNews|eleicoes|TemaNoticias/)
  assert.match(resumo, /id: 'moedas', label: 'Moedas', refresh: \['temas.json'\]/)
})
