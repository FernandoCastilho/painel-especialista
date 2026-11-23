import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { novidadesDaSemana, organizarNovidades } from '../src/novidadesSemana.js'

test('a tela reúne todos os itens por dia civil de Brasília, inclusive na virada do ano', () => {
  const entradas = [
    { date: '26/12/2026', items: ['Anterior'] },
    { date: '02/01/2027', items: ['1', '2', '3', '4', '5'] },
    { date: '27/12/2026', items: ['Primeiro dia'] },
    { date: '02/01/2027', items: ['Outro ajuste do dia'] },
    { date: '03/01/2027', resumo: 'Amanhã', items: ['Futura'] },
  ]
  const agora = Date.parse('2027-01-03T02:59:59Z')
  assert.deepEqual(organizarNovidades(entradas, agora), {
    recentes: [
      { date: '02/01/2027', items: ['1', '2', '3', '4', '5', 'Outro ajuste do dia'] },
      { date: '27/12/2026', items: ['Primeiro dia'] },
    ],
    anteriores: [{ date: '26/12/2026', items: ['Anterior'] }],
  })
  assert.deepEqual(novidadesDaSemana(entradas, agora), [])
  assert.deepEqual(novidadesDaSemana(entradas, agora + 1000), ['Amanhã'])
  assert.deepEqual(organizarNovidades(entradas, Date.parse('2027-01-10T03:00:00Z')).recentes, [])
})

test('novidades da semana: só entradas com resumo dos últimos 7 dias, mais recente primeiro, no máximo 4', () => {
  const e = [
    { date: '03/11/2026', resumo: 'A' }, { date: '02/11/2026', resumo: 'B' }, { date: '02/11/2026' }, { date: '01/11/2026', resumo: 'C' },
    { date: '31/10/2026', resumo: 'D' }, { date: '28/10/2026', resumo: 'E' }, { date: '20/10/2026', resumo: 'F' },
  ]
  const now = Date.parse('2026-11-03T15:00:00Z')
  assert.deepEqual(novidadesDaSemana(e, now), ['A', 'B', 'C', 'D'])
  assert.deepEqual(novidadesDaSemana(e, now, 10), ['A', 'B', 'C', 'D', 'E'])
  assert.deepEqual(novidadesDaSemana(e, Date.parse('2026-11-20T15:00:00Z')), [])
})


test('resumo Finame distingue os fluxos TFC/TFB e TLP exigível e condiciona IOF zero', () => {
  const source = readFileSync(new URL('../src/Novidades.jsx', import.meta.url), 'utf8')
  const resumo = source.match(/resumo: '([^']*Calculadora BNDES Finame Materiais[^']*)'/)?.[1]
  assert.ok(resumo, 'resumo Finame deve existir no aviso inicial')
  assert.match(resumo, /projeção com TFC ou TFB/)
  assert.match(resumo, /TLP exigível em fluxo próprio/)
  assert.match(resumo, /IOF zero somente após confirmação de recursos FINAME elegíveis/)
  assert.doesNotMatch(resumo, /TFC, TFB ou TLP|IOF zero por padrão/)
})
