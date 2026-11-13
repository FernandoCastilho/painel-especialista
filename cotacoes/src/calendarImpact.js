// Explicação de cada evento do calendário econômico: o que é, o efeito na economia e a ligação com o Brasil.
// O texto é fixo e escolhido pelo título do evento (inglês do Forex Factory ou português das fontes oficiais).
// Evento sem categoria mapeada não inventa explicação: é tratado como de impacto baixo.

// Canal de transmissão por país: por onde o evento chega ao Brasil.
export const LIGACAO_PAIS = {
  BR: 'Evento doméstico: mexe direto com os juros futuros (DI), o câmbio e a bolsa.',
  US: 'EUA: dita o juro e o dólar globais; dólar forte e Treasuries em alta pressionam real, bolsa e fluxo para emergentes.',
  CN: 'China: maior compradora de minério, soja e petróleo do Brasil; dados fortes sustentam exportações e o real.',
  EU: 'Zona do euro: o euro pesa no índice do dólar e a região é grande parceira comercial; efeito mais indireto, via dólar e apetite a risco.',
  GB: 'Reino Unido: efeito indireto, pelo apetite a risco global e pelo dólar.',
  JP: 'Japão: juro baixo financia o carry trade; alta do juro ou do iene tira dinheiro de emergentes, o Brasil incluído.',
  AU: 'Austrália: economia ligada a minério; serve de termômetro de commodities e da demanda chinesa.',
  CA: 'Canadá: economia ligada a petróleo; efeito indireto, via preço de commodities.',
  CH: 'Suíça: o franco é porto seguro; sinaliza aversão a risco, que costuma pesar sobre o real.',
  NZ: 'Nova Zelândia: efeito indireto, via apetite a risco e commodities agrícolas.',
}

