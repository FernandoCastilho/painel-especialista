export const TEMAS_HISTORIAS = [
  {
    id: 'origem-fisica',
    titulo: 'Do físico ao digital',
    leitura: 'O iFood digitalizou o pedido, mas a refeição continuou a percorrer o último quilômetro. A Netflix digitalizou também a entrega do próprio filme. A Blockbuster tentou combinar a loja física com pedidos online. O que mudou em cada caso foi a parte do serviço que podia chegar ao cliente pela internet.',
  },
  {
    id: 'logistica',
    titulo: 'Como a entrega escala',
    leitura: 'Para crescer, o iFood passou a coordenar entregas em redes locais. A Netflix começou pelos Correios e depois passou a distribuir vídeo pela internet. No primeiro caso contam densidade e distância; no segundo, capacidade de rede e direitos de distribuição.',
  },
  {
    id: 'locacao-video',
    titulo: 'Locação de vídeo',
    leitura: 'A Netflix levou o aluguel à casa do cliente pelo correio e depois pela internet. A Blockbuster também ofereceu aluguel online e entrega por correio, mas tentou aproveitar a própria rede de lojas. A comparação não é entre uma empresa que inovou e outra que não tentou: é entre modelos com custos e incentivos diferentes.',
  },
]

export const HISTORIAS = [
  {
    id: 'ifood',
    nome: 'iFood',
    fundacao: '2011',
    local: 'Brasil',
    setor: 'Tecnologia para delivery',
    titulo: 'Do guia de cardápios à plataforma de delivery',
    origem: 'Antes do aplicativo havia o Disk Cook: o consumidor consultava um guia impresso e fazia o pedido por telefone. Patrick Sigrist, Eduardo Baer, Guilherme Bonifácio e Felipe Fioravante fundaram o iFood em 2011, no estado de São Paulo, a partir desse negócio.',
    virada: 'O site e o aplicativo facilitaram encontrar restaurantes e pedir sem passar pela central de atendimento. A partir de 2018, o iFood também passou a coordenar a logística em parte dos pedidos. Outros continuaram com entrega a cargo do estabelecimento.',
    leitura: 'Para um restaurante, pedidos adicionais não garantem margem adicional. Vale olhar comissão, promoções, embalagem e entrega por pedido, além da dependência de um único canal. Em 2023, o Cade celebrou um acordo com o iFood que limitou cláusulas de exclusividade.',
    marcos: [
      ['1997', 'O guia impresso que antecedeu o iFood começou a circular.'],
      ['2011', 'Fundação do iFood a partir da experiência com o Disk Cook.'],
      ['2012', 'Lançamento do site e do aplicativo para Android e iOS.'],
      ['2013–2014', 'Primeiro investimento da Movile e expansão com a fusão com o Restaurante Web.'],
      ['2015', 'A plataforma chegou a um milhão de pedidos mensais.'],
      ['2018', 'Início da operação logística na plataforma.'],
    ],
    conexoes: {
      'origem-fisica': 'O guia e o telefone validaram a demanda antes do site e do aplicativo.',
      logistica: 'A empresa passou da intermediação de pedidos também à coordenação de entregas, mantendo ambos os modelos.',
    },
    fontes: [
      { titulo: 'FEA-USP: relato de Eduardo Baer sobre a fundação', url: 'https://fea.usp.br/fea/noticias/eduardo-baer-inspira-futuros-lideres-com-trajetoria-de-sucesso.html' },
      { titulo: 'iFood: origem e modelos de entrega', url: 'https://institucional.ifood.com.br/estudos-e-pesquisas/resposta-ao-manifesto-sobre-regulacao/' },
      { titulo: 'iFood: linha do tempo institucional', url: 'https://institucional.ifood.com.br/wp-content/uploads/2024/02/iFood_FY23_Final-2.pdf' },
      { titulo: 'Cade: acordo sobre exclusividade', url: 'https://www.gov.br/cade/pt-br/assuntos/noticias/cade-celebra-acordo-com-ifood-em-investigacao-de-exclusividade-no-mercado-de-marketplaces-de-delivery-on-line-de-comida/' },
    ],
  },
  {
    id: 'netflix',
    nome: 'Netflix',
    fundacao: '1997',
    local: 'Estados Unidos',
    setor: 'Entretenimento',
    titulo: 'Do DVD pelo correio ao streaming',
    origem: 'Reed Hastings e Marc Randolph fundaram a Netflix na Califórnia em 1997 para alugar DVDs pelo correio. A loja online abriu em 1998: o cliente escolhia o filme no site e recebia o disco em casa.',
    virada: 'Em 1999, a empresa lançou uma assinatura sem multa por atraso. Em 2007, acrescentou a opção de assistir pela internet sem abandonar os DVDs de imediato. Os dois formatos conviveram até o último envio postal, em 2023.',
    leitura: 'A assinatura mudou a forma de cobrar antes de o streaming mudar a forma de entregar. Uma transição desse tipo pode reduzir o custo da entrega física e, ao mesmo tempo, elevar a importância dos gastos com tecnologia e conteúdo.',
    marcos: [
      ['1997', 'Reed Hastings e Marc Randolph fundam a empresa.'],
      ['1998', 'Abre a loja online para aluguel de DVDs enviados pelo correio.'],
      ['1999', 'Lançamento da assinatura de DVDs, sem data de devolução ou multa por atraso.'],
      ['2007', 'A estreia do streaming permite assistir pela internet.'],
      ['2016', 'O lançamento em mais de 130 novos países amplia o alcance global do streaming.'],
      ['2023', 'A Netflix envia seus últimos DVDs.'],
    ],
    conexoes: {
      'origem-fisica': 'A compra do serviço já era online, mas os filmes ainda chegavam em discos antes do streaming.',
      'locacao-video': 'A assinatura e a entrega em casa disputaram o mesmo público que alugava filmes nas lojas.',
      logistica: 'O streaming substituiu o transporte dos discos pela distribuição pela internet, sem desativar a operação postal de um dia para o outro.',
    },
    fontes: [
      { titulo: 'Netflix: história da fundação', url: 'https://about.netflix.com/en/leadership' },
      { titulo: 'Netflix: inauguração da loja de DVDs em 1998', url: 'https://about.netflix.com/en/news/first-online-dvd-rental-store-opens' },
      { titulo: 'Netflix: lançamento da assinatura em 1999', url: 'https://about.netflix.com/en/news/netflix-com-transforms-dvd-business-eliminating-late-fees-and-due-dates-from' },
      { titulo: 'Netflix: introdução do streaming em 2007', url: 'https://about.netflix.com/en/news/netflix-offers-subscribers-the-option-of-instantly-watching-movies-on-their' },
      { titulo: 'Netflix: expansão global em 2016', url: 'https://about.netflix.com/en/news/netflix-is-now-available-around-the-world' },
      { titulo: 'Netflix: fim dos envios postais em 2023', url: 'https://about.netflix.com/en/news/thanks-for-watching' },
    ],
  },
  {
    id: 'blockbuster',
    nome: 'Blockbuster',
    fundacao: '1985',
    local: 'Estados Unidos',
    setor: 'Locação de vídeo',
    titulo: 'Da videolocadora de bairro à rede de lojas',
    origem: 'David Cook abriu a primeira Blockbuster em Dallas, no Texas, em outubro de 1985. A loja se diferenciava pelo catálogo amplo de fitas e pelo uso de computadores na operação, em uma época em que alugar um filme exigia ir à videolocadora.',
    virada: 'A rede cresceu a partir das lojas. Quando o aluguel migrou para outros canais, a Blockbuster ofereceu aluguel por correio e, com o Total Access, permitiu devolver o DVD recebido em casa em uma loja. Em setembro de 2010, a empresa e algumas subsidiárias nos EUA pediram proteção judicial pelo Chapter 11.',
    leitura: 'As lojas serviam como ponto de retirada e devolução, mas também exigiam aluguel, equipe e estoque. Em uma mudança de canal, o desafio é usar a estrutura existente sem deixar seus custos comprometerem a transição. É uma leitura do caso, não uma explicação única para o pedido de proteção judicial.',
    marcos: [
      ['1985', 'A primeira loja abre em Dallas com um amplo catálogo de fitas.'],
      ['2006', 'O Total Access integra o aluguel online por correio às devoluções em loja.'],
      ['2010', 'A companhia e algumas subsidiárias entram com pedido de proteção pelo Chapter 11.'],
      ['2011', 'A DISH compra quase todos os ativos da operação, incluindo a marca.'],
    ],
    conexoes: {
      'origem-fisica': 'As lojas de fitas e DVDs foram a base do negócio antes da entrada no aluguel online.',
      'locacao-video': 'O programa Total Access tentou combinar a conveniência do correio com a presença das lojas.',
    },
    fontes: [
      { titulo: 'Billboard: cobertura da abertura da primeira loja em 1985', url: 'https://www.worldradiohistory.com/Archive-All-Music/Billboard/80s/1985/BB-1985-10-19.pdf' },
      { titulo: 'History: David Cook e a primeira loja em Dallas', url: 'https://www.history.com/this-day-in-history/october-19/first-blockbuster-store-opens' },
      { titulo: 'Blockbuster: relatório anual arquivado na SEC', url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312511186981/d10k.htm' },
      { titulo: 'Blockbuster: comunicado do pedido de Chapter 11', url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312510215765/d8k.htm' },
      { titulo: 'Blockbuster: conclusão da venda de ativos à DISH', url: 'https://www.sec.gov/Archives/edgar/data/1085734/000119312511132032/d8k.htm' },
    ],
  },
]

export const casosDoTema = id => HISTORIAS.filter(caso => Object.hasOwn(caso.conexoes, id))
