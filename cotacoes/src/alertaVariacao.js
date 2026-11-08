// Dólar/euro contra o fechamento anterior da fonte, o mesmo Δ dia da tabela.
// Um alerta por moeda/sentido/dia; mantém o início às 9h de Brasília.
import { marketDate } from './marketReturns.js'
import { quoteAgeState } from './quoteFreshness.js'

export const LIMITE_PCT = 0.3
export const MOEDAS_ALERTA = { USD: 'Dólar', EUR: 'Euro' }
const horaBr = (t) => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(t)))

// varBid (delta) e pctChange (pct) acompanham a mesma cotação. A base é bid - varBid,
// não uma amostra local, PTAX ou uma barra diária que ainda poderia estar incompleta.
// O fornecedor não informa a data/hora da base neste registro: não inventar "ontem".
export function fechamentoAnterior(quote) {
  if (!Number.isFinite(quote?.bid) || quote.bid <= 0 || !Number.isFinite(quote.delta) || !Number.isFinite(quote.pct)) return null
  const base = quote.bid - quote.delta
  if (!Number.isFinite(base) || base <= 0) return null
  const implied = quote.delta / base * 100
  // pctChange pode vir arredondado a duas casas. Incoerência maior invalida a referência.
  if (Math.abs(implied - quote.pct) > 0.005 + 1e-10) return null
  return base
}

export function alertasDoDia({ quotes, now = Date.now(), limite = LIMITE_PCT }) {
  if (!Number.isFinite(now) || !Number.isFinite(new Date(now).getTime()) || !Number.isFinite(limite) || limite < 0) return []
  const hoje = marketDate(now)
  const out = []
  for (const code of Object.keys(MOEDAS_ALERTA)) {
    const q = quotes?.[code]
    if (!q || (q.source && q.source !== code) || quoteAgeState(q, now) || marketDate(q.timestamp) !== hoje || horaBr(q.timestamp) < 9) continue
    const base = fechamentoAnterior(q)
    if (base === null) continue
    // Usa o mesmo percentual publicado no Δ dia, sem recalcular um limiar diferente
    // devido ao arredondamento do fornecedor. O limite permanece estritamente > 0,30%.
    const pct = q.pct
    if (Math.abs(pct) - limite <= 1e-10) continue
    const dir = pct > 0 ? 'alta' : 'queda'
    out.push({ id: `${hoje}:${code}:${dir}`, code, nome: MOEDAS_ALERTA[code], dir, pct, base, atual: q.bid, at: q.timestamp })
  }
  return out
}

export function textoAlerta(a) {
  const pct = Math.abs(a.pct).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const v = (x) => x.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  const h = (t) => new Date(t).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  return `${a.nome} em ${a.dir} de ${pct}% em relação ao fechamento anterior da fonte (${v(a.base)} → ${v(a.atual)} às ${h(a.at)} de Brasília).`
}
