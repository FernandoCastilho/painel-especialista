// Standalone candidate. HP 12c User's Guide, pp. 33–34, 54–56, 67–69 and Appendix D:
// https://h10032.www1.hp.com/ctg/Manual/c00363319.pdf
function requireValue(ok, code) {
  if (!ok) throw Object.assign(new RangeError('Error ' + code), { code })
}
const finite = (...xs) => xs.every(Number.isFinite)
function round(value, decimals) {
  const a = Math.abs(value) * 10 ** decimals
  requireValue(finite(a), 0)
  return Math.sign(value) * Math.round(a + a * Number.EPSILON) / 10 ** decimals || 0
}

export function hpAmort({ pv, pmt, i, n = 0, count, begin = false, decimals = 2 }) {
  requireValue(finite(pv, pmt, i, n) && Number.isSafeInteger(count) && count > 0 && count <= 100000
    && Number.isInteger(decimals) && decimals >= 0 && decimals <= 9, 5)
  let interest = 0
  let balance = pv
  for (let j = 0; j < count; j++) {
    const charge = begin && n === 0 && j === 0 ? 0 : Math.sign(pmt) * round(Math.abs(balance * i / 100), decimals)
    interest += charge
    balance = round(balance + pmt - charge, decimals)
  }
  return { interest: round(interest, decimals), principal: round(balance - pv, decimals), pv: balance, n: n + count, count }
}

export function hpSimpleInterest({ pv, i, n }) {
  requireValue(finite(pv, i, n), 0)
  const factor = -pv * i * n / 100
  requireValue(finite(factor), 0)
  return { interest360: factor / 360, interest365: factor / 365, principal: -pv }
}

const day = 86400000
function iso(s) {
  requireValue(typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s), 8)
  const d = new Date(s + 'T00:00:00Z')
  requireValue(Number.isFinite(+d) && d.toISOString().slice(0, 10) === s && s >= '1582-10-15' && s <= '4046-11-25', 8)
  return d
}
function previousCoupon(maturity, offset) {
  const d = new Date(+maturity)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() - 6 * offset)
  const month = d.getUTCMonth()
  d.setUTCDate(maturity.getUTCDate())
  requireValue(d.getUTCMonth() === month, 8)
  return d
}
function terms(settlement, maturity) {
  const s = iso(settlement), m = iso(maturity)
  const maxYear = s.getUTCFullYear() + 500
  const max = `${maxYear}-${settlement.slice(5)}`
  requireValue(s < m && maturity <= max, 8)
  let n = 1, next = m, prev = previousCoupon(m, n)
  while (prev > s) {
    next = prev
    prev = previousCoupon(m, ++n)
  }
  const period = (next - prev) / day
  return { n, fraction: (next - s) / day / period, elapsed: (s - prev) / day / period }
}
function priceAt({ n, fraction, elapsed }, coupon, yieldRate) {
  const c = coupon / 2, r = yieldRate / 200
  const accrued = c * elapsed
  if (n === 1) return { price: (100 + c) / (1 + fraction * r) - accrued, accrued }
  const l = Math.log1p(r)
  const redemption = 100 * Math.exp(-(n - 1 + fraction) * l)
  if (c === 0) return { price: redemption, accrued }
  const annuity = r === 0 ? n : -Math.expm1(-n * l) / -Math.expm1(-l)
  return { price: redemption + c * Math.exp(-fraction * l) * annuity - accrued, accrued }
}
export function hpBondPrice({ coupon, yieldRate, settlement, maturity }) {
  const t = terms(settlement, maturity)
  requireValue(finite(coupon, yieldRate) && coupon >= 0 && (t.n === 1 ? 1 + t.fraction * yieldRate / 200 > 0 : yieldRate > -200), 5)
  const result = priceAt(t, coupon, yieldRate)
  requireValue(finite(result.price, result.accrued), 5)
  return result
}
export function hpBondYield({ coupon, price, settlement, maturity }) {
  const t = terms(settlement, maturity)
  requireValue(finite(coupon, price) && coupon >= 0 && price + coupon * t.elapsed / 2 > 0, 5)
  if (t.n === 1 || coupon === 0) {
    const yieldRate = t.n === 1
      ? 200 * ((100 + coupon / 2) / (price + coupon * t.elapsed / 2) - 1) / t.fraction
      : 200 * Math.expm1((Math.log(100) - Math.log(price)) / (t.n - 1 + t.fraction))
    requireValue(finite(yieldRate) && (t.n === 1 ? 1 + t.fraction * yieldRate / 200 > 0 : yieldRate > -200), 5)
    return { yieldRate }
  }
  let lo = -200 + 1e-10, hi = 100
  while (priceAt(t, coupon, hi).price > price && hi < 1e12) hi *= 2
  requireValue(priceAt(t, coupon, hi).price <= price && priceAt(t, coupon, lo).price >= price, 5)
  for (let j = 0; j < 120; j++) {
    const mid = lo + (hi - lo) / 2
    if (mid === lo || mid === hi) break
    if (priceAt(t, coupon, mid).price > price) lo = mid
    else hi = mid
  }
  const yieldRate = lo + (hi - lo) / 2
  requireValue(finite(yieldRate, priceAt(t, coupon, yieldRate).price), 5)
  return { yieldRate }
}

export function hpDepreciation({ method, pv, fv = 0, n, i = 0, year }) {
  requireValue(finite(pv, fv, n, i, year) && n > 0 && n <= 1e10 && Number.isInteger(year) && year > 0
    && ['SL', 'SOYD', 'DB'].includes(method), 5)
  const base = pv - fv, k = Math.floor(n), fraction = n - k, y = Math.min(year, k)
  let depreciation = 0, remaining = base
  if (method === 'SL') {
    const run = Math.min(year, n), prev = Math.min(year - 1, n)
    depreciation = base * (run - prev) / n
    remaining = base * (n - run) / n
  } else if (method === 'SOYD') {
    const sum = (k + 1) * (k + 2 * fraction) / 2
    const weightedYears = y * (n + 1) - y * (y + 1) / 2 + (year > k ? fraction : 0)
    depreciation = base * (year <= k ? n - year + 1 : year === k + 1 ? fraction : 0) / sum
    remaining = base * (1 - weightedYears / sum)
  } else {
    const rate = i / (100 * n)
    // Appendix D defines keyboard DB from remaining book value, without a residual cap.
    // FV affects the remaining depreciable value only; do not add crossover or reset the balance.
    const bookBefore = pv * (1 - rate) ** (year - 1)
    depreciation = year <= n ? bookBefore * rate : 0
    remaining = pv * (1 - rate) ** Math.min(year, Math.floor(n)) - fv
  }
  requireValue(finite(depreciation, remaining), 0)
  return { depreciation, remaining }
}
