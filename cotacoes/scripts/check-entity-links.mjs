// Confere os sites oficiais das associações e órgãos de src/sectorEntities.js.
// Roda no GitHub (com internet): .github/workflows/entity-links.yml. Não bloqueia pull requests.
// Resultado: ok, aviso (confirmar à mão) ou falha (corrigir a lista).
import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { ENTITY_REGISTRY } from '../src/sectorEntities.js'

const sameSite = (a, b) => new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '')

/** Classifica a resposta de um site. Bloqueio a robô (401/403/429) pede conferência manual. */
export function classifyLink(expected, { status, finalUrl, error }) {
  if (error) return { level: 'falha', note: `sem resposta (${error})` }
  if (status === 404 || status === 410 || status >= 500) return { level: 'falha', note: `erro ${status}` }
  if ([401, 403, 429].includes(status)) return { level: 'aviso', note: `site recusou a checagem automática (${status}): abrir à mão` }
  if (status >= 400) return { level: 'falha', note: `erro ${status}` }
  if (finalUrl && !sameSite(expected, finalUrl)) return { level: 'aviso', note: `redireciona para outro site: ${new URL(finalUrl).hostname}` }
  return { level: 'ok', note: String(status) }
}

async function check(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (verificador de links do painel)' } })
    await response.body?.cancel()
    return classifyLink(url, { status: response.status, finalUrl: response.url })
  } catch (cause) {
    return classifyLink(url, { error: cause?.cause?.code || cause?.name || 'erro de rede' })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = Object.entries(ENTITY_REGISTRY.associations).map(([key, [acronym, , , url]]) => ({ key, acronym, url }))
  const results = []
  for (let i = 0; i < entries.length; i += 6) results.push(...await Promise.all(entries.slice(i, i + 6).map(async entry => ({ ...entry, ...await check(entry.url) }))))
  const lines = results.filter(item => item.level !== 'ok').map(item => `- ${item.level.toUpperCase()} · ${item.acronym} (${item.url}): ${item.note}`)
  const failures = results.filter(item => item.level === 'falha').length
  const summary = `## Sites de associações e órgãos\n\n${results.length} endereços: ${results.filter(item => item.level === 'ok').length} ok, ${results.filter(item => item.level === 'aviso').length} para conferir à mão, ${failures} com falha.\n\n${lines.join('\n') || 'Nenhum problema encontrado.'}\n`
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  process.exitCode = failures ? 1 : 0
}
