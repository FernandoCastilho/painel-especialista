import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeRate } from '../src/rateTrend.js'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
// Pedido explícito: tabela inicial; Brasil antes do exterior. Gráficos abrem no detalhe.
test('juros: tabelas iniciais separadas em Brasil e exterior abrem detalhes', () => {
 const s=source('Juros.jsx'), br=s.slice(s.indexOf('<section aria-labelledby="juros-brasil">'),s.indexOf('<section aria-labelledby="juros-exterior">')), ex=s.slice(s.indexOf('<section aria-labelledby="juros-exterior">'))
 assert.match(br, /<RatesSnapshot.*region="brasil".*onOpen=\{abrir\}/)
 assert.match(ex, /<RatesSnapshot.*region="exterior".*onOpen=\{abrir\}/)
 assert.match(br, /<CdiFuturoTable.*onOpen=\{abrir\}/)
 assert.match(br, /<Curves.*region="brasil".*onOpen=\{abrir\}/)
 assert.match(ex, /<Curves.*region="exterior".*onOpen=\{abrir\}/)
 assert.match(s, /<RateModal kind=\{open\}/)
 assert.doesNotMatch(s, /<GraphCard|<SelicChart|<CdiChart|<SofrChart/)
 for (const id of ['SELIC','CDI','SOFR','ESTR','FED','ECB','BOJ']) assert.ok(s.includes(id + ':'), id)
})
test('juros: detalhe preserva gráficos, inclui leitura e tabelas filtradas',()=>{
 const s=source('RateModal.jsx'); assert.match(s,/<RateTrend/);assert.match(s,/<RatesSnapshot.*onlyIds/);assert.match(s,/<Curves.*onlyId/)
 assert.match(source('RatesSnapshot.jsx'),/onlyIds.includes\(row.id\)/)
 assert.match(source('Curves.jsx'),/!onlyId \|\| id === onlyId/)
})
test('juros: tabela de referência precede as curvas em cada região',()=>{
 const s=source('Juros.jsx')
 for (const region of ['brasil','exterior']) assert.ok(s.indexOf(`<RatesSnapshot macro={macro} region="${region}"`) < s.indexOf(`<Curves curves={curves} region="${region}"`))
})
const day=86400000, range={start:new Date(10*day),end:new Date(20*day)}
test('tendência: não usa dados futuros nem converte faltantes em zero',()=>{
 const r=summarizeRate([{t:11*day,value:12},{t:19*day,value:10},{t:21*day,value:90},{t:18*day,value:null}],range)
 assert.equal(r.change,-2);assert.equal(r.count,2);assert.equal(summarizeRate([],range),null)
})
test('tendência: política preserva referência anterior, observada não inventada',()=>{
 const r=summarizeRate([{t:5*day,value:10},{t:15*day,value:11}],range,true)
 assert.equal(r.change,1);assert.equal(r.first.t,5*day)
 assert.equal(summarizeRate([{t:5*day,value:10}],range),null)
})
test('juros: curvas não prometem tendência e tabela explicita datas fixas',()=>{
 assert.match(source('RateModal.jsx'),/SERIES.includes\(kind\) && <RateTrend/)
 assert.match(source('RateModal.jsx'),/tabela abaixo compara datas fixas/)
 assert.match(source('RateModal.jsx'),/filtro acima altera apenas o gráfico e a leitura descritiva/)
})

test('juros: carrega estilos da leitura de tendência preservada no detalhe', () => {
 assert.match(source('Juros.jsx'), /import '\.\/Juros\.css'/)
 assert.match(source('Juros.css'), /\.rate-trend\s*\{[^}]*border-left:[^}]*padding:[^}]*margin:/)
})
