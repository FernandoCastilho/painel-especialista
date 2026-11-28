// CDS de 5 anos do Brasil (risco-país), em pontos-base.
// Fonte gratuita e não oficial: World Government Bonds. A página só mostra o número depois que o navegador termina de carregar,
// por isso a coleta (scripts/fetch-cds.mjs) lê o texto já montado. Aqui ficam as regras puras: leitura do texto, conferência
// e o que a tela mostra. Regra principal: na dúvida, a linha some; o especialista nunca vê número errado.

export const CDS_SOURCE = {
  name: 'World Government Bonds',
  url: 'https://www.worldgovernmentbonds.com/cds-historical-data/brazil/5-years/',
  official: false,
}
// Faixa plausível do CDS brasileiro (mínimo histórico perto de 90 pb, pico de 2015 perto de 500 pb).
export const CDS_MIN = 50
export const CDS_MAX = 1000
// Variação acima disso contra o último dia anterior é tratada como dado estranho, não como mercado.
export const CDS_MAX_JUMP = 0.3
// Depois disso sem dado novo, a linha some (cobre fim de semana e feriado prolongado).
export const CDS_MAX_AGE_MS = 4 * 864e5
// Intervalo mínimo entre visitas ao site (a coleta das cotações roda a cada 5 min no pregão).
export const CDS_MIN_INTERVAL_MS = 115 * 60000
// Histórico guardado e mostrado no gráfico do Panorama: 12 meses.
export const CDS_HISTORY_MS = 366 * 864e5
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Data civil em Brasília (UTC−3, sem horário de verão) de um instante.
export const spDate = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10)

// A fonte publica no dia D o fechamento do dia útil anterior (conferido em 28/11/2026: o ponto de sábado 21/11 traz os
// 175,36 pb que a imprensa noticiou como fechamento de sexta 20/11; segunda nunca muda em relação a domingo).
// Data da publicação (ou do ponto do gráfico) -> dia de mercado a que o valor se refere. Feriados não são descontados.
export function closeDate(day) {
  let t = Date.parse(day + 'T12:00:00Z') - 864e5
  while ([0, 6].includes(new Date(t).getUTCDay())) t -= 864e5
  return new Date(t).toISOString().slice(0, 10)
}
// Arquivos gravados antes da correção guardavam a data da publicação; os novos guardam a data do fechamento.
const DATED_BY = 'fechamento'
const closeDated = (history, datedBy) => {
  const byDate = new Map()
  for (const p of history) { const date = datedBy === DATED_BY ? p.date : closeDate(p.date); byDate.set(date, { ...p, date }) }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// Texto da página já carregada -> { value, observedAt }. Enquanto a página mostra "----", não há leitura.
export function parseCdsText(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ')
  const v = t.match(/value stands at (\d{1,4}(?:\.\d+)?) basis points/i)
  const d = t.match(/Last Update: (\d{1,2}) ([A-Za-z]{3}) (\d{4}),? (\d{1,2}):(\d{2}) GMT\+0/i)
  if (!v || !d) throw new Error('CDS: valor ou horário não encontrados na página')
  const month = MONTHS[d[2].toLowerCase()]
  if (month == null) throw new Error('CDS: mês desconhecido no horário da página')
  const observedAt = Date.UTC(Number(d[3]), month, Number(d[1]), Number(d[4]), Number(d[5]))
  return { value: Number(v[1]), observedAt }
}

const plausible = (v) => Number.isFinite(v) && v >= CDS_MIN && v <= CDS_MAX
const validHistory = (h) => (Array.isArray(h) ? h : []).filter((p) => p && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && plausible(p.value) && Number.isFinite(p.observedAt))

// Fechamento do dia útil anterior ao do valor publicado: base da variação do dia. `history` já com datas de fechamento.
export function referenceFor(history, observedAt) {
  const day = closeDate(spDate(observedAt))
  return validHistory(history).filter((p) => p.date < day).sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null
}

// Série diária do gráfico da própria página da fonte ([instante UTC da data, pb], um ponto por dia corrido) -> histórico de 12 meses,
// já com a data do fechamento (sábado, domingo e segunda repetem o fechamento de sexta e viram um ponto só).
// Só é aceita se o último ponto bater com o número lido no texto (±5%) e não tiver salto anormal entre dias; senão, nada entra.
export function chartHistory(raw, reading, now = Date.now()) {
  if (!Array.isArray(raw) || !reading || !plausible(reading.value)) return []
  const since = reading.observedAt - CDS_HISTORY_MS
  const pts = raw
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] <= now && p[0] >= since)
    .sort((a, b) => a[0] - b[0])
    .map(([t, value]) => ({ date: closeDate(new Date(t).toISOString().slice(0, 10)), value, observedAt: t }))
    .filter((p, i, all) => all[i + 1]?.date !== p.date)
  if (pts.length < 20 || !pts.every((p) => plausible(p.value))) return []
  if (pts.some((p, i) => i && Math.abs(p.value / pts[i - 1].value - 1) > CDS_MAX_JUMP)) return []
  const today = pts.findLast((p) => p.date <= closeDate(spDate(reading.observedAt)))
  if (!today || Math.abs(today.value / reading.value - 1) > 0.05) return []
  return pts
}

