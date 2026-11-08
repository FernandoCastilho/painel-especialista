import { NEWS_WINDOW_MS, NEWS_WINDOW_DAYS } from './newsWindow.js'
import { BANKING_TOPICS } from './bankingSectors.js'
import { INSUMOS } from './insumos.js'

// This registry is deliberately independent of the legacy Google News collector.
// A government domain alone is not a reuse licence or an approval to crawl it.
// Registry eligibility does not mean that the live collector is operational.
export const SECTOR_NEWS_COLLECTION = Object.freeze({
  mode: 'offline-revalidation',
  automaticCollectionEnabled: false,
  notice: 'Atualização automática institucional desativada. Esta seleção usa publicações já verificadas; consulte os links das fontes.',
})
export const SECTOR_NEWS_WINDOW_MS = NEWS_WINDOW_MS
export const SECTOR_NEWS_TOPICS = [...BANKING_TOPICS, ...INSUMOS].map(({ id, label }) => ({ id, label }))
export const CC_BY_ND_3 = 'https://creativecommons.org/licenses/by-nd/3.0/'
const reviewedAt = '2026-11-05'
const gov = (id, label, listPath, articlePath, topics) => ({
  id, label, url: `https://www.gov.br${listPath}`, articlePrefix: `https://www.gov.br${articlePath}`,
  topics, enabled: true, automaticCollection: true, adapter: 'gov-html', type: 'comunicado', allowedTypes: ['comunicado', 'estatistica'], licenseUrl: CC_BY_ND_3,
  rightsReviewedAt: reviewedAt, robotsUrl: 'https://www.gov.br/robots.txt',
  rightsEvidenceUrl: `https://www.gov.br${listPath}`,
  rightsNote: 'Rodapé desta fonte verificado: CC BY-ND 3.0. Só manchete original e metadados, com atribuição e link da licença; sem fotos, texto integral ou endosso.',
  reason: 'Cobertura institucional parcial; não representa toda a imprensa nem todo o setor.',
})
const pending = (id, label, url, topics, reason) => ({ id, label, url, topics, enabled: false, type: 'comunicado', reason })

