import { nf } from './format.js'
import { CONCEITO_MAQUILA } from './maquila.js'
import { CONCEITO_JUROS_FORCADOS } from './jurosForcados.js'
import { CONCEITO_ICMS_ST } from './icmsSt.js'
import { CONCEITO_IMPOSTO_SELETIVO } from './impostoSeletivo.js'
// Aba "Aprender": conceitos explicados em linguagem simples. Os números dos exemplos saem das funções abaixo (testadas),
// nunca digitados no texto, para a tela não mostrar uma conta errada. Exemplos são didáticos, não cotações de mercado.


// Paridade coberta de juros: (1 + i_BRL) = (1 + i_USD) × F / S  →  i_USD = (1 + i_BRL) × S / F − 1 (taxas anuais compostas, para o exemplo).
export const cupomCambial = ({ spot, futuro, di }) => ((1 + di) * spot) / futuro - 1

// Diferencial de juros entre duas moedas, composto: (1 + i_BRL) ÷ (1 + i_USD) − 1 (taxas anuais). A conta rápida, i_BRL − i_USD, é uma aproximação.
export const diferencialDeJuros = (brl, usd) => (1 + brl) / (1 + usd) - 1

// Dólar futuro de equilíbrio (paridade coberta): à vista × (1 + i_BRL) ÷ (1 + i_USD). Acima dele, quem aplicou em reais perde para o câmbio.
export const dolarDeEquilibrio = ({ spot, brl, usd }) => (spot * (1 + brl)) / (1 + usd)

// Juros de um dia de um empréstimo overnight, convenção ACT/360 (a da SOFR).
export const jurosDeUmDia = (principal, taxaAnual) => (principal * taxaAnual) / 360

// Juros do primeiro ano de um financiamento indexado: saldo × (indexador + spread), saldo constante (simplificação didática).
export const jurosAnuais = (saldo, indexador, spread) => saldo * (indexador + spread)

// Custo médio ponderado das fontes de captação: fontes = [{ valor, custo }], custo em fração ao ano.
export const custoMedio = (fontes) => {
  const total = fontes.reduce((s, f) => s + f.valor, 0)
  return total > 0 ? fontes.reduce((s, f) => s + f.valor * f.custo, 0) / total : NaN
}

// Prêmio anual de um CDS: spread em pontos-base × valor protegido (100 pb = 1% ao ano).
export const premioCds = (nocional, pontosBase) => (nocional * pontosBase) / 10000

// Liquidação antecipada de um contrato prefixado, juros compostos anuais.
// Na curva: o saldo cresce pela taxa contratada até a data (principal × (1 + taxa)^anos decorridos).
export const valorNaCurva = ({ principal, taxa, anosDecorridos }) => principal * (1 + taxa) ** anosDecorridos
// A mercado: o valor de resgate no vencimento, trazido a valor presente pela taxa de mercado do prazo que falta.
export const valorAMercado = ({ principal, taxa, anosTotal, taxaMercado, anosRestantes }) => (principal * (1 + taxa) ** anosTotal) / (1 + taxaMercado) ** anosRestantes
// Break funding: o credor mantém a captação até o vencimento (saldo × (1 + taxa de funding)^restante) e só consegue reaplicar o que recebe à taxa de mercado.
// O custo é a diferença, a valor presente pela taxa de reaplicação; nunca negativo (reaplicar acima do funding não gera cobrança).
export const breakFunding = ({ captado, taxaFunding, anosDecorridos, taxaReaplicacao, anosRestantes }) => {
  const saldo = captado * (1 + taxaFunding) ** anosDecorridos
  return Math.max(0, saldo * (((1 + taxaFunding) / (1 + taxaReaplicacao)) ** anosRestantes - 1))
}

// Remuneração pós-fixada CDI + spread: o spread compõe com o CDI (não se soma). Taxas anuais em fração.
export const taxaCdiMaisSpread = (cdi, spread) => (1 + cdi) * (1 + spread) - 1

// Juros de um prazo, a juros compostos: principal × ((1 + taxa anual)^t − 1), com t em fração do ano (CDI: dias úteis ÷ 252).
export const jurosNoPrazo = ({ principal, taxaAnual, fracaoAno }) => principal * ((1 + taxaAnual) ** fracaoAno - 1)

// Exemplo didático de CET: uma entrada líquida e uma única saída, em dias corridos/365.
// Para várias parcelas, a taxa é a que iguala o valor presente de todas as saídas à entrada.
export const cetParcelaUnica = ({ liquido, pagamento, dias }) => (pagamento / liquido) ** (365 / dias) - 1

// FIDC: índice de subordinação (cotas subordinadas sobre o total de cotas) e a distribuição de uma perda da carteira.
export const indiceSubordinacao = ({ senior, subordinada }) => subordinada / (senior + subordinada)
// A perda consome primeiro a cota subordinada; só o que passa dela atinge a sênior.
export const perdaNasCotas = ({ senior, subordinada, perda }) => ({ subordinada: Math.min(subordinada, perda), senior: Math.min(senior, Math.max(0, perda - subordinada)) })

// Inflação acumulada: produto dos fatores mensais, não a soma. Taxas mensais em fração.
// Taxa isenta de IR equivalente a quanto num título tributado (ex.: CRI/CRA isentos para pessoa física × CDB com IR de 15%).
export const equivalenteTributado = (taxaIsenta, ir) => taxaIsenta / (1 - ir)
export const inflacaoAcumulada = (mensais) => mensais.reduce((f, m) => f * (1 + m), 1) - 1
// Juro real (equação de Fisher): (1 + nominal) ÷ (1 + inflação) − 1.
export const juroReal = (nominal, inflacao) => (1 + nominal) / (1 + inflacao) - 1

// Commodities: soja em dólar por tonelada vira real por saca de 60 kg; o galão americano (3,78541 L) vira litro.
export const sacaEmReais = (usdPorTonelada, cambio) => usdPorTonelada * 0.06 * cambio
export const galaoParaLitro = (usdPorGalao, cambio) => (usdPorGalao / 3.78541) * cambio

const EX_DIFERENCIAL = { brl: 0.14, usd: 0.04, spot: 5 }
const EX_CUPOM = { spot: 5, futuro: 5.5, di: 0.14 }
const EX_CUPOM_2 = { spot: 5, futuro: 5.25, di: 0.14 }
const EX_SOFR = { principal: 1_000_000, taxa: 0.043 }
const EX_EURIBOR = { saldo: 200_000, indexador: 0.03, spread: 0.01 }
const EX_FUNDING = { fontes: [{ nome: 'CDB', valor: 60, custo: 0.14 }, { nome: 'LCI', valor: 30, custo: 0.13 }, { nome: 'Capital próprio', valor: 10, custo: 0 }], taxaEmprestimo: 0.18 }
const EX_LIQ = { principal: 1_000_000, taxa: 0.15, anosTotal: 2, anosDecorridos: 1, anosRestantes: 1, taxaMercado: 0.12, taxaFunding: 0.13 }
const EX_DEB = { principal: 1_000_000, cdi: 0.14, spread: 0.02 }
const EX_NC = { principal: 5_000_000, cdi: 0.14, spread: 0.03, diasUteis: 126 }
const EX_FIDC = { senior: 7_000_000, subordinada: 3_000_000, perdas: [2_000_000, 4_000_000] }
const EX_FOCUS = { selic: 0.125, ipca: 0.0452, selicAnterior: 0.1275, emprestimo: 2_000_000 }
const EX_CRI = { principal: 1_000_000, ipca: 0.045, real: 0.07, ir: 0.15 }
const EX_CRA = { principal: 1_000_000, cdi: 0.14, spread: 0.005, ir: 0.15 }
const EX_FACIL = { receita: 320_000_000, limite: 500_000_000, valor: 50_000_000, cdi: 0.14, spreadMercado: 0.03, spreadBanco: 0.05 }
const EX_DRAWBACK = { usd: 200_000, cambio: 5.4, carga: 0.25 }
const EX_INFL = { mensal: 0.004, meses: 12, selic: 0.145 }
const EX_SACA = { usd: 520, antes: 5, depois: 5.5 }
const EX_ICBR = { indiceUsd: 1, altaDolar: 0.1, quedaUsd: -0.05 }
const EX_BOMBA = { usdGalao: 2.2, cambio: 5.4, bomba: 6.5 }
const EX_CDS = { nocional: 10_000_000, pb: 200 }

const money = (v, sym) => `${sym} ${nf(v, 0)}`
const pct = (f, d = 2) => `${nf(f * 100, d)}%`

