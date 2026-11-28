// TV ao vivo: só canais oficiais no YouTube, conferidos em 28/11/2026 (transmissão ao vivo pública e com exibição
// permitida fora do YouTube). O robô da TV (scripts/fetch-tv.mjs) descobre o vídeo que cada canal transmite agora;
// sem dado recente do robô, o Painel usa o endereço do canal e o YouTube tenta mostrar a transmissão que estiver no ar.
export const TV_CANAIS = [
  { id: 'cnn-brasil', nome: 'CNN Brasil', idioma: 'Português', canal: 'UCvdwhh_fDyWccR42-rReZLw', youtube: 'https://www.youtube.com/@CNNbrasil/live' },
  { id: 'bloomberg', nome: 'Bloomberg TV', idioma: 'Inglês', canal: 'UCIALMKvObZNtJ6AmdCLP7Lg', youtube: 'https://www.youtube.com/@markets/live' },
]

export const TV_TAMANHOS = [
  { id: 'p', rotulo: 'P', nome: 'Pequena', largura: 320 },
  { id: 'm', rotulo: 'M', nome: 'Média', largura: 480 },
  { id: 'g', rotulo: 'G', nome: 'Grande', largura: 720 },
]

export const TV_EVENTO = 'painel:tv'
const CHAVE = 'painel-tv'

// Dado do robô vale por 3 horas: o agendamento do GitHub atrasa, e uma live de programa acaba e outra começa.
export const TV_VALIDADE_MS = 3 * 60 * 60 * 1000

// O que tocar: o vídeo que o robô achou (ao-vivo), um aviso sem vídeo (sem-live, nao-libera) ou, sem dado recente,
// o endereço do canal (canal). Começa sem som; o som liga no próprio player do YouTube.
export function tvFonte(canal, dados, agora = Date.now()) {
  const params = { autoplay: '1', mute: '1', playsinline: '1', rel: '0' }
  const item = dados?.canais?.[canal.id]
  const idade = agora - Date.parse(item?.conferido)
  const recente = idade >= -5 * 60 * 1000 && idade <= TV_VALIDADE_MS
  if (recente && item.estado === 'ao-vivo' && /^[A-Za-z0-9_-]{11}$/.test(item.videoId || '')) {
    return { tipo: 'video', url: `https://www.youtube.com/embed/${item.videoId}?${new URLSearchParams(params)}` }
  }
  if (recente && (item.estado === 'sem-live' || item.estado === 'nao-libera')) return { tipo: item.estado }
  return { tipo: 'canal', url: tvEmbedUrl(canal) }
}

export function tvEmbedUrl(canal) {
  const params = new URLSearchParams({ channel: canal.canal, autoplay: '1', mute: '1', playsinline: '1', rel: '0' })
  return `https://www.youtube.com/embed/live_stream?${params}`
}

// Arquivo do robô: fica na branch tv do repositório, ao lado da branch data das cotações.
export function tvDadosUrl(dataBase) {
  if (!dataBase) return null
  return `${String(dataBase).replace(/\/+$/, '').replace(/\/data$/, '/tv')}/tv.json`
}

export function lerPreferencia(storage = globalThis.localStorage) {
  try {
    const salvo = JSON.parse(storage?.getItem(CHAVE) || '{}')
    const pos = salvo.posicao
    return {
      canal: TV_CANAIS.some(c => c.id === salvo.canal) ? salvo.canal : null,
      tamanho: TV_TAMANHOS.some(t => t.id === salvo.tamanho) ? salvo.tamanho : 'p',
      posicao: Number.isFinite(pos?.x) && Number.isFinite(pos?.y) ? { x: pos.x, y: pos.y } : null,
    }
  } catch { return { canal: null, tamanho: 'p', posicao: null } }
}

export function gravarPreferencia(pref, storage = globalThis.localStorage) {
  try { storage?.setItem(CHAVE, JSON.stringify(pref)) } catch { /* Sem armazenamento: vale só nesta visita. */ }
}
