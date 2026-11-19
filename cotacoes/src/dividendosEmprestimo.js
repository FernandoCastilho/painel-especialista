// Dividendos via empréstimo: a empresa de lucro real toma crédito, paga ao sócio o dividendo já aprovado em ata,
// o sócio aplica e deixa a aplicação como garantia. Mede a eficiência total da operação.
// Lógica combinada com Fernando em 19/11/2026.
//
// Eficiência (na data final) = ganho líquido da aplicação do sócio − imposto sobre o dividendo (se não houver ata)
//                              − custo da empresa com o empréstimo.
// Custo da empresa = IOF e cada pagamento, líquidos da economia de IR/CSLL sobre juros e IOF, levados à data final pelo
// CDI líquido que o caixa da empresa renderia (PIS/Cofins 4,65% e IR/CSLL), menos o valor recebido no empréstimo.
// Assim, pagar antes custa o rendimento que o caixa da empresa deixa de ter, e os formatos ficam comparáveis.
//
// Premissas:
// - Meses de 30 dias para juros e IOF; juros dedutíveis no mês em que correm (regime de competência, lucro real),
//   inclusive quando são pagos só no fim.
// - IOF de crédito PJ opcional: 0,38% + 0,0082% ao dia sobre cada amortização do principal, até 365 dias (IOF_PJ, a mesma
//   regra das outras calculadoras), pago na contratação.
// - Aplicação do sócio em % do CDI, CDI constante, 21 dias úteis por mês, sem resgates; IR regressivo por dias corridos
//   reais (meses × 365/12): 22,5% / 20% / 17,5% / 15%.
// - Dividendo: isento com ata de distribuição aprovada até 31/12/2025 (regra de transição da Lei 15.270/2025);
//   sem ata, o imposto informado (padrão 10%) sai do valor que o sócio aplica.
import { IOF_PJ } from './emprestimo.js'

export const PRAZOS = [12, 24, 36, 48, 60]
export const PIS_COFINS_FINANCEIRO = 0.0465
export const FORMATOS = [
  { id: 'price', label: 'Parcelas iguais (Price)' },
  { id: 'sac', label: 'Amortização constante (SAC)' },
  { id: 'juros', label: 'Juros mensais, principal no fim' },
  { id: 'fim', label: 'Tudo no fim (juros acumulados)' },
]

export const diasCorridos = (meses) => Math.round((meses * 365) / 12)

// "1,31" → 1.31; "10.000.000,00" → 10000000; vazio ou inválido → NaN.
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(/\s|%/g, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(t)) return NaN
  return Number(t.replaceAll('.', '').replace(',', '.'))
}

export function irPessoaFisica(dias) {
  if (dias <= 180) return 0.225
  if (dias <= 360) return 0.2
  if (dias <= 720) return 0.175
  return 0.15
}

// Fluxo mensal do empréstimo: pagamento, juros do mês (dedutíveis) e amortização do principal.
export function fluxoEmprestimo(valor, i, n, formato) {
  const fluxo = []
  let saldo = valor
  const parcela = i === 0 ? valor / n : (valor * i) / (1 - (1 + i) ** -n)
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i
    let amortizacao = 0
    let pagamento = 0
    if (formato === 'price') { amortizacao = parcela - juros; pagamento = parcela; saldo -= amortizacao }
    else if (formato === 'sac') { amortizacao = valor / n; pagamento = amortizacao + juros; saldo -= amortizacao }
    else if (formato === 'juros') { amortizacao = k === n ? valor : 0; pagamento = juros + amortizacao }
    else if (formato === 'fim') { saldo += juros; amortizacao = k === n ? valor : 0; pagamento = k === n ? saldo : 0 }
    else throw new Error(`Formato desconhecido: ${formato}`)
    fluxo.push({ mes: k, pagamento, juros, amortizacao })
  }
  return fluxo
}

export function iofCredito(valor, fluxo, iof = IOF_PJ) {
  return valor * (iof.fixed / 100) + fluxo.reduce((a, f) => a + f.amortizacao * (iof.daily / 100) * Math.min(30 * f.mes, iof.maxDays), 0)
}

