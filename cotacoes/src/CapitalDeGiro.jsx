import { useState } from 'react'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { SYSTEMS, parseDecimal } from './emprestimo.js'
import { cetPct, dmy } from './format.js'
import { giroOperation } from './creditComparison.js'
import { cgAddDays, cgDate, cgToday } from './contaGarantida.js'
import { resolveCreditIof } from './iofRules.js'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA, pracaCalendars } from './pracaContrato.js'
import './CapitalDeGiro.css'
import './CalcPattern-giro.css'

const EXPENSES = [
  { id: 'iof', label: 'IOF' },
  { id: 'fee', label: 'Fee de estruturação' },
  { id: 'tac', label: 'Tarifas' },
  { id: 'other', label: 'Outras despesas' },
]
const GUARANTEES = ['A definir', 'Sem garantia', 'Aval', 'Recebíveis', 'Aplicação financeira', 'Imóvel', 'Outras']
const DAY = 86400000
const periodDays = (from, to) => cgDate(from) && cgDate(to) ? (cgDate(to) - cgDate(from)) / DAY : null
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
  const [form, setForm] = useState(() => {
    const start = cgToday()
    return { value: '100.000,00', n: '12', rate: '2,00', unit: 'am', system: 'price',
      start, firstDue: cgAddDays(start, 30), praca: PRACA_PADRAO, profile: 'pj', eligible: false,
      guarantee: GUARANTEES[0], costs: { fee: '0,00', tac: '0,00', other: '0,00' }, timings: {} }
  })
  const [dirty, setDirty] = useState(false)
  const change = patch => {
    setForm(previous => ({ ...previous, ...patch }))
    if (!apresentacao) setDirty(true)
  }
  const bind = key => ({ value: form[key], onChange: event => change({ [key]: event.target.value }) })
  const principal = parseMoneyInput(form.value)
  const n = /^\d+$/.test(form.n.trim()) ? Number(form.n) : null
  const rate = parseDecimal(form.rate)
  const expenses = EXPENSES.filter(cost => cost.id !== 'iof').map(cost => ({ ...cost,
    parsed: parseMoneyInput(form.costs[cost.id], { optional: true }),
  }))
  const sumExpenses = financed => expenses.reduce((sum, item) =>
    sum + (!!form.timings[item.id] === financed ? item.parsed.value : 0), 0)
  const financedFees = sumExpenses(true)
  const tax = resolveCreditIof({ date: form.start, profile: form.profile, operationValue: principal.value + financedFees, eligible: form.eligible })
  const untilFirst = periodDays(form.start, form.firstDue)
  const grace = untilFirst === null ? 0 : Math.max(0, untilFirst - 30)
  const isBullet = form.system === 'bullet'
  const errors = {
    value: principal.ok && principal.value > 0 ? null : principal.error || 'Informe um valor maior que zero.',
    n: n >= 1 && n <= 600 ? null : 'Informe o prazo em meses, de 1 a 600.',
    rate: rate !== null && rate <= 1000 ? null : 'Informe uma taxa entre 0% e 1.000%.',
    dates: untilFirst > 0 ? null : 'Informe a liberação e o primeiro vencimento posterior à liberação.',
    iof: tax.ok ? null : tax.error,
  }
  for (const item of expenses) errors[item.id] = item.parsed.ok ? null : item.parsed.error
  const hasErrors = Object.values(errors).some(Boolean)
  const params = { value: principal.value, n, rate, unit: form.unit, start: form.start, firstDue: form.firstDue,
    profile: form.profile, eligible: form.eligible, fees: sumExpenses(false), financedFees,
    financeIof: !!form.timings.iof, calendars: pracaCalendars(form.praca) }
  const calculation = !dirty && !hasErrors ? giroOperation({ ...params, system: form.system }) : null
  const result = calculation?.ok ? calculation : null
  const moneyText = value => result ? brl(value) : '—'
  const fieldError = (key, id) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-err` : undefined })
  const updateStart = event => {
    const start = event.target.value
    change({ start, firstDue: cgAddDays(start, untilFirst > 0 ? untilFirst : 30) ?? '' })
  }

  return <section className="giro-screen" aria-labelledby="calc-h">
    <header className="giro-header">
      <p>Painel do Especialista</p>
      <div><h2 id="calc-h">Capital de giro</h2>
        <Help title="Capital de Giro: cálculo e premissas">
          <p>Operação prefixada com juros por dias corridos na base de 30 dias. O vencimento passa ao próximo dia útil conforme a praça do contrato. No Bullet, o pagamento acontece no último vencimento.</p>
          <p>Os custos à vista são abatidos na liberação. Custos financiados compõem o saldo e as parcelas. O CET é anual, calculado sobre o fluxo em dias corridos na base de 365 dias. O CET do contrato prevalece.</p>
          <p>O IOF é calculado pelo principal de cada parcela e pelos dias corridos, com limite de 365 dias. À vista, é abatido na liberação. Quando incorporado ao principal da mesma operação, o IOF integra o saldo financiado e o valor total para o limite do Simples Nacional.</p>
          <p>{PRACA_AJUDA}</p>
        </Help>
      </div>
    </header>

    <div className="giro-columns">
      <form className="giro-form" noValidate onSubmit={event => { event.preventDefault(); setDirty(false) }}>
        <fieldset className="giro-card">
          <legend>Dados da operação</legend>
          <div className="giro-grid">
            <Field id="cx-value" label="Valor solicitado" issue={errors.value}>
              <MoneyInput id="cx-value" {...fieldError('value', 'cx-value')} value={form.value} onChange={value => change({ value })} />
            </Field>
            <Field id="cx-n" label="Prazo" issue={errors.n}>
              <div className="giro-input-unit"><input id="cx-n" inputMode="numeric" {...fieldError('n', 'cx-n')} {...bind('n')} /><span>meses</span></div>
            </Field>
            <Field id="cx-grace" label="Carência">
              <div className="giro-input-unit"><input id="cx-grace" type="number" min="0" max="3630" step="1" inputMode="numeric"
                placeholder={isBullet ? 'Pagamento único' : 'Sem carência'} disabled={isBullet} value={isBullet ? '' : grace || ''}
                onChange={event => {
                  const days = Number(event.target.value)
                  if (Number.isInteger(days) && days >= 0 && days <= 3630) change({ firstDue: cgAddDays(form.start, 30 + days) ?? '' })
                }} />{grace > 0 && !isBullet && <span>dias</span>}</div>
            </Field>
          </div>
          <details className="giro-settings">
            <summary>Datas e praça do contrato</summary>
            <div className="giro-grid">
              <Field id="cx-start" label="Data da liberação"><input id="cx-start" type="date" value={form.start} onChange={updateStart} /></Field>
              <Field id="cx-firstDue" label="Primeiro vencimento mensal" issue={errors.dates}>
                <input id="cx-firstDue" type="date" {...fieldError('dates', 'cx-firstDue')} {...bind('firstDue')} />
              </Field>
              <Field id="cx-praca" label="Praça do contrato">
                <select id="cx-praca" {...bind('praca')}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
              </Field>
            </div>
            <p>{PRACA_RESSALVA}</p>
          </details>
          {grace > 0 && !isBullet && <p className="giro-note">Carência de {grace} dias corridos além dos primeiros 30 dias. Os juros do período extra são somados ao saldo. O prazo informado corresponde ao número de parcelas mensais após a carência.</p>}
        </fieldset>

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
          <legend>Condições da modalidade</legend>
          <div className="giro-grid giro-grid-pair">
            <Field id="cx-system" label="Amortização">
              <select id="cx-system" {...bind('system')}>{SYSTEMS.map(system => <option key={system.id} value={system.id}>{system.label}</option>)}</select>
              {isBullet && <p className="giro-note">Principal e juros pagos no vencimento.</p>}
            </Field>
            <Field id="cx-frequency" label="Periodicidade">
              <input id="cx-frequency" readOnly value={isBullet ? 'Pagamento único' : 'Mensal'} />
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
              const item = system.id === form.system ? result : giroOperation({ ...params, system: system.id })
              return <tr key={system.id}><th scope="row">{system.label}</th><td>{item.ok ? brl(item.total) : '—'}</td><td>{item.ok ? brl(item.interest) : '—'}</td><td>{item.ok ? percent(item.cet) : '—'}</td></tr>
            })}</tbody>
          </table>
        </div>
      </details>
    </details> : <button className="giro-installments giro-installments-disabled" type="button" disabled>Ver parcelas</button>}
  </section>
}
