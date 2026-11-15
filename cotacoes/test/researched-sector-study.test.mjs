import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFile } from 'node:fs/promises'
import { chartScale, barPosition, transcriptText, transcriptParagraphs, durationLabel } from '../src/sectorStudies/presentation.js'
const require = createRequire(import.meta.url)
const fixture = {group:'base-florestal', topicIndex:3,title:'Compensados',summary:['Resumo verificado'],sections:[{id:'negocio',title:'Funcionamento',paragraphs:['Conteúdo específico'],columns:['Etapa','Efeito'],rows:[['Laminação','Qualidade']],sources:[{label:'IBGE',url:'https://www.ibge.gov.br'}]}],charts:[{id:'volume',title:'Volume observado',years:[2023,2024],unit:'índice',scope:'Recorte',series:[{label:'Produção',values:[100,110]}],method:'Base observada',source:{label:'IBGE',url:'https://www.ibge.gov.br'},period:'2023–2024'}],sources:[{label:'Fonte privada',url:'https://example.com',purpose:'Proveniência'},{label:'IBGE',url:'https://www.ibge.gov.br',purpose:'Dados'}],limitations:['Limite específico'],method:'Método específico',canvasQuestions:[{dimension:'Proposta de valor',question:'Qual aplicação domina as vendas?'}],diagram:{nodes:[{id:'a',label:'Toras',detail:'Matéria-prima'},{id:'b',label:'Painéis',detail:'Produto'}],edges:[{from:'a',to:'b',label:'Transformação'}]},transcript:'Síntese textual do estudo'}
async function component(entry) {
  const result = await build({entryPoints:[entry],bundle:true,write:false,jsx:'automatic',format:'cjs',platform:'node',external:['react','react-dom'],loader:{'.css':'empty'}})
  const module={exports:{}}
  runInNewContext(result.outputFiles[0].text,{module,exports:module.exports,require,URL,console,Date,Intl})
  return module.exports.default
}
test('gráficos categóricos exibem Mercado; séries históricas mantêm Ano', async () => {
  const Component = await component('src/ResearchedSectorStudy.jsx')
  const chart = { ...fixture.charts[0], categoryLabel: 'Mercado', years: ['São Paulo', 'Santiago'] }
  const html = renderToStaticMarkup(createElement(Component, { study: { ...fixture, charts: [chart] } }))
  assert.match(html, /<th scope="col">Mercado<\/th>/)
  assert.doesNotMatch(html, /<th scope="col">Ano<\/th>/)
  const historical = renderToStaticMarkup(createElement(Component, { study: fixture }))
  assert.match(historical, /<th scope="col">Ano<\/th>/)
})
test('renderer mostra pesquisa específica, Canvas, cadeia, tabela, fontes públicas e ausência honesta de áudio', async () => {
  const Component = await component('src/ResearchedSectorStudy.jsx')
  const html = renderToStaticMarkup(createElement(Component,{study:fixture}))
  for (const text of ['Resumo verificado','Qual aplicação domina as vendas?','Toras','Painéis','Transformação','Laminação','Volume observado','Limite específico','Método específico','Síntese textual do estudo','Áudio ainda não disponível para este estudo.']) assert.ok(html.includes(text),text)
  assert.doesNotMatch(html,/Fonte privada|example\.com|speechSynthesis/)
  assert.match(html,/Maximizar diagrama/)
  assert.doesNotMatch(html, /Pausar animação do diagrama|Retomar animação do diagrama/)
  assert.match(html, /aria-keyshortcuts="P"/)
})
test('áudio exige arquivo explícito e oferece velocidade e transcrição', async () => {
  const Component = await component('src/ResearchedSectorStudy.jsx')
  const html = renderToStaticMarkup(createElement(Component,{study:{...fixture,audio:{src:'/audio/estudo.mp3'}}}))
  assert.match(html,/<audio[^>]+controls=""[^>]+src="\/audio\/estudo.mp3"/)
  assert.match(html,/Velocidade/)
  assert.match(html,/Ler transcrição/)
  assert.match(html,/Voz sintética/)
  assert.match(html,/<option value="1.25" selected="">1,25× · padrão/)
  assert.match(html,/Duração disponível após carregar o áudio/)
})
test('apresentação conserva saída, foco, pausa e movimento reduzido', async () => {
  const code=(await readFile('src/SectorValueChain.jsx','utf8')) + (await readFile('src/useDiagramPresentation.js','utf8'))
  const css=await readFile('src/ResearchedSectorStudy.css','utf8')
  for (const token of ["event.key === 'Escape'","'popstate'","event.key === 'Tab'","event.key.toLowerCase() === 'p'",'appRoot.inert = previousInert','maximizeRef.current?.focus()','diagram.edges.map','createPortal']) assert.ok(code.includes(token),token)
  assert.match(css,/prefers-reduced-motion:reduce/)
  assert.match(css,/animation-play-state:paused/)
})
test('apresentação móvel mantém tamanho do texto e rolagem sem alterar o piloto TIC', async () => {
  const code = await readFile('src/SectorValueChain.jsx', 'utf8')
  const css = await readFile('src/ResearchedSectorStudy.css', 'utf8')
  assert.match(code, /className="tic-flow-fullscreen researched-flow-fullscreen"/)
  assert.match(code, /'--sector-flow-transform'/)
  assert.match(css, /\.researched-flow-fullscreen > \.researched-flow\s*\{\s*transform:var\(--sector-flow-transform\)/)
  assert.match(css, /@media \(max-width:600px\)[\s\S]*\.researched-flow-fullscreen\s*\{[^}]*overflow-y:auto/)
  assert.match(css, /\.researched-flow-fullscreen > \.researched-flow\s*\{[^}]*position:relative;[^}]*width:100%;[^}]*transform:none/)
  assert.match(css, /\.researched-flow-fullscreen > \.tic-flow-laser-slot\s*\{\s*position:fixed/)
})
test('todos os estudos integrados renderizam sem erros e mantêm sua identidade', async () => {
  const studies=JSON.parse(await readFile('src/sectorStudies/studies.json','utf8'))
  const Component=await component('src/ResearchedSectorStudy.jsx')
  for (const study of studies) {
    const html=renderToStaticMarkup(createElement(Component,{study}))
    assert.ok(html.includes(study.title),study.title)
    assert.ok(html.includes(`Perguntas para conversar com a empresa (${study.canvasQuestions.length})`))
    assert.doesNotMatch(html,/study-callout|study-nav|Capítulos do estudo/)
    assert.match(html,/class="study-summary"/)
    assert.match(html,/Relações da cadeia|rich-chain/)
    assert.doesNotMatch(html,/speechSynthesis/)
  }
})