export const SECTOR_NEWS_SOURCES = [
  { ...gov('anvisa', 'Anvisa', '/anvisa/pt-br/assuntos/noticias-anvisa', '/anvisa/pt-br/assuntos/noticias-anvisa/', ['agricultura', 'alimentos-bebidas', 'quimicos-plasticos', 'varejo-essencial', 'saude-assistencial', 'diagnosticos', 'produtos-saude', 'alimentacao-servicos']), automaticCollection: false, collectionNote: 'Coleta automática suspensa: tentativa de 05/11/2026 acionou detector de desafio de acesso no índice. Manchetes abaixo foram verificadas manualmente na origem; não houve nova tentativa ou contorno.' },
  gov('mapa', 'Ministério da Agricultura e Pecuária', '/agricultura/pt-br/ultimas-noticias', '/agricultura/pt-br/assuntos/noticias/', ['agricultura', 'pecuaria', 'alimentos-bebidas']),
  gov('antt', 'Agência Nacional de Transportes Terrestres (ANTT)', '/antt/pt-br/assuntos/ultimas-noticias-antt', '/antt/pt-br/assuntos/ultimas-noticias-antt/', ['veiculos-pesados', 'transporte-cargas', 'transporte-passageiros', 'armazenagem-logistica', 'infraestrutura']),
  gov('mdic', 'Ministério do Desenvolvimento, Indústria, Comércio e Serviços', '/mdic/pt-br/assuntos/noticias', '/mdic/pt-br/assuntos/noticias/', ['industria', 'veiculos-pesados', 'metalmecanica', 'quimicos-plasticos', 'textil-moveis', 'comercio', 'atacado-distribuicao', 'varejo-essencial', 'varejo-duraveis', 'software-ti', 'servicos', 'servicos-profissionais', 'terceirizacao', 'mineracao', 'cobre', 'aluminio', 'aco', 'minerio']),
  pending('ibge', 'IBGE / Agência IBGE Notícias', 'https://servicodados.ibge.gov.br/api/docs/noticias?versao=3', ['agricultura', 'pecuaria', 'industria', 'comercio', 'servicos', 'construcao-civil', 'mercado-imobiliario', 'textil-moveis', 'atacado-distribuicao', 'varejo-essencial', 'varejo-duraveis', 'servicos-profissionais', 'terceirizacao'], 'API oficial identificada. Homologação pendente: página de licença respondeu 403 e limites de uso não foram verificados. Coleta desativada.'),
  pending('anatel', 'Anatel', 'https://www.gov.br/anatel/pt-br/assuntos/noticias', ['telecom', 'comunicacao-midia'], 'Página retornou desafio humano de acesso em 05/11/2026. Sem contorno; coleta desativada.'),
  gov('anp', 'Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP)', '/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados', '/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/', ['oleo-gas', 'petroleo']),
  gov('aneel', 'Agência Nacional de Energia Elétrica (ANEEL)', '/aneel/pt-br/assuntos/noticias', '/aneel/pt-br/assuntos/noticias/', ['energia']),
  gov('anm', 'Agência Nacional de Mineração (ANM)', '/anm/pt-br/assuntos/noticias', '/anm/pt-br/assuntos/noticias/', ['mineracao', 'cobre', 'aluminio', 'aco', 'minerio']),
  gov('ana', 'Agência Nacional de Águas e Saneamento Básico (ANA)', '/ana/pt-br/assuntos/noticias-e-eventos/noticias', '/ana/pt-br/assuntos/noticias-e-eventos/noticias/', ['saneamento']),
  pending('mma-reciclagem', 'Ministério do Meio Ambiente e Mudança do Clima / SINIR', 'https://sinir.gov.br/', ['reciclagem'], 'Referência oficial de resíduos identificada. Coleta de notícias, direitos e adaptação ainda não homologados; não houve busca exaustiva do setor. Coleta desativada.'),
  pending('mec', 'Ministério da Educação', 'https://www.gov.br/mec/pt-br/assuntos/noticias', ['educacao'], 'A página do MEC apresentou desafio humano/CAPTCHA em 05/11/2026. Coleta desativada, sem nova tentativa ou contorno. Falta homologar acesso e direitos.'),
  gov('mtur', 'Ministério do Turismo', '/turismo/pt-br/assuntos/noticias', '/turismo/pt-br/assuntos/noticias/', ['turismo-hospedagem', 'transporte-passageiros', 'alimentacao-servicos', 'lazer-entretenimento']),
  pending('bcb', 'Banco Central do Brasil', 'https://www.bcb.gov.br/detalhenoticia', ['servicos-financeiros'], 'Fonte candidata; acesso, licença e adaptação da coleta ainda não homologados.'),
  gov('susep', 'Superintendência de Seguros Privados (Susep)', '/susep/pt-br/central-de-conteudos/noticias', '/susep/pt-br/central-de-conteudos/noticias/', ['seguros']),
  gov('cvm', 'Comissão de Valores Mobiliários (CVM)', '/cvm/pt-br/assuntos/noticias', '/cvm/pt-br/assuntos/noticias/', ['servicos-financeiros']),
  gov('ans', 'Agência Nacional de Saúde Suplementar (ANS)', '/ans/pt-br/assuntos/noticias', '/ans/pt-br/assuntos/noticias/', ['saude-assistencial', 'diagnosticos', 'seguros']),
  gov('ipen', 'Instituto de Pesquisas Energéticas e Nucleares (IPEN/CNEN)', '/ipen/pt-br/assuntos/mais-noticias', '/ipen/pt-br/assuntos/mais-noticias/', ['quimicos-plasticos', 'produtos-saude', 'diagnosticos', 'reciclagem']),
]

