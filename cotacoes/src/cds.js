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
const HISTORY_DAYS = 30
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

// Data civil em Brasília (UTC−3, sem horário de verão) de um instante.
export const spDate = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10)

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

// Último fechamento de um dia anterior ao da observação: base da variação do dia.
export function referenceFor(history, observedAt) {
  const day = spDate(observedAt)
  return validHistory(history).filter((p) => p.date < day).sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null
}

// Junta a leitura nova ao arquivo anterior. Lança erro (e quem chama mantém o anterior) se a leitura não passar na conferência.
export function buildCdsData(previous, reading, now = Date.now()) {
  const { value, observedAt } = reading ?? {}
  if (!plausible(value)) throw new Error(`CDS: ${value} pb fora da faixa de ${CDS_MIN} a ${CDS_MAX}`)
  if (!Number.isFinite(observedAt) || observedAt > now + 15 * 60000) throw new Error('CDS: horário da página inválido ou no futuro')
  if (Number.isFinite(previous?.observedAt) && observedAt < previous.observedAt) throw new Error('CDS: página com dado mais antigo que o já publicado')
  const history = validHistory(previous?.history)
  const reference = referenceFor(history, observedAt)
  if (reference && Math.abs(value / reference.value - 1) > CDS_MAX_JUMP) throw new Error(`CDS: salto de ${reference.value} para ${value} pb, acima do limite`)
  const date = spDate(observedAt)
  const nextHistory = [...history.filter((p) => p.date !== date), { date, value, observedAt }]
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-HISTORY_DAYS)
  return {
    generatedAt: new Date(now).toISOString(),
    lastAttemptAt: now,
    source: CDS_SOURCE,
    unit: 'pb',
    value,
    observedAt,
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

// O que a linha mostra. null = a linha não aparece (sem arquivo, valor fora da faixa, dado velho ou salto anormal).
export function cdsView(data, now = Date.now()) {
  if (!data || !plausible(data.value) || !Number.isFinite(data.observedAt)) return null
  if (data.observedAt > now + 3600000 || now - data.observedAt > CDS_MAX_AGE_MS) return null
  const ref = data.reference && plausible(data.reference.value) && data.reference.date < spDate(data.observedAt) ? data.reference : null
  if (ref && Math.abs(data.value / ref.value - 1) > CDS_MAX_JUMP) return null
  const change = ref ? Math.round((data.value - ref.value) * 100) / 100 : null
  const pct = ref ? (data.value / ref.value - 1) * 100 : null
  const tone = change == null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  return {
    value: nf(data.value),
    change: change == null ? null : signed(change),
    pct: pct == null ? null : signed(pct) + '%',
    tone,
    refDate: ref ? ref.date.split('-').reverse().slice(0, 2).join('/') : null,
    when: hora(data.observedAt),
    sourceName: data.source?.name || CDS_SOURCE.name,
  }
}
