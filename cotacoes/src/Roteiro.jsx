// Peças comuns do roteiro das calculadoras de crédito (21/11/2026): 1 Demanda, 2 Encargos, 3 Resultado.
// A linha do tempo saiu das sete calculadoras a pedido do Fernando (21/11/2026).
// Nasceram no piloto do Capital de Giro. Só apresentação: quem faz a conta é cada calculadora, e aqui chega o número pronto.
import { sobraDeCentavos } from './centavosDaTela.js'
import './Roteiro.css'

// Título numerado de um bloco do roteiro.
export const step = (number, text) => <><span className="rt-step">{number}</span> {text}</>

// Quadro do resultado: o único com borda laranja. `alert` é o aviso de quando ainda não há resultado.
export function Resultado({ id, number = 3, title = 'Resultado · custo final para o cliente', alert, className, children }) {
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
// total: { label, value } com value numérico, a linha do total; rows: linhas depois dele, [{ label, value, kind }], com value
// já formatado e kind 'total' ou 'muted'.
// Centavos: cada parte é arredondada sozinha ao aparecer. Quando as partes, como aparecem, não somam o total como aparece,
// uma linha discreta explica a diferença. Nenhum valor é ajustado.
export function ComposicaoDoCusto({ title = 'Do que é feito o custo', parts, total, rows = [], format }) {
  const drawn = parts.map((part, index) => ({ ...part, tone: `rt-tone-${index + 1}` }))
  const filled = drawn.filter(part => part.value > 0)
  const complete = Number.isFinite(total?.value) && parts.every(part => Number.isFinite(part.value))
  const gap = complete ? sobraDeCentavos(parts.map(part => part.value), total.value) : null
  return <>
    <h4 className="rt-group">{title}</h4>
    {filled.length > 0 && <div className="rt-bar" aria-hidden="true">{filled.map(part =>
      <i key={part.label} className={part.tone} style={{ flexGrow: part.value }} />)}</div>}
    <dl className="rt-parts">
      {drawn.map(part => <div key={part.label}><dt><i className={part.tone} aria-hidden="true" />{part.label}</dt><dd>{format(part.value)}</dd></div>)}
      {total && <div className="rt-total"><dt>{total.label}</dt><dd>{format(total.value)}</dd></div>}
      {gap && <div className="rt-muted"><dt>Arredondamento: as partes somam {format(gap.sum)}; a diferença vem de arredondar cada parte em centavos</dt><dd>{format(gap.diff)}</dd></div>}
      {rows.map(row => <div key={row.label} className={row.kind ? `rt-${row.kind}` : undefined}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  </>
}