// Junta a leitura nova ao arquivo anterior. Lança erro (e quem chama mantém o anterior) se a leitura não passar na conferência.
export function buildCdsData(previous, reading, now = Date.now(), chart = []) {
  const { value, observedAt } = reading ?? {}
  if (!plausible(value)) throw new Error(`CDS: ${value} pb fora da faixa de ${CDS_MIN} a ${CDS_MAX}`)
  if (!Number.isFinite(observedAt) || observedAt > now + 15 * 60000) throw new Error('CDS: horário da página inválido ou no futuro')
  if (Number.isFinite(previous?.observedAt) && observedAt < previous.observedAt) throw new Error('CDS: página com dado mais antigo que o já publicado')
  // Leituras próprias valem mais que o gráfico da fonte no mesmo dia.
  const byDate = new Map(validHistory(chart).map((p) => [p.date, p]))
  for (const p of closeDated(validHistory(previous?.history), previous?.datedBy)) byDate.set(p.date, p)
  const history = [...byDate.values()]
  const reference = referenceFor(history, observedAt)
  if (reference && Math.abs(value / reference.value - 1) > CDS_MAX_JUMP) throw new Error(`CDS: salto de ${reference.value} para ${value} pb, acima do limite`)
  const date = closeDate(spDate(observedAt))
  const nextHistory = [...history.filter((p) => p.date !== date), { date, value, observedAt }]
    .filter((p) => p.observedAt >= observedAt - CDS_HISTORY_MS)
    .sort((a, b) => a.date.localeCompare(b.date))
  return {
    generatedAt: new Date(now).toISOString(),
    lastAttemptAt: now,
    source: CDS_SOURCE,
    unit: 'pb',
    datedBy: DATED_BY,
    value,
    observedAt,
    date,
    reference: reference ? { date: reference.date, value: reference.value } : null,
    error: null,
    history: nextHistory,
  }
}

// Falha na coleta: mantém o último dado válido e registra a tentativa (a tela decide pela idade do dado).
export function cdsFailure(previous, error, now = Date.now()) {
  const base = previous && typeof previous === 'object' ? previous : { source: CDS_SOURCE, unit: 'pb', value: null, observedAt: null, reference: null, history: [] }
  return { ...base, generatedAt: new Date(now).toISOString(), lastAttemptAt: now, error: String(error?.message ?? error) }
}

// A coleta visita o site no máximo a cada ~2 h, mesmo que a rodada das cotações seja de 5 min.
export const cdsDue = (previous, now = Date.now()) => !Number.isFinite(previous?.lastAttemptAt) || now - previous.lastAttemptAt >= CDS_MIN_INTERVAL_MS

const nf = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const signed = (v, d = 2) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d)
const hora = (ms) => {
  const d = new Date(ms - 3 * 3600000)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

const ddmm = (date) => date.split('-').reverse().slice(0, 2).join('/')
// Acumulado contra o último fechamento antes de `inicio` (1º dia do mês ou do ano), na mesma série diária.
// Base a mais de 7 dias da virada (lacuna no histórico) impede o cálculo, como nos acumulados das moedas.
function accumulated(history, value, inicio) {
  const base = history.filter((p) => p.date < inicio).at(-1)
  if (!base || Date.parse(inicio) - Date.parse(base.date) > 7 * 864e5) return null
  return (value / base.value - 1) * 100
}

// O que a linha mostra. null = a linha não aparece (sem arquivo, valor fora da faixa, dado velho ou salto anormal).
export function cdsView(data, now = Date.now()) {
  if (!data || !plausible(data.value) || !Number.isFinite(data.observedAt)) return null
  if (data.observedAt > now + 3600000 || now - data.observedAt > CDS_MAX_AGE_MS) return null
  const day = closeDate(spDate(data.observedAt))
  const refRaw = data.reference && plausible(data.reference.value) && /^\d{4}-\d{2}-\d{2}$/.test(data.reference.date) ? data.reference : null
  const refDate = refRaw && (data.datedBy === DATED_BY ? refRaw.date : closeDate(refRaw.date))
  const ref = refRaw && refDate < day ? { date: refDate, value: refRaw.value } : null
  if (ref && Math.abs(data.value / ref.value - 1) > CDS_MAX_JUMP) return null
  const change = ref ? Math.round((data.value - ref.value) * 100) / 100 : null
  const pct = ref ? (data.value / ref.value - 1) * 100 : null
  const tone = change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const history = closeDated(validHistory(data.history), data.datedBy).filter((p) => p.date < day)
  const mes = accumulated(history, data.value, day.slice(0, 8) + '01')
  const ano = accumulated(history, data.value, day.slice(0, 5) + '01-01')
  return {
    value: nf(data.value),
    change: change == null ? null : signed(change),
    pct: pct == null ? null : signed(pct) + '%',
    tone,
    refDate: ref ? ddmm(ref.date) : null,
    close: ddmm(day),
    month: mes == null ? null : signed(mes) + '%',
    year: ano == null ? null : signed(ano) + '%',
    monthTone: mes == null ? 'flat' : mes > 0 ? 'up' : mes < 0 ? 'down' : 'flat',
    yearTone: ano == null ? 'flat' : ano > 0 ? 'up' : ano < 0 ? 'down' : 'flat',
    when: hora(data.observedAt),
    sourceName: data.source?.name || CDS_SOURCE.name,
  }
}
