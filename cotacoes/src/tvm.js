import { nf } from './format.js'

// Texto aprovado por Fernando em 27/11/2026. Exemplo didático com números redondos; não é cotação.
export const EX_TVM = { principal: 10_000_000, taxa: 0.12, anos: 2, taxaMercado: 0.13 }
export const tvmNoVencimento = ({ principal, taxa, anos }) => principal * (1 + taxa) ** anos
export const tvmNaCurva = ({ principal, taxa }, anosDecorridos) => principal * (1 + taxa) ** anosDecorridos
export const tvmValorJusto = (vencimento, taxaMercado, anosRestantes) => vencimento / (1 + taxaMercado) ** anosRestantes

const reais = (v) => `R$ ${nf(v, 0)}`
const venc = tvmNoVencimento(EX_TVM)
const curva = tvmNaCurva(EX_TVM, 1)
const justo = tvmValorJusto(venc, EX_TVM.taxaMercado, 1)

export const CONCEITO_TVM = {
  id: 'tvm',
  nome: 'TVM (Títulos e Valores Mobiliários)',
  aliases: ['títulos e valores mobiliários', 'valores mobiliários', 'carteira ampliada', 'incluindo TVM', 'custo amortizado', 'VJORA', 'VJR', 'DTVM'],
  topico: 'Operações de crédito',
  revisadoEm: '2026-11-27',
  fontes: [
    { nome: 'Planalto — Lei 6.385/1976, art. 2º (valores mobiliários)', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6385.htm' },
    { nome: 'Banco Central — Resolução CMN 4.966/2021 (instrumentos financeiros)', url: 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20CMN&numero=4966' },
  ],
  frase: 'São papéis que podem ser vendidos a outro investidor, como títulos públicos, debêntures, notas comerciais, CRI, CRA e cotas de fundos. No balanço do banco, ficam separados das operações de crédito.',
  crianca: [
    'Quando o banco empresta para uma empresa por uma CCB, isso é uma operação de crédito, um contrato só entre os dois. Quando a empresa emite uma debênture ou uma nota comercial e o banco compra, o banco passa a ter um título que pode vender a outro investidor. Esse título entra no balanço como TVM.',
    'Para quem analisa bancos, o risco é parecido: nos dois casos a empresa deve ao banco. Por isso muitos bancos mostram a carteira "ampliada" e a inadimplência "incluindo TVM", somando os títulos de empresas ao crédito.',
    'Desde 2025, o banco classifica cada título pelo que pretende fazer com ele. Se for guardar até o vencimento, o título fica na curva (custo amortizado). Se puder guardar ou vender, fica a valor justo, com o ajuste no patrimônio (VJORA). Se for para negociar, fica a valor justo, com o ajuste no lucro (VJR).',
  ],
  analogia: 'O crédito é um acordo assinado só entre duas partes. O TVM é um papel padronizado que pode trocar de dono, como um ingresso numerado que se revende.',
  lacunas: [
    '"Valor mobiliário", no sentido da CVM, é mais estreito que TVM no balanço. A Lei 6.385 deixa de fora título público e títulos emitidos por banco, como o CDB. Mesmo assim, no balanço do banco, o título público entra em TVM.',
    'DTVM é uma instituição, a distribuidora de títulos e valores mobiliários, e não o título.',
    'O mesmo título pode ter valores diferentes no balanço conforme a categoria. Na curva, não mostra a oscilação de preço; a valor justo, mostra.',
    'Inadimplência "incluindo TVM" não é só empréstimo. Para comparar bancos, use a mesma base nos dois.',
  ],
  preciso: {
    texto: 'A Lei 6.385/1976, art. 2º, lista os valores mobiliários sob a CVM, entre eles ações, debêntures, notas comerciais, cotas de fundos e contratos de investimento coletivo. A lei exclui títulos públicos e títulos cambiais de responsabilidade de instituição financeira, exceto debêntures. Nos bancos, a Resolução CMN 4.966/2021, em vigor desde 1º/1/2025, classifica os ativos financeiros em custo amortizado, VJORA e VJR.',
    formula: 'na curva = principal × (1 + taxa)^t   ·   a valor justo = valor no vencimento ÷ (1 + taxa de mercado)^prazo restante',
  },
  exemplo: {
    titulo: `Banco compra R$ ${nf(EX_TVM.principal / 1_000_000, 0)} milhões em nota comercial prefixada a ${nf(EX_TVM.taxa * 100, 0)}% ao ano, por ${EX_TVM.anos} anos`,
    passos: [
      `No vencimento, a empresa paga ${nf(EX_TVM.principal, 0)} × ${nf(1 + EX_TVM.taxa, 2)}² = ${reais(venc)}.`,
      `Depois de 1 ano, na curva: ${nf(EX_TVM.principal, 0)} × ${nf(1 + EX_TVM.taxa, 2)} = ${reais(curva)}.`,
      `Se a taxa de mercado para esse risco subir para ${nf(EX_TVM.taxaMercado * 100, 0)}%, a valor justo: ${nf(venc, 0)} ÷ ${nf(1 + EX_TVM.taxaMercado, 2)} = ${reais(justo)}.`,
    ],
    resultado: `A diferença é de ${reais(curva - justo)}. No custo amortizado ela não aparece. Em VJORA, vai para o patrimônio. Em VJR, vai para o lucro do período.`,
  },
  noApp: { texto: 'Em Bancos, a inadimplência de alguns bancos aparece "incluindo TVM".', tab: 'bancos' },
  teste: {
    pergunta: 'A empresa toma R$ 5 milhões em CCB e emite R$ 5 milhões em nota comercial, que o banco compra. Onde cada uma aparece no balanço do banco?',
    resposta: 'A CCB fica em operações de crédito, e a nota comercial, em TVM. O risco é da mesma empresa, por isso os relatórios somam as duas na carteira ampliada.',
  },
}
