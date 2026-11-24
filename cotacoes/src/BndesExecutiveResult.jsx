// Apenas apresentação: recebe taxas e valores já calculados e formatados pela modalidade.
function Facts({ items, className = '' }) {
  return <dl className={`be-facts ${className}`}>{items.filter(Boolean).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
export default function BndesExecutiveResult({ annualCet, monthlyCet, cetLabel = 'CET estimado', total, tax, equivalent, cdiReference, reference, conditions, installments, expenses, extraMetrics = [], help, totalHelp }) {
  return <div className="be-grid">
    <section className="be-financial" aria-label="Resultado financeiro">
      <h4>Resultado financeiro</h4>
      <div className="be-answer">
        <div className="be-cet"><span>{cetLabel}{help}</span><strong>{annualCet}</strong>{monthlyCet && <small>{monthlyCet}</small>}</div>
        <div className="be-total"><span>Total estimado a pagar{totalHelp}</span><strong>{total}</strong><small>Principal, juros e despesas informadas</small></div>
      </div>
      <Facts items={[[ 'Taxa final', tax ], ...extraMetrics]} />
      {equivalent && <div className="be-equivalent"><span>Equivalência em CDI</span><strong>{equivalent}</strong>{cdiReference && <small>{cdiReference}</small>}</div>}
      <h5>Parcelas</h5><Facts items={installments} className="be-installments" />
      <h5>Juros e despesas</h5><Facts items={expenses} />
    </section>
    <section className="be-conditions" aria-label="Condições da operação">
      <h4>Condições da operação</h4>
      <div className="be-reference">
        <span>Indexador utilizado</span><strong>{reference.name}</strong>
        {reference.code && <small>Série {reference.code}</small>}
        <Facts items={[[ 'Taxa de referência', reference.rate ]]} />
        <p>{reference.manual ? 'Taxa manual' : reference.source}{reference.date && <> · referência do painel em {reference.date}</>}</p>
        {reference.manual && <small>Taxa informada para esta simulação; a data identifica a fonte do painel.</small>}
        {reference.retained && <p className="be-retained" role="status">Referência retida · confira a atualização em Taxas e históricos.</p>}
      </div>
      <h5>Dados da operação</h5><Facts items={conditions} />
    </section>
  </div>
}
