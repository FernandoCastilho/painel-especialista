import { ECONOMIA_REVIEWED_AT, economiaDate, economiaReadings } from './economiaContexto.js'
import './EconomiaContexto.css'

export default function EconomiaContexto() {
  return <section className="economia-contexto" aria-labelledby="economia-contexto-title">
    <header>
      <h2 id="economia-contexto-title">Economia em contexto</h2>
      <p>Leituras da editoria Economia do Brazil Journal, com perguntas do Painel para visitas e comitês de crédito.</p>
      <small>Seleção manual conferida em <time dateTime={ECONOMIA_REVIEWED_AT}>{economiaDate(ECONOMIA_REVIEWED_AT)}</time>. Não é um feed em tempo real nem se limita às manchetes dos últimos cinco dias.</small>
    </header>
    <ul className="economia-contexto-grid">
      {economiaReadings().map(item => <li key={item.id}>
        <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}<span className="economia-link-hint">Ler no Brazil Journal ↗</span></a></h3>
        <p className="economia-contexto-meta">{item.kind} · <time dateTime={item.publishedAt}>{economiaDate(item.publishedAt)}</time></p>
        <p><strong>Para a conversa:</strong> {item.question}</p>
        {item.note && <small>{item.note}</small>}
      </li>)}
    </ul>
    <p className="economia-contexto-note">As perguntas são do Painel, não recomendações do veículo. As matérias abrem na origem; não substituem fontes oficiais de taxas, legislação ou análise de crédito.</p>
  </section>
}
