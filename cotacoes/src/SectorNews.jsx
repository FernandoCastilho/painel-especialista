import './SectorNews.css'
import { NEWS_WINDOW_MS } from './newsWindow.js'
import { useEffect, useMemo, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { startVisiblePolling, DATA_POLL_MS } from './visiblePolling.js'
import { normalizeSectorNews, SECTOR_NEWS_COLLECTION } from './sectorNews.js'
import { publicReference } from './insumoPresentation.js'
import Estado from './Estado.jsx'
import { limparManchete } from './newsTitle.js'

const date = value => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
const dateTime = value => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
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
  const collection = normalized?.collection?.automaticCollectionEnabled && resource.status === 'ok' && !readError ? normalized.collection : SECTOR_NEWS_COLLECTION
  const collectionNotice = readError ? 'Atualização automática não confirmada nesta leitura; exibindo publicações já verificadas.' : collection.notice
  return <section className="sector-news" aria-labelledby={`sector-news-${id}`}>
    <h3 id={`sector-news-${id}`} className="sector-news-heading">Notícias da semana · {label}</h3>
    <p className="sector-news-meta">Publicações de {date(now - NEWS_WINDOW_MS)} a {date(now)}.</p>
    <p className="sector-news-status">{collectionNotice}</p>
    {collection.automaticCollectionEnabled && <>
      <p className="sector-news-meta">Verificação geral do painel: <time dateTime={collection.checkedAt}>{dateTime(collection.checkedAt)}</time> · último sucesso geral: <time dateTime={collection.lastSuccessAt}>{dateTime(collection.lastSuccessAt)}</time> (Brasília).</p>
      <p className="sector-news-meta">Fontes do painel: {collection.sourceStats.successful} com consulta válida · {collection.sourceStats.notActive} não ativadas.</p>
    </>}
    {insumo && <p className="setores-note">Oferta, demanda e decisões que ajudam a acompanhar o mercado do insumo. As notícias são contexto; não demonstram, por si só, a causa de uma variação de preço.</p>}
    {resource.status === 'loading' && !topic ? <Estado>Carregando notícias…</Estado> : <>
      {readError && <p className="sector-news-status" role="status">Atualização de notícias indisponível nesta leitura.</p>}
      {items.length > 0 ? <>
        {topic?.status !== 'ok' && <p className="sector-news-meta">Seleção parcial de publicações verificadas.</p>}
        <ol className="sector-news-list" aria-label={`${label}: notícias da semana`}>{items.map(item => <li key={item.link}>
          <a href={item.link} target="_blank" rel="noopener noreferrer">{limparManchete(item.title)}</a>
          <small>{item.source} · <time dateTime={item.datePrecision === 'day' ? item.publishedAt : new Date(item.t).toISOString()}>{publicationLabel(item)}</time></small>
          {item.author && <small>{item.author}</small>}
          {item.relevanceNote && <small>{item.relevanceNote}</small>}
          {item.licenseUrl && <small><a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">Licença de uso</a></small>}
        </li>)}</ol>
      </> : !readError && <p className="sector-news-meta" role="status">Publicações ainda não disponíveis nesta seleção.</p>}
    </>}
  </section>
}
