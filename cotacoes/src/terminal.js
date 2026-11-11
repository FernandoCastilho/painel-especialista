// Camada de apresentação do terminal: comandos digitados, faixa de cotações e indicadores do topo.
// Só formata o que o app já coleta; não consulta fontes nem calcula taxas novas.
import { liveCross } from './parity.js'
import { brentReturns } from './oilReference.js'
import { nf } from './format.js'
import { sourceHealth } from './dataHealth.js'

import { APP_SECTIONS } from './appSections.js'

export const DESK_TABS = APP_SECTIONS.map(({ id, label, terminalLabel, oculto }) => ({ id, label: terminalLabel || label, ...(oculto ? { oculto } : {}) }))

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/<GO>|CURNCY|CURRENCY|[\s/\-_.]+/g, '')

const CURRENCY = { USD: 'USD', USDBRL: 'USD', DOLAR: 'USD', EUR: 'EUR', EURBRL: 'EUR', EURO: 'EUR', JPY: 'JPY', JPYBRL: 'JPY', IENE: 'JPY', CNH: 'CNH', CNHBRL: 'CNH', CNY: 'CNH', YUAN: 'CNH' }
const PAIR = new Set(['EURUSD', 'PARIDADE', 'PAR'])
const TAB = {
  MERCADO: ['resumo'], RESUMO: ['resumo'], HOME: ['resumo'],
  JUROS: ['juros'], DI: ['juros'], SELIC: ['juros'], CDI: ['juros'], CURVA: ['juros'], CURVAS: ['juros'], SOFR: ['juros'], TREASURY: ['juros'], UST: ['juros'],
  CENARIOS: ['cenarios'], FOCUS: ['cenarios', 'projecoes'], PROJECOES: ['cenarios', 'projecoes'],
  ATIVIDADE: ['cenarios', 'atividade'], PMI: ['cenarios', 'atividade'], PAYROLL: ['cenarios', 'atividade'], EMPREGO: ['cenarios', 'atividade'],
  COMMODITIES: ['cenarios', 'commodities'], PETROLEO: ['cenarios', 'commodities'], BRENT: ['cenarios', 'commodities'], OURO: ['cenarios', 'commodities'],
  FRETE: ['cenarios', 'frete'],
  BNDES: ['bndes'], TFB: ['bndes'],
  BANCOS: ['bancos'], BASILEIA: ['bancos'],
  SETORES: ['setores'], COBRE: ['setores', 'cobre'], ALUMINIO: ['setores', 'aluminio'], ACO: ['setores', 'aco'], TELECOM: ['setores', 'telecom'], INDUSTRIA: ['setores', 'industria'], VAREJO: ['setores', 'comercio'],
  TLPEXIGIVEL: ['calculadora', 'bndes-tlp-exigivel'], CREDITOTFB: ['calculadora', 'bndes-credito-tfb'],
  COMPARADORDECREDITO: ['calculadora', 'comparador-credito'],
  EMPRESTIMO4131: ['calculadora', 'emprestimo-4131'], LEI4131: ['calculadora', 'emprestimo-4131'], 4131: ['calculadora', 'emprestimo-4131'],
  OPERACAODI: ['calculadora', 'operacao-di'], OPERACAOXDI: ['calculadora', 'operacao-di'], OPXDI: ['calculadora', 'operacao-di'],
  CALC: ['calculadora'], CALCULADORA: ['calculadora'], CALCULADORAS: ['calculadora'], GIRO: ['calculadora', 'giro'], DESCONTO: ['calculadora', 'analise-desconto'], ANALISEDEDESCONTO: ['calculadora', 'analise-desconto'], FINIMP: ['calculadora', 'finimp'], FINAME: ['calculadora', 'finame-materiais'], FINAMEMATERIAIS: ['calculadora', 'finame-materiais'],
  NEWS: ['noticias'], NOTICIAS: ['noticias'], AGENDA: ['noticias'],
  FERIADOS: ['feriados'], APRESENTAR: ['apresentar'], APRESENTACAO: ['apresentar'], CONFIG: ['config'], AJUDA: ['config'], HELP: ['config'],
  APRENDER: ['aprender'], EDU: ['aprender'], EDUCACAO: ['aprender'], ESTUDAR: ['aprender'], CUPOM: ['aprender', 'cupom-cambial'], CUPOMCAMBIAL: ['aprender', 'cupom-cambial'], EURIBOR: ['aprender', 'euribor'], FUNDING: ['aprender', 'custo-de-funding'], CUSTODEFUNDING: ['aprender', 'custo-de-funding'], CDS: ['aprender', 'cds'],
  MAQUILA: ['aprender', 'lei-de-maquila'], LEIDEMAQUILA: ['aprender', 'lei-de-maquila'], MAQUILAPARAGUAI: ['aprender', 'lei-de-maquila'], LEIDEMAQUILANOPARAGUAI: ['aprender', 'lei-de-maquila'],
}

