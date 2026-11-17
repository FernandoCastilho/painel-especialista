import { recentNews } from './newsWindow.js'
// Apresentação para o cliente: catálogo de setores e itens de mercado, leitura dos dados que o painel já coleta e o roteiro dos slides.
// Só formata o que já existe nos arquivos do painel; não consulta fontes novas nem inventa números: sem dado, o slide diz que falta.
import { INSUMOS } from './insumos.js'
import { nf } from './format.js'
import { upcoming } from './agenda.js'
import { explicarEvento } from './calendarImpact.js'

const DIA = 864e5

// Itens de mercado que podem entrar na apresentação. `tipo`: moeda (cotação do painel), commodity (Pink Sheet mensal, com preço diário
// quando há), petroleo (Brent diário da EIA), frete (índice mensal BLS), noticia (só matérias, sem série de preço) ou planejado (coleta ainda não existe).
export const ITENS = {
  usd: { id: 'usd', label: 'Dólar', tipo: 'moeda', code: 'USD', tema: 'moeda-usd', move: ['Juros nos EUA (Fed) e diferencial para a Selic: juro alto lá fora tira dólares de emergentes.', 'Fluxo comercial e financeiro: exportações de commodities, investimento estrangeiro e saída de capital.', 'Risco fiscal e político no Brasil; eleições e ruído em Brasília pesam no prêmio de risco.', 'Aversão a risco global: crises e guerras fortalecem o dólar contra todas as moedas.'] },
  eur: { id: 'eur', label: 'Euro', tipo: 'moeda', code: 'EUR', tema: 'moeda-eur', move: ['Juros do BCE contra os do Fed: a paridade EUR/USD define boa parte do EUR/BRL.', 'Atividade na Europa (PMI, Alemanha) e preço da energia no continente.', 'O euro em reais carrega o movimento do dólar: dólar forte no Brasil puxa o euro junto.'] },
  cnh: { id: 'cnh', label: 'Yuan', tipo: 'moeda', code: 'CNH', tema: 'moeda-cnh', move: ['Política do Banco do Povo da China: fixing diário e intervenções seguram a moeda numa faixa.', 'Tarifas e relação comercial com os EUA; demanda chinesa por minério, soja e petróleo.', 'Yuan mais fraco barateia o produto chinês importado em dólar; mais forte encarece.'] },
  jpy: { id: 'jpy', label: 'Iene', tipo: 'moeda', code: 'JPY', tema: 'moeda-jpy', move: ['Juros do Banco do Japão: ainda baixos, financiam o carry trade; alta do juro valoriza o iene.', 'Aversão a risco: o iene é porto seguro e sobe em crises.'] },
  minerio: { id: 'minerio', label: 'Minério de ferro', tipo: 'commodity', commodity: 'iron-ore', tema: 'minerio', insumo: 'minerio', unidade: 't' },
  petroleo: { id: 'petroleo', label: 'Petróleo (Brent)', tipo: 'petroleo', tema: 'petroleo', insumo: 'petroleo', unidade: 'barril' },
  cobre: { id: 'cobre', label: 'Cobre', tipo: 'commodity', commodity: 'copper', diario: 'cobre', tema: 'cobre', insumo: 'cobre', unidade: 't' },
  aluminio: { id: 'aluminio', label: 'Alumínio', tipo: 'commodity', commodity: 'aluminum', tema: 'aluminio', insumo: 'aluminio', unidade: 't' },
  aco: { id: 'aco', label: 'Aço', tipo: 'noticia', tema: 'aco', insumo: 'aco', semSerie: 'O aço não tem série de preço pública diária neste painel: a leitura é pelas matérias dos últimos cinco dias e pelo custo do minério de ferro.' },
  soja: { id: 'soja', label: 'Soja', tipo: 'commodity', commodity: 'soybeans', unidade: 't', move: ['Safra e clima no Brasil, na Argentina e nos EUA.', 'Compras da China e política de biocombustíveis (óleo de soja).', 'Dólar: a soja é cotada em US$; real fraco melhora a receita do produtor em reais.'] },
  milho: { id: 'milho', label: 'Milho', tipo: 'commodity', commodity: 'corn', unidade: 't', move: ['Safra e clima (EUA, Brasil, Argentina) e estoques finais do USDA.', 'Demanda por ração (proteína animal) e por etanol de milho.', 'Dólar e frete interno; a segunda safra brasileira pesa no preço local.'] },
  ouro: { id: 'ouro', label: 'Ouro', tipo: 'commodity', commodity: 'gold', unidade: 'oz', move: ['Juros reais nos EUA e dólar: juro baixo e dólar fraco favorecem o ouro.', 'Compras de bancos centrais e busca por proteção em crises.'] },
  frete: { id: 'frete', label: 'Frete marítimo', tipo: 'frete', move: ['Oferta de navios e contêineres contra a demanda do comércio global.', 'Rotas: Mar Vermelho, Canal do Panamá e congestionamento em portos.', 'Preço do combustível marítimo (bunker), ligado ao petróleo.'] },
  trigo: { id: 'trigo', label: 'Trigo', tipo: 'commodity', commodity: 'wheat', tema: 'trigo', unidade: 't', move: ['Safra e clima nos EUA, na Rússia e na Argentina; o Brasil importa boa parte do que consome.', 'Dólar e frete: o trigo importado chega em US$; o nacional acompanha a paridade de importação.', 'Estoques mundiais e política de exportação da Rússia.'] },
  acucar: { id: 'acucar', label: 'Açúcar', tipo: 'commodity', commodity: 'sugar', tema: 'acucar', unidade: 'lb', moeda: 'US¢', move: ['Mix açúcar/etanol das usinas: etanol mais rentável tira açúcar da oferta.', 'Safra no Centro-Sul, na Índia e na Tailândia; clima e monções.', 'Dólar: o açúcar é cotado em US¢/libra em Nova York; real fraco favorece a exportação.'] },
  carne: { id: 'carne', label: 'Carne bovina', tipo: 'commodity', commodity: 'beef', tema: 'carne', unidade: 'kg', move: ['Exportação para a China e habilitações sanitárias; tarifas dos EUA.', 'Ciclo pecuário: oferta de boi gordo e preço da arroba.', 'Custo da ração (milho e farelo de soja) e dólar na receita de exportação.'] },
  algodao: { id: 'algodao', label: 'Algodão', tipo: 'commodity', commodity: 'cotton', tema: 'algodao', unidade: 'lb', moeda: 'US¢', move: ['Safra no Brasil (Mato Grosso) e nos EUA; o Brasil virou o maior exportador.', 'Demanda têxtil na China e no Sudeste Asiático; concorrência das fibras sintéticas (petróleo).', 'Dólar: cotação em Nova York em US¢/libra.'] },
  carvao: { id: 'carvao', label: 'Carvão', tipo: 'commodity', commodity: 'coal', tema: 'carvao', unidade: 't', move: ['Demanda de energia na China e na Índia; o Brasil importa o carvão metalúrgico da siderurgia.', 'Oferta da Austrália e da Indonésia; clima, portos e logística.', 'Preço do gás natural e política climática: carvão compete com gás na geração.'] },
  cacau: { id: 'cacau', label: 'Cacau', tipo: 'commodity', commodity: 'cocoa', tema: 'cacau', unidade: 'kg', move: ['Safra na Costa do Marfim e em Gana (mais da metade da oferta mundial); clima e doenças das lavouras.', 'Estoques nas bolsas de Nova York e Londres; demanda da indústria de chocolate.', 'Dólar: o cacau é cotado em US$; a indústria brasileira importa parte da amêndoa.'] },
  cafe: { id: 'cafe', label: 'Café', tipo: 'commodity', commodity: 'coffee', tema: 'cafe', unidade: 'lb', moeda: 'US¢', move: ['Safra brasileira (bienalidade, geada e seca) e do Vietnã (robusta).', 'Estoques certificados em Nova York e tarifas de importação nos EUA.', 'Dólar: cotação em US¢/libra; real fraco incentiva a exportação e sustenta o preço interno.'] },
  fertilizantes: { id: 'fertilizantes', label: 'Fertilizantes (ureia)', tipo: 'commodity', commodity: 'urea', tema: 'fertilizantes', unidade: 't', move: ['Preço do gás natural (matéria-prima da ureia) e oferta da Rússia, da China e do Oriente Médio.', 'O Brasil importa mais de 80% do que usa: dólar e frete pesam direto no custo da safra.', 'Calendário de compra: o produtor compra antes do plantio; atraso de câmbio e logística muda o custo.'] },
  // Coletas ainda não existentes: aparecem na montagem como "em breve" e não entram no roteiro.
  energia: { id: 'energia', label: 'Energia elétrica', tipo: 'planejado' },
  incc: { id: 'incc', label: 'INCC', tipo: 'planejado' },
}
export const ITEM_IDS = Object.keys(ITENS)

