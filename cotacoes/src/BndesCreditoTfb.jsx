import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useMemo, useState } from 'react'
import Help from './CalculatorHelp.jsx'
import { createTfbReference } from './bndesTfbReference.js'
import { reconcileCreditoPequenasEmpresas } from './bndesCreditoPequenasEmpresas.js'
import './BndesProfiles.css'

const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = iso => iso.split('-').reverse().join('/')
const pct = value => (100 * value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%'

export function TfbIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5" /></svg>
}

function Metric({ label, value, note, children }) {
  return <div className="fm-kpi"><span className="cx-field-label">{label}<Help title={label}>{children}</Help></span><b>{value}</b>{note && <small>{note}</small>}</div>
}

export default function BndesCreditoTfb({ onBack }) {
  const input = useMemo(createTfbReference, [])
  const result = useMemo(() => reconcileCreditoPequenasEmpresas(input), [input])
  const [view, setView] = useState('payments')
  const interest = result.rows.reduce((sum, row) => sum + row.interestCents, 0)
  const payments = result.cashFlows.slice(1).reduce((sum, row) => sum + row.cashOutCents, 0)
  return <section className="cx bndes-profile calc-standard" aria-labelledby="tfb-heading">
    <h2 id="tfb-heading" className="cx-title"><span className="cx-icon"><TfbIcon /></span>BNDES Crédito Pequenas Empresas · TFB</h2>
    <p className="status">Conferência do exemplo histórico · 34 pagamentos · Não é cotação atual</p>
    <article className="desk-panel cx-panel calc-result-shell">
      <ExpandablePanel title="Caso conferido"><div className="calc-panel-context"><Help title="Escopo da conferência"><p>Este cenário foi montado pelo usuário a partir de cálculos oficiais e fornecido em três imagens em 05/11/2026. Não é um documento emitido por banco. A tela executa o mesmo motor que reconciliou as 34 linhas, sem usar o CET do cabeçalho como alvo.</p><p>É uma conferência desse fluxo, não uma calculadora genérica de contratos. Para outra operação, são necessárias a precisão original da taxa, a âncora da carência, o calendário e os encargos aplicáveis. Essas condições não são transferidas para Finame/TFC.</p></Help></div>
      <dl className="bndes-facts">
        <div><dt>Valor financiado</dt><dd>{brl(input.principalCents)}</dd></div>
        <div><dt>Liberação</dt><dd>{date(input.releaseDate)}</dd></div>
        <div><dt>Prazo / carência</dt><dd>36 / 3 meses</dd></div>
        <div><dt>Juros / amortização</dt><dd>Trimestral na carência / SAC mensal</dd></div>
        <div><dt>Taxa precisa utilizada</dt><dd>17,5402% a.a. · inferida</dd></div>
        <div><dt>Âncora da carência</dt><dd>15/11/2026 · inferida</dd></div>
      </dl>
      <p className="cx-hint cx-pad">As parcelas e o CET são calculados abaixo. Taxa precisa, âncora e calendário deste exemplo não são condições padrão para novas operações.</p>
    </ExpandablePanel>
</article>
    {!result.ok ? <p role="alert" className="status">{result.errors[0].message}</p> : <>
      <article className="desk-panel cx-panel calc-result-shell" aria-labelledby="tfb-result">
        <span id="tfb-result" className="sr-only">Resultado do fluxo</span><ExpandablePanel title="Resultado do fluxo"><div className="calc-panel-context"><small>CET matemático · não é certificação contratual</small></div>
        <div className="fm-grade">
          <Metric label="CET do fluxo" value={pct(result.cet.calculatedAnnualRateDecimal)} note="20,16% a.a. com duas casas"><p>Taxa que iguala o recebimento líquido aos 34 pagamentos, por dias corridos/365, incluindo o IOF retido e a tarifa na primeira cobrança. O CET informado originalmente foi desconsiderado. O cálculo matemático não confirma outros encargos de uma operação real.</p></Metric>
          <Metric label="Recebimento líquido" value={brl(result.netDisbursementCents)} note="em 26/10/2026">Valor financiado menos o IOF retido na liberação, uma única vez.</Metric>
          <Metric label="IOF retido" value={brl(result.iof.totalCents)} note="R$ 0,00 nas parcelas"><p>Memória do exemplo: adicional de 0,38% mais 0,0082% por dia corrido sobre cada amortização, limitado a 365 dias. O imposto não é cobrado de novo nos vencimentos. O enquadramento fiscal de outra operação precisa ser confirmado.</p></Metric>
          <Metric label="Juros das parcelas" value={brl(interest)} note="sem a tarifa">Soma dos juros das 34 linhas. O total impresso sob “juros” inclui mais R$ 2.200,00, exatamente o valor da tarifa.</Metric>
          <Metric label="Primeira cobrança" value={brl(result.firstCashOutCents)} note="15/02/2027 · inclui tarifa">Juros de R$ 152.520,44 mais tarifa de R$ 2.200,00. Não há amortização de principal na primeira cobrança.</Metric>
          <Metric label="Pagamentos após a liberação" value={brl(payments)} note="parcelas + tarifa, uma vez">R$ 3.842.970,58 de parcelas mais R$ 2.200,00 de tarifa. O IOF já reduziu o recebimento líquido e não deve ser somado novamente ao fluxo do CET.</Metric>
        </div>
      </ExpandablePanel>
</article>
      <article className="desk-panel cx-panel calc-result-shell">
        <ExpandablePanel title="Memória de cálculo"><div className="calc-panel-context"><Help title="Datas, centavos e base dos juros"><p>Juros gerados com dias corridos e denominador 365 ou 366 conforme o ano civil. Isso é diferente da base fixa 365 do CET. A primeira cobrança cobre 112 dias desde a liberação.</p><p>Amortização SAC: saldo dividido pelo número de amortizações restantes, arredondado a centavos em cada evento. As linhas 29, 31 e 33 amortizam R$ 90.909,10; as demais, R$ 90.909,09. O saldo final é zero.</p><p>Os deslocamentos das datas foram observados nas imagens. O calendário é parcial e não certifica todos os feriados bancários.</p></Help>
          <div className="seg" role="group" aria-label="Visão do fluxo TFB"><button type="button" aria-pressed={view === 'payments'} onClick={() => setView('payments')}>Parcelas</button><button type="button" aria-pressed={view === 'cash'} onClick={() => setView('cash')}>Caixa e encargos</button></div>
        </div>
        <div className="cx-wrap" role="region" aria-label={view === 'payments' ? '34 parcelas TFB conferidas' : 'Fluxo de caixa TFB com IOF e tarifa'} tabIndex="0">
          {view === 'payments' ? <table className="cx-matrix"><caption>34 linhas do exemplo · valores em reais</caption><thead><tr><th>Nº</th><th>Vencimento</th><th>Dias corridos</th><th>Saldo inicial</th><th>Juros</th><th>Amortização</th><th>Parcela</th><th>Saldo final</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.number}><th scope="row">{row.number}{row.inGrace ? ' · carência' : ''}</th><td>{date(row.date)}</td><td>{row.days}</td>{['openingCents', 'interestCents', 'principalCents', 'paymentCents', 'closingCents'].map(key => <td key={key}>{brl(row[key])}</td>)}</tr>)}</tbody></table> : <table className="cx-matrix"><caption>Recebimento positivo e pagamentos negativos para calcular o CET</caption><thead><tr><th>Evento</th><th>Data</th><th>Crédito bruto</th><th>IOF retido</th><th>Parcela</th><th>Tarifa</th><th>Caixa líquido</th></tr></thead><tbody>{result.cashFlows.map((flow, index) => <tr key={flow.date}><th scope="row">{index === 0 ? 'Liberação' : index}</th><td>{date(flow.date)}</td>{[flow.creditCents, flow.iofPaidCents, flow.principalCents + flow.interestCents, flow.feeCents, flow.netCashCents].map((value, i) => <td key={i}>{brl(value)}</td>)}</tr>)}</tbody></table>}
        </div>
      </ExpandablePanel>
</article>
      <details className="bndes-limits"><summary>Premissas, fontes e limites</summary><ul>{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul><p>Fonte do exemplo: três imagens fornecidas pelo usuário em 05/11/2026. Nenhum dado identificador foi incorporado.</p><p><a href="https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/01-22Cir13-Anexo-I-Procedimentos-Operacionais.pdf" target="_blank" rel="noreferrer">BNDES · Anexo I, itens 5.2 a 5.6</a> · <a href="https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf" target="_blank" rel="noreferrer">CMN 4.881 · fórmula do CET</a></p></details>
    </>}
  </section>
}
