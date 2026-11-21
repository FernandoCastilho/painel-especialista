import { useState } from 'react'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { SYSTEMS, parseDecimal } from './emprestimo.js'
import { cetPct, dmy } from './format.js'
import { giroOperation } from './creditComparison.js'
import { cgToday } from './contaGarantida.js'
import { addMonths } from './creditModalities.js'
import LinhaMestra, { useLinhaMestra } from './LinhaMestra.jsx'
import { ComposicaoDoCusto, LinhaDoTempo, Respostas, Resultado, step } from './Roteiro.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import { lmSchedule } from './linhaMestra.js'
import { resolveCreditIof } from './iofRules.js'
import { PRACA_AJUDA, PRACAS_CONTRATO, pracaCalendars } from './pracaContrato.js'
import './CalculatorStandard.css'
import './CapitalDeGiro.css'
import CalcBack from './CalcBack.jsx'

// Nomes padrão dos encargos nas calculadoras (escolha do Fernando, 21/11/2026): Taxa, IOF, Fee, TAC, Outros.
const EXPENSES = [
  { id: 'iof', label: 'IOF' },
  { id: 'fee', label: 'Fee' },
  { id: 'tac', label: 'TAC' },
  { id: 'other', label: 'Outros' },
]
const GUARANTEES = ['A definir', 'Sem garantia', 'Aval', 'Recebíveis', 'Aplicação financeira', 'Imóvel', 'Outras']
const formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl = value => formatMoney.format(value)
const percent = rate => `${cetPct(rate * 100)}% a.a.`
const FOOT = 'Estes valores valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'

function Field({ id, label, issue, children }) {
  return <div className="giro-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {issue && <small id={`${id}-err`} className="giro-error" role="alert">{issue}</small>}
  </div>
}

