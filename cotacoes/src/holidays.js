// Calendários de feriados por praça. Brasil, Nova York (Federal Reserve), Londres e Japão são calculados por regra;
// a China vem de dados oficiais (ato do Conselho de Estado, via holiday-cn), porque muda todo ano e tem dias de compensação.
// Datas em 'AAAA-MM-DD'. Nenhum feriado é inventado: sem dado para um ano da China, o app avisa em vez de supor.

const pad = (n) => String(n).padStart(2, '0')
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const ms = (s) => Date.parse(`${s}T12:00:00Z`)
export const addDays = (s, n) => new Date(ms(s) + n * 864e5).toISOString().slice(0, 10)
export const dow = (s) => new Date(ms(s)).getUTCDay() // 0 = domingo
const isWeekend = (s) => dow(s) === 0 || dow(s) === 6

// Páscoa (algoritmo gregoriano anônimo)
export function easter(y) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(y, month, day)
}

// n-ésimo dia da semana do mês (n = 1..5), ou o último (n = -1)
export function nthWeekday(y, m, wd, n) {
  if (n > 0) {
    const first = iso(y, m, 1)
    return addDays(first, ((wd - dow(first) + 7) % 7) + (n - 1) * 7)
  }
  const last = iso(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate())
  return addDays(last, -((dow(last) - wd + 7) % 7))
}

const sortMap = (list) => new Map(list.sort((a, b) => (a[0] < b[0] ? -1 : 1)))

function brazil(y) {
  const e = easter(y)
  return sortMap([
    [iso(y, 1, 1), 'Confraternização Universal'],
    [addDays(e, -48), 'Carnaval (segunda)'],
    [addDays(e, -47), 'Carnaval (terça)'],
    [addDays(e, -2), 'Sexta-feira Santa'],
    [iso(y, 4, 21), 'Tiradentes'],
    [iso(y, 5, 1), 'Dia do Trabalho'],
    [addDays(e, 60), 'Corpus Christi'],
    [iso(y, 9, 7), 'Independência do Brasil'],
    [iso(y, 10, 12), 'Nossa Senhora Aparecida'],
    [iso(y, 11, 2), 'Finados'],
    [iso(y, 11, 15), 'Proclamação da República'],
    ...(y >= 2024 ? [[iso(y, 11, 20), 'Consciência Negra']] : []),
    [iso(y, 12, 25), 'Natal'],
  ])
}

// Feriados nacionais de data fixa previstos em lei (leis federais 662/1949, 6.802/1980,
// 10.607/2002 e 14.759/2023). Feriados religiosos dependem da legislação municipal.
const brazilCivil = y => sortMap([...brazil(y)].filter(([, name]) => !['Carnaval (segunda)', 'Carnaval (terça)', 'Sexta-feira Santa', 'Corpus Christi'].includes(name)))
// Calendário anual de negociação, conferido na publicação oficial da B3 de 09/01/2026.
// Não extrapola vésperas/expediente para anos sem calendário conferido; não é calendário de liquidação de todos os segmentos.
const b3Trading = y => y === 2026 ? sortMap([
  ...[...brazil(y)].filter(([d]) => !isWeekend(d)),
  [iso(y, 12, 24), 'B3 · sem sessão de negociação (véspera de Natal)'],
  [iso(y, 12, 31), 'B3 · sem sessão de negociação (véspera de Ano Novo)'],
]) : new Map()

