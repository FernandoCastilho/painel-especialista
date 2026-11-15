import { preserveFocus } from './focus-collector.mjs'
// Coleta CDI, Selic, PTAX e Boletim Focus (Banco Central) e grava public/macro.json. Rodado a cada hora pelo GitHub Actions.
import { mkdir, writeFile } from 'node:fs/promises'
import { fillFromPrevious, loadPreviousOrFail } from './prev-lib.mjs'
import { changePoints, focusFor, focusRelease, parseSgs, parseSofr, parseSofrAvg, ptaxFrom, toBr, windows } from './macro-lib.mjs'

const SGS = (code, a, b) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json&dataInicial=${a}&dataFinal=${b}`
const OLINDA = 'https://olinda.bcb.gov.br/olinda/servico'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []

// O Banco Central responde 502/lento com frequência: várias tentativas.
async function getJson(url, label, tries = 5) {
  let last
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-macro)', accept: 'application/json' }, signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      last = e
      await sleep(2500 * i)
    }
  }
  errors.push(`${label}: ${last.message}`)
  return null
}

const now = new Date()
const out = { generatedAt: Date.now(), cdi: [], selic: [], sofr: [], sofrAvg: [], focus: null, ptax: {}, errors }

// CDI anualizado (SGS 4389, B3): últimos 10 anos (limite do SGS para séries diárias)
{
  const from = new Date(now.getTime() - 3640 * 864e5)
  const rows = await getJson(SGS(4389, toBr(from.getTime()), toBr(now.getTime())), 'cdi')
  out.cdi = parseSgs(rows)
  console.log('CDI:', out.cdi.length, 'pontos')
}

// Meta Selic (SGS 432) desde 1999, só os pontos de mudança
{
  let all = []
  for (const [a, b] of windows(1999, now)) all = all.concat(parseSgs(await getJson(SGS(432, a, b), `selic ${a}`)))
  out.selic = changePoints(all.sort((x, y) => x[0] - y[0]))
  console.log('Selic:', out.selic.length, 'pontos de mudança')
}

// SOFR overnight (NY Fed), taxa do dia, desde o início da série (abr/2018)
{
  const end = new Date().toISOString().slice(0, 10)
  const data = await getJson(`https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2018-04-02&endDate=${end}`, 'sofr')
  out.sofr = parseSofr(data)
  console.log('SOFR:', out.sofr.length, 'pontos')
  const avg = await getJson(`https://markets.newyorkfed.org/api/rates/secured/sofrai/search.json?startDate=2018-04-02&endDate=${end}`, 'sofr médias')
  out.sofrAvg = parseSofrAvg(avg)
  console.log('SOFR médias:', out.sofrAvg.length, 'pontos')
}

// Focus: coleta semanal (segunda/terça 08:30, com o vigia de 30 em 30 min em focus.yml) e manual/push; as coletas de hora em hora não tocam no Focus.
// Se o macro.json publicado existe mas não pôde ser lido, a coleta para aqui: publicar sem ele apagaria o Focus do painel.
const previous = await loadPreviousOrFail('macro.json')
const scheduled = process.env.GITHUB_EVENT_NAME === 'schedule'
if (!scheduled) {
  const since = new Date(now.getTime() - 21 * 864e5).toISOString().slice(0, 10)
  const names = { Selic: 'Selic', IPCA: 'IPCA', 'PIB Total': 'PIB', Câmbio: 'Câmbio' }
  const rowsOut = []
  let date = ''
  for (const [indicator, label] of Object.entries(names)) {
    const filter = encodeURIComponent(`Indicador eq '${indicator}' and Data ge '${since}' and baseCalculo eq 0`)
    const data = await getJson(`${OLINDA}/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=100&$filter=${filter}&$orderby=Data%20desc&$format=json`, `focus ${indicator}`)
    const f = focusFor(data?.value)
    if (f) {
      rowsOut.push({ label, indicator, values: f.values })
      if (f.date > date) date = f.date
    } else errors.push(`focus ${indicator}: sem dados`)
  }
  out.focus = rowsOut.length ? { date, release: focusRelease(date), rows: rowsOut } : null
  console.log('Focus:', rowsOut.length, 'indicadores; coleta até', date, '; divulgação', date && focusRelease(date))
}

// PTAX (USD, EUR, JPY): último dia útil com boletim
for (const moeda of ['USD', 'EUR', 'JPY']) {
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getTime() - back * 864e5)
    const day = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`
    const url = `${OLINDA}/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${moeda}'&@dataCotacao='${day}'&$top=10&$format=json`
    const data = await getJson(url, `ptax ${moeda} ${day}`, 3)
    const p = ptaxFrom(data?.value)
    if (p) {
      out.ptax[moeda] = { ...p, date: d.toISOString().slice(0, 10) }
      break
    }
  }
}
console.log('PTAX:', Object.keys(out.ptax).join(','))

// Histórico da PTAX de fechamento (venda), ~400 dias, para a tabela dos gráficos
out.ptaxHist = {}
{
  const md = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}-${d.getUTCFullYear()}`
  const ini = md(new Date(now.getTime() - 400 * 864e5))
  for (const moeda of ['USD', 'EUR', 'JPY']) {
    const url = `${OLINDA}/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='${moeda}'&@dataInicial='${ini}'&@dataFinalCotacao='${md(now)}'&$filter=tipoBoletim%20eq%20'Fechamento'&$select=cotacaoVenda,dataHoraCotacao&$format=json`
    const data = await getJson(url, `ptax hist ${moeda}`, 3)
    if (data?.value?.length) out.ptaxHist[moeda] = Object.fromEntries(data.value.map((r) => [r.dataHoraCotacao.slice(0, 10), r.cotacaoVenda]))
  }
}

if (errors.length) console.warn('Falhas:', errors.join(' | '))
// Fonte que falhou: mantém o último dado publicado (e avisa na tela) em vez de apagar o bloco ou travar o deploy.
fillFromPrevious(out, previous, ['cdi', 'selic', 'sofr', 'sofrAvg', 'focus', 'ptax', 'ptaxHist'])
if (scheduled) { delete out.stale.focus; preserveFocus(out, previous, { skipped: true }) }
if (Object.keys(out.stale).length) console.log('Reaproveitado do último publicado:', Object.keys(out.stale).join(', '))
const ok = out.cdi.length && out.selic.length
if (!ok && process.env.MACRO_STRICT === 'true') {
  console.error('CDI/Selic não coletados; abortando para manter os dados anteriores no ar.')
  process.exit(1)
}
await mkdir(new URL('../public/', import.meta.url), { recursive: true })
await writeFile(new URL('../public/macro.json', import.meta.url), JSON.stringify(out))
console.log('macro.json gravado')
