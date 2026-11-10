// Lembrete do fim do calendário de pregão da B3. Todas as datas são fixas: nenhum teste depende do dia de hoje.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { B3_CALENDAR_REMINDER_DAYS, b3CalendarReminder, b3CalendarStatus } from '../scripts/data-schedules.mjs'

const em = (iso) => b3CalendarReminder(Date.parse(iso))

test('calendário B3: conta os dias até o fim da cobertura conferida e avisa a 60 dias ou menos', () => {
  assert.equal(B3_CALENDAR_REMINDER_DAYS, 60)
  assert.deepEqual(em('2026-11-10T15:00:00Z'), { due: true, daysLeft: 51, coverageEnd: '2026-12-31', nextYear: 2027, today: '2026-11-10' })
  assert.deepEqual([em('2026-11-01T15:00:00Z').daysLeft, em('2026-11-01T15:00:00Z').due], [60, true]) // exatamente 60: avisa
  assert.deepEqual([em('2026-10-31T15:00:00Z').daysLeft, em('2026-10-31T15:00:00Z').due], [61, false]) // 61: ainda não
  assert.equal(em('2026-06-01T15:00:00Z').due, false)
  assert.deepEqual([em('2026-12-31T15:00:00Z').daysLeft, em('2026-12-31T15:00:00Z').due], [0, true])
})

test('calendário B3: o dia vale no horário de Brasília e, depois do fim, o lembrete continua ativo', () => {
  assert.equal(em('2026-11-02T01:30:00Z').today, '2026-11-01') // 22h30 de 01/11 em Brasília
  assert.equal(em('2026-11-02T01:30:00Z').daysLeft, 60)
  const depois = em('2027-01-04T15:00:00Z') // ano sem calendário conferido
  assert.equal(b3CalendarStatus(2027).verified, false)
  assert.deepEqual(depois, { due: true, daysLeft: -4, coverageEnd: '2026-12-31', nextYear: 2027, today: '2027-01-04' })
})

test('calendário B3: o lembrete só conta; não libera nem inventa ano novo', () => {
  const fonte = readFileSync(new URL('../scripts/data-schedules.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(fonte, /closed2027/)
  assert.match(fonte, /String\(year\)==='2026'/)
  assert.match(readFileSync(new URL('../scripts/check-stale.mjs', import.meta.url), 'utf8'), /calendarioB3 = b3CalendarReminder\(\)/)
})

// Executa o passo real de pages.yml com GitHub e arquivo em memória. Não abre issue nem envia mensagem de verdade.
async function rodarLembrete(calendarioB3, { abertas = [], fechadas = [] } = {}) {
  const pages = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const passo = pages.split('      - name: Lembrar do calendário da B3')[1]
  assert.match(passo, /^[^\n]*\n {8}if: always\(\)\n/)
  const script = passo.split('          script: |\n')[1].split('\n').map((l) => l.replace(/^ {12}/, '')).join('\n')
  const feito = { criadas: [], comentarios: [], fechadas: [], avisos: [], paginou: 0 }
  const listForRepo = async () => ({ data: abertas })
  const github = {
    paginate: async (fn, args) => { assert.equal(fn, listForRepo); assert.equal(args.state, 'closed'); feito.paginou++; return fechadas },
    rest: { issues: { listForRepo, create: async (i) => feito.criadas.push(i), createComment: async (c) => feito.comentarios.push(c), update: async (u) => feito.fechadas.push(u) } },
  }
  const fakeRequire = () => ({ existsSync: () => true, readFileSync: () => JSON.stringify({ hours: 6, items: [], calendarioB3 }) })
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  await new AsyncFunction('require', 'process', 'github', 'context', 'fetch', 'core', script)(fakeRequire, { env: { RUNNER_TEMP: '/tmp' } }, github, { repo: { owner: 'fixture', repo: 'painel' }, serverUrl: 'https://github.com', runId: 9 }, () => { throw new Error('rede proibida no teste') }, { warning: (m) => feito.avisos.push(m) })
  return feito
}
const TITULO = 'Calendário da B3 no painel termina em 31/12/2026: incluir o de 2027'

test('lembrete do calendário B3: abre uma pendência só, com o que fazer em linguagem simples', async () => {
  const r = await rodarLembrete(em('2026-11-10T15:00:00Z'))
  assert.equal(r.criadas.length, 1)
  assert.equal(r.criadas[0].title, TITULO)
  assert.match(r.criadas[0].body, /^Faltam 51 dias para o fim do calendário de pregão da B3 que o painel conhece \(vai até 31\/12\/2026\)\./)
  assert.match(r.criadas[0].body, /a partir de 01\/01\/2027, as curvas de juros da B3 \(DI x pré e cupom cambial\) param de atualizar/)
  assert.match(r.criadas[0].body, /cotacoes\/scripts\/data-schedules\.mjs[\s\S]*cotacoes\/src\/holidays\.js/)
  assert.match(r.avisos[0], /Aviso ao Teams NÃO enviado/) // sem segredo no teste: registra, não quebra
})

test('lembrete do calendário B3: não duplica nem comenta a cada rodada, e não volta se o dono fechou', async () => {
  const aberta = await rodarLembrete(em('2026-11-11T15:00:00Z'), { abertas: [{ number: 5, title: TITULO }] })
  assert.deepEqual([aberta.criadas.length, aberta.comentarios.length, aberta.fechadas.length, aberta.paginou], [0, 0, 0, 0])
  const fechada = await rodarLembrete(em('2026-12-20T15:00:00Z'), { fechadas: [{ number: 5, title: TITULO }] })
  assert.deepEqual([fechada.criadas.length, fechada.comentarios.length], [0, 0])
  const depois = await rodarLembrete(em('2027-01-04T15:00:00Z'), { abertas: [{ number: 5, title: TITULO }] })
  assert.equal(depois.criadas.length, 0) // mesmo título depois do fim: segue uma pendência só
  // um pull request com o mesmo título não conta como pendência
  const pr = await rodarLembrete(em('2026-11-10T15:00:00Z'), { abertas: [{ number: 8, title: TITULO, pull_request: {} }] })
  assert.equal(pr.criadas.length, 1)
})

test('lembrete do calendário B3: fora do prazo não abre nada; com o calendário novo no ar, fecha o lembrete aberto', async () => {
  const longe = await rodarLembrete(em('2026-06-01T15:00:00Z'))
  assert.deepEqual([longe.criadas.length, longe.fechadas.length, longe.paginou], [0, 0, 0])
  const resolvido = await rodarLembrete({ due: false, daysLeft: 410, coverageEnd: '2027-12-31', nextYear: 2028, today: '2026-11-16' }, { abertas: [{ number: 5, title: TITULO }, { number: 6, title: 'Outra pendência' }] })
  assert.equal(resolvido.criadas.length, 0)
  assert.deepEqual(resolvido.fechadas.map((f) => [f.issue_number, f.state]), [[5, 'closed']])
  assert.match(resolvido.comentarios[0].body, /agora vai até 31\/12\/2027/)
  const semDado = await rodarLembrete(undefined)
  assert.deepEqual([semDado.criadas.length, semDado.fechadas.length], [0, 0])
})
