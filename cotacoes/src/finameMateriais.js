// BNDES Finame Materiais (Materiais Industrializados): regras do produto, base legal e a conta da operação indireta.
// Regras conforme a página do produto e as circulares do BNDES vigentes em novembro de 2026 (ver FONTES); o agente financeiro
// confirma as condições de cada operação. A tela mostra a data da regra e avisa o que precisa de conferência.
import { IOF_PJ, monthlyRate, parseDecimal } from './emprestimo.js'
import { iso, nextBusinessDay } from './holidays.js'
import { actualActualCalendarYears } from './bndesCreditoPequenasEmpresas.js'
import { creditCet } from './creditComparison.js'

// Limite técnico para conservar precisão em centavos. Não é um limite de crédito ou enquadramento.
export const LIMITE_MONETARIO = 1_000_000_000_000
const dentroDoLimite = value => Number.isFinite(value) && Math.abs(value) <= LIMITE_MONETARIO
const erroNumerico = 'Resultado fora do limite numérico de R$ 1 trilhão ou sem fechamento em centavos. Reduza o valor, a taxa ou o prazo.'
// Soma compensada evita perder centavos em cronogramas de maior magnitude.
const somar = values => {
  let total = 0, ajuste = 0
  for (const value of values) {
    const parcela = value - ajuste, proximo = total + parcela
    ajuste = (proximo - total) - parcela
    total = proximo
  }
  return total
}