export const feeEstruturacao = (base, taxaFlat) => base * taxaFlat
export const CONCEITOS = [
  CONCEITO_JUROS_FORCADOS,
  {
    id: 'marcacao-a-mercado',
    topico: 'Funding e risco',
    nome: 'Marcação a mercado (MtM)',
    revisadoEm: '2026-11-11',
    frase: 'É estimar quanto uma posição vale hoje pelas condições de mercado, não apenas pela taxa contratada.',
    crianca: [
      'Pense em um título que promete um pagamento futuro. Seu preço hoje pode mudar, mesmo que essa promessa continue igual. Se o mercado passa a exigir juros maiores para o mesmo fluxo, o preço cai; se exige juros menores, o preço sobe.',
      'Na curva, o valor evolui pela taxa contratada. A mercado, usa as condições atuais. Em títulos prefixados e indexados à inflação, prazo e sensibilidade aos juros importam: duration é uma medida dessa sensibilidade. Renda fixa não significa preço fixo antes do vencimento.',
      'Para a empresa, a pergunta prática é: precisarei vender a aplicação antes do prazo? A oscilação pode afetar a reserva de caixa. Em um hedge, avalie o derivativo junto da exposição protegida e confira quando há pagamentos ou exigência de garantias.',
    ],
    analogia: 'É como separar o valor combinado de uma venda futura do preço que alguém pagaria por esse direito hoje.',
    lacunas: [
      'Preço estimado não é oferta firme: liquidez, risco de crédito, spreads e custos podem mudar o valor efetivo de saída.',
      'Uma queda no extrato não é, sozinha, um desembolso. Nos futuros há ajustes diários pagos ou recebidos; outros contratos podem ter regras diferentes. Marcação, ajuste e margem não são sinônimos.',
      'Manter um título até o vencimento não apaga risco de crédito. O fluxo contratado depende do cumprimento pelo emissor; impostos e custos também afetam o resultado líquido.',
      'Não aplique o preço teórico de um título à quitação de qualquer empréstimo: a liquidação antecipada segue contrato e normas aplicáveis. Break funding é outro conceito.',
      'Perguntas de visita: qual é o horizonte do caixa? Há ativos longos financiando compromissos curtos? Quem valida as marcações? Qual cenário exigiria caixa para ajustes ou garantias?',
    ],
    preciso: {
      texto: 'Para um título de fluxos definidos, a referência é o valor presente dos pagamentos pela curva de desconto compatível com prazo e risco. A fórmula abaixo simplifica as taxas como anuais compostas; instrumentos reais usam convenções próprias. Derivativos exigem modelo adequado às suas características. A classificação contábil e eventual hedge accounting devem ser avaliados separadamente pelo contador, não deduzidos apenas da oscilação de preço.',
      formula: 'Preço = Σ fluxo_t ÷ (1 + taxa_t)^t; em um fluxo único: P = F ÷ (1 + i)^t.',
    },
    exemplo: (() => {
      const principal = 1000, taxa = 0.1
      const base = { principal, taxa, anosTotal: 1, anosRestantes: 1 }
      const futuro = principal * (1 + taxa)
      const alta = valorAMercado({ ...base, taxaMercado: 0.12 })
      const baixa = valorAMercado({ ...base, taxaMercado: 0.08 })
      return {
        titulo: 'Mesmo fluxo, três taxas · valores hipotéticos',
        passos: [
          `Título sem cupons comprado por R$ ${nf(principal)} para pagar R$ ${nf(futuro)} em um ano: taxa de ${pct(taxa)} a.a.`,
          `Sem passagem de tempo, se a taxa exigida sobe a ${pct(0.12)} a.a., o preço passa a R$ ${nf(alta)}; variação de R$ ${nf(alta - principal)} frente à compra.`,
          `Se a taxa cai a ${pct(0.08)} a.a., o preço passa a R$ ${nf(baixa)}; variação de R$ ${nf(baixa - principal)}. O pagamento futuro não foi alterado.`,
          'Hipóteses: fluxo único, ausência de inadimplência, impostos, custos e diferença entre compra e venda. Não é cotação nem cálculo de liquidação de crédito.',
        ],
        resultado: `Taxa maior reduz o preço; taxa menor aumenta o preço. O fluxo permanece R$ ${nf(futuro)} no vencimento, se cumprido pelo emissor.`,
      }
    })(),
    teste: {
      pergunta: 'Uma aplicação prefixada caiu de preço: isso prova inadimplência ou exige venda imediata?',
      resposta: 'Não. Pode refletir aumento da taxa exigida pelo mercado. Confira risco do emissor, liquidez e necessidade de caixa. Vender, manter ou proteger exige avaliar o conjunto, não apenas a variação no extrato.',
    },
    fontes: [
      { nome: 'B3 · relação entre juros e preço dos títulos', url: 'https://borainvestir.b3.com.br/objetivos-financeiros/investir-melhor/devo-resgatar-meu-titulo-do-tesouro-direto-com-prejuizo-e-reinvestir/' },
      { nome: 'Tesouro Direto · preços e resgate antecipado', url: 'https://www.tesourodireto.com.br/sobre-o-tesouro/regras-e-regulamento' },
      { nome: 'B3 · futuros, ajustes diários e garantias', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/mercado-de-acoes/dinamica-de-negociacao.htm' },
    ],
    noApp: { tab: 'aprender', view: 'liquidacao-antecipada', texto: 'Compare valor na curva, valor a mercado e break funding em liquidação antecipada.' },
  },
  {
    id: 'diferencial-de-juros',
    topico: 'Juros e câmbio',
    nome: 'Diferencial de juros',
    frase: 'É a diferença entre a taxa de juros de duas moedas (ou países), por exemplo o juro em reais menos o juro em dólares.',
    crianca: [
      'Se aplicar dinheiro no Brasil rende 14% ao ano e nos Estados Unidos rende 4%, o Brasil paga mais. Essa distância é o diferencial de juros.',
      'Quem toma dinheiro emprestado onde o juro é baixo e aplica onde é alto parece ganhar a diferença. Essa operação se chama carry trade. Só que as moedas oscilam: se a moeda da aplicação perde valor, a vantagem encolhe ou vira prejuízo.',
      'Por isso o mercado já embute o diferencial no dólar futuro. Quem trava o câmbio da volta (faz hedge) deixa de ter ganho extra sem risco: é a ideia da paridade coberta de juros, a mesma que dá origem ao cupom cambial.',
    ],
    analogia: 'É como dois bancos na mesma rua pagando taxas diferentes: o que paga mais atrai o dinheiro, mas, se para depositar você precisa trocar de moeda e ela cai, a vantagem pode sumir.',
    lacunas: [
      'Não é lucro garantido: o ganho só se mantém se a moeda da aplicação se desvalorizar menos do que o diferencial.',
      'Diferencial nominal não é diferencial real: se a inflação dos dois países é diferente, o juro real entre eles também é.',
      'Pela paridade descoberta de juros, o câmbio deveria se mover para compensar o diferencial; na prática isso falha no curto prazo (em geral, menos de um ano), e é aí que o carry trade encontra espaço (e também o risco).',
    ],
    preciso: {
      texto: 'Com taxas anuais compostas i_BRL e i_USD, o diferencial exato é a razão dos fatores de juros. Na paridade coberta, ele é igual ao prêmio do dólar futuro sobre o à vista (F = dólar futuro, S = dólar à vista):',
      formula: 'diferencial = (1 + i_BRL) ÷ (1 + i_USD) − 1 = F ÷ S − 1',
    },
    exemplo: (() => {
      const d = diferencialDeJuros(EX_DIFERENCIAL.brl, EX_DIFERENCIAL.usd)
      const f = dolarDeEquilibrio(EX_DIFERENCIAL)
      return {
        titulo: 'Conta com números redondos',
        passos: [
          `Juro em reais: ${pct(EX_DIFERENCIAL.brl, 0)} ao ano. Juro em dólares: ${pct(EX_DIFERENCIAL.usd, 0)} ao ano. Dólar à vista: R$ ${nf(EX_DIFERENCIAL.spot)}.`,
          `Diferencial = (1 + ${nf(EX_DIFERENCIAL.brl)}) ÷ (1 + ${nf(EX_DIFERENCIAL.usd)}) − 1 = ${pct(d)} ao ano. A conta rápida, ${pct(EX_DIFERENCIAL.brl, 0)} − ${pct(EX_DIFERENCIAL.usd, 0)}, dá ${nf((EX_DIFERENCIAL.brl - EX_DIFERENCIAL.usd) * 100, 0)} pontos percentuais.`,
          `Dólar de equilíbrio em 1 ano = ${nf(EX_DIFERENCIAL.spot)} × ${nf(EX_DIFERENCIAL.brl + 1)} ÷ ${nf(EX_DIFERENCIAL.usd + 1)} = R$ ${nf(f)}.`,
        ],
        resultado: `Se o dólar estiver abaixo de R$ ${nf(f)} em 1 ano, quem aplicou em reais ganhou mais do que aplicando em dólares; acima disso, o câmbio consumiu a vantagem.`,
      }
    })(),
    noApp: { texto: 'Aba Juros: compare o DI (Brasil), os Treasuries (EUA) e o cupom cambial, que é esse diferencial já descontado do dólar futuro.', tab: 'juros' },
    teste: {
      pergunta: 'Se o juro em reais sobe e o juro em dólares fica igual, o diferencial sobe ou cai?',
      resposta: 'Sobe. A vantagem de aplicar em reais aumenta, e o carry trade tende a ficar mais atrativo se o câmbio ficar estável. O risco de o dólar subir continua existindo.',
    },
  },
  {
    id: 'cupom-cambial',
    topico: 'Juros e câmbio',
    nome: 'Cupom cambial',
    frase: 'É o juro em dólar que o mercado brasileiro está embutindo, calculado a partir do juro em reais e do dólar futuro.',
    crianca: [
      'Você pode guardar dinheiro de duas formas: em reais, que rendem, por exemplo, 14% ao ano, ou em dólares. O problema é que o dólar sobe e desce.',
      'O mercado já combina hoje por quanto vai vender o dólar daqui a um ano: é o dólar futuro. Se esse dólar futuro já está mais caro que o de hoje, boa parte dos 14% do real é só compensação pela alta do dólar.',
      'Tire essa compensação dos 14%. O que sobrar é o juro que você ganharia em dólares. Esse é o cupom cambial.',
    ],
    analogia: 'É como trocar de moeda e já travar o preço da volta: o ganho que resta, em dólar, depois de combinada a volta, é o cupom.',
    lacunas: [
      'Não é a variação do dólar. É um juro, expresso ao ano.',
      'Não é o juro dos EUA. A diferença entre o cupom cambial e o juro americano de mesmo prazo reflete o prêmio de risco de operar em dólar no Brasil.',
      'O mercado costuma cotar o cupom em taxa linear, base 360 dias corridos (convenção da B3 para o DI x dólar). O exemplo ao lado usa taxa composta anual só para simplificar.',
    ],
    preciso: {
      texto: 'Vem da paridade coberta de juros: quem aplica em reais e trava a volta ao dólar no futuro deve obter o mesmo que aplicando em dólar. Logo, com S = dólar à vista, F = dólar futuro e i = taxa DI no mesmo prazo:',
      formula: 'cupom = (1 + DI) × S ÷ F − 1',
    },
    exemplo: (() => {
      const a = cupomCambial(EX_CUPOM)
      const b = cupomCambial(EX_CUPOM_2)
      return {
        titulo: 'Conta com números redondos',
        passos: [
          `Dólar à vista: R$ ${nf(EX_CUPOM.spot)}. Dólar futuro em 1 ano: R$ ${nf(EX_CUPOM.futuro)}. DI de 1 ano: ${pct(EX_CUPOM.di, 0)}.`,
          `Cupom = (1 + ${nf(EX_CUPOM.di)}) × ${nf(EX_CUPOM.spot)} ÷ ${nf(EX_CUPOM.futuro)} − 1 = ${pct(a)} ao ano.`,
          `Se o dólar futuro fosse R$ ${nf(EX_CUPOM_2.futuro)} (mais perto do à vista), o cupom subiria para ${pct(b)}.`,
        ],
        resultado: `Cupom de ${pct(a)} ao ano: quase todo o juro do real foi “consumido” pela alta esperada do dólar.`,
      }
    })(),
    noApp: { texto: 'Aba Juros, “Brasil · Cupom cambial” (curva DI x dólar da B3).', tab: 'juros' },
    teste: {
      pergunta: 'Se o dólar futuro sobe e o DI fica igual, o cupom cambial sobe ou cai?',
      resposta: 'Cai. O dólar futuro está no denominador: quanto maior o F, menor o cupom. Mais do juro do real passa a ser compensação cambial.',
    },
  },
  {
    id: 'sofr',
    topico: 'Juros e câmbio',
    nome: 'SOFR',
    frase: 'É a taxa de juros de um dia para empréstimos em dólar com garantia de títulos do Tesouro americano.',
    crianca: [
      'Alguém precisa de dinheiro só até amanhã e deixa como garantia um título do governo dos EUA. Quem empresta sabe que, se não for pago, fica com o título.',
      'O juro desse empréstimo de uma noite, medido em milhares de operações reais, é a SOFR. Como tem garantia, é considerada uma taxa quase sem risco.',
    ],
    analogia: 'É o “preço do dinheiro por uma noite” no mercado americano, com penhor.',
    lacunas: [
      'Não é a taxa do Fed. O Fed define uma faixa-alvo; a SOFR é o que o mercado de fato pratica, e fica perto dela, mas não igual.',
      'É de um dia. Para prazos longos usam-se médias compostas (30, 90, 180 dias) ou taxas a termo; o app mostra as médias.',
      'Substituiu a LIBOR em dólar como referência de contratos.',
    ],
    preciso: {
      texto: 'Publicada pelo Federal Reserve de Nova York todo dia útil, por volta das 8h (horário de Nova York), referente às operações do dia útil anterior. É a mediana, ponderada pelo volume, das operações de recompra (repo) de um dia garantidas por Treasuries. Juros calculados em ACT/360:',
      formula: 'juros do dia = principal × SOFR ÷ 360',
    },
    exemplo: {
      titulo: 'Quanto custa uma noite',
      passos: [
        `Empréstimo de ${money(EX_SOFR.principal, 'US$')} com SOFR de ${pct(EX_SOFR.taxa)} ao ano.`,
        `Juros de 1 dia = ${nf(EX_SOFR.principal, 0)} × ${nf(EX_SOFR.taxa * 100)}% ÷ 360 ≈ US$ ${nf(jurosDeUmDia(EX_SOFR.principal, EX_SOFR.taxa))}.`,
      ],
      resultado: `Cerca de US$ ${nf(jurosDeUmDia(EX_SOFR.principal, EX_SOFR.taxa))} por noite.`,
    },
    noApp: { texto: 'Aba Juros: gráfico da SOFR (taxa do dia, médias de 30/90/180 dias e faixa de percentis) e a linha “EUA · SOFR overnight” em Juros de referência.', tab: 'juros' },
    teste: {
      pergunta: 'Por que a SOFR é tratada como uma taxa quase sem risco?',
      resposta: 'Porque o empréstimo é de um dia e tem como garantia títulos do Tesouro americano. Quem empresta pode ficar com o título se não for pago.',
    },
  },
  {
    id: 'euribor',
    revisadoEm: '2026-11-05',
    fontes: [{ nome: 'EMMI — definição e metodologia da Euribor', url: 'https://www.emmi-benchmarks.eu/benchmarks/euribor/' }],
    topico: 'Juros e câmbio',
    nome: 'Euribor',
    frase: 'É o juro de referência em euros para empréstimos entre bancos europeus, em prazos de uma semana a 12 meses.',
    crianca: [
      'Os bancos emprestam dinheiro uns aos outros. A Euribor é o “preço médio” desse empréstimo, em euros, divulgado todo dia para vários prazos.',
      'Muita gente na Europa tem financiamento da casa escrito como “Euribor + 1%”. Quando a Euribor sobe, a prestação sobe junto.',
    ],
    analogia: 'É a “tabela de preço” do dinheiro em euros entre bancos; os contratos se penduram nela.',
    lacunas: [
      'Não é a taxa do Banco Central Europeu (BCE). O BCE fixa a taxa de depósito; a Euribor reage a ela e às expectativas sobre ela.',
      'É uma referência não garantida a prazo, com componente de risco bancário. Não equivale à SOFR, garantida e overnight, nem à €STR, referência overnight não garantida em euros.',
      'Não existe uma Euribor só: há uma por prazo (1 semana, 1, 3, 6 e 12 meses).',
      'Administrada pelo EMMI. Desde 2019 usa uma metodologia “híbrida”, que prioriza transações reais em vez de só cotações informadas.',
    ],
    preciso: {
      texto: 'Referência de crédito e de derivativos em euros (swaps de juros, hipotecas de taxa variável). Juros em ACT/360. Um contrato indexado soma a Euribor do prazo escolhido a um spread fixo:',
      formula: 'taxa do contrato = Euribor (prazo) + spread',
    },
    exemplo: {
      titulo: 'Financiamento “Euribor + spread”',
      passos: [
        `Saldo de ${money(EX_EURIBOR.saldo, '€')}, Euribor 12 meses de ${pct(EX_EURIBOR.indexador)} e spread de ${pct(EX_EURIBOR.spread)}.`,
        `Taxa do contrato = ${pct(EX_EURIBOR.indexador + EX_EURIBOR.spread)} ao ano → juros do ano ≈ ${money(jurosAnuais(EX_EURIBOR.saldo, EX_EURIBOR.indexador, EX_EURIBOR.spread), '€')}.`,
        `Se a Euribor subir 1 ponto percentual, os juros passam a ≈ ${money(jurosAnuais(EX_EURIBOR.saldo, EX_EURIBOR.indexador + 0.01, EX_EURIBOR.spread), '€')}.`,
      ],
      resultado: `Cada ponto percentual na Euribor muda o custo em ${money(jurosAnuais(EX_EURIBOR.saldo, 0.01, 0), '€')} ao ano neste saldo.`,
    },
    noApp: { texto: 'O app ainda não exibe a Euribor. Em Juros de referência aparece a taxa de depósito do BCE, que é o que a move.', tab: 'juros' },
    teste: {
      pergunta: 'Se o BCE sobe a taxa de depósito, o que tende a acontecer com a Euribor?',
      resposta: 'Tende a subir, porque os bancos passam a pagar mais pelo dinheiro e o mercado já antecipa as próximas decisões do BCE.',
    },
  },
  {
    id: 'custo-de-funding',
    topico: 'Funding e risco',
    nome: 'Custo de funding',
    frase: 'É quanto custa, em média, para uma instituição conseguir o dinheiro que depois empresta.',
    crianca: [
      'Uma padaria compra farinha para fazer pão: o preço da farinha é o custo dela. Um banco “compra” dinheiro de quem aplica (CDB, LCI, depósitos) ou de investidores de fora, e paga juros por isso.',
      'Esse custo médio é o custo de funding. Quando o banco empresta, cobra mais do que pagou, e a diferença é a margem.',
    ],
    analogia: 'É o preço da farinha do banco: quem capta mais barato consegue emprestar mais barato, ou lucrar mais.',
    lacunas: [
      'Não é uma taxa só. É uma média das fontes, ponderada pelo valor de cada uma.',
      'Muda com o risco da instituição e do país (ver CDS), com o prazo e com a moeda da captação.',
      '“Funding spread” é o custo acima de um benchmark, por exemplo CDI + 1,5% ao ano ou SOFR + 2%.',
    ],
    preciso: {
      texto: 'Custo médio ponderado das fontes de captação, mais custos que não aparecem na taxa (recolhimentos compulsórios, contribuição ao FGC, despesas de captação). Em dólar, costuma ser benchmark (SOFR) mais spread de crédito; para virar custo em reais, soma-se a conversão pelo cupom cambial (swap).',
      formula: 'custo médio = Σ (valor da fonte × custo da fonte) ÷ Σ valores',
    },
    exemplo: (() => {
      const c = custoMedio(EX_FUNDING.fontes.map(({ valor, custo }) => ({ valor, custo })))
      const total = EX_FUNDING.fontes.reduce((s, f) => s + f.valor, 0)
      return {
        titulo: 'Banco que capta 100',
        passos: [
          `Fontes: ${EX_FUNDING.fontes.map((f) => `${f.nome} ${f.valor} a ${pct(f.custo, 0)}`).join('; ')} (na prática, o capital próprio também tem custo de oportunidade).`,
          `Custo médio = (${EX_FUNDING.fontes.map((f) => `${f.valor}×${nf(f.custo * 100, 0)}%`).join(' + ')}) ÷ ${total} = ${pct(c, 1)} ao ano.`,
          `Se empresta a ${pct(EX_FUNDING.taxaEmprestimo, 0)} ao ano, a margem bruta é ${nf((EX_FUNDING.taxaEmprestimo - c) * 100, 1)} pontos percentuais, antes de impostos, inadimplência e custos.`,
        ],
        resultado: `Custo de funding de ${pct(c, 1)} ao ano e margem bruta de ${nf((EX_FUNDING.taxaEmprestimo - c) * 100, 1)} p.p.`,
      }
    })(),
    noApp: { texto: 'A curva DI, em Juros, é o benchmark em reais; o cupom cambial, na mesma aba, mostra o custo do dólar embutido nos juros.', tab: 'juros' },
    teste: {
      pergunta: 'Se o CDS do país sobe, o que tende a acontecer com o custo de funding externo de um banco brasileiro?',
      resposta: 'Tende a subir. O mercado passa a exigir um spread maior para financiar quem está no país percebido como mais arriscado.',
    },
  },
  {
    id: 'fee-de-estruturacao', topico: 'Operações de crédito', nome: 'Fee de estruturação',
    frase: 'É a remuneração pelo trabalho de organizar uma operação financeira, conforme os serviços e as condições definidos no contrato.',
    crianca: [
      'Fee é uma palavra em inglês usada para comissão ou remuneração. Estruturar uma operação pode envolver desenhar prazos e garantias, analisar documentos e coordenar os participantes de uma captação.',
      'Para a empresa, entender essa cobrança ajuda a comparar propostas pelo custo completo e pelo dinheiro que realmente entra no caixa. Uma taxa de juros menor pode vir acompanhada de custos iniciais maiores.',
      'O valor pode ser fixo ou um percentual de uma base definida no contrato. Pagamento na assinatura, na liberação, por etapas ou condicionado ao sucesso depende do acordo; não há taxa ou momento universal.',
    ],
    analogia: 'É como pagar pelo projeto e pela organização de uma obra: essa remuneração é diferente do custo de usar dinheiro emprestado durante a execução.',
    lacunas: [
      'Não é uma taxa anual de juros. O spread é um componente da taxa de juros; o fee remunera serviços de estruturação. Não some automaticamente um percentual flat à taxa anual.',
      'Confira a base de cálculo, os serviços incluídos, quem recebe, vencimento, tributos e regras de desistência ou insucesso no contrato. Outras comissões, como colocação, podem ser cobradas separadamente.',
      'Uma condição documentada em determinada emissão não constitui tabela universal nem tabela atual do Itaú. A existência e a forma da cobrança precisam ser verificadas em cada proposta.',
    ],
    preciso: { texto: 'Quando pactuado como percentual único (flat), a comissão é a base contratual multiplicada pelo percentual. Comparar o custo financeiro exige considerar todos os fluxos, datas e demais encargos, além dos juros.', formula: 'fee = base contratual × percentual flat; líquido = valor liberado − fee − outros custos descontados' },
    exemplo: (() => { const base=10_000_000, taxa=0.01, fee=feeEstruturacao(base,taxa); return {
      titulo: 'Hipotético: cobrança única descontada na liberação',
      passos: [`Suponha uma operação de ${money(base,'R$')} e um fee flat de ${pct(taxa,0)}, pactuado apenas para este exemplo. Não é cotação nem taxa recomendada.`, `Fee = ${money(base,'R$')} × ${pct(taxa,0)} = ${money(fee,'R$')}. Se descontado na liberação, entram ${money(base-fee,'R$')} no caixa, antes de outros custos.`],
      resultado: 'A dívida e os juros seguem as condições do contrato. Receber menos no início afeta o custo efetivo; 1% flat não equivale automaticamente a 1% ao ano.',
    } })(),
    noApp: {texto: 'Compare os juros na aba Juros e, na proposta da operação, confira separadamente o fee e os demais custos contratados.',tab:'juros'},
    teste: {pergunta:'Um fee de 1% flat pode ser somado diretamente a juros de 12% ao ano?',resposta:'Não. O fee é uma cobrança única neste exemplo, enquanto os juros dependem do saldo e do tempo. A comparação exige os valores e as datas dos fluxos do contrato.'},
    fontes: [
      {nome:'BNDES — serviços de coordenação em ofertas públicas',url:'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-servicos-coordenacao-em-ofertas-publicas/'},
      {nome:'Autoban — prospecto definitivo de 27/07/2017, páginas 66–68 (exemplo contratual histórico)',url:'https://www.itau.com.br/content/dam/ibba/ofertas-publicas/pdfs/concessionaria-do-sistema-anhanguera-bandeirantes-sa/2017/junho/autoban-prospecto-definitivo.pdf'},
    ],
  },
  {
    id: 'cet', topico: 'Operações de crédito', nome: 'CET (Custo Efetivo Total)', revisadoEm: '2026-11-06',
    frase: 'É a taxa anual que reúne o custo do crédito, considerando quanto entra no caixa e quanto sai, nas datas de cada pagamento.',
    crianca: [
      'A taxa contratual remunera o dinheiro emprestado. O CET reúne também os outros encargos da operação: ajuda a comparar propostas que parecem baratas nos juros, mas cobram mais na entrada ou nas parcelas.',
      'A conta começa pelo dinheiro líquido recebido. Depois entram as prestações e as demais cobranças vinculadas ao crédito, cada uma na sua data. Mudar uma data pode mudar o CET, mesmo sem alterar o total pago.',
      'Não se calcula o CET somando os percentuais dos juros, do IOF e de uma tarifa. É preciso encontrar a taxa que faz os pagamentos futuros equivalerem ao dinheiro recebido hoje.',
    ],
    analogia: 'É como comparar duas viagens pelo valor completo: a passagem anunciada não revela sozinha o gasto com bagagem e taxas. No crédito, o momento de cada pagamento também entra na comparação.',
    ajuda: [
      'A Resolução CMN 4.881 exige cálculo e informação do CET para pessoas físicas, inclusive empresários individuais, e para ME e EPP nos termos da LC 123. Não abrange automaticamente toda empresa; o art. 9º exclui repasses de recursos externos e crédito rural.',
      'Para adiantamento a depositantes, desconto, cheque especial e crédito rotativo, o art. 6º determina prazo de 30 dias e limite pactuado. Essa regra especial difere do cronograma de um financiamento parcelado.',
    ],
    lacunas: [
      'Considere juros, tarifas, tributos, seguros e outras despesas aplicáveis ligadas à operação, inclusive serviços de terceiros de responsabilidade do tomador. Confira o demonstrativo e o contrato.',
      'Uma cobrança descontada na liberação reduz o líquido recebido; uma cobrança posterior entra na data em que será paga. Não desconte o mesmo IOF ou a mesma tarifa duas vezes.',
      'O CET usa dias corridos e base fixa de 365 dias, inclusive quando o intervalo passa por ano bissexto. A apresentação é percentual ao ano, com duas casas decimais; não arredonde as etapas antes de concluir.',
    ],
    preciso: {
      texto: 'FC0 é o crédito líquido; FCj é cada saída; d0 é a data de liberação e dj, a de pagamento. Resolva a equação para CET. Pelo art. 5º, taxas flutuantes e índices de preços não entram no CET regulatório e devem ser informados separadamente. Uma projeção com CDI ou IPCA futuro não é esse CET.',
      formula: 'Σ [FCj ÷ (1 + CET)^((dj − d0) ÷ 365)] = FC0',
    },
    exemplo: (() => {
      const principal = 10_000, iof = 200, tarifa = 100, pagamento = 11_000, dias = 365
      const liquido = principal - iof - tarifa
      const cet = cetParcelaUnica({ liquido, pagamento, dias })
      return {
        titulo: 'Didático: uma cobrança ao final de 365 dias',
        passos: [
          `Crédito de ${money(principal, 'R$')}, com IOF de ${money(iof, 'R$')} e tarifa de ${money(tarifa, 'R$')} descontados na liberação. São valores fictícios, não alíquotas ou condições comerciais. Líquido recebido: ${money(liquido, 'R$')}.`,
          `Após ${dias} dias corridos, pagamento único de ${money(pagamento, 'R$')}, sem outras cobranças. Juros sobre o principal: ${pct(pagamento / principal - 1)}.`,
          `CET = (${nf(pagamento, 0)} ÷ ${nf(liquido, 0)})^(365 ÷ ${dias}) − 1 = ${pct(cet)} ao ano.`,
        ],
        resultado: `A taxa contratual do exemplo é ${pct(pagamento / principal - 1)} ao ano, mas o CET é ${pct(cet)} ao ano, porque a empresa recebe ${money(liquido, 'R$')} e paga ${money(pagamento, 'R$')}.`,
      }
    })(),
    noApp: { texto: 'Na aba Juros, acompanhe os referenciais usados nas propostas. Eles ajudam na análise, mas não substituem o CET do fluxo completo de cada operação.', tab: 'juros' },
    teste: { pergunta: 'Duas propostas com a mesma taxa contratual sempre têm o mesmo CET?', resposta: 'Não. O líquido recebido, os demais encargos e as datas dos pagamentos podem ser diferentes. Compare o fluxo completo e confira se as propostas usam as mesmas condições.' },
    fontes: [{ nome: 'Banco Central — Resolução CMN 4.881, arts. 1º a 9º', url: 'https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf' }],
  },
  {
    id: 'fgi-peac', topico: 'Operações de crédito', nome: 'FGI e FGI PEAC (garantia para o crédito)', revisadoEm: '2026-11-09',
    frase: 'É um fundo do BNDES que cobre parte da perda do banco quando uma empresa de menor porte não paga um empréstimo e não tem garantia suficiente.',
    crianca: [
      'Muitas empresas pequenas e médias não têm imóvel ou aval suficiente para dar ao banco. O FGI (Fundo Garantidor para Investimentos), administrado pelo BNDES, funciona como uma garantia complementar: se a empresa não pagar, o fundo cobre uma parte da perda do banco.',
      'O FGI PEAC é a versão criada na pandemia (Programa Emergencial de Acesso a Crédito, Lei 14.042/2020), com recursos da União, para micro, pequenas e médias empresas. O FGI Tradicional é o fundo de sempre, mantido pelas comissões pagas nas operações.',
      'A garantia não perdoa a dívida: a empresa continua devendo ao banco e paga uma comissão pela cobertura. O que muda é o risco do banco, que tende a aprovar com mais facilidade ou a oferecer melhores condições.',
    ],
    analogia: 'É como um fiador profissional: o banco aceita emprestar porque, se houver calote, parte da perda é coberta pelo fundo. Quem deve continua sendo a empresa.',
    lacunas: [
      'O fundo garante só uma parte da operação, não toda. O percentual coberto, o limite por operação e a comissão dependem do produto, do porte da empresa e do prazo; confirme com o agente financeiro.',
      'O PEAC nasceu como medida temporária e foi reaberto em 2022. Não verifiquei se ele aceita novas operações hoje: pergunte ao agente financeiro antes de contar com ele.',
      'A garantia do FGI não substitui a análise de crédito do banco nem garante a aprovação. O banco ainda decide se concede o crédito e em que condições.',
    ],
    preciso: {
      texto: 'O agente financeiro credenciado pede a garantia ao BNDES para uma operação própria. Em caso de inadimplência, o fundo honra a parte garantida, dentro do limite de cobertura e das regras do produto. A comissão de garantia é cobrada da empresa e repassada ao fundo.',
      formula: 'perda coberta = perda do banco × % de cobertura, até o limite da garantia',
    },
    exemplo: {
      titulo: 'Hipotético: financiamento de R$ 1.000.000 com cobertura de 80%',
      passos: [
        'Uma empresa financia R$ 1.000.000 e não tem garantia suficiente. O percentual de 80% é só um exemplo, não a cobertura de um produto específico.',
        'Se a empresa não pagar e o banco perder R$ 500.000, o fundo cobre 80% desse valor: R$ 400.000.',
      ],
      resultado: 'O banco fica com R$ 100.000 de perda, em vez de R$ 500.000. Por isso a garantia pode facilitar a aprovação; a empresa continua devedora de todo o valor.',
    },
    noApp: { texto: 'Na calculadora BNDES Finame Materiais, a ajuda "Regras do produto e fontes" cita o FGI (Tradicional ou PEAC) entre as garantias admitidas.', tab: 'calculadora', view: 'finame-materiais' },
    teste: { pergunta: 'Se a empresa tem a garantia do FGI e não paga o banco, a dívida deixa de existir?', resposta: 'Não. O fundo cobre parte da perda do banco, mas a empresa continua devedora. A garantia reduz o risco do banco, não perdoa a dívida.' },
    fontes: [
      { nome: 'BNDES — Programa Emergencial de Acesso a Crédito (FGI PEAC)', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/garantias/peac' },
      { nome: 'Planalto — Lei 14.042/2020', url: 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14042.htm' },
    ],
  },
  {
    id: 'liquidacao-antecipada',
    topico: 'Operações de crédito',
    nome: 'Liquidação antecipada (na curva, a mercado e break funding)',
    frase: 'É pagar um contrato antes do vencimento; o valor a pagar muda conforme o contrato seja liquidado na curva ou a mercado, e pode vir com a cobrança de break funding.',
    crianca: [
      'Você financiou R$ 1 milhão a uma taxa fixa por dois anos e quer quitar com um ano de antecedência. Quanto pagar? Há duas formas de calcular.',
      'Na curva: o saldo cresce todo dia pela taxa contratada, como se o contrato seguisse normalmente, e você paga esse saldo. É a conta do contrato; não olha o que o mercado paga de juros hoje.',
      'A mercado: o contrato vale hoje o que vale o dinheiro que ele ainda vai render, descontado pela taxa de mercado do prazo que falta. Se o mercado paga menos do que o seu contrato, o contrato “vale mais” e você paga mais do que o saldo na curva; se o mercado paga mais, paga menos.',
      'Break funding (custo de quebra) é a indenização que o credor cobra por ter captado dinheiro a uma taxa e prazo fixos para emprestar a você: ao receber antes, ele só consegue reaplicar a uma taxa menor e fica com um buraco. A cláusula do contrato diz se e como isso é cobrado.',
    ],
    analogia: 'É como cancelar um aluguel antes do fim: o saldo contábil é o que falta pagar (na curva); o valor de mercado é o quanto o dono perde ou ganha se alugar de novo pelos preços de hoje; o break funding é a multa para cobrir o buraco que ele fica.',
    lacunas: [
      'Na curva não é “sem custo”: é o valor contábil. Quem liquida na curva um contrato que rende menos que o mercado paga pouco; quem liquida um que rende mais deixa o credor no prejuízo, e é aí que entra a cobrança de quebra.',
      'A mercado e break funding atacam o mesmo problema (a diferença entre a taxa do contrato e a taxa de hoje) por caminhos diferentes. Em geral, o contrato prevê um ou outro, ou fixa uma regra própria; somar os dois pelo mesmo efeito seria cobrar em dobro.',
      'Break funding mede a perda do credor com a captação (taxa de funding contra taxa de reaplicação), não a perda com o contrato (taxa do contrato contra taxa de mercado). Por isso nunca é negativo: se ele reaplica acima do funding, não há o que cobrar.',
      'Os termos e a fórmula exata dependem do contrato e da instituição (em operações do BNDES, das condições da linha); a conta abaixo é o esqueleto, não a cláusula.',
    ],
    preciso: {
      texto: 'Com taxa contratada i, prazo total T, tempo decorrido t, resto r = T − t, taxa de mercado m, taxa de funding f e taxa de reaplicação m (juros compostos anuais):',
      formula: 'curva = P × (1 + i)^t   ·   mercado = P × (1 + i)^T ÷ (1 + m)^r   ·   break funding = saldo do funding × [((1 + f) ÷ (1 + m))^r − 1], mínimo zero',
    },
    exemplo: (() => {
      const e = EX_LIQ
      const curva = valorNaCurva(e)
      const mercado = valorAMercado(e)
      const quebra = breakFunding({ captado: e.principal, taxaFunding: e.taxaFunding, anosDecorridos: e.anosDecorridos, taxaReaplicacao: e.taxaMercado, anosRestantes: e.anosRestantes })
      return {
        titulo: `Empréstimo de ${money(e.principal, 'R$')} a ${pct(e.taxa, 0)} ao ano, quitado com um ano de antecedência`,
        passos: [
          `Contrato prefixado de ${e.anosTotal} anos; liquidação após ${e.anosDecorridos} ano. A taxa de mercado para o ano que falta está em ${pct(e.taxaMercado, 0)}.`,
          `Na curva = ${nf(e.principal, 0)} × ${nf(1 + e.taxa, 2)}^${e.anosDecorridos} = R$ ${nf(curva, 0)}.`,
          `A mercado: no vencimento o contrato valeria R$ ${nf(e.principal * (1 + e.taxa) ** e.anosTotal, 0)}; trazido a valor presente por ${pct(e.taxaMercado, 0)} em ${e.anosRestantes} ano, dá R$ ${nf(mercado, 0)}, ou seja, R$ ${nf(mercado - curva, 0)} a mais que na curva, porque o contrato rende mais do que o mercado paga hoje.`,
          `Break funding: o credor captou ${money(e.principal, 'R$')} a ${pct(e.taxaFunding, 0)}, e a captação já vale R$ ${nf(e.principal * (1 + e.taxaFunding) ** e.anosDecorridos, 0)}. Reaplicando a ${pct(e.taxaMercado, 0)} em vez de ${pct(e.taxaFunding, 0)}, falta R$ ${nf(quebra, 0)} a valor presente.`,
        ],
        resultado: `Na curva R$ ${nf(curva, 0)}; a mercado R$ ${nf(mercado, 0)}; break funding de R$ ${nf(quebra, 0)} (só o que cobre a captação, conforme o contrato).`,
      }
    })(),
    noApp: { texto: 'A taxa de mercado do prazo que falta vem da curva DI x pré, em Juros; para a TFB e a TLP do BNDES, veja a aba BNDES e, em Cenários, o assunto Indexadores (TR, TBF e TLP).', tab: 'juros' },
    teste: {
      pergunta: 'A taxa de mercado cai de 12% para 8% depois que você contratou a 15% fixos. Liquidar na curva ou a mercado custa mais?',
      resposta: 'A mercado custa mais. O seu contrato rende 15% e o mercado paga 8%, então o valor presente dos fluxos que faltam sobe. Na curva o saldo não muda com a taxa de mercado, por isso é o menor dos dois.',
    },
  },
  {
    id: 'cds',
    topico: 'Funding e risco',
    nome: 'CDS (Credit Default Swap)',
    frase: 'É um seguro contra calote de uma empresa ou de um país; o preço do seguro mede o risco percebido.',
    crianca: [
      'Você empresta dinheiro a um amigo e compra um seguro: se ele não pagar, a seguradora cobre. O CDS é esse seguro, só que negociado no mercado.',
      'Quanto mais caro o prêmio por ano, mais o mercado teme o calote. O CDS de 5 anos do Brasil é o termômetro de risco-país mais citado.',
    ],
    analogia: 'É o preço do seguro de carro: carro em bairro perigoso paga mais. País ou empresa mais arriscados pagam mais.',
    lacunas: [
      'Não é um título nem um juro; é um derivativo. Quem compra paga um prêmio periódico e recebe indenização se houver evento de crédito (calote ou reestruturação).',
      'O número cotado (ex.: 200) é o prêmio em pontos-base ao ano sobre o valor protegido, não um rendimento.',
      'Não é igual ao EMBI, que mede a diferença de rendimento de títulos soberanos em dólar contra os Treasuries. São parentes, mas medidas diferentes.',
    ],
    preciso: {
      texto: 'Contrato padronizado (ISDA). O comprador da proteção paga o spread acordado sobre o nocional, em trimestres, até o vencimento ou até o evento de crédito. 100 pontos-base equivalem a 1% ao ano:',
      formula: 'prêmio anual = nocional × spread (pb) ÷ 10.000',
    },
    exemplo: {
      titulo: 'Quanto custa proteger',
      passos: [
        `CDS de 5 anos cotado a ${EX_CDS.pb} pb. Valor protegido: ${money(EX_CDS.nocional, 'US$')}.`,
        `Prêmio = ${nf(EX_CDS.nocional, 0)} × ${EX_CDS.pb} ÷ 10.000 = US$ ${nf(premioCds(EX_CDS.nocional, EX_CDS.pb), 0)} por ano.`,
      ],
      resultado: `${EX_CDS.pb} pb equivalem a ${pct(EX_CDS.pb / 10000)} ao ano do valor protegido.`,
    },
    noApp: { texto: 'O app não exibe CDS: a cotação exige fonte de mercado paga. Como referência indireta, veja o cupom cambial e os Treasuries em Juros.', tab: 'juros' },
    teste: {
      pergunta: 'O CDS de 5 anos do Brasil passa de 150 para 250 pb. O que isso diz?',
      resposta: 'O mercado passou a ver mais risco de crédito no país: proteger o mesmo valor ficou 100 pb (1 ponto percentual ao ano) mais caro.',
    },
  },
  {
    id: 'debenture',
    topico: 'Operações de crédito',
    nome: 'Debênture',
    frase: 'É um título de dívida que uma empresa emite para pegar dinheiro emprestado direto de investidores, em vez de pegar no banco.',
    crianca: [
      'Uma empresa precisa de R$ 100 milhões para uma obra. Em vez de um banco emprestar tudo, ela divide a dívida em muitos pedaços iguais (as debêntures) e vende cada um a um investidor. Quem compra empresta; a empresa promete devolver o valor e pagar juros.',
      'As regras ficam na escritura de emissão: prazo, remuneração (por exemplo CDI + 2% ao ano, IPCA + 7% ou taxa prefixada), datas de pagamento e garantias. Um agente fiduciário confere, em nome dos investidores, se a empresa cumpre o combinado.',
    ],
    analogia: 'É uma vaquinha formal: a empresa pede um pouco a muita gente, assina o que promete pagar e alguém independente (o agente fiduciário) confere se ela cumpre.',
    lacunas: [
      'Não é ação: o debenturista é credor, não sócio. Se a empresa quebrar, os credores recebem antes dos acionistas (existe a debênture conversível em ações, mas é um caso à parte).',
      'Renda fixa não é risco zero: o risco é o de crédito da empresa emissora, e a debênture não tem a garantia do FGC. Quanto maior o risco, maior o spread que o mercado exige.',
      'Na remuneração pós-fixada o spread compõe com o CDI: 14% de CDI com 2% de spread dão cerca de 16,3% ao ano, não 16%.',
      'Debêntures incentivadas (de infraestrutura) têm benefício fiscal para a pessoa física; a regra tributária muda por lei, então confira a vigente.',
      'O mercado secundário costuma ter menos liquidez que o de ações ou de títulos públicos: vender antes do vencimento pode custar um desconto.',
    ],
    preciso: {
      texto: 'Título de crédito emitido por sociedade por ações, em série, com os termos definidos na escritura de emissão. O preço unitário (PU) é o valor nominal atualizado mais a remuneração acumulada. Na remuneração pós-fixada, o spread compõe com o CDI do período:',
      formula: 'taxa efetiva = (1 + CDI) × (1 + spread) − 1   ·   juros = principal × [(1 + taxa)^t − 1]',
    },
    exemplo: (() => {
      const e = EX_DEB
      const taxa = taxaCdiMaisSpread(e.cdi, e.spread)
      return {
        titulo: `Investidor compra ${money(e.principal, 'R$')} em debêntures CDI + ${pct(e.spread, 0)}`,
        passos: [
          `CDI de ${pct(e.cdi, 0)} ao ano, mantido ao longo do ano (simplificação). Spread de ${pct(e.spread, 0)}.`,
          `Taxa efetiva = ${nf(1 + e.cdi, 2)} × ${nf(1 + e.spread, 2)} − 1 = ${pct(taxa)} ao ano (e não ${pct(e.cdi + e.spread, 0)}).`,
          `Juros em 1 ano = ${nf(e.principal, 0)} × ${pct(taxa)} = R$ ${nf(jurosNoPrazo({ principal: e.principal, taxaAnual: taxa, fracaoAno: 1 }), 0)}.`,
        ],
        resultado: `R$ ${nf(jurosNoPrazo({ principal: e.principal, taxaAnual: taxa, fracaoAno: 1 }), 0)} de juros em um ano, ${pct(taxa)} ao ano, antes de impostos e do risco de crédito.`,
      }
    })(),
    noApp: { texto: 'O app não traz preços nem emissões de debêntures. O CDI, referência da remuneração pós-fixada, está em Juros.', tab: 'juros' },
    teste: {
      pergunta: 'Uma debênture paga CDI + 2% ao ano e o CDI sobe de 14% para 15%. O que acontece com a remuneração?',
      resposta: `Sobe junto: de cerca de ${pct(taxaCdiMaisSpread(0.14, 0.02), 1)} para ${pct(taxaCdiMaisSpread(0.15, 0.02), 1)} ao ano. O spread de 2% continua o mesmo; só a parte do CDI muda.`,
    },
  },
  {
    id: 'nota-comercial',
    revisadoEm: '2026-11-05',
    fontes: [{ nome: 'B3 — Nota Comercial', url: 'https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-fixa/nota-comercial.htm' }, { nome: 'Lei 14.195/2021 — arts. 45 a 51', url: 'https://www2.camara.leg.br/legin/fed/lei/2021/lei-14195-26-agosto-2021-791684-normaatualizada-pl.html' }],
    topico: 'Operações de crédito',
    nome: 'Nota comercial',
    frase: 'É um título de dívida escritural que a empresa emite para captar recursos; prazo e remuneração são definidos na emissão.',
    crianca: [
      'A empresa pode emitir notas comerciais para obter recursos de investidores, inclusive para capital de giro ou uma ponte até outra captação. Esses usos não tornam o curto prazo obrigatório.',
      'Como na debênture, há valor, prazo, data de pagamento e remuneração definidos, que podem incluir CDI + spread. A estrutura, as exigências e o custo dependem da emissão e da forma de oferta; não são sempre menores.',
    ],
    analogia: 'É uma promessa de pagamento registrada eletronicamente: a empresa recebe recursos e combina valor, vencimento e remuneração com os investidores.',
    lacunas: [
      'Um prazo menor não elimina o risco de crédito do emissor; nota comercial não tem garantia do FGC.',
      'Quando a emissão financia uma necessidade mais longa que seu vencimento, há risco de refinanciamento se o mercado fechar.',
      'Nota comercial e debênture são instrumentos distintos de dívida. Compare as condições da emissão, as garantias, a oferta e os custos; não apenas a duração.',
      'Quem pode emitir, prazos e forma de oferta vêm da lei e da regulamentação da CVM, e já mudaram: confira a norma vigente antes de decidir.',
    ],
    preciso: {
      texto: 'Título de crédito escritural que representa promessa de pagamento em dinheiro, conforme os arts. 45 a 51 da Lei 14.195/2021. Prazo e remuneração constam das condições da emissão. Neste exemplo pós-fixado simplificado, t é uma fração do ano pela convenção CDI de dias úteis ÷ 252:',
      formula: 'juros = principal × [(1 + taxa)^t − 1]   ·   t = dias úteis ÷ 252',
    },
    exemplo: (() => {
      const e = EX_NC
      const taxa = taxaCdiMaisSpread(e.cdi, e.spread)
      const t = e.diasUteis / 252
      const juros = jurosNoPrazo({ principal: e.principal, taxaAnual: taxa, fracaoAno: t })
      return {
        titulo: `Capital de giro de ${money(e.principal, 'R$')} por ${e.diasUteis} dias úteis`,
        passos: [
          `Remuneração CDI + ${pct(e.spread, 0)}, com CDI de ${pct(e.cdi, 0)}: taxa efetiva = ${nf(1 + e.cdi, 2)} × ${nf(1 + e.spread, 2)} − 1 = ${pct(taxa)} ao ano.`,
          `Prazo: ${e.diasUteis} ÷ 252 = ${nf(t, 2)} ano.`,
          `Juros = ${nf(e.principal, 0)} × [(1 + ${pct(taxa)})^${nf(t, 2)} − 1] = R$ ${nf(juros, 0)}, ou ${pct(juros / e.principal)} sobre o valor captado.`,
        ],
        resultado: `Em meio ano, a empresa paga R$ ${nf(juros, 0)} de juros (${pct(juros / e.principal)} do valor) além de devolver o principal.`,
      }
    })(),
    noApp: { texto: 'O app não traz emissões de notas comerciais. O CDI, referência da remuneração pós-fixada, está em Juros.', tab: 'juros' },
    teste: {
      pergunta: 'Por que uma empresa pode preferir uma nota comercial a uma debênture para cobrir uma necessidade de 6 meses?',
      resposta: 'Porque a emissão é mais simples e barata e o prazo é curto: não compensa montar a estrutura de uma debênture de longo prazo para uma necessidade passageira.',
    },
  },
  {
    id: 'fidc',
    topico: 'Operações de crédito',
    nome: 'FIDC (Fundo de Investimento em Direitos Creditórios)',
    frase: 'É um fundo que compra recebíveis (valores que empresas têm a receber) e financia a compra vendendo cotas a investidores.',
    crianca: [
      'Uma loja vende a prazo e só vai receber daqui a 60 dias, mas precisa do dinheiro hoje. Ela vende esses recebíveis ao FIDC com desconto. O fundo paga hoje e recebe dos clientes no vencimento.',
      'Para ter o dinheiro, o fundo vende cotas a investidores, em camadas: a cota sênior é paga primeiro; a subordinada (muitas vezes ficando com o próprio vendedor dos recebíveis) absorve as primeiras perdas e protege a sênior.',
    ],
    analogia: 'É um prédio com andares: a perda entra pelo porão (cota subordinada) e só sobe ao andar de cima (sênior) se o porão encher.',
    lacunas: [
      'O investidor sênior depende da qualidade da carteira de recebíveis e do tamanho da subordinação, não só de quem vendeu os recebíveis. Mas inadimplência acima da subordinação atinge a sênior.',
      'Mais subordinação protege mais a sênior, mas obriga o cedente a deixar mais capital no fundo; menos subordinação financia mais com dinheiro de terceiros e é mais arriscada.',
      'Não é coberto pelo FGC. A liquidez das cotas costuma ser limitada, com amortização e resgate previstos no regulamento do fundo.',
      'Quem pode investir (público geral ou só profissional) e as regras da carteira vêm da regulamentação da CVM e do regulamento de cada fundo: confira os dois.',
    ],
    preciso: {
      texto: 'Fundo cujo ativo são direitos creditórios (duplicatas, recebíveis de cartão, financiamentos, créditos corporativos etc.) e cujo passivo são cotas seniores, eventualmente mezanino, e subordinadas. A perda da carteira é absorvida primeiro pela cota subordinada. A proteção da sênior é medida pelo índice de subordinação:',
      formula: 'subordinação = subordinadas ÷ (sênior + subordinadas)   ·   perda na sênior = máx(0, perda − subordinadas)',
    },
    exemplo: (() => {
      const e = EX_FIDC
      const sub = indiceSubordinacao(e)
      const [a, b] = e.perdas.map((perda) => ({ perda, ...perdaNasCotas({ ...e, perda }) }))
      return {
        titulo: `FIDC com carteira de ${money(e.senior + e.subordinada, 'R$')}`,
        passos: [
          `Cotas: sênior ${money(e.senior, 'R$')} e subordinada ${money(e.subordinada, 'R$')}. Subordinação = ${nf(e.subordinada, 0)} ÷ ${nf(e.senior + e.subordinada, 0)} = ${pct(sub, 0)}.`,
          `Perda de ${money(a.perda, 'R$')} por inadimplência: a subordinada absorve tudo (${money(a.subordinada, 'R$')}) e fica com ${money(e.subordinada - a.subordinada, 'R$')}; a sênior perde ${money(a.senior, 'R$')}.`,
          `Perda de ${money(b.perda, 'R$')}: a subordinada zera (${money(b.subordinada, 'R$')}) e a sênior perde ${money(b.senior, 'R$')}.`,
        ],
        resultado: `Com ${pct(sub, 0)} de subordinação, a sênior só sofre perda quando a inadimplência passa de ${pct(sub, 0)} da carteira.`,
      }
    })(),
    noApp: { texto: 'O app não traz cotas de FIDC. Como referência de custo do crédito, veja o CDI e a curva DI em Juros.', tab: 'juros' },
    teste: {
      pergunta: 'Um FIDC tem 25% de subordinação e a carteira perde 30% por inadimplência. A cota sênior perde?',
      resposta: 'Perde, sim. A subordinada (25% da carteira) absorve os primeiros 25 pontos e os 5% restantes atingem a sênior.',
    },
  },
  {
    id: 'cri',
    topico: 'Operações de crédito',
    nome: 'CRI (Certificado de Recebíveis Imobiliários)',
    frase: 'É um título que transforma valores a receber do setor imobiliário (aluguéis, parcelas de imóveis, dívidas de incorporadoras) em investimento vendido a investidores.',
    crianca: [
      'Uma incorporadora vai receber as parcelas dos apartamentos que vendeu ao longo de vários anos, mas quer o dinheiro agora para a próxima obra. Uma securitizadora compra esses recebíveis, empacota e emite o CRI; quem compra o CRI passa a receber, aos poucos, o que os compradores dos apartamentos pagam.',
      'Os recebíveis (o lastro) ficam num patrimônio separado, só para pagar os investidores daquele CRI: se a securitizadora quebrar, o lastro não se mistura com as dívidas dela. A remuneração costuma ser IPCA + uma taxa, CDI + spread ou prefixada, e um agente fiduciário fiscaliza em nome dos investidores.',
    ],
    analogia: 'É como comprar o direito de receber os aluguéis de um prédio: você não é dono do prédio, mas recebe o que os inquilinos pagam, e quem organiza a cobrança guarda esse dinheiro num cofre separado do dele.',
    lacunas: [
      'O risco é de quem paga o lastro (a incorporadora, a empresa ou os mutuários) e das garantias, não da securitizadora. Não há FGC: se o devedor não pagar e as garantias não cobrirem, o investidor perde.',
      'CRI “corporativo” depende de uma só empresa (risco concentrado); CRI “pulverizado” depende de muitos compradores de imóveis (risco diluído, mas com inadimplência e pré-pagamentos).',
      'Para pessoa física, os rendimentos são isentos de IR pela regra vigente; por isso a taxa parece menor que a de um CDB. Já houve propostas de mudar essa isenção, e empresas pagam IR: confira a regra em vigor.',
      'Desde 2024, regras do Conselho Monetário Nacional limitam o lastro: dívida de empresa sem ligação real com o setor imobiliário não serve mais de lastro de CRI.',
      'A liquidez antes do vencimento é baixa e o preço oscila com a taxa de mercado: um CRI IPCA + 7% vale menos se o mercado passar a exigir IPCA + 8% para o mesmo risco.',
    ],
    preciso: {
      texto: 'Título de crédito emitido por companhia securitizadora (Lei 14.430/2022), lastreado em direitos creditórios imobiliários, com regime fiduciário e patrimônio separado. Remuneração usual: IPCA mais uma taxa real. Para comparar com um título tributado, divide-se a taxa isenta por (1 − IR):',
      formula: 'taxa = (1 + IPCA) × (1 + taxa real) − 1   ·   equivalente tributado = taxa isenta ÷ (1 − IR)',
    },
    exemplo: (() => {
      const e = EX_CRI
      const taxa = taxaCdiMaisSpread(e.ipca, e.real)
      const eq = equivalenteTributado(taxa, e.ir)
      return {
        titulo: `Pessoa física aplica ${money(e.principal, 'R$')} num CRI IPCA + ${pct(e.real, 0)}`,
        passos: [
          `Com IPCA de ${pct(e.ipca, 1)} no ano: taxa = ${nf(1 + e.ipca, 3)} × ${nf(1 + e.real, 2)} − 1 = ${pct(taxa)} ao ano, isenta de IR.`,
          `Rendimento em 1 ano = ${nf(e.principal, 0)} × ${pct(taxa)} = R$ ${nf(e.principal * taxa, 0)}, sem desconto de imposto.`,
          `Um CDB com IR de ${pct(e.ir, 0)} precisaria pagar ${pct(taxa)} ÷ ${nf(1 - e.ir, 2)} = ${pct(eq)} ao ano para entregar o mesmo líquido.`,
        ],
        resultado: `${pct(taxa)} isentos equivalem a ${pct(eq)} num título tributado a ${pct(e.ir, 0)}, antes do risco de crédito do lastro.`,
      }
    })(),
    noApp: { texto: 'O app não traz emissões nem preços de CRI. O IPCA, que corrige a maioria deles, está em Cenários › Inflação.', tab: 'cenarios', view: 'inflacao' },
    teste: {
      pergunta: 'Para pessoa física, um CRI isento paga 11,8% ao ano e um CDB com IR de 15% paga 13,5%. Qual rende mais, líquido de imposto?',
      resposta: 'O CRI. O CDB entrega 13,5% × 0,85 = 11,5% líquidos, abaixo dos 11,8% do CRI; a comparação ainda precisa pesar o risco de crédito, maior no CRI e sem FGC.',
    },
  },
  {
    id: 'cra',
    topico: 'Operações de crédito',
    nome: 'CRA (Certificado de Recebíveis do Agronegócio)',
    frase: 'É o irmão do CRI para o agronegócio: transforma valores a receber de produtores, cooperativas, tradings e indústrias do agro em investimento vendido a investidores.',
    crianca: [
      'Uma trading financia insumos para produtores e vai receber na colheita, daqui a meses. Para ter o dinheiro antes, ela cede esses recebíveis a uma securitizadora, que emite o CRA; quem compra o CRA recebe quando os produtores pagarem.',
      'A estrutura é a do CRI: lastro em patrimônio separado, agente fiduciário e remuneração em CDI + spread, IPCA + taxa ou prefixada. O lastro é do agro: CPR (Cédula de Produto Rural), CDCA, duplicatas de venda de insumos, contratos de fornecimento.',
    ],
    analogia: 'É comprar hoje uma parte da conta que a safra vai pagar amanhã: se a colheita e os preços vierem bons, a conta se paga; se não vierem, entram as garantias.',
    lacunas: [
      'O risco é do agro que está no lastro: clima, quebra de safra, preço das commodities e câmbio afetam a capacidade de pagar. Não há FGC.',
      'Muitas receitas do agro são em dólar (soja, milho, café cotados lá fora): câmbio e preço internacional pesam no risco, mesmo com o CRA pago em reais.',
      'Isenção de IR para pessoa física pela regra vigente, como no CRI, e a mesma ressalva: a regra pode mudar e empresas pagam IR.',
      'Desde 2024 o lastro precisa ter ligação real com o agronegócio; dívida de empresa de fora do setor não serve mais.',
      'Pode haver séries sênior e subordinada, como num FIDC: a subordinada absorve as primeiras perdas.',
    ],
    preciso: {
      texto: 'Título de crédito emitido por companhia securitizadora (Leis 11.076/2004 e 14.430/2022), lastreado em direitos creditórios do agronegócio, com regime fiduciário e patrimônio separado. Na remuneração pós-fixada, o spread compõe com o CDI; a comparação com título tributado segue a do CRI:',
      formula: 'taxa = (1 + CDI) × (1 + spread) − 1   ·   equivalente tributado = taxa isenta ÷ (1 − IR)',
    },
    exemplo: (() => {
      const e = EX_CRA
      const taxa = taxaCdiMaisSpread(e.cdi, e.spread)
      const eq = equivalenteTributado(taxa, e.ir)
      return {
        titulo: `Pessoa física aplica ${money(e.principal, 'R$')} num CRA CDI + ${pct(e.spread, 1)}`,
        passos: [
          `CDI de ${pct(e.cdi, 0)}: taxa = ${nf(1 + e.cdi, 2)} × ${nf(1 + e.spread, 3)} − 1 = ${pct(taxa)} ao ano, isenta de IR.`,
          `Equivalente num título tributado a ${pct(e.ir, 0)}: ${pct(taxa)} ÷ ${nf(1 - e.ir, 2)} = ${pct(eq)} ao ano.`,
          `Em percentual do CDI: ${pct(eq)} ÷ ${pct(e.cdi, 0)} = ${nf((eq / e.cdi) * 100, 0)}% do CDI.`,
        ],
        resultado: `O CRA CDI + ${pct(e.spread, 1)} isento equivale a um CDB de cerca de ${nf((eq / e.cdi) * 100, 0)}% do CDI tributado a ${pct(e.ir, 0)}, antes do risco do agro.`,
      }
    })(),
    noApp: { texto: 'O app não traz emissões de CRA. Soja, milho e o IC-Br agropecuário, que mexem com quem está no lastro, estão em Cenários › Commodities.', tab: 'cenarios', view: 'commodities' },
    teste: {
      pergunta: 'A safra de quem está no lastro de um CRA quebra e a dívida não é paga. Quem absorve a perda?',
      resposta: 'Primeiro as garantias (penhor da safra, alienação fiduciária, aval) e, se houver, a série subordinada; o que passar disso atinge os investidores. A securitizadora não cobre a perda e não há FGC.',
    },
  },
  {
    id: 'facil',
    topico: 'Operações de crédito',
    nome: 'Regime FÁCIL (CVM)',
    frase: 'É o regime da CVM que simplifica, para companhias de menor porte, o registro e as ofertas de ações e títulos de dívida no mercado de capitais.',
    crianca: [
      'Abrir capital ou emitir uma debênture sempre foi caro e trabalhoso para empresas médias: documentos extensos, prospecto, formulário de referência e custos com assessores. O FÁCIL (criado pelas Resoluções CVM 231 e 232, de 2025) reduz essa papelada para quem é companhia de menor porte.',
      'A régua é a receita: sociedade anônima com receita bruta anual consolidada abaixo de R$ 500 milhões. Ela usa um formulário único e mais curto no lugar do formulário de referência, do prospecto e da lâmina, e tem modalidades de oferta mais simples. Assim, pode captar com investidores (ações, debêntures, notas comerciais) em vez de depender só do banco.',
    ],
    analogia: 'É uma porta lateral, mais estreita, para entrar no mesmo prédio do mercado de capitais: menos burocracia na entrada, mas as regras do prédio continuam valendo.',
    lacunas: [
      'Não é subsídio nem garantia: o investidor continua assumindo o risco de crédito ou de negócio da empresa, e com menos informação padronizada que numa companhia grande.',
      'Passar de R$ 500 milhões de receita não tira a empresa do regime na hora: há um prazo de transição (um ano após a notificação) para evitar entra-e-sai por oscilação de receita.',
      'Limites de valor por oferta, público que pode investir em cada modalidade e datas de vigência estão nas Resoluções CVM 231 e 232 e em ajustes posteriores; as fontes divergem em detalhes, então confira o texto vigente na CVM.',
      'Facilitar a emissão não barateia o dinheiro por si só: o custo final continua sendo o CDI (ou IPCA) mais o spread que os investidores exigirem pelo risco da empresa.',
    ],
    preciso: {
      texto: 'Regime de facilitação de acesso a capital para a companhia de menor porte (CMP), instituído pelas Resoluções CVM 231 e 232/2025: registro simplificado, formulário FÁCIL no lugar de formulário de referência, prospecto e lâmina, e modalidades próprias de oferta pública. Enquadramento pela receita, e custo da captação pela taxa composta:',
      formula: 'CMP: receita bruta anual consolidada < R$ 500 milhões   ·   custo = (1 + CDI) × (1 + spread) − 1',
    },
    exemplo: (() => {
      const e = EX_FACIL
      const mercado = taxaCdiMaisSpread(e.cdi, e.spreadMercado), banco = taxaCdiMaisSpread(e.cdi, e.spreadBanco)
      const economia = e.valor * (banco - mercado)
      return {
        titulo: `Indústria com receita de ${money(e.receita, 'R$')} quer captar ${money(e.valor, 'R$')} (hipotético)`,
        passos: [
          `Receita de ${money(e.receita, 'R$')} < ${money(e.limite, 'R$')}: enquadra como companhia de menor porte e pode usar o FÁCIL.`,
          `Debênture pelo FÁCIL a CDI + ${pct(e.spreadMercado, 0)}: ${nf(1 + e.cdi, 2)} × ${nf(1 + e.spreadMercado, 2)} − 1 = ${pct(mercado)} ao ano. Empréstimo bancário a CDI + ${pct(e.spreadBanco, 0)}: ${pct(banco)} ao ano.`,
          `Diferença no ano: ${nf(e.valor, 0)} × (${pct(banco)} − ${pct(mercado)}) = R$ ${nf(economia, 0)}.`,
        ],
        resultado: `Se o mercado aceitar CDI + ${pct(e.spreadMercado, 0)}, a empresa economiza cerca de R$ ${nf(economia, 0)} por ano frente ao banco, antes dos custos da emissão.`,
      }
    })(),
    noApp: { texto: 'O app não traz emissões pelo FÁCIL. O CDI, base do custo de uma debênture ou nota comercial, está em Juros.', tab: 'juros' },
    teste: {
      pergunta: 'Uma S.A. faturou R$ 480 milhões e quer emitir debêntures. Pode usar o FÁCIL? E se no ano seguinte faturar R$ 550 milhões?',
      resposta: 'Pode, porque está abaixo de R$ 500 milhões. Se passar do limite, não sai na hora: tem o prazo de transição (um ano após a notificação) antes de perder a condição de companhia de menor porte.',
    },
  },
  {
    id: 'drawback',
    topico: 'Comércio exterior',
    nome: 'Drawback',
    frase: 'É o regime aduaneiro que suspende ou isenta os tributos sobre insumos comprados para fabricar produtos que serão exportados.',
    crianca: [
      'Uma fábrica importa aço e componentes para montar máquinas que vai vender no exterior. Sem drawback, ela pagaria imposto de importação, IPI, PIS e Cofins sobre esses insumos e só depois tentaria recuperar. Com o drawback suspensão, esses tributos ficam suspensos, desde que ela exporte o produto dentro do prazo do ato concessório.',
      'Há também o drawback isenção (reposição de estoque): quem já exportou usando insumos tributados pode comprar a mesma quantidade de novo, sem tributos. O regime é concedido pela Secex no Siscomex e vale também para insumos comprados no Brasil (drawback integrado).',
    ],
    analogia: 'É uma conta de passagem: o insumo entra sem pagar pedágio porque vai sair do país dentro do produto; se não sair, o pedágio é cobrado com juros e multa.',
    lacunas: [
      'Não é isenção incondicional: se a exportação não acontecer no prazo, os tributos suspensos são devidos com acréscimos legais.',
      'O ganho principal é de caixa: a empresa deixa de adiantar tributos que só recuperaria depois, o que reduz o capital de giro preso e a necessidade de funding.',
      'Prazos: na suspensão, o ato concessório vale em regra 1 ano, prorrogável uma vez por igual período (bens de longo ciclo de fabricação podem ter prazo maior). Regras e prazos mudam por portaria da Secex; confira a vigente.',
      'Com a reforma tributária, a LC 214/2025 prevê a suspensão de IBS e CBS no drawback suspensão; a aplicação às outras modalidades segue regras próprias da transição.',
      'O ICMS segue regras dos estados (convênios do Confaz) e pode não acompanhar a suspensão federal.',
    ],
    preciso: {
      texto: 'Regime aduaneiro especial (Decreto-Lei 37/1966) nas modalidades suspensão, isenção e restituição, com ato concessório da Secex no Siscomex e comprovação pela exportação. O alívio de caixa na suspensão é o tributo que deixa de ser pago na entrada do insumo:',
      formula: 'insumo em R$ = valor em US$ × câmbio   ·   tributo suspenso = insumo em R$ × carga tributária',
    },
    exemplo: (() => {
      const e = EX_DRAWBACK
      const reais = e.usd * e.cambio, suspenso = reais * e.carga
      return {
        titulo: `Fabricante importa ${money(e.usd, 'US$')} em insumos para exportar (carga hipotética de ${pct(e.carga, 0)})`,
        passos: [
          `Insumo em reais: ${nf(e.usd, 0)} × ${nf(e.cambio, 2)} = R$ ${nf(reais, 0)}.`,
          `Sem drawback, a empresa adianta tributos de cerca de ${pct(e.carga, 0)}: R$ ${nf(suspenso, 0)} na importação.`,
          `Com drawback suspensão, esses R$ ${nf(suspenso, 0)} ficam suspensos; viram devidos só se a exportação não for comprovada no prazo.`,
        ],
        resultado: `R$ ${nf(suspenso, 0)} a menos de caixa preso em tributos, desde que a exportação aconteça no prazo do ato concessório.`,
      }
    })(),
    noApp: { texto: 'O câmbio está no Mercado; preços internacionais de insumos (metais, petróleo, grãos) estão em Cenários › Commodities.', tab: 'cenarios', view: 'commodities' },
    teste: {
      pergunta: 'Uma empresa usou drawback suspensão, mas a venda ao exterior foi cancelada e ela vendeu o produto no Brasil. O que acontece com os tributos dos insumos?',
      resposta: 'Ficam devidos: sem exportação comprovada, a empresa paga os tributos suspensos com os acréscimos legais (juros e, conforme o caso, multa).',
    },
  },
  CONCEITO_MAQUILA,
  CONCEITO_IMPOSTO_SELETIVO,
  {
    id: 'inflacao',
    topico: 'Inflação',
    nome: 'Inflação (IPCA)',
    frase: 'É o aumento generalizado e contínuo dos preços: o mesmo dinheiro compra menos com o tempo.',
    crianca: [
      'Se o lanche custava R$ 10 e hoje custa R$ 10,50, o preço subiu 5%. Se quase tudo sobe assim, mês após mês, há inflação, e o seu dinheiro perde poder de compra.',
      'No Brasil, a inflação oficial é o IPCA, medido pelo IBGE: acompanha o preço de uma cesta que representa o consumo das famílias (alimentos, transporte, moradia etc.). O Banco Central persegue uma meta para ele, hoje de 3,0% ao ano, com tolerância de 1,5 ponto percentual para cima ou para baixo.',
      'Para segurar a inflação, o Banco Central sobe a Selic: juro maior esfria o consumo e o crédito. Por isso Selic, curva de juros, câmbio e inflação andam juntos.',
    ],
    analogia: 'É o troco que encolhe: com os mesmos R$ 100 você compra hoje um pouco menos do que comprava no ano passado.',
    lacunas: [
      'Inflação é a variação dos preços, não o nível: inflação em queda não significa que os preços baixaram, só que sobem mais devagar. Preço só cai com deflação (inflação negativa).',
      'O acumulado em 12 meses é composto, não a soma dos meses: doze meses de 0,4% dão cerca de 4,9%, não 4,8%.',
      'Há mais de um índice: IPCA (oficial, usado na meta), INPC (famílias de menor renda) e IGP-M (FGV, usado em muitos reajustes de aluguel). Medem cestas diferentes e podem divergir.',
      'Juro nominal não é juro real: o que sobra para quem aplica é o juro descontada a inflação.',
    ],
    preciso: {
      texto: 'A inflação acumulada em n meses é o produto dos fatores mensais menos 1. O juro real, pela equação de Fisher, desconta a inflação do juro nominal:',
      formula: 'acumulado = Π (1 + mês) − 1   ·   juro real = (1 + nominal) ÷ (1 + inflação) − 1',
    },
    exemplo: (() => {
      const e = EX_INFL
      const acc = inflacaoAcumulada(Array(e.meses).fill(e.mensal))
      return {
        titulo: `${e.meses} meses de inflação a ${pct(e.mensal, 1)} ao mês`,
        passos: [
          `Soma simples (errada): ${e.meses} × ${pct(e.mensal, 1)} = ${pct(e.meses * e.mensal, 1)}.`,
          `Composto: (1 + ${nf(e.mensal, 3)})^${e.meses} − 1 = ${pct(acc)} em 12 meses.`,
          `Com a Selic a ${pct(e.selic)} ao ano, o juro real = ${nf(1 + e.selic, 3)} ÷ ${nf(1 + acc, 4)} − 1 = ${pct(juroReal(e.selic, acc))} ao ano.`,
        ],
        resultado: `Inflação de ${pct(acc)} em 12 meses e juro real de ${pct(juroReal(e.selic, acc))} ao ano sobre a Selic de ${pct(e.selic)}.`,
      }
    })(),
    noApp: { texto: 'O IPCA oficial, com histórico e o quadro “o que pesa”, está em Cenários › Inflação.', tab: 'cenarios', view: 'inflacao' },
    teste: {
      pergunta: 'A inflação em 12 meses cai de 6% para 4%. Os preços caíram?',
      resposta: 'Não. Eles seguem subindo, mas a um ritmo menor: 4% ao ano em vez de 6%. Preço só cai quando há deflação, isto é, inflação negativa.',
    },
  },
  {
    id: 'focus',
    topico: 'Inflação',
    nome: 'Boletim Focus',
    frase: 'É a pesquisa semanal do Banco Central com o que o mercado espera para Selic, inflação, PIB e câmbio: a bússola das expectativas.',
    crianca: [
      'Toda semana o Banco Central pergunta a mais de cem bancos, gestoras e consultorias quanto elas projetam para a Selic, o IPCA, o PIB e o dólar no fim deste ano e dos próximos. Publica na segunda-feira, às 8h25, a mediana (o valor do meio) e também o mínimo, o máximo e quantas instituições responderam.',
      'O boletim importa porque o Banco Central mira a inflação esperada, não só a passada: se o Focus mostra o IPCA subindo acima da meta, cresce a chance de Selic mais alta por mais tempo. Para quem empresta ou capta, a mediana da Selic no fim do ano é a melhor pista pública de para onde vai o custo do dinheiro.',
      'A coleta fecha na sexta; por isso o painel chama o boletim pela data de coleta. Em semana com feriado na segunda, a divulgação passa para a terça.',
    ],
    analogia: 'É a previsão do tempo do mercado: ninguém garante que vai chover, mas quando cem meteorologistas apontam chuva, você leva o guarda-chuva (e o banco precifica o guarda-chuva).',
    lacunas: [
      'Mediana não é consenso nem garantia: metade das casas projeta acima e metade abaixo. O intervalo entre mínimo e máximo diz quanta discordância há.',
      'É expectativa de fim de período (dezembro de cada ano), não a média do ano: a Selic de dezembro de 2026 pode ser bem diferente da média de 2026. No câmbio, o Focus traz a média do mês de dezembro.',
      'O Focus mede o que o mercado pensa, e o mercado erra: compare a projeção com o que a curva DI já precifica e com o que o Copom escreve no comunicado.',
      'Revisões semanais pequenas são ruído; o que importa é a direção ao longo de várias semanas (por isso o painel mostra o histórico de 52 semanas).',
    ],
    preciso: {
      texto: 'Pesquisa de expectativas de mercado do Banco Central (Sistema de Expectativas), com projeções anuais e mensais para inflação (IPCA, IGP-M), Selic, PIB, câmbio, balança comercial e contas públicas, coletadas até sexta-feira e divulgadas na segunda. O painel usa a mediana das projeções anuais (base de cálculo 0, todas as respostas) de Selic, IPCA, PIB e câmbio, pela API Olinda do Banco Central.',
      formula: 'juro real esperado = (1 + Selic esperada) ÷ (1 + IPCA esperado) − 1   ·   mediana = valor do meio das projeções',
    },
    exemplo: (() => {
      const e = EX_FOCUS
      const real = juroReal(e.selic, e.ipca)
      const economia = e.emprestimo * (e.selicAnterior - e.selic)
      return {
        titulo: `Focus projeta Selic de ${pct(e.selic)} e IPCA de ${pct(e.ipca)} para o fim do ano (hipotético)`,
        passos: [
          `Juro real esperado: (1 + ${pct(e.selic)}) ÷ (1 + ${pct(e.ipca)}) − 1 = ${pct(real)} ao ano: ainda alto, o que segura consumo e crédito.`,
          `Na semana anterior a mediana era ${pct(e.selicAnterior)}: o mercado passou a esperar 0,25 ponto a menos de Selic, sinal de ciclo de corte mais rápido.`,
          `Num empréstimo pós-fixado de ${money(e.emprestimo, 'R$')}, cada 0,25 ponto a menos de Selic por um ano são cerca de R$ ${nf(economia, 0)} a menos de juros.`,
        ],
        resultado: `A leitura para a conversa: o mercado espera juro real de ${pct(real)} e um ciclo de corte um pouco mais rápido; o cliente pode preferir pós-fixado a travar uma taxa prefixada alta agora.`,
      }
    })(),
    noApp: { texto: 'A mediana do Focus para Selic, IPCA, PIB e dólar está em Cenários › Projeções, ao lado das projeções dos bancos, com o histórico de 52 semanas em gráfico abaixo da tabela.', tab: 'cenarios', view: 'projecoes' },
    teste: {
      pergunta: 'O Focus desta semana mostra a mediana do IPCA de 2026 subindo de 4,3% para 4,6%, acima da meta de 3%. O que isso sugere para a Selic e para um cliente que vai captar?',
      resposta: 'Inflação esperada subindo afasta cortes de juros: a Selic tende a ficar alta por mais tempo. Para quem vai captar, o pós-fixado fica mais caro à frente; vale comparar com uma taxa prefixada antes que a curva DI incorpore a piora.',
    },
  },
  {
    id: 'commodities-e-cambio',
    topico: 'Commodities',
    nome: 'Commodities e câmbio',
    frase: 'As commodities são cotadas em dólar no mundo todo; quem produz ou compra em reais sente o preço pelo dólar multiplicado pelo câmbio.',
    crianca: [
      'Soja, petróleo, minério e café têm um preço de referência mundial, quase sempre em dólar. Mas o produtor brasileiro paga as contas e recebe em reais. Se o dólar sobe, os mesmos dólares valem mais reais.',
      'Por isso a soja pode ficar parada em dólar e mesmo assim render mais ao produtor: foi o dólar que subiu. O inverso também vale: com o real forte, o ganho em reais encolhe, ainda que o preço lá fora esteja estável.',
      'Dos dois lados do negócio: o exportador torce por dólar alto; o importador de fertilizante e de diesel, por dólar baixo. É por isso que câmbio e commodities andam sempre juntos nas conversas.',
    ],
    analogia: 'É como vender algo em moeda estrangeira numa viagem: o preço da etiqueta não mudou, mas o troco em reais depende da cotação do dia.',
    lacunas: [
      'O preço em reais mistura duas variáveis: a commodity em dólar e o câmbio. Uma pode subir enquanto a outra anula o efeito; olhe as duas antes de concluir.',
      'A referência internacional não é o preço que o produtor recebe: há prêmio de porto, frete, impostos e diferença de qualidade e de região.',
      'Fertilizantes e combustíveis são insumos importados: dólar alto encarece o custo do agro ao mesmo tempo em que valoriza a receita.',
    ],
    preciso: {
      texto: 'A conversão de uma commodity cotada em dólar por tonelada para real por saca de 60 kg usa o câmbio do período. Um mês de câmbio médio costuma ser usado para séries mensais:',
      formula: 'R$/saca = US$/tonelada × 0,06 × câmbio (R$/US$)',
    },
    exemplo: (() => {
      const e = EX_SACA
      const a = sacaEmReais(e.usd, e.antes), b = sacaEmReais(e.usd, e.depois)
      return {
        titulo: `Soja a US$ ${nf(e.usd, 0)}/t com o dólar a R$ ${nf(e.antes, 2)} e a R$ ${nf(e.depois, 2)}`,
        passos: [
          `Com o dólar a R$ ${nf(e.antes, 2)}: ${nf(e.usd, 0)} × 0,06 × ${nf(e.antes, 2)} = R$ ${nf(a, 2)} por saca.`,
          `Com o dólar a R$ ${nf(e.depois, 2)}: ${nf(e.usd, 0)} × 0,06 × ${nf(e.depois, 2)} = R$ ${nf(b, 2)} por saca.`,
          `O preço em dólar não mudou; a saca subiu ${pct(b / a - 1, 1)} em reais só pelo câmbio.`,
        ],
        resultado: `Mesma soja em dólar, ${pct(b / a - 1, 1)} a mais em reais: o câmbio responde sozinho por toda a diferença.`,
      }
    })(),
    noApp: { texto: 'A soja em dólar e a estimativa em R$/saca (dólar médio do mês) estão em Cenários › Commodities.', tab: 'cenarios', view: 'commodities' },
    teste: {
      pergunta: 'A soja cai 5% em dólar e o dólar sobe 10% no mesmo período. Em reais, a saca sobe ou cai?',
      resposta: 'Sobe, cerca de 4,5%: 0,95 × 1,10 = 1,045. O efeito do câmbio mais que compensou a queda lá fora.',
    },
  },
  {
    id: 'ic-br',
    revisadoEm: '2026-11-05',
    fontes: [{ nome: 'BCB — Revisão metodológica do IC-Br, dezembro de 2017', url: 'https://www.bcb.gov.br/content/ri/relatorioinflacao/201712/RELINF201712-ri201712b3p.pdf' }],
    topico: 'Commodities',
    nome: 'IC-Br (índice de commodities)',
    frase: 'É o índice do Banco Central que resume, em reais, o preço das commodities que mais pesam na economia brasileira.',
    crianca: [
      'Em vez de olhar soja, minério e petróleo um a um, o IC-Br acompanha uma cesta de commodities em reais. A ponderação considera a relevância para a inflação doméstica; não é uma carteira do que o Brasil exporta.',
      'Ele vem em quatro partes: o índice geral, e as cestas de agropecuária, de metais e de energia. Assim dá para ver qual setor puxa o movimento.',
      'Como é calculado em reais, o índice mexe com dois fatores: o preço internacional das commodities e o câmbio. Dólar mais forte empurra o IC-Br para cima, ainda que o mundo esteja estável.',
    ],
    analogia: 'É um termômetro de commodities relevantes para os preços no Brasil: não informa o preço de cada produto, mas a evolução de uma cesta em reais.',
    lacunas: [
      'O IC-Br é um número-índice: o nível em si (por exemplo, 460) só tem sentido em comparação com meses anteriores. Olhe a variação.',
      'Ele é medido em reais; por isso reflete o câmbio. Para isolar o efeito do mundo, compare com as mesmas commodities em dólar.',
      'É mensal e divulgado com defasagem, ao contrário dos preços diários de petróleo e gás. Serve para tendência, não para acompanhar o dia.',
    ],
    preciso: {
      texto: 'O índice em reais é, em essência, o índice em dólar multiplicado pela variação do câmbio. A variação em reais combina as duas:',
      formula: 'variação em R$ = (1 + variação em US$) × (1 + variação do dólar) − 1',
    },
    exemplo: (() => {
      const e = EX_ICBR
      const v = (1 + e.quedaUsd) * (1 + e.altaDolar) - 1
      return {
        titulo: `Cesta cai ${pct(-e.quedaUsd, 0)} em dólar e o dólar sobe ${pct(e.altaDolar, 0)}`,
        passos: [
          `Em dólar: ${nf(e.indiceUsd, 2)} × (1 − ${nf(-e.quedaUsd, 2)}) = ${nf(e.indiceUsd * (1 + e.quedaUsd), 3)}.`,
          `Em reais, com o dólar ${pct(e.altaDolar, 0)} mais alto: ${nf(1 + e.quedaUsd, 2)} × ${nf(1 + e.altaDolar, 2)} − 1 = ${pct(v, 1)}.`,
        ],
        resultado: `O IC-Br sobe ${pct(v, 1)} mesmo com as commodities ${pct(-e.quedaUsd, 0)} mais baratas lá fora: o câmbio inverteu o sinal.`,
      }
    })(),
    noApp: { texto: 'O IC-Br geral, de agropecuária, metais e energia está em Cenários › Commodities, na tabela “Em reais”.', tab: 'cenarios', view: 'commodities' },
    teste: {
      pergunta: 'O IC-Br sobe 3% no mês. Isso quer dizer que as commodities ficaram 3% mais caras no mundo?',
      resposta: 'Não necessariamente. O índice é em reais: parte da alta pode vir só do dólar mais forte. Compare com a variação em dólar para separar os dois efeitos.',
    },
  },
  {
    id: 'combustiveis',
    topico: 'Commodities',
    nome: 'Combustíveis: do petróleo à bomba',
    frase: 'O preço na bomba parte do petróleo e dos derivados em dólar, passa pelo câmbio e ainda soma impostos, etanol, margens e frete.',
    crianca: [
      'O petróleo vira gasolina e diesel na refinaria. O valor dos derivados lá fora, em dólar por galão, é o ponto de partida do preço. Depois entram o câmbio, o frete, os tributos, a mistura de etanol na gasolina e as margens de distribuição e dos postos.',
      'Por isso o preço da bomba não acompanha o petróleo no mesmo dia: há política de preços da refinaria, estoques e contratos no meio do caminho. Uma alta lá fora chega à bomba com atraso e diluída.',
      'O diesel pesa muito além do carro: move caminhão e máquina agrícola, entra no frete de tudo e, por isso, aparece na inflação de forma indireta.',
    ],
    analogia: 'É como o preço de uma refeição: o ingrediente (derivado em dólar) é só uma parte da conta. O restante é cozinha, impostos e serviço.',
    lacunas: [
      'Converter o derivado de Nova York para reais por litro dá um piso de comparação, não o custo da refinaria brasileira: não inclui frete, impostos nem margens.',
      'A gasolina vendida no posto tem mistura de etanol anidro. Uma parte do preço depende do etanol e do açúcar, não do petróleo.',
      'O preço ao consumidor é uma média semanal de postos pesquisados pela ANP, com defasagem; já os derivados em Nova York são cotações diárias.',
    ],
    preciso: {
      texto: 'Para comparar o derivado americano com a bomba brasileira, converte-se o galão em litro e o dólar em real:',
      formula: 'R$/litro = (US$/galão ÷ 3,78541) × câmbio (R$/US$)',
    },
    exemplo: (() => {
      const e = EX_BOMBA
      const produto = galaoParaLitro(e.usdGalao, e.cambio)
      return {
        titulo: `Gasolina a US$ ${nf(e.usdGalao, 2)}/galão, dólar a R$ ${nf(e.cambio, 2)} e bomba a R$ ${nf(e.bomba, 2)}/litro`,
        passos: [
          `Em reais por litro: (${nf(e.usdGalao, 2)} ÷ 3,78541) × ${nf(e.cambio, 2)} = R$ ${nf(produto, 2)}.`,
          `Na bomba o litro custa R$ ${nf(e.bomba, 2)}: o produto convertido responde por ${pct(produto / e.bomba, 0)}.`,
          `O restante (${pct(1 - produto / e.bomba, 0)}) é imposto, etanol anidro na mistura, frete, distribuição e margem do posto.`,
        ],
        resultado: `Só ${pct(produto / e.bomba, 0)} do preço da bomba vem do derivado em dólar; por isso a gasolina reage menos que o petróleo.`,
      }
    })(),
    noApp: { texto: 'Gás, diesel e gasolina de Nova York estão na tabela de commodities; os preços ao consumidor (ANP), na tabela “Combustíveis ao consumidor”, ambas em Cenários › Commodities.', tab: 'cenarios', view: 'commodities' },
    teste: {
      pergunta: 'O petróleo sobe 10% em um dia. A gasolina na bomba sobe 10% no dia seguinte?',
      resposta: 'Em geral, não. Há política de preços, impostos, etanol, margens e defasagem no meio: a alta chega à bomba atrasada e menor do que 10%.',
    },
  },
  {
    id: 'escala-6x1',
    topico: 'Tributos e trabalho',
    nome: 'Escala 6x1 e transição da jornada',
    revisadoEm: '2026-11-06',
    fontes: [
      { nome: 'Câmara — EC 141/2026, publicação original, arts. 2º a 10', url: 'https://www2.camara.leg.br/legin/fed/emecon/2026/emendaconstitucional-141-16-outubro-2026-800062-publicacaooriginal-181622-pl.html' },
      { nome: 'Senado — texto da EC 141/2026', url: 'https://legis.senado.leg.br/norma/44184944/publicacao/44189027' },
    ],
    frase: 'A escala 6x1 distribui o trabalho em seis dias e o descanso em um; a EC 141/2026 prevê sua substituição com transição.',
    crianca: [
      'Escala informa em quais dias a pessoa trabalha; jornada informa quantas horas trabalha. Seis dias de trabalho não significam seis jornadas de oito horas: é preciso respeitar os limites aplicáveis.',
      'A EC 141 foi publicada em 16/10/2026. Dois meses após a publicação, estabelece até 42 horas semanais e dois dias de repouso remunerado; um ano depois desse prazo, até 40 horas. Em 05/11/2026, a primeira etapa ainda não começou. A redução preserva o salário.',
      'Para a empresa, o ponto prático é planejar cobertura, produtividade e caixa. Menos horas por empregado não significam automaticamente o mesmo aumento de contratações: demanda, turnos e organização do trabalho também contam.',
    ],
    analogia: 'É reorganizar os turnos de uma loja: o horário da loja e o horário de cada empregado são coisas diferentes.',
    lacunas: [
      'A emenda já foi promulgada; não é apenas uma proposta. Sua transição não autoriza antecipar a aplicação de todas as regras.',
      'Acordo ou convenção coletiva pode disciplinar compensações; há regras próprias para regimes diferenciados. A folga não precisa ser sempre sábado e domingo.',
      'Os arts. 8º e 9º trazem condições específicas para empregados com diploma superior e alta remuneração e para contratos públicos com mão de obra. Confira o enquadramento antes de alterar contratos.',
      'Jornadas já fixadas em até 40 horas não têm redução proporcional automática. Lei complementar poderá criar medidas transitórias para MEI, micro e pequenas empresas, condicionadas à manutenção do emprego; essa previsão não suspende os prazos da emenda.',
    ],
    preciso: {
      texto: 'Os arts. 6º e 10 da EC 141/2026 definem a transição e a vigência. O planejamento financeiro abaixo compara horas disponíveis; não determina a escala legal de uma categoria.',
      formula: 'horas disponíveis = número de empregados × horas semanais por empregado',
    },
    exemplo: {
      titulo: 'Planejamento ilustrativo de uma equipe com 10 empregados',
      passos: ['Com 44 horas por empregado: 10 × 44 = 440 horas por semana.', 'Com 40 horas por empregado: 10 × 40 = 400 horas por semana; diferença de 40 horas.'],
      resultado: 'A empresa precisa avaliar como cobrir 40 horas semanais a menos. Esta conta não prova que será necessário contratar exatamente uma pessoa.',
    },
    noApp: { texto: 'Em Cenários, compare o ambiente de custos da empresa. O painel não calcula folha nem define o enquadramento trabalhista.', tab: 'cenarios' },
    teste: { pergunta: 'Em 05/11/2026, a publicação da EC 141 já obriga toda empresa a adotar imediatamente 40 horas?', resposta: 'Não. A emenda prevê etapas, prazos e situações específicas. É preciso conferir a vigência, a categoria e os contratos antes de aplicar a mudança.' },
  },
  CONCEITO_ICMS_ST,
  {
    id: 'reforma-tributaria',
    topico: 'Tributos e trabalho',
    nome: 'Reforma Tributária do consumo',
    revisadoEm: '2026-11-05',
    fontes: [
      { nome: 'Câmara — LC 214/2025, texto atualizado', url: 'https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html' },
      { nome: 'Receita Federal — entenda a reforma e a transição', url: 'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/entenda' },
    ],
    frase: 'A reforma reorganiza os tributos sobre o consumo, com CBS federal e IBS de estados e municípios, em uma transição até 2033.',
    crianca: [
      'A CBS substitui PIS e Cofins; o IBS substitui ICMS e ISS. A mudança é gradual. O Imposto Seletivo é outro tributo, com regras próprias para produtos e serviços previstos em lei.',
      'O ano de 2026 é de teste: CBS de 0,9% e IBS de 0,1%, com dispensa de recolhimento para quem cumpre as obrigações previstas. PIS e Cofins terminam em 2027; ICMS e ISS dão lugar ao IBS gradualmente de 2029 a 2032. O modelo fica integral em 2033.',
      'Na empresa, importa conferir preço de venda, créditos das compras e prazo de recebimento. O efeito muda conforme atividade, regime e cadeia de fornecedores e clientes.',
    ],
    analogia: 'É trocar o sistema de cobrança com a empresa funcionando: por um tempo, regras antigas e novas convivem.',
    lacunas: [
      'As alíquotas de teste de 2026 não são a carga final de todos os setores. Existem reduções, exceções e regimes específicos.',
      'Crédito tributário não é dinheiro livre em conta: depende dos requisitos legais, do documento fiscal e das regras de apropriação.',
      'A reforma do consumo não se confunde com a tributação de dividendos. Consulte cada legislação e não projete uma alíquota única para toda empresa.',
    ],
    preciso: {
      texto: 'No regime regular, débitos das vendas podem ser compensados com créditos admitidos nas aquisições. O exemplo isola essa lógica e não calcula um tributo real.',
      formula: 'saldo ilustrativo a recolher = débitos das vendas − créditos admitidos',
    },
    exemplo: {
      titulo: 'Débito de R$ 100 e crédito de R$ 40 — valores hipotéticos',
      passos: ['Admita R$ 100 de débito nas vendas e R$ 40 de crédito válido nas compras.', 'Compensação ilustrativa: R$ 100 − R$ 40 = R$ 60.'],
      resultado: 'O saldo seria R$ 60, se todos os créditos fossem admitidos. Os valores não representam uma alíquota oficial nem o cálculo de 2026.',
    },
    noApp: { texto: 'Na calculadora Reforma tributária · caixa, simule a CBS e o dinheiro necessário para cobrir mudanças de prazo. É uma estimativa educativa, sem apuração fiscal de CBS ou IBS.', tab: 'calculadora', view: 'cbs-caixa' },
    teste: { pergunta: 'Somar 0,9% de CBS e 0,1% de IBS em 2026 revela a alíquota definitiva de toda empresa?', resposta: 'Não. São alíquotas de teste, com regras de dispensa. A carga final depende do regime, da operação, das alíquotas aplicáveis e dos créditos admitidos.' },
  },
  {
    id: 'split-payment',
    topico: 'Tributos e trabalho',
    nome: 'Split Payment',
    revisadoEm: '2026-11-05',
    fontes: [
      { nome: 'Câmara — LC 214/2025 atualizada, arts. 31 a 35', url: 'https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html' },
      { nome: 'Receita Federal — testes de integração do Split Payment, 30/09/2026', url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/setembro/comunicado-5' },
    ],
    frase: 'É a separação de IBS e CBS no pagamento: a parcela do tributo vai ao Fisco e o restante segue para a empresa.',
    crianca: [
      'Em vez de a empresa receber todo o valor e depois pagar o tributo, o sistema de pagamento separa os valores na liquidação financeira. Isso exige vínculo entre pagamento, documento fiscal e cálculo do imposto.',
      'Em 05/11/2026, a plataforma pública está em testes de integração iniciados em 15/10/2026, em ambiente controlado, sem processamento definitivo de operações reais. Não presuma que toda venda já sofre essa separação.',
      'Na gestão do caixa, compare o valor bruto vendido com o que fica disponível para pagar fornecedor e folha. O tributo separado não deve ser tratado como capital de giro próprio.',
    ],
    analogia: 'É um pagamento com dois destinos: uma parte vai para a empresa e outra quita o tributo correspondente.',
    lacunas: [
      'O split payment não é um imposto novo: é uma forma de recolher IBS e CBS.',
      'A implantação depende de atos e cronogramas oficiais. Os procedimentos padrão e simplificado têm regras distintas.',
      'Vendas parceladas, créditos e valores já quitados afetam o cálculo. Antecipar recebíveis não elimina a obrigação de separar o tributo.',
    ],
    preciso: {
      texto: 'Os arts. 31 a 35 da LC 214/2025, atualizados pela LC 227/2026, regulam a segregação na liquidação. O exemplo supõe um valor de tributo já identificado, sem créditos, tarifas ou outros ajustes.',
      formula: 'valor disponível ilustrativo = pagamento bruto − tributo separado',
    },
    exemplo: {
      titulo: 'Pagamento de R$ 1.000 com R$ 100 de tributo hipotético',
      passos: ['Separe R$ 100 do pagamento bruto de R$ 1.000.', 'Restam R$ 900 para a empresa, antes de tarifas e outros ajustes. Em duas parcelas iguais, a hipótese seria R$ 50 separados de cada R$ 500.'],
      resultado: 'O caixa disponível seria R$ 900. Os R$ 100 são uma hipótese didática, não uma alíquota oficial nem uma cobrança já aplicada ao usuário.',
    },
    noApp: { texto: 'Na calculadora Reforma tributária · caixa, teste como a separação do imposto pode mudar o recebimento e a reserva de giro. O painel simula hipóteses; não executa split payment.', tab: 'calculadora', view: 'cbs-caixa' },
    teste: { pergunta: 'O split payment cria um imposto adicional e já é descontado de toda venda em novembro de 2026?', resposta: 'Não. Ele recolhe IBS e CBS, sem criar outro tributo. Na data desta revisão, os testes oficiais são controlados e não processam operações reais em caráter definitivo.' },
  },
  {
    id: 'dividendos',
    topico: 'Tributos e trabalho',
    nome: 'Dividendos e distribuição de lucros',
    revisadoEm: '2026-11-06',
    fontes: [
      { nome: 'Câmara — Lei 9.250/1995 atualizada, art. 6º-A incluído pela Lei 15.270/2025', url: 'https://www2.camara.leg.br/legin/fed/lei/1995/lei-9250-26-dezembro-1995-362566-normaatualizada-pl.html' },
      { nome: 'Receita Federal — perguntas e respostas sobre lucros e dividendos', url: 'https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirf/manual_padrao_rfb_per_tributacao_cotin_v-19-12-2025.pdf' },
    ],
    frase: 'Dividendos são lucros distribuídos aos sócios; a distribuição reduz o caixa da empresa e pode gerar imposto para quem recebe.',
    crianca: [
      'Ter lucro contábil não significa ter o mesmo valor disponível no banco: parte pode estar em estoque ou em vendas a prazo. Antes de distribuir, confira o lucro distribuível, a documentação e o caixa necessário à operação.',
      'Desde janeiro de 2026, dividendos de uma mesma pessoa jurídica para uma mesma pessoa física residente no Brasil acima de R$ 50 mil no mês sofrem IRRF de 10% sobre o total, não só sobre o excesso. Pagamentos do mesmo mês são somados.',
      'A retenção é considerada na apuração anual das altas rendas. Receber até o limite mensal não garante isenção anual: o total de rendimentos do beneficiário também importa.',
    ],
    analogia: 'É dividir o resultado de uma loja entre os donos, preservando antes o dinheiro necessário para manter a loja funcionando.',
    lacunas: [
      'Não confunda dividendos com pró-labore, salário ou juros sobre capital próprio: são pagamentos com regras diferentes.',
      'A regra mensal acima trata de pessoa física residente no Brasil. Pagamentos ao exterior e a outros beneficiários exigem análise própria.',
      'Há regra de transição para resultados até 2025, com aprovação da distribuição até 31/12/2025 e demais requisitos legais. O ano do lucro, sozinho, não garante a exceção.',
      'A tributação anual de altas rendas alcança rendimentos acima de R$ 600 mil no ano, observadas exclusões e ajustes legais; retenção não é necessariamente imposto definitivo.',
    ],
    preciso: {
      texto: 'O art. 6º-A da Lei 9.250/1995 prevê o limite por mesma fonte pagadora e beneficiário no mesmo mês. Na hipótese tributada abaixo, aplica-se 10% ao total, sem deduções.',
      formula: 'se total mensal > R$ 50.000: IRRF = total mensal × 10%, ressalvadas exceções legais',
    },
    exemplo: {
      titulo: 'R$ 60.000 distribuídos no mês a um sócio residente, sem exceção legal',
      passos: ['IRRF: R$ 60.000 × 10% = R$ 6.000, e não R$ 1.000 sobre o excesso.', 'O sócio recebe R$ 54.000; a empresa destina R$ 6.000 ao imposto retido.'],
      resultado: 'A saída total de caixa da empresa é R$ 60.000. O valor retido deverá ser considerado no ajuste tributário do beneficiário.',
    },
    noApp: { texto: 'Em Juros, compare o custo de financiar a empresa após uma distribuição. O painel não apura o imposto pessoal do sócio.', tab: 'juros' },
    teste: { pergunta: 'A mesma empresa paga R$ 30 mil e depois R$ 30 mil ao mesmo sócio residente no mesmo mês; sem exceção, há retenção?', resposta: 'Sim. Soma-se R$ 60 mil no mês e recalcula-se a retenção de 10% sobre o total: R$ 6 mil. Dividir o pagamento não elimina a regra mensal.' },
  },
]

export const TOPICOS = ['Juros e câmbio', 'Funding e risco', 'Operações de crédito', 'Comércio exterior', 'Inflação', 'Commodities', 'Tributos e trabalho']

// Busca por palavras (todas precisam aparecer), sem diferenciar acento nem maiúscula, no conteúdo inteiro do conceito.
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const textoDeBusca = (c) => plain([c.nome, c.topico, c.frase, c.analogia, ...c.crianca, ...c.lacunas, c.preciso.texto, c.preciso.formula, c.exemplo.titulo, ...c.exemplo.passos, c.teste.pergunta, c.teste.resposta, c.estudoHistorico ? JSON.stringify(c.estudoHistorico) : ''].join(' '))
export function buscarConceitos(termo, lista = CONCEITOS) {
  const palavras = plain(String(termo ?? '')).split(/\s+/).filter(Boolean)
  return palavras.length ? lista.filter((c) => { const t = textoDeBusca(c); return palavras.every((w) => t.includes(w)) }) : lista
}
// Agrupa por tópico, na ordem de TOPICOS, sem mostrar tópico vazio.
export const porTopico = (lista) => TOPICOS.map((topico) => ({ topico, itens: lista.filter((c) => c.topico === topico) })).filter((g) => g.itens.length)

// MAPA DE CONEXÕES. Regra do projeto: ao criar ou alterar um conceito, atualize aqui o papel dele (CONEXAO.itens) e as ligações com os
// outros conceitos (LIGACOES). Os testes recusam conceito sem papel, sem ligação ou com ligação para conceito que não existe.
// LIGACOES é a fonte única: cada par vale nos dois sentidos e aparece em "Conecta com" de ambos os conceitos e no quadro geral.
export const LIGACOES = [
  ['marcacao-a-mercado', 'liquidacao-antecipada', 'Preço econômico e valor de quitação não são automaticamente iguais; confira contrato e normas aplicáveis.'],
  ['marcacao-a-mercado', 'debenture', 'O preço de uma debênture responde à curva de juros, ao risco do emissor e à liquidez.'],
  ['marcacao-a-mercado', 'custo-de-funding', 'Mudanças no custo exigido pelo mercado alteram o valor presente dos fluxos.'],
  ['substituicao-tributaria', 'reforma-tributaria', 'A exclusão de ICMS-ST muda o recolhimento do ICMS vigente; não se confunde com a transição da reforma para IBS e CBS.'],
  ['substituicao-tributaria', 'custo-de-funding', 'A antecipação do imposto e o prazo de utilização do crédito de estoque podem alterar a necessidade de financiar o capital de giro.'],
  ['imposto-seletivo', 'reforma-tributaria', 'O IS integra a reforma do consumo, com incidência e cálculo próprios, ao lado do IBS e da CBS.'],
  ['imposto-seletivo', 'inflacao', 'Mudanças no tributo podem afetar preços, mas o efeito na inflação depende do repasse e do peso de cada produto.'],
  ['juros-forcados', 'inflacao', 'A taxa real depende da inflação; manter juros baixos pode ser coerente com desinflação ou entrar em conflito com inflação elevada.'],
  ['juros-forcados', 'diferencial-de-juros', 'O diferencial de rendimento é um dos canais de pressão cambial, mas não explica sozinho a movimentação das moedas.'],
  ['juros-forcados', 'custo-de-funding', 'Taxa básica menor não garante captação mais barata se o risco, o juro longo ou o spread subirem.'],
  ['cet', 'fee-de-estruturacao', 'Uma comissão vinculada ao crédito altera o líquido recebido ou os pagamentos; o CET considera o valor e a data dessa cobrança, quando aplicável.'],
  ['cet', 'custo-de-funding', 'O funding ajuda a explicar a taxa cobrada pela instituição; o CET mede o custo do fluxo para o tomador, incluindo os demais encargos aplicáveis.'],
  ['escala-6x1', 'custo-de-funding', 'Reorganizar turnos pode mudar o fluxo de caixa e a necessidade de giro; a decisão de financiar depende da produtividade e da operação de cada empresa.'],
  ['reforma-tributaria', 'split-payment', 'A reforma cria CBS e IBS; o split payment é um dos mecanismos previstos para recolher esses tributos na liquidação financeira.'],
  ['reforma-tributaria', 'custo-de-funding', 'A transição dos tributos e o aproveitamento de créditos podem alterar o caixa da empresa e o valor de capital de giro a financiar.'],
  ['split-payment', 'custo-de-funding', 'A parcela tributária separada no pagamento reduz o caixa bruto disponível; planejar o giro exige considerar esse fluxo e o custo de financiá-lo.'],
  ['dividendos', 'custo-de-funding', 'Distribuir lucros retira recursos da empresa; reter parte do resultado pode reduzir a necessidade de captar, conforme o caixa e o plano de investimento.'],
  ['fgi-peac', 'cet', 'A comissão da garantia é um encargo ligado ao crédito; entra no CET quando aplicável, conforme o contrato.'],
  ['fgi-peac', 'custo-de-funding', 'Com parte do risco coberta pelo fundo, o banco pode aceitar emprestar a empresas sem garantia própria, o que muda o acesso e o custo do crédito.'],
  ['fee-de-estruturacao', 'custo-de-funding', 'O custo de captar e o spread ajudam a explicar os juros; a remuneração da estruturação deve ser conferida separadamente no custo completo.'],
  ['fee-de-estruturacao', 'debenture', 'Uma emissão pode envolver comissões de estruturação, coordenação e colocação, com condições próprias descritas nos documentos da oferta.'],
  ['diferencial-de-juros', 'cupom-cambial', 'O cupom cambial é o diferencial de juros depois de passar pelo dólar futuro: a parte do juro em reais que sobra em dólar.'],
  ['diferencial-de-juros', 'sofr', 'A SOFR é o juro em dólar contra o qual se mede o diferencial: quanto maior o juro em reais sobre ela, maior o diferencial.'],
  ['diferencial-de-juros', 'inflacao', 'Diferencial nominal não é real: descontando a inflação de cada país, o ganho verdadeiro entre as moedas pode ser outro.'],
  ['focus', 'inflacao', 'O Focus traz a inflação que o mercado espera; o Banco Central mira essa expectativa ao decidir a Selic, não só o IPCA já medido.'],
  ['focus', 'diferencial-de-juros', 'A Selic esperada no Focus é o lado brasileiro do diferencial de juros à frente: muda o prêmio de ficar em reais.'],
  ['focus', 'commodities-e-cambio', 'O câmbio projetado no Focus (média de dezembro) é a referência de mercado para converter preços em dólar nos cenários do cliente.'],
  ['cupom-cambial', 'sofr', 'O cupom cambial é o juro em dólar embutido no mercado brasileiro; a diferença dele para a SOFR mostra o prêmio de estar no país.'],
  ['cupom-cambial', 'custo-de-funding', 'O cupom cambial converte o custo de captar em dólar para reais (swap): é a ponte que fecha a conta do funding externo.'],
  ['sofr', 'euribor', 'São referências de juros de mercados diferentes: SOFR é overnight e garantida por títulos do Tesouro dos EUA; Euribor mede funding em euros não garantido, a prazo, com componente de risco de crédito bancário.'],
  ['sofr', 'custo-de-funding', 'Captar em dólar custa SOFR mais o spread de crédito de quem capta.'],
  ['euribor', 'custo-de-funding', 'Captar em euro custa Euribor mais o spread de crédito de quem capta.'],
  ['custo-de-funding', 'cds', 'O CDS mede o risco percebido: quando sobe, o spread exigido e o custo de funding sobem junto.'],
  ['custo-de-funding', 'liquidacao-antecipada', 'O break funding cobra o custo de quebrar a captação (funding) que financiava o contrato liquidado antes do prazo.'],
  ['custo-de-funding', 'debenture', 'A debênture é uma fonte de funding da empresa: seu custo é o CDI (ou o IPCA) mais o spread de risco.'],
  ['cds', 'debenture', 'O CDS é um seguro contra calote; o risco de crédito que ele precifica é o mesmo que define o spread da debênture.'],
  ['liquidacao-antecipada', 'debenture', 'Quitar ou resgatar uma debênture antes do vencimento pode ser na curva ou a mercado, e os contratos costumam prever uma cobrança de quebra.'],
  ['liquidacao-antecipada', 'fidc', 'Vender recebíveis ao FIDC com desconto é trazer valor futuro a valor presente, a mesma conta da liquidação a mercado.'],
  ['debenture', 'nota-comercial', 'São instrumentos distintos de dívida da empresa; prazo, garantias, remuneração e exigências dependem das condições e da forma de oferta de cada emissão.'],
  ['debenture', 'fidc', 'Duas formas de captar no mercado: a debênture é dívida da empresa; o FIDC compra os recebíveis dela, e o investidor depende da carteira.'],
  ['debenture', 'inflacao', 'Debêntures indexadas ao IPCA pagam a inflação mais uma taxa real: quem compra se protege do aumento dos preços.'],
  ['commodities-e-cambio', 'ic-br', 'O IC-Br é o preço das commodities já passado pelo câmbio: o índice em reais é o índice em dólar multiplicado pelo dólar.'],
  ['commodities-e-cambio', 'combustiveis', 'O derivado cotado em dólar chega à bomba em reais: o câmbio converte o ponto de partida do preço do combustível.'],
  ['commodities-e-cambio', 'diferencial-de-juros', 'Um diferencial de juros alto tende a atrair dólares e valorizar o real, o que barateia em reais as commodities cotadas em dólar.'],
  ['ic-br', 'inflacao', 'Commodities agrícolas e de energia pressionam o IPCA com defasagem, por alimentos, combustíveis e insumos: o IC-Br antecipa parte dessa pressão.'],
  ['combustiveis', 'inflacao', 'Gasolina pesa diretamente no IPCA, e o diesel entra de forma indireta pelo frete de praticamente tudo.'],
  ['cri', 'fidc', 'CRI e FIDC transformam recebíveis em investimento: o CRI pela securitizadora, com patrimônio separado; o FIDC por um fundo com cotas sênior e subordinada.'],
  ['cri', 'debenture', 'Mesma lógica de título com termo escrito e agente fiduciário; no CRI corporativo, o lastro costuma ser uma debênture da própria empresa do setor imobiliário.'],
  ['cri', 'inflacao', 'A maioria dos CRIs paga IPCA mais uma taxa: o investidor recebe a inflação de volta e a taxa real por cima.'],
  ['cri', 'custo-de-funding', 'Como o investidor pessoa física é isento, aceita taxa menor: o CRI tende a baratear o funding do setor imobiliário.'],
  ['cri', 'cra', 'Mesma estrutura de securitização: o CRI tem lastro imobiliário, o CRA tem lastro do agronegócio.'],
  ['cra', 'fidc', 'Os dois podem ter séries sênior e subordinada, e nos dois a subordinada absorve as primeiras perdas.'],
  ['cra', 'commodities-e-cambio', 'Quem está no lastro do CRA vende commodities cotadas em dólar: preço internacional e câmbio decidem se a safra paga a conta.'],
  ['facil', 'debenture', 'O FÁCIL simplifica a emissão de debêntures para companhias de menor porte: o título é o mesmo, o caminho é mais curto.'],
  ['facil', 'nota-comercial', 'A nota comercial é uma das captações que a companhia de menor porte pode fazer pelo FÁCIL, para capital de giro e ponte.'],
  ['facil', 'custo-de-funding', 'Ao abrir o mercado de capitais para empresas médias, o FÁCIL dá uma alternativa ao banco: o custo é CDI mais o spread que os investidores pedirem.'],
  ['drawback', 'commodities-e-cambio', 'Os insumos do drawback costumam ser cotados em dólar: o câmbio define quanto vale, em reais, o insumo e o tributo suspenso.'],
  ['drawback', 'custo-de-funding', 'O drawback libera caixa ao não adiantar tributos sobre insumos, o que reduz o capital de giro a financiar e o custo de funding da exportação.'],
  ['lei-de-maquila', 'drawback', 'Ambos apoiam operações de exportação, mas a maquila é um regime do Paraguai e o drawback é um regime aduaneiro brasileiro: requisitos e tributos são diferentes.'],
  ['lei-de-maquila', 'custo-de-funding', 'O benefício tributário precisa ser comparado com capital de giro, logística e custo de financiar a operação; a alíquota de 1% não resume o custo total.'],
  ['lei-de-maquila', 'commodities-e-cambio', 'Insumos, contrato de maquila e exportação podem envolver moedas diferentes; preço internacional e câmbio mudam o custo da cadeia.'],
  ['nota-comercial', 'fidc', 'Duas saídas para capital de giro: captar por nota comercial, no prazo definido na emissão, ou antecipar o que a empresa tem a receber por um FIDC.'],
]

export const CONEXAO = {
  titulo: 'Como as peças se encaixam',
  itens: [
    { id: 'marcacao-a-mercado', texto: 'separa o valor atual da posição do fluxo contratado e ajuda a avaliar liquidez e risco de mercado.' },
    { id: 'substituicao-tributaria', texto: 'antecipa o ICMS das revendas em um ponto da cadeia; a mudança paulista exige conferir mercadoria, estoque, créditos e caixa.' },
    { id: 'imposto-seletivo', texto: 'explica o imposto do pecado no Brasil, seu objetivo de saúde e ambiente, as regras de transição e possíveis efeitos sobre preços e margens.' },
    { id: 'juros-forcados', texto: 'compara seis histórias de juros baixos, controle da curva e repressão financeira, com benefícios, custos e limites de causalidade.' },
    { id: 'cet', texto: 'reúne o custo do crédito para o tomador, com o líquido recebido, os encargos aplicáveis e as datas dos pagamentos.' },
    { id: 'escala-6x1', texto: 'liga organização dos turnos, produtividade e planejamento do caixa, com transição e enquadramento trabalhista a conferir.' },
    { id: 'reforma-tributaria', texto: 'muda a apuração dos tributos sobre consumo e exige revisar preços, créditos e fluxo de caixa durante a transição.' },
    { id: 'split-payment', texto: 'separa IBS e CBS no pagamento, conforme as regras de implantação; afeta o valor disponível para financiar a operação.' },
    { id: 'dividendos', texto: 'distribuem o resultado aos sócios e conectam lucro, caixa da empresa, tributação do beneficiário e necessidade de financiamento.' },
    { id: 'fee-de-estruturacao', texto: 'remunera a organização da operação e precisa entrar na comparação do custo completo, conforme o contrato.' },
    { id: 'diferencial-de-juros', texto: 'é a distância entre o juro de duas moedas: a origem da conta que liga o real ao dólar.' },
    { id: 'cupom-cambial', texto: 'é a ponte entre o juro em reais e o juro em dólar.' },
    { id: 'sofr', texto: 'é o benchmark do dólar: o preço “sem risco” do dinheiro em dólar.' },
    { id: 'euribor', texto: 'é uma referência de funding bancário não garantido em euros, a prazo; não é uma taxa sem risco equivalente à SOFR. Para uma referência overnight em euros, consulte também €STR, cuja metodologia é diferente da SOFR.' },
    { id: 'custo-de-funding', texto: 'é o resultado: benchmark + spread de risco, convertido na moeda em que a instituição empresta.' },
    { id: 'cds', texto: 'é o prêmio pelo risco de crédito: quanto mais alto, mais caro captar.' },
    { id: 'fgi-peac', texto: 'é a garantia do BNDES que cobre parte da perda do banco em crédito a empresas de menor porte; a dívida continua da empresa.' },
    { id: 'liquidacao-antecipada', texto: 'mostra quanto vale pagar antes do vencimento: o saldo do contrato (na curva), o preço de hoje (a mercado) e a indenização pelo funding quebrado (break funding).' },
    { id: 'debenture', texto: 'é a dívida longa e formal da empresa com investidores: CDI ou IPCA mais um spread.' },
    { id: 'nota-comercial', texto: 'é um título de dívida escritural; pode financiar giro ou ponte, com prazo definido na emissão.' },
    { id: 'fidc', texto: 'é o fundo que compra recebíveis; a subordinação protege quem tem a cota sênior.' },
    { id: 'cri', texto: 'transforma recebíveis imobiliários em título para o investidor, com patrimônio separado e, para pessoa física, isenção de IR.' },
    { id: 'cra', texto: 'é o CRI do agronegócio: lastro em safra, insumos e contratos do agro, com risco ligado a clima, commodities e câmbio.' },
    { id: 'facil', texto: 'é a porta simplificada da CVM para companhias de menor porte (receita abaixo de R$ 500 milhões) captarem com investidores.' },
    { id: 'drawback', texto: 'suspende ou isenta os tributos dos insumos de quem exporta, liberando caixa do exportador.' },
    { id: 'lei-de-maquila', texto: 'organiza produção ou serviços no Paraguai para o exterior, sob programa aprovado, com tributação própria e obrigações de exportação.' },
    { id: 'inflacao', texto: 'é o que desconta o juro nominal para chegar ao juro real, e o que o Banco Central tenta controlar com a Selic.' },
    { id: 'focus', texto: 'é a pesquisa semanal do Banco Central com o que o mercado espera de Selic, inflação, PIB e câmbio: antecipa o custo do dinheiro.' },
    { id: 'commodities-e-cambio', texto: 'é a regra de conversão: o preço mundial em dólar vira preço em reais pelo câmbio.' },
    { id: 'ic-br', texto: 'resume em reais a cesta de commodities do Brasil, mostrando se o conjunto ficou mais caro ou mais barato.' },
    { id: 'combustiveis', texto: 'é o caminho do derivado em dólar até a bomba, onde entram câmbio, impostos, etanol e margens, e de onde parte da inflação.' },
  ],
  // O caminho que une tudo, de ponta a ponta.
  cadeia: 'Expectativas (Focus) → Inflação → Selic e curva DI → CDI → remuneração de debêntures, notas comerciais, CRI e CRA (com o FÁCIL abrindo esse caminho às empresas menores) → custo de funding (somando o risco, medido pelo CDS) → liquidação antecipada e break funding. No comércio exterior, o drawback alivia o caixa do exportador e a maquila organiza operações no Paraguai para o exterior, com regras próprias e custos no destino a avaliar. Na ponta externa, SOFR, Euribor, diferencial de juros e cupom cambial ligam o juro em reais ao juro em dólar e em euro. Nas commodities, o preço em dólar passa pelo câmbio e vira IC-Br, soja em reais e combustível na bomba, e daí volta à inflação.',
}

// Ligações de um conceito: [{ id, porque }] nos dois sentidos, na ordem de LIGACOES.
export const conexoesDe = (id) => LIGACOES.filter(([a, b]) => a === id || b === id).map(([a, b, porque]) => ({ id: a === id ? b : a, porque }))