// ordem importa: a primeira categoria que casa vale
export const CATEGORIAS = [
  { id: 'feriado', re: /holiday|feriado/i,
    nome: 'Feriado bancário', oque: 'Dia em que o mercado do país fecha ou opera com horário reduzido.',
    economia: 'Menos liquidez: negócios mais raros e movimentos de preço mais bruscos nas moedas do país.', brasil: 'Se o feriado é nos EUA, o dólar e os juros futuros negociam no Brasil com volume menor.' },
  { id: 'fala', re: /minutes|\bata\b|speaks|speech|testif|discurso|fala\b/i,
    nome: 'Ata ou discurso de autoridade', oque: 'Detalha como o banco central pensa e o que debateu na última reunião.',
    economia: 'Muda as apostas de juros futuros antes da próxima decisão, sem alterar a taxa vigente.', brasil: 'Move Treasuries e dólar na hora; o DI brasileiro costuma seguir, por contágio.' },
  { id: 'juros', re: /fomc|copom|funds rate|refinancing rate|rate decision|policy rate|cash rate|overnight rate|bank rate|monetary policy|press conference|rate statement|interest rate|decisão|selic|deposit facility|\bsnb\b/i,
    nome: 'Decisão de juros', oque: 'O banco central define a taxa básica de juros e explica os próximos passos.',
    economia: 'Juro mais alto encarece crédito e esfria a atividade e a inflação; mais baixo estimula. O tom do comunicado pesa tanto quanto o número.', brasil: 'Juro maior lá fora atrai capital dos emergentes: dólar sobe, curva DI abre e a bolsa sofre; o inverso alivia.' },
  { id: 'emprego', re: /payroll|non-?farm|employment|unemployment|jobless|jolts|job openings|earnings|labou?r|caged|desemprego|vagas/i,
    nome: 'Emprego e salários', oque: 'Mede quantos empregos surgiram, a taxa de desemprego e o crescimento dos salários.',
    economia: 'Mercado de trabalho forte sustenta consumo e salários, o que pressiona a inflação e adia cortes de juros.', brasil: 'Dado forte nos EUA eleva Treasuries e dólar; o real e a bolsa tendem a perder.' },
  { id: 'inflacao-produtor', re: /\bppi\b|producer price|import price|wholesale|produtor|preços de importação/i,
    nome: 'Preços ao produtor e importação', oque: 'Mede a variação de custos na porta da fábrica, antes de chegar ao consumidor.',
    economia: 'Antecipa a inflação ao consumidor: custo alto de produção tende a ser repassado aos preços.', brasil: 'Indica pressão de preços global; pesa nas apostas de juros e no câmbio.' },
  { id: 'inflacao', re: /\bcpi\b|ipca|inflation|\bpce\b|hicp|consumer price|inflação|\bigp/i,
    nome: 'Inflação ao consumidor', oque: 'Mede a variação dos preços que as famílias pagam. É o dado que mais guia a decisão de juros.',
    economia: 'Inflação acima do esperado antecipa juros altos por mais tempo; abaixo, abre espaço para cortes.', brasil: 'Surpresa de alta lá fora fortalece o dólar e abre a curva de juros; no Brasil, o IPCA move DI, Selic esperada e câmbio.' },
  { id: 'pib', re: /\bgdp\b|\bpib\b|produto interno/i,
    nome: 'PIB', oque: 'Soma tudo o que a economia produziu no trimestre: o retrato da atividade.',
    economia: 'Crescimento forte sustenta lucros e emprego; queda seguida de dois trimestres caracteriza recessão técnica.', brasil: 'Crescimento global forte ajuda commodities e exportações; o PIB brasileiro mexe com juros e bolsa.' },
  { id: 'pmi', re: /pmi|\bism\b|\bifo\b|\bzew\b|sentiment|confidence|tankan|empire state|philly|business climate|sentix|confiança|\bnahb\b/i,
    nome: 'Atividade e confiança (PMI, sondagens)', oque: 'Pesquisas com empresas e consumidores; adiantam o rumo da economia. PMI acima de 50 indica expansão.',
    economia: 'Costumam virar antes do PIB: queda sinaliza desaceleração à frente; alta, retomada.', brasil: 'PMI industrial forte (China, EUA) anima commodities e o real; fraco derruba minério e bolsa.' },
  { id: 'atividade', re: /retail sales|industrial|durable|factory|production|vendas no varejo|produção|personal (income|spending)|consumer spending|\bpmc\b|\bpim\b/i,
    nome: 'Consumo e produção', oque: 'Mede vendas no varejo, produção industrial e encomendas: o ritmo da demanda e da fábrica.',
    economia: 'Consumo e produção fortes indicam economia aquecida; fracos antecipam desaceleração e cortes de juros.', brasil: 'Demanda forte nos parceiros sustenta exportações e commodities; fraca pesa no real.' },
  { id: 'comercio', re: /trade balance|balança comercial|exports|imports|current account|conta corrente|goods trade/i,
    nome: 'Comércio exterior', oque: 'Diferença entre o que o país exporta e importa, e o saldo das contas externas.',
    economia: 'Déficit grande pressiona a moeda do país; superávit a sustenta. Também mostra demanda por produtos estrangeiros.', brasil: 'Compras da China e dos EUA de minério, soja e petróleo definem parte do fluxo de dólares para o Brasil.' },
  { id: 'energia', re: /crude|\boil\b|petr[óo]leo|natural gas|gas storage|opec|rig count|gasoline|distillate|cushing/i,
    nome: 'Petróleo e energia', oque: 'Estoques e produção de petróleo, gás e derivados.',
    economia: 'Estoque baixo ou produção cortada sobe o preço da energia, que alimenta a inflação.', brasil: 'Brasil é exportador de petróleo: preço alto favorece Petrobras, balança comercial e o real, mas pressiona combustíveis internos.' },
  { id: 'imoveis', re: /housing|home sales|building permits|mortgage|house price|construction|habita[çc][ãa]o|imóve|new home|existing home|pending home/i,
    nome: 'Mercado imobiliário', oque: 'Vendas, licenças e preços de imóveis; muito sensível a juros.',
    economia: 'Mostra o efeito do juro sobre o crédito: imóveis fracos antecipam desaceleração do consumo.', brasil: 'Efeito indireto, via juros e dólar nos EUA.' },
  { id: 'leilao', re: /auction|leilão/i,
    nome: 'Leilão de títulos', oque: 'O governo vende títulos para se financiar; a taxa mostra a procura dos investidores.',
    economia: 'Demanda fraca eleva as taxas de longo prazo e encarece o crédito em toda a economia.', brasil: 'Treasuries mais caras (taxas altas) puxam o dólar para cima e pesam nos emergentes.' },
  { id: 'focus', re: /focus/i,
    nome: 'Boletim Focus', oque: 'Pesquisa semanal do Banco Central com as projeções de mercado para Selic, IPCA, PIB e câmbio.',
    economia: 'Mostra para onde o mercado aposta; mudanças relevantes antecipam o tom do Copom.', brasil: 'Evento doméstico: revisões de IPCA e Selic movem o DI.' },
]

