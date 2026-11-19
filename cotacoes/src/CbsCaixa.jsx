import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import Help from './CalculatorHelp.jsx'
import CbsAnnualScenario from './CbsAnnualScenario.jsx'
import { operatingWorkingCapital } from './cbsAnnual.js'
import CbsOverview from './CbsOverview.jsx'
import IbgeActivitySearch from './IbgeActivitySearch.jsx'
import snapshot from './ibgeCbsSnapshot.json'
import oficial from './rtcOficial.json'
import { simulateCbsCash } from './cbsCash.js'
import { ANOS_REFORMA, aliquotasDoAno } from './rtcAnos.js'
import { TIPOS_RECEITA_SIMPLES } from './rtcCalc.js'
import { CBS_SOURCES } from './baseDados.js'
import './CbsCaixa.css'
import './CalcPattern-cbs.css'

const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const numeric = text => String(text).trim() === '' ? NaN : Number(String(text).replace(',', '.'))
const pctText = n => String(n).replace('.', ',')
const isoDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
// Tratamentos com redução de alíquota (CST 200 e 011) da tabela oficial; CST 515 (diferimento) fica de fora.
const REDUCOES = oficial.reducoes.filter(r => r.cst === '200' || r.cst === '011')
const ratesFor = year => { const a = aliquotasDoAno(year, oficial); return { cbsRate: pctText(a.cbs), ibsUfRate: pctText(a.ibsUf), ibsMunRate: pctText(a.ibsMun) } }
const initialYear = 2027
const initial = { kind: 'comercio', group: 'comercio-83319', regime: 'real', revenue: '3.000.000,00', year: String(initialYear),
  receiveDays: '90', payDays: '30', stockDays: '120', monthlyCmv: '', monthlyPurchases: '', spendingPct: '', eligibleShare: '70',
  ...ratesFor(initialYear), reduction: '', isRate: '0', simplesCbs: '', simplesIbs: '', simplesTipo: '1',
  currentNetRate: '', splitShare: '50', currentDueDays: '40', futureDueDays: '40', creditDelayDays: '30' }
export function CbsIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 5h18v14H3zM3 10h18M8 5v14M13 14h5M16 12l2 2-2 2" /></svg>
}