// Explicit editorial exceptions after reading the original body. These are pinned
// to a URL + unchanged headline, never supplied by an arbitrary payload/keyword.
// Exact short evidence and scope are retained for review; no article text is copied.
export const SECTOR_NEWS_EDITORIAL_REVIEWS = [
  { link: 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias-antt/antt-participa-de-decisoes-para-avancos-em-regras-para-caminhoes-fiscalizacao-de-cargas-perigosas-e-digitalizacao-do-transporte-no-mercosul', title: 'ANTT participa de decisões para avanços em regras para caminhões, fiscalização de cargas perigosas e digitalização do transporte no Mercosul', reviewedAt: '2026-11-05', author: 'Bruno Laganá, Comunicação da ANTT', topics: {} },
  { link: 'https://www.gov.br/mdic/pt-br/assuntos/noticias/2026/outubro/acordo-mercosul-ue-impulsiona-exportacoes-brasileiras-com-alta-de-ate-421-em-produtos', title: 'Acordo Mercosul - UE impulsiona exportações brasileiras, com alta de até 421% em produtos', reviewedAt: '2026-11-05', topics: {
    aluminio: { quote: 'Alumínio em bruto: +107%', note: 'Recorte: exportações de alumínio em bruto entre maio e setembro/2026, comparadas ao mesmo período de 2025. Não é cotação nem variação semanal do metal.' },
    metalmecanica: { quote: 'Outro destaque foram os transformadores elétricos, cujas exportações passaram de zero', note: 'Recorte: exportações de transformadores elétricos entre maio e setembro/2026. Não representa toda a metalmecânica ou o mercado interno.' },
  } },
  { link: 'https://www.gov.br/anp/pt-br/canais_atendimento/imprensa/noticias-comunicados/producao-de-petroleo-e-gas-natural-bate-novo-recorde-em-setembro', title: 'Produção de petróleo e gás natural bate novo recorde em setembro', reviewedAt: '2026-11-05', type: 'estatistica', topics: {
    'oleo-gas': { quote: 'Produção de petróleo e gás natural bate novo recorde em setembro', note: 'Divulgação institucional sobre produção de setembro. Data de publicação em novembro não muda o período do dado.' },
    petroleo: { quote: 'Produção de petróleo e gás natural bate novo recorde em setembro', note: 'Recorte: produção de petróleo em setembro. Não é cotação atual nem preço do diesel ao consumidor.' },
  } },
  { link: 'https://www.gov.br/mdic/pt-br/assuntos/noticias/2026/outubro/acordo-mercosul-efta-abre-novas-oportunidades-para-exportacoes-brasileiras-a-noruega-em-1o-de-novembro', title: 'Acordo Mercosul-EFTA abre novas oportunidades para exportações brasileiras à Noruega em 1º de novembro', reviewedAt: '2026-11-05', topics: {
    'textil-moveis': { quote: 'tarifa zero para vestuário e têxteis confeccionados', note: 'Recorte: vestuário e têxteis exportados à Noruega. Comunicado sobre acesso tarifário, não indicador de móveis ou de varejo interno.' },
    metalmecanica: { quote: 'máquinas e aparelhos mecânicos e calçados', note: 'Recorte: acesso ao mercado norueguês para máquinas e aparelhos mecânicos. Não demonstra aumento efetivo das vendas.' },
  } },
  { link: 'https://www.gov.br/ipen/pt-br/assuntos/mais-noticias/encontro-discute-tecnologia-de-radiacao-na-reciclagem', title: 'Encontro discute tecnologia de radiação na reciclagem', reviewedAt: '2026-11-05', topics: {
    'quimicos-plasticos': { quote: 'O encontro é destinado a representantes das indústrias de plásticos', note: 'Recorte: encontro técnico sobre reciclagem de plásticos. Evento anunciado para 9 a 13/11; não é resultado econômico observado.' },
    reciclagem: { quote: 'O encontro é destinado a representantes das indústrias de plásticos', note: 'Recorte: comunicado sobre encontro técnico de reciclagem de plásticos, previsto para 9 a 13/11. Não cobre papel, metais ou vidro nem comprova produção, preço ou resultado econômico. Manchete recuperada do snapshot já verificado, sem nova coleta.' },
  } },
  { link: 'https://www.gov.br/ana/pt-br/assuntos/noticias-e-eventos/noticias/sistema-cantareira-continuara-a-operar-na-faixa-de-atencao-em-novembro-1', title: 'Sistema Cantareira continuará a operar na Faixa de Atenção em novembro', reviewedAt: '2026-11-05', author: 'Assessoria Especial de Comunicação Social (ASCOM/ANA)', topics: {
    saneamento: { quote: 'principal manancial de abastecimento da Região Metropolitana de São Paulo', note: 'Recorte regional: manancial de abastecimento da Região Metropolitana de São Paulo. Não representa a condição de todos os sistemas de água do país.' },
  } },
  { link: 'https://www.gov.br/turismo/pt-br/assuntos/noticias/mais-de-2-milhoes-de-passageiros-devem-movimentar-aeroportos-do-brasil-durante-o-feriado-de-finados', title: 'Mais de 2 milhões de passageiros devem movimentar aeroportos do Brasil durante o feriado de Finados', reviewedAt: '2026-11-05', author: 'Rafael Daher, Assessoria de Comunicação do Ministério do Turismo', topics: {
    'turismo-hospedagem': { quote: 'rede hoteleira e da busca por experiências turísticas voltadas ao descanso e ao lazer', note: 'Recorte: turismo e hospedagem no feriado de Finados. Projeção publicada antes do feriado, não balanço de movimento realizado.' },
    'transporte-passageiros': { quote: 'Mais de 2 milhões de passageiros devem movimentar aeroportos do Brasil durante o feriado de Finados', note: 'Recorte: transporte aéreo no feriado. Projeção anterior ao feriado, não balanço realizado nem dado de transporte terrestre.' },
  } },
  { link: 'https://www.gov.br/cvm/pt-br/assuntos/noticias/2026/destaques-da-cvm-em-outubro', title: 'Confira o que aconteceu na CVM em... outubro!', reviewedAt: '2026-11-05', topics: {
    'servicos-financeiros': { quote: 'CVM inicia consulta pública sobre atualização de normas contábeis aplicáveis aos fundos de investimento', note: 'Recorte: mercado de capitais. Retrospectiva de outubro publicada em novembro; não é nova consulta em 03/11 nem indicador de crédito bancário.' },
  } },
  { link: 'https://www.gov.br/ans/pt-br/assuntos/noticias/beneficiario/deliberacoes-da-645a-reuniao-da-diretoria-colegiada', title: 'ANS prorroga trabalhos de comitê sobre cartões de desconto', reviewedAt: '2026-11-05', topics: {
    'saude-assistencial': { quote: 'oferecem acesso a uma rede de profissionais, clínicas, laboratórios e outros estabelecimentos de saúde', note: 'Recorte: cartões de desconto ligados à rede privada de atendimento. Cartões de desconto não devem ser apresentados como planos de saúde.' },
    diagnosticos: { quote: 'clínicas, laboratórios e outros estabelecimentos de saúde', note: 'Recorte: laboratórios na rede acessada por cartões de desconto. Não é indicador de volume de exames ou de todo o mercado diagnóstico.' },
  } },
]

const rule = (positive, negative = null, context = null) => ({ positive, negative, context })
export const SECTOR_NEWS_RULES = {
  agricultura: rule(/agricultur|agricol|agroindustr|agronegocio|safra|fertilizant|agrotoxic|bioinsumo|irrigacao/, /agricultura familiar.*(?:premio|homenage)/),
  pecuaria: rule(/pecuari|proteina animal|bovin|suin|avic|avicol|frigorific|newcastle|\bcarnes?\b|pescad/, /carnevale|carneiro.*(?:ator|cantor)/),
  'alimentos-bebidas': rule(/aliment|bebida|laticin|cerveja|cachaca|pescad|produtos avicolas/, /vale.alimentacao|receita (?:caseira|culinaria)|horoscopo/),
  industria: rule(/industria|industrial|manufatur|producao fabril/, /industria (?:do crime|da fofoca|de multas)/),
  'veiculos-pesados': rule(/caminh(?:ao|oes)|onibus|veiculos pesados/, /acidente|colisao|atropel|assalto|morre|morto/, /producao|venda|frota|regras|regula|emplac|fabric|financia|montadora/),
  metalmecanica: rule(/metalmecanic|maquinas|equipamentos industriais|bens de capital/, /maquina (?:do tempo|de lavar roupa em casa)|maquinas de votos/),
  'quimicos-plasticos': rule(/quimic|plastic|petroquimic|resina|saneante|produtos de limpeza/, /quimica (?:do amor|entre os)/),
  'textil-moveis': rule(/textil|texteis|vestuario|confecc|moveis|mobilia|calcados/, /dispositivos moveis|telefon(?:e|ia).*moveis|dados moveis/),
  comercio: rule(/varejo|comercio (?:varejista|e consumo)|consumo das familias|vendas no comercio/, /comercio de drogas|comercio exterior|trafico/),
  'atacado-distribuicao': rule(/atacad|distribuidores|distribuicao de (?:mercadorias|alimentos|produtos)/, /distribuicao de (?:renda|senhas|votos)/),
  'varejo-essencial': rule(/supermercad|farmaci|drogari|varejo alimentar/, /farmacia.*(?:universidade|curso)|receita caseira/),
  'varejo-duraveis': rule(/e.commerce|comercio eletronico|eletrodomestic|varejo de moveis|bens duraveis/, /golpe|dica de compra|cupom/),
  'transporte-cargas': rule(/transporte.*cargas|cargas.*transporte|cargas perigosas|frete|transportador.*cargas/, /cargas eletricas|carga emocional/),
  'transporte-passageiros': rule(/transporte.*passageiros|passageiros.*transporte|transporte coletivo|viagens internacionais|aviacao comercial/, /acidente|atropel|assalto/),
  'armazenagem-logistica': rule(/armazena|operadores logistic|armazen[se]|centro(?:s)? de distribuicao|logistica/, /armazenamento de (?:dados|fotos)|logistica de campanha/),
  'construcao-civil': rule(/construcao civil|sinapi|construtoras|canteiro.*obra|materiais de construcao/, /construcao de (?:consenso|narrativa|identidade)/),
  infraestrutura: rule(/infraestrutura|concess.*rodovi|duplicacao.*(?:br|rodovia)|obras.*(?:rodovia|ferrovia)|rota das gerais/, /infraestrutura de (?:dados|software)/),
  'mercado-imobiliario': rule(/imobiliari|incorporador|lancamentos residenciais|alugueis|financiamento habitacional/, /imobiliario.*(?:golpe|fraude)/),
  telecom: rule(/telecom|banda larga|fibra optica|anatel|\b5g\b|provedores de internet/, /claro que|vivo para|fibra alimentar/),
  'software-ti': rule(/software|tecnologia da informacao|servicos de ti|ciberseguranca|computacao em nuvem|datacenters|data centers/, /download gratis|jogo gratis|cupom/),
  'comunicacao-midia': rule(/radiodifusao|audiovisual|midia|mercado publicitario|emissoras|producao cinematografica/, /fofoca|celebridade|quem saiu do/),
  'saude-assistencial': rule(/hospita|clinic|servicos de saude|atencao domiciliar|radioterapia|notificacao de efeitos adversos/, /clinica.*(?:campeonato|futebol)|horoscopo/),
  diagnosticos: rule(/diagnostic|laboratorios clinicos|analises clinicas|exames laboratoriais|diagnostico in vitro/, /diagnostico (?:da economia|do mercado|empresarial|financeiro)/),
  'produtos-saude': rule(/dispositiv.*medic|equipamento.*(?:saude|radioterapia)|medicament|vacina|produtos para saude/, /vacina.*(?:boato|astrologia)/),
  servicos: rule(/setor de servicos|volume de servicos|pesquisa mensal de servicos|nomenclatura brasileira de servicos/, /servicos funerarios.*(?:homenagem|velorio)/),
  educacao: rule(/educacao privada|ensino privado|faculdades particulares|escolas particulares|mensalidades escolares|fies|prouni/, /escola de samba/),
  'servicos-profissionais': rule(/contabil|contabilidade|auditoria independente|servicos juridicos|consultoria empresarial|escritorios de advocacia/, /contabilidade.*(?:futebol|placar)/),
  terceirizacao: rule(/terceiriz|facilities|limpeza profissional|seguranca patrimonial|trabalho temporario/, /terceirizacao.*(?:culpa|responsabilidade politica)/),
  'turismo-hospedagem': rule(/turismo|hospedagem|hotelaria|hoteis|ocupacao hoteleira/, /turismo espacial|horoscopo/),
  'alimentacao-servicos': rule(/restaurantes|bares e|alimentacao fora|food service|delivery de comida/, /receita caseira|como cozinhar/),
  'lazer-entretenimento': rule(/parques tematicos|entretenimento|bilheteria|cinemas|producao de eventos|parques de diversao/, /fofoca|celebridade|quem saiu do/),
  energia: rule(/energia eletrica|renovaveis|geracao solar|eolica|aneel|tarifa de energia|distribuidoras de energia|leilao de transmissao|reserva de capacidade/, /energia (?:positiva|espiritual)/),
  reciclagem: rule(/reciclagem|materiais reciclaveis|reciclados|sucata|aparas de papel|logistica reversa de embalagens/, /reciclagem (?:de (?:motoristas|condutores|profissionais|conhecimento)|profissional|para (?:vigilantes|motoristas|condutores))|curso de reciclagem.*(?:cnh|transito)/),
  saneamento: rule(/saneamento|esgotamento|agua e esgoto|residuos solidos|abastecimento de agua/, /saneamento de (?:contas|processos)/),
  'servicos-financeiros': rule(/credito|cooperativas.*(?:credito|financeir)|bancos|fintech|sistema financeiro|open finance|pix/, /banco(?:s)? de (?:sangue|dados|sementes)|creditos? de carbono/),
  seguros: rule(/seguros|seguradoras|resseguros|susep|corretoras de seguro/, /lugares seguros|caminhos seguros|alimentos seguros/),
  mineracao: rule(/mineracao|mineradora|minerais criticos|minerais estrategicos|extracao mineral|fechamento de minas/, /mineracao de dados|academia nacional de medicina/),
  'oleo-gas': rule(/petroleo|gas natural|biocombustiveis|refinaria|etanol|biodiesel|precos de combustiveis/, /gas de pimenta|oleo de cozinha.*receita/),
  cobre: rule(/\bcobre\b|copper/, /cobre (?:a |o |os |as |seus |suas )?(?:custos|despesas|dividas|danos|salarios|riscos)/, /metal|miner|tonelad|estoque|fundicao|cotacao|preco|oferta|demanda/),
  aluminio: rule(/aluminio|aluminum|aluminium|bauxita|alumina/, /papel aluminio.*receita|truque caseiro/),
  aco: rule(/\baco\b|siderurg|steel/, /homem de aco|nervos de aco/),
  minerio: rule(/minerio de ferro|iron ore|pelotizacao/, /vale a pena/),
  petroleo: rule(/petroleo|diesel|brent|wti/, /perfume|novela/),
}

export const sectorNewsTypeLabel = type => ({ comunicado: 'Comunicado institucional', estatistica: 'Divulgação estatística', imprensa: 'Imprensa independente' }[type] || 'Tipo não verificado')
export const normalizeNewsText = text => String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const editorialNoise = /conteudo patrocinado|publieditorial|informe publicitario|horoscopo|homenagem|concurso publico|processo seletivo|premio|premiacao/
export function isSectorNewsRelevant(id, title) {
  const r = SECTOR_NEWS_RULES[id], text = normalizeNewsText(title)
  return Boolean(r && text && !editorialNoise.test(text) && !r.negative?.test(text) && r.positive.test(text) && (!r.context || r.context.test(text)))
}
function editorialReview(item) {
  return SECTOR_NEWS_EDITORIAL_REVIEWS.find(review => review.link === item.link && review.title === item.title)
}
export function sectorNewsItemMatchesTopic(id, item) {
  if (isSectorNewsRelevant(id, item.title)) return true
  const text = normalizeNewsText(item.title), rule = SECTOR_NEWS_RULES[id]
  return Boolean(rule && !editorialNoise.test(text) && !rule.negative?.test(text) && editorialReview(item)?.topics[id])
}

export function validIsoTimestamp(value) {
  if (typeof value !== 'string') return null
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate() || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) return null
  if (m[7] !== 'Z') { const [h, min] = m[7].slice(1).split(':').map(Number); if (h > 14 || min > 59 || (h === 14 && min > 0)) return null }
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

// If an original page exposes only a local date (no verified timezone), do not
// invent an instant: the whole possible UTC interval must fit the 120h window.
export function publicationBounds(item) {
  const exact = validIsoTimestamp(item?.publishedAt)
  if (exact !== null) return { min: exact, max: exact, t: exact, precision: 'instant' }
  if (item?.datePrecision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(item?.publishedAt || '')) return null
  const t = validIsoTimestamp(`${item.publishedAt}T00:00:00Z`)
  return t === null ? null : { min: t - 14 * 3600000, max: t + 36 * 3600000 - 1, t, precision: 'day' }
}

export function canonicalNewsUrl(value) {
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key)
    return u.href.replace(/\/$/, '')
  } catch { return null }
}

