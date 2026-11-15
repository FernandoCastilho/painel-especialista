import { useNewsClock } from './useNewsClock.js'
import { newsCollectionStale } from './newsWindow.js'
import RefreshButton from './RefreshButton.jsx'
import { Aviso } from './Avisos.jsx'
import { useMemo, useState } from 'react'
import Explain from './Explain.jsx'
import { CURRENCIES } from './useQuotes.js'
import { useNews } from './useNews.js'
import { buildFeed } from './feed.js'
import Estado from './Estado.jsx'
import { limparManchete } from './newsTitle.js'

const stamp = (t) => {
  if (!t) return '—'
  const d = new Date(t)
  const today = d.toDateString() === new Date().toDateString()
  return today ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const Tickers = ({ codes, colors }) =>
  codes.map((c) => (
    <b key={c} className="tk" style={{ '--tk': colors[c] }}>
      {c}
    </b>
  ))

export default function News({ colors }) {
  const { data, error } = useNews()
  const [filter, setFilter] = useState('ALL')
  const now = useNewsClock()
  const feed = useMemo(() => buildFeed(data?.news, filter, 60, now), [data, filter, now])
  const generated = data?.generatedAt && new Date(data.generatedAt)

  return (
    <section className="news">
      <div className="history-head">
        <h2>Notícias · últimos 5 dias <Explain id="noticias" /></h2>
        <RefreshButton files={['news.json']} label="Notícias" />
      </div>
      {!data && !error && <p className="status">Carregando notícias…</p>}
      {error && <Estado tipo="erro" erro={error}>Notícias indisponíveis no momento.</Estado>}
      {data && Object.keys(data.stale ?? {}).length > 0 && (
        <p className="status stale">Sem novas manchetes válidas para {Object.keys(data.stale).join(', ')}; só permanecem as publicadas nas últimas 120 horas.</p>
      )}
      {data && (
        <>
          <div className="seg feed-filter" role="group" aria-label="Filtrar por moeda ou mercado">
            {['ALL', ...CURRENCIES.map((c) => c.code), 'MERCADO'].map((c) => (
              <button key={c} type="button" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                {c === 'ALL' ? 'Todas' : c === 'MERCADO' ? 'Mercado hoje' : c}
              </button>
            ))}
          </div>
          {feed.length ? (
            <ul className="feed">
              {feed.map((n) => (
                <li key={n.link}>
                  <time className="feed-time">{stamp(n.t)}</time>
                  <span className="feed-tk">
                    <Tickers codes={n.codes} colors={colors} />
                  </span>
                  <span className="feed-body">
                    <a href={n.link} target="_blank" rel="noopener noreferrer" title={n.original ? `Original: ${n.original}` : undefined}>
                      {limparManchete(n.title)}
                    </a>
                    <small className="muted">
                      {n.source}
                      {n.original && ' · traduzida do inglês'}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="status">Nenhuma publicação válida nas últimas 120 horas no arquivo disponível. Isso não significa ausência de notícias.</p>
          )}
        </>
      )}
      {data && newsCollectionStale(data, now) && (
        <p className="status stale">Atualização incompleta, atrasada ou não confirmada. A data do arquivo não renova a data de publicação das notícias.</p>
      )}
      {generated && (<Aviso title="Notícias · como ler">
        <p className="status">
          Arquivo gerado em {generated.toLocaleDateString('pt-BR')} às {generated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Janela móvel de 5 dias (120 horas), contada pela publicação. O ticker indica a moeda que a notícia tende a afetar. Manchetes em inglês são traduzidas automaticamente. As matérias pertencem aos veículos citados.
        </p></Aviso>
      )}
    </section>
  )
}
