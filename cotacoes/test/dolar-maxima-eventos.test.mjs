import test from 'node:test'
import assert from 'node:assert/strict'
import { marcosEntre, marcosQueCabem, EVENTOS_MERCADO } from '../src/eventosMercado.js'
import { noticiasPerto } from '../src/fxAgora.js'
import { juntarAgora } from '../scripts/fx-noticias-lib.mjs'

const ms = (iso) => Date.parse(iso)

test('lista de eventos: todo evento tem data, rótulo curto e fonte pública com link', () => {
  for (const e of EVENTOS_MERCADO) {
    assert.match(e.data, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(e.rotulo.length <= 16, `rótulo longo: ${e.rotulo}`)
    assert.ok(e.fonte)
    assert.match(e.link, /^https:\/\//)
  }
})

test('marcos do período: lista conferida e agenda, sem os previstos', () => {
  const m = marcosEntre(ms('2026-10-20T00:00:00-03:00'), ms('2026-11-10T23:00:00-03:00'))
  const rot = m.map((x) => x.rotulo)
  assert.ok(rot.includes('2º turno'))
  assert.ok(rot.includes('Copom'))
  assert.ok(rot.includes('Fed'))
  assert.ok(rot.includes('Payroll'))
  assert.ok(!rot.some((r) => /IPCA/.test(r)), 'IPCA previsto não entra')
  assert.ok(!rot.includes('1º turno'), 'fora do período')
})

test('gráfico do dia: só eventos com horário; Copom às 18h30 de Brasília', () => {
  const m = marcosEntre(ms('2026-11-04T09:00:00-03:00'), ms('2026-11-04T19:00:00-03:00'), { intradiario: true })
  assert.deepEqual(m.map((x) => x.rotulo), ['Copom'])
  assert.equal(m[0].t, ms('2026-11-04T18:30:00-03:00'))
})

test('evento sem fonte ou com link inválido fica de fora', () => {
  const lista = [{ data: '2026-11-02', rotulo: 'Sem fonte' }, { data: '2026-11-03', rotulo: 'Ok', fonte: 'BC', link: 'https://www.bcb.gov.br' }, { data: '2026-11-03', rotulo: 'Http', fonte: 'X', link: 'http://x' }]
  const m = marcosEntre(ms('2026-11-01T00:00:00-03:00'), ms('2026-11-05T00:00:00-03:00'), { lista, agenda: () => [] })
  assert.deepEqual(m.map((x) => x.rotulo), ['Ok'])
})

test('rótulos de eventos não encavalam: o primeiro da lista tem prioridade', () => {
  const x = (t) => t
  const ok = marcosQueCabem([{ t: 100, rotulo: 'A' }, { t: 120, rotulo: 'B' }, { t: 300, rotulo: 'C' }], x)
  assert.deepEqual(ok.map((m) => m.rotulo), ['A', 'C'])
})

test('notícias perto da máxima: janela de 1 h antes a 30 min depois, até 3, sem repetir, em ordem de horário', () => {
  const t = ms('2026-11-27T11:00:00-03:00')
  const n = (min, title, link = `https://ex.com/${title}`) => ({ t: t + min * 60000, title, link, source: 'X' })
  const a = [n(-90, 'longe antes'), n(-50, 'antes'), n(-5, 'quase'), n(10, 'logo depois'), n(45, 'longe depois')]
  const b = [n(-5, 'quase'), n(2, 'colada'), { ...n(1, 'sem hora'), semHora: true }]
  const r = noticiasPerto([a, b], t)
  assert.deepEqual(r.map((x) => x.title), ['quase', 'colada', 'logo depois'])
  assert.deepEqual(noticiasPerto([a], NaN), [])
})

test('fx-agora: junta o anterior do mesmo dia, descarta outro dia e manchete sem horário', () => {
  const dia = '2026-11-27'
  const it = (h, title) => ({ t: ms(`${dia}T${h}:00-03:00`), title, link: `https://ex.com/${encodeURIComponent(title)}`, source: 'Valor Econômico' })
  const anterior = { dia, itens: [it('10:12', 'Dólar sobe com exterior')] }
  const novos = [it('11:37', 'Dólar renova máxima do dia'), it('11:37', 'Dólar renova máxima do dia'), { ...it('12:00', 'Dólar cai'), t: ms(`${dia}T15:00:00Z`) }, it('09:15', 'Bolsa abre em alta')]
  const r = juntarAgora(anterior, novos, dia)
  assert.deepEqual(r.map((x) => x.title), ['Dólar sobe com exterior', 'Dólar renova máxima do dia'])
  assert.deepEqual(juntarAgora({ dia: '2026-11-26', itens: anterior.itens }, [], dia), [])
})
