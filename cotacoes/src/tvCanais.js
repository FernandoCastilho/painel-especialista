// TV ao vivo: só canais oficiais no YouTube, conferidos em 28/11/2026 (transmissão ao vivo pública e com exibição
// permitida fora do YouTube). O endereço é o do canal, não de um vídeo: o YouTube mostra a transmissão que estiver no ar.
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

// Começa sem som; o som liga no próprio player do YouTube.
export function tvEmbedUrl(canal) {
  const params = new URLSearchParams({ channel: canal.canal, autoplay: '1', mute: '1', playsinline: '1', rel: '0' })
  return `https://www.youtube.com/embed/live_stream?${params}`
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