// "USDBRL Curncy", "usd/brl", "dólar", "juros <GO>" → destino, ou null se o comando não existe.
export function parseCommand(text) {
  const key = norm(text)
  if (!key) return null
  if (CURRENCY[key]) return { kind: 'currency', code: CURRENCY[key] }
  if (PAIR.has(key)) return { kind: 'pair' }
  if (TAB[key]) return { kind: 'tab', id: TAB[key][0], sub: TAB[key][1] ?? '' }
  return null
}


export const toneOf = (v) => (Number.isFinite(v) && v > 0 ? 'up' : Number.isFinite(v) && v < 0 ? 'down' : 'flat')

// Uma variação que arredonda para zero na unidade exibida (0,00% ou 0 bps) não pode ter seta nem cor de alta ou baixa.
const roundsToZero = (change, unit) => Number.isFinite(change) && (unit === 'bps' ? Math.round(Math.abs(change) * 100) === 0 : Math.round(Math.abs(change) * 100) === 0)

// unit 'pct' (variação do dia), 'bps' (taxa de juros: a variação vem em pontos percentuais) ou 'pp' (pontos percentuais, mostrados como tal).
export function changeText(change, unit = 'pct') {
  if (!Number.isFinite(change)) return null
  const sign = roundsToZero(change, unit) ? '' : change > 0 ? '+' : change < 0 ? '−' : ''
  if (unit === 'pp') return `${sign}${nf(Math.abs(change), 2)} p.p.`
  return unit === 'bps' ? `${sign}${Math.abs(Math.round(change * 100))} bps` : `${sign}${nf(Math.abs(change), 2)}%`
}

const priceDigits = (code) => (code === 'JPY' ? 5 : 4)

// Itens do tipo { key, label, value, change, unit, tone } usados pela faixa, pelos indicadores e pelo mapa de variação.
function fxItems(quotes) {
  const out = []
  for (const code of ['USD', 'EUR', 'JPY', 'CNH']) {
    const q = quotes?.[code]
    if (!q || !(q.bid > 0)) continue
    const hasDay = !q.fallback && Number.isFinite(q.pct)
    out.push({ key: `${code}BRL`, code, label: `${q.source || code}/BRL`, value: nf(q.bid, priceDigits(code)), change: hasDay ? q.pct : null, unit: 'pct' })
  }
  return out
}

// Paridade para a Finimp: a paridade EUR/USD do momento, com 2 centavos a mais ou a menos conforme a moeda do pagamento
// e a do financiamento. Arredonda a 4 casas para não carregar resíduo de ponto flutuante (1,1172 + 0,02 = 1,1372).
export const FINIMP_MARGEM = 0.02
export function finimpParidade(par) {
  if (!Number.isFinite(par)) return null
  const r = (v) => Math.round(v * 1e4) / 1e4
  return { base: r(par), eurUsd: r(par + FINIMP_MARGEM), usdEur: r(par - FINIMP_MARGEM) }
}

// Paridade EUR/USD: a cotação direta de mercado (EUR-USD da AwesomeAPI, pela coleta central) quando existe, não retida e
// não mais velha que 30 min em relação ao EUR/BRL; senão, o cruzamento EUR/BRL ÷ USD/BRL.
export function directParity(quotes, maxGap = 30 * 60000) {
  const d = quotes?.EURUSD
  if (!d || d.stale || !(d.bid > 0) || !Number.isFinite(d.timestamp)) return null
  if (quotes?.EUR?.timestamp && Number(quotes.EUR.timestamp) - d.timestamp > maxGap) return null
  return d
}
// Calculadora da Finimp: valor do pagamento na moeda de pagamento → valor a financiar na outra moeda.
// 'eur-usd' (paga em EUR, financia em USD): EUR × (paridade + 0,02). 'usd-eur' (paga em USD, financia em EUR): USD ÷ (paridade − 0,02).
export const FINIMP_MODOS = {
  'eur-usd': { label: 'Pagamento em EUR, financiamento em USD', paga: 'EUR', financia: 'USD' },
  'usd-eur': { label: 'Pagamento em USD, financiamento em EUR', paga: 'USD', financia: 'EUR' },
}
export function finimpConverte(valor, modo, fin) {
  if (!fin || !(valor > 0) || !FINIMP_MODOS[modo]) return null
  const taxa = modo === 'eur-usd' ? fin.eurUsd : fin.usdEur
  if (!(taxa > 0)) return null
  const v = modo === 'eur-usd' ? valor * taxa : valor / taxa
  return { taxa, valor: Math.round(v * 100) / 100, moeda: FINIMP_MODOS[modo].financia }
}

