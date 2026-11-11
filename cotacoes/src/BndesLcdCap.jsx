import { useMemo, useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import Help from './CalculatorHelp.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { useDataFile } from './useDataFile.js'
import { dmy } from './format.js'
import { LCDCAP_SOURCE, lcdQuoteAt, parseLcdSchedule, simulateLcdCap } from './bndesLcdCap.js'
import { BNDES_PROFILE_IOF_OPTIONS } from './bndesProfileIof.js'
import { LCD_SNAPSHOT_AS_OF, withOfficialLcdSnapshot } from './lcdOfficialSnapshot.js'
import './BndesLcdCap.css'

const brl = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = text => text.trim().replace(',', '.')
const number = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
const percent = rate => `${(rate * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
export function LcdIcon() { return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 20h18M5 17V9h4v8m2 0V5h4v12m2 0v-5h4v5M3 4l4 1 4-3 4 1 6-2" /></svg> }

function BalanceChart({ result }) {
  const points = [{ date: result.rows[0].from, value: result.totals.principalCents }, ...result.rows.map(row => ({ date: row.date, value: row.closingCents }))]
  const max = Math.max(...points.map(point => point.value)), from = Date.parse(points[0].date), duration = Date.parse(points.at(-1).date) - from
  const line = points.map(point => `${40 + (Date.parse(point.date) - from) / duration * 920},${160 - point.value / max * 140}`).join(' ')
  return <figure className="lcd-chart"><figcaption>Saldo após cada cobrança · projeção informada</figcaption><svg viewBox="0 0 1000 190" role="img" aria-label="Evolução projetada do saldo, da liberação à quitação. Valores disponíveis no cronograma abaixo."><path d="M40 20V160H960" fill="none" stroke="currentColor" opacity="0.3" /><polyline points={line} fill="none" stroke="var(--amber, #ffb000)" strokeWidth="3" /><text x="40" y="184">{dmy(points[0].date)}</text><text x="960" y="184" textAnchor="end">{dmy(points.at(-1).date)}</text><text x="45" y="16">Máximo {brl(max)}</text></svg></figure>
}

export default function BndesLcdCap({ onBack }) {
  const moedas = useDataFile('moedas.json')
  const moedasData = useMemo(() => withOfficialLcdSnapshot(moedas.data), [moedas.data])
  const [principalText, setPrincipal] = useState(''), [feeText, setFee] = useState('')
  const [contractDate, setContractDate] = useState(''), [releaseDate, setReleaseDate] = useState('')
  const [ld1Text, setLd1] = useState(''), [fixingDate, setFixingDate] = useState(''), [ld1Source, setLd1Source] = useState('')
  const [bndes, setBndes] = useState(''), [intermediation, setIntermediation] = useState(''), [agent, setAgent] = useState('')
  const [selic, setSelic] = useState(''), [scenarioAccepted, setScenarioAccepted] = useState(false), [ld1Confirmed, setLd1Confirmed] = useState(false)
  const [iofProfile, setIofProfile] = useState('zero'), [iofEligible, setIofEligible] = useState(false)
  const [scheduleText, setScheduleText] = useState(''), [scheduleSource, setScheduleSource] = useState(''), [scheduleConfirmed, setScheduleConfirmed] = useState(false)
  const principal = parseMoneyInput(principalText), fee = parseMoneyInput(feeText, { optional: true }), schedule = parseLcdSchedule(scheduleText)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const quote = lcdQuoteAt(moedasData, contractDate, today)
  const result = simulateLcdCap({ mode: 'projection', principalCents: principal.ok ? Math.round(principal.value * 100) : null, releaseFeeCents: fee.ok ? Math.round(fee.value * 100) : null, contractDate, releaseDate,
    ld1: { annualPct: decimal(ld1Text), fixingDate, source: ld1Source, confirmed: ld1Confirmed },
    spreads: { bndes: decimal(bndes), intermediation: decimal(intermediation), agent: decimal(agent) },
    selicScenario: { annualPct: decimal(selic), acknowledged: scenarioAccepted }, schedule: { events: schedule.events, source: scheduleSource, confirmed: scheduleConfirmed },
    iof: { profile: iofProfile, eligible: iofProfile === 'simples' && iofEligible } })
  const field = (id, label, value, setValue, type = 'text', hint) => <div className="cx-field"><div className="cx-field-label"><label htmlFor={`lcd-${id}`}>{label}</label>{hint && <Help title={label}>{hint}</Help>}</div><input id={`lcd-${id}`} type={type} inputMode={type === 'text' && !['source', 'schedule-source'].includes(id) ? 'decimal' : undefined} value={value} onChange={event => setValue(event.target.value)} autoComplete="off" /></div>
  const selicPoints = moedasData?.series?.['143']?.points?.filter(point => point[0] <= today) ?? []
  const lastSelic = selicPoints.at(-1)
  const methodology = <><p>Fator Selic do cenário = (1 + Selic anual / 100) elevado a (DU / 252). Saldo corrigido = saldo inicial × fator Selic. Fator de juros = (1 + (BNDES + intermediação + agente + LD1) / 100) elevado a (DU / 252). Juros exigíveis = saldo corrigido × (fator de juros − 1). A amortização reduz o saldo corrigido.</p><p>O cálculo contratual exige a trajetória diária da Selic com a defasagem D-2. O histórico 143 de seis casas não é convertido em taxa anual nem usado como fator contratual exato. Esta versão calcula apenas o cenário informado, com arredondamentos de projeção, e não certifica elegibilidade nem condições comerciais.</p><p>CET (Res. CMN 4.881/2020, art. 4º): taxa anual que iguala o valor líquido liberado ao valor presente das parcelas, em dias corridos/365 desde a liberação. Pelo art. 5º, a Selic fica fora: as parcelas são recalculadas com Selic zero, só com LD1 e remunerações, fixadas no contrato. Mesmas datas e mesma base de juros (dias úteis/252). Valor líquido = valor liberado menos a tarifa informada e o IOF escolhido, ambos cobrados na liberação. IOF diário sobre o principal de cada amortização, sem a Selic capitalizada, em dias corridos até o vencimento e com teto de 365 dias; adicional de 0,38% sobre o valor.</p><p><a href={LCDCAP_SOURCE} target="_blank" rel="noreferrer">BNDES · Anexo IV, seção 5 (LCDCAP)</a>. Perfil separado do Finame/TFC e da TLP exigível.</p></>
  return <section className="cx cx-lcd" aria-labelledby="lcd-title">
    <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
    <h2 id="lcd-title" className="cx-title"><span className="cx-icon"><LcdIcon /></span>BNDES · Selic capitalizada + LCD</h2>
    <p className="status">Projeção · CET pela regra do BC, sem Selic</p>
    <article className="desk-panel cx-panel">
      <header><h3 className="cx-heading">Condições da operação<Help title="Modalidade LCDCAP">Projeção da modalidade LCDCAP para operações indiretas. A Selic aumenta o saldo; LD1 e remunerações são cobradas nos vencimentos. TLP exigível é uma modalidade diferente e não usa este motor.</Help></h3></header>
      <div className="cx-form">
        <div className="cx-field"><div className="cx-field-label"><label htmlFor="lcd-principal">Valor liberado</label><Help title="Valor liberado">Informe o valor liberado, sem encargos financiados.</Help></div><MoneyInput id="lcd-principal" value={principalText} onChange={setPrincipal} /></div>
        <div className="cx-field"><div className="cx-field-label"><label htmlFor="lcd-fee">Tarifa na liberação (opcional)</label><Help title="Tarifa na liberação">Tarifas e encargos pagos pelo cliente na liberação. Só entram no CET: o valor líquido é o valor liberado menos esta tarifa. Não mudam juros nem parcelas. O IOF é escolhido no campo ao lado e também sai do valor líquido.</Help></div><MoneyInput id="lcd-fee" value={feeText} onChange={setFee} /></div>
        <div className="cx-field"><div className="cx-field-label"><label htmlFor="lcd-iof">IOF</label><Help title="IOF da operação"><p>Zero é a premissa de recursos BNDES/FINAME elegíveis. O painel cita o Decreto 6.306/2007, art. 8º, IX, que trata de recursos FINAME. A alíquota zero depende do enquadramento dos recursos desta operação, e o painel não verifica isso. Também não foi conferido aqui se essa regra alcança a linha Selic + LCD fora do FINAME: confirme com a instituição.</p><p>Sem enquadramento, escolha PJ geral (0,0082% ao dia) ou Simples/MEI (0,00274% ao dia em operação de até R$ 30 mil), mais 0,38% de adicional sobre o valor. O IOF diário incide sobre o principal de cada amortização, sem a Selic capitalizada, pelos dias corridos da liberação ao vencimento, com teto de 365 dias. Tudo é cobrado na liberação: entra no valor líquido do CET e não muda juros nem parcelas.</p></Help></div><select id="lcd-iof" value={iofProfile} onChange={event => { setIofProfile(event.target.value); setIofEligible(false) }}>{BNDES_PROFILE_IOF_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>{iofProfile === 'zero' ? <p className="cx-hint">Alíquota zero depende do enquadramento dos recursos; o painel não verifica.</p> : iofProfile === 'simples' ? <label className="lcd-check" htmlFor="lcd-iof-eligible"><input id="lcd-iof-eligible" type="checkbox" checked={iofEligible} onChange={event => setIofEligible(event.target.checked)} />Confirmo a opção pelo Simples/MEI e o enquadramento com a instituição.</label> : null}</div>
        {field('contract', 'Data da contratação', contractDate, value => { setContractDate(value); setLd1Confirmed(false) }, 'date')}
        {field('release', 'Data da liberação', releaseDate, value => { setReleaseDate(value); setScheduleConfirmed(false) }, 'date')}
        {field('selic', 'Selic do cenário (% a.a.)', selic, value => { setSelic(value); setScenarioAccepted(false) }, 'text', 'Hipótese constante de Selic fornecida por você para os dias úteis de toda a projeção. Não há taxa futura oficial preenchida automaticamente.')}
        <div className="cx-field-label lcd-full"><label className="lcd-check"><input type="checkbox" checked={scenarioAccepted} onChange={event => setScenarioAccepted(event.target.checked)} />Confirmo a Selic como cenário.</label><Help title="Confirmação do cenário Selic">Confirmo que essa Selic é um cenário de projeção, constante em todos os dias úteis informados; não é uma taxa futura oficial.</Help></div>
        <div className="cx-field lcd-full"><div className="cx-field-label"><span className="cx-label">Índice Selic 143 (D-2)</span><Help title="Índice histórico Selic 143">Índice histórico Selic acumulada D-2 (143). É um índice, não uma taxa de 143% nem a Selic anual. D-2 já corresponde à defasagem de dois dias úteis.</Help></div><p className="cx-hint">{lastSelic ? `${number(lastSelic[1])} em ${dmy(lastSelic[0])}` : moedas.status === 'loading' ? 'Carregando' : 'Indisponível'} · <a href="#bndes/moedas/143?p=12m">Ver gráfico 143</a></p></div>
        {field('ld1', 'LD1 contratada (% a.a.)', ld1Text, value => { setLd1(value); setLd1Confirmed(false) }, 'text', 'Sobretaxa LCD fixada no contrato. Novas divulgações não reprecificam este contrato.')}
        {field('fixing', 'Data da referência LD1', fixingDate, value => { setFixingDate(value); setLd1Confirmed(false) }, 'date', 'Data da referência LD1 usada na contratação.')}
        {field('source', 'Fonte da LD1 contratada', ld1Source, value => { setLd1Source(value); setLd1Confirmed(false) }, 'text', 'Registre a fonte da sobretaxa fixada na contratação.')}
        <div className="cx-field">
          <div className="cx-field-label"><span className="cx-label">Referência LD1 do snapshot</span><Help title="Referência histórica LD1">Histórico oficial consultado em {dmy(LCD_SNAPSHOT_AS_OF)}. Datas posteriores à cobertura não têm referência confirmada nesta versão. Confirme a taxa do seu contrato antes de aceitar esta referência.</Help></div>
          <p className="cx-hint">{quote ? `${number(Number(quote.annualPct))}% a.a. em ${dmy(quote.date)}${quote.retainedSince ? ' · snapshot, sem atualização automática' : ''}. Confirme a taxa do seu contrato.` : 'Sem referência verificada para a data da contratação. Informe a taxa e a fonte do contrato.'}</p>
          <button type="button" disabled={!quote} onClick={() => { setLd1(quote.annualPct.replace('.', ',')); setFixingDate(quote.date); setLd1Source(quote.source); setLd1Confirmed(false) }}>Preencher com esta referência</button>
          <p className="cx-hint">Histórico consultado: {dmy(LCD_SNAPSHOT_AS_OF)} · <a href="#bndes/moedas/LD1?p=12m">Ver gráfico LD1</a></p>
        </div>
        <div className="cx-field-label lcd-full"><label className="lcd-check"><input type="checkbox" checked={ld1Confirmed} onChange={event => setLd1Confirmed(event.target.checked)} />Conferi a LD1 do contrato.</label><Help title="Confirmação da LD1">Conferi a sobretaxa fixada na contratação. Novas divulgações não reprecificam este contrato.</Help></div>
        {field('bndes', 'Remuneração BNDES (% a.a.)', bndes, setBndes, 'text', 'Remuneração básica do BNDES. Preencha inclusive zero quando não aplicável.')}
        {field('intermediation', 'Intermediação financeira (% a.a.)', intermediation, setIntermediation, 'text', 'Preencha inclusive zero quando não aplicável.')}
        {field('agent', 'Remuneração do agente (% a.a.)', agent, setAgent, 'text', 'Preencha inclusive zero quando não aplicável. As três remunerações e LD1 são somadas antes da conversão por DU/252.')}
      </div>
    </article>
    <article className="desk-panel cx-panel">
      <header><h3 className="cx-heading">Cronograma informado<Help title="Cronograma completo">Use datas de vencimento já ajustadas. Os dias úteis são contados desde a liberação ou cobrança anterior. C cobra somente juros fixos; A também amortiza o saldo corrigido dividido pelas amortizações restantes. A carência vem antes de todas as amortizações. Inclua o vencimento final.</Help></h3></header>
      <div className="cx-form">
        <div className="cx-field lcd-full"><div className="cx-field-label"><label htmlFor="lcd-schedule">Cobranças</label><Help title="Formato das cobranças">Uma cobrança por linha: data; dias úteis; C ou A. Use C para carência e A para amortização.</Help></div><textarea id="lcd-schedule" value={scheduleText} onChange={event => { setScheduleText(event.target.value); setScheduleConfirmed(false) }} rows="7" spellCheck="false" placeholder="AAAA-MM-DD; dias úteis; C (carência) ou A (amortização)" />{scheduleText && !schedule.ok && <p className="cx-error" role="alert">{schedule.error.message}</p>}</div>
        {field('schedule-source', 'Origem das datas e dias úteis', scheduleSource, value => { setScheduleSource(value); setScheduleConfirmed(false) }, 'text', 'Registre a origem das datas e das contagens de dias úteis de cada período.')}
        <div className="cx-field-label lcd-full"><label className="lcd-check"><input type="checkbox" checked={scheduleConfirmed} onChange={event => setScheduleConfirmed(event.target.checked)} />Conferi datas, dias úteis e periodicidades.</label><Help title="Confirmação do cronograma">Conferi o cronograma, as periodicidades contratuais, datas ajustadas e dias úteis de cada período.</Help></div>
      </div>
    </article>
    <article className="desk-panel cx-panel" aria-live="polite">
      <header><h3 className="cx-heading">Projeção do fluxo<Help title="Memória de cálculo e limites">{methodology}</Help></h3><small>Projeção · CET sem Selic</small></header>
      {!result.ok ? <p className="status cx-pad" role="status">{!principalText.trim() ? 'Preencha o valor liberado e as condições da operação para projetar o fluxo.' : <>Resultado indisponível: {scheduleText && !schedule.ok ? schedule.error.message : !fee.ok ? `Tarifa na liberação: ${fee.error}` : result.error.message} Dados ausentes não são tratados como zero.</>}</p> : <>
        <div className="fm-grade">
          <div className="fm-kpi"><span className="cx-field-label">Remunerações + LD1<Help title="Remunerações + LD1">Componente exigível, convertido pela base de 252 dias úteis.</Help></span><b>{number(result.fixedAnnualPct)}% a.a.</b></div>
          <div className="fm-kpi"><span className="cx-field-label">Selic capitalizada<Help title="Selic capitalizada">Valor incorporado ao saldo projetado.</Help></span><b>{brl(result.totals.capitalizedSelicCents)}</b></div>
          <div className="fm-kpi"><span className="cx-field-label">Juros exigíveis<Help title="Juros exigíveis">Juros sem duplicar a Selic no pagamento, pois ela já foi incorporada ao saldo.</Help></span><b>{brl(result.totals.interestCents)}</b></div>
          <div className="fm-kpi"><span className="cx-field-label">Pagamentos projetados<Help title="Pagamentos projetados">Total das parcelas, sem o IOF cobrado na liberação e sem outras despesas.</Help></span><b>{brl(result.totals.paymentCents)}</b></div>
        </div>
        <div className="fm-grade lcd-cet">
          <div className="fm-kpi"><span className="cx-field-label">CET · parte fixa (regra do BC)<Help title="CET · parte fixa">Taxa anual que iguala o valor líquido liberado ao valor presente das parcelas, em dias corridos/365 desde a liberação (Res. CMN 4.881/2020, art. 4º). Pelo art. 5º, a Selic fica fora: parcelas recalculadas só com LD1 e remunerações, mesmas datas e base de juros. Valor líquido sem a tarifa e o IOF, cobrados na liberação.</Help></span><b>{result.cet.fixedAnnualRate == null ? 'Indisponível' : percent(result.cet.fixedAnnualRate)}</b><small>{result.cet.fixedAnnualRate == null ? (result.cet.fixedUnavailable || 'Taxa negativa ou sem solução: o painel não mostra CET abaixo de zero.') : `LD1 + remunerações, sem Selic · líquido ${brl(result.cet.netReleaseCents)}`}</small></div>
          <div className="fm-kpi"><span className="cx-field-label">Custo com Selic projetada<Help title="Custo com Selic projetada">Mesmo método do CET, aplicado às parcelas projetadas completas, com a Selic do cenário. Não é o CET regulatório: depende da hipótese de Selic.</Help></span><b>{result.cet.projectedAnnualRate == null ? 'Indisponível' : percent(result.cet.projectedAnnualRate)}</b><small>{result.cet.projectedAnnualRate == null ? 'Sem solução para este fluxo.' : `Selic de ${number(result.annualSelicScenarioPct)}% a.a. no cenário`}</small></div>
          <div className="fm-kpi"><span className="cx-field-label">IOF na liberação<Help title="IOF na liberação">Adicional sobre o valor mais o diário sobre o principal de cada amortização, em dias corridos até o vencimento, com teto de 365 dias. Cobrado na liberação e descontado do valor líquido nas duas linhas de custo. Alíquota zero só vale se os recursos forem enquadrados; o painel não verifica.</Help></span><b>{brl(result.iof.totalCents)}</b><small>{result.iof.profile === 'zero' ? 'Alíquota zero · enquadramento não verificado' : `${brl(result.iof.additionalCents)} adicional + ${brl(result.iof.dailyCents)} diário`}</small></div>
        </div>
        <BalanceChart result={result} />
        <div className="cx-wrap" role="region" tabIndex="0" aria-label="Cronograma da projeção LCDCAP"><table className="cx-matrix lcd-table"><caption>Projeção · Selic constante de {number(result.annualSelicScenarioPct)}% a.a.</caption><thead><tr><th>Data</th><th>DU</th><th>Saldo inicial</th><th>Selic no saldo</th><th>Saldo corrigido</th><th>Juros exigíveis</th><th>Amortização</th><th>Pagamento</th><th>Saldo final</th></tr></thead><tbody>{result.rows.map(row => <tr key={row.date}><th scope="row">{dmy(row.date)}{row.phase === 'grace' && ' · carência'}</th><td>{row.businessDays}</td>{['openingCents', 'capitalizedSelicCents', 'correctedCents', 'interestCents', 'amortizationCents', 'paymentCents', 'closingCents'].map(key => <td key={key}>{brl(row[key])}</td>)}</tr>)}</tbody></table></div>
        <ul className="lcd-warnings">{result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
      </>}
    </article>
  </section>
}
