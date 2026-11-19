import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { IOF_PLANILHA, emprestimoPrice, irPessoaFisica, parseDecimal, simularDividendosEmprestimo, simularPrazo } from '../src/dividendosEmprestimo.js'

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (tolerância ${tol})`)
const base = { valor: 10_000_000, taxaMes: 0.0131, cdi: 0.1387, pctCdi: 1, aliquotaPj: 0.34, aliquotaDividendos: 0.1 }

// Planilha "Dividendos_Comparativo" enviada por Fernando em 18/11/2026 (foto). Com o IOF da planilha (0,0041% ao dia),
// o IOF bate com a planilha; a parcela difere ~R$ 300 porque a taxa da planilha tem mais casas que "1,31%".
test('IOF da planilha reproduzido com a regra de 0,0041% ao dia', () => {
  const esperado = { 12: 119850, 24: 156382, 36: 168462, 48: 174429, 60: 177953 }
  for (const [n, iof] of Object.entries(esperado)) near(emprestimoPrice(10_000_000, 0.0131, Number(n), IOF_PLANILHA).iof, iof, 15)
})

test('montante da planilha = ganho + dividendos + economia de IR (prova com os números da foto, 12 meses)', () => {
  near(121277 + 1000000 + 336030, 1457307, 0)
  near(0.34 * (10988323 - 10000000), 336030, 1) // economia = 34% × (juros + IOF)
  const r = simularPrazo({ ...base, iof: IOF_PLANILHA }, 12)
  near(r.montantePlanilha, r.ganhoPlanilha + r.dividendos + r.reducaoIr, 1e-6)
  assert.equal(r.ir, 0.175) // 12 meses = 365 dias (decisão de Fernando); a planilha usa 20% (360 dias)
})

test('faixas de IR da aplicação de pessoa física', () => {
  assert.equal(irPessoaFisica(180), 0.225)
  assert.equal(irPessoaFisica(360), 0.2)
  assert.equal(irPessoaFisica(720), 0.175)
  assert.equal(irPessoaFisica(1800), 0.15)
  assert.deepEqual(simularDividendosEmprestimo(base).prazos.map((x) => x.ir), [0.175, 0.15, 0.15, 0.15, 0.15])
})

// Conferência independente: livro-caixa mês a mês dos dois caminhos, sem as fórmulas da calculadora.
function livroCaixa(p, n) {
  const i = p.taxaMes
  const cdiMes = (1 + ((1 + p.cdi) ** (1 / 252) - 1) * p.pctCdi) ** 21 - 1
  const rPj = cdiMes * (1 - 0.0465) * (1 - p.aliquotaPj)
  // Caminho B: empresa guarda o valor, paga IOF (com dedução) na contratação e parcelas (com dedução dos juros) todo mês.
  let saldoDivida = p.valor
  const pmt = p.valor * i / (1 - (1 + i) ** -n)
  let iof = p.valor * 0.0038
  const amort = []
  for (let k = 1; k <= n; k++) { const j = saldoDivida * i; amort.push([k, pmt - j, j]); saldoDivida -= pmt - j }
  for (const [k, a] of amort) iof += a * 0.000082 * Math.min(30 * k, 365)
  let caixaB = p.valor - iof * (1 - p.aliquotaPj)
  for (const [, , j] of amort) caixaB = caixaB * (1 + rPj) - pmt + p.aliquotaPj * j
  // Caminho A: empresa paga o valor hoje; caixa zero. Sócio aplica o líquido; no B aplica o valor cheio.
  const dias = Math.round(n * 365 / 12)
  const fator = 1 + ((1 + cdiMes) ** n - 1) * (1 - irPessoaFisica(dias))
  const iofSocio = p.mutuo ? p.valor * (0.0038 + 0.000082 * Math.min(dias, 365)) : 0
  const socioB = (p.valor - iofSocio) * fator
  const socioA = p.valor * (1 - p.aliquotaDividendos) * fator
  return (socioB - socioA) + (caixaB - 0)
}

test('conferência independente pelo livro-caixa, todos os prazos e cenários', () => {
  for (const p of [base, { ...base, cdi: 0.1415, pctCdi: 0.95, taxaMes: 0.011, aliquotaDividendos: 0.05 }, { ...base, aliquotaPj: 0.24, valor: 3_500_000 }, { ...base, mutuo: true }]) {
    for (const r of simularDividendosEmprestimo(p).prazos) near(r.resultado, livroCaixa(p, r.n), 0.05)
  }
})

test('ponte planilha → justo fecha e a alíquota de empate zera o resultado', () => {
  for (const r of simularDividendosEmprestimo(base).prazos) {
    near(r.montantePlanilha + r.ajusteSocio + r.ajusteEmpresa, r.resultado, 1e-4)
    const zero = simularPrazo({ ...base, aliquotaDividendos: r.aliquotaEmpate }, r.n)
    near(zero.resultado, 0, 1e-4)
  }
})

test('exemplo da planilha com IOF atual: ganho justo bem menor que a soma simples', () => {
  const [r12, , , , r60] = simularDividendosEmprestimo(base).prazos
  near(r12.resultado, 840000, 15000)
  near(r60.resultado, 656000, 15000)
  assert.ok(r12.montantePlanilha > r12.resultado + 500000)
  assert.ok(r12.iof > 200000 && r12.iof < 205000, 'IOF atual (0,0082% ao dia) acima do da planilha')
})

test('imposto adiado e IOF do mútuo', () => {
  const sem = simularDividendosEmprestimo(base).prazos
  const com = simularDividendosEmprestimo({ ...base, mutuo: true }).prazos
  for (const r of sem) near(r.resultadoAdiado, r.resultado - 1_000_000, 1e-6)
  near(com[0].custoMutuo, 10_000_000 * (0.0038 + 0.000082 * 365), 0.01) // 337.300
  assert.ok(com[0].resultado < sem[0].resultado - 337_300)
  for (const r of com) {
    near(r.montantePlanilha + r.ajusteSocio + r.ajusteEmpresa, r.resultado, 1e-4)
    near(simularPrazo({ ...base, mutuo: true, aliquotaDividendos: r.aliquotaEmpate }, r.n).resultado, 0, 1e-4)
  }
})

test('erros de preenchimento', () => {
  assert.equal(simularDividendosEmprestimo({ ...base, valor: NaN }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, taxaMes: 0 }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, cdi: 14.15 }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, aliquotaDividendos: NaN }).ok, false)
  assert.equal(parseDecimal('1,31'), 1.31)
  assert.equal(parseDecimal('10.000.000,00'), 10000000)
  assert.ok(Number.isNaN(parseDecimal('abc')))
})

test('calculadora no menu, no atalho e na busca, com os avisos de risco', () => {
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  assert.match(src('src/Calculadora.jsx'), /id: 'dividendos-emprestimo'/)
  assert.match(src('src/terminal.js'), /DIVIDENDOS: \['calculadora', 'dividendos-emprestimo'\]/)
  assert.match(src('scripts/build-search-index.mjs'), /'DividendosEmprestimo.jsx':\['calculadora\/dividendos-emprestimo'/)
  const tela = src('src/DividendosEmprestimo.jsx')
  for (const aviso of [/distribuição disfarçada de lucros/, /Adiamento, não isenção/, /mais de R\$ 50 mil no mês/, /redutor pode devolver/]) assert.match(tela, aviso)
})
