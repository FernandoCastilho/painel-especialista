import ChartFullscreen from './ChartFullscreen.jsx'
import ExpandIcon from './ExpandIcon.jsx'
import { useCallback, useEffect, useRef, useState } from 'react'
import { nbr5891 } from './format.js'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import LinhaMestra from './LinhaMestra.jsx'
import { Respostas, step } from './Roteiro.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import { lmClear, lmDefaults, lmLoad, lmSave } from './linhaMestra.js'
import { PRACA_AJUDA, PRACA_RESSALVA, PRACAS_CONTRATO } from './pracaContrato.js'
import { parseMoneyInput } from './moneyInput.js'
import { IOF_SOURCE } from './iofRules.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { useDataFile } from './useDataFile.js'
import { creditMarketReference } from './creditComparison.js'
import { MODALITIES, MIN_COLUMNS, MAX_COLUMNS, SYSTEM_OPTIONS, FINIMP_CURRENCY_LIST, PORTES, COMPOSICOES, PERIODICIDADES, FGI, initialColumns, initialShared, newColumn, evaluateAll, highlights, modalityLabel, cetGroup, CET_GROUPS } from './creditModalities.js'
import { FINIMP_TERMS } from './finimpComparison.js'
import { useCurves } from './useCurves.js'
import { useHolidays } from './useHolidays.js'
import { forwardBetween } from './cdiFuturo.js'
import { busDaysIn } from './holidays.js'
import { REGIMES, PRODUCTS, investmentAlone, creditVsCash, expenseShield } from './aplicacaoPj.js'
import './CreditComparison.css'
import './CalcPattern-comparador.css'
import CalcBack from './CalcBack.jsx'

