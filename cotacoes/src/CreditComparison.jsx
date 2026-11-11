import { useCallback, useEffect, useRef, useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { IOF_SOURCE } from './iofRules.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { useDataFile } from './useDataFile.js'
import { creditMarketReference } from './creditComparison.js'
import { MODALITIES, MIN_COLUMNS, MAX_COLUMNS, SYSTEM_OPTIONS, FINIMP_CURRENCY_LIST, PORTES, COMPOSICOES, PERIODICIDADES, FGI, initialColumns, initialShared, newColumn, evaluateAll, highlights, modalityLabel } from './creditModalities.js'
import { FINIMP_TERMS } from './finimpComparison.js'
import './CreditComparison.css'

const brl = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = v => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : 'Não mensurável'
const day = d => d.split('-').reverse().join('/')
const TERMS = [6, 12, 18, 24, 36, 48, 60, 72, 84]
const GRACES = [0, 3, 6, 12, 18, 24]
const GUARANTEES = ['', 'Aval', 'Recebíveis', 'Alienação fiduciária', 'Fundo garantidor (FGI)', 'Outra garantia']
const COLUMN_COLORS = ['#0075bf', '#c76d00', '#2a8a4a', '#8a3ffc', '#c2185b']
const COLUMN_DASH = ['', '8 4', '2 4', '10 3 2 3', '4 4']

export function CreditIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 4h7v16H3zM14 4h7v16h-7zM5 8h3M16 8h3M5 12h3M16 12h3M5 16h3M16 16h3" /></svg>
}
function ModalityIcon({ id }) {
  const paths = {
    'giro-pre': 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7',
    'giro-cdi': 'M3 17l6-6 4 4 8-8M15 7h6v6',
    bndes: 'M4 4h16v16H4zM9 8l7 4-7 4z',
    finimp: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    'conta-garantida': 'M4 7h16v12H4zM4 11h16M8 15h3',
    desconto: 'M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2zM9 9h6M9 13h6',
    outra: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[id] ?? paths.outra} /></svg>
}
const usesCdiIn = columns => columns.some(c => c.modality === 'giro-cdi' || (c.modality === 'outra' && c.rateType === 'cdi'))

