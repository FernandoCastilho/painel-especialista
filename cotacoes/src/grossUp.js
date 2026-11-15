// Reconstrução educacional de 14/11/2026; não altera calculadoras ou regras tributárias.
export const CONCEITO_GROSS_UP = {
  id: 'gross-up',
  nome: 'Gross-up',
  aliases: ['gross up', 'grossup', 'reajustamento do rendimento bruto'],
  topico: 'Operações de crédito',
  revisadoEm: '2026-11-14',
  frase: 'Gross-up é aumentar o pagamento bruto para preservar um valor líquido combinado após uma retenção.',
  crianca: [
    'Imagine que alguém precisa receber um valor líquido e uma parte do pagamento será retida. O bruto precisa ser maior para que, depois da retenção, sobre o líquido combinado.',
    'Em contratos de crédito, confira quem suporta o imposto. Juros líquidos para o credor podem ser diferentes do desembolso total do tomador.',
    'A cláusula distribui o custo econômico entre as partes; não elimina tributos nem substitui o enquadramento legal.',
  ],
  analogia: 'É como colocar mais água antes de um filtro que retém uma fração, para obter a quantidade desejada depois dele.',
  lacunas: [
    'A alíquota de 20% do exemplo é hipotética. Não é taxa padrão de FINIMP, empréstimo externo ou qualquer produto.',
    'Não basta somar 20% ao líquido: no modelo proporcional, o adicional também sofre retenção.',
    'Gross-up não é spread nem CET. Confira o fluxo completo, câmbio, datas, tarifas, IOF e demais encargos aplicáveis.',
    'No Brasil, o art. 786 do RIR/2018 trata do reajustamento quando a fonte assume o imposto do beneficiário, com exceções. O art. 761, § 1º, afasta esse reajustamento nos juros remetidos pela compra de bens a prazo, hipótese em que o remetente é contribuinte. Não generalize para todo financiamento de importação.',
    'A SC Cosit 82/2019 trata de royalties e crédito fictício no tratado Brasil–Espanha: nesse crédito não se aumenta a base por gross-up. Não é uma regra universal para empréstimos.',
    'Na comparação de investimentos, a expressão também pode indicar uma taxa bruta equivalente à líquida. Isso não significa que o emissor pagará um adicional.',
  ],
  preciso: {
    texto: 'Modelo didático: uma única retenção proporcional sobre todo o bruto, sem deduções. Se L é o líquido, B o bruto e t a alíquota em fração, L = B × (1 − t), com 0 ≤ t < 1. Deduções, progressividade e bases diferentes exigem outro modelo. Em uma operação real, valide natureza do rendimento, residência, tratado, isenção, contrato e legislação vigente.',
    formula: 'Bruto = líquido ÷ (1 − alíquota); retenção = bruto − líquido.',
  },
  exemplo: {
    titulo: 'US$ 800 líquidos com retenção hipotética de 20%',
    passos: [
      'Hipótese didática: preservar US$ 800,00 líquidos após uma única retenção de 20% sobre todo o bruto.',
      'Bruto: US$ 800,00 ÷ 0,80 = US$ 1.000,00.',
      'Retenção: US$ 1.000,00 × 20% = US$ 200,00. Líquido: US$ 1.000,00 − US$ 200,00 = US$ 800,00.',
      'Somar apenas 20% daria US$ 960,00; a retenção seria US$ 192,00 e sobrariam US$ 768,00.',
    ],
    resultado: 'O adicional de US$ 200,00 equivale a 25% do líquido de US$ 800,00, embora a retenção seja 20% do bruto.',
  },
  teste: {
    pergunta: 'Uma retenção de 20% sobre o bruto se resolve acrescentando 20% ao líquido?',
    resposta: 'Não neste modelo. Divide-se o líquido por 0,80. O adicional também sofre retenção; por isso US$ 800 líquidos exigem US$ 1.000 brutos.',
  },
  noApp: { tab: 'aprender', view: 'cet', texto: 'Compare com CET: gross-up é um componente possível, não o custo completo da operação.' },
  fontes: [
    { nome: 'Câmara dos Deputados · RIR/2018, arts. 761 e 786', url: 'https://www2.camara.leg.br/legin/fed/decret/2018/decreto-9580-22-novembro-2018-787360-normaatualizada-pe.html' },
    { nome: 'SC Cosit 82/2019 · documento da Receita em cópia IBET, itens 44–46', url: 'https://www.ibet.com.br/wp-content/uploads/2019/03/SC_Cosit_n_82-2019.pdf' },
  ],
}
