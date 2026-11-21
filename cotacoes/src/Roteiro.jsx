// Peças comuns do roteiro das calculadoras de crédito (21/11/2026): 1 Demanda, 2 Encargos, 3 Linha do tempo, 4 Resultado.
// Nasceram no piloto do Capital de Giro. Só apresentação: quem faz a conta é cada calculadora, e aqui chega o número pronto.
import './Roteiro.css'

// Título numerado de um bloco do roteiro.
export const step = (number, text) => <><span className="rt-step">{number}</span> {text}</>

// Linha do tempo da operação. events: [{ label, when, value, note, empty }], em ordem; `empty` marca um momento que não existe
// nesta operação (por exemplo, sem carência). Sem events, mostra o aviso `placeholder`.
export function LinhaDoTempo({ id, number = 3, title = 'Linha do tempo da operação', events, placeholder, className }) {
  return <section className={['rt-timeline', className].filter(Boolean).join(' ')} aria-labelledby={id}>
    <h3 id={id}>{step(number, title)}</h3>
    {events ? <ol>{events.map(event => <li key={event.label} className={event.empty ? 'is-empty' : undefined}>
      <b>{event.label}</b><span>{event.when}</span><strong>{event.value}</strong><small>{event.note}</small>
    </li>)}</ol> : <p className="rt-timeline-empty">{placeholder}</p>}
  </section>
}

// Quadro do resultado: o único com borda laranja. `alert` é o aviso de quando ainda não há resultado.
export function Resultado({ id, number = 4, title = 'Resultado · custo final para o cliente', alert, className, children }) {
  return <aside className={['rt-result', className].filter(Boolean).join(' ')} aria-labelledby={id}>
    <h3 id={id}>{step(number, title)}</h3>
    <div className="rt-result-body">
      {alert && <small className={`rt-alert${alert.warning ? ' is-warning' : ''}`} role={alert.error ? 'alert' : undefined}>{alert.text}</small>}
      {children}
    </div>
  </aside>
}

// As respostas do resultado, uma por pergunta. items: [{ question, value, note, main }]; `main` destaca a resposta principal.
export function Respostas({ items }) {
  return <dl className="rt-answers">{items.map(item => <div key={item.question} className={item.main ? 'rt-answer-main' : undefined}>
    <dt>{item.question}</dt><dd>{item.value}</dd>{item.note && <dd className="rt-answer-note">{item.note}</dd>}
  </div>)}</dl>
}

// Do que é feito o custo: barra de proporção e lista. parts: [{ label, value }], com value numérico (ou vazio sem resultado);
// rows: linhas depois das partes, [{ label, value, kind }], com value já formatado e kind 'total' ou 'muted'.
export function ComposicaoDoCusto({ title = 'Do que é feito o custo', parts, rows = [], format }) {
  const drawn = parts.map((part, index) => ({ ...part, tone: `rt-tone-${index + 1}` }))
  const filled = drawn.filter(part => part.value > 0)
  return <>
    <h4 className="rt-group">{title}</h4>
    {filled.length > 0 && <div className="rt-bar" aria-hidden="true">{filled.map(part =>
      <i key={part.label} className={part.tone} style={{ flexGrow: part.value }} />)}</div>}
    <dl className="rt-parts">
      {drawn.map(part => <div key={part.label}><dt><i className={part.tone} aria-hidden="true" />{part.label}</dt><dd>{format(part.value)}</dd></div>)}
      {rows.map(row => <div key={row.label} className={row.kind ? `rt-${row.kind}` : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  </>
}
