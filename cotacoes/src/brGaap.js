import { nf } from './format.js'

// Texto aprovado por Fernando em 27/11/2026. Exemplo didático com números redondos de uma empresa fictícia.
export const EX_BR_GAAP = { ebitdaAntesAluguel: 20, aluguel: 3, dividaBancaria: 34, arrendamento: 15 }
export const alavancagemAntiga = ({ ebitdaAntesAluguel, aluguel, dividaBancaria }) => dividaBancaria / (ebitdaAntesAluguel - aluguel)
export const alavancagemCpc06 = ({ ebitdaAntesAluguel, dividaBancaria, arrendamento }) => (dividaBancaria + arrendamento) / ebitdaAntesAluguel

const e = EX_BR_GAAP
const ebitdaAntigo = e.ebitdaAntesAluguel - e.aluguel
const alta = e.ebitdaAntesAluguel / ebitdaAntigo - 1

export const CONCEITO_BR_GAAP = {
  id: 'br-gaap',
  nome: 'BR GAAP (práticas contábeis adotadas no Brasil)',
  aliases: ['BRGAAP', 'BR Gap', 'GAAP', 'práticas contábeis', 'CPC', 'IFRS', 'Cosif', 'lucro gerencial', 'lucro recorrente'],
  topico: 'Funding e risco',
  revisadoEm: '2026-11-27',
  fontes: [
    { nome: 'Planalto — Lei 6.404/1976 (Lei das S.A.), texto consolidado', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm' },
    { nome: 'CVM — CPC 06 (R2), Arrendamentos', url: 'https://conteudo.cvm.gov.br/cvm_institucional/export/sites/cvm/menu/regulados/normascontabeis/cpc/CPC_06_R2_rev_18.pdf' },
    { nome: 'Banco Central — Resolução CMN 4.818/2020 (demonstrações financeiras)', url: 'https://normativos.bcb.gov.br/Lists/Normativos/Attachments/51051/Res_4818_v2_L.pdf' },
  ],
  frase: 'São as regras contábeis brasileiras. Para as empresas, valem a Lei das S.A. e os pronunciamentos do CPC. Para os bancos, valem as normas do Banco Central.',
  crianca: [
    'GAAP é a sigla em inglês de "princípios contábeis geralmente aceitos", e BR GAAP é a versão brasileira. Desde 2008, o CPC adaptou as normas internacionais (IFRS). Por isso, o balanço de uma empresa comum em BR GAAP fica muito parecido com um balanço em IFRS. Empresas menores podem usar o CPC PME, que é mais simples.',
    'Os bancos seguem regras próprias do Banco Central: o plano de contas Cosif e as normas do CMN. Por isso um banco grande pode mostrar três lucros diferentes: o contábil em BR GAAP, o consolidado em IFRS e o recorrente gerencial.',
  ],
  analogia: 'É a mesma partida jogada com regulamentos diferentes. Conforme a regra, o placar muda sem que a partida mude.',
  lacunas: [
    '"BRGAAP" num relatório de banco quer dizer regras do Banco Central, e não o CPC puro.',
    'O lucro recorrente gerencial segue critérios do próprio banco. Para comparar bancos, use a mesma base nos dois e veja a conciliação.',
    'Mudança de norma quebra a série histórica. Nas empresas, isso aconteceu em 2019, com a regra de arrendamentos. Nos bancos, em 2025, com a regra de perda esperada.',
    'Na análise de um cliente PJ, confira no parecer do auditor qual regra foi usada e se há ressalva. Um balancete sem auditoria não tem o mesmo peso.',
  ],
  preciso: {
    texto: 'A Lei 6.404/1976, alterada pelas Leis 11.638/2007 e 11.941/2009, levou a contabilidade brasileira aos padrões internacionais. O CPC emite os pronunciamentos, que a CVM aprova para as companhias abertas e o CFC aprova para as demais empresas. As instituições financeiras seguem as normas do CMN e do Banco Central. A Resolução CMN 4.818/2020 exige também um balanço consolidado anual em IFRS dos bancos de capital aberto e dos líderes de conglomerado S1 a S3.',
    formula: 'empresa = Lei 6.404 + CPC (≈ IFRS)   ·   banco = normas do Banco Central (BR GAAP) + consolidado em IFRS + visão gerencial',
    tipo: 'conceitual',
  },
  exemplo: {
    titulo: 'A mesma empresa antes e depois do CPC 06 (R2), a regra de arrendamentos que vale desde 2019',
    passos: [
      `Números da empresa: EBITDA antes dos aluguéis de R$ ${e.ebitdaAntesAluguel} milhões, aluguel das lojas de R$ ${e.aluguel} milhões por ano, dívida bancária de R$ ${e.dividaBancaria} milhões e contratos de aluguel com valor presente de R$ ${e.arrendamento} milhões.`,
      `Pela regra antiga, o aluguel é despesa. O EBITDA fica em R$ ${ebitdaAntigo} milhões, e a dívida/EBITDA em ${e.dividaBancaria} ÷ ${ebitdaAntigo} = ${nf(alavancagemAntiga(e), 1)}x.`,
      `Pelo CPC 06 (R2), o aluguel vira depreciação e juros, e o contrato vira dívida. O EBITDA fica em R$ ${e.ebitdaAntesAluguel} milhões, e a dívida/EBITDA em (${e.dividaBancaria} + ${e.arrendamento}) ÷ ${e.ebitdaAntesAluguel} = ${nf(alavancagemCpc06(e), 2)}x.`,
    ],
    resultado: `A empresa é a mesma, mas o EBITDA sobe ${nf(alta * 100, 0)}% e a alavancagem também sobe. Antes de comparar com um covenant, veja em qual regra ele foi escrito.`,
  },
  noApp: { texto: 'Em Bancos, a nota de cada indicador diz se o número é contábil ou gerencial.', tab: 'bancos' },
  teste: {
    pergunta: 'Um banco divulga lucro contábil de R$ 9 bilhões e lucro recorrente de R$ 10 bilhões. Qual usar para comparar com outro banco?',
    resposta: 'A mesma base nos dois. O lucro contábil segue a mesma regra para todos os bancos; o gerencial segue critérios de cada um. Veja a conciliação entre os dois.',
  },
}
