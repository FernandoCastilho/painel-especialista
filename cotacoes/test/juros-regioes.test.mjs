import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeRate } from '../src/rateTrend.js'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
test('juros: gráficos principais separados em Brasil e exterior, sem tabelas principais', () => {
 const s=source('Juros.jsx'), br=s.slice(s.indexOf('<section aria-labelledby="juros-brasil">'),s.indexOf('<section aria-labelledby="juros-exterior">')), ex=s.slice(s.indexOf('<section aria-labelledby="juros-exterior">'))
 for(const c of ['SelicChart','CdiChart','CdiFuturo']) assert.match(br,new RegExp(`<${c} `))
 for(const c of ['SofrChart','Estr','Policy']) assert.match(ex,new RegExp(`<${c} `))
 assert.match(br,/region="brasil"/);assert.match(ex,/region="exterior"/)
 assert.doesNotMatch(s,/<RatesSnapshot|<CdiFuturoTable|<Curves /)
 for(const id of ['br','cc','us','eu']) assert.ok(s.includes(`curve('${id}'`))
 assert.match(s,/type="button".*aria-label=\{`Ampliar/)
})
test('juros: detalhe preserva gráficos, inclui leitura e tabelas filtradas',()=>{
 const s=source('RateModal.jsx'); assert.match(s,/<RateTrend/);assert.match(s,/<RatesSnapshot.*onlyIds/);assert.match(s,/<Curves.*onlyId/)
 assert.match(source('RatesSnapshot.jsx'),/onlyIds.includes\(row.id\)/)
 assert.match(source('Curves.jsx'),/!onlyId \|\| id === onlyId/)
})
test('juros: grade responsiva não força tabela na primeira tela',()=>{assert.match(source('Juros.css'),/minmax\(min\(100%,360px\),1fr\)/)})
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
 assert.match(source('Juros.jsx'),/kind.startsWith\('curva-'\).*'Ver gráfico e tabela'/)
 assert.match(source('RateModal.jsx'),/tabela abaixo compara datas fixas/)
 assert.match(source('RateModal.jsx'),/filtro acima altera apenas o gráfico e a leitura descritiva/)
})
