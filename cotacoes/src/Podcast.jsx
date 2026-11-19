import { useEffect, useRef, useState } from 'react'
import { PODCASTS, podcastUrl, loadLatestPodcast, podcastDate, episodeLabel } from './podcasts.js'
import './Podcast.css'

const clock = seconds => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const value = Math.floor(seconds)
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
export default function Podcast() {
  const [active, setActive] = useState(PODCASTS[0]?.id ?? null)
  const [results, setResults] = useState({})
  const [refresh, setRefresh] = useState(0)
  const [audioError, setAudioError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [volume, setVolume] = useState(1)
  const audio = useRef(null)
  const selected = PODCASTS.find(p => p.id === active)
  const result = results[active]
  const episode = result?.episode
  const reset = () => { audio.current?.pause(); setPlaying(false); setWaiting(false); setPosition(0); setDuration(0); setAudioError(null) }
  useEffect(() => {
    const controller = new AbortController()
    let live = true
    const timer = setTimeout(() => controller.abort(), 15000)
    setResults({})
    Promise.all(PODCASTS.map(async podcast => {
      try {
        const next = await loadLatestPodcast(podcast, { signal: controller.signal })
        if (live) setResults(current => ({ ...current, [podcast.id]: next }))
      } catch {
        if (live) setResults(current => ({ ...current, [podcast.id]: { error: true } }))
      }
    })).finally(() => clearTimeout(timer))
    return () => { live = false; controller.abort(); clearTimeout(timer) }
  }, [refresh])
  const toggle = async () => {
    const player = audio.current
    if (!player) return
    if (!player.paused) { player.pause(); return }
    setAudioError(null); setWaiting(true)
    try { await player.play() } catch { if (audio.current === player) { setWaiting(false); setPlaying(false); setAudioError(active) } }
  }
  const seek = value => {
    const player = audio.current
    if (!player || !Number.isFinite(player.duration) || player.duration <= 0) return
    const next = Math.max(0, Math.min(player.duration, value))
    player.currentTime = next; setPosition(next)
  }
  return <section className="podcast-page" aria-label="Podcasts de economia e mercado">
    <p className="podcast-intro">Ouça os episódios sem sair do Painel.</p>
    <div className="podcast-workspace">
      <article className="podcast-listening" aria-label="Player do podcast">
        <h2 className="podcast-panel-title">{playing ? 'Ouvindo agora' : 'Pronto para ouvir'}</h2>
        <div className="podcast-player-body">
          <div className="podcast-episode-heading">
            <div className="podcast-art" aria-hidden="true"><svg viewBox="0 0 120 120"><path d="M20 52v16m10-28v40m10-35v30m10-48v66m10-56v46m10-62v78m10-54v30m10-39v48m10-32v16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg></div>
            <div><h3>{selected?.title ?? 'Selecione um programa'}</h3><p className="podcast-note">{selected?.description}</p>
              {episode && <><p className="podcast-kicker">{episodeLabel(episode, result.checkedAt)} · <time dateTime={new Date(episode.publishedAt).toISOString()}>{podcastDate(episode.publishedAt)}</time></p><h4>{episode.title}</h4></>}
            </div>
          </div>
          {!result && <p role="status">Consultando episódios…</p>}
          {result?.error && <p role="status">Não foi possível consultar o episódio mais recente. Tente atualizar ou abra o programa pelo link abaixo.</p>}
          {episode && <>
            <audio ref={audio} key={`${active}-${episode.audioUrl}`} aria-label={`Ouvir ${episode.title}`} preload="none" src={episode.audioUrl}
              onLoadedMetadata={e => { const a = e.currentTarget; setDuration(Number.isFinite(a.duration) ? a.duration : 0); a.playbackRate = speed; a.volume = volume }}
              onDurationChange={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
              onTimeUpdate={e => setPosition(e.currentTarget.currentTime)}
              onPlay={() => setPlaying(true)} onPlaying={() => { setPlaying(true); setWaiting(false) }}
              onPause={() => { setPlaying(false); setWaiting(false) }} onWaiting={() => setWaiting(true)}
              onEnded={() => { setPlaying(false); setWaiting(false) }} onError={() => { setAudioError(active); setPlaying(false); setWaiting(false) }} />
            <div className="podcast-progress"><label className="podcast-sr" htmlFor="podcast-position">Posição do episódio</label><input id="podcast-position" type="range" min="0" max={duration || 1} step="1" value={Math.min(position, duration || 0)} disabled={!duration || audioError === active} aria-valuetext={`${clock(position)} de ${clock(duration)}`} onChange={e => seek(Number(e.target.value))} /><div><span>{clock(position)}</span><span>{duration ? clock(duration) : 'Duração após iniciar'}</span></div></div>
            <div className="podcast-controls">
              <button type="button" disabled={!duration || audioError === active} onClick={() => seek(position - 15)} aria-label="Voltar 15 segundos">↶ 15<span>Voltar 15 s</span></button>
              <button className="podcast-play" type="button" onClick={toggle} aria-label={playing ? 'Pausar episódio' : 'Reproduzir episódio'}>{playing ? 'Ⅱ' : '▶'}</button>
              <button type="button" disabled={!duration || audioError === active} onClick={() => seek(position + 30)} aria-label="Avançar 30 segundos">30 ↷<span>Avançar 30 s</span></button>
              <label className="podcast-speed">Velocidade<select aria-label="Velocidade de reprodução" value={speed} onChange={e => { const value = Number(e.target.value); setSpeed(value); if (audio.current) audio.current.playbackRate = value }}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map(value => <option key={value} value={value}>{String(value).replace('.', ',')}×</option>)}</select></label>
              <label className="podcast-volume">Volume<input aria-label="Volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={e => { const value = Number(e.target.value); setVolume(value); if (audio.current) audio.current.volume = value }} /></label>
            </div>
            {waiting && <p role="status">Carregando áudio…</p>}
            {audioError === active && <p role="status">O áudio não carregou. Tente reproduzir novamente ou use o link do programa abaixo.</p>}
          </>}
          {selected && <p className="podcast-external"><a href={podcastUrl(selected)} target="_blank" rel="noopener noreferrer">Abrir {selected.title} no Apple Podcasts ↗<span className="podcast-sr"> (nova aba)</span></a></p>}
        </div>
      </article>
      <aside className="podcast-programs" aria-label="Programas de podcast"><h2 className="podcast-panel-title">Programas</h2><div className="podcast-program-list">{PODCASTS.map(podcast => {
        const next = results[podcast.id]
        return <button type="button" className={`podcast-program${active === podcast.id ? ' is-selected' : ''}`} key={podcast.id} aria-pressed={active === podcast.id} onClick={() => { if (active !== podcast.id) { reset(); setActive(podcast.id) } }}>
          <span aria-hidden="true">{active === podcast.id && playing ? 'Ⅱ' : '▶'}</span><span><strong>{podcast.title}</strong><small>{!next ? 'Consultando episódios…' : next.error ? 'Fonte indisponível' : active === podcast.id ? playing ? 'Em reprodução' : 'Selecionado' : podcast.cadence}</small>{next?.episode && <small>{podcastDate(next.episode.publishedAt)}</small>}</span>
        </button>
      })}</div><button className="podcast-refresh" type="button" onClick={() => { reset(); setRefresh(value => value + 1) }}>Atualizar episódios</button></aside>
    </div>
    <p className="podcast-note">O Painel consulta os feeds dos produtores ao abrir a seção. Trailers identificados são excluídos. Nem todo programa publica diariamente. “Hoje” usa o horário de Brasília no momento da consulta. A reprodução só começa ao pressionar play.</p>
    {result?.checkedAt && <p className="podcast-note">Consulta em {new Date(result.checkedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília).</p>}
    <p className="podcast-note">Conteúdo e disponibilidade são dos produtores. As opiniões dos episódios não substituem uma análise própria. Em aparelhos que controlam o volume pelo sistema, use também os botões do dispositivo.</p>
  </section>
}
