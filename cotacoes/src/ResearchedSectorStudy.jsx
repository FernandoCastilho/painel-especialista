import { StudyTable, StudyMethod } from './StudyParts.jsx'
import { useRef, useState } from 'react'
import './SectorStudy.css'
import KnowledgeMap from './KnowledgeMap.jsx'
import SectorValueChain from './SectorValueChain.jsx'
import { publicAgencySources } from './sectorSourceVisibility.js'
import './ResearchedSectorStudy.css'
import { chartScale, barPosition, transcriptParagraphs, durationLabel } from './sectorStudies/presentation.js'

const link = source => <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>

export function ResearchChart({ chart }) {
  const [seriesIndex, setSeriesIndex] = useState(0)
  const series = chart.series[seriesIndex]
  const scale = chartScale(chart)
  return <section className="study-chart" aria-labelledby={`chart-${chart.id}`}>
    <h4 id={`chart-${chart.id}`}>{chart.title}</h4>
    {chart.series.length > 1 && <label>Série<select value={seriesIndex} onChange={event => setSeriesIndex(Number(event.target.value))}>{chart.series.map((item, index) => <option key={item.label} value={index}>{item.label}</option>)}</select></label>}
    <p>{series.label} · {chart.unit}. {chart.scope}</p>
    {scale.negative && <p className="central-note">Eixo bipolar: valores negativos à esquerda do zero; positivos à direita.</p>}
    <div className="research-bar-axis" aria-hidden="true"><span>{scale.negative ? (-scale.maximum).toLocaleString('pt-BR') : '0'}</span>{scale.negative && <span>0</span>}<span>{scale.maximum.toLocaleString('pt-BR', { signDisplay: scale.negative ? 'always' : 'auto' })}</span></div>
    <div className="study-bars" role="img" aria-label={`${chart.title}. ${series.label}. Valores com sinal na tabela abaixo.`}>{chart.years.map((year, index) => <div className="study-bar-row research-bar-row" key={year}><span>{year}</span><span className="study-bar-track research-bar-track"><span className="research-bar-zero" style={{ left: `${scale.zero}%` }} aria-hidden="true" /><span className={`study-bar research-bar${series.values[index] < 0 ? ' research-bar-negative' : ''}`} style={barPosition(series.values[index], scale)} /></span><strong>{series.values[index].toLocaleString('pt-BR', { signDisplay: scale.negative ? 'exceptZero' : 'auto' })}</strong></div>)}</div>
    <details><summary>Ver todos os dados e método</summary><div className="study-table-wrap"><table><caption>{chart.title} · {chart.unit}</caption><thead><tr><th scope="col">{chart.categoryLabel || 'Ano'}</th>{chart.series.map(item => <th scope="col" key={item.label}>{item.label}</th>)}</tr></thead><tbody>{chart.years.map((year, index) => <tr key={year}><th scope="row">{year}</th>{chart.series.map(item => <td key={item.label}>{item.values[index].toLocaleString('pt-BR')}</td>)}</tr>)}</tbody></table></div><p>{chart.method}</p></details>
    <p className="central-note">{publicAgencySources([chart.source]).length > 0 && <>Fonte: {link(chart.source)} · </>}Referência: {chart.period} · consulta: 06/11/2026.</p>
  </section>
}