const saoPaulo = (y) => sortMap([[iso(y, 1, 25), 'Aniversário da cidade de São Paulo'], [iso(y, 7, 9), 'Revolução Constitucionalista (estadual SP)']])
// Minas Gerais: o feriado estadual (21/04) já é nacional; entram os municipais de Belo Horizonte.
const minasGerais = (y) => sortMap([[iso(y, 8, 15), 'Assunção de Nossa Senhora (Belo Horizonte)'], [iso(y, 12, 8), 'Imaculada Conceição (Belo Horizonte)']])
// Regras locais são separadas do calendário financeiro BR; feriado religioso municipal não vira feriado nacional.
const fixed = (list) => (y) => sortMap(list.map(([m, d, n]) => [iso(y, m, d), n]))
const spEstado = fixed([[7, 9, 'Revolução Constitucionalista']])
const spCidade = fixed([[1, 25, 'Aniversário de São Paulo']])
// 19/12 não é feriado civil estadual (Lei PR 18.384/2014; TRT9, Súmula 37).
// Não há aqui inventário completo de feriados estaduais do PR: a visão sinaliza essa cobertura.
const paEstado = () => new Map()
// Lei municipal 3.015/1967, referida no Decreto Curitiba 2.385/2025: três feriados religiosos.
// 29/03 é aniversário da cidade, não uma regra de feriado municipal.
const curitibaCidade = y => sortMap([[addDays(easter(y), -2), 'Sexta-feira Santa'], [addDays(easter(y), 60), 'Corpus Christi'], [iso(y, 9, 8), 'Nossa Senhora da Luz dos Pinhais (padroeira)']])
const curitiba = (y) => sortMap([...curitibaCidade(y), ...paEstado(y)])
const sorocaba = fixed([[8, 15, 'Aniversário de Sorocaba']])
const barueri = fixed([[3, 26, 'Aniversário de Barueri'], [6, 24, 'São João Batista (padroeiro)']])
const cascavel = fixed([[11, 14, 'Aniversário de Cascavel']])
const londrina = (y) => sortMap([[addDays(easter(y), 68), 'Sagrado Coração de Jesus (padroeiro)'], [iso(y, 12, 10), 'Aniversário de Londrina']])
const maringa = fixed([[5, 10, 'Aniversário de Maringá']])
// Campinas: Dia do Evangélico (12/08, Lei municipal 16.785/2025, a partir de 2026) e Nossa Senhora da Conceição (08/12, padroeira).
const campinas = (y) => sortMap([...(y >= 2026 ? [[iso(y, 8, 12), 'Dia do Evangélico']] : []), [iso(y, 12, 8), 'Nossa Senhora da Conceição (padroeira)']])
// Região de Campinas: registros municipais da lista do TJ-SP (CSM, sessão de 24/11/2025).
// O recorte é específico; não compõe automaticamente feriados nacionais/estaduais. Paulínia: Páscoa + 68 dias.
const regiaoCampinas = (y) => sortMap([
  [iso(y, 1, 20), 'São Sebastião, padroeiro (Valinhos)'],
  [iso(y, 2, 2), 'Nossa Senhora da Candelária, padroeira (Indaiatuba)'],
  [iso(y, 2, 28), 'Aniversário de Paulínia'],
  [iso(y, 4, 2), 'Aniversário de Vinhedo'],
  [iso(y, 5, 19), 'Aniversário de Hortolândia'],
  [iso(y, 5, 28), 'Aniversário de Valinhos'],
  [addDays(easter(y), 68), 'Sagrado Coração de Jesus, padroeiro (Paulínia)'],
  [iso(y, 6, 13), 'Santo Antônio, padroeiro (Americana)'],
  [iso(y, 7, 26), 'Aniversário de Sumaré; Sant\'Ana, padroeira (Vinhedo)'],
  [iso(y, 9, 12), 'Aniversário de Jaguariúna'],
  [iso(y, 9, 15), 'Feriado municipal (Nova Odessa)'],
  [iso(y, 12, 4), 'Santa Bárbara, padroeira (Santa Bárbara d\'Oeste)'],
])

