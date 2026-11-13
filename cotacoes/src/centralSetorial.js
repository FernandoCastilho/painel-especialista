// Catálogo do Agente Setorial. Disponibilidade do estudo indicada por recorte.
export const CATALOGO_SETORIAL = [
  ['base-florestal', 'Base florestal e madeira', ['Florestas plantadas','Serrarias','Lâminas','Compensados','MDF e MDP','Móveis']],
  ['transporte-logistica', 'Transporte e logística', ['Carga geral','Transporte de madeira','Transporte de grãos','Transporte refrigerado','Transporte de produtos perigosos','Armazenagem','Logística portuária']],
  ['papel-celulose', 'Papel, celulose e embalagens', ['Celulose','Papel','Papelão ondulado','Caixas','Sacos industriais','Tubetes']],
  ['alimentos-agroindustria', 'Alimentos e agroindústria', ['Frigoríficos','Laticínios','Moinhos','Óleos vegetais','Alimentos processados','Bebidas']],
  ['metalmecanico', 'Metalmecânico e máquinas', ['Fundição','Usinagem','Estruturas metálicas','Máquinas industriais','Máquinas agrícolas','Equipamentos']],
  ['automotivo', 'Automotivo e autopeças', ['Componentes automotivos','Implementos rodoviários','Reposição de autopeças','Distribuidores de peças']],
  ['construcao', 'Construção e materiais', ['Construção residencial','Galpões','Infraestrutura','Cimento','Cerâmica','Vidros','Esquadrias']],
  ['textil', 'Têxtil e vestuário', ['Fiação','Tecelagem','Malharia','Tinturaria','Confecção','Tecidos técnicos']],
  ['quimicos', 'Químicos, plásticos e borracha', ['Resinas','Transformação plástica','Embalagens flexíveis','Tintas','Limpeza','Borracha']],
  ['atacado', 'Atacado e distribuição', ['Distribuição de alimentos','Distribuição de medicamentos','Distribuição de materiais de construção','Distribuição de insumos industriais','Distribuição de equipamentos','Distribuição de válvulas para óleo e gás']],
  ['tic', 'Tecnologia da Informação e Comunicação — TIC', ['Integração de TI e infraestrutura digital','Cibersegurança','Redes e conectividade','Serviços gerenciados de TI','Comunicação e colaboração','Software e serviços de TI','Data centers e nuvem','Operadoras de telecomunicações']],
].map(([id, label, topics]) => ({ id, label, topics }))
export const TOPICOS_ESTUDO = ['Resumo executivo','Funcionamento e cadeia de valor','Empresas, concorrência e polos de referência','Histórico e indicadores','Conjuntura e impactos','Economia da empresa e financiamento','Cenários e sinais de acompanhamento','Fontes, método e limitações']
export const normalizeSector = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()


