import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useState } from 'react'
import { nbr5891 } from './format.js'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { DISCOUNT_INITIAL_FORM, DISCOUNT_TERMS, TITLE_FEE_MODES, parseDiscountForm } from './analiseDesconto.js'
import './AnaliseDesconto.css'
import './CalcPattern-analise-desconto.css'
import { IOF_SOURCE } from './iofRules.js'
import { cgAddDays, cgToday } from './contaGarantida.js'
import LinhaMestra, { useLinhaMestra } from './LinhaMestra.jsx'
import { ComposicaoDoCusto, Respostas, Resultado, step } from './Roteiro.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import { lmLoad } from './linhaMestra.js'
import { PRACAS_CONTRATO } from './pracaContrato.js'
import CalcBack from './CalcBack.jsx'

const brl = (value) => value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const number = (value) => value == null ? '—' : value.toLocaleString('pt-BR')
const pct = (value) => `${nbr5891(value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
// CET anual (decimal) com o equivalente mensal composto.
const cetText = (cet) => cet == null ? 'Não mensurável' : `${pct(cet)} a.a.`
const cetMonthly = (cet) => cet == null ? '—' : `${pct(Math.expm1(Math.log1p(cet) / 12))} a.m.`
// Direção da economia em símbolo, além da cor: ▲ giro com menor custo, ▼ giro com maior custo.
const arrow = (value) => value > 0 ? '▲' : value < 0 ? '▼' : '='
const dateBr = (iso) => iso ? iso.split('-').reverse().join('/') : ''
const FOOT = 'A data e a praça valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'
const CET_HELP = 'CET (Resolução CMN 4.881/2020, arts. 4º e 6º, texto oficial): nas operações de desconto, o CET usa o prazo de 30 dias e o valor do limite pactuado — aqui, o valor nominal da operação. Líquido = nominal − juros de 30 dias − IOF de 30 dias − TAC − tarifa de títulos; o nominal volta em 30 dias corridos; taxa anual em dias corridos/365. O custo pelo prazo real usa a data de pagamento de cada título e não é o CET da norma.'

export function DescontoIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 11h8M8 15h5M8 18h3" /><path d="m14 17 2 2 4-4" /></svg>
}

// Roteiro da tela (21/11/2026): 1 Demanda, 2 Encargos, 3 Resultado do desconto (a linha do tempo saiu em 21/11/2026); depois, a
// comparação com o giro. Tela limpa (21/11/2026): explicações ficam nos "?".
// Só ordem, nomes e apresentação: os números são os mesmos que parseDiscountForm já devolvia.
export default function AnaliseDesconto({ onBack, apresentacao }) {
  // Linha mestra comum (19/11/2026): data da operação e praça vêm dela; o valor pode ser o principal do giro comparado.
  const [lm, setLm, clearLm] = useLinhaMestra(cgToday())
  // O exemplo de títulos vence 30 dias depois da data da operação, como no exemplo de referência (05/11 → 05/12).
  const [form, setForm] = useState(() => ({ ...DISCOUNT_INITIAL_FORM, titleRows: DISCOUNT_INITIAL_FORM.titleRows.map(row => ({ ...row, dueDate: cgAddDays(lmLoad(cgToday()).start, 30) ?? row.dueDate })) }))
  const [visited, setVisited] = useState({})
  const fromLine = form.giroPrincipalMode === 'linha'
  const filled = { ...form, date: lm.start, praca: lm.praca, giroPrincipalMode: fromLine ? 'manual' : form.giroPrincipalMode, giroPrincipal: fromLine ? lm.value : form.giroPrincipal }
  const { errors: found, operation, result: calculated } = parseDiscountForm(filled)
  const result = calculated?.ok ? calculated : null
  // A tela abre sem vermelho: o erro de um campo só aparece depois que a pessoa passa por ele e sai.
  // O erro de um grupo de títulos também aparece ao mexer na data da operação; o aviso geral da operação só
  // aparece quando não resta campo pendente ainda não visitado. A validação usa sempre a lista completa (found).
  const visit = (key) => setVisited((old) => old[key] ? old : { ...old, [key]: true })
  const seen = (key) => !!visited[key] || (key.startsWith('titleRow') && !!visited.date)
  const unseen = Object.keys(found).filter((key) => key !== 'operation' && !seen(key))
  const errors = Object.fromEntries(Object.entries(found).filter(([key]) => key === 'operation' ? unseen.length === 0 : seen(key)))
  const pending = Object.keys(found).length > 0, flagged = Object.keys(errors).length > 0
  const guide = (what) => unseen.length === 1 && unseen[0] === 'titleFeeMode' ? `Escolha como a tarifa dos títulos é cobrada para ver ${what}.` : `Preencha os campos que faltam para ver ${what}.`
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }))
  const changeLm = (key, value) => { setLm(key, value); visit(key === 'start' ? 'date' : key === 'value' ? 'giroPrincipal' : key) }
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
  // Sem a operação completa, o resultado do desconto avisa o que falta (o aviso da comparação fica no bloco dela).
  const resultAlert = operation ? null : { warning: flagged, text: flagged ? 'Preencha ou corrija os campos sinalizados para ver o resultado.' : guide('o resultado') }
  return <section className="cx cx-desconto bw calc-standard calc-workspace" aria-labelledby="ad-heading">
    <div className="bw-heading calc-workspace-heading"><div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="ad-heading" className="cx-title"><span>Análise de desconto</span></h2></div><CalculatorHelp title="Análise de desconto"><p>Compare o custo recorrente de antecipar títulos com um capital de giro Price em 12, 24, 36 e 48 meses.</p><p>Exemplo editável. Informe os títulos, a convenção contratual e o enquadramento. Juros, IOF e CET são calculados automaticamente. A quantidade de operações informada abaixo controla todos os resultados.</p><p>Simulação estimada, com CET pela Resolução CMN 4.881. Não é proposta nem recomendação de contratação.</p></CalculatorHelp></div>

    {/* Roteiro de 21/11/2026: primeiro o custo do desconto (blocos 1 a 4); a comparação com o giro vem depois. Só apresentação. */}
    <div className="dsc-flow">
      <div className="dsc-form">
        <LinhaMestra prefix="ad-lm" title={step(1, 'Demanda do cliente')} values={lm} onChange={changeLm} onClear={clearLm} foot={null} help={{ title: 'Demanda do cliente', children: <p>{FOOT}</p> }}
          fields={['start']} labels={{ start: 'Data da operação' }} errors={{ start: errors.date }}
          details={{ fields: ['praca'], open: !!apresentacao, summary: PRACAS_CONTRATO.find(praca => praca.id === lm.praca)?.label }}>
          <div className="lm-field"><span className="lm-label"><label htmlFor="ad-gross">Valor total dos títulos</label></span><output id="ad-gross" className="dsc-readonly">{brl(operation?.value)}</output></div>
          <div className="desconto-titles lm-wide">
            <div className="cx-field-label"><h4>Títulos ou grupos com o mesmo vencimento</h4><CalculatorHelp title="Títulos ou grupos com o mesmo vencimento"><p>Informe o valor nominal total de cada grupo e a quantidade de títulos. Não multiplique o valor pela quantidade. Todos usam a taxa de juros dos encargos.</p></CalculatorHelp></div>
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
        </LinhaMestra>

        <article className="desk-panel cx-panel desconto-input-panel">
          <header className="cx-heading"><h3>{step(2, 'Encargos')}</h3><CalculatorHelp title="Encargos do desconto"><p>O custo completo inclui juros, IOF, TAC e tarifa dos títulos. Os valores iniciais são um exemplo ilustrativo: substitua pelos títulos e condições do contrato.</p></CalculatorHelp></header>
          <div className="cx-form">
            {textField('operationRate', 'Taxa de juros (% a.m.)', 'Aplicada a cada grupo de títulos pelos dias corridos até o vencimento informado, conforme a convenção selecionada.')}
            {field('convention', 'Convenção contratual de desconto', <select {...props('convention')} value={form.convention} onChange={event => set('convention', event.target.value)}><option value="commercial30">Comercial simples (por fora), mês de 30 dias</option><option value="rational30">Racional simples (por dentro), mês de 30 dias</option></select>, 'Selecione a convenção efetiva do contrato. Vencimento em fim de semana, feriado nacional ou feriado da praça do contrato passa para o próximo dia útil; juros e IOF contam até essa data.')}
            {field('titleFeeMode', 'Tarifa dos títulos: como é cobrada', <select {...props('titleFeeMode')} value={form.titleFeeMode} onChange={(event) => set('titleFeeMode', event.target.value)}><option value="">Selecione a forma de cobrança</option>{TITLE_FEE_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select>, 'A referência mostra R$ 564,00 como “unitário”, mas os totais o tratam como tarifa da operação. Escolha a interpretação correta.')}
            {feeField}
            {moneyField('tac', 'TAC', 'Tarifa de contratação, cobrada a cada operação de desconto.')}
            <div className="cx-field"><div className="cx-field-label"><label htmlFor="ad-iof">IOF <small>calculado</small></label></div><output id="ad-iof" className="dsc-readonly">{brl(operation?.iof)}</output></div>
          </div>
          <details className="dsc-drawer" open={!!apresentacao}>
            <summary>Enquadramento do IOF<small> · {form.taxProfile === 'simples' ? `Simples Nacional / MEI${form.eligible ? ', opção confirmada' : ', opção a confirmar'}` : 'pessoa jurídica, regra geral'}</small></summary>
            <div className="cx-form">{taxFields('taxProfile', 'eligible')}</div>
          </details>
        </article>
      </div>

      {/* Resultado do desconto: é o que o modo Apresentar mostra em "Resultado". */}
      <div className="rt-outcome calc-result-shell" aria-live="polite">
        <Resultado id="ad-result-title" number={3} alert={resultAlert}>
          <Respostas items={[
            { question: 'Quanto entra no caixa', value: brl(operation?.net), note: 'Valor líquido da operação: bruto menos todos os custos' },
            { question: 'Quanto é descontado', value: brl(operation?.cost), note: 'Custo total completo, com a tarifa de títulos' },
            { question: 'Quanto custa', value: operation ? cetText(operation.cet) : '—', main: true,
              note: `CET do desconto (art. 6º · 30 dias)${operation ? ` · ${cetMonthly(operation.cet)} · prazo real: ${cetText(operation.termCost)}` : ''}` },
          ]} />
          <ComposicaoDoCusto format={brl} parts={[
            { label: 'Juros', value: operation?.interest },
            { label: 'IOF', value: operation?.iof },
            { label: 'Tarifa dos títulos', value: operation?.titleFee },
            { label: 'TAC', value: operation?.tac },
          ].map(part => operation?.cost > 0
            ? { ...part, label: `${part.label} · ${pct(part.value / operation.cost)}` }
            : part)} total={{ label: 'Custo total completo', value: operation?.cost }} rows={[
            { label: 'Subtotal sem tarifa de títulos (TAC + juros + IOF)', value: brl(operation?.costWithoutTitles), kind: 'muted' },
            { label: 'Base do IOF: nominal menos juros antecipados', value: brl(operation?.base), kind: 'muted' },
          ]} />
          <div className="dsc-result-foot"><span>Como o CET do desconto é calculado</span><CalculatorHelp title="CET do desconto"><p>{CET_HELP}</p></CalculatorHelp></div>
        </Resultado>
      </div>
    </div>

    {/* Depois do custo do desconto: a comparação com o capital de giro. Blocos sem número, para não confundir com o roteiro. */}
    <div className="dsc-compare-head"><h3>Comparação com o capital de giro</h3><CalculatorHelp title="Comparação com o capital de giro"><p>O desconto se repete todo mês; o giro Price é pago em 12, 24, 36 ou 48 meses.</p></CalculatorHelp></div>
    <div className="dsc-workspace">
    <div className="dsc-inputs">
    <article className="desk-panel cx-panel desconto-input-panel">
      <header className="cx-heading"><h3>Projeção mensal do desconto</h3><CalculatorHelp title="Projeção mensal do desconto"><p>A projeção mantém vencimentos e quantidade dos títulos, escalona proporcionalmente seus valores nominais para o valor médio e recalcula juros e IOF com a taxa projetada. A TAC e tarifas fixas permanecem por operação. O limite do Simples é conferido novamente para cada operação projetada.</p></CalculatorHelp></header>
      <div className="cx-form">
        {textField('operations', 'Quantidade de operações por mês', 'A primeira referência tem 6 e a comparação tem 7. Vale exclusivamente o número deste campo.', 'numeric')}
        {moneyField('averageValue', 'Valor médio bruto por operação', 'Volume mensal = valor médio × quantidade de operações.')}
        {textField('discountRate', 'Taxa de desconto de referência (% a.m.)', 'Recalcula juros e base do IOF sobre os grupos escalonados, mantendo seus vencimentos.')}
      </div>
    </article>

    <article className="desk-panel cx-panel desconto-input-panel">
      <header className="cx-heading"><h3>Premissas do capital de giro</h3><CalculatorHelp title="Premissas do capital de giro"><p>Mesmo cálculo do Capital de Giro. Juros pelos dias corridos entre vencimentos: (1 + taxa a.m.) elevado a dias/30. Vencimento em fim de semana, feriado nacional, feriado da praça do contrato ou 31/12 (sem expediente bancário) passa para o próximo dia útil. TAC e IOF são descontados na liberação: o principal é financiado inteiro e o líquido recebido é menor. Alíquotas legais automáticas por enquadramento e valor total da operação.</p><p>Liberação do giro na data da operação ({dateBr(lm.start) || '—'}), na mesma praça do contrato.</p></CalculatorHelp></header>
      <div className="cx-form">
        {field('giroPrincipalMode', 'Principal usado no giro', <select {...props('giroPrincipalMode')} value={form.giroPrincipalMode} onChange={(event) => set('giroPrincipalMode', event.target.value)}><option value="monthly">Igual ao volume bruto mensal do desconto</option><option value="linha">Valor da linha mestra (R$ {lm.value})</option><option value="manual">Informar outro valor</option></select>, 'Usar o volume mensal é uma hipótese de comparação, não uma necessidade de capital de giro (NCG) apurada.')}
        {fromLine && field('giroPrincipal', 'Valor para o giro comparado', <MoneyInput {...props('giroPrincipal')} value={lm.value} onChange={(value) => changeLm('value', value)} />, 'É o valor da linha mestra: vale também nas outras calculadoras de empréstimo, até você fechar esta aba.')}
        {form.giroPrincipalMode === 'manual' && moneyField('giroPrincipal', 'Valor financiado no giro', 'Ao informar outro principal, os montantes comparados também ficam diferentes.')}
        {textField('giroRate', 'Taxa do giro Price (% a.m.)', 'Taxa mensal efetiva, com parcelas mensais. Se o primeiro vencimento passar de 30 dias, os dias extras de juros entram no saldo.')}
        {moneyField('giroTac', 'TAC do giro, uma única vez', 'R$ 3.150,00 é o valor inferido para reconciliar a referência. Confirme a proposta; não é uma tarifa padrão.')}
        {taxFields('giroTaxProfile', 'giroEligible')}
      </div>
    </article>
    </div>
    <aside className="dsc-result-col" aria-label="Resultado da comparação">
    <article className="desk-panel cx-panel dsc-result-box">
      {!result && <header className="dsc-result-head"><h3>Desconto × giro: resultado</h3></header>}
      {/* Falta de dados: faixa no topo do quadro do resultado. */}
      <div aria-live="polite" className="desconto-result-status">
        {pending && (flagged
          ? <p className="desconto-notice">Preencha ou corrija os campos sinalizados para liberar a comparação.</p>
          : <p className="desconto-notice desconto-guide">{guide('a comparação')}</p>)}
        {calculated && !calculated.ok && <p role="alert" className="cx-error">{calculated.error}</p>}
      </div>
      {result && <ExpandablePanel title="Desconto × giro: resultado">
        {/* a. Resposta principal: quanto o giro custa a menos (ou a mais) que o desconto em 12 meses. Só reorganiza números já calculados. */}
        <div className="dsc-answer">
          <div className="dsc-answer-main" data-direction={first.savings > 0 ? 'giro' : first.savings < 0 ? 'desconto' : 'igual'}>
            <small>Economia estimada com giro · 12 meses</small>
            <b><span aria-hidden="true">{arrow(first.savings)}</span> {brl(first.savings)}</b>
            <span>{first.savings > 0 ? 'O giro custa menos que o desconto neste cenário.' : first.savings < 0 ? 'O giro custa mais: neste cenário o desconto sai mais barato.' : 'Os dois caminhos custam o mesmo neste cenário.'}</span>
          </div>
          <div className="dsc-answer-side"><small>Por mês</small><b>{brl(first.savings / 12)}</b><span>Média do cenário de 12 meses</span></div>
        </div>
        {/* b. Equivalências: taxa efetiva (CET) dos dois caminhos */}
        <div className="dsc-equiv">
          <div><span>CET do desconto</span><b>{cetText(result.projected.cet)}</b><small>Projeção mensal · art. 6º</small></div>
          <div><span>CET do giro · 12 meses</span><b>{cetText(first.giro.cet)}</b><small>Price · art. 4º</small></div>
        </div>
        {/* c. Valores em reais, agrupados, terminando no total */}
        <div className="dsc-values" role="group" aria-label="Valores em reais">
          <h4 className="dsc-grp">Desconto · por mês</h4>
          {summaryRows.map(([label, monthly, , count]) => <div key={label} className={label === 'Custo total do desconto' ? 'dsc-sub' : undefined}><span>{label}</span><b>{count ? number(monthly) : brl(monthly)}</b></div>)}
          <h4 className="dsc-grp">Economia estimada com giro · por prazo</h4>
          {DISCOUNT_TERMS.map((months, index) => <div key={months}><span>{months} meses</span><b><span aria-hidden="true">{arrow(result.comparisons[index].savings)}</span> {brl(result.comparisons[index].savings)}</b></div>)}
          <h4 className="dsc-grp">Em 12 meses</h4>
          <div><span>Desconto: juros + TAC + títulos + IOF</span><b>{brl(first.discountCost)}</b></div>
          <div><span>Giro: juros + TAC + IOF</span><b>{brl(first.giro.cost)}</b></div>
          <div className="dsc-total"><span>Economia estimada com giro</span><b>{brl(first.savings)}</b></div>
        </div>
        {/* Notas depois dos números */}
        <p className="desconto-result-caption">Principal do giro: <b>{brl(result.principal)}</b> · {number(result.operations)} operações de desconto por mês · Price a {form.giroRate}% a.m.</p>
        <div className="calc-panel-context dsc-note"><span>Como ler a economia</span><CalculatorHelp title="Economia estimada com giro"><p>Economia = custo do desconto − custo do giro. ▲ positivo: giro com menor custo; ▼ negativo: maior custo. Não comprova economia efetiva.</p></CalculatorHelp></div>
      </ExpandablePanel>}
    </article>
    </aside>
    </div>

    {/* d. Tabelas completas em largura total, recolhidas: nada foi apagado. */}
    <details className="dsc-tables"><summary>Tabelas: custos do desconto, desconto × giro por prazo e composição do giro</summary>
      <article className="desk-panel cx-panel desconto-summary-panel calc-result-shell">
        <ExpandablePanel title="Resumo dos custos do desconto">
        <div className="cx-wrap" role="region" aria-label="Resumo mensal e anual do desconto" tabIndex={0}>
          <table className="cx-matrix desconto-table"><caption className="sr-only">Volume e custos de desconto no mês e em doze meses</caption><thead><tr><th scope="col">Item</th><th scope="col">Mês</th><th scope="col">Ano</th></tr></thead><tbody>{summaryRows.map(([label, monthly, annual, count]) => <tr key={label}><th scope="row">{label}</th><td>{count ? number(monthly) : brl(monthly)}</td><td>{count ? number(annual) : brl(annual)}</td></tr>)}</tbody></table>
        </div>
      </ExpandablePanel></article>

      <article className="desk-panel cx-panel desconto-comparison-panel calc-result-shell">
        <ExpandablePanel title="Desconto × giro: CET e custo financeiro"><div className="calc-panel-context"><CalculatorHelp title="Como comparar desconto e giro"><p>{CET_HELP} O CET do desconto usa a projeção mensal e vale para qualquer prazo, pois a operação se repete. No giro, o líquido é o principal menos TAC e IOF.</p><p>Economia = custo do desconto − custo do giro. Positivo: giro tem menor custo no cenário; negativo: maior custo. Na coluna Mês, os custos são a média do cenário de 12 meses; as duas linhas de parcela/desembolso já são mensais.</p><p>A média mensal all-in não é a parcela contratual. Ela distribui principal, juros, TAC e IOF pelo prazo. A parcela Price aparece separadamente, sem TAC e IOF.</p><p>Os fluxos não são equivalentes: o desconto é repetido todo mês e o giro é amortizado. A diferença de custos não comprova economia efetiva nem substitui a análise do ciclo de caixa. Esta simulação não é proposta nem recomendação de contratação.</p></CalculatorHelp></div>
        <div className="cx-wrap" role="region" aria-label="Comparação de desconto e giro em 12, 24, 36 e 48 meses; role para ver todas as colunas" tabIndex={0}>
          <table className="cx-matrix desconto-table"><caption className="sr-only">CET, custo acumulado por prazo, economia estimada e desembolso mensal</caption><thead><tr><th scope="col">Item</th><th scope="col">Mês<small>base: giro de 12 meses</small></th>{DISCOUNT_TERMS.map((months) => <th scope="col" key={months}>{months} meses</th>)}</tr></thead><tbody>{comparisonRows.map((row) => <tr key={row.label} className={row.savings ? 'desconto-savings' : undefined}><th scope="row">{row.label}</th><td data-negative={row.savings && row.month < 0 ? 'true' : undefined}>{(row.format || brl)(row.month)}</td>{DISCOUNT_TERMS.map((months, index) => { const value = result ? row.value(result.comparisons[index]) : null; return <td key={months} data-negative={row.savings && value < 0 ? 'true' : undefined}>{(row.format || brl)(value)}</td> })}</tr>)}</tbody></table>
        </div>
        <p className="desconto-notice desconto-inset"><b>A média mensal all-in não é a parcela contratual.</b> Os fluxos não são equivalentes; compare também o CET. A diferença de custos não comprova economia efetiva.</p>
      </ExpandablePanel></article>

      <article className="desk-panel cx-panel desconto-comparison-panel calc-result-shell">
        <ExpandablePanel title="Composição do custo do giro">
        <div className="cx-wrap" role="region" aria-label="Juros, TAC e IOF do giro por prazo; role para ver todas as colunas" tabIndex={0}>
          <table className="cx-matrix desconto-table"><caption className="sr-only">Encargos totais do giro e separação do IOF diário e adicional</caption><thead><tr><th scope="col">Item</th>{DISCOUNT_TERMS.map((months) => <th scope="col" key={months}>{months} meses</th>)}</tr></thead><tbody>{[['Juros totais', 'interest'], ['TAC única', 'tac'], ['IOF diário', 'dailyIof'], ['IOF adicional', 'additionalIof'], ['IOF total', 'iof'], ['Custo financeiro total', 'cost']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{DISCOUNT_TERMS.map((months, index) => <td key={months}>{brl(result?.comparisons[index].giro[key])}</td>)}</tr>)}</tbody></table>
        </div>
      </ExpandablePanel></article>
    </details>

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
    {/* Desconto com taxa prefixada: a referência é a curva DI x pré da B3. Sempre o último bloco da tela. */}
    <ReferenciaMercado tipos={['pre']} />
  </section>
}
