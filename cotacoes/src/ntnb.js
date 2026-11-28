// NTN-B (Tesouro IPCA+ com Juros Semestrais): a taxa é o juro real, acima do IPCA, que o Tesouro paga em cada vencimento.
// Fonte oficial e pública: planilha diária de preços e taxas do Tesouro Direto, no Tesouro Transparente. Usada a taxa de
// compra da manhã (a que o investidor trava ao comprar). Lógica pura: serve à coleta (scripts/fetch-ntnb.mjs) e à tela.
export const NTNB_SOURCE = {
  name: 'Tesouro Transparente · Tesouro Direto',
  url: 'https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto',
  csv: 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv',
}
export const NTNB_TIPO = 'Tesouro IPCA+ com Juros Semestrais'
const DAY = 864e5
const HIST_ANOS = 10 // histórico guardado: 10 anos antes da última data
const REVISITA_MS = 3 * 3600e3 // a planilha muda 1 vez por dia útil; visita no máximo a cada 3 h
const FAIXA = [-5, 25] // juro real fora disso é erro de leitura

const iso = (dmy) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy ?? '')
  if (!m) return null
  const d = `${m[3]}-${m[2]}-${m[1]}`
  return new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d ? d : null
}
const menosDias = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) - n * DAY).toISOString().slice(0, 10)

// Planilha do Tesouro (separador ";", decimal com vírgula) -> taxas de compra da NTN-B por vencimento e data.
// Título fora de oferta aparece com taxa de compra 0 ou vazia: não é taxa, fica de fora.
export function parseNtnbCsv(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('planilha do Tesouro vazia')
  const head = lines[0].split(';').map((c) => c.trim())
  const col = (nome) => head.indexOf(nome)
  const [iTipo, iVenc, iData, iTaxa] = ['Tipo Titulo', 'Data Vencimento', 'Data Base', 'Taxa Compra Manha'].map(col)
  if ([iTipo, iVenc, iData, iTaxa].some((i) => i < 0)) throw new Error('formato da planilha do Tesouro mudou')
  const porVenc = new Map()
  for (const line of lines.slice(1)) {
    const c = line.split(';')
    if (c[iTipo]?.trim() !== NTNB_TIPO) continue
    const venc = iso(c[iVenc]?.trim()), data = iso(c[iData]?.trim())
    if (!venc || !data) throw new Error(`data inválida na planilha do Tesouro: ${line.slice(0, 80)}`)
    const raw = (c[iTaxa] ?? '').trim()
    if (!raw) continue
    const taxa = Number(raw.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(taxa)) throw new Error(`taxa inválida na planilha do Tesouro em ${data}`)
    if (taxa === 0) continue
    if (taxa < FAIXA[0] || taxa > FAIXA[1]) throw new Error(`taxa fora do esperado para a NTN-B ${venc} em ${data}: ${raw}`)
    if (!porVenc.has(venc)) porVenc.set(venc, new Map())
    porVenc.get(venc).set(data, taxa)
  }
  if (!porVenc.size) throw new Error('planilha do Tesouro sem NTN-B')
  return porVenc
}

// Última data com taxa em cada data de comparação: no máximo a data pedida (nunca usa dado posterior).
const ultimaAte = (datas, alvo) => datas.findLast((d) => d <= alvo)

