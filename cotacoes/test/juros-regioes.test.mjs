import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeRate } from '../src/rateTrend.js'
const source = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8')
// Pedido de 17/11/2026 (substitui o de 15/11): só gráficos na página, sem a Selic meta. As tabelas e a escolha de
// período ficam no detalhe, que abre no centro da tela ao clicar no gráfico. Brasil antes do exterior.
test('juros: só gráficos na página, sem Selic meta; tabelas ficam no detalhe', () => {
 const s=source('Juros.jsx'), br=s.slice(s.indexOf('aria-labelledby="juros-brasil">'),s.indexOf('aria-labelledby="juros-exterior">')), ex=s.slice(s.indexOf('aria-labelledby="juros-exterior">'))
 assert.match(br, /<Graficos region="brasil".*onOpen=\{abrir\}/)
 assert.match(ex, /<Graficos region="exterior".*onOpen=\{abrir\}/)
 assert.match(s, /brasil: \[\['cdi', 'CDI', 'juros-ref-brasil'\], \['cdif', 'CDI futuro', 'juros-cdif'\], \['curva-br', 'DI x pré', 'juros-curva-br'\], \['curva-cc', 'Cupom cambial', 'juros-curva-cc'\]\]/)
 assert.match(s, /exterior: \[\['sofr', 'SOFR', 'juros-ref-exterior'\], \['fed', 'Fed \(faixa-alvo\)'\], \['estr', '€STR'\], \['ecb', 'BCE \(depósito\)'\], \['boj', 'Japão \(meta overnight\)'\], \['curva-us', 'Treasuries', 'juros-curva-us'\], \['curva-eu', 'Curva do euro', 'juros-curva-eu'\]\]/)
 // nenhuma tabela na página: nem a de referência, nem a de CDI futuro, nem as das curvas
 assert.doesNotMatch(s, /<RatesSnapshot|<CdiFuturoTable|<Curves |IndicatorTable|<table/)
 assert.match(s, /<CdiFuturo preview /); assert.match(s, /<CurveDetail preview /)
 // Selic meta fora da aba
 assert.doesNotMatch(s, /<SelicChart|'selic'|SELIC/)
 // clicar no gráfico abre o detalhe; os controles do próprio gráfico não disparam a abertura
 assert.match(s, /onClick=\{\(e\) => \{ if \(!e\.target\.closest\(CONTROLE\)\) onOpen\(kind\) \}\}/)
 assert.match(s, /aria-label=\{`Ampliar gráfico: \$\{nome\}`\}/)
 assert.match(s, /<RateModal kind=\{open\}/)
 // no detalhe, as tabelas vêm abaixo do gráfico
 const m=source('RateModal.jsx')
 assert.match(m, /<CdiFuturo curves=\{curves\} macro=\{data\} hol=\{hol\} \/><CdiFuturoTable curves=\{curves\} \/>/)
 assert.match(m, /<RatesSnapshot.*onlyIds/); assert.match(m, /<Curves curves=\{curves\} onlyId=/)
 // tabela dentro do detalhe não tem linha clicável
 assert.match(source('IndicatorTable.jsx'), /const off = r\.disabled \|\| !onOpen/)
})
test('juros: detalhe preserva gráficos, inclui leitura e tabelas filtradas',()=>{
 const s=source('RateModal.jsx'); assert.match(s,/<RateTrend/);assert.match(s,/<RatesSnapshot.*onlyIds/);assert.match(s,/<Curves.*onlyId/)
 assert.match(source('RatesSnapshot.jsx'),/onlyIds.includes\(row.id\)/)
 assert.match(source('Curves.jsx'),/!onlyId \|\| id === onlyId/)
})
test('juros: referência vem antes do CDI futuro e das curvas em cada região',()=>{
 const s=source('Juros.jsx')
 assert.ok(s.indexOf("['cdi', 'CDI'") < s.indexOf("['cdif'") && s.indexOf("['cdif'") < s.indexOf("['curva-br'") && s.indexOf("['curva-br'") < s.indexOf("['curva-cc'"))
 assert.ok(s.indexOf("['sofr'") < s.indexOf("['boj'") && s.indexOf("['boj'") < s.indexOf("['curva-us'") && s.indexOf("['curva-us'") < s.indexOf("['curva-eu'"))
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