// Pautas editoriais para pesquisa. Os recortes existentes são ligados por sua rota estável.
export const PAUTAS_SETORIAIS = [
  {
    label: 'Primeira rodada',
    topics: [
      { id: 'embalagens', title: 'Embalagens', scope: 'Comparar embalagens de papel, plástico, metal e vidro. Investigar custo e repasse de insumos, estoques e financiamento de máquinas.', related: [['papel-celulose', 2], ['quimicos', 2]] },
      { id: 'energia', existingRoute: 'energia', title: 'Energia elétrica e renováveis', scope: 'Distinguir geração, transmissão, distribuição e comercialização. Investigar contratos, investimentos, prazo até a geração de caixa e exposição a preços.' },
      { id: 'materiais-de-construcao', title: 'Materiais de Construção', scope: 'Comparar fabricantes, distribuidores e varejistas. Investigar sazonalidade, estoques, frete e prazo de recebimento.', related: [['construcao', 3], ['atacado', 2]] },
      { id: 'locacao-de-leves', title: 'Locação de Leves', scope: 'Investigar utilização, renovação e financiamento da frota, receita contratada e valor de revenda dos veículos leves.' },
    ],
  },
  {
    label: 'Automotivo e frotas',
    topics: [
      { id: 'locacao-de-pesados', title: 'Locação de Pesados', scope: 'Investigar contratos, utilização, manutenção, renovação da frota e valor residual de caminhões e equipamentos.' },
      { id: 'concessionarias', title: 'Concessionárias', scope: 'Investigar financiamento e giro de estoque, margem em novos e usados e contribuição da receita de pós-venda.' },
    ],
  },
  {
    label: 'Aprofundamentos',
    topics: [
      { id: 'bens-de-capital', title: 'Bens de Capital', scope: 'Investigar carteira de encomendas, adiantamentos, prazo de entrega e exposição cambial na produção de máquinas e equipamentos.', related: [['metalmecanico', 3], ['metalmecanico', 4], ['metalmecanico', 5]] },
      { id: 'farmacias', title: 'Farmácias e Varejo Farmacêutico', scope: 'Investigar estoques, validade dos produtos, prazos de fornecedores e capital de giro no varejo farmacêutico.', related: [['atacado', 1]] },
    ],
  },
  {
    label: 'Indústria e serviços',
    topics: [
      { id: 'aco-e-mineracao', existingRoute: 'mineracao', title: 'Mineração e materiais básicos', scope: 'Investigar a cadeia de aço e mineração, da extração e beneficiamento do minério à siderurgia. Comparar custos, destino das vendas e financiamento da produção.', related: [['metalmecanico', 0], ['metalmecanico', 2]] },
      { id: 'industria-farmaceutica', title: 'Indústria Farmacêutica', scope: 'Investigar fabricação de medicamentos, dependência de insumos importados, estoques e ciclo de venda para distribuidores.', related: [['atacado', 1]] },
      { id: 'saude', existingRoute: 'saude-assistencial', title: 'Hospitais, clínicas e cuidados', scope: 'Investigar a prestação de serviços de saúde, a composição das receitas, prazos de repasse, glosas e investimento em equipamentos.' },
      { id: 'facilities', existingRoute: 'terceirizacao', title: 'Terceirização e facilities', scope: 'Investigar contratos de serviços, reajustes de mão de obra, prazos de recebimento e capital de giro.' },
      { id: 'educacao', existingRoute: 'educacao', title: 'Educação privada', scope: 'Comparar educação básica e superior. Investigar calendário de matrículas, retenção, inadimplência e expansão de unidades.' },
    ],
  },
  {
    label: 'Varejo e distribuição',
    topics: [
      { id: 'atacarejo', title: 'Atacarejo', scope: 'Investigar giro de estoque, escala de compra, exposição a perdas e financiamento de novas lojas.', related: [['atacado', 0]] },
      { id: 'supermercados', title: 'Supermercados', scope: 'Investigar perecíveis, perdas, margem por categoria, recebimento de cartões e ciclo de caixa.' },
      { id: 'varejo-de-vestuario', title: 'Varejo de Vestuário', scope: 'Investigar compra de coleções, giro, remarcações, sazonalidade e capital de giro.', related: [['textil', 4]] },
      { id: 'beleza-e-cuidados-pessoais', title: 'Beleza e Cuidados Pessoais', scope: 'Distinguir fabricação, distribuição e varejo. Investigar mix, canais de venda, estoque e repasse de custos.' },
    ],
  },
  {
    label: 'Próxima rodada',
    topics: [
      { id: 'pet', title: 'Pet', scope: 'Distinguir alimentação, varejo e serviços veterinários. Investigar recorrência, estoques e canais de venda.' },
      { id: 'suplementos-e-wellness', title: 'Suplementos e Wellness', scope: 'Investigar fabricação, importação, distribuição, giro de estoque e concentração por canal de venda.' },
      { id: 'restaurantes', existingRoute: 'alimentacao-servicos', title: 'Restaurantes e alimentação', scope: 'Investigar margem por canal, perdas de estoque, sazonalidade, despesas fixas e prazo de recebimento.' },
      { id: 'academias', title: 'Academias', scope: 'Investigar receitas recorrentes, cancelamentos, ocupação, maturação de unidades e financiamento de equipamentos.' },
    ],
  },
  {
    label: 'Movimentos estratégicos',
    topics: [
      { id: 'atratividade-setorial-ma', title: 'Atratividade setorial para M&A', scope: 'Pesquisar transações públicas, concentração de mercado e sinais de consolidação por setor, com data e fonte.' },
      { id: 'processo-ma', title: 'Processo de fusões e aquisições (M&A)', scope: 'Mapear preparação, avaliação, negociação, diligência e integração para futura explicação em Aprender.' },
      { id: 'governanca-corporativa', title: 'Governança corporativa', scope: 'Pesquisar decisões societárias, controles e prestação de contas para futura explicação em Aprender.' },
      { id: 'jornada-ipo', title: 'Jornada para o IPO', scope: 'Pesquisar etapas de preparação para a oferta pública inicial de ações, com referências da CVM e da B3, para futura explicação em Aprender.' },
    ],
  },
]

export const ESTUDOS_RELACIONADOS_AS_PAUTAS = [
  ['automotivo', null],
  ['papel-celulose', null],
  ['metalmecanico', null],
  ['quimicos', null],
  ['atacado', 0],
  ['alimentos-agroindustria', 4],
  ['transporte-logistica', null],
  ['alimentos-agroindustria', 5],
  ['quimicos', 3],
]

export const rotaPautaSetorial = topic => topic.existingRoute || `pesquisa/${topic.id}`
