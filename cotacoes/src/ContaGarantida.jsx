import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useEffect, useRef, useState } from 'react'
import { nbr5891 } from './format.js'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import ComparativoAlongamento from './ComparativoAlongamento.jsx'
import { CG_CET_DAYS, CG_SOURCES, CG_TAX_PROFILES, cgAddDays, cgInitialForm, cgToday, parseContaGarantidaForm } from './contaGarantida.js'
import LinhaMestra, { useLinhaMestra } from './LinhaMestra.jsx'
import { ComposicaoDoCusto, LinhaDoTempo, Respostas, Resultado, step } from './Roteiro.jsx'
import './ContaGarantida.css'
import './CalcPattern-conta-garantida.css'
import CalcBack from './CalcBack.jsx'

const brl = n => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = n => `${nbr5891(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dateLabel = d => d ? d.split('-').reverse().join('/') : '—'
const FOOT = 'Valor e data valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'
export function ContaGarantidaIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18v15H3zM3 10h18M7 3v4M17 3v4M7 14h4M9 12v4M14 15h4" /></svg>
}
// Roteiro de 21/11/2026, só no modo Utilização única: 1 Demanda, 2 Encargos, 3 Linha do tempo, 4 Resultado.
// Só ordem, nomes e apresentação: os números são os que parseContaGarantidaForm já devolvia.
// Lançamentos por dia e Comparar com parcelado seguem como eram.
export default function ContaGarantida({ onBack }) {
  const [form, setForm] = useState(cgInitialForm)
  // Linha mestra comum (19/11/2026): na utilização única, o valor e a data vêm dela e passam para as outras calculadoras.
  const [lm, setLm, clearLm] = useLinhaMestra(cgToday())
  const single = form.mode === 'single'
  const filled = single ? { ...form, amount: lm.value, start: lm.start } : form
  const [comparing, setComparing] = useState(false)
  const [page, setPage] = useState(0)
  const nextId = useRef(0)
  const [visited, setVisited] = useState({})
  const { errors: found, warnings, params, result: calculation, cet } = parseContaGarantidaForm({ ...filled, rateBase: '30', conversion: 'proportional', status: 'performing' })
  const result = calculation?.ok ? calculation : null
  // A tela abre sem vermelho: o erro de um campo só aparece depois que a pessoa passa por ele e sai.
  // Erros que dependem de outros campos (IOF, data final, data do lançamento) aparecem quando um desses campos já foi visitado.
  // A validação e o cálculo usam sempre a lista completa (found); só a exibição é adiada.
  const visit = key => setVisited(old => old[key] ? old : { ...old, [key]: true })
  const sources = key => key === 'taxProfile' ? ['start', 'amount', 'operationValue', 'eligible'] : key === 'end' ? ['start', 'duration'] : /^row-.+-date$/.test(key) ? ['start', 'end'] : []
  const errors = Object.fromEntries(Object.entries(found).filter(([key]) => visited[key] || sources(key).some(source => visited[source])))
  const pending = Object.keys(found).length > 0, flagged = Object.keys(errors).length > 0
  const missing = Object.keys(found)
  const guide = form.mode === 'single' && missing.every(key => ['amount', 'rate', 'duration', 'end', 'taxProfile'].includes(key)) ? 'Preencha valor, taxa e prazo para ver o resultado.'
    : form.mode === 'ledger' && missing.every(key => key === 'rate' || key.startsWith('row-')) ? 'Preencha os lançamentos e a taxa do contrato para ver o resultado.'
      : 'Preencha os campos que faltam para ver o resultado.'
  const set = (key, value) => { setForm(old => ({ ...old, [key]: value })); setPage(0) }
  const changeLm = (key, value) => { setLm(key, value); visit(key === 'value' ? 'amount' : key); setPage(0) }
  const control = key => ({ id: `cg-${key}`, 'aria-invalid': !!errors[key], 'aria-describedby': `cg-${key}-hint cg-${key}-error`, onBlur: () => visit(key) })
  const field = (key, label, input, hint = '', status = '') => <div className="cx-field" key={key}><div className="cx-field-label"><label htmlFor={`cg-${key}`}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>{input}<p id={`cg-${key}-hint`} className={status ? 'cx-hint' : 'sr-only'}>{status || hint}</p><p id={`cg-${key}-error`} className="cx-error" role={errors[key] ? 'alert' : undefined}>{errors[key] || ''}</p></div>
  const input = (key, label, hint, type = 'text', status = '') => field(key, label, <input {...control(key)} type={type} inputMode={type === 'text' ? 'decimal' : undefined} value={form[key]} onChange={e => set(key, e.target.value)} />, hint, status)
  const select = (key, label, choices, hint) => field(key, label, <select {...control(key)} value={form[key]} onChange={e => set(key, e.target.value)}>{choices.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>, hint)
  const money = (key, label, hint) => field(key, label, <MoneyInput {...control(key)} value={form[key]} onChange={value => set(key, value)} />, hint)
  const changeRow = (id, key, value) => { setForm(old => ({ ...old, rows: old.rows.map(row => row.id === id ? { ...row, [key]: value } : row) })); setPage(0) }
  const addRow = () => {
    const id = `entry-${++nextId.current}`
    setForm(old => ({ ...old, rows: [...old.rows, { id, date: cgAddDays(old.rows.at(-1)?.date || old.start, 1) || old.start, draw: '', payment: '' }] }))
  }
  const pages = result ? Math.ceil(result.rows.length / 31) : 0
  const safePage = Math.min(page, Math.max(0, pages - 1))
  // A gaveta "Enquadramento do IOF" abre sozinha quando um campo dela tem erro, para o aviso não ficar escondido.
  const iofDrawer = useRef(null)
  const iofAlert = !!(errors.taxProfile || errors.operationValue || errors.eligible)
  useEffect(() => { if (iofAlert && iofDrawer.current) iofDrawer.current.open = true }, [iofAlert, single, comparing])
  // Campos e textos que valem nos dois modos (utilização única e lançamentos por dia): mudam só de quadro.
  const rateHelp = <CalculatorHelp title="Juros e convenções do contrato"><p>Informe a taxa contratual em percentual ao mês. Para a apuração proporcional, os juros de cada dia correspondem ao saldo utilizado × taxa mensal ÷ 100 ÷ 30. O divisor 30 é fixo e não transforma o calendário real em meses de 30 dias. Juros não são capitalizados.</p></CalculatorHelp>
  const rateFields = <>
    {input('rate', single ? 'Taxa de juros (% a.m.)' : 'Taxa do contrato (% a.m.)', 'Taxa mensal em percentual, apurada proporcionalmente com base 30 e sem capitalização. Obrigatória. 0 significa sem juros; vazio não significa zero.')}
    {money('limit', 'Limite contratado (R$)', 'Opcional. Usado só para o CET: pela Resolução CMN 4.881/2020, art. 6º, o rotativo calcula o CET com prazo de 30 dias sobre o limite pactuado. Não muda o resultado do período.')}
    {select('dayCount', 'Dias que geram juros', [['calendar', 'Todos os dias corridos'], ['business', 'Dias úteis: segunda a sexta, menos feriados nacionais e extras']], 'Dias úteis descontam sábados, domingos e os feriados nacionais do calendário do painel (inclusive Carnaval, Sexta-feira Santa e Corpus Christi), além dos feriados extras que você informar. O IOF diário sempre considera dias corridos, inclusive fins de semana.')}
    {form.dayCount === 'business' && field('holidays', 'Feriados extras do contrato (AAAA-MM-DD)', <textarea {...control('holidays')} rows={3} value={form.holidays} onChange={e => set('holidays', e.target.value)} placeholder="2026-01-25, 2026-07-09" />, 'Opcional. Os feriados nacionais já são descontados pelo calendário do painel. Informe aqui só os feriados locais ou outros dias sem expediente previstos no contrato.')}
  </>
  const iofHelp = <CalculatorHelp title="Referência de IOF"><p>Juros e IOF são pagos à parte, sem capitalização ou financiamento no saldo utilizado. Operação rotativa por saldos diários: não se aplica um teto genérico de 365 dias. Os dois modos mantêm a mesma natureza rotativa, mesmo quando há apenas um saque.</p></CalculatorHelp>
  const iofProfile = select('taxProfile', 'Enquadramento da operação', CG_TAX_PROFILES.map(p => [p.id, p.label]), 'Referências consultadas em 05/11/2026. Não há atualização automática nem tratamento de mudanças de alíquota dentro do período.')
  const iofRates = <div className="cg-tax-reference"><span>IOF diário automático</span><b>{params.iofDaily == null ? '—' : `${String(params.iofDaily).replace('.', ',')}% ao dia`}</b><span>IOF adicional automático</span><b>{params.iofAdditional == null ? '—' : `${String(params.iofAdditional).replace('.', ',')}% sobre acréscimos diários`}</b></div>
  const iofSimples = form.taxProfile === 'simples' && <>
    {money('operationValue', 'Valor da operação confirmado no contrato', 'Redução até R$ 30 mil; acima, alíquota geral automática. Informe o valor total contratado, não o saldo momentâneo nem apenas um saque.')}
    <div className="cx-field"><div className="cx-field-label"><label className="cg-check" htmlFor="cg-eligible"><input {...control('eligible')} type="checkbox" checked={form.eligible} onChange={e => set('eligible', e.target.checked)} />Confirmo o enquadramento do Simples/MEI e a documentação com a instituição.</label><CalculatorHelp title="Confirmação do enquadramento"><p>Confirmo que o tomador é optante do Simples/MEI e que a operação e a documentação atendem ao art. 7º, VI, e ao art. 45, II, com a instituição financeira.</p><p>A seleção não comprova o enquadramento tributário.</p></CalculatorHelp></div><p id="cg-eligible-hint" className="sr-only">A seleção não comprova o enquadramento tributário.</p><p id="cg-eligible-error" className="cx-error" role={errors.eligible ? 'alert' : undefined}>{errors.eligible}</p></div>
  </>
  const iofNote = <p className="cx-hint cx-pad">Alíquotas consultadas em 05/11/2026; sem atualização automática.</p>
  // Avisos da conta; com resultado, também o aviso do CET.
  const alerts = (warnings.length > 0 || (result && !cet?.ok)) && <div className="cg-alerts">
    {warnings.map(warning => <p className="cg-notice" key={warning}>{warning}</p>)}
    {result && (cet && !cet.ok ? <p className="cg-notice" role="alert">CET não calculado: {cet.error}</p>
      : !cet?.ok && <p className="cg-notice">Sem CET: informe o limite contratado para ver o CET de 30 dias (art. 6º).</p>)}
  </div>
  const equiv = cet?.ok && <div className="cg-equiv">
    <div><span>CET (art. 6º · 30 dias sobre o limite)</span><b>{pct(cet.annual)} a.a.</b></div>
    <div><span>CET ao mês</span><b>{pct(cet.monthly)} a.m.</b></div>
    <div><span>Pagamento no {CG_CET_DAYS}º dia</span><b>{brl(cet.payment)}</b></div>
  </div>
  // Notas depois dos números; detalhes do CET recolhidos (na utilização única, as equivalências do CET ficam dentro da gaveta).
  const notes = result && <>
    <p className="cx-hint cg-note">{dateLabel(params.start)} a {dateLabel(params.end)} · {result.rows.length} fechamentos apurados · {result.totals.interestDays} dias com saldo e contagem de juros · taxa do contrato: {form.rate}% a.m.</p>
    <div className="calc-panel-context cg-note"><span>Como ler o resultado</span><CalculatorHelp title="Resultado estimado do período"><p>Custo total = juros + IOF diário + IOF adicional, todos pagos à parte. Não inclui a devolução do principal nem outras tarifas. Saldo devedor final é exclusivamente o valor utilizado ainda não amortizado. O pagamento dos custos não gera novas utilizações.</p></CalculatorHelp></div>
    {cet?.ok && <details className="cg-more"><summary>Como calculamos o CET</summary>
      {single && equiv}
      <div className="cx-heading"><span>Fluxo e regra do CET</span><CalculatorHelp title="Como calculamos o CET"><p>Fluxo do CET: {brl(cet.net)} líquidos em {dateLabel(cet.start)}; {brl(cet.payment)} em {dateLabel(cet.end)}.</p><p>Limite de {brl(cet.limit)} liberado em {dateLabel(cet.start)}, menos o IOF adicional ({brl(cet.additionalIof)}), cobrado na utilização: líquido de {brl(cet.net)}. Em {dateLabel(cet.end)}, devolução do limite + juros de {CG_CET_DAYS} dias ({brl(cet.interest)}) + IOF diário ({brl(cet.dailyIof)}), pela taxa, contagem de dias e IOF desta tela.</p><p>O CET é a taxa anual que iguala o valor liberado ao valor presente do pagamento, em dias corridos/365 (Resolução CMN 4.881/2020, arts. 4º e 6º). Ao mês: equivalente composta. Não há tarifas neste simulador.</p></CalculatorHelp></div>
      <p className="cg-notice">Regra do art. 6º da Resolução CMN 4.881/2020 (texto oficial conferido em 11/11/2026): prazo de 30 dias e limite pactuado. Obrigatória para pessoa física, ME e EPP (art. 1º); para as demais empresas, estimativa. Taxa e IOF do contrato prevalecem.</p>
    </details>}
  </>
  // Utilização única: linha do tempo e respostas. Só reparte o que a conta já devolve.
  const reais = value => result ? brl(value) : '—'
  const totals = result?.totals
  // Para cobrir a conta: devolve o valor utilizado (amortização na data da quitação) e paga juros e IOF, cobrados à parte.
  const cover = totals && totals.payment + totals.cost
  const events = result && [
    { label: 'Utilização', when: dateLabel(params.start), value: brl(totals.draw), note: 'Valor inteiro na conta: juros e IOF são pagos à parte' },
    { label: 'Período de uso', when: `de ${dateLabel(params.start)} a ${dateLabel(params.end)}`, value: result.calendarDays === 1 ? '1 dia corrido' : `${result.calendarDays} dias corridos`,
      note: `${totals.interestDays === 1 ? '1 dia gera' : `${totals.interestDays} dias geram`} juros${form.dayCount === 'business' ? ' (só dias úteis)' : ''}. O IOF diário conta todos os dias` },
    { label: 'Cobertura', when: dateLabel(params.end), value: brl(cover), note: `${brl(totals.payment)} do valor utilizado mais ${brl(totals.cost)} de juros e IOF` },
  ]
  const rateAnswer = cet?.ok ? { question: 'Qual é a taxa efetiva', value: `${pct(cet.annual)} a.a.`, note: `CET: ${pct(cet.monthly)} a.m. · 30 dias sobre o limite` }
    : { question: 'Qual é a taxa', value: result ? `${form.rate}% a.m.` : '—', note: `Taxa do contrato. ${cet ? 'CET não calculado' : 'CET: informe o limite'}` }
  const answers = <>
    <Respostas items={[
      { question: 'Quanto usou', value: reais(totals?.draw), note: result ? `Utilização em ${dateLabel(params.start)}` : 'Valor utilizado do limite' },
      { question: 'Quanto paga para cobrir', value: reais(cover), note: 'Valor utilizado mais juros e IOF do período' },
      rateAnswer,
      { question: 'Quanto custa', value: reais(totals?.cost), note: 'Juros + IOF diário + IOF adicional, pagos à parte', main: true },
    ]} />
    <ComposicaoDoCusto format={reais} parts={[
      { label: 'Juros', value: totals?.interest },
      { label: 'IOF diário', value: totals?.dailyIof },
      { label: 'IOF adicional', value: totals?.additionalIof },
    ]} rows={[
      { label: 'Custo total', value: reais(totals?.cost), kind: 'total' },
      { label: 'Saldo devedor final', value: reais(result?.balance), kind: 'muted' },
    ]} />
  </>
  // Aviso de quando ainda não há resultado: o que falta preencher, o que corrigir ou o erro da conta.
  let status = null
  if (pending) status = flagged ? { warning: true, text: 'Preencha ou corrija os campos sinalizados para calcular. Nenhum resultado anterior é mantido quando há erro.' } : { text: guide }
  else if (calculation && !calculation.ok) status = { error: true, warning: true, text: calculation.error }
  return <section className="cx cx-cg bw calc-standard calc-workspace" aria-labelledby="cg-heading">
    <div className="bw-heading calc-workspace-heading"><div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cg-heading" className="cx-title"><span>Conta Garantida</span></h2></div><CalculatorHelp title="Conta Garantida"><p>Simule uma utilização por prazo ou registre utilizações e amortizações por data. Veja o saldo diário, os juros e as duas parcelas do IOF.</p><p>Estimativa para crédito rotativo adimplente, com reutilização contratualmente prevista. Juros e IOF são pagos à parte, nunca incorporados ao saldo. Informe a taxa mensal da proposta e confira as convenções. Não é extrato nem cotação bancária.</p><p>CET: informe o limite contratado. Pela Resolução CMN 4.881/2020, art. 6º, o crédito rotativo calcula o CET com prazo de 30 dias e o limite pactuado. Regra aplicada conforme o resumo do painel; confira no texto da norma.</p><p>Os modos Utilização única e Lançamentos por dia simulam o rotativo. Comparar com parcelado estima sua substituição por um novo giro de principal definido. Nenhum modo calcula inadimplência ou renegociação.</p></CalculatorHelp></div>
    <p className="cg-notice">{comparing ? 'Compare encargos, parcelas e capacidade de pagamento. Estimativa, sem contratação ou CET.' : 'Estimativa para operação adimplente e rotativa. Não é extrato nem cotação bancária. O CET aparece quando você informa o limite contratado.'}</p>
    <div className="cg-modes" role="group" aria-label="Tipo de simulação">
      <button type="button" aria-pressed={!comparing && form.mode === 'single'} onClick={() => { setComparing(false); set('mode', 'single') }}>Utilização única</button>
      <button type="button" aria-pressed={!comparing && form.mode === 'ledger'} onClick={() => { setComparing(false); set('mode', 'ledger') }}>Lançamentos por dia</button>
      <button type="button" aria-pressed={comparing} onClick={() => setComparing(true)}>Comparar com parcelado</button>
    </div>
    {/* Tela recém-aberta: dica curta no topo do que preencher, sem vermelho e sem valores de exemplo. Some quando a pessoa começa. */}
    {!comparing && pending && !flagged && Object.keys(visited).length === 0 && <p className="cg-notice cg-guide cg-start">{single ? 'Para começar, confira a demanda do cliente e informe a taxa de juros. O resultado aparece logo abaixo.' : 'Para começar, confira a linha mestra e informe a taxa do contrato. O resultado aparece ao lado, no computador, ou logo abaixo, no celular.'}</p>}
    <div hidden={!comparing}><ComparativoAlongamento /></div>
    {!comparing && <>
    {/* Utilização única: roteiro de cima para baixo (21/11/2026). Lançamentos por dia: padrão de 18/11/2026, com dados à esquerda
        e resultado ao lado (computador largo) ou abaixo (telas menores). Só apresentação. */}
    <div className={single ? 'cg-workspace cg-roteiro' : 'cg-workspace'}>
    <div className="cg-inputs">
    {single ? <><LinhaMestra prefix="cg" title={step(1, 'Demanda do cliente')} foot={FOOT} values={lm} onChange={changeLm} onClear={clearLm} fields={['value', 'start']}
      labels={{ value: 'Valor utilizado', start: 'Data da utilização' }} errors={{ value: errors.amount, start: errors.start }}>
      {select('dateMode', 'Como informar o prazo?', [['duration', 'Quantidade de dias corridos'], ['end', 'Data da quitação']], 'A quitação é simulada no início da data final, antes dos encargos desse dia. O saldo inicial anterior à utilização é zero.')}
      {form.dateMode === 'duration' ? input('duration', 'Dias corridos de uso', 'Exemplo: 10 dias = data inicial + 10. A quitação ocorre antes da apuração do dia final.', 'text', `Quitação: ${dateLabel(params.end)}.`) : input('end', 'Data da quitação', 'O saldo é liquidado antes da apuração do dia.', 'date')}
      {errors.end && form.dateMode === 'duration' && <p className="cx-error lm-wide">{errors.end}</p>}
    </LinhaMestra>
    <article className="desk-panel cx-panel cg-narrow">
      <header className="cx-heading"><h3>{step(2, 'Encargos')}</h3>{rateHelp}</header>
      <div className="cx-form">{rateFields}</div>
      <div className="cg-iof">
        <div className="cx-field-label"><span>IOF</span>{iofHelp}</div>
        {iofRates}
        <details className="cg-iof-drawer" ref={iofDrawer}>
          <summary>Enquadramento do IOF<small> · {CG_TAX_PROFILES.find(p => p.id === form.taxProfile)?.label}</small></summary>
          <div className="cx-form">{iofProfile}{iofSimples}</div>
          {iofNote}
        </details>
      </div>
    </article></> : <>
    <article className="desk-panel cx-panel">
      <header className="cx-heading"><h3>1. Período e lançamentos</h3><CalculatorHelp title="Período e lançamentos"><p>Valores em branco na tabela valem zero. Várias linhas da mesma data são somadas antes do cálculo, sem ordem intradia. Amortização reduz somente o valor utilizado; os pagamentos de juros e IOF ficam fora desta tabela. Para ver o IOF correto de uma conta existente, traga o histórico, não trate o saldo antigo como novo saque.</p></CalculatorHelp></header>

        <div className="cx-form">{input('start', 'Primeiro dia apurado', 'Saldo anterior: zero. Para saldo já utilizado, inclua o histórico desde a utilização original.', 'date')}{input('end', 'Último dia apurado, inclusive', 'Não gera amortização automática. O saldo final pode continuar em aberto.', 'date')}</div>
        <div className="cx-wrap cg-entry-wrap" role="region" aria-label="Tabela editável de utilizações e amortizações" tabIndex={0}>
          <table className="cx-matrix cg-entry"><caption className="sr-only">Lançamentos da conta garantida; valores em reais</caption><thead><tr><th scope="col">Data</th><th scope="col">Utilização</th><th scope="col">Amortização</th><th scope="col">Ação</th></tr></thead><tbody>{form.rows.map((row, index) => <tr key={row.id}>
            {['date', 'draw', 'payment'].map(key => {
              const id = `row-${row.id}-${key}`, label = { date: 'Data', draw: 'Utilização', payment: 'Amortização' }[key]
              return <td key={key}>{field(id, `${label}, linha ${index + 1}`, key === 'date' ? <input {...control(id)} type="date" value={row.date} onChange={e => changeRow(row.id, key, e.target.value)} /> : <MoneyInput {...control(id)} value={row[key]} onChange={value => changeRow(row.id, key, value)} />)}</td>
            })}
            <td><button type="button" className="cg-button" disabled={form.rows.length === 1} aria-label={`Remover lançamento ${index + 1}`} onClick={() => set('rows', form.rows.filter(item => item.id !== row.id))}>Remover</button></td>
          </tr>)}</tbody></table>
        </div>
        <div className="cg-actions"><button type="button" className="cg-button" disabled={form.rows.length >= 500} onClick={addRow}>+ Adicionar lançamento</button><span className="cx-hint">{form.rows.length} de 500 linhas</span><CalculatorHelp title="Adicionar lançamentos"><p>Até 500 linhas. Lance somente utilização e amortização do principal. Juros e IOF são calculados separadamente.</p></CalculatorHelp></div>
    </article>

    <article className="desk-panel cx-panel cg-narrow">
      <header className="cx-heading"><h3>2. Juros e convenções do contrato</h3>{rateHelp}</header>
      <div className="cx-form">{rateFields}</div>
    </article>

    <article className="desk-panel cx-panel cg-narrow">
      <header className="cx-heading"><h3>3. Referência de IOF</h3>{iofHelp}</header>
      <div className="cx-form">{iofProfile}{iofRates}{iofSimples}</div>
      {iofNote}
    </article></>}

    </div>
    {/* Linha do tempo e resultado formam o quadro de resultado (é o que o modo Apresentar mostra em "Resultado"). */}
    {single ? <div className="rt-outcome calc-result-shell" aria-live="polite">
      <LinhaDoTempo id="cg-timeline-title" events={events} placeholder="Aparece quando valor, taxa e prazo estão preenchidos: utilização, período de uso e cobertura." />
      <Resultado id="cg-result-title" alert={status}>
        {result ? <ExpandablePanel title="Resultado estimado do período">{alerts}{answers}{notes}</ExpandablePanel> : <>{alerts}{answers}</>}
      </Resultado>
    </div> : <aside className="cg-result-col" aria-label="Resultado da simulação">
    <article className="desk-panel cx-panel cg-result-box">
      {!result && <header className="cg-result-head"><h3>Resultado</h3></header>}
      {/* Falta de dados e avisos: faixa no topo do quadro do resultado. */}
      <div aria-live="polite" className="cg-result-status">
        {pending && (flagged
          ? <p className="cg-notice">Preencha ou corrija os campos sinalizados para calcular. Nenhum resultado anterior é mantido quando há erro.</p>
          : <p className="cg-notice cg-guide">{guide}</p>)}
        {calculation && !calculation.ok && <p role="alert" className="cg-notice">{calculation.error}</p>}
      </div>
      {!result && warnings.map(warning => <p className="cg-notice" key={warning}>{warning}</p>)}
      {result && <ExpandablePanel title="Resultado estimado do período">
        {alerts}
        {/* a. Resposta principal: custo de juros + IOF sobre os saldos e a taxa efetiva. Só reorganiza números já calculados. */}
        <div className="cg-answer">
          <div className="cg-answer-main"><small>Custo total do período</small><b>{brl(result.totals.cost)}</b><span>Juros + IOF diário + IOF adicional, pagos à parte</span></div>
          {cet?.ok ? <div className="cg-answer-side"><small>CET · taxa efetiva</small><b>{pct(cet.annual)} a.a.</b><span>{pct(cet.monthly)} a.m. · 30 dias sobre o limite</span></div>
            : <div className="cg-answer-side"><small>Taxa do contrato</small><b>{form.rate}% a.m.</b><span>{cet ? 'CET não calculado' : 'CET: informe o limite'}</span></div>}
        </div>
        {/* b. Equivalências */}
        {equiv}
        {/* c. Valores em reais, agrupados, terminando no total */}
        <div className="cg-values" role="group" aria-label="Valores em reais">
          <h4 className="cg-grp">Utilização</h4>
          <div><span>Total de utilizações</span><b>{brl(result.totals.draw)}</b></div>
          <div><span>Saldo devedor final</span><b>{brl(result.balance)}</b></div>
          <h4 className="cg-grp">Custo do período</h4>
          <div><span>Juros apurados</span><b>{brl(result.totals.interest)}</b></div>
          <div><span>IOF diário</span><b>{brl(result.totals.dailyIof)}</b></div>
          <div><span>IOF adicional</span><b>{brl(result.totals.additionalIof)}</b></div>
          <div className="cg-total"><span>Custo total</span><b>{brl(result.totals.cost)}</b></div>
        </div>
        {notes}
      </ExpandablePanel>}
    </article>
    </aside>}
    </div>

    {/* d. Tabelas longas em largura total, recolhidas: nada foi apagado. */}
    {result && <details className="cg-tables"><summary>Tabelas: apuração mensal e memória de cálculo diária</summary>
        <article className="desk-panel cx-panel calc-result-shell">
          <ExpandablePanel title="Apuração mensal dentro do período"><div className="calc-panel-context"><CalculatorHelp title="Apuração mensal dentro do período"><p>Meses inicial e final podem estar incompletos. A tabela apura custo, não simula o calendário de recolhimento do banco. Soma dos saldos é uma base acumulada de reais × dias, não o saldo da conta.</p></CalculatorHelp></div>
          <div className="cx-wrap" role="region" aria-label="Tabela mensal de juros e IOF" tabIndex={0}><table className="cx-matrix cg-results"><caption className="sr-only">Somatórios do período selecionado por mês; não são datas de pagamento</caption><thead><tr><th scope="col">Mês</th><th scope="col">Soma dos saldos</th><th scope="col">Soma dos acréscimos</th><th scope="col">Juros</th><th scope="col">IOF diário</th><th scope="col">IOF adicional</th><th scope="col">IOF total</th></tr></thead><tbody>{result.months.map(month => <tr key={month.month}><th scope="row">{month.month.split('-').reverse().join('/')}</th><td>{brl(month.dailyBase)}</td><td>{brl(month.additionalBase)}</td><td>{brl(month.interest)}</td><td>{brl(month.dailyIof)}</td><td>{brl(month.additionalIof)}</td><td>{brl(month.dailyIof + month.additionalIof)}</td></tr>)}</tbody></table></div>
        </ExpandablePanel></article>
        <article className="desk-panel cx-panel calc-result-shell">
          <ExpandablePanel title="Memória de cálculo diária">
          <div className="cx-wrap" role="region" aria-label="Tabela diária, role horizontalmente para ver todas as colunas" tabIndex={0}><table className="cx-matrix cg-results"><caption className="sr-only">Saldo utilizado no fechamento, juros pagos à parte e bases do IOF</caption><thead><tr><th scope="col">Data</th><th scope="col">Utilização</th><th scope="col">Amortização</th><th scope="col">Juros do dia</th><th scope="col">Saldo final / base IOF</th><th scope="col">Acréscimo / base adicional</th><th scope="col">IOF diário</th><th scope="col">IOF adicional</th></tr></thead><tbody>{result.rows.slice(safePage * 31, safePage * 31 + 31).map(row => <tr key={row.date}><th scope="row">{dateLabel(row.date)}{!row.countsInterest && <small>Sem juros neste dia</small>}</th>{['draw', 'payment', 'interest', 'balance', 'additionalBase', 'dailyIof', 'additionalIof'].map(key => <td key={key}>{brl(row[key])}</td>)}</tr>)}</tbody></table></div>
          <div className="cg-pagination"><button type="button" className="cg-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button><span>Página {safePage + 1} de {pages} · até 31 dias por página</span><button type="button" className="cg-button" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Próxima</button></div>
        </ExpandablePanel></article>
    </details>}
    <div className="cg-method cx-heading"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Como calculamos e onde a simulação não se aplica"><ul>
      <li>Saldo anterior ao primeiro dia é zero. Agrupamos utilizações e amortizações da mesma data. Saldo utilizado = saldo anterior + utilizações − amortizações. Juros e IOF são pagos pelo cliente à parte: nunca viram principal, nunca geram juros sobre juros e nunca aumentam a base do IOF nesta simulação.</li>
      <li>Em utilização única, a data inicial conta e a data de quitação não gera juros nem IOF diário se o saldo ficar zerado. Utilização e quitação na mesma data ficam líquidas em zero nesta convenção, sem modelar crédito intradia. Confirme datas-valor e horários do banco.</li>
      <li>A taxa do contrato é sempre mensal e percentual. Juros do dia = saldo utilizado × taxa mensal ÷ 100 ÷ 30, apenas nos dias escolhidos, sem capitalização. A base 30 é fixa; o calendário da utilização continua real.</li>
      <li>IOF diário = saldo de fechamento × alíquota diária. IOF adicional = máximo entre zero e a diferença entre saldo final e saldo final anterior × alíquota adicional. Como os encargos são pagos à parte neste simulador, as bases incluem apenas o principal utilizado. Amortizações não devolvem IOF já apurado; nova elevação do saldo gera novo adicional.</li>
      <li>A premissa de encargos pagos à parte foi adotada para este simulador; não é uma regra universal de todos os contratos. O art. 7º, § 12, prevê encargos na base quando integrarem saldos devedores. Operações com encargos debitados na conta exigem outro tratamento e não são simuladas aqui.</li>
      <li>Sem arredondamento intermediário; a exibição é arredondada para centavos. A soma dos centavos exibidos pode diferir do total calculado com precisão completa.</li>
      <li>CET (Resolução CMN 4.881/2020, arts. 4º e 6º, texto oficial): o limite contratado é liberado na data inicial e devolvido em 30 dias corridos, com juros de 30 dias pela taxa e contagem de dias desta tela e o IOF diário e adicional desse período. O IOF adicional é cobrado na utilização e sai do valor líquido; juros e IOF diário, apurados dia a dia, entram no pagamento do 30º dia. Não há tarifas neste simulador. O CET é a taxa anual que iguala o líquido ao valor presente do pagamento, em dias corridos/365; ao mês, a equivalente composta. Confira a regra no texto da norma.</li>
      <li>Não inclui indexadores variáveis como CDI, spread variável, mora, multa, excesso de limite, renegociação, isenções não confirmadas nem taxas que mudam no período. As regras de inadimplência dos §§ 18–19 não são simuladas. Contratos com principal definido têm base de IOF diferente.</li>
      <li>Valor e data da utilização ficam na demanda do cliente (linha mestra, comum às calculadoras de empréstimo), só nesta aba do navegador; fechar a aba ou clicar em Limpar apaga. Os demais campos ficam somente nesta tela. Nenhum valor informado é enviado a serviços ou incluído na busca.</li>
    </ul><p>Fontes consultadas em 05/11/2026: {CG_SOURCES.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}.</p></CalculatorHelp></div>
    </>}
  </section>
}
