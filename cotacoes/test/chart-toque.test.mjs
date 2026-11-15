import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { focoPorTeclado, limitarBalao, margemEixo, rotuloEixo, saidaDeToque } from '../src/chartToque.js'

const ler = (arquivo) => readFileSync(new URL(`../src/${arquivo}`, import.meta.url), 'utf8')

test('balão: fica inteiro dentro do contêiner, à esquerda e à direita', () => {
  // celular de 390 px (gráfico com 358 px) e balão de 180 px: o centro nunca deixa a borda passar da folga
  assert.equal(limitarBalao(58, 180, 358), 94)
  assert.equal(limitarBalao(342, 180, 358), 264)
  assert.equal(limitarBalao(200, 180, 358), 200)
  for (const centro of [0, 58, 120, 179, 300, 342, 358]) {
    const c = limitarBalao(centro, 180, 358)
    assert.ok(c - 90 >= 4 && c + 90 <= 354, `centro ${centro}`)
  }
  // antes de medir (largura 0) acompanha o ponto; balão maior que o contêiner fica centralizado
  assert.equal(limitarBalao(58, 0, 358), 58)
  assert.equal(limitarBalao(58, 400, 358), 179)
})

test('eixo: margem acompanha o maior rótulo e o negativo usa sinal de menos', () => {
  assert.equal(rotuloEixo(-1000000, 0), '−1.000.000')
  assert.equal(rotuloEixo(-500000, 0), '−500.000')
  assert.equal(rotuloEixo(500000, 0), '500.000')
  assert.equal(rotuloEixo(5.1904, 2), '5,19')
  // rótulos curtos mantêm a margem de sempre; longos e negativos ganham espaço
  assert.equal(margemEixo(['5,10', '5,20', '5,30']), 58)
  assert.equal(margemEixo(['500.000', '0']), 58)
  const longa = margemEixo(['500.000', '0', '−500.000', '−1.000.000'])
  assert.ok(longa >= 10 * 7 + 8, `margem ${longa}`)
  assert.equal(margemEixo([]), 58)
})

test('toque: foco de teclado é diferente de foco por toque, e dedo levantado não esconde o balão', () => {
  const alvo = (visivel) => ({ currentTarget: { matches: (seletor) => seletor === ':focus-visible' && visivel } })
  assert.equal(focoPorTeclado(alvo(true)), true)
  assert.equal(focoPorTeclado(alvo(false)), false)
  assert.equal(focoPorTeclado({}), true) // sem como saber: mantém o comportamento do teclado
  assert.equal(saidaDeToque({ pointerType: 'touch' }), true)
  assert.equal(saidaDeToque({ pointerType: 'mouse' }), false)
})

test('gráficos: nenhum pula para o primeiro ponto ao receber foco por toque', () => {
  for (const arquivo of ['HistoryChart.jsx', 'Curves.jsx', 'Sofr.jsx', 'MultiLinhas.jsx', 'Resumo.jsx']) {
    const fonte = ler(arquivo)
    assert.doesNotMatch(fonte, /onFocus=\{\(\) => setHover\(/, arquivo)
    assert.match(fonte, /onFocus=\{\(e\) => \{ if \(focoPorTeclado\(e\)\) setHover\(/, arquivo)
  }
  for (const arquivo of ['HistoryChart.jsx', 'Curves.jsx', 'Sofr.jsx']) {
    const fonte = ler(arquivo)
    assert.match(fonte, /left: limitarBalao\(/, arquivo)
    assert.match(fonte, /if \(!saidaDeToque\(e\)\) setHover\(null\)/, arquivo)
  }
  // acessibilidade preservada no gráfico principal
  const historico = ler('HistoryChart.jsx')
  for (const trecho of ['tabIndex={0}', 'aria-describedby={`${plotId}-hint`}', 'role="status" aria-live="polite"', 'onKeyDown={onKey}']) assert.ok(historico.includes(trecho), trecho)
})
