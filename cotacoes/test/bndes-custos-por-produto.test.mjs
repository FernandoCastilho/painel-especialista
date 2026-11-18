import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { CUSTOS_BNDES, PRODUTOS_BNDES, PERFIS_PAINEL, custosPermitidos, avaliarCusto, custoBndes } from '../src/bndesCustosPorProduto.js'
import { CUSTOS, REGRAS, CUSTOS_FIXOS } from '../src/finameMateriais.js'
import { LCDCAP_PROFILE } from '../src/bndesLcdCap.js'

// Transcrição literal da tabela da calculadora BNDES (foto de 18/11/2026). Ordem das colunas:
// Custo Fixo, TFB, TFB TR, Pré 5, Pré 3, TFC, TFC MPME, TFC TR, TFBD, TLP, SELIC_LCD, SOFR.
const TABELA = {
  'Finame - Demais BKs':                          '.X.XX...XXX.',
  'Finame - Materiais Industrializados':          '.X...XX.XXX.',
  'Finame - Baixo Carbono':                       '.X.XX...XXX.',
  'Finame - Máquinas 4.0':                        '.X.XX...XXX.',
  'BNDES - Crédito Pequenas e Médias Empresas':   '.X...XX.XXX.',
  'BNDES - Automático Projetos de Investimentos': '.X.XX...XXX.',
  'BNDES - Automático Emergencial':               '.X...XX.XXX.',
  'BNDES - Fundo Clima Automático':               'X...........',
  'BNDES - Mais Inovação - Difusão Tecnológica':  '.......X....',
  'BNDES - Mais Inovação - Investimento':         '..X.........',
  'BNDES - Finame Funttel':                       '..X.........',
  'BNDES - Finame FUST Automático':               '..X.........',
  'BNDES - EXIM Pré-Embarque':                    '.........X.X',
}

test('matriz confere com a tabela original, linha a linha', () => {
  assert.deepEqual(CUSTOS_BNDES.map(c => c.sigla), ['Custo Fixo', 'TFB', 'TFB TR', 'Pré 5', 'Pré 3', 'TFC', 'TFC MPME', 'TFC TR', 'TFBD', 'TLP', 'SELIC_LCD', 'SOFR'])
  assert.deepEqual(PRODUTOS_BNDES.map(p => p.nome), Object.keys(TABELA))
  for (const produto of PRODUTOS_BNDES) {
    const linha = CUSTOS_BNDES.map(c => (produto.custos.includes(c.id) ? 'X' : '.')).join('')
    assert.equal(linha, TABELA[produto.nome], produto.nome)
  }
  assert.equal(PRODUTOS_BNDES.filter(p => p.tipo === 'Produto').length, 7)
  assert.equal(PRODUTOS_BNDES.filter(p => p.tipo === 'Programa').length, 6)
})

test('grupos e bases de cálculo da descrição dos custos', () => {
  const base = Object.fromEntries(CUSTOS_BNDES.map(c => [c.sigla, c.base]))
  for (const s of ['Custo Fixo', 'TFB', 'TFB TR', 'Pré 5', 'Pré 3', 'TFC', 'TFC MPME', 'TFC TR']) assert.equal(base[s], '365/366', s)
  assert.equal(base.TFBD, '360'); assert.equal(base.SOFR, '360'); assert.equal(base.TLP, '252'); assert.equal(base.SELIC_LCD, '252')
  assert.deepEqual(CUSTOS_BNDES.filter(c => c.grupo === 'pos').map(c => c.sigla), ['TFBD', 'TLP', 'SELIC_LCD', 'SOFR'])
  assert.deepEqual(CUSTOS_BNDES.filter(c => c.soMpme).map(c => c.sigla), ['Pré 3', 'TFC MPME'])
  assert.equal(custoBndes('tfbd').foraDoItau, true)
  assert.equal(custoBndes('tfb').carenciaMaxMeses, 12)
})

test('o que pode e o que não pode', () => {
  assert.equal(avaliarCusto('finame-materiais', 'tfc').permitido, true)
  assert.equal(avaliarCusto('finame-materiais', 'pre5').permitido, false)
  assert.equal(avaliarCusto('finame-demais-bks', 'tfc').permitido, false)
  assert.equal(avaliarCusto('exim-pre-embarque', 'sofr').permitido, true)
  assert.equal(avaliarCusto('exim-pre-embarque', 'tfb').permitido, false)
  assert.equal(avaliarCusto('fundo-clima-automatico', 'custoFixo').permitido, true)
  assert.match(avaliarCusto('finame-demais-bks', 'pre3', { mpme: false }).motivo, /apenas para MPME/)
  assert.equal(avaliarCusto('finame-demais-bks', 'pre3', { mpme: true }).permitido, true)
  assert.equal(avaliarCusto('inexistente', 'tfb').permitido, false)
  assert.equal(avaliarCusto('finame-materiais', 'xyz').permitido, false)
  assert.deepEqual(custosPermitidos('credito-pme', { mpme: false }).map(c => c.id), ['tfb', 'tfc', 'tfbd', 'tlp', 'selicLcd'])
  assert.deepEqual(custosPermitidos('nada'), [])
})

test('calculadoras do painel só oferecem custos permitidos e usam a base da tabela', () => {
  for (const perfil of PERFIS_PAINEL) {
    assert.ok(perfil.produtos.length > 0, perfil.perfil)
    for (const produto of perfil.produtos) for (const custo of perfil.custos) assert.equal(avaliarCusto(produto, custo).permitido, true, `${perfil.perfil}: ${produto}/${custo}`)
  }
  // Finame Materiais oferece TFC, TFB e TLPCAP; todos aceitos pela linha do produto.
  const materiais = PERFIS_PAINEL.find(p => p.perfil === 'finame-materiais')
  for (const { id } of CUSTOS) assert.ok(materiais.custos.includes(id), id)
  // Carência de até 12 meses com TFB, como na descrição da tabela.
  assert.equal(REGRAS.carenciaMaxTfbMeses, custoBndes('tfb').carenciaMaxMeses); assert.ok(CUSTOS_FIXOS.has('tfb'))
  // SELIC_LCD em base 252.
  assert.equal(String(LCDCAP_PROFILE.basis), custoBndes('selicLcd').base)
  // EXIM Pré-Embarque não aceita SELIC_LCD.
  assert.ok(!PERFIS_PAINEL.find(p => p.perfil === 'bndes-selic-lcd').produtos.includes('exim-pre-embarque'))
})

test('área BNDES tem a aba Custos por produto', () => {
  const src = readFileSync(new URL('../src/BndesWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(src, /Custos por produto/)
  assert.match(src, /<BndesCustosProdutos \/>/)
})
