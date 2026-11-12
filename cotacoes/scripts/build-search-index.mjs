import { readFile, writeFile } from 'node:fs/promises'
import { parse } from '@babel/parser'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
// Explicit routes prevent indexing hidden prototypes and private/transient forms.
export const SEARCH_PAGES = {
  'BndesTlpExigivel.jsx':['calculadora/bndes-tlp-exigivel','BNDES TLP exigível: projeção e cronograma'],
  'BndesCreditoTfb.jsx':['calculadora/bndes-credito-tfb','BNDES Crédito TFB: conferência do exemplo de 34 parcelas'],
  'FinameMateriais.jsx':['calculadora/finame-materiais','BNDES Finame Materiais: taxas, carência e parcelas'],
  'GoogleTrends.jsx':['resumo','Google Trends: interesse de busca, crédito, BNDES, Selic, custos e reforma tributária'],
  'ContaGarantida.jsx':['calculadora/conta-garantida','Conta Garantida: utilização, amortização, juros e IOF'],
  'OperacaoDi.jsx':['calculadora/operacao-di','Operação x DI: pré, % do CDI ou CDI + spread contra a curva DI'],
  'Emprestimo4131.jsx':['calculadora/emprestimo-4131','Empréstimo externo (4131): custo em dólar, swap para CDI e NDF'],
  'CreditComparison.jsx':['calculadora/comparador-credito','Comparador de Crédito: propostas, CET e garantias'],
  'AnaliseDesconto.jsx':['calculadora/analise-desconto','Análise de desconto: títulos e capital de giro Price'],
  'Bancos.jsx':['bancos','Bancos — Basileia, carteiras PJ e PF, provisões e inadimplência'],
  'finimpHelpContent.js':['calculadora/finimp','FINIMP: fórmulas e explicações'],
  'FinimpComparacao.jsx':['calculadora/finimp','FINIMP: comparação de propostas e atingir meta'],
  'HeavyVehicles.jsx':['setores/veiculos-pesados','Veículos pesados — ANFAVEA'],
  'Resumo.jsx':['resumo','Mercado hoje'], 'Macro.jsx':['juros','Juros e indicadores'], 'RatesSnapshot.jsx':['juros','Juros de referência'],
  'Curves.jsx':['juros','Curvas de juros'], 'CdiFuturo.jsx':['juros','CDI futuro'], 'CupomLeitura.jsx':['juros','Cupom cambial'], 'Sofr.jsx':['juros','SOFR'],
  'FocusHistorico.jsx':['cenarios/projecoes','Histórico semanal do Focus'], 'Projecoes.jsx':['cenarios/projecoes','Projeções'], 'Calendario.jsx':['cenarios/calendario','Calendário econômico'],
  'RecoveryHistoryPanel.jsx':['cenarios/recuperacao','Recuperação judicial'], 'Inadimplencia.jsx':['cenarios/inadimplencia','Inadimplência PF e PJ'], 'MarketContext.jsx':['cenarios/commodities','Commodities e atividade'],
  'Outros.jsx':['cenarios/inflacao','Inflação e fiscal'], 'Indexadores.jsx':['cenarios/indexadores','Indexadores'],
  'InflacaoPesos.jsx':['cenarios/inflacao','Inflação: o que pesa'], 'Bndes.jsx':['bndes','BNDES'], 'Setores.jsx':['setores','Setores e insumos'],
  'BndesLcdCap.jsx':['calculadora/bndes-selic-lcd','BNDES Selic capitalizada + LCD'], 'Calculadora.jsx':['calculadora/giro','Capital de Giro'], 'Feriados.jsx':['feriados','Feriados'], 'News.jsx':['noticias','Notícias'],
  'ReformaTributaria.jsx':['resumo','Notícias do Mercado'], 'Aprender.jsx':['aprender','Aprender'],
  'ConceitoDiario.jsx':['aprender','Conceito do dia'],
  'AlertaVariacao.jsx':['resumo','Alerta de variação'], 'IpcaGrupoChart.jsx':['cenarios/inflacao','IPCA por grupos'],
}
const SKIP_ATTR = new Set(['className','id','key','href','src','d','style','type','role','target','rel','name','value','fill','stroke','viewBox'])
export function extractSearchText(source) {
  const ast = parse(source, { sourceType:'module', plugins:['jsx'] }), texts=[], explain=[], byRoute={}, explainRoutes={}
  const visit = (node,parent,contextRoute='') => {
    const add=text=>{texts.push(text);(byRoute[contextRoute]??=[]).push(text)}
    if (!node || typeof node!=='object') return
    if(node.type==='ConditionalExpression' && node.test?.type==='Identifier' && node.test.name==='fiscal') { visit(node.consequent,node,'cenarios/fiscal');visit(node.alternate,node,'cenarios/inflacao');return }
    if(node.type==='LogicalExpression' && node.operator==='&&' && (node.left?.name==='fiscal' || (node.left?.type==='UnaryExpression' && node.left.argument?.name==='fiscal'))) { visit(node.right,node,node.left.name==='fiscal'?'cenarios/fiscal':'cenarios/inflacao');return }
    if(node.type==='JSXElement' && node.openingElement?.name?.name==='section') {
      const section=node.openingElement.attributes.find(a=>a.name?.name==='aria-labelledby')?.value?.value
      contextRoute=({'market-context-heading':'cenarios/atividade','commodities-context-heading':'cenarios/commodities','freight-heading':'cenarios/frete'})[section] || contextRoute
    }
    if (node.type==='ImportDeclaration'  || node.type==='CommentLine' || node.type==='CommentBlock')return
    if (node.type==='JSXAttribute' && SKIP_ATTR.has(node.name?.name))return
    if (node.type==='JSXOpeningElement' && node.name?.name==='Explain') { const id=node.attributes.find(a=>a.name?.name==='id')?.value?.value;if(id){explain.push(id);if(contextRoute)explainRoutes[id]=contextRoute} }
    if (node.type==='JSXText') { const text=node.value.replace(/\s+/g,' ').trim();if(text)add(text) }
    if (node.type==='StringLiteral' && !(parent?.type==='ObjectProperty' && parent.key===node) && !(parent?.type==='MemberExpression') && !/^https?:|^\.|^#|^[Mm][0-9]/.test(node.value) && /[\p{L}]{2,}\s+[\p{L}]{2,}/u.test(node.value))add(node.value)
    for(const [key,value] of Object.entries(node))if(!['loc','start','end','extra','comments','leadingComments','trailingComments'].includes(key)){ if(Array.isArray(value))value.forEach(v=>visit(v,node,contextRoute));else if(value && typeof value==='object')visit(value,node,contextRoute) }
  }
  visit(ast)
  return {text:[...new Set(texts)].join(' · '),explain,byRoute:Object.fromEntries(Object.entries(byRoute).map(([route,values])=>[route,[...new Set(values)].join(' · ')])),explainRoutes}
}
export async function buildSearchIndex() {
  const documents=[],glossaryRoutes={}
  for(const [file,[route,title]] of Object.entries(SEARCH_PAGES)) {
    const {text,explain,byRoute,explainRoutes}=extractSearchText(await readFile(new URL('../src/'+file,import.meta.url),'utf8'))
    if(['MarketContext.jsx','Outros.jsx'].includes(file)) {
      for(const [target,body] of Object.entries(byRoute))if(target)documents.push({id:'page:'+file+':'+target,title:({'cenarios/atividade':'Atividade e emprego','cenarios/commodities':'Commodities','cenarios/frete':'Frete marítimo','cenarios/fiscal':'Fiscal','cenarios/inflacao':'Inflação'})[target],body,route:target,kind:'Área do painel'})
    } else documents.push({id:'page:'+file,title,body:text,route,kind:'Área do painel',...(file==='GoogleTrends.jsx'?{context:{newsTab:'trends'}}:{})})
    for(const id of explain)glossaryRoutes[id]??=explainRoutes[id] || route
    if(file==='FinameMateriais.jsx')glossaryRoutes.fgi??=route // texto do glossário exibido dentro da ajuda modal, sem "?" aninhado
  }
  // Subsections with conditional JSX need their own navigable entries.
  for(const [route,title,body] of [
    ['cenarios/atividade','Atividade e emprego','Indicadores de mercado ISM indústria serviços Caged desemprego payroll'],
    ['cenarios/frete','Frete marítimo','Referência de transporte marítimo de mercadorias e Japão'],
    ['cenarios/fiscal','Fiscal','Dívida bruta do governo geral em reais e em percentual do PIB'],
  ])documents.push({id:'route:'+route,title,body,route,kind:'Área do painel'})
  return {documents,glossaryRoutes}
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const index=await buildSearchIndex()
  await writeFile(new URL('../src/searchContent.generated.json',import.meta.url),JSON.stringify(index)+'\n')
  console.log(`Busca: ${index.documents.length} áreas estáticas indexadas`)
}
