import { useRef, useState } from 'react'
import transcript from './ticPodcastTranscript.txt?raw'
import './SectorPodcast.css'

export const PODCAST_RATES = [1, 1.25, 1.5, 2]
export default function SectorPodcast() {
  const audio = useRef(null)
  const [rate, setRate] = useState(1.25)
  const [duration, setDuration] = useState(null)
  const [failed, setFailed] = useState(false)
  const applyRate = () => {
    if (audio.current) {
      audio.current.defaultPlaybackRate = rate
      audio.current.playbackRate = rate
      audio.current.preservesPitch = true
    }
  }
  const selectRate = event => {
    const next = Number(event.target.value)
    setRate(next)
    if (audio.current) {
      audio.current.defaultPlaybackRate = next
      audio.current.playbackRate = next
    }
  }
  const estimate = duration ? `${Math.floor(duration / rate / 60)} min ${String(Math.round(duration / rate) % 60).padStart(2, '0')} s` : 'cerca de 5 minutos em 1,25×'
  return <section className="sector-podcast" aria-labelledby="tic-podcast-title">
    <div className="sector-podcast-heading"><div><p className="central-kicker">ESCUTE O ESTUDO</p><h4 id="tic-podcast-title">TIC em áudio</h4></div><span className="sector-podcast-badge">Piloto · voz sintética</span></div>
    <p>Negócio, conjuntura, oportunidades, riscos e crédito. Pesquisa de <time dateTime="2026-11-06">06/11/2026</time>; não é uma atualização em tempo real.</p>
    <audio ref={audio} controls preload="metadata" aria-label="Resumo em áudio do estudo de integração de TI" src="./audio/tic-2026-11-06.mp3" onLoadedMetadata={() => { applyRate(); if (Number.isFinite(audio.current?.duration)) setDuration(audio.current.duration) }} onPlay={applyRate} onRateChange={() => { if (PODCAST_RATES.includes(audio.current?.playbackRate)) setRate(audio.current.playbackRate) }} onError={() => setFailed(true)} />
    <div className="sector-podcast-options"><label htmlFor="tic-podcast-speed">Velocidade <select id="tic-podcast-speed" value={rate} onChange={selectRate}>{PODCAST_RATES.map(value => <option key={value} value={value}>{String(value).replace('.', ',')}×{value === 1.25 ? ' · padrão' : ''}</option>)}</select></label><span aria-live="polite">Tempo total nesta velocidade: {estimate}.</span></div>
    {failed && <p role="alert">Não foi possível carregar o áudio. Tente abrir o arquivo ou leia a transcrição abaixo.</p>}
    <p className="central-note">Narração sintética em português brasileiro. Pode haver variações de pronúncia e entonação. Cenários e avaliações são hipóteses analíticas, não recomendações de crédito.</p>
    <details><summary>Ler transcrição completa</summary>{transcript.trim().split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>
    <a className="sector-podcast-download" href="./audio/tic-2026-11-06.mp3" download>Baixar áudio (MP3)</a>
  </section>
}
