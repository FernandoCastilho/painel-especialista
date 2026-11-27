// Manchetes do dólar do dia, com horário, para o gráfico do dia mostrar as notícias publicadas perto da máxima.
// Roda dentro da coleta de cotações (quotes.yml), de 15 em 15 minutos no pregão, e grava $DATA_DIR/fx-agora.json,
// publicado junto com intraday.json. Fonte: Google Notícias (busca por data), com as manchetes públicas do Valor Econômico
// entre as buscas. Falha não interrompe a coleta de cotações: o arquivo anterior fica como estava.
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseRss, canonicalSource } from './news-lib.mjs'
import { FX_AGORA_ARQUIVO, FX_BUSCAS, diaBrasilia, juntarAgora, urlBuscaDia } from './fx-noticias-lib.mjs'

const dir = process.env.DATA_DIR
if (!dir) { console.error('DATA_DIR não definido'); process.exit(1) }
const destino = join(dir, FX_AGORA_ARQUIVO)
const agora = Date.now()
const dia = diaBrasilia(agora)

let anterior = null
try { anterior = JSON.parse(await readFile(destino, 'utf8')) } catch { /* primeira rodada do dia ou arquivo ausente */ }

const brutos = []
const erros = []
for (const q of FX_BUSCAS.USD) {
  try {
    const res = await fetch(urlBuscaDia(q, dia), { headers: { 'user-agent': 'Mozilla/5.0 (cotacoes-news)' }, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    brutos.push(...parseRss(await res.text()).map((it) => ({ ...it, source: canonicalSource(it) })))
  } catch (e) {
    erros.push(`${q}: ${e.message}`)
  }
}

if (erros.length === FX_BUSCAS.USD.length) {
  console.error('Manchetes do momento indisponíveis; mantido o arquivo anterior.', erros.join(' | '))
  process.exit(1)
}
const itens = juntarAgora(anterior, brutos, dia)
await writeFile(destino, JSON.stringify({ generatedAt: agora, dia, fonte: 'Google Notícias (inclui manchetes públicas do Valor Econômico)', itens, ...(erros.length ? { errors: erros } : {}) }))
console.log(`${FX_AGORA_ARQUIVO}: ${itens.length} manchetes de ${dia}`, erros.length ? `| Falhas: ${erros.join(' | ')}` : '')