// Setores: a cadeia (o que entra, o que a empresa faz, para quem vende), os itens que entram por padrão e as perguntas para a conversa.
// A lista nasce da carteira atendida (saúde, farmoquímico, alimentos, confecção, móveis, metalmecânica, construção, telecom, varejo)
// e cobre o restante do mercado brasileiro (agro, sucroenergético, siderurgia, automotivo, logística, comércio por subsetor). A ordem dos itens é a dos slides.
export const SETORES_APRESENTACAO = [
  { id: 'metalmecanica', grupo: 'Indústria', label: 'Metalmecânica e equipamentos', itens: ['aco', 'cobre', 'aluminio', 'usd', 'eur', 'minerio'],
    cadeia: { entradas: ['Aço e inox', 'Cobre e alumínio', 'Componentes importados (Europa, China)'], processo: 'Usinagem, montagem e integração', saidas: ['Indústria e agro', 'Exportação (ACC/ACE)', 'Projetos com BNDES/Finame'] },
    perguntas: ['Qual fatia do custo é metal e como o contrato de venda repassa a variação?', 'Há importação de componentes? Em qual moeda e com qual prazo de pagamento?', 'Exporta? Quais moedas e quais prazos de recebimento?'] },
  { id: 'siderurgia', grupo: 'Indústria', label: 'Siderurgia e mineração', itens: ['minerio', 'carvao', 'aco', 'usd', 'cnh'],
    cadeia: { entradas: ['Minério de ferro', 'Carvão metalúrgico (importado)', 'Energia e sucata'], processo: 'Redução, aciaria e laminação', saidas: ['Construção civil', 'Automotivo e máquinas', 'Exportação'] },
    perguntas: ['Contratos de venda indexados a que referência (minério 62% Fe, aço plano)?', 'Qual a exposição ao aço importado da China e às medidas antidumping?', 'Carvão e minério: compra em dólar? Há hedge?'] },
  { id: 'automotivo', grupo: 'Indústria', label: 'Automotivo e autopeças', itens: ['aco', 'aluminio', 'cobre', 'usd', 'eur'],
    cadeia: { entradas: ['Aço e alumínio', 'Cobre e eletrônica', 'Componentes importados'], processo: 'Estampagem, usinagem e montagem', saidas: ['Montadoras', 'Mercado de reposição', 'Exportação'] },
    perguntas: ['Reajuste com as montadoras segue qual índice e com que defasagem?', 'Qual o conteúdo importado por peça e em qual moeda?', 'Há financiamento de máquinas (Finame) previsto?'] },
  { id: 'saude', grupo: 'Indústria', label: 'Saúde: dispositivos e próteses', itens: ['usd', 'eur', 'cnh', 'aco', 'frete'],
    cadeia: { entradas: ['Polímeros e resinas', 'Aço inox e titânio', 'Componentes importados (China, Europa)'], processo: 'Fabricação, importação e distribuição', saidas: ['Hospitais e clínicas', 'SUS e convênios', 'Distribuidores'] },
    perguntas: ['Quanto do custo é importado e em qual moeda (dólar, euro)?', 'Prazo médio de recebimento do SUS e dos convênios? Como financia esse ciclo?', 'Importação com Finimp ou pagamento à vista? Há trava de câmbio?'] },
  { id: 'farmoquimico', grupo: 'Indústria', label: 'Farmoquímico e laboratorial', itens: ['usd', 'cnh', 'eur', 'petroleo', 'frete'],
    cadeia: { entradas: ['Insumos ativos e reagentes (China, Índia)', 'Solventes e energia', 'Embalagens'], processo: 'Fracionamento, síntese e distribuição', saidas: ['Farmácias magistrais', 'Indústrias e laboratórios', 'Hospitais'] },
    perguntas: ['Qual a fatia dos insumos importados e de quais países?', 'Compra em dólar com prazo? Finimp, 4131 ou pagamento à vista?', 'Como o preço de venda acompanha o câmbio: tabela mensal ou repasse imediato?'] },
  { id: 'alimentos', grupo: 'Indústria', label: 'Alimentos e bebidas', itens: ['trigo', 'milho', 'soja', 'acucar', 'cacau', 'carne', 'usd'],
    cadeia: { entradas: ['Grãos e farinhas', 'Proteína animal', 'Açúcar, cacau e embalagens'], processo: 'Processamento e distribuição', saidas: ['Varejo e atacado', 'Food service', 'Exportação'] },
    perguntas: ['Quais matérias-primas pesam mais no custo e como são compradas (safra, contrato, spot)?', 'Há exposição ao dólar nos insumos ou nas vendas?', 'Como o preço de venda ao varejo acompanha o custo? Com que defasagem?'] },
  { id: 'confeccao', grupo: 'Indústria', label: 'Confecção e têxtil', itens: ['usd', 'cnh', 'algodao', 'petroleo'],
    cadeia: { entradas: ['Algodão', 'Fibras sintéticas (poliamida, elastano)', 'Tecidos e aviamentos importados'], processo: 'Fiação, tecelagem e confecção', saidas: ['Varejo próprio', 'Atacado e marcas', 'Exportação'] },
    perguntas: ['Qual a fatia de tecido e aviamento importado? Em qual moeda?', 'A concorrência do importado pressiona o preço? Como responde?', 'Coleções: quanto tempo entre compra do insumo e venda?'] },
  { id: 'moveis', grupo: 'Indústria', label: 'Móveis', itens: ['usd', 'petroleo', 'aco'],
    cadeia: { entradas: ['Madeira e MDF', 'Couro, tecidos e espumas', 'Ferragens e componentes'], processo: 'Fabricação e acabamento', saidas: ['Varejo e lojas próprias', 'Exportação', 'Construção e hotelaria'] },
    perguntas: ['Insumos em dólar (couro, espuma, ferragens)? Qual fatia?', 'Exporta? Para onde e em qual moeda?', 'Ciclo de produção e prazo de entrega: como financia o estoque?'] },
  { id: 'construcao', grupo: 'Indústria', label: 'Construção pesada e infraestrutura', itens: ['aco', 'cobre', 'petroleo', 'incc', 'usd'],
    cadeia: { entradas: ['Aço e cimento', 'Diesel e asfalto', 'Equipamentos importados'], processo: 'Obras, saneamento e incorporação', saidas: ['Setor público e concessões', 'Incorporação', 'Indústria'] },
    perguntas: ['Os contratos têm reajuste por índice (INCC, aço, diesel)? Com que periodicidade?', 'Importa equipamentos? Em qual moeda?', 'Carteira de obras e prazo de recebimento do poder público?'] },
  { id: 'telecom', grupo: 'Serviços', label: 'Telecom e data center', itens: ['usd', 'cnh', 'cobre', 'energia'],
    cadeia: { entradas: ['Equipamentos e fibra importados', 'Energia elétrica', 'Capital para expansão (CAPEX)'], processo: 'Rede, data center e serviços', saidas: ['Empresas e provedores', 'Nuvem e IA', 'Governo'] },
    perguntas: ['Qual fatia do CAPEX é importada e em qual moeda?', 'Energia: contrato no mercado livre? Qual o peso no custo?', 'Como o juro afeta o plano de expansão e o alongamento da dívida?'] },
  { id: 'logistica', grupo: 'Serviços', label: 'Logística e transporte', itens: ['petroleo', 'frete', 'usd', 'soja', 'milho'],
    cadeia: { entradas: ['Diesel', 'Pneus, peças e veículos (Finame)', 'Mão de obra'], processo: 'Transporte e armazenagem', saidas: ['Indústria e agro', 'Varejo e e-commerce', 'Comércio exterior'] },
    perguntas: ['Os contratos de frete têm cláusula de reajuste pelo diesel?', 'Renovação de frota: Finame, leasing ou recursos próprios?', 'Há operação com cargas importadas ou exportadas? Em qual moeda?'] },
  // Comércio, por subsetor: o que pesa muda muito entre um supermercado e uma concessionária.
  { id: 'comercio-supermercados', grupo: 'Comércio', label: 'Supermercados e alimentos', itens: ['trigo', 'milho', 'carne', 'acucar', 'cafe', 'usd'],
    cadeia: { entradas: ['Alimentos in natura e industrializados', 'Carnes, grãos e laticínios', 'Importados (azeite, vinho, bacalhau)'], processo: 'Compra, logística e venda no ponto de venda', saidas: ['Consumidor final', 'Food service e pequeno varejo', 'E-commerce e entrega'] },
    perguntas: ['Quais categorias pesam mais na margem e como o fornecedor repassa a commodity (carne, trigo, café)?', 'Prazo médio de pagamento aos fornecedores e giro de estoque?', 'Inflação de alimentos: o cliente troca de marca ou reduz volume?'] },
  { id: 'comercio-moda', grupo: 'Comércio', label: 'Moda, calçados e esportes', itens: ['usd', 'cnh', 'algodao', 'petroleo'],
    cadeia: { entradas: ['Confecção e calçado nacionais', 'Importados (China, Vietnã)', 'Coleções com compra antecipada'], processo: 'Compra por coleção, lojas e e-commerce', saidas: ['Consumidor final', 'Franquias', 'Marketplaces'] },
    perguntas: ['Qual fatia da compra é importada e em qual moeda? Com que antecedência?', 'Crédito ao cliente (cartão próprio, parcelado): inadimplência e custo?', 'Estoque de coleção: quanto fica para liquidação?'] },
  { id: 'comercio-farmacias', grupo: 'Comércio', label: 'Farmácias e drogarias', itens: ['usd', 'cnh'],
    cadeia: { entradas: ['Medicamentos (reajuste CMED anual)', 'Insumos importados da indústria (China, Índia)', 'Higiene e beleza'], processo: 'Rede de lojas e distribuição', saidas: ['Consumidor final', 'Convênios e PBM', 'Entrega e e-commerce'] },
    perguntas: ['Como o reajuste anual da CMED e o câmbio dos insumos chegam ao preço de compra?', 'Mix de genéricos, marca e não medicamentos na margem?', 'Prazo com a indústria e distribuidores; crédito ao cliente?'] },
  { id: 'comercio-matcon', grupo: 'Comércio', label: 'Materiais de construção', itens: ['aco', 'cobre', 'petroleo', 'incc', 'usd'],
    cadeia: { entradas: ['Aço, cimento e cobre', 'Tintas, PVC e resinas (petróleo)', 'Acabamentos importados'], processo: 'Lojas, atacado e entrega em obra', saidas: ['Consumidor final e reformas', 'Construtoras', 'Pequenos empreiteiros'] },
    perguntas: ['Quais categorias seguem commodity (aço, cobre, PVC) e com que defasagem o preço de compra muda?', 'Vendas a prazo para construtoras: prazo e inadimplência?', 'Juros: como afeta a reforma financiada e o crédito imobiliário dos clientes?'] },
  { id: 'comercio-eletro', grupo: 'Comércio', label: 'Eletro, móveis e e-commerce', itens: ['usd', 'cnh', 'frete', 'aluminio', 'cobre'],
    cadeia: { entradas: ['Eletroeletrônicos importados ou com componente importado', 'Móveis nacionais', 'Frete marítimo e logística'], processo: 'Lojas, marketplace e crediário', saidas: ['Consumidor final', 'Marketplaces', 'Entrega própria'] },
    perguntas: ['Qual fatia do sortimento depende do dólar e do yuan? Quem carrega o câmbio: o fornecedor ou a loja?', 'Crediário e cartão: custo do funding e inadimplência?', 'Frete marítimo e prazo de importação: quanto estoque fica em trânsito?'] },
  { id: 'comercio-veiculos', grupo: 'Comércio', label: 'Veículos, peças e concessionárias', itens: ['aco', 'aluminio', 'usd', 'eur', 'petroleo'],
    cadeia: { entradas: ['Veículos das montadoras (estoque financiado: floor plan)', 'Peças nacionais e importadas', 'Combustível e serviços'], processo: 'Venda, financiamento e pós-venda', saidas: ['Consumidor final', 'Frotas e empresas', 'Seminovos'] },
    perguntas: ['Estoque financiado pela montadora: prazo, custo e giro?', 'Peças importadas: qual fatia e em qual moeda?', 'Juros do financiamento ao cliente: quanto da venda depende de crédito?'] },
  { id: 'comercio-combustiveis', grupo: 'Comércio', label: 'Postos e combustíveis', itens: ['petroleo', 'usd', 'acucar'],
    cadeia: { entradas: ['Gasolina e diesel (Petrobras e importadores)', 'Etanol (usinas)', 'Loja de conveniência'], processo: 'Revenda e serviços', saidas: ['Consumidor final', 'Frotas e agro', 'Transportadoras'] },
    perguntas: ['Margem por litro e repasse dos reajustes da distribuidora: com que defasagem?', 'Mix gasolina/etanol/diesel e o peso do etanol (ligado ao açúcar)?', 'Prazo da distribuidora e crédito a frotas?'] },
  { id: 'comercio-atacado', grupo: 'Comércio', label: 'Atacado e distribuição', itens: ['usd', 'cnh', 'frete', 'trigo', 'milho'],
    cadeia: { entradas: ['Produtos importados (China) e da indústria nacional', 'Estoque financiado', 'Frete marítimo e interno'], processo: 'Importação, distribuição e venda', saidas: ['Varejo e e-commerce', 'Pequeno comércio', 'Franquias e revendas'] },
    perguntas: ['Qual fatia das compras é importada e com qual prazo de pagamento?', 'Frete marítimo: contrato fechado ou spot? Qual peso no custo?', 'Como a Selic afeta o crédito ao cliente e a inadimplência?'] },
  { id: 'agro-graos', grupo: 'Agro', label: 'Agro: grãos', itens: ['soja', 'milho', 'trigo', 'algodao', 'fertilizantes', 'usd', 'petroleo'],
    cadeia: { entradas: ['Fertilizantes (importados)', 'Sementes e defensivos', 'Diesel e máquinas'], processo: 'Produção e comercialização da safra', saidas: ['Exportação (China)', 'Esmagamento e ração', 'Cooperativas e tradings'] },
    perguntas: ['Quanto da safra já está vendido e a que preço (em dólar ou em reais)?', 'Insumos comprados em dólar? Com qual prazo (barter, CPR)?', 'Custo de armazenagem e frete até o porto?'] },
  { id: 'agro-proteina', grupo: 'Agro', label: 'Agro: proteína animal', itens: ['carne', 'milho', 'soja', 'usd', 'cnh'],
    cadeia: { entradas: ['Milho e farelo de soja (ração)', 'Genética e sanidade', 'Energia e embalagens'], processo: 'Criação, abate e processamento', saidas: ['Exportação (China, EUA)', 'Varejo', 'Food service'] },
    perguntas: ['Qual a fatia da ração no custo e como compra o milho e a soja?', 'Exporta? Quais mercados e em qual moeda?', 'Habilitações sanitárias e dependência de um mercado comprador?'] },
  { id: 'sucroenergetico', grupo: 'Agro', label: 'Sucroenergético', itens: ['acucar', 'petroleo', 'fertilizantes', 'usd'],
    cadeia: { entradas: ['Cana-de-açúcar', 'Diesel e fertilizantes', 'Capital de safra'], processo: 'Moagem: açúcar e etanol', saidas: ['Exportação de açúcar', 'Etanol (preço da gasolina)', 'Energia da biomassa'] },
    perguntas: ['Qual o mix açúcar/etanol previsto e o que o define?', 'Açúcar fixado em dólar? Qual volume e qual prazo?', 'Como a política de preços da Petrobras afeta a receita do etanol?'] },
]
export const SETOR_IDS = SETORES_APRESENTACAO.map((s) => s.id)
export const GRUPOS_SETORES = [...new Set(SETORES_APRESENTACAO.map((s) => s.grupo))]

