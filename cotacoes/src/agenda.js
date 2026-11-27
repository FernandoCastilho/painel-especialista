// Agenda de eventos de mercado. Datas conferidas em 10/10/2026 (ver `source` de cada grupo).
// "previsto" = data de terceiros, a conferir no órgão oficial antes de usar como referência.
export const CHECKED = '2026-10-10'

const GROUPS = [
  {
    kind: 'Copom',
    source: 'Banco Central (calendário de 2026)',
    tz: 'America/Sao_Paulo',
    time: '18:30',
    label: 'Copom: decisão da Selic',
    dates: ['2026-11-04', '2026-12-09'],
  },
  {
    kind: 'FOMC',
    source: 'Federal Reserve (calendário de 2026)',
    tz: 'America/New_York',
    time: '14:00',
    label: 'FOMC: decisão de juros do Fed',
    dates: ['2026-10-28', '2026-12-09'],
  },
  {
    kind: 'Payroll',
    source: 'BLS (Employment Situation)',
    tz: 'America/New_York',
    time: '08:30',
    label: 'Payroll: emprego nos EUA',
    dates: ['2026-11-06', '2026-12-04'],
  },
  {
    kind: 'IPCA',
    source: 'IBGE (data prevista, a confirmar)',
    tz: 'America/Sao_Paulo',
    time: '09:00',
    label: 'IPCA (previsto)',
    tentative: true,
    dates: ['2026-11-12', '2026-12-11'],
  },
  {
    kind: 'IPCA-15',
    source: 'IBGE (data prevista, a confirmar)',
    tz: 'America/Sao_Paulo',
    time: '09:00',
    label: 'IPCA-15 (previsto)',
    tentative: true,
    dates: ['2026-10-23', '2026-11-26', '2026-12-23'],
  },
]

// Instante UTC de "AAAA-MM-DD HH:MM" no fuso `tz` (sem biblioteca: ajusta pelo deslocamento do fuso).
export function zonedToUtc(date, time, tz) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess))
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return guess - (asLocal - guess)
}

// Focus: toda segunda-feira, 8h25 (Brasília).
function focusMondays(from, to) {
  const out = []
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - 1))
  for (let i = 0; i < 60; i++) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 1) continue
    const date = d.toISOString().slice(0, 10)
    const t = zonedToUtc(date, '08:25', 'America/Sao_Paulo')
    if (t >= from.getTime() && t <= to.getTime()) out.push({ kind: 'Focus', label: 'Boletim Focus', t, source: 'Banco Central', tentative: false })
  }
  return out
}

// Eventos de `now` até `now + days`, em ordem cronológica.
export function upcoming(now = new Date(), days = 30) {
  const end = new Date(now.getTime() + days * 864e5)
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const events = []
  for (const g of GROUPS) {
    for (const date of g.dates) {
      const t = zonedToUtc(date, g.time, g.tz)
      if (t >= startOfDay.getTime() && t <= end.getTime()) events.push({ kind: g.kind, label: g.label, t, source: g.source, tentative: !!g.tentative })
    }
  }
  events.push(...focusMondays(startOfDay, end))
  return events.sort((a, b) => a.t - b.t)
}

// Eventos confirmados (sem os "previstos") entre `from` e `to`, em milissegundos: marcas do gráfico de câmbio.
export function confirmadosEntre(from, to) {
  const out = []
  for (const g of GROUPS) {
    if (g.tentative) continue
    for (const date of g.dates) {
      const t = zonedToUtc(date, g.time, g.tz)
      if (t >= from && t <= to) out.push({ kind: g.kind, label: g.label, t, source: g.source })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}
