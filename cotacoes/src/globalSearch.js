import { APP_SECTIONS } from './appSections.js'
import { inNewsWindow, recentNews } from './newsWindow.js'
import { GROUPS } from './moedas.js'
import { creditStats } from './inadimplencia.js'
// Pesquisa local: não lê campos, armazenamento pessoal ou páginas de terceiros.
export const normalizeSearch = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
export const SEARCH_SECTIONS = Object.fromEntries(APP_SECTIONS.filter(section => !section.oculto || section.id === 'calculadora').map(({ id, label }) => [id, label]))
export const SEARCH_SOURCES = [
  ['quotes.json','resumo','Cotações de câmbio'], ['history.json','resumo','Histórico de câmbio'], ['intraday.json','resumo','Câmbio intradiário'],
  ['macro.json','juros','Juros e projeções'], ['curves.json','juros','Curvas de juros'], ['curves-history.json','juros','Histórico das curvas'],
  ['news.json','noticias','Manchetes'], ['temas.json','resumo','Notícias por tema'], ['reforma-tributaria.json','resumo','Reforma tributária'],
  ['focus-history.json','cenarios/projecoes','Histórico semanal do Focus'], ['cenarios.json','cenarios/projecoes','Projeções por instituição'], ['projecoes.json','cenarios/projecoes','Projeções'],
  ['heavy-vehicles.json','setores/veiculos-pesados','Veículos pesados — ANFAVEA'], ['calendar.json','cenarios/calendario','Calendário econômico'], ['inadimplencia.json','cenarios/inadimplencia','Inadimplência PF e PJ'],
  ['market-indicators.json','cenarios/atividade','Atividade e emprego'], ['indicator-history.json','cenarios/atividade','Histórico de atividade'],
  ['commodities.json','cenarios/commodities','Commodities'], ['commodities-brl.json','cenarios/commodities','Commodities em reais'],
  ['oil.json','cenarios/commodities','Petróleo Brent'], ['fuels.json','cenarios/commodities','Combustíveis'],
  ['freight.json','cenarios/frete','Frete marítimo'], ['freight-jp.json','cenarios/frete','Frete marítimo do Japão'],
  ['ipca.json','cenarios/inflacao','IPCA'], ['ipca-groups.json','cenarios/inflacao','IPCA por grupos'], ['divida.json','cenarios/fiscal','Dívida bruta'],
  ['indexadores.json','cenarios/indexadores','Indexadores'], ['bndes.json','bndes','Taxas do BNDES'], ['moedas.json','bndes/moedas','Moedas contratuais'],
  ['policy-rates.json','juros','Taxas dos bancos centrais'], ['estr.json','juros','Taxa €STR'], ['euro-curve.json','juros','Curva de juros do euro'],
  ['feriados.json','feriados','Feriados'], ['recado.json','resumo','Recado publicado'], ['insumos-precos.json','setores/cobre','Preços de insumos'], ['indices.json','resumo','Índices de mercado'],
]
const OMIT = /^(?:source|sources|fonte|fontes|route|rota|link|url|sourceUrl|sourceURL|api|pagina|error|stack|trace|token|password|secret|id|key|code|schemaVersion|schema|generatedAt|updatedAt|checkedAt|lastSuccessAt|t)$/i
export function plainContent(value, key = '') {
  if (key==='t' && typeof value==='number' && Number.isFinite(value) && value>0) return new Date(value).toISOString()
  if (/token|password|secret|session|email/i.test(key) || OMIT.test(key) || value == null || typeof value === 'boolean') return ''
  if (typeof value === 'string') return /^https?:|^data:|^<svg/i.test(value) ? '' : value
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString('pt-BR', { maximumFractionDigits: 6 }) : ''
  if (Array.isArray(value)) return value.map(v => plainContent(v)).filter(Boolean).join(' · ')
  if (typeof value === 'object') return Object.entries(value).filter(([k])=>k!=='t' || !(value.period || value.date || value.d)).map(([k,v]) => plainContent(v,k)).filter(Boolean).join(' · ')
  return ''
}
export function makeSearchDoc({ id, title, body, route, ...rest }) {
  return { id, title, body, route, section:SEARCH_SECTIONS[route.split('/')[0]] || 'Painel', ...rest, normalized:normalizeSearch(title + ' ' + body), titleNormalized:normalizeSearch(title) }
}
export const isNewsSearchFile = file => ['news.json', 'temas.json', 'reforma-tributaria.json'].includes(file)
// Keep structured publication data with each selected result, not only a frozen
// text snippet. A topic/currency body can contain several independently expiring items.
function currentNewsNode(node, now) {
  if (Array.isArray(node)) {
    const items = recentNews(node, now)
    return items.length ? items : null
  }
  if (Array.isArray(node?.items)) {
    const items = recentNews(node.items, now)
    return items.length ? { ...node, items } : null
  }
  return inNewsWindow(node?.t, now) ? node : null
}
export function currentSearchDocument(doc, now = Date.now()) {
  if (!doc || !isNewsSearchFile(doc.file)) return doc
  const newsNode = currentNewsNode(doc.newsNode, now)
  // Legacy selected news without publication metadata fail closed. stamp is a
  // file-generation time and must never be used as the article's publication.
  return newsNode ? makeSearchDoc({ ...doc, body: plainContent(newsNode), newsNode }) : null
}
// Prune before recursive indexing: parent bodies must not retain expired headlines.
function currentSearchNews(file, data, now) {
  if (file === 'news.json') return { generatedAt: data.generatedAt, news: Object.fromEntries(Object.entries(data.news ?? {}).map(([code, items]) => [code, recentNews(items, now)])) }
  if (file === 'temas.json') return { generatedAt: data.generatedAt, temas: Object.fromEntries(Object.entries(data.temas ?? {}).filter(([, topic]) => topic && typeof topic === 'object').map(([id, topic]) => [id, { label: topic.label, grupo: topic.grupo, items: recentNews(topic.items, now) }])) }
  return { generatedAt: data.generatedAt, items: recentNews(data.items, now) }
}
// Named records retain their own context, route and snapshot. No HTML is interpreted.
export function indexSearchData(file, data, route, label, now = Date.now()) {
  if (!SEARCH_SECTIONS[route.split('/')[0]]) return {docs:[],limited:false}
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Formato indisponível')
  if (isNewsSearchFile(file)) data = currentSearchNews(file, data, now)
  const docs = [], stamp = data.generatedAt || data.updatedAt || null
  if(file==='focus-history.json' && data.series) {
    for(const [indicator,byYear] of Object.entries(data.series))for(const [year,points] of Object.entries(byYear))docs.push(makeSearchDoc({id:`${file}:${indicator}:${year}`,title:`Focus · ${indicator} · referência ${year}`,context:{year},body:`Histórico semanal da mediana do Focus para ${indicator}, ano de referência ${year}. `+plainContent(points.slice().reverse()),route,file,stamp,kind:'Dado publicado'}))
    return {docs,limited:false}
  }
  if(file==='inadimplencia.json'  && Array.isArray(data.series)) {
    for(const s of data.series) {
      const stats=creditStats(s.points), person=s.person==='PF'?'Pessoa física':'Pessoa jurídica', portfolio={total:'Total',livres:'Recursos livres',direcionados:'Recursos direcionados'}[s.type] || s.type
      const fmt=v=>v==null?'indisponível':v.toLocaleString('pt-BR',{maximumFractionDigits:2})
      const body=`Inadimplência de ${person.toLowerCase()} na carteira ${portfolio}: ${fmt(stats.last?.v)}% em ${stats.last?.period || 'referência indisponível'}. Variação no mês: ${fmt(stats.month)} p.p.; em 12 meses: ${fmt(stats.year)} p.p. Histórico mensal: ${(s.points || []).slice().reverse().map(p=>`${p.period}: ${fmt(p.v)}%`).join(' · ')}`
      docs.push(makeSearchDoc({id:file+':'+s.key,title:`Inadimplência · ${person} · ${portfolio}`,body,route,file,stamp,kind:'Dado publicado',context:{creditType:s.type}}))
    }
    return {docs,limited:false}
  }
  let visited = 0, limited = false
  const walk = (node, path = [], inherited = label) => {
    if (++visited > 60000 || path.length > 25) { limited = true; return }
    if (!node || typeof node !== 'object') return
    const currency = path.find(p=>/^(USD|EUR|JPY|CNH|CNY|EURUSD)$/.test(p))
    const seriesId = path.length===2 && path[0]==='series' ? path[1] : node.id
    const currencyMeta = file==='moedas.json' && seriesId ? [...GROUPS.tfc,...GROUPS.moedas].find(s=>s.id===seriesId) : null
    const domainTitle = file==='macro.json' && path.length===1 ? ({selic:'Meta Selic',cdi:'CDI',sofr:'SOFR',sofrAvg:'Médias da SOFR',ptax:'PTAX'})[path[0]] : file==='bndes.json' && seriesId ? `TFB ${seriesId} · prazo ${node.prazo} meses · liberação em ${node.liberacao} dias` : file==='bndes.json' && path.join('/')==='tlp' ? 'TLP - parcela prefixada' : currencyMeta?.name || (file==='policy-rates.json' && seriesId ? ({FED:'Federal Reserve (Fed)',ECB:'Banco Central Europeu (BCE)',BOE:'Banco da Inglaterra (BoE)',BOJ:'Banco do Japão (BoJ)'})[seriesId] || seriesId : null)
    const title = node.title || node.nome || node.label || node.name || node.subject || domainTitle || (currency && path.at(-1)===currency ? ({USD:'Dólar americano',EUR:'Euro',JPY:'Iene japonês',CNH:'Yuan offshore',CNY:'Yuan',EURUSD:'Paridade EUR/USD'}[currency]) : null)
    let target = route
    if (file === 'temas.json') { const tema = path.find(p => /^(industria|comercio|servicos|telecom|veiculos-pesados|cobre|aluminio|aco|minerio|petroleo)$/.test(p)); if (tema) target = 'setores/' + tema }
    if (file === 'macro.json' && path.includes('focus')) target = 'cenarios/projecoes'
    if (file === 'moedas.json' && seriesId) target = `bndes/${/^C\d/.test(seriesId) ? 'tfc' : 'moedas'}/${encodeURIComponent(seriesId)}`
    if (file === 'bndes.json' && seriesId) target = `bndes/tfb/${encodeURIComponent(seriesId)}`
    if (file==='bndes.json' && path.join('/')==='tlp')target='bndes/tlp/TLP'
    if (typeof title === 'string' && title.trim()) {
      const newsNode = isNewsSearchFile(file) ? currentNewsNode(node, now) : null
      const body = isNewsSearchFile(file) ? (newsNode ? plainContent(newsNode) : '') : plainContent(node)
      if (body) docs.push(makeSearchDoc({ id:file+':'+path.join('/'), title:title.slice(0,200), body, route:target, file, stamp, kind:'Dado publicado', ...(newsNode ? { newsNode } : {}), context:file==='reforma-tributaria.json'?{newsTab:'reforma'}:file==='temas.json' && target==='resumo'?{newsTab:path.includes('eleicoes-eua')?'eleicoes':'moedas'}:undefined }))
      if(Array.isArray(node.points))return
    }
    const entries = Array.isArray(node) ? node.map((v,i)=>[String(i),v]) : Object.entries(node)
    for (const [k,v] of entries) if (!OMIT.test(k) && v && typeof v === 'object') walk(v,[...path,k], typeof title === 'string' ? title : inherited)
  }
  walk(data)
  if (!docs.length && !isNewsSearchFile(file)) { const body=plainContent(data); if(body) docs.push(makeSearchDoc({id:file,title:label,body,route,file,stamp,kind:'Dado publicado'})); else throw new Error('Sem conteúdo pesquisável disponível') }
  return { docs, limited }
}
export function searchDocuments(docs, query) {
  const q = normalizeSearch(query).trim(), tokens = [...new Set(q.split(/\s+/).filter(Boolean))]
  if (q.length < 2) return []
  const seen=new Set()
  return docs.filter(d=>{if(!SEARCH_SECTIONS[d.route?.split('/')[0]])return false;const key=d.route+'|'+d.titleNormalized+'|'+d.body;if(seen.has(key))return false;seen.add(key);return tokens.every(t=>d.normalized.includes(t))}).map(d=>({...d, score:(d.titleNormalized === q ? 100 : d.titleNormalized.includes(q) ? 30 : 0) + tokens.filter(t=>d.titleNormalized.includes(t)).length * 5 + (d.kind==='Conceito' ? 2 : 0)})).sort((a,b)=>b.score-a.score || a.title.localeCompare(b.title,'pt-BR'))
}
export function highlightParts(text, query) {
  const tokens = [...new Set(normalizeSearch(query).trim().split(/\s+/).filter(Boolean))]
  let normalized = '', offset = 0
  const starts = [], ends = []
  for (const ch of text) { const part = normalizeSearch(ch); for (let k=0;k<part.length;k++) { normalized += part[k]; starts.push(offset); ends.push(offset+ch.length) } offset += ch.length }
  const ranges = []
  for (const token of tokens) for (let at = normalized.indexOf(token); at !== -1; at = normalized.indexOf(token, at + token.length)) ranges.push([starts[at],ends[at+token.length-1]])
  ranges.sort((a,b)=>a[0]-b[0]); const merged=[]
  for(const r of ranges) { const last=merged.at(-1); if(last && r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r.slice()) }
  const parts=[]; let at=0
  for(const [a,b] of merged) { if(a>at)parts.push({text:text.slice(at,a),match:false});parts.push({text:text.slice(a,b),match:true});at=b }
  if(at<text.length)parts.push({text:text.slice(at),match:false})
  return parts.length ? parts : [{text,match:false}]
}
export function searchSnippet(body, query, size = 220) {
  const n=normalizeSearch(body), tokens=normalizeSearch(query).trim().split(/\s+/).filter(Boolean)
  const at=Math.min(...tokens.map(t=>n.indexOf(t)).filter(i=>i>=0)), start=Number.isFinite(at) ? Math.max(0,at-60) : 0
  return (start ? '…' : '')+body.slice(start,start+size)+(start+size<body.length ? '…' : '')
}
export const isSearchShortcut = e => !e.defaultPrevented && !e.isComposing && !e.repeat && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && String(e.key).toLowerCase()==='f'
