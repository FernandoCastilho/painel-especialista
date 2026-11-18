// Dividendos via empréstimo: a empresa (lucro real) toma crédito, repassa o dinheiro ao sócio, o sócio aplica e deixa a
// aplicação como garantia. Compara com o caminho direto: distribuir o dividendo hoje e pagar o imposto sobre ele.
// Modelo combinado com Fernando em 18/11/2026, a partir da planilha "Dividendos_Comparativo".
//
// Premissas:
// - Empréstimo PJ pela tabela Price, meses de 30 dias, IOF não financiado (pago na contratação).
// - IOF de crédito PJ: mesma regra das outras calculadoras do painel (IOF_PJ: 0,38% + 0,0082% ao dia sobre cada
//   amortização, até 365 dias). A planilha original usa 0,0041% ao dia (regra anterior ao Decreto 12.499/2025).
// - Juros e IOF são despesa dedutível na empresa de lucro real: economia de IR/CSLL = alíquota × despesa.
// - Aplicação do sócio (pessoa física) em % do CDI, CDI constante, 21 dias úteis por mês, sem resgates;
//   IR regressivo por dias corridos (22,5% / 20% / 17,5% / 15%). Sem IOF (prazo acima de 30 dias).
// - Comparação justa (valor futuro pelo CDI): no caminho direto o sócio também aplicaria o dividendo líquido; e o caixa
//   que a empresa deixa de pagar hoje rende CDI na empresa, tributado no lucro real (PIS/Cofins 4,65% e IR/CSLL).
//   Cada parcela e cada economia de IR são levadas à data final por esse CDI líquido da empresa.
import { IOF_PJ } from './emprestimo.js'

export const PRAZOS = [12, 24, 36, 48, 60]
export const PIS_COFINS_FINANCEIRO = 0.0465
export const IOF_PLANILHA = { fixed: 0.38, daily: 0.0041, maxDays: 365 }

// "1,31" → 1.31; "10.000.000,00" → 10000000; vazio ou inválido → NaN.
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(/\s|%/g, '')
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(t)) return NaN
  return Number(t.replaceAll('.', '').replace(',', '.'))
}

// IR da aplicação de pessoa física pelo prazo em dias corridos.
export function irPessoaFisica(dias) {
  if (dias <= 180) return 0.225
  if (dias <= 360) return 0.2
  if (dias <= 720) return 0.175
  return 0.15
}

// Empréstimo Price em n meses com taxa mensal i (decimal). IOF em % (fixed sobre o valor; daily por dia sobre cada amortização).
export function emprestimoPrice(valor, i, n, iof = IOF_PJ) {
  const parcela = i === 0 ? valor / n : (valor * i) / (1 - (1 + i) ** -n)
  let saldo = valor
  let iofDiario = 0
  const fluxo = []
  for (let k = 1; k <= n; k++) {
    const juros = saldo * i
    const amortizacao = parcela - juros
    saldo -= amortizacao
    iofDiario += amortizacao * (iof.daily / 100) * Math.min(30 * k, iof.maxDays)
    fluxo.push({ mes: k, juros, amortizacao })
  }
  const iofTotal = valor * (iof.fixed / 100) + iofDiario
  const juros = fluxo.reduce((a, f) => a + f.juros, 0)
  return { parcela, iof: iofTotal, juros, totalPago: parcela * n + iofTotal, fluxo }
}

export function simularPrazo({ valor, taxaMes, cdi, pctCdi = 1, aliquotaPj = 0.34, aliquotaDividendos = 0.1, iof = IOF_PJ }, n) {
  const emp = emprestimoPrice(valor, taxaMes, n, iof)
  const reducaoIr = aliquotaPj * (emp.juros + emp.iof)

  // Aplicação do sócio: CDI diário × % do CDI, 21 dias úteis por mês.
  const cdiDia = (1 + cdi) ** (1 / 252) - 1
  const bruto = (1 + cdiDia * pctCdi) ** (21 * n) - 1
  const ir = irPessoaFisica(30 * n)
  const liquidoPct = bruto * (1 - ir)
  const ganhoBruto = valor * bruto
  const ganhoLiquido = valor * liquidoPct

  // Visão da planilha (soma simples): rendimento total da aplicação menos o que a empresa pagou, mais imposto evitado e economia de IR.
  const dividendos = valor * aliquotaDividendos
  const rentabilidade = valor + ganhoLiquido
  const ganhoPlanilha = rentabilidade - emp.totalPago
  const montantePlanilha = ganhoPlanilha + dividendos + reducaoIr

  // Comparação justa, na data final.
  // Sócio: no caminho direto aplicaria o dividendo líquido; a diferença é o imposto evitado, aplicado no mesmo produto.
  const socio = dividendos * (1 + liquidoPct)
  // Empresa: no caminho direto pagaria o valor hoje. Com o empréstimo, guarda esse caixa (rende CDI líquido de PIS/Cofins e IR/CSLL),
  // paga o IOF líquido de IR na contratação e cada parcela líquida da economia de IR sobre os juros do mês.
  const rEmpresa = ((1 + cdiDia * pctCdi) ** 21 - 1) * (1 - PIS_COFINS_FINANCEIRO) * (1 - aliquotaPj)
  const vf = (meses) => (1 + rEmpresa) ** meses
  let empresa = (valor - emp.iof * (1 - aliquotaPj)) * vf(n)
  for (const f of emp.fluxo) empresa -= (emp.parcela - aliquotaPj * f.juros) * vf(n - f.mes)
  const resultado = socio + empresa
  // Imposto sobre dividendos que zera o resultado (resultado é linear na alíquota).
  const aliquotaEmpate = -empresa / (valor * (1 + liquidoPct))

  // Ponte planilha → justo.
  const ajusteSocio = -(valor - dividendos) * liquidoPct
  const ajusteEmpresa = empresa - (valor - emp.totalPago + reducaoIr)

  return {
    n, parcela: emp.parcela, iof: emp.iof, juros: emp.juros, totalPago: emp.totalPago, reducaoIr,
    bruto, ir, liquidoPct, ganhoBruto, ganhoLiquido,
    dividendos, rentabilidade, ganhoPlanilha, montantePlanilha,
    socio, empresa, resultado, aliquotaEmpate, ajusteSocio, ajusteEmpresa,
    rEmpresaMes: rEmpresa,
  }
}

export function simularDividendosEmprestimo(p) {
  if (!(p.valor > 0)) return { ok: false, error: 'Informe o valor dos lucros acumulados (valor da operação).' }
  if (!(p.taxaMes > 0 && p.taxaMes < 0.2)) return { ok: false, error: 'Informe a taxa do empréstimo ao mês, entre 0% e 20%. Ex.: 1,31.' }
  if (!(p.cdi > 0 && p.cdi < 1)) return { ok: false, error: 'Informe o CDI ao ano. Ex.: 14,15.' }
  if (!(p.pctCdi > 0 && p.pctCdi <= 2)) return { ok: false, error: 'Informe o % do CDI da aplicação entre 1% e 200%.' }
  if (!(p.aliquotaPj >= 0 && p.aliquotaPj < 1)) return { ok: false, error: 'Informe a alíquota de IR/CSLL da empresa. Ex.: 34.' }
  if (!(p.aliquotaDividendos >= 0 && p.aliquotaDividendos < 1)) return { ok: false, error: 'Informe o imposto sobre dividendos evitado. Ex.: 10.' }
  return { ok: true, prazos: (p.prazos ?? PRAZOS).map((n) => simularPrazo(p, n)) }
}
