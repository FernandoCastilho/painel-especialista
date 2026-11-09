import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { TIC_CANVAS_QUESTIONS } from '../src/ticCanvasQuestions.js'

const component = readFileSync(new URL('../src/SectorStudy.jsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/SectorStudy.css', import.meta.url), 'utf8')

test('roteiro Canvas é enxuto e cobre as seis dimensões da integradora', () => {
  assert.equal(TIC_CANVAS_QUESTIONS.length, 6)
  assert.deepEqual(TIC_CANVAS_QUESTIONS.map(item => item.dimension), [
    'Proposta de valor', 'Clientes e canais', 'Receita e recorrência',
    'Entrega e parceiros', 'Custos e riscos', 'Caixa e crescimento',
  ])
  for (const { question } of TIC_CANVAS_QUESTIONS) {
    assert.ok(question.length < 220)
    assert.ok(question.endsWith('?'))
    assert.equal(question.match(/\?/g).length, 1)
  }
  const text = TIC_CANVAS_QUESTIONS.map(item => item.question).join(' ')
  for (const term of ['fabricante', 'clientes', 'licenças', 'implantação', 'serviços gerenciados', 'margem', 'certificação', 'câmbio', 'caixa', 'aceite']) assert.ok(text.includes(term), term)
})

test('resumo em destaque vem primeiro; perguntas ficam recolhidas, antes do podcast e dos capítulos', () => {
  const summary = component.indexOf('<section className="study-summary"')
  const questions = component.indexOf('<details className="study-section study-canvas-details">')
  const podcast = component.indexOf('<SectorPodcast />')
  assert.ok(summary > 0 && questions > summary && podcast > questions)
  assert.match(component.slice(summary, questions), /<\/section>\s*$/)
  assert.doesNotMatch(component, /study-callout|StudyChapterNav/)
  assert.match(component, /Perguntas para conversar com a empresa \(\{TIC_CANVAS_QUESTIONS\.length\}\)/)
  assert.match(component, /<ol className="study-canvas-questions">/)
  assert.match(component, /inspirado no Business Model Canvas/)
  assert.match(css, /@media\(max-width:600px\).*study-canvas-questions\{grid-template-columns:minmax\(0,1fr\)/)
})
