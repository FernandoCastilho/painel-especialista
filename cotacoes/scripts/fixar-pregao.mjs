// Fixa um pregão marcante no gráfico intradiário por alguns dias (pregao-fixado.json, em public/).
// Guarda as amostras daquele dia (intraday.json da coleta central) e as manchetes do dólar com horário (mesma busca do fx-agora.json),
// para o dia continuar aberto com máxima, mínima e notícias perto da máxima depois que sair da janela de 5 dias do intraday.
// Uso: node cotacoes/scripts/fixar-pregao.mjs AAAA-MM-DD [dias=7] [destino]
import { writeFile } from 'node:fs/promises'
import { parseRss, canonicalSource } from './news-lib.mjs'
import { FX_BUSCAS, diaBrasilia, juntarAgora, urlBuscaDia } from './fx-noticias-lib.mjs'

const [dia, diasArg = '7', destino = 'cotacoes/public/pregao-fixado.json'] = process.argv.slice(2)
if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? '')) { console.error('Informe o dia: AAAA-MM-DD'); process.exit(1) }
const dias = Number(diasArg)
const ate = new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 864e5).toISOString().slice(0, 10)
const BASE = process.env.INTRADAY_URL || 'https://raw.githubusercontent.com/FernandoCastilho/painel-especialista/data/intraday.json'

const intraday = await (await fetch(BASE, { signal: AbortSignal.timeout(20000) })).json()
const series = {}
for (const [code, s] of Object.entries(intraday.series ?? {})) {
  const pts = (s.points ?? []).filter((p) => Array.isArray(p) && diaBrasilia(p[0]) === dia)
  if (pts.length) series[code] = pts
}
if (!series.USD?.length) { console.error(`Sem amostras do dólar em ${dia} no intraday.json`); process.exit(1) }

const brutos = []
const erros = []
for (const q of FX_BUSCAS.USD) {
  try {
    const res = await fetch(urlBuscaDia(q, dia), { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-news)' }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    brutos.push(...parseRss(await res.text()).map((it) => ({ ...it, source: canonicalSource(it) })))
  } catch (e) { erros.push(`${q}: ${e.message}`) }
}
const itens = juntarAgora(null, brutos, dia)
const out = {
  generatedAt: Date.now(),
  dia,
  ate,
  fonte: `${intraday.source}; manchetes: Google Notícias (inclui manchetes públicas do Valor Econômico)`,
  resolution: intraday.resolution,
  series,
  noticias: { dia, itens },
  ...(erros.length ? { errors: erros } : {}),
}
await writeFile(destino, `${JSON.stringify(out)}\n`)
console.log(`${destino}: ${Object.entries(series).map(([c, p]) => `${c} ${p.length}`).join(', ')}; ${itens.length} manchetes; fixado até ${ate}`, erros.length ? `| Falhas: ${erros.join(' | ')}` : '')
