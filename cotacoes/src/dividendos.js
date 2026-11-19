// Distribuição de dividendos: quanto cada sócio recebe e a retenção de IR da Lei 15.270/2025 (vigente desde 01/01/2026).
// Regra usada (texto da lei; conferir regulamentação da Receita antes de usar com cliente):
// - Pessoa física residente: se a MESMA empresa pagar ao MESMO sócio mais de R$ 50.000,00 no mês,
//   retém 10% sobre o TOTAL pago no mês (não só sobre o excedente). Até R$ 50.000,00 no mês: sem retenção.
// - Sócio residente no exterior: 10% na fonte sobre todo o valor, sem limite mensal.
// - Transição: lucros apurados até 2025, com distribuição aprovada até 31/12/2025, ficam sem retenção.
// Fora da conta: imposto mínimo anual (IRPFM, renda acima de R$ 600 mil no ano), redutor da carga somada PJ + PF,
// regras de S.A. (reserva legal, dividendo mínimo obrigatório) e dúvidas sobre o Simples Nacional.

export const LIMITE_MENSAL = 50000
export const ALIQUOTA = 0.1
export const MAX_SOCIOS = 10
export const MAX_MESES = 60

const LIMITE_CENTAVOS = LIMITE_MENSAL * 100
const cents = (v) => Math.round(v * 100)

// "12,5" → 12.5; "1.234,56" → 1234.56; vazio ou inválido → NaN.
export function parseDecimal(text) {
  const t = String(text ?? '').trim().replace(/\s|%/g, '')
  if (!t) return NaN
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(t)) return NaN
  return Number(t.replaceAll('.', '').replace(',', '.'))
}

// Reparte um valor em centavos em n partes iguais; os centavos que sobram vão para as primeiras partes.
export function repartirCentavos(totalCentavos, n) {
  const base = Math.floor(totalCentavos / n)
  const resto = totalCentavos - base * n
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0))
}

// Reparte o total entre os sócios pelo percentual; a diferença de arredondamento fica com o maior sócio.
export function repartirSocios(totalCentavos, pcts) {
  const partes = pcts.map((p) => Math.round(totalCentavos * p))
  const dif = totalCentavos - partes.reduce((a, b) => a + b, 0)
  if (dif && partes.length) partes[pcts.indexOf(Math.max(...pcts))] += dif
  return partes
}

// IR na fonte de um pagamento mensal (em centavos).
export function irrfMes(parcelaCentavos, { exterior = false, transicao = false } = {}) {
  if (transicao || parcelaCentavos <= 0) return 0
  if (exterior || parcelaCentavos > LIMITE_CENTAVOS) return Math.round(parcelaCentavos * ALIQUOTA)
  return 0
}

// Menor número de meses para que nenhum pagamento mensal passe de R$ 50.000,00.
export function mesesSemRetencao(totalCentavos) {
  return Math.max(1, Math.ceil(totalCentavos / LIMITE_CENTAVOS))
}

function socioResultado(totalCentavos, meses, { exterior, transicao }) {
  const parcelas = repartirCentavos(totalCentavos, meses)
  const irrf = parcelas.map((p) => irrfMes(p, { exterior, transicao }))
  const irTotal = irrf.reduce((a, b) => a + b, 0)
  return { parcelas, irrf, irTotal, liquido: totalCentavos - irTotal }
}

export function simularDividendos({ lucro, payout = 1, meses = 1, socios = [], transicao = false }) {
  if (!(lucro > 0)) return { ok: false, error: 'Informe o lucro disponível para distribuir.' }
  if (!(payout > 0 && payout <= 1)) return { ok: false, error: 'O percentual a distribuir deve ficar entre 0,01% e 100%.' }
  if (!Number.isInteger(meses) || meses < 1 || meses > MAX_MESES) return { ok: false, error: `Informe de 1 a ${MAX_MESES} pagamentos mensais.` }
  if (!socios.length) return { ok: false, error: 'Inclua ao menos um sócio.' }
  if (socios.length > MAX_SOCIOS) return { ok: false, error: `Use no máximo ${MAX_SOCIOS} sócios.` }
  if (socios.some((s) => !(s.pct > 0))) return { ok: false, error: 'Cada sócio precisa de uma participação maior que zero.' }
  const soma = socios.reduce((a, s) => a + s.pct, 0)
  if (Math.abs(soma - 1) > 1e-6) return { ok: false, error: `As participações somam ${(soma * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%. Devem somar 100%.` }

  const totalC = cents(lucro * payout)
  const partes = repartirSocios(totalC, socios.map((s) => s.pct))
  const linhas = socios.map((s, i) => {
    const atual = socioResultado(partes[i], meses, { exterior: s.exterior, transicao })
    // Para residente: menor prazo que zera a retenção, e quanto se deixaria de reter com ele.
    const minimo = s.exterior || transicao ? null : mesesSemRetencao(partes[i])
    const alternativo = minimo && minimo > meses ? socioResultado(partes[i], minimo, { exterior: false, transicao }) : null
    return {
      nome: s.nome?.trim() || `Sócio ${i + 1}`,
      pct: s.pct,
      exterior: !!s.exterior,
      total: partes[i] / 100,
      parcela: Math.max(...atual.parcelas) / 100,
      retido: atual.irrf.some((v) => v > 0),
      ir: atual.irTotal / 100,
      liquido: atual.liquido / 100,
      mesesSemRetencao: minimo,
      economia: alternativo ? (atual.irTotal - alternativo.irTotal) / 100 : 0,
      parcelas: atual.parcelas.map((p) => p / 100),
      irrfMeses: atual.irrf.map((v) => v / 100),
    }
  })
  const irC = linhas.reduce((a, l) => a + cents(l.ir), 0)
  return {
    ok: true,
    total: totalC / 100,
    retido: (cents(lucro) - totalC) / 100,
    ir: irC / 100,
    liquido: (totalC - irC) / 100,
    aliquotaEfetiva: totalC ? irC / totalC : 0,
    meses,
    mesesSemRetencao: linhas.reduce((m, l) => Math.max(m, l.mesesSemRetencao ?? 0), 0) || null,
    economia: linhas.reduce((a, l) => a + cents(l.economia), 0) / 100,
    linhas,
  }
}
