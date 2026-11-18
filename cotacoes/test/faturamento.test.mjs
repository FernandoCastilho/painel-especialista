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

// Modelo do DAC enviado por Fernando (números inventados): título, cabeçalho com (R$ mil) e meia-risca (–) sem dado.
const MODELO = `Faturamento e endividamento
Competência     Faturamento (R$ mil)    Endividamento (R$ mil)
Jan/24  87      –
Fev/24  1.246   –
Mar/24  2.596   –
Jan/25  350     2.235
Fev/25  549     2.777
Mar/25  1.683   –
Jan/26  5.440   3.825
Fev/26  5.483   3.752
Mar/26  11.416  0
`

test('lê o modelo com título, unidade no cabeçalho e meia-risca como mês sem informação', () => {
  const { meses, avisos, unidade } = fat.parseFaturamento(MODELO)
  assert.deepEqual(avisos, [])
  assert.equal(unidade, 'R$ mil')
  assert.equal(meses.length, 9)
  assert.deepEqual(meses.slice(0, 1).map((m) => [m.rotulo, m.faturamento, m.endividamento]), [['jan/24', 87, null]])
  assert.equal(fat.parseNumero('–'), null)
  assert.equal(fat.parseNumero('—'), null)
  // Período de vários meses: todos os meses do ano anterior entram, inclusive sem endividamento.
  const c = fat.compararPeriodo(meses, fat.chaveMes(2025, 1), fat.chaveMes(2025, 3))
  assert.equal(c.mesesComparados, 3)
  assert.equal(c.faturamento.anterior, 87 + 1246 + 2596)
  assert.equal(c.endividamento.mesesComparados, 0)
  assert.equal(fat.parseFaturamento(fat.EXEMPLO).avisos.length, 0)
  assert.equal(fat.parseFaturamento(fat.EXEMPLO).unidade, 'R$ mil')
})

test('lê a tabela com barras (| Competência | ... |) e ignora a linha de traços', () => {
  const texto = `| Competência | Faturamento (R$ mil) | Endividamento (R$ mil) |
|---|---:|---:|
| Jan/25 | 350 | 2.235 |
| Mar/25 | 1.683 | – |
| Out/26 | 12.839 | 0 |`
  const { meses, avisos, unidade } = fat.parseFaturamento(texto)
  assert.deepEqual(avisos, [])
  assert.equal(unidade, 'R$ mil')
  assert.deepEqual(meses.map((m) => [m.rotulo, m.faturamento, m.endividamento]), [['jan/25', 350, 2235], ['mar/25', 1683, null], ['out/26', 12839, 0]])
})

test('gráfico usa série contínua: mês faltando vira posição vazia, sem saltos na marcação', () => {
  const { meses } = fat.parseFaturamento(MODELO)
  const serie = fat.serieContinua(meses)
  assert.equal(serie.length, 27)
  assert.deepEqual(serie.slice(2, 5).map((m) => [m.rotulo, m.faturamento, !!m.vazio]), [['mar/24', 2596, false], ['abr/24', null, true], ['mai/24', null, true]])
  for (let i = 1; i < serie.length; i++) assert.equal(serie[i].chave, serie[i - 1].chave + 1)
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
})

