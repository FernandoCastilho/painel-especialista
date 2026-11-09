// Motor documental local: ausência e divergência nunca são convertidas em zero.
export const FIELDS = [
  ['grossRevenue','Receita bruta','DRE'],['revenue','Receita líquida','DRE'],['cost','Custo das vendas (despesa positiva)','DRE'],['grossProfit','Lucro bruto','DRE'],['expenses','Despesas operacionais (positivas)','DRE'],['netProfit','Lucro líquido','DRE'],['tax','IR/CSLL no resultado (despesa positiva)','DRE'],['financialExpense','Despesas financeiras','DRE'],['financialIncome','Receitas financeiras','DRE'],['depreciation','Depreciação, amortização e exaustão no resultado','DRE'],['interest','Despesa de juros identificada','DRE'],['creditSales','Vendas a prazo compatíveis com recebíveis','DRE'],['creditPurchases','Compras a prazo compatíveis com fornecedores','DRE'],
  ['assets','Ativo total','Balanço'],['currentAssets','Ativo circulante','Balanço'],['currentLiabilities','Passivo circulante','Balanço'],['longLiabilities','Passivo não circulante','Balanço'],['equity','Patrimônio líquido','Balanço'],['cash','Disponibilidades informadas','Balanço'],['eligibleCash','Caixa livre elegível confirmado','Balanço'],['receivables','Recebíveis comerciais','Balanço'],['inventory','Estoques','Balanço'],['suppliers','Fornecedores comerciais','Balanço'],['shortDebt','Dívida financeira de curto prazo','Balanço'],['longDebt','Dívida financeira de longo prazo','Balanço'],['fixedAssets','Imobilizado líquido','Balanço'],['relatedAssets','Créditos com partes relacionadas','Balanço'],['relatedLiabilities','Obrigações com partes relacionadas','Balanço'],['taxLiabilities','Tributos a pagar','Balanço'],['provisions','Provisões','Balanço'],['operatingAssets','Ativos circulantes operacionais classificados','Balanço'],['operatingLiabilities','Passivos circulantes operacionais classificados','Balanço'],['operatingCashFlow','Fluxo operacional informado na DFC','DFC'],
]
export const SECTORS = {
  geral: ['Geral / atividade mista', 'Qual é a atividade e a composição da receita por linha de negócio? Informe o escopo antes de aplicar referências setoriais.'],
  industria: ['Indústria', 'Qual é a composição dos estoques entre matérias-primas, produtos em elaboração e acabados, seu tempo sem movimentação e a capacidade utilizada?'],
  comercio: ['Comércio e distribuição', 'Qual é a composição por mix e canal, a idade dos estoques e o efeito documentado de devoluções e descontos?'],
  servicos: ['Serviços', 'Qual é a concentração, recorrência e vigência dos contratos e a composição de pessoal, terceiros e adiantamentos?'],
  construcao: ['Construção e incorporação', 'Quais são os custos a incorrer, cronogramas, recebíveis e adiantamentos por empreendimento e SPE?'],
  agro: ['Agro', 'Quais safras, ativos biológicos e produtos compõem os saldos, separando produção própria de revenda?'],
  logistica: ['Transportes e logística', 'Qual é a utilização da frota e a composição dos arrendamentos, renovação e contratos relevantes?'],
}
export const METRICS = [
 ['liquidity','Liquidez corrente','x','Ativo circulante / passivo circulante'],
 ['workingCapital','Capital circulante líquido','money','Ativo circulante − passivo circulante'],
 ['grossMargin','Margem bruta','%','Lucro bruto / receita líquida × 100'],
 ['netMargin','Margem líquida','%','Lucro líquido / receita líquida × 100'],
 ['ebit','EBIT calculado','money','Lucro líquido + IR/CSLL + despesas financeiras − receitas financeiras'],
 ['ebitda','EBITDA calculado','money','EBIT + depreciação, amortização e exaustão reconhecidas no resultado'],
 ['ebitdaMargin','Margem EBITDA','%','EBITDA / receita líquida × 100'],
 ['debt','Dívida financeira bruta','money','Dívida financeira de curto + longo prazo (escopo declarado)'],
 ['netDebt','Dívida líquida','money','Dívida bruta − caixa livre elegível confirmado'],
 ['debtRevenue','Dívida / receita líquida','%','Dívida no fechamento / receita líquida anual × 100'],
 ['debtEbitda','Dívida bruta / EBITDA','x','Dívida bruta / EBITDA positivo'],
 ['netDebtEbitda','Dívida líquida / EBITDA','x','Dívida líquida / EBITDA positivo'],
 ['shortShare','Dívida de curto / dívida total','%','Dívida financeira de curto / dívida financeira total × 100'],
 ['interestCover','Cobertura contábil de juros','x','EBIT / despesa de juros positiva identificada'],
 ['partialOperating','Saldo operacional parcial','money','Estoques + recebíveis comerciais − fornecedores comerciais'],
 ['ncg','Necessidade de capital de giro classificada','money','Ativos circulantes operacionais − passivos circulantes operacionais'],
 ['pmr','Prazo médio de recebimento','dias','Média entre recebíveis inicial e final / vendas a prazo compatíveis × dias do período'],
 ['pme','Prazo médio de estoque','dias','Média entre estoques inicial e final / custo das vendas compatível × dias do período'],
 ['pmp','Prazo médio de pagamento','dias','Média entre fornecedores inicial e final / compras a prazo compatíveis × dias do período'],
 ['cycle','Ciclo financeiro','dias','PMR + PME − PMP (bases compatíveis)'],
]
export const STATUSES = ['Informado','Não informado','Ilegível','Divergente','Não comparável','Não aplicável']
export function numberValue(raw) {
 if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
 if (typeof raw !== 'string' || !raw.trim() || !/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(raw.trim())) return null
 return Number(raw.trim().replaceAll('.','').replace(',','.'))
}
export function cell(raw, source = '') {
 if (raw !== null && typeof raw === 'object') {
  const status = STATUSES.includes(raw.status) ? raw.status : 'Não informado'
  return { value: status === 'Informado' ? numberValue(raw.value) : null, status, source: typeof raw.source === 'string' ? raw.source : source, original: raw.value, note: typeof raw.note === 'string' ? raw.note : '' }
 }
 const value = numberValue(raw)
 return { value, status: value === null ? 'Não informado' : 'Informado', source, original: raw, note: '' }
}
export const finite = v => typeof v === 'number' && Number.isFinite(v)
export const sum = (...values) => values.every(finite) ? values.reduce((a,b) => a+b,0) : null
export const subtract = (a,b) => finite(a) && finite(b) ? a-b : null
export const ratio = (a,b,scale=1) => finite(a) && finite(b) && b>0 ? a/b*scale : null
export function change(previous,current) {
 return { absolute: subtract(current,previous), percent: finite(previous)&&previous>0&&finite(current)&&current>=0 ? (current/previous-1)*100 : null }
}
export function blankAnalysis() {
 const end = new Date().getFullYear()-1
 return { version:1, company:'', activity:'', sector:'geral', currency:'BRL', unit:'1', perimeter:'individual', debtScope:'', monthlyBasis:'grossRevenue', inference:false, years:[end-2,end-1,end].map(year=>({year,source:'',fullYear:true,compatible:false,days:year%4===0&&(year%100!==0||year%400===0)?366:365,values:{},monthly:Array(12).fill('')})), opening:{}, debts:[], benchmarks:[], answers:{} }
}
export function validDate(date) {
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
 const parsed=new Date(date+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date
}
function record(value) { return value!==null&&typeof value==='object'&&!Array.isArray(value) }
function textFields(recordValue,fields,required=[]) {
 for(const key of fields) if((recordValue[key]!==undefined||required.includes(key))&&typeof recordValue[key]!=='string') throw new Error(`O campo ${key} deve ser texto.`)
}
function booleanFields(recordValue,fields) {
 for(const key of fields) if(recordValue[key]!==undefined&&typeof recordValue[key]!=='boolean') throw new Error(`O campo ${key} deve ser verdadeiro ou falso.`)
}
function validateCell(raw) {
 if(raw!==null&&typeof raw==='object') {
  if(!record(raw)||!STATUSES.includes(raw.status)) throw new Error('Célula com estado inválido. Use os estados indicados no modelo.')
  textFields(raw,['source','note'])
 }
 const content=record(raw)?raw.value:raw
 if(content!==null&&content!==undefined&&content!==''&&content!=='-'&&numberValue(content)===null) throw new Error('Valor inválido. No JSON, use números ou texto brasileiro como 1.234,56; não use fórmulas.')
}
export function validateInput(input) {
 if (!record(input)||input.version!==1) throw new Error('Use o modelo JSON versão 1 disponibilizado nesta tela.')
 textFields(input,['company','activity','sector','debtScope'],['company','activity','sector','debtScope'])
 booleanFields(input,['inference','debtsComparable'])
 if(!Object.hasOwn(SECTORS,input.sector)) throw new Error('Setor desconhecido. Selecione um módulo disponível ou Geral.')
 if (!Array.isArray(input.years)||input.years.length!==3) throw new Error('Informe exatamente três exercícios.')
 if (!['BRL','USD','EUR'].includes(input.currency)||!['1','1000','1000000'].includes(String(input.unit))) throw new Error('Moeda ou unidade não reconhecida.')
 if (!['individual','consolidado'].includes(input.perimeter)) throw new Error('Identifique a base individual ou consolidada.')
 if (!['grossRevenue','revenue'].includes(input.monthlyBasis)) throw new Error('Identifique a base bruta ou líquida do faturamento mensal.')
 const years=input.years.map(y=>y?.year)
 if (years.some(y=>!Number.isInteger(y)||y<1900||y>2200)||new Set(years).size!==3||years.some((y,i)=>i>0&&y!==years[i-1]+1)) throw new Error('Os exercícios devem ser três anos consecutivos, em ordem crescente.')
 for (const y of input.years) {
  if (!record(y)||!record(y.values)||!Array.isArray(y.monthly)||y.monthly.length!==12) throw new Error(`Confira os valores e os 12 meses de ${y.year}.`)
  if (!Number.isInteger(y.days)||y.days<1||y.days>366||typeof y.fullYear!=='boolean'||typeof y.compatible!=='boolean'||typeof y.source!=='string') throw new Error(`Confira período, fonte e compatibilidade de ${y.year}.`)
  const known = new Set(FIELDS.map(f=>f[0]))
  if (Object.keys(y.values).some(key=>!known.has(key))) throw new Error('Conta desconhecida: use os códigos do modelo. Mantenha contas adicionais no documento de origem para conferência.')
  for (const raw of [...Object.values(y.values),...y.monthly]) validateCell(raw)
 }
 if(input.opening!==undefined) {
  if(!record(input.opening)||Object.keys(input.opening).some(key=>!['receivables','inventory','suppliers'].includes(key))) throw new Error('Saldos de abertura devem conter somente recebíveis, estoques e fornecedores.')
  Object.values(input.opening).forEach(validateCell)
 }
 if(input.answers!==undefined) {
  if(!record(input.answers)||Object.values(input.answers).some(value=>typeof value!=='string')) throw new Error('Respostas devem ser um mapa de textos.')
 }
 if (!Array.isArray(input.debts)||input.debts.length>200||!Array.isArray(input.benchmarks)||input.benchmarks.length>100) throw new Error('Limite de 200 contratos e 100 referências por análise.')
 for (const d of input.debts) {
  if (!record(d)||typeof d.id!=='string'||typeof d.currency!=='string'||!validDate(d.date)||!Array.isArray(d.schedule)||d.schedule.length>1200) throw new Error('Contrato inválido: informe ID, moeda, data-base e cronograma (lista vazia quando ausente; até 1.200 parcelas).')
  textFields(d,['creditor','modality','maturity','indexer','rate','guarantee','source','purpose','covenants'])
  validateCell(d.amount)
  for(const p of d.schedule) {
   if(!record(p)||typeof p.date!=='string') throw new Error('Parcela inválida: informe um objeto com data e valor de principal.')
   textFields(p,['source','note']);validateCell(p.amount)
  }
 }
 for (const b of input.benchmarks) {
  if (!record(b)||!METRICS.some(m=>m[0]===b.metric)||!Number.isInteger(b.year)||typeof b.name!=='string'||typeof b.source!=='string'||typeof b.method!=='string') throw new Error('Referência inválida. Confira indicador, exercício, nome, método e fonte.')
  textFields(b,['consultedAt','limitations','currency','perimeter']);booleanFields(b,['comparable']);validateCell(b.value)
  if(b.unit!==undefined&&!['1','1000','1000000'].includes(String(b.unit))) throw new Error('Unidade da referência inválida.')
  if(b.consultedAt&&!validDate(b.consultedAt)) throw new Error('Data de consulta da referência inválida.')
 }
 return input
}
const SIGNED_FIELDS=new Set(['netProfit','grossProfit','equity','tax','operatingCashFlow'])
function accountCell(key,raw,source='') {
 const c=cell(raw,source)
 if(finite(c.value)&&c.value<0&&!SIGNED_FIELDS.has(key)) {c.value=null;c.status='Divergente';c.note='Valor negativo em conta de natureza não negativa; confirme sinal e classificação.'}
 return c
}
export function formatValue(value,unit='money') {
 if (!finite(value)) return 'Não calculável'
 return `${value.toLocaleString('pt-BR',{minimumFractionDigits:unit==='money'?2:unit==='x'?2:1,maximumFractionDigits:unit==='money'?2:unit==='x'?2:1})}${unit==='%'?'%':unit==='x'?'×':unit==='dias'?' dias':''}`
}
function computeYear(y, previous, data) {
 const entries=Object.fromEntries(FIELDS.map(([key])=>[key,accountCell(key,y.values[key],y.source)]))
 const v=Object.fromEntries(Object.entries(entries).map(([key,c])=>[key,c.value]))
 const m={}
 m.liquidity=ratio(v.currentAssets,v.currentLiabilities)
 m.workingCapital=subtract(v.currentAssets,v.currentLiabilities)
 m.grossMargin=y.fullYear?ratio(v.grossProfit,v.revenue,100):null
 m.netMargin=y.fullYear?ratio(v.netProfit,v.revenue,100):null
 m.ebit=y.fullYear?subtract(sum(v.netProfit,v.tax,v.financialExpense),v.financialIncome):null
 m.ebitda=sum(m.ebit,v.depreciation)
 m.ebitdaMargin=ratio(m.ebitda,v.revenue,100)
 m.debt=data.debtScope.trim()?sum(v.shortDebt,v.longDebt):null
 m.netDebt=subtract(m.debt,v.eligibleCash)
 m.debtRevenue=y.fullYear?ratio(m.debt,v.revenue,100):null
 m.debtEbitda=ratio(m.debt,m.ebitda)
 m.netDebtEbitda=ratio(m.netDebt,m.ebitda)
 m.shortShare=ratio(v.shortDebt,m.debt,100)
 m.interestCover=ratio(m.ebit,v.interest)
 m.partialOperating=subtract(sum(v.inventory,v.receivables),v.suppliers)
 m.ncg=subtract(v.operatingAssets,v.operatingLiabilities)
 const p=key=>accountCell(key,previous ? previous.values?.[key] : data.opening?.[key]).value
 for (const [metric,key,denominator] of [['pmr','receivables','creditSales'],['pme','inventory','cost'],['pmp','suppliers','creditPurchases']]) m[metric]=y.compatible&&y.fullYear?ratio(finite(p(key))&&finite(v[key])?(p(key)+v[key])/2:null,v[denominator],y.days):null
 m.cycle=subtract(sum(m.pmr,m.pme),m.pmp)
 const monthly=y.monthly.map(c=>cell(c,y.source)), complete=monthly.every(c=>finite(c.value))
 const observed=monthly.filter(c=>finite(c.value))
 const monthlyTotal=complete?sum(...monthly.map(c=>c.value)):null
 const monthlyChanges=monthly.map((c,i)=>change(i?monthly[i-1].value:cell(previous?.monthly?.[11]).value,c.value))
 const monthlyShares=monthly.map(c=>ratio(c.value,monthlyTotal,100))
 const quarters=Array.from({length:4},(_,i)=>sum(...monthly.slice(i*3,i*3+3).map(c=>c.value)))
 const semesters=Array.from({length:2},(_,i)=>sum(...monthly.slice(i*6,i*6+6).map(c=>c.value)))
 return {...y,entries,v,m,monthly,monthlyTotal,monthlyChanges,monthlyShares,quarters,semesters,monthlyCount:observed.length,monthlyPartial:observed.length?sum(...observed.map(c=>c.value)):null,monthlyAverage:observed.length?sum(...observed.map(c=>c.value))/observed.length:null,balanceResidual:subtract(v.assets,sum(v.currentLiabilities,v.longLiabilities,v.equity)),grossResidual:subtract(v.grossProfit,subtract(v.revenue,v.cost)),monthlyResidual:y.fullYear?subtract(monthlyTotal,v[data.monthlyBasis]):null}
}
function analyseDebt(debts) {
 const groups=Object.create(null), warnings=[], ids=new Map()
 for(const d of debts) ids.set(d.id,(ids.get(d.id)||0)+1)
 for (const d of debts) {
  const amount=cell(d.amount).value
  if (!d.id.trim()||ids.get(d.id)>1) {warnings.push(`Contrato ${d.id||'sem ID'}: identidade ausente ou duplicada; excluído dos totais até esclarecimento.`);continue}
  if (!finite(amount)||amount<0||!d.currency.trim()) {warnings.push(`Contrato ${d.id}: saldo ou moeda não informado/ inválido; excluído dos totais.`);continue}
  const key=`${d.date} · ${d.currency}`
  groups[key]??={amount:0,count:0,byCreditor:Object.create(null),byModality:Object.create(null),byIndexer:Object.create(null),scheduled:0,buckets:{'Vencidos':0,'Até 12 meses':0,'13 a 24 meses':0,'25 a 36 meses':0,'Acima de 36 meses':0},unscheduled:0}
  const g=groups[key];g.amount+=amount;g.count++
  for (const [field,target] of [['creditor','byCreditor'],['modality','byModality'],['indexer','byIndexer']]) {const label=typeof d[field]==='string'&&d[field].trim()?d[field]:'Não informado';g[target][label]=(g[target][label]||0)+amount}
  if (!d.schedule.length) {g.unscheduled+=amount;warnings.push(`Contrato ${d.id}: falta cronograma de amortização. Vencimento final ${d.maturity||'não informado'} não distribui o saldo por parcelas.`)}
  else if (d.schedule.some(p=>!finite(cell(p.amount).value)||!validDate(p.date)||cell(p.amount).value<0)) {g.unscheduled+=amount;warnings.push(`Contrato ${d.id}: cronograma incompleto; não consolidado. Saldo inteiro mantido sem cronograma válido.`)}
  else {
   const scheduled=d.schedule.reduce((s,p)=>s+cell(p.amount).value,0);g.scheduled+=scheduled
   for(const p of d.schedule) {
    const months=(Number(p.date.slice(0,4))-Number(d.date.slice(0,4)))*12+Number(p.date.slice(5,7))-Number(d.date.slice(5,7))+(p.date.slice(8)>d.date.slice(8)?1:0)
    const bucket=p.date<d.date?'Vencidos':months<=12?'Até 12 meses':months<=24?'13 a 24 meses':months<=36?'25 a 36 meses':'Acima de 36 meses'
    g.buckets[bucket]+=cell(p.amount).value
   }
   if(Math.abs(scheduled-amount)>1e-9) warnings.push(`Contrato ${d.id}: principal no cronograma (${formatValue(scheduled)}) difere do saldo (${formatValue(amount)}); conciliar sem ajustar valores.`)
  }
 }
 return {groups,warnings}
}
export function analyseBalance(raw) {
 const data=validateInput(raw), years=data.years.map((y,i)=>computeYear(y,data.years[i-1],data))
 const questions=[], findings=[], limitations=[]
 const addQuestion=(theme,observation,text,needed)=>{const existing=questions.find(q=>q.theme===theme&&q.text===text);if(existing){existing.observation+=`; ${observation}`;return existing.id}const id=`Q${questions.length+1}`;questions.push({id,theme,observation,text,needed,answer:''});return id}
 if (!data.company.trim()) limitations.push('Identificação não informada: relatório sem atribuição a uma empresa.')
 if (!data.activity?.trim()) addQuestion('Atividade','Atividade não descrita','Qual é a atividade e a composição da receita por segmento?','Descrição e receita por segmento')
 if (!data.debtScope.trim()) {limitations.push('Escopo da dívida não declarado: indicadores de dívida bloqueados.');addQuestion('Dívida','Escopo não declarado','Quais obrigações estão incluídas na dívida financeira, incluindo arrendamentos, partes relacionadas e antecipações?','Escopo conciliado dos saldos')}
 for (const y of years) {
  if (!y.source.trim()) limitations.push(`${y.year}: fonte documental não informada; cálculos a conferir na origem.`)
  if (!y.fullYear) limitations.push(`${y.year}: período parcial; comparações anuais de fluxos e prazos bloqueadas.`)
  if (!y.compatible) limitations.push(`${y.year}: compatibilidade entre contas e bases dos prazos médios não confirmada; PMR, PME e PMP bloqueados.`)
  const uncertain=Object.entries(y.entries).filter(([,c])=>['Divergente','Ilegível','Não comparável'].includes(c.status))
  for (const [key,c] of uncertain) {limitations.push(`${y.year} · ${FIELDS.find(f=>f[0]===key)[1]}: ${c.status}; cálculos dependentes bloqueados.`);addQuestion('Fonte',`${y.year}: ${key} ${c.status}`,`Qual documento e valor devem ser usados para ${FIELDS.find(f=>f[0]===key)[1]} em ${y.year}?`,'Documento identificado e conciliação')}
  if (finite(y.balanceResidual)&&Math.abs(y.balanceResidual)>1e-9) {limitations.push(`${y.year}: resíduo do balanço ${formatValue(y.balanceResidual)} na unidade declarada; não ajustado.`);addQuestion('Conciliação',`Balanço ${y.year}: resíduo ${formatValue(y.balanceResidual)}`,'Como conciliar ativo, passivos exigíveis e patrimônio líquido? Há precisão publicada ou reclassificações documentadas?','Balanço completo, precisão e conciliação')}
  if(finite(y.grossResidual)&&Math.abs(y.grossResidual)>1e-9) addQuestion('DRE',`Lucro bruto ${y.year}: diferença ${formatValue(y.grossResidual)}`,'Como conciliar receita líquida, custo das vendas e lucro bruto?','DRE e classificação de custos')
  if(y.monthlyCount!==12) addQuestion('Faturamento',`${y.year}: ${y.monthlyCount}/12 meses informados`,'Quais são os valores e fontes dos meses ausentes?','Faturamento mensal completo')
  if(finite(y.monthlyResidual)&&Math.abs(y.monthlyResidual)>1e-9) addQuestion('Faturamento',`${y.year}: soma mensal menos DRE = ${formatValue(y.monthlyResidual)}`,'Como conciliar as bases de faturamento mensal e DRE, incluindo deduções e escopo?','Conciliação das bases, sem presumir erro')
 }
 for(let i=1;i<years.length;i++) {
  const a=years[i-1],b=years[i]
  if(!a.fullYear||!b.fullYear) continue
  const revenue=change(a.v.revenue,b.v.revenue)
  for(const [key,label,question,need] of [['debt','Dívida financeira','Como evoluíram vencimentos, encargos e geração de caixa?','Cronogramas, encargos e DFC'],['receivables','Recebíveis','Qual é a composição dos recebíveis por vencimento e quais condições comerciais foram praticadas?','Idade dos recebíveis e condições comerciais'],['inventory','Estoques','Qual é a composição e o tempo sem movimentação dos estoques no encerramento?','Composição e idade dos estoques'],['suppliers','Fornecedores','Como evoluíram compras, condições contratadas e valores vencidos?','Compras e composição de fornecedores']]) {
   const old=key==='debt'?a.m.debt:a.v[key],now=key==='debt'?b.m.debt:b.v[key],c=change(old,now)
   if(!finite(c.absolute)||!finite(revenue.absolute)) continue
   const text=`${a.year} → ${b.year}: ${label} ${formatValue(old)} → ${formatValue(now)} (Δ ${formatValue(c.absolute)}${finite(c.percent)?`; ${formatValue(c.percent,'%')}`:''}); receita líquida ${formatValue(a.v.revenue)} → ${formatValue(b.v.revenue)}${finite(revenue.percent)?` (${formatValue(revenue.percent,'%')})`:''}.${finite(c.percent)&&finite(revenue.percent)?` Diferença de crescimento: ${formatValue(c.percent-revenue.percent)} p.p.`:''}`
   const q=addQuestion(label,text,question,need)
   let inference=''
   if(key==='debt'&&(!finite(a.balanceResidual)||Math.abs(a.balanceResidual)<1e-9)&&(!finite(b.balanceResidual)||Math.abs(b.balanceResidual)<1e-9)&&finite(a.m.debtRevenue)&&finite(b.m.debtRevenue)&&a.m.debtRevenue!==b.m.debtRevenue) inference=`${b.m.debtRevenue>a.m.debtRevenue?'Maior':'Menor'} peso relativo da dívida sobre a receita; isoladamente, não confirma mudança na capacidade de pagamento.`
   findings.push({text,question:q,inference,priority:key==='debt'?2:1,year:b.year,source:`${a.source||'Fonte não informada'}; ${b.source||'Fonte não informada'}`})
  }
 }
 const additionalCrossings=[]
 for(let i=1;i<years.length;i++) {
  const a=years[i-1],b=years[i]
  if(!a.fullYear||!b.fullYear) continue
  for(const [label,old,now,otherLabel,otherOld,otherNow,question] of [
   ['Despesas operacionais',a.v.expenses,b.v.expenses,'receita líquida',a.v.revenue,b.v.revenue,'Qual é a composição de custos e despesas por natureza e quais reclassificações explicam a comparação entre exercícios?'],
   ['Custo das vendas',a.v.cost,b.v.cost,'receita líquida',a.v.revenue,b.v.revenue,'Qual é a composição de custos e despesas por natureza e quais reclassificações explicam a comparação entre exercícios?'],
   ['Lucro líquido',a.v.netProfit,b.v.netProfit,'patrimônio líquido',a.v.equity,b.v.equity,'Qual é a conciliação do patrimônio líquido, com resultados, aportes, distribuições e demais movimentações documentadas?'],
   ['Imobilizado líquido',a.v.fixedAssets,b.v.fixedAssets,'dívida financeira',a.m.debt,b.m.debt,'Quais aquisições, baixas, depreciações e movimentações da dívida foram documentadas, sem presumir vínculo entre elas?'],
   ['Lucro líquido',a.v.netProfit,b.v.netProfit,'fluxo operacional informado',a.v.operatingCashFlow,b.v.operatingCashFlow,'Como a DFC concilia o resultado e as variações operacionais nos exercícios informados?'],
  ]) {
   if(![old,now,otherOld,otherNow].every(finite))continue
   const text=`${a.year} → ${b.year}: ${label} ${formatValue(old)} → ${formatValue(now)}; ${otherLabel} ${formatValue(otherOld)} → ${formatValue(otherNow)}. Variações conjuntas não demonstram causalidade.`
   additionalCrossings.push({text,question:addQuestion(label,text,question,'Abertura e conciliação documental')})
  }
  for(const [key,label] of [['grossMargin','Margem bruta'],['netMargin','Margem líquida'],['ebitdaMargin','Margem EBITDA']])if(finite(a.m[key])&&finite(b.m[key]))additionalCrossings.push({text:`${a.year} → ${b.year}: ${label} ${formatValue(a.m[key],'%')} → ${formatValue(b.m[key],'%')}; diferença ${formatValue(b.m[key]-a.m[key])} p.p.`,question:null})
 }
 const debt=analyseDebt(data.debts)
 if(!data.debts.length) addQuestion('Endividamento aberto','Detalhamento não informado','Qual é a posição da dívida por contrato, data-base, moeda, saldo, indexador e amortizações?','Mapa de endividamento')
 for(const warning of debt.warnings) addQuestion('Contrato',warning,'Qual informação documentada esclarece esta lacuna do contrato?','Contrato e cronograma')
 if(years.some(y=>!finite(y.m.pmp))) addQuestion('Prazos médios','PMP ou ciclo financeiro não calculável','Quais são as compras a prazo e os saldos inicial e final de fornecedores compatíveis?','Compras a prazo, saldos e bases; CMV não é substituto')
 if(years.some(y=>!finite(y.m.ebitda))) addQuestion('Resultado','EBITDA não calculável em pelo menos um exercício','Qual é a composição de IR/CSLL, resultado financeiro e depreciação, amortização e exaustão reconhecidas no resultado?','DRE e notas; não depreciação acumulada')
 const sector=SECTORS[data.sector]||SECTORS.geral
 addQuestion('Setor',sector[0],sector[1],'Abertura documental pertinente ao setor informado')
 const debtReconciliations=years.map(y=>{
  const g=debt.groups[`${y.year}-12-31 · ${data.currency}`]
  const comparable=data.debtsComparable===true&&g&&data.debtScope.trim()&&finite(y.m.debt)
  return {year:y.year,date:`${y.year}-12-31`,currency:data.currency,detail:g?.amount??null,balance:finite(y.m.debt)?y.m.debt*Number(data.unit):null,difference:comparable?subtract(g.amount,y.m.debt*Number(data.unit)):null}
 })
 for(const r of debtReconciliations) if(finite(r.difference)&&Math.abs(r.difference)>1e-9) addQuestion('Conciliação de dívida',`${r.date}: abertura − balanço = ${formatValue(r.difference)} ${r.currency} em unidades`,'Quais contratos ou reclassificações conciliam a abertura com o balanço na mesma data e escopo?','Mapa completo e conciliação')
 const benchmarks=data.benchmarks.map(b=>{
  const metric=METRICS.find(m=>m[0]===b.metric),actual=years.find(y=>y.year===b.year)?.m[b.metric]??null,value=cell(b.value).value
  const comparable=b.comparable===true&&b.method===metric[3]&&/^https?:\/\//.test(b.source)&&!!b.consultedAt&&!!b.limitations&&b.currency===data.currency&&String(b.unit)===String(data.unit)&&b.perimeter===data.perimeter
  return {...b,actual,value,metricLabel:metric[1],format:metric[2],difference:comparable?subtract(actual,value):null,comparable}
 })
 limitations.push('Análise determinística dos campos informados. Sem leitura automática de PDF/imagem, pesquisa de referências ou auditoria dos documentos originais. EBITDA não é fluxo de caixa. Três exercícios não sustentam correlação estatística nem previsão.')
 return {data,years,questions,additionalCrossings,findings:findings.sort((a,b)=>b.year-a.year||b.priority-a.priority),limitations,debt,debtReconciliations,benchmarks,sector}
}
export function sampleAnalysis() {
 const d=blankAnalysis();d.company='Exemplo sintético — não é empresa real';d.activity='Distribuição de mercadorias';d.sector='comercio';d.debtScope='Empréstimos e financiamentos usados; sem limites disponíveis';
 d.years.forEach((y,i)=>{y.source='Exemplo sintético, tabela de teste';y.compatible=true;y.values={grossRevenue:[100,112,126][i],revenue:[100,112,126][i],netProfit:[-10,5,8][i],shortDebt:[8,10,12][i],longDebt:[12,17,18][i],receivables:[10,13,14][i],inventory:[15,17,16][i],suppliers:[8,10,12][i],currentAssets:[30,38,40][i],currentLiabilities:[15,20,24][i]};y.monthly=Array(12).fill(y.values.grossRevenue/12)});return d
}

export function annualCsv(data) {
 return ['conta;'+data.years.map(y=>y.year).join(';'),...FIELDS.map(([key])=>[key,...data.years.map(y=>{const v=cell(y.values[key]).value;return finite(v)?String(v).replace('.',','):''})].join(';'))].join('\n')
}
export function importAnnualCsv(text,data) {
 const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(line=>line.split(';'))
 if(rows[0].join(';')!==`conta;${data.years.map(y=>y.year).join(';')}`) throw new Error('Cabeçalho CSV diferente dos três exercícios selecionados. Baixe o modelo desta tela.')
 const seen=new Set(),known=new Set(FIELDS.map(f=>f[0])),years=data.years.map(y=>({...y,values:{...y.values}}))
 for(const [key,...values] of rows.slice(1)) {
  if(!known.has(key)||seen.has(key)||values.length!==3) throw new Error('CSV com conta desconhecida, repetida ou número de colunas diferente de quatro.')
  seen.add(key)
  values.forEach((value,i)=>{if(value.trim()&&value.trim()!=='-'&&numberValue(value)===null) throw new Error(`Valor inválido em ${key}. Use vírgula decimal.`);years[i].values[key]=value.trim()})
 }
 return validateInput({...data,years})
}
