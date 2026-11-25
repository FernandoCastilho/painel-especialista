export const FONTE_CVM = 'https://dados.cvm.gov.br/dataset/fi-doc-inf_diario'
export const LICENCA_CVM = 'https://opendatacommons.org/licenses/odbl/1-0/'

const idPattern = /^cvm-[fc]-([A-Z0-9]{12}\d{2})(?:-([A-Za-z0-9_-]{1,64}))?$/
export const isFundoCvm = id => idPattern.test(id) && (!id.startsWith('cvm-f-') || id.length === 20)
const normalizar = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const abreviacoes = new Map([
  ['cp', /\b(?:cp|cred(?:ito)?\.?\s+priv(?:ado)?)\b/],
  ['ie', /\b(?:ie|invest(?:imento)?\.?\s+no\s+exterior)\b/],
  ['rl', /\b(?:rl|resp(?:onsabilidade)?\.?\s+(?:limitada|ltda))\b/],
])

export function nomeFundo([id, nome, cnpj]) {
  const formatado = cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  const subclasse = idPattern.exec(id)?.[2]
  const tipo = subclasse ? 'Subclasse ' + subclasse : id.startsWith('cvm-f-') ? 'Fundo (cadastro anterior)' : 'Classe'
  return nome + ' · ' + formatado + ' · ' + tipo
}

export function buscarFundos(catalogo, busca, excluidos = []) {
  const termos = normalizar(busca.trim()).replace(/\boff\s+funds\b/g, 'of funds').split(/\s+/)
  if (termos.join('').length < 3) return []
  const cnpj = busca.replace(/[./\s-]/g, '').toUpperCase()
  const buscaCnpj = /\d/.test(cnpj) && /^[A-Z0-9]+$/.test(cnpj)
  const matches = []
  for (const item of catalogo) {
    if (excluidos.includes(item[0])) continue
    const nome = normalizar(nomeFundo(item) + ' ' + (item[3] ?? ''))
    if ((buscaCnpj && (item[2].includes(cnpj) || item[4]?.includes(cnpj))) ||
        termos.every(termo => abreviacoes.get(termo)?.test(nome) ?? nome.includes(termo))) matches.push(item)
    if (matches.length === 20) break
  }
  return matches
}

export function cotasDoFundo(grupo, item) {
  const [id] = item
  const rows = grupo?.[id]
  if (!Array.isArray(rows) || rows.length < 2 || rows.some((linha, index) => {
    if (!Array.isArray(linha)) return true
    const [date, value] = linha
    const day = new Date(date)
    return typeof date !== 'string' || !Number.isFinite(+day)
      || day.toISOString().slice(0, 10) !== date || (index > 0 && rows[index - 1][0] >= date)
      || !Number.isFinite(value) || value < 1e-12 || value > 1e12
  })) throw new Error('O histórico de cotas da CVM não está disponível para esta série.')
  return { id, name: nomeFundo(item), rows, currency: 'BRL', source: 'CVM · Informe Diário' }
}

let catalogo
const grupos = new Map()

async function carregar(arquivo, compactado = false, revalidacao) {
  const url = new URL('./cvm/' + arquivo, document.baseURI)
  if (revalidacao) url.searchParams.set('revalidar', revalidacao)
  const cache = revalidacao ? 'no-store' : compactado ? 'default' : 'no-cache'
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache })
  if (!response.ok) throw new Error('Dados da CVM indisponíveis agora.')
  if (!compactado) return response.json()
  const conteudo = new Uint8Array(await response.arrayBuffer())
  if (conteudo[0] !== 0x1f || conteudo[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(conteudo))
  const stream = new Blob([conteudo]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).json()
}

async function lerCatalogo(revalidacao) {
  const manifest = await carregar('manifest.json', false, revalidacao)
  const arquivo = manifest.files?.catalogo
  if (manifest.version !== 1 || !/^catalogo-[a-f0-9]{64}\.json\.gz$/.test(arquivo)
      || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.first) || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.last)) {
    throw new Error('Catálogo da CVM indisponível.')
  }
  const items = await carregar(arquivo, true, revalidacao)
  if (!Array.isArray(items) || !items.length) throw new Error('Catálogo da CVM indisponível.')
  return { manifest, items }
}

export function carregarCatalogoCvm() {
  // Um manifesto em cache pode apontar para um arquivo substituído na publicação.
  if (!catalogo) catalogo = lerCatalogo()
    .catch(() => lerCatalogo(Date.now()))
    .catch(error => {
      catalogo = undefined
      throw error
    })
  return catalogo
}

export async function carregarFundoCvm(id) {
  const { manifest, items } = await carregarCatalogoCvm()
  const item = items.find(registro => registro[0] === id)
  if (!item) throw new Error('Série ausente no período coberto pela CVM.')
  const bucket = [...item[2]].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 128, 0)
  const arquivo = manifest.files?.[bucket]
  if (!new RegExp('^cotas-' + bucket + '-[a-f0-9]{64}\\.json\\.gz$').test(arquivo)) {
    throw new Error('Arquivo de cotas indisponível.')
  }
  if (!grupos.has(arquivo)) {
    if (grupos.size >= 8) grupos.delete(grupos.keys().next().value)
    grupos.set(arquivo, carregar(arquivo, true).catch(error => {
      grupos.delete(arquivo)
      catalogo = undefined
      throw error
    }))
  }
  return cotasDoFundo(await grupos.get(arquivo), item)
}
