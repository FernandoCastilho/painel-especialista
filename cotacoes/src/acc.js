import { nf } from './format.js'

// Contas didáticas do ACC. Juros simples na base 360 são uma convenção usual de mercado, não regra geral:
// a forma de cálculo e de pagamento dos juros vale a do contrato. Não precifica operação real.
export function reaisAdiantados({ valorMe, taxaContrato }) {
  if (![valorMe, taxaContrato].every((v) => Number.isFinite(v) && v >= 0)) return null
  return valorMe * taxaContrato
}
export function jurosAcc({ valorMe, taxaAno, dias }) {
  if (![valorMe, taxaAno, dias].every((v) => Number.isFinite(v) && v >= 0)) return null
  return valorMe * taxaAno * dias / 360
}
// Diferença em reais entre devolver o principal na taxa do dia e o que entrou na taxa do contrato (antes de juros e encargos).
export function diferencaCambial({ valorMe, taxaContrato, taxaDia }) {
  if (![valorMe, taxaContrato, taxaDia].every((v) => Number.isFinite(v) && v >= 0)) return null
  return valorMe * (taxaDia - taxaContrato)
}

const EX = { valorMe: 100_000, taxaContrato: 5, taxaAno: 0.07, dias: 180, taxaDia: 5.4 }
const usd = (v) => `US$ ${nf(v, 0)}`
const brl = (v) => `R$ ${nf(v, 0)}`
const taxa = (v) => `R$ ${nf(v, 2)}`

