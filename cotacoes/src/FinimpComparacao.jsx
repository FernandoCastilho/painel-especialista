import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { Fragment, useState, useSyncExternalStore } from 'react'
import FinimpHelp from './FinimpHelp.jsx'
import { FINIMP_HELP } from './finimpHelpContent.js'
import MoneyInput from './MoneyInput.jsx'
import { FINIMP_TERMS, compareFinimp, finimpCost, solveFinimpRate } from './finimpComparison.js'
import { finimpDraftStore } from './calculatorDraft.js'
import { FINIMP_CURRENCIES, validateFinimpInputs } from './finimpInputs.js'
import { parseDecimal } from './emprestimo.js'
import { formatFinimpRate, formatFinimpPercent as pct, formatFinimpDelta as delta } from './finimpPresentation.js'
import { ComposicaoDoCusto, Respostas, Resultado, step } from './Roteiro.jsx'
import ReferenciaMercado from './ReferenciaMercado.jsx'
import './FinimpComparacao.css'
import './CalcPattern-finimp.css'
import CalcBack from './CalcBack.jsx'

export default function FinimpComparacao({ onBack }) {
  const draft = useSyncExternalStore(finimpDraftStore.subscribe, finimpDraftStore.getSnapshot, finimpDraftStore.getSnapshot)
  const { principalText, currency, competitor, itau, useTac, tacFxText, goalMode, goalTerm, targetText } = draft
  const setField = key => value => finimpDraftStore.update({ [key]: value })
  const setPrincipal = setField('principalText'), setCurrency = value => finimpDraftStore.update({ currency: value, tacFxText: '' }), setCompetitor = setField('competitor'), setItau = setField('itau')
  const setUseTac = setField('useTac'), setGoalMode = setField('goalMode'), setGoalTerm = setField('goalTerm'), setTarget = setField('targetText')
  const setTacFx = setField('tacFxText')
  const [touched, setTouched] = useState({})
  const [selectedDays, setSelectedDays] = useState(null)
  const [focusedField, setFocusedField] = useState(null)
  const { principal, competitor: a, itau: b, target, errors, conditionsReady } = validateFinimpInputs(draft)
  const rows = FINIMP_TERMS.map(days => compareFinimp({ principal, days, competitor: a, itau: b }))
  const selected = finimpCost({ ...a, principal, days: FINIMP_TERMS[goalTerm] })
  const goal = solveFinimpRate({ principal, days: FINIMP_TERMS[goalTerm], flatRate: b.flatRate, tac: b.tac, targetCost: goalMode === 'equal' ? (selected.ok ? selected.cost : null) : target })
  const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const moneyBrl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const differenceAmount = n => n !== 0 && Math.abs(n) < 0.005 ? `${n > 0 ? '+' : '−'} < 0,01 ${currency}` : money(n)
  const help = (key, suffix='') => <FinimpHelp title={FINIMP_HELP[key].title+(suffix?' · '+suffix:'')}><p>{FINIMP_HELP[key].text}</p></FinimpHelp>
  const field = (label, id, value, change, monetary = false, helpKey, suffix, options = {}) => {
    const error = (options.showError || touched[id] || value !== '') && errors[id]
    const attrs = { id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined, onBlur: () => { setTouched(t => ({ ...t, [id]: true })); setFocusedField(null) } }
    const rate = monetary || options.raw ? null : parseDecimal(value)
    const displayedValue = focusedField !== id && rate !== null ? formatFinimpRate(rate) : value
    return <div className="cx-field"><div className="fi-label cx-field-label"><label htmlFor={id}>{label}</label>{helpKey && help(helpKey, suffix)}</div>{monetary ? <MoneyInput {...attrs} prefix={options.prefix ?? currency} value={value} onChange={change} /> : <input {...attrs} inputMode="decimal" autoComplete="off" value={displayedValue} onFocus={() => setFocusedField(id)} onChange={e => change(e.target.value)} />}{error && <p className="cx-error" id={`${id}-err`} role="alert">{error}</p>}</div>
  }
  // Encargos de cada proposta, com os nomes padrão das calculadoras; "flat" é próprio do produto.
  const bankFields = (name, bank, setBank, key) => <fieldset className="fi-bank"><legend>{name}</legend>{field(<>Taxa de juros <small>anual simples, %</small></>, `fi-${key}-rate`, bank.annualRate, v => setBank({ ...bank, annualRate: v }), false, 'rate', name)}{field(<>Flat <small>sobre o principal, %</small></>, `fi-${key}-flat`, bank.flatRate, v => setBank({ ...bank, flatRate: v }), false, 'flat', name)}{useTac && field('TAC à vista (R$)', `fi-${key}-tac`, bank.tac, v => setBank({ ...bank, tac: v }), true, 'tac', name, { prefix: 'R$' })}</fieldset>
  // Resposta principal: o prazo escolhido na demanda (ou na tabela) ou, sem escolha, o da meta. Só lê valores já calculados na tabela.
  const answerDays = selectedDays ?? FINIMP_TERMS[goalTerm]
  const answerRow = rows[FINIMP_TERMS.indexOf(answerDays)]
  const answer = conditionsReady && answerRow?.ok ? answerRow : null
  // Meta: a taxa atual da Instituição 2 contra a taxa requerida (o custo cresce com a taxa; nenhuma conta nova).
  const goalMet = goal.ok && b.annualRate !== null ? b.annualRate <= goal.annualRate * (1 + 1e-12) + 1e-12 : null
  // Roteiro (21/11/2026): o resultado só reparte e reordena o que a conta devolveu para o prazo escolhido (a linha do tempo saiu
  // em 21/11/2026). Tela limpa: explicações ficam nos "?".
  const moneyText = value => answer ? money(value) : '—'
  const costNote = cost => answer ? `${pct(cost.periodPercent)} do principal em ${answerDays} dias` : 'Juros, flat e TAC'
  // Do que é feito o custo de cada proposta: juros + flat + TAC (na moeda do principal) = custo.
  const costParts = (name, cost, bank) => <div key={name}><ComposicaoDoCusto title={`Do que é feito o custo · ${name}`} format={moneyText}
    parts={[{ label: 'Juros', value: cost?.interest }, { label: 'Flat', value: cost?.flat },
      ...(useTac ? [{ label: currency !== 'BRL' && bank.tacBrl > 0 ? `TAC à vista (${moneyBrl(bank.tacBrl)})` : 'TAC à vista', value: cost?.tac }] : []),
    ].map(part => cost?.cost > 0
      ? { ...part, label: `${part.label} · ${pct(100 * part.value / cost.cost)}` }
      : part)}
    total={{ label: 'Custo total', value: cost?.cost }} /></div>
  return <section className="cx fi bw calc-standard calc-workspace" aria-labelledby="fi-heading">
    <div className="cx-toolbar">
      <button type="button" className="cx-back" onClick={() => { finimpDraftStore.reset(); setTouched({}); setSelectedDays(null); setFocusedField(null) }}>Nova simulação</button>
    </div>
    <div className="bw-heading calc-workspace-heading"><div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="fi-heading" className="cx-title"><span>FINIMP · comparação de propostas</span></h2></div>{help('simulation')}</div>
    <div className="fi-inputs">
    <article className="desk-panel cx-panel fi-box"><header><h3 className="cx-heading"><span>{step(1, 'Demanda do cliente')}</span><FinimpHelp title="Como começar"><p>Para começar, informe o principal e, em cada instituição, a taxa anual e o flat. A tabela e a meta de custo se completam sozinhas.</p></FinimpHelp></h3></header>
    {/* Tela recém-aberta: o que preencher aparece no aviso do resultado; "como começar" fica no "?" do título. */}
    <div className="cx-form">
      {field(`Principal (${currency})`, 'fi-principal', principalText, setPrincipal, true)}
      <div className="cx-field"><div className="fi-label cx-field-label"><label htmlFor="fi-currency">Moeda</label>{help('currency')}</div><select id="fi-currency" value={currency} onChange={e => setCurrency(e.target.value)}>{FINIMP_CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></div>
      {/* O prazo que o cliente quer: o mesmo seletor que fica na tabela (os doze prazos fixos), agora também aqui. */}
      <div className="cx-field"><div className="fi-label cx-field-label"><label htmlFor="fi-term">Prazo</label><FinimpHelp title="Prazo"><p>Os doze prazos fixos da tabela, de 30 a 360 dias. Sem escolha, acompanha o prazo da meta.</p></FinimpHelp></div><select id="fi-term" value={answerDays} onChange={e => setSelectedDays(Number(e.target.value))}>{FINIMP_TERMS.map(days => <option key={days} value={days}>{days} dias</option>)}</select></div>
    </div></article>
    <article className="desk-panel cx-panel fi-box"><header><h3 className="cx-heading"><span>{step(2, 'Encargos')}</span></h3></header>
    <div className="fi-banks">{bankFields('Instituição 1', competitor, setCompetitor, 'a')}{bankFields('Instituição 2', itau, setItau, 'b')}</div>
    <div className="fi-tac-toggle"><label className="fi-check"><input type="checkbox" checked={useTac} onChange={e => setUseTac(e.target.checked)} /> Incluir TAC à vista</label>{help('tac')}</div>
    <p className="fi-tac-status" role="status">TAC {useTac ? 'incluída' : 'excluída'}.</p>
    {useTac && currency !== 'BRL' && <div className="cx-form">{field(`Câmbio da TAC (R$ por ${currency})`, 'fi-tac-fx', tacFxText, setTacFx, false, 'tacFx', currency, { raw: true, showError: a.tacBrl > 0 || b.tacBrl > 0 })}</div>}
    </article>
    </div>
    {/* O quadro de resultado é o que o modo Apresentar mostra em "Resultado". */}
    <div className="rt-outcome calc-result-shell" aria-live="polite">
      <Resultado id="fi-result-title" number={3} alert={answer ? null : conditionsReady ? { error: true, warning: true, text: answerRow?.error || 'Resultado fora do limite numérico; revise as condições.' }
        : { text: 'Informe o principal e as condições das duas instituições para comparar os prazos.' }}>
        {/* Sem apontar vencedor (decisão do Fernando registrada em docs/finimp-comparacao.md): os dois custos lado a lado e a diferença, com o sinal. */}
        <Respostas items={[
          // O principal entra cheio; flat (e TAC) são cobrados à parte, por isso "antes do flat" (Auditor, 21/11/2026).
          { question: 'Quanto recebe (antes do flat)', value: moneyText(principal), note: answer ? `Principal · ${answerDays} dias` : 'Principal desembolsado' },
          { question: 'Quanto custa na Instituição 1', value: moneyText(answer?.competitor.cost), note: costNote(answer?.competitor) },
          { question: 'Quanto custa na Instituição 2', value: moneyText(answer?.itau.cost), note: costNote(answer?.itau) },
          { question: 'Qual a diferença', value: answer ? differenceAmount(answer.difference) : '—', main: true,
            note: answer ? `Instituição 2 menos Instituição 1 · ${delta(answer.deltaPp)} no período` : 'Instituição 2 menos Instituição 1' },
        ]} />
        <div className="fi-parts">{costParts('Instituição 1', answer?.competitor, a)}{costParts('Instituição 2', answer?.itau, b)}</div>
      </Resultado>
    </div>
    {/* Depois do resultado: a meta (campos e resposta juntos) e a tabela completa dos doze prazos, recolhida. */}
    <article className="desk-panel cx-panel fi-box fi-goal-box"><header><h3 className="cx-heading"><span>Atingir meta de custo</span>{help('goal')}</h3></header>
      <div className="fi-goal-body">
        <div className="cx-form"><div className="cx-field"><div className="cx-field-label"><label htmlFor="fi-goal-mode">Meta</label></div><select id="fi-goal-mode" value={goalMode} onChange={e => setGoalMode(e.target.value)}><option value="equal">Igualar custo da Instituição 1</option><option value="target">Custo alvo informado</option></select></div><div className="cx-field"><div className="cx-field-label"><label htmlFor="fi-goal-term">Prazo da meta</label></div><select id="fi-goal-term" value={goalTerm} onChange={e => setGoalTerm(Number(e.target.value))}>{FINIMP_TERMS.map((days, i) => <option key={days} value={i}>{days} dias</option>)}</select></div>{goalMode === 'target' && field(`Custo alvo (${currency})`, 'fi-target', targetText, setTarget, true)}</div>
        <div className="fi-goal-result"><small>Meta · {FINIMP_TERMS[goalTerm]} dias</small>
          <div className="fi-goal" role="status">{goal.ok ? <>{goalMet !== null && <p className={`fi-goal-met${goalMet ? ' is-met' : ''}`}><span aria-hidden="true">{goalMet ? '▼' : '▲'}</span> Instituição 2 hoje a {pct(b.annualRate)} a.a.: {goalMet ? 'atinge a meta' : 'acima da taxa requerida, não atinge a meta'}</p>}<strong>Taxa requerida: {pct(goal.annualRate)} a.a.</strong><p>Custo calculado: {money(goal.result.cost)} ({pct(goal.result.periodPercent)} no período).</p><button type="button" onClick={() => setItau({ ...itau, annualRate: goal.annualRate.toLocaleString('pt-BR', { useGrouping: false, maximumSignificantDigits: 17 }) })}>Aplicar taxa à Instituição 2</button></> : <p>{conditionsReady ? goal.error : 'Preencha o principal e as condições das instituições para ver a taxa que atinge a meta.'}</p>}</div>
        </div>
      </div>
    </article>
    <details className="fi-table-drawer"><summary>Ver todos os prazos <small>de 30 a 360 dias</small></summary>
      <ExpandablePanel title="Tabela comparativa FINIMP"><div className="calc-panel-context">{help('period')}</div>
      <p id="fi-table-help" className="sr-only">12 prazos fixos, de 30 a 360 dias. Clique em uma linha para destacá-la. Pelo teclado, use Tab até o botão do prazo e pressione Enter ou Espaço. Use rolagem para acessar todas as colunas.</p>
      <div className="fi-scroll" role="region" aria-label="Comparação por prazo" aria-describedby="fi-table-help" tabIndex={0}>
        <table className="fi-compare"><caption className="sr-only">Comparação de custos no período. Instituição 2 menos Instituição 1.</caption>
          <thead><tr><th scope="col" rowSpan={2}>Prazo<br />(dias)</th><th scope="colgroup" colSpan={useTac ? 5 : 4}>Instituição 1</th><th scope="colgroup" colSpan={useTac ? 5 : 4}>Instituição 2</th><th scope="colgroup" colSpan={2}>Comparação</th></tr>
            <tr>{['a', 'b'].map(bank => <Fragment key={bank}>{[<th key={bank + '-interest'} scope="col">Juros ({currency})</th>, <th key={bank + '-flat'} scope="col">Flat ({currency})</th>, useTac && <th key={bank + '-tac'} scope="col">TAC à vista (R$)</th>, <th key={bank + '-cost'} scope="col">Custo ({currency}){help('cost',bank==='a'?'Instituição 1':'Instituição 2')}</th>, <th key={bank + '-percent'} scope="col">Custo no período (%)</th>]}</Fragment>)}<th scope="col">Diferença ({currency}){help('comparison')}</th><th scope="col">Delta do custo (p.p.)</th></tr>
          </thead>
          <tbody>{rows.map((r, i) => <tr key={FINIMP_TERMS[i]} className={selectedDays === FINIMP_TERMS[i] ? 'fi-row-selected' : undefined} onClick={() => setSelectedDays(FINIMP_TERMS[i])}><th scope="row"><button type="button" className="fi-row-select" aria-label={`Selecionar prazo de ${FINIMP_TERMS[i]} dias`} aria-pressed={selectedDays === FINIMP_TERMS[i]} onClick={() => setSelectedDays(FINIMP_TERMS[i])}>{FINIMP_TERMS[i]}</button></th>{r.ok ? <>{['competitor', 'itau'].map(key => <Fragment key={key}>{[<td key={key + '-interest'}>{money(r[key].interest)}</td>, <td key={key + '-flat'}>{money(r[key].flat)}</td>, useTac && <td key={key + '-tac'}>{moneyBrl((key === 'competitor' ? a : b).tacBrl)}</td>, <td className="fi-cost" key={key + '-cost'}><strong>{money(r[key].cost)}</strong></td>, <td key={key + '-percent'}>{pct(r[key].periodPercent)}</td>]}</Fragment>)}<td className="fi-difference"><strong>{differenceAmount(r.difference)}</strong></td><td className="fi-delta">{delta(r.deltaPp)}</td></> : <td colSpan={useTac ? 12 : 10}>{conditionsReady ? r.error || 'Resultado fora do limite numérico; revise as condições.' : '—'}</td>}</tr>)}</tbody>
        </table>
      </div>
    </ExpandablePanel></details>
    {/* Operação em moeda: a referência é a cotação da moeda escolhida. Em reais não há câmbio a mostrar. Sempre o último bloco. */}
    {currency !== 'BRL' && <ReferenciaMercado tipos={['cambio']} moeda={currency} />}
  </section>
}
