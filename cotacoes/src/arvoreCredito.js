// Árvore de Crédito: a partir da necessidade do cliente e do perfil da empresa, escolhe até três
// possibilidades de crédito na ordem combinada com Fernando (entrevista de 18/11/2026) e explica por que
// cada uma entrou ou saiu. Não há conta financeira aqui: nenhuma taxa, CET, IOF calculado ou projeção.
// Só regras de enquadramento, textos com fonte e os sinais da tabela de faturamento (somas e médias).
// Regras e fontes: docs/arvore-decisao-credito.md e docs/arvore-credito-regras-produtos.md.

import { parseFaturamento } from './faturamento.js'

export const CONSULTA = '18/11/2026' // data em que as regras abaixo foram conferidas
export const MAX_FOLHA = 3 // decisão de Fernando: no máximo três possibilidades na frente

// Marca de confiança de cada regra.
export const MARCAS = {
  of: 'Conferido em fonte oficial',
  fernando: 'Prática relatada por Fernando',
  busca: 'Fonte secundária, a confirmar',
  nc: 'Não conferido',
}

const fonte = (nome, url, marca = 'of') => ({ nome, url, marca })
const F = {
  res278: fonte('Resolução BCB 278/2022', 'https://www.bcb.gov.br/api/conteudo/app/normativos/exibenormativo?p1=Resolu%C3%A7%C3%A3o%20BCB&p2=278'),
  res277: fonte('Resolução BCB 277/2022', 'https://www.bcb.gov.br/api/conteudo/app/normativos/exibenormativo?p1=Resolu%C3%A7%C3%A3o%20BCB&p2=277'),
  iof: fonte('Decreto 6.306/2007 (IOF)', 'https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html'),
  rir: fonte('RIR/2018 (Decreto 9.580)', 'https://www2.camara.leg.br/legin/fed/decret/2018/decreto-9580-22-novembro-2018-787360-normaatualizada-pe.html'),
  lei9430: fonte('Lei 9.430/1996', 'https://www2.camara.leg.br/legin/fed/lei/1996/lei-9430-27-dezembro-1996-367738-normaatualizada-pl.html'),
  finameMat: fonte('BNDES Finame Materiais Industrializados', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados'),
  finameBk: fonte('BNDES Finame BK Aquisição', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-finame-bk-aquisicao-comercializacao'),
  giroBndes: fonte('BNDES Crédito Pequenas e Médias Empresas', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-credito-pequenas-e-medias-empresas'),
  automatico: fonte('BNDES Automático', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-automatico'),
  exim: fonte('BNDES Exim Pré-embarque', 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-exim-pre-embarque'),
  cpr: fonte('Lei 8.929/1994 (CPR)', 'https://www2.camara.leg.br/legin/fed/lei/1994/lei-8929-22-agosto-1994-349613-normaatualizada-pl.html'),
  lei6313: fonte('Lei 6.313/1975 (nota de crédito à exportação)', 'https://www2.camara.leg.br/legin/fed/lei/1970-1979/lei-6313-16-dezembro-1975-366420-normaatualizada-pl.html'),
  lei14195: fonte('Lei 14.195/2021 (nota comercial)', 'https://www2.camara.leg.br/legin/fed/lei/2021/lei-14195-26-agosto-2021-791684-normaatualizada-pl.html'),
  lei6404: fonte('Lei 6.404/1976 (debêntures)', 'https://www2.camara.leg.br/legin/fed/lei/1970-1979/lei-6404-15-dezembro-1976-368447-normaatualizada-pl.html'),
  facil: fonte('Resolução CVM 232/2025 (regime FÁCIL)', 'https://conteudo.cvm.gov.br/legislacao/resolucoes/anexos/200/resol232.htm', 'busca'),
  res4815: fonte('Resolução 4.815 (recebíveis e duplicatas)', 'https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o&numero=4815'),
  res2325: fonte('Resolução CMN 2.325/1996 (garantias)', 'https://www.bcb.gov.br/api/conteudo/app/normativos/exibenormativo?p1=Resolu%C3%A7%C3%A3o&p2=2325'),
  cnaeCpr: fonte('Lista de CNAEs emitentes de CPR (leitura da lei, a conferir)', 'https://concla.ibge.gov.br/busca-online-cnae.html', 'nc'),
  lei14133: fonte('Lei 14.133/2021 (garantia em contrato público)', 'https://www2.camara.leg.br/legin/fed/lei/2021/lei-14133-1-abril-2021-791222-normaatualizada-pl.html'),
}

// Regiões com taxa do BNDES menor em algumas linhas (Finame, giro PME).
export const UF_NORTE_NORDESTE = ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA']
const FUNDO_REGIONAL = { AC: 'FNO', AM: 'FNO', AP: 'FNO', PA: 'FNO', RO: 'FNO', RR: 'FNO', TO: 'FNO', MA: 'FNE', PI: 'FNE', CE: 'FNE', RN: 'FNE', PB: 'FNE', PE: 'FNE', AL: 'FNE', SE: 'FNE', BA: 'FNE', MT: 'FCO', MS: 'FCO', GO: 'FCO', DF: 'FCO' }

// CNAEs típicos de quem pode emitir CPR (Lei 8.929, art. 2º). A lei fala em atividade, não em código:
// a lista é leitura da pesquisa de 18/11/2026, a conferir na tabela do IBGE. Comparação pelo início do código.
export const CNAE_CPR = ['01', '02', '03', '10', '11', '12', '131', '161', '171', '193', '2013', '2051', '283', '4623', '4661', '4683']

export const soDigitos = (s) => String(s ?? '').replace(/\D/g, '')

// Porte pela receita anual (tabela do BNDES; o site tem duas versões, esta é a da página "Porte de empresa").
export function porteBndes(receitaAnual) {
  if (!(receitaAnual > 0)) return null
  if (receitaAnual <= 360_000) return 'micro'
  if (receitaAnual <= 4_800_000) return 'pequena'
  if (receitaAnual <= 300_000_000) return 'media'
  return 'grande'
}
export const PORTE_ROTULO = { micro: 'Micro', pequena: 'Pequena', media: 'Média', grande: 'Grande' }

export const cnaeCpr = (cnae) => {
  const c = soDigitos(cnae)
  return c.length >= 2 && CNAE_CPR.some((p) => c.startsWith(p))
}

// Cada operação: o que é, o que cobre, o que fica de fora, impostos e cuidados, mais a regra de enquadramento.
// `requisito(ctx)` devolve null quando a empresa se enquadra, ou o motivo de ter saído da folha.
// `avisos(ctx)` devolve as observações que dependem do perfil (regime tributário, prazo, região).
export const OPERACOES = {
  4131: {
    nome: 'Empréstimo externo (4131) com NDF',
    resumo: 'Dinheiro captado no exterior, em dólar ou euro, com proteção cambial (NDF) para a dívida ficar em reais.',
    cobre: 'Uso livre: pode cobrir o bem, os impostos e as despesas numa operação só.',
    foraDeCobertura: 'Nada pela norma; o contrato pode restringir.',
    impostos: 'Sem IOF de crédito. IOF de câmbio de 3,5% na entrada se o prazo médio for de até 364 dias; zero acima disso. IR de 15% sobre os juros pagos ao exterior.',
    parcelaAjustavel: true,
    moedaEstrangeira: true,
    calculadora: 'emprestimo-4131',
    marca: 'of',
    fontes: [F.res278, F.iof, F.rir],
    avisos(ctx) {
      const a = []
      if (ctx.regime === 'presumido' || ctx.regime === 'simples') a.push(`No ${ctx.regime === 'simples' ? 'Simples Nacional' : 'Lucro Presumido'}, o ganho no NDF é tributado e a perda cambial da dívida não abate imposto: o custo final fica acima do cotado. Compare com uma linha em reais. Regra conferida nos textos de lei; falta validação de tributarista.`)
      if (ctx.prazoMeses && ctx.prazoMeses <= 12) a.push('Prazo de até 12 meses: o prazo médio fica em até 364 dias, e a entrada paga 3,5% de IOF de câmbio.')
      else if (ctx.prazoMeses) a.push('Confira o prazo médio na calculadora 4131: até 364 dias, a entrada paga 3,5% de IOF de câmbio.')
      if (ctx.exporta && ctx.importa) a.push('A empresa exporta: a receita em moeda estrangeira pode pagar parte da dívida e reduzir a proteção necessária (proposta a confirmar).')
      return a
    },
  },
  finimp: {
    nome: 'FINIMP com proteção cambial',
    resumo: 'Financiamento da importação: o banco paga o fornecedor no exterior e a empresa paga depois, com NDF para travar o câmbio.',
    cobre: 'O valor pago ao fornecedor estrangeiro (bem ou serviço importado).',
    foraDeCobertura: 'Impostos de importação e despesas locais costumam ficar de fora; depende do produto de cada instituição. A norma não proíbe financiá-los.',
    impostos: 'Sem IOF de crédito. Se financiar despesa local com recurso que entra no País e prazo médio de até 364 dias, essa parcela paga 3,5% de IOF de câmbio.',
    parcelaAjustavel: false,
    moedaEstrangeira: true,
    calculadora: 'finimp',
    marca: 'of',
    fontes: [F.res278, F.iof],
    requisito: (ctx) => (ctx.importa ? null : 'Só para quem está importando.'),
    avisos(ctx) {
      const a = ['Parcela fixa: não acompanha meses fortes e fracos.']
      if (ctx.regime === 'presumido' || ctx.regime === 'simples') a.push('Com NDF, o ganho na proteção é tributado neste regime e a perda cambial não abate imposto.')
      if (ctx.prazoMeses > 6) a.push('Prazo acima de 180 dias: se o valor for de US$ 500 mil ou mais, a operação é declarada ao Banco Central (SCE-Crédito).')
      return a
    },
  },
  cpr: {
    nome: 'CPR (cédula de produto rural) financeira',
    resumo: 'Título emitido por quem produz, beneficia ou industrializa produto rural, ou vende insumos e máquinas agrícolas.',
    cobre: 'Uso ligado à atividade rural ou à cadeia do agro.',
    foraDeCobertura: 'Empresa fora da cadeia rural.',
    impostos: 'Quem não é produtor rural (indústria, insumos, máquinas, armazenagem) paga IOF e não tem as isenções.',
    parcelaAjustavel: true,
    calculadora: null,
    marca: 'of',
    fontes: [F.cpr, F.cnaeCpr],
    requisito(ctx) {
      if (!cnaeCpr(ctx.cnae)) return 'Atividade (CNAE) fora da lista de emitentes de CPR.'
      if (!ctx.notasCpr) return 'Faltam as notas fiscais validadas para a CPR.'
      if (ctx.porte === 'micro') return 'Microempresa: confirme se a instituição opera CPR com esse porte (a lei não restringe).'
      return null
    },
    avisos: () => ['A lista de CNAEs que habilitam a CPR é leitura da lei, a conferir; confirme a atividade real e o objeto social.'],
  },
  'finame-materiais': {
    nome: 'BNDES Finame Materiais',
    resumo: 'Reembolso, com recurso do BNDES, de compras de materiais industrializados nacionais já feitas.',
    cobre: 'Notas de compra emitidas nos 12 meses anteriores ao pedido no BNDES, de itens da lista do BNDES.',
    foraDeCobertura: 'Alimentos, bebidas, combustíveis, lubrificantes, itens importados e máquinas que podem ser credenciadas no Finame.',
    impostos: 'Sem IOF: operação com recursos do Finame.',
    parcelaAjustavel: false,
    calculadora: 'finame-materiais',
    marca: 'of',
    fontes: [F.finameMat, F.iof],
    requisito(ctx) {
      if (!ctx.notasFiname) return 'Faltam notas de compra elegíveis nos últimos 12 meses.'
      if (ctx.valor > 20_000_000) return 'Acima de R$ 20 milhões por operação.'
      return null
    },
    avisos(ctx) {
      const a = ['Até 7 anos, com até 2 de carência. Parcela fixa.']
      if (ctx.cnae && /^0[1-3]/.test(soDigitos(ctx.cnae))) a.push('Atividade principal agro: o recurso só pode ser usado em agro.')
      if (UF_NORTE_NORDESTE.includes(ctx.uf)) a.push('Norte e Nordeste: taxa do BNDES menor nesta linha.')
      return a
    },
  },
  finame: {
    nome: 'BNDES Finame (máquina nacional)',
    resumo: 'Financiamento de máquina ou equipamento nacional credenciado no BNDES, com recurso do BNDES.',
    cobre: 'Máquina, equipamento, caminhão ou ônibus novos, nacionais e credenciados; giro associado de até 30% para MPME.',
    foraDeCobertura: 'Bem importado ou usado.',
    impostos: 'Sem IOF: operação com recursos do Finame.',
    parcelaAjustavel: false,
    calculadora: 'finame-materiais',
    marca: 'of',
    fontes: [F.finameBk, F.iof],
    requisito: (ctx) => (ctx.maquinaCredenciada ? null : 'Máquina não credenciada no Finame.'),
    avisos(ctx) {
      const a = ['Até 10 anos, com até 2 de carência. Parcela fixa.', 'Máquina 4.0 ou eficiente em energia: veja Finame Máquinas 4.0, Finame Baixo Carbono ou Fundo Clima, com taxa do BNDES menor.']
      if (UF_NORTE_NORDESTE.includes(ctx.uf)) a.push('Norte e Nordeste: taxa do BNDES menor nesta linha.')
      return a
    },
  },
  'bndes-automatico': {
    nome: 'BNDES Automático (projeto)',
    resumo: 'Financiamento de obra, ampliação ou modernização, com recurso do BNDES via banco.',
    cobre: 'Obras, instalações, máquinas nacionais credenciadas e giro associado de até 30%, até R$ 150 milhões.',
    foraDeCobertura: 'Terreno, custeio, importados e item isolado sem projeto.',
    impostos: 'IOF conforme o enquadramento da operação; confira caso a caso.',
    parcelaAjustavel: false,
    calculadora: 'finame-materiais',
    marca: 'of',
    fontes: [F.automatico],
    requisito: (ctx) => (ctx.valor > 150_000_000 ? 'Acima de R$ 150 milhões.' : null),
    avisos: () => ['Até 20 anos, com até 3 de carência. Aceita reembolso de gastos dos 12 meses anteriores.'],
  },
  giro: {
    nome: 'Capital de giro',
    resumo: 'Empréstimo em reais, de uso livre, prefixado ou pós-fixado.',
    cobre: 'Qualquer finalidade.',
    foraDeCobertura: '—',
    impostos: 'IOF de crédito: 0,0082% ao dia, até 365 dias, mais 0,38%. Simples Nacional em operação de até R$ 30 mil: 0,00274% ao dia.',
    parcelaAjustavel: true,
    calculadora: 'giro',
    marca: 'of',
    fontes: [F.iof],
    // Gap de caixa (Fernando, 18/11/2026): giro só para prazo acima de 12 meses; o que é pontual vai para Conta Garantida ou desconto.
    requisito: (ctx) => (ctx.necessidade === 'gap-caixa' && ctx.prazoMeses > 0 && ctx.prazoMeses <= 12 ? 'Prazo de até 12 meses: necessidade pontual, para Conta Garantida ou desconto.' : null),
    avisos(ctx) {
      const a = []
      if (ctx.regime === 'real') a.push('No Lucro Real, juros, IOF e tarifas reduzem o imposto da empresa.')
      return a
    },
  },
  'giro-bndes': {
    nome: 'Giro BNDES (Crédito Pequenas e Médias Empresas)',
    resumo: 'Capital de giro com recurso do BNDES, via banco, sem precisar de projeto.',
    cobre: 'Necessidades do dia a dia da empresa, até R$ 20 milhões por ano.',
    foraDeCobertura: 'Importados e setores vedados pelo BNDES.',
    impostos: 'IOF de crédito, como no capital de giro.',
    parcelaAjustavel: false,
    calculadora: 'finame-materiais',
    marca: 'of',
    fontes: [F.giroBndes],
    requisito(ctx) {
      if (ctx.receitaAnual > 300_000_000) return 'Faturamento anual acima de R$ 300 milhões.'
      if (ctx.valor > 20_000_000) return 'Acima de R$ 20 milhões por ano.'
      return null
    },
    avisos(ctx) {
      const a = ['Até 5 anos, com até 2 de carência.']
      if (ctx.necessidade === 'dividendos') a.push('Finalidade declarada pelo BNDES: capital de giro, manutenção ou geração de empregos. Não exige comprovar o uso, mas o banco repassador pode pedir informações sobre a utilização.')
      if (UF_NORTE_NORDESTE.includes(ctx.uf)) a.push('Norte e Nordeste: taxa do BNDES menor nesta linha.')
      return a
    },
  },
  'conta-garantida': {
    nome: 'Conta Garantida',
    resumo: 'Limite rotativo para descasamento de caixa de dias ou semanas.',
    cobre: 'Falta de caixa pontual, com entrada prevista.',
    foraDeCobertura: 'Necessidade permanente: fica cara quando o saldo fica parado.',
    impostos: 'IOF de crédito sobre os saldos diários, mais 0,38% sobre os acréscimos de saldo.',
    parcelaAjustavel: false,
    calculadora: 'conta-garantida',
    marca: 'of',
    fontes: [F.iof],
    requisito: (ctx) => (ctx.prazoMeses > 12 ? 'Prazo acima de 12 meses: a necessidade não é pontual.' : null),
    avisos: () => ['A renovação do limite não é garantida.'],
  },
  desconto: {
    nome: 'Desconto de duplicatas',
    resumo: 'O banco antecipa o valor de vendas a prazo já faturadas.',
    cobre: 'A parte pontual da necessidade, até o valor dos títulos.',
    foraDeCobertura: 'Venda ainda não faturada.',
    impostos: 'IOF de crédito sobre o valor líquido: 0,0082% ao dia mais 0,38%.',
    parcelaAjustavel: false,
    calculadora: 'analise-desconto',
    marca: 'of',
    fontes: [F.res4815, F.iof],
    requisito(ctx) {
      if (!ctx.garantias.includes('duplicatas')) return 'A empresa não informou duplicatas ou recebíveis.'
      if (ctx.prazoMeses > 12) return 'Prazo acima de 12 meses: a necessidade não é pontual.'
      return null
    },
    avisos: () => ['A duplicata escritural começou em 15/07/2026 e passa a ser obrigatória por porte a partir de 2027.'],
  },
  'acc-ace': {
    nome: 'ACC ou ACE',
    resumo: 'O banco antecipa em reais a receita de uma exportação: ACC antes do embarque, ACE depois.',
    cobre: 'Produção e venda para exportar; quem paga é a própria exportação.',
    foraDeCobertura: 'Empresa que não exporta.',
    impostos: 'Sem IOF de crédito.',
    parcelaAjustavel: false,
    moedaEstrangeira: true,
    calculadora: null,
    marca: 'of',
    fontes: [F.res277, F.iof],
    requisito: (ctx) => (ctx.exporta ? null : 'Só para quem exporta.'),
    avisos: () => ['Prazo de até 1.500 dias pela norma.', 'Se a exportação não acontecer, a devolução é em reais, com juros, efeito do câmbio e possível encargo do Banco Central.'],
  },
  'exim-pre': {
    nome: 'BNDES Exim Pré-embarque',
    resumo: 'Recurso do BNDES para produzir bens que serão exportados.',
    cobre: 'Bens da lista do BNDES, inclusive máquinas: até 100% do valor exportado para MPME, 80% para grande.',
    foraDeCobertura: 'Bem sem índice de nacionalização.',
    impostos: 'Crédito à exportação: sem IOF.',
    parcelaAjustavel: false,
    calculadora: null,
    marca: 'of',
    fontes: [F.exim, F.iof],
    requisito: (ctx) => (ctx.exporta ? null : 'Só para quem exporta.'),
    avisos: () => ['Prazo total de 4 a 5 anos. Exige compromisso de exportação.'],
  },
  nce: {
    nome: 'Nota de crédito à exportação',
    resumo: 'Crédito ligado à exportação, sem embarque específico.',
    cobre: 'Produção para exportar e atividades de apoio à exportação, conforme orçamento vinculado ao título.',
    foraDeCobertura: 'Empresa fora da cadeia exportadora.',
    impostos: 'Isenta de IOF.',
    parcelaAjustavel: false,
    calculadora: null,
    marca: 'of',
    fontes: [F.lei6313, F.iof],
    requisito: (ctx) => (ctx.exporta ? null : 'Só para quem exporta ou participa da cadeia exportadora.'),
    avisos: () => ['A empresa comprova o uso no prazo e na forma que o banco exigir; descumprir vence a dívida e pode derrubar a isenção de IOF.'],
  },
  'nota-comercial': {
    nome: 'Nota comercial',
    resumo: 'Título de dívida vendido a investidores, para valores maiores.',
    cobre: 'Uso livre.',
    foraDeCobertura: '—',
    impostos: 'Sem IOF para a emissora; o IOF regressivo recai sobre o investidor que sai antes de 30 dias.',
    parcelaAjustavel: true,
    calculadora: null,
    marca: 'of',
    fontes: [F.lei14195, F.iof],
    requisito: (ctx) => (ctx.tipo === 'outra' ? 'Só S.A., Ltda. ou cooperativa.' : null),
    avisos: () => ['Exige escriturador e estruturação; custo de emissão a cotar caso a caso.'],
  },
  debenture: {
    nome: 'Debênture',
    resumo: 'Título de dívida de sociedade anônima, para valores altos.',
    cobre: 'Uso livre.',
    foraDeCobertura: '—',
    impostos: 'Sem IOF de crédito.',
    parcelaAjustavel: false,
    calculadora: null,
    marca: 'of',
    fontes: [F.lei6404, F.facil],
    requisito: (ctx) => (ctx.tipo === 'sa' ? null : 'Só para S.A.'),
    avisos(ctx) {
      const a = ['Exige balanço auditado, agente fiduciário e estruturação.']
      if (ctx.receitaAnual > 0 && ctx.receitaAnual < 500_000_000) a.push('Receita abaixo de R$ 500 milhões: pode usar o regime FÁCIL da CVM (fonte secundária, a confirmar).')
      return a
    },
  },
  'carta-credito': {
    nome: 'Carta de crédito de importação',
    resumo: 'Garantia do banco ao fornecedor estrangeiro de que ele será pago.',
    cobre: 'A segurança de pagamento exigida pelo fornecedor. Não é dinheiro.',
    foraDeCobertura: 'Prazo financeiro: se também faltar prazo, combine com FINIMP.',
    impostos: '—',
    parcelaAjustavel: false,
    calculadora: null,
    marca: 'of',
    fontes: [F.res2325],
    requisito: (ctx) => (ctx.importa ? null : 'Só para quem está importando.'),
    avisos: () => ['Consome limite de crédito no banco.'],
  },
  fianca: {
    nome: 'Fiança bancária',
    resumo: 'Garantia do banco a uma obrigação da empresa perante terceiro.',
    cobre: 'A garantia exigida no contrato. Não é dinheiro.',
    foraDeCobertura: 'Falta de caixa para executar o contrato.',
    impostos: '—',
    parcelaAjustavel: false,
    calculadora: null,
    marca: 'of',
    fontes: [F.res2325, F.lei14133],
    avisos: () => ['Em contrato público, a empresa escolhe entre caução, seguro garantia, fiança e título de capitalização.', 'Consome limite de crédito no banco; o seguro garantia não.'],
  },
}

// Folhas: ordem por necessidade. `confirmada` = ordem confirmada por Fernando em 18/11/2026; as demais são proposta.
export const NECESSIDADES = [
  { id: 'gap-caixa', nome: 'Gap de caixa (capital de giro)', confirmada: true, ordem: ['4131', 'finame-materiais', 'cpr', 'giro', 'conta-garantida', 'desconto', 'giro-bndes'] },
  { id: 'maquina-importada', nome: 'Máquina importada', confirmada: true, ordem: ['4131', 'finimp', 'cpr', 'finame-materiais', 'giro', 'carta-credito'], importa: true },
  { id: 'maquina-nacional', nome: 'Máquina nacional (investimento)', confirmada: true, ordem: ['finame', '4131', 'giro', 'bndes-automatico'] },
  { id: 'materia-prima-importada', nome: 'Importação de matéria-prima', confirmada: true, ordem: ['finimp', '4131', 'giro', 'carta-credito'], importa: true },
  { id: 'exportacao', nome: 'Exportação', confirmada: true, ordem: ['acc-ace', 'exim-pre', 'nce', '4131'], exporta: true },
  { id: 'dividendos', nome: 'Distribuição de dividendos', confirmada: true, ordem: ['4131', 'giro', 'giro-bndes', 'nota-comercial', 'debenture'] },
  { id: 'compra-empresa', nome: 'Compra de outra empresa', confirmada: true, ordem: ['4131', 'giro', 'nota-comercial', 'debenture'] },
  { id: 'estoque-nacional', nome: 'Estoque nacional por prazo longo', confirmada: true, ordem: ['finame-materiais', '4131', 'cpr', 'giro', 'giro-bndes'] },
  { id: 'alongar-divida', nome: 'Alongar dívida de curto prazo', confirmada: false, ordem: ['giro', '4131', 'giro-bndes', 'nota-comercial', 'finame-materiais'] },
  { id: 'obra-ampliacao', nome: 'Obra, ampliação ou planta nova', confirmada: false, ordem: ['bndes-automatico', '4131', 'giro', 'nota-comercial', 'debenture'] },
  { id: 'garantia-fornecedor', nome: 'Garantia exigida por fornecedor estrangeiro', confirmada: false, ordem: ['carta-credito', 'finimp'], importa: true },
  { id: 'garantia-contrato', nome: 'Garantia de execução de contrato', confirmada: false, ordem: ['fianca', 'giro'] },
]
export const necessidadePorId = (id) => NECESSIDADES.find((n) => n.id === id) ?? null

// Critérios de triagem do alongamento, não parâmetros de crédito ou aprovação.
export const CRITERIOS_ALONGAMENTO = [
  ['caixa', 'O caixa está sem aperto relevante?'],
  ['alavancagem', 'A alavancagem não é excessiva?'],
  ['repagamento', 'A capacidade de pagar a nova dívida foi demonstrada?'],
]

// Monta o contexto usado pelas regras a partir do que o especialista informou.
export function contexto(entrada = {}) {
  const nec = necessidadePorId(entrada.necessidade)
  const receitaAnual = entrada.receitaAnual > 0 ? entrada.receitaAnual : null
  return {
    necessidade: entrada.necessidade ?? null,
    valor: entrada.valor > 0 ? entrada.valor : 0,
    prazoMeses: entrada.prazoMeses > 0 ? entrada.prazoMeses : 0,
    regime: entrada.regime ?? '',
    tipo: entrada.tipo ?? '',
    uf: String(entrada.uf ?? '').toUpperCase(),
    cnae: soDigitos(entrada.cnae),
    receitaAnual,
    porte: porteBndes(receitaAnual),
    garantias: entrada.garantias ?? [],
    exporta: Boolean(entrada.exporta || nec?.exporta),
    importa: Boolean(entrada.importa || nec?.importa),
    notasFiname: Boolean(entrada.notasFiname),
    notasCpr: Boolean(entrada.notasCpr),
    ...(nec?.id === 'alongar-divida' && {
      alongamento: Object.fromEntries(CRITERIOS_ALONGAMENTO.map(([id]) => [id, entrada.alongamento?.[id] === true])),
      notasFiname: entrada.notasFiname === true,
    }),
    maquinaCredenciada: entrada.maquinaCredenciada !== false,
  }
}

// Folha da necessidade: as operações em ordem, separadas entre as que entram e as que saíram (com o motivo).
export function montarFolha(entrada) {
  const nec = necessidadePorId(entrada?.necessidade)
  if (!nec) return null
  const ctx = contexto(entrada)
  const entram = []
  const sairam = []
  const complementares = []
  for (const id of nec.ordem) {
    const op = OPERACOES[id]
    const alongamento = nec.id === 'alongar-divida'
    const finameIndireto = alongamento && id === 'finame-materiais'
    const externa = alongamento && id === '4131'
    const motivo = finameIndireto
      // O valor da dívida não é o valor dos gastos reembolsáveis. O agente financeiro valida o limite da despesa.
      ? (!ctx.notasFiname ? 'Faltam notas de compra elegíveis nos últimos 12 meses.' : null)
      : externa && !CRITERIOS_ALONGAMENTO.every(([criterio]) => ctx.alongamento[criterio] === true)
        ? 'Só entra com os três pontos confirmados: sem aperto relevante de caixa, sem alavancagem excessiva e com capacidade de pagamento demonstrada.'
        : op.requisito?.(ctx)
    const item = { id, ...op, avisosPerfil: op.avisos ? op.avisos(ctx) : [] }
    if (motivo) sairam.push({ ...item, motivo })
    else if (finameIndireto) complementares.push({
      ...item,
      resumo: 'Somente para despesas elegíveis comprovadas. O reembolso pode recompor caixa, mas não quita diretamente a dívida.',
      foraDeCobertura: `Quitação direta de dívida. ${item.foraDeCobertura}`,
      avisosPerfil: [...item.avisosPerfil, 'Confirme a elegibilidade, o limite da despesa e se as notas já foram usadas em outro financiamento, com o agente financeiro.'],
    })
    else {
      // No alongamento, Giro BNDES não é atalho para o Finame Materiais.
      if (alongamento && id === 'giro-bndes') item.calculadora = null
      if (externa) item.avisosPerfil.push('Compare com a linha em reais. Confirme a finalidade contratual, o custo da proteção cambial e a capacidade de pagar em cenário adverso.')
      entram.push(item)
    }
  }
  return {
    necessidade: nec,
    contexto: ctx,
    frente: entram.slice(0, MAX_FOLHA),
    outras: entram.slice(MAX_FOLHA),
    ...(nec.id === 'alongar-divida' && { complementares }),
    sairam,
    observacoes: observacoesPerfil(ctx),
  }
}

// Observações gerais do perfil, que não dependem de uma operação só.
export function observacoesPerfil(ctx) {
  const o = []
  const fundo = FUNDO_REGIONAL[ctx.uf]
  if (fundo) o.push(`${ctx.uf} está na área do ${fundo} (fundo constitucional regional, isento de IOF pelo Decreto 6.306/2007, art. 9º, III). Consulte as condições com o banco administrador.`)
  if (ctx.uf === 'MG' || ctx.uf === 'ES') o.push('Em MG e ES, alguns municípios estão na área do FNE (Sudene); a lista é por município.')
  if (ctx.regime === 'simples' && ctx.valor > 0 && ctx.valor <= 30_000) o.push('Simples Nacional com operação de até R$ 30 mil: IOF de crédito diário menor (0,00274%).')
  if (ctx.exporta && ctx.importa) o.push('A empresa exporta e importa: a receita em moeda estrangeira pode pagar a dívida da importação. Desde 01/10/2026, a exportadora pode ter conta em moeda estrangeira no Brasil (Res. BCB 575/2026).')
  return o
}

// ---- Tabela de faturamento e endividamento (o mesmo texto colado na calculadora Faturamento) ----

export const UNIDADES = { 'R$': 1, 'R$ mil': 1_000, 'R$ milhões': 1_000_000 }
export function fatorUnidade(unidadeLida, escolha) {
  if (escolha && UNIDADES[escolha]) return UNIDADES[escolha]
  const u = String(unidadeLida ?? '').toLowerCase()
  if (/mil(?!h)/.test(u)) return 1_000
  if (/milh|mi\b/.test(u)) return 1_000_000
  if (/bilh|bi\b/.test(u)) return 1_000_000_000
  return null
}

const MES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const LIMITE_FRACO = 0.8 // mês com faturamento abaixo de 80% da média dos últimos 12
export const LIMITE_FORTE = 1.2 // mês com faturamento acima de 120% da média dos últimos 12

// Lê a tabela colada e devolve os números que ajudam a julgar o pedido. Valores em reais.
// Só somas, médias e divisões dos números colados: nenhuma projeção.
export function analisarFaturamento(texto, { unidade, valorPedido = 0, dividaCurta = null } = {}) {
  const lido = parseFaturamento(texto)
  const fator = fatorUnidade(lido.unidade, unidade)
  const comFat = lido.meses.filter((m) => m.faturamento != null)
  if (!comFat.length) return { ...lido, fator, ok: false }
  if (!fator) return { ...lido, fator, ok: false, precisaUnidade: true }
  const ultimos = comFat.slice(-12)
  const total12 = ultimos.reduce((s, m) => s + m.faturamento, 0) * fator
  const media = total12 / ultimos.length
  const meses = ultimos.map((m) => ({ rotulo: m.rotulo, mes: m.mes, valor: m.faturamento * fator, indice: media > 0 ? (m.faturamento * fator) / media : null }))
  const fracos = meses.filter((m) => m.indice != null && m.indice < LIMITE_FRACO)
  const fortes = meses.filter((m) => m.indice != null && m.indice > LIMITE_FORTE)
  const comDivida = lido.meses.filter((m) => m.endividamento != null && m.endividamento > 0)
  const ultimaDivida = comDivida.at(-1) ?? null
  const divida = ultimaDivida ? ultimaDivida.endividamento * fator : null
  return {
    ...lido,
    fator,
    ok: true,
    mesesConsiderados: ultimos.length,
    periodo: `${ultimos[0].rotulo} a ${ultimos.at(-1).rotulo}`,
    total12,
    receitaAnualizada: ultimos.length >= 12 ? total12 : (total12 / ultimos.length) * 12,
    media,
    meses,
    fracos: fracos.map((m) => m.rotulo),
    fortes: fortes.map((m) => m.rotulo),
    sazonal: fracos.length > 0 && fortes.length > 0,
    divida,
    dividaRotulo: ultimaDivida?.rotulo ?? null,
    dividaEmMeses: divida != null && media > 0 ? divida / media : null,
    pedidoEmMeses: valorPedido > 0 && media > 0 ? valorPedido / media : null,
    dividaComPedidoEmMeses: valorPedido > 0 && media > 0 ? ((divida ?? 0) + valorPedido) / media : null,
    curtoPrazoPct: dividaCurta != null && divida > 0 ? dividaCurta / divida : null,
  }
}
export const nomeMes = (mes) => MES_NOME[mes - 1]

// ---- Consulta pública do CNPJ (BrasilAPI) ----

export function cnpjValido(cnpj) {
  const c = soDigitos(cnpj)
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false
  const dv = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = [...base].reduce((s, d, i) => s + Number(d) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  const d1 = dv(c.slice(0, 12))
  const d2 = dv(c.slice(0, 12) + d1)
  return c.endsWith(`${d1}${d2}`)
}
export const formatarCnpj = (cnpj) => soDigitos(cnpj).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5')
// Consulta automática desligada (decisão de Fernando, 18/11/2026): só volta depois de confirmada a política do banco
// sobre consulta em serviço externo. Com ela desligada, nenhum CNPJ sai da tela.
export const CONSULTA_CNPJ_ATIVA = false
// Enquanto a consulta automática estiver desligada, a tela abre o comprovante oficial da Receita em outra aba;
// o especialista digita o CNPJ lá e copia os dados. Nada sai da tela da Árvore de Crédito.
export const RECEITA_CNPJ = { nome: 'Receita Federal', url: 'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp' }
export const CNPJ_SERVICO = { nome: 'BrasilAPI', url: (cnpj) => `https://brasilapi.com.br/api/cnpj/v1/${soDigitos(cnpj)}` }

// Tipo societário pelo código de natureza jurídica da Receita (2046/2054 S.A.; 2062 e 2240 limitada; 2143 cooperativa).
export function tipoPorNatureza(codigo, descricao = '') {
  const c = soDigitos(codigo)
  if (c === '2046' || c === '2054') return 'sa'
  if (c === '2062' || c === '2240') return 'ltda'
  if (c === '2143') return 'cooperativa'
  const d = String(descricao).toLowerCase()
  if (/an[oô]nima/.test(d)) return 'sa'
  if (/limitada/.test(d)) return 'ltda'
  if (/cooperativa/.test(d)) return 'cooperativa'
  return c || d ? 'outra' : ''
}

// Regime pelo dado público mais recente. Lucro Real ou Presumido só aparece quando a fonte traz o ano;
// sem isso, só o Simples é conhecido, e o especialista escolhe.
export function regimePorDados(d) {
  if (d?.opcao_pelo_simples === true || d?.opcao_pelo_mei === true) return 'simples'
  const lista = Array.isArray(d?.regime_tributario) ? [...d.regime_tributario].sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0)) : []
  const forma = String(lista[0]?.forma_de_tributacao ?? '').toLowerCase()
  if (forma.includes('real')) return 'real'
  if (forma.includes('presumido')) return 'presumido'
  return ''
}

// Converte a resposta pública em campos da tela. Campo ausente fica vazio; nada é inventado.
export function lerDadosCnpj(d) {
  if (!d || typeof d !== 'object') return null
  const cnae = soDigitos(d.cnae_fiscal ?? d.cnae_principal?.codigo ?? '')
  const anoRegime = Array.isArray(d.regime_tributario) && d.regime_tributario.length ? Math.max(...d.regime_tributario.map((r) => r.ano ?? 0)) : null
  return {
    razaoSocial: d.razao_social ?? '',
    nomeFantasia: d.nome_fantasia ?? '',
    municipio: d.municipio ?? '',
    uf: String(d.uf ?? '').toUpperCase(),
    cnae,
    cnaeDescricao: d.cnae_fiscal_descricao ?? d.cnae_principal?.descricao ?? '',
    naturezaJuridica: d.natureza_juridica ?? '',
    tipo: tipoPorNatureza(d.codigo_natureza_juridica, d.natureza_juridica),
    porteReceita: d.porte ?? d.descricao_porte ?? '',
    inicioAtividade: d.data_inicio_atividade ?? '',
    situacao: d.descricao_situacao_cadastral ?? d.situacao_cadastral ?? '',
    regime: regimePorDados(d),
    anoRegime: anoRegime || null,
  }
}

export async function consultarCnpj(cnpj, { fetchFn = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (!cnpjValido(cnpj)) return { ok: false, erro: 'CNPJ inválido: confira os números.' }
  const controle = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controle ? setTimeout(() => controle.abort(), timeoutMs) : null
  try {
    const r = await fetchFn(CNPJ_SERVICO.url(cnpj), { signal: controle?.signal, headers: { Accept: 'application/json' } })
    if (r.status === 404) return { ok: false, erro: 'CNPJ não encontrado no serviço público.' }
    if (!r.ok) return { ok: false, erro: `O serviço público não respondeu (código ${r.status}). Preencha os dados à mão.` }
    const dados = lerDadosCnpj(await r.json())
    return dados ? { ok: true, dados } : { ok: false, erro: 'Resposta do serviço sem dados. Preencha à mão.' }
  } catch {
    return { ok: false, erro: 'Não foi possível consultar o serviço público agora. Preencha os dados à mão.' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
