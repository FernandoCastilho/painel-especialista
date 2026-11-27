import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'
import { amortizacoesIguais, calcularFluxoCambio, irRemissivelPadrao, tirBase252, vencimentoPorPrazo } from '../src/cambioFuturoFluxo.js'

const near = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)
const cent = v => Math.round(v * 100) / 100

// Planilha de Fernando (26/11/2026), bullet: 100.000 USD, 361 dias, spot 5,916, futuro 6,5027.
test('bullet reproduz a planilha e anualiza a TIR em base 252', () => {
  const r = calcularFluxoCambio({ inicio: '2026-11-13', valorUsd: 100000, tacBrl: 0, spot: 5.916,
    taxas: { externa: 6.6581, ir: 2.2194, local: 2.3204 }, parcelas: [{ prazo: 361, amortizacao: 100000, futuro: 6.5027 }] })
  assert.equal(r.completo, true)
  assert.equal(r.valorBrl, 591600)
  const [l] = r.linhas
  assert.equal(l.vencimento, '2027-11-09')
  near(l.externa, 6676.59)
  near(l.ir, 2225.57, 0.006) // a planilha mostra 2.225,57; com a taxa de 4 casas dá 2.225,565
  near(l.local, 2326.85)
  near(l.juros, 11229.01)
  assert.equal(l.parcela, 111229.01)
  assert.equal(l.fcBrl, 723288.88)
  assert.equal(l.du, 246)
  near(r.periodoPct, 22.26) // o número "TIR aa" da planilha é o custo no período, sem anualizar
  near(r.tirPct, ((723288.88 / 591600) ** (252 / 246) - 1) * 100, 1e-6)
  near(r.tirPct, 22.86)
})

// Planilha de Fernando (26/11/2026), 4 parcelas de 25.000 USD.
test('quatro parcelas reproduzem todas as colunas da planilha', () => {
  const r = calcularFluxoCambio({ inicio: '2026-11-23', valorUsd: 100000, spot: 5.916,
    taxas: { externa: 6.1468, ir: 2.0489, local: 1.9674 },
    parcelas: [91, 182, 273, 361].map(prazo => ({ prazo, amortizacao: 25000, futuro: 6.5 })) })
  const planilha = [
    ['2027-02-22', 100000, 1553.77, 517.92, 497.31, 27569.01],
    ['2027-05-24', 75000, 1165.33, 388.44, 372.99, 26926.75],
    ['2027-08-23', 50000, 776.89, 258.96, 248.66, 26284.50],
    ['2027-11-19', 25000, 375.64, 125.21, 120.23, 25621.08],
  ]
  planilha.forEach(([venc, saldo, ext, ir, local, parcela], i) => {
    const l = r.linhas[i]
    assert.equal(l.vencimento, venc)
    assert.equal(l.saldo, saldo)
    near(l.externa, ext, 0.006)
    near(l.ir, ir, 0.006)
    near(l.local, local, 0.006)
    assert.equal(l.parcela, parcela)
    assert.equal(l.fcBrl, cent(parcela * 6.5))
  })
  assert.equal(r.linhas[3].dias, 88) // última parcela: 361 − 273
  assert.equal(r.completo, true)
  const vpl = r.linhas.reduce((s, l) => s + l.fcBrl / (1 + r.tirPct / 100) ** (l.du / 252), 0)
  near(vpl, r.liquidoBrl, 1e-4)
})

test('TAC reduz o valor recebido e encarece a TIR', () => {
  const base = { inicio: '2026-11-13', valorUsd: 100000, spot: 5.916, taxas: { externa: 6.6581, ir: 2.2194, local: 2.3204 },
    parcelas: [{ prazo: 361, amortizacao: 100000, futuro: 6.5027 }] }
  const sem = calcularFluxoCambio(base)
  const com = calcularFluxoCambio({ ...base, tacBrl: 5000 })
  assert.equal(com.liquidoBrl, 586600)
  assert.ok(com.tirPct > sem.tirPct)
})

test('sem câmbio futuro calcula a tabela, mas não a TIR', () => {
  const r = calcularFluxoCambio({ inicio: '2026-11-23', valorUsd: 100000, spot: 5.916, taxas: { externa: 6, ir: 2, local: 2 },
    parcelas: [{ prazo: 91, amortizacao: 50000, futuro: 6 }, { prazo: 182, amortizacao: 50000 }] })
  assert.equal(r.completo, false)
  assert.equal(r.tirPct, undefined)
  near(r.linhas[1].parcela, 50000 + 50000 * 0.10 * 91 / 360)
})

