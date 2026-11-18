import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const studies = JSON.parse(readFileSync('src/sectorStudies/studies.json', 'utf8'))
test('reader-facing study text omits execution details and malformed questions', () => {
  for (const study of studies) {
    const key = `${study.group}/${study.topicIndex}`
    const visible = JSON.stringify([study.summary, study.sections, study.method, study.limitations, study.canvasQuestions, study.transcript, study.diagram])
    assert.doesNotMatch(visible, /\bskill\b|arquivos privados de contexto|regras locais|subagent/i, key)
    for (const question of study.canvasQuestions) {
      assert.doesNotMatch(question.question, /\.\?/, key)
      assert.match(question.question.trim(), /\?$/, key)
    }
    if (study.reviewStatus === 'approved') assert.doesNotMatch(visible, /revisão independente (?:ainda |permanece )?pendente|NÃO CONFERIDO para uso final/i, key)
  }
})

test('executive indicators keep their heading; TIC summary and Canvas retain their order', async () => {
  const { readFile } = await import('node:fs/promises')
  const catalog = await readFile(new URL('../src/Setores.jsx', import.meta.url), 'utf8')
  const tic = await readFile(new URL('../src/SectorStudy.jsx', import.meta.url), 'utf8')
  assert.match(catalog, /<h5>O que acompanhar<\/h5>/)
  const summary = tic.indexOf('<section className="study-summary"')
  const questions = tic.indexOf('<details className="study-section study-canvas-details">')
  const credit = tic.indexOf('<SectorCreditReading group="tic" />')
  const podcast = tic.indexOf('<SectorPodcast />')
  assert.ok(summary > 0 && questions > summary && credit > questions && podcast > credit)
  assert.match(tic.slice(summary, questions), /<\/section>\s*$/)
  assert.match(tic.slice(questions, credit), /<\/details>\s*$/)
})
