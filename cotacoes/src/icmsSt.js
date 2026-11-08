// Conteúdo didático. Não determina enquadramento nem calcula imposto de uma empresa.
export const FONTES_ICMS_ST = [
  { nome: 'Sefaz-SP · Portaria SRE 34/2026, arts. 1º a 3º (escopo e vigência)', url: 'https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-SRE-34-de-2026.aspx' },
  { nome: 'Sefaz-SP · Portaria CAT 28/2020, texto vigente (estoque e crédito)', url: 'https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-28-de-2020.aspx' },
  { nome: 'Sefaz-SP · Portaria CAT 68/2019 (listas de mercadorias)', url: 'https://legislacao.fazenda.sp.gov.br/Paginas/Portaria-CAT-68-de-2019.aspx' },
  { nome: 'Sefaz-SP · RC 40205/2026 (itens que permanecem e operações interestaduais)', url: 'https://legislacao.fazenda.sp.gov.br/Paginas/RC40205_2026.aspx' },
]

// Hipóteses escolhidas apenas para comparar o MOMENTO do recolhimento, não a carga real.
export function exemploIcmsSt() {
  const bases = [100, 150, 200], aliquota = .18, basePresumida = 200
  const debitos = bases.map(base => Math.round(base * aliquota * 100) / 100)
  const creditos = [0, debitos[0], debitos[1]]
  const recolhimentos = debitos.map((debito, i) => debito - creditos[i])
  return { bases, aliquota, basePresumida, debitos, creditos, recolhimentos, proprio: debitos[0], antecipado: basePresumida * aliquota - debitos[0], total: recolhimentos.reduce((a, b) => a + b, 0) }
}

export const ETAPAS_ICMS = {
  st: [
    { titulo: 'A mercadoria percorre a cadeia', texto: 'Fabricante → distribuidor → loja → consumidor. Neste desenho, o fabricante é o substituto tributário: a lei lhe atribui o recolhimento do imposto das operações seguintes. Distribuidor e loja são os substituídos.', ativos: [0], fluxo: 'mercadoria' },
    { titulo: 'O substituto antecipa o imposto da revenda', texto: 'Além do ICMS da própria venda, o fabricante retém e recolhe o ICMS-ST das etapas futuras. A base de cálculo da ST segue o critério legal do produto, como preço fixado ou margem de valor agregado (MVA). Não é o lucro efetivo da loja.', ativos: [0], fluxo: 'tributo' },
    { titulo: 'As próximas vendas já têm imposto retido', texto: 'No fluxo interno típico representado, distribuidor e loja revendem mercadoria cujo ICMS das operações subsequentes já foi retido. Isso não é isenção. Obrigações, complementação, ressarcimento e exceções dependem da legislação e da operação.', ativos: [1, 2], fluxo: 'mercadoria' },
    { titulo: 'A antecipação acompanha o estoque', texto: 'A loja pode financiar, no custo de aquisição, imposto recolhido antes da sua revenda. O prazo do fornecedor, o giro e o recebimento do cliente determinam por quanto tempo esse recurso fica comprometido. O consumidor continua no fim da cadeia.', ativos: [2, 3], fluxo: 'caixa' },
  ],
  normal: [
    { titulo: 'A cadeia continua a mesma', texto: 'O desenho agora mostra empresas no Regime Periódico de Apuração (RPA), com operações tributadas e créditos admitidos. A exclusão de ST não elimina o ICMS nem altera, por si só, a alíquota.', ativos: [0], fluxo: 'mercadoria' },
    { titulo: 'Cada contribuinte apura a sua operação', texto: 'O fabricante apura o imposto próprio. Distribuidor e loja registram os débitos das vendas e podem descontar os créditos legalmente admitidos das compras. O recolhimento segue o calendário fiscal, não necessariamente o recebimento do cliente.', ativos: [0, 1, 2], fluxo: 'tributo' },
    { titulo: 'Débitos menos créditos admitidos', texto: 'A não cumulatividade evita cobrar integralmente de novo o imposto já suportado nas etapas anteriores, quando o crédito é permitido. No Simples Nacional, a apuração segue regras próprias no DAS: não se deve copiar este desenho de débitos e créditos do RPA.', ativos: [1, 2], fluxo: 'tributo' },
    { titulo: 'Menos antecipação, mas imposto continua devido', texto: 'Nas compras atingidas pela exclusão, pode diminuir o desembolso antecipado ligado à revenda, conforme preços e negociação. A empresa precisa reservar caixa para o imposto das vendas. Não há aumento garantido de margem nem liberação automática de dinheiro.', ativos: [2, 3], fluxo: 'caixa' },
  ],
}

