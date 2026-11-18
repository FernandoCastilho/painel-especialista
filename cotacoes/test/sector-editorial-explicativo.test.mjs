import test from 'node:test'
import assert from 'node:assert/strict'
import { SECTOR_HIGHLIGHTS } from '../src/sectorHighlights.js'
import { uniqueParagraphs, sectionParagraphs, readableSectionTitle, chartConsultationLabel, studyGlossary } from '../src/sectorEditorial.js'
test('15 distinct sector introductions with complete economic and credit explanation', () => {
  assert.equal(Object.keys(SECTOR_HIGHLIGHTS).length, 15)
  for (const key of ['summary','margin','cash','attention','credit']) {
    const values = Object.values(SECTOR_HIGHLIGHTS).map(x => x[key])
    assert.equal(new Set(values).size, 15)
    assert.ok(values.every(x => x.length > 30))
  }
})
test('exact duplicates removed; qualifications and other sections preserved', () => {
  assert.deepEqual(uniqueParagraphs([' A  B ', 'A B', 'A B; dado não confirmado']), [' A  B ', 'A B; dado não confirmado'])
  assert.deepEqual(sectionParagraphs({id:'negocio', paragraphs:['A','B']}, ['A']), ['B'])
  assert.deepEqual(sectionParagraphs({id:'indicadores', paragraphs:['A','B']}, ['A']), ['A','B'])
})
test('dates are never inferred from review date or period', () => {
  assert.equal(chartConsultationLabel({reviewedAt:'2026-11-17',period:'2025'}), 'Data de consulta não informada')
  assert.equal(chartConsultationLabel({consultedAt:'2026-11-13'}), 'Consulta: 13/11/2026')
  assert.equal(chartConsultationLabel({source:{accessedAt:'2026-11-06'}}), 'Consulta: 06/11/2026')
  for(const date of ['2026-02-30','garbage','2026-13-01']) assert.equal(chartConsultationLabel({consultedAt:date}), 'Data de consulta não informada')
})
test('plain headings and relevant glossary only', () => {
  assert.equal(readableSectionTitle('Análise SWOT'), 'O que fortalece e o que fragiliza o negócio')
  assert.equal(readableSectionTitle('Cinco forças de Porter'), 'Concorrência e poder de negociação')
  assert.equal(readableSectionTitle('Indicadores e método'), 'Indicadores e método')
  assert.deepEqual(studyGlossary({summary:['Glosas e lead time']} ).map(x=>x.term), ['glosa','lead time'])
  assert.deepEqual(studyGlossary({summary:['Negócio']}), [])
})

// Keep the dedicated TIC route covered, not only the generic study renderer.
test('TIC special route and standard studies use the same educational credit block', async () => {
  const { readFile } = await import('node:fs/promises')
  const tic = await readFile(new URL('../src/SectorStudy.jsx', import.meta.url), 'utf8')
  const standard = await readFile(new URL('../src/ResearchedSectorStudy.jsx', import.meta.url), 'utf8')
  const block = await readFile(new URL('../src/SectorCreditReading.jsx', import.meta.url), 'utf8')
  assert.match(tic, /<SectorCreditReading group="tic" \/>/)
  assert.match(standard, /<SectorCreditReading group=\{study.group\} \/>/)
  assert.match(block, /SECTOR_HIGHLIGHTS\[group\]/)
  assert.match(block, /Não atribui nota de risco nem aprova crédito/)
  assert.match(SECTOR_HIGHLIGHTS.tic.credit, /Separe receita recorrente, revenda e projetos/)
})
test('wholesale margin is not confused with purchasing discount', () => {
  assert.match(SECTOR_HIGHLIGHTS.atacado.margin, /diferença entre o preço líquido de venda e o custo de aquisição/)
  assert.match(SECTOR_HIGHLIGHTS.atacado.margin, /descontados os custos da operação/)
  assert.doesNotMatch(SECTOR_HIGHLIGHTS.atacado.margin, /desconto de compra precisa/)
})
