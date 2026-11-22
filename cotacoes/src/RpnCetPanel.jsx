import { useId, useState } from 'react'
import { calculatePastedCet } from './rpnPastedCet.mjs'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const example = 'Vencimento\tValor\n05/02/2027\t520,00\n08/03/2027\t540,00'

export default function RpnCetPanel() {
  const id = useId()
  const [releaseDate, setReleaseDate] = useState('')
  const [net, setNet] = useState('')
  const [costs, setCosts] = useState('')
  const [payments, setPayments] = useState('')
  const result = payments.trim() ? calculatePastedCet({ releaseDate, net, costs, payments }) : null

  return <details className="rpn-reference-panel rpn-cet">
    <summary>CET · Cole os vencimentos do Excel</summary>
    <p id={id + '-scope'}>Simulação em reais, com uma liberação e pagamentos informados. Cole duas colunas: vencimento e valor a pagar. O resultado muda automaticamente.</p>
    <div className="rpn-cet-fields">
      <label>Data da liberação<input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} /></label>
      <label>Valor líquido liberado (R$)<input inputMode="decimal" value={net} onChange={e => setNet(e.target.value)} placeholder="1.000,00" /></label>
      <label>Outros custos na liberação (R$)<input inputMode="decimal" value={costs} onChange={e => setCosts(e.target.value)} placeholder="Opcional" aria-describedby={id + '-costs'} /></label>
    </div>
    <p id={id + '-costs'}>Some TAC, fee e outros encargos pagos no dia da liberação que ainda não estejam descontados do líquido nem nas parcelas. Custos pagos depois entram nas linhas de suas datas.</p>
    <label className="rpn-cet-paste">Vencimentos e valores (R$)
      <textarea rows={5} spellCheck={false} value={payments} onChange={e => setPayments(e.target.value)} placeholder={example} aria-describedby={id + '-scope'} />
    </label>
    <div role="status" aria-live="polite" className="rpn-cet-result">
      {result?.ok ? <><strong>{percent.format(result.annualRate)} a.a.</strong>
        <span>{result.count} pagamentos · Total a pagar {currency.format(result.total)} · Líquido após custos {currency.format(result.netAfterCosts)}</span></> : <span>{result?.error ?? 'O CET aparece aqui quando os dados estiverem completos.'}</span>}
    </div>
    <p>O cálculo usa dias corridos, base de 365 dias e somente os valores informados. Não projeta CDI, variação cambial ou outros indexadores. Não substitui o demonstrativo da instituição. Consulte a Resolução CMN 4.881 em Configurações → Base de dados.</p>
  </details>
}
