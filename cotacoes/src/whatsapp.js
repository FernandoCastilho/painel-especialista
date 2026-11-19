import { CURRENCIES } from './useQuotes.js'
import { liveParity } from './parity.js'

const num = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const pct = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}%`
// verde = alta, vermelho = queda (o triângulo vermelho dos emojis de seta parecia queda nos dois sentidos)
const arrow = (v) => (v > 0 ? '🟢' : v < 0 ? '🔴' : '⚪')

export const DISCLAIMER = 'Valores ilustrativos, em reais (paridade em dólares por euro). Para cotações reais, consulte a Tesouraria do Itaú.'

const stampOf = (when) =>
  `${when.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

// Só a cotação do momento e a variação do dia, sem compra/venda/máx./mín.
function rows(quotes) {
  const list = CURRENCIES.filter((c) => quotes?.[c.code]).map((c) => {
    const q = quotes[c.code]
    const trend = !q.fallback && Number.isFinite(q.pct) ? `${arrow(q.pct)} ${pct(q.pct)}` : '—'
    return { key: c.code, country: [...c.flag].map((ch) => String.fromCharCode(ch.codePointAt(0) - 0x1f1e6 + 65)).join(''), icon: c.flag, code: q.source ?? c.code, price: `R$ ${num(q.bid)}`, trend }
  })
  const par = liveParity(quotes?.USD, quotes?.EUR)
  if (par) {
    const usd = CURRENCIES.find((c) => c.code === 'USD')
    const eur = CURRENCIES.find((c) => c.code === 'EUR')
    list.push({ key: 'EUR', pair: ['EUR', 'USD'], country: 'EUUS', icon: `${eur.flag}${usd.flag}`, code: 'EUR/USD', price: `US$ ${num(par.main)}`, trend: `${arrow(par.pct)} ${pct(par.pct)}` })
  }
  return list
}

// WhatsApp: *negrito*, _itálico_.
export function buildMessage(quotes, when = new Date()) {
  const r = rows(quotes)
  if (!r.length) return ''
  return [`*Cotações* · ${stampOf(when)}`, '', ...r.map((x) => `${x.icon} *${x.code}* ${x.price} ${x.trend}`), '', `_${DISCLAIMER}_`].join('\n')
}

// E-mail / Teams: texto simples, sem marcação.
export function buildPlain(quotes, when = new Date()) {
  const r = rows(quotes)
  if (!r.length) return ''
  return [`Cotações · ${stampOf(when)}`, '', ...r.map((x) => `${x.icon} ${x.code}  ${x.price}  ${x.trend}`), '', DISCLAIMER].join('\n')
}

// E-mail / Teams: versão formatada (negrito) com a bandeira como imagem; `pngs` = { USD: dataURI, ... }.
export function buildHtml(quotes, when = new Date(), pngs = {}) {
  const r = rows(quotes)
  if (!r.length) return ''
  const lines = r
    .map((x) => {
      const img = (k, alt) => (pngs[k] ? `<img src="${pngs[k]}" width="18" height="12" alt="${alt}" style="vertical-align:middle">` : '')
      const flag = x.pair ? x.pair.map((k) => img(k, k)).join('') || x.icon : img(x.key, x.country) || x.icon
      return `${flag}&nbsp;<b>${x.code}</b>&nbsp;&nbsp;${x.price}&nbsp;&nbsp;${x.trend}`
    })
    .join('<br>')
  return `<p><b>Cotações</b> · ${stampOf(when)}</p><p>${lines}</p><p><i>${DISCLAIMER}</i></p>`
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`

// ---- Resumo de mercado (câmbio + juros + curvas + Focus), no formato do WhatsApp ----
const p2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dm = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
const bps = (d) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d * 100))} bps`
const last = (a) => (a?.length ? a[a.length - 1] : null)

// Vértice mais próximo de `target` numa curva [[x, taxa, ...]].
const nearest = (pts, target) => pts?.reduce((b, p) => (b && Math.abs(b[0] - target) <= Math.abs(p[0] - target) ? b : p), null)
const dayAgo = (c) => c?.compare?.find((x) => x.id === 'd1')
const latest = (c) => c?.compare?.find((x) => x.id === 'hoje')

function brLines(curves) {
  const now = latest(curves?.br)
  if (!now) return []
  const prev = dayAgo(curves.br)
  const out = [`*DI x pré* · ${dm(now.date + 'T12:00:00Z')}`]
  const parts = [[63, '3m'], [126, '6m'], [252, '1a'], [504, '2a'], [1260, '5a']].map(([d, label]) => {
    const a = nearest(curves.br.curves[now.date], d)
    const b = prev && nearest(curves.br.curves[prev.date], d)
    return a ? `${label} ${p2(a[1])}%${b ? ` (${bps(a[1] - b[1])})` : ''}` : null
  })
  out.push(parts.filter(Boolean).join(' · '))
  return out
}

function usLines(macro, curves) {
  const out = []
  const sofr = last(macro?.sofr)
  const now = latest(curves?.us)
  const prev = dayAgo(curves?.us)
  const parts = []
  if (sofr) parts.push(`SOFR ${p2(sofr[1])}% (${dm(sofr[0])})`)
  for (const lbl of ['2 Yr', '10 Yr']) {
    const a = now && curves.us.curves[now.date]?.find((p) => p[2] === lbl)
    const b = prev && curves.us.curves[prev.date]?.find((p) => p[2] === lbl)
    if (a) parts.push(`UST ${lbl.replace(' Yr', 'a')} ${p2(a[1])}%${b ? ` (${bps(a[1] - b[1])})` : ''}`)
  }
  if (parts.length) out.push('*EUA*', parts.join(' · '))
  return out
}

function brRatesLines(macro) {
  const cdi = last(macro?.cdi)
  const selic = last(macro?.selic)
  const parts = []
  if (selic) parts.push(`Selic meta ${p2(selic[1])}%`)
  if (cdi) parts.push(`CDI ${p2(cdi[1])}%`)
  const px = macro?.ptax?.USD
  if (px) parts.push(`PTAX ${num(px.sell)} (${dm(px.date + 'T12:00:00Z')})`)
  return parts.length ? ['*Brasil*', parts.join(' · ')] : []
}

function focusLines(macro) {
  const f = macro?.focus
  if (!f) return []
  const years = [...new Set(f.rows.flatMap((r) => Object.keys(r.values)))].sort().slice(0, 2)
  const fmt = { Selic: (v) => `${p2(v)}%`, IPCA: (v) => `${p2(v)}%`, PIB: (v) => `${p2(v)}%`, Câmbio: (v) => `R$ ${p2(v)}` }
  const parts = f.rows.map((r) => `${r.label} ${years.map((y) => (r.values[y] ? (fmt[r.label] ?? p2)(r.values[y].median) : '—')).join(' / ')}`)
  return [`*Focus* (${years.join(' / ')}) · ${dm(((f.link && f.release) || f.date) + 'T12:00:00Z')}`, parts.join(' · ')]
}

export function buildSummary({ quotes, macro, curves, when = new Date() }) {
  const fx = rows(quotes)
  const blocks = [
    [`*Resumo de mercado* · ${stampOf(when)}`],
    fx.length ? ['*Câmbio*', ...fx.map((x) => `${x.icon} *${x.code}* ${x.price} ${x.trend}`)] : [],
    brRatesLines(macro),
    brLines(curves),
    usLines(macro, curves),
    focusLines(macro),
    [`_${DISCLAIMER}_`],
  ].filter((b) => b.length)
  if (blocks.length <= 2) return ''
  return blocks.map((b) => b.join('\n')).join('\n\n')
}
