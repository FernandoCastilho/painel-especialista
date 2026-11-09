// Confere os sites oficiais das associações e órgãos de src/sectorEntities.js.
// Roda no GitHub (com internet): .github/workflows/entity-links.yml. Não bloqueia pull requests.
// Resultado: ok, aviso (confirmar à mão) ou falha (corrigir a lista).
import { appendFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { ENTITY_REGISTRY } from '../src/sectorEntities.js'

const host = value => new URL(value).hostname.replace(/^www\./, '')
// O mesmo site pode mudar para um subdomínio (ex.: portaldaindustria.com.br -> sistemaindustria.portaldaindustria.com.br).
const sameSite = (a, b) => host(b) === host(a) || host(b).endsWith(`.${host(a)}`)
// O endereço não existe: erro certo. Os demais erros de rede (tempo esgotado, certificado incompleto,
// resposta fora do padrão) também acontecem com site no ar e com bloqueio à rede do GitHub: conferir à mão.
const GONE = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN'])

/** Classifica a resposta de um site. Bloqueio a robô (401/403/406/429) pede conferência manual. */
export function classifyLink(expected, { status, finalUrl, error }) {
  if (error) return GONE.has(error) ? { level: 'falha', note: `endereço não existe (${error})` } : { level: 'aviso', note: `resposta fora do padrão (${error}): abrir à mão` }
  if (status === 404 || status === 410 || status >= 500) return { level: 'falha', note: `erro ${status}` }
  if ([401, 403, 406, 429].includes(status)) return { level: 'aviso', note: `site recusou a checagem automática (${status}): abrir à mão` }
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
    return classifyLink(url, { error: cause?.cause?.code || cause?.code || cause?.name || 'erro de rede' })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entries = Object.entries(ENTITY_REGISTRY.associations).map(([key, [acronym, , , url]]) => ({ key, acronym, url })).filter(entry => entry.url)
  // Endereços candidatos para testar uma correção antes de gravar na lista (entrada "extra_urls" do workflow).
  const extras = (process.env.CHECK_EXTRA_URLS || '').split(',').map(value => value.trim()).filter(Boolean).map(url => ({ key: url, acronym: 'candidato', url }))
  const results = []
  for (let i = 0; i < entries.length; i += 6) results.push(...await Promise.all(entries.slice(i, i + 6).map(async entry => ({ ...entry, ...await check(entry.url) }))))
  const extraResults = await Promise.all(extras.map(async entry => ({ ...entry, ...await check(entry.url) })))
  const lines = results.filter(item => item.level !== 'ok').map(item => `- ${item.level.toUpperCase()} · ${item.acronym} (${item.url}): ${item.note}`)
  const failures = results.filter(item => item.level === 'falha').length
  const extraLines = extraResults.map(item => `- ${item.level.toUpperCase()} · ${item.url}: ${item.note}`)
  const summary = `## Sites de associações e órgãos\n\n${results.length} endereços: ${results.filter(item => item.level === 'ok').length} ok, ${results.filter(item => item.level === 'aviso').length} para conferir à mão, ${failures} com falha.\n\n${lines.join('\n') || 'Nenhum problema encontrado.'}\n${extraLines.length ? `\n### Candidatos\n\n${extraLines.join('\n')}\n` : ''}`
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary)
  process.exitCode = failures ? 1 : 0
}