function parityItem(quotes) {
  const d = directParity(quotes)
  if (d) return { key: 'EURUSD', code: 'PAR', label: 'EUR/USD', raw: d.bid, direct: true, comparable: true, at: { PAR: d.timestamp }, value: nf(d.bid, 4), change: Number.isFinite(d.pct) ? d.pct : null, unit: 'pct', reason: null }
  const p = liveCross(quotes?.EUR, quotes?.USD)
  if (!p || quotes.EUR.fallback || quotes.USD.fallback) return null
  return { key: 'EURUSD', code: 'PAR', label: 'EUR/USD', raw: p.main, direct: false, comparable: p.comparable !== false, at: { EUR: Number(quotes.EUR.timestamp), USD: Number(quotes.USD.timestamp) }, value: nf(p.main, 4), change: p.comparable === false ? null : p.pct, unit: 'pct', reason: p.comparable === false ? 'cotações de horários distintos' : null }
}

function rateItems(rates) {
  return (rates ?? []).map((r) => ({ key: r.key, label: r.label, value: `${nf(r.value, 2)}%`, change: r.delta, unit: 'bps', rate: true }))
}

const withTone = (items) => items.map((i) => ({ ...i, tone: roundsToZero(i.change, i.unit) ? 'flat' : toneOf(i.change), text: changeText(i.change, i.unit) }))

// Brent spot diário da EIA (arquivo oil.json): é referência datada, não cotação em tempo real; por isso leva a data.
// A variação é a da última observação sobre a anterior (só existe quando a série traz as duas).
export function brentItem(oil) {
  if (oil?.benchmark !== 'Brent' || oil?.kind !== 'spot' || oil?.unit !== 'USD/barril' || !Number.isFinite(oil.value)) return null
  const [, m, d] = String(oil.observationDate ?? '').split('-')
  const day = brentReturns(oil).day
  return { key: 'BRENT', code: 'BRENT', label: 'Brent EIA', value: nf(oil.value, 2), change: Number.isFinite(day) ? day : null, unit: 'pct', note: d && m ? `${d}/${m}` : null }
}

