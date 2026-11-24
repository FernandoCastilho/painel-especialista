import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FORMATOS, fluxoEmprestimo, iofCredito, irPessoaFisica, parseDecimal, simularDividendosEmprestimo, simularOperacao } from '../src/dividendosEmprestimo.js'

const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (tolerância ${tol})`)
const base = { valor: 10_000_000, taxaMes: 0.0131, cdi: 0.1387, pctCdi: 1, aliquotaPj: 0.34, comIof: true, temAta: true, aliquotaDividendos: 0.1 }

test('fluxos dos quatro formatos quitam o principal e somam os juros certos', () => {
  for (const { id } of FORMATOS) {
    const f = fluxoEmprestimo(10_000_000, 0.0131, 24, id)
    near(f.reduce((a, x) => a + x.amortizacao, 0), 10_000_000, 1e-4)
    near(f.reduce((a, x) => a + x.pagamento, 0) - 10_000_000, f.reduce((a, x) => a + x.juros, 0), 1e-4)
  }
  const fim = fluxoEmprestimo(10_000_000, 0.0131, 24, 'fim')
  near(fim.at(-1).pagamento, 10_000_000 * 1.0131 ** 24, 1e-4)
  assert.ok(fim.slice(0, -1).every((x) => x.pagamento === 0))
  const juros = fluxoEmprestimo(10_000_000, 0.0131, 24, 'juros')
  near(juros[0].pagamento, 131_000, 1e-6)
})

test('IOF: Price confere com a regra do painel; principal no fim paga o teto de 365 dias', () => {
  near(iofCredito(10_000_000, fluxoEmprestimo(10_000_000, 0.0131, 12, 'price')), 201_714, 2)
  near(iofCredito(10_000_000, fluxoEmprestimo(10_000_000, 0.0131, 24, 'juros')), 10_000_000 * (0.0038 + 0.000082 * 365), 1e-4)
  assert.equal(simularOperacao({ ...base, comIof: false }, 12, 'price').iof, 0)
})

test('faixas de IR do sócio por dias corridos reais', () => {
  assert.equal(irPessoaFisica(365), 0.175)
  assert.deepEqual(simularDividendosEmprestimo(base).prazos.map((x) => x.formatos[0].ir), [0.175, 0.15, 0.15, 0.15, 0.15])
})

// Conferência independente: livro-caixa mês a mês da empresa e conta direta do sócio, sem as fórmulas da calculadora.
function livroCaixa(p, n, formato) {
  const i = p.taxaMes
  const cdiMes = (1 + ((1 + p.cdi) ** (1 / 252) - 1) * p.pctCdi) ** 21 - 1
  const rPj = cdiMes * (1 - 0.0465) * (1 - p.aliquotaPj)
  const V = p.valor
  const pmt = V * i / (1 - (1 + i) ** -n)
  let saldo = V, iof = p.comIof ? V * 0.0038 : 0
  const meses = []
  for (let k = 1; k <= n; k++) {
    const j = saldo * i
    let pag, am
    if (formato === 'price') { am = pmt - j; pag = pmt; saldo -= am }
    if (formato === 'sac') { am = V / n; pag = am + j; saldo -= am }
    if (formato === 'juros') { am = k === n ? V : 0; pag = j + am }
    if (formato === 'fim') { saldo += j; am = k === n ? V : 0; pag = k === n ? saldo : 0 }
    if (p.comIof) iof += am * 0.000082 * Math.min(30 * k, 365)
    meses.push([pag, j])
  }
  // Caixa da empresa: começa em zero (recebe o empréstimo e paga o dividendo), paga IOF e cada pagamento, recebe a economia de IR.
  let caixa = -iof * (1 - p.aliquotaPj)
  for (const [pag, j] of meses) caixa = caixa * (1 + rPj) - pag + p.aliquotaPj * j
  const dias = Math.round(n * 365 / 12)
  const imposto = p.temAta ? 0 : V * p.aliquotaDividendos
  const socio = (V - imposto) * ((1 + cdiMes) ** n - 1) * (1 - irPessoaFisica(dias))
  // Custo da empresa = −caixa final (o principal pago já sai do caixa; o valor recebido foi repassado ao sócio).
  return socio - imposto + caixa + V
}

test('conferência independente pelo livro-caixa: todos os formatos, prazos e opções', () => {
  const cenarios = [base, { ...base, comIof: false }, { ...base, temAta: false }, { ...base, temAta: false, aliquotaDividendos: 0.05, cdi: 0.1415, pctCdi: 0.95, taxaMes: 0.011 }, { ...base, aliquotaPj: 0.24, valor: 3_500_000 }]
  for (const p of cenarios) for (const x of simularDividendosEmprestimo(p).prazos) for (const r of x.formatos) near(r.eficiencia, livroCaixa(p, x.n, r.formato), 0.05)
})

test('composição fecha e o mais eficiente é o de maior resultado', () => {
  for (const x of simularDividendosEmprestimo({ ...base, temAta: false }).prazos) {
    for (const r of x.formatos) near(r.ganhoSocio - (r.juros + r.iof) + r.economiaIr - r.efeitoTempo - r.impostoDividendo, r.eficiencia, 1e-4)
    assert.equal(x.melhor, x.formatos.reduce((a, b) => (b.eficiencia > a.eficiencia ? b : a)).formato)
  }
})

test('exemplo de referência (R$ 10 mi, 1,31% a.m., CDI 13,87%, com IOF e ata)', () => {
  const [p12, , p36, , p60] = simularDividendosEmprestimo(base).prazos
  assert.equal(p12.melhor, 'sac')
  near(p12.formatos.find((r) => r.formato === 'sac').eficiencia, 26_000, 3_000)
  near(p60.formatos.find((r) => r.formato === 'sac').eficiencia, 1_684_000, 15_000)
  assert.ok(p36.formatos.find((r) => r.formato === 'fim').eficiencia < p36.formatos.find((r) => r.formato === 'price').eficiencia)
  // Sem IOF, todos os formatos melhoram.
  const semIof = simularDividendosEmprestimo({ ...base, comIof: false }).prazos[0]
  for (const r of semIof.formatos) assert.ok(r.eficiencia > p12.formatos.find((y) => y.formato === r.formato).eficiencia)
  // Sem ata, o imposto de 10% sai do resultado.
  const semAta = simularOperacao({ ...base, temAta: false }, 12, 'sac')
  assert.equal(semAta.impostoDividendo, 1_000_000)
})

test('erros de preenchimento', () => {
  assert.equal(simularDividendosEmprestimo({ ...base, valor: NaN }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, taxaMes: 0 }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, cdi: 14.15 }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, temAta: false, aliquotaDividendos: NaN }).ok, false)
  assert.equal(simularDividendosEmprestimo({ ...base, temAta: true, aliquotaDividendos: NaN }).ok, true)
  assert.equal(parseDecimal('1,31'), 1.31)
  assert.equal(parseDecimal('10.000.000,00'), 10000000)
})

test('tela: menu, atalho, busca, avisos e nenhuma menção à planilha', () => {
  const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
  assert.match(src('src/Calculadora.jsx'), /id: 'dividendos-emprestimo'/)
  assert.match(src('src/terminal.js'), /DIVIDENDOS: \['calculadora', 'dividendos-emprestimo'\]/)
  assert.match(src('scripts/build-search-index.mjs'), /'DividendosEmprestimo.jsx':\['calculadora\/dividendos-emprestimo'/)
  const tela = src('src/DividendosEmprestimo.jsx')
  assert.doesNotMatch(tela, /planilha/i)
  for (const aviso of [/aprovada até 31\/12\/2025/, /Dedutibilidade/, /mais de R\$ 50 mil no mês/, /Mais eficiente/, /Operação com IOF/]) assert.match(tela, aviso)
})
