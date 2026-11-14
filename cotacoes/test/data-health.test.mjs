import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceHealth, quoteHealth } from '../src/dataHealth.js'
const H = 3600000
const at = s => Date.parse(s)
const now = at('2026-11-02T14:00:00-03:00')
const resource = data => ({ status: 'ok', data })
test('health: atraso anterior não desaparece no domingo', () => {
  const sunday = at('2026-11-01T12:00:00-03:00')
  for (const date of ['2026-10-01T12:00:00-03:00', '2026-10-30T10:00:00-03:00']) assert.equal(sourceHealth(resource({generatedAt:at(date)}),6*H,true,sunday).state,'old')
})
test('health: pausa semanal e retomada na segunda usam Brasília', () => {
  const r = resource({generatedAt:at('2026-10-30T23:00:00-03:00')})
  assert.equal(sourceHealth(r,6*H,true,at('2026-11-01T12:00:00-03:00')).state,'ok')
  assert.equal(sourceHealth(r,6*H,false,at('2026-11-01T12:00:00-03:00')).state,'old')
  assert.equal(sourceHealth(r,6*H,true,at('2026-11-02T00:30:00-03:00')).state,'ok')
  assert.equal(sourceHealth(r,6*H,true,at('2026-11-02T06:00:00-03:00')).state,'old')
})
test('health: arquivo novo não apaga retenção parcial ou falhas', () => {
  for(const detail of [{stale:{cdi:now-H}},{series:{ibov:{stale:true,points:[]}}},{errors:['SOFR: HTTP503']}]) assert.equal(sourceHealth(resource({generatedAt:now,...detail}),6*H,true,now).state,'partial')
})
test('health: mapas vazios não geram falso alerta e Selic vigente não envelhece', () => {
  assert.equal(sourceHealth(resource({generatedAt:now,stale:{},errors:[],error:{},selic:[[at('2026-06-01T12:00:00-03:00'),13.75]]}),6*H,true,now).state,'ok')
})
test('health: falha de leitura conserva geração e último sucesso', () => {
  const original=now-2*H
  const h=sourceHealth({status:'ok',data:{generatedAt:original},stale:true,error:'offline',checkedAt:now,lastSuccessAt:original},6*H,true,now)
  assert.equal(h.state,'retained');assert.equal(h.generatedAt,original);assert.equal(h.checkedAt,now);assert.equal(h.lastSuccessAt,original)
})
test('health: ausência, carregamento e data futura têm estado explícito', () => {
  assert.equal(sourceHealth(undefined,6*H,true,now).state,'missing')
  assert.equal(sourceHealth({status:'loading'},6*H,true,now).state,'loading')
  assert.equal(sourceHealth(resource({generatedAt:now+H}),6*H,true,now).state,'missing')
})
const quotes = timestamp => Object.fromEntries(Object.entries({USD:5.4,EUR:6.1,JPY:.035,CNH:.8}).map(([source,bid])=>[source,{source,bid,ask:bid,high:bid,low:bid,pct:0,delta:null,timestamp}]))
test('health: consulta às14h preserva dólar de10h e agrupa a referência mais antiga', () => {
  const rows=quotes(now);rows.USD.timestamp=now-4*H
  const h=quoteHealth(rows,{now,collectedAt:now,checkedAt:now,lastSuccessAt:now})
  assert.equal(h.state,'old');assert.equal(h.label,'Dado antigo');assert.equal(h.feed,'delayed');assert.equal(h.observedAt,now-4*H);assert.equal(h.latestObservedAt,now);assert.equal(rows.USD.timestamp,now-4*H)
})
test('health: retenção, reserva e ausência não recebem estado recente', () => {
  const rows=quotes(now);for(const q of Object.values(rows))q.stale=true
  assert.equal(quoteHealth(rows,{now}).state,'retained')
  delete rows.JPY;assert.equal(quoteHealth(rows,{now}).state,'partial')
  const reserve=quotes(now-H);for(const q of Object.values(reserve))q.fallback=true
  assert.equal(quoteHealth(reserve,{now}).state,'reserve')
  assert.equal(quoteHealth(null,{now}).state,'loading');assert.equal(quoteHealth({}, {now}).state,'missing')
  const future=quotes(now);future.USD.timestamp=now+H
  assert.equal(quoteHealth(future,{now}).state,'partial')
})

test('câmbio fora da janela de coleta: referências do fim da janela ficam neutras; atraso real continua alerta', () => {
  const noite = at('2026-11-12T22:00:00-03:00'), fim = at('2026-11-12T19:41:00-03:00')
  const rows = quotes(fim)
  const h = quoteHealth(rows, { now: noite })
  assert.equal(h.state, 'offhours'); assert.equal(h.label, 'Fora do horário de coleta'); assert.equal(h.feed, 'idle')
  rows.CNH.stale = true // cruzamento retido à noite continua sendo referência do fim da janela
  assert.equal(quoteHealth(rows, { now: noite }).state, 'offhours')
  rows.USD.timestamp = at('2026-11-12T14:00:00-03:00') // coleta parou à tarde: alerta
  assert.equal(quoteHealth(rows, { now: noite }).feed, 'delayed')
  const semIene = quotes(fim); delete semIene.JPY
  assert.equal(quoteHealth(semIene, { now: noite }).state, 'partial')
})
