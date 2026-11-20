import test from 'node:test'
import assert from 'node:assert/strict'
import { simularParcelasCambiais as simular, tirarTirCambialPct } from '../src/cambioFuturoCenario.js'
const inicio = '2026-11-20'
const ano = '2027-11-20'
const perto = (a, b, tol = 1e-8) => assert.ok(Math.abs(a-b) < tol, `${a} vs ${b}`)
const parcela = (id, vencimento, valorMoeda, taxaTrava, taxaCenario, outros = {}) =>
  ({ id, vencimento, valorMoeda, taxaTrava, taxaCenario, ...outros })

test('prévia aprovada: três parcelas com soma nominal de 198 mil e diferença de 4,5 mil', () => {
  const r = simular({ inicio, parcelas:[
    parcela('a', '2027-05-20',10000,6.55,6.70),
    parcela('b', '2027-08-20',10000,6.60,6.80),
    parcela('c', ano,10000,6.65,6.75),
  ] })
  assert.equal(r.ok,true)
  assert.equal(r.totalComTravaBrl,198000)
  assert.equal(r.totalSemTravaBrl,202500)
  assert.equal(r.diferencaBrl,4500)
  assert.deepEqual(r.parcelas.map(p=>p.diferencaBrl),[1500,2000,1000])
  assert.equal(r.tirComTravaPct,null)
})
test('diferenças opostas preservam detalhe e resultam em empate total', () => {
  const a=parcela('a','2027-05-20',10000,6.55,6.70)
  const b=parcela('b',ano,15000,6.50,6.40)
  for (const linhas of [[a,b],[b,a]]) {
    const r=simular({ inicio, parcelas:linhas })
    assert.equal(r.totalComTravaBrl,163000)
    assert.equal(r.totalSemTravaBrl,163000)
    assert.equal(r.diferencaBrl,0)
    assert.equal(r.parcelas.find(p=>p.id==='a').diferencaBrl,1500)
    assert.equal(r.parcelas.find(p=>p.id==='b').diferencaBrl,-1500)
  }
})
test('custos por lado alteram o ponto de equilíbrio e não são contados duas vezes', () => {
  const { parcelas:[p] }=simular({ inicio, parcelas:[parcela('a',ano,10000,6.55,6.56,{custoTravaBrl:130,custoSemTravaBrl:30})] })
  assert.equal(p.comTravaBrl,65630)
  assert.equal(p.semTravaBrl,65630)
  perto(p.equilibrio,6.56)
  assert.equal(p.diferencaBrl,0)
})
test('taxa de custo usa pagamento e líquido recebidos no ano e não mascara taxa alta em prazo curto', () => {
  const a=simular({ inicio, liquidoBrl:60000, parcelas:[parcela('a',ano,10000,6.55,6.70)] })
  perto(a.custoNoPeriodoPct,100*(65500/60000-1))
  perto(a.tirComTravaPct,100*(65500/60000-1))
  perto(a.tirSemTravaPct,100*(67000/60000-1))
  const b=simular({ inicio, liquidoBrl:100, parcelas:[parcela('b','2026-11-30',100,1.15,1.2)] })
  assert.ok(b.tirComTravaPct>1000)
  perto(b.tirComTravaPct,Math.expm1(Math.log(1.15)*36.5)*100,1e-6)
})
test('TIR de múltiplas parcelas é do fluxo inteiro, com VPL igual a zero', () => {
  // 100 no fim do ano 1 e 110 no fim do ano 2 equivalem a 181,818… a 10% a.a.
  const pagamentos=[{dias:365,pago:100},{dias:730,pago:110}]
  perto(tirarTirCambialPct(200/1.1,pagamentos),10)
  perto(tirarTirCambialPct(100,[{dias:365,pago:80}]),-20)
  assert.equal(tirarTirCambialPct(100,[{dias:365,pago:100}]),0)
  const r=simular({ inicio, liquidoBrl:90, parcelas:[
    parcela('a','2027-05-20',50,1,1.1),parcela('b',ano,55,1,0.9),
  ] })
  const soma=r.parcelas.reduce((s,p)=>s+p.comTravaBrl/(1+r.tirComTravaPct/100)**(p.dias/365),0)
  perto(soma,90)
  assert.equal(r.custoNoPeriodoPct,null)
})
test('não trata simulação incompleta como um total parcial de todas as parcelas', () => {
  const r=simular({ inicio, liquidoBrl:100, parcelas:[
    parcela('a',ano,50,1,null),parcela('b','2027-11-21',100,1,1.2),
  ] })
  assert.equal(r.totalComTravaBrl,150)
  assert.equal(r.totalSemTravaBrl,null)
  assert.equal(r.diferencaBrl,null)
  assert.ok(r.tirComTravaPct>0)
  assert.equal(r.tirSemTravaPct,null)
  assert.equal(r.parcelas[1].diferencaBrl,20)
})
test('datas inválidas, duplicatas, zero e tamanho são tratados sem resultados enganadores', () => {
  assert.equal(simular({inicio,parcelas:[]}).ok,false)
  assert.equal(simular({inicio:'2027-02-29',parcelas:[parcela('a',ano,1,1,1)]}).ok,false)
  assert.equal(simular({inicio,parcelas:[parcela('a',ano,0,1,1)]}).ok,false)
  assert.equal(simular({inicio,parcelas:[parcela('a',ano,1,1,1),parcela('a',ano,1,1,1)]}).ok,false)
  assert.equal(simular({inicio,parcelas:[parcela('a',inicio,1,1,1)]}).totalComTravaBrl,null)
  assert.equal(simular({inicio,parcelas:[parcela('a',ano,1,1,1)],liquidoBrl:0.001}).ok,false)
})
test('quantias monetárias arredondam por parcela e protegem os limites de centavos', () => {
  const r=simular({inicio,parcelas:[parcela('a',ano,1,1.005,1.015)]})
  assert.equal(r.totalComTravaBrl,1.01)
  assert.equal(r.totalSemTravaBrl,1.02)
  assert.equal(r.diferencaBrl,.01)
  assert.equal(simular({inicio,parcelas:[parcela('a',ano,1e16,1,1)]}).ok,false)
})

test('trava cruzada multiplica taxas decimais originais e arredonda centavos uma vez', async () => {
  const { simularParcelasCambiaisComTravaCruzada, mostrarBrutoTravaCruzada } = await import('../src/cambioFuturoCenario.js')
  const parcela = { id: 'p1', vencimento: '2027-01-01', valorMoeda: 1001, taxaParidade: .58, taxaTrava: 6.75, taxaCenario: 4, custoTravaBrl: .01 }
  const result = simularParcelasCambiaisComTravaCruzada({ inicio:'2026-01-01', liquidoBrl:3800, parcelas:[parcela] })
  assert.equal(mostrarBrutoTravaCruzada(1001,6.75,.58),3918.92)
  assert.equal(result.totalComTravaBrl,3918.93)
  assert.equal(result.totalSemTravaBrl,4004)
  assert.ok(Math.abs(result.tirComTravaPct - (3918.93/3800-1)*100) < 1e-9)
  const incompleto = simularParcelasCambiaisComTravaCruzada({ inicio:'2026-01-01', liquidoBrl:3800, parcelas:[{...parcela, taxaParidade:null}] })
  assert.equal(incompleto.totalComTravaBrl,null)
  assert.equal(incompleto.tirComTravaPct,null)
})
