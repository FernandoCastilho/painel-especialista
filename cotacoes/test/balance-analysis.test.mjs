import test from 'node:test'
import assert from 'node:assert/strict'
import {analyseBalance,blankAnalysis,sampleAnalysis,change,cell,numberValue,annualCsv,importAnnualCsv,validDate,validateInput,METRICS} from '../src/balanceAnalysis.js'
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`)
const model=()=>{const d=blankAnalysis();d.debtScope='Empréstimos e financiamentos';return d}
test('ausência, traço, null e boolean não viram zero; números pt-BR estritos',()=>{
 for(const v of ['',null,undefined,'-',true,false,'1e3','1.2','NaN']) assert.equal(numberValue(v),null)
 assert.equal(numberValue('0'),0);assert.equal(numberValue('1.234,56'),1234.56)
 assert.equal(cell({value:100,status:'Divergente'}).value,null)
})
test('crescimentos e relações dívida receita sem causalidade',()=>{
 const d=model();d.years.forEach((y,i)=>{y.values={revenue:[100,112,126][i],shortDebt:[20,27,30][i],longDebt:0}})
 const r=analyseBalance(d);near(r.years[1].m.debtRevenue,27/112*100)
 assert.match(r.findings.find(f=>f.year===d.years[1].year).text,/23,00 p.p./)
 assert.match(r.findings[0].inference,/não confirma/)
})
test('mudança prejuízo lucro não calcula percentual convencional',()=>assert.deepEqual(change(-10,5),{absolute:15,percent:null}))
test('mês ausente mantém total parcial, não calcula anual',()=>{
 const d=sampleAnalysis();d.years[1].monthly[3]='';const y=analyseBalance(d).years[1]
 assert.equal(y.monthlyCount,11);assert.equal(y.monthlyTotal,null);assert.ok(y.monthlyPartial>0)
})
test('prazos exigem abertura e compras a prazo; sem proxy CMV',()=>{
 const d=model();d.years.forEach((y,i)=>{y.compatible=true;y.values={inventory:[10,14,12][i],cost:[60,70,80][i],suppliers:5,receivables:10,creditSales:100}})
 const r=analyseBalance(d);assert.equal(r.years[0].m.pme,null);near(r.years[1].m.pme,12/70*d.years[1].days)
 assert.equal(r.years[1].m.pmp,null);assert.equal(r.years[1].m.cycle,null)
 d.opening.inventory=8;d.years[1].values.inventory='';assert.equal(analyseBalance(d).years[2].m.pme,null)
})
test('caixa sem elegibilidade não permite dívida líquida e depreciação ausente bloqueia EBITDA',()=>{
 const d=model();d.years[0].values={cash:50,shortDebt:100,longDebt:0,netProfit:5,tax:2,financialExpense:3,financialIncome:0}
 const r=analyseBalance(d);assert.equal(r.years[0].m.netDebt,null);assert.equal(r.years[0].m.ebitda,null);assert.equal(r.years[0].m.ebit,10)
})
test('denominadores zero e EBITDA negativo bloqueiam razões',()=>{
 const d=model();d.years[0].values={revenue:0,currentAssets:10,currentLiabilities:0,netProfit:-10,tax:0,financialExpense:0,financialIncome:0,depreciation:0,shortDebt:10,longDebt:0}
 const m=analyseBalance(d).years[0].m;assert.equal(m.netMargin,null);assert.equal(m.liquidity,null);assert.equal(m.debtEbitda,null)
})
test('dado divergente preserva origem e bloqueia apenas dependentes',()=>{
 const d=model();d.years[0].values={revenue:{value:100,status:'Divergente',source:'DRE A versus B'},netProfit:5,currentAssets:20,currentLiabilities:10}
 const r=analyseBalance(d);assert.equal(r.years[0].m.netMargin,null);assert.equal(r.years[0].m.liquidity,2);assert.equal(r.years[0].entries.revenue.source,'DRE A versus B')
})
test('conta negativa de natureza não negativa exige esclarecimento',()=>{
 const d=model();d.years[0].values={currentAssets:-10,currentLiabilities:5};const r=analyseBalance(d);assert.equal(r.years[0].m.liquidity,null);assert.equal(r.years[0].entries.currentAssets.status,'Divergente')
})
test('período parcial não gera cruzamentos anuais',()=>{
 const d=sampleAnalysis();d.years[1].fullYear=false;assert.equal(analyseBalance(d).findings.length,0)
})
test('dívidas segregadas por moeda/data; final não vira cronograma e rótulos não poluem prototype',()=>{
 const d=model();d.debts=[{id:'A',date:'2025-12-31',currency:'BRL',amount:100,creditor:'__proto__',schedule:[],maturity:'2030-01-01'},{id:'B',date:'2025-12-31',currency:'USD',amount:20,creditor:'constructor',schedule:[]}]
 const r=analyseBalance(d);assert.equal(Object.keys(r.debt.groups).length,2);assert.equal(r.debt.groups['2025-12-31 · BRL'].byCreditor.__proto__,100);assert.equal(r.debt.groups['2025-12-31 · BRL'].scheduled,0);assert.equal(r.debt.warnings.length,2)
})
test('datas inválidas não aceitas',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);const d=model();d.debts=[{id:'A',date:'2026-99-99',currency:'BRL',amount:1,schedule:[]}];assert.throws(()=>validateInput(d),/Contrato inválido/)})
test('benchmark sem comparabilidade não produz diferença; referência validada na entrada produz',()=>{
 const d=model();d.years[0].values={currentAssets:30,currentLiabilities:10};d.benchmarks=[{name:'Referência sintética',metric:'liquidity',year:d.years[0].year,value:2,source:'https://example.org/dfp',method:METRICS[0][3],currency:d.currency,unit:d.unit,perimeter:d.perimeter,consultedAt:'2026-11-09',limitations:'Porte diferente',comparable:false}]
 assert.equal(analyseBalance(d).benchmarks[0].difference,null);d.benchmarks[0].comparable=true;assert.equal(analyseBalance(d).benchmarks[0].difference,1)
})
test('CSV anual importa por códigos e rejeita cabeçalho ou conta duplicada',()=>{
 const d=sampleAnalysis(),csv=annualCsv(d);assert.equal(cell(importAnnualCsv(csv,blankAnalysis()).years[0].values.revenue).value,100)
 assert.throws(()=>importAnnualCsv(csv.replace('conta;','ano;'),d));assert.throws(()=>importAnnualCsv(csv+'\nrevenue;1;2;3',d))
})
test('JSON não executa instruções e rejeita esquema inesperado',()=>{
 const d=model();d.company='<script>alert(1)</script>';assert.equal(analyseBalance(d).data.company,d.company)
 d.years[0].values.unrecognized=5;assert.throws(()=>validateInput(d),/Conta desconhecida/)
})
test('cronograma usa amortizações e faixas pela data-base; concilia só escopo confirmado',()=>{
 const d=model();const year=d.years[2].year;d.years[2].values={shortDebt:1,longDebt:0};d.unit='1000';d.debts=[{id:'A',date:`${year}-12-31`,currency:'BRL',amount:1000,schedule:[{date:`${year}-12-30`,amount:100},{date:`${year+1}-12-31`,amount:200},{date:`${year+2}-01-01`,amount:300},{date:`${year+4}-01-01`,amount:400}]}]
 let r=analyseBalance(d);assert.equal(r.debtReconciliations[2].difference,null);const g=Object.values(r.debt.groups)[0];assert.equal(g.buckets.Vencidos,100);assert.equal(g.buckets['Até 12 meses'],200);assert.equal(g.buckets['13 a 24 meses'],300);assert.equal(g.buckets['Acima de 36 meses'],400)
 d.debtsComparable=true;r=analyseBalance(d);assert.equal(r.debtReconciliations[2].difference,0)
})
test('identidades de contrato duplicadas não entram parcialmente nos totais',()=>{
 const d=model();const c={id:'A',date:'2025-12-31',currency:'BRL',amount:100,schedule:[]};d.debts=[c,{...c}];assert.deepEqual(Object.keys(analyseBalance(d).debt.groups),[])
})
test('mensal cruza dezembro janeiro e agregados incompletos ficam indisponíveis',()=>{
 const d=sampleAnalysis();d.years[0].monthly[11]=100;d.years[1].monthly[0]=120;d.years[1].monthly[2]=''
 const r=analyseBalance(d);near(r.years[1].monthlyChanges[0].percent,20);assert.equal(r.years[1].quarters[0],null);assert.equal(r.years[1].semesters[0],null);assert.ok(r.years[1].quarters[1]>0)
})
