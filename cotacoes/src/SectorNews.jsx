import { NEWS_WINDOW_MS } from './newsWindow.js'
import { useEffect, useMemo, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { startVisiblePolling, DATA_POLL_MS } from './visiblePolling.js'
import { normalizeSectorNews, SECTOR_NEWS_COLLECTION } from './sectorNews.js'
import { publicReference } from './insumoPresentation.js'
import Estado from './Estado.jsx'

const date = value => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const publicationLabel = item => item.datePrecision === 'day' ? String(item.publishedAt).slice(0, 10).split('-').reverse().join('/') : date(item.t)

// Revalidate publication dates while open; UI never equates an old snapshot with a fresh search.
export default function SectorNews({ id, label, insumo = false }) {
  const resource = useDataFile('sector-news.json')
  const [now, setNow] = useState(Date.now)
  useEffect(() => startVisiblePolling(() => setNow(Date.now()), DATA_POLL_MS), [])
  const normalized = useMemo(() => {
    try { return resource.data ? normalizeSectorNews(resource.data, now) : null } catch { return null }
  }, [resource.data, now])
  const topic = normalized?.topics?.[id]
  const items = (topic?.items ?? []).filter(item => publicReference(item.link))
  const readError = topic?.status === 'failed' || resource.status === 'error' || resource.stale || (resource.data && !normalized)
  return <section className="sector-news" aria-labelledby={`sector-news-${id}`}>
    <h3 id={`sector-news-${id}`} className="sector-news-heading">Notícias da semana · {label}</h3>
    <p className="sector-news-meta">Publicações de {date(now - NEWS_WINDOW_MS)} a {date(now)}.</p>
    <p className="sector-news-status">{SECTOR_NEWS_COLLECTION.notice}</p>
    {insumo && <p className="setores-note">Oferta, demanda e decisões que ajudam a acompanhar o mercado do insumo. As notícias são contexto; não demonstram, por si só, a causa de uma variação de preço.</p>}
    {resource.status === 'loading' && !topic ? <Estado>Carregando notícias…</Estado> : <>
      {readError && <p className="sector-news-status" role="status">Atualização de notícias indisponível nesta leitura.</p>}
      {items.length > 0 ? <>
        {topic?.status !== 'ok' && <p className="sector-news-meta">Seleção parcial de publicações verificadas.</p>}
        <ol className="sector-news-list" aria-label={`${label}: notícias da semana`}>{items.map(item => <li key={item.link}>
          <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
          <small>{item.source} · <time dateTime={item.datePrecision === 'day' ? item.publishedAt : new Date(item.t).toISOString()}>{publicationLabel(item)}</time></small>
          {item.author && <small>{item.author}</small>}
          {item.relevanceNote && <small>{item.relevanceNote}</small>}
          {item.licenseUrl && <small><a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">Licença de uso</a></small>}
        </li>)}</ol>
      </> : !readError && <p className="sector-news-meta" role="status">Publicações ainda não disponíveis nesta seleção.</p>}
    </>}
  </section>
}
