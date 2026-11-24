// Organização do catálogo apenas: IDs e destinos existentes permanecem intactos.
export const CALCULATOR_GROUPS = [
  {
    id: 'credito-giro', title: 'Crédito e capital de giro',
    description: 'Simule financiamentos, necessidades de caixa e antecipação de recebíveis.',
    calculators: ['finame-materiais', 'comparador-credito', 'giro', 'conta-garantida', 'analise-desconto'],
  },
  {
    id: 'internacional', title: 'Crédito internacional',
    description: 'Avalie importações e empréstimos em moeda estrangeira.',
    calculators: ['finimp', 'emprestimo-4131', 'cambio-futuro'],
  },
  {
    id: 'taxas-cambio', title: 'Taxas e câmbio',
    description: 'Compare referências de juros e cenários do dólar.',
    calculators: ['operacao-di', 'cdi-dolar'],
  },
  {
    id: 'planejamento', title: 'Planejamento e análise',
    description: 'Analise faturamento, distribuição de lucros e impactos tributários no caixa.',
    calculators: ['faturamento', 'dividendos-emprestimo', 'cbs-caixa'],
  },
]