// Itens que entram em todo setor (podem ser desmarcados).
export const TRANSVERSAIS = ['usd']

// O que atravessa toda a cadeia (slide da cadeia): como cada variável chega à importação e à exportação, sem excesso.
export const TRANSVERSAIS_TEXTO = [
  { id: 'dolar', label: 'Dólar', texto: 'Importação: encarece insumo, máquina e dívida em moeda estrangeira; Finimp e NDF travam o custo. Exportação: a receita em reais sobe com o dólar, mas o custo interno não cai; ACC/ACE antecipam e protegem a receita.' },
  { id: 'selic', label: 'Selic', texto: 'Custo do giro (CDI + spread) e do estoque financiado; juro alto freia o crédito ao cliente e torna o caixa aplicado mais rentável. Juro alto tende a atrair fluxo e valorizar o real: barateia a importação e aperta a margem de quem exporta.' },
  { id: 'inflacao', label: 'Inflação', texto: 'Reajuste de insumos, salários e tarifas e a Selic futura. Quem importa sofre câmbio e inflação ao mesmo tempo; quem exporta vê o custo em reais subir contra a receita em dólar. O repasse ao preço depende da concorrência.' },
]

// Leitura de uma linha para cada indicador do cenário.
export const LEITURA_CENARIO = {
  selic: 'Custo do giro e do estoque financiado; referência para aplicar o caixa.',
  cdi: 'Base do custo de capital de giro (CDI + spread) e das aplicações.',
  ipca: 'Pressão de reajuste em insumos e salários; guia a Selic futura.',
  usd: 'Custo do importado e receita do exportador; move estoque e contratos em moeda.',
  'focus-Selic': 'Onde o mercado vê a Selic no fim do ano: antecipa o custo do crédito.',
  'focus-IPCA': 'Inflação esperada para o ano: baliza reajustes e negociações de preço.',
  emprego: 'Saldo de vagas formais (CAGED): demanda do consumidor e pressão salarial.',
  inadimplencia: 'Inadimplência acima de 90 dias: risco de crédito ao cliente e apetite dos bancos.',
}