const brl = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
// Duas casas decimais em todas as calculadoras (decisão de Fernando, 23/11/2026).
const pct = v => Number.isFinite(v) ? `${nbr5891(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : 'Não mensurável'
const day = d => d.split('-').reverse().join('/')
const GUARANTEES = ['', 'Aval', 'Recebíveis', 'Alienação fiduciária', 'Fundo garantidor (FGI)', 'Outra garantia']
const COLUMN_COLORS = ['#0075bf', '#c76d00', '#2a8a4a', '#8a3ffc', '#c2185b']
const COLUMN_DASH = ['', '8 4', '2 4', '10 3 2 3', '4 4']

function emailDraft(entries, { equivalent, scenario, cdi, complete }) {
  const multiple = entries.length > 1
  const subject = multiple ? 'Resumo da comparação de crédito' : 'Resumo da cotação de crédito'
  const basis = equivalent
    ? (multiple ? 'Comparação pelo mesmo valor líquido.' : 'Simulação pelo valor líquido desejado.')
    : 'Simulação nas condições informadas.'
  const items = entries.map(({ result, index }) => [
    `${multiple ? `${index + 1}. ` : ''}${result.label.replace(/\s+/g, ' ').trim()}`,
    `Valor contratado: ${brl(result.value)} · Valor líquido: ${brl(result.net)}`,
    `Prazo e fluxo: ${result.systemLabel} · Último vencimento: ${day(result.lastDate)}`,
    `Primeiro pagamento estimado: ${brl(result.firstPayment)}`,
    `${result.cetLabel.replace('CET', 'CET estimado')}: ${result.cet === null ? 'Não mensurável' : `${pct(result.cet * 100)} a.a.`}`,
    ...(result.floating && result.projectedCost !== null
      ? [`${result.projectedLabel}: ${pct(result.projectedCost * 100)} a.a. (não é CET)`]
      : []),
    `Custo sobre o valor líquido: ${brl(result.cost)}`,
  ].join('\r\n'))
  const notes = [
    ...(entries.some(({ result }) => result.modality === 'giro-cdi' || (result.modality === 'outra' && result.floating))
      ? [`Cenário CDI ${scenario}: ${pct(cdi)} a.a. O indexador pode variar.`]
      : []),
    complete ? 'Estimativas sujeitas à confirmação das condições contratuais.' : 'Simulação preliminar. Encargos e condições contratuais sujeitos à confirmação.',
  ]
  const body = ['Olá,', `Segue o resumo da ${multiple ? 'comparação de crédito' : 'cotação de crédito'}. ${basis}`, ...items, notes.join('\r\n'), 'Fico à disposição para conversar sobre as condições.'].join('\r\n\r\n')
  return `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function EmailEnvelope({ label, href }) {
  return <a className="credit-email" role="link" href={href} target="_blank" rel="noopener noreferrer"
    aria-label={label} aria-disabled={href ? undefined : true} title={href ? label : 'Gere um resultado válido para preparar o e-mail'}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" />
    </svg>
  </a>
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
const isCdi = c => c.modality === 'giro-cdi' || (c.modality === 'outra' && c.rateType === 'cdi')
const usesCdiIn = columns => columns.some(isCdi)

const FOOT = 'Estes valores valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'

// 1 Demanda do cliente (roteiro de 21/11/2026): valor, prazo, carência e amortização à vista.
// Data, praça, regime tributário e adicional do IR quase nunca mudam: ficam na gaveta "Detalhes do contrato".
function SharedFields({ shared, set, onClear, apresentacao }) {
  const update = (key, value) => set({ ...shared, [key]: value })
  // Linha mestra comum (19/11/2026): valor, prazo, carência, amortização, data e praça passam para as outras calculadoras de empréstimo.
  // Regime tributário e adicional do IR são só do Comparador.
  const startError = shared.start ? null : 'Informe a data da liberação.'
  const summary = [`liberação em ${shared.start ? day(shared.start) : '—'}`, PRACAS_CONTRATO.find(p => p.id === shared.praca)?.label, regimeLabel(shared.regime),
    shared.regime !== 'simples' && (shared.adicional ? 'com adicional de IRPJ' : 'sem adicional de IRPJ')].filter(Boolean).join(' · ')
  return <div className="credit-shared-wrap"><LinhaMestra prefix="credit-shared" title={step(1, 'Demanda do cliente')} values={shared} onChange={update} onClear={onClear}
    foot={null} help={{ title: 'Demanda do cliente', children: <><p>Cada coluna pode ter condições próprias.</p><p>{FOOT}</p></> }} fields={['value', 'term', 'grace', 'system']} errors={{ start: startError }}
    details={{ fields: ['start', 'praca'], open: !!apresentacao, alert: startError, summary, children: <>
      <div className="lm-field"><span className="lm-label"><label htmlFor="credit-shared-regime">Regime tributário</label><CalculatorHelp title="Regime tributário da empresa"><p>Regime tributário da empresa que toma o crédito. Define o imposto da aplicação financeira e se juros, IOF e tarifas reduzem o IRPJ/CSLL.</p></CalculatorHelp></span><select id="credit-shared-regime" value={shared.regime} onChange={e => update('regime', e.target.value)}>{REGIMES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
      {shared.regime !== 'simples' && <label className="credit-check lm-wide"><input type="checkbox" checked={shared.adicional} onChange={e => update('adicional', e.target.checked)} /> Paga o adicional de 10% do IRPJ (lucro acima de R$ 20 mil por mês): IRPJ + CSLL = {shared.adicional ? '34%' : '24%'}</label>}
    </> }} /></div>
}

function ColumnCard({ index, col, set, result, shared, individual, email }) {
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
    {text('rate', cdi ? 'Spread efetivo (%)' : 'Taxa de juros efetiva (%)')}{unitSelect}
    {amount('fees', 'TAC e fee na liberação')}
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
    {giro && <>{amount('monthlyFees', 'Outros, em cada pagamento')}{iofProfile}{eligible}</>}
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
    {select('guarantee', 'Garantia', GUARANTEES.map(g => [g, g || 'Não informada']))}{amount('guaranteeValue', 'Valor da garantia (opcional)')}
  </>
  const own = <>
    {amount('value', 'Valor próprio', shared.value)}{text('term', 'Prazo próprio (meses)', { placeholder: shared.term })}{text('grace', 'Carência própria (meses)', { placeholder: shared.grace })}
    {select('system', 'Amortização própria', [['', 'Igual à comum'], ...SYSTEM_OPTIONS])}
  </>
  const single = result?.ok && result.rows.length === 1
  // A garantia fica em "Mais condições": se o erro for nela, a gaveta abre sozinha, para o campo não ficar escondido.
  const moreDrawer = useRef(null), guaranteeError = !!result && !result.ok && /garantia/i.test(result.error ?? '')
  useEffect(() => { if (guaranteeError && moreDrawer.current) moreDrawer.current.open = true }, [guaranteeError])
  return <article className={`credit-card credit-card-${m}`} aria-label={individual ? 'Operação 1' : `Comparação ${index + 1}`}>
    <header className="credit-card-head">
      <span className="credit-card-icon"><ModalityIcon id={m} /></span>
      <label htmlFor={`${prefix}-modality`}><span className="credit-card-number">{individual ? 'Operação' : 'Comparação'} {index + 1}</span>
        <select id={`${prefix}-modality`} value={m} onChange={e => set({ ...newColumn(e.target.value), value: col.value, term: col.term, grace: col.grace, system: col.system, guarantee: col.guarantee, guaranteeValue: col.guaranteeValue })}>{MODALITIES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      <CalculatorHelp title={MODALITIES.find(x => x.id === m)?.label ?? 'Modalidade'}><p>{MODALITIES.find(x => x.id === m)?.hint}</p><p><b>Valores iniciais são exemplos.</b> Troque pelos dados da proposta antes de {individual ? 'gerar a cotação' : 'comparar'}.</p><p>Condições próprias desta coluna: campo vazio segue as condições comuns do topo.</p></CalculatorHelp>
      <EmailEnvelope label={`Preparar e-mail da cotação ${index + 1}`} href={email} />
    </header>
    <div className="credit-card-body">
      {result && !result.ok && <p className="credit-card-error credit-alert" role="status">{result.error ?? '—'}</p>}
      <div className="credit-fields">{rateCard}</div>
      <details ref={moreDrawer}><summary>Mais condições desta modalidade</summary><div className="credit-fields">{more}</div></details>
      <details><summary>Condições próprias desta coluna</summary><div className="credit-fields">{own}</div></details>
    </div>
    {(result?.ok || !result) && <footer className="credit-card-result">
      {result?.ok ? <>
        <div><span>Parcela estimada</span><b>{brl(result.firstPayment)}</b><small>{single ? 'pagamento único' : `1ª de ${result.rows.length}`}</small></div>
        <div><span>{result.cetLabel ?? 'CET'}</span><b>{result.cet === null ? 'Não mensurável' : `${pct(result.cet * 100)} a.a.`}</b></div>
        {result.floating && <div><span>{result.projectedLabel}</span><b>{result.projectedCost === null ? 'Não mensurável' : `${pct(result.projectedCost * 100)} a.a.`}</b><small>não é CET</small></div>}
      </> : <p className="credit-card-error">—</p>}
    </footer>}
  </article>
}

function ResultPanel({ title, children, className = '' }) {
  const [expanded, setExpanded] = useState(false)
  const close = useCallback(() => setExpanded(false), [])
  return <section className={`credit-result-panel ${className}`}>
    <header><h3>{title}</h3><button type="button" className="btn-expand" onClick={() => setExpanded(true)} aria-label={`Ampliar ${title}`} title="Ampliar"><ExpandIcon /></button></header>
    {!expanded && children}
    {expanded && <Presentation title={title} onClose={close}>{children}</Presentation>}
  </section>
}

function Results({ results, columns, scenario, cdi, source, equivalent, investment, shared }) {
  const [pair, setPair] = useState([0, 1])
  // A seleção só muda a apresentação. Todos os motores e resultados são preservados.
  const selected = pair.map((i, slot) => i < results.length ? i : slot)
  const choose = (slot, value) => setPair(previous => {
    const next = previous.map((i, n) => i < results.length ? i : n)
    const other = slot === 0 ? 1 : 0
    if (next[other] === value) next[other] = next[slot]
    next[slot] = value
    return next
  })
  const columnClass = i => selected.includes(i) ? '' : 'credit-extra-column'

  const single = results.length === 1
  const failed = results.map((r, i) => ({ r, i })).filter(x => !x.r.ok)
  if (failed.length) return <div role="status" className="credit-errors">{failed.map(({ r, i }) => <p key={i}>{single ? 'Operação' : 'Comparação'} {i + 1} · {modalityLabel(columns[i].modality)}: {r.error}</p>)}</div>
  // Alinha pela data real, não pelo número da parcela. Não soma nem recalcula fluxos.
  const paymentDates = [...new Set(results.flatMap(r => r.rows.map(row => row.date)))].sort()
  const paymentsByDate = results.map(r => {
    const byDate = new Map()
    for (const row of r.rows) {
      if (!byDate.has(row.date)) byDate.set(row.date, [])
      byDate.get(row.date).push(row.payment)
    }
    return byDate
  })
  const best = highlights(results)
  const head = i => `${i + 1}. ${results[i].label}`
  // Selos de menor CET e menor custo: uma regra só, usada na matriz e no quadro de respostas (sem vencedor absoluto).
  const cetTag = (r, i) => best.lowestCet === i ? ' · menor CET' : r.ok && best.lowestCetByGroup[cetGroup(r)] === i ? ` · menor CET entre ${CET_GROUPS[cetGroup(r)]}` : ''
  const costTag = i => best.lowestCost === i ? ' · menor custo' : ''
  // Quadro de respostas (roteiro de 21/11/2026): as perguntas do Capital de Giro, uma coluna por operação.
  // Só repete números que a conta já devolve e que a matriz abaixo também mostra.
  const onePayment = r => r.rows.length === 1
  const questions = [
    { label: 'Quanto entra no caixa', value: r => brl(r.net), note: r => `Valor líquido, de ${brl(r.value)} contratados` },
    { label: results.every(onePayment) ? 'Quanto paga no vencimento' : 'Quanto paga por mês', value: r => brl(r.firstPayment),
      note: r => onePayment(r) ? `Pagamento único em ${day(r.lastDate)}` : `1ª de ${r.rows.length} parcelas` },
    { label: 'Quanto paga no total', value: r => brl(r.total), note: r => `Total desembolsado até ${day(r.lastDate)}` },
    { label: 'Quanto custa', main: true, value: r => r.cet === null ? 'Não mensurável' : `${pct(r.cet * 100)} a.a.`,
      note: (r, i) => <>{r.cetLabel === 'CET' ? 'CET estimado' : r.cetLabel}{cetTag(r, i)}
        {r.floating && <><br />{r.projectedLabel}: {r.projectedCost === null ? 'Não mensurável' : `${pct(r.projectedCost * 100)} a.a.`} (não é CET)</>}
        <br /><strong>Custo sobre o líquido: {brl(r.cost)}</strong>{costTag(i)}</> },
  ]
  // Linhas agrupadas por categoria: taxas; valor e parcelas; custos terminando no total; prazo; caixa próprio; garantia. A aplicação é a última coluna.
  const investAlone = investment?.alone.ok ? investment.alone : null
  const costPart = (amount, total) => <>{brl(amount)}{total > 0 && <><br /><small>{pct(100 * amount / total)} do custo</small></>}</>
  const investRateLabel = investAlone ? (investment.product === 'cdb-pre' ? `Prefixada · ${pctRate(investment.rate)} a.a.` : `${pctRate(investment.rate)} do CDI`) : ''
  const groups = [
    ['Taxas e custo efetivo', [
      ['Taxa / indexador', r => r.rateLabel, '', () => investRateLabel],
      ['CET estimado · parte fixa (regra do BC) · a.a.', (r, i) => `${pct(r.cet === null ? NaN : r.cet * 100)}${cetTag(r, i)}`],
      ...(results.some(r => r.floating) ? [[`${[...new Set(results.filter(r => r.floating).map(r => r.projectedLabel))].length === 1 ? results.find(r => r.floating).projectedLabel : 'Custo com índice ou prazo de uso'} · a.a. (não é CET)`, r => pct(r.projectedCost === null ? NaN : r.projectedCost * 100)]] : []),
      ...(results.some(r => r.declaredCet !== null) ? [['CET informado pelo banco', r => r.declaredCet === null ? '—' : pct(r.declaredCet)]] : []),
    ]],
    ['Valor e parcelas', [
      ['Valor contratado', r => brl(r.value), '', inv => `${brl(inv.deposit)} aplicado`], ['Valor líquido recebido', r => brl(r.net)],
      ['Parcela estimada (1ª)', r => brl(r.firstPayment)], ['Maior pagamento', r => brl(r.maxPayment)],
    ], 'credit-num'],
    ['Custos da operação', [
      ['Juros totais', r => costPart(r.interest, r.cost), '', inv => `${brl(inv.gross)} de rendimento`], ['IOF', r => costPart(r.iof, r.cost), '', inv => brl(inv.iof)],
      ['Tarifas e encargos totais (sem IOF)', r => costPart(r.fees, r.cost), '', inv => `${brl(inv.tax + inv.pisCofins)} de impostos`],
      ['Custo sobre o líquido', (r, i) => `${brl(r.cost)}${costTag(i)}`],
      ...(!single ? [['Diferença de custo para a comparação 1', (r, i) => i === 0 ? '—' : brl(r.cost - results[0].cost)]] : []),
      ...(shared ? [[`Custo após IRPJ/CSLL (${regimeLabel(shared.regime)})`, r => brl(r.cost - expenseShield(shared.regime, shared.adicional) * r.cost)]] : []),
      [investAlone ? 'Total desembolsado · na aplicação, saldo final líquido' : 'Total desembolsado', r => brl(r.total), 'credit-total-row', inv => brl(inv.deposit + inv.net)],
    ], 'credit-num'],
    ['Prazo e fluxo', [
      ['Sistema e pagamentos', r => r.systemLabel, '', () => 'Resgate no fim do período'],
      ['Liberação / último vencimento', r => `${day(r.start)} / ${day(r.lastDate)}`, '', inv => `${day(inv.start)} / ${day(inv.end)}`],
      ['Carência / observação', r => r.graceNote || '—'],
    ]],
    ...(investment ? [['Caixa próprio', [
      ['Tomar o crédito e manter o caixa aplicado', (r, i) => { const v = investment.vsCash[i]; return !v?.ok ? (v?.error ?? '—') : `${v.leftover >= 0 ? '+' : '−'} ${brl(Math.abs(v.leftover))}${v.leftover >= 0 ? ' · compensa' : ' · melhor usar o caixa'}` }],
    ]]] : []),
    ['Garantia', [
      ['Garantia', r => r.guarantee], ['Valor da garantia', r => brl(r.guaranteeValue)], ['Cobertura nominal', r => pct(r.coverage)],
    ]],
  ]
  // Resposta principal: só aponta valores já calculados e já exibidos na tabela (CET e custo sobre o líquido).
  const cetOrder = results.map((r, i) => i).filter(i => results[i].cet !== null).sort((a, b) => results[a].cet - results[b].cet)
  const cetText = i => `${pct(results[i].cet * 100)} a.a.`
  const cheapest = best.lowestCost
  const runnerUp = cheapest === 0 ? results.map((r, i) => i).filter(i => i > 0).reduce((a, b) => results[b].cost < results[a].cost ? b : a) : 0
  const costDiff = cheapest === null ? null : cheapest === 0 ? results[runnerUp].cost - results[0].cost : results[cheapest].cost - results[0].cost
  const costCard = cheapest !== null && <div><small>Menor custo sobre o líquido</small><b>{head(cheapest)}</b><span>{brl(results[cheapest].cost)} de custo · <strong>{brl(Math.abs(costDiff))} a menos</strong> que {head(runnerUp)}{cheapest === 0 ? ' (a segunda mais barata)' : ''}</span></div>
  const cetCard = best.lowestCet !== null
    ? <div><small>Menor CET estimado · parte fixa</small><b>{head(best.lowestCet)}</b><span><strong>{cetText(best.lowestCet)}</strong>{cetOrder.length > 1 && <>, contra {cetText(cetOrder[1])} em {head(cetOrder[1])}</>}</span></div>
    : best.mixed
      ? <div><small>CET · tipos diferentes de taxa</small>{Object.entries(best.lowestCetByGroup).map(([g, i]) => <span key={g}>Menor CET entre {CET_GROUPS[g]}: <strong>{head(i)}</strong> · {cetText(i)}</span>)}<div className="credit-help-line"><span>Compare o custo em reais.</span><CalculatorHelp title="CET com tipos diferentes de taxa"><p>O CET só compara colunas do mesmo tipo de taxa.</p></CalculatorHelp></div></div>
      : <div><small>CET</small><span>O CET não pôde ser comparado entre as colunas.</span></div>
  const [mainCard, sideCard] = best.lowestCet !== null ? [cetCard, costCard] : [costCard, cetCard]
  return <div className="credit-results">
    {single ? <Respostas items={questions.map(q => ({ question: q.label, value: q.value(results[0]), note: q.note(results[0], 0), main: q.main }))} />
      : <table className="credit-answers"><caption>Respostas por operação</caption>
        <thead><tr><th scope="col">Pergunta</th>{results.map((r, i) => <th scope="col" key={i}>{head(i)}</th>)}</tr></thead>
        <tbody>{questions.map(q => <tr key={q.label} className={q.main ? 'credit-answers-main' : undefined}><th scope="row">{q.label}</th>
          {results.map((r, i) => <td key={i}><span className="credit-answers-op">{head(i)}</span><b>{q.value(r)}</b><small>{q.note(r, i)}</small></td>)}</tr>)}</tbody>
      </table>}
    <section className="credit-answer" aria-label="Resposta principal">
      <div className="credit-answer-main">{single ? <div><small>Cotação individual</small><b>{head(0)}</b><span>CET estimado · parte fixa: <strong>{results[0].cet === null ? 'Não mensurável' : cetText(0)}</strong></span></div> : mainCard}</div>
      <div className="credit-answer-side">{single ? <div><small>Custo sobre o líquido</small><b>{brl(results[0].cost)}</b><span>Uma operação, sem classificação comparativa.</span></div> : sideCard}</div>
    </section>
    <p className="credit-notice">Simulação · {scenario} · {equivalent ? 'Mesmo valor líquido' : 'Condições originais'}. {usesCdiIn(columns) && <>CDI constante de {pct(cdi)} a.a. · {source}. Projeção, não taxa futura garantida.</>}</p>
    <ResultPanel title={single ? 'Cotação da operação' : 'Comparação financeira das operações'}>
      {results.length > 2 && <div className="credit-pair-picker" role="group" aria-label="Modalidades visíveis em telas estreitas"><span>Em telas estreitas, compare duas por vez:</span>{selected.map((value, slot) => <label key={slot}>Modalidade visível {slot + 1}<select value={value} onChange={e => choose(slot, Number(e.target.value))}>{results.map((r, i) => <option key={i} value={i}>{head(i)}</option>)}</select></label>)}</div>}
      <div className={`credit-scroll credit-matrix-scroll${single ? ' credit-single-matrix' : ''}`} tabIndex="0" role="region" aria-label={single ? 'Indicadores da operação' : 'Quadro comparativo por modalidade'}><table className="credit-table credit-matrix"><caption>{single ? 'Indicadores da operação' : 'Indicadores em linhas · modalidades em colunas'}</caption><thead><tr><th scope="col">Modalidade</th>{results.map((r, i) => <th scope="col" className={columnClass(i)} key={i}>{head(i)}</th>)}{investAlone && <th scope="col" className="credit-invest-col">Aplicação financeira<br /><small>{PRODUCTS.find(x => x.id === investment.product)?.label}</small></th>}</tr></thead><tbody>{groups.map(([group, rows, groupClass]) => [
        <tr key={group} className="credit-grp"><th scope="colgroup" colSpan={results.length + 1 + (investAlone ? 1 : 0)}>{group}</th></tr>,
        ...rows.map(([label, get, rowClass, getInvest]) => <tr key={label} className={[groupClass, rowClass].filter(Boolean).join(' ') || undefined}><th scope="row">{label}</th>{results.map((r, i) => <td className={columnClass(i)} key={i}>{get(r, i)}</td>)}{investAlone && <td className="credit-invest-col">{getInvest ? getInvest(investAlone) : '—'}</td>}</tr>),
      ])}</tbody></table></div>
    </ResultPanel>
    <section className="credit-analysis credit-reading"><h3>Leitura consultiva</h3>
      <p>{single ? 'Cotação individual: confira custo, CET e fluxo da operação. ' : best.lowestCet !== null ? <>Menor CET estimado: <strong>{head(best.lowestCet)}</strong>. </> : best.mixed ? <>Há tipos diferentes de taxa. Entre tipos diferentes, compare o custo em reais. {Object.entries(best.lowestCetByGroup).map(([g, i]) => <span key={g}>Menor CET entre {CET_GROUPS[g]}: <strong>{head(i)}</strong>. </span>)}</> : 'O CET não pôde ser comparado entre as colunas. '}{best.lowestCost !== null && <>Menor custo em reais sobre o líquido: <strong>{head(best.lowestCost)}</strong>. </>}{best.unmeasurable.length > 0 && <>CET não mensurável em: {best.unmeasurable.map(i => head(i)).join(', ')}. </>}</p>
      <div className="credit-help-line"><span>Como ler CET e custo projetado</span><CalculatorHelp title="Como ler CET e custo projetado"><p>O CET compara colunas do mesmo tipo (prefixado com prefixado, pós-fixado com pós-fixado). Prazos, risco de juros e garantias também importam.</p><p>CET estimado do fluxo informado, não certificado do contrato. Prefixado: juros compostos em dias corridos/30. CDI: dias úteis/252, segunda a sexta menos feriados nacionais, os da praça do contrato e os informados. Vencimento em dia não útil passa para o próximo dia útil, pelos mesmos feriados e também em 31/12 (sem expediente bancário). Cada modalidade segue as convenções da sua calculadora. Confira as condições contratuais.</p>
      <p>No pós-fixado, o CET segue a Resolução CMN 4.881/2020, art. 5º: a taxa flutuante (CDI) não entra. Mostramos o CET da parte fixa (mesmo contrato com CDI zero, só o spread) e, à parte, o custo com o CDI projetado, que não é CET. A ordem de menor CET usa o CET da parte fixa. Nas modalidades prefixadas os dois números coincidem. No BNDES com TLP capitalizada, o IPCA fica fora do CET da mesma forma. Na conta garantida, o CET segue o art. 6º (30 dias sobre o limite, igual à calculadora própria) e o custo pelo prazo de uso aparece à parte. O CET da parte fixa refaz o IOF no ritmo de amortização sem CDI, o que pode mudar o líquido em centavos.</p></CalculatorHelp></div>
      <p>{single ? 'Considere o valor líquido recebido. ' : new Set(results.map(r => r.net.toFixed(2))).size > 1 ? 'Os valores líquidos são diferentes. Use a comparação pelo mesmo valor líquido antes de comparar custos absolutos. ' : 'O líquido recebido é equivalente. '}{!single && 'Não há vencedor absoluto.'}</p>
      <div className="credit-help-line"><span>Cobertura nominal</span><CalculatorHelp title="Cobertura nominal"><p>Cobertura nominal = valor da garantia ÷ crédito contratado. Não representa avaliação, liquidez ou aceitação pelo banco e não indica condição melhor ou pior.</p></CalculatorHelp></div></section>
    {investment && <InvestmentBlock alone={investment.alone} regime={shared.regime} adicional={shared.adicional} product={investment.product} />}
    {investment && <section className="credit-analysis"><h3>Crédito ou caixa próprio?</h3>
      <div className="credit-help-line"><span>Como funciona a comparação com caixa próprio</span><CalculatorHelp title="Crédito ou caixa próprio">      <p>Conta: a empresa recebe o líquido do crédito, mantém essa quantia na aplicação e resgata para pagar cada parcela, com o imposto do regime. {shared.regime === 'real' ? `No Lucro Real, juros, IOF e tarifas do crédito reduzem o IRPJ/CSLL (${shared.adicional ? '34%' : '24%'}).` : 'Neste regime, as despesas do crédito não reduzem o imposto.'}{investment.product.startsWith('fundo') && shared.regime !== 'simples' ? ' Fora do Simples, o come-cotas é antecipação e não muda o imposto final; não é simulado.' : ''} Sobra positiva no fim: compensa tomar o crédito; negativa: usar o caixa próprio sai mais barato.</p><p>Projeção pela curva DI do dia, não garantia. Prejuízo fiscal, compensações e o momento exato do recolhimento não são simulados.</p></CalculatorHelp></div>
      <ul>{results.map((r, i) => { const v = investment.vsCash[i]; return <li key={i}><b>{head(i)}:</b> {!v?.ok ? v?.error : v.leftover >= 0 ? <>manter o caixa aplicado deixa <b>{brl(v.leftover)}</b> a mais no fim ({day(r.lastDate)}).</> : <>usar o caixa próprio economiza <b>{brl(-v.leftover)}</b>{v.shortfall > 0 ? ' (a aplicação não cobre todas as parcelas)' : ''}.</>}</li> })}</ul></section>}
    {shared && <ResultPanel title="Dados básicos da operação">
      <dl className="credit-operation-summary">
        <div><dt>{equivalent ? 'Valor comum de referência' : 'Valor da operação'}</dt><dd>{brl(parseMoneyInput(shared.value).value)}</dd></div>
        <div><dt>Prazo</dt><dd>{shared.term} meses</dd></div>
        <div><dt>Carência</dt><dd>{shared.grace} meses</dd></div>
        <div><dt>Amortização</dt><dd>{SYSTEM_OPTIONS.find(([id]) => id === shared.system)?.[1] ?? shared.system}</dd></div>
        <div><dt>Liberação</dt><dd>{day(shared.start)}</dd></div>
        <div><dt>Regime tributário</dt><dd>{regimeLabel(shared.regime)}</dd></div>
      </dl><div className="credit-help-line"><span>Como ler</span><CalculatorHelp title="Dados básicos da operação"><p>{single ? 'Condições da operação. Valor, prazo, carência e amortização aparecem na cotação acima.' : 'Condições comuns. Diferenças de valor, prazo, carência e amortização de cada modalidade aparecem na comparação acima.'}</p></CalculatorHelp></div>
    </ResultPanel>}
    <details className="credit-more"><summary>Parcelas por data e gráfico dos fluxos</summary>
    <div className="credit-result-grid">
      <ResultPanel title="Parcelas · data e valor">
        <div className={`credit-scroll credit-matrix-scroll credit-payment-scroll${single ? ' credit-single-matrix' : ''}`} tabIndex="0" role="region" aria-label="Parcelas alinhadas por data e modalidade"><table className="credit-table credit-matrix credit-payment-matrix"><caption>Valor da parcela por data · — indica ausência de pagamento</caption><thead><tr><th scope="col">Data</th>{results.map((r, i) => <th scope="col" className={columnClass(i)} key={i}>{head(i)}</th>)}</tr></thead><tbody>{paymentDates.map(date => <tr key={date}><th scope="row">{day(date)}</th>{paymentsByDate.map((byDate, i) => <td className={columnClass(i)} key={i}>{byDate.has(date) ? byDate.get(date).map((payment, n) => <span className="credit-payment-value" key={n}>{brl(payment)}</span>) : <span aria-label="Sem pagamento nesta data">—</span>}</td>)}</tr>)}</tbody></table></div>
      </ResultPanel>
      <ResultPanel title="Gráficos dos fluxos"><CreditChart results={results} /></ResultPanel>
    </div>
    </details>
    {results.some(r => r.notes.length) && <details className="credit-notes"><summary>Premissas de cada coluna</summary><ul>{results.map((r, i) => {
      if (r.notes.length === 0) return null
      // No BNDES, a última nota descreve o calendário. As anteriores são avisos da operação.
      const warnings = r.modality === 'bndes' ? r.notes.slice(0, -1) : []
      const premises = r.notes.slice(warnings.length)
      const exchange = r.modality === 'finimp' ? r.notes[0].split(', constante até o vencimento.')[0] : null
      return <li key={i}><b>{head(i)}</b><CalculatorHelp title={`Premissas · ${head(i)}`}><ul>{premises.map(note => <li key={note}>{note}</li>)}</ul></CalculatorHelp>
        {exchange && <p>{exchange}</p>}
        {warnings.length > 0 && <ul>{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
      </li>
    })}</ul></details>}
    <details><summary>Fluxos completos e memória do cálculo</summary><div className="credit-help-line"><span>Como ler a memória do cálculo</span><CalculatorHelp title="Memória do cálculo"><p>CET estimado desconta cada pagamento em dias corridos/365 a partir da liberação. Valores exibidos arredondados; cálculo usa precisão integral.</p></CalculatorHelp></div>{results.map((r, i) => <div className="credit-scroll" key={i}><table><caption>{head(i)} · pagamentos em reais</caption><thead><tr>{['Nº', 'Data', 'Amortização', 'Juros', 'Pagamento', 'Saldo'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{r.rows.map(row => <tr key={row.number}><td>{row.number}</td><td>{day(row.date)}</td><td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td><td>{brl(row.balance)}</td></tr>)}</tbody></table></div>)}</details>
  </div>
}
function CreditChart({ results }) {
  const start = Math.min(...results.map(r => new Date(r.start).getTime()))
  const end = Math.max(...results.map(r => new Date(r.lastDate).getTime()))
  const max = Math.max(...results.map(r => r.paid), 1)
  const points = r => [{ date: r.start, cumulative: 0 }, ...r.rows].map(row => `${40 + (new Date(row.date).getTime() - start) / (end - start) * 620},${210 - row.cumulative / max * 180}`).join(' ')
  const names = results.map((r, i) => `${i + 1} ${r.label}`)
  return <figure className="credit-chart"><figcaption>Pagamentos acumulados · {names.map((n, i) => `${n} (${['azul', 'laranja', 'verde', 'roxo', 'rosa'][i]})`).join(', ')}<CalculatorHelp title="Gráfico dos fluxos"><p>Somente pagamentos futuros, sem descontos na liberação. Linhas ligam vencimentos e não representam cobranças diárias. O gráfico usa datas reais, inclusive prazos diferentes.</p></CalculatorHelp></figcaption>
    <ChartFullscreen><svg viewBox="0 0 700 250" role="img" aria-label={`Pagamentos acumulados até o fim de cada operação: ${results.map((r, i) => `${i + 1} ${brl(r.paid)}`).join(', ')}. Datas e valores completos na memória.`}><path d="M40 25V210H670" fill="none" stroke="currentColor" />
      {results.map((r, i) => <polyline key={i} points={points(r)} fill="none" stroke={COLUMN_COLORS[i]} strokeWidth="3" strokeDasharray={COLUMN_DASH[i] || undefined} />)}
      <text x="40" y="240">Liberação</text><text x="510" y="240">Último vencimento</text></svg></ChartFullscreen>
  </figure>
}
const INVEST_INITIAL = { on: false, product: 'cdb-pos', rate: '100', adminFee: '0,50' }
const pctRate = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const regimeLabel = id => REGIMES.find(r => r.id === id)?.label ?? ''

function InvestmentFields({ invest, set, curveBase }) {
  const update = (key, value) => set({ ...invest, [key]: value })
  const pre = invest.product === 'cdb-pre'
  return <section className="desk-panel credit-controls credit-invest" aria-labelledby="credit-invest-title">
    <h3 id="credit-invest-title"><label><input type="checkbox" checked={invest.on} onChange={e => update('on', e.target.checked)} /> Comparar com aplicação financeira</label></h3>
    {invest.on && !curveBase && <p className="credit-alert" role="status">Curva DI indisponível agora: a aplicação não pode ser calculada.</p>}
    <div className="credit-help-line"><span>Tributação e projeção</span><CalculatorHelp title="Comparar com aplicação financeira"><p>Mostra quanto a empresa ganharia deixando o dinheiro aplicado e, em cada operação, se compensa tomar o crédito e manter o caixa aplicado ou usar o caixa próprio. Tributação pelo regime escolhido nos detalhes do contrato (bloco 1).</p>{curveBase && <p>Nos cenários de alta ou queda, a curva sobe ou desce na mesma variação.</p>}</CalculatorHelp></div>
    {invest.on && <>
      <label className="credit-field" htmlFor="credit-invest-product"><span>Aplicação</span><select id="credit-invest-product" value={invest.product} onChange={e => update('product', e.target.value)}>{PRODUCTS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
      <label className="credit-field" htmlFor="credit-invest-rate"><span>{pre ? 'Taxa (% a.a., 252 dias úteis)' : 'Remuneração (% do CDI)'}</span><input id="credit-invest-rate" inputMode="decimal" value={invest.rate} onChange={e => update('rate', e.target.value)} /></label>
      {invest.product.startsWith('fundo') && <label className="credit-field" htmlFor="credit-invest-fee"><span>Taxa de administração (% a.a.)</span><input id="credit-invest-fee" inputMode="decimal" value={invest.adminFee} onChange={e => update('adminFee', e.target.value)} /></label>}
      {curveBase && <p className="credit-hint">CDI projetado pela curva DI x pré da B3 de {day(curveBase)}.</p>}
    </>}
  </section>
}

function InvestmentBlock({ alone, regime, adicional, product }) {
  if (!alone.ok) return <p className="credit-errors" role="status">Aplicação financeira: {alone.error}</p>
  const real = regime === 'real', simples = regime === 'simples'
  const rows = [
    ['Período', `${day(alone.start)} a ${day(alone.end)} · ${alone.days} dias`],
    ['Valor aplicado', brl(alone.deposit)],
    [product.startsWith('fundo') ? 'Rendimento bruto (após taxa de administração)' : 'Rendimento bruto', brl(alone.gross)],
    ...(alone.iof > 0 ? [['IOF (resgate antes de 30 dias)', brl(-alone.iof)]] : []),
    ...(real ? [['PIS/Cofins (4,65% até 31/12/2026)', brl(-alone.pisCofins)]] : []),
    [simples ? 'IR retido na fonte (imposto final)' : `IRPJ + CSLL (${adicional ? '34%' : '24%'})`, brl(-alone.tax)],
    ...(!simples ? [['IR retido na fonte (antecipação, abatido do IRPJ)', brl(alone.withheld)]] : []),
    ['Rendimento líquido', brl(alone.net)],
    ['Taxa líquida ao ano', alone.netRate == null ? '—' : pctRate(alone.netRate)],
  ]
  return <section className="credit-invest-block"><h3>Aplicação financeira · {PRODUCTS.find(x => x.id === product)?.label} · {regimeLabel(regime)}<CalculatorHelp title="Tributação e garantia da aplicação"><p>{simples ? `No Simples, o IR retido pelo banco é o imposto final: ${product === 'fundo-cp' ? '22,5% até 180 dias e 20% acima' : '22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima'}${product.startsWith('fundo') ? ', com come-cotas em maio e novembro' : ''}.` : real ? 'No Lucro Real, o rendimento entra no lucro pelo regime de competência; o IR retido pelo banco só antecipa o imposto. A partir de 2027, sem PIS/Cofins sobre o rendimento (a CBS não incide).' : 'No Lucro Presumido, o rendimento entra inteiro na base do IRPJ e da CSLL no resgate; o IR retido pelo banco só antecipa o imposto. Não há PIS/Cofins sobre o rendimento.'} LCI e LCA não são isentas para empresa. CDB tem garantia do FGC até R$ 250 mil por CNPJ em cada banco.</p></CalculatorHelp></h3>
    <div className="credit-scroll"><table><tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table></div>
  </section>
}

function Presentation({ children, onClose, title = 'Necessidade do Cliente' }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement, overflow = document.body.style.overflow
    element.showModal(); document.body.style.overflow = 'hidden'
    window.addEventListener('hashchange', onClose)
    return () => { window.removeEventListener('hashchange', onClose); element.close(); document.body.style.overflow = overflow; if (trigger?.isConnected) trigger.focus() }
  }, [onClose])
  return <dialog className="credit-presentation" ref={dialog} onCancel={onClose} aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose}>Fechar ×</button></header>{children}</dialog>
}
export default function CreditComparison({ onBack, apresentacao }) {
  const [columns, setColumns] = useState(initialColumns), [count, setCount] = useState(2)
  const [shared, setSharedState] = useState(() => ({ ...initialShared(cgToday()), ...lmLoad(cgToday()) }))
  const setShared = next => { setSharedState(next); lmSave(Object.fromEntries(Object.keys(lmDefaults('')).map(k => [k, next[k]]))) }
  const clearShared = () => { lmClear(); setConfirmed(null); setSharedState(old => ({ ...old, ...lmDefaults(cgToday()) })) }
  const [scenario, setScenario] = useState('Base'), [manual, setManual] = useState(false), [cdiText, setCdi] = useState('')
  const [cdiFromCurve, setCdiFromCurve] = useState(true)
  const [shock, setShock] = useState('2'), [equivalent, setEquivalent] = useState(false), [target, setTarget] = useState('500.000,00')
  const [present, setPresent] = useState(false), [confirmed, setConfirmed] = useState(null), [compared, setCompared] = useState(null)
  const close = useCallback(() => setPresent(false), [])
  const [invest, setInvest] = useState(INVEST_INITIAL), [area, setArea] = useState('compare')
  const curves = useCurves(), hol = useHolidays()
  const curveToday = curves.data?.br?.compare?.find(c => c.id === 'hoje')
  const curvePts = curveToday ? curves.data.br.curves?.[curveToday.date] : null
  const macro = useDataFile('macro.json'), reference = creditMarketReference(macro.data)
  // CDI médio da curva DI da B3 no prazo informado na linha mestra (meses × 21 dias úteis), a partir da liberação.
  const termMonths = Number.parseInt(shared.term, 10)
  const curveAvg = (() => {
    if (!curveToday || !curvePts || !(termMonths > 0)) return null
    const startDu = busDaysIn(curveToday.date, shared.start, ['BR'], hol.ctx)
    const maxDu = Math.max(...curvePts.map(x => x[0]))
    const endDu = Math.min(startDu + termMonths * 21, maxDu)
    const value = forwardBetween(curvePts, startDu, endDu)
    return value == null ? null : { value, months: Math.round((endDu - startDu) / 21), limited: startDu + termMonths * 21 > maxDu, date: curveToday.date }
  })()
  const curveAvgText = curveAvg ? curveAvg.value.toFixed(2).replace('.', ',') : ''
  // A referência do sistema acompanha o prazo; edição explícita pertence ao usuário.
  const cdiInputText = cdiFromCurve ? curveAvgText : cdiText
  const toggleManual = on => invalidate(setManual)(on)
  const editCdi = value => { invalidate(setCdi)(value); setCdiFromCurve(false) }
  const useCurveAverage = () => invalidate(setCdiFromCurve)(true)
  const baseCdi = manual ? parseDecimal(cdiInputText) : reference?.value
  const delta = parseDecimal(shock), cdi = scenario === 'Base' ? baseCdi : Number.isFinite(baseCdi) && delta !== null ? Math.max(0, baseCdi + (scenario === 'Alta' ? delta : -delta)) : NaN
  const visible = columns.slice(0, count)
  const usesCdi = usesCdiIn(visible)
  // "Cenários e comparações" abre sozinho quando há operação pós-CDI (a referência do CDI é necessária) ou opção marcada,
  // e fecha quando a última operação pós-CDI sai sem nada marcado. Fora isso, quem abre e fecha é a pessoa.
  const needsScenarios = usesCdi || invest.on || equivalent
  const scenariosDrawer = useRef(null), hadCdi = useRef(usesCdi), [scenariosStartOpen] = useState(needsScenarios || !!apresentacao)
  useEffect(() => {
    const drawer = scenariosDrawer.current
    if (drawer && !apresentacao && (needsScenarios || hadCdi.current)) drawer.open = needsScenarios
    hadCdi.current = usesCdi
  }, [needsScenarios, usesCdi, apresentacao])
  const scenariosSummary = [usesCdi && `cenário do CDI: ${scenario}`, invest.on && 'com aplicação financeira', equivalent && 'mesmo valor líquido'].filter(Boolean).join(' · ') || 'nenhuma opção marcada'
  const source = manual ? 'Premissa manual' : reference ? `${reference.source} · observação ${day(reference.date)}${reference.stale || macro.stale ? ' · referência atrasada/atualização pendente' : ''}` : 'Referência indisponível'
  const targetValue = equivalent ? parseMoneyInput(target).value ?? NaN : null
  const results = evaluateAll(visible, shared, { cdi, targetNet: equivalent ? targetValue : null })
  const shift = !usesCdiIn(visible) || scenario === 'Base' || !Number.isFinite(cdi) || !Number.isFinite(baseCdi) ? 0 : cdi - baseCdi
  const investParams = { regime: shared.regime, adicional: shared.adicional, product: invest.product, rate: parseDecimal(invest.rate), adminFee: parseDecimal(invest.adminFee), pts: curvePts, curveBase: curveToday?.date, ctx: hol.ctx, shift }
  const horizon = results.filter(r => r.ok).map(r => r.lastDate).sort().at(-1)
  const sharedValue = parseMoneyInput(shared.value).value
  const investment = invest.on ? {
    product: invest.product, rate: investParams.rate,
    alone: horizon && sharedValue > 0 ? investmentAlone({ ...investParams, start: shared.start, end: horizon, deposit: sharedValue }) : { ok: false, error: 'Preencha as operações para definir o período.' },
    vsCash: results.map(r => r.ok ? creditVsCash(r, investParams) : null),
  } : null
  const signature = JSON.stringify([count, visible, shared, scenario, cdi, source, equivalent, target, invest, curveToday?.date ?? null])
  const showResults = compared === signature
  const complete = confirmed === signature
  const invalidate = fn => value => { setConfirmed(null); fn(value) }
  const setColumn = i => invalidate(col => setColumns(list => list.map((c, k) => k === i ? col : c)))
  const content = <Results results={results} columns={visible} scenario={scenario} cdi={cdi} source={source} equivalent={equivalent} investment={investment} shared={shared} />
  const allOk = results.every(r => r.ok)
  const emailContext = { equivalent, scenario, cdi, complete }
  const combinedEmail = showResults && allOk && count > 1
    ? emailDraft(results.map((result, index) => ({ result, index })), emailContext) : undefined
  return <div className="credit-workspace"><section className="cx bw credit-comparison credit-bw" aria-labelledby="credit-title">
    <div className="bw-heading"><div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="credit-title"><span>Necessidade do Cliente</span></h2><CalculatorHelp title={count === 1 ? 'Como gerar a cotação' : 'Como usar o comparador'}><p>{count === 1 ? 'Preencha a operação e gere a cotação.' : 'Preencha a operação e compare as modalidades.'}</p><p>{count === 1 ? 'Preencha a demanda do cliente, escolha a modalidade e os encargos e confira custo, CET e fluxo.' : 'Preencha a demanda do cliente uma vez, escolha as modalidades e os encargos de cada uma e compare custo, CET e fluxo.'} Opcional: contra deixar o dinheiro aplicado, com a tributação da empresa.</p></CalculatorHelp></div>
    <nav className="bw-nav" aria-label="Área da necessidade do cliente">
      <button type="button" aria-pressed={area === 'compare'} onClick={() => setArea('compare')}>{count === 1 ? 'Cotar operação' : 'Comparar operações'}</button>
      <button type="button" aria-pressed={area === 'rules'} onClick={() => setArea('rules')}>Premissas e fontes</button>
    </nav></div>
    <div className="credit-bw-body" hidden={area !== 'compare'}>
    <SharedFields shared={shared} set={invalidate(setShared)} onClear={clearShared} apresentacao={apresentacao} />
    <section className="credit-charges" aria-labelledby="credit-charges-title">
    <h3 id="credit-charges-title">{step(2, 'Encargos')}</h3>
    <div className="credit-count" role="group" aria-label="Quantidade de operações"><span id="credit-count-label">Quantas operações?</span>
      <div className="seg">{Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, k) => k + MIN_COLUMNS).map(n => <button type="button" key={n} aria-pressed={n === count} onClick={() => invalidate(setCount)(n)}>{n}</button>)}</div>
      <CalculatorHelp title="Quantidade de operações"><p>Encargos: o que o banco cobra em cada operação.</p><p>Cada coluna pede os campos da sua modalidade e usa a conta da respectiva calculadora. Ao reduzir a quantidade, as colunas escondidas guardam o que foi digitado.</p></CalculatorHelp></div>
    <div className="credit-grid" style={{ '--credit-cols': count }}>{visible.map((col, i) => <ColumnCard individual={count === 1} key={i} index={i} col={col} set={setColumn(i)} result={results[i]} shared={shared}
      email={showResults && results[i].ok ? emailDraft([{ result: results[i], index: i }], emailContext) : undefined} />)}</div>
    </section>
    {/* Opções que mudam o resultado, num bloco só, antes do botão de comparar. */}
    <details className="credit-scenarios" ref={scenariosDrawer} open={scenariosStartOpen}>
    <summary>Cenários e comparações<small> · {scenariosSummary}</small></summary>
    {usesCdi && <section className="desk-panel credit-controls credit-cdi"><h3>Cenários do CDI<CalculatorHelp title="Cenários do CDI"><p>CDI constante em cada cenário; queda limitada a zero. Variação ilustrativa ajustável, não previsão de mercado. Referência de mercado não define o CDI futuro do contrato.</p></CalculatorHelp></h3><p className={!manual && !reference ? 'credit-alert' : undefined} role={!manual && !reference ? 'status' : undefined}>{source}</p><label><input type="checkbox" checked={manual} onChange={e => toggleManual(e.target.checked)} /> Informar referência manual</label>{manual && <label className="credit-field">CDI base (% a.a.)<input inputMode="decimal" value={cdiInputText} onChange={e => editCdi(e.target.value)} /></label>}{manual && curveAvg && <p className="credit-hint">Média da curva DI da B3 de {day(curveAvg.date)} em {curveAvg.months} meses{curveAvg.limited ? ' (prazo limitado ao último vértice da curva)' : ''}: <strong>{pct(curveAvg.value)} a.a.</strong> <button type="button" className="credit-link" onClick={useCurveAverage}>Usar a média</button></p>}<label className="credit-field">Variação dos cenários (pontos percentuais a.a.)<input inputMode="decimal" value={shock} onChange={e => invalidate(setShock)(e.target.value)} /></label><div className="seg" aria-label="Cenário">{['Queda', 'Base', 'Alta'].map(s => <button type="button" key={s} aria-pressed={s === scenario} onClick={() => invalidate(setScenario)(s)}>{s}</button>)}</div></section>}
    <InvestmentFields invest={invest} set={invalidate(setInvest)} curveBase={curveToday?.date} />
    <section className="desk-panel credit-controls"><label><input type="checkbox" checked={equivalent} onChange={e => invalidate(setEquivalent)(e.target.checked)} /> {count === 1 ? 'Definir o valor líquido desejado' : 'Comparar pelo mesmo valor líquido'}</label>{equivalent && <label className="credit-field" htmlFor="credit-target">{count === 1 ? 'Líquido desejado' : 'Líquido comum'}<MoneyInput id="credit-target" value={target} onChange={invalidate(setTarget)} /></label>}<CalculatorHelp title={count === 1 ? 'Definir o valor líquido desejado' : 'Comparar pelo mesmo valor líquido'}><p>{count === 1 ? 'Ajusta o valor contratado para o líquido desejado, mantendo taxas, encargos fixos, prazo e garantias.' : 'Recalcula o valor contratado de cada coluna para o líquido comum, mantendo taxas, encargos fixos, prazos e garantias.'} Os valores originais permanecem nos formulários.</p></CalculatorHelp></section>
    </details>
    <div className="credit-actions"><button type="button" className="credit-compare" onClick={() => setCompared(signature)}><span aria-hidden="true">⇄</span> {count === 1 ? 'Gerar cotação' : 'Comparar modalidades'}</button></div>
    {compared !== null && !showResults && <p className="credit-notice credit-alert" role="status">{count === 1 ? 'As condições mudaram desde a última cotação. Clique em Gerar cotação para atualizar o resultado.' : 'As condições mudaram desde a última comparação. Clique em Comparar modalidades para atualizar o resultado.'}</p>}
    {/* O resultado aparece depois de comparar (é o que o modo Apresentar mostra em "Resultado"). Único quadro com borda laranja;
        abaixo dos dados em largura total, porque exibe de 1 a 5 modalidades lado a lado. */}
    {showResults && <div className="rt-outcome calc-result-shell credit-outcome">
    <section className="credit-result-box" aria-labelledby="credit-result-title">
      <header className="credit-result-head">
        <h3 id="credit-result-title">{step(3, 'Resultado · custo final para o cliente')}</h3>
        {count > 1 && <EmailEnvelope label={`Preparar e-mail com as ${count} cotações da comparação`} href={combinedEmail} />}
      </header>
      <div className="credit-result-body">
        <p className="credit-result-status">CET estimado do fluxo informado, não CET certificado do contrato. {complete ? 'Conferência declarada pelo usuário; não é auditoria contratual.' : 'Encargos ainda não conferidos: resultados são preliminares.'}</p>
        {content}
        <div className="credit-result-actions">
          <label className="credit-confirm"><input type="checkbox" checked={complete} onChange={e => setConfirmed(e.target.checked ? signature : null)} /> Conferi todos os encargos e as convenções para esta simulação.</label>
          <button type="button" className="cx-action" disabled={!allOk || !complete} onClick={() => setPresent(content)}>{count === 1 ? 'Apresentar cotação' : 'Apresentar comparação'}</button>
        </div>
      </div>
    </section>
    </div>}
    </div>
    <div className="credit-bw-body" hidden={area !== 'rules'}>
    <section className="credit-method">
      <header>
        <h3>Premissas, limites e fonte do IOF</h3>
        <CalculatorHelp title="Premissas, limites e fonte do IOF">
          <p>Giro e Outra modalidade: prefixado em juros compostos dias corridos/30; CDI em dias úteis/252 com os feriados nacionais, os da praça do contrato e os informados, taxa diária do CDI multiplicada pelo percentual e spread composto à parte. Price tem pagamento constante, SAC amortiza o mesmo valor; dias até o primeiro vencimento além de 30 são carência capitalizada. Bullet tem vencimento único. IOF incide sobre o principal original, com teto de 365 dias.</p>
          <p>BNDES: custo financeiro, taxa do BNDES e spread do agente compostos ou somados; carência com juros pagos; vencimentos no dia 15 ou próximo dia útil e juros por dias corridos; na TLP capitalizada, CET sem o IPCA (art. 5º) e custo com IPCA à parte; regras e limites de prazo e carência da calculadora BNDES; IOF zero nos recursos Finame ou alíquota PJ/Simples. FINIMP: juros simples ano de 360 dias, flat e TAC, em reais pelo câmbio informado, sem variação cambial e sem IOF de câmbio. Conta Garantida: saldo utilizado integralmente por todo o período, juros e IOF pagos no fim. Desconto de duplicata: juros descontados na liberação, nominal pago no vencimento.</p>
          <p>{PRACA_AJUDA} Vale para Giro, Outra modalidade, BNDES e Desconto de duplicata; FINIMP e Conta Garantida seguem as próprias convenções (na Conta Garantida, só os feriados informados). {PRACA_RESSALVA}</p>
          <p>O CET de todas as modalidades é estimado pelo mesmo fluxo de caixa: líquido recebido na liberação e pagamentos datados, desconto ACT/365. Carência com juros pagos em giro, múltiplas liberações, amortizações extraordinárias, renegociação e garantias compartilhadas não são simuladas. Confira os cronogramas contra o contrato. <a href={IOF_SOURCE} target="_blank" rel="noreferrer">Fonte legal do IOF</a>. Regras compartilhadas com as demais calculadoras, para PJ e Simples/MEI a partir de 17/07/2025.</p>
        </CalculatorHelp>
      </header>
    </section>
    <section className="credit-method">
      <header>
        <h3>Aplicação financeira e tributação da empresa</h3>
        <CalculatorHelp title="Aplicação financeira e tributação da empresa">
          <p>Simples Nacional: o IR retido pelo banco é o imposto final (LC 123/2006, art. 13, § 1º, V). Lucro Presumido: o rendimento entra inteiro na base do IRPJ e da CSLL no resgate (Lei 9.430/1996, art. 25, II); o IR retido é antecipação; não há PIS/Cofins sobre o rendimento. Lucro Real: IRPJ e CSLL por competência; PIS/Cofins de 4,65% sobre o rendimento até 31/12/2026 (Decreto 8.426/2015), dedutível; a partir de 2027 a CBS não incide sobre rendimento financeiro (LC 214/2025, art. 6º, V); juros, IOF e tarifas do crédito reduzem o IRPJ/CSLL.</p>
          <p>IOF regressivo sobre o rendimento no resgate com menos de 30 dias (Decreto 6.306/2007). Fundos: come-cotas em maio e novembro (15% longo prazo, 20% curto prazo), definitivo só no Simples. LCI e LCA não são isentas para empresa. Prejuízo fiscal e o momento exato do recolhimento não são simulados. Recomendada revisão de um tributarista antes do uso com cliente.</p>
        </CalculatorHelp>
      </header>
    </section>
    </div>
    {present && <Presentation onClose={close}>{present}</Presentation>}
    {/* Referência de mercado: curva prefixada para operação de taxa fixa, CDI futuro para pós-CDI. Sempre o último bloco da tela. */}
    {/* O gráfico termina no prazo da operação mais longa da comparação (regra de 23/11/2026). */}
    <ReferenciaMercado tipos={[!visible.every(isCdi) && 'pre', usesCdi && 'pos'].filter(Boolean)}
      prazoMeses={Math.max(0, ...visible.map(col => Number.parseInt(col.term || shared.term, 10)).filter(Number.isFinite)) || undefined} />
  </section></div>
}