export const CONCEITO_ICMS_ST = {
  id: 'substituicao-tributaria', topico: 'Tributos e trabalho', nome: 'Substituição tributária do ICMS', revisadoEm: '2026-11-08', fontes: FONTES_ICMS_ST,
  frase: 'Na ST para frente, um contribuinte recolhe antecipadamente o ICMS das próximas etapas da cadeia; sair da ST não é ficar isento.',
  crianca: [
    'O ICMS é um imposto estadual. Na substituição tributária para frente, a lei coloca em uma empresa, muitas vezes o fabricante ou o importador, a responsabilidade de recolher também o imposto das futuras revendas.',
    'Quem recolhe por essas etapas é o substituto. As empresas que recebem a mercadoria com o imposto retido são as substituídas. A responsabilidade e o cálculo dependem do produto, da operação e da legislação aplicável.',
    'Sem essa antecipação, a mercadoria continua tributada pelas regras comuns do regime da empresa. No RPA, há débitos pelas vendas e créditos admitidos pelas compras. No Simples Nacional, o tratamento é próprio no DAS.',
  ],
  analogia: 'É como concentrar a cobrança de etapas futuras em um ponto da cadeia. Quando essa cobrança antecipada é retirada, a obrigação não desaparece: muda a forma de apurar e recolher.',
  diagramaIcms: true,
  lacunas: [
    'ST não é um imposto novo nem isenção nas revendas. Também não se confunde com split payment de IBS/CBS.',
    'NCM isolada ou CNAE do negócio não basta: confira descrição da mercadoria, código, lista vigente e operação, inclusive destino.',
    'A base presumida da ST não é necessariamente o preço efetivo ao consumidor. Diferenças podem ter tratamento próprio de complemento ou ressarcimento.',
    'Crédito de estoque não é depósito bancário. No RPA, a transição da CAT 28/2020 usa 12 parcelas; no Simples, há dedução própria no PGDAS-D. Documentos e requisitos legais são indispensáveis.',
  ],
  preciso: {
    texto: 'No modelo simplificado da ST para frente, o recolhimento antecipado corresponde ao imposto sobre a base presumida da etapa final menos o ICMS próprio da operação do substituto. Base, alíquota, margens, benefícios, ajustes e responsável devem ser confirmados na legislação do caso.',
    formula: 'ICMS-ST ilustrativo = base presumida × alíquota hipotética − ICMS próprio',
  },
  exemplo: {
    titulo: 'Cadeia hipotética no RPA, não cálculo fiscal',
    passos: [
      'Hipóteses: vendas de R$ 100, R$ 150 e R$ 200; mesma alíquota fictícia de 18%; base final presumida de R$ 200. Sem frete, IPI, reduções ou outros ajustes. Para isolar a cadeia, não há crédito anterior ao fabricante.',
      'Com ST: fabricante recolhe R$ 18 de ICMS próprio e R$ 18 de ICMS-ST. Total antecipado das revendas: R$ 18. Total da cadeia representada: R$ 36.',
      'Sem ST, no RPA: fabricante recolhe R$ 18; distribuidor, R$ 27 de débito menos R$ 18 de crédito = R$ 9; loja, R$ 36 menos R$ 27 = R$ 9.',
      'A soma é R$ 36 nos dois cenários porque a base presumida foi escolhida igual ao preço final efetivo e as demais hipóteses foram mantidas. Isso não prova igualdade de carga em um caso real.',
    ],
    resultado: 'O exemplo separa quem recolhe e quando. Não estima economia, margem nem alíquota aplicável ao seu produto.',
  },
  teste: { pergunta: 'Uma loja paulista vende autopeças. Pode tratar todo o estoque como isento e usar o crédito fiscal como dinheiro disponível?', resposta: 'Não. Deve identificar os itens e operações atingidos, aplicar o regime tributário correto, documentar o estoque de transição e seguir as regras de crédito. O ICMS continua existindo e o crédito não entra automaticamente na conta bancária.' },
  noApp: { texto: 'Compare com a reforma tributária, que trata da transição para IBS e CBS, e com os efeitos do financiamento no caixa.', tab: 'aprender', view: 'reforma-tributaria' },
}