export function validateSectorNewsItem(raw, now = Date.now(), { windowMs = SECTOR_NEWS_WINDOW_MS } = {}) {
  const source = SECTOR_NEWS_SOURCES.find(s => s.id === raw?.sourceId)
  if (!source?.enabled) return { reason: 'source_not_approved' }
  if (typeof raw.title !== 'string' || !raw.title.trim() || raw.title.length > 600 || /<[^>]*>/.test(raw.title)) return { reason: 'invalid_title' }
  const link = canonicalNewsUrl(raw.link)
  if (!link?.startsWith(source.articlePrefix) || new URL(link).search || /%(?:2f|5c|2e)/i.test(link) || /\/(?:RSS|@@|search|login)(?:[/?]|$)/i.test(link)) return { reason: 'invalid_direct_url' }
  const bounds = publicationBounds(raw)
  if (!bounds) return { reason: 'invalid_publication_date' }
  if (bounds.max > now) return { reason: 'future_or_uncertain_publication' }
  // The knowledge map may retain already approved headlines for seven days.
  // Existing readers keep their five-day default; callers cannot extend past 168h.
  const publicationWindow = Number.isFinite(windowMs) && windowMs > 0 ? Math.min(windowMs, 7 * 86400000) : SECTOR_NEWS_WINDOW_MS
  if (bounds.min < now - publicationWindow) return { reason: 'outside_120h_or_uncertain_boundary' }
  const collected = validIsoTimestamp(raw.collectedAt)
  if (collected === null || collected > now || collected < bounds.min) return { reason: 'invalid_collection_date' }
  if (!source.allowedTypes.includes(raw.type)) return { reason: 'wrong_source_type' }
  if (raw.licenseUrl !== source.licenseUrl) return { reason: 'missing_or_wrong_license' }
  const item = { title: raw.title.trim(), link, source: source.label, sourceId: source.id, publishedAt: raw.publishedAt, collectedAt: raw.collectedAt, type: raw.type, licenseUrl: source.licenseUrl, t: bounds.t, datePrecision: bounds.precision }
  if (editorialReview(item)?.type) item.type = editorialReview(item).type
  if (bounds.precision === 'day') item.publicationTimeNote = 'Data original; horário e fuso não confirmados. Inclusão conservadora na janela.'
  if (typeof raw.eventId === 'string' && raw.eventId.length <= 160) item.eventId = raw.eventId
  const author = editorialReview(item)?.author || raw.author
  if (typeof author === 'string' && author.length < 240 && !/[<>]/.test(author)) item.author = author
  return { item }
}

