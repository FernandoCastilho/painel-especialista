import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { initialAlongamentoForm, parseAlongamentoForm, estimateNcg, parseAlongamentoDecimal, ALONGAMENTO_SOURCES } from './alongamento.js'
import { cgToday } from './contaGarantida.js'
import { parseMoneyInput } from './moneyInput.js'
import FluxoPagamentos from './FluxoPagamentos.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import { EnvelopeEml } from './EmailEnvelope.jsx'
import { alongamentoEml } from './contaGarantidaEml.js'
import { linhasDoFluxoAlongamento, prazoDoGiro } from './alongamentoFluxo.js'
import './ComparativoAlongamento.css'

const brl = value => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateLabel = value => value.split('-').reverse().join('/')
const signed = value => `${value > 0 ? '+' : ''}${brl(value)}`
const ncgInitial = { mode: 'balances', receivables: '', inventory: '', payables: '', sales: '', cost: '', purchases: '', pmr: '', pme: '', pmp: '' }

export default function ComparativoAlongamento({ ativo = true } = {}) {
  const [form, setForm] = useState(() => initialAlongamentoForm(cgToday()))
  const [ncg, setNcg] = useState(ncgInitial)
  const [page, setPage] = useState(0)
  const [visited, setVisited] = useState({})
  const { errors, result } = parseAlongamentoForm(form)
  const set = (key, value) => { setForm(old => ({ ...old, [key]: value })); setVisited(old => ({ ...old, [key]: true })); setPage(0) }
  const showError = key => !!errors[key] && (visited[key] || !!String(form[key] ?? '').trim())
  const control = key => ({ id: `along-${key}`, 'aria-invalid': showError(key), 'aria-describedby': showError(key) ? `along-${key}-error` : undefined, onBlur: () => setVisited(old => ({ ...old, [key]: true })) })
  const field = (key, label, content, help) => <div className="cx-field" key={key}><div className="cx-field-label"><label htmlFor={`along-${key}`}>{label}</label><CalculatorHelp title={label}><p>{help}</p></CalculatorHelp></div>{content}{showError(key) && <p id={`along-${key}-error`} className="cx-error">{errors[key]}</p>}</div>
  const money = (key, label, help) => field(key, label, <MoneyInput {...control(key)} value={form[key]} onChange={value => set(key, value)} />, help)
  const input = (key, label, help, type = 'text') => field(key, label, <input {...control(key)} type={type} inputMode={type === 'text' ? 'decimal' : undefined} value={form[key]} onChange={e => set(key, e.target.value)} />, help)
  const select = (key, label, values, help) => field(key, label, <select {...control(key)} value={form[key]} onChange={e => set(key, e.target.value)}>{values.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select>, help)

  const ncgKeys = ncg.mode === 'balances' ? ['receivables', 'inventory', 'payables'] : ['sales', 'pmr', 'cost', 'pme', 'purchases', 'pmp']
  const ncgErrors = {}, ncgParams = { mode: ncg.mode }
  for (const key of ncgKeys) {
    const decimal = ['pmr', 'pme', 'pmp'].includes(key)
    const parsed = decimal ? { ok: parseAlongamentoDecimal(ncg[key]) != null, value: parseAlongamentoDecimal(ncg[key]) } : parseMoneyInput(ncg[key])
    if (!parsed.ok || parsed.value < 0 || parsed.value > (decimal ? 3660 : 1e12)) ncgErrors[key] = decimal ? 'Informe de 0 a 3.660 dias.' : 'Informe um valor de 0 a R$ 1 trilhão.'
    else ncgParams[key] = parsed.value
  }
  const ncgResult = Object.keys(ncgErrors).length ? null : estimateNcg(ncgParams)
  const ncgLabels = { receivables: 'Clientes a receber (R$)', inventory: 'Estoque a custo (R$)', payables: 'Fornecedores a pagar (R$)', sales: 'Vendas mensais (R$)', pmr: 'Prazo médio de recebimento (dias)', cost: 'Custo mensal das vendas (R$)', pme: 'Prazo médio de estoque (dias)', purchases: 'Compras mensais (R$)', pmp: 'Prazo médio de pagamento (dias)' }
  const months = result?.ok ? result.months : []
  const pages = Math.ceil(months.length / 12)
  const safePage = Math.min(page, Math.max(0, pages - 1))

  return <div className="alongamento" aria-label="Comparativo de conta garantida e giro parcelado">
    <div className="along-entry-grid">
      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>1. Conta garantida atual</h3><CalculatorHelp title="Conta garantida atual"><p>Projeção a partir do saldo médio utilizado. O saldo é considerado constante até o fim da comparação, sem novos saques. Juros e IOF são pagos à parte. Não recria o extrato nem cobra novamente o IOF adicional sobre um saldo já existente.</p><p>Para uso eventual ou saldo muito variável, confira também os lançamentos por dia. A comparação não recomenda alongar automaticamente todo o limite contratado.</p></CalculatorHelp></header>
        <div className="cx-form">
          {money('balance', 'Saldo médio utilizado (R$)', 'Use o saldo médio de todos os dias do período, incluindo dias sem utilização. Na projeção, esse valor será mantido constante. Não informe o limite disponível.')}
          {input('cgRate', 'Taxa da conta garantida (% a.m.)', 'Taxa mensal percentual do contrato, apurada proporcionalmente por dias corridos com divisor 30 e sem capitalização.')}
          {input('start', 'Data da comparação', 'Data da nova liberação e da quitação parcial ou total da conta garantida. Só custos futuros entram na comparação.', 'date')}
          {select('profile', 'Enquadramento do IOF', [['pj', 'Pessoa jurídica — geral'], ['simples', 'Simples Nacional / MEI']], 'Alíquotas automáticas conforme legislação e valor de cada operação. O saldo médio não define o valor contratual da conta garantida. Não há campo de alíquota manual.')}
          {form.profile === 'simples' && <>
            {money('operationValueCG', 'Valor contratado da conta garantida (R$)', 'Valor total previsto no contrato, necessário para avaliar o limite de R$ 30 mil. Acima dele aplica-se a alíquota geral. A quitação parcial não muda esse enquadramento.')}
            <div className="cx-field along-check"><label htmlFor="along-eligible"><input {...control('eligible')} type="checkbox" checked={form.eligible} onChange={e => set('eligible', e.target.checked)} />Confirmo o enquadramento e a documentação do Simples/MEI.</label>{errors.eligible && <p id="along-eligible-error" className="cx-error">{errors.eligible}</p>}</div>
          </>}
        </div>
      </article>
      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>2. Giro parcelado</h3><CalculatorHelp title="Giro parcelado"><p>O valor informado quita total ou parcialmente a conta garantida. IOF e tarifa são pagos com recursos próprios no início e não reduzem o valor disponível para a quitação. O saldo que permanecer na conta garantida continua gerando encargos.</p><p>Price tem parcelas fixas; SAC tem amortização constante e parcelas decrescentes. Em carência, os juros do giro são capitalizados mensalmente. A primeira parcela vence no aniversário mensal após a carência. O prazo de amortização não inclui os meses de carência.</p></CalculatorHelp></header>
        <div className="cx-form">
          {money('amount', 'Valor para substituir a conta garantida (R$)', 'Valor líquido aplicado na quitação, limitado ao saldo médio informado. IOF e tarifa são pagos à parte, no início.')}
          {input('loanRate', 'Taxa do giro parcelado (% a.m.)', 'Taxa efetiva mensal da proposta. Informe zero apenas se houver operação sem juros. Campo vazio não equivale a zero.')}
          {input('n', 'Quantidade de parcelas', 'Quantidade de parcelas mensais após a carência. O prazo total soma carência e amortização.')}
          {select('system', 'Sistema de amortização', [['price', 'Price — fixas'], ['sac', 'SAC — decrescentes']], 'A parcela contém juros e devolução do principal. Amortização não é custo financeiro.')}
          {input('graceMonths', 'Carência (meses)', 'Zero significa primeira parcela após um mês. Com carência, não há parcela do giro nos meses de carência e os juros são incorporados ao seu saldo. Os encargos da conta garantida residual continuam pagos à parte.')}
          {money('fee', 'Tarifa da nova operação (R$)', 'Tarifa paga com recursos próprios na contratação. Zero significa ausência de tarifa. Não é financiada; confira outros custos da proposta antes de contratar.')}
        </div>
      </article>
    </div>

    <article className="desk-panel cx-panel">
      <header className="cx-heading"><h3>3. Capacidade de pagamento <span className="along-optional">opcional</span></h3><CalculatorHelp title="Capacidade de pagamento"><p>Informe a sobra mensal de caixa depois de operação, impostos, retiradas e investimentos necessários e pagamentos das demais dívidas, antes dos encargos de toda a conta garantida comparada e das novas parcelas. Considere os meses mais fracos. Lucro contábil ou EBITDA não são automaticamente caixa disponível.</p><p>A sobra é mantida constante nesta estimativa. Ela não comprova caixa disponível no dia da contratação para pagar IOF e tarifa. Se a parcela não couber, a reutilização do rotativo pode anular a economia; esse novo uso não está presumido na projeção.</p></CalculatorHelp></header>
      <div className="cx-form">{money('cashAvailable', 'Caixa mensal disponível antes destas operações (R$)', 'Opcional. Deixe vazio se não souber; sem esse dado não avaliamos capacidade de pagamento. Use a sobra após operação, impostos, demais dívidas e saídas necessárias.')}</div>
    </article>

    {!result?.ok && <p className="cg-notice" role="status">Preencha os dados da conta garantida e da proposta para comparar.</p>}
    {errors.calculation && <p className="cx-error" role="alert">{errors.calculation}</p>}
    {result && !result.ok && <p className="cx-error" role="alert">{result.error}</p>}
    {result?.ok && <article className="desk-panel cx-panel along-results" aria-labelledby="along-result-title">
      <header className="cx-heading"><h3 id="along-result-title">Comparação no mesmo horizonte</h3><EnvelopeEml label="Baixar e-mail da comparação para o Outlook" gerar={() => alongamentoEml({ result, form, valor: parseMoneyInput(form.amount).value })} /><CalculatorHelp title="Como interpretar a comparação"><p>Os cenários cobrem o mesmo saldo inicial até a última parcela do giro. Economia de encargos inclui juros e IOF, mais tarifa no giro. A diferença também reflete a redução do principal no parcelado; não é economia atribuível apenas à taxa.</p><p>Na variação mensal, um valor positivo indica aumento do desembolso; negativo indica redução. Desembolso inclui amortização. Dívida final é mostrada separadamente e não é somada aos encargos. Durante a carência os juros incorporados ao giro aparecem no custo financeiro, mas só saem do caixa nas parcelas. A conta garantida mantém o saldo não substituído; sem novos saques ou vencimento antecipado do limite.</p></CalculatorHelp></header>
      <p className="cx-hint cx-pad">{dateLabel(result.start)} a {dateLabel(result.end)} · {result.horizonDays} dias · sem novas utilizações do rotativo</p>
      <div className="along-kpis">
        <div><span>{result.savings >= 0 ? 'Economia estimada de encargos' : 'Aumento estimado de encargos'}</span><strong>{brl(Math.abs(result.savings))}</strong><small>Em todo o horizonte, com IOF e tarifa</small></div>
        <div><span>Variação do desembolso mensal</span><strong>{signed(result.monthlyDelta)}</strong><small>No primeiro mês com parcela, incluindo CG residual</small></div>
        <div><span>Dívida ao final com o alongamento</span><strong>{brl(result.alternative.finalDebt)}</strong><small>Se mantiver a CG: {brl(result.baseline.finalDebt)}</small></div>
      </div>
      <div className="cx-wrap" role="region" aria-label="Comparação dos custos, pagamentos e dívida" tabIndex={0}><table className="cx-matrix along-summary"><thead><tr><th scope="col">Indicador</th><th scope="col">Manter a conta garantida</th><th scope="col">Giro + conta garantida residual</th></tr></thead><tbody>
        {[
          ['Juros no horizonte', result.baseline.interest, result.alternative.interest],
          ['IOF futuro', result.baseline.iof, result.alternative.iof],
          ['Tarifa da nova operação', 0, result.loan.fee],
          ['Custo financeiro total', result.baseline.cost, result.alternative.cost],
          ['Total de desembolsos', result.baseline.cashOut, result.alternative.cashOut],
          ['Dívida restante ao final', result.baseline.finalDebt, result.alternative.finalDebt],
        ].map(([label, before, after]) => <tr key={label}><th scope="row">{label}</th><td>{brl(before)}</td><td>{brl(after)}</td></tr>)}
      </tbody></table></div>
      <div className="along-cash-summary">
        <div><span>Primeira parcela do giro</span><b>{brl(result.loan.firstInstallment)}</b></div>
        <div><span>IOF + tarifa pagos no início</span><b>{brl(result.loan.upfront)}</b></div>
      </div>
      {result.cashAssessment ? <p className={`cg-notice ${result.cashAssessment.fits ? '' : 'along-alert'}`} role="status">{result.cashAssessment.fits ? `As parcelas e a conta garantida residual cabem na sobra informada. Menor folga mensal: ${brl(result.cashAssessment.minSurplus)}.` : `Em pelo menos um mês faltam ${brl(Math.max(0, -result.cashAssessment.minSurplus))} para pagar a parcela e a conta garantida residual. Há risco de reutilizar o limite.`} Verifique também caixa para os {brl(result.loan.upfront)} de custos iniciais.</p> : <p className="cg-notice">Capacidade de pagamento não avaliada: informe o caixa mensal disponível. Custos iniciais exigem caixa próprio.</p>}
      <details className="along-details"><summary>Evolução mensal dos pagamentos e da dívida</summary>
        <div className="cx-wrap" role="region" aria-label="Evolução mensal da comparação" tabIndex={0}><table className="cx-matrix along-schedule"><thead><tr><th scope="col">Vencimento</th><th scope="col">Manter CG: encargos</th><th scope="col">Parcela do giro</th><th scope="col">Juros do giro</th><th scope="col">Amortização</th><th scope="col">CG residual: encargos</th><th scope="col">Desembolso combinado</th><th scope="col">Dívida combinada</th></tr></thead><tbody>{months.slice(safePage * 12, safePage * 12 + 12).map(month => <tr key={month.number}><th scope="row">{dateLabel(month.date)}{month.grace && <small>Carência</small>}</th>{[month.baselineCost, month.installment, month.loanInterest, month.amortization, month.residualCost, month.cashOut, month.remainingLoan + month.remainingCG].map((value, index) => <td key={index}>{brl(value)}</td>)}</tr>)}</tbody></table></div>
        <div className="cg-pagination"><button type="button" className="cg-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button><span>Página {safePage + 1} de {pages}</span><button type="button" className="cg-button" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Próxima</button></div>
      </details>
    </article>}
    {result?.ok && <FluxoPagamentos rows={linhasDoFluxoAlongamento(months)} inicio={result.start} nota="Parcelas do giro parcelado. Na carência, os juros são incorporados ao saldo e não há parcela." />}

    <details className="desk-panel cx-panel along-details along-ncg"><summary>Diagnóstico de capital de giro <span className="along-optional">opcional</span></summary>
      <div className="cx-heading cx-pad"><h3>Necessidade operacional simplificada</h3><CalculatorHelp title="Diagnóstico de capital de giro"><p>NCG = clientes a receber + estoque a custo − fornecedores a pagar. Pode ser negativa. Não é o valor recomendado de empréstimo: recursos próprios e outras fontes podem financiar parte da necessidade.</p><p>Nos prazos, estimamos clientes por vendas mensais ÷ 30 × prazo de recebimento; estoque por custo mensal das vendas ÷ 30 × prazo de estoque; fornecedores por compras mensais ÷ 30 × prazo de pagamento. Use médias comparáveis, prazos ponderados por valor e operações à vista com prazo zero. Compras e custo das vendas não são necessariamente iguais.</p><p>Sem estoque, informe zero para valor ou prazo de estoque. Esta estimativa não inclui impostos, folha e outras contas operacionais, sazonalidade ou recebíveis já antecipados. Não duplique recebíveis antecipados como recursos livres.</p></CalculatorHelp></div>
      <div className="cg-modes cx-pad" role="group" aria-label="Como estimar a necessidade de capital de giro"><button type="button" aria-pressed={ncg.mode === 'balances'} onClick={() => setNcg(old => ({ ...old, mode: 'balances' }))}>Saldos conhecidos</button><button type="button" aria-pressed={ncg.mode === 'terms'} onClick={() => setNcg(old => ({ ...old, mode: 'terms' }))}>Estimar pelos prazos</button></div>
      <div className="cx-form">{ncgKeys.map(key => <div className="cx-field" key={key}><div className="cx-field-label"><label htmlFor={`ncg-${key}`}>{ncgLabels[key]}</label></div>{['pmr', 'pme', 'pmp'].includes(key) ? <input id={`ncg-${key}`} inputMode="decimal" value={ncg[key]} aria-invalid={!!ncg[key] && !!ncgErrors[key]} aria-describedby={ncgErrors[key] && ncg[key] ? `ncg-${key}-error` : undefined} onChange={e => setNcg(old => ({ ...old, [key]: e.target.value }))} /> : <MoneyInput id={`ncg-${key}`} value={ncg[key]} aria-invalid={!!ncg[key] && !!ncgErrors[key]} aria-describedby={ncgErrors[key] && ncg[key] ? `ncg-${key}-error` : undefined} onChange={value => setNcg(old => ({ ...old, [key]: value }))} />}{ncg[key] && ncgErrors[key] && <p id={`ncg-${key}-error`} className="cx-error">{ncgErrors[key]}</p>}</div>)}</div>
      {ncgResult?.ok ? <div className="along-ncg-result" role="status"><span>NCG operacional estimada</span><strong>{brl(ncgResult.ncg)}</strong>{ncgResult.cycleDays != null && <small>Ciclo financeiro: {ncgResult.cycleDays} dias</small>}<small>Diagnóstico do negócio; não define sozinho quanto contratar.</small></div> : <p className="cx-hint cx-pad" role="status">Preencha os dados deste diagnóstico. Use zero quando não houver saldo ou prazo.</p>}
    </details>
    <div className="cx-heading along-method"><span>Premissas, IOF e limites</span><CalculatorHelp title="Premissas, IOF e limites do alongamento"><p>Estimativa de crédito novo em reais para PJ, adimplente. Não simula renegociação, portabilidade, isenção especial, inadimplência, indexador variável ou reutilização do rotativo. Não calcula CET. Confira a proposta e custos não previstos antes de contratar.</p><p>IOF automático: no giro, adicional sobre o principal liberado e parcela diária sobre amortizações do principal original, pelos dias reais até o vencimento, limitados a 365 dias por parcela. Na conta garantida, diária sobre saldo constante e sem teto genérico de 365 dias; não há adicional futuro sem acréscimo de saldo. Juros e IOF da CG são pagos à parte.</p><p>Juros do giro seguem períodos mensais; dias reais são usados no IOF e na apuração proporcional da CG. A data de vencimento é ajustada ao último dia quando o mês não tiver o dia original, sem calendário de feriados. IOF e tarifa do giro são pagos à vista. Em carência, juros são capitalizados; sua amortização não vira novo principal liberado para o IOF.</p><p>Referências consultadas: {ALONGAMENTO_SOURCES.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}. Conferidas em 06/11/2026; projeções mantêm as alíquotas vigentes consultadas.</p><p>Dados somente na memória desta tela, sem envio a serviços externos ou gravação automática.</p></CalculatorHelp></div>
    {/* Curva DI x pré até o prazo do giro (carência + parcelas), regra de 23/11/2026. Último bloco da tela. */}
    {ativo && <ReferenciaMercado tipos={['pre']} prazoMeses={prazoDoGiro(form.n, form.graceMonths)} />}
  </div>
}
