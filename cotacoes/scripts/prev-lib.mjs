import { recentNews } from '../src/newsWindow.js'
// Último dado válido: quando uma fonte falha na coleta horária, o arquivo publicado antes é reaproveitado
// e a parte reaproveitada fica registrada em `stale` ({ chave: instante da coleta original }), para a tela avisar.

const isEmpty = (v) => v == null || (Array.isArray(v) ? !v.length : typeof v === 'object' && !Object.keys(v).length)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const PREV_TENTATIVAS = 3

// Lê o arquivo já publicado no GitHub Pages e diz o que aconteceu, em até 3 tentativas com espera crescente (2 s, 4 s):
// - 'ok': leu (data = conteúdo);
// - 'missing': o arquivo não existe (404 legítimo, primeira publicação) ou não há repositório configurado (execução local);
// - 'unreadable': não deu para ler (rede, tempo esgotado, erro do servidor, resposta vazia ou JSON inválido). Não é "não existe".
export async function readPrevious(file, repo = process.env.GITHUB_REPOSITORY, { fetchImpl = fetch, tries = PREV_TENTATIVAS, wait = (i) => sleep(2000 * i) } = {}) {
  const [owner, name] = (repo ?? '').split('/')
  if (!owner || !name) return { status: 'missing', data: null }
  let last
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchImpl(`https://${owner.toLowerCase()}.github.io/${name}/${file}`, { signal: AbortSignal.timeout(20000) })
      if (res.status === 404) return { status: 'missing', data: null }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.text()
      if (!body.trim()) throw new Error('resposta vazia')
      return { status: 'ok', data: JSON.parse(body) }
    } catch (e) {
      last = e
      if (i < tries) await wait(i)
    }
  }
  return { status: 'unreadable', data: null, error: last?.message ?? 'falha desconhecida' }
}

// Arquivo já publicado no GitHub Pages (null se não existir ou se a leitura falhar nas 3 tentativas).
// Para quem só completa lacunas com o dado anterior. Quem depende do anterior para não encolher usa loadPreviousOrFail.
export async function loadPrevious(file, repo = process.env.GITHUB_REPOSITORY, options) {
  return (await readPrevious(file, repo, options)).data
}

// Para coletores cujo dado só existe no site publicado (Focus, histórico do Focus, curvas da B3): "não existe" devolve null,
// mas "não consegui ler" interrompe a coleta. A rodada falha antes de montar o site e o que está no ar fica como está;
// a próxima rodada tenta de novo. Saída de emergência (arquivo publicado corrompido de forma permanente): definir a
// variável PREV_IGNORAR_ILEGIVEL=true, que volta a tratar a leitura falha como "não existe".
export async function loadPreviousOrFail(file, repo = process.env.GITHUB_REPOSITORY, options) {
  const r = await readPrevious(file, repo, options)
  if (r.status !== 'unreadable') return r.data
  if (process.env.PREV_IGNORAR_ILEGIVEL === 'true') {
    console.warn(`${file}: arquivo publicado ilegível (${r.error}); seguindo sem ele porque PREV_IGNORAR_ILEGIVEL=true`)
    return null
  }
  throw new Error(`${file}: não foi possível ler o arquivo publicado (${r.error}). Coleta interrompida para não publicar uma versão vazia ou menor por cima do dado que está no ar.`)
}

const tsOf = (prev, key) => prev?.stale?.[key] ?? prev?.generatedAt ?? null

// Completa `out[key]` com o valor anterior onde a coleta nova veio vazia. Devolve `out` com `stale` preenchido.
export function fillFromPrevious(out, prev, keys) {
  const stale = {}
  for (const key of keys) {
    if (key === 'ptax') {
      // por moeda: só completa as que faltam
      const missing = Object.keys(prev?.ptax ?? {}).filter((m) => !out.ptax?.[m])
      if (missing.length) {
        out.ptax = { ...(out.ptax ?? {}), ...Object.fromEntries(missing.map((m) => [m, prev.ptax[m]])) }
        stale.ptax = tsOf(prev, 'ptax')
      }
    } else if (isEmpty(out[key]) && !isEmpty(prev?.[key])) {
      out[key] = prev[key]
      stale[key] = tsOf(prev, key)
    }
  }
  out.stale = stale
  return out
}

// Notícias: por moeda, mantém as manchetes anteriores quando a nova coleta veio vazia.
export function fillNewsFromPrevious(news, prev, now = Date.now()) {
  const stale = {}
  for (const code of Object.keys(news)) {
    news[code] = recentNews(news[code], now)
    if (!news[code]?.length && prev?.news?.[code]?.length) {
      news[code] = recentNews(prev.news[code], now)
      stale[code] = prev.stale?.[code] ?? prev.generatedAt ?? null
    }
  }
  return stale
}
