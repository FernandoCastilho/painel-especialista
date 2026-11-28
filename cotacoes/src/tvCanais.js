// TV ao vivo: fontes oficiais. O atalho por canal do YouTube nem sempre resolve a transmissão atual;
// os sites das emissoras são independentes desse endereço e continuam acessíveis pelo menu.
export const TV_CANAIS = [
  { id: 'cnn-brasil', nome: 'CNN Brasil', idioma: 'Português', canal: 'UCvdwhh_fDyWccR42-rReZLw', youtube: 'https://www.youtube.com/@CNNbrasil/streams', oficial: 'https://www.cnnbrasil.com.br/ao-vivo/' },
  { id: 'bloomberg', nome: 'Bloomberg TV', idioma: 'Inglês', canal: 'UCIALMKvObZNtJ6AmdCLP7Lg', youtube: 'https://www.youtube.com/@markets/streams', oficial: 'https://www.bloomberg.com/live/us' },
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
    return {
      canal: TV_CANAIS.some(c => c.id === salvo.canal) ? salvo.canal : null,
      tamanho: TV_TAMANHOS.some(t => t.id === salvo.tamanho) ? salvo.tamanho : 'p',
    }
  } catch { return { canal: null, tamanho: 'p' } }
}

export function gravarPreferencia(pref, storage = globalThis.localStorage) {
  try { storage?.setItem(CHAVE, JSON.stringify(pref)) } catch { /* Sem armazenamento: vale só nesta visita. */ }
}