test('gráfico bipolar usa zero central, sinal explícito e escala estável entre séries', async () => {
  const chart={...fixture.charts[0],series:[{label:'Variação',values:[-10,5]},{label:'Outra',values:[0,20]}]}
  const scale=chartScale(chart)
  assert.deepEqual(scale,{negative:true,maximum:20,zero:50})
  assert.deepEqual(barPosition(-10,scale),{left:'25%',width:'25%'})
  assert.deepEqual(barPosition(5,scale),{left:'50%',width:'12.5%'})
  assert.deepEqual(barPosition(0,scale),{left:'50%',width:'0%'})
  const Component=await component('src/ResearchedSectorStudy.jsx')
  const html=renderToStaticMarkup(createElement(Component,{study:{...fixture,charts:[chart]}}))
  assert.match(html,/valores negativos à esquerda do zero/)
  assert.match(html,/research-bar-negative/)
  assert.match(html,/>-10<\/strong>/)
  assert.match(html,/>\+5<\/strong>/)
})
test('transcrição preserva parágrafos e duração é calculada, não estimada', () => {
  assert.deepEqual(transcriptParagraphs('Primeiro.\n\nSegundo.'),['Primeiro.','Segundo.'])
  assert.equal(transcriptText(['Primeiro.','Segundo.']),'Primeiro.\n\nSegundo.')
  assert.equal(durationLabel(125,1.25),'1 min 40 s')
  assert.equal(durationLabel(59.7,1),'1 min 00 s')
})
test('geração de áudio é opt-in, somente revisados, valida hashes e decodificação', async () => {
  const code=await readFile('scripts/generate-sector-audio.mjs','utf8')
  for(const token of ["args.includes('--generate')", "study.reviewStatus !== 'approved'", "'pt-BR-AntonioNeural'", 'textSha256', 'fileSha256', "execute('ffprobe'", "execute('ffmpeg'", "'-xerror'"]) assert.ok(code.includes(token),token)
  const sync=await readFile('scripts/sync-sector-studies.mjs','utf8')
  assert.ok(sync.includes('audio.textSha256 === digest(transcriptText(study.transcript))'))
  assert.ok(sync.includes('=== audio.fileSha256'))
})

test('cadeia em desenhos mostra produto, dinheiro, banco e ciclo; sem emoji cai na versão em texto', async () => {
  const Component = await component('src/ResearchedSectorStudy.jsx')
  const rich = { nodes: [
    { id: 'a', label: 'Pecuarista', detail: 'Origem', emoji: '🐄', bank: 'Giro' },
    { id: 'b', label: 'Frigorífico', detail: 'Abate', emoji: '🏭' }],
  edges: [{ from: 'a', to: 'b', label: 'Compra', product: { emoji: '🐂', label: 'animal para abate' }, cash: { emoji: '💵', label: 'pagamento do animal' } }],
  cycle: { title: 'Ciclo de caixa', steps: ['Paga', 'Estoque', 'Recebe'], text: 'Texto do ciclo' } }
  const html = renderToStaticMarkup(createElement(Component, { study: { ...fixture, diagram: rich } }))
  for (const text of ['🐄', 'animal para abate', 'pagamento do animal', 'Onde o banco entra', 'Ciclo de caixa', 'Texto do ciclo']) assert.ok(html.includes(text), text)
  assert.match(html, /rich-chain/)
  const plain = renderToStaticMarkup(createElement(Component, { study: fixture }))
  assert.doesNotMatch(plain, /rich-chain/)
  assert.match(plain, /sector-chain-nodes/)
  const missingCash = { ...rich, edges: [{ ...rich.edges[0], cash: undefined }] }
  assert.doesNotMatch(renderToStaticMarkup(createElement(Component, { study: { ...fixture, diagram: missingCash } })), /rich-chain/)
})

test('novos estudos usam data própria e não herdam a data histórica fixa', async () => {
  const Component = await component('src/ResearchedSectorStudy.jsx')
  const html = renderToStaticMarkup(createElement(Component, { study: { ...fixture, reviewedAt: '2026-11-13' } }))
  assert.match(html, /dateTime="2026-11-13">13\/11\/2026/)
  assert.doesNotMatch(html, /dateTime="2026-11-06"/)
})