export default function ResearchedSectorStudy({ study, goto }) {
  const prefix = `sector-${study.group}-${study.topicIndex}`
  return <article className="sector-study" aria-labelledby={`${prefix}-title`}>
    <p className="central-kicker">ESTUDO SETORIAL · PESQUISA DE MERCADO</p><h3 id={`${prefix}-title`}>{study.title}</h3>
    <p className="central-note">Pesquisa pública realizada em {study.reviewedAt ? <time dateTime={study.reviewedAt}>{study.reviewedAt.split('-').reverse().join('/')}</time> : 'data não informada'}. Dados têm períodos próprios; atualização não é automática.</p>
    {study.reviewStatus !== 'approved' && <p role="status" className="study-warning"><strong>NÃO CONFERIDO · revisão independente pendente. Versão de trabalho, não usar como estudo final.</strong></p>}
    <section className="study-summary" aria-labelledby={`${prefix}-summary`}><p className="central-kicker">RESUMO EXECUTIVO</p><h4 id={`${prefix}-summary`} className="sr-only">Resumo executivo</h4>{study.summary.map((text, index) => <p key={text} className={index === 0 ? 'study-summary-lead' : undefined}>{text}</p>)}</section>
    <details className="study-section study-canvas-details">
      <summary>Perguntas para conversar com a empresa ({study.canvasQuestions.length})</summary>
      <p className="study-canvas-intro">Roteiro inspirado no Business Model Canvas. Peça números e um contrato real para sustentar as respostas.</p>
      <ol className="study-canvas-questions">{study.canvasQuestions.map(item => <li key={item.dimension}><strong>{item.dimension}</strong><p>{item.question}</p></li>)}</ol>
    </details>
    <KnowledgeMap compact key={`${study.group}-${study.topicIndex}`} goto={goto} sectorContext={{ group: study.group, topicIndex: study.topicIndex, study }} />
    <ResearchAudio study={study} />
    {study.diagram?.nodes?.length > 0 && <SectorValueChain diagram={study.diagram} title={study.title} />}
    {study.sections.map(section => <details className="study-section" id={`${prefix}-${section.id}`} key={section.id} open={section.id === 'negocio' || section.id === 'indicadores' || undefined}><summary>{section.title}</summary>{section.paragraphs?.map(text => <p key={text}>{text}</p>)}<StudyTable section={section} />{section.bullets && <ul>{section.bullets.map(text => <li key={text}>{text}</li>)}</ul>}{publicAgencySources(section.sources).length > 0 && <p className="central-note">Fontes: {publicAgencySources(section.sources).map((source, index) => <span key={source.url}>{index > 0 ? ' · ' : ''}{link(source)}</span>)}</p>}</details>)}
    {study.charts.length > 0 && <section aria-label="Indicadores e séries históricas">{study.charts.map(chart => <ResearchChart key={chart.id} chart={chart} />)}</section>}
    <StudyMethod study={study} />
  </article>
}

function ResearchAudio({ study }) {
  const audioRef = useRef(null)
  const [failed, setFailed] = useState(false)
  const [rate, setRate] = useState(1.25)
  const [duration, setDuration] = useState(study.audio?.durationSeconds || null)
  const applyRate = (next = rate) => {
    if (!audioRef.current) return
    audioRef.current.defaultPlaybackRate = next
    audioRef.current.playbackRate = next
    audioRef.current.preservesPitch = true
  }
  return <section className="study-chart" aria-label="Síntese narrada e transcrição">
    <h4>Síntese do estudo</h4>
    {study.audio?.src && !failed ? <>
      <p className="central-note">Voz sintética em português brasileiro. Pode haver variações de pronúncia e entonação.</p>
      <audio ref={audioRef} controls preload="metadata" src={study.audio.src} aria-label={`Síntese em áudio: ${study.title}`} onError={() => setFailed(true)} onLoadedMetadata={() => { applyRate(); if (Number.isFinite(audioRef.current?.duration)) setDuration(audioRef.current.duration) }} onPlay={() => applyRate()} onRateChange={() => { if ([0.75, 1, 1.25, 1.5, 2].includes(audioRef.current?.playbackRate)) setRate(audioRef.current.playbackRate) }} />
      <label>Velocidade<select value={rate} onChange={event => { const next = Number(event.target.value); setRate(next); applyRate(next) }}>{[0.75, 1, 1.25, 1.5, 2].map(value => <option key={value} value={value}>{String(value).replace('.', ',')}×{value === 1.25 ? ' · padrão' : ''}</option>)}</select></label>
      <p aria-live="polite">Tempo total nesta velocidade: {durationLabel(duration, rate)}.</p>
    </> : <p className="central-note">{failed ? 'Não foi possível carregar o arquivo de áudio.' : 'Áudio ainda não disponível para este estudo.'} A síntese em texto está disponível abaixo.</p>}
    <details><summary>{study.audio?.src ? 'Ler transcrição' : 'Ler síntese em texto'}</summary>{transcriptParagraphs(study.transcript).map((text, index) => <p key={index}>{text}</p>)}</details>
  </section>
}
