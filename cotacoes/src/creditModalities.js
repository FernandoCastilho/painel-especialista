// Comparador de Crédito por modalidade. Camada de orquestração: cada modalidade usa o motor que já existe
// (Capital de Giro, BNDES, FINIMP, Conta Garantida, Desconto de duplicata) sem alterar nenhuma regra de cálculo.
// Aqui só se organiza a entrada de cada coluna e se leva o resultado a um formato comum: valor líquido, fluxo de pagamentos e CET.
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { creditOperation, equivalentCredit, creditCet } from './creditComparison.js'
import { cgDate, cgAddDays, cgInitialForm, parseContaGarantidaForm, contaGarantidaCet } from './contaGarantida.js'
import { finimpCost, FINIMP_TERMS } from './finimpComparison.js'
import { discountOperation } from './analiseDesconto.js'
import { simular, periodos30Datas, vencimentoDia15, PORTES, CUSTOS, COMPOSICOES, PERIODICIDADES, FGI, taxaFinal, IOF_ZERO } from './finameMateriais.js'
import { resolveCreditIof } from './iofRules.js'

export const MAX_COLUMNS = 5
export const MIN_COLUMNS = 2
export const MODALITIES = Object.freeze([
  { id: 'giro-pre', label: 'Giro prefixado', hint: 'Capital de giro com taxa fixa' },
  { id: 'giro-cdi', label: 'Giro pós-CDI', hint: 'Capital de giro com percentual do CDI mais spread' },
  { id: 'bndes', label: 'BNDES', hint: 'Repasse indireto: custo financeiro, taxa do BNDES e spread do agente' },
  { id: 'finimp', label: 'FINIMP', hint: 'Financiamento à importação, em reais pelo câmbio informado' },
  { id: 'conta-garantida', label: 'Conta Garantida', hint: 'Juros e IOF sobre o saldo utilizado' },
  { id: 'desconto', label: 'Desconto de duplicata', hint: 'Antecipação de títulos, por fora ou por dentro' },
  { id: 'outra', label: 'Outra modalidade', hint: 'Condições livres informadas pelo usuário' },
])
export const modalityLabel = id => MODALITIES.find(m => m.id === id)?.label ?? 'Modalidade'
export const DEFAULT_MODALITIES = Object.freeze(['giro-pre', 'giro-cdi', 'bndes', 'finimp', 'outra'])
export const SYSTEM_OPTIONS = Object.freeze([['price', 'Price'], ['sac', 'SAC'], ['bullet', 'Bullet capitalizado']])
export const FINIMP_CURRENCY_LIST = Object.freeze(['USD', 'EUR', 'JPY', 'CNH', 'BRL'])

const fail = error => ({ ok: false, error })
const sumOf = values => values.reduce((a, b) => a + b, 0)
const toMoneyText = n => n.toFixed(2).replace('.', ',')

export function addMonths(start, months) {
  const from = cgDate(start)
  if (!from || !Number.isInteger(months) || months < 0 || months > 1200) return null
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(from.getUTCDate(), last))
  return target.toISOString().slice(0, 10)
}
const integerText = text => /^\d+$/.test(String(text ?? '').trim()) ? Number(text) : null
const money = (text, optional = false) => { const p = parseMoneyInput(text, { optional }); return p.ok ? p.value : null }
const percent = text => { const n = parseDecimal(text); return Number.isFinite(n) ? n : null }

