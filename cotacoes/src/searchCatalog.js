import { CONCEITOS, CONEXAO, LIGACOES } from './educacao.js'
import { GLOSSARY } from './glossary.js'
import { INSUMOS } from './insumos.js'
import { makeSearchDoc, plainContent } from './globalSearch.js'
import { BANKING_TOPICS } from './bankingSectors.js'
import { CURADORIA_TOPICS } from './curadoria.js'
import { CATALOGO_SETORIAL, PAUTAS_SETORIAIS, rotaPautaSetorial } from './centralSetorial.js'
import { sectorEntitySearchEntries } from './sectorEntities.js'
import generated from './searchContent.generated.json'
export function staticSearchDocuments() {
  const researchTopics = PAUTAS_SETORIAIS.flatMap(group => group.topics)
  const researchRoutes = new Set(researchTopics.map(rotaPautaSetorial))
  return [
    makeSearchDoc({id:'calculator:cbs-caixa',title:'Reforma tributária: CBS e impacto no caixa',body:'Simulador indicativo de capital de giro, split payment, créditos tributários e gastos setoriais do IBGE. Faturamento, recebimento, pagamento e estoque.',route:'calculadora/cbs-caixa',kind:'Calculadora'}),
    makeSearchDoc({id:'learning:map',title:'Mapa do conhecimento',body:'Grafo interativo de setores, subsetores, conceitos e notícias dos últimos 7 dias. Explorar conexões com zoom e arraste.',route:'aprender/mapa',kind:'Área do painel'}),
    ...CURADORIA_TOPICS.map(topic => makeSearchDoc({ id: 'curadoria:' + topic.id, title: topic.label + ': notícias dos últimos sete dias', body: 'Curadoria automática de notícias em fontes oficiais e imprensa selecionada. Janela de 7 dias, 168 horas de publicação.', route: 'resumo', context: { newsTab: topic.id }, kind: 'Área do painel' })),
    ...CATALOGO_SETORIAL.flatMap(group => group.topics.map((topic, index) => makeSearchDoc({id:`sector-topic:${group.id}:${index}`,title:topic,body:`${group.label}. Catálogo setorial. Abra o tópico para consultar o estudo ou o status da pesquisa.`,route:`setores/topico/${group.id}/${index}`,kind:'Subsetor'}))),
    ...PAUTAS_SETORIAIS.flatMap(group => group.topics.map(topic => makeSearchDoc({
      id: `sector-research:${topic.id}`, title: topic.title, body: `${group.label}. Pesquisa pendente. ${topic.scope}`,
      route: `setores/${rotaPautaSetorial(topic)}`, kind: 'Pauta setorial',
    }))),
    ...sectorEntitySearchEntries().map(makeSearchDoc),
    ...CONCEITOS.map(c=>makeSearchDoc({id:'concept:'+c.id,title:c.nome,body:plainContent(c),route:'aprender/'+c.id,kind:'Conceito'})),
    makeSearchDoc({id:'learning:connections',title:CONEXAO.titulo,body:plainContent(CONEXAO)+' '+plainContent(LIGACOES),route:'aprender/conceitos',kind:'Conteúdo do painel'}),
    ...Object.entries(GLOSSARY).filter(([key])=>generated.glossaryRoutes[key]).map(([key,g])=>makeSearchDoc({id:'glossary:'+key,title:g.t,body:plainContent(g),route:generated.glossaryRoutes[key] || 'juros',kind:'Explicação',help:g.t})),
    ...[...BANKING_TOPICS,...INSUMOS].filter(topic => !researchRoutes.has(topic.id)).map(t=>makeSearchDoc({id:'sector:'+t.id,title:t.label,body:plainContent(t)+(t.available===false?' Indicadores e notícias deste tema ainda não estão integrados. Categoria editorial da visão bancária, não classificação oficial.':''),route:'setores/'+t.id,kind:'Setor ou insumo'})),
    ...generated.documents.map(makeSearchDoc),
  ]
}
