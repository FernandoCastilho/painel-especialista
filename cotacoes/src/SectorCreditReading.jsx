import { SECTOR_HIGHLIGHTS } from './sectorHighlights.js'

export default function SectorCreditReading({ group }) {
  const highlight = SECTOR_HIGHLIGHTS[group]
  if (!highlight) return null
  return <details className="study-section">
    <summary>Leitura para comitê de crédito</summary>
    <p>{highlight.credit}</p>
    <p>Relacione o que gera caixa, o que pode impedir o pagamento e quais documentos sustentam a conclusão. Discuta também o que acontece se vendas caírem, custos subirem ou recebimentos atrasarem.</p>
    <p className="central-note">Roteiro setorial educativo. Não atribui nota de risco nem aprova crédito; exige análise específica da empresa e do subsetor.</p>
  </details>
}
