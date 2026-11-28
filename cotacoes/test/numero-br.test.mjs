import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { parse } from '@babel/parser'
import { comSinal, formatarAoSair, formatarNumeroBr, lerNumeroSimples, lerTaxaTexto } from '../src/numeroBr.js'
import { parseDecimal as decimalEmprestimo } from '../src/emprestimo.js'
import { parseDecimal as decimalCdiDolar } from '../src/cdiDolar.js'
import { parseDecimal as decimalDividendos } from '../src/dividendosEmprestimo.js'
import { parseAlongamentoDecimal } from '../src/alongamento.js'
import { parseMoneyInput } from '../src/moneyInput.js'
import { numeroPt } from '../src/investimentos.js'
import { valorAplicado } from '../src/investmentHistory.js'
import { lerValor } from '../src/simulacaoCambio.js'
import { num as custoFunding } from '../src/cdcFunding.js'
import { parseSignedDecimal } from '../src/finameFunding.js'
import { toCents } from '../src/rpnPastedCet.mjs'

test('formata em pt-BR ao sair: milhar com ponto, vírgula decimal e ao menos duas casas', () => {
  const ler = parseMoneyInput
  assert.equal(formatarNumeroBr('1234567,89', ler), '1.234.567,89')
  assert.equal(formatarNumeroBr('1000000', ler), '1.000.000,00')
  assert.equal(formatarNumeroBr('1.500', ler), '1.500,00')
  assert.equal(formatarNumeroBr(' 12,5 ', ler), '12,50')
  assert.equal(formatarNumeroBr('5,4321', decimalCdiDolar), '5,4321', 'não arredonda o que foi digitado')
  assert.equal(formatarNumeroBr('13.5', decimalEmprestimo), '13,50', 'ponto decimal digitado vira vírgula')
  assert.equal(formatarNumeroBr('-1,5', comSinal(decimalEmprestimo)), '-1,50')
  assert.equal(formatarNumeroBr('30', parseAlongamentoDecimal, { casas: 'livre' }), '30', 'prazo em dias não ganha casas')
  assert.equal(formatarNumeroBr('500 mil', lerValor), '500.000,00')
})

test('texto vazio, inválido ou que o campo não lê fica como está', () => {
  for (const texto of ['', '   ', 'abc', '1,2,3', '1e5', '12..5']) assert.equal(formatarNumeroBr(texto, decimalEmprestimo), texto)
  assert.equal(formatarNumeroBr('1500,123', parseMoneyInput), '1500,123', 'dinheiro com 3 casas segue com o aviso de erro')
  assert.equal(formatarNumeroBr('-5', decimalEmprestimo), '-5', 'campo sem sinal não aceita negativo')
})

test('o campo relê o texto formatado com exatamente o mesmo número', () => {
  const leitores = {
    decimalEmprestimo, decimalCdiDolar, decimalDividendos, parseMoneyInput, numeroPt, valorAplicado, lerValor, custoFunding,
    parseSignedDecimal, lerTaxaTexto, lerNumeroSimples, cents: t => { const c = toCents(t); return c === null ? null : c / 100 },
    alongamento: parseAlongamentoDecimal, alongamentoPct: t => parseAlongamentoDecimal(t, { percent: true }),
  }
  const entradas = ['0', '0,5', '12', '12,5', '13.5', '99,99', '100', '999,999', '1000', '1.000', '1.500,5', '1500.25', '1234567,891',
    '1.234.567,8', '5,4321', '5.4321', '6.5', '0,000001', '12%', '-3,2', '1.000.000', '10000000,01', '7.200']
  for (const [nome, ler] of Object.entries(leitores)) {
    const num = v => (typeof v === 'number' ? v : v?.ok ? v.value : NaN)
    for (const texto of entradas) {
      const antes = num(ler(texto)), formatado = formatarNumeroBr(texto, ler)
      if (formatado === texto) continue
      assert.ok(Object.is(num(ler(formatado)), antes), `${nome}: ${texto} → ${formatado} mudou o número`)
      assert.match(formatado, /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$/, `${nome}: ${formatado} fora do padrão brasileiro`)
    }
  }
})

test('campo de taxa que não lê milhar mantém o texto em vez de mudar o número', () => {
  assert.equal(formatarNumeroBr('1500', decimalEmprestimo), '1500')
  assert.equal(formatarNumeroBr('1.500', decimalEmprestimo), '1,50', 'mostra como o campo já lia: 1,5')
})

test('formatarAoSair devolve o texto novo só quando ele muda', () => {
  const mudancas = []
  const aoSair = formatarAoSair(parseMoneyInput, texto => mudancas.push(texto))
  aoSair({ target: { value: '2500' } })
  aoSair({ target: { value: '2.500,00' } })
  aoSair({ target: { value: 'xyz' } })
  assert.deepEqual(mudancas, ['2.500,00'])
})

// Todo campo de valor digitado (inputMode decimal) precisa formatar ao sair ou estar na lista de exceções.
const EXCECOES = new Map([
  ['RpnCalculator.jsx', 'visor da calculadora HP: aceita expressões e notação científica'],
  ['RpnHistoryPanel.jsx', 'operandos da calculadora HP, no formato do visor'],
])

test('todos os campos de valor das telas formatam ao sair', async () => {
  const dir = new URL('../src/', import.meta.url)
  const semFormato = []
  for (const arquivo of (await readdir(dir)).filter(f => f.endsWith('.jsx') && !EXCECOES.has(f))) {
    const fonte = await readFile(new URL(arquivo, dir), 'utf8')
    const ast = parse(fonte, { sourceType: 'module', plugins: ['jsx'] })
    const visitar = no => {
      if (!no || typeof no !== 'object') return
      if (Array.isArray(no)) return no.forEach(visitar)
      if (no.type === 'JSXOpeningElement' && no.name.name === 'input') {
        const attrs = Object.fromEntries(no.attributes.filter(a => a.type === 'JSXAttribute').map(a => [a.name.name, a.value ? fonte.slice(a.value.start, a.value.end) : 'true']))
        const decimal = attrs.inputMode && /decimal/.test(attrs.inputMode)
        const espalha = no.attributes.some(a => a.type === 'JSXSpreadAttribute')
        if (decimal && !attrs.onBlur && !espalha) semFormato.push(`${arquivo}:${no.loc.start.line}`)
      }
      for (const chave in no) if (!['loc', 'start', 'end'].includes(chave)) visitar(no[chave])
    }
    visitar(ast)
  }
  assert.deepEqual(semFormato, [])
})
