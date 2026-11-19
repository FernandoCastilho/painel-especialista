// Finame Materiais com custo pós-fixado: TLP, Taxa LCD e TFBD no mesmo cronograma da TFC e da TFB.
// Pedido do Fernando em 19/11/2026 (combinado aprovado): a taxa do painel entra como a TFC/TFB, a hipótese futura
// (IPCA, Selic ou dólar) vem do Focus ano a ano e é editável. Projeção, não memória contratual.
//
// Regras de cada custo (tabela de premissas da calculadora BNDES e Anexo IV da Circular 13/2022):
// - TLP (exigível): juros = saldo × [(1 + IPCA)^(du/252) × (1 + J ⊕ BNDES ⊕ agente)^(du/252) − 1]. O IPCA é cobrado
//   com os juros e não corrige o saldo. Base 252 dias úteis.
// - Taxa LCD: a Selic capitaliza no saldo, (1 + Selic)^(du/252); juros = saldo corrigido × [(1 + LD1 ⊕ BNDES ⊕ agente)^(du/252) − 1].
//   Base 252 dias úteis.
// - TFBD: o saldo em reais acompanha o dólar (moeda 604); juros proporcionais = saldo corrigido × (TFBD ⊕ BNDES ⊕ agente) × dias/360.
//   Base 360 dias corridos.
// "⊕" é a composição capitalizada do BNDES: (1 + a)(1 + b)(1 + c) − 1.
// Dias úteis: feriados nacionais e da praça do contrato. Vencimentos: dia 15 ou próximo dia útil (mesmo calendário da TFC/TFB).
import { REGRAS, PERIODICIDADES, calendarioFiname, taxaFinal } from './finameMateriais.js'
import { contractCalendars } from './pracaContrato.js'
import { busDaysIn } from './holidays.js'
import { creditCet } from './creditComparison.js'
import { monthlyRate } from './emprestimo.js'

export const CUSTOS_POS = Object.freeze(['tlp', 'lcd', 'tfbd'])
export const INDICE_POS = Object.freeze({
  tlp: { id: 'ipca', rotulo: 'IPCA', unidade: '% a.a.', focus: 'IPCA', base: 252 },
  lcd: { id: 'selic', rotulo: 'Selic', unidade: '% a.a.', focus: 'Selic', base: 252 },
  tfbd: { id: 'cambio', rotulo: 'Dólar', unidade: 'R$ por US$', focus: 'Câmbio', base: 360 },
})
// TFBD: TD1 até 24 meses, TD2 acima de 24 até 72, TD3 acima de 72 (Moedas Contratuais do BNDES).
export const codigoTfbd = prazo => (prazo <= 24 ? 'TD1' : prazo <= 72 ? 'TD2' : 'TD3')

const DAY = 86400000
const civil = iso => Date.parse(`${iso}T00:00:00Z`) / DAY
const isoDe = dias => new Date(dias * DAY).toISOString().slice(0, 10)
const somar = values => values.reduce((a, b) => a + b, 0)

// Trajetória anual: [{ ano: 2026, valor }, ...] em ordem. Ano sem valor usa o último ano anterior informado
// (e, antes do primeiro, o primeiro). Devolve o valor do ano.
export function valorDoAno(trajetoria, ano) {
  let escolhido = trajetoria[0].valor
  for (const item of trajetoria) if (item.ano <= ano) escolhido = item.valor
  return escolhido
}

// Trajetória do Focus para o indicador (mediana por ano), do ano da liberação em diante. Devolve [] se não houver.
export function trajetoriaFocus(focus, indicador, anoInicial) {
  const row = focus?.rows?.find(r => r.indicator === indicador)
  if (!row?.values) return []
  return Object.entries(row.values).map(([ano, v]) => ({ ano: Number(ano), valor: v?.median })).filter(item => Number.isInteger(item.ano) && item.ano >= anoInicial && Number.isFinite(item.valor)).sort((a, b) => a.ano - b.ano)
}

// Fator do índice de taxa (IPCA ou Selic) entre duas datas: produto por ano civil de (1 + taxa do ano)^(du no ano / 252).
function fatorTaxaAnual(trajetoria, de, ate, cals, ctx) {
  let log = 0, inicio = de, du = 0
  while (civil(inicio) < civil(ate)) {
    // Ano do primeiro dia que conta (o dia inicial não conta): em 31/12, o segmento seguinte já é do ano novo.
    const ano = Number(isoDe(civil(inicio) + 1).slice(0, 4))
    const fimAno = `${ano}-12-31`
    const fim = civil(fimAno) < civil(ate) ? fimAno : ate
    const n = busDaysIn(inicio, fim, cals, ctx)
    du += n
    log += Math.log1p(valorDoAno(trajetoria, ano) / 100) * (n / 252)
    inicio = fim
  }
  return { fator: Math.exp(log), du }
}

