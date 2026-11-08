import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { relevante, mergeItems, reformaFile, QUERIES, WINDOW_DAYS } from '../scripts/reforma-lib.mjs'
import { groupByDay, normalizeReforma, searchItems, dayOf } from '../src/reforma.js'

const now = Date.parse('2026-10-31T15:00:00Z')
const h = 36e5
const it = (title, ago, source = 'Valor Econômico', link = `https://exemplo.com/${encodeURIComponent(title)}`) => ({ title, link, source, t: now - ago * h })

test('só entra matéria que trata do tema; CBS emissora e assunto vizinho ficam de fora', () => {
  for (const t of ['Senado aprova regulamentação da reforma tributária', 'IBS e CBS: o que muda para o comércio', 'Imposto seletivo sobre bebidas é votado', 'Split payment começa em 2027', 'Comitê Gestor do IBS é instalado']) assert.ok(relevante(t), t)
  for (const t of ['CBS News divulga pesquisa eleitoral', 'Dólar fecha em alta com Fed', 'Reforma administrativa avança na Câmara', 'Selic e inflação no Brasil']) assert.equal(relevante(t), false, t)
})
test('mescla o novo ao histórico: sem repetição, só 5 dias, mais recente primeiro', () => {
  const fresh = [it('Reforma tributária: Senado vota texto', 2), it('Reforma tributária: Senado vota texto', 3, 'Outro veículo', 'https://exemplo.com/b'), it('Reforma tributária e o IBS nas cidades', 30)]
  const previous = [it('Reforma tributária e o IBS nas cidades', 30), it('Reforma tributária: regulamentação em debate', 24 * 4), it('Reforma tributária: matéria velha', 24 * 9), it('Dólar sobe forte hoje', 1)]
  const out = mergeItems(fresh, previous, now)
  assert.deepEqual(out.map((x) => x.title), ['Reforma tributária: Senado vota texto', 'Reforma tributária e o IBS nas cidades', 'Reforma tributária: regulamentação em debate'])
  assert.ok(out.every((x, i, a) => !i || a[i - 1].t >= x.t))
  assert.equal(WINDOW_DAYS, 5); assert.ok(QUERIES.length >= 4 && QUERIES.every((q) => /tribut|IVA/i.test(q)))
})
test('descarta item inválido, data futura e link que não é http', () => {
  const bad = [{ title: '', link: 'https://a.com/1', t: now - h }, { title: 'Reforma tributária X', link: 'ftp://a', t: now - h }, { title: 'Reforma tributária Y', link: 'https://a.com/2', t: now + 48 * h }, { title: 'Reforma tributária Z', link: 'https://a.com/3', t: NaN }]
  assert.deepEqual(mergeItems(bad, [], now), [])
})
test('arquivo: formato, preservação e leitura na tela', () => {
  const f = reformaFile(mergeItems([it('Reforma tributária hoje', 1)], [], now), now)
  assert.equal(f.topic, 'reforma-tributaria'); assert.equal(f.stale, false)
  const n = normalizeReforma(f, now); assert.equal(n.items.length, 1); assert.equal(n.windowDays, 5)
  assert.throws(() => normalizeReforma({ topic: 'outro', items: [] })); assert.throws(() => normalizeReforma(null))
  assert.equal(normalizeReforma({ ...f, stale: true, error: 'x' }, now).stale, true)
})
test('agrupa por dia de Brasília, com contagem e veículos mais frequentes', () => {
  const items = [it('Reforma tributária A', 1), it('Reforma tributária B', 2, 'Folha'), it('Reforma tributária C', 3), it('Reforma tributária D', 30, 'Folha')]
  const days = groupByDay(items)
  assert.equal(days.length, 2); assert.equal(days[0].key, dayOf(items[0].t)); assert.equal(days[0].count, 3)
  assert.deepEqual(days[0].sources[0], ['Valor Econômico', 2])
  assert.equal(days.reduce((n, d) => n + d.count, 0), 4)
})
test('busca por palavras no título e no veículo, sem acento', () => {
  const items = [it('Reforma tributária: Senado vota', 1), it('IBS em debate na Câmara', 2, 'Folha')]
  assert.equal(searchItems(items, 'senado').length, 1); assert.equal(searchItems(items, 'folha camara').length, 1); assert.equal(searchItems(items, '').length, 2); assert.equal(searchItems(items, 'xyz').length, 0)
})
test('a aba aparece ao lado de Manchetes e a coleta está no deploy', () => {
  const resumo = readFileSync(new URL('../src/Resumo.jsx', import.meta.url), 'utf8')
  assert.ok(resumo.includes("label: 'Manchetes'") && resumo.includes("label: 'Reforma tributária'") && resumo.includes('<CuradoriaNoticias id={newsTab} />'))
  assert.match(readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8'), /node scripts\/fetch-reforma\.mjs/)
})

import { normalizeTemas } from '../src/reforma.js'
import { parseSetor } from '../src/insumos.js'
test('temas: normaliza por assunto, descarta itens inválidos e ordena do mais novo ao mais antigo', () => {
  const out = normalizeTemas({ generatedAt: 1, temas: { cobre: { label: 'Cobre', grupo: 'insumo', items: [{ title: 'A', link: 'https://x/a', t: 1 }, { title: 'B', link: 'https://x/b', t: 2 }, { title: '', link: 'https://x/c', t: 3 }, { title: 'D', link: 'javascript:1', t: 4 }] } } }, 5)
  assert.deepEqual(out.cobre.items.map((i) => i.title), ['B', 'A'])
  assert.throws(() => normalizeTemas({}))
})
test('setores: id desconhecido volta ao primeiro setor', () => {
  assert.equal(parseSetor('cobre'), 'cobre')
  assert.equal(parseSetor('xyz'), 'industria')
  assert.equal(parseSetor(''), 'industria')
})
