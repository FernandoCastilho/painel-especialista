import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import Help from './CalculatorHelp.jsx'
import { simulateTlpExigivel, parseTlpSchedule, TLP_EXIGIVEL_SOURCE } from './bndesTlpExigivel.js'
import './BndesProfiles.css'

const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const date = iso => iso.split('-').reverse().join('/')
const rateText = value => value.trim().replace(',', '.')
const percent = rate => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
const EMPTY = { amount: '', fee: '', release: '', j: '', jSource: '', jConfirmed: false, bndes: '', agent: '', ipca: '', scenarioConfirmed: false, schedule: '', scheduleSource: '', scheduleConfirmed: false }

export function TlpIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 20V4M4 20h16M7 15l4-4 4 2 5-7M16 6h4v4" /></svg>
}

export default function BndesTlpExigivel({ onBack }) {
  const [form, setForm] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)
  const update = (key, value) => {
    setForm(previous => ({
      ...previous, [key]: value,
      ...(['j', 'jSource'].includes(key) ? { jConfirmed: false } : {}),
      ...(key === 'ipca' ? { scenarioConfirmed: false } : {}),
      ...(['release', 'schedule', 'scheduleSource'].includes(key) ? { scheduleConfirmed: false } : {}),
    }))
    setSubmitted(false)
  }
  const money = parseMoneyInput(form.amount)
  const fee = parseMoneyInput(form.fee, { optional: true })
  const schedule = parseTlpSchedule(form.schedule)
  const result = !submitted ? null : !money.ok ? { ok: false, error: { message: money.error } } : !fee.ok ? { ok: false, error: { message: `Tarifa na liberação: ${fee.error}` } } : !schedule.ok ? schedule : simulateTlpExigivel({
    mode: 'projection', principalCents: Math.round(money.value * 100), releaseFeeCents: Math.round(fee.value * 100), releaseDate: form.release,
    j: { annualPct: rateText(form.j), source: form.jSource, confirmed: form.jConfirmed },
    spreads: { bndes: rateText(form.bndes), agent: rateText(form.agent) },
    ipcaScenario: { annualPct: rateText(form.ipca), acknowledged: form.scenarioConfirmed },
    schedule: { events: schedule.events, source: form.scheduleSource, confirmed: form.scheduleConfirmed },
  })
  const field = (key, label, hint, type = 'text') => <div className="cx-field"><div className="cx-field-label"><label htmlFor={`tlp-${key}`}>{label}</label><Help title={label}><p>{hint}</p></Help></div><input id={`tlp-${key}`} type={type} value={form[key]} onChange={event => update(key, event.target.value)} inputMode={['j', 'bndes', 'agent', 'ipca'].includes(key) ? 'decimal' : undefined} autoComplete="off" /></div>
  const check = (key, label) => <label className="bndes-check" htmlFor={`tlp-${key}`}><input id={`tlp-${key}`} type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)} />{label}</label>
  return <section className="cx bndes-profile" aria-labelledby="tlp-heading">
    <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
    <h2 id="tlp-heading" className="cx-title"><span className="cx-icon"><TlpIcon /></span>BNDES TLP exigível</h2>
    <p className="status">Projeção de IPCA constante · Juros pagos nos vencimentos · CET pela regra do BC, sem IPCA · Não é TLPCAP</p>
    <p className="cx-hint">IPCA, J da TLP e spreads compõem os juros exigíveis. IPCA positivo não aumenta o principal, inclusive na carência. Informe o cronograma e as taxas do caso; nenhuma condição do Finame é transferida automaticamente.</p>
    <form onSubmit={event => { event.preventDefault(); setSubmitted(true) }} noValidate>
      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading">Condições da projeção<Help title="TLP exigível: regra e limite da projeção"><p>Regra da seção 1 do Anexo IV: juros = saldo × (fator TLP × fator spread − 1). O fator TLP contratual combina IPCA mensal defasado, aniversários no dia 15 e J em dias úteis/252. Os spreads BNDES e agente se multiplicam em dias úteis/252.</p><p>Esta projeção substitui os índices mensais por uma hipótese explícita de IPCA anual constante em DU/252. Não calcula uma memória histórica nem reproduz truncagem contratual de 16 casas. Não capitaliza IPCA no saldo.</p></Help></h3></header>
        <div className="cx-form">
          <div className="cx-field"><label htmlFor="tlp-amount">Principal financiado</label><MoneyInput id="tlp-amount" value={form.amount} onChange={value => update('amount', value)} /></div>
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="tlp-fee">Tarifa na liberação (opcional)</label><Help title="Tarifa na liberação"><p>Tarifas e encargos pagos pelo cliente na liberação. Só entram no CET: o valor líquido é o principal menos esta tarifa. Não mudam juros nem parcelas.</p><p>Esta calculadora não tem IOF. Em branco, o valor líquido é o próprio principal.</p></Help></div><MoneyInput id="tlp-fee" value={form.fee} onChange={value => update('fee', value)} /></div>
          {field('release', 'Data da liberação', 'Data útil efetiva. Não é a data de assinatura.', 'date')}
          {field('j', 'J da TLP aplicável (% a.a.)', 'Parcela real fixada para a contratação, já ajustada pelo fator aplicável. Não use o último J publicado como substituto automático do contratado. Zero deve ser informado explicitamente.')}
          {field('jSource', 'Fonte do J informado', 'Identifique o contrato ou a referência e sua data. Não inclua CPF, números de conta ou outros dados pessoais.')}
          {field('bndes', 'Spread BNDES (% a.a.)', 'Remuneração total do BNDES, incluindo intermediação financeira quando aplicável. Não some a intermediação duas vezes.')}
          {field('agent', 'Spread do agente (% a.a.)', 'Remuneração da instituição financeira aplicável ao contrato. Os fatores são multiplicados, não somados.')}
          {field('ipca', 'IPCA anual do cenário (%)', 'Hipótese constante, inclusive se negativa. Não é previsão garantida nem o IPCA mensal defasado usado no contrato.')}
          <div className="cx-field bndes-full">{check('jConfirmed', 'Conferi o J aplicável e sua fonte; ele já está ajustado para esta contratação.')}{check('scenarioConfirmed', 'Entendo que o IPCA constante em DU/252 é uma hipótese de projeção, não uma memória contratual.')}</div>
          <div className="cx-field bndes-full"><div className="cx-field-label"><label htmlFor="tlp-schedule">Cronograma de juros e amortização</label><Help title="Como informar o cronograma"><p>Uma linha por cobrança: data em AAAA-MM-DD; dias úteis do período; C para apenas juros na carência ou A para juros mais amortização SAC. Inclua todos os vencimentos até a quitação. Os dias úteis contam desde a liberação ou cobrança anterior.</p><p>Datas devem estar ajustadas conforme o contrato, inclusive feriados locais e bancários. A tela não cria nem certifica o calendário. Não há retorno à carência, múltiplas liberações ou pagamentos extraordinários.</p></Help></div><textarea id="tlp-schedule" value={form.schedule} onChange={event => update('schedule', event.target.value)} placeholder={'AAAA-MM-DD; DU; C\nAAAA-MM-DD; DU; A'} aria-describedby="tlp-schedule-hint" /><p id="tlp-schedule-hint" className="cx-hint">Formato: data; dias úteis; C ou A. Exemplo de sintaxe: 2027-02-15; 21; A. O número de dias é ilustrativo e precisa ser conferido.</p></div>
          {field('scheduleSource', 'Fonte das datas e dias úteis', 'Identifique a memória ou o calendário usado e as regras de vencimento. A confirmação não valida automaticamente a contagem informada.')}
          <div className="cx-field bndes-full">{check('scheduleConfirmed', 'Conferi datas ajustadas, dias úteis e periodicidades com a fonte informada.')}</div>
          <div className="bndes-full"><button className="cx-action" type="submit">Calcular projeção exigível</button></div>
        </div>
      </article>
    </form>
    <article className="desk-panel cx-panel" aria-live="polite">
      <header><h3 className="cx-heading">Resultado</h3><small>Sem IOF ou seguros · CET sem IPCA</small></header>
      {!result?.ok ? <p className="cx-hint cx-pad" role={result ? 'alert' : 'status'}>{result?.error?.message || 'Preencha e confirme as condições para calcular. Não há taxas ou datas presumidas.'}</p> : <>
        <div className="fm-grade">
          <div className="fm-kpi"><span>Principal inicial</span><b>{brl(result.totals.principalCents)}</b></div>
          <div className="fm-kpi"><span>Juros exigíveis</span><b>{brl(result.totals.interestCents)}</b><small>Inclui IPCA, J e spreads</small></div>
          <div className="fm-kpi"><span>Pagamentos projetados</span><b>{brl(result.totals.paymentCents)}</b><small>Principal e juros</small></div>
          <div className="fm-kpi"><span>Saldo final</span><b>{brl(result.totals.closingCents)}</b><small>Sem capitalização de IPCA positivo</small></div>
        </div>
        <div className="fm-grade tlp-cet">
          <div className="fm-kpi"><span className="cx-field-label">CET · parte fixa (regra do BC)<Help title="CET · parte fixa"><p>Taxa anual que iguala o valor líquido liberado ao valor presente das parcelas, em dias corridos/365 desde a liberação (Res. CMN 4.881/2020, art. 4º).</p><p>Pelo art. 5º, o IPCA fica fora. As parcelas são recalculadas só com J da TLP e spreads, que ficam fixos no contrato. Mesmas datas e mesma base de juros (dias úteis/252).</p><p>Valor líquido = principal menos a tarifa informada. Não há IOF nesta calculadora.</p></Help></span><b>{result.cet.fixedAnnualRate == null ? 'Indisponível' : percent(result.cet.fixedAnnualRate)}</b><small>{result.cet.fixedAnnualRate == null ? (result.cet.fixedUnavailable || 'Taxa negativa ou sem solução: o painel não mostra CET abaixo de zero.') : `J + spreads, sem IPCA · líquido ${brl(result.cet.netReleaseCents)}`}</small></div>
          <div className="fm-kpi"><span className="cx-field-label">Custo com IPCA projetado<Help title="Custo com IPCA projetado"><p>Mesmo método do CET, aplicado às parcelas projetadas completas, com o IPCA do cenário.</p><p>Não é o CET regulatório: depende da hipótese de IPCA.</p></Help></span><b>{result.cet.projectedAnnualRate == null ? 'Indisponível' : percent(result.cet.projectedAnnualRate)}</b><small>{result.cet.projectedAnnualRate == null ? 'Taxa negativa ou sem solução: o painel não mostra custo abaixo de zero.' : `IPCA de ${result.annualIpcaScenarioPct.toLocaleString('pt-BR')}% a.a. no cenário`}</small></div>
        </div>
        <div className="cx-wrap" role="region" aria-label="Cronograma TLP exigível" tabIndex={0}><table className="cx-matrix"><caption>Valores em reais. Juros negativos reduzem a prestação e, quando excedentes, o principal.</caption><thead><tr><th>Nº</th><th>Vencimento</th><th>DU</th><th>Saldo inicial</th><th>Juros exigíveis</th><th>Amortização</th><th>Redução por juros negativos</th><th>Pagamento</th><th>Saldo final</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.number}><th scope="row">{row.number}{row.phase === 'grace' ? ' · carência' : ''}</th><td>{date(row.date)}</td><td>{row.businessDays}</td>{['openingCents', 'interestCents', 'amortizationCents', 'negativeInterestPrincipalReductionCents', 'paymentCents', 'closingCents'].map(key => <td key={key}>{brl(row[key])}</td>)}</tr>)}</tbody></table></div>
        <ul className="cx-hint cx-pad">{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      </>}
    </article>
    <details className="bndes-limits"><summary>Fonte e limites desta calculadora</summary><p><a href={TLP_EXIGIVEL_SOURCE} target="_blank" rel="noreferrer">BNDES · Circular 13/2022, Anexo IV, seção 1 · TLP exigível</a>. A seção 2 trata de TLPCAP e não é usada aqui.</p><p>SAC com amortização do saldo remanescente. Sem Price, IOF, seguros, antecipações, liberação múltipla ou cálculo histórico de índices. Taxas e cronograma precisam ser confirmados separadamente; a aprovação do formulário não certifica o contrato.</p></details>
  </section>
}
