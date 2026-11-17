import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as fat from '../src/faturamento.js'

const require = createRequire(import.meta.url)
// Números fictícios, no mesmo formato do texto copiado do DAC.
const TEXTO = `Mês     Faturamento     Endividamento
out/24  7.000   9.000
nov/24  5.000   9.000
jan/25  5.500   9.300
fev/25  5.400   8.700
out/25  6.300   10.000
nov/25  6.000   10.200
jan/26  5.500   10.300
fev/26  5.100   0
`

test('lê o texto colado do DAC, com cabeçalho, espaços ou tabulação', () => {
  const { meses, avisos } = fat.parseFaturamento(TEXTO)
  assert.deepEqual(avisos, [])
  assert.equal(meses.length, 8)
  assert.deepEqual(meses[0], { chave: fat.chaveMes(2024, 10), rotulo: 'out/24', ano: 2024, mes: 10, faturamento: 7000, endividamento: 9000 })
  assert.equal(meses.at(-1).endividamento, 0)
  const tab = fat.parseFaturamento('Mês\tFaturamento\tEndividamento\nset/26\t4.647\t0\n01/2026;5.584,50;10.349')
  assert.deepEqual(tab.meses.map((m) => [m.rotulo, m.faturamento, m.endividamento]), [['jan/26', 5584.5, 10349], ['set/26', 4647, 0]])
})

test('formatos de mês e número aceitos e linhas ruins viram aviso', () => {
  assert.deepEqual(fat.parseMes('Out. 2024'), { ano: 2024, mes: 10 })
  assert.deepEqual(fat.parseMes('março/25'), { ano: 2025, mes: 3 })
  assert.equal(fat.parseMes('13/2025'), null)
  assert.equal(fat.parseNumero('R$ 7.123,45'), 7123.45)
  assert.equal(fat.parseNumero('-'), null)
  assert.equal(fat.parseNumero('abc'), undefined)
  const { meses, avisos } = fat.parseFaturamento('xyz/24 10 20\nout/24 abc 5\nout/24 1 2\nout/24 3 4')
  assert.equal(meses.length, 1)
  assert.equal(meses[0].faturamento, 1)
  assert.deepEqual(avisos.map((a) => a.linha), [1, 2, 4])
})

test('um mês clicado é comparado com o mesmo mês do ano anterior', () => {
  const { meses } = fat.parseFaturamento(TEXTO)
  const k = fat.chaveMes(2025, 10)
  const c = fat.compararPeriodo(meses, k, k)
  assert.equal(c.rotulo, 'out/25')
  assert.equal(c.rotuloAnterior, 'out/24')
  assert.equal(c.faturamento.atual, 6300)
  assert.equal(c.faturamento.anterior, 7000)
  assert.ok(Math.abs(c.faturamento.variacao - (6300 / 7000 - 1)) < 1e-12)
  assert.ok(Math.abs(c.endividamento.variacaoUltimo - (10000 / 9000 - 1)) < 1e-12)
})

test('período arrastado soma só os meses que existem nos dois anos e ignora saldo zero', () => {
  const { meses } = fat.parseFaturamento(TEXTO)
  // Arrastar da direita para a esquerda dá o mesmo período.
  const c = fat.compararPeriodo(meses, fat.chaveMes(2026, 2), fat.chaveMes(2025, 10))
  assert.equal(c.rotulo, 'out/25 a fev/26')
  assert.equal(c.rotuloAnterior, 'out/24 a fev/25')
  assert.equal(c.mesesNoPeriodo, 4)
  assert.equal(c.mesesComparados, 4)
  assert.equal(c.faturamento.atual, 6300 + 6000 + 5500 + 5100)
  assert.equal(c.faturamento.anterior, 7000 + 5000 + 5500 + 5400)
  assert.equal(c.faturamento.mediaAtual, 22900 / 4)
  // fev/26 tem saldo 0: fica fora do endividamento.
  assert.equal(c.endividamento.mesesComparados, 3)
  assert.equal(c.endividamento.mediaAtual, (10000 + 10200 + 10300) / 3)
  assert.equal(c.endividamento.mediaAnterior, (9000 + 9000 + 9300) / 3)
  assert.equal(c.endividamento.ultimoRotulo, 'jan/26')
  assert.equal(c.endividamento.ultimoAnteriorRotulo, 'jan/25')
  // Sem ano anterior colado: nada a comparar.
  const s = fat.compararPeriodo(meses, fat.chaveMes(2024, 10), fat.chaveMes(2024, 11))
  assert.equal(s.mesesComparados, 0)
  assert.equal(s.faturamento.variacao, null)
})

test('resumo por ano usa só os meses colados', () => {
  const anos = fat.resumoPorAno(fat.parseFaturamento(TEXTO).meses)
  assert.deepEqual(anos.map((a) => [a.ano, a.meses, a.total, a.media]), [[2024, 2, 12000, 6000], [2025, 4, 23200, 5800], [2026, 2, 10600, 5300]])
  assert.equal(fat.parseFaturamento(fat.EXEMPLO).avisos.length, 0)
})

test('tela abre vazia, sem dados de cliente, e está no catálogo de calculadoras', async () => {
  const raw = (await readFile(new URL('../src/Faturamento.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(raw, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const stub = ({ children }) => createElement('div', null, children)
  runInNewContext(code, { module, exports: module.exports, require: (n) => n === './ChartFullscreen.jsx' || n === './ExpandablePanel.jsx' || n === './CalculatorHelp.jsx' ? stub : n === './faturamento.js' ? fat : require(n) })
  const html = renderToStaticMarkup(createElement(module.exports.default, { onBack: () => {} }))
  assert.match(html, /Cole aqui: Mês, Faturamento e Endividamento/)
  assert.match(html, /Nenhum mês lido ainda/)
  assert.doesNotMatch(html, /<svg[^>]*ft-chart/)
  const calc = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(calc, /id: 'faturamento', title: 'Faturamento'/)
  assert.match(calc, /view === 'faturamento'\) return <Faturamento/)
})
