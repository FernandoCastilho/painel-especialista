import { useRef, useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import ComparativoAlongamento from './ComparativoAlongamento.jsx'
import { CG_CET_DAYS, CG_SOURCES, CG_TAX_PROFILES, cgAddDays, cgInitialForm, parseContaGarantidaForm } from './contaGarantida.js'
import './ContaGarantida.css'

const brl = n => n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = n => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dateLabel = d => d ? d.split('-').reverse().join('/') : '—'
export function ContaGarantidaIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18v15H3zM3 10h18M7 3v4M17 3v4M7 14h4M9 12v4M14 15h4" /></svg>
}
export default function ContaGarantida({ onBack }) {
  const [form, setForm] = useState(cgInitialForm)
  const [comparing, setComparing] = useState(false)
  const [page, setPage] = useState(0)
  const nextId = useRef(0)
  const { errors, warnings, params, result: calculation, cet } = parseContaGarantidaForm({ ...form, rateBase: '30', conversion: 'proportional', status: 'performing' })
  const result = calculation?.ok ? calculation : null
  const set = (key, value) => { setForm(old => ({ ...old, [key]: value })); setPage(0) }
  const control = key => ({ id: `cg-${key}`, 'aria-invalid': !!errors[key], 'aria-describedby': `cg-${key}-hint cg-${key}-error` })
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
  return <section className="cx cx-cg" aria-labelledby="cg-heading">
    <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
    <div className="cx-heading"><h2 id="cg-heading" className="cx-title"><span className="cx-icon"><ContaGarantidaIcon /></span>Conta Garantida</h2><CalculatorHelp title="Conta Garantida"><p>Simule uma utilização por prazo ou registre utilizações e amortizações por data. Veja o saldo diário, os juros e as duas parcelas do IOF.</p><p>Estimativa para crédito rotativo adimplente, com reutilização contratualmente prevista. Juros e IOF são pagos à parte, nunca incorporados ao saldo. Informe a taxa mensal da proposta e confira as convenções. Não é extrato nem cotação bancária.</p><p>CET: informe o limite contratado. Pela Resolução CMN 4.881/2020, art. 6º, o crédito rotativo calcula o CET com prazo de 30 dias e o limite pactuado. Regra aplicada conforme o resumo do painel; confira no texto da norma.</p><p>Os modos Utilização única e Lançamentos por dia simulam o rotativo. Comparar com parcelado estima sua substituição por um novo giro de principal definido. Nenhum modo calcula inadimplência ou renegociação.</p></CalculatorHelp></div>
    <p className="cg-notice">{comparing ? 'Compare encargos, parcelas e capacidade de pagamento. Estimativa, sem contratação ou CET.' : 'Estimativa para operação adimplente e rotativa. Não é extrato nem cotação bancária. O CET aparece quando você informa o limite contratado.'}</p>
    <div className="cg-modes" role="group" aria-label="Tipo de simulação">
      <button type="button" aria-pressed={!comparing && form.mode === 'single'} onClick={() => { setComparing(false); set('mode', 'single') }}>Utilização única</button>
      <button type="button" aria-pressed={!comparing && form.mode === 'ledger'} onClick={() => { setComparing(false); set('mode', 'ledger') }}>Lançamentos por dia</button>
      <button type="button" aria-pressed={comparing} onClick={() => setComparing(true)}>Comparar com parcelado</button>
    </div>
    <div hidden={!comparing}><ComparativoAlongamento /></div>
    {!comparing && <>
    <article className="desk-panel cx-panel">
      <header className="cx-heading"><h3>1. {form.mode === 'single' ? 'Valor e período de utilização' : 'Período e lançamentos'}</h3><CalculatorHelp title={form.mode === 'single' ? 'Valor e período de utilização' : 'Período e lançamentos'}>{form.mode === 'single' ? <p>A quitação é simulada no início da data final, antes dos encargos desse dia. O saldo inicial anterior à utilização é zero.</p> : <p>Valores em branco na tabela valem zero. Várias linhas da mesma data são somadas antes do cálculo, sem ordem intradia. Amortização reduz somente o valor utilizado; os pagamentos de juros e IOF ficam fora desta tabela. Para ver o IOF correto de uma conta existente, traga o histórico, não trate o saldo antigo como novo saque.</p>}</CalculatorHelp></header>
      {form.mode === 'single' ? <>
        <div className="cx-form">{select('dateMode', 'Como informar o prazo?', [['duration', 'Quantidade de dias corridos'], ['end', 'Data da quitação']], 'A quitação é simulada no início da data final, antes dos encargos desse dia.')}</div>
        <div className="cx-wrap cg-entry-wrap" role="region" aria-label="Tabela de utilização única" tabIndex={0}>
          <table className="cx-matrix cg-entry"><caption className="sr-only">Valor utilizado, data inicial e prazo</caption><thead><tr><th scope="col">Utilização</th><th scope="col">Data inicial</th><th scope="col">{form.dateMode === 'duration' ? 'Prazo' : 'Quitação'}</th></tr></thead><tbody><tr>
            <td>{money('amount', 'Valor utilizado (R$)', 'Pode ser zero; não há valor presumido.')}</td>
            <td>{input('start', 'Data da utilização', 'Saldo inicial anterior a esta data: zero.', 'date')}</td>
            <td>{form.dateMode === 'duration' ? input('duration', 'Dias corridos de uso', 'Exemplo: 10 dias = data inicial + 10. A quitação ocorre antes da apuração do dia final.', 'text', `Quitação: ${dateLabel(params.end)}.`) : input('end', 'Data da quitação', 'O saldo é liquidado antes da apuração do dia.', 'date')}</td>
          </tr></tbody></table>
        </div>
        {errors.end && form.dateMode === 'duration' && <p className="cx-error cx-pad">{errors.end}</p>}
      </> : <>
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
      </>}
    </article>

    <article className="desk-panel cx-panel cg-narrow">
      <header className="cx-heading"><h3>2. Juros e convenções do contrato</h3><CalculatorHelp title="Juros e convenções do contrato"><p>Informe a taxa contratual em percentual ao mês. Para a apuração proporcional, os juros de cada dia correspondem ao saldo utilizado × taxa mensal ÷ 100 ÷ 30. O divisor 30 é fixo e não transforma o calendário real em meses de 30 dias. Juros não são capitalizados.</p></CalculatorHelp></header>
      <div className="cx-form">
        {input('rate', 'Taxa do contrato (% a.m.)', 'Taxa mensal em percentual, apurada proporcionalmente com base 30 e sem capitalização. Obrigatória. 0 significa sem juros; vazio não significa zero.')}
        {money('limit', 'Limite contratado (R$)', 'Opcional. Usado só para o CET: pela Resolução CMN 4.881/2020, art. 6º, o rotativo calcula o CET com prazo de 30 dias sobre o limite pactuado. Não muda o resultado do período.')}
        {select('dayCount', 'Dias que geram juros', [['calendar', 'Todos os dias corridos'], ['business', 'Dias úteis: segunda a sexta, menos feriados nacionais e extras']], 'Dias úteis descontam sábados, domingos e os feriados nacionais do calendário do painel (inclusive Carnaval, Sexta-feira Santa e Corpus Christi), além dos feriados extras que você informar. O IOF diário sempre considera dias corridos, inclusive fins de semana.')}
        {form.dayCount === 'business' && field('holidays', 'Feriados extras do contrato (AAAA-MM-DD)', <textarea {...control('holidays')} rows={3} value={form.holidays} onChange={e => set('holidays', e.target.value)} placeholder="2026-01-25, 2026-07-09" />, 'Opcional. Os feriados nacionais já são descontados pelo calendário do painel. Informe aqui só os feriados locais ou outros dias sem expediente previstos no contrato.')}
      </div>
    </article>

    <article className="desk-panel cx-panel cg-narrow">
      <header className="cx-heading"><h3>3. Referência de IOF</h3><CalculatorHelp title="Referência de IOF"><p>Juros e IOF são pagos à parte, sem capitalização ou financiamento no saldo utilizado. Operação rotativa por saldos diários: não se aplica um teto genérico de 365 dias. Os dois modos mantêm a mesma natureza rotativa, mesmo quando há apenas um saque.</p></CalculatorHelp></header>
      <div className="cx-form">
        {select('taxProfile', 'Enquadramento da operação', CG_TAX_PROFILES.map(p => [p.id, p.label]), 'Referências consultadas em 05/11/2026. Não há atualização automática nem tratamento de mudanças de alíquota dentro do período.')}
        <div className="cg-tax-reference"><span>IOF diário automático</span><b>{params.iofDaily == null ? '—' : `${String(params.iofDaily).replace('.', ',')}% ao dia`}</b><span>IOF adicional automático</span><b>{params.iofAdditional == null ? '—' : `${String(params.iofAdditional).replace('.', ',')}% sobre acréscimos diários`}</b></div>
        {form.taxProfile === 'simples' && <>
          {money('operationValue', 'Valor da operação confirmado no contrato', 'Redução até R$ 30 mil; acima, alíquota geral automática. Informe o valor total contratado, não o saldo momentâneo nem apenas um saque.')}
          <div className="cx-field"><div className="cx-field-label"><label className="cg-check" htmlFor="cg-eligible"><input {...control('eligible')} type="checkbox" checked={form.eligible} onChange={e => set('eligible', e.target.checked)} />Confirmo o enquadramento do Simples/MEI e a documentação com a instituição.</label><CalculatorHelp title="Confirmação do enquadramento"><p>Confirmo que o tomador é optante do Simples/MEI e que a operação e a documentação atendem ao art. 7º, VI, e ao art. 45, II, com a instituição financeira.</p><p>A seleção não comprova o enquadramento tributário.</p></CalculatorHelp></div><p id="cg-eligible-hint" className="sr-only">A seleção não comprova o enquadramento tributário.</p><p id="cg-eligible-error" className="cx-error" role={errors.eligible ? 'alert' : undefined}>{errors.eligible}</p></div>
        </>}
      </div>
      <p className="cx-hint cx-pad">Alíquotas consultadas em 05/11/2026; sem atualização automática.</p>
    </article>

    <div aria-live="polite" className="cg-result-status">
      {Object.keys(errors).length > 0 && <p className="cg-notice">Preencha ou corrija os campos sinalizados para calcular. Nenhum resultado anterior é mantido quando há erro.</p>}
      {calculation && !calculation.ok && <p role="alert" className="cg-notice">{calculation.error}</p>}
    </div>
    {warnings.map(warning => <p className="cg-notice" key={warning}>{warning}</p>)}
    {result && <>
      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>Resultado estimado do período</h3><CalculatorHelp title="Resultado estimado do período"><p>Custo total = juros + IOF diário + IOF adicional, todos pagos à parte. Não inclui a devolução do principal nem outras tarifas. Saldo devedor final é exclusivamente o valor utilizado ainda não amortizado. O pagamento dos custos não gera novas utilizações.</p></CalculatorHelp></header>
        <div className="cg-kpis">
          {[['Juros apurados', result.totals.interest], ['IOF diário', result.totals.dailyIof], ['IOF adicional', result.totals.additionalIof], ['Custo total', result.totals.cost], ['Saldo devedor final', result.balance], ['Total de utilizações', result.totals.draw]].map(([label, value]) => <div key={label}><span>{label}</span><b>{brl(value)}</b></div>)}
        </div>
        {cet?.ok ? <div className="cg-cet">
          <div className="cg-kpis">
            <div><span>CET (art. 6º · 30 dias sobre o limite)</span><b>{pct(cet.annual)} a.a.</b></div>
            <div><span>CET ao mês</span><b>{pct(cet.monthly)} a.m.</b></div>
            <div><span>Pagamento no {CG_CET_DAYS}º dia</span><b>{brl(cet.payment)}</b></div>
          </div>
          <div className="cx-heading cx-pad"><p className="cx-hint">Fluxo do CET: {brl(cet.net)} líquidos em {dateLabel(cet.start)}; {brl(cet.payment)} em {dateLabel(cet.end)}.</p><CalculatorHelp title="Como calculamos o CET"><p>Limite de {brl(cet.limit)} liberado em {dateLabel(cet.start)}, menos o IOF adicional ({brl(cet.additionalIof)}), cobrado na utilização: líquido de {brl(cet.net)}. Em {dateLabel(cet.end)}, devolução do limite + juros de {CG_CET_DAYS} dias ({brl(cet.interest)}) + IOF diário ({brl(cet.dailyIof)}), pela taxa, contagem de dias e IOF desta tela.</p><p>O CET é a taxa anual que iguala o valor liberado ao valor presente do pagamento, em dias corridos/365 (Resolução CMN 4.881/2020, arts. 4º e 6º). Ao mês: equivalente composta. Não há tarifas neste simulador.</p></CalculatorHelp></div>
          <p className="cg-notice">Regra do art. 6º da Resolução CMN 4.881/2020 (texto oficial conferido em 11/11/2026): prazo de 30 dias e limite pactuado. Obrigatória para pessoa física, ME e EPP (art. 1º); para as demais empresas, estimativa. Taxa e IOF do contrato prevalecem.</p>
        </div> : cet && !cet.ok ? <p className="cg-notice" role="alert">CET não calculado: {cet.error}</p>
          : <p className="cx-hint cx-pad">Sem CET: informe o limite contratado para ver o CET de 30 dias (art. 6º).</p>}
        <p className="cx-hint cx-pad">{dateLabel(params.start)} a {dateLabel(params.end)} · {result.rows.length} fechamentos apurados · {result.totals.interestDays} dias com saldo e contagem de juros · taxa do contrato: {form.rate}% a.m.</p>
      </article>
      <article className="desk-panel cx-panel">
        <header className="cx-heading"><h3>Apuração mensal dentro do período</h3><CalculatorHelp title="Apuração mensal dentro do período"><p>Meses inicial e final podem estar incompletos. A tabela apura custo, não simula o calendário de recolhimento do banco. Soma dos saldos é uma base acumulada de reais × dias, não o saldo da conta.</p></CalculatorHelp></header>
        <div className="cx-wrap" role="region" aria-label="Tabela mensal de juros e IOF" tabIndex={0}><table className="cx-matrix cg-results"><caption className="sr-only">Somatórios do período selecionado por mês; não são datas de pagamento</caption><thead><tr><th scope="col">Mês</th><th scope="col">Soma dos saldos</th><th scope="col">Soma dos acréscimos</th><th scope="col">Juros</th><th scope="col">IOF diário</th><th scope="col">IOF adicional</th><th scope="col">IOF total</th></tr></thead><tbody>{result.months.map(month => <tr key={month.month}><th scope="row">{month.month.split('-').reverse().join('/')}</th><td>{brl(month.dailyBase)}</td><td>{brl(month.additionalBase)}</td><td>{brl(month.interest)}</td><td>{brl(month.dailyIof)}</td><td>{brl(month.additionalIof)}</td><td>{brl(month.dailyIof + month.additionalIof)}</td></tr>)}</tbody></table></div>
      </article>
      <article className="desk-panel cx-panel">
        <header><h3>Memória de cálculo diária</h3></header>
        <div className="cx-wrap" role="region" aria-label="Tabela diária, role horizontalmente para ver todas as colunas" tabIndex={0}><table className="cx-matrix cg-results"><caption className="sr-only">Saldo utilizado no fechamento, juros pagos à parte e bases do IOF</caption><thead><tr><th scope="col">Data</th><th scope="col">Utilização</th><th scope="col">Amortização</th><th scope="col">Juros do dia</th><th scope="col">Saldo final / base IOF</th><th scope="col">Acréscimo / base adicional</th><th scope="col">IOF diário</th><th scope="col">IOF adicional</th></tr></thead><tbody>{result.rows.slice(safePage * 31, safePage * 31 + 31).map(row => <tr key={row.date}><th scope="row">{dateLabel(row.date)}{!row.countsInterest && <small>Sem juros neste dia</small>}</th>{['draw', 'payment', 'interest', 'balance', 'additionalBase', 'dailyIof', 'additionalIof'].map(key => <td key={key}>{brl(row[key])}</td>)}</tr>)}</tbody></table></div>
        <div className="cg-pagination"><button type="button" className="cg-button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button><span>Página {safePage + 1} de {pages} · até 31 dias por página</span><button type="button" className="cg-button" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Próxima</button></div>
      </article>
    </>}
    <div className="cg-method cx-heading"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Como calculamos e onde a simulação não se aplica"><ul>
      <li>Saldo anterior ao primeiro dia é zero. Agrupamos utilizações e amortizações da mesma data. Saldo utilizado = saldo anterior + utilizações − amortizações. Juros e IOF são pagos pelo cliente à parte: nunca viram principal, nunca geram juros sobre juros e nunca aumentam a base do IOF nesta simulação.</li>
      <li>Em utilização única, a data inicial conta e a data de quitação não gera juros nem IOF diário se o saldo ficar zerado. Utilização e quitação na mesma data ficam líquidas em zero nesta convenção, sem modelar crédito intradia. Confirme datas-valor e horários do banco.</li>
      <li>A taxa do contrato é sempre mensal e percentual. Juros do dia = saldo utilizado × taxa mensal ÷ 100 ÷ 30, apenas nos dias escolhidos, sem capitalização. A base 30 é fixa; o calendário da utilização continua real.</li>
      <li>IOF diário = saldo de fechamento × alíquota diária. IOF adicional = máximo entre zero e a diferença entre saldo final e saldo final anterior × alíquota adicional. Como os encargos são pagos à parte neste simulador, as bases incluem apenas o principal utilizado. Amortizações não devolvem IOF já apurado; nova elevação do saldo gera novo adicional.</li>
      <li>A premissa de encargos pagos à parte foi adotada para este simulador; não é uma regra universal de todos os contratos. O art. 7º, § 12, prevê encargos na base quando integrarem saldos devedores. Operações com encargos debitados na conta exigem outro tratamento e não são simuladas aqui.</li>
      <li>Sem arredondamento intermediário; a exibição é arredondada para centavos. A soma dos centavos exibidos pode diferir do total calculado com precisão completa.</li>
      <li>CET (Resolução CMN 4.881/2020, arts. 4º e 6º, texto oficial): o limite contratado é liberado na data inicial e devolvido em 30 dias corridos, com juros de 30 dias pela taxa e contagem de dias desta tela e o IOF diário e adicional desse período. O IOF adicional é cobrado na utilização e sai do valor líquido; juros e IOF diário, apurados dia a dia, entram no pagamento do 30º dia. Não há tarifas neste simulador. O CET é a taxa anual que iguala o líquido ao valor presente do pagamento, em dias corridos/365; ao mês, a equivalente composta. Confira a regra no texto da norma.</li>
      <li>Não inclui indexadores variáveis como CDI, spread variável, mora, multa, excesso de limite, renegociação, isenções não confirmadas nem taxas que mudam no período. As regras de inadimplência dos §§ 18–19 não são simuladas. Contratos com principal definido têm base de IOF diferente.</li>
      <li>Os dados ficam somente nesta tela. Sair da calculadora ou recarregar apaga o rascunho. Nenhum valor informado é enviado a serviços ou incluído na busca.</li>
    </ul><p>Fontes consultadas em 05/11/2026: {CG_SOURCES.map((source, index) => <span key={source.url}>{index > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a></span>)}.</p></CalculatorHelp></div>
    </>}
  </section>
}