export function dedupeSectorNews(items) {
  const links = new Set(), titles = new Set(), events = new Set()
  return items.slice().sort((a, b) => b.t - a.t || a.link.localeCompare(b.link)).filter(item => {
    const title = normalizeNewsText(item.title).replace(/[^a-z0-9 ]/g, '')
    if (links.has(item.link) || titles.has(title) || (item.eventId && events.has(item.eventId))) return false
    links.add(item.link); titles.add(title); if (item.eventId) events.add(item.eventId)
    return true
  })
}

const beforeNow = (value, now) => { const t = validIsoTimestamp(value); return t !== null && t <= now ? value : null }
const newest = values => values.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null
function sourceState(source, raw, now) {
  const checkedAt = beforeNow(raw?.checkedAt, now), lastSuccessAt = beforeNow(raw?.lastSuccessAt, now)
  let status = source.enabled && ['ok', 'partial', 'empty', 'failed'].includes(raw?.status) ? raw.status : 'unavailable'
  let reason = source.enabled ? (raw?.reason || 'Ainda não houve coleta válida desta fonte.') : source.reason
  if (source.collectionNote && !reason.includes(source.collectionNote)) reason += ` ${source.collectionNote}`
  const stale = Boolean(lastSuccessAt && Date.parse(lastSuccessAt) < now - SECTOR_NEWS_WINDOW_MS)
  if (['ok', 'empty', 'partial'].includes(status) && (!checkedAt || !lastSuccessAt || stale)) {
    status = 'failed'
    reason = `${stale ? 'Última consulta bem-sucedida fora da janela de cinco dias; atualização atrasada.' : 'Estado de sucesso sem datas verificáveis; atualização não confirmada.'} ${reason}`
  }
  if (raw?.accessSuspended) {
    status = 'failed'
    if (!reason.includes('Coleta suspensa; sem novas tentativas automáticas.')) reason = `Coleta suspensa; sem novas tentativas automáticas. ${reason}`
  }
  return { id: source.id, label: source.label, url: source.url, enabled: source.enabled, automaticCollection: Boolean(source.automaticCollection), accessSuspended: Boolean(raw?.accessSuspended), status, reason, checkedAt, lastSuccessAt, stale, licenseUrl: source.licenseUrl || null }
}