test('validações: amortização que não fecha, prazo fora de ordem e TAC excessiva', () => {
  const base = { inicio: '2026-11-23', valorUsd: 100000, spot: 5, taxas: { externa: 6, ir: 2, local: 2 } }
  assert.match(calcularFluxoCambio({ ...base, parcelas: [{ prazo: 90, amortizacao: 40000 }, { prazo: 180, amortizacao: 50000 }] }).erro, /soma das amortizações/)
  assert.match(calcularFluxoCambio({ ...base, parcelas: [{ prazo: 180, amortizacao: 50000 }, { prazo: 90, amortizacao: 50000 }] }).erro, /prazos crescentes/)
  assert.equal(calcularFluxoCambio({ ...base, tacBrl: 500000, parcelas: [{ prazo: 90, amortizacao: 100000 }] }).ok, false)
  assert.equal(calcularFluxoCambio({ ...base, taxas: { externa: 6, ir: null, local: 2 }, parcelas: [{ prazo: 90, amortizacao: 100000 }] }).ok, false)
})

test('apoios: amortização em partes iguais, vencimento e TIR', () => {
  assert.deepEqual(amortizacoesIguais(100000, 3), [33333.33, 33333.33, 33333.34])
  assert.equal(vencimentoPorPrazo('2026-11-23', 91), '2027-02-22')
  assert.equal(vencimentoPorPrazo('2026-11-23', 0), null)
  assert.equal(vencimentoPorPrazo('2026-11-23', 3651), null)
  near(tirBase252(100, [{ valor: 110, du: 252 }]), 10, 1e-9)
  assert.equal(tirBase252(100, []), null)
})

// Aprovado por Fernando em 27/11/2026: o IR vem como 1/3 da comissão externa (4 casas), editável.
test('IR remissível sugerido é 1/3 da comissão externa nas duas planilhas', () => {
  assert.equal(irRemissivelPadrao(6.6581), 2.2194)
  assert.equal(irRemissivelPadrao(6.1468), 2.0489)
  assert.equal(irRemissivelPadrao(0), 0)
  assert.equal(irRemissivelPadrao(null), null)
  assert.equal(irRemissivelPadrao(-3), null)
})

