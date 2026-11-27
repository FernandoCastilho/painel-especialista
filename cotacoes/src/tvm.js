import { nf } from './format.js'

// Conceito do Aprender pedido por Fernando em 27/11/2026. Didático: não altera calculadoras nem dados de bancos.
// Os números do exemplo saem das funções abaixo (testadas), nunca digitados no texto.

// Dívida líquida abatendo só o caixa e as aplicações livres (sem as vinculadas a garantia ou bloqueadas).
export const dividaLiquida = ({ divida, caixa, aplicacoes, vinculadas = 0 }) => divida - caixa - (aplicacoes - vinculadas)
export const alavancagem = (divida, ebitda) => divida / ebitda

const EX = { divida: 30, caixa: 2, aplicacoes: 8, vinculadas: 3, ebitda: 10 }
const mi = (v) => `R$ ${nf(v, 1)} mi`
const vezes = (v) => `${nf(v, 2)}x`

export const CONCEITO_TVM = {
  id: 'tvm',
  topico: 'Contabilidade e balanços',
  nome: 'TVM (Títulos e Valores Mobiliários)',
  aliases: ['tvm', 'títulos e valores mobiliários', 'aplicações financeiras', 'ativos financeiros', 'custo amortizado', 'valor justo', 'VJORA', 'VJR', 'mantidos até o vencimento', 'disponíveis para venda', 'para negociação', 'Circular 3.068', 'Resolução CMN 4.966', 'CPC 48', 'IFRS 9'],
  revisadoEm: '2026-11-27',
  frase: 'TVM é a carteira de títulos que uma empresa ou um banco tem no balanço, como títulos públicos, CDBs, debêntures, cotas de fundos e ações, junto com a regra que diz como cada um é avaliado.',
  crianca: [
    'Quando a empresa aplica o caixa num CDB, compra título público ou guarda ações de outra empresa, esse dinheiro vira um ativo financeiro. No balanço, aparece como aplicações financeiras ou TVM, e a nota explicativa mostra o que há dentro.',
    'O ponto central é como cada título é avaliado. Alguns ficam pelo valor da curva, isto é, pela taxa contratada (custo amortizado). Outros são marcados a mercado: a oscilação do preço vai para o resultado do período ou fica no patrimônio líquido, conforme a categoria.',
    'Na análise de crédito, a pergunta é: esse dinheiro está livre e vira caixa rápido? Aplicação dada em garantia, bloqueada, de pouca liquidez ou em ações de empresa ligada não paga dívida com a mesma facilidade que um CDB de liquidez diária.',
    'Nos resultados dos bancos, TVM costuma aparecer ao lado da carteira de crédito: debêntures, notas comerciais, CRI e CRA comprados de empresas são, na prática, crédito. Por isso alguns indicadores de inadimplência dizem “incluindo TVM”.',
  ],
  analogia: 'É a gaveta de investimentos da empresa: importa quanto há nela, se a gaveta está trancada e quanto cada papel valeria se fosse vendido hoje.',
  lacunas: [
    'TVM não é sinônimo de caixa. Confira na nota explicativa o prazo, a liquidez, o emissor e se há aplicação vinculada a garantia, a depósito judicial ou a exigência de contrato.',
    'Para a lei do mercado de capitais (Lei 6.385/1976, art. 2º, § 1º), título da dívida pública não é valor mobiliário. Na contabilidade, porém, ele entra na carteira de TVM. A sigla contábil é mais ampla que o conceito jurídico.',
    'Desde 1º/01/2025, os bancos classificam esses ativos pela Resolução CMN 4.966/2021, que revogou a Circular 3.068/2001. Balanços antigos usam as categorias da circular: para negociação, disponíveis para venda e mantidos até o vencimento. Cuidado ao comparar séries.',
    'Ganho ou perda de marcação a mercado não é caixa realizado. Um lucro puxado pela alta de títulos a mercado pode se desfazer no trimestre seguinte; separe esse efeito do resultado da operação.',
    'Empresas que adotam o CPC PME seguem regras mais simples, e as categorias do CPC 48 podem não aparecer com esses nomes.',
    'Em textos em inglês, TVM também é a sigla de time value of money (valor do dinheiro no tempo). Aqui, TVM é Títulos e Valores Mobiliários.',
    'Perguntas de visita: o que há nas aplicações financeiras? Alguma está em garantia ou bloqueada? Em quanto tempo vira caixa? Quem é o emissor? Como o contrato define caixa e dívida líquida?',
  ],
  preciso: {
    texto: 'Nas empresas que seguem o CPC 48 (equivalente ao IFRS 9), cada ativo financeiro é classificado pelo modelo de negócio (manter para receber os fluxos, manter para receber e vender, ou negociar) e pelas características dos fluxos do contrato (se são só principal e juros). Daí saem três categorias: custo amortizado, valor justo por meio de outros resultados abrangentes (VJORA) e valor justo por meio do resultado (VJR). Nas instituições financeiras, a Resolução CMN 4.966/2021 adota lógica equivalente desde 2025, com provisão para perda esperada também sobre títulos.',
    formula: 'Custo amortizado: valor pela taxa efetiva, juros no resultado · VJORA: valor a mercado, oscilação no patrimônio líquido (outros resultados abrangentes) · VJR: valor a mercado, oscilação direto no resultado.',
    tipo: 'conceitual',
  },
  exemplo: (() => {
    const reportada = dividaLiquida({ ...EX, vinculadas: 0 })
    const ajustada = dividaLiquida(EX)
    const livres = EX.aplicacoes - EX.vinculadas
    return {
      titulo: 'Dívida líquida com aplicação dada em garantia · valores hipotéticos',
      passos: [
        `Balanço: dívida bruta de ${mi(EX.divida)}, caixa de ${mi(EX.caixa)} e aplicações financeiras (TVM) de ${mi(EX.aplicacoes)}. A nota explicativa mostra ${mi(EX.vinculadas)} dessas aplicações dados em garantia de um empréstimo. EBITDA do ano: ${mi(EX.ebitda)}.`,
        `Dívida líquida pelo número do balanço: ${nf(EX.divida, 1)} − ${nf(EX.caixa, 1)} − ${nf(EX.aplicacoes, 1)} = ${mi(reportada)}. Alavancagem: ${vezes(alavancagem(reportada, EX.ebitda))} o EBITDA.`,
        `Tirando a aplicação em garantia, que não está livre para pagar a dívida: ${nf(EX.divida, 1)} − ${nf(EX.caixa, 1)} − ${nf(livres, 1)} = ${mi(ajustada)}. Alavancagem: ${vezes(alavancagem(ajustada, EX.ebitda))}.`,
        'Se o contrato tiver limite de 2,25x, a mesma empresa cumpre por uma conta e descumpre pela outra. Vale a definição escrita no contrato.',
      ],
      resultado: `A diferença de ${vezes(alavancagem(ajustada - reportada, EX.ebitda))} na alavancagem vem só da leitura da nota de TVM, sem mudar nada na operação da empresa.`,
    }
  })(),
  teste: {
    pergunta: 'Uma empresa tem R$ 8 milhões em aplicações financeiras: posso abater tudo da dívida para calcular a dívida líquida?',
    resposta: 'Não sem ler a nota explicativa. Abata só o que está livre e tem liquidez; aplicação em garantia, bloqueada ou de difícil venda pode ficar de fora. Confira também como o contrato define caixa.',
  },
  noApp: { tab: 'aprender', view: 'marcacao-a-mercado', texto: 'Veja em Marcação a mercado por que um título muda de preço quando os juros mudam, mesmo sem calote do emissor.' },
  fontes: [
    { nome: 'Banco Central · Resolução CMN 4.966/2021 (instrumentos financeiros)', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4966' },
    { nome: 'CPC 48 · Instrumentos Financeiros', url: 'https://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos/Pronunciamento?Id=106' },
    { nome: 'Planalto · Lei 6.385/1976, art. 2º (valores mobiliários)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6385compilada.htm' },
  ],
}