export default function CbsCaixa({ onBack }) {
  const [form, setForm] = useState(initial)
  const [searchReset, setSearchReset] = useState(0)
  const [monthlyOverrides, setMonthlyOverrides] = useState({})
  const [activityConfirmed, setActivityConfirmed] = useState(false)
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const dataset = snapshot.datasets.find(d => d.kind === form.kind)
  const group = dataset.groups.find(g => g.id === form.group)
  const ratio = form.spendingPct.trim() === '' ? group?.spendingRatio : numeric(form.spendingPct) / 100
  const parsedMoney = parseMoneyInput(form.revenue)
  const cmv = parseMoneyInput(form.monthlyCmv)
  const purchases = parseMoneyInput(form.monthlyPurchases)
  const year = Number(form.year)
  const yearRates = aliquotasDoAno(year, oficial)
  const simples = form.regime === 'simples'
  const treatment = REDUCOES.find(r => r.cClassTrib === form.reduction)
  const taxes = simples
    ? { regime: 'simples', pCbs: numeric(form.simplesCbs), pIbs: numeric(form.simplesIbs), tipoReceita: Number(form.simplesTipo) }
    : { regime: 'regular', aliquotas: yearRates.oficial ? { cbs: yearRates.cbs, ibsUf: yearRates.ibsUf, ibsMun: yearRates.ibsMun }
      : { cbs: numeric(form.cbsRate), ibsUf: numeric(form.ibsUfRate), ibsMun: numeric(form.ibsMunRate) },
    reducao: treatment?.reducao ?? {}, isRate: year >= 2027 ? numeric(form.isRate) : 0 }
  const simplesBlocked = simples && year < 2027
  const inputs = { ...Object.fromEntries(['receiveDays', 'payDays', 'stockDays', 'eligibleShare',
    'currentNetRate', 'splitShare', 'currentDueDays', 'futureDueDays', 'creditDelayDays'].map(k => [k, numeric(form[k])])), taxes,
    ...(simples ? { eligibleShare: 0 } : {}) }
  const result = simplesBlocked || !group || !activityConfirmed ? null : simulateCbsCash({ ...inputs,
    revenue: parsedMoney.ok ? parsedMoney.value : NaN, spendingRatio: ratio })
  const rateLabel = simples ? `CBS no DAS ${form.simplesCbs || '—'}% · IBS no DAS ${form.simplesIbs || '—'}%`
    : `CBS ${pctText(taxes.aliquotas.cbs)}% · IBS estadual ${pctText(taxes.aliquotas.ibsUf)}% · IBS municipal ${pctText(taxes.aliquotas.ibsMun)}%${treatment ? ` · redução ${pctText(treatment.reducao.cbs)}%` : ''}`
  const simplesMissing = simples && (!Number.isFinite(taxes.pCbs) || !Number.isFinite(taxes.pIbs))
  const statusTag = simples ? 'informado' : yearRates.oficial ? 'oficial' : 'hipótese'
  const ncg = operatingWorkingCapital({ revenue: parsedMoney.ok ? parsedMoney.value : NaN,
    receiveDays: inputs.receiveDays, payDays: inputs.payDays, stockDays: inputs.stockDays,
    monthlyCmv: cmv.ok ? cmv.value : NaN, monthlyPurchases: purchases.ok ? purchases.value : NaN })
  const currentRateMissing = form.currentNetRate.trim() === ''
  const field = (key, label, hint, suffix = 'dias') => {
    const val = key === 'spendingPct' && form[key] === '' ? decimal((group?.spendingRatio ?? 0) * 100) : form[key]
    const number = numeric(val)
    const invalid = !Number.isFinite(number) || number < 0 || number > (suffix === '%' ? (key === 'spendingPct' ? 500 : 100) : 365) || (suffix === 'dias' && !Number.isInteger(number))
    return <div className="cx-field" key={key}>
      <div className="cx-field-label"><label htmlFor={`cbs-${key}`}>{label} ({suffix})</label><Help title={label}><p>{hint}</p></Help></div>
      <input id={`cbs-${key}`} inputMode={suffix === '%' ? 'decimal' : 'numeric'} value={val}
        aria-invalid={invalid} aria-describedby={invalid ? `cbs-${key}-error` : undefined}
        onFocus={e => e.target.select()} onChange={e => set(key, e.target.value)} />
      {invalid && <p id={`cbs-${key}-error`} className="cx-error">Informe {suffix === 'dias' ? 'dias inteiros de 0 a 365' : `um percentual de 0 a ${key === 'spendingPct' ? 500 : 100}`}.</p>}
    </div>
  }
  return <section className="cx cbs bw calc-standard calc-workspace" aria-labelledby="cbs-title">
    <div className="cx-toolbar"><button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <button type="button" className="cx-action" onClick={() => { setForm(initial); setMonthlyOverrides({}); setActivityConfirmed(false); setSearchReset(value => value + 1) }}>Restaurar exemplo</button></div>
    <div className="bw-heading calc-workspace-heading"><h2 id="cbs-title" className="cx-title"><strong aria-hidden="true">{'PME'}</strong><span>Reforma tributária · impacto no caixa</span></h2></div>
    <div className="cx-field-label cbs-intro"><span>O que esta simulação faz</span><Help title="O que esta simulação faz"><p>Simule a CBS (federal, substitui PIS/Cofins), o IBS (estadual e municipal, substitui ICMS e ISS) e o Imposto Seletivo, com as regras da calculadora oficial da Receita, e veja o efeito no caixa.</p></Help></div>
    <p className="cbs-assumptions">Simulação educativa · regras da calculadora oficial da Receita · valores sem tributos, imposto calculado “por fora” · sem apuração fiscal.</p>
    <div className="cbs-workspace">
      <article className="desk-panel cx-panel">
        <header><h3>Dados da empresa</h3><p>Informe valores médios. Os prazos são em dias.</p></header>
        {/* Avisos de dados faltando ou de regime: faixa no topo do quadro. */}
        {(!activityConfirmed || simplesBlocked || (result && !result.ok)) && <div className="cbs-alerts">
          {!activityConfirmed && <p className="cbs-alert" role="status">Setor exibido é apenas exemplo. Selecione a atividade para calcular o impacto tributário.</p>}
          {simplesBlocked && <div className="cbs-message cbs-alert" role="status">Em 2026 o Simples não recolhe CBS e IBS no DAS. A regra oficial do Simples começa em 2027. Escolha 2027 ou um ano depois.</div>}
          {result && !result.ok && <p className="cx-error cbs-alert" role="alert">{simplesMissing ? 'Informe a parte de CBS e a parte de IBS da alíquota do DAS.' : currentRateMissing ? 'Informe os tributos atuais para comparar.' : result.error}</p>}
        </div>}
        <div className="cx-form cbs-essential">
          <IbgeActivitySearch key={searchReset} datasets={snapshot.datasets} selected={{ ...group, kind: form.kind }} onSelect={option => { setActivityConfirmed(true); setForm(f => ({ ...f, kind: option.kind, group: option.id, spendingPct: '' })) }} />
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-year">Ano da simulação</label><Help title="Ano da simulação"><p>2026 é o ano de teste, com as alíquotas oficiais do banco da Receita (CBS 0,9% e IBS 0,1%). Nesse ano, quem cumpre as obrigações em regra não recolhe esses valores.</p><p>De 2027 em diante a Receita ainda não publicou alíquotas. A tela traz um valor inicial marcado como hipótese, que você pode trocar. Ao mudar o ano, as alíquotas voltam ao valor inicial daquele ano.</p></Help></div>
            <select id="cbs-year" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value, ...ratesFor(Number(e.target.value)) }))}>{ANOS_REFORMA.map(y => <option key={y} value={y}>{y}{y === 2026 ? ' · alíquotas oficiais' : ' · alíquotas em hipótese'}</option>)}</select></div>
          <div className="cx-field"><label htmlFor="cbs-regime">Regime atual</label><select id="cbs-regime" value={form.regime} onChange={e => set('regime', e.target.value)}><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option><option value="simples">Simples Nacional (DAS)</option></select></div>
          {simples ? <>
            {field('simplesCbs', 'Parte do DAS que é CBS', 'Alíquota efetiva de CBS dentro do DAS, calculada pelo PGDAS-D. A calculadora oficial também não calcula esse número: ela recebe pronto e só reparte.', '%')}
            {field('simplesIbs', 'Parte do DAS que é IBS', 'Alíquota efetiva de IBS dentro do DAS, calculada pelo PGDAS-D. Some estadual e municipal.', '%')}
            <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-simples-tipo">Tipo de venda</label><Help title="Tipo de venda no Simples"><p>Regra oficial do Simples: venda no mercado interno conta inteira; venda mista conta pela metade; exportação direta não paga; exportação indireta fica suspensa (não entra no imposto a pagar).</p><p>Créditos nas compras não entram: no Simples, CBS e IBS ficam dentro do DAS.</p></Help></div>
              <select id="cbs-simples-tipo" value={form.simplesTipo} onChange={e => set('simplesTipo', e.target.value)}>{Object.entries(TIPOS_RECEITA_SIMPLES).map(([k, t]) => <option key={k} value={k}>{t.rotulo}</option>)}</select></div>
          </> : <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-reduction">Tratamento da venda</label><Help title="Reduções da tabela oficial"><p>Reduções de 30% a 100% copiadas da tabela oficial de classificação da Receita (cClassTrib). A conta é a mesma da oficial: alíquota × (1 − redução).</p><p>Escolha só se toda a venda tiver essa redução. Diferimento, crédito presumido e regimes específicos não entram.</p></Help></div>
            <select id="cbs-reduction" value={form.reduction} onChange={e => set('reduction', e.target.value)}><option value="">Tributação integral (sem redução)</option>{REDUCOES.map(r => <option key={r.cClassTrib} value={r.cClassTrib}>{`${pctText(r.reducao.cbs)}%${r.reducao.ibsUf !== r.reducao.cbs ? ` (IBS ${pctText(r.reducao.ibsUf)}%)` : ''} · ${r.cClassTrib} · ${r.descricao}`}</option>)}</select></div>}
          <div className="cbs-rates" aria-labelledby="cbs-rates-title">
            <p id="cbs-rates-title" className="cbs-rates-title">{simples ? `Simples em ${year}` : `Alíquotas de ${year}`} <span className={`cbs-tag${yearRates.oficial && !simples ? ' is-official' : ''}`}>{statusTag}</span></p>
            {simples ? <p>CBS e IBS vêm da alíquota do DAS que você informou.</p> : yearRates.oficial ? <p>CBS {pctText(yearRates.cbs)}% · IBS estadual {pctText(yearRates.ibsUf)}% · IBS municipal {pctText(yearRates.ibsMun)}%</p> : <div className="cbs-rate-grid">
              {field('cbsRate', 'CBS', 'Hipótese editável. A Receita não publicou a alíquota deste ano.', '%')}
              {field('ibsUfRate', 'IBS estadual', 'Hipótese editável. A Receita não publicou a alíquota deste ano.', '%')}
              {field('ibsMunRate', 'IBS municipal', 'Hipótese editável. A Receita não publicou a alíquota deste ano.', '%')}
            </div>}
            {!simples && yearRates.origem.map(o => <p key={o} className="cbs-rate-origin">{o}</p>)}
            <p className="cbs-rate-origin">Regras e reduções: calculadora oficial da Receita, versão {oficial.fonte.versaoCalculadora}, tabela {oficial.fonte.versaoBaseDados} de {isoDate(oficial.fonte.dataBaseDados)}.</p>
          </div>
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-revenue">Vendas mensais sem tributos</label><Help title="Vendas sem tributos"><p>Valor médio das vendas sem ICMS, ISS, PIS, Cofins e IPI. É a base de cálculo da calculadora oficial: CBS e IBS são somados por fora, sobre esse valor.</p><p>O cliente paga as vendas mais CBS, IBS e Imposto Seletivo. Frete e outras cobranças entram na base; descontos incondicionais saem.</p></Help></div><MoneyInput id="cbs-revenue" value={form.revenue} onChange={value => set('revenue', value)} aria-invalid={!parsedMoney.ok || parsedMoney.value <= 0} /></div>
          {field('receiveDays', 'Recebimento médio', 'Dias entre a venda e o recebimento. Use a média ponderada dos valores, incluindo vendas à vista.')}
          {field('payDays', 'Pagamento das compras a prazo', 'Prazo médio ponderado apenas das compras a prazo informadas. Não inclua compras à vista nesta média. Ajuda a situar o crédito, cuja liberação é uma hipótese separada.')}
          {field('stockDays', 'Estoque médio', 'Dias entre a compra e a venda. Serviços sem estoque podem informar zero. Matérias-primas e produtos em elaboração exigem aproximação do ciclo completo.')}
          <div className="cx-field"><label htmlFor="cbs-cmv">Custo mensal das mercadorias vendidas (CMV)</label><MoneyInput id="cbs-cmv" value={form.monthlyCmv} onChange={v => set('monthlyCmv', v)} /><p>Necessário para estimar o estoque ao custo.</p></div>
          <div className="cx-field"><label htmlFor="cbs-purchases">Compras mensais a prazo</label><MoneyInput id="cbs-purchases" value={form.monthlyPurchases} onChange={v => set('monthlyPurchases', v)} /><p>Necessário para estimar fornecedores; não inclui compras à vista.</p></div>
          {field('currentNetRate', 'Tributos atuais substituídos, após créditos', 'Percentual efetivamente pago hoje, sobre as vendas sem tributos, dos tributos que a CBS e o IBS substituem no ano escolhido. Em 2027 e 2028: PIS/Cofins. De 2029 a 2032 o ICMS e o ISS saem aos poucos: some a parte que deixa de existir. Em 2033: PIS/Cofins, ICMS e ISS. No Simples, use a parte do DAS que corresponde a esses tributos.', '%')}
        </div>
      </article>
      <div className="cbs-right">
        <details className="desk-panel cx-panel cbs-details cbs-settings"><summary>Ajustar hipóteses de impostos e prazos</summary>
          <header><h3>Hipóteses do cenário</h3><Help title="Hipóteses, não enquadramento fiscal"><p>O setor estima gastos. Não define sozinho a alíquota, elegibilidade fiscal, regularidade do fornecedor ou adoção do split payment. Esses percentuais e prazos são hipóteses editáveis, não estatísticas do IBGE.</p><p>As alíquotas de {year} estão no quadro “Alíquotas de {year}”, com a origem de cada número. Só 2026 tem alíquota oficial no banco da Receita.</p></Help></header>
          <div className="cbs-premise-summary">{statusTag === 'hipótese' ? 'Hipóteses editáveis' : 'Valores usados'} — {rateLabel}{simples ? '' : ` · gastos que podem gerar crédito: ${form.eligibleShare}%`} · vendas com split: {form.splitShare}%<br />Tributos atuais substituídos: {form.currentNetRate.trim() ? `${form.currentNetRate}% das vendas sem tributos` : 'não informado'}.</div>
          <div className="cx-form">
            {field('spendingPct', 'Gastos sobre o faturamento', 'Referência econômica do IBGE. Comércio usa compras para revenda; indústria e serviços combinam itens identificados de compras/consumo. São bases diferentes e aproximadas. Ajustar substitui apenas a hipótese desta simulação.', '%')}
            {!simples && field('eligibleShare', 'Parcela dos gastos que gera crédito', 'Hipótese inicial de 70%, não estimativa do IBGE. Mercadorias, materiais, energia, fretes e serviços podem gerar crédito conforme operação e fornecedor. Salários não geram CBS nem IBS. Isenções, alíquota zero, Simples e regimes especiais alteram o crédito. O modelo usa nas compras a mesma alíquota efetiva das vendas; ajuste esta parcela para representar um aproveitamento diferente.', '%')}
            {!simples && year >= 2027 && field('isRate', 'Imposto Seletivo', 'Só para produtos previstos em lei, como cigarro, bebida alcoólica, bebida açucarada e veículo. Começa em 2027. Informe a alíquota ad valorem (sobre o valor). Ele entra na base da CBS e do IBS, como na oficial, e não gera crédito. Valor por unidade (ad rem) não entra nesta tela.', '%')}
            {field('splitShare', 'Vendas com separação no pagamento', 'Percentual hipotético das vendas sujeito ao split payment, que separa CBS e IBS no pagamento. A implantação é gradual; 50% é somente um cenário de adoção parcial. Não se presume início geral em janeiro de 2027. Imposto já quitado no vencimento não é cobrado novamente no recebimento.', '%')}
            {field('currentDueDays', 'Recolhimento atual após a venda', 'Prazo médio entre venda e recolhimento atual. O padrão de 40 dias é hipótese ilustrativa, não vencimento legal fixo. A data efetiva depende da apuração e do calendário.')}
            {field('futureDueDays', 'Recolhimento futuro após a venda', 'Prazo médio hipotético até o vencimento da CBS e do IBS. O split antecipa o recolhimento quando o recebimento acontece antes; não posterga o vencimento se o cliente paga depois. Não é prazo legal fixo.')}
            {field('creditDelayDays', 'Liberação do crédito após pagar fornecedor', 'Hipótese de tempo até o crédito ficar disponível, não prazo legal de ressarcimento nem inadimplência medida. O modelo situa a compra antes da venda pelos dias de estoque e adiciona o prazo de pagamento e esta espera. Crédito fiscal não é dinheiro depositado automaticamente.')}
          </div>
                {group && <div className="cbs-source"><b>Gastos sugeridos: {decimal(ratio * 100)}% do faturamento</b><p>{form.spendingPct ? 'Percentual ajustado pelo usuário.' : `${dataset.population} · IBGE ${dataset.year}.`}</p><p>É referência econômica de gastos, não percentual de crédito tributário.</p><a href={dataset.source} target="_blank" rel="noreferrer">Consultar tabela {dataset.table} no IBGE ↗</a></div>}
      </details>
        {result?.ok && <article className="desk-panel cx-panel cbs-result calc-result-shell" aria-labelledby="cbs-result-title">
          <span className="sr-only" id="cbs-result-title">Reserva adicional para cobrir os prazos</span><ExpandablePanel title="Reserva adicional para cobrir os prazos"><div className="calc-panel-context"><Help title="Como a reserva é estimada"><p>Fluxo mensal uniforme, divisor 30 e prazos médios constantes. A reserva compara a disponibilidade temporária do imposto atual com a da CBS e do IBS líquidos futuros, ponderando a parcela de split e o vencimento. Não é o imposto mensal multiplicado pelo ano.</p><p>Primeiro cenário: créditos utilizáveis já disponíveis. Segundo: indisponibilidade temporária desses créditos conforme compra, estoque, pagamento e prazo adicional informado. A espera positiva é calculada separadamente na parcela com split e na parcela recolhida no vencimento, antes de ponderar os resultados; um recolhimento posterior não anula a espera da parcela antecipada. São cenários de sensibilidade, não intervalo estatístico nem déficit máximo comprovado. Não somar novamente esses valores à retenção bruta ou à NCG integral.</p><p>O ciclo financeiro é apresentado em dias; não calculamos a NCG total da empresa, saldo de caixa, sazonalidade, margem, renegociação de preços, CAPEX, ressarcimento ou capacidade de pagamento. O resultado não é limite de crédito nem recomendação de contratação.</p></Help></div>
          {/* Ordem do resultado: resposta principal; equivalências em dias; valores em reais agrupados; notas; detalhes recolhidos. Só apresentação: nenhuma conta nova. */}
          <div className="cbs-reserve">
            <p className="cbs-answer-label">Necessidade adicional de capital de giro</p>
            <p className="cbs-eyebrow">Considerando a espera para usar os créditos</p>
            <strong className="cbs-primary-value">{money(result.reserveDelayed)}</strong>
            <p className="cbs-primary-reading">{result.reserveDelayed === 0 ? 'Neste cenário, não apareceu necessidade adicional por mudança de prazos.' : 'Reserva estimada para cobrir a mudança de datas entre receber, pagar o imposto e usar os créditos.'}</p>
            <p>Isso não mede o giro total da empresa. Não é uma nova despesa mensal.</p>
          </div>
          <p className="cbs-equiv">Ciclo financeiro: <b>{result.cycleDays} dias</b> · Espera para usar os créditos: <b>{decimal(result.creditGapDays)} dias</b> no modelo</p>
          <div className="cbs-values">
            <h4 className="cbs-values-grp">Reserva de prazo · duas hipóteses</h4>
            <dl className="cbs-breakdown cbs-scenarios">
              <div><dt>Créditos já disponíveis</dt><dd><strong>{money(result.reserveImmediate)}</strong></dd></div>
              <div><dt>Créditos disponíveis após a espera</dt><dd><strong>{money(result.reserveDelayed)}</strong></dd></div>
            </dl>
            <p className="cbs-detail-intro">Duas hipóteses de reserva para cobrir prazos. Não some os valores e não multiplique por 12. Zero não significa caixa suficiente.</p>
            <h4 className="cbs-values-grp">Imposto por mês · outra informação</h4>
            <dl className="cbs-breakdown cbs-monthly-tax">
              <div><dt>CBS nas vendas</dt><dd>{money(result.cbs)}</dd></div>
              <div><dt>IBS nas vendas{simples ? '' : ` (estadual ${money(result.ibsUf)} + municipal ${money(result.ibsMun)})`}</dt><dd>{money(result.ibs)}</dd></div>
              {result.isTax > 0 && <div><dt>Imposto Seletivo</dt><dd>{money(result.isTax)}</dd></div>}
              {!simples && <div><dt>Menos créditos usados para abater</dt><dd>− {money(result.creditsUsable)}</dd></div>}
              <div className="cbs-total"><dt>Tributos novos a pagar</dt><dd>{money(result.netTax + result.isTax)}/mês</dd></div>
              <div><dt>Tributos atuais substituídos, pela hipótese informada</dt><dd>{money(result.currentTax)}/mês</dd></div>
              <div className="cbs-delta"><dt>{result.monthlyTaxDelta > 0 ? 'Aumento' : result.monthlyTaxDelta < 0 ? 'Redução' : 'Sem mudança'} nesta hipótese</dt><dd><span aria-hidden="true">{result.monthlyTaxDelta > 0 ? '▲ ' : result.monthlyTaxDelta < 0 ? '▼ ' : ''}</span>{money(Math.abs(result.monthlyTaxDelta))}/mês</dd></div>
            </dl>
          </div>
          <div className="cbs-notes">
            <p className="cbs-monthly-change"><b>{result.monthlyTaxDelta > 0 ? 'Aumento' : result.monthlyTaxDelta < 0 ? 'Redução' : 'Sem mudança'} de imposto: {money(Math.abs(result.monthlyTaxDelta))}/mês.</b> Com o mesmo total vendido, essa diferença muda o dinheiro que sobra após pagar o tributo. Avalie preço e margem separadamente da reserva de prazo acima.</p>
            {result.excessCredits > 0 && <p>Há ainda {money(result.excessCredits)} de créditos acima da CBS das vendas. Esse saldo não virou dinheiro nesta conta. A espera para aproveitá-lo pode exigir mais giro do que o estimado.</p>}
            {result.pendingTax > 0 && <p>Exportação indireta: {money(result.pendingTax)} de CBS e IBS ficam suspensos e não entram no imposto a pagar.</p>}
            {year === 2026 && <p className="cbs-critical">2026 é ano de teste: quem cumpre as obrigações em regra não recolhe CBS e IBS. Os valores mostram o cálculo com as alíquotas oficiais.</p>}
            {form.regime === 'real' && <p className="cbs-critical">Lucro Real: confira se a carga atual informada já desconta os créditos. O resultado não comprova economia.</p>}
            <p className="cbs-used-assumptions">{statusTag === 'hipótese' ? 'Hipóteses' : 'Valores usados'}: {rateLabel}{simples ? '' : ` · gastos elegíveis a crédito ${form.eligibleShare}%`} · vendas com split {form.splitShare}%.</p>
          </div>
          <details className="cbs-details cbs-annual-details"><summary>Reserva mês a mês · janeiro a dezembro</summary>
            <CbsAnnualScenario key={searchReset} revenue={form.revenue} inputs={{ ...inputs, spendingRatio: ratio }} overrides={monthlyOverrides} onOverridesChange={setMonthlyOverrides} />
          </details>
          <details className="cbs-details cbs-calculation"><summary>Entender o cálculo e os dois cenários</summary>
          <details className="cbs-details cbs-cash-details"><summary>Como isso aparece no recebimento e nos prazos?</summary>
            <div className="cbs-explanation">
              <h4>Do total vendido ao dinheiro recebido</h4>
              <p>Quando as vendas deste mês forem recebidas, o modelo considera:</p>
              <dl className="cbs-breakdown">
                <div><dt>Vendas sem tributos</dt><dd>{money(parsedMoney.value)}</dd></div>
                <div><dt>Mais CBS, IBS e Imposto Seletivo cobrados do cliente</dt><dd>+ {money(result.grossReceipts - parsedMoney.value)}</dd></div>
                <div><dt>Menos CBS e IBS separados no recebimento</dt><dd>− {money(result.splitNet)}</dd></div>
                <div className="cbs-total"><dt>Entrada após essa separação</dt><dd>{money(result.receiptsAfterNetSplit)}</dd></div>
              </dl>
              <p>Esse valor ainda precisa pagar fornecedores, folha, outros tributos e despesas. Não é lucro nem saldo livre em conta.</p>
              <p>{inputs.receiveDays > inputs.futureDueDays ? 'O recebimento acontece depois do vencimento: CBS e IBS já foram pagos antes e não são descontados novamente.' : 'CBS e IBS são separados na parcela das vendas indicada no cenário, considerando os créditos já disponíveis. A parte restante do imposto segue o vencimento informado.'}</p>
              <p>Antes dos créditos e do ajuste de imposto já pago, CBS e IBS das vendas com split seriam {money(result.splitGross)}. Não some esse valor à reserva.</p>
              <h4>Por que os prazos mudam a reserva?</h4>
              <div className="cbs-result-note">
                <p>{result.timingDelta < 0 ? 'Com os créditos disponíveis, a mudança de prazos libera temporariamente ' + money(-result.timingDelta) + ' no modelo. Isso não comprova sobra de caixa.' : 'Com os créditos disponíveis, a mudança de prazos exige ' + money(result.timingDelta) + ' a mais de reserva no modelo.'}</p>
                <p>A espera para usar os créditos representa {money(result.creditExposure)} de necessidade temporária ({decimal(result.creditGapDays)} dias no modelo, ponderados entre as vendas com e sem split). A calculadora combina esse efeito com o anterior para chegar ao segundo cenário; não some novamente.</p>
                <p>Ciclo financeiro: {inputs.receiveDays} dias para receber + {inputs.stockDays} dias em estoque − {inputs.payDays} dias para pagar = <b>{result.cycleDays} dias</b>. {result.cycleDays > 0 ? 'Em média, a empresa paga a compra antes de receber a venda.' : result.cycleDays < 0 ? 'Em média, a empresa recebe a venda antes de pagar a compra.' : 'Em média, pagamento da compra e recebimento da venda coincidem.'} Isso mostra o intervalo em dias, não a necessidade total de giro em reais.</p>
              </div>
              <h4>Exemplo simples para conferir o entendimento</h4>
              <p>Imagine R$ 100 de imposto por mês, com vendas e recolhimentos distribuídos uniformemente. Se o pagamento passar a acontecer 10 dias antes, a reserva de prazo será aproximadamente R$ 100 ÷ 30 × 10 = R$ 33,33. O imposto mensal continua sendo R$ 100; a reserva cobre a mudança de data. Exemplo hipotético, isolado dos valores acima.</p>
              <details className="cbs-check"><summary>Uma reserva de prazo significa pagar esse valor a mais todo mês?</summary><p>Não. Ela cobre um intervalo entre saídas e entradas. A diferença mensal do imposto é outra informação e aparece no bloco “Imposto por mês”.</p></details>
            </div>
          </details>
          </details>
        </ExpandablePanel></article>}
        <article className="desk-panel cx-panel cbs-giro" aria-labelledby="cbs-giro-title"><h3 id="cbs-giro-title">Faturamento e necessidade de giro</h3>
          {!ncg && <p className="cbs-alert" role="status">NCG não calculada: confira faturamento e prazos válidos e informe CMV e compras mensais a prazo. Campos vazios não são zero.</p>}
          <p>Dados médios editáveis. O exemplo inicial usa R$ 3 milhões por mês, Lucro Real e prazos de 90, 30 e 120 dias.</p>
          {parsedMoney.ok && parsedMoney.value > 0 && parsedMoney.value <= 1e13 && Number.isInteger(inputs.receiveDays) && inputs.receiveDays >= 0 && inputs.receiveDays <= 365 && <p>Valores a receber estimados: <b>{money(parsedMoney.value * inputs.receiveDays / 30)}</b> (vendas uniformes).</p>}
          {[inputs.receiveDays, inputs.payDays, inputs.stockDays].every(v => Number.isInteger(v) && v >= 0 && v <= 365) && <p>Ciclo financeiro: <b>{inputs.receiveDays + inputs.stockDays - inputs.payDays} dias</b>.</p>}
          {ncg && <p>NCG operacional simplificada: <b>{money(ncg.total)}</b> = recebíveis {money(ncg.receivables)} + estoques {money(ncg.inventory)} − fornecedores {money(ncg.suppliers)}.</p>}
          <p>Estimativa média, sem outras contas operacionais. Use valores na mesma base, descontando tributos recuperáveis quando aplicável. Não representa projeção de caixa. No cálculo de prazo tributário, o prazo das compras a prazo é uma aproximação para todas as compras, inclusive à vista.</p>
        </article>
        <CbsOverview revenue={form.revenue} inputs={{ ...inputs, currentNetRate: simplesBlocked || !activityConfirmed ? NaN : inputs.currentNetRate, spendingRatio: ratio }} monthlyCmv={cmv.ok ? cmv.value : NaN} monthlyPurchases={purchases.ok ? purchases.value : NaN} overrides={monthlyOverrides} onOverridesChange={setMonthlyOverrides} />
        <details className="cbs-method cbs-concepts"><summary>Entenda os termos</summary>
          <p><b>Caixa:</b> dinheiro disponível para pagar contas.</p>
          <p><b>Crédito tributário:</b> abatimento do imposto. Não é um depósito na conta.</p>
          <p><b>Split payment:</b> separação do imposto no pagamento; o restante segue para a empresa.</p>
          <p><b>Por fora:</b> o imposto é calculado sobre o valor sem tributos e somado ao preço. 10% por fora sobre R$ 100 dá R$ 10, e o cliente paga R$ 110.</p>
          <p><b>Hipótese:</b> número de partida que você pode trocar. Não é alíquota oficial.</p>
        </details>
      </div>
    </div>
    <details className="cbs-method"><summary>Fontes e limites da referência setorial</summary><p>{dataset.description}</p><p>{dataset.population}. Ano-base {dataset.year}; coleta em {new Date(dataset.retrievedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Razão entre somas do setor, não média de percentuais individuais. Valores suprimidos pelo IBGE são excluídos, nunca convertidos em zero. Bases preservadas quando a atualização falha; não há consulta a dados do cliente.</p><p><a href={dataset.query} target="_blank" rel="noreferrer">Valores consultados na API SIDRA</a> · <a href={CBS_SOURCES.law} target="_blank" rel="noreferrer">LC 214/2025, arts. 27, 31–35, 47–48 e 347</a> · <a href={CBS_SOURCES.tcu} target="_blank" rel="noreferrer">Referência técnica do TCU</a></p></details>
    <details className="cbs-method cbs-official-source"><summary>Fonte das regras e das alíquotas</summary>
      <p>Fórmulas e dados da <a href={oficial.fonte.repositorio} target="_blank" rel="noreferrer">calculadora oficial da Receita Federal (regime regular)</a> e da <a href={oficial.fonte.repositorioSimples} target="_blank" rel="noreferrer">versão do Simples Nacional</a>. Licença MIT, Copyright (c) 2026 Receita Federal do Brasil.</p>
      <p>Versão da calculadora {oficial.fonte.versaoCalculadora} · tabela de dados {oficial.fonte.versaoBaseDados}, de {isoDate(oficial.fonte.dataBaseDados)} · copiada em {isoDate(oficial.fonte.extraidoEm)}. {REDUCOES.length} tratamentos com redução.</p>
      <p>Oficial: alíquotas de 2026, reduções e a forma de calcular. Hipótese: alíquotas de 2027 a 2033, prazos, split e parcela dos gastos que gera crédito. Uma rotina semanal avisa quando a Receita publicar tabela nova; a troca dos dados é feita à mão.</p>
      <p>Fora do cálculo: nota fiscal item a item, crédito presumido, diferimento, regimes específicos, compras do governo e o cálculo da alíquota do DAS.</p>
    </details>
    <p className="status">Estimativa educativa · sem apuração fiscal, promessa de economia ou compromisso de crédito.</p>
  </section>
}