test('tela: bullet da planilha preenchido campo a campo e abertura de parcelas', async t => {
  const require = createRequire(import.meta.url)
  const module = { exports: {} }
  const paths = ['marketReturns', 'holidays', 'moneyInput', 'cdiDolar', 'cambioFuturoFluxo', 'cambioFuturoColar']
  const deps = Object.fromEntries(await Promise.all(paths.map(async p => ['./' + p + '.js', await import('../src/' + p + '.js')])))
  const { code } = await transform(await readFile(new URL('../src/CambioFuturoFluxo.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  runInNewContext(code, { module, exports: module.exports, require: name => name.endsWith('.jsx') ? () => null : name.endsWith('.css') ? {} : deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({}))
  t.after(() => ui.close())
  await ui.settle()
  const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el?.props ? [el, ...nodes(el.props.children)] : []
  const text = el => Array.isArray(el) ? el.map(text).join(' ') : el?.props ? text(el.props.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
  const field = id => nodes(ui.value).find(n => n.props.id === 'cf-f-' + id)
  const fill = async (id, value) => {
    const el = field(id)
    if (el.props.change) el.props.change(value)
    else el.props.onChange({ target: { value } })
    await ui.settle()
  }
  for (const [id, value] of Object.entries({ inicio: '2026-11-13', valor: '100.000,00', allin: '11,20', externa: '6,6581', local: '2,3204', spot: '5,916', '1-prazo': '361', '1-futuro': '6,5027' })) await fill(id, value)
  assert.equal(field('ir').props.value, '2,2194') // preenchido sozinho: 1/3 da externa
  assert.match(field('ir').props.hint, /1\/3 da comissão externa/)
  assert.match(text(ui.value), /IR juros remissível \(USD\+2,2194%\)/)
  assert.match(text(field('valor-brl')), /591\.600,00/)
  assert.match(text(field('1-parcela')), /111\.229,01/)
  assert.match(text(field('1-fc')), /723\.288,88/)
  assert.match(text(field('fc-0')), /591\.600,00/)
  assert.equal(text(field('tir')), '22,86%')
  assert.equal(text(field('periodo')), '22,26%')
  assert.doesNotMatch(text(field('soma')), /não bate/)
  assert.match(text(ui.value), /Juros total \(USD\+11,20%\)/)
  await fill('ir', '3')
  assert.equal(field('ir').props.value, '3')
  assert.match(field('ir').props.hint, /Apague/)
  assert.notEqual(text(field('tir')), '22,86%')
  await fill('externa', '7') // valor editado pelo usuário não é sobrescrito
  assert.equal(field('ir').props.value, '3')
  await fill('externa', '6,6581')
  await fill('ir', '   ')
  assert.equal(field('ir').props.value, '2,2194')
  assert.equal(text(field('tir')), '22,86%')
  await fill('tac', 'abc')
  assert.match(field('tac').props.error, /TAC em reais/)
  assert.equal(text(field('tir')), '—')
  await fill('tac', '0')
  await fill('1-prazo', '99999999')
  assert.match(field('1-prazo').props.error, /3650/)
  await fill('1-prazo', '361')
  assert.equal(text(field('tir')), '22,86%')
  await fill('parcelas', '4')
  assert.ok(field('4-prazo'))
  assert.equal(field('5-prazo'), undefined)
  assert.equal(field('2-amort').props.placeholder, '25.000,00')
  assert.equal(text(field('tir')), '—')
  assert.equal(field('periodo'), undefined)

  // Tabela da mesa colada (A10:H13 da foto): preenche tudo, menos spot e câmbio futuro.
  await fill('colar', ['91\t22/02/2027\t25.000,00\t100.000,00\t1.553,77\t517,92\t497,31\t27.569,01',
    '182\t24/05/2027\t25.000,00\t75.000,00\t1.165,33\t388,44\t372,99\t26.926,75',
    '273\t23/08/2027\t25.000,00\t50.000,00\t776,89\t258,96\t248,66\t26.284,50',
    '361\t19/11/2027\t25.000,00\t25.000,00\t375,64\t125,21\t120,23\t25.621,08'].join('\n'))
  assert.equal(field('inicio').props.value, '2026-11-23')
  assert.equal(field('valor').props.value, '100.000,00')
  assert.equal(field('parcelas').props.value, 4)
  assert.equal(field('externa').props.value, '6,1468')
  assert.equal(field('ir').props.value, '2,0489') // 1/3 da externa: fica no automático
  assert.match(field('ir').props.hint, /pode editar/)
  assert.equal(field('local').props.value, '1,9674')
  assert.equal(field('allin').props.value, '11,20') // o all-in já digitado não é trocado
  assert.deepEqual([1, 2, 3, 4].map(n => field(n + '-prazo').props.value), ['91', '182', '273', '361'])
  assert.equal(field('4-amort').props.value, '25.000,00')
  assert.equal(field('1-futuro').props.value, '') // o 6,5027 era da parcela de 361 dias, não fica na de 91
  assert.match(text(field('colar-status')), /Tabela colada:\s+4\s+parcelas\s*, início\s+23\/11\/2026/)
  for (const n of [1, 2, 3, 4]) await fill(n + '-futuro', '6,5')
  assert.deepEqual([1, 2, 3, 4].map(n => text(field(n + '-parcela'))), ['27.569,01', '26.926,75', '26.284,50', '25.621,08'])
  assert.doesNotMatch(text(field('colar-status')), /Falta o spot/)
  // All-in: o digitado fica; o que veio da colagem é trocado na colagem seguinte. Linhas a mais são limpas.
  await fill('allin', '')
  await fill('colar', '91\t22/02/2027\t25.000,00\t100.000,00\t1.553,77\t517,92\t497,31\t27.569,01\n182\t24/05/2027\t75.000,00\t75.000,00\t1.165,33\t388,44\t372,99\t76.926,76')
  assert.equal(field('allin').props.value, '10,1631')
  await fill('colar', '361\t09/11/2027\t100.000,00\t100.000,00\t6.676,59\t2.225,57\t2.326,85\t111.229,01')
  assert.equal(field('allin').props.value, '11,1979')
  assert.equal(field('parcelas').props.value, 1)
  await fill('parcelas', '2')
  assert.equal(field('2-prazo').props.value, '')
  await fill('parcelas', '1')
  await fill('colar', 'texto qualquer')
  assert.match(text(field('colar-status')), /Cole as linhas/)
  assert.equal(field('externa').props.value, '6,6581') // texto inválido não apaga o que já foi preenchido
})