export const PERIODOS = [
  { dias: 90, label: '3 meses' },
  { dias: 180, label: '6 meses' },
  { dias: 360, label: '1 ano' },
]

export const setorPorId = (id) => SETORES_APRESENTACAO.find((s) => s.id === id) ?? null

// Itens marcados por padrão para um setor: os transversais e os do setor, sem os planejados (que não têm dado) e sem repetição.
export function itensPadrao(setorId) {
  const s = setorPorId(setorId)
  const ids = [...TRANSVERSAIS, ...(s?.itens ?? [])]
  return ids.filter((id, i) => ITENS[id] && ITENS[id].tipo !== 'planejado' && ids.indexOf(id) === i)
}

// Itens a mostrar na montagem para o setor: os padrão primeiro, depois os demais disponíveis, por fim os planejados do setor (desligados).
export function itensDaMontagem(setorId) {
  const padrao = itensPadrao(setorId)
  const s = setorPorId(setorId)
  const planejados = (s?.itens ?? []).filter((id) => ITENS[id]?.tipo === 'planejado')
  const outros = ITEM_IDS.filter((id) => ITENS[id].tipo !== 'planejado' && !padrao.includes(id))
  return [...padrao.map((id) => ({ ...ITENS[id], padrao: true })), ...outros.map((id) => ({ ...ITENS[id], padrao: false })), ...planejados.map((id) => ({ ...ITENS[id], padrao: false }))]
}

