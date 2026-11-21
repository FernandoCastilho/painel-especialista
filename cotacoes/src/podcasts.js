// Canais confirmados nos feeds públicos dos produtores e no Apple Podcasts.
export const PODCASTS = [
  { id: 'morning-call', title: 'Itaú Views Morning Call', cadence: 'Diário', description: 'Uma leitura rápida das notícias políticas e econômicas para começar o dia.', feedUrl: 'https://anchor.fm/s/f84d76fc/podcast/rss', artworkUrl: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/41558263/41558263-1736207492157-d3ad646cf5305.jpg', appleId: '1495352313', slug: 'ita%C3%BA-views-morning-call' },
  { id: 'itau-views', title: 'Itaú Views', cadence: 'Análises e entrevistas', description: 'Conversas sobre economia, setores, investimentos e tecnologia com especialistas e convidados.', feedUrl: 'https://anchor.fm/s/e0ddef4c/podcast/rss', artworkUrl: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/37626411/37626411-1736278886384-c6920dc0ab923.jpg', appleId: '1464605101', slug: 'ita%C3%BA-views' },
  { id: 'daily-fin', title: 'Daily Fin Podcast', cadence: 'Notícias e análises', description: 'Notícias de economia, política e negócios comentadas pela RadarFin.', feedUrl: 'https://anchor.fm/s/f9f69e70/podcast/rss', artworkUrl: 'https://d3t3ozftmdmh3i.cloudfront.net/staging/podcast_uploaded_nologo/41836892/41836892-1776453323117-468022a4428b9.jpg', appleId: '1781425869', slug: 'daily-fin-podcast', podcastAddictUrl: 'https://podcastaddict.com/podcast/daily-fin-podcast/5848272' },
]
export const podcastUrl = podcast => `https://podcasts.apple.com/br/podcast/${podcast.slug}/id${podcast.appleId}`
const textOf = (node, tag) => node.getElementsByTagName(tag)[0]?.textContent?.trim() || ''
const itunesNs = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
const artworkHosts = new Set([
  'www.itau.com.br', 'anchor.fm',
  'd3t3ozftmdmh3i.cloudfront.net', 'i.scdn.co', 'image-cdn-fa.spotifycdn.com',
  'is1-ssl.mzstatic.com', 'is2-ssl.mzstatic.com', 'is3-ssl.mzstatic.com',
])
export function safePodcastArtwork(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && artworkHosts.has(url.hostname) ? url.href : null
  } catch { return null }
}
export function podcastArtworkCandidates(...values) {
  return [...new Set(values.map(safePodcastArtwork).filter(Boolean))]
}
function directArtwork(node) {
  const tags = Array.from(node?.children || [])
  const itunes = tags.find(tag => tag.localName === 'image' && tag.namespaceURI === itunesNs)
  const rss = tags.find(tag => tag.localName === 'image' && !tag.namespaceURI)
  return safePodcastArtwork(itunes?.getAttribute('href')) || (rss ? safePodcastArtwork(textOf(rss, 'url')) : null)
}
function readPodcastFeed(xml, Parser = DOMParser) {
  const doc = new Parser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Feed inválido')
  const channel = doc.getElementsByTagName('channel')[0]
  const items = Array.from(doc.getElementsByTagName('item'), item => {
    const enclosure = item.getElementsByTagName('enclosure')[0]
    const artworkUrl = directArtwork(item)
    return { title: textOf(item, 'title'), publishedAt: textOf(item, 'pubDate'), type: textOf(item, 'itunes:episodeType'), audioUrl: enclosure?.getAttribute('url'), mime: enclosure?.getAttribute('type'), ...(artworkUrl ? { artworkUrl } : {}) }
  })
  return { items, channelArtworkUrl: directArtwork(channel) }
}
export const parsePodcastFeed = (xml, Parser) => readPodcastFeed(xml, Parser).items
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
  const { items, channelArtworkUrl } = readPodcastFeed(await response.text(), Parser)
  const episode = latestEpisode(items, now)
  if (!episode) throw new Error('Nenhum episódio de áudio válido')
  return { episode, checkedAt: now, ...(channelArtworkUrl ? { channelArtworkUrl } : {}) }
}
