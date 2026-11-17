// Manchetes por dia para as bolinhas do gráfico de câmbio.
//
// Onde fica guardado:
// - data/fx-noticias-base.json (no git): carga inicial dos últimos 60 dias. Nunca é apagada pela coleta.
// - fx-noticias.json (no site publicado): base + tudo o que a coleta de hora em hora acrescentou depois.
//   Cada rodada lê o arquivo publicado anterior, acrescenta os últimos dias úteis e publica de novo.
//
// Uso:
//   node scripts/fetch-fx-noticias.mjs              coleta de hora em hora (grava public/fx-noticias.json)
//   (rodadas de Trends e Focus: scripts/preserve-fx-noticias.mjs, sem nova busca)
//   node scripts/fetch-fx-noticias.mjs --base 60    carga inicial dos últimos 60 dias (grava data/fx-noticias-base.json)
import { readFile, writeFile } from 'node:fs/promises'
import { loadPreviousOrFail } from './prev-lib.mjs'
import { parseRss, canonicalSource } from './news-lib.mjs'
import { FX_ARQUIVO, FX_BUSCAS, FX_MOEDAS, contarDias, diasUteis, escolherDoDia, juntar, urlBuscaDia } from './fx-noticias-lib.mjs'

const BASE = new URL('../data/fx-noticias-base.json', import.meta.url)
const SAIDA = new URL(`../public/${FX_ARQUIVO}`, import.meta.url)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const erros = []

async function lerJson(url) {
  try { return JSON.parse(await readFile(url, 'utf8')) } catch { return null }
}

async function get(url, tentativas = 3, timeoutMs = 20000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-news)' }, signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      if (i === tentativas) throw e
      await sleep(2000 * i * i)
    }
  }
}

// Coleta os dias pedidos. Falha numa busca não interrompe: o dia fica com o que veio das outras (ou com o que já estava guardado).
// `prazoMs`: tempo máximo da coleta. Esgotado, para de buscar e grava o que tem (o resto fica como estava guardado).
// A rodada de hora em hora não pode travar a publicação do painel inteiro por causa destas manchetes.
async function coletar(dias, { prazoMs = Infinity, tentativas = 3, timeoutMs = 20000 } = {}) {
  const agora = Date.now()
  const limite = agora + prazoMs
  const out = { generatedAt: agora, moedas: {} }
  for (const dia of dias) {
    for (const code of FX_MOEDAS) {
      const destino = ((out.moedas[code] ??= { dias: {} })).dias
      if (Date.now() > limite) { erros.push(`${code}/${dia}: tempo da coleta esgotado`); continue }
      const brutos = []
      for (const q of FX_BUSCAS[code]) {
        if (Date.now() > limite) break
        try {
          brutos.push(...parseRss(await get(urlBuscaDia(q, dia), tentativas, timeoutMs)).map((it) => ({ ...it, source: canonicalSource(it) })))
        } catch (e) {
          erros.push(`${code}/${dia}: ${e.message}`)
        }
        await sleep(900)
      }
      const itens = escolherDoDia(brutos, dia, code)
      if (itens.length) destino[dia] = { itens, coletadoEm: agora }
      console.log(code, dia, itens.length, 'manchetes')
    }
  }
  return out
}

const arg = process.argv.indexOf('--base')
if (arg > 0) {
  const n = Math.min(400, Math.max(1, Number(process.argv[arg + 1]) || 60))
  const novo = await coletar(diasUteis(n))
  const base = { ...juntar([await lerJson(BASE), novo]), generatedAt: Date.now(), dias: n }
  if (!contarDias(base)) {
    console.error('Nenhuma manchete coletada; base não gravada.', erros.join(' | '))
    process.exit(1)
  }
  await writeFile(BASE, `${JSON.stringify(base, null, 1)}\n`)
  console.log('Base gravada:', contarDias(base), 'dias com manchetes.', erros.length ? `Falhas: ${erros.join(' | ')}` : '')
} else {
  // Arquivo publicado ilegível interrompe a rodada (o site fica como está): publicar só a base apagaria os dias acumulados.
  const anterior = await loadPreviousOrFail(FX_ARQUIVO)
  // De hora em hora: só os últimos 3 dias úteis, do mais recente para o mais antigo, com 1 tentativa por busca e no máximo 2,5 minutos.
  const novo = await coletar(diasUteis(5).slice(-3).reverse(), { prazoMs: 150000, tentativas: 1, timeoutMs: 10000 })
  const arquivo = { ...juntar([await lerJson(BASE), anterior, novo]), generatedAt: novo.generatedAt, errors: erros }
  await writeFile(SAIDA, JSON.stringify(arquivo))
  console.log(`${FX_ARQUIVO} gravado:`, contarDias(arquivo), 'dias com manchetes', erros.length ? `| Falhas: ${erros.join(' | ')}` : '')
}