export function simularOperacao(p, n, formato) {
  const { valor, taxaMes, cdi, pctCdi = 1, aliquotaPj = 0.34, comIof = true, temAta = true, aliquotaDividendos = 0.1 } = p
  const fluxo = fluxoEmprestimo(valor, taxaMes, n, formato)
  const juros = fluxo.reduce((a, f) => a + f.juros, 0)
  const iof = comIof ? iofCredito(valor, fluxo) : 0
  const economiaIr = aliquotaPj * (juros + iof)

  // Sócio.
  const impostoDividendo = temAta ? 0 : valor * aliquotaDividendos
  const aplicado = valor - impostoDividendo
  const cdiDia = (1 + cdi) ** (1 / 252) - 1
  const bruto = (1 + cdiDia * pctCdi) ** (21 * n) - 1
  const ir = irPessoaFisica(diasCorridos(n))
  const ganhoSocio = aplicado * bruto * (1 - ir)

  // Empresa: valor futuro dos desembolsos líquidos de IR pelo CDI líquido do caixa da empresa.
  const rEmpresa = ((1 + cdiDia * pctCdi) ** 21 - 1) * (1 - PIS_COFINS_FINANCEIRO) * (1 - aliquotaPj)
  const vf = (m) => (1 + rEmpresa) ** m
  let custoEmpresa = iof * (1 - aliquotaPj) * vf(n) - valor
  for (const f of fluxo) custoEmpresa += (f.pagamento - aliquotaPj * f.juros) * vf(n - f.mes)
  const custoNominal = juros + iof - economiaIr
  const efeitoTempo = custoEmpresa - custoNominal

  const eficiencia = ganhoSocio - impostoDividendo - custoEmpresa
  // Se a empresa pagasse o dividendo com caixa próprio: o sócio teria o mesmo ganho e a empresa perderia o rendimento do caixa.
  const custoCaixaProprio = valor * (vf(n) - 1)
  const emprestimoVsCaixa = custoCaixaProprio - custoEmpresa // positivo: o empréstimo sai mais barato que usar o caixa

  return {
    n, formato, juros, iof, economiaIr, totalPago: fluxo.reduce((a, f) => a + f.pagamento, 0) + iof,
    primeiroPagamento: fluxo[0].pagamento,
    impostoDividendo, aplicado, bruto, ir, ganhoSocio,
    custoEmpresa, custoNominal, efeitoTempo, eficiencia, custoCaixaProprio, emprestimoVsCaixa, rEmpresaMes: rEmpresa,
  }
}

export function simularDividendosEmprestimo(p) {
  if (!(p.valor > 0)) return { ok: false, error: 'Informe o valor do dividendo (valor da operação).' }
  if (!(p.taxaMes > 0 && p.taxaMes < 0.2)) return { ok: false, error: 'Informe a taxa do empréstimo ao mês, entre 0% e 20%. Ex.: 1,31.' }
  if (!(p.cdi > 0 && p.cdi < 1)) return { ok: false, error: 'Informe o CDI ao ano. Ex.: 14,15.' }
  if (!(p.pctCdi >= 0.01 && p.pctCdi <= 2)) return { ok: false, error: 'Informe o % do CDI da aplicação entre 1% e 200%.' }
  if (!(p.aliquotaPj >= 0 && p.aliquotaPj < 1)) return { ok: false, error: 'Informe a alíquota de IR/CSLL da empresa. Ex.: 34.' }
  if (!p.temAta && !(p.aliquotaDividendos >= 0 && p.aliquotaDividendos < 1)) return { ok: false, error: 'Informe o imposto sobre o dividendo. Ex.: 10.' }
  const prazos = (p.prazos ?? PRAZOS).map((n) => {
    const formatos = FORMATOS.map((f) => simularOperacao(p, n, f.id))
    const melhor = formatos.reduce((a, b) => (b.eficiencia > a.eficiencia ? b : a))
    return { n, formatos, melhor: melhor.formato }
  })
  return { ok: true, prazos }
}
