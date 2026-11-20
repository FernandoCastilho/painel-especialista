// Comparação em reais de uma obrigação na mesma moeda, com cobertura integral.
// Somatório nominal por vencimento: não é VPL. A TIR usa as datas reais (365 dias).
const BASE = 100n
const CENTAVOS_MAX = 100_000_000_000_000n // R$ 1 trilhão, mantendo resolução de centavos no visor
const DIA = 86_400_000
const INCOMPLETO = value => value == null
const positivo = value => Number.isFinite(value) && value > 0
const naoNegativo = value => Number.isFinite(value) && value >= 0
const falha = erro => ({ ok: false, erro, parcelas: [],
  totalComTravaBrl: null, totalSemTravaBrl: null, diferencaBrl: null,
  tirComTravaPct: null, tirSemTravaPct: null, custoNoPeriodoPct: null,
})
function diaCivil(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const stamp = Date.parse(iso + 'T12:00:00Z')
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === iso ? stamp : null
}
function decimal(value) {
  const [s, exp = '0'] = String(value).split('e')
  const fraction = s.split('.')[1]?.length ?? 0
  const scale = fraction - Number(exp)
  const n = BigInt(s.replace('.', ''))
  return scale >= 0 ? [n, 10n ** BigInt(scale)] : [n * 10n ** BigInt(-scale), 1n]
}
function arredondar(n, d) {
  return (n * 2n + d) / (d * 2n)
}
function centavos(amount, rate = 1, fee = 0) {
  const [a, ad] = decimal(amount), [r, rd] = decimal(rate), [f, fd] = decimal(fee)
  const den = ad * rd * fd
  return arredondar((a * r * fd + f * ad * rd) * BASE, den)
}
const reais = cents => cents == null ? null : Number(cents) / Number(BASE)
function somar(linhas, key) {
  return linhas.every(linha => linha[key] !== null) ? linhas.reduce((s, linha) => s + linha[key], 0n) : null
}
function cadastroValido(p) {
  return p && typeof p.id === 'string' && p.id.length > 0 &&
    [p.valorMoeda, p.taxaTrava, p.taxaCenario].every(value => INCOMPLETO(value) || positivo(value)) &&
    [p.custoTravaBrl, p.custoSemTravaBrl].every(value => INCOMPLETO(value) || naoNegativo(value))
}
export function tirarTirCambialPct(recebido, pagamentos) {
  // A convenção de sinais é fixa: entrada inicial, depois apenas pagamentos.
  // O VPL é estritamente decrescente e tem uma única raiz no domínio r > −100%.
  if (!positivo(recebido) || !Array.isArray(pagamentos) || !pagamentos.length ||
      pagamentos.some(p => !positivo(p.pago) || !Number.isInteger(p.dias) || p.dias < 1)) return null
  const target = Math.log(recebido)
  const pts = pagamentos.map(p => [p.dias / 365, Math.log(p.pago)])
  const residual = logFactor => {
    const terms = pts.map(([time, paid]) => paid - time * logFactor)
    const max = Math.max(...terms)
    return max - target + Math.log(terms.reduce((sum, term) => sum + Math.exp(term - max), 0))
  }
  const atZero = residual(0)
  if (Math.abs(atZero) < 1e-14) return 0
  let low = -1, high = 1
  const highLimit = Math.log(Number.MAX_VALUE / 100)
  const lowLimit = Math.log(Number.EPSILON / 2)
  while (residual(low) < 0 && low > lowLimit) low = Math.max(low * 2, lowLimit)
  while (residual(high) > 0 && high < highLimit) high = Math.min(high * 2, highLimit)
  if (residual(low) < 0 || residual(high) > 0) return null
  for (let i = 0; i < 100; i++) {
    const center = (low + high) / 2
    const value = residual(center)
    if (Math.abs(value) < 1e-13 || center === low || center === high) {
      const taxa = Math.expm1(center) * 100
      return Number.isFinite(taxa) && taxa > -100 ? taxa : null
    }
    if (value > 0) low = center
    else high = center
  }
  return null
}
export function simularParcelasCambiais({ inicio, liquidoBrl, parcelas } = {}) {
  if (!Array.isArray(parcelas) || parcelas.length < 1 || parcelas.length > 5) return falha('Escolha de 1 a 5 parcelas.')
  if (!parcelas.every(cadastroValido) || new Set(parcelas.map(p => p.id)).size !== parcelas.length) return falha('Confira os valores e os campos das parcelas.')
  const initial = diaCivil(inicio)
  if (initial === null) return falha('Informe uma data inicial válida.')
  if (!INCOMPLETO(liquidoBrl) && !positivo(liquidoBrl)) return falha('Informe um valor líquido recebido maior que zero ou deixe em branco.')
  const feitas = parcelas.map(p => {
    const stamp = diaCivil(p.vencimento)
    const dias = stamp === null || stamp <= initial ? null : (stamp - initial) / DIA
    const apta = dias !== null && positivo(p.valorMoeda)
    const custoH = p.custoTravaBrl ?? 0
    const custoS = p.custoSemTravaBrl ?? 0
    const com = apta && positivo(p.taxaTrava) ? centavos(p.valorMoeda, p.taxaTrava, custoH) : null
    const sem = apta && positivo(p.taxaCenario) ? centavos(p.valorMoeda, p.taxaCenario, custoS) : null
    // Zero por arredondamento não é pagamento liquidável.
    const comCentavos = com !== 0n ? com : null
    const semCentavos = sem !== 0n ? sem : null
    const ideal = comCentavos === null ? null : p.taxaTrava + (custoH - custoS) / p.valorMoeda
    const equilibrio = ideal !== null && positivo(ideal) ? ideal : null
    return { id: p.id, dias, comCentavos, semCentavos, equilibrio,
      comTravaBrl: reais(comCentavos), semTravaBrl: reais(semCentavos),
      diferencaBrl: comCentavos === null || semCentavos === null ? null : reais(semCentavos - comCentavos),
    }
  })
  const com = somar(feitas, 'comCentavos'), sem = somar(feitas, 'semCentavos')
  const liquido = INCOMPLETO(liquidoBrl) ? null : centavos(liquidoBrl)
  if ([com, sem, liquido, ...feitas.flatMap(x => [x.comCentavos, x.semCentavos])].some(n => n !== null && n > CENTAVOS_MAX)) return falha('Os valores excedem o limite de simulação.')
  if (liquido === 0n) return falha('Informe um valor líquido de pelo menos um centavo.')
  const tir = (total, key) => total === null || liquido === null ? null :
    tirarTirCambialPct(Number(liquido), feitas.map(x => ({ pago: Number(x[key]), dias: x.dias })))
  const custoNoPeriodoPct = feitas.length === 1 && liquido !== null && com !== null
    ? Number(com - liquido) / Number(liquido) * 100 : null
  return {
    ok: true,
    parcelas: feitas.map(({ id, dias, comTravaBrl, semTravaBrl, diferencaBrl, equilibrio }) => ({ id, dias, comTravaBrl, semTravaBrl, diferencaBrl, equilibrio })),
    totalComTravaBrl: reais(com),
    totalSemTravaBrl: reais(sem),
    diferencaBrl: com === null || sem === null ? null : reais(sem - com),
    tirComTravaPct: tir(com, 'comCentavos'),
    tirSemTravaPct: tir(sem, 'semCentavos'),
    custoNoPeriodoPct,
  }
}