// Variação entre o primeiro ponto dentro da janela (`dias` até `agora`) e o último. `folga`: quantos dias o primeiro ponto pode ficar
// depois do início da janela e ainda valer (séries mensais precisam de mais folga que as diárias). Sem cobertura, null: não se chama de
// "6 meses" uma série de duas semanas.
export function variacaoPeriodo(pontos, dias, agora = Date.now(), folga = 10) {
  const validos = (pontos ?? []).filter((p) => Number.isFinite(p?.t) && p.v > 0).sort((a, b) => a.t - b.t)
  if (validos.length < 2) return null
  const inicio = agora - dias * DIA
  const base = validos.find((p) => p.t >= inicio)
  const ultimo = validos.at(-1)
  if (!base || base === ultimo || base.t - inicio > folga * DIA) return null
  return { pct: ((ultimo.v - base.v) / base.v) * 100, de: base, ate: ultimo, dias }
}

// Variação que arredonda para zero nas casas exibidas fica sem sinal (mesma regra da faixa do terminal).
export const sinal = (pct, casas = 1) => { if (!Number.isFinite(pct)) return '—'; const zero = Math.round(Math.abs(pct) * 10 ** casas) === 0; return `${zero ? '' : pct > 0 ? '+' : '−'}${nf(Math.abs(pct), casas)}%` }
export const tom = (pct) => (!Number.isFinite(pct) ? 'flat' : Math.round(pct * 10) === 0 ? 'flat' : pct > 0 ? 'up' : 'down')
const mesAno = (period) => { const [y, m] = String(period ?? '').split('-'); return m && y ? `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}/${y}` : '' }
const dm = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
const dmhm = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', '')
const tMes = (period) => Date.parse(`${period}-15T12:00:00Z`)

// Pontos (t, v) de cada fonte, no mesmo formato.
const ptsMoeda = (hist, code) => (hist?.series?.[code]?.points ?? []).map((p) => ({ t: Number(p.t), v: Number(p.bid) }))
const ptsMensal = (history) => (history ?? []).map((p) => ({ t: tMes(p.period), v: Number(p.value), period: p.period }))
const ptsDiario = (serie) => (serie?.points ?? []).map(([t, v]) => ({ t: Number(t), v: Number(v) }))
const ptsOil = (oil) => (oil?.points ?? []).map((p) => ({ t: Date.parse(`${p.date}T12:00:00Z`), v: Number(p.value) }))

// Dados do gráfico de um item: o trecho mostrado e a série inteira (para arrastar um trecho e comparar com o mesmo trecho
// do ano anterior), com o formato do valor. Sem pelo menos 2 pontos no trecho, não há gráfico.
function grafico(janela, serie, { prefixo = '', sufixo = '', casas = 2, mensal = false } = {}) {
  if (!(janela?.length > 1)) return null
  return { pontos: janela.map((p) => ({ t: p.t, bid: p.v })), historico: serie.map((p) => ({ t: p.t, bid: p.v })), prefixo, sufixo, casas, mensal }
}

// Variação do dólar no mesmo período: converte a variação de uma commodity em US$ para reais.
export function emReais(pctUsd, pctDolar) {
  if (!Number.isFinite(pctUsd) || !Number.isFinite(pctDolar)) return null
  return ((1 + pctUsd / 100) * (1 + pctDolar / 100) - 1) * 100
}

