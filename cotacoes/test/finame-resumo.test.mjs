import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FINAME_DESTAQUES, destaquesFiname } from '../src/finameResumo.js'

const quadros = ['taxa', 'financiado', 'carencia', 'parcelas', 'spread', 'juros', 'iof', 'tac', 'fgi', 'total'].map((id) => ({ id, valor: `valor-${id}` }))

test('destaques do Finame: de 3 a 5 números, escolhidos entre os quadros da composição e na ordem definida', () => {
  assert.ok(FINAME_DESTAQUES.length >= 3 && FINAME_DESTAQUES.length <= 5)
  assert.deepEqual(destaquesFiname(quadros).map((q) => q.id), ['taxa', 'parcelas', 'juros', 'total'])
})

test('destaques usam o próprio quadro da composição, sem cópia nem conta nova', () => {
  for (const destaque of destaquesFiname(quadros)) assert.equal(destaque, quadros.find((q) => q.id === destaque.id))
})

test('quadro ausente ou lista inválida não quebra a tela', () => {
  assert.deepEqual(destaquesFiname(quadros.filter((q) => q.id !== 'juros')).map((q) => q.id), ['taxa', 'parcelas', 'total'])
  assert.deepEqual(destaquesFiname([null, undefined, { id: 'total' }]).map((q) => q.id), ['total'])
  assert.deepEqual(destaquesFiname(null), [])
  assert.deepEqual(destaquesFiname(undefined), [])
})

test('tela: destaques sempre abertos, composição recolhida e faixa "Cotação comparativa" só ao comparar', () => {
  const source = readFileSync(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  // Todo destaque existe na lista de quadros da tela.
  for (const id of FINAME_DESTAQUES) assert.match(source, new RegExp(`\\{ id: '${id}', rotulo: '`))
  // A mesma função desenha o topo e a composição: rótulo, valor e nota não podem divergir.
  assert.match(source, /className="fm-summary-row"/)
  for (const key of ['total', 'primeiraParcela', 'ultimaParcela']) assert.match(source, new RegExp(`brl\\(res.${key}\\)`))
  assert.match(source, /Taxa de referência/)
  assert.match(source, /Primeira parcela após carência/)
  assert.match(source, /brl\(res.total\)/)
  assert.match(source, /<details className="fm-details"><summary>Composição do resultado · \{custo\.toUpperCase\(\)\}<\/summary>\s*<div className="fm-grade">\{quadros\.map\(quadro\)\}<\/div>/)
  assert.doesNotMatch(source, /<details className="fm-details" open/)
  // A faixa azul não aparece sozinha: só junto da comparação.
  assert.match(source, /className=\{comparar \? 'fm-hero' : undefined\}/)
  assert.match(source, /\{comparar && <div className="fm-comparison"/)
  assert.match(source, /comparar \? 'Cotação comparativa' : 'Cotação da operação'/)
  // Ressalvas do resultado continuam no cabeçalho do painel.
  assert.match(source, /<small>Projeção · CET estimado<\/small>/)
  assert.match(source, /não substitui o CET do contrato/)
  // A tela não faz conta nova com o resultado para os destaques: o arquivo de seleção não importa o cálculo.
  assert.doesNotMatch(readFileSync(new URL('../src/finameResumo.js', import.meta.url), 'utf8'), /import /)
})


test('comparação mantém cabeçalho limpo e resultados usam a taxa adotada com origem visível', () => {
  const source = readFileSync(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  assert.match(source, /Com \{item\.custo\.toUpperCase\(\)\}<\/th>/)
  assert.doesNotMatch(source, /scope="col">\{item\.custo\.toUpperCase\(\)\}<small>/)
  assert.match(source, /pct\(item\.rate\.value, 4\)/)
  assert.match(source, /item\.rate\.manual \? ' \(taxa manual\)' : ''/)
  assert.match(source, /className="fm-reference-sources"/)
  assert.match(source, /item\.quote\.codigo/)
  assert.match(source, /dmy\(item\.quote\.data\)/)
  assert.match(source, /<details className="fm-premises"><summary>Premissas e limites da simulação/)
})
