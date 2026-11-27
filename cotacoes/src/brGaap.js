import { nf } from './format.js'
import { alavancagem } from './tvm.js'

// Conceito do Aprender pedido por Fernando em 27/11/2026 (ele escreveu "BR Gap"; o termo é BR GAAP).
// Didático: não altera calculadoras nem dados de bancos. Números do exemplo saem das contas abaixo.

const EX = { ebitdaAntesAluguel: 11.2, aluguel: 1.2, divida: 20, arrendamento: 5 }
const mi = (v) => `R$ ${nf(v, 1)} mi`
const vezes = (v) => `${nf(v, 2)}x`

// Mesmo negócio em duas regras: CPC PME (aluguel como despesa) e CPC completo (CPC 06 R2, arrendamento como dívida).
export function mesmoAluguelDuasRegras({ ebitdaAntesAluguel, aluguel, divida, arrendamento }) {
  const pme = { ebitda: ebitdaAntesAluguel - aluguel, divida }
  const completo = { ebitda: ebitdaAntesAluguel, divida: divida + arrendamento }
  return { pme: { ...pme, alavancagem: alavancagem(pme.divida, pme.ebitda) }, completo: { ...completo, alavancagem: alavancagem(completo.divida, completo.ebitda) } }
}

export const CONCEITO_BR_GAAP = {
  id: 'br-gaap',
  topico: 'Contabilidade e balanços',
  nome: 'BR GAAP (práticas contábeis adotadas no Brasil)',
  aliases: ['br gaap', 'brgaap', 'br gap', 'brgap', 'gaap', 'práticas contábeis adotadas no Brasil', 'IFRS', 'CPC', 'CPC PME', 'Cosif', 'Lei 6.404', 'IFRS 16', 'CPC 06'],
  revisadoEm: '2026-11-27',
  frase: 'BR GAAP é o conjunto de regras contábeis usado no Brasil, com a Lei das S.A., os pronunciamentos do CPC e as normas dos reguladores. Diz como o balanço e o resultado foram montados.',
  crianca: [
    'GAAP vem do inglês Generally Accepted Accounting Principles, ou princípios contábeis geralmente aceitos. BR GAAP é a versão brasileira: a Lei 6.404/1976, os pronunciamentos do CPC aprovados pelo CFC e pela CVM e as regras de reguladores como o Banco Central.',
    'Desde 2010, o BR GAAP das empresas está praticamente alinhado ao padrão internacional (IFRS). Mas há níveis: companhias abertas e empresas de grande porte seguem o CPC completo; pequenas e médias podem usar o CPC PME, mais simples; microempresas e empresas de pequeno porte têm norma ainda mais enxuta do CFC.',
    'Nos bancos, BR GAAP quer dizer as regras do Banco Central (o plano de contas Cosif), que ainda têm diferenças em relação ao IFRS. Por isso um mesmo banco pode divulgar um lucro em BR GAAP, outro em IFRS e um terceiro, recorrente gerencial.',
    'Na análise de crédito, o primeiro passo é ler na nota explicativa de base de preparação qual regra foi usada. Só compare indicadores de empresas, ou de anos, montados pela mesma régua.',
  ],
  analogia: 'É a régua usada para medir a empresa: a mesma mesa medida com réguas diferentes dá números diferentes, sem que a mesa tenha mudado.',
  lacunas: [
    'Escreve-se GAAP, de accounting principles, e não “gap”. Em finanças, gap costuma ser descasamento de prazos ou de caixa, outro assunto.',
    'Contabilidade societária não é escrita fiscal. Lucro presumido, Lalur e ajustes do imposto de renda seguem regras tributárias; um balanço feito só para o fisco pode não seguir o CPC.',
    'Arrendamentos: no CPC completo (CPC 06 R2, equivalente ao IFRS 16), aluguéis de longo prazo entram como dívida e saem do custo, o que eleva o EBITDA. No CPC PME, o aluguel comum segue como despesa. Compare só empresas na mesma regra, ou ajuste antes.',
    'Muitos contratos definem dívida e EBITDA excluindo os efeitos do IFRS 16, ou pela regra vigente na data da assinatura. Vale a definição escrita no contrato.',
    'Balanço auditado e balanço sem auditoria podem seguir a mesma norma, mas o grau de conferência é diferente. Veja se há relatório do auditor e se ele traz ressalva.',
    'Nos bancos, resultado recorrente gerencial não é BR GAAP nem IFRS: é um critério do próprio banco, com ajustes que ele explica na reconciliação.',
  ],
  preciso: {
    texto: 'As práticas contábeis adotadas no Brasil são formadas pela Lei 6.404/1976 (com as mudanças das Leis 11.638/2007 e 11.941/2009) e pelos pronunciamentos, interpretações e orientações do CPC, tornados obrigatórios pelo CFC (como NBC TG) e, para companhias abertas, pela CVM. Instituições financeiras seguem as normas do CMN e do Banco Central (Cosif), que incorporam parte dos CPCs; seguradoras seguem a Susep. Nas companhias abertas, as demonstrações consolidadas em BR GAAP e em IFRS tendem a coincidir.',
    formula: 'BR GAAP = Lei 6.404/1976 + CPC (via CFC e CVM) + normas do regulador do setor (Banco Central, Susep e outros).',
    tipo: 'conceitual',
  },
  exemplo: (() => {
    const r = mesmoAluguelDuasRegras(EX)
    return {
      titulo: 'Mesmo aluguel, duas regras · valores hipotéticos',
      passos: [
        `Duas empresas iguais pagam ${mi(EX.aluguel)} por ano de aluguel de longo prazo. Antes do aluguel, geram ${mi(EX.ebitdaAntesAluguel)} de EBITDA. Dívida financeira: ${mi(EX.divida)}. Valor presente dos aluguéis futuros: ${mi(EX.arrendamento)}.`,
        `Empresa A, no CPC PME: o aluguel é despesa. EBITDA de ${mi(r.pme.ebitda)}, dívida de ${mi(r.pme.divida)} e alavancagem de ${vezes(r.pme.alavancagem)}.`,
        `Empresa B, no CPC completo (CPC 06 R2): o aluguel vira depreciação e juros, fora do EBITDA, e o passivo de arrendamento entra como dívida. EBITDA de ${mi(r.completo.ebitda)}, dívida de ${mi(r.completo.divida)} e alavancagem de ${vezes(r.completo.alavancagem)}.`,
        'Hipóteses: mesmo negócio e mesmo caixa; só muda a regra contábil.',
      ],
      resultado: `O caixa das duas é o mesmo, mas o EBITDA difere em ${mi(r.completo.ebitda - r.pme.ebitda)} e a alavancagem, em ${vezes(r.completo.alavancagem - r.pme.alavancagem)}. Antes de comparar, ponha as duas na mesma régua.`,
    }
  })(),
  teste: {
    pergunta: 'Duas empresas do mesmo setor mostram EBITDA bem diferente: a regra contábil de cada balanço está entre as primeiras coisas a conferir?',
    resposta: 'Sim. Veja na nota de base de preparação se as duas usam o CPC completo ou o CPC PME e como tratam aluguéis de longo prazo. Só depois compare margem e alavancagem.',
  },
  noApp: { tab: 'aprender', view: 'tvm', texto: 'Veja em TVM como a nota explicativa das aplicações financeiras muda a dívida líquida.' },
  fontes: [
    { nome: 'Planalto · Lei 6.404/1976 (Lei das S.A.), texto consolidado', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6404consol.htm' },
    { nome: 'CPC PME (R1) · Contabilidade para Pequenas e Médias Empresas', url: 'https://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos/Pronunciamento?Id=79' },
  ],
}