// Dado de um item para o slide: valor atual, quando, variação do dia e do período, pontos para o minigráfico e a frase pronta.
// dados: { quotes, hist (history.json), commodities (lista), diario (insumos-precos.json), oil, frete, temas, agora }.
export function dadoItem(item, dados, periodo) {
  const agora = dados.agora ?? Date.now()
  const dolar = variacaoPeriodo(ptsMoeda(dados.hist, 'USD'), periodo.dias, agora)
  if (item.tipo === 'moeda') {
    const q = dados.quotes?.[item.code]
    const pontos = ptsMoeda(dados.hist, item.code)
    if (!(q?.bid > 0)) return { indisponivel: 'Cotação indisponível no momento.' }
    const per = variacaoPeriodo(pontos, periodo.dias, agora)
    const casas = item.code === 'JPY' ? 4 : 2
    const janela = pontos.filter((p) => p.t >= agora - periodo.dias * DIA)
    // histórico para o ano anterior: a cotação central (360 dias) completada, para trás, pela referência diária do BCE
    const bce = (dados.ecb?.[item.code] ?? []).map((p) => ({ t: p.t, v: p.bid })).filter((p) => !pontos.length || p.t < pontos[0].t)
    const g = grafico(janela, [...bce, ...pontos], { prefixo: 'R$ ', casas })
    return { valor: q.bid, valorTexto: `R$ ${nf(q.bid, casas)}`, quando: `cotação de ${dmhm(q.timestamp)}`, dia: !q.fallback && Number.isFinite(q.pct) ? q.pct : null, periodo: per, pontos: janela, stale: !!q.stale,
      grafico: g && bce.length ? { ...g, bce: true } : g,
      frase: `${item.label} a R$ ${nf(q.bid, casas)}: ${per ? `${sinal(per.pct)} em ${periodo.label}` : `sem histórico de ${periodo.label} disponível`}.` }
  }
  if (item.tipo === 'commodity') {
    const c = (dados.commodities ?? []).find((x) => x.id === item.commodity && Number.isFinite(x.value))
    if (!c) return { indisponivel: 'Preço indisponível no momento.' }
    const mensal = ptsMensal(c.history)
    const serie = item.diario ? dados.diario?.series?.[item.diario] : null
    const diario = ptsDiario(serie)
    const per = variacaoPeriodo(mensal, periodo.dias, agora, 35)
    const reais = per && dolar ? emReais(per.pct, dolar.pct) : null
    const moeda = item.moeda ?? 'US$', d = c.decimals ?? 1
    const frase = `${item.label} a ${moeda} ${nf(c.value, d)}/${item.unidade} (média de ${mesAno(c.period)}): ${per ? `${sinal(per.pct)} em ${periodo.label}, em dólar` : `sem histórico de ${periodo.label}`}.` +
      (reais != null ? ` Em reais, ${sinal(reais)}: o dólar ${dolar.pct >= 0 ? 'subiu' : 'caiu'} ${nf(Math.abs(dolar.pct), 1)}% no período.` : '')
    // Gráfico mensal com pelo menos 12 meses (um trecho de 6 pontos não dá para arrastar e comparar com o ano anterior); 400 dias cobrem a defasagem da publicação.
    const janela = mensal.filter((p) => p.t >= agora - Math.max(periodo.dias, 400) * DIA)
    return { valor: c.value, valorTexto: `${moeda} ${nf(c.value, d)}`, unidade: `${moeda}/${item.unidade}`, unidadeCurta: `/${item.unidade}`, grafico: grafico(janela, mensal, { prefixo: `${moeda} `, casas: d, sufixo: `/${item.unidade}`, mensal: true }), quando: `média de ${mesAno(c.period)} · ${c.benchmark}`, dia: null, mes: Number.isFinite(c.variationPct) ? c.variationPct : null, periodo: per, emReais: reais, dolar, pontos: diario.length > 1 ? diario.filter((p) => p.t >= agora - periodo.dias * DIA) : mensal.filter((p) => p.t >= agora - periodo.dias * DIA), pontosNota: diario.length > 1 ? `preço diário aproximado (${serie.name ?? 'contrato futuro'})` : 'média mensal', stale: !!c.stale, frase }
  }
  if (item.tipo === 'petroleo') {
    const o = dados.oil
    const pontos = ptsOil(o)
    if (!(o?.value > 0) || o.benchmark !== 'Brent') return { indisponivel: 'Brent indisponível no momento.' }
    const per = variacaoPeriodo(pontos, periodo.dias, agora)
    const ult = pontos.at(-1), ant = pontos.at(-2)
    const dia = ult && ant ? ((ult.v - ant.v) / ant.v) * 100 : null
    const reais = per && dolar ? emReais(per.pct, dolar.pct) : null
    return { valor: o.value, valorTexto: `US$ ${nf(o.value, 2)}`, unidade: 'US$/barril', unidadeCurta: '/barril', grafico: grafico(pontos.filter((p) => p.t >= agora - periodo.dias * DIA), pontos, { prefixo: 'US$ ', casas: 2, sufixo: '/barril' }), quando: `Brent spot de ${dm(Date.parse(`${o.observationDate}T12:00:00Z`))}`, dia, periodo: per, emReais: reais, dolar, pontos: pontos.filter((p) => p.t >= agora - periodo.dias * DIA), pontosNota: 'Brent spot diário', stale: !!o.stale,
      frase: `Brent a US$ ${nf(o.value, 2)}/barril (${dm(Date.parse(`${o.observationDate}T12:00:00Z`))}): ${per ? `${sinal(per.pct)} em ${periodo.label}, em dólar` : `sem histórico de ${periodo.label}`}.${reais != null ? ` Em reais, ${sinal(reais)}.` : ''} O diesel na bomba segue o Brent e o dólar com defasagem, pela política de preços da Petrobras.` }
  }
  if (item.tipo === 'frete') {
    const f = dados.frete
    const mensal = ptsMensal(f?.points)
    const ult = mensal.at(-1)
    if (!ult) return { indisponivel: 'Índice de frete indisponível no momento.' }
    const per = variacaoPeriodo(mensal, periodo.dias, agora, 35)
    return { valor: ult.v, valorTexto: nf(ult.v, 1), unidade: 'pontos', unidadeCurta: ' pontos', grafico: grafico(mensal.filter((p) => p.t >= agora - Math.max(periodo.dias, 400) * DIA), mensal, { casas: 1, sufixo: ' pontos', mensal: true }), quando: `índice mensal de ${mesAno(ult.period)} (transporte de carga, EUA)`, dia: null, periodo: per, pontos: mensal.filter((p) => p.t >= agora - periodo.dias * DIA), pontosNota: 'índice mensal', stale: !!f.stale,
      frase: `Frete marítimo (índice de preços do transporte de carga, EUA) em ${nf(ult.v, 1)} pontos (${mesAno(ult.period)}): ${per ? `${sinal(per.pct)} em ${periodo.label}` : `sem histórico de ${periodo.label}`}. Não é cotação de rota brasileira nem US$/contêiner.` }
  }
  if (item.tipo === 'noticia') return { semSerie: item.semSerie, frase: item.semSerie }
  return { indisponivel: 'Coleta ainda não existe para este item.' }
}