// Dólar projetado numa data: interpolação geométrica entre o dólar do dia da liberação e o valor do Focus no fim de cada ano.
// Depois do último ano informado, fica constante.
export function cambioNaData(inicial, liberacao, trajetoria, iso) {
  const pontos = [[civil(liberacao), inicial], ...trajetoria.map(item => [civil(`${item.ano}-12-31`), item.valor]).filter(([t]) => t > civil(liberacao))]
  const t = civil(iso)
  if (t <= pontos[0][0]) return inicial
  for (let k = 1; k < pontos.length; k++) {
    const [t0, v0] = pontos[k - 1], [t1, v1] = pontos[k]
    if (t <= t1) return v0 * Math.exp(Math.log(v1 / v0) * ((t - t0) / (t1 - t0)))
  }
  return pontos.at(-1)[1]
}

const trajetoriaValida = (trajetoria, custo) => Array.isArray(trajetoria) && trajetoria.length > 0 && trajetoria.length <= 30
  && trajetoria.every((item, k) => Number.isInteger(item.ano) && item.ano >= 2000 && item.ano <= 2100 && (k === 0 || item.ano > trajetoria[k - 1].ano)
    && Number.isFinite(item.valor) && (custo === 'tfbd' ? item.valor > 0 && item.valor <= 100 : item.valor > -50 && item.valor <= 100))