test('tela abre vazia, sem dados de cliente, e está no catálogo de calculadoras', async () => {
  const raw = (await readFile(new URL('../src/Faturamento.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(raw, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const stub = ({ children }) => createElement('div', null, children)
  runInNewContext(code, { module, exports: module.exports, require: (n) => n === './ChartFullscreen.jsx' || n === './ExpandablePanel.jsx' || n === './CalculatorHelp.jsx' ? stub : n === './faturamento.js' ? fat : require(n) })
  const html = renderToStaticMarkup(createElement(module.exports.default, { onBack: () => {} }))
  assert.match(html, /Cole aqui: Competência \(mês\), Faturamento e Endividamento/)
  assert.match(html, /Nenhum mês lido ainda/)
  assert.doesNotMatch(html, /<svg[^>]*ft-chart/)
  const calc = await readFile(new URL('../src/Calculadora.jsx', import.meta.url), 'utf8')
  assert.match(calc, /id: 'faturamento', title: 'Faturamento'/)
  assert.match(calc, /view === 'faturamento'\) return <Faturamento/)
})

test('total curto do quadro do período segue a unidade colada', () => {
  assert.equal(fat.totalCurto(23400, 'R$ mil'), 'R$ 23,4 MM')
  assert.equal(fat.totalCurto(950, 'R$ mil'), 'R$ 950 mil')
  assert.equal(fat.totalCurto(21.5, 'R$ milhões'), 'R$ 21,5 MM')
  assert.equal(fat.totalCurto(1234.5, null), '1.234,5')
  assert.equal(fat.totalCurto(null, 'R$ mil'), '—')
  // Variação do exemplo da apresentação: 21,5 contra 23,4 = -8%.
  assert.equal(Math.round(fat.variacao(21500, 23400) * 100), -8)
})

test('últimos 12 meses e alavancagem no critério do DAC (endividamento do último saldo ÷ média mensal de 12 meses)', () => {
  // 24 meses fictícios: faturamento 1.000 no primeiro ano e 1.200 no segundo; saldo 0 nos dois últimos meses.
  const linhas = ['Mês Faturamento Endividamento']
  for (let i = 0; i < 24; i++) {
    const k = fat.chaveMes(2024, 11) + i
    const divida = i >= 22 ? 0 : 2400
    linhas.push(`${fat.rotuloMes(k)} ${i < 12 ? '1.000' : '1.200'} ${i === 21 ? '3.000' : divida}`)
  }
  const ind = fat.indicadores12m(fat.parseFaturamento(linhas.join('\n')).meses)
  assert.equal(ind.de, 'nov/25')
  assert.equal(ind.ate, 'out/26')
  assert.equal(ind.meses, 12)
  assert.equal(ind.total, 14400)
  assert.equal(ind.media, 1200)
  assert.equal(ind.totalAnterior, 12000)
  assert.ok(Math.abs(ind.variacao - 0.2) < 1e-12)
  // Saldo zero em set/26 e out/26: vale o último saldo informado (ago/26 = 3.000).
  assert.equal(ind.endividamentoMes, 'ago/26')
  assert.equal(ind.endividamento, 3000)
  assert.equal(ind.alavancagem, 2.5)
  assert.equal(ind.endividamentoForaDaJanela, false)
  // Saldo antigo (fora dos 12 meses): a conta segue a regra e a tela recebe o aviso.
  const antigo = fat.indicadores12m(fat.parseFaturamento('jan/20 1.000 5.000\njan/26 1.000 0').meses)
  assert.equal(antigo.endividamentoForaDaJanela, true)
})

test('com menos de 24 meses não compara 12 contra 12 e a média usa os meses informados', () => {
  const ind = fat.indicadores12m(fat.parseFaturamento('jan/26 1.000 500\nfev/26 2.000 –\nmar/26 3.000 1.000').meses)
  assert.equal(ind.meses, 3)
  assert.equal(ind.media, 2000)
  assert.equal(ind.variacao, null)
  assert.equal(ind.mesesAnterior, 0)
  assert.equal(ind.alavancagem, 0.5)
  assert.equal(fat.indicadores12m([]), null)
  assert.equal(fat.emMilhoes(5931), '5,9')
  assert.equal(fat.emMilhoes(null), '—')
})

test('crescimento do faturamento x endividamento no período escolhido', () => {
  const texto = 'Mês Faturamento Endividamento\njan/25 1.000 2.000\nfev/25 1.000 2.000\njan/26 900 2.400\nfev/26 900 2.400'
  const { meses } = fat.parseFaturamento(texto)
  const c = fat.compararPeriodo(meses, fat.chaveMes(2026, 1), fat.chaveMes(2026, 2))
  const cr = fat.leituraCrescimento(c)
  assert.ok(Math.abs(cr.fat - -0.1) < 1e-12)
  assert.ok(Math.abs(cr.div - 0.2) < 1e-12)
  assert.ok(Math.abs(cr.diferencaPp - 30) < 1e-9)
  assert.equal(cr.relacao, 'piorou')
  const melhor = fat.leituraCrescimento({ faturamento: { variacao: 0.3 }, endividamento: { variacaoMedia: 0.1 } })
  assert.equal(melhor.relacao, 'melhorou')
  assert.equal(fat.leituraCrescimento({ faturamento: { variacao: 0.1 }, endividamento: { variacaoMedia: 0.1 } }).relacao, 'estavel')
  // Sem saldo nos dois períodos: mostra só o faturamento, sem conclusão.
  assert.equal(fat.leituraCrescimento({ faturamento: { variacao: 0.1 }, endividamento: { variacaoMedia: null } }).relacao, null)
})

test('análise automática: sazonalidade, tendência, meses fora do padrão e endividamento', () => {
  // 36 meses fictícios: base 1.000 crescendo 1% ao mês, dezembro +30% e fevereiro -20%; saldo de dívida estável.
  const linhas = ['Mês Faturamento Endividamento']
  for (let i = 0; i < 36; i++) {
    const k = fat.chaveMes(2023, 11) + i
    const m = ((k % 12) + 12) % 12
    const efeito = m === 11 ? 1.3 : m === 1 ? 0.8 : 1
    linhas.push(`${fat.rotuloMes(k)} ${Math.round(1000 * 1.01 ** i * efeito)} ${i >= 34 ? 0 : 2000}`)
  }
  const a = fat.analisarSerie(fat.parseFaturamento(linhas.join('\n')).meses)
  assert.equal(a.suficiente, true)
  assert.equal(a.meses, 36)
  assert.ok(a.sazonalidade, 'com 36 meses há sazonalidade')
  assert.equal(a.sazonalidade.fortes[0].rotulo, 'dez')
  assert.equal(a.sazonalidade.fracos[0].rotulo, 'fev')
  assert.ok(Math.abs(a.sazonalidade.indices[11].indice - 1.3 / 1.0083) < 0.05)
  assert.equal(a.sazonalidade.relevante, true)
  assert.ok(a.tendenciaAno > 0, 'tendência de alta')
  // Com a sazonalidade descontada, dezembro e fevereiro não viram "fora do padrão".
  assert.equal(a.atipicos.filter((x) => /^(dez|fev)/.test(x.rotulo)).length, 0)
  assert.equal(a.endividamento.ultimoRotulo, 'ago/26')
  assert.equal(a.endividamento.semSaldoNoFim, 2)
  assert.ok(a.atencao.some((t) => /sem saldo/.test(t)))
})

test('análise com poucos meses avisa e não inventa sazonalidade', () => {
  assert.equal(fat.analisarSerie(fat.parseFaturamento('jan/26 1 1\nfev/26 2 2').meses).suficiente, false)
  const curta = fat.analisarSerie(fat.parseFaturamento(['jan/26 1.000 500', 'fev/26 900 500', 'mar/26 800 500', 'abr/26 700 500', 'mai/26 600 500', 'jun/26 500 500', 'jul/26 400 500'].join('\n')).meses)
  assert.equal(curta.sazonalidade, null)
  assert.ok(curta.quedas >= 3)
  assert.ok(curta.atencao.some((t) => /quedas seguidas/.test(t)))
  assert.ok(curta.tendenciaAno < 0)
})