// Manchetes dos últimos cinco dias do tema do item (as mais recentes), sem alterar o título.
export function manchetes(temas, temaId, n = 3, now = Date.now()) {
  return recentNews(temas?.[temaId]?.items, now).sort((a, b) => b.t - a.t).slice(0, n).map((i) => ({ t: i.t, title: i.title, source: i.source, link: i.link }))
}

// Cenário em uma linha: Selic, CDI, IPCA 12 meses, dólar e o que o Focus espera para o ano.
export function linhasCenario(dados) {
  const m = dados.macro
  const out = []
  const last = (a) => (Array.isArray(a) && a.length ? a[a.length - 1] : null)
  const selic = last(m?.selic), cdi = last(m?.cdi)
  if (selic) out.push({ key: 'selic', label: 'Selic', valor: `${nf(selic[1], 2)}%`, nota: 'meta a.a.' })
  if (cdi) out.push({ key: 'cdi', label: 'CDI', valor: `${nf(cdi[1], 2)}%`, nota: `a.a. · ${dm(cdi[0])}` })
  const ipca = (dados.ipca?.points ?? []).at(-1)
  if (ipca && Number.isFinite(ipca.y12)) out.push({ key: 'ipca', label: 'IPCA 12 meses', valor: `${nf(ipca.y12, 2)}%`, nota: mesAno(ipca.period) })
  const usd = dados.quotes?.USD
  if (usd?.bid > 0) out.push({ key: 'usd', label: 'Dólar', valor: `R$ ${nf(usd.bid, 2)}`, nota: Number.isFinite(usd.pct) && !usd.fallback ? `${sinal(usd.pct, 2)} hoje` : dmhm(usd.timestamp) })
  const ano = String(new Date(dados.agora ?? Date.now()).getFullYear())
  for (const ind of ['Selic', 'IPCA']) {
    const row = m?.focus?.rows?.find((r) => r.indicator === ind)
    const v = row?.values?.[ano]?.median
    if (Number.isFinite(v)) out.push({ key: `focus-${ind}`, label: `Focus ${ano}: ${ind}`, valor: `${nf(v, 2)}%`, nota: `mediana · Focus de ${(m.focus.link && m.focus.release) || m.focus.date ? dm(Date.parse(`${(m.focus.link && m.focus.release) || m.focus.date}T12:00:00Z`)) : ''}` })
  }
  return out.map((l) => ({ ...l, leitura: LEITURA_CENARIO[l.key] ?? null }))
}

const mesCurto = (period) => mesAno(period).replace('/20', '/')
// Cenário: emprego (saldo do CAGED, 12 meses) e inadimplência PF e PJ (carteira total, 13 meses), para os gráficos abaixo das linhas.
export function graficosCenario(dados) {
  const caged = (dados.indicadores ?? []).find((s) => s.id === 'caged')
  const emprego = (caged?.points ?? []).map((p) => ({ period: p.period, t: tMes(p.period), v: Number(p.value), rotulo: mesCurto(p.period) })).filter((p) => Number.isFinite(p.v) && Number.isFinite(p.t)).slice(-12)
  const serie = (key) => ((dados.inadimplencia ?? []).find((s) => s.key === key)?.points ?? []).map((p) => ({ t: Number(p.t), v: Number(p.v), period: p.period })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).slice(-13)
  const pf = serie('pf-total'), pj = serie('pj-total')
  return {
    emprego: emprego.length ? { pontos: emprego, ultimo: emprego.at(-1), acumulado: emprego.reduce((a, p) => a + p.v, 0) } : null,
    inadimplencia: pf.length || pj.length ? { PF: pf, PJ: pj, ultimo: { PF: pf.at(-1) ?? null, PJ: pj.at(-1) ?? null } } : null,
  }
}

// Encerramento: miniaturas de tudo o que foi falado (itens, Selic, IPCA, emprego, inadimplência), cada uma com valor,
// variação e minigráfico, para embasar o resumo.
export function miniaturas(slidesItens, dados, periodo) {
  const out = []
  for (const s of slidesItens) {
    const d = s.dado
    if (!d || d.indisponivel || d.semSerie) continue
    out.push({ key: s.item.id, label: s.item.label, valor: `${d.valorTexto}${d.unidadeCurta ?? ''}`, variacao: d.periodo ? `${sinal(d.periodo.pct)} em ${periodo.label}` : d.quando, tom: d.periodo ? tom(d.periodo.pct) : 'flat', pontos: (d.pontos ?? []).map((p) => ({ t: p.t, bid: p.v })) })
  }
  const agora = dados.agora ?? Date.now()
  const umAno = agora - 370 * DIA
  const selic = (dados.macro?.selic ?? []).filter((p) => Array.isArray(p) && p[0] >= umAno).map((p) => ({ t: p[0], bid: p[1] }))
  if (selic.length) out.push({ key: 'selic', label: 'Selic', valor: `${nf(selic.at(-1).bid, 2)}% a.a.`, variacao: selic.length > 1 ? `${sinal(selic.at(-1).bid - selic[0].bid, 2).replace('%', ' p.p.')} em 12 meses` : 'meta', tom: tom(selic.at(-1).bid - selic[0].bid), pontos: selic })
  const ipca = (dados.ipca?.points ?? []).filter((p) => Number.isFinite(p.y12)).slice(-13).map((p) => ({ t: tMes(p.period), bid: p.y12 }))
  if (ipca.length) out.push({ key: 'ipca', label: 'IPCA 12 meses', valor: `${nf(ipca.at(-1).bid, 2)}%`, variacao: ipca.length > 1 ? `${sinal(ipca.at(-1).bid - ipca[0].bid, 2).replace('%', ' p.p.')} em 12 meses` : '', tom: tom(ipca.at(-1).bid - ipca[0].bid), pontos: ipca })
  const g = graficosCenario(dados)
  if (g.emprego) out.push({ key: 'emprego', label: 'Emprego formal (CAGED)', valor: `${g.emprego.ultimo.v >= 0 ? '+' : '−'}${nf(Math.abs(g.emprego.ultimo.v), 0)} vagas`, variacao: `${mesAno(g.emprego.ultimo.period)} · ${nf(g.emprego.acumulado, 0)} em 12 meses`, tom: tom(g.emprego.ultimo.v), pontos: g.emprego.pontos.map((p) => ({ t: p.t, bid: p.v })) })
  for (const k of ['PF', 'PJ']) {
    const pts = g.inadimplencia?.[k] ?? []
    if (pts.length) out.push({ key: `inad-${k}`, label: `Inadimplência ${k}`, valor: `${nf(pts.at(-1).v, 2)}%`, variacao: pts.length > 1 ? `${sinal(pts.at(-1).v - pts[0].v, 2).replace('%', ' p.p.')} em 12 meses` : '', tom: tom(pts.at(-1).v - pts[0].v), pontos: pts.map((p) => ({ t: p.t, bid: p.v })) })
  }
  return out
}

