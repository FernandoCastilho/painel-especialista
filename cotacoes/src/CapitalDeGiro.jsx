import { useState } from 'react'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { formatMoneyText, parseMoneyInput } from './moneyInput.js'
import { SYSTEMS, parseDecimal } from './emprestimo.js'
import { cetPct, dmy } from './format.js'
import { PERIODICIDADES, giroConta, giroFee, giroParcelas } from './giroConta.js'
import { giroEmailLink } from './giroEmail.js'
import { cgToday } from './contaGarantida.js'
import { addMonths } from './creditModalities.js'
import LinhaMestra, { useLinhaMestra } from './LinhaMestra.jsx'
import { ComposicaoDoCusto, Respostas, Resultado, step } from './Roteiro.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import FluxoPagamentos from './FluxoPagamentos.jsx'
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
const PROFILES = { pj: 'Pessoa jurídica geral', simples: 'Simples/MEI: operação elegível até R$ 30 mil' }
// Por período, no plural e no "quanto paga por ..." da resposta.
const PERIOD_WORDS = { 1: ['mensais', 'mês'], 2: ['bimestrais', 'bimestre'], 3: ['trimestrais', 'trimestre'], 4: ['quadrimestrais', 'quadrimestre'], 6: ['semestrais', 'semestre'] }
const formatMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl = value => formatMoney.format(value)
const percent = rate => `${cetPct(rate * 100)}% a.a.`
const share = (part, whole) => `${(part / whole * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
const FOOT = 'Valor, prazo, carência, amortização, data e praça valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'

// Padrão próprio do Capital de Giro na linha mestra: 36 meses (pedido do Fernando em 22/11/2026; as outras seguem em 24).
const GIRO_PADRAO = Object.freeze({ term: '36' })

// `copiar`: cronograma completo que não coube no rascunho; vai para a área de transferência no clique, para colar no e-mail.
function EmailEnvelope({ href, copiar }) {
  const label = 'Preparar e-mail com o resultado'
  const onClick = copiar ? () => { navigator.clipboard?.writeText(copiar).catch(() => {}) } : undefined
  return <a className="credit-email giro-email" role="link" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}
    aria-label={label} aria-disabled={href ? undefined : true} title={href ? label : 'Gere um resultado válido para preparar o e-mail'}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" />
    </svg>
  </a>
}

// Ajuste de uma parcela (flex): data e/ou valor do pagamento. Só vale se a conta aceitar; senão, o erro aparece aqui.
function FlexEditor({ row, onApply, onCancel, error }) {
  const [date, setDate] = useState(row.date)
  const [payment, setPayment] = useState(formatMoneyText(String(row.payment.toFixed(2)).replace('.', ',')))
  const parsed = parseMoneyInput(payment)
  const apply = () => {
    const change = {}
    if (date && date !== row.date) change.date = date
    if (parsed.ok && Math.round(parsed.value * 100) !== Math.round(row.payment * 100)) change.payment = parsed.value
    onApply(change)
  }
  return <tr className="giro-flex-edit"><td colSpan={7}>
    <div className="giro-flex-form">
      <label>Vencimento da parcela {row.number}<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Pagamento da parcela {row.number}<MoneyInput aria-invalid={!parsed.ok} value={payment} onChange={setPayment} /></label>
      <button type="button" disabled={!parsed.ok || !date} onClick={apply}>Aplicar</button>
      <button type="button" className="giro-link" onClick={onCancel}>Cancelar</button>
    </div>
    {(error || !parsed.ok) && <small className="giro-error" role="alert">{error || parsed.error}</small>}
  </td></tr>
}

// Roteiro da tela: 1 Demanda, 2 Encargos, 3 Resultado (a linha do tempo saiu a pedido de Fernando, 21/11/2026).
// A conta é a giroConta: nas opções de hoje, idêntica ao giroOperation; com periodicidade, juros na carência e flex, as regras
// estão em docs/giro-conta-ajustes-2026-11-21.md.
export default function CapitalDeGiro({ onBack, apresentacao }) {
  // Valor, prazo, carência, amortização, data e praça vêm da linha mestra comum (19/11/2026); o resto é do produto.
  const [lm, setLm, clearLm] = useLinhaMestra(cgToday(), GIRO_PADRAO)
  const [form, setForm] = useState(() => ({ rate: '2,00', unit: 'am', firstDue: '', profile: 'pj', eligible: false, period: 1, bulletPeriod: 0, graceInterest: false,
    feeUnit: 'brl', guarantee: GUARANTEES[0], costs: { fee: '0,00', tac: '0,00', other: '0,00' }, timings: {} }))
  const [dirty, setDirty] = useState(false)
  // Parcelas ajustadas (flex): { [nº]: { date?, payment? } }. Qualquer mudança na demanda ou nos encargos desfaz os ajustes.
  const [flex, setFlex] = useState({})
  const [editing, setEditing] = useState(null)
  const [flexError, setFlexError] = useState(null)
  const resetFlex = () => { setFlex({}); setEditing(null); setFlexError(null) }
  const markDirty = () => { if (!apresentacao) setDirty(true); resetFlex() }
  const change = patch => {
    setForm(previous => ({ ...previous, ...patch }))
    markDirty()
  }
  const changeLm = (key, value) => { setLm(key, value); markDirty() }
  const bind = key => ({ value: form[key], onChange: event => change({ [key]: event.target.value }) })
  const principal = parseMoneyInput(lm.value)
  const schedule = lmSchedule(lm)
  const isBullet = lm.system === 'bullet'
  // No Bullet a periodicidade é dos juros: 0 = pagamento único (padrão, como hoje); 1 a 6 = juros a cada p meses, principal no fim.
  const period = isBullet ? form.bulletPeriod : form.period
  const periodOptions = isBullet ? [{ id: 0, label: 'Pagamento único' }, ...PERIODICIDADES] : PERIODICIDADES
  // Parcelas = (prazo − carência) / periodicidade; 1º vencimento = liberação + carência + periodicidade (bullet: no fim do prazo).
  // O 1º vencimento informado à mão prevalece.
  const parcels = schedule.ok && !isBullet ? giroParcelas(schedule.term, schedule.grace, period) : null
  const n = schedule.ok ? (isBullet ? schedule.n : parcels.ok ? parcels.n : null) : null
  const autoDue = schedule.ok && (isBullet || parcels.ok) ? addMonths(lm.start, isBullet ? schedule.dueMonths : schedule.grace + period) : null
  const firstDue = form.firstDue || autoDue
  const graceAllowed = !isBullet && (form.firstDue ? true : schedule.ok && schedule.grace > 0)
  const graceInterest = graceAllowed && form.graceInterest
  const rate = parseDecimal(form.rate)
  const feePercent = form.feeUnit === 'pct' ? parseDecimal(form.costs.fee) : null
  const expenses = EXPENSES.filter(cost => cost.id !== 'iof').map(cost => {
    if (cost.id !== 'fee' || form.feeUnit !== 'pct') return { ...cost, parsed: parseMoneyInput(form.costs[cost.id], { optional: true }) }
    // Fee em %: percentual sobre o valor solicitado, arredondado a centavos; daí em diante igual ao Fee em R$.
    const valid = String(form.costs.fee).trim() === '' || (feePercent !== null && feePercent <= 100)
    return { ...cost, parsed: valid ? { ok: true, value: feePercent && principal.ok ? giroFee(principal.value, feePercent) : 0 } : { ok: false, error: 'Informe o Fee entre 0% e 100% do valor solicitado.' } }
  })
  const sumExpenses = financed => expenses.reduce((sum, item) =>
    sum + (!!form.timings[item.id] === financed ? item.parsed.value : 0), 0)
  const financedFees = sumExpenses(true)
  const tax = resolveCreditIof({ date: lm.start, profile: form.profile, operationValue: principal.value + financedFees, eligible: form.eligible })
  // Aviso de data só quando o problema é de data. Sem prazo ou carência válidos não há vencimento automático a conferir:
  // quem avisa é o campo do prazo, e a gaveta dos detalhes não abre por isso.
  const datesOk = firstDue ? lm.start && firstDue > lm.start : !(schedule.ok && (isBullet || parcels.ok)) && lm.start
  const errors = {
    value: principal.ok && principal.value > 0 ? null : principal.error || 'Informe um valor maior que zero.',
    n: schedule.ok || /carência/.test(schedule.error) ? null : schedule.error,
    grace: schedule.ok || !/carência/.test(schedule.error) ? null : schedule.error,
    period: parcels && !parcels.ok ? parcels.error : null,
    rate: rate !== null && rate <= 1000 ? null : 'Informe uma taxa entre 0% e 1.000%.',
    dates: datesOk ? null : 'Informe a liberação e o primeiro vencimento posterior à liberação.',
    iof: tax.ok ? null : tax.error,
  }
  for (const item of expenses) errors[item.id] = item.parsed.ok ? null : item.parsed.error
  const hasErrors = Object.values(errors).some(Boolean)
  const params = { value: principal.value, n, rate, unit: form.unit, start: lm.start, firstDue,
    profile: form.profile, eligible: form.eligible, fees: sumExpenses(false), financedFees,
    financeIof: !!form.timings.iof, calendars: pracaCalendars(lm.praca), periodicidade: period, jurosNaCarencia: graceInterest }
  const calculation = !dirty && !hasErrors ? giroConta({ ...params, system: lm.system, flex }) : null
  const result = calculation?.ok ? calculation : null
  const moneyText = value => result ? brl(value) : '—'
  const last = result?.rows.at(-1)
  const adjusted = result ? result.rows.filter(row => row.fixed).length : 0
  const graceRows = result ? result.rows.filter(row => row.juros).length : 0
  const installments = result ? result.rows.length - graceRows : 0
  const [plural, per] = PERIOD_WORDS[period] ?? PERIOD_WORDS[1]
  // Custo total = juros + IOF + despesas (à vista e financiadas): só reparte o que a conta já devolve.
  // O percentual de cada parte sobre o custo total é só apresentação, com uma casa (não precisa somar 100).
  const parts = [
    { label: 'Juros', value: result?.interest },
    { label: 'IOF', value: result?.iof },
    { label: 'Fee, TAC e outros', value: result ? result.fees + result.financedFees : undefined },
  ].map(part => result && result.cost > 0 ? { ...part, label: `${part.label} · ${share(part.value, result.cost)}` } : part)
  let paymentNote = 'Primeira parcela'
  if (isBullet) paymentNote = graceRows ? `Principal e juros do último período. Antes, ${graceRows} ${graceRows === 1 ? 'pagamento' : 'pagamentos'} só de juros` : 'Pagamento único'
  else if (result) {
    paymentNote = installments === 1 ? 'Parcela única' : `1ª de ${installments} parcelas ${plural}`
    if (lm.system === 'sac' && installments > 1) paymentNote = `1ª parcela. A última é de ${brl(last.payment)}`
    if (graceRows) paymentNote += `. Antes, ${graceRows} ${graceRows === 1 ? 'pagamento' : 'pagamentos'} só de juros`
  }
  const single = isBullet || installments === 1 ? 'Pagamento único' : null
  const upfront = result ? Math.round((result.value - result.net) * 100) / 100 : 0
  const totalNote = upfront > 0 ? `${single ?? 'Parcelas'} mais o que é pago na liberação` : single ?? 'Soma das parcelas'
  const paymentQuestion = isBullet ? 'Quanto paga no vencimento' : `Quanto paga por ${per}`
  const detailsSummary = [`liberação em ${lm.start ? dmy(lm.start) : '—'}`, PRACAS_CONTRATO.find(praca => praca.id === lm.praca)?.label,
    form.firstDue ? `1º vencimento em ${dmy(form.firstDue)}` : autoDue ? `1º vencimento automático em ${dmy(autoDue)}` : '1º vencimento automático',
    `garantia: ${form.guarantee.toLowerCase()}`].filter(Boolean).join(' · ')
  // Aviso do quadro de resultado enquanto não há resultado.
  const resultAlert = result ? null : { error: !!calculation?.error, warning: !!calculation?.error || hasErrors,
    text: calculation?.error || (hasErrors ? 'Confira os campos indicados.' : 'Clique em Simular para atualizar o resultado.') }
  const fieldError = (key, id) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${id}-err` : undefined })
  const flexNotice = result && (result.earlyEnd || adjusted > 0) ? [
    adjusted > 0 && `${adjusted === 1 ? '1 parcela ajustada' : `${adjusted} parcelas ajustadas`} na tabela de parcelas.`,
    result.earlyEnd && `A operação termina antes: quitada na parcela ${result.earlyEnd.number}, em ${dmy(result.earlyEnd.date)}.`,
  ].filter(Boolean).join(' ') : null
  const email = result ? giroEmailLink({ result, request: {
    term: schedule.term, grace: isBullet ? 0 : schedule.grace, start: lm.start, graceInterest,
    systemLabel: SYSTEMS.find(system => system.id === lm.system)?.label ?? lm.system,
    periodLabel: isBullet ? (period ? `Juros ${PERIOD_WORDS[period][0]}, principal no fim` : 'Pagamento único no fim')
      : PERIODICIDADES.find(item => item.id === period).label, paymentLabel: isBullet ? 'Quanto paga no vencimento' : `Quanto paga por ${per} (1ª parcela)`,
    rate, unit: form.unit, profileLabel: PROFILES[form.profile],
    charges: [
      { label: 'IOF', value: result.iof, timing: form.timings.iof ? 'financiado' : 'à vista, na liberação' },
      ...expenses.map(item => ({ label: item.label, value: item.parsed.value, timing: form.timings[item.id] ? 'financiado' : 'à vista, na liberação',
        note: item.id === 'fee' && form.feeUnit === 'pct' && feePercent ? `${feePercent.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% do valor solicitado` : null })),
    ],
  } }) : undefined

  const applyFlex = number => change => {
    const next = { ...flex }
    const merged = { ...(flex[number] ?? {}), ...change }
    if (!Object.keys(merged).length) { setEditing(null); return }
    next[number] = merged
    const attempt = giroConta({ ...params, system: lm.system, flex: next })
    if (!attempt.ok) { setFlexError(attempt.error); return }
    setFlex(next); setEditing(null); setFlexError(null)
  }

  return <section className="cx bw calc-standard calc-workspace giro-screen" aria-labelledby="calc-h">
    <div className="bw-heading calc-workspace-heading giro-header">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="calc-h" className="cx-title"><span>Capital de giro</span></h2></div>
      <Help title="Capital de Giro: cálculo e premissas">
        <p>Operação prefixada com juros por dias corridos na base de 30 dias. Todo vencimento que cai em fim de semana ou feriado passa para o próximo dia útil da praça do contrato. No Bullet, o pagamento é único, no fim do prazo.</p>
        <p>Prazo total e carência em meses, como na seção Necessidade do Cliente. Parcelas = (prazo − carência) ÷ periodicidade: mensal 1, bimestral 2, trimestral 3, quadrimestral 4, semestral 6 meses. A primeira vence uma periodicidade depois do fim da carência e as seguintes a cada periodicidade. Os juros são pagos junto com o principal, na mesma periodicidade.</p>
        <p>Carência: sem marcar “Pagar juros na carência”, os juros da carência (da liberação até liberação + carência) são somados ao saldo. Sem carência, os juros do 1º período entram na 1ª parcela. Marcando, há pagamentos só de juros na mesma periodicidade, contados para trás a partir do fim da carência (como no BNDES: o período mais curto fica no começo); o saldo fica igual ao valor financiado.</p>
        <p>Bullet: o principal é pago no fim do prazo. Em Periodicidade, “Pagamento único” paga também todos os juros no fim (somados ao saldo); escolhendo mensal, trimestral etc., os juros são pagos a cada período, contados para trás a partir do vencimento, e no fim paga o principal com os juros do último período.</p>
        <p>Os custos à vista são abatidos na liberação. Custos financiados compõem o saldo e as parcelas. O Fee pode ser em R$ ou em % do valor solicitado (arredondado a centavos). O CET é anual, calculado sobre o fluxo em dias corridos na base de 365 dias. O CET do contrato prevalece.</p>
        <p>Em “Do que é feito o custo”, o percentual de cada parte é sobre o custo total, com uma casa; por arredondamento, a soma pode não dar exatamente 100%.</p>
        <p>O envelope ao lado do resultado prepara um e-mail no Outlook com o resumo, as taxas e encargos e as parcelas. Quando o cronograma não cabe no endereço do rascunho (o Outlook recusa endereços longos), o e-mail leva o resumo das parcelas e o cronograma completo é copiado no clique: é só colar no e-mail (Ctrl+V).</p>
        <p>{FOOT}</p>
        <p>{PRACA_AJUDA}</p>
      </Help>
    </div>

    <div className="giro-flow">
      <form className="giro-form" noValidate onSubmit={event => { event.preventDefault(); setDirty(false) }}>
        <LinhaMestra prefix="cx" title={step(1, 'Demanda do cliente')} values={lm} onChange={changeLm} foot=""
          onClear={() => { clearLm(); markDirty() }} fields={['value', 'term', 'grace', 'system']}
          labels={{ value: 'Valor solicitado' }} errors={{ value: errors.value, term: errors.n, grace: errors.grace }}
          details={{ fields: ['start', 'praca'], open: !!apresentacao, alert: errors.dates, summary: detailsSummary, children: <>
            <div className="lm-field">
              <span className="lm-label"><label htmlFor="cx-firstDue">{isBullet ? 'Vencimento (opcional)' : 'Primeiro vencimento (opcional)'}</label></span>
              <input id="cx-firstDue" type="date" {...fieldError('dates', 'cx-firstDue')} {...bind('firstDue')} />
              {errors.dates && <small id="cx-firstDue-err" className="lm-error" role="alert">{errors.dates}</small>}
            </div>
            <div className="lm-field">
              <span className="lm-label"><label htmlFor="cx-guarantee">Garantia</label></span>
              <select id="cx-guarantee" {...bind('guarantee')}>{GUARANTEES.map(label => <option key={label}>{label}</option>)}</select>
            </div>
          </> }}>
          <div className="lm-field">
            <span className="lm-label"><label htmlFor="cx-period">Periodicidade</label></span>
            <select id="cx-period" value={period} {...fieldError('period', 'cx-period')}
              onChange={event => change({ [isBullet ? 'bulletPeriod' : 'period']: Number(event.target.value) })}>
              {periodOptions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            {errors.period && <small id="cx-period-err" className="lm-error" role="alert">{errors.period}</small>}
          </div>
          <div className="lm-field giro-grace-interest">
            <label><input id="cx-graceInterest" type="checkbox" disabled={!graceAllowed} checked={graceInterest}
              onChange={event => change({ graceInterest: event.target.checked })} /> Pagar juros na carência</label>
          </div>
        </LinhaMestra>
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
            {EXPENSES.map(({ id, label }) => <div className={`giro-cost${id === 'fee' ? ' giro-cost-fee' : ''}`} key={id}>
              <span className="giro-cost-label">{label}{id === 'iof' && <> <small>calculado</small> <Help title="IOF: como é calculado">
                <p>IOF da operação de crédito (Decreto 6.306/2007, art. 7º): alíquota adicional de 0,38% sobre o valor da operação, mais a alíquota diária sobre o principal de cada parcela, pelos dias corridos até o vencimento, com limite de 365 dias.</p>
                <p>Pessoa jurídica geral: diária de 0,0082%. Simples Nacional ou MEI, em operação de até R$ 30 mil: diária de 0,00274%, desde que o enquadramento e a documentação da operação sejam confirmados.</p>
                <p>À vista, o IOF é abatido na liberação. Financiado (incorporado ao principal da mesma operação), integra o saldo financiado e o valor total para o limite do Simples Nacional.</p>
                <p>O IOF incide sobre as amortizações e seus prazos: pagamentos só de juros, na carência, não pagam IOF.</p>
                {tax.ok && <p><a href={tax.source} target="_blank" rel="noreferrer">Base legal do IOF automático</a></p>}
              </Help></>}</span>
              {id === 'iof' ? <output className="giro-readonly" aria-label="Valor do IOF">{moneyText(result?.iof)}</output>
                : id === 'fee' ? <div><div className="giro-input-unit">
                  <input id="cx-fee" inputMode="decimal" autoComplete="off" aria-label="Valor de Fee" {...fieldError('fee', 'cx-fee')} value={form.costs.fee}
                    onChange={event => change({ costs: { ...form.costs, fee: event.target.value } })}
                    onBlur={event => { if (form.feeUnit === 'brl') { const text = formatMoneyText(event.target.value); if (text !== event.target.value) change({ costs: { ...form.costs, fee: text } }) } }} />
                  <select aria-label="Unidade do Fee" value={form.feeUnit} onChange={event => change({ feeUnit: event.target.value, costs: { ...form.costs, fee: '0,00' } })}>
                    <option value="brl">R$</option><option value="pct">%</option>
                  </select>
                </div>{errors.fee && <small id="cx-fee-err" className="giro-error" role="alert">{errors.fee}</small>}</div>
                : <div><MoneyInput id={`cx-${id}`} aria-label={`Valor de ${label}`} {...fieldError(id, `cx-${id}`)}
                  value={form.costs[id]} onChange={value => change({ costs: { ...form.costs, [id]: value } })} />
                  {errors[id] && <small id={`cx-${id}-err`} className="giro-error" role="alert">{errors[id]}</small>}</div>}
              <select aria-label={`Forma de pagamento de ${label}`} value={form.timings[id] ? 'financed' : 'upfront'}
                onChange={event => change({ timings: { ...form.timings, [id]: event.target.value === 'financed' } })}>
                <option value="upfront">À vista</option><option value="financed">Financiado</option>
              </select>
            </div>)}
            <div className="giro-cost giro-cost-profile">
              <label className="giro-cost-label" htmlFor="cx-profile">Perfil tributário</label>
              <div><select id="cx-profile" value={form.profile} {...fieldError('iof', 'cx-profile')} onChange={event => change({ profile: event.target.value, eligible: false })}>
                {Object.entries(PROFILES).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>{errors.iof && <small id="cx-profile-err" className="giro-error" role="alert">{errors.iof}</small>}</div>
            </div>
            {form.profile === 'simples' && <label className="giro-eligible"><input type="checkbox" checked={form.eligible} onChange={event => change({ eligible: event.target.checked })} /> Confirmo o enquadramento e a documentação da operação.</label>}
          </div>
        </fieldset>
        <button className="giro-simulate" type="submit">Simular</button>
      </form>

      {/* O quadro de resultado é o que o modo Apresentar mostra em "Resultado". */}
      <div className="rt-outcome giro-outcome calc-result-shell" aria-live="polite">
        <Resultado id="giro-result-title" number={3} className="giro-result" alert={resultAlert}>
          {flexNotice && <small className="rt-alert">{flexNotice}</small>}
          <Respostas items={[
            { question: 'Quanto entra no caixa', value: moneyText(result?.net), note: result ? `Valor líquido, de ${brl(result.value)} solicitados` : 'Valor líquido liberado' },
            { question: paymentQuestion, value: moneyText(isBullet ? last?.payment : result?.installment), note: paymentNote },
            { question: 'Quanto paga no total', value: moneyText(result?.total), note: totalNote },
            { question: 'Quanto custa', value: result ? percent(result.cet) : '—', note: 'Custo Efetivo Total (CET), em dias corridos', main: true },
          ]} />
          <ComposicaoDoCusto parts={parts} format={moneyText} total={{ label: 'Custo total', value: result?.cost }} rows={[
            { label: 'Saldo financiado', value: moneyText(result?.financedBalance), kind: 'muted' },
            ...(result?.capitalizedGrace > 0 ? [{ label: 'Juros da carência somados ao saldo', value: brl(result.capitalizedGrace), kind: 'muted' }] : []),
          ]} />
        </Resultado>
        <EmailEnvelope href={email?.href} copiar={email?.copiar} />
      </div>
    </div>

    {result ? <details className="giro-installments">
      <summary>Ver parcelas{adjusted > 0 && <small> · {adjusted === 1 ? '1 ajustada' : `${adjusted} ajustadas`}</small>}</summary>
      <div className="giro-table-tools">
        <Help title="Parcelas e ajustes (flex)">
          <p>O CET usa o valor líquido e as parcelas deste cronograma, em centavos. Nas tabelas Price e SAC, o arredondamento pode gerar diferenças de centavos entre parcelas ou amortizações.</p>
          <p>Ajustar uma parcela: mude a data e/ou o valor do pagamento. A parcela ajustada fica fixa. As anteriores à primeira ajustada não mudam; as seguintes, não ajustadas, são recalculadas juntas para quitar o saldo no último vencimento: no Price com um mesmo pagamento, no SAC com uma mesma amortização. Pode ajustar várias.</p>
          <p>Data ajustada: passa para o próximo dia útil se cair em fim de semana ou feriado e precisa ficar entre a parcela anterior e a seguinte. Ajustada só na data, a parcela mantém a amortização: adiada, ela sobe (mais dias de juros) e as seguintes caem um pouco; antecipada, o contrário.</p>
          <p>Valor ajustado: não pode ser menor que os juros do período. Se as parcelas ajustadas quitarem o saldo antes do fim, as restantes saem e a operação termina antes.</p>
          <p>A última parcela sempre fecha o saldo: por arredondamento, ela pode ficar alguns centavos diferente do valor digitado, mesmo quando foi ajustada.</p>
          <p>O IOF, o total pago, o custo e o CET usam o fluxo ajustado. O IOF é calculado sobre esse fluxo; numa quitação antecipada de um contrato já assinado, o IOF já pago não é devolvido.</p>
          <p>Qualquer mudança na demanda ou nos encargos desfaz os ajustes.</p>
        </Help>
        {Object.keys(flex).length > 0 && <button type="button" className="giro-link" onClick={resetFlex}>Desfazer ajustes</button>}
      </div>
      {result.earlyEnd && <p className="giro-notice" role="status">A operação termina antes: quitada na parcela {result.earlyEnd.number}, em {dmy(result.earlyEnd.date)}.</p>}
      <div className="giro-table-scroll" role="region" aria-label="Cronograma de pagamentos" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Parcela</th><th scope="col">Vencimento</th><th scope="col">Amortização</th><th scope="col">Juros</th><th scope="col">Pagamento</th><th scope="col">Saldo</th>{!isBullet && <th scope="col"><span className="giro-sr">Ajuste</span></th>}</tr></thead>
          <tbody>{result.rows.flatMap(row => [<tr key={row.number} className={row.fixed ? 'is-fixed' : undefined}>
            <th scope="row">{row.number}{row.juros && <small> só juros</small>}{row.fixed && <small> ajustada</small>}</th><td>{dmy(row.date)}</td><td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td><td>{brl(row.balance)}</td>
            {!isBullet && <td><button type="button" className="giro-link" aria-label={`Ajustar parcela ${row.number}`} aria-expanded={editing === row.number}
              onClick={() => { setEditing(editing === row.number ? null : row.number); setFlexError(null) }}>Ajustar</button></td>}
          </tr>, editing === row.number && <FlexEditor key={`edit-${row.number}`} row={row} error={flexError}
            onApply={applyFlex(row.number)} onCancel={() => { setEditing(null); setFlexError(null) }} />])}</tbody>
          <tfoot><tr><th scope="row" colSpan={4}>Total das parcelas</th><td>{brl(result.paid)}</td><td>—</td>{!isBullet && <td />}</tr></tfoot>
        </table>
      </div>
      <details className="giro-settings giro-comparison">
        <summary>Comparar amortizações</summary>
        <div className="giro-table-scroll" role="region" aria-label="Comparação dos sistemas" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Amortização</th><th scope="col">Total pago</th><th scope="col">Juros totais</th><th scope="col">CET</th></tr></thead>
            <tbody>{SYSTEMS.filter(system => system.id !== 'bullet' || isBullet).map(system => {
              const item = system.id === lm.system ? result : giroConta({ ...params, system: system.id })
              return <tr key={system.id}><th scope="row">{system.label}</th><td>{item.ok ? brl(item.total) : '—'}</td><td>{item.ok ? brl(item.interest) : '—'}</td><td>{item.ok ? percent(item.cet) : '—'}</td></tr>
            })}</tbody>
          </table>
        </div>
      </details>
    </details> : <button className="giro-installments giro-installments-disabled" type="button" disabled>Ver parcelas</button>}
    {/* Taxa prefixada: a referência é a curva DI x pré da B3. */}
    <ReferenciaMercado tipos={['pre']} prazoMeses={schedule.ok ? schedule.term : undefined} />
    {/* Depois da referência de mercado, o fluxo de pagamentos da simulação em barras, mês a mês (22/11/2026). */}
    {result && <FluxoPagamentos rows={result.rows} inicio={lm.start} />}
  </section>
}