// Valor de cada coluna: campo próprio quando preenchido, senão o comum. Texto vazio no próprio campo = seguir o comum.
export function newColumn(modality = 'giro-pre') {
  return {
    ...baseColumn(),
    modality, ...(modality === 'giro-cdi' ? { rate: '0,35', rateType: 'cdi' } : {}),
  }
}
function baseColumn() {
  return {
    modality: 'giro-pre',
    // Condições próprias (vazio = igual às condições comuns).
    value: '', term: '', grace: '', system: '',
    // Capital de giro e outra modalidade.
    rateType: 'fixed', rate: '1,45', unit: 'am', cdiPercent: '100', fees: '0', monthlyFees: '0', holidays: '',
    profile: 'pj', eligible: false, guarantee: '', guaranteeValue: '',
    name: '', declaredCet: '',
    // BNDES.
    bLine: 'tfb', bCost: '10,00', bPorte: 'mpme', bAgent: '3,00', bComp: 'capitalizada', bPeriod: '1', bIpca: '4,50',
    bIof: 'zero', bTac: '0', bPart: '100', bFgi: '', bFgiInc: false,
    // FINIMP.
    fCurrency: 'USD', fFx: '5,50', fDays: '180', fRate: '6,00', fFlat: '0,50', fTac: '0',
    // Conta Garantida.
    cRate: '2,00', cBase: '30', cConv: 'proportional', cCount: 'calendar', cDays: '30',
    // Desconto de duplicata.
    dRate: '1,83', dConv: 'commercial30', dFeeMode: 'total', dFee: '0', dTac: '0', dTitles: '1', dDays: '60',
  }
}
export const initialColumns = () => DEFAULT_MODALITIES.map(newColumn)
export const initialShared = (today, defaultValue = '500.000,00') => ({ value: defaultValue, term: '24', grace: '0', system: 'price', start: today, regime: 'presumido', adicional: true })

function resolve(col, shared, valueOverride) {
  const valueText = valueOverride != null ? toMoneyText(valueOverride) : (col.value.trim() || shared.value)
  const system = col.system || shared.system
  return { valueText, value: money(valueText), term: integerText(col.term.trim() || shared.term), grace: integerText(col.grace.trim() || shared.grace), system, start: shared.start }
}

function conditions(col) {
  const guaranteeValue = col.guaranteeValue.trim() ? money(col.guaranteeValue) : null
  return { guarantee: col.guarantee.trim() || 'Não informada', guaranteeValue: guaranteeValue ?? null, guaranteeInvalid: col.guaranteeValue.trim() !== '' && guaranteeValue === null }
}

// Resultado comum. `rows` é o fluxo de pagamentos futuros; o líquido é o que a empresa recebe na liberação.
// `cet` é o CET regulatório (Res. CMN 4.881/2020): no pós-fixado, só a parte fixa (CDI zero, art. 5º). `projectedCost` é a
// taxa anual do fluxo com o CDI projetado. Nas modalidades prefixadas os dois coincidem.
function finish(base) {
  const { value, net, rows, start, interest, iof, fees, guaranteeInfo, notes = [], label, rateLabel, systemLabel } = base
  const paid = sumOf(rows.map(r => r.payment))
  let cumulative = 0
  const flow = rows.map((r, k) => ({ ...r, number: k + 1, cumulative: (cumulative += r.payment) }))
  const projectedCost = creditCet(net, flow)
  const floating = base.cetRegulatory !== undefined
  const cet = floating ? base.cetRegulatory : projectedCost
  const coverage = guaranteeInfo.guaranteeValue === null ? null : guaranteeInfo.guaranteeValue / value * 100
  return {
    ok: true, modality: base.modality, label, rateLabel, systemLabel, start, value, net, rows: flow, interest, iof, fees,
    paid, total: base.total ?? paid + (value - net), cost: paid - net, cet, projectedCost, floating,
    projectedLabel: floating ? base.projectedLabel ?? 'Custo com CDI projetado' : null, cetLabel: floating ? base.cetLabel ?? 'CET · parte fixa (regra do BC)' : 'CET',
    firstPayment: flow[0].payment, maxPayment: Math.max(...flow.map(r => r.payment)), lastDate: flow.at(-1).date,
    guarantee: guaranteeInfo.guarantee, guaranteeValue: guaranteeInfo.guaranteeValue, coverage, notes,
    graceNote: base.graceNote ?? '', declaredCet: base.declaredCet ?? null,
  }
}