// Federal Reserve: domingo vira segunda; sábado não é compensado (os bancos abrem na sexta).
function newYork(y) {
  const fixed = (m, d, name) => {
    const s = iso(y, m, d)
    return dow(s) === 0 ? [addDays(s, 1), `${name} (observado)`] : dow(s) === 6 ? null : [s, name]
  }
  return sortMap(
    [
      fixed(1, 1, 'Ano Novo'),
      [nthWeekday(y, 1, 1, 3), 'Martin Luther King Jr.'],
      [nthWeekday(y, 2, 1, 3), 'Dia dos Presidentes'],
      [nthWeekday(y, 5, 1, -1), 'Memorial Day'],
      y >= 2021 ? fixed(6, 19, 'Juneteenth') : null,
      fixed(7, 4, 'Independência dos EUA'),
      [nthWeekday(y, 9, 1, 1), 'Labor Day'],
      [nthWeekday(y, 10, 1, 2), 'Columbus Day'],
      fixed(11, 11, 'Veterans Day'),
      [nthWeekday(y, 11, 4, 4), 'Thanksgiving'],
      fixed(12, 25, 'Natal'),
    ].filter(Boolean),
  )
}

// Reino Unido: feriado de fim de semana passa para o próximo dia útil, sem colidir com outro feriado.
function london(y) {
  const e = easter(y)
  const out = new Map()
  const put = (s, name) => {
    let d = s
    while (isWeekend(d) || out.has(d)) d = addDays(d, 1)
    out.set(d, d === s ? name : `${name} (compensado)`)
  }
  put(iso(y, 1, 1), 'Ano Novo')
  out.set(addDays(e, -2), 'Good Friday')
  out.set(addDays(e, 1), 'Easter Monday')
  out.set(nthWeekday(y, 5, 1, 1), 'Early May bank holiday')
  out.set(nthWeekday(y, 5, 1, -1), 'Spring bank holiday')
  out.set(nthWeekday(y, 8, 1, -1), 'Summer bank holiday')
  put(iso(y, 12, 25), 'Natal')
  put(iso(y, 12, 26), 'Boxing Day')
  return sortMap([...out])
}