// Roteiro da tela (piloto de 21/11/2026): 1 Demanda, 2 Encargos, 3 Linha do tempo, 4 Resultado.
// Só ordem, nomes e apresentação: os números são os mesmos que giroOperation já devolvia.
export default function CapitalDeGiro({ onBack, apresentacao }) {
  // Valor, prazo, carência, amortização, data e praça vêm da linha mestra comum (19/11/2026); o resto é do produto.
  const [lm, setLm, clearLm] = useLinhaMestra(cgToday())
  const [form, setForm] = useState(() => ({ rate: '2,00', unit: 'am', firstDue: '', profile: 'pj', eligible: false,
    guarantee: GUARANTEES[0], costs: { fee: '0,00', tac: '0,00', other: '0,00' }, timings: {} }))
  const [dirty, setDirty] = useState(false)
  const markDirty = () => { if (!apresentacao) setDirty(true) }
  const change = patch => {
    setForm(previous => ({ ...previous, ...patch }))
    markDirty()
  }
  const changeLm = (key, value) => { setLm(key, value); markDirty() }
  const bind = key => ({ value: form[key], onChange: event => change({ [key]: event.target.value }) })
  const principal = parseMoneyInput(lm.value)
  // Regra do Comparador (decisão de 19/11/2026): prazo total e carência em meses; parcelas = prazo − carência;
  // 1º vencimento = liberação + carência + 1 mês (bullet: no fim do prazo). O 1º vencimento informado à mão prevalece.
  const schedule = lmSchedule(lm)
  const n = schedule.ok ? schedule.n : null
  const autoDue = schedule.ok ? addMonths(lm.start, schedule.dueMonths) : null
  const firstDue = form.firstDue || autoDue
  const rate = parseDecimal(form.rate)
  const expenses = EXPENSES.filter(cost => cost.id !== 'iof').map(cost => ({ ...cost,
    parsed: parseMoneyInput(form.costs[cost.id], { optional: true }),
  }))
  const sumExpenses = financed => expenses.reduce((sum, item) =>
    sum + (!!form.timings[item.id] === financed ? item.parsed.value : 0), 0)
  const financedFees = sumExpenses(true)
  const tax = resolveCreditIof({ date: lm.start, profile: form.profile, operationValue: principal.value + financedFees, eligible: form.eligible })
  const isBullet = lm.system === 'bullet'
  // Aviso de data só quando o problema é de data. Sem prazo ou carência válidos não há vencimento automático a conferir:
  // quem avisa é o campo do prazo, e a gaveta dos detalhes não abre por isso.
  const datesOk = firstDue ? lm.start && firstDue > lm.start : !schedule.ok && lm.start
  const errors = {
    value: principal.ok && principal.value > 0 ? null : principal.error || 'Informe um valor maior que zero.',
    n: schedule.ok || /carência/.test(schedule.error) ? null : schedule.error,
    grace: schedule.ok || !/carência/.test(schedule.error) ? null : schedule.error,
    rate: rate !== null && rate <= 1000 ? null : 'Informe uma taxa entre 0% e 1.000%.',
    dates: datesOk ? null : 'Informe a liberação e o primeiro vencimento posterior à liberação.',
    iof: tax.ok ? null : tax.error,
  }
  for (const item of expenses) errors[item.id] = item.parsed.ok ? null : item.parsed.error
  const hasErrors = Object.values(errors).some(Boolean)
  const params = { value: principal.value, n, rate, unit: form.unit, start: lm.start, firstDue,
    profile: form.profile, eligible: form.eligible, fees: sumExpenses(false), financedFees,
    financeIof: !!form.timings.iof, calendars: pracaCalendars(lm.praca) }
  const calculation = !dirty && !hasErrors ? giroOperation({ ...params, system: lm.system }) : null
  const result = calculation?.ok ? calculation : null
  const moneyText = value => result ? brl(value) : '—'
  const first = result?.rows[0], last = result?.rows.at(-1)
  // Pago na liberação: despesas e IOF à vista (diferença entre o valor solicitado e o líquido).
  const upfront = result ? Math.round((result.value - result.net) * 100) / 100 : 0
  // Custo total = juros + IOF + despesas (à vista e financiadas): só reparte o que a conta já devolve.
  const parts = [
    { label: 'Juros', value: result?.interest },
    { label: 'IOF', value: result?.iof },
    { label: 'Fee, TAC e outros', value: result ? result.fees + result.financedFees : undefined },
  ]
  // Carência: a combinada na demanda; com 1º vencimento informado à mão, a que a conta apurou (dias além do primeiro mês).
  const hasGrace = !!result && (form.firstDue ? result.graceDays > 0 : schedule.grace > 0)
  let grace = { value: 'Sem carência', note: 'Não há período sem pagamento' }
  if (hasGrace) grace = {
    value: form.firstDue ? '1º vencimento informado' : `${schedule.grace} ${schedule.grace === 1 ? 'mês' : 'meses'}`,
    note: result.capitalizedGrace > 0 ? `Sem pagamento. Juros de ${brl(result.capitalizedGrace)} somados ao saldo` : 'Sem pagamento no período',
  }
  const events = result && [
    { label: 'Liberação', when: dmy(lm.start), value: brl(result.net),
      note: upfront > 0 ? `${brl(result.value)} menos ${brl(upfront)} pagos na liberação` : 'Valor integral: nada é descontado na liberação' },
    ...(isBullet ? [
      { label: 'Vencimento único', when: dmy(last.date), value: brl(last.payment), note: `Principal e juros. Total pago: ${brl(result.total)}` },
    ] : [
      { label: 'Carência', empty: !hasGrace, when: `1ª parcela em ${dmy(first.date)}`, ...grace },
      { label: 'Parcelas', when: result.n === 1 ? dmy(first.date) : `de ${dmy(first.date)} a ${dmy(last.date)}`,
        value: result.n === 1 ? '1 parcela' : `${result.n} parcelas mensais`,
        note: first.payment === last.payment ? `1ª de ${brl(first.payment)}` : `1ª de ${brl(first.payment)}, última de ${brl(last.payment)}` },
      { label: 'Quitação', when: dmy(last.date), value: brl(result.total), note: 'Total pago' },
    ]),
  ]
  let paymentNote = 'Primeira parcela'
  if (isBullet) paymentNote = 'Pagamento único'
  else if (result && lm.system === 'sac') paymentNote = `1ª parcela. A última é de ${brl(last.payment)}`
  else if (result) paymentNote = result.n === 1 ? 'Parcela única' : `1ª de ${result.n} parcelas mensais`
  const single = isBullet || result?.n === 1 ? 'Pagamento único' : null
  const totalNote = upfront > 0 ? `${single ?? 'Parcelas'} mais o que é pago na liberação` : single ?? 'Soma das parcelas'
  const detailsSummary = [`liberação em ${lm.start ? dmy(lm.start) : '—'}`, PRACAS_CONTRATO.find(praca => praca.id === lm.praca)?.label,
    form.firstDue ? `1º vencimento em ${dmy(form.firstDue)}` : '1º vencimento automático', `garantia: ${form.guarantee.toLowerCase()}`].filter(Boolean).join(' · ')
  // Aviso do quadro de resultado enquanto não há resultado.
  const resultAlert = result ? null : { error: !!calculation?.error, warning: !!calculation?.error || hasErrors,
    text: calculation?.error || (hasErrors ? 'Confira os campos indicados.' : 'Clique em Simular para atualizar o resultado.') }
  const fieldError = (key, id) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-err` : undefined })

  return <section className="cx bw calc-standard calc-workspace giro-screen" aria-labelledby="calc-h">
    <div className="bw-heading calc-workspace-heading giro-header">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="calc-h" className="cx-title"><span>Capital de giro</span></h2></div>
      <Help title="Capital de Giro: cálculo e premissas">
        <p>Operação prefixada com juros por dias corridos na base de 30 dias. O vencimento passa ao próximo dia útil conforme a praça do contrato. No Bullet, o pagamento acontece no fim do prazo.</p>
        <p>Prazo total e carência em meses, como na seção Necessidade do Cliente: parcelas = prazo − carência; a primeira vence um mês depois do fim da carência. Os juros da carência são somados ao saldo.</p>
        <p>Os custos à vista são abatidos na liberação. Custos financiados compõem o saldo e as parcelas. O CET é anual, calculado sobre o fluxo em dias corridos na base de 365 dias. O CET do contrato prevalece.</p>
        <p>O IOF é calculado pelo principal de cada parcela e pelos dias corridos, com limite de 365 dias. À vista, é abatido na liberação. Quando incorporado ao principal da mesma operação, o IOF integra o saldo financiado e o valor total para o limite do Simples Nacional.</p>
        <p>{PRACA_AJUDA}</p>
      </Help>
    </div>

    <div className="giro-flow">
      <form className="giro-form" noValidate onSubmit={event => { event.preventDefault(); setDirty(false) }}>
        <LinhaMestra prefix="cx" title={step(1, 'Demanda do cliente')} values={lm} onChange={changeLm} foot={FOOT}
          onClear={() => { clearLm(); markDirty() }} fields={['value', 'term', 'grace', 'system']}
          labels={{ value: 'Valor solicitado' }} errors={{ value: errors.value, term: errors.n, grace: errors.grace }}
          details={{ fields: ['start', 'praca'], open: !!apresentacao, alert: errors.dates, summary: detailsSummary, children: <>
            <div className="lm-field">
              <span className="lm-label"><label htmlFor="cx-firstDue">{isBullet ? 'Vencimento (opcional)' : 'Primeiro vencimento (opcional)'}</label></span>
              <input id="cx-firstDue" type="date" {...fieldError('dates', 'cx-firstDue')} {...bind('firstDue')} />
              {errors.dates ? <small id="cx-firstDue-err" className="lm-error" role="alert">{errors.dates}</small>
                : <small className="giro-hint">{form.firstDue ? 'Data informada à mão.' : autoDue ? `Automático: ${dmy(autoDue)}.` : 'Preencha prazo e carência.'}</small>}
            </div>
            <div className="lm-field">
              <span className="lm-label"><label htmlFor="cx-guarantee">Garantia</label></span>
              <select id="cx-guarantee" {...bind('guarantee')}>{GUARANTEES.map(label => <option key={label}>{label}</option>)}</select>
            </div>
          </> }} />
        <fieldset className="giro-card">
          <legend>{step(2, 'Encargos')}</legend>
          <div className="giro-costs">
            <div className="giro-cost-head" aria-hidden="true"><span>Encargo</span><span>Valor</span><span>Como paga</span></div>
            <div className="giro-cost giro-cost-rate">
              <label className="giro-cost-label" htmlFor="cx-rate">Taxa de juros <small>prefixada</small></label>
              <div><div className="giro-input-unit">
                <input id="cx-rate" inputMode="decimal" {...fieldError('rate', 'cx-rate')} {...bind('rate')} />
                <select aria-label="Período da taxa" {...bind('unit')}><option value="am">% a.m.</option><option value="aa">% a.a.</option></select>
              </div>{errors.rate && <small id="cx-rate-err" className="giro-error" role="alert">{errors.rate}</small>}</div>
              <span className="giro-cost-fixed">{isBullet ? 'No vencimento' : 'Nas parcelas'}</span>
            </div>
            {EXPENSES.map(({ id, label }) => <div className="giro-cost" key={id}>
              <span className="giro-cost-label">{label}{id === 'iof' && <> <small>calculado</small></>}</span>
              {id === 'iof' ? <output className="giro-readonly" aria-label="Valor do IOF">{moneyText(result?.iof)}</output> :
                <div><MoneyInput id={`cx-${id}`} aria-label={`Valor de ${label}`} {...fieldError(id, `cx-${id}`)}
                  value={form.costs[id]} onChange={value => change({ costs: { ...form.costs, [id]: value } })} />
                  {errors[id] && <small id={`cx-${id}-err`} className="giro-error" role="alert">{errors[id]}</small>}</div>}
              <select aria-label={`Forma de pagamento de ${label}`} value={form.timings[id] ? 'financed' : 'upfront'}
                onChange={event => change({ timings: { ...form.timings, [id]: event.target.value === 'financed' } })}>
                <option value="upfront">À vista</option><option value="financed">Financiado</option>
              </select>
            </div>)}
          </div>
          <details className="giro-settings">
            <summary>Enquadramento do IOF</summary>
            <div className="giro-iof">
              <Field id="cx-profile" label="Perfil tributário" issue={errors.iof}>
                <select id="cx-profile" value={form.profile} {...fieldError('iof', 'cx-profile')} onChange={event => change({ profile: event.target.value, eligible: false })}>
                  <option value="pj">Pessoa jurídica geral</option><option value="simples">Simples/MEI: operação elegível até R$ 30 mil</option>
                </select>
              </Field>
              {form.profile === 'simples' && <label><input type="checkbox" checked={form.eligible} onChange={event => change({ eligible: event.target.checked })} /> Confirmo o enquadramento e a documentação da operação.</label>}
              {tax.ok && <p><a href={tax.source} target="_blank" rel="noreferrer">Base legal do IOF automático</a></p>}
            </div>
          </details>
        </fieldset>
        <button className="giro-simulate" type="submit">Simular</button>
      </form>

      {/* Linha do tempo e resultado formam o quadro de resultado (é o que o modo Apresentar mostra em "Resultado"). */}
      <div className="rt-outcome giro-outcome calc-result-shell" aria-live="polite">
        <LinhaDoTempo id="giro-timeline-title" className="giro-timeline" events={events}
          placeholder="Aparece depois de simular: liberação, carência, parcelas e quitação." />
        <Resultado id="giro-result-title" className="giro-result" alert={resultAlert}>
          <Respostas items={[
            { question: 'Quanto entra no caixa', value: moneyText(result?.net), note: result ? `Valor líquido, de ${brl(result.value)} solicitados` : 'Valor líquido liberado' },
            { question: isBullet ? 'Quanto paga no vencimento' : 'Quanto paga por mês', value: moneyText(first?.payment), note: paymentNote },
            { question: 'Quanto paga no total', value: moneyText(result?.total), note: totalNote },
            { question: 'Quanto custa', value: result ? percent(result.cet) : '—', note: 'Custo Efetivo Total (CET), em dias corridos', main: true },
          ]} />
          <ComposicaoDoCusto parts={parts} format={moneyText} total={{ label: 'Custo total', value: result?.cost }} rows={[
            { label: 'Saldo financiado', value: moneyText(result?.financedBalance), kind: 'muted' },
          ]} />
        </Resultado>
      </div>
    </div>

    {result ? <details className="giro-installments">
      <summary>Ver parcelas</summary>
      <div className="giro-table-scroll" role="region" aria-label="Cronograma de pagamentos" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Parcela</th><th scope="col">Vencimento</th><th scope="col">Amortização</th><th scope="col">Juros</th><th scope="col">Pagamento</th><th scope="col">Saldo</th></tr></thead>
          <tbody>{result.rows.map(row => <tr key={row.number}>
            <th scope="row">{row.number}</th><td>{dmy(row.date)}</td><td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td><td>{brl(row.balance)}</td>
          </tr>)}</tbody>
          <tfoot><tr><th scope="row" colSpan={4}>Total das parcelas</th><td>{brl(result.paid)}</td><td>—</td></tr></tfoot>
        </table>
      </div>
      <p className="giro-rounding">O CET usa o valor líquido e as parcelas deste cronograma, em centavos. Nas tabelas Price e SAC, o arredondamento pode gerar diferenças de centavos entre parcelas ou amortizações.</p>
      <details className="giro-settings giro-comparison">
        <summary>Comparar amortizações</summary>
        <div className="giro-table-scroll" role="region" aria-label="Comparação dos sistemas" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Amortização</th><th scope="col">Total pago</th><th scope="col">Juros totais</th><th scope="col">CET</th></tr></thead>
            <tbody>{SYSTEMS.filter(system => system.id !== 'bullet' || isBullet).map(system => {
              const item = system.id === lm.system ? result : giroOperation({ ...params, system: system.id })
              return <tr key={system.id}><th scope="row">{system.label}</th><td>{item.ok ? brl(item.total) : '—'}</td><td>{item.ok ? brl(item.interest) : '—'}</td><td>{item.ok ? percent(item.cet) : '—'}</td></tr>
            })}</tbody>
          </table>
        </div>
      </details>
    </details> : <button className="giro-installments giro-installments-disabled" type="button" disabled>Ver parcelas</button>}
    {/* Taxa prefixada: a referência é a curva DI x pré da B3. Sempre o último bloco da tela. */}
    <ReferenciaMercado tipos={['pre']} />
  </section>
}
