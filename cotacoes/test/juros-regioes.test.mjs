import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeRate } from '../src/rateTrend.js'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
// Pedido de 17/11/2026 (substitui o de 15/11): indicadores de referência em gráfico na página, sem a Selic meta;
// CDI futuro e curvas seguem em tabela. Brasil antes do exterior. Tudo amplia no detalhe, no centro da tela.
test('juros: indicadores em gráfico por região, sem Selic meta, e tabelas de CDI futuro e curvas abrem detalhes', () => {
 const s=source('Juros.jsx'), br=s.slice(s.indexOf('aria-labelledby="juros-brasil">'),s.indexOf('aria-labelledby="juros-exterior">')), ex=s.slice(s.indexOf('aria-labelledby="juros-exterior">'))
 assert.match(br, /<Indicadores region="brasil".*onOpen=\{abrir\}/)
 assert.match(ex, /<Indicadores region="exterior".*onOpen=\{abrir\}/)
 assert.match(br, /<CdiFuturoTable.*onOpen=\{abrir\}/)
 assert.match(br, /<Curves.*region="brasil".*onOpen=\{abrir\}/)
 assert.match(ex, /<Curves.*region="exterior".*onOpen=\{abrir\}/)
 assert.match(s, /<RateModal kind=\{open\}/)
 assert.match(s, /brasil: \[\['cdi', 'CDI'\]\]/)
 assert.match(s, /exterior: \[\['sofr', 'SOFR'\], \['fed', 'Fed \(faixa-alvo\)'\], \['estr', '€STR'\], \['ecb', 'BCE \(depósito\)'\], \['boj', 'Japão \(meta overnight\)'\]\]/)
 // Selic meta fora da aba: nem gráfico, nem tabela de referência, nem atalho para o detalhe dela.
 assert.doesNotMatch(s, /<SelicChart|<RatesSnapshot|'selic'|SELIC/)
 assert.match(s, /aria-label=\{`Ampliar gráfico: \$\{nome\}`\}/)
})
test('juros: detalhe preserva gráficos, inclui leitura e tabelas filtradas',()=>{
 const s=source('RateModal.jsx'); assert.match(s,/<RateTrend/);assert.match(s,/<RatesSnapshot.*onlyIds/);assert.match(s,/<Curves.*onlyId/)
 assert.match(source('RatesSnapshot.jsx'),/onlyIds.includes\(row.id\)/)
 assert.match(source('Curves.jsx'),/!onlyId \|\| id === onlyId/)
})
test('juros: gráficos de referência precedem as curvas em cada região',()=>{
 const s=source('Juros.jsx')
 for (const region of ['brasil','exterior']) assert.ok(s.indexOf(`<Indicadores region="${region}"`) < s.indexOf(`<Curves curves={curves} region="${region}"`))
})
test('detalhe de gráfico abre em janela no centro da tela no computador', () => {
 const css=source('styles.css')
 assert.match(css, /\.expandable-panel\.is-dialog\.is-modal \{ inset:0; margin:auto; width:min\(1120px, calc\(100vw - 64px\)\); height:fit-content; max-height:calc\(100dvh - 64px\);/)
 assert.doesNotMatch(css, /\.expandable-panel\.is-dialog\.is-modal \{ inset:0 0 0 auto/)
 // sem `transform` depois de aberta: calendário e balões de posição fixa continuam se medindo pela tela
 assert.match(css, /\.expandable-panel\.is-modal\[open\] \{ animation:modal-in \.28s cubic-bezier\(\.16,1,\.3,1\) backwards; \}/)
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