export const CONCEITO_ACC = {
  id: 'acc',
  topico: 'Comércio exterior',
  nome: 'ACC (Adiantamento sobre Contrato de Câmbio)',
  aliases: ['adiantamento sobre contrato de câmbio', 'adiantamento de contrato de câmbio', 'ACE', 'pré-embarque', 'liquidação de câmbio de exportação'],
  revisadoEm: '2026-11-14',
  frase: 'É o banco pagando hoje, em reais, os dólares que o exportador só vai receber depois do embarque; a dívida se quita com a entrega desses dólares ao banco.',
  crianca: [
    'A empresa vendeu para fora, mas o dinheiro só chega depois de produzir, embarcar e esperar o comprador pagar. Nesse meio-tempo ela precisa comprar matéria-prima e pagar salários. No ACC, ela fecha com o banco um contrato de câmbio de exportação, vendendo antes os dólares que vai receber, e o banco antecipa os reais para financiar a produção.',
    'O caminho normal tem quatro passos: a mercadoria é embarcada (ou o serviço é prestado), o comprador paga, os dólares entram no país e são entregues ao banco, e essa entrega liquida o contrato de câmbio. Com isso o ACC está quitado, sem a empresa tirar reais do caixa para pagar o principal.',
    'Se os dólares não chegam como previsto, o contrato tem de ser regularizado por outro caminho: a empresa devolve o adiantamento em reais, o banco debita a conta dela (de uma vez ou em parcelas) ou o contrato é cancelado ou baixado no câmbio, com acerto de eventual diferença de taxa. Em todos esses casos, o contrato só se encerra com principal, juros, comissões, tarifas, impostos e eventuais encargos de atraso pagos.',
  ],
  analogia: 'É como vender a safra antes da colheita: o banco já comprou os dólares que a exportação vai gerar e adiantou o dinheiro. Quando a exportação paga, os dólares seguem direto para o banco e a conta fecha sozinha. Se a exportação falha, o exportador tem de pagar por fora, e esse desvio sai mais caro.',
  fluxo: {
    titulo: 'O ACC em um quadro',
    concessao: {
      titulo: 'Concessão (antes do embarque)',
      passos: [
        { quem: 'Exportador', texto: 'fecha com o banco um contrato de câmbio de exportação.' },
        { quem: 'Banco', texto: 'antecipa em reais o valor do contrato para a produção e o capital de giro.' },
      ],
    },
    principal: {
      titulo: 'Caminho normal: os dólares entram',
      passos: [
        { quem: 'Embarque', texto: 'a mercadoria sai ou o serviço é prestado.' },
        { quem: 'Pagamento', texto: 'o comprador no exterior paga o exportador.' },
        { quem: 'Ingresso', texto: 'os dólares entram no país, normalmente por transferência do exterior, e vão para o banco.' },
        { quem: 'Liquidação', texto: 'a entrega dos dólares liquida o contrato de câmbio.' },
      ],
      fim: 'ACC quitado: o banco recebeu as divisas e, pagos os juros e encargos do contrato, a operação acaba.',
    },
    desvio: {
      titulo: 'Desvio: os dólares não entram como previsto',
      passos: [
        { quem: 'Devolução', texto: 'o exportador devolve ao banco, em reais, o valor adiantado.' },
        { quem: 'Débito em conta', texto: 'o banco debita o adiantamento e os encargos da conta do exportador, inclusive em partes, até quitar.' },
        { quem: 'Cancelamento ou baixa', texto: 'o contrato sai da posição de câmbio do banco. O cancelamento depende de acordo e costuma ter acerto de diferença cambial; a baixa é só contábil e não extingue a dívida.' },
      ],
      fim: 'Em qualquer desvio, o contrato só fecha com principal, encargos, comissões, despesas, tarifas, impostos e eventuais encargos por atraso pagos.',
    },
    custos: {
      titulo: 'O que pode pesar na conta',
      itens: [
        { nome: 'Juros (deságio)', texto: 'o custo financeiro do adiantamento, em moeda estrangeira.' },
        { nome: 'Comissões', texto: 'as previstas no contrato da operação.' },
        { nome: 'Despesas, tarifas e impostos', texto: 'custos operacionais e tributários da operação.' },
        { nome: 'Encargos por atraso', texto: 'entram só se houver mora ou inadimplência.' },
        { nome: 'Diferença cambial', texto: 'aparece no cancelamento, quando o contrato prevê acerto pela taxa do dia; pode ser contra ou a favor da empresa.' },
        { nome: 'Encargo do Banco Central', texto: 'cancelamento ou baixa antes do embarque pode sujeitar o exportador a um encargo financeiro recolhido ao Banco Central (Resolução CMN 5.056/2022).' },
      ],
    },
  },
  lacunas: [
    'ACC não é um empréstimo comum em reais: a dívida nasce em moeda estrangeira, presa a um contrato de câmbio, e o pagamento esperado são as divisas da própria exportação. Pagar em reais é a exceção e tende a custar mais.',
    'ACC e ACE são parecidos, mas em momentos diferentes: o ACC antecipa antes do embarque (pré-embarque); o ACE (Adiantamento sobre Cambiais Entregues) antecipa depois do embarque, com os documentos da exportação já entregues ao banco.',
    'O juro do ACC, chamado de deságio, é cobrado em moeda estrangeira. Por isso costuma ser comparado ao custo do dinheiro em dólar (cupom cambial e referências externas como a SOFR), e não ao CDI.',
    'Cancelamento e baixa não são a mesma coisa. O cancelamento depende de acordo entre empresa e banco, e o contrato costuma prever o acerto pela taxa do dia: se o dólar subiu, a empresa paga a diferença; se caiu, a diferença pode ser a favor dela. A baixa é só um registro contábil, feito na taxa do contrato, e não extingue a dívida (Resolução BCB 277/2022, art. 41).',
    'Antes do embarque, cancelar ou baixar o ACC pode gerar, além dos custos do banco, um encargo financeiro recolhido ao Banco Central (Resolução CMN 5.056/2022). Há dispensas, por exemplo quando a mercadoria já foi embarcada; confira a norma.',
    'Para o crédito: pela Lei 11.101/2005 (art. 49, § 4º, e art. 86, II), o valor adiantado em ACC fica fora da recuperação judicial e pode ser pedido em restituição na falência, desde que o adiantamento esteja registrado no contrato e o prazo total, com prorrogações, respeite as normas do Banco Central. O tratamento dos juros e encargos é discutido nos tribunais; confirme com o jurídico.',
    'Prazos e regras de regularização seguem a regulamentação do Banco Central (Resolução BCB 277/2022 e alterações) e o contrato. Confira a versão vigente antes de usar um prazo.',
  ],
  preciso: {
    texto: 'O ACC é a antecipação, em moeda nacional, do valor de um contrato de câmbio de exportação (Resolução BCB 277/2022, art. 36, que regulamenta a Lei 14.286/2021). No mercado, o nome ACC é usado para a fase antes do embarque. A Lei 4.728/1965, art. 75, dá ao contrato força de cobrança na Justiça e base para a restituição na falência. A liquidação normal se dá pela entrega da moeda estrangeira ao banco. Sem o ingresso das divisas, o contrato é regularizado por prorrogação, liquidação, cancelamento ou baixa, conforme a regulamentação, e só se encerra após o pagamento do principal e de todos os encargos. Na conta abaixo, juros simples na base 360 são uma convenção usual, não regra: vale o contrato.',
    formula: 'reais adiantados = valor em US$ × taxa do contrato   ·   juros em US$ = valor × taxa ao ano × dias ÷ 360   ·   diferença no cancelamento, se o contrato prever = valor × (taxa do dia − taxa do contrato)',
  },
  exemplo: (() => {
    const reais = reaisAdiantados(EX), juros = jurosAcc(EX), dif = diferencaCambial(EX)
    return {
      titulo: `ACC de ${usd(EX.valorMe)} a ${taxa(EX.taxaContrato)}, com juros hipotéticos de ${nf(EX.taxaAno * 100, 0)}% ao ano por ${EX.dias} dias`,
      passos: [
        `Na concessão, a empresa recebe ${nf(EX.valorMe, 0)} × ${nf(EX.taxaContrato, 2)} = ${brl(reais)} antes do embarque.`,
        `Juros do período: ${nf(EX.valorMe, 0)} × ${nf(EX.taxaAno * 100, 0)}% × ${EX.dias} ÷ 360 = ${usd(juros)}, acertados conforme o contrato.`,
        `Caminho normal: o comprador paga ${usd(EX.valorMe)}, os dólares são entregues ao banco e liquidam o contrato. A empresa não tira reais do caixa para pagar o principal.`,
        `Desvio: o pedido é cancelado e o contrato de câmbio é cancelado de comum acordo, com acerto pelo dólar a ${taxa(EX.taxaDia)}. Devolver o principal custa ${nf(EX.valorMe, 0)} × ${nf(EX.taxaDia, 2)} = ${brl(EX.valorMe * EX.taxaDia)}, ou ${brl(dif)} a mais do que entrou.`,
      ],
      resultado: `No caminho normal, a própria exportação paga a dívida. No desvio, a empresa devolve ${brl(EX.valorMe * EX.taxaDia)}, ${brl(dif)} a mais só pela variação do câmbio, além dos juros (${usd(juros)}, cerca de ${brl(juros * EX.taxaDia)} a ${taxa(EX.taxaDia)}), do eventual encargo do Banco Central, de tarifas e de encargos de atraso. Números ilustrativos, não são cotação nem taxa de mercado.`,
    }
  })(),
  noApp: { texto: 'Aba Juros: o cupom cambial e a SOFR mostram o custo do dinheiro em dólar, referência para comparar o juro do ACC.', tab: 'juros' },
  teste: {
    pergunta: 'Uma empresa tomou ACC, mas o cliente no exterior cancelou o pedido. Quais são os caminhos para fechar o contrato e por que nenhum é tão barato quanto o fluxo normal?',
    resposta: 'Sem a entrada dos dólares, o contrato precisa ser regularizado: devolução do adiantamento em reais, débito em conta (inteiro ou em partes) ou cancelamento ou baixa no câmbio. Em todos, a empresa paga principal e encargos com recursos próprios, em vez de usar as divisas da exportação; no cancelamento ainda pode arcar com a diferença cambial se o dólar subiu e, antes do embarque, com o encargo do Banco Central.',
  },
  fontes: [
    { nome: 'Banco Central · Resolução BCB nº 277/2022 (mercado de câmbio)', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=277' },
    { nome: 'Banco Central · Resolução CMN nº 5.056/2022 (encargo no cancelamento ou baixa)', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=5056' },
    { nome: 'Planalto · Lei 14.286/2021 (marco cambial)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14286.htm' },
    { nome: 'Planalto · Lei 4.728/1965 (art. 75)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l4728.htm' },
    { nome: 'Planalto · Lei 11.101/2005 (arts. 49 e 86)', url: 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm' },
  ],
}