// Arquivo publicado: vencimentos em oferta na última data, histórico de 10 anos alinhado por data e curva de hoje,
// de 1 mês e de 1 ano atrás (só com os vencimentos de hoje, para comparar o mesmo título).
export function buildNtnbData(porVenc, now = Date.now()) {
  const ref = [...porVenc.values()].flatMap((m) => [...m.keys()]).sort().at(-1)
  const vencimentos = [...porVenc.keys()].filter((v) => porVenc.get(v).has(ref) && v > ref).sort()
  if (vencimentos.length < 4) throw new Error(`poucos vencimentos de NTN-B em oferta em ${ref} (${vencimentos.length})`)
  const desde = menosDias(ref, Math.round(HIST_ANOS * 365.25))
  const dates = [...new Set(vencimentos.flatMap((v) => [...porVenc.get(v).keys()]))].filter((d) => d >= desde && d <= ref).sort()
  const series = Object.fromEntries(vencimentos.map((v) => [v, dates.map((d) => porVenc.get(v).get(d) ?? null)]))
  const compare = [['hoje', 'Hoje', 0], ['mes', '1 mês', 30], ['ano', '1 ano', 365]]
    .map(([id, label, dias]) => ({ id, label, date: dias ? ultimaAte(dates, menosDias(ref, dias)) : ref }))
    .filter((c, i, a) => c.date && a.findIndex((x) => x.date === c.date) === i)
  const curves = Object.fromEntries(compare.map((c) => [c.date, vencimentos
    .filter((v) => porVenc.get(v).has(c.date))
    .map((v) => [anoDe(v), porVenc.get(v).get(c.date), v.slice(0, 4)])]))
  const at = new Date(now).toISOString()
  return { schemaVersion: 1, generatedAt: at, checkedAt: at, lastAttemptAt: now, ref, source: NTNB_SOURCE, tipo: NTNB_TIPO, taxa: 'compra-manha', vencimentos, dates, series, curve: { sourceDate: ref, compare, curves }, stale: false }
}
const anoDe = (v) => +(Number(v.slice(0, 4)) + (Number(v.slice(5, 7)) - 1) / 12).toFixed(3)

export const ntnbDue = (previous, now = Date.now()) => !Number.isFinite(previous?.lastAttemptAt) || now - previous.lastAttemptAt >= REVISITA_MS

// Falha da coleta: mantém o último dado válido, marcado como pendente.
export function ntnbFailure(previous, error, now = Date.now()) {
  const msg = String(error?.message ?? error).slice(0, 200)
  if (previous?.vencimentos?.length) return { ...previous, stale: true, error: msg, lastAttemptAt: now }
  return { schemaVersion: 1, generatedAt: new Date(now).toISOString(), lastAttemptAt: now, stale: true, error: msg }
}

// Nova leitura nunca pode recuar no tempo em relação à já publicada.
export function ntnbAccept(previous, next) {
  if (previous?.ref && next.ref < previous.ref) throw new Error(`planilha do Tesouro com data ${next.ref}, anterior à já publicada (${previous.ref})`)
  return next
}

// --- tela ---

const isoOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? '')
// Confere o arquivo antes de desenhar; arquivo fora do formato vira "indisponível", não gráfico errado.
export function ntnbView(data, now = Date.now()) {
  if (!data || data.schemaVersion !== 1 || !isoOk(data.ref) || !Array.isArray(data.vencimentos) || !data.vencimentos.length || !Array.isArray(data.dates)) return null
  if (data.vencimentos.some((v) => !isoOk(v) || !Array.isArray(data.series?.[v]) || data.series[v].length !== data.dates.length)) return null
  const idadeDias = (now - Date.parse(`${data.ref}T21:00:00Z`)) / DAY
  return { ...data, atrasado: !!data.stale || idadeDias > 5 }
}

// Vencimento que abre o gráfico: o de 2035 (referência de prazo médio do mercado) ou o do meio da lista.
export const vencPadrao = (view) => view.vencimentos.find((v) => v.startsWith('2035')) ?? view.vencimentos[Math.floor(view.vencimentos.length / 2)]

export const rotuloVenc = (v) => `NTN-B ${v.slice(0, 4)}`

// Pontos do gráfico no tempo (formato do Plot): [{ t, bid }], só os dias com taxa.
export function historicoNtnb(view, venc) {
  const s = view.series[venc] ?? []
  return view.dates.flatMap((d, i) => (Number.isFinite(s[i]) ? [{ t: Date.parse(`${d}T12:00:00Z`), bid: s[i] }] : []))
}

// Taxa de um vencimento na última data com taxa até `alvo` (a tabela do detalhe só usa se for a própria data).
export function taxaEm(view, venc, alvo) {
  const s = view.series[venc] ?? []
  for (let i = view.dates.length - 1; i >= 0; i--) if (view.dates[i] <= alvo && Number.isFinite(s[i])) return { date: view.dates[i], taxa: s[i] }
  return null
}