function giroLike(col, p, ctx, kind) {
  const cdiMode = kind === 'giro-cdi' || (kind === 'outra' && col.rateType === 'cdi')
  if (p.value === null || !(p.value > 0)) return fail('Informe um valor maior que zero.')
  if (p.term === null || p.term < 1) return fail('Informe o prazo em meses.')
  if (p.grace === null || p.grace < 0) return fail('Informe a carência em meses (0 se não houver).')
  if (!['price', 'sac', 'bullet'].includes(p.system)) return fail('Escolha a amortização.')
  const bullet = p.system === 'bullet'
  const n = bullet ? 1 : p.term - p.grace
  if (!bullet && n < 1) return fail('A carência precisa ser menor que o prazo.')
  const firstDue = addMonths(p.start, bullet ? p.term : p.grace + 1)
  if (!firstDue) return fail('Informe uma data de liberação válida.')
  if (cdiMode && !Number.isFinite(ctx.cdi)) return fail('Informe CDI e amplitude válidos ou aguarde a referência automática.')
  const input = {
    value: p.value, n, rate: percent(col.rate) ?? NaN, unit: col.unit, system: p.system, start: p.start, firstDue, profile: col.profile,
    eligible: col.eligible, rateType: cdiMode ? 'cdi' : 'fixed', cdi: cdiMode ? ctx.cdi : 0, cdiPercent: percent(col.cdiPercent) ?? NaN,
    fees: money(col.fees) ?? NaN, monthlyFees: money(col.monthlyFees) ?? NaN, holidays: col.holidays.trim() ? col.holidays.trim().split(/[\s,;]+/) : [],
    guaranteeValue: conditions(col).guaranteeValue,
  }
  const info = conditions(col)
  if (info.guaranteeInvalid) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  const r = ctx.targetNet != null ? equivalentCredit(input, ctx.targetNet) : creditOperation(input)
  if (!r.ok) return r
  const flow = r.rows.map(x => ({ date: x.date, days: x.days, payment: x.payment, amortization: x.amortization, interest: x.interest, balance: x.balance }))
  const declared = kind === 'outra' && col.declaredCet.trim() ? percent(col.declaredCet) : null
  return finish({
    modality: kind, label: kind === 'outra' && col.name.trim() ? col.name.trim() : modalityLabel(kind), start: p.start, value: r.value, net: r.net, rows: flow, interest: r.interest, iof: r.iof,
    fees: r.fees + r.monthlyFees * r.rows.length, guaranteeInfo: { ...info, guaranteeValue: r.guaranteeValue },
    rateLabel: cdiMode ? `${col.cdiPercent}% do CDI + ${col.rate}% ${col.unit === 'am' ? 'a.m.' : 'a.a.'}` : `Prefixada · ${col.rate}% ${col.unit === 'am' ? 'a.m.' : 'a.a.'}`,
    systemLabel: `${p.system.toUpperCase()} · ${r.rows.length} pagamento(s)`, declaredCet: declared,
    graceNote: r.graceDays > 0 ? `Carência capitalizada: ${r.graceDays} dias · R$ ${r.capitalizedGrace.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
    ...(cdiMode ? { cetRegulatory: r.cetRegulatory } : {}),
    notes: cdiMode ? ['CDI constante no cenário escolhido; projeção, não taxa futura garantida.', 'CET · parte fixa (regra do BC): mesmo contrato com CDI zero, só o spread, na mesma base de dias úteis/252, feriados e datas (Res. CMN 4.881/2020, art. 5º). O custo com CDI projetado aparece à parte e não é CET.'] : [],
  })
}

function bndes(col, p, ctx) {
  if (p.value === null || !(p.value > 0)) return fail('Informe um valor maior que zero.')
  if (p.term === null || p.grace === null) return fail('Informe prazo e carência em meses.')
  if (!['price', 'sac'].includes(p.system)) return fail('BNDES aceita Price ou SAC. Troque a amortização desta coluna.')
  const info = conditions(col)
  if (info.guaranteeInvalid) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  const porte = PORTES.find(x => x.id === col.bPorte)
  const part = percent(col.bPart), cost = percent(col.bCost), agent = percent(col.bAgent), tac = money(col.bTac, true), ipca = col.bLine === 'tlp' ? parseSigned(col.bIpca) : 0
  const fgiPct = col.bFgi.trim() ? percent(col.bFgi) : null
  if (!porte || part === null || cost === null || agent === null || tac === null || (col.bLine === 'tlp' && ipca === null) || (col.bFgi.trim() && fgiPct === null)) return fail('Confira os campos do BNDES: porte, participação, custo financeiro, spread do agente, TAC e IPCA.')
  // Regulamento do FGI Tradicional (Circular SUP/ADIG 62/2026), art. 7º, I: MEI e empresas de micro, pequeno e médio porte,
  // com receita bruta de até R$ 300 milhões. A exceção do inciso II (setores definidos pelo Poder Executivo) não é modelada.
  if (fgiPct !== null && porte.mpme === false) return fail('Retire a garantia do FGI: ela atende micro, pequenas e médias empresas (receita bruta de até R$ 300 milhões no ano anterior).')
  let iof = IOF_ZERO
  if (col.bIof !== 'zero') {
    const tax = resolveCreditIof({ date: p.start, profile: col.bIof, operationValue: p.value * part / 100, eligible: col.bIof === 'pj' ? false : col.eligible })
    if (!tax.ok) return fail(tax.error)
    iof = { fixed: tax.additional, daily: tax.daily, maxDays: tax.maxDays }
  }
  const periods = Number(col.bPeriod)
  const simParams = { valor: p.value, participacao: part, prazo: p.term, carencia: p.grace, custo: col.bLine, custoFinanceiro: cost, taxaBndes: porte.taxa, taxaAgente: agent, ipca: ipca ?? 0, perfilTlp: col.bLine === 'tlp' ? 'tlpcap' : undefined, sistema: p.system, periodicidade: periods, composicao: col.bComp, iof, tac, fgi: fgiPct === null ? null : { percentual: fgiPct, incorporar: col.bFgiInc, periodos: periodos30Datas(new Date(`${p.start}T12:00:00`), vencimentoDia15(new Date(`${p.start}T12:00:00`), p.term)) } , dataLiberacao: new Date(`${p.start}T12:00:00`), feriados: {} }
  const sim = simular(simParams)
  if (!sim.ok) return fail(sim.erros?.[0] ?? 'Confira as condições do BNDES.')
  const rows = []
  // Calendário real do BNDES (dia 15 ou próximo dia útil, juros por dias corridos); IOF cobrado todo na liberação.
  for (const parcela of sim.parcelas) {
    if (!(parcela.parcela > 0)) continue
    rows.push({ date: parcela.vencimento, days: parcela.dias, payment: parcela.parcela, amortization: parcela.amortizacao, interest: parcela.juros, balance: parcela.saldo })
  }
  if (!rows.length) return fail('O cronograma do BNDES não gerou pagamentos.')
  const upfront = sim.tac + sim.iof + (sim.fgi && !sim.fgi.incorporado ? sim.fgi.ecg : 0)
  const net = sim.liberado - upfront
  if (!(net > 0)) return fail('Tarifas e IOF devem ser menores que o valor liberado.')
  // TLP capitalizada: o IPCA é índice de preços e fica fora do CET regulatório (art. 5º). O CET é o do mesmo contrato com IPCA zero;
  // o fluxo com o IPCA informado vira o "custo com IPCA projetado".
  let indexed = {}
  if (col.bLine === 'tlp') {
    const flat = simular({ ...simParams, ipca: 0 })
    if (!flat.ok) return fail(flat.erros?.[0] ?? 'Confira as condições do BNDES.')
    const flatNet = flat.liberado - (flat.tac + flat.iof + (flat.fgi && !flat.fgi.incorporado ? flat.fgi.ecg : 0))
    indexed = { cetRegulatory: creditCet(flatNet, flat.parcelas.filter(x => x.parcela > 0).map(x => ({ days: x.dias, payment: x.parcela }))), projectedLabel: 'Custo com IPCA projetado' }
  }
  const result = finish({
    ...indexed, modality: 'bndes', label: 'BNDES', start: p.start, value: sim.liberado, net, rows, interest: sim.juros + sim.correcao, iof: sim.iof,
    fees: sim.tac + (sim.fgi ? sim.fgi.ecg : 0), guaranteeInfo: info,
    rateLabel: `${CUSTOS.find(x => x.id === col.bLine)?.label ?? col.bLine} · taxa final ${sim.taxa.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.`,
    systemLabel: `${p.system.toUpperCase()} · ${rows.length} pagamento(s)`,
    graceNote: p.grace > 0 ? `Carência de ${p.grace} mes(es) com juros pagos (convenção BNDES)` : '',
    notes: [...sim.avisos, 'Vencimentos no dia 15 ou próximo dia útil e juros por dias corridos, como na calculadora BNDES; o calendário contratual do agente prevalece.'],
  })
  return result
}
function parseSigned(text) {
  const value = String(text).trim(), negative = value.startsWith('-')
  const n = parseDecimal(negative ? value.slice(1) : value)
  return n === null ? null : negative ? -n : n
}

function finimp(col, p) {
  if (p.value === null || !(p.value > 0)) return fail('Informe um valor maior que zero.')
  const info = conditions(col)
  if (info.guaranteeInvalid) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  const fx = col.fCurrency === 'BRL' ? 1 : /^\d+(?:[.,]\d+)?$/.test(col.fFx.trim()) ? Number(col.fFx.replace(',', '.')) : null
  if (!FINIMP_CURRENCY_LIST.includes(col.fCurrency) || !(fx > 0)) return fail('Informe a moeda e o câmbio (R$ por unidade da moeda), maior que zero.')
  const days = col.fDays === 'auto' ? (p.term !== null ? p.term * 30 : NaN) : Number(col.fDays)
  if (!FINIMP_TERMS.includes(days)) return fail('FINIMP vai de 30 a 360 dias, em múltiplos de 30. Escolha o prazo desta coluna.')
  const rate = percent(col.fRate), flat = percent(col.fFlat), tac = money(col.fTac, true)
  if (rate === null || flat === null || tac === null) return fail('Informe taxa anual simples, flat em % e TAC em reais (0 se não houver).')
  const cost = finimpCost({ principal: p.value, annualRate: rate, flatRate: flat, tac, days })
  if (!cost.ok) return fail(cost.error)
  const net = p.value - cost.flat - cost.tac
  if (!(net > 0)) return fail('Flat e TAC devem ser menores que o valor da operação.')
  const date = cgAddDays(p.start, days)
  if (!date) return fail('Informe uma data de liberação válida.')
  return finish({
    modality: 'finimp', label: 'FINIMP', start: p.start, value: p.value, net, rows: [{ date, days, payment: p.value + cost.interest, amortization: p.value, interest: cost.interest, balance: 0 }],
    interest: cost.interest, iof: 0, fees: cost.flat + cost.tac, guaranteeInfo: info,
    rateLabel: `${col.fCurrency} · ${col.fRate}% a.a. simples (base 360) + flat ${col.fFlat}%`, systemLabel: `Pagamento único · ${days} dias`,
    notes: [`Principal de ${(p.value / fx).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${col.fCurrency} ao câmbio de R$ ${fx.toLocaleString('pt-BR')}, constante até o vencimento.`,
      'Sem variação cambial e sem IOF de câmbio, como na calculadora FINIMP. Premissa do CET: flat e TAC pagos na liberação; juros e principal no vencimento.', 'Carência e amortização comuns do topo não se aplicam a esta modalidade: pagamento único.'],
  })
}

function contaGarantida(col, p) {
  if (p.value === null || !(p.value > 0)) return fail('Informe um valor maior que zero.')
  const info = conditions(col)
  if (info.guaranteeInvalid) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  const days = col.cDays.trim() ? integerText(col.cDays) : p.term === null ? null : p.term * 30
  if (days === null || days < 1 || days > 3660) return fail('Informe de 1 a 3.660 dias de utilização.')
  const form = { ...cgInitialForm(p.start), mode: 'single', dateMode: 'duration', duration: String(days), amount: p.valueText, rate: col.cRate, rateBase: col.cBase, conversion: col.cConv, dayCount: col.cCount, holidays: col.holidays, taxProfile: col.profile, eligible: col.eligible, operationValue: p.valueText }
  const parsed = parseContaGarantidaForm(form)
  if (!parsed.result?.ok) return fail(parsed.result?.error ?? Object.values(parsed.errors)[0] ?? 'Confira as condições da Conta Garantida.')
  const { totals } = parsed.result
  const end = cgAddDays(p.start, days)
  // CET regulatório da conta garantida (art. 6º): 30 dias sobre o limite, igual à calculadora própria (limite = valor da coluna).
  // O fluxo pelo prazo de uso informado vira o "custo pelo prazo de uso".
  const cg = contaGarantidaCet({ limit: p.value, start: p.start, rate: parsed.params.rate, rateBase: parsed.params.rateBase, conversion: parsed.params.conversion, dayCount: parsed.params.dayCount, holidays: parsed.params.holidays, taxProfile: col.profile, eligible: col.eligible, operationValue: p.value })
  return finish({
    cetRegulatory: cg.ok ? cg.annual : null, projectedLabel: 'Custo pelo prazo de uso', cetLabel: 'CET (art. 6º · 30 dias sobre o limite)',
    // Mesma convenção do CET: IOF adicional na liberação; juros e IOF diário no encerramento.
    modality: 'conta-garantida', label: 'Conta Garantida', start: p.start, value: p.value, net: p.value - totals.additionalIof,
    rows: [{ date: end, days, payment: p.value + totals.interest + totals.dailyIof, amortization: p.value, interest: totals.interest, balance: 0 }],
    interest: totals.interest, iof: totals.iof, fees: 0, guaranteeInfo: info,
    rateLabel: `${col.cRate}% a.m. · base ${col.cBase} · ${col.cConv === 'proportional' ? 'proporcional' : 'equivalente'}`, systemLabel: `Uso único · ${days} dias`,
    notes: ['Saldo utilizado integralmente do início ao fim; IOF adicional na liberação, juros e IOF diário no encerramento, sem tarifas (não modeladas nesta modalidade).', 'Carência e amortização comuns do topo não se aplicam a esta modalidade: pagamento único.'],
  })
}

function desconto(col, p) {
  if (p.value === null || !(p.value > 0)) return fail('Informe um valor maior que zero.')
  const info = conditions(col)
  if (info.guaranteeInvalid) return fail('Confira o valor da garantia ou deixe-o vazio quando não mensurável.')
  const days = col.dDays.trim() ? integerText(col.dDays) : p.term === null ? null : p.term * 30
  const titles = integerText(col.dTitles), rate = percent(col.dRate), fee = percent(col.dFee), tac = money(col.dTac, true)
  if (days === null || days < 1 || days > 3660 || titles === null || titles < 1 || rate === null || fee === null || tac === null) return fail('Confira prazo médio, quantidade de títulos, taxa, tarifa e TAC.')
  const dueDate = cgAddDays(p.start, days)
  if (!dueDate) return fail('Informe uma data de liberação válida.')
  const r = discountOperation({ titleRows: [{ value: p.value, count: titles, dueDate }], date: p.start, rate, convention: col.dConv, taxProfile: col.profile, eligible: col.eligible, feeMode: col.dFeeMode, fee, tac })
  if (!r.ok) return fail(r.error)
  return finish({
    modality: 'desconto', label: 'Desconto de duplicata', start: p.start, value: r.value, net: r.net,
    rows: [{ date: r.rows[0].paymentDate, days: r.rows[0].days, payment: r.value, amortization: r.value, interest: 0, balance: 0 }], total: r.value, // vencimento ajustado ao dia útil, como na Análise de desconto
    interest: r.interest, iof: r.iof, fees: r.titleFee + r.tac, guaranteeInfo: info,
    rateLabel: `${col.dRate}% a.m. · ${col.dConv === 'commercial30' ? 'por fora (comercial)' : 'por dentro (racional)'}`, systemLabel: `Vencimento único · ${days} dias · ${titles} título(s)`,
    notes: ['O valor é o nominal dos títulos; os juros são descontados na liberação. No fluxo do CET, o líquido entra na data da operação e o nominal sai no vencimento.', 'Carência e amortização comuns do topo não se aplicam a esta modalidade: pagamento único.'],
  })
}

// Solução do valor contratado que dá um líquido comum. Giro e Outra reutilizam a equivalência já existente; as demais
// modalidades têm líquido quase linear no valor, resolvido por secante e conferido pelo fluxo completo.
function solveNet(run, target) {
  let v = target / 0.97, previous = null
  for (let i = 0; i < 25; i++) {
    const r = run(v)
    if (!r.ok) return r
    const error = target - r.net
    if (Math.abs(error) < 0.01) return r
    const slope = previous && Math.abs(v - previous.v) > 1e-9 ? (r.net - previous.net) / (v - previous.v) : 0.97
    previous = { v, net: r.net }
    v = Math.round((v + error / (slope > 0.05 ? slope : 0.97)) * 100) / 100
    if (!(v > 0) || v > 1e11) break
  }
  return fail('Não foi possível reconciliar o líquido comum com estas condições e limites numéricos.')
}

export function evaluateColumn(col, shared, ctx = {}) {
  const base = resolve(col, shared)
  const run = override => {
    const p = override == null ? base : resolve(col, shared, override)
    switch (col.modality) {
      case 'giro-pre': case 'giro-cdi': case 'outra': return giroLike(col, p, { ...ctx, targetNet: null }, col.modality)
      case 'bndes': return bndes(col, p, ctx)
      case 'finimp': return finimp(col, p)
      case 'conta-garantida': return contaGarantida(col, p)
      case 'desconto': return desconto(col, p)
      default: return fail('Escolha uma modalidade.')
    }
  }
  if (ctx.targetNet == null || ctx.targetNet === undefined) return run()
  if (!(ctx.targetNet > 0)) return fail('Informe o valor líquido comum, maior que zero.')
  if (['giro-pre', 'giro-cdi', 'outra'].includes(col.modality)) return giroLike(col, base, ctx, col.modality)
  return solveNet(run, ctx.targetNet)
}

export function evaluateAll(columns, shared, ctx) {
  return columns.map(col => evaluateColumn(col, shared, ctx))
}

// Tipo de taxa para comparar CET (decisão de Fernando em 11/11/2026): prefixado só com prefixado, pós-fixado (CDI, IPCA) só com
// pós-fixado e conta garantida (art. 6º, 30 dias sobre o limite) só com conta garantida. O CET regulatório do pós-fixado deixa o
// índice de fora (art. 5º), por isso não é comparável com o de um prefixado; entre tipos diferentes, vale o menor custo em reais.
export const CET_GROUPS = Object.freeze({ pre: 'prefixados', pos: 'pós-fixados', rotativo: 'contas garantidas' })
export const cetGroup = r => r.modality === 'conta-garantida' ? 'rotativo' : r.floating ? 'pos' : 'pre'

// Destaques objetivos, sem declarar vencedor absoluto: só os menores valores entre as colunas válidas.
export function highlights(results) {
  const ok = results.map((r, i) => ({ r, i })).filter(x => x.r.ok)
  const cet = ok.filter(x => x.r.cet !== null)
  const groups = [...new Set(ok.map(x => cetGroup(x.r)))]
  const mixed = groups.length > 1
  const lowestCetByGroup = {}
  for (const g of groups) {
    const members = cet.filter(x => cetGroup(x.r) === g)
    if (members.length > 1) lowestCetByGroup[g] = members.reduce((a, b) => b.r.cet < a.r.cet ? b : a).i
  }
  return {
    mixed, lowestCetByGroup,
    lowestCet: !mixed && cet.length > 1 ? cet.reduce((a, b) => b.r.cet < a.r.cet ? b : a).i : null,
    lowestCost: ok.length > 1 ? ok.reduce((a, b) => b.r.cost < a.r.cost ? b : a).i : null,
    lowestMaxPayment: ok.length > 1 ? ok.reduce((a, b) => b.r.maxPayment < a.r.maxPayment ? b : a).i : null,
    unmeasurable: ok.filter(x => x.r.cet === null).map(x => x.i),
  }
}

export { PORTES, COMPOSICOES, PERIODICIDADES, FGI, taxaFinal }