export const NIVEL = { high: 'Alto', medium: 'Médio', low: 'Baixo', holiday: 'Feriado' }

// { nome, oque, economia, brasil, nivel, mapeado }. Sem categoria: impacto baixo, sem explicação inventada.
export function explicarEvento(e) {
  const alvo = e?.impact === 'holiday' ? 'holiday' : String(e?.title ?? '')
  const cat = CATEGORIAS.find((c) => c.re.test(alvo))
  const pais = LIGACAO_PAIS[e?.country]
  if (!cat) {
    return { mapeado: false, nome: null, nivel: 'low', nivelFonte: e?.impact ?? null, oque: null, economia: 'Impacto baixo: sem efeito relevante mapeado sobre a economia.', brasil: 'Impacto baixo: sem correlação direta relevante mapeada com o Brasil.' }
  }
  const brasil = e.country === 'BR' ? LIGACAO_PAIS.BR : [cat.brasil, pais].filter(Boolean).join(' ')
  return { mapeado: true, nome: cat.nome, nivel: e.impact, nivelFonte: e.impact, oque: cat.oque, economia: cat.economia, brasil }
}

// ===== Nome em português dos eventos que chegam em inglês (Forex Factory) =====
// Formato: "Nome em português (sigla original)". O título é desmontado em país, estágio (prévia, final), termo e
// frequência (m/m, q/q, y/y); só é traduzido quando o termo está no dicionário. Evento sem tradução continua como veio.
// A explicação do balão (CATEGORIAS) segue usando o título original.
const FREQUENCIA = { 'm/m': 'variação mensal', 'q/q': 'variação trimestral', 'y/y': 'variação anual', 'q/y': 'trimestre contra o mesmo do ano anterior', '3m/3m': '3 meses contra os 3 anteriores', '3m/y': 'média de 3 meses, variação anual', 'ytd/y': 'acumulado no ano, variação anual' }
const ESTAGIO = { prelim: 'prévia', flash: 'prévia', advance: '1ª estimativa', second: '2ª estimativa', final: 'final', revised: 'revisado' }
const PAIS_DO_TITULO = { german: 'da Alemanha', french: 'da França', italian: 'da Itália', spanish: 'da Espanha' }
// termo em inglês (minúsculas) -> [nome em português, sigla original (opcional)]
const TERMOS = {
  // PIB
  'gdp': ['PIB', 'GDP'], 'gdp price index': ['Deflator do PIB', 'GDP'],
  // inflação ao consumidor e ao produtor
  'cpi': ['Inflação ao consumidor', 'CPI'], 'core cpi': ['Núcleo da inflação ao consumidor', 'Core CPI'], 'tokyo core cpi': ['Núcleo da inflação ao consumidor de Tóquio', 'Core CPI'],
  'pce price index': ['Inflação pelo índice PCE', 'PCE'], 'core pce price index': ['Núcleo da inflação pelo índice PCE', 'Core PCE'],
  'ppi': ['Inflação ao produtor', 'PPI'], 'core ppi': ['Núcleo da inflação ao produtor', 'Core PPI'], 'ppi input': ['Inflação ao produtor, insumos', 'PPI'], 'ppi output': ['Inflação ao produtor, produtos', 'PPI'],
  'wpi': ['Inflação no atacado', 'WPI'], 'rpi': ['Inflação no varejo', 'RPI'], 'import prices': ['Preços de importação'],
  // emprego
  'unemployment rate': ['Taxa de desemprego'], 'unemployment claims': ['Pedidos de seguro-desemprego'], 'claimant count change': ['Variação dos pedidos de auxílio-desemprego'],
  'non-farm employment change': ['Criação de empregos fora do setor agrícola, payroll', 'NFP'], 'adp non-farm employment change': ['Criação de empregos no setor privado', 'ADP'],
  'employment change': ['Criação de empregos'], 'average hourly earnings': ['Ganho médio por hora'], 'average earnings index': ['Ganho salarial médio'], 'average cash earnings': ['Ganho salarial médio'],
  'jolts job openings': ['Vagas de emprego abertas', 'JOLTS'], 'employment cost index': ['Índice de custo do emprego', 'ECI'], 'unit labor costs': ['Custo unitário do trabalho'], 'nonfarm productivity': ['Produtividade do trabalho'],
  'challenger job cuts': ['Demissões anunciadas', 'Challenger'],
  // consumo, varejo e indústria
  'retail sales': ['Vendas no varejo'], 'core retail sales': ['Núcleo das vendas no varejo'], 'wholesale sales': ['Vendas no atacado'], 'manufacturing sales': ['Vendas da indústria'],
  'industrial production': ['Produção industrial'], 'manufacturing production': ['Produção da indústria de transformação'], 'construction output': ['Produção da construção civil'],
  'factory orders': ['Encomendas à indústria'], 'durable goods orders': ['Pedidos de bens duráveis'], 'core durable goods orders': ['Núcleo dos pedidos de bens duráveis'],
  'capacity utilization rate': ['Uso da capacidade instalada'], 'business inventories': ['Estoques das empresas'], 'business investment': ['Investimento das empresas'], 'fixed asset investment': ['Investimento em ativos fixos'],
  'personal income': ['Renda pessoal'], 'personal spending': ['Gastos pessoais'], 'household spending': ['Gastos das famílias'], 'consumer credit': ['Crédito ao consumidor'], 'index of services': ['Índice de serviços'],
  // PMI e sondagens
  'manufacturing pmi': ['PMI industrial'], 'services pmi': ['PMI de serviços'], 'composite pmi': ['PMI composto'], 'construction pmi': ['PMI da construção'],
  'non-manufacturing pmi': ['PMI de serviços'], 'ism manufacturing pmi': ['PMI industrial do ISM'], 'ism services pmi': ['PMI de serviços do ISM'],
  'caixin manufacturing pmi': ['PMI industrial Caixin'], 'caixin services pmi': ['PMI de serviços Caixin'], 'chicago pmi': ['PMI de Chicago'],
  'empire state manufacturing index': ['Índice industrial Empire State'], 'philly fed manufacturing index': ['Índice industrial do Fed da Filadélfia'], 'richmond manufacturing index': ['Índice industrial do Fed de Richmond'],
  'businessnz manufacturing index': ['Índice industrial BusinessNZ'], 'cb leading index': ['Indicadores antecedentes do Conference Board', 'CB'], 'nfib small business index': ['Otimismo das pequenas empresas', 'NFIB'],
  'zew economic sentiment': ['Expectativas econômicas ZEW', 'ZEW'], 'ifo business climate': ['Clima de negócios Ifo', 'Ifo'], 'sentix investor confidence': ['Confiança do investidor Sentix', 'Sentix'],
  // confiança do consumidor
  'consumer confidence': ['Confiança do consumidor'], 'cb consumer confidence': ['Confiança do consumidor do Conference Board', 'CB'], 'uom consumer sentiment': ['Confiança do consumidor de Michigan', 'UoM'],
  'uom inflation expectations': ['Expectativas de inflação de Michigan', 'UoM'], 'gfk consumer confidence': ['Confiança do consumidor GfK', 'GfK'], 'gfk consumer climate': ['Confiança do consumidor GfK', 'GfK'],
  // comércio exterior e contas públicas
  'trade balance': ['Balança comercial'], 'goods trade balance': ['Balança comercial de bens'], 'usd-denominated trade balance': ['Balança comercial em dólares'], 'current account': ['Conta corrente'],
  'federal budget balance': ['Resultado do orçamento federal'], 'public sector net borrowing': ['Endividamento líquido do setor público'],
  // petróleo e energia
  'crude oil inventories': ['Estoques de petróleo'], 'natural gas storage': ['Estoques de gás natural'], 'api weekly statistical bulletin': ['Estoques de petróleo, boletim semanal', 'API'],
  // imóveis, crédito e moeda
  'building permits': ['Licenças de construção'], 'housing starts': ['Início de construção de moradias'], 'existing home sales': ['Vendas de imóveis usados'], 'new home sales': ['Vendas de imóveis novos'], 'pending home sales': ['Vendas pendentes de imóveis'],
  'mortgage delinquencies': ['Inadimplência das hipotecas'], 'new loans': ['Novos empréstimos'], 'm2 money supply': ['Oferta de moeda', 'M2'],
  // bancos centrais: decisões e comunicados
  'federal funds rate': ['Decisão de juros do Fed', 'Federal Funds Rate'], 'fomc statement': ['Comunicado do Fed', 'FOMC'], 'fomc press conference': ['Entrevista coletiva do Fed', 'FOMC'],
  'fomc meeting minutes': ['Ata da reunião do Fed', 'FOMC'], 'fomc economic projections': ['Projeções econômicas do Fed', 'FOMC'], 'beige book': ['Livro Bege do Fed', 'Beige Book'],
  'main refinancing rate': ['Decisão de juros do Banco Central Europeu', 'ECB'], 'ecb press conference': ['Entrevista coletiva do Banco Central Europeu', 'ECB'], 'ecb economic bulletin': ['Boletim econômico do Banco Central Europeu', 'ECB'],
  'monetary policy statement': ['Comunicado de política monetária'], 'monetary policy report': ['Relatório de política monetária'], 'monetary policy meeting minutes': ['Ata da reunião de política monetária'],
  'official bank rate': ['Decisão de juros do Banco da Inglaterra', 'BoE'], 'monetary policy summary': ['Resumo de política monetária do Banco da Inglaterra', 'BoE'], 'mpc official bank rate votes': ['Votos na decisão de juros do Banco da Inglaterra', 'MPC'],
  'boj policy rate': ['Decisão de juros do Banco do Japão', 'BoJ'], 'boj press conference': ['Entrevista coletiva do Banco do Japão', 'BoJ'], 'boj outlook report': ['Relatório de perspectivas do Banco do Japão', 'BoJ'],
  'cash rate': ['Decisão de juros do banco central da Austrália', 'RBA'], 'rba rate statement': ['Comunicado de juros do banco central da Austrália', 'RBA'], 'official cash rate': ['Decisão de juros do banco central da Nova Zelândia', 'RBNZ'],
  'overnight rate': ['Decisão de juros do Banco do Canadá', 'BoC'], 'boc rate statement': ['Comunicado de juros do Banco do Canadá', 'BoC'], 'snb policy rate': ['Decisão de juros do banco central da Suíça', 'SNB'],
  'bank holiday': ['Feriado bancário'],
}
// quem fala: cargo em inglês (minúsculas) -> [cargo em português, sigla original (opcional)]
const CARGOS = {
  'fed chair': ['presidente do Fed'], 'fomc member': ['dirigente do Fed', 'FOMC'], 'ecb president': ['presidente do Banco Central Europeu', 'ECB'],
  'boe gov': ['presidente do Banco da Inglaterra', 'BoE'], 'mpc member': ['dirigente do Banco da Inglaterra', 'MPC'], 'boj gov': ['presidente do Banco do Japão', 'BoJ'],
  'buba president': ['presidente do Bundesbank'], 'rba gov': ['presidente do banco central da Austrália', 'RBA'], 'rbnz gov': ['presidente do banco central da Nova Zelândia', 'RBNZ'],
  'boc gov': ['presidente do Banco do Canadá', 'BoC'], 'snb chairman': ['presidente do banco central da Suíça', 'SNB'], 'treasury sec': ['do Tesouro dos EUA'],
}
const comSigla = (nome, sigla) => (sigla ? `${nome} (${sigla})` : nome)
export function traduzirEvento(title) {
  const original = String(title ?? '').trim()
  let resto = original
  const pais = /^(German|French|Italian|Spanish)\s+/i.exec(resto)
  if (pais) resto = resto.slice(pais[0].length)
  const doPais = pais ? ` ${PAIS_DO_TITULO[pais[1].toLowerCase()]}` : ''
  const fala = /^(.+?)\s+(\S+)\s+Speaks$/i.exec(resto)
  if (fala) {
    const cargo = CARGOS[fala[1].toLowerCase()]
    return cargo ? comSigla(`Fala de ${fala[2]}, ${cargo[0]}`, cargo[1]) : original
  }
  const leilao = /^(\d+)-(y|m) Bond Auction$/i.exec(resto)
  if (leilao) return `Leilão de títulos de ${leilao[1]} ${leilao[2].toLowerCase() === 'y' ? 'anos' : 'meses'}${doPais}`
  const freq = /\s+(3m\/3m|3m\/y|ytd\/y|[mqy]\/[mqy])$/i.exec(resto)
  if (freq) resto = resto.slice(0, freq.index)
  const partes = []
  const antes = /^(Prelim|Flash|Advance|Second|Final|Revised)\s+/i.exec(resto)
  if (antes) { resto = resto.slice(antes[0].length); partes.push(ESTAGIO[antes[1].toLowerCase()]) }
  const depois = /\s+Flash Estimate$/i.exec(resto)
  if (depois) { resto = resto.slice(0, depois.index); partes.push(ESTAGIO.flash) }
  const termo = Object.hasOwn(TERMOS, resto.toLowerCase()) ? TERMOS[resto.toLowerCase()] : null
  if (!termo) return original
  if (freq) {
    const texto = FREQUENCIA[freq[1].toLowerCase()]
    if (!texto) return original
    partes.push(texto)
  }
  return comSigla([`${termo[0]}${doPais}`, ...partes].join(', '), termo[1])
}

// Previsto e anterior no padrão brasileiro: "0.0%" -> "0,0%", "194K" -> "194 mil", "1.2M" -> "1,2 mi", "-19.2B" -> "-19,2 bi".
// Muda só a apresentação (vírgula decimal, ponto de milhar e sufixo): não arredonda nem altera o valor.
// Formato desconhecido volta como veio.
const SUFIXO = { K: ' mil', M: ' mi', B: ' bi', T: ' tri', '%': '%' }
export function formatarValorCalendario(value) {
  if (typeof value !== 'string') return value
  const partes = value.split('|').map((parte) => {
    const m = /^\s*([+-]?)(\d+)(?:\.(\d+))?\s*([KMBT%]?)\s*$/.exec(parte)
    return m ? `${m[1]}${m[2].replace(/\B(?=(\d{3})+$)/g, '.')}${m[3] ? `,${m[3]}` : ''}${SUFIXO[m[4]] ?? ''}` : null
  })
  return partes.includes(null) ? value : partes.join(' | ')
}