// Cronograma e resultado no mesmo formato de `simular` (finameMateriais.js), para a tela, o comparativo, o PDF e a apresentação.
// Entradas: custo ('tlp' | 'lcd' | 'tfbd'), taxaFixa (J, LD1 ou TFBD, % a.a.), trajetoria do índice (ano a ano),
// cambioInicial (R$/US$ no dia da liberação, só TFBD) e as condições comuns da operação.
export function simularPos({ custo, valor, participacao = 100, prazo, carencia = 0, taxaFixa, taxaBndes, taxaAgente, trajetoria, cambioInicial = null, periodicidade = 1, composicao = 'capitalizada', tac = 0, fgi = null, dataLiberacao, feriados = {}, calendarios = ['BR'] }) {
  const erros = []
  if (!CUSTOS_POS.includes(custo)) erros.push('Custo pós-fixado não suportado.')
  if (!(Number.isFinite(valor) && valor > 0 && valor <= 1e12)) erros.push('Informe um valor maior que zero.')
  if (!(Number.isFinite(participacao) && participacao >= REGRAS.participacaoMinPct && participacao <= REGRAS.participacaoMaxPct)) erros.push('Participação de 1 a 100%.')
  if (!(Number.isInteger(prazo) && prazo >= 1 && prazo <= REGRAS.prazoMaxMeses)) erros.push(`Prazo de 1 a ${REGRAS.prazoMaxMeses} meses.`)
  if (!(Number.isInteger(carencia) && carencia >= 0 && carencia <= REGRAS.carenciaMaxMeses && (!Number.isInteger(prazo) || carencia < prazo))) erros.push(`Carência de 0 a ${REGRAS.carenciaMaxMeses} meses, menor que o prazo.`)
  if (![taxaBndes, taxaAgente].every(v => Number.isFinite(v) && v >= 0 && v <= 100)) erros.push('Informe a taxa do BNDES e o spread da instituição em % a.a.')
  // LD1 pode ser negativa; J e TFBD também ficam limitadas a −50% para não inverter o sinal dos juros por erro de digitação.
  if (!(Number.isFinite(taxaFixa) && taxaFixa > -50 && taxaFixa <= 100)) erros.push('Informe a taxa de referência em % a.a.')
  if (!trajetoriaValida(trajetoria, custo)) erros.push(custo === 'tfbd' ? 'Informe o dólar projetado de cada ano (R$ por US$).' : `Informe o ${INDICE_POS[custo]?.rotulo ?? 'índice'} projetado de cada ano, de −50 a 100% a.a.`)
  if (custo === 'tfbd' && !(Number.isFinite(cambioInicial) && cambioInicial > 0 && cambioInicial <= 100)) erros.push('Informe o dólar do dia da liberação (R$ por US$).')
  if (!(Number.isFinite(tac) && tac >= 0 && tac <= 1e9)) erros.push('Informe a TAC em R$, de zero em diante.')
  if (!PERIODICIDADES.some(p => p.id === periodicidade)) erros.push('Escolha periodicidade mensal, trimestral ou semestral.')
  if (fgi) erros.push('Retire a garantia do FGI: o FGI Tradicional não aceita operações em TLP, Selic/LCD capitalizada ou TFBD (Anexo I do Regulamento, item 1).')
  const cals = contractCalendars(calendarios)
  if (!cals) erros.push('Escolha a praça do contrato entre as praças disponíveis.')
  const calendario = cals && Number.isInteger(prazo) && prazo >= 1 && prazo <= REGRAS.prazoMaxMeses ? calendarioFiname(dataLiberacao, prazo, feriados, calendarios) : null
  if (!calendario) erros.push('Informe uma data de liberação válida.')
  if (erros.length) return { ok: false, erros, avisos: [] }

  const liberado = valor * participacao / 100
  const taxa = taxaFinal(taxaFixa, taxaBndes, taxaAgente, composicao)
  const inicio = calendario.inicio
  const anoInicial = Number(inicio.slice(0, 4))
  // Períodos do calendário real: de/ate, dias corridos e o fator do índice em cada um.
  const periodos = calendario.datas.map((ate, k) => {
    const de = k ? calendario.datas[k - 1] : inicio
    const corridos = civil(ate) - civil(de)
    if (custo === 'tfbd') {
      const c0 = cambioNaData(cambioInicial, inicio, trajetoria, de), c1 = cambioNaData(cambioInicial, inicio, trajetoria, ate)
      return { de, ate, corridos, du: busDaysIn(de, ate, cals, feriados), fatorIndice: c1 / c0, cambio: c1 }
    }
    const { fator, du } = fatorTaxaAnual(trajetoria, de, ate, cals, feriados)
    return { de, ate, corridos, du, fatorIndice: fator }
  })
  if (periodos.some(p => !(p.du > 0) && custo !== 'tfbd')) return { ok: false, erros: ['Período sem dia útil no calendário: confira a data da liberação.'], avisos: [] }

  // Juros do período sobre a base, para uma taxa fixa anual composta (sem o índice).
  const crescimentoFixo = (anual, p) => (custo === 'tfbd' ? (anual / 100) * (p.corridos / 360) : Math.expm1(Math.log1p(anual / 100) * (p.du / 252)))

  // Monta o fluxo para uma taxa anual fixa e um "modo índice": 'projetado' usa a trajetória; 'zero' tira o índice (CET parte fixa).
  const fluxoPara = (anualFixa, indice = 'projetado') => {
    const parcelas = []
    let saldo = liberado, fator = 1, acumulado = 0
    const n = prazo - carencia
    for (let m = 1; m <= prazo; m++) {
      const p = periodos[m - 1]
      const fIndice = indice === 'zero' ? 1 : p.fatorIndice
      let correcao = 0, juros
      if (custo === 'tlp') {
        // TLP exigível: IPCA cobrado com os juros, sem corrigir o saldo.
        juros = (saldo + acumulado) * ((1 + crescimentoFixo(anualFixa, p)) * fIndice - 1)
      } else {
        // LCD e TFBD: o índice corrige o saldo; a parte fixa incide sobre o saldo corrigido.
        correcao = saldo * (fIndice - 1)
        saldo += correcao; fator *= fIndice
        // Juros da carência ainda não pagos também acompanham o índice até o pagamento.
        const correcaoAcumulado = acumulado * (fIndice - 1)
        juros = (saldo + acumulado + correcaoAcumulado) * crescimentoFixo(anualFixa, p) + correcaoAcumulado
      }
      const naCarencia = m <= carencia
      if (naCarencia) {
        acumulado += juros
        // Anexo I, item 5.3: cobranças contadas retroativamente a partir do fim da carência.
        const paga = (carencia - m) % periodicidade === 0
        const pagos = paga ? acumulado : 0
        if (paga) acumulado = 0
        parcelas.push({ mes: m, correcao, juros: pagos, jurosApurados: juros, amortizacao: 0, principal: 0, parcela: pagos, saldo, carencia: true })
      } else {
        const restantes = n - (m - carencia) + 1
        const amortizacao = restantes === 1 ? saldo : saldo / restantes
        saldo -= amortizacao
        parcelas.push({ mes: m, correcao, juros, jurosApurados: juros, amortizacao, principal: amortizacao / fator, parcela: juros + amortizacao, saldo: restantes === 1 ? 0 : saldo, carencia: false })
      }
    }
    return parcelas
  }

  const parcelas = fluxoPara(taxa)
  if (parcelas.some(p => !Number.isFinite(p.parcela) || p.parcela < -0.005 || !Number.isFinite(p.saldo))) {
    return { ok: false, erros: ['Com esta hipótese do índice, alguma parcela ficaria negativa. Revise a projeção.'], avisos: [] }
  }
  const juros = somar(parcelas.map(p => p.juros))
  const correcao = somar(parcelas.map(p => p.correcao))
  const jurosCarencia = somar(parcelas.filter(p => p.carencia).map(p => p.juros))
  // Atribuição em camadas, no mesmo cronograma e com o mesmo índice: custo financeiro (índice + taxa fixa), + BNDES, + agente.
  const jurosDe = anual => somar(fluxoPara(anual).map(p => p.juros))
  const jSoCusto = jurosDe(taxaFinal(taxaFixa, 0, 0, composicao)), jSemAgente = jurosDe(taxaFinal(taxaFixa, taxaBndes, 0, composicao))
  const atribuicao = { custoFinanceiro: jSoCusto, bndes: jSemAgente - jSoCusto, agente: juros - jSemAgente }
  const fluxo = parcelas.map((p, k) => ({ ...p, saldoInicial: k ? parcelas[k - 1].saldo : liberado, iof: 0, pago: p.parcela, vencimento: calendario.datas[k], dias: calendario.dias[k], anos: calendario.anos[k], du: periodos[k].du, fatorIndice: periodos[k].fatorIndice, ...(custo === 'tfbd' ? { cambio: periodos[k].cambio } : {}) }))
  const total = somar(fluxo.map(p => p.pago)) + tac
  const amort = fluxo.filter(p => !p.carencia)
  const fecha = Math.abs(somar(parcelas.map(p => p.amortizacao)) - (liberado + correcao)) < 0.01 && Math.abs(total - (liberado + correcao + juros + tac)) < 0.01
  if (!fecha) return { ok: false, erros: ['Resultado sem fechamento em centavos. Reduza o valor ou revise as taxas.'], avisos: [] }

  // CET (Res. CMN 4.881/2020): valor líquido na liberação = liberado − TAC (IOF zero nesta tela); dias corridos/365.
  // Art. 5º: o índice (IPCA, Selic, variação cambial) fica fora do CET da parte fixa; o projetado inclui a hipótese do Focus.
  const liquido = liberado - tac
  const cetDe = rows => {
    const anual = creditCet(liquido, rows.filter(p => p.parcela > 0).map(p => ({ days: calendario.dias[p.mes - 1], payment: p.parcela })))
    return anual === null ? null : { anual: anual * 100, mensal: Math.expm1(Math.log1p(anual) / 12) * 100, liquido }
  }
  const cet = cetDe(fluxo)
  const cetFixo = cetDe(fluxoPara(taxa, 'zero'))
  // Taxa nominal projetada do primeiro ano (índice do ano da liberação composto com a taxa final), só para o equivalente em CDI.
  const indicePrimeiroAno = custo === 'tfbd'
    ? (cambioNaData(cambioInicial, inicio, trajetoria, isoDe(civil(inicio) + 365)) / cambioInicial - 1) * 100
    : valorDoAno(trajetoria, anoInicial)
  const taxaNominal = custo === 'tfbd' ? ((1 + taxa / 100) * (1 + indicePrimeiroAno / 100) - 1) * 100 : Math.expm1(Math.log1p(taxa / 100) + Math.log1p(indicePrimeiroAno / 100)) * 100
  const avisos = []
  if (custo === 'tfbd') avisos.push('TFBD não disponível no Itaú (tabela de premissas da calculadora BNDES).')
  return {
    ok: true, perfil: custo, financiado: liberado, liberado, tac, cet, cetFixo, fgi: null, taxa, taxaFixa,
    taxaMensal: monthlyRate(taxa, 'aa') * 100, taxaNominal, composicao, parcelas: fluxo,
    calendario: 'datas-reais-act-act', baseJuros: custo === 'tfbd' ? 'dias corridos/360' : 'dias úteis/252', liberacao: inicio,
    indice: { ...INDICE_POS[custo], trajetoria, cambioInicial: custo === 'tfbd' ? cambioInicial : null, primeiroAno: indicePrimeiroAno },
    jurosCarencia, juros, correcao, atribuicao, spreadAgentePp: taxa - taxaFinal(taxaFixa, taxaBndes, 0, composicao),
    iof: 0, iofFixo: 0, iofDiario: 0,
    primeiraParcela: amort[0]?.parcela ?? 0, ultimaParcela: amort.at(-1)?.parcela ?? 0, parcelasAmortizacao: amort.length,
    total, recursosProprios: valor - liberado, avisos,
  }
}
