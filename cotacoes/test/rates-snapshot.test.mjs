import test from 'node:test'
import assert from 'node:assert/strict'
import { snapshotPeriods,lastAt,snapshotRows,brDay } from '../src/ratesSnapshot.js'
test('snapshot uses Sao Paulo day, calendar month/year clamp and 180 calendar days',()=>{
 const p=snapshotPeriods(Date.parse('2026-03-31T15:00Z'))
 assert.equal(p[1].date,'2026-02-28');assert.equal(p[2].date,'2025-10-02');assert.equal(p[3].date,'2025-03-31')
 assert.equal(snapshotPeriods(Date.parse('2024-02-29T15:00Z'))[3].date,'2023-02-28')
 assert.equal(brDay(Date.parse('2026-10-22T01:00Z')),'2026-10-21')
})
test('lastAt chooses nearest preceding observation inclusively, never future or zero by absence',()=>{
 const p=[{date:'2026-10-21',value:5},{date:'2026-10-23',value:6},{date:'2026-10-20',value:4}]
 assert.equal(lastAt(p,'2026-10-22').value,5);assert.equal(lastAt(p,'2026-10-21').value,5)
 assert.equal(lastAt(p,'2026-10-19'),null);assert.equal(lastAt([{date:'2026-10-21',value:NaN}],'2026-10-22'),null)
})
test('interest snapshot excludes all FX, PTAX and oil even when supplied',()=>{
 const rows=snapshotRows({periods:snapshotPeriods(Date.parse('2026-10-22T12:00Z')), quotes:{USD:{bid:5}},history:{series:{USD:{points:[]}}},oil:{points:[{date:'2026-10-21',value:100}]},macro:{ptaxHist:{USD:{'2026-10-21':5}}}})
 assert.deepEqual(rows.map(r=>r.id),['SELIC','CDI','SOFR'])
 assert.ok(rows.every(r=>Object.values(r.cells).every(c=>c.value==='—')))
 assert.match(rows[0].unit,/Política monetária/)
 assert.match(rows[1].unit,/overnight/)
 assert.match(rows[2].label,/EUA/)
})
test('rates retain observation dates, Selic effective dates and annualized levels',()=>{
 const t=d=>Date.parse(d+'T12:00Z')
 const periods=snapshotPeriods(t('2026-10-22'))
 const rows=snapshotRows({periods,macro:{cdi:[[t('2025-10-21'),10],[t('2026-09-22'),11],[t('2026-10-21'),12],[t('2026-10-23'),99]],selic:[[t('2026-09-01'),13.75],[t('2026-10-21'),13.75]],sofr:[[t('2026-10-21'),4.25]]}})
 const cdi=rows.find(r=>r.id==='CDI'), selic=rows.find(r=>r.id==='SELIC')
 assert.equal(cdi.cells.day.value,'12,00%');assert.equal(cdi.cells.month.value,'11,00%')
 assert.equal(cdi.cells.year.value,'10,00%');assert.equal(cdi.cells.day.date,'21/10/2026')
 assert.equal(selic.cells.day.date,'01/09/2026');assert.match(selic.cells.day.status,/Vigente/)
 assert.equal(selic.cells.year.value,'—');assert.match(cdi.cells.day.source,/4389/)
})
test('missing, stale and loading data stay explicit without invented values',()=>{
 const periods=snapshotPeriods(Date.parse('2026-10-22T12:00Z'))
 const rows=snapshotRows({periods,macro:{sofr:[[Date.parse('2026-10-21T12:00Z'),4]],stale:{sofr:1}},errors:{}})
 assert.match(rows.find(r=>r.id==='SOFR').cells.day.status,/pendente/)
 assert.equal(rows.find(r=>r.id==='SOFR').cells.year.value,'—')
 assert.equal(rows.find(r=>r.id==='CDI').cells.day.value,'—')
 const loading=snapshotRows({periods,errors:{macro:'Carregando juros…'}})
 assert.equal(loading[0].cells.day.status,'Carregando juros…')
})
test('Juros: a página traz só tabelas; cada linha abre o gráfico em tela própria, sem consultas de câmbio nem Focus',async()=>{
 const {readFile}=await import('node:fs/promises')
 const read=p=>readFile(new URL('../src/'+p,import.meta.url),'utf8')
 const app=await read('App.jsx'), snapshot=await read('RatesSnapshot.jsx'), macro=await read('Macro.jsx'), juros=await read('Juros.jsx'), modal=await read('RateModal.jsx')
 const section=app.slice(app.indexOf("{tab === 'juros'"),app.indexOf("{tab === 'cenarios'"))
 assert.match(section,/<Juros macro=\{macro\} curves=\{curves\} hol=\{hol\}/)
 // ordem da página: referência, CDI futuro e curvas; nenhum gráfico solto na página
 assert.ok(juros.indexOf('<RatesSnapshot')<juros.indexOf('<CdiFuturoTable'));assert.ok(juros.indexOf('<CdiFuturoTable')<juros.indexOf('<Curves'))
 assert.doesNotMatch(juros,/<(SelicChart|CdiChart|SofrChart|EstrChart|CurveChart|CdiFuturo) /)
 for(const tabela of ['<RatesSnapshot','<CdiFuturoTable','<Curves']) assert.match(juros.slice(juros.indexOf(tabela)),/^[^\n]*onOpen=\{abrir\}/,tabela+' abre o gráfico')
 // toda linha da tabela de referência tem gráfico na tela de detalhe
 for(const id of ['SELIC','CDI','SOFR','ESTR','FED','ECB','BOJ']) { const kind=new RegExp(id+": '(\\w+)'").exec(juros)?.[1]; assert.ok(kind,id+' sem destino'); assert.ok(modal.includes("'"+kind+"'"),kind+' sem gráfico') }
 assert.match(modal,/kind === 'cdif'/);assert.match(modal,/<CurveDetail/);assert.match(modal,/<Expandable modal/)
 assert.doesNotMatch(snapshot,/fetch\(|history.json|oil.json|quotes|DATA_BASE/)
 assert.doesNotMatch(macro,/FocusTable|useMacro/)
 assert.match(snapshot,/SOFR não é a taxa básica do Fed/)
})
test('interest chart toggles expose state without struck-through labels',async()=>{
 const {readFile}=await import('node:fs/promises')
 for(const name of ['Sofr.jsx','Curves.jsx']) {
  const s=await readFile(new URL('../src/'+name,import.meta.url),'utf8')
  assert.match(s,/aria-pressed/);assert.match(s,/Oculta/);assert.match(s,/Visível/)
 }
 const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8')
 assert.doesNotMatch(css,/curve-legend[^}]+line-through/)
})
