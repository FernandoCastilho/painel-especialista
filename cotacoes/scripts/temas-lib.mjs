// Notícias por setor (indústria, comércio, serviços) e por insumo (cobre, alumínio, aço, minério de ferro, petróleo e diesel),
// e as eleições nos EUA (aba de Notícias do Mercado).
// Mesma coleta da reforma tributária: buscas no Google Notícias, só títulos que tratam do tema, histórico de 5 dias.
import { mergeItems, WINDOW_DAYS } from './reforma-lib.mjs'
export { WINDOW_DAYS }

const re = (s) => new RegExp(s, 'i')
// `termos`: o título precisa citar o assunto. `contexto` (opcional): e precisa trazer contexto econômico, para tirar ruído
// (por exemplo, "cobre" também é verbo; "serviços" é palavra genérica).
export const TEMAS = [
  { id: 'industria', grupo: 'setor', label: 'Indústria',
    queries: ['indústria brasileira produção industrial', 'indústria PMI Brasil CNI Anfavea', 'indústria custos juros dólar exportação', 'siderurgia petroquímica montadoras produção Brasil'],
    termos: re('ind[úu]stria|industrial|f[áa]brica|montadora|siderurg|petroqu[íi]m|Anfavea|\\bCNI\\b|Abimaq|Abiquim|Fiesp|manufatur'),
    contexto: re('produ[çc][ãa]o|PMI|custo|demanda|vendas|exporta|importa|juros|d[óo]lar|tarifa|emprego|investimento|queda|alta|cresc|capacidade|estoque') },
  { id: 'veiculos-pesados', grupo:'setor',label:'Veículos pesados',
    queries:['ANFAVEA caminhões ônibus produção emplacamento exportação','veículos pesados caminhões mercado financiamento Brasil','caminhões ônibus vendas Brasil renovação frota'],
    termos:re('caminh[õo]es|caminh[ãa]o|[ôo]nibus|ve[íi]culos? pesad'),
    // Sem lista de palavras que derrubam (decisão de 18/11/2026): acidente, roubo ou morte só ficam de fora quando o título
    // não traz assunto de mercado. "Acidente com ônibus deixa feridos" sai; "Roubo de carga encarece o frete de caminhões" entra.
    contexto:re('emplac|licenciam|produ[çc][ãa]o|exporta|vendas|financia|mercado|frota|montadora|Anfavea|Fenabrave|frete|seguro de carga|encarece') },
  { id: 'comercio', grupo: 'setor', label: 'Comércio e consumo',
    queries: ['varejo vendas comércio Brasil', 'consumo das famílias confiança do consumidor', 'vendas no varejo IBGE CNC', 'supermercados e-commerce vendas Black Friday'],
    termos: re('varejo|com[ée]rcio|consumo|consumidor|lojista|supermercad|e-commerce|Abras|\\bCNC\\b|Black Friday'),
    contexto: re('vendas|confian[çc]a|infla[çc][ãa]o|cr[ée]dito|juros|endividamento|inadimpl|queda|alta|cresc|índice|pesquisa|IBGE|IPCA|renda') },
  { id: 'servicos', grupo: 'setor', label: 'Serviços',
    queries: ['setor de serviços volume IBGE', 'transporte logística frete Brasil', 'bancos crédito setor financeiro Brasil', 'tecnologia telecom serviços Brasil economia'],
    termos: re('setor de servi[çc]os|volume de servi[çc]os|\\bPMS\\b|log[íi]stica|transporte (?:rodovi|ferrovi|a[ée]re|de carga|mar[íi]tim)|frete|ferrovia|aviação|companhias a[ée]reas|turismo|bancos?\\b|fintech|telecom|tecnologia'),
    contexto: re('receita|volume|demanda|custo|tarifa|pre[çc]o|cr[ée]dito|juros|lucro|resultado|queda|alta|cresc|IBGE|investimento|leil[ãa]o|concess') },
  { id: 'telecom', grupo: 'setor', label: 'Internet e telecom',
    queries: ['telecomunicações internet banda larga Anatel', 'telecom 5G operadoras Vivo Claro TIM', 'provedores de internet fibra Brasil', 'data center nuvem internet infraestrutura Brasil'],
    termos: re('telecom|internet|banda larga|\\b5G\\b|fibra [óo]ptica|operadoras?|Anatel|provedor(?:es)?|Vivo\\b|\\bTIM\\b|\\bClaro\\b|data center|conectividade'),
    contexto: re('receita|invest|leil[ãa]o|espectro|tarifa|pre[çc]o|assinantes|clientes|lucro|resultado|regula|licen|expans|rede|cobertura|queda|alta|cresc|fus[ãa]o|aquisi|contrato') },
  // Madeira e base florestal (pedido de 17/11/2026, para visitas a indústrias de madeira). Uso educativo: entra toda matéria
  // que cite o setor, inclusive queda de preço, acidente, fiscalização e notícia de outros países (decisão do Fernando em
  // 18/11/2026: nenhuma matéria do setor fica de fora por causa de uma palavra). Sem filtro de contexto econômico.
  // Sai só o título em que "Madeira" é outra coisa (a ilha, o rio, sobrenome, o município de Serraria, o MDF-e) e que não
  // cita o setor em nenhum outro trecho.
  { id: 'madeira', grupo: 'setor', label: 'Madeira e base florestal',
    queries: ['madeira serrada compensado exportação preço', 'indústria madeireira setor florestal Brasil', 'painéis de madeira MDF MDP indústria moveleira', 'florestas plantadas eucalipto pinus madeira mercado'],
    termos: re(['madeir', 'serraria', '\\bMDF\\b(?!-e)', '\\bMDP\\b', 'compensados? (?:de (?:pinus|eucalipto)|brasileir)', 'florestas? plantadas?', 'setor florestal', 'base florestal',
      'concess\\S+ floresta', 'manejo florestal', 'eucalipto', '\\bpinus\\b', 'ABIMCI', '\\bIb[áa](?![\\wÀ-ú])', 'moveleir', 'Abim[óo]vel', '(?:ind[úu]stria|produ[çc][ãa]o|setor) de m[óo]veis',
      'Dexco', 'Duratex', 'Eucatex', 'Berneck', 'Arauco'].join('|')),
    // Outros sentidos da palavra. Não descartam a matéria: o trecho é apagado do título antes de procurar o setor, então
    // "Madeireiros escoam produção pelo Rio Madeira" entra e "Hidrelétricas do Madeira reduzem produção" não.
    homonimos: new RegExp([
      // a ilha
      'Ilha da Madeira', 'Governo (?:Regional )?da Madeira', 'Regi[ãa]o Aut[óo]noma da Madeira', '\\bPorto Santo\\b', 'Funchal', 'madeirense', 'arquip[ée]lago da Madeira',
      'aeroporto da Madeira', '(?:clima|tempo|custo de vida) na Madeira', 'vinhos? (?:da |de )?Madeira',
      // o rio
      'Rio Madeira', '\\b(?:do|no|pelo) Madeira\\b', 'Madeira-Mamor[ée]',
      // pessoas e lugares com o nome
      '(?:deputad[oa]|senador[a]?|vereador[a]?|prefeit[oa]|ministr[oa]|jogador|t[ée]cnico|atacante|zagueiro|goleiro) Madeira\\b', '(?:Prefeitura|munic[íi]pio|cidade) de Serraria',
    ].join('|'), 'gi') },
  { id: 'cobre', grupo: 'insumo', label: 'Cobre',
    queries: ['cobre preço LME', 'cobre China demanda estoques', 'cobre mineração Chile Peru produção', 'cobre tarifa Estados Unidos commodities'],
    termos: re('\\bcobre\\b|copper|Codelco|Freeport'),
    contexto: re('pre[çc]o|tonelada|\\bLME\\b|min[ée]rio|mina|mineradora|Chile|Peru|China|demanda|estoque|metal|metais|tarifa|commodit|oferta|produ[çc][ãa]o|Vale|Sossego|Salobo|Cara[íi]ba') },
  { id: 'aluminio', grupo: 'insumo', label: 'Alumínio',
    queries: ['alumínio preço LME', 'alumínio produção China tarifa', 'alumínio Albras Alcoa Novelis CBA', 'alumínio bauxita energia eletrointensivos'],
    termos: re('alum[íi]nio|aluminum|aluminium|bauxita|Albras|Novelis|\\bCBA\\b'),
    contexto: re('pre[çc]o|tonelada|\\bLME\\b|tarifa|China|produ[çc][ãa]o|energia|demanda|estoque|oferta|exporta|importa|custo|eletrointensiv') },
  { id: 'aco', grupo: 'insumo', label: 'Aço',
    homonimos: /(?:nervos?|homem|mulher|punho|cora[çc][ãa]o|vontade|cortina|dama) de a[çc]o/gi,
    queries: ['aço preço siderurgia Brasil', 'aço importação China antidumping', 'Gerdau CSN Usiminas aço resultado', 'aço tarifa produção demanda'],
    termos: re('\\baço\\b|siderurg|Gerdau|\\bCSN\\b|Usiminas|Aço Brasil|laminados?|\\bsteel\\b'),
    contexto: re('pre[çc]o|importa[çc]|antidumping|tarifa|produ[çc][ãa]o|China|demanda|custo|siderurg|vendas|cota|resultado|estoque|exporta') },
  { id: 'minerio', grupo: 'insumo', label: 'Minério de ferro',
    homonimos: /Vale do Sil[íi]cio|Vale do (?:Para[íi]ba|Jequitinhonha|S[ãa]o Francisco|Itaja[íi]|Ribeira|A[çc]o)/gi,
    queries: ['minério de ferro preço China', 'minério de ferro Vale produção', 'minério de ferro Dalian demanda siderurgia', 'minério de ferro exportação Brasil'],
    termos: re('min[ée]rio de ferro|iron ore|Dalian|Vale\\b'),
    contexto: re('pre[çc]o|tonelada|China|demanda|produ[çc][ãa]o|exporta|Dalian|siderurg|estoque|cota[çc][ãa]o|oferta|embarque|porto') },
  { id: 'petroleo', grupo: 'insumo', label: 'Petróleo e diesel',
    queries: ['petróleo Brent preço OPEP', 'diesel preço Petrobras ANP', 'gasolina diesel reajuste combustíveis', 'petróleo estoques EIA produção'],
    termos: re('petr[óo]leo|\\bBrent\\b|diesel|gasolina|combust[íi]ve|Petrobras|\\bANP\\b|\\bOPEP\\b|\\bOPEC\\b'),
    contexto: re('pre[çc]o|barril|reajuste|estoque|produ[çc][ãa]o|OPEP|OPEC|demanda|oferta|refinaria|pol[íi]tica de pre|cota[çc][ãa]o|alta|queda|importa|exporta') },
  // Insumos da apresentação ao cliente (alimentos, confecção, proteína animal, agro, siderurgia): só o preço e o mercado, sem ruído de receita ou saúde.
  { id: 'trigo', grupo: 'insumo', label: 'Trigo',
    queries: ['trigo preço safra Brasil Argentina', 'trigo Chicago cotação importação', 'trigo farinha moinhos preço'],
    termos: re('\\btrigo\\b|\\bwheat\\b|farinha de trigo|moinhos?'),
    contexto: re('pre[çc]o|safra|cota[çc][ãa]o|Chicago|importa|exporta|Argentina|R[úu]ssia|tonelada|saca|oferta|demanda|alta|queda|colheita|clima') },
  { id: 'acucar', grupo: 'insumo', label: 'Açúcar',
    queries: ['açúcar preço Nova York cotação', 'açúcar etanol usinas safra', 'açúcar exportação Brasil Índia'],
    termos: re('a[çc][úu]car|\\bsugar\\b|usinas?\\b|sucroalcool|sucroenerg'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|safra|moagem|exporta|Nova York|Londres|[ÍI]ndia|etanol|libra|tonelada|oferta|demanda|alta|queda|mix') },
  { id: 'carne', grupo: 'insumo', label: 'Carne bovina',
    queries: ['boi gordo arroba preço', 'carne bovina exportação China preço', 'frigoríficos JBS Marfrig Minerva carne'],
    termos: re('boi gordo|arroba|carne bovina|frigor[íi]fic|\\bJBS\\b|Marfrig|Minerva|pecu[áa]ri'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|exporta|China|EUA|tarifa|abate|oferta|demanda|alta|queda|habilita|arroba|resultado|embarque') },
  { id: 'algodao', grupo: 'insumo', label: 'Algodão',
    queries: ['algodão preço pluma cotação', 'algodão safra Brasil exportação', 'algodão Nova York cotton'],
    termos: re('algod[ãa]o|\\bcotton\\b|pluma'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|safra|exporta|Nova York|libra|arroba|tonelada|oferta|demanda|alta|queda|China|t[êe]xtil|colheita') },
  { id: 'carvao', grupo: 'insumo', label: 'Carvão',
    queries: ['carvão mineral preço siderurgia', 'carvão metalúrgico coque importação', 'carvão térmico Austrália preço'],
    termos: re('carv[ãa]o|\\bcoal\\b|coque'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|siderurg|importa|exporta|Austr[áa]lia|China|tonelada|oferta|demanda|alta|queda|usina|energia|mina') },
  { id: 'cacau', grupo: 'insumo', label: 'Cacau',
    queries: ['cacau preço Nova York cotação', 'cacau safra Costa do Marfim Gana', 'cacau chocolate indústria custo'],
    termos: re('\\bcacau\\b|\\bcocoa\\b|am[êe]ndoas? de cacau'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|safra|Costa do Marfim|Gana|Nova York|Londres|tonelada|oferta|demanda|alta|queda|chocolate|colheita|clima') },
  { id: 'cafe', grupo: 'insumo', label: 'Café',
    queries: ['café arábica preço saca cotação', 'café safra Brasil exportação Cecafé', 'café Nova York tarifa preço'],
    termos: re('\\bcaf[ée]s?(?![\\wÀ-ú])|ar[áa]bica|\\brobusta\\b|conilon|Cecaf[ée]'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|safra|saca|exporta|Nova York|Londres|tarifa|oferta|demanda|alta|queda|colheita|clima|estoque') },
  { id: 'fertilizantes', grupo: 'insumo', label: 'Fertilizantes',
    queries: ['fertilizantes preço ureia potássio', 'fertilizantes importação Brasil Rússia China', 'adubo preço safra custo produtor'],
    termos: re('fertilizant|\\bureia\\b|\\badubo\\b|pot[áa]ssio|fosfato|\\bNPK\\b|\\bMosaic\\b|Nutrien'),
    contexto: re('pre[çc]o|cota[çc][ãa]o|importa|R[úu]ssia|China|Marrocos|tonelada|safra|custo|oferta|demanda|alta|queda|produtor|tarifa|g[áa]s') },
  // Resumo › Notícias › Moedas: o que mexe com cada moeda acompanhada no painel (dólar, euro, iene e yuan).
  { id: 'moeda-usd', grupo: 'moeda', label: 'Dólar',
    queries: ['dólar hoje câmbio real', 'dólar fecha sobe cai real', 'dólar Banco Central Fed câmbio'],
    termos: re('d[óo]lar|\\bUSD\\b'),
    contexto: re('real|R\\$|BRL|c[âa]mbio|cota|sobe|cai|alta|queda|fecha|abre|Fed|juros|Treasur|BC\\b|Banco Central|swap|leil') },
  { id: 'moeda-eur', grupo: 'moeda', label: 'Euro',
    queries: ['euro câmbio real hoje', 'euro BCE juros câmbio', 'euro dólar cotação zona do euro'],
    termos: re('\\beuro\\b|\\bEUR\\b|\\bBCE\\b|zona do euro|Lagarde'),
    contexto: re('c[âa]mbio|cota|d[óo]lar|real|juros|infla|alta|queda|sobe|cai|taxa') },
  { id: 'moeda-jpy', grupo: 'moeda', label: 'Iene',
    queries: ['iene câmbio Banco do Japão', 'iene dólar cotação BoJ juros', 'yen dollar Bank of Japan'],
    termos: re('\\biene\\b|\\byen\\b|\\bJPY\\b|\\bBoJ\\b|Banco do Jap[ãa]o|Bank of Japan'),
    contexto: re('c[âa]mbio|cota|d[óo]lar|dollar|juros|rate|alta|queda|interven|sobe|cai|weak|strong') },
  { id: 'moeda-cnh', grupo: 'moeda', label: 'Yuan',
    queries: ['yuan câmbio China dólar', 'yuan PBOC cotação juros', 'yuan dollar PBOC'],
    termos: re('\\byuan\\b|renminbi|\\bCNH\\b|\\bCNY\\b|\\bPBOC\\b|Banco do Povo'),
    contexto: re('c[âa]mbio|cota|d[óo]lar|dollar|juros|rate|alta|queda|exporta|tarifa|sobe|cai|fixing|weak|strong') },
  // Resumo › Notícias: eleições nos EUA e o efeito no mercado (dólar, Treasuries, bolsas). Exige termo de eleição e contexto americano.
  { id: 'eleicoes-eua', grupo: 'mercado', label: 'Eleições nos EUA',
    queries: ['eleições americanas mercado financeiro dólar', 'eleições Estados Unidos midterms resultado Congresso', 'midterms Trump Câmara Senado mercado', 'eleições EUA impacto Ibovespa juros Treasuries'],
    termos: re('elei[çc]|midterms?|eleitor|urnas|vota[çc][ãa]o|apura[çc][ãa]o|pesquisa eleitoral'),
    contexto: re('EUA|Estados Unidos|americana?s?|Trump|midterms?|republican|democrat|Congresso|Senado|C[âa]mara|Casa Branca|Wall Street|Treasur') },
]
// Palavras de mercado comuns a todos os temas de setor e de insumo (decisão de 18/11/2026): a lista própria de cada tema era
// curta e deixava de fora notícia do assunto ("demitem", "férias coletivas", "lucro"). Cada palavra vem presa ao sentido de
// mercado ("recorde de exportação", não só "recorde"; "capacidade produtiva", não "capacidade para 40 passageiros"), para não
// abrir a porta ao uso comum ("câmera cobre o show", receita de bolo de trigo, "café faz bem?"). Moedas e eleições seguem só
// com a lista própria; madeira não tem filtro de mercado.
export const MERCADO_AMPLO = [
  'demi(?:te|tem|tiu|tiram|tir|ss[ãa]o|ss[õo]es)\\b', 'f[ée]rias coletivas', 'fecha (?:unidade|usina|mina|f[áa]brica)', '(?:abre|inaugura|constr[óo]i|amplia|paralisa|suspende|desativa) (?:a |sua |uma |nova )?f[áa]brica', 'mineradora',
  'usinas? (?:de|sider|termel|t[ée]rmica|hidrel|a[çc]ucareira)', 'investe\\b(?! contra)|investem|investiu|investir|investiment|investidor', 'lucr(?:o|os|a|am|ou|aram)\\b',
  'preju[íi]zo (?:l[íi]quido|de R\\$|bilion|milion|no trimestre|trimestral|no ano)', '(?:tem|registra|reverte|amplia) preju',
  'receita (?:l[íi]quida|bruta|de vendas)', 'faturamento', 'balan[çc]o (?:trimestral|do trimestre|anual|patrimonial|financeiro)', 'divulga balan',
  'sobretaxa', 'antidumping', 'tarifa[çc]o', 'tarifas? (?:de (?:importa|exporta)|dos EUA|americanas?|de Trump|sobre|extras?|adicionais?)',
  'aquisi[çc]', 'fus[ãa]o (?:com|entre|de empresas)', 'cota[çc][ãa]o', 'export', 'importa(?:[çc]|d|dor|m\\b|r\\b)|(?<!n[ãa]o |que |pouco |mais |menos )importa\\b',
  'financiamento', 'linha de cr[ée]dito', 'cr[ée]dito (?:rural|agr|para|do BNDES|[àa] exporta|de carbono)', 'recorde (?:de|na|no|em) (?:produ|vendas|export|import|safra|lucro|receita|embarque|faturamento|moagem|pre[çc]o|emplacamento|colheita)',
  '(?:pre[çc]o|safra|produ[çc][ãa]o|exporta[çc][ãa]o|vendas) recorde', 'capacidade (?:produtiva|instalada|de produ)',
  'amplia(?:r|[çc][ãa]o)? (?:a |sua )?(?:produ|capacidade|f[áa]brica|unidade|planta|opera|vendas|exporta)', 'nova (?:linha|unidade|planta|f[áa]brica)',
  '(?:abre|fecha|corta|gera|cria|elimina) (?:\\d[\\d.,]* )?(?:mil )?(?:vagas|empregos|postos)']
// Safra e colheita só contam nos temas de insumo: em veículos pesados, "caminhão com safra de milho tomba" é acidente.
export const MERCADO_AGRO = ['safra', 'colheita']
// Nas listas próprias, "importa" não pode pegar "importante" nem "não importa", e "invest" não pode pegar "investiga" nem
// "investe contra".
const IMPORTA = String.raw`importa(?:[çc]|d|dor|m\b|r\b)|(?<!n[ãa]o |que |pouco |mais |menos )importa\b`
const INVESTE = String.raw`investe\b(?! contra)|investem|investiu|investir|investiment|investidor`
const SEM_FALSO = (fonte) => fonte.replace(/importa(?:\[[^\]]*\])?/g, `(?:${IMPORTA})`).replace(/invest(?:imento)?/g, `(?:${INVESTE})`)
for (const t of TEMAS) {
  if (!['setor', 'insumo'].includes(t.grupo) || !t.contexto) continue
  const lista = [...MERCADO_AMPLO, ...(t.grupo === 'insumo' ? MERCADO_AGRO : [])]
  t.contexto = new RegExp(`${SEM_FALSO(t.contexto.source)}|${lista.join('|')}`, 'i')
}

export const TEMA_IDS = TEMAS.map((t) => t.id)
// `homonimos` (opcional): outros sentidos da palavra do setor. O trecho sai do título antes de procurar o setor; a matéria
// só fica de fora se não sobrar nenhuma menção ao setor.
export const relevanteTema = (tema, title) => {
  const texto = tema.homonimos ? String(title ?? '').replace(tema.homonimos, ' ') : title
  return (!tema.excluir || !tema.excluir.test(title)) && tema.termos.test(texto) && (!tema.contexto || tema.contexto.test(title))
}

export function temasFile(porTema, now, { stale = false, errors = [] } = {}) {
  return { schemaVersion: 1, generatedAt: now, windowDays: WINDOW_DAYS, stale, errors, temas: Object.fromEntries(TEMAS.map((t) => [t.id, { label: t.label, grupo: t.grupo, items: porTema[t.id] ?? [] }])) }
}
// Veículos de economia e negócios de referência (Valor, Folha, InfoMoney, Reuters e outros).
export const PREFERIDOS = /valor|folha|estad[aã]o|globo|g1\b|cnn|infomoney|exame|bloomberg|reuters|investing|money times|poder360|uol|veja|[ée]poca|brazil journal|seu dinheiro|bnamericas|ag[eê]ncia brasil|ag[eê]ncia de not[ií]cias da ind[uú]stria|cni|brasil mineral|not[ií]cias de minera[cç][aã]o|mining|teletime|tele\.?s[ií]ntese|mobile time|converge|e-investidor|neofeed|cnbc|financial times|wall street journal|forbes|istoé dinheiro|isto[eé] dinheiro|correio braziliense|o tempo|zero hora|gaúchazh|agência estado|broadcast|metr[oó]poles|band|r7|sbt|valor international/i
export const MIN_PREFERIDOS = 6 // mantido para quem já usa; a régua abaixo não descarta mais por quantidade (decisão de 18/11/2026)
// Régua dos veículos (decisão de 18/11/2026: "eficiente e com a informação real"): de cada fato fica uma versão, a mais recente
// de veículo de referência quando houver; a matéria de outro portal entra quando traz um fato que ainda não está na lista. Sai a
// repetição (o mesmo fato contado de novo, reconhecido pelas palavras do título) e o que não tem informação útil (título em outra
// língua, coluna diária traduzida sobre preço no Vietnã). Antes, bastavam 6 matérias de referência para todas as outras
// sumirem, inclusive as que traziam fato novo.
const VAZIAS = new Set(['para', 'como', 'mais', 'menos', 'sobre', 'apos', 'entre', 'pelo', 'pela', 'pelos', 'pelas', 'contra', 'desde', 'ainda', 'tambem',
  'este', 'esta', 'isso', 'essa', 'esse', 'sera', 'pode', 'podem', 'diz', 'dizem', 'veja', 'hoje', 'nesta', 'neste', 'semana', 'segundo', 'aponta', 'mostra'])
const palavrasDoTitulo = (titulo) => new Set(String(titulo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9%]+/)
  .filter((w) => (w.length > 3 || /\d/.test(w)) && !VAZIAS.has(w)))
const TRES_DIAS = 3 * 864e5
// Mesma notícia: até 3 dias de distância, 4 palavras ou mais em comum e a maior parte das palavras do título mais curto no
// outro (70%). Se os dois títulos trazem números e nenhum se repete (outra data, outro percentual), são fatos diferentes.
export function mesmoFato(a, b) {
  if (a.t && b.t && Math.abs(a.t - b.t) > TRES_DIAS) return false
  const pa = palavrasDoTitulo(a.title), pb = palavrasDoTitulo(b.title)
  const na = [...pa].filter((w) => /\d/.test(w)), nb = [...pb].filter((w) => /\d/.test(w))
  if (na.length && nb.length && !na.some((n) => nb.includes(n))) return false
  const comuns = [...pa].filter((w) => pb.has(w)).length
  return comuns >= 4 && comuns / Math.min(pa.size, pb.size) >= 0.7
}
// Sem informação útil: título em outra língua (letras do vietnamita, cirílico, árabe, chinês, japonês, coreano) e as colunas
// diárias traduzidas do Vietnam.vn ("Preços da gasolina e do diesel hoje, 15 de novembro…"), que tratam do preço no Vietnã.
const OUTRA_LINGUA = /[\u0103\u0111\u01a1\u01b0\u1ea0-\u1ef9\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/i
const COLUNA_DIARIA_TRADUZIDA = (i) => /vietnam\.vn/i.test(i.source ?? '') && /\bhoje\b[^:]*\d/i.test(i.title ?? '')
export const semInformacaoUtil = (i) => OUTRA_LINGUA.test(i.title ?? '') || COLUNA_DIARIA_TRADUZIDA(i)
// A lista chega da mais recente para a mais antiga; de cada fato fica a primeira versão, com preferência pelo veículo de referência.
export function filtraVeiculos(items) {
  const deReferencia = (i) => PREFERIDOS.test(i.source ?? '')
  const uteis = items.filter((i) => !semInformacaoUtil(i))
  const bons = []
  for (const i of uteis) if (deReferencia(i) && !bons.some((b) => mesmoFato(b, i))) bons.push(i)
  const mantidos = []
  for (const i of uteis) {
    if (deReferencia(i)) { if (bons.includes(i)) mantidos.push(i); continue }
    if (bons.some((b) => mesmoFato(b, i)) || mantidos.some((m) => !deReferencia(m) && mesmoFato(m, i))) continue
    mantidos.push(i)
  }
  return mantidos
}
export const mergeTema = (tema, fresh, previous, now) => filtraVeiculos(mergeItems(fresh, previous, now, WINDOW_DAYS, (title) => relevanteTema(tema, title)))
