import { useCallback, useEffect, useRef, useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { IOF_SOURCE } from './iofRules.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday, cgAddDays } from './contaGarantida.js'
import { useDataFile } from './useDataFile.js'
import { creditOperation, equivalentCredit, creditMarketReference } from './creditComparison.js'
import './CreditComparison.css'

const brl = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = v => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : 'Não mensurável'
const day = d => d.split('-').reverse().join('/')
const initial = () => ({ value: '500.000,00', n: '24', rate: '1,45', unit: 'am', system: 'price', rateType: 'fixed', cdiPercent: '100', start: cgToday(), firstDue: cgAddDays(cgToday(), 30), profile: 'pj', eligible: false, fees: '0', monthlyFees: '0', guarantee: 'Não informada', guaranteeValue: '', holidays: '' })
function parse(form, cdi) {
  const result = { ...form, cdi }
  for (const key of ['value', 'fees', 'monthlyFees']) result[key] = parseMoneyInput(form[key]).value ?? NaN
  for (const key of ['n', 'rate', 'cdiPercent']) result[key] = parseDecimal(form[key]) ?? NaN
  result.guaranteeValue = form.guaranteeValue.trim() ? (parseMoneyInput(form.guaranteeValue).value ?? NaN) : null
  result.holidays = form.holidays.trim() ? form.holidays.trim().split(/[\s,;]+/) : []
  return result
}
export function CreditIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h7v16H3zM14 4h7v16h-7zM5 8h3M16 8h3M5 12h3M16 12h3M5 16h3M16 16h3" /></svg>
}
function Proposal({ form, set, name }) {
  const prefix = `credit-${name}`
  const update = (key, value) => set({ ...form, [key]: value })
  const field = (key, label, options) => <label className="credit-field" htmlFor={`${prefix}-${key}`}><span>{label}</span>{options ? <select id={`${prefix}-${key}`} value={form[key]} onChange={e => update(key, e.target.value)}>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : <input id={`${prefix}-${key}`} type={['start', 'firstDue'].includes(key) ? 'date' : 'text'} inputMode={['n', 'rate', 'cdiPercent'].includes(key) ? 'decimal' : undefined} value={form[key]} onChange={e => update(key, e.target.value)} />}</label>
  const amount = (key, label) => <label className="credit-field" htmlFor={`${prefix}-${key}`}><span>{label}</span><MoneyInput id={`${prefix}-${key}`} value={form[key]} onChange={v => update(key, v)} /></label>
  return <article className="desk-panel credit-proposal"><h3>Operação {name} · Capital de Giro</h3><div className="credit-fields">
    {amount('value', 'Valor contratado')}{field('rateType', 'Tipo de taxa', [['fixed', 'Prefixada'], ['cdi', 'CDI + spread']])}
    {field('rate', form.rateType === 'fixed' ? 'Taxa efetiva (%)' : 'Spread efetivo (%)')}{field('unit', 'Unidade da taxa', [['am', 'Ao mês'], ['aa', 'Ao ano']])}
    {form.rateType === 'cdi' && field('cdiPercent', 'Percentual do CDI (%)')}
    {field('system', 'Amortização', [['price', 'Price'], ['sac', 'SAC'], ['bullet', 'Bullet capitalizado']])}
    {form.system !== 'bullet' && field('n', 'Quantidade de parcelas')}
    {field('start', 'Liberação')}{field('firstDue', form.system === 'bullet' ? 'Vencimento único' : 'Primeiro vencimento')}
  </div><details><summary>Encargos, garantia e calendário</summary><div className="credit-fields">
    {amount('fees', 'Encargos na liberação (sem IOF)')}{amount('monthlyFees', 'Encargos em cada pagamento')}
    {field('profile', 'Enquadramento IOF', [['pj', 'Pessoa jurídica'], ['simples', 'Simples Nacional / MEI']])}
    {form.profile === 'simples' && <label><input type="checkbox" checked={form.eligible} onChange={e => update('eligible', e.target.checked)} /> Confirmo a opção pelo Simples/MEI</label>}
    {field('guarantee', 'Tipo / descrição da garantia')}{amount('guaranteeValue', 'Valor da garantia (opcional)')}
  </div>{form.rateType === 'cdi' && <label className="credit-field" htmlFor={`${prefix}-holidays`}>Feriados do calendário contratado (AAAA-MM-DD)<textarea id={`${prefix}-holidays`} value={form.holidays} onChange={e => update('holidays', e.target.value)} /></label>}
  <p>Encargos iniciais e IOF são descontados do crédito. Inclua tarifas, seguros e demais despesas aplicáveis nos dois campos de encargos. Garantia sem valor informado não gera cobertura.</p></details></article>
}
function Results({ a, b, forms, scenario, cdi, source, equivalent }) {
  if (!a.ok || !b.ok) return <div role="status" className="credit-errors">{!a.ok && <p>Operação A: {a.error}</p>}{!b.ok && <p>Operação B: {b.error}</p>}</div>
  const conditions = f => `${f.rateType === 'fixed' ? 'Prefixada' : `${f.cdiPercent}% do CDI + spread`} · ${f.rate}% ${f.unit === 'am' ? 'a.m.' : 'a.a.'}`
  const rows = [
    ['Taxa / indexador / spread', conditions(forms[0]), conditions(forms[1])],
    ['Sistema e pagamentos', `${forms[0].system.toUpperCase()} · ${a.rows.length} pagamento(s)`, `${forms[1].system.toUpperCase()} · ${b.rows.length} pagamento(s)`],
    ['Liberação / primeiro vencimento', `${day(forms[0].start)} / ${day(forms[0].firstDue)}`, `${day(forms[1].start)} / ${day(forms[1].firstDue)}`],
    ['Valor contratado', brl(a.value), brl(b.value)], ['Valor líquido recebido', brl(a.net), brl(b.net)],
    ['CET estimado · a.a.', pct(a.cet * 100), pct(b.cet * 100)], ['Juros totais', brl(a.interest), brl(b.interest)],
    ['IOF', brl(a.iof), brl(b.iof)], ['Encargos totais (sem IOF)', brl(a.fees + a.monthlyFees * a.rows.length), brl(b.fees + b.monthlyFees * b.rows.length)],
    ['Total desembolsado', brl(a.total), brl(b.total)], ['Custo sobre o líquido', brl(a.cost), brl(b.cost)],
    ['Maior pagamento', brl(a.maxPayment), brl(b.maxPayment)], ['Último vencimento', day(a.lastDate), day(b.lastDate)],
    ['Garantia', forms[0].guarantee || 'Não informada', forms[1].guarantee || 'Não informada'],
    ['Valor da garantia', brl(a.guaranteeValue), brl(b.guaranteeValue)], ['Cobertura nominal', pct(a.coverage), pct(b.coverage)],
    ['Carência capitalizada antes do primeiro período', `${a.graceDays} dias · ${brl(a.capitalizedGrace)}`, `${b.graceDays} dias · ${brl(b.capitalizedGrace)}`],
  ]
  return <div className="credit-results"><p className="credit-notice">Simulação · {scenario} · {equivalent ? 'Mesmo valor líquido' : 'Condições originais'}. {forms.some(f => f.rateType === 'cdi') && <>CDI constante de {pct(cdi)} a.a. · {source}. Projeção, não taxa futura garantida.</>}</p>
    <div className="credit-scroll"><table><caption>Comparação financeira das operações</caption><thead><tr><th scope="col">Indicador</th><th scope="col">Operação A</th><th scope="col">Operação B</th></tr></thead><tbody>{rows.map(([label, x, y]) => <tr key={label}><th scope="row">{label}</th><td>{x}</td><td>{y}</td></tr>)}</tbody></table></div>
    <section className="credit-analysis"><h3>Leitura consultiva</h3><p>CET estimado do fluxo informado, não certificado do contrato. Prefixado: juros compostos em dias corridos/30. CDI: dias úteis/252, somente segunda a sexta menos feriados informados. Carência capitalizada; sem ajuste automático de vencimentos. Confira as convenções contratuais.</p><p>Diferença de custo (B − A): <strong>{brl(b.cost - a.cost)}</strong>. Diferença da maior parcela (B − A): <strong>{brl(b.maxPayment - a.maxPayment)}</strong>.</p>
      <p>{Math.abs(a.net - b.net) >= 0.01 ? 'Os valores líquidos são diferentes. Use a comparação equivalente antes de comparar custos absolutos. ' : 'O líquido recebido é equivalente. '}Prazos, risco de juros e garantias também importam. Não há vencedor absoluto.</p><p>Cobertura nominal = valor da garantia ÷ crédito contratado. Não representa avaliação, liquidez ou aceitação pelo banco e não indica condição melhor ou pior.</p></section>
    <CreditChart a={a} b={b} />
    <details><summary>Fluxos completos e memória do cálculo</summary><p>Liberação: A recebe {brl(a.net)} em {day(forms[0].start)}; B recebe {brl(b.net)} em {day(forms[1].start)}. CET estimado desconta cada cobrança em dias corridos/365. Valores exibidos arredondados; cálculo usa precisão integral.</p>{[[a, 'A'], [b, 'B']].map(([r, label]) => <div className="credit-scroll" key={label}><table><caption>Operação {label} · pagamentos em reais</caption><thead><tr>{['Nº', 'Data', 'Amortização', 'Juros', 'Pagamento', 'Saldo'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{r.rows.map(row => <tr key={row.number}><td>{row.number}</td><td>{day(row.date)}</td><td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td><td>{brl(row.balance)}</td></tr>)}</tbody></table></div>)}</details>
  </div>
}
function CreditChart({ a, b }) {
  const start = Math.min(...[a, b].map(r => new Date(r.rows[0].date).getTime() - r.rows[0].days * 86400000))
  const end = Math.max(...[a, b].map(r => new Date(r.lastDate).getTime()))
  const max = Math.max(a.paid, b.paid, 1)
  const points = r => [{ date: new Date(new Date(r.rows[0].date).getTime() - r.rows[0].days * 86400000).toISOString().slice(0, 10), cumulative: 0 }, ...r.rows].map(row => `${40 + (new Date(row.date).getTime() - start) / (end - start) * 620},${210 - row.cumulative / max * 180}`).join(' ')
  return <figure className="credit-chart"><figcaption>Pagamentos acumulados · A em azul, B em laranja</figcaption><svg viewBox="0 0 700 250" role="img" aria-label={`Pagamentos acumulados até o fim de cada operação: A ${brl(a.paid)}, B ${brl(b.paid)}. Datas e valores completos na memória.`}><path d="M40 25V210H670" fill="none" stroke="currentColor" /><polyline points={points(a)} fill="none" stroke="#0075bf" strokeWidth="3" /><polyline points={points(b)} fill="none" stroke="#c76d00" strokeWidth="3" strokeDasharray="8 4" /><text x="40" y="240">Liberação</text><text x="510" y="240">Último vencimento</text></svg><p>Somente pagamentos futuros, sem descontos na liberação. Linhas ligam vencimentos e não representam cobranças diárias. O gráfico usa datas reais, inclusive prazos diferentes.</p></figure>
}
function Presentation({ children, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement, overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    window.addEventListener('hashchange', onClose)
    return () => { window.removeEventListener('hashchange', onClose); element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus() }
  }, [onClose])
  return <dialog className="credit-presentation" ref={dialog} onCancel={onClose} aria-labelledby="credit-presentation-title"><header><h2 id="credit-presentation-title">Comparador de Crédito</h2><button type="button" onClick={onClose}>Fechar ×</button></header>{children}</dialog>
}
export default function CreditComparison({ onBack }) {
  const [aForm, setA] = useState(initial), [bForm, setB] = useState(initial)
  const [scenario, setScenario] = useState('Base'), [manual, setManual] = useState(false), [cdiText, setCdi] = useState('')
  const [shock, setShock] = useState('2'), [equivalent, setEquivalent] = useState(false), [target, setTarget] = useState('500.000,00')
  const [present, setPresent] = useState(false), [confirmed, setConfirmed] = useState(null)
  const close = useCallback(() => setPresent(false), [])
  const macro = useDataFile('macro.json'), reference = creditMarketReference(macro.data)
  const baseCdi = manual ? parseDecimal(cdiText) : reference?.value
  const delta = parseDecimal(shock), cdi = scenario === 'Base' ? baseCdi : Number.isFinite(baseCdi) && delta !== null ? Math.max(0, baseCdi + (scenario === 'Alta' ? delta : -delta)) : NaN
  const usesCdi = [aForm, bForm].some(f => f.rateType === 'cdi')
  const source = manual ? 'Premissa manual' : reference ? `${reference.source} · observação ${day(reference.date)}${reference.stale || macro.stale ? ' · referência atrasada/atualização pendente' : ''}` : 'Referência indisponível'
  const simulate = form => {
    if (usesCdi && (!Number.isFinite(cdi) || !Number.isFinite(delta))) return { ok: false, error: 'Informe CDI e amplitude válidos ou aguarde a referência automática.' }
    const p = parse(form, form.rateType === 'cdi' ? cdi : 0)
    return equivalent ? equivalentCredit(p, parseMoneyInput(target).value) : creditOperation(p)
  }
  const a = simulate(aForm), b = simulate(bForm)
  const signature = JSON.stringify([aForm, bForm, scenario, cdi, source, equivalent, target])
  const complete = confirmed === signature
  const edit = setter => value => { setConfirmed(null); setter(value) }
  const content = <Results a={a} b={b} forms={[aForm, bForm]} scenario={scenario} cdi={cdi} source={source} equivalent={equivalent} />
  return <section className="cx credit-comparison" aria-labelledby="credit-title"><button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button><h2 id="credit-title">Comparador de Crédito</h2><p>Capital de Giro em reais · duas propostas, custos, fluxo de caixa e garantias.</p>
    <p className="credit-notice">Primeira versão: prefixado ou CDI, Price, SAC e Bullet capitalizado. BNDES, Conta Garantida e FINIMP mantêm calculadoras próprias. Não aplique estas regras a outras modalidades.</p>
    <div className="credit-pair"><Proposal form={aForm} set={edit(setA)} name="A" /><Proposal form={bForm} set={edit(setB)} name="B" /></div>
    {usesCdi && <section className="desk-panel credit-controls"><h3>Cenários do CDI</h3><p>{source}</p><label><input type="checkbox" checked={manual} onChange={e => edit(setManual)(e.target.checked)} /> Informar referência manual</label>{manual && <label className="credit-field">CDI base (% a.a.)<input inputMode="decimal" value={cdiText} onChange={e => edit(setCdi)(e.target.value)} /></label>}<label className="credit-field">Variação dos cenários (pontos percentuais a.a.)<input inputMode="decimal" value={shock} onChange={e => edit(setShock)(e.target.value)} /></label><div className="seg" aria-label="Cenário">{['Queda', 'Base', 'Alta'].map(s => <button type="button" key={s} aria-pressed={s === scenario} onClick={() => edit(setScenario)(s)}>{s}</button>)}</div><p>CDI constante em cada cenário; queda limitada a zero. Variação ilustrativa ajustável, não previsão de mercado. Referência de mercado não define o CDI futuro do contrato.</p></section>}
    <section className="desk-panel credit-controls"><label><input type="checkbox" checked={equivalent} onChange={e => edit(setEquivalent)(e.target.checked)} /> Comparar pelo mesmo valor líquido</label>{equivalent && <label className="credit-field" htmlFor="credit-target">Líquido comum<MoneyInput id="credit-target" value={target} onChange={edit(setTarget)} /></label>}<p>Recalcula o valor contratado necessário para o líquido comum, mantendo taxas, encargos fixos, prazos e garantias. Os valores originais permanecem nos formulários.</p></section>
    <label className="credit-confirm"><input type="checkbox" checked={complete} onChange={e => setConfirmed(e.target.checked ? signature : null)} /> Conferi todos os encargos e as convenções para esta simulação.</label>
    <p>CET estimado do fluxo informado, não CET certificado do contrato. {complete ? 'Conferência declarada pelo usuário; não é auditoria contratual.' : 'Encargos ainda não conferidos: resultados são preliminares.'}</p>
    <button type="button" disabled={!a.ok || !b.ok || !complete} onClick={() => setPresent(content)}>Apresentar comparação</button>
    {content}
    <details className="credit-method"><summary>Premissas, limites e fonte do IOF</summary><p>Prefixado: juros compostos em dias corridos/30 sobre a taxa mensal efetiva. CDI: dias úteis/252, de segunda a sexta menos os feriados informados; taxa diária equivalente do CDI multiplicada pelo percentual informado e então capitalizada nos dias úteis; o resultado é multiplicado pelo fator do spread anualizado. Não há calendário bancário nem ajuste de vencimentos automático.</p><p>Price tem pagamento financeiro constante calculado por fatores de desconto das datas; SAC amortiza o mesmo valor em cada parcela. Em ambos, dias até o primeiro vencimento que excederem 30 são carência com juros capitalizados. Bullet tem um único vencimento com capitalização integral. Encargos por pagamento não são capitalizados. IOF incide apenas sobre o principal original, com teto diário de 365 dias por amortização; encargos iniciais não são financiados.</p><p>Carência com juros pagos, cronogramas irregulares, múltiplas liberações, amortizações extraordinárias, renegociação e garantias compartilhadas não são simulados. Os cronogramas devem ser conferidos contra o contrato. <a href={IOF_SOURCE} target="_blank" rel="noreferrer">Fonte legal do IOF</a>. Regras automáticas compartilhadas com Capital de Giro, para PJ e Simples/MEI a partir de 17/07/2025.</p></details>
    {present && <Presentation onClose={close}>{present}</Presentation>}
  </section>
}