export function normalizeSectorNews(data, now = Date.now()) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!record(data) || data.schemaVersion !== 1 || !record(data.topics) || !record(data.sourceStates)) throw new Error('Arquivo de notícias setoriais inválido ou versão não suportada.')
  if (!Number.isFinite(now)) now = Date.now()
  const states = Object.fromEntries(SECTOR_NEWS_SOURCES.map(source => [source.id, sourceState(source, data?.sourceStates?.[source.id], now)]))
  const topics = Object.fromEntries(SECTOR_NEWS_TOPICS.map(topic => {
    const sources = SECTOR_NEWS_SOURCES.filter(s => s.topics.includes(topic.id)).map(s => states[s.id])
    const rawItems = Array.isArray(data?.topics?.[topic.id]?.items) ? data.topics[topic.id].items : []
    const items = dedupeSectorNews(rawItems.map(item => validateSectorNewsItem(item, now).item).filter(item => item && sources.some(s => s.id === item.sourceId) && sectorNewsItemMatchesTopic(topic.id, item))).map(item => {
      const review = editorialReview(item)
      return review?.topics[topic.id] ? { ...item, relevanceNote: review.topics[topic.id].note, relevanceReviewedAt: review.reviewedAt } : item
    })
    const enabled = sources.filter(s => s.enabled), successful = enabled.filter(s => ['ok', 'empty', 'partial'].includes(s.status))
    let status
    if (!enabled.length || enabled.every(s => s.status === 'unavailable')) status = 'unavailable'
    else if (!successful.length) status = 'failed'
    else if (sources.some(s => !['ok', 'empty'].includes(s.status))) status = 'partial'
    else status = items.length ? 'ok' : 'empty'
    const checkedAt = newest(sources.map(s => s.checkedAt)), lastSuccessAt = newest(sources.map(s => s.lastSuccessAt))
    const notes = {
      unavailable: 'Cobertura ainda não disponível: nenhuma fonte homologada foi consultada com sucesso para este tema.',
      failed: 'A consulta falhou ou está atrasada. Itens de consultas anteriores, se exibidos, ainda passam pelo filtro das últimas 120 horas.',
      partial: `${items.length ? 'Há manchetes verificadas' : 'Nenhuma manchete relevante validada na janela'}; cobertura parcial, com fontes pendentes ou coleta limitada. Isso não significa ausência de notícias no setor.`,
      empty: 'Nenhuma manchete relevante encontrada nas fontes consultadas nas últimas 120 horas. Isso não significa ausência de notícias no setor.',
      ok: 'Manchetes nas fontes institucionais consultadas; sem promessa de cobertura de toda a imprensa ou do setor.',
    }
    return [topic.id, { ...topic, items, status, checkedAt, lastSuccessAt, coverageNote: notes[status], sources }]
  }))
  return { schemaVersion: 1, collection: SECTOR_NEWS_COLLECTION, generatedAt: beforeNow(data?.generatedAt, now), windowDays: NEWS_WINDOW_DAYS, windowStart: new Date(now - SECTOR_NEWS_WINDOW_MS).toISOString(), windowEnd: new Date(now).toISOString(), topics, sourceStates: states }
}
