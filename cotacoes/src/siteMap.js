// Mapa do site: a árvore sai dos catálogos do próprio painel, para não ficar desatualizada.
// Seções ocultas (Apresentar, Configurações) ficam de fora. Cada item leva o endereço da tela (#aba/visão)
// e, quando o destino é um quadro dentro da página, o id do quadro (anchor).
import { APP_SECTIONS } from './appSections.js'
import { CALCULATOR_GROUPS } from './calculatorGroups.js'
import { CEN_SECTIONS, CEN_SECTION_LABELS, CEN_VIEWS } from './cenariosViews.js'
import { CATALOGO_SETORIAL } from './centralSetorial.js'
import { CONCEITOS, porTopico } from './educacao.js'
import { HISTORIAS } from './historias.js'
import { FAMILIES } from './bndesView.js'

// Os quatro ramos do mapa, aprovados por Fernando em 27/11/2026. 'calculadora' e 'rpn' moram no ramo Calculadoras.
export const SITE_MAP_BRANCHES = [
  { id: 'mercado', label: 'Mercado', sections: ['resumo', 'juros', 'cenarios', 'feriados'] },
  { id: 'calculadoras', label: 'Calculadoras', sections: ['calculadora', 'rpn'] },
  { id: 'empresas', label: 'Empresas e setores', sections: ['setores', 'bancos', 'ma', 'bndes'] },
  { id: 'conteudo', label: 'Conteúdo', sections: ['noticias', 'podcast', 'aprender', 'historias', 'novidades'] },
]

// Quadros de Mercado hoje que não têm endereço próprio: o mapa abre a aba e rola até eles.
const MERCADO_HOJE = [['comparison-title', 'Comparar moedas'], ['market-news-title', 'Notícias e temas do dia']]

const node = (id, label, route, extra = {}) => ({ id, label, route, ...extra })
const sectionLabel = id => APP_SECTIONS.find(s => s.id === id)?.label ?? id
const curto = nome => nome.replace(/ \(.*\)/, '')

// calcs, jurosAtalhos, bndesProfiles e bndesAliases vêm das próprias telas (Calculadora, Juros, BndesWorkspace).
export function buildSiteMap({ calcs = [], jurosAtalhos = [], bndesProfiles = [], bndesAliases = {} } = {}) {
  const calcTitle = id => calcs.find(c => c.id === id)?.title ?? id
  const bndesLinhas = bndesProfiles.map(([id, label]) => node(`calc-bndes:${id}`, label, `calculadora/${bndesAliases[id] ? 'finame-materiais' : id}`))
  const sections = {
    resumo: node('resumo', sectionLabel('resumo'), 'resumo', { children: MERCADO_HOJE.map(([anchor, label]) => node(`resumo:${anchor}`, label, 'resumo', { anchor })) }),
    juros: node('juros', sectionLabel('juros'), 'juros', { children: jurosAtalhos.map(([anchor, label]) => node(`juros:${anchor}`, label, 'juros', { anchor })) }),
    cenarios: node('cenarios', sectionLabel('cenarios'), 'cenarios', {
      children: CEN_VIEWS.map(v => {
        const subs = Object.keys(CEN_SECTIONS).filter(route => route.startsWith(`${v.id}/`))
        return node(`cenarios:${v.id}`, v.label, `cenarios/${v.id}`, subs.length ? { children: subs.map(route => node(`cenarios:${route}`, CEN_SECTION_LABELS[route] ?? route, `cenarios/${route}`)) } : {})
      }),
    }),
    feriados: node('feriados', sectionLabel('feriados'), 'feriados'),
    calculadora: node('calculadora', 'Todas as calculadoras', 'calculadora', {
      children: CALCULATOR_GROUPS.map(g => node(`calc-group:${g.id}`, g.title, 'calculadora', {
        children: g.calculators.map(id => node(`calc:${id}`, calcTitle(id), `calculadora/${id}`, id === 'finame-materiais' && bndesLinhas.length ? { children: bndesLinhas } : {})),
      })),
    }),
    rpn: node('rpn', sectionLabel('rpn'), 'rpn'),
    setores: node('setores', sectionLabel('setores'), 'setores', {
      children: CATALOGO_SETORIAL.map(g => node(`setores:${g.id}`, g.label, `setores/pasta/${g.id}`, {
        children: g.topics.map((t, i) => node(`setores:${g.id}:${i}`, t, `setores/topico/${g.id}/${i}`)),
      })),
    }),
    bancos: node('bancos', sectionLabel('bancos'), 'bancos'),
    ma: node('ma', sectionLabel('ma'), 'ma', { children: [node('ma:visao-geral', 'Visão geral', 'ma/visao-geral'), node('ma:transacoes', 'Transações', 'ma/transacoes')] }),
    bndes: node('bndes', 'Taxas BNDES', 'bndes', { children: FAMILIES.map(f => node(`bndes:${f.id}`, f.title.startsWith(f.label) ? f.title.replace(' — ', ' · ') : `${f.label} · ${f.title}`, `bndes/${f.id}`)) }),
    noticias: node('noticias', sectionLabel('noticias'), 'noticias'),
    podcast: node('podcast', sectionLabel('podcast'), 'podcast'),
    aprender: node('aprender', sectionLabel('aprender'), 'aprender', {
      children: [
        node('aprender:mapa', 'Mapa do conhecimento', 'aprender/mapa'),
        node('aprender:conceitos', 'Conceitos', 'aprender/conceitos', {
          children: porTopico(CONCEITOS).map(g => node(`aprender:topico:${g.topico}`, g.topico, 'aprender/conceitos', {
            children: g.itens.map(c => node(`aprender:${c.id}`, curto(c.nome), `aprender/${c.id}`)),
          })),
        }),
      ],
    }),
    historias: node('historias', sectionLabel('historias'), 'historias', { children: HISTORIAS.map(h => node(`historias:${h.id}`, h.nome, `historias/${h.id}`)) }),
    novidades: node('novidades', sectionLabel('novidades'), 'novidades'),
  }
  // O ramo Calculadoras abre direto nos grupos: a seção "Todas as calculadoras" vira o próprio ramo.
  const branches = SITE_MAP_BRANCHES.map(b => b.id === 'calculadoras'
    ? { id: b.id, label: b.label, route: 'calculadora', children: [...sections.calculadora.children, sections.rpn] }
    : { id: b.id, label: b.label, children: b.sections.map(id => sections[id]) })
  return { id: 'painel', label: 'PME', children: branches }
}

// Todos os itens da árvore, em ordem (para contar destinos e para os testes).
export function flattenSiteMap(tree) {
  const out = []
  const walk = n => { out.push(n); (n.children ?? []).forEach(walk) }
  walk(tree)
  return out
}

export const siteMapHref = route => `#${route}`