// IPCA acumulado em 12 meses (IBGE, série já validada por normalizeIpca): valor do último mês e diferença em p.p. sobre o mês anterior.
// Sem o mês anterior, a variação fica ausente; nunca vira zero.
export function ipcaItem(series) {
  const points = (series?.points ?? []).filter((p) => Number.isFinite(p?.y12))
  const last = points.at(-1)
  if (!last) return null
  const [y, m] = last.period.split('-').map(Number)
  const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  const prev = points.find((p) => p.period === prevKey)
  const note = new Date(`${last.period}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '').replace(' de ', '/')
  return { key: 'IPCA', code: 'IPCA', label: 'IPCA 12m', value: `${nf(last.y12, 2)}%`, change: prev ? last.y12 - prev.y12 : null, unit: 'pp', note }
}

// Ibovespa (arquivo indices.json, fechamento diário do Yahoo, atrasado): último fechamento e variação sobre o anterior, com a data.
export function ibovItem(file) {
  const s = file?.series?.ibov
  const pts = (s?.points ?? []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0)
  const last = pts.at(-1), prev = pts.at(-2)
  if (!last) return null
  const note = new Date(last[0]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
  return { key: 'IBOV', code: 'IBOV', label: 'Ibovespa', value: nf(last[1], 0), change: prev ? (last[1] / prev[1] - 1) * 100 : null, unit: 'pct', note, stale: !!s.stale }
}
// Minigráfico do Ibovespa: os últimos 30 fechamentos.
export const ibovSpark = (file) => (file?.series?.ibov?.points ?? []).slice(-30).map(([t, v]) => ({ t, bid: v }))

// Faixa corrida sob a barra superior: câmbio, paridade, juros de referência e Brent (EIA, com data).
export function tapeItems(quotes, rates, oil) {
  const p = parityItem(quotes)
  const brent = brentItem(oil)
  return withTone([...fxItems(quotes), ...(p ? [p] : []), ...rateItems(rates), ...(brent ? [brent] : [])])
}

// Indicadores do topo do Mercado: dólar, euro, paridade, IPCA em 12 meses (IBGE, quando há série) e os três juros de referência do Brasil.
export function kpiItems(quotes, rates, ipca, ibov) {
  const fx = fxItems(quotes)
  const p = parityItem(quotes)
  const byKey = Object.fromEntries(rateItems(rates).map((r) => [r.key, r]))
  const pick = (...keys) => keys.map((k) => byKey[k]).filter(Boolean)
  return withTone([fx.find((i) => i.code === 'USD'), fx.find((i) => i.code === 'EUR'), p, ipcaItem(ipca), ibovItem(ibov), ...pick('selic', 'cdi', 'di1')].filter(Boolean))
}

// Minigráficos dos cards de CDI, Selic e IPCA, só com dados observados: nada é preenchido nem interpolado.
// CDI e Selic: fechamento de cada um dos 12 meses anteriores (último valor observado até o fim do mês) mais a última observação.
// Mês sem observação fica de fora. A Selic é uma série em degraus (só os dias de mudança estão no arquivo), então vale o último valor em vigor;
// no CDI, que é diário, uma observação mais de 7 dias antes do fim do mês é lacuna e o mês é descartado. Série parada há mais de 10 dias: sem gráfico.
const DAY = 864e5
const MIN_SPARK = 7
export function monthlyCloses(points, now = Date.now(), { months = 12, step = false } = {}) {
  const pts = (Array.isArray(points) ? points : []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0])
  const last = pts.at(-1)
  if (!last || now - last[0] > 10 * DAY) return []
  const ref = new Date(last[0])
  const out = []
  for (let k = months; k >= 1; k--) {
    const end = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - k + 1, 1) - 1
    let found = null
    for (const p of pts) { if (p[0] <= end) found = p; else break }
    if (found && (step || end - found[0] <= 7 * DAY)) out.push({ t: found[0], bid: found[1] })
  }
  out.push({ t: last[0], bid: last[1] })
  return out.length >= MIN_SPARK ? out : []
}

// IPCA em 12 meses: os últimos 12 meses divulgados (os que existem; mês ausente não é preenchido).
export function ipcaSpark(series) {
  const pts = (series?.points ?? []).filter((p) => Number.isFinite(p?.y12) && /^\d{4}-\d{2}$/.test(p.period)).sort((a, b) => a.period.localeCompare(b.period))
  const idx = (p) => Number(p.period.slice(0, 4)) * 12 + Number(p.period.slice(5))
  const last = pts.at(-1)
  if (!last) return []
  const out = pts.filter((p) => idx(last) - idx(p) < 12).map((p) => ({ t: Date.parse(`${p.period}-15T12:00:00Z`), bid: p.y12 }))
  return out.length >= MIN_SPARK ? out : []
}

export const kpiSparks = ({ macro, ipca }, now = Date.now()) => ({
  cdi: monthlyCloses(macro?.cdi, now),
  selic: monthlyCloses(macro?.selic, now, { step: true }),
  IPCA: ipcaSpark(ipca),
})
// Cor do minigráfico de 12 meses: pela variação do próprio gráfico (primeiro contra último ponto), não pela do dia mostrada no card.
export const sparkTone = (points) => {
  const d = points.at(-1).bid - points[0].bid
  return Math.abs(d) < 0.005 ? 'flat' : d > 0 ? 'up' : 'down'
}
export const SPARK_NOTE = { cdi: 'fechamento mensal, 12 meses', selic: 'fechamento mensal, 12 meses', IPCA: 'últimos 12 meses divulgados', IBOV: 'fechamentos disponíveis no histórico carregado' }

// Estado do indicador "dados" da barra superior, a partir do que App.jsx já sabe sobre as cotações.
export function feedState({ error, aged, hasQuotes }) {
  if (error) return 'err'
  if (!hasQuotes) return 'loading'
  return aged ? 'delayed' : 'ok'
}

// Estado da coleta; metadados de retenção prevalecem sobre a data de geração.
export function dataStatus(entries, now = Date.now()) {
  return entries.map(e => {
    const health = e.health ?? sourceHealth(e.resource ?? { data: { generatedAt: e.at } }, e.maxAge, e.weekdays, now)
    const { label: statusLabel, ...details } = health
    return { key: e.key, label: e.label, ...details, statusLabel, at: health.generatedAt, ageMs: health.generatedAt ? Math.max(0, now - health.generatedAt) : null }
  })
}

export function ageText(ageMs) {
  if (!Number.isFinite(ageMs)) return '—'
  const min = Math.round(ageMs / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`
}

export const SHORTCUTS = [
  ['Ctrl + Shift + F', 'Buscar em todo o painel; o botão Buscar também está disponível no celular'],
  ['Alt + 1 … 9', DESK_TABS.filter(tab => !tab.oculto).map(tab => tab.label).join(', ')],
  ['Ctrl + ~  ou  Ctrl + "', 'Laser pointer (Alt + L também vale): liga e desliga (Esc também para). Ligado, o mouse segue normal: clique clica; arrastar risca; Ctrl + arrastar faz um retângulo; Shift + arrastar, uma seta. Tudo se apaga sozinho'],
]
