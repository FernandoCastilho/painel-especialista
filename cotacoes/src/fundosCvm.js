export const FONTE_CVM = 'https://dados.cvm.gov.br/dataset/fi-doc-inf_diario'
export const LICENCA_CVM = 'https://opendatacommons.org/licenses/odbl/1-0/'

const idPattern = /^cvm-[fc]-([A-Z0-9]{12}\d{2})(?:-([A-Za-z0-9_-]{1,64}))?$/
export const isFundoCvm = id => idPattern.test(id) && (!id.startsWith('cvm-f-') || id.length === 20)
const normalizar = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const conectivos = new Set('a as com da das de do dos e em na nas no nos o os para por'.split(' '))
const indiceNomes = new WeakMap()

// Siglas de mercado (CVM 175, ANBIMA e plataformas): o nome completo continua valendo na busca.
const A = '[AÁÀÃÂ]', E = '[EÉÊ]', I = '[IÍ]', O = '[OÓÔÕ]', C = '[CÇ]'
const termo = texto => texto.replace(/ /g, '\\s+')
const SIGLAS = [
  [`FIF EM COTAS DE FUNDOS INCENTIVADOS DE INVESTIMENTO EM INFRA(?:ESTRUTURA)?`, 'FIC FI-INFRA'],
  [`FIC DE FUNDOS? DE INVESTIMENTO(?: FINANCEIRO)?`, 'FIC'],
  [`(?:FUNDO DE INVESTIMENTO|FI)(?: FINANCEIRO)? EM COTAS DE FUNDOS? DE INVESTIMENTO(?: FINANCEIRO)?`, 'FIC'],
  [`FI FINANCEIRO EM COTAS DE FUNDOS?`, 'FIC'],
  [`CLASSE DE INVESTIMENTO EM COTAS DE CLASSES? DE INVESTIMENTO`, 'CIC'],
  [`CIC DE CLASSES? DE INVESTIMENTO`, 'CIC'],
  [`CLASSE DE INVESTIMENTO EM COTAS(?: DE)?`, 'CIC'],
  [`CLASSE DE INVESTIMENTO`, 'CI'],
  [`FUNDO DE INVESTIMENTO FINANCEIRO`, 'FIF'],
  [`FI FINANCEIRO`, 'FIF'],
  [`FUNDO INCENTIVADO DE INVESTIMENTO(?: FINANCEIRO)? EM INFRAESTRUTURA`, 'FI-INFRA'],
  [`FUNDO INCENTIVADO EM INVESTIMENTO EM DEB${E}NTURES DE INFRA(?:ESTRUTURA)?`, 'FI-INFRA'],
  [`FUNDO DE INVESTIMENTO`, 'FI'],
  [`FI EM COTAS`, 'FIC'],
  [`FI EM ${A}${C}${O}ES`, 'FIA'],
  [`FIC EM ${A}${C}${O}ES`, 'FIC FIA'],
  [`EM ${A}${C}${O}ES`, 'AÇÕES'],
  [`MULTIMERCADO`, 'MULT'],
  [`RENDA FIXA`, 'RF'],
  [`REFERENCIADO`, 'REF'],
  [`CR${E}DITO PRIVADO|CR${E}D\\.? PRIV\\.?`, 'CP'],
  [`LONGO PRAZO`, 'LP'],
  [`INVESTIMENTO NO EXTERIOR`, 'IE'],
  [`RESPONSABILIDADE LIMITADA|RESPONSAB\\.? LIMITADA|RESP\\.? LIMITADA`, 'RL'],
  [`PREVID${E}N${C}${I}${A}RIO|PREVID${E}N${C}IA`, 'PREV'],
  [`INFRAESTRUTURA`, 'INFRA'],
  [`DEB${E}NTURES`, 'DEB'],
  [`INCENTIVADO`, 'INC'],
  [`INVESTIMENTO`, 'INV'],
].map(([padrao, sigla]) => [new RegExp(`(?<![\\p{L}\\p{N}])(?:${termo(padrao)})(?![\\p{L}\\p{N}])`, 'giu'), sigla])

