// Robô da TV ao vivo: descobre qual vídeo cada canal está transmitindo agora no YouTube e se o canal deixa exibir
// esse vídeo fora do YouTube. Grava tv.json, que o Painel lê para tocar o vídeo certo.
// Por que: o endereço "o que está ao vivo no canal" (embed/live_stream?channel=) dá "vídeo indisponível" quando o canal
// tem mais de uma transmissão ou nenhuma única, como a CNN Brasil, que faz uma live por programa.
// Uso: node scripts/fetch-tv.mjs <arquivo tv.json>. Se o YouTube não responder, o canal mantém o dado anterior.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { TV_CANAIS } from '../src/tvCanais.js'

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/

// Lê um objeto JSON que começa em `inicio` contando chaves (o YouTube põe o objeto inteiro numa linha de script).
function objetoEm(texto, inicio) {
  let nivel = 0, aspas = false, escape = false
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') aspas = false
    } else if (c === '"') aspas = true
    else if (c === '{') nivel++
    else if (c === '}' && --nivel === 0) return texto.slice(inicio, i + 1)
  }
  return null
}

export function lerRespostaDoPlayer(html) {
  const marca = html.indexOf('ytInitialPlayerResponse')
  if (marca < 0) return null
  const inicio = html.indexOf('{', marca)
  const bruto = inicio < 0 ? null : objetoEm(html, inicio)
  try { return bruto ? JSON.parse(bruto) : null } catch { return null }
}

// Resultado de uma página /channel/<id>/live:
// ao-vivo (vídeo no ar e liberado fora do YouTube), nao-libera (no ar, mas só no YouTube), sem-live (canal sem
// transmissão agora) ou falhou (o YouTube pediu login, mudou a página ou não respondeu: não dá para saber).
export function interpretarPaginaAoVivo(html) {
  if (typeof html !== 'string' || !html) return { estado: 'falhou', motivo: 'página vazia' }
  const canonica = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || ''
  const player = lerRespostaDoPlayer(html)
  const status = player?.playabilityStatus
  if (status?.status === 'LOGIN_REQUIRED') return { estado: 'falhou', motivo: 'o YouTube pediu login (bloqueio de robô)' }
  if (!/\/watch\?v=/.test(canonica)) {
    // Página do canal, não de um vídeo: o canal não está ao vivo agora.
    return /youtube\.com\/(channel|@)/.test(canonica) ? { estado: 'sem-live' } : { estado: 'falhou', motivo: 'página inesperada' }
  }
  const videoId = player?.videoDetails?.videoId || canonica.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1]
  if (!ID_VIDEO.test(videoId || '')) return { estado: 'falhou', motivo: 'vídeo sem identificação' }
  const aoVivo = player?.videoDetails?.isLive === true || player?.microformat?.playerMicroformatRenderer?.liveBroadcastDetails?.isLiveNow === true
  if (!aoVivo) return { estado: 'sem-live' }
  const titulo = String(player?.videoDetails?.title || '').slice(0, 160)
  if (status?.playableInEmbed === false) return { estado: 'nao-libera', videoId, titulo }
  if (status?.status && status.status !== 'OK') return { estado: 'falhou', motivo: `situação do vídeo: ${status.status}` }
  return { estado: 'ao-vivo', videoId, titulo }
}

// Junta o novo com o anterior: canal que falhou fica com o último dado bom (e a data dele, para o Painel saber a idade).
export function juntar(anterior, novos, agora) {
  const canais = {}
  for (const c of TV_CANAIS) {
    const novo = novos[c.id]
    if (novo && novo.estado !== 'falhou') canais[c.id] = { ...novo, conferido: agora }
    else if (anterior?.canais?.[c.id]) canais[c.id] = anterior.canais[c.id]
  }
  return { atualizado: agora, canais }
}

async function baixar(url) {
  const ctrl = AbortSignal.timeout(20000)
  const r = await fetch(url, {
    signal: ctrl,
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      Cookie: 'SOCS=CAI; CONSENT=YES+',
    },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

async function main(arquivo) {
  if (!arquivo) throw new Error('uso: node scripts/fetch-tv.mjs <arquivo tv.json>')
  let anterior = null
  try { anterior = JSON.parse(await readFile(arquivo, 'utf8')) } catch { /* primeira vez */ }
  const novos = {}
  for (const c of TV_CANAIS) {
    try { novos[c.id] = interpretarPaginaAoVivo(await baixar(`https://www.youtube.com/channel/${c.canal}/live`)) }
    catch (e) { novos[c.id] = { estado: 'falhou', motivo: e.message } }
    const n = novos[c.id]
    console.log(`${c.nome}: ${n.estado}${n.videoId ? ` (${n.videoId})` : ''}${n.titulo ? ` · ${n.titulo}` : ''}${n.motivo ? ` · ${n.motivo}` : ''}`)
  }
  const saida = juntar(anterior, novos, new Date().toISOString())
  await writeFile(arquivo, `${JSON.stringify(saida, null, 2)}\n`)
  return novos
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main(process.argv[2]).catch(e => { console.error(e.message); process.exit(1) })
}
