// Canais confirmados no catálogo público do Itaú e no Apple Podcasts em 18/11/2026.
export const PODCASTS = [
  { id: 'morning-call', title: 'Itaú Views Morning Call', cadence: 'Diário', description: 'Uma leitura rápida das notícias políticas e econômicas para começar o dia.', feedUrl: 'https://anchor.fm/s/f84d76fc/podcast/rss', appleId: '1495352313', slug: 'ita%C3%BA-views-morning-call' },
  { id: 'itau-views', title: 'Itaú Views', cadence: 'Análises e entrevistas', description: 'Conversas sobre economia, setores, investimentos e tecnologia com especialistas e convidados.', feedUrl: 'https://anchor.fm/s/e0ddef4c/podcast/rss', appleId: '1464605101', slug: 'ita%C3%BA-views' },
]
export const podcastUrl = podcast => `https://podcasts.apple.com/br/podcast/${podcast.slug}/id${podcast.appleId}`
const textOf = (node, tag) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
export function parsePodcastFeed(xml, Parser = DOMParser) {
  const doc = new Parser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Feed inválido')
  return Array.from(doc.getElementsByTagName('item'), item => {
    const enclosure = item.getElementsByTagName('enclosure')[0]
    return { title: textOf(item, 'title'), publishedAt: textOf(item, 'pubDate'), type: textOf(item, 'itunes:episodeType'), audioUrl: enclosure?.getAttribute('url'), mime: enclosure?.getAttribute('type') }
  })
}
function secureAudio(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}
export function latestEpisode(items, now = Date.now()) {
  return items.filter(item => item.title && item.type?.toLowerCase() !== 'trailer' && !/\btrailer\b/i.test(item.title)
    && /^audio\//i.test(item.mime || '') && secureAudio(item.audioUrl)
    && Number.isFinite(Date.parse(item.publishedAt)) && Date.parse(item.publishedAt) <= now)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))[0] || null
}
export const podcastDate = value => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(new Date(value))
export function episodeLabel(episode, checkedAt) {
  return podcastDate(episode.publishedAt) === podcastDate(checkedAt) ? 'Publicado hoje (na consulta)' : 'Mais recente encontrado'
}
export async function loadLatestPodcast(podcast, { signal, fetcher = fetch, now = Date.now(), Parser } = {}) {
  const url = new URL(podcast.feedUrl)
  // Renova o cache por minuto, sem criar coletor, agendamento ou cópia do áudio.
  url.searchParams.set('t', Math.floor(now / 60000))
  const response = await fetcher(url.href, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('Feed indisponível')
  const episode = latestEpisode(parsePodcastFeed(await response.text(), Parser), now)
  if (!episode) throw new Error('Nenhum episódio de áudio válido')
  return { episode, checkedAt: now }
}