export const REGRAS = {
  conferidoEm: '2026-11-04',
  prazoMaxMeses: 84, // até 7 anos
  carenciaMaxMeses: 24, // até 2 anos
  carenciaMaxTfbMeses: 12, // com TFB, Taxa Fixa Composta ou Taxa Fixa Composta MPME, carência de até 1 ano
  participacaoMinPct: 1,
  participacaoMaxPct: 100,
  tetoOperacao: 20_000_000, // por operação
  tetoCliente12m: 150_000_000, // por cliente a cada 12 meses, da homologação
  taxaBndes: { 'mpme-nne': 0.95, mpme: 1.25, grande: 1.25 }, // % a.a. (página do produto, lida em 04/11/2026); 1,25% desde 22/01/2026 segundo a Abimaq
  selicSuspensa: 'Circular SUP/ADIG nº 09/2026, de 22/01/2026 (altera a Circular SUP/ADIG nº 13/2022)',
  reembolsoMeses: 12, // notas fiscais emitidas até 12 meses antes do protocolo
  itens: 'bens industrializados novos, de fabricação nacional, enquadrados na lista NCM do Finame Materiais Industrializados e nos critérios de origem CST/CSOSN, usados na atividade do cliente; o produto não exige credenciamento dos materiais no CFI',
  foraDoProduto: 'alimentos, bebidas, combustíveis, lubrificantes e máquinas ou equipamentos credenciáveis no CFI (esses vão para o Finame tradicional)',
  nacionalizacao: 'conteúdo importado de até 40% ou cumprimento do Processo Produtivo Básico (PPB), verificado pelo CST ou CSOSN da nota (códigos iniciados em 0, 4 e 5)',
  // IOF: alíquota zero. O Finame Materiais é operação "efetuada com recursos da Agência Especial de Financiamento Industrial - FINAME"
  // (Decreto 6.306/2007, art. 8º, IX, vigente no texto consolidado lido em 04/11/2026), e o adicional de 0,38% do art. 8º, § 5º, só
  // alcança os incisos que ele lista (I, IV, V, VI, X, XI, XIV, XVI, XVIII, XIX, XXI e XXVI), não o IX. A alíquota zero geral das
  // operações do BNDES (art. 8º, XXX) foi revogada pelo Decreto 8.511/2015 sem afetar o inciso IX. É assim que o mercado contrata
  // (informativo da Abimaq de janeiro de 2026 sobre as condições do produto: sem incidência de IOF). Se o agente cobrar (funding diverso),
  // vale o IOF de crédito PJ: 0,38% + 0,0082% ao dia sobre o principal de cada parcela, até 365 dias (Decreto 12.499/2025).
  iof: 'Sem IOF: a operação é feita com recursos da FINAME e tem alíquota zero (Decreto 6.306/2007, art. 8º, IX, vigente), sem o adicional de 0,38% do § 5º, que só alcança os incisos que ele lista. É assim que o mercado contrata (informativo da Abimaq de janeiro de 2026 sobre as condições do produto: sem incidência de IOF); a revogação da alíquota zero geral do BNDES (art. 8º, XXX, pelo Decreto 8.511/2015) não afeta o inciso IX. Risco residual: o § 4º do art. 8º cobra o imposto se houver desvio de finalidade ou descumprimento de condição. Só se o agente cobrar, por funding diverso, vale o IOF de crédito de pessoa jurídica: 0,38% sobre o valor, uma vez, mais 0,0082% ao dia sobre o principal de cada parcela, até 365 dias (Decreto 12.499/2025, com eficácia restabelecida pelo STF em julho de 2025; optante do Simples Nacional até R$ 30 mil: 0,00274% ao dia)',
}
// Base legal e fontes de cada regra (o que foi confirmado e como). "indexada": trecho da página oficial lido pelo buscador; a página em si não abriu nesta rede.
export const FONTES = [
  { regra: 'FGI Tradicional: custo da garantia (ECG = %G × K × VL × P, com fator K pelo prazo total); o índice de garantia contratada varia de 10% a 80% e o produto atende micro, pequenas e médias empresas', fonte: 'BNDES, Anexo V ao Regulamento do FGI Tradicional (Circular SUP/ADIG nº 65/2026) e páginas do BNDES FGI (ECG, informações a empresas e a instituições financeiras), lidas em 09/11/2026', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/garantias/bndes-fgi/informacoes-a-instituicoes-financeiras/encargo-concessao-garantia-ecg' },
  { regra: 'Custo financeiro: TFB, TFBD, TLP, Taxa LCD, Taxa Fixa Composta ou Taxa Fixa Composta MPME; taxa do BNDES de 0,95% a.a. (MPME N/NE) ou 1,25% a.a. (MPME nas demais regiões e grandes); taxa do agente negociada; Selic suspensa (Circular SUP/ADIG nº 09/2026, de 22/01/2026)', fonte: 'Página do produto BNDES Finame Materiais Industrializados, lida em 04/11/2026', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados' },
  { regra: 'Prazo total de até 7 anos, com até 2 anos de carência (1 ano com TFB, Taxa Fixa Composta ou Taxa Fixa Composta MPME); participação de até 100% dos itens financiáveis; limite de R$ 150 milhões por cliente a cada 12 meses da homologação; notas emitidas até 12 meses antes do protocolo; garantia livre, FGI admitido', fonte: 'Página do produto, lida em 04/11/2026', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados' },
  { regra: 'Teto de R$ 20 milhões por operação; itens, exclusões e nacionalização (conteúdo importado até 40% ou PPB)', fonte: 'Itens e nacionalização na página do produto; o teto por operação vem de Observatório da Indústria RS, Fomento Paraná e e-book CNI 2025 (secundárias; não consta na página oficial lida em 04/11/2026)', url: 'https://observatoriodaindustriars.org.br/solucao/bndes-finame-materiais/' },
  { regra: 'TFC (Taxa Fixa Composta): prefixada, combinação de duas taxas fixas; séries TFC_60.90, TFC_120.90, TFC_MPME_60.90 e TFC_MPME_120.90 (códigos C01 a C04); a faixa de prazo (até 60 ou 61 a 120 meses) e a liberação em 90 dias vêm da denominação das séries; TFB por faixa de prazo e liberação em 30 ou 90 dias', fonte: 'Guia de custos financeiros (definição da TFC) e Moedas Contratuais do BNDES (nomes, códigos e valores), lidos em 04/11/2026; séries coletadas pelo painel (aba BNDES); a página própria da TFC não pôde ser lida', url: 'https://www.bndes.gov.br/moedas' },
  { regra: 'Composição da taxa final: fator do custo financeiro × fator da taxa do BNDES × fator da taxa do agente − 1 (exemplo oficial: 1,07 × 1,015 × 1,03 − 1 = 11,86% a.a.)', fonte: 'Guia "Taxa de juros" do BNDES, lido em 04/11/2026', url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/guia/taxa-de-juros' },
  { regra: 'TLP: parcela prefixada (taxa real) mais IPCA', fonte: 'Lei 13.483/2017 e Resolução CMN 4.600/2017; guia de custos financeiros do BNDES', url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2017/lei/l13483.htm' },
  { regra: 'TLP exigível e TLPCAP são perfis distintos; esta interface encaminha TLP exigível à projeção própria', fonte: 'BNDES, Anexo IV: Condições a serem observadas na contratação, seções 1 e 2', url: 'https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/04-22Cir13-Anexo-IV-Condicoes-a-Serem-Observadas-na-Contratacao.pdf' },
  { regra: 'Cobranças na carência contadas retroativamente desde seu fim; calendário contratual tem data-base e ajustes próprios, não reproduzidos pelas datas ilustrativas desta tela', fonte: 'BNDES, Anexo I: Procedimentos Operacionais, itens 5.1–5.4', url: 'https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/01-22Cir13-Anexo-I-Procedimentos-Operacionais.pdf' },
  { regra: 'IOF: alíquota zero na operação com recursos da FINAME (art. 8º, IX), sem o adicional de 0,38% (§ 5º não lista o inciso IX); se cobrado por funding diverso, crédito PJ 0,38% + 0,0082% ao dia sobre o principal de cada parcela, até 365 dias', fonte: 'Decreto 6.306/2007, texto consolidado na Câmara dos Deputados, lido em 04/11/2026: art. 8º, IX vigente, XXX revogado pelo Decreto 8.511/2015, §§ 4º e 5º; art. 7º, I, b e § 1º; Decreto 12.499/2025 (STF, ADI 7827 e ADC 96, jul/2025); informativo da Abimaq de janeiro de 2026 sobre o Finame Materiais ("sem incidência de IOF"; página não lida diretamente)', url: 'https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html' },
]
export const PORTES = [
  { id: 'mpme-nne', label: 'MPME no Norte ou Nordeste', taxa: REGRAS.taxaBndes['mpme-nne'], mpme: true },
  { id: 'mpme', label: 'MPME nas demais regiões', taxa: REGRAS.taxaBndes.mpme, mpme: true },
  { id: 'grande', label: 'Grande empresa', taxa: REGRAS.taxaBndes.grande, mpme: false },
]
export const CUSTOS = [
  { id: 'tfc', label: 'TFC (prefixada)', hint: 'Taxa Fixa Composta: prefixada, combinação de duas taxas fixas do BNDES, com série própria para MPME. A faixa de prazo (até 60 ou 61 a 120 meses) e a liberação em 90 dias seguem a denominação das séries nas Moedas Contratuais (TFC_60.90, TFC_120.90); confirme com o agente. Carência de até 12 meses.' },
  { id: 'tfb', label: 'TFB (prefixada)', hint: 'Taxa Fixa do BNDES: prefixada, por faixa de prazo do financiamento e prazo até a liberação dos recursos (30 ou 90 dias). Carência de até 12 meses.' },
  { id: 'tlp', label: 'TLPCAP · perfil capitalizado', hint: 'Perfil programático explícito: IPCA projetado capitalizado no saldo. Não representa TLP exigível; a interface encaminha TLP à projeção própria.' },
]
export const PERIODICIDADES = [
  { id: 1, label: 'Mensal' },
  { id: 3, label: 'Trimestral' },
  { id: 6, label: 'Semestral' },
]
export const SISTEMAS = [
  { id: 'sac', label: 'SAC', hint: 'amortização constante, parcelas decrescentes' },
  { id: 'price', label: 'Price', hint: 'parcelas iguais' },
]
// Composição das três parcelas da taxa: capitalizada ((1+a)(1+b)(1+c)−1, como o BNDES apura juros, dia a dia) ou somada (a+b+c, como as
// páginas resumem e alguns agentes apresentam na proposta). A diferença fica em torno de 0,7 p.p. nas taxas de hoje.
export const COMPOSICOES = [
  { id: 'capitalizada', label: 'Capitalizada', hint: 'padrão do BNDES: (1 + custo) × (1 + BNDES) × (1 + agente) − 1' },
  { id: 'somada', label: 'Somada', hint: 'custo + BNDES + agente, como aparece em propostas simplificadas' },
]

// Faixa da TFB pelo prazo total da operação (a tabela do BNDES é por faixa: até 36, 36 a 60, 60 a 84, 84 a 120 meses).
export const faixaTfb = (prazoMeses) => (prazoMeses <= 36 ? 36 : prazoMeses <= 60 ? 60 : prazoMeses <= 84 ? 84 : 120)
// Faixa da TFC pelo prazo total (até 60 ou 61 a 120 meses) e código da série nas Moedas Contratuais, por porte (MPME tem série própria).
export const faixaTfc = (prazoMeses) => (prazoMeses <= 60 ? 60 : 120)
export const TFC_CODIGOS = { grande: { 60: 'C01', 120: 'C02' }, mpme: { 60: 'C03', 120: 'C04' } }
export const TFC_NOMES = { C01: 'TFC_60.90', C02: 'TFC_120.90', C03: 'TFC_MPME_60.90', C04: 'TFC_MPME_120.90' }
export const codigoTfc = (porte, prazoMeses) => TFC_CODIGOS[PORTES.find((p) => p.id === porte)?.mpme ? 'mpme' : 'grande'][faixaTfc(prazoMeses)]
export const CUSTOS_FIXOS = new Set(['tfb', 'tfc'])

// Taxa final da operação indireta (todas em % a.a.).
export const taxaFinal = (custo, bndes, agente, composicao = 'capitalizada') => (composicao === 'somada' ? custo + bndes + agente : Math.expm1(Math.log1p(custo / 100) + Math.log1p(bndes / 100) + Math.log1p(agente / 100)) * 100)

// Custo financeiro nominal da TLP: parcela prefixada (TLP) composta com o IPCA projetado.
export const tlpNominal = (tlp, ipca) => Math.expm1(Math.log1p(tlp / 100) + Math.log1p(ipca / 100)) * 100

// Conferência das regras do produto. Devolve { erros: [...], avisos: [...] }: erro impede a conta; aviso só alerta.
export function conferir({ valor, participacao, prazo, carencia, custo }) {
  const erros = [], avisos = []
  if (!Number.isFinite(valor) || !(valor > 0)) erros.push('Informe um valor finito e positivo dos materiais.')
  else if (!dentroDoLimite(valor)) erros.push(erroNumerico)
  if (!Number.isFinite(participacao) || !(participacao >= REGRAS.participacaoMinPct && participacao <= REGRAS.participacaoMaxPct)) erros.push(`A participação do BNDES vai de ${REGRAS.participacaoMinPct}% a ${REGRAS.participacaoMaxPct}% dos itens financiáveis.`)
  if (!CUSTOS.some(option => option.id === custo)) erros.push('Escolha um custo financeiro suportado: TFC, TFB ou TLPCAP explícita.')
  if (!Number.isInteger(prazo) || prazo < 1) erros.push('Informe o prazo total em meses.')
  else if (prazo > REGRAS.prazoMaxMeses) erros.push(`Prazo total acima do máximo do produto: ${REGRAS.prazoMaxMeses} meses (7 anos).`)
  if (!Number.isInteger(carencia) || carencia < 0) erros.push('Informe a carência em meses (0 se não houver).')
  else {
    const fixa = CUSTOS_FIXOS.has(custo)
    const max = fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses
    if (carencia > max) erros.push(`Carência acima do máximo: ${max} meses${fixa ? ` com ${custo.toUpperCase()} (1 ano)` : ' (2 anos)'}.`)
    if (Number.isInteger(prazo) && prazo >= 1 && carencia >= prazo) erros.push('A carência precisa ser menor que o prazo total.')
  }
  const financiado = Number.isFinite(valor) && valor > 0 && Number.isFinite(participacao) && participacao > 0 ? valor * (participacao / 100) : 0
  if (financiado > REGRAS.tetoOperacao) avisos.push(`Valor financiado acima de R$ 20 milhões por operação: teto citado em materiais de divulgação de terceiros (Observatório da Indústria RS, Fomento Paraná e CNI, 2020 a 2025) que não consta na página oficial do produto em 04/11/2026; confirme com o agente.`)
  if (financiado > REGRAS.tetoCliente12m) avisos.push(`Valor acima do limite por cliente em 12 meses (R$ 150 milhões).`)
  return { erros, avisos, financiado }
}

// Cronograma: carência com juros pagos na periodicidade escolhida (sobre o saldo, capitalizados mês a mês dentro do período) e depois
// SAC ou Price mensal com juros junto do principal. taxaAnual em % a.a. é a taxa de juros; ipcaAnual (% a.a., só na TLP) é a correção
// monetária capitalizada ao saldo todo mês no perfil TLPCAP explícito, não TLP exigível. Modelo de meses iguais: não é memória contratual.
// A amortização é calculada sobre o saldo corrigido
// (SAC = saldo corrigido ÷ parcelas vincendas; Price = prestação recalculada sobre o saldo corrigido). Com ipcaAnual 0, é o SAC/Price nominal.
// Devolve parcelas [{ mes, correcao, juros, amortizacao, principal, parcela, saldo, carencia }]; `principal` é a parte da
// amortização que corresponde ao valor entregue (amortização sem a correção acumulada): a soma dos principais é o financiado, e é
// sobre ele que incide o IOF diário (Decreto 6.306/2007, art. 7º, I, b: "valor do principal de cada uma das parcelas").
const taxaValida = t => Number.isFinite(t) && t >= 0 && t <= 700
// `anos` (opcional): fração de ano de cada mês do cronograma, em dias corridos sobre os dias do ano civil (ACT/ACT), entre a liberação
// e cada vencimento real. Com ela, os juros de cada período são (1 + taxa anual)^(fração) − 1: juros pelos dias reais entre vencimentos.
// Sem ela, vale o modelo legado de meses iguais (1/12 do ano), usado só em chamadas programáticas e testes antigos.
export function cronograma({ financiado, prazo, carencia, taxaAnual, sistema, periodicidade = 1, ipcaAnual = 0, anos = null }) {
  if (!dentroDoLimite(financiado) || financiado <= 0 || !Number.isInteger(prazo) || prazo < 1 || prazo > REGRAS.prazoMaxMeses
    || !Number.isInteger(carencia) || carencia < 0 || carencia >= prazo || carencia > REGRAS.carenciaMaxMeses
    || !(Array.isArray(taxaAnual) ? taxaAnual.length === prazo && taxaAnual.every(taxaValida) : taxaValida(taxaAnual)) || !validIpcaProjection(ipcaAnual)
    || !SISTEMAS.some(option => option.id === sistema) || !PERIODICIDADES.some(option => option.id === periodicidade)
    || (anos !== null && !(Array.isArray(anos) && anos.length === prazo && anos.every(a => Number.isFinite(a) && a > 0 && a < 1)))) {
    throw new RangeError('Parâmetros inválidos para o cronograma Finame.')
  }
  // taxaAnual pode ser um número (taxa única) ou uma lista com uma taxa por mês (indexador editado parcela a parcela).
  const anualDoMes = m => (Array.isArray(taxaAnual) ? taxaAnual[m - 1] : taxaAnual)
  const taxaDoMes = m => (anos ? Math.expm1(Math.log1p(anualDoMes(m) / 100) * anos[m - 1]) : monthlyRate(anualDoMes(m), 'aa')), c = monthlyRate(ipcaAnual, 'aa')
  const parcelas = []
  let saldo = financiado
  let fator = 1 // correção acumulada desde a liberação
  let acumulado = 0
  for (let m = 1; m <= carencia; m++) {
    const correcao = saldo * c
    saldo += correcao; fator *= 1 + c
    const i = taxaDoMes(m)
    acumulado = (saldo + acumulado) * i + acumulado // juros do mês sobre o saldo corrigido + juros ainda não pagos (capitalização dentro do período)
    // Anexo I, item 5.3: contar retroativamente a partir do fim da carência.
    const paga = (carencia - m) % periodicidade === 0
    parcelas.push({ mes: m, correcao, juros: paga ? acumulado : 0, amortizacao: 0, principal: 0, parcela: paga ? acumulado : 0, saldo, carencia: true })
    if (paga) acumulado = 0
  }
  const n = prazo - carencia
  for (let k = 1; k <= n; k++) {
    const correcao = saldo * c
    saldo += correcao; fator *= 1 + c
    const i = taxaDoMes(carencia + k)
    const juros = saldo * i
    const restantes = n - k + 1
    // Amortização Price equivalente à PMT menos juros, sem cancelamento nas taxas ínfimas.
    // Price com períodos de tamanhos diferentes (dias reais): prestação constante que zera o saldo descontando cada período pela sua taxa.
    const descontos = () => { let log = 0, soma = 0; for (let j = carencia + k; j <= prazo; j++) { log += Math.log1p(taxaDoMes(j)); soma += Math.exp(-log) } return soma }
    const amortizacao = restantes === 1 ? saldo : sistema === 'price' && i !== 0 ? (anos ? saldo / descontos() - juros : saldo * (i / Math.expm1(restantes * Math.log1p(i)))) : saldo / restantes
    saldo -= amortizacao
    parcelas.push({ mes: carencia + k, correcao, juros, amortizacao, principal: amortizacao / fator, parcela: juros + amortizacao, saldo, carencia: false })
  }
  if (parcelas.some(parcela => !['correcao', 'juros', 'amortizacao', 'principal', 'parcela', 'saldo'].every(key => dentroDoLimite(parcela[key]))
    || ['juros', 'amortizacao', 'principal', 'parcela', 'saldo'].some(key => parcela[key] < 0))
    || parcelas.at(-1).saldo !== 0) throw new RangeError(erroNumerico)
  return parcelas
}

// Helper legado aproximado, fora da UI: não é apuração tributária por datas reais.
// IOF de crédito PJ sobre o cronograma: adicional único sobre o financiado + alíquota diária sobre o principal de cada parcela (sem a
// correção pelo IPCA) pelos dias até o vencimento (meses de 365/12 dias, contando a carência), limitados a 365 dias (Decreto 6.306/2007,
// art. 7º, § 1º). Por construção, nunca passa de financiado × (fixed + maxDays × daily). iof = { fixed, daily, maxDays? } em % e dias.
export function iofCronograma(financiado, parcelas, iof = IOF_PJ, dias = null) {
  const maxDias = iof.maxDays ?? IOF_PJ.maxDays
  const fixo = (financiado * (iof.fixed ?? 0)) / 100
  const porParcela = parcelas.map((p, k) => ((p.principal ?? p.amortizacao) * Math.min(dias ? dias[k] : Math.round((p.mes * 365) / 12), maxDias) * (iof.daily ?? 0)) / 100)
  const diario = porParcela.reduce((a, v) => a + v, 0)
  return { fixo, diario, total: fixo + diario, porParcela }
}

// FGI Tradicional: Encargo por Concessão de Garantia (ECG). Fonte: Anexo V ao Regulamento de Operações do FGI Tradicional
// (Circular SUP/ADIG nº 65/2026, em vigor desde 09/06/2026), itens 2.1.2, 2.1.3 e 2.1.6.
// A tabela de custo mensal do site do BNDES é só ilustrativa e não substitui esta fórmula.
// Limites: Regulamento de Operações do FGI Tradicional (Circular SUP/ADIG nº 62/2026), art. 15: cobertura de 10% a 80% do crédito,
// em múltiplos de 10, e até R$ 20 milhões de crédito garantido por tomador em cada agente financeiro.
// Vedações: Anexo I (Circular nº 51/2026), item 1: operações com recursos do BNDES indexadas à TLP, Selic ou TR capitalizadas,
// à TFBD, ou com capitalização de juros na carência não podem ter garantia do FGI Tradicional.
export const FGI = Object.freeze({
  percentualMin: 10, percentualMax: 80, percentualMultiplo: 10, padraoPercentual: 80, limiteCredito: 20_000_000,
  vedacoes: 'O FGI Tradicional não garante operação com recursos do BNDES indexada à TLP capitalizada, à Selic capitalizada, à TR capitalizada ou à TFBD, nem operação com capitalização de juros na carência.',
  fonte: 'BNDES, Regulamento de Operações do FGI Tradicional (Circular SUP/ADIG nº 62/2026): art. 15 para a cobertura de 10% a 80% em múltiplos de 10 e o limite de R$ 20 milhões por cliente em cada agente; Anexo I (Circular nº 51/2026) para as linhas aceitas e as vedações; Anexo V (Circular SUP/ADIG nº 65/2026) para a fórmula do ECG e o fator K',
  url: 'https://www.bndes.gov.br/wps/portal/site/home/financiamento/garantias/bndes-fgi/informacoes-a-instituicoes-financeiras/encargo-concessao-garantia-ecg',
})
// [prazo total máximo em meses, fator K em % por período de 30 dias]
const FATOR_K = [[3, 1.42], [6, 0.62], [9, 0.42], [12, 0.31], [15, 0.27], [18, 0.24], [21, 0.22], [24, 0.20], [27, 0.18], [30, 0.17], [33, 0.16], [36, 0.15], [39, 0.14], [45, 0.13], [48, 0.12], [54, 0.11], [60, 0.10], [69, 0.09], [78, 0.08], [90, 0.07], [102, 0.06]]
// Mensagem de erro do percentual garantido (null quando válido): 10% a 80%, só em múltiplos de 10.
export const erroPercentualFgi = (percentual) => (Number.isFinite(percentual) && percentual >= FGI.percentualMin && percentual <= FGI.percentualMax && percentual % FGI.percentualMultiplo === 0
  ? null : `Informe o percentual garantido pelo FGI de ${FGI.percentualMin} a ${FGI.percentualMax}%, em múltiplos de ${FGI.percentualMultiplo}.`)
export const fatorKFgi = (prazoMeses) => (FATOR_K.find(([max]) => prazoMeses <= max)?.[1] ?? 0.05)
// Períodos de 30 dias completos entre a liberação e o vencimento ordinário (P). Sem datas, usa meses de 365/12 dias.
export const periodos30 = (prazoMeses) => Math.floor((prazoMeses * 365) / 12 / 30)
// P pelas datas: períodos de 30 dias completos entre a liberação e o último vencimento (Date ou número em ms).
export const periodos30Datas = (liberacao, ultimoVencimento) => Math.max(0, Math.floor((+ultimoVencimento - +liberacao) / (30 * 86400000)))
// ECG = %G × K × VL × P (pago à vista); incorporado ao saldo devedor: %G × K × VL × P ÷ (1 − %G × K × P).
export function ecgFgi({ valor, percentual, prazo, periodos, incorporar }) {
  const g = percentual / 100, k = fatorKFgi(prazo) / 100, p = periodos ?? periodos30(prazo)
  const denominador = incorporar ? 1 - g * k * p : 1
  return { k: k * 100, p, ecg: (g * k * valor * p) / denominador }
}

// Vencimento contratual da parcela `mes`: todo dia 15 do mês (a contar do mês da liberação). Se o dia 15 não for dia útil
// (fim de semana ou feriado nacional), vence no próximo dia útil. Devolve Date ao meio-dia, como o restante da tela.
export function vencimentoDia15(liberacao, mes, ctx = {}) {
  const ref = new Date(liberacao.getFullYear(), liberacao.getMonth() + mes, 15, 12)
  const util = nextBusinessDay(iso(ref.getFullYear(), ref.getMonth() + 1, 15), ['BR'], ctx)
  const [y, m, d] = util.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

// Calendário real da operação: vencimentos no dia 15 (ou no próximo dia útil, feriados nacionais) contados da liberação.
// Devolve as datas (AAAA-MM-DD), os dias corridos desde a liberação e a fração de ano ACT/ACT de cada período
// (dias corridos sobre 365 ou 366, separados por ano civil), base dos juros de cada parcela.
const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function calendarioFiname(liberacao, prazo, ctx = {}) {
  if (Object.prototype.toString.call(liberacao) !== '[object Date]' || Number.isNaN(+liberacao) || !Number.isInteger(prazo) || prazo < 1 || prazo > REGRAS.prazoMaxMeses) return null
  const inicio = isoLocal(liberacao)
  const datas = Array.from({ length: prazo }, (_, k) => isoLocal(vencimentoDia15(liberacao, k + 1, ctx)))
  const civil = t => Date.parse(`${t}T00:00:00Z`) / 86400000
  const dias = datas.map(d => civil(d) - civil(inicio))
  if (dias[0] <= 0 || dias.some((d, k) => k && d <= dias[k - 1])) return null
  const anos = datas.map((d, k) => actualActualCalendarYears(k ? datas[k - 1] : inicio, d).fraction)
  return { inicio, datas, dias, anos }
}

// Vencimento da parcela `mes` contado da liberação: mesmo dia do mês, recuando para o último dia quando o mês é mais curto.
export function vencimento(liberacao, mes) {
  const d = new Date(liberacao)
  const alvo = new Date(d.getFullYear(), d.getMonth() + mes + 1, 0) // último dia do mês-alvo
  return new Date(d.getFullYear(), d.getMonth() + mes, Math.min(d.getDate(), alvo.getDate()))
}

// Resumo da operação. Entradas em % a.a. e R$. Na TFB e na TFC, custoFinanceiro é a taxa fixa e a taxa é nominal.
// custo='tlp' exige perfilTlp='tlpcap': modelo capitalizado histórico, disponível somente para uso programático explícito.
// TLP exigível usa bndesTlpExigivel.js; nunca presumir que estes perfis são intercambiáveis.
export const IOF_ZERO = { fixed: 0, daily: 0 }
export const validIpcaProjection = ipca => Number.isFinite(ipca) && ipca >= -50 && ipca <= 100
export function parseIpcaProjection(text) {
  const value = String(text).trim(), negative = value.startsWith('-')
  const parsed = parseDecimal(negative ? value.slice(1) : value)
  return parsed === null ? null : negative ? -parsed : parsed
}
export function simular({ valor, participacao = 100, prazo, carencia = 0, custo, custoFinanceiro, custoPorMes, ipca = 0, perfilTlp, taxaBndes, taxaAgente, sistema = 'sac', periodicidade = 1, composicao = 'capitalizada', iof = IOF_ZERO, tac = 0, fgi = null, dataLiberacao = null, feriados = {} }) {
  const check = conferir({ valor, participacao, prazo, carencia, custo })
  const iofOk = iof && [iof.fixed, iof.daily].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
    && (iof.maxDays == null || (Number.isInteger(iof.maxDays) && iof.maxDays >= 0 && iof.maxDays <= IOF_PJ.maxDays))
  const ipcaOk = custo !== 'tlp' || validIpcaProjection(ipca)
  const taxasOk = [custoFinanceiro, taxaBndes, taxaAgente].every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
  const porMesOk = custoPorMes == null || (Array.isArray(custoPorMes) && custoPorMes.length === prazo && custoPorMes.every(v => Number.isFinite(v) && v >= 0 && v <= 100))
  if (!porMesOk) check.erros.push('Informe o indexador de cada parcela em % a.a., de 0 a 100.')
  if (!(Number.isFinite(tac) && tac >= 0 && tac <= 1_000_000_000)) check.erros.push('Informe a TAC em R$, de zero em diante.')
  if (fgi && erroPercentualFgi(fgi.percentual)) check.erros.push(erroPercentualFgi(fgi.percentual))
  if (fgi && custo === 'tlp') check.erros.push(`Retire a garantia do FGI: esta linha usa TLP capitalizada. ${FGI.vedacoes}`)
  if (!taxasOk) check.erros.push('Informe o custo financeiro, a taxa do BNDES e o spread da instituição em % a.a.')
  if (!ipcaOk) check.erros.push('Informe o IPCA esperado de -50 a 100% a.a., limite deste modelo.')
  if (!iofOk) check.erros.push('Informe as alíquotas do IOF em % (0 e 0 se o agente confirmar alíquota zero).')
  if (!SISTEMAS.some(option => option.id === sistema)) check.erros.push('Escolha SAC ou Price.')
  if (!PERIODICIDADES.some(option => option.id === periodicidade)) check.erros.push('Escolha periodicidade mensal, trimestral ou semestral.')
  if (!COMPOSICOES.some(option => option.id === composicao)) check.erros.push('Escolha composição capitalizada ou somada.')
  if (custo === 'tlp' && perfilTlp !== 'tlpcap') check.erros.push('TLP exigível requer a projeção própria. Este motor só aceita o perfil TLPCAP capitalizado explicitamente.')
  // Com a data da liberação, juros pelos dias reais entre vencimentos (dia 15 ou próximo dia útil); sem ela, modelo legado de meses iguais.
  const calendario = dataLiberacao !== null && Number.isInteger(prazo) ? calendarioFiname(dataLiberacao, prazo, feriados) : null
  if (dataLiberacao !== null && !calendario) check.erros.push('Informe uma data de liberação válida.')
  if (check.erros.length) return { ok: false, ...check }
  const anos = calendario?.anos ?? null
  const liberado = check.financiado
  const ecgCalc = fgi ? ecgFgi({ valor: liberado, percentual: fgi.percentual, prazo, periodos: fgi.periodos, incorporar: !!fgi.incorporar }) : null
  const ecg = ecgCalc?.ecg ?? 0
  const ecgIncorporado = !!(fgi && fgi.incorporar)
  const financiado = liberado + (ecgIncorporado ? ecg : 0) // principal do cronograma: valor liberado mais o ECG financiado
  if (fgi && financiado > FGI.limiteCredito) return { ok: false, ...check, erros: [`Com garantia do FGI, o crédito é limitado a ${FGI.limiteCredito.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por cliente em cada agente financeiro, somadas as outras operações garantidas. Reduza o valor ou retire a garantia.`] }
  const taxa = taxaFinal(custoFinanceiro, taxaBndes, taxaAgente, composicao)
  const ipcaAnual = custo === 'tlp' ? ipca : 0
  // Indexador editado por parcela: cada mês usa a própria taxa final; sem edição, uma taxa única (resultado idêntico ao anterior).
  const serie = (bndes, agente) => (custoPorMes ? custoPorMes.map(c => taxaFinal(c, bndes, agente, composicao)) : taxaFinal(custoFinanceiro, bndes, agente, composicao))
  const editados = custoPorMes ? custoPorMes.filter(c => c !== custoFinanceiro).length : 0
  if (editados) check.avisos.push(`Indexador alterado em ${editados} ${editados === 1 ? 'parcela' : 'parcelas'}: a taxa final em destaque usa o valor da cotação; o cronograma usa o indexador informado em cada linha.`)
  let parcelas
  try { parcelas = cronograma({ financiado, prazo, carencia, taxaAnual: serie(taxaBndes, taxaAgente), sistema, periodicidade, ipcaAnual, anos }) }
  catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { ok: false, ...check, erros: [erroNumerico] }
  }
  const jurosCarencia = somar(parcelas.filter((p) => p.carencia).map(p => p.juros))
  const correcao = somar(parcelas.map(p => p.correcao))
  const amort = parcelas.filter((p) => !p.carencia)
  const iofCalc = iofCronograma(financiado, parcelas, iof, calendario?.dias ?? null)
  // Quanto dos juros remunera cada parte: custo financeiro (só o custo), BNDES (custo + BNDES menos só o custo) e spread do agente
  // (taxa completa menos custo + BNDES), sempre com o mesmo cronograma; a soma fecha nos juros totais.
  const jurosDe = (t) => somar(cronograma({ financiado, prazo, carencia, taxaAnual: t, sistema, periodicidade, ipcaAnual, anos }).map(p => p.juros))
  let jSoCusto, jSemAgente
  try {
    jSoCusto = jurosDe(serie(0, 0))
    jSemAgente = jurosDe(serie(taxaBndes, 0))
  } catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { ok: false, ...check, erros: [erroNumerico] }
  }
  const juros = somar(parcelas.map(p => p.juros))
  const atribuicao = { custoFinanceiro: jSoCusto, bndes: jSemAgente - jSoCusto, agente: juros - jSemAgente }
  const spreadAgentePp = taxa - taxaFinal(custoFinanceiro, taxaBndes, 0, composicao) // quanto o spread do agente acrescenta à taxa final, em pontos
  // Fluxo parcela a parcela: saldo inicial (antes da correção do mês), IOF diário da parcela e total pago no vencimento.
  const fluxo = parcelas.map((p, k) => ({ ...p, saldoInicial: k ? parcelas[k - 1].saldo : financiado, iof: iofCalc.porParcela[k], pago: p.parcela + iofCalc.porParcela[k], ...(calendario ? { vencimento: calendario.datas[k], dias: calendario.dias[k], anos: calendario.anos[k] } : {}) }))
  const ecgAVista = fgi && !ecgIncorporado ? ecg : 0
  const total = somar(fluxo.map(p => p.pago)) + iofCalc.fixo + tac + ecgAVista
  const somaAmortizacao = somar(parcelas.map(p => p.amortizacao)), somaPrincipal = somar(parcelas.map(p => p.principal))
  const fecha = (a, b) => Math.abs(a - b) < 0.005
  if (![total, juros, correcao, jurosCarencia, ...Object.values(atribuicao), iofCalc.total, iofCalc.fixo, iofCalc.diario].every(dentroDoLimite)
    || !fluxo.every(p => dentroDoLimite(p.pago) && dentroDoLimite(p.iof))
    || !fecha(somaAmortizacao, financiado + correcao) || !fecha(somaPrincipal, financiado)
    || !fecha(total, financiado + correcao + juros + iofCalc.total + tac + ecgAVista)) {
    return { ok: false, ...check, erros: [erroNumerico] }
  }
  // CET (Resolução CMN 4.881/2020, art. 4º): só com o calendário real. Valor líquido na liberação = liberado − IOF − TAC − ECG à vista;
  // pagamentos de cada vencimento descontados em dias corridos/365. Devolve null quando o fluxo não fecha (ex.: encargos ≥ valor liberado).
  // O IOF (adicional e diário) é cobrado na liberação (Decreto 6.306/2007): no CET sai todo do valor líquido, e as parcelas entram sem ele.
  const liquido = liberado - iofCalc.total - tac - ecgAVista
  const cetAnual = calendario ? creditCet(liquido, fluxo.filter(p => p.parcela > 0).map(p => ({ days: p.dias, payment: p.parcela }))) : null
  const cet = cetAnual === null ? null : { anual: cetAnual * 100, mensal: Math.expm1(Math.log1p(cetAnual) / 12) * 100, liquido }
  return {
    ok: true, financiado, liberado, tac, cet, fgi: fgi ? { percentual: fgi.percentual, incorporado: ecgIncorporado, ecg, k: ecgCalc.k, periodos: ecgCalc.p } : null, taxa, taxaMensal: monthlyRate(taxa, 'aa') * 100, taxaNominal: custo === 'tlp' ? tlpNominal(taxa, ipca) : taxa, composicao, parcelas: fluxo,
    perfil: custo === 'tlp' ? 'tlpcap' : custo, calendario: calendario ? 'datas-reais-act-act' : 'meses-iguais-hipoteticos', liberacao: calendario?.inicio ?? null,
    jurosCarencia, juros, correcao, atribuicao, spreadAgentePp, iof: iofCalc.total, iofFixo: iofCalc.fixo, iofDiario: iofCalc.diario,
    primeiraParcela: amort[0]?.parcela ?? 0, ultimaParcela: amort.at(-1)?.parcela ?? 0, parcelasAmortizacao: amort.length,
    total, recursosProprios: valor - liberado, avisos: check.avisos,
  }
}

// Equivalente em CDI + spread (composto): o spread que, capitalizado sobre o CDI atual, dá a mesma taxa final.
export const spreadSobreCdi = (taxa, cdi) => (Number.isFinite(cdi) ? ((1 + taxa / 100) / (1 + cdi / 100) - 1) * 100 : null)

// IPCA esperado para a projeção da TLP: a mediana do Focus do ano seguinte (a operação dura anos; o ano corrente está quase fechado),
// ou do ano corrente quando o seguinte ainda não existe. Devolve { ano, valor } ou null.
export function ipcaEsperado(focus, agora = Date.now()) {
  const row = focus?.rows?.find((r) => r.indicator === 'IPCA')
  const y = new Date(agora).getFullYear()
  for (const ano of [String(y + 1), String(y)]) {
    const v = row?.values?.[ano]?.median
    if (Number.isFinite(v)) return { ano, valor: v }
  }
  return null
}
