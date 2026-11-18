import { useEffect, useState } from 'react'
import { PODCASTS, podcastUrl, loadLatestPodcast, podcastDate, episodeLabel } from './podcasts.js'
import './Podcast.css'

export default function Podcast() {
  const [active, setActive] = useState(null)
  const [results, setResults] = useState({})
  const [refresh, setRefresh] = useState(0)
  const [audioError, setAudioError] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    let live = true
    const timer = setTimeout(() => controller.abort(), 15000)
    setResults({})
    setActive(null)
    setAudioError(null)
    Promise.all(PODCASTS.map(async podcast => {
      try {
        const result = await loadLatestPodcast(podcast, { signal: controller.signal })
        if (live) setResults(current => ({ ...current, [podcast.id]: result }))
      } catch {
        if (live) setResults(current => ({ ...current, [podcast.id]: { error: true } }))
      }
    })).finally(() => clearTimeout(timer))
    return () => { live = false; controller.abort(); clearTimeout(timer) }
  }, [refresh])
  return <section className="podcast-page" aria-label="Podcasts de economia e mercado">
    <p className="podcast-intro">O episódio mais recente encontrado de cada programa, com título, data e áudio para ouvir aqui no Painel.</p>
    <p className="podcast-note">Ao abrir esta seção, o Painel consulta os feeds dos produtores. Trailers identificados são excluídos. O áudio não inicia sozinho: abra o player e pressione play.</p>
    <p className="podcast-note">Nem todo programa publica diariamente. A fonte pode demorar a atualizar; a data abaixo é a publicação informada pelo produtor. “Hoje” usa o horário de Brasília no momento da consulta.</p>
    <button type="button" onClick={() => setRefresh(value => value + 1)}>Atualizar episódios</button>
    <div className="podcast-grid">{PODCASTS.map(podcast => {
      const result = results[podcast.id]
      const episode = result?.episode
      return <article className="podcast-card" key={podcast.id}>
        <p className="podcast-kicker">{podcast.cadence}</p>
        <h2>{podcast.title}</h2><p>{podcast.description}</p>
        {!result && <p role="status">Consultando episódios…</p>}
        {result?.error && <p role="status">Não foi possível consultar o episódio mais recente. Tente atualizar ou abra o programa pelo link abaixo.</p>}
        {episode && <>
          <p className="podcast-kicker">{episodeLabel(episode, result.checkedAt)}</p>
          <h3>{episode.title}</h3>
          <p className="podcast-note">Publicado em <time dateTime={new Date(episode.publishedAt).toISOString()}>{podcastDate(episode.publishedAt)}</time>. Consulta em {new Date(result.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).</p>
          <button type="button" aria-expanded={active === podcast.id} aria-controls={`player-${podcast.id}`} onClick={() => { setAudioError(null); setActive(active === podcast.id ? null : podcast.id) }}>{active === podcast.id ? 'Fechar player' : 'Ouvir este episódio no Painel'}</button>
          <div id={`player-${podcast.id}`} className="podcast-player">{active === podcast.id && <audio key={episode.audioUrl} aria-label={`Ouvir ${episode.title}`} controls preload="none" src={episode.audioUrl} onError={() => setAudioError(podcast.id)} />}</div>
          {audioError === podcast.id && <p role="status">O áudio não carregou. Use o link do programa abaixo.</p>}
        </>}
        <p className="podcast-note"><a href={podcastUrl(podcast)} target="_blank" rel="noopener noreferrer">Abrir {podcast.title} no Apple Podcasts (nova aba)</a></p>
      </article>
    })}</div>
    <p className="podcast-note">Programas do Itaú BBA. Conteúdo e disponibilidade são dos produtores. As opiniões dos episódios não substituem uma análise própria.</p>
  </section>
}