export function abreviarNomeFundo(nome) {
  // "X · SUBCLASSE I DA CLASSE X": o nome da classe já está no começo.
  let curto = nome.replace(/(\s·\s+SUBCLASSE\s+\S+)\s+DA\s+CLASSE\s.*$/iu, '$1')
  for (const [padrao, sigla] of SIGLAS) curto = curto.replace(padrao, sigla)
  return curto
    .replace(/\s+-(?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function nomeFundo([id, nome, cnpj]) {
  const formatado = cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
  const subclasse = idPattern.exec(id)?.[2]
  const tipo = subclasse ? ' · Subclasse ' + subclasse : id.startsWith('cvm-f-') ? ' · Fundo (cadastro anterior)' : ''
  return abreviarNomeFundo(nome) + ' · ' + formatado + tipo
}

function indexarNome(item) {
  let registro = indiceNomes.get(item)
  if (!registro) {
    const nome = normalizar(item[1])
    const pai = item[3] && item[3] !== item[1] ? normalizar(item[3]) : ''
    const [id] = item
    const subclasse = idPattern.exec(id)?.[2]
    const tipo = subclasse ? 'subclasse ' + normalizar(subclasse) : id.startsWith('cvm-f-') ? 'fundo cadastro anterior' : 'classe'
    registro = { nome, pai, texto: nome + ' ' + pai + ' ' + tipo }
    indiceNomes.set(item, registro)
  }
  return registro
}

export function prepararBuscaCvm(catalogo) {
  catalogo.forEach(indexarNome)
}

function prioridadeNome({ nome, pai, texto }, consulta, termos) {
  if (nome === consulta) return 0
  if (nome.startsWith(consulta) || pai.startsWith(consulta)) return 1
  if (texto.includes(consulta)) return 2
  if (termos.every(termo => texto.includes(termo))) return 3
  return -1
}

function correspondeSiglas(registro, termos, posiveisSiglas) {
  const faltantes = []
  for (const termo of termos) {
    if (registro.texto.includes(termo)) continue
    if (!posiveisSiglas.has(termo)) return false
    faltantes.push(termo)
  }
  registro.iniciais ??= [registro.nome, registro.pai].filter(Boolean).flatMap(denominacao => {
    const palavras = denominacao.split(' ')
    const juntar = lista => lista.map(palavra => palavra[0]).join('')
    return [juntar(palavras), juntar(palavras.filter(palavra => !conectivos.has(palavra)))]
  })
  return faltantes.every(termo => registro.iniciais.some(sigla => sigla.includes(termo)))
}

export function buscarFundos(catalogo, busca, excluidos = []) {
  const consulta = normalizar(busca).replace(/\boff funds\b/g, 'of funds')
  const termos = consulta.split(' ')
  if (termos.join('').length < 2) return []
  const possiveisSiglas = new Set(termos.filter(termo => /^[a-z]{2,5}$/.test(termo)))
  const cnpj = busca.replace(/[./\s-]/g, '').toUpperCase()
  const buscaCnpj = /\d/.test(cnpj) && /^[A-Z0-9]+$/.test(cnpj)
  const cnpjCompleto = buscaCnpj && /^[A-Z0-9]{12}\d{2}$/.test(cnpj)
  const resultados = [[], [], [], []]
  const candidatosSigla = []
  for (const item of catalogo) {
    if (excluidos.includes(item[0])) continue
    let prioridade
    if (buscaCnpj && item[2] === cnpj) prioridade = 0
    else if (buscaCnpj && (item[2].includes(cnpj) || item[4]?.includes(cnpj))) prioridade = 1
    else if (cnpjCompleto) continue
    else prioridade = prioridadeNome(indexarNome(item), consulta, termos)
    if (prioridade >= 0 && resultados[prioridade].length < 20) resultados[prioridade].push(item)
    if (prioridade === -1 && possiveisSiglas.size) candidatosSigla.push(item)
    if (resultados[0].length === 20) break
  }
  const matches = resultados.flat().slice(0, 20)
  for (const item of candidatosSigla) {
    if (matches.length === 20) break
    if (correspondeSiglas(indexarNome(item), termos, possiveisSiglas)) matches.push(item)
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

// Redes de empresa podem barrar download de .gz (erro 403). A base sai também em JSON comum,
// que o próprio servidor comprime no envio; o .gz fica como plano B.
async function carregarBase(arquivo, revalidacao) {
  try {
    return await carregar(arquivo.replace(/\.gz$/, ''), true, revalidacao)
  } catch {
    return carregar(arquivo, true, revalidacao)
  }
}

async function lerCatalogo(revalidacao) {
  const manifest = await carregar('manifest.json', false, revalidacao)
  const arquivo = manifest.files?.catalogo
  if (manifest.version !== 1 || !/^catalogo-[a-f0-9]{64}\.json\.gz$/.test(arquivo)
      || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.first) || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.last)) {
    throw new Error('Catálogo da CVM indisponível.')
  }
  const items = await carregarBase(arquivo, revalidacao)
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
    grupos.set(arquivo, carregarBase(arquivo).catch(error => {
      grupos.delete(arquivo)
      catalogo = undefined
      throw error
    }))
  }
  const fundo = cotasDoFundo(await grupos.get(arquivo), item)
  return /^\d{4}-\d{2}-\d{2}$/.test(manifest.collected) ? { ...fundo, atualizado: manifest.collected } : fundo
}