// Resumo final: os três itens com maior movimento no período, em uma frase cada.
export function resumoFinal(slidesItens, periodo) {
  return slidesItens
    .filter((s) => Number.isFinite(s.dado?.periodo?.pct))
    .sort((a, b) => Math.abs(b.dado.periodo.pct) - Math.abs(a.dado.periodo.pct))
    .slice(0, 3)
    .map((s) => `${s.item.label}: ${sinal(s.dado.periodo.pct)} em ${periodo.label}${s.dado.emReais != null ? ` (em reais, ${sinal(s.dado.emReais)})` : ''}.`)
}

// Leitura curta de um evento da agenda: o efeito na economia (evento doméstico) ou o canal até o Brasil (evento externo).
const PAIS_EVENTO = { FOMC: 'US', Payroll: 'US' }
export function leituraEvento(e) {
  const pais = PAIS_EVENTO[e.kind] ?? 'BR'
  const x = explicarEvento({ title: e.label, country: pais, impact: 'high' })
  return pais === 'BR' ? x.economia : x.brasil
}

// Roteiro: perguntas (para o apresentador), capa, cenário, cadeia do setor, um slide por item, agenda e encerramento.
// cfg: { nome, site, capa, setorId, itens: [ids], periodo: { dias, label } }.
export function montarRoteiro(cfg, dados) {
  const setor = setorPorId(cfg.setorId)
  if (!setor) throw new Error('Setor desconhecido')
  const periodo = PERIODOS.find((p) => p.dias === cfg.periodo?.dias) ?? PERIODOS[1]
  const agora = dados.agora ?? Date.now()
  const itens = (cfg.itens ?? []).map((id) => ITENS[id]).filter((i) => i && i.tipo !== 'planejado')
  const slidesItens = itens.map((item) => {
    const insumo = item.insumo ? INSUMOS.find((i) => i.id === item.insumo) : null
    return { kind: 'item', item, dado: dadoItem(item, dados, periodo), move: insumo?.move ?? item.move ?? [], manchetes: item.tema ? manchetes(dados.temas, item.tema, 3, agora) : [], newsState: item.tema ? { generatedAt: dados.temas?.[item.tema]?.generatedAt, stale: dados.temas?.[item.tema]?.stale } : null, periodo }
  })
  const perguntas = [...setor.perguntas, ...itens.flatMap((i) => (i.insumo ? INSUMOS.find((x) => x.id === i.insumo)?.visita ?? [] : []))].filter((p, i, a) => a.indexOf(p) === i).slice(0, 8)
  const nome = cfg.capa?.titulo || cfg.nome || ''
  // Ordem: as perguntas vêm antes da capa, para o apresentador ler o que precisa conversar antes de começar.
  return [
    { kind: 'perguntas', perguntas, nome, setor },
    { kind: 'capa', nome, setor, capa: cfg.capa ?? null, agora, periodo },
    { kind: 'cenario', linhas: linhasCenario({ ...dados, agora }), graficos: graficosCenario(dados), agora },
    { kind: 'cadeia', setor, transversais: TRANSVERSAIS_TEXTO },
    ...slidesItens,
    { kind: 'agenda', eventos: upcoming(new Date(agora), 30).slice(0, 6).map((e) => ({ ...e, leitura: leituraEvento(e) })) },
    { kind: 'fim', nome, pontos: resumoFinal(slidesItens, periodo), minis: miniaturas(slidesItens, dados, periodo), periodo, agora },
  ]
}

// Capa: o que o site da empresa informa (título, descrição, logotipo), lido por um serviço público de metadados.
// Se a leitura falha, a capa usa o nome digitado e o ícone do site (favicon), quando existe. Nada é guardado.
export const DOMINIO = (url) => { try { return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '') } catch { return '' } }
// Endereços a tentar, em ordem: o digitado e, se veio só o nome ("tubokraft"), as terminações .com.br e .com.
export function candidatosSite(texto) {
  const t = String(texto ?? '').trim().replace(/\s+/g, '').replace(/\/+$/, '')
  if (!t) return []
  const semEsquema = t.replace(/^https?:\/\//i, '')
  if (!/\./.test(semEsquema)) return [`https://${semEsquema}.com.br`, `https://${semEsquema}.com`]
  return [/^https?:\/\//i.test(t) ? t : `https://${t}`]
}
// Ícone do site, servido como imagem (não depende do serviço de metadados); a página esconde a imagem se o ícone não existir.
export const faviconUrl = (dominio) => (dominio ? `https://icons.duckduckgo.com/ip3/${dominio}.ico` : null)
export function normalizarCapa(json, url) {
  const d = json?.status === 'success' ? json.data : null
  if (!d) return null
  const titulo = String(d.publisher || d.title || '').trim()
  return { titulo: titulo || DOMINIO(url), descricao: String(d.description ?? '').trim(), logo: d.logo?.url ?? faviconUrl(DOMINIO(url)), imagem: d.image?.url ?? null, dominio: DOMINIO(url) }
}
async function lerMetadados(alvo, signal) {
  const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(alvo)}&palette=false&audio=false&video=false`, { signal })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.message ? `${json.code ?? res.status}: ${json.message}` : `HTTP ${res.status}`)
  const capa = normalizarCapa(json, alvo)
  if (!capa) throw new Error(json?.message ?? 'sem dados do site')
  return capa
}
// Tenta cada endereço candidato; devolve a primeira capa lida. Falhando todos, o erro lista o que foi tentado e por quê.
export async function buscarCapa(texto, signal) {
  const tentativas = candidatosSite(texto)
  if (!tentativas.length) throw new Error('informe o endereço do site')
  const motivos = []
  for (const alvo of tentativas) {
    try { return await lerMetadados(alvo, signal) } catch (e) { if (e.name === 'AbortError') throw e; motivos.push(`${DOMINIO(alvo)}: ${e.message}`) }
  }
  const erro = new Error(motivos.join(' · '))
  erro.tentativas = tentativas.map(DOMINIO)
  throw erro
}