function SharedFields({ shared, set }) {
  const update = (key, value) => set({ ...shared, [key]: value })
  return <section className="desk-panel credit-shared" aria-label="Condições comuns a todas as comparações">
    <label className="credit-field" htmlFor="credit-shared-value"><span>Valor da operação</span><MoneyInput id="credit-shared-value" value={shared.value} onChange={v => update('value', v)} /></label>
    <label className="credit-field" htmlFor="credit-shared-term"><span>Prazo</span><select id="credit-shared-term" value={shared.term} onChange={e => update('term', e.target.value)}>{TERMS.map(t => <option key={t} value={t}>{t} meses</option>)}</select></label>
    <label className="credit-field" htmlFor="credit-shared-grace"><span>Carência</span><select id="credit-shared-grace" value={shared.grace} onChange={e => update('grace', e.target.value)}>{GRACES.map(g => <option key={g} value={g}>{g === 0 ? 'Sem carência' : `${g} meses`}</option>)}</select></label>
    <label className="credit-field" htmlFor="credit-shared-system"><span>Amortização</span><select id="credit-shared-system" value={shared.system} onChange={e => update('system', e.target.value)}>{SYSTEM_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
    <label className="credit-field" htmlFor="credit-shared-start"><span>Data da liberação</span><input id="credit-shared-start" type="date" max="9999-12-31" value={shared.start} onChange={e => update('start', e.target.value)} /></label>
  </section>
}

function ColumnCard({ index, col, set, result, shared }) {
  const prefix = `credit-c${index + 1}`
  const update = (key, value) => set({ ...col, [key]: value })
  const text = (key, label, opts = {}) => <label className="credit-field" htmlFor={`${prefix}-${key}`}><span>{label}</span><input id={`${prefix}-${key}`} type={opts.type ?? 'text'} inputMode={opts.type || opts.numeric === false ? undefined : 'decimal'} placeholder={opts.placeholder} value={col[key]} onChange={e => update(key, e.target.value)} /></label>
  const select = (key, label, options) => <label className="credit-field" htmlFor={`${prefix}-${key}`}><span>{label}</span><select id={`${prefix}-${key}`} value={col[key]} onChange={e => update(key, e.target.value)}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
  const amount = (key, label, optionalPlaceholder) => <label className="credit-field" htmlFor={`${prefix}-${key}`}><span>{label}</span><MoneyInput id={`${prefix}-${key}`} placeholder={optionalPlaceholder} value={col[key]} onChange={v => update(key, v)} /></label>
  const unitSelect = select('unit', 'Unidade da taxa', [['am', 'Ao mês'], ['aa', 'Ao ano']])
  const m = col.modality
  const giro = m === 'giro-pre' || m === 'giro-cdi' || m === 'outra'
  const cdi = m === 'giro-cdi' || (m === 'outra' && col.rateType === 'cdi')
  const iofProfile = select('profile', 'Enquadramento IOF', [['pj', 'Pessoa jurídica'], ['simples', 'Simples Nacional / MEI']])
  const eligible = col.profile === 'simples' && <label className="credit-check"><input type="checkbox" checked={col.eligible} onChange={e => update('eligible', e.target.checked)} /> Confirmo a opção pelo Simples/MEI</label>
  const rateCard = giro ? <>
    {m === 'outra' && <>{text('name', 'Nome da modalidade', { numeric: false, placeholder: 'Ex.: Cédula de crédito' })}{select('rateType', 'Indexador', [['fixed', 'Prefixado'], ['cdi', 'CDI + spread']])}</>}
    {m !== 'outra' && <p className="credit-static"><b>Indexador:</b> {m === 'giro-cdi' ? 'CDI + spread' : 'Prefixado'}</p>}
    {cdi && text('cdiPercent', 'Percentual do CDI (%)')}
    {text('rate', cdi ? 'Spread efetivo (%)' : 'Taxa efetiva (%)')}{unitSelect}
    {amount('fees', 'Tarifas na liberação (sem IOF)')}
  </> : m === 'bndes' ? <>
    {select('bLine', 'Indexador / linha', [['tfb', 'TFB (prefixada)'], ['tfc', 'TFC (prefixada)'], ['tlp', 'TLPCAP (IPCA capitalizado)']])}
    {text('bCost', 'Custo financeiro (% a.a.)')}
    {amount('bTac', 'TAC (R$)')}
    {select('bPorte', 'Porte da empresa', PORTES.map(p => [p.id, `${p.label} · BNDES ${p.taxa.toLocaleString('pt-BR')}% a.a.`]))}
    {text('bAgent', 'Spread do agente (% a.a.)')}{text('bPart', 'Participação do BNDES (%)')}
  </> : m === 'finimp' ? <>
    {select('fCurrency', 'Moeda', FINIMP_CURRENCY_LIST.map(c => [c, c]))}
    {text('fRate', 'Taxa anual simples (%)')}{text('fFlat', 'Flat (% do principal)')}{amount('fTac', 'TAC (R$)')}
  </> : m === 'conta-garantida' ? <>
    <p className="credit-static"><b>Indexador:</b> taxa do banco, sem indexador</p>
    {text('cRate', 'Taxa (% a.m.)')}
    <p className="credit-static"><b>Tarifas:</b> não modeladas nesta modalidade</p>
  </> : <>
    {select('dConv', 'Indexador / convenção', [['commercial30', 'Por fora (comercial)'], ['rational30', 'Por dentro (racional)']])}
    {text('dRate', 'Taxa de desconto (% a.m.)')}
    {select('dFeeMode', 'Tarifa dos títulos', [['total', 'Total por operação (R$)'], ['unit', 'Unitária × quantidade (R$)'], ['percent', 'Percentual do nominal (%)']])}{text('dFee', 'Valor da tarifa dos títulos')}{amount('dTac', 'TAC (R$)')}
  </>
  const more = <>
    {giro && <>{amount('monthlyFees', 'Tarifas em cada pagamento')}{iofProfile}{eligible}</>}
    {cdi && <label className="credit-field" htmlFor={`${prefix}-holidays`}><span>Feriados do calendário contratado (AAAA-MM-DD)</span><textarea id={`${prefix}-holidays`} value={col.holidays} onChange={e => update('holidays', e.target.value)} /></label>}
    {m === 'bndes' && <>
      {select('bComp', 'Composição da taxa', COMPOSICOES.map(c => [c.id, c.label]))}
      {select('bPeriod', 'Periodicidade', PERIODICIDADES.map(p => [String(p.id), p.label]))}
      {col.bLine === 'tlp' && text('bIpca', 'IPCA projetado (% a.a.)')}
      {select('bIof', 'IOF', [['zero', 'Alíquota zero (recursos Finame)'], ['pj', 'Pessoa jurídica geral'], ['simples', 'Simples/MEI']])}
      {col.bIof === 'simples' && <label className="credit-check"><input type="checkbox" checked={col.eligible} onChange={e => update('eligible', e.target.checked)} /> Confirmo a opção pelo Simples/MEI</label>}
      {text('bFgi', `Garantia FGI (${FGI.percentualMin}% a ${FGI.percentualMax}%, múltiplos de ${FGI.percentualMultiplo}, opcional)`)}
      {col.bFgi.trim() && <label className="credit-check"><input type="checkbox" checked={col.bFgiInc} onChange={e => update('bFgiInc', e.target.checked)} /> Incorporar o ECG ao financiamento</label>}
    </>}
    {m === 'finimp' && <>{col.fCurrency !== 'BRL' && text('fFx', 'Câmbio (R$ por unidade da moeda)')}{select('fDays', 'Prazo (dias)', [['auto', 'Igual ao prazo comum'], ...FINIMP_TERMS.map(d => [String(d), `${d} dias`])])}</>}
    {m === 'conta-garantida' && <>
      {text('cDays', 'Dias de utilização')}{select('cBase', 'Base da taxa (dias)', [['30', '30'], ['360', '360'], ['365', '365'], ['252', '252']])}
      {select('cConv', 'Conversão diária', [['proportional', 'Proporcional'], ['equivalent', 'Equivalente']])}{select('cCount', 'Contagem de dias', [['calendar', 'Corridos'], ['business', 'Úteis']])}
      {col.cCount === 'business' && <label className="credit-field" htmlFor={`${prefix}-holidays`}><span>Feriados (AAAA-MM-DD)</span><textarea id={`${prefix}-holidays`} value={col.holidays} onChange={e => update('holidays', e.target.value)} /></label>}
      {iofProfile}{eligible}
    </>}
    {m === 'desconto' && <>{text('dDays', 'Prazo médio dos títulos (dias)')}{text('dTitles', 'Quantidade de títulos')}{iofProfile}{eligible}</>}
    {m === 'outra' && text('declaredCet', 'CET informado pelo banco (% a.a., opcional)')}
  </>
  const own = <>
    {amount('value', 'Valor próprio', shared.value)}{text('term', 'Prazo próprio (meses)', { placeholder: shared.term })}{text('grace', 'Carência própria (meses)', { placeholder: shared.grace })}
    {select('system', 'Amortização própria', [['', 'Igual à comum'], ...SYSTEM_OPTIONS])}
  </>
  const single = result?.ok && result.rows.length === 1
  return <article className={`credit-card credit-card-${m}`} aria-label={`Comparação ${index + 1}`}>
    <header className="credit-card-head">
      <span className="credit-card-icon"><ModalityIcon id={m} /></span>
      <label htmlFor={`${prefix}-modality`}><span className="credit-card-number">Comparação {index + 1}</span>
        <select id={`${prefix}-modality`} value={m} onChange={e => set({ ...newColumn(e.target.value), value: col.value, term: col.term, grace: col.grace, system: col.system, guarantee: col.guarantee, guaranteeValue: col.guaranteeValue })}>{MODALITIES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    </header>
    <div className="credit-card-body">
      <p className="credit-hint">{MODALITIES.find(x => x.id === m)?.hint}</p>
      <p className="credit-hint"><b>Valores iniciais são exemplos.</b> Troque pelos dados da proposta antes de comparar.</p>
      <div className="credit-fields">{rateCard}</div>
      <div className="credit-fields">{select('guarantee', 'Garantia', GUARANTEES.map(g => [g, g || 'Não informada']))}{amount('guaranteeValue', 'Valor da garantia (opcional)')}</div>
      <details><summary>Mais condições desta modalidade</summary><div className="credit-fields">{more}</div></details>
      <details><summary>Condições próprias desta coluna</summary><p className="credit-hint">Campo vazio segue as condições comuns do topo.</p><div className="credit-fields">{own}</div></details>
    </div>
    <footer className="credit-card-result">
      {result?.ok ? <>
        <div><span>Parcela estimada</span><b>{brl(result.firstPayment)}</b><small>{single ? 'pagamento único' : `1ª de ${result.rows.length}`}</small></div>
        <div><span>{result.cetLabel ?? 'CET'}</span><b>{result.cet === null ? 'Não mensurável' : `${pct(result.cet * 100)} a.a.`}</b></div>
        {result.floating && <div><span>{result.projectedLabel}</span><b>{result.projectedCost === null ? 'Não mensurável' : `${pct(result.projectedCost * 100)} a.a.`}</b><small>não é CET</small></div>}
      </> : <p className="credit-card-error">{result?.error ?? '—'}</p>}
    </footer>
  </article>
}

function Results({ results, columns, scenario, cdi, source, equivalent }) {
  const failed = results.map((r, i) => ({ r, i })).filter(x => !x.r.ok)
  if (failed.length) return <div role="status" className="credit-errors">{failed.map(({ r, i }) => <p key={i}>Comparação {i + 1} · {modalityLabel(columns[i].modality)}: {r.error}</p>)}</div>
  const best = highlights(results)
  const head = i => `${i + 1}. ${results[i].label}`
  const rows = [
    ['Taxa / indexador', r => r.rateLabel], ['Sistema e pagamentos', r => r.systemLabel],
    ['Liberação / último vencimento', r => `${day(r.start)} / ${day(r.lastDate)}`],
    ['Valor contratado', r => brl(r.value)], ['Valor líquido recebido', r => brl(r.net)],
    ['CET estimado · parte fixa (regra do BC) · a.a.', (r, i) => `${pct(r.cet === null ? NaN : r.cet * 100)}${best.lowestCet === i ? ' · menor CET' : ''}`],
    ...(results.some(r => r.floating) ? [[`${[...new Set(results.filter(r => r.floating).map(r => r.projectedLabel))].length === 1 ? results.find(r => r.floating).projectedLabel : 'Custo com índice ou prazo de uso'} · a.a. (não é CET)`, r => pct(r.projectedCost === null ? NaN : r.projectedCost * 100)]] : []),
    ...(results.some(r => r.declaredCet !== null) ? [['CET informado pelo banco', r => r.declaredCet === null ? '—' : pct(r.declaredCet)]] : []),
    ['Parcela estimada (1ª)', r => brl(r.firstPayment)], ['Maior pagamento', r => brl(r.maxPayment)],
    ['Juros totais', r => brl(r.interest)], ['IOF', r => brl(r.iof)], ['Tarifas e encargos totais (sem IOF)', r => brl(r.fees)],
    ['Total desembolsado', r => brl(r.total)],
    ['Custo sobre o líquido', (r, i) => `${brl(r.cost)}${best.lowestCost === i ? ' · menor custo' : ''}`],
    ['Diferença de custo para a comparação 1', (r, i) => i === 0 ? '—' : brl(r.cost - results[0].cost)],
    ['Carência / observação', r => r.graceNote || '—'],
    ['Garantia', r => r.guarantee], ['Valor da garantia', r => brl(r.guaranteeValue)], ['Cobertura nominal', r => pct(r.coverage)],
  ]
  return <div className="credit-results"><p className="credit-notice">Simulação · {scenario} · {equivalent ? 'Mesmo valor líquido' : 'Condições originais'}. {usesCdiIn(columns) && <>CDI constante de {pct(cdi)} a.a. · {source}. Projeção, não taxa futura garantida.</>}</p>
    <div className="credit-scroll"><table><caption>Comparação financeira das operações</caption><thead><tr><th scope="col">Indicador</th>{results.map((r, i) => <th scope="col" key={i}>{head(i)}</th>)}</tr></thead><tbody>{rows.map(([label, get]) => <tr key={label}><th scope="row">{label}</th>{results.map((r, i) => <td key={i}>{get(r, i)}</td>)}</tr>)}</tbody></table></div>
    <section className="credit-analysis"><h3>Leitura consultiva</h3>
      <p>{best.lowestCet !== null ? <>Menor CET estimado: <strong>{head(best.lowestCet)}</strong>. </> : 'O CET não pôde ser comparado entre as colunas. '}{best.lowestCost !== null && <>Menor custo em reais sobre o líquido: <strong>{head(best.lowestCost)}</strong>. </>}{best.unmeasurable.length > 0 && <>CET não mensurável em: {best.unmeasurable.map(i => head(i)).join(', ')}. </>}</p>
      <p>CET estimado do fluxo informado, não certificado do contrato. Prefixado: juros compostos em dias corridos/30. CDI: dias úteis/252, segunda a sexta menos feriados nacionais e os informados. Cada modalidade segue as convenções da sua calculadora. Confira as condições contratuais.</p>
      <p>No pós-fixado, o CET segue a Resolução CMN 4.881/2020, art. 5º: a taxa flutuante (CDI) não entra. Mostramos o CET da parte fixa (mesmo contrato com CDI zero, só o spread) e, à parte, o custo com o CDI projetado, que não é CET. A ordem de menor CET usa o CET da parte fixa. Nas modalidades prefixadas os dois números coincidem. No BNDES com TLP capitalizada, o IPCA fica fora do CET da mesma forma. Na conta garantida, o CET segue o art. 6º (30 dias sobre o limite, igual à calculadora própria) e o custo pelo prazo de uso aparece à parte. O CET da parte fixa refaz o IOF no ritmo de amortização sem CDI, o que pode mudar o líquido em centavos.</p>
      <p>{new Set(results.map(r => r.net.toFixed(2))).size > 1 ? 'Os valores líquidos são diferentes. Use a comparação pelo mesmo valor líquido antes de comparar custos absolutos. ' : 'O líquido recebido é equivalente. '}Prazos, risco de juros e garantias também importam. Não há vencedor absoluto.</p>
      <p>Cobertura nominal = valor da garantia ÷ crédito contratado. Não representa avaliação, liquidez ou aceitação pelo banco e não indica condição melhor ou pior.</p></section>
    <CreditChart results={results} />
    {results.some(r => r.notes.length) && <section className="credit-notes"><h3>Premissas de cada coluna</h3><ul>{results.map((r, i) => r.notes.length > 0 && <li key={i}><b>{head(i)}</b><ul>{r.notes.map(n => <li key={n}>{n}</li>)}</ul></li>)}</ul></section>}
    <details><summary>Fluxos completos e memória do cálculo</summary><p>CET estimado desconta cada pagamento em dias corridos/365 a partir da liberação. Valores exibidos arredondados; cálculo usa precisão integral.</p>{results.map((r, i) => <div className="credit-scroll" key={i}><table><caption>{head(i)} · pagamentos em reais</caption><thead><tr>{['Nº', 'Data', 'Amortização', 'Juros', 'Pagamento', 'Saldo'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{r.rows.map(row => <tr key={row.number}><td>{row.number}</td><td>{day(row.date)}</td><td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td><td>{brl(row.balance)}</td></tr>)}</tbody></table></div>)}</details>
  </div>
}
function CreditChart({ results }) {
  const start = Math.min(...results.map(r => new Date(r.start).getTime()))
  const end = Math.max(...results.map(r => new Date(r.lastDate).getTime()))
  const max = Math.max(...results.map(r => r.paid), 1)
  const points = r => [{ date: r.start, cumulative: 0 }, ...r.rows].map(row => `${40 + (new Date(row.date).getTime() - start) / (end - start) * 620},${210 - row.cumulative / max * 180}`).join(' ')
  const names = results.map((r, i) => `${i + 1} ${r.label}`)
  return <figure className="credit-chart"><figcaption>Pagamentos acumulados · {names.map((n, i) => `${n} (${['azul', 'laranja', 'verde', 'roxo', 'rosa'][i]})`).join(', ')}</figcaption>
    <svg viewBox="0 0 700 250" role="img" aria-label={`Pagamentos acumulados até o fim de cada operação: ${results.map((r, i) => `${i + 1} ${brl(r.paid)}`).join(', ')}. Datas e valores completos na memória.`}><path d="M40 25V210H670" fill="none" stroke="currentColor" />
      {results.map((r, i) => <polyline key={i} points={points(r)} fill="none" stroke={COLUMN_COLORS[i]} strokeWidth="3" strokeDasharray={COLUMN_DASH[i] || undefined} />)}
      <text x="40" y="240">Liberação</text><text x="510" y="240">Último vencimento</text></svg>
    <p>Somente pagamentos futuros, sem descontos na liberação. Linhas ligam vencimentos e não representam cobranças diárias. O gráfico usa datas reais, inclusive prazos diferentes.</p></figure>
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
  const [columns, setColumns] = useState(initialColumns), [count, setCount] = useState(MIN_COLUMNS)
  const [shared, setShared] = useState(() => initialShared(cgToday()))
  const [scenario, setScenario] = useState('Base'), [manual, setManual] = useState(false), [cdiText, setCdi] = useState('')
  const [shock, setShock] = useState('2'), [equivalent, setEquivalent] = useState(false), [target, setTarget] = useState('500.000,00')
  const [present, setPresent] = useState(false), [confirmed, setConfirmed] = useState(null), [compared, setCompared] = useState(null)
  const close = useCallback(() => setPresent(false), [])
  const macro = useDataFile('macro.json'), reference = creditMarketReference(macro.data)
  const baseCdi = manual ? parseDecimal(cdiText) : reference?.value
  const delta = parseDecimal(shock), cdi = scenario === 'Base' ? baseCdi : Number.isFinite(baseCdi) && delta !== null ? Math.max(0, baseCdi + (scenario === 'Alta' ? delta : -delta)) : NaN
  const visible = columns.slice(0, count)
  const usesCdi = usesCdiIn(visible)
  const source = manual ? 'Premissa manual' : reference ? `${reference.source} · observação ${day(reference.date)}${reference.stale || macro.stale ? ' · referência atrasada/atualização pendente' : ''}` : 'Referência indisponível'
  const targetValue = equivalent ? parseMoneyInput(target).value ?? NaN : null
  const results = evaluateAll(visible, shared, { cdi, targetNet: equivalent ? targetValue : null })
  const signature = JSON.stringify([count, visible, shared, scenario, cdi, source, equivalent, target])
  const showResults = compared === signature
  const complete = confirmed === signature
  const invalidate = fn => value => { setConfirmed(null); fn(value) }
  const setColumn = i => invalidate(col => setColumns(list => list.map((c, k) => k === i ? col : c)))
  const content = <Results results={results} columns={visible} scenario={scenario} cdi={cdi} source={source} equivalent={equivalent} />
  const allOk = results.every(r => r.ok)
  return <section className="cx credit-comparison" aria-labelledby="credit-title"><button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button><h2 id="credit-title" className="cx-title cx-heading"><span className="cx-heading-text"><span className="cx-icon" aria-hidden="true"><CreditIcon /></span><span>Simulador de empréstimo · Compare modalidades</span></span></h2>
    <p>Escolha quantas comparações quer fazer e a modalidade de cada uma. Cada coluna pede os campos da sua modalidade e usa a conta da respectiva calculadora. Ao reduzir a quantidade, as colunas escondidas guardam o que foi digitado e voltam se você aumentar de novo.</p>
    <SharedFields shared={shared} set={invalidate(setShared)} />
    <div className="credit-count" role="group" aria-label="Quantidade de comparações"><span id="credit-count-label">Quantas comparações?</span>
      <div className="seg">{Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, k) => k + MIN_COLUMNS).map(n => <button type="button" key={n} aria-pressed={n === count} onClick={() => invalidate(setCount)(n)}>{n}</button>)}</div></div>
    <div className="credit-grid" style={{ '--credit-cols': count }}>{visible.map((col, i) => <ColumnCard key={i} index={i} col={col} set={setColumn(i)} result={results[i]} shared={shared} />)}</div>
    {usesCdi && <section className="desk-panel credit-controls"><h3>Cenários do CDI</h3><p>{source}</p><label><input type="checkbox" checked={manual} onChange={e => invalidate(setManual)(e.target.checked)} /> Informar referência manual</label>{manual && <label className="credit-field">CDI base (% a.a.)<input inputMode="decimal" value={cdiText} onChange={e => invalidate(setCdi)(e.target.value)} /></label>}<label className="credit-field">Variação dos cenários (pontos percentuais a.a.)<input inputMode="decimal" value={shock} onChange={e => invalidate(setShock)(e.target.value)} /></label><div className="seg" aria-label="Cenário">{['Queda', 'Base', 'Alta'].map(s => <button type="button" key={s} aria-pressed={s === scenario} onClick={() => invalidate(setScenario)(s)}>{s}</button>)}</div><p>CDI constante em cada cenário; queda limitada a zero. Variação ilustrativa ajustável, não previsão de mercado. Referência de mercado não define o CDI futuro do contrato.</p></section>}
    <section className="desk-panel credit-controls"><label><input type="checkbox" checked={equivalent} onChange={e => invalidate(setEquivalent)(e.target.checked)} /> Comparar pelo mesmo valor líquido</label>{equivalent && <label className="credit-field" htmlFor="credit-target">Líquido comum<MoneyInput id="credit-target" value={target} onChange={invalidate(setTarget)} /></label>}<p>Recalcula o valor contratado de cada coluna para o líquido comum, mantendo taxas, encargos fixos, prazos e garantias. Os valores originais permanecem nos formulários.</p></section>
    <div className="credit-actions"><button type="button" className="credit-compare" onClick={() => setCompared(signature)}><span aria-hidden="true">⇄</span> Comparar modalidades</button></div>
    {compared !== null && !showResults && <p className="credit-notice" role="status">As condições mudaram desde a última comparação. Clique em Comparar modalidades para atualizar o resultado.</p>}
    {showResults && <>
      <label className="credit-confirm"><input type="checkbox" checked={complete} onChange={e => setConfirmed(e.target.checked ? signature : null)} /> Conferi todos os encargos e as convenções para esta simulação.</label>
      <p>CET estimado do fluxo informado, não CET certificado do contrato. {complete ? 'Conferência declarada pelo usuário; não é auditoria contratual.' : 'Encargos ainda não conferidos: resultados são preliminares.'}</p>
      <button type="button" disabled={!allOk || !complete} onClick={() => setPresent(content)}>Apresentar comparação</button>
      {content}</>}
    <details className="credit-method"><summary>Premissas, limites e fonte do IOF</summary><p>Giro e Outra modalidade: prefixado em juros compostos dias corridos/30; CDI em dias úteis/252 com feriados informados, taxa diária do CDI multiplicada pelo percentual e spread composto à parte. Price tem pagamento constante, SAC amortiza o mesmo valor; dias até o primeiro vencimento além de 30 são carência capitalizada. Bullet tem vencimento único. IOF incide sobre o principal original, com teto de 365 dias.</p><p>BNDES: custo financeiro, taxa do BNDES e spread do agente compostos ou somados; carência com juros pagos; vencimentos no dia 15 ou próximo dia útil e juros por dias corridos; na TLP capitalizada, CET sem o IPCA (art. 5º) e custo com IPCA à parte; regras e limites de prazo e carência da calculadora BNDES; IOF zero nos recursos Finame ou alíquota PJ/Simples. FINIMP: juros simples ano de 360 dias, flat e TAC, em reais pelo câmbio informado, sem variação cambial e sem IOF de câmbio. Conta Garantida: saldo utilizado integralmente por todo o período, juros e IOF pagos no fim. Desconto de duplicata: juros descontados na liberação, nominal pago no vencimento.</p><p>O CET de todas as modalidades é estimado pelo mesmo fluxo de caixa: líquido recebido na liberação e pagamentos datados, desconto ACT/365. No pós-fixado, o CET regulatório usa só a parte fixa (CDI zero, mesmo spread, base de dias úteis/252, feriados e datas), conforme o art. 5º da Resolução CMN 4.881/2020; o custo com CDI projetado é informado à parte. Carência com juros pagos em giro, múltiplas liberações, amortizações extraordinárias, renegociação e garantias compartilhadas não são simuladas. Confira os cronogramas contra o contrato. <a href={IOF_SOURCE} target="_blank" rel="noreferrer">Fonte legal do IOF</a>. Regras compartilhadas com as demais calculadoras, para PJ e Simples/MEI a partir de 17/07/2025.</p></details>
    {present && <Presentation onClose={close}>{present}</Presentation>}
  </section>
}
