// Rodadas exclusivas de Trends e Focus: republica as manchetes do dólar (fx-noticias.json) sem nova busca.
// Lê só o arquivo já publicado e a base do git. Arquivo publicado ilegível interrompe a rodada (o site fica como está).
import { readFile, writeFile } from 'node:fs/promises'
import { loadPreviousOrFail } from './prev-lib.mjs'
import { FX_ARQUIVO, contarDias, juntar } from './fx-noticias-lib.mjs'

const lerJson = async (url) => { try { return JSON.parse(await readFile(url, 'utf8')) } catch { return null } }
const anterior = await loadPreviousOrFail(FX_ARQUIVO)
const arquivo = { ...juntar([await lerJson(new URL('../data/fx-noticias-base.json', import.meta.url)), anterior]), generatedAt: anterior?.generatedAt ?? Date.now(), errors: anterior?.errors ?? [] }
await writeFile(new URL(`../public/${FX_ARQUIVO}`, import.meta.url), JSON.stringify(arquivo))
console.log(`${FX_ARQUIVO} preservado:`, contarDias(arquivo), 'dias com manchetes')
