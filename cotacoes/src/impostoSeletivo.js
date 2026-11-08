import { nf } from './format.js'

const baseDidatica = 100
const aliquotaFicticia = 0.1
const impostoDidatico = baseDidatica * aliquotaFicticia

export const CONCEITO_IMPOSTO_SELETIVO = {
  id: 'imposto-seletivo',
  topico: 'Tributos e trabalho',
  nome: 'Imposto do Pecado (Imposto Seletivo no Brasil)',
  revisadoEm: '2026-11-08',
  frase: 'O Imposto Seletivo busca desestimular bens e serviços prejudiciais à saúde ou ao meio ambiente.',
  crianca: [
    '“Imposto do pecado” é o apelido do Imposto Seletivo (IS), criado pela reforma tributária. A ideia é usar a tributação para reduzir danos, influenciando decisões de consumo e produção; não é uma cobrança religiosa.',
    'O alcance legal inclui veículos, aeronaves e embarcações, produtos fumígenos, bebidas alcoólicas e açucaradas, bens minerais e concursos de prognósticos e fantasy sport. O enquadramento depende da classificação e das exceções legais: nem todo produto dessas famílias paga a mesma coisa.',
    'Na prática, a empresa precisa conferir o produto, a base de cálculo e a regra aplicável antes de rever preços e margens. O consumidor pode sentir o efeito no preço, mas o repasse depende da concorrência e das decisões da empresa.',
    'Situação em 08/11/2026: a MP 1.399/2026 prevê início da cobrança em 2 de fevereiro de 2027 e disciplina temporária até dezembro. A MP ainda precisa da aprovação do Congresso para virar lei. As regras de 2028 dependem de legislação posterior.',
  ],
  analogia: 'É um sinal de preço para atividades com custos para a saúde ou o ambiente: o tributo tenta mudar incentivos, sem garantir sozinho que o consumo caia.',
  lacunas: [
    'Não existe uma alíquota única de “imposto do pecado”. O cálculo pode usar percentual, valor por unidade ou uma combinação, conforme o produto e a norma.',
    'O IS tem regras próprias e não funciona como os créditos de IBS e CBS. Em regra, incide uma única vez e não gera créditos para compensar o próprio IS de etapas anteriores.',
    'Não some o novo IS ao IPI antigo como se ambos permanecessem integralmente iguais. Para 2027, o governo propõe preservar a carga na transição, com conversões entre bases diferentes e redução do IPI; confira a norma vigente.',
    'Aumento de um imposto sobre um produto não equivale à mesma alta do IPCA. O efeito agregado depende do repasse, do peso do item e da reação de consumidores e empresas.',
  ],
  preciso: {
    texto: 'A EC 132/2023 criou a competência federal e a LC 214/2025, atualizada, instituiu o IS (art. 409 e seguintes). A incidência e o contribuinte dependem da operação prevista em lei, como produção, extração, comercialização ou importação. O tributo integra a base do IBS e da CBS, mas não a própria base. A conta abaixo isola somente um percentual fictício, sem reproduzir a apuração legal ou o preço final.',
    formula: 'IS ilustrativo = base hipotética × alíquota fictícia',
  },
  exemplo: {
    titulo: 'Base de R$ 100 e taxa fictícia de 10%',
    passos: [
      `Admita uma base de R$ ${nf(baseDidatica, 2)} e uma alíquota inventada de 10%, apenas para aprender a conta.`,
      `Multiplique R$ ${nf(baseDidatica, 2)} × 10% = R$ ${nf(impostoDidatico, 2)} de IS ilustrativo.`,
      'Para chegar ao preço final, ainda seria necessário considerar a legislação, outros tributos, custos, margens e o repasse. Não se pode concluir que o preço subirá exatamente 10%.',
    ],
    resultado: `R$ ${nf(impostoDidatico, 2)} de imposto no exemplo. Os 10% não são uma alíquota oficial de qualquer produto.`,
  },
  teste: {
    pergunta: 'Uma bebida e um veículo terão necessariamente a mesma alíquota de IS e o mesmo aumento de preço?',
    resposta: 'Não. A classificação, a base e a alíquota variam; há exceções e regras de transição. Mesmo após calcular o imposto, o repasse ao preço depende de margens, concorrência e demanda.',
  },
  noApp: { texto: 'Em Cenários, acompanhe a inflação para comparar alterações de preços. Este conceito explica o IS; o painel não apura o tributo de um produto.', tab: 'cenarios', view: 'inflacao' },
  fontes: [
    { nome: 'Câmara — LC 214/2025, texto atualizado, art. 409 e seguintes', url: 'https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html' },
    { nome: 'Ministério da Fazenda — regras temporárias do IS para 2027 (05/11/2026)', url: 'https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/novembro/governo-federal-define-aliquotas-do-imposto-seletivo-para-2027-por-meio-de-medida-provisoria' },
    { nome: 'Agência Câmara — MP 1.399/2026 e tramitação (05/11/2026)', url: 'https://www.camara.leg.br/noticias/1316363-medida-provisoria-regulamenta-o-imposto-seletivo-para-2027' },
  ],
}
