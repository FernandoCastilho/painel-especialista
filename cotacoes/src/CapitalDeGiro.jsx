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
import { lmSchedule } from './linhaMestra.js'
import { resolveCreditIof } from './iofRules.js'
import { PRACA_AJUDA, pracaCalendars } from './pracaContrato.js'
import './CalculatorStandard.css'
import './CapitalDeGiro.css'

const EXPENSES = [
  { id: 'iof', label: 'IOF' },
  { id: 'fee', label: 'Fee de estruturação' },
  { id: 'tac', label: 'Tarifas' },
  { id: 'other', label: 'Outras despesas' },
]
const GUARANTEES = ['A definir', 'Sem garantia', 'Aval', 'Recebíveis', 'Aplicação financeira', 'Imóvel', 'Outras']
const formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl = value => formatMoney.format(value)
const percent = rate => `${cetPct(rate * 100)}% a.a.`

function Field({ id, label, issue, children }) {
  return <div className="giro-field">
    <label htmlFor={id}>{label}</label>
    {children}
    {issue && <small id={`${id}-err`} className="giro-error" role="alert">{issue}</small>}
  </div>
}

export default function CapitalDeGiro({ onBack, apresentacao }) {
  // Valor, prazo, carência, amortização, data e praça vêm da linha mestra comum (19/11/2026); o resto é do produto.
  const [lm, setLm, clearLm] = useLinhaMestra(cgToday())
  const [form, setForm] = useState(() => ({ rate: '2,00', unit: 'am', firstDue: '', profile: 'pj', eligible: false,
    guarantee: GUARANTEES[0], costs: { fee: '0,00', tac: '0,00', other: '0,00' }, timings: {} }))
  const [dirty, setDirty] = useState(false)
  const change = patch => {
    setForm(previous => ({ ...previous, ...patch }))
    if (!apresentacao) setDirty(true)
  }
  const changeLm = (key, value) => { setLm(key, value); if (!apresentacao) setDirty(true) }
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
  const errors = {
    value: principal.ok && principal.value > 0 ? null : principal.error || 'Informe um valor maior que zero.',
    n: schedule.ok || /carência/.test(schedule.error) ? null : schedule.error,
    grace: schedule.ok || !/carência/.test(schedule.error) ? null : schedule.error,
    rate: rate !== null && rate <= 1000 ? null : 'Informe uma taxa entre 0% e 1.000%.',
    dates: firstDue && lm.start && firstDue > lm.start ? null : 'Informe a liberação e o primeiro vencimento posterior à liberação.',
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
  const fieldError = (key, id) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-err` : undefined })

  return <section className="cx bw calc-standard calc-workspace giro-screen" aria-labelledby="calc-h">
    <button type="button" className="cx-back giro-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
    <div className="bw-heading calc-workspace-heading giro-header">
      <h2 id="calc-h" className="cx-title"><strong aria-hidden="true">PME</strong><span>Capital de giro</span></h2>
      <Help title="Capital de Giro: cálculo e premissas">
        <p>Operação prefixada com juros por dias corridos na base de 30 dias. O vencimento passa ao próximo dia útil conforme a praça do contrato. No Bullet, o pagamento acontece no fim do prazo.</p>
        <p>Prazo total e carência em meses, como no Comparador de Crédito: parcelas = prazo − carência; a primeira vence um mês depois do fim da carência. Os juros da carência são somados ao saldo.</p>
        <p>Os custos à vista são abatidos na liberação. Custos financiados compõem o saldo e as parcelas. O CET é anual, calculado sobre o fluxo em dias corridos na base de 365 dias. O CET do contrato prevalece.</p>
        <p>O IOF é calculado pelo principal de cada parcela e pelos dias corridos, com limite de 365 dias. À vista, é abatido na liberação. Quando incorporado ao principal da mesma operação, o IOF integra o saldo financiado e o valor total para o limite do Simples Nacional.</p>
        <p>{PRACA_AJUDA}</p>
      </Help>
    </div>

    <div className="giro-columns">
      <form className="giro-form" noValidate onSubmit={event => { event.preventDefault(); setDirty(false) }}>
        <LinhaMestra prefix="cx" values={lm} onChange={changeLm} onClear={() => { clearLm(); if (!apresentacao) setDirty(true) }}
          labels={{ value: 'Valor solicitado' }} errors={{ value: errors.value, term: errors.n, grace: errors.grace }} />
        <fieldset className="giro-card">
          <legend>Taxas, tributos e despesas</legend>
          <div className="giro-rate">
            <Field id="cx-rate" label="Taxa prefixada" issue={errors.rate}>
              <div className="giro-input-unit">
                <input id="cx-rate" inputMode="decimal" {...fieldError('rate', 'cx-rate')} {...bind('rate')} />
                <select aria-label="Período da taxa" {...bind('unit')}><option value="am">% a.m.</option><option value="aa">% a.a.</option></select>
              </div>
            </Field>
          </div>
          <div className="giro-costs">
            <div className="giro-cost-head" aria-hidden="true"><span>Despesa</span><span>Valor</span><span>Forma de pagamento</span></div>
            {EXPENSES.map(({ id, label }) => <div className="giro-cost" key={id}>
              <span className="giro-cost-label">{label}</span>
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

        <fieldset className="giro-card">
          <legend>Condições do produto</legend>
          <div className="giro-grid giro-grid-pair">
            <Field id="cx-firstDue" label={isBullet ? 'Vencimento (opcional)' : 'Primeiro vencimento (opcional)'} issue={errors.dates}>
              <input id="cx-firstDue" type="date" {...fieldError('dates', 'cx-firstDue')} {...bind('firstDue')} />
              <small className="giro-hint">{form.firstDue ? 'Data informada à mão.' : autoDue ? `Pela linha mestra: ${dmy(autoDue)}.` : 'Preencha prazo e carência.'}</small>
            </Field>
            <Field id="cx-frequency" label="Periodicidade">
              <input id="cx-frequency" readOnly value={isBullet ? 'Pagamento único' : 'Mensal'} />
              {isBullet && <small className="giro-hint">Principal e juros pagos no vencimento.</small>}
            </Field>
          </div>
          <div className="giro-guarantee"><Field id="cx-guarantee" label="Garantia">
            <select id="cx-guarantee" {...bind('guarantee')}>{GUARANTEES.map(label => <option key={label}>{label}</option>)}</select>
          </Field></div>
        </fieldset>
        <button className="giro-simulate" type="submit">Simular</button>
      </form>

      {/* Resultado: único quadro com borda laranja. Resposta principal no topo (CET e parcela); depois a taxa e os valores
          em reais, terminando no custo total. Só apresentação: os mesmos valores calculados de antes. */}
      <aside className="giro-result calc-result-shell" aria-labelledby="giro-result-title" aria-live="polite">
        <h3 id="giro-result-title">Resultado da simulação</h3>
        <div className="giro-result-body">
          {!result && <small className={`giro-result-alert${calculation?.error || hasErrors ? ' is-warning' : ''}`} role={calculation?.error ? 'alert' : undefined}>
            {calculation?.error || (hasErrors ? 'Confira os campos indicados.' : 'Clique em Simular para atualizar o resultado.')}
          </small>}
          <div className="giro-answer">
            <div className="giro-answer-main"><small>Custo Efetivo Total</small><b>{result ? percent(result.cet) : '—'}</b><span>CET anual do fluxo, em dias corridos</span></div>
            <div className="giro-answer-side"><small>{isBullet ? 'Pagamento único' : 'Primeira parcela'}</small><b>{moneyText(result?.rows[0].payment)}</b><span>{isBullet ? 'no vencimento' : 'parcelas mensais'}</span></div>
          </div>
          <h4 className="giro-result-group">Taxa e custo efetivo</h4>
          <dl>
            <div className="giro-cet"><dt>Custo Efetivo Total (CET)</dt><dd>{result ? percent(result.cet) : '—'}</dd></div>
          </dl>
          <h4 className="giro-result-group">Valores em reais</h4>
          <dl>
            <div><dt>Valor líquido liberado</dt><dd>{moneyText(result?.net)}</dd></div>
            <div><dt>Saldo financiado</dt><dd>{moneyText(result?.financedBalance)}</dd></div>
            <div><dt>{isBullet ? 'Pagamento único' : 'Primeira parcela'}</dt><dd>{moneyText(result?.rows[0].payment)}</dd></div>
            {!isBullet && <div><dt>Última parcela</dt><dd>{moneyText(result?.rows.at(-1).payment)}</dd></div>}
            <div className="giro-total"><dt>Custo total</dt><dd>{moneyText(result?.cost)}</dd></div>
          </dl>
        </div>
      </aside>
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
  </section>
}