// Japão: regra dos feriados nacionais (equinócios por fórmula, válida de 1980 a 2099), feriado de domingo compensado e "feriado dos cidadãos".
function japan(y) {
  const eq = (c) => Math.floor(c + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
  const base = new Map([
    [iso(y, 1, 1), 'Ano Novo'],
    [nthWeekday(y, 1, 1, 2), 'Dia da Maioridade'],
    [iso(y, 2, 11), 'Fundação Nacional'],
    [iso(y, 2, 23), 'Aniversário do Imperador'],
    [iso(y, 3, eq(20.8431)), 'Equinócio de Primavera'],
    [iso(y, 4, 29), 'Dia de Showa'],
    [iso(y, 5, 3), 'Dia da Constituição'],
    [iso(y, 5, 4), 'Dia do Verde'],
    [iso(y, 5, 5), 'Dia das Crianças'],
    [nthWeekday(y, 7, 1, 3), 'Dia do Mar'],
    [iso(y, 8, 11), 'Dia da Montanha'],
    [nthWeekday(y, 9, 1, 3), 'Respeito aos Idosos'],
    [iso(y, 9, eq(23.2488)), 'Equinócio de Outono'],
    [nthWeekday(y, 10, 1, 2), 'Dia do Esporte'],
    [iso(y, 11, 3), 'Dia da Cultura'],
    [iso(y, 11, 23), 'Ação de Graças Trabalhista'],
  ])
  const out = new Map(base)
  for (const [s, name] of base) {
    if (dow(s) === 0) {
      let d = addDays(s, 1)
      while (out.has(d)) d = addDays(d, 1)
      out.set(d, `${name} (compensado)`)
    }
  }
  for (const s of [...out.keys()]) {
    const mid = addDays(s, 1)
    if (!out.has(mid) && out.has(addDays(s, 2)) && dow(mid) !== 0) out.set(mid, 'Feriado dos cidadãos')
  }
  for (const s of [iso(y, 1, 2), iso(y, 1, 3), iso(y, 12, 31)]) if (!out.has(s)) out.set(s, 'Feriado bancário')
  return sortMap([...out])
}

// 31/12: sem expediente bancário ao público (Febraban); a conta que vence no dia é paga no dia útil seguinte, sem multa.
// Vale só para mover datas de pagamento: não entra no calendário BR, que conta dias úteis (DU/252) de CDI, DI e TLP.
const semExpedienteBancario = y => sortMap([[iso(y, 12, 31), 'Sem expediente bancário (31/12)']])
// Praças do contrato + 31/12, para ajustar vencimentos ao próximo dia útil bancário.
export const paymentCalendars = cals => [...new Set([...cals, 'BANCO'])]

export const CALENDARS = [
  { id: 'BR', label: 'Brasil (referência de dias úteis financeiros)', short: 'Brasil financeiro', rule: brazil },
  { id: 'CIVBR', label: 'Brasil (feriados nacionais por lei)', short: 'Brasil · nacionais', rule: brazilCivil, hidden: true },
  { id: 'B3', label: 'B3 (sessões de negociação)', short: 'B3', rule: b3Trading, hidden: true },
  { id: 'BANCO', label: 'Expediente bancário (31/12 sem atendimento)', short: 'Expediente bancário', rule: semExpedienteBancario, hidden: true },
  { id: 'SP', label: 'São Paulo (cidade e estado)', short: 'São Paulo', rule: saoPaulo },
  { id: 'MG', label: 'Minas Gerais (Belo Horizonte)', short: 'Minas Gerais', rule: minasGerais },
  { id: 'PR', label: 'Curitiba (cidade e estado)', short: 'Curitiba', rule: curitiba },
  { id: 'NY', label: 'Nova York (Federal Reserve)', short: 'Nova York', rule: newYork },
  { id: 'SPE', label: 'Estado de São Paulo', short: 'Estado SP', rule: spEstado, hidden: true },
  { id: 'SPC', label: 'Cidade de São Paulo', short: 'São Paulo (cidade)', rule: spCidade, hidden: true },
  { id: 'PRE', label: 'Estado do Paraná', short: 'Estado PR', rule: paEstado, hidden: true },
  { id: 'CWB', label: 'Cidade de Curitiba', short: 'Curitiba (cidade)', rule: curitibaCidade, hidden: true },
  { id: 'SOR', label: 'Sorocaba', short: 'Sorocaba', rule: sorocaba, hidden: true },
  { id: 'BAR', label: 'Barueri (Alphaville)', short: 'Barueri', rule: barueri, hidden: true },
  { id: 'CVL', label: 'Cascavel', short: 'Cascavel', rule: cascavel, hidden: true },
  { id: 'LDA', label: 'Londrina', short: 'Londrina', rule: londrina, hidden: true },
  { id: 'MGA', label: 'Maringá', short: 'Maringá', rule: maringa, hidden: true },
  { id: 'CPS', label: 'Campinas', short: 'Campinas', rule: campinas, hidden: true },
  { id: 'RMC', label: 'Região de Campinas', short: 'Região de Campinas', rule: regiaoCampinas, hidden: true },
  { id: 'UK', label: 'Londres', short: 'Londres', rule: london },
  { id: 'JP', label: 'Tóquio', short: 'Tóquio', rule: japan },
  { id: 'CN', label: 'China (continental)', short: 'China', rule: null },
]
export const calLabel = (id) => CALENDARS.find((c) => c.id === id)?.short ?? id
// Moeda do país da praça, para escolher a bandeira (praças brasileiras, mesmo as de estado e cidade, levam a do Brasil).
const COUNTRY_FLAG = { NY: 'USD', UK: 'GBP', JP: 'JPY', CN: 'CNH' }
export const calFlag = (id) => COUNTRY_FLAG[id] ?? (CALENDARS.some((c) => c.id === id) ? 'BRL' : null)

// Dados da China: { 2026: { off: Map(data → nome), work: Set(dias úteis em fim de semana) } }, montado a partir do arquivo coletado.
export function buildCn(file) {
  const out = {}
  for (const [year, y] of Object.entries(file?.years ?? {})) {
    const off = new Map()
    const work = new Set()
    for (const d of y.days ?? []) (d.isOffDay ? off.set(d.date, d.nameEn ?? d.name) : work.add(d.date))
    if (off.size) out[year] = { off, work }
  }
  return out
}

const cache = new Map()
export function holidayMap(cal, year, ctx = {}) {
  if (cal === 'CN') return ctx.cn?.[year]?.off ?? new Map()
  const key = `${cal}${year}`
  if (!cache.has(key)) cache.set(key, CALENDARS.find((c) => c.id === cal).rule(year))
  return cache.get(key)
}
const nameOf = (cal, s, ctx) => holidayMap(cal, Number(s.slice(0, 4)), ctx).get(s)

// A China só tem dado quando o ato do ano foi publicado: devolve os anos sem dado, para avisar o usuário.
export const cnMissingYears = (years, ctx = {}) => [...new Set(years)].filter((y) => !ctx.cn?.[y])

export function calendarYearCovered(cal, year, ctx = {}) {
  if (cal === 'CN') return !!ctx.cn?.[year]
  if (cal === 'B3') return year === 2026
  if (cal === 'PRE') return false // ausência de inventário estadual completo não é ausência de feriado
  return CALENDARS.some(c => c.id === cal)
}

export const HOLIDAY_SOURCES = [
  { label: 'Feriados nacionais · Lei 10.607/2002', url: 'https://www.planalto.gov.br/ccivil_03/leis/2002/l10607.htm' },
  { label: 'Nossa Senhora Aparecida · Lei 6.802/1980', url: 'https://www.planalto.gov.br/ccivil_03/leis/l6802.htm' },
  { label: 'Âmbito civil e religioso dos feriados · Lei 9.093/1995', url: 'https://www.planalto.gov.br/ccivil_03/leis/l9093.htm' },
  { label: 'Consciência Negra · Lei 14.759/2023', url: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14759.htm' },
  { label: 'Curitiba · Decreto 2.385/2025 e Lei Municipal 3.015/1967', url: 'https://legisladocexterno.curitiba.pr.gov.br/VisualizarHTML.aspx?id=458542' },
  { label: 'Paraná · 19 de dezembro não é feriado civil (TRT9)', url: 'https://www.trt9.jus.br/portal/noticias.xhtml?id=5243491' },
  { label: 'B3 · calendário de negociação de 2026', url: 'https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm' },
]

export function isBusinessDay(s, cal, ctx = {}) {
  if (cal === 'CN' && ctx.cn?.[s.slice(0, 4)]?.work.has(s)) return true // sábado/domingo de compensação trabalha
  return !isWeekend(s) && !nameOf(cal, s, ctx)
}
export const isBusinessDayAll = (s, cals, ctx = {}) => cals.every((c) => isBusinessDay(s, c, ctx))

// Motivos pelos quais a data não é dia útil nas praças escolhidas
export function offReasons(s, cals, ctx = {}) {
  const out = []
  for (const c of cals) {
    if (isBusinessDay(s, c, ctx)) continue
    const n = nameOf(c, s, ctx)
    out.push({ cal: c, name: n ?? 'fim de semana' })
  }
  return out
}

export function nextBusinessDay(s, cals, ctx = {}) {
  let d = s
  for (let i = 0; i < 40 && !isBusinessDayAll(d, cals, ctx); i++) d = addDays(d, 1)
  return d
}

// Dias úteis entre duas datas (a inicial não conta, a final conta), comuns a todas as praças informadas
export function busDaysIn(from, to, cals, ctx = {}) {
  if (!(ms(to) > ms(from))) return 0
  let n = 0
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (isBusinessDayAll(d, cals, ctx)) n++
  return n
}

// Feriados (em dia de semana) nas praças escolhidas, nos próximos `days` dias a partir de `from` (inclusive)
export function upcomingHolidays(from, days, cals, ctx = {}, { includeWeekends = false } = {}) {
  const out = []
  for (let i = 0; i <= days; i++) {
    const d = addDays(from, i)
    for (const c of cals) {
      const name = nameOf(c, d, ctx)
      if (name && (includeWeekends || !isWeekend(d))) out.push({ date: d, cal: c, name })
    }
  }
  return out
}
