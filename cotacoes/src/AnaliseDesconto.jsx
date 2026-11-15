import { useState } from 'react'
import { nbr5891 } from './format.js'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { DISCOUNT_INITIAL_FORM, DISCOUNT_TERMS, TITLE_FEE_MODES, parseDiscountForm } from './analiseDesconto.js'
import './AnaliseDesconto.css'
import { IOF_SOURCE } from './iofRules.js'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_RESSALVA } from './pracaContrato.js'

const brl = (value) => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (value) => value == null ? '—' : value.toLocaleString('pt-BR')
const pct = (value) => `${nbr5891(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
// CET anual (decimal) com o equivalente mensal composto.
const cetText = (cet) => cet == null ? 'Não mensurável' : `${pct(cet)} a.a.`
const cetMonthly = (cet) => cet == null ? '—' : `${pct(Math.expm1(Math.log1p(cet) / 12))} a.m.`
const dateBr = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const CET_HELP = 'CET (Resolução CMN 4.881/2020, arts. 4º e 6º, texto oficial): nas operações de desconto, o CET usa o prazo de 30 dias e o valor do limite pactuado — aqui, o valor nominal da operação. Líquido = nominal − juros de 30 dias − IOF de 30 dias − TAC − tarifa de títulos; o nominal volta em 30 dias corridos; taxa anual em dias corridos/365. O custo pelo prazo real usa a data de pagamento de cada título e não é o CET da norma.'

export function DescontoIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8M8 15h5M8 18h3" /><path d="m14 17 2 2 4-4" /></svg>
}

export default function AnaliseDesconto({ onBack }) {
  const [form, setForm] = useState(() => ({ ...DISCOUNT_INITIAL_FORM, titleRows: DISCOUNT_INITIAL_FORM.titleRows.map(row => ({ ...row })) }))
  const [visited, setVisited] = useState({})
  const { errors: found, operation, result: calculated } = parseDiscountForm(form)
  const result = calculated?.ok ? calculated : null
  // A tela abre sem vermelho: o erro de um campo só aparece depois que a pessoa passa por ele e sai.
  // O erro de um grupo de títulos também aparece ao mexer na data da operação; o aviso geral da operação só
  // aparece quando não resta campo pendente ainda não visitado. A validação usa sempre a lista completa (found).
  const visit = (key) => setVisited((old) => old[key] ? old : { ...old, [key]: true })
  const seen = (key) => !!visited[key] || (key.startsWith('titleRow') && !!visited.date)
  const unseen = Object.keys(found).filter((key) => key !== 'operation' && !seen(key))
  const errors = Object.fromEntries(Object.entries(found).filter(([key]) => key === 'operation' ? unseen.length === 0 : seen(key)))
  const pending = Object.keys(found).length > 0, flagged = Object.keys(errors).length > 0
  const guide = unseen.length === 1 && unseen[0] === 'titleFeeMode' ? 'Escolha como a tarifa dos títulos é cobrada para ver a comparação.' : 'Preencha os campos que faltam para ver a comparação.'
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  const props = (key) => ({ id: `ad-${key}`, 'aria-invalid': !!errors[key], 'aria-describedby': `ad-${key}-err ad-${key}-hint`, onBlur: () => visit(key) })
  const field = (key, label, control, hint = '') => <div className="cx-field" key={key}>
    <div className="cx-field-label"><label htmlFor={`ad-${key}`}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>{control}
    <p className="sr-only" id={`ad-${key}-hint`}>{hint}</p>
    <p className="cx-error" id={`ad-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] || ''}</p>
  </div>
  const textField = (key, label, hint, inputMode = 'decimal') => field(key, label, <input {...props(key)} inputMode={inputMode} autoComplete="off" value={form[key]} onChange={(event) => set(key, event.target.value)} onFocus={(event) => event.target.select()} />, hint)
  const moneyField = (key, label, hint) => field(key, label, <MoneyInput {...props(key)} value={form[key]} onChange={(value) => set(key, value)} />, hint)
  const taxFields = (key, eligibleKey) => <>
    {field(key, 'Enquadramento tributário', <select {...props(key)} value={form[key]} onChange={event => set(key, event.target.value)}><option value="pj">Pessoa jurídica: regra geral</option><option value="simples">Optante do Simples Nacional / MEI</option></select>, 'Alíquotas automáticas. Simples confirmado: diária reduzida apenas para operação total até R$ 30 mil; acima, regra geral.')}
    {form[key] === 'simples' && <label><input type="checkbox" checked={form[eligibleKey]} onChange={event => set(eligibleKey, event.target.checked)} /> Confirmo opção pelo Simples Nacional/MEI para esta operação.</label>}
  </>
  const setRow = (index, key, value) => set('titleRows', form.titleRows.map((row, i) => i === index ? { ...row, [key]: value } : row))
  const feeField = form.titleFeeMode === 'total' ? moneyField('titleFeeTotal', 'Tarifa total de títulos por operação', 'Total cobrado pelo conjunto de títulos. Não multiplica pela quantidade.')
    : form.titleFeeMode === 'unit' ? moneyField('titleFeeUnit', 'Custo unitário por título', 'Multiplicado pela quantidade de títulos em cada operação.')
      : form.titleFeeMode === 'percent' ? textField('titleFeePercent', 'Tarifa sobre o valor bruto (%)', '0,25% reproduz os centavos da tabela de referência; é uma hipótese, não uma tarifa contratual confirmada.') : null
  const summaryRows = [
    ['Quantidade de operações', result?.operations, result?.annualOperations, true],
    ['Volume bruto de operações', result?.monthly.value, result?.annual.value],
    ['Tarifa de títulos', result?.monthly.titleFee, result?.annual.titleFee],
    ['Tarifa de contratação (TAC)', result?.monthly.tac, result?.annual.tac],
    ['Juros pagos', result?.monthly.interest, result?.annual.interest],
    ['IOF pago', result?.monthly.iof, result?.annual.iof],
    ['Custo total do desconto', result?.monthly.cost, result?.annual.cost],
  ]
  const first = result?.comparisons[0]
  const comparisonRows = [
    { label: 'CET do desconto', month: result?.projected.cet, value: () => result.projected.cet, format: cetText },
    { label: 'CET do giro', month: first?.giro.cet, value: (row) => row.giro.cet, format: cetText },
    { label: 'Desconto: juros + TAC + títulos + IOF', month: result?.monthly.cost, value: (row) => row.discountCost },
    { label: 'Giro: juros + TAC + IOF', month: first ? first.giro.cost / 12 : null, value: (row) => row.giro.cost },
    { label: 'Economia estimada com giro', month: first ? first.savings / 12 : null, value: (row) => row.savings, savings: true },
    { label: 'Parcela Price, sem TAC e IOF', month: first?.giro.installment, value: (row) => row.giro.installment },
    { label: 'Média mensal all-in: principal + custos', month: first?.giro.averageMonthlyOutflow, value: (row) => row.giro.averageMonthlyOutflow },
  ]
  return <section className="cx cx-desconto" aria-labelledby="ad-heading">
    <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
    <div className="cx-heading"><h2 id="ad-heading" className="cx-title"><span className="cx-icon"><DescontoIcon /></span>Análise de desconto</h2><CalculatorHelp title="Análise de desconto"><p>Compare o custo recorrente de antecipar títulos com um capital de giro Price em 12, 24, 36 e 48 meses.</p><p>Exemplo editável. Informe os títulos, a convenção contratual e o enquadramento. Juros, IOF e CET são calculados automaticamente. A quantidade de operações informada abaixo controla todos os resultados.</p></CalculatorHelp></div>
    <p className="desconto-notice">Simulação estimada, com CET pela Resolução CMN 4.881. Não é proposta nem recomendação de contratação.</p>

    <article className="desk-panel cx-panel desconto-input-panel">
      <header className="cx-heading"><h3>1. Operação simulada de desconto</h3><CalculatorHelp title="Operação simulada de desconto"><p>Os valores iniciais são um exemplo ilustrativo. Substitua pelos títulos e condições do contrato. O custo completo inclui juros, IOF, TAC e tarifa dos títulos.</p></CalculatorHelp></header>
      <div className="cx-form">
        {field('date', 'Data da operação e liberação do giro', <input {...props('date')} type="date" min="1900-01-01" max="9995-12-31" value={form.date} onChange={(event) => set('date', event.target.value)} />, 'A primeira parcela do giro vence no mês seguinte, no mesmo dia (limitado ao último dia do mês) ou no próximo dia útil.')}
        <div><span>Valor bruto dos títulos</span><b>{brl(operation?.value)}</b></div>
        {textField('operationRate', 'Taxa da operação (% a.m.)', 'Aplicada a cada grupo de títulos pelos dias corridos até o vencimento informado, conforme a convenção selecionada.')}
        {field('convention', 'Convenção contratual de desconto', <select {...props('convention')} value={form.convention} onChange={event => set('convention', event.target.value)}><option value="commercial30">Comercial simples (por fora), mês de 30 dias</option><option value="rational30">Racional simples (por dentro), mês de 30 dias</option></select>, 'Selecione a convenção efetiva do contrato. Vencimento em fim de semana, feriado nacional ou feriado da praça do contrato passa para o próximo dia útil; juros e IOF contam até essa data.')}
        {field('praca', 'Praça do contrato (feriados)', <select {...props('praca')} value={form.praca} onChange={event => set('praca', event.target.value)}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>, `${PRACA_AJUDA} Vale para os títulos e para as parcelas do giro. ${PRACA_RESSALVA}`)}
        {taxFields('taxProfile', 'eligible')}
        {field('titleFeeMode', 'Como calcular a tarifa dos títulos?', <select {...props('titleFeeMode')} value={form.titleFeeMode} onChange={(event) => set('titleFeeMode', event.target.value)}><option value="">Selecione a forma de cobrança</option>{TITLE_FEE_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select>, 'A referência mostra R$ 564,00 como “unitário”, mas os totais o tratam como tarifa da operação. Escolha a interpretação correta.')}
        {feeField}
        {moneyField('tac', 'Tarifa de contratação por operação (TAC)')}
        <div><span>Juros calculados</span><b>{brl(operation?.interest)}</b></div>
        <div><span>IOF automático</span><b>{brl(operation?.iof)}</b></div>
      </div>
      <div className="desconto-titles">
        <h4>Títulos ou grupos com o mesmo vencimento</h4>
        <p>Informe o valor nominal total de cada grupo e a quantidade de títulos. Não multiplique o valor pela quantidade. Todos usam a taxa contratual acima.</p>
        {form.titleRows.map((row, index) => <fieldset key={index} className="cx-form" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) visit('titleRow' + index) }}><legend>Grupo {index + 1}</legend>
          <label>Valor nominal total do grupo<MoneyInput value={row.value} onChange={value => setRow(index, 'value', value)} /></label>
          <label>Quantidade de títulos<input inputMode="numeric" value={row.count} onChange={event => setRow(index, 'count', event.target.value)} /></label>
          <label>Vencimento contratual<input type="date" value={row.dueDate} onChange={event => setRow(index, 'dueDate', event.target.value)} /></label>
          {operation?.rows[index]?.adjusted && <p className="desconto-paydate">Pago em {dateBr(operation.rows[index].paymentDate)}, próximo dia útil.</p>}
          <button type="button" disabled={form.titleRows.length === 1} onClick={() => { set('titleRows', form.titleRows.filter((_, i) => i !== index)); setVisited((old) => Object.fromEntries(Object.entries(old).filter(([key]) => !key.startsWith('titleRow')))) }}>Remover grupo {index + 1}</button>
          {errors['titleRow' + index] && <p role="alert">{errors['titleRow' + index]}</p>}
        </fieldset>)}
        <button type="button" disabled={form.titleRows.length >= 500} onClick={() => set('titleRows', [...form.titleRows, { value: '', count: '1', dueDate: '' }])}>Adicionar grupo de títulos</button>
        {errors.operation && <p role="alert" className="cx-error">{errors.operation}</p>}
      </div>
      <div className="desconto-kpis" aria-live="polite">
        <div><span>Base do IOF: nominal menos juros antecipados</span><b>{brl(operation?.base)}</b></div>
        <div><span>Tarifa total de títulos</span><b>{brl(operation?.titleFee)}</b></div>
        <div><div className="cx-field-label"><span>Subtotal sem tarifa de títulos</span><CalculatorHelp title="Subtotal sem tarifa de títulos"><p>TAC + juros + IOF.</p></CalculatorHelp></div><b>{brl(operation?.costWithoutTitles)}</b></div>
        <div><div className="cx-field-label"><span>Custo total completo</span><CalculatorHelp title="Custo total completo"><p>Inclui a tarifa de títulos.</p></CalculatorHelp></div><b>{brl(operation?.cost)}</b></div>
        <div><div className="cx-field-label"><span>Valor líquido da operação</span><CalculatorHelp title="Valor líquido da operação"><p>Bruto menos todos os custos.</p></CalculatorHelp></div><b>{brl(operation?.net)}</b></div>
        <div><div className="cx-field-label"><span>CET do desconto (art. 6º · 30 dias)</span><CalculatorHelp title="CET do desconto"><p>{CET_HELP}</p></CalculatorHelp></div><b>{cetText(operation?.cet)}</b><small>{operation ? `${cetMonthly(operation.cet)} · prazo real: ${cetText(operation.termCost)}` : ''}</small></div>
      </div>
    </article>

    <article className="desk-panel cx-panel desconto-input-panel">
      <header className="cx-heading"><h3>2. Projeção mensal do desconto</h3><CalculatorHelp title="Projeção mensal do desconto"><p>A projeção mantém vencimentos e quantidade dos títulos, escalona proporcionalmente seus valores nominais para o valor médio e recalcula juros e IOF com a taxa projetada. A TAC e tarifas fixas permanecem por operação. O limite do Simples é conferido novamente para cada operação projetada.</p></CalculatorHelp></header>
      <div className="cx-form">
        {textField('operations', 'Quantidade de operações por mês', 'A primeira referência tem 6 e a comparação tem 7. Vale exclusivamente o número deste campo.', 'numeric')}
        {moneyField('averageValue', 'Valor médio bruto por operação', 'Volume mensal = valor médio × quantidade de operações.')}
        {textField('discountRate', 'Taxa de desconto de referência (% a.m.)', 'Recalcula juros e base do IOF sobre os grupos escalonados, mantendo seus vencimentos.')}
      </div>
    </article>

    <article className="desk-panel cx-panel desconto-input-panel">
      <header className="cx-heading"><h3>3. Premissas do capital de giro</h3><CalculatorHelp title="Premissas do capital de giro"><p>Mesmo cálculo do Capital de Giro. Juros pelos dias corridos entre vencimentos: (1 + taxa a.m.) elevado a dias/30. Vencimento em fim de semana, feriado nacional, feriado da praça do contrato ou 31/12 (sem expediente bancário) passa para o próximo dia útil. TAC e IOF são descontados na liberação: o principal é financiado inteiro e o líquido recebido é menor. Alíquotas legais automáticas por enquadramento e valor total da operação.</p></CalculatorHelp></header>
      <div className="cx-form">
        {field('giroPrincipalMode', 'Principal usado no giro', <select {...props('giroPrincipalMode')} value={form.giroPrincipalMode} onChange={(event) => set('giroPrincipalMode', event.target.value)}><option value="monthly">Igual ao volume bruto mensal do desconto</option><option value="manual">Informar outro valor</option></select>, 'Usar o volume mensal é uma hipótese de comparação, não uma necessidade de capital de giro (NCG) apurada.')}
        {form.giroPrincipalMode === 'manual' && moneyField('giroPrincipal', 'Valor financiado no giro', 'Ao informar outro principal, os montantes comparados também ficam diferentes.')}
        {textField('giroRate', 'Taxa do giro Price (% a.m.)', 'Taxa mensal efetiva, com parcelas mensais. Se o primeiro vencimento passar de 30 dias, os dias extras de juros entram no saldo.')}
        {moneyField('giroTac', 'TAC do giro, uma única vez', 'R$ 3.150,00 é o valor inferido para reconciliar a referência. Confirme a proposta; não é uma tarifa padrão.')}
        {taxFields('giroTaxProfile', 'giroEligible')}
      </div>
    </article>

    <div aria-live="polite" className="desconto-result-status">
      {pending && (flagged
        ? <p className="desconto-notice">Preencha ou corrija os campos sinalizados para liberar a comparação.</p>
        : <p className="desconto-notice desconto-guide">{guide}</p>)}
      {calculated && !calculated.ok && <p role="alert" className="cx-error">{calculated.error}</p>}
      {result && <p className="desconto-result-caption">Principal do giro: <b>{brl(result.principal)}</b> · {number(result.operations)} operações de desconto por mês · Price a {form.giroRate}% a.m.</p>}
    </div>

    <article className="desk-panel cx-panel desconto-summary-panel">
      <header><h3>Resumo dos custos do desconto</h3></header>
      <div className="cx-wrap" role="region" aria-label="Resumo mensal e anual do desconto" tabIndex={0}>
        <table className="cx-matrix desconto-table"><caption className="sr-only">Volume e custos de desconto no mês e em doze meses</caption><thead><tr><th scope="col">Item</th><th scope="col">Mês</th><th scope="col">Ano</th></tr></thead><tbody>{summaryRows.map(([label, monthly, annual, count]) => <tr key={label}><th scope="row">{label}</th><td>{count ? number(monthly) : brl(monthly)}</td><td>{count ? number(annual) : brl(annual)}</td></tr>)}</tbody></table>
      </div>
    </article>

    <article className="desk-panel cx-panel desconto-comparison-panel">
      <header className="cx-heading"><h3>Desconto × giro: CET e custo financeiro</h3><CalculatorHelp title="Como comparar desconto e giro"><p>{CET_HELP} O CET do desconto usa a projeção mensal e vale para qualquer prazo, pois a operação se repete. No giro, o líquido é o principal menos TAC e IOF.</p><p>Economia = custo do desconto − custo do giro. Positivo: giro tem menor custo no cenário; negativo: maior custo. Na coluna Mês, os custos são a média do cenário de 12 meses; as duas linhas de parcela/desembolso já são mensais.</p><p>A média mensal all-in não é a parcela contratual. Ela distribui principal, juros, TAC e IOF pelo prazo. A parcela Price aparece separadamente, sem TAC e IOF.</p><p>Os fluxos não são equivalentes: o desconto é repetido todo mês e o giro é amortizado. A diferença de custos não comprova economia efetiva nem substitui a análise do ciclo de caixa. Esta simulação não é proposta nem recomendação de contratação.</p></CalculatorHelp></header>
      <div className="cx-wrap" role="region" aria-label="Comparação de desconto e giro em 12, 24, 36 e 48 meses; role para ver todas as colunas" tabIndex={0}>
        <table className="cx-matrix desconto-table"><caption className="sr-only">CET, custo acumulado por prazo, economia estimada e desembolso mensal</caption><thead><tr><th scope="col">Item</th><th scope="col">Mês<small>base: giro de 12 meses</small></th>{DISCOUNT_TERMS.map((months) => <th scope="col" key={months}>{months} meses</th>)}</tr></thead><tbody>{comparisonRows.map((row) => <tr key={row.label} className={row.savings ? 'desconto-savings' : undefined}><th scope="row">{row.label}</th><td data-negative={row.savings && row.month < 0 ? 'true' : undefined}>{(row.format || brl)(row.month)}</td>{DISCOUNT_TERMS.map((months, index) => { const value = result ? row.value(result.comparisons[index]) : null; return <td key={months} data-negative={row.savings && value < 0 ? 'true' : undefined}>{(row.format || brl)(value)}</td> })}</tr>)}</tbody></table>
      </div>
      <p className="desconto-notice desconto-inset"><b>A média mensal all-in não é a parcela contratual.</b> Os fluxos não são equivalentes; compare também o CET. A diferença de custos não comprova economia efetiva.</p>
    </article>

    <article className="desk-panel cx-panel desconto-comparison-panel">
      <header><h3>Composição do custo do giro</h3></header>
      <div className="cx-wrap" role="region" aria-label="Juros, TAC e IOF do giro por prazo; role para ver todas as colunas" tabIndex={0}>
        <table className="cx-matrix desconto-table"><caption className="sr-only">Encargos totais do giro e separação do IOF diário e adicional</caption><thead><tr><th scope="col">Item</th>{DISCOUNT_TERMS.map((months) => <th scope="col" key={months}>{months} meses</th>)}</tr></thead><tbody>{[['Juros totais', 'interest'], ['TAC única', 'tac'], ['IOF diário', 'dailyIof'], ['IOF adicional', 'additionalIof'], ['IOF total', 'iof'], ['Custo financeiro total', 'cost']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{DISCOUNT_TERMS.map((months, index) => <td key={months}>{brl(result?.comparisons[index].giro[key])}</td>)}</tr>)}</tbody></table>
      </div>
    </article>

    <div className="desconto-method cx-heading"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Premissas, fórmulas e pontos de atenção">
      <ul>
        <li>Tarifa por operação: total informado, custo unitário × títulos ou valor bruto × percentual. Sem arredondamento intermediário; os valores exibidos são arredondados para centavos.</li>
        <li>Desconto mensal = operações × (tarifa de títulos + TAC + juros pagos + IOF pago). Custo do prazo = custo mensal × meses.</li>
        <li>Desconto: juros e IOF de cada título contam da operação até a data de pagamento (vencimento ou próximo dia útil, se cair em fim de semana, feriado nacional, feriado da praça do contrato ou 31/12, sem expediente bancário).</li>
        <li>Giro Price: juros de cada parcela = saldo × ((1 + i) elevado a dias/30 − 1), pelos dias corridos entre vencimentos; parcela fixa que quita o saldo nessas datas. Vencimentos no próximo dia útil.</li>
        <li>IOF do giro = adicional × principal + diária × soma de cada amortização multiplicada por seus dias corridos, limitados a 365. Percentuais são divididos por 100.</li>
        <li>CET (Resolução CMN 4.881/2020, texto oficial): taxa anual que iguala o líquido liberado aos pagamentos, em dias corridos/365. Desconto (art. 6º): prazo de 30 dias sobre o limite (aqui, o nominal): nominal − juros e IOF de 30 dias − TAC − tarifa de títulos, contra o nominal em 30 dias; o custo pelo prazo real usa o nominal de cada título na data de pagamento e não é CET. Giro (art. 4º): principal − TAC − IOF, contra as parcelas.</li>
        <li>Custo do giro = soma das parcelas − principal + TAC + IOF. Média mensal all-in = (principal + custo do giro) / meses.</li>
        <li>Não inclui juros de mora por títulos vencidos, despesas de baixa de duplicatas, seguros, outros encargos, renegociações nem reinvestimento dos fluxos.</li>
        <li>Feriados considerados: nacionais e, se escolhida, os da praça do contrato. Confirme convenção de juros, tarifas, enquadramento e calendário na proposta. IOF segue o regime suportado a partir de 17/07/2025; datas anteriores são bloqueadas. Os dados iniciais são um exemplo, não condições comerciais vigentes.</li>
        <li><a href={IOF_SOURCE} target="_blank" rel="noreferrer">Decreto 6.306/2007: art. 7º, II, VI e §§ 1º, 4º e 15</a>. PJ: 0,0082% ao dia + 0,38%; Simples/MEI confirmado até R$ 30 mil: 0,00274% ao dia + 0,38%. IOF diário limitado a 365 dias por título.</li>
      </ul>
    </CalculatorHelp></div>
  </section>
}
