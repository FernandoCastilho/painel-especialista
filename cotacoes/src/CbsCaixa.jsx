import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import Help from './CalculatorHelp.jsx'
import snapshot from './ibgeCbsSnapshot.json'
import { simulateCbsCash } from './cbsCash.js'
import { CBS_SOURCES } from './baseDados.js'
import './CbsCaixa.css'

const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const decimal = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const numeric = text => String(text).trim() === '' ? NaN : Number(String(text).replace(',', '.'))
const initial = { kind: 'comercio', group: 'comercio-83319', regime: 'presumido', revenue: '1.000.000,00',
  receiveDays: '30', payDays: '30', stockDays: '30', spendingPct: '', eligibleShare: '70',
  cbsRate: '11,2', currentNetRate: '3,65', splitShare: '50', currentDueDays: '40',
  futureDueDays: '40', creditDelayDays: '30' }
const kinds = { comercio: 'Comércio', industria: 'Indústria', servicos: 'Serviços' }
export function CbsIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 5h18v14H3zM3 10h18M8 5v14M13 14h5M16 12l2 2-2 2" /></svg>
}

export default function CbsCaixa({ onBack }) {
  const [form, setForm] = useState(initial)
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const dataset = snapshot.datasets.find(d => d.kind === form.kind)
  const group = dataset.groups.find(g => g.id === form.group)
  const ratio = form.spendingPct.trim() === '' ? group?.spendingRatio : numeric(form.spendingPct) / 100
  const parsedMoney = parseMoneyInput(form.revenue)
  const inputs = Object.fromEntries(['receiveDays', 'payDays', 'stockDays', 'eligibleShare', 'cbsRate',
    'currentNetRate', 'splitShare', 'currentDueDays', 'futureDueDays', 'creditDelayDays'].map(k => [k, numeric(form[k])]))
  const result = form.regime === 'simples' || !group ? null : simulateCbsCash({ ...inputs,
    revenue: parsedMoney.ok ? parsedMoney.value : NaN, spendingRatio: ratio })
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
  const chooseKind = kind => {
    const next = snapshot.datasets.find(d => d.kind === kind)
    setForm(f => ({ ...f, kind, group: next.groups[0].id, spendingPct: '' }))
  }
  return <section className="cx cbs" aria-labelledby="cbs-title">
    <div className="cx-toolbar"><button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <button type="button" className="cx-action" onClick={() => setForm(initial)}>Restaurar exemplo</button></div>
    <h2 id="cbs-title" className="cx-title"><CbsIcon /> Reforma tributária · impacto no caixa</h2>
    <p className="cbs-intro">Quanto pode faltar de giro quando o imposto sai antes e os créditos chegam depois?</p>
    <p className="cbs-assumptions">Exemplo editável, sem identificação de cliente. Estimativa de CBS em preços brutos mantidos; IBS, ICMS, ISS, IPI e demais tributos não são calculados aqui.</p>
    <div className="cbs-workspace">
      <article className="desk-panel cx-panel">
        <header><h3>1. A empresa e seu ciclo</h3></header>
        <div className="cx-form">
          <div className="cx-field"><label htmlFor="cbs-kind">Setor</label><select id="cbs-kind" value={form.kind} onChange={e => chooseKind(e.target.value)}>{Object.entries(kinds).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
          <div className="cx-field"><label htmlFor="cbs-group">Atividade de referência do IBGE</label><select id="cbs-group" value={form.group} onChange={e => setForm(f => ({ ...f, group: e.target.value, spendingPct: '' }))}>{dataset.groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          <div className="cx-field"><label htmlFor="cbs-regime">Regime atual</label><select id="cbs-regime" value={form.regime} onChange={e => setForm(f => ({ ...f, regime: e.target.value, currentNetRate: e.target.value === 'real' ? '9,25' : '3,65' }))}><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option><option value="simples">Simples Nacional — IBS/CBS dentro do DAS</option></select></div>
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-revenue">Faturamento mensal bruto</label><Help title="Faturamento mensal"><p>Valor médio bruto das vendas, incluindo tributos. O modelo mantém o preço total cobrado do cliente e estima a parcela de CBS por dentro desse total: valor × alíquota ÷ (100 + alíquota). Não aplica a alíquota por fora diretamente ao faturamento bruto. Os demais tributos não são segregados; a base tributável real pode ser diferente.</p></Help></div><MoneyInput id="cbs-revenue" value={form.revenue} onChange={value => set('revenue', value)} aria-invalid={!parsedMoney.ok || parsedMoney.value <= 0} /></div>
          {field('receiveDays', 'Recebimento médio', 'Dias entre a venda e o recebimento. Use a média ponderada dos valores, incluindo vendas à vista.')}
          {field('payDays', 'Pagamento a fornecedores', 'Dias entre a compra e o pagamento ao fornecedor. Ajuda a situar o crédito: o imposto pode ser quitado em outra data, por isso o prazo de liberação é uma hipótese separada.')}
          {field('stockDays', 'Estoque médio', 'Dias entre a compra e a venda. Serviços sem estoque podem informar zero. Matérias-primas e produtos em elaboração exigem aproximação do ciclo completo.')}
        </div>
        {group && <div className="cbs-source"><b>Gastos sugeridos: {decimal(ratio * 100)}% do faturamento</b><p>{form.spendingPct ? 'Percentual ajustado pelo usuário.' : `${dataset.population} · IBGE ${dataset.year}.`}</p><p>É referência econômica de gastos, não percentual de crédito tributário.</p><div className="cbs-update-status" role="note" aria-label="Atualização da referência IBGE"><b>Base preservada · IBGE {dataset.year}</b><p>Atualização automática suspensa após falha de acesso ao IBGE (HTTP 403). Última coleta válida: {new Date(dataset.retrievedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Não é uma consulta em tempo real.</p></div><a href={dataset.source} target="_blank" rel="noreferrer">Consultar tabela {dataset.table} no IBGE ↗</a></div>}
      </article>
      <div className="cbs-right">
        <article className="desk-panel cx-panel">
          <header><h3>2. Premissas do cenário</h3><Help title="Hipóteses, não enquadramento fiscal"><p>O setor estima gastos. Não define sozinho a alíquota, elegibilidade fiscal, regularidade do fornecedor ou adoção do split payment. Esses percentuais e prazos são hipóteses editáveis, não estatísticas do IBGE.</p><p>O exemplo usa CBS de 11,2% por fora: referência técnica de 11,3% calculada pelo TCU menos 0,1 ponto percentual na transição 2027/2028 (LC 214, art. 347). Não é alíquota definitiva para sua empresa. Benefícios, alíquota zero e regimes específicos exigem ajuste.</p></Help></header>
          <div className="cbs-premise-summary">CBS: {form.cbsRate}% · gastos elegíveis: {form.eligibleShare}% · vendas com split: {form.splitShare}%<br />Carga atual líquida: {form.currentNetRate}% do faturamento — hipótese{form.regime === 'real' ? ' de 9,25% sem créditos atuais; ajuste para não superestimar a carga atual' : ', sujeita a exceções por operação'}.</div>
          <details className="cbs-details"><summary>Ajustar impostos, créditos e prazos</summary><div className="cx-form">
            {field('spendingPct', 'Gastos sobre o faturamento', 'Referência econômica do IBGE. Comércio usa compras para revenda; indústria e serviços combinam itens identificados de compras/consumo. São bases diferentes e aproximadas. Ajustar substitui apenas a hipótese desta simulação.', '%')}
            {field('eligibleShare', 'Parcela dos gastos que gera crédito', 'Hipótese inicial de 70%, não estimativa do IBGE. Mercadorias, materiais, energia, fretes e serviços podem gerar crédito conforme operação e fornecedor. Salários não geram CBS. Isenções, alíquota zero, Simples e regimes especiais alteram o crédito. Modelo usa a mesma alíquota nas aquisições elegíveis; ajuste esta parcela para representar um aproveitamento menor.', '%')}
            {field('cbsRate', 'CBS do cenário, por fora', 'Alíquota hipotética aplicável às vendas e às compras elegíveis deste cenário homogêneo. Padrão 11,2% para ilustração da transição; não é uma determinação fiscal por setor.', '%')}
            {field('currentNetRate', 'Carga atual líquida de PIS/Cofins', 'Imposto atual depois de créditos dividido pelo faturamento bruto. Presumido inicia com hipótese de 3,65%; Real com 9,25% sem créditos. Esses valores não confirmam o tratamento da empresa. Se conhecer o recolhimento líquido médio, divida pelo faturamento e ajuste. Não há apuração automática de PIS/Cofins.', '%')}
            {field('splitShare', 'Vendas com separação no pagamento', 'Percentual hipotético do faturamento sujeito ao split payment. A implantação é gradual; 50% é somente um cenário de adoção parcial. Não se presume início geral em janeiro de 2027. Imposto já quitado no vencimento não é cobrado novamente no recebimento.', '%')}
            {field('currentDueDays', 'Recolhimento atual após a venda', 'Prazo médio entre venda e recolhimento atual. O padrão de 40 dias é hipótese ilustrativa, não vencimento legal fixo. A data efetiva depende da apuração e do calendário.')}
            {field('futureDueDays', 'Recolhimento futuro após a venda', 'Prazo médio hipotético até o vencimento da CBS. O split antecipa o recolhimento quando o recebimento acontece antes; não posterga o vencimento se o cliente paga depois. Não é prazo legal fixo.')}
            {field('creditDelayDays', 'Liberação do crédito após pagar fornecedor', 'Hipótese de tempo até o crédito ficar disponível, não prazo legal de ressarcimento nem inadimplência medida. O modelo situa a compra antes da venda pelos dias de estoque e adiciona o prazo de pagamento e esta espera. Crédito fiscal não é dinheiro depositado automaticamente.')}
          </div></details>
        </article>
        {form.regime === 'simples' && <div className="cbs-message" role="status">O Simples com IBS/CBS dentro do DAS tem sistemática própria de créditos. Esta versão calcula o regime regular. Não aplicamos o cálculo padrão ao DAS. Uma opção pelo regime regular exige análise própria.</div>}
        {result && !result.ok && <p className="cx-error" role="alert">{result.error}</p>}
        {result?.ok && <article className="desk-panel cx-panel cbs-result" aria-labelledby="cbs-result-title">
          <header><h3 id="cbs-result-title">3. Necessidade adicional de giro</h3><Help title="Como a reserva é estimada"><p>Fluxo mensal uniforme, divisor 30 e prazos médios constantes. A reserva compara a disponibilidade temporária do imposto atual com a da CBS líquida futura, ponderando a parcela de split e o vencimento. Não é o imposto mensal multiplicado pelo ano.</p><p>Primeiro cenário: créditos utilizáveis já disponíveis. Segundo: indisponibilidade temporária desses créditos conforme compra, estoque, pagamento e prazo adicional informado. A espera positiva é calculada separadamente na parcela com split e na parcela recolhida no vencimento, antes de ponderar os resultados; um recolhimento posterior não anula a espera da parcela antecipada. São cenários de sensibilidade, não intervalo estatístico nem déficit máximo comprovado. Não somar novamente esses valores à retenção bruta ou à NCG integral.</p><p>O ciclo financeiro é apresentado em dias; não calculamos a NCG total da empresa, saldo de caixa, sazonalidade, margem, renegociação de preços, CAPEX, ressarcimento ou capacidade de pagamento. O resultado não é limite de crédito nem recomendação de contratação.</p></Help></header>
          <div className="cbs-reserve"><small>Reserva indicativa nos dois cenários</small><strong>{money(result.reserveImmediate)} a {money(result.reserveDelayed)}</strong><p>Crédito disponível × crédito com espera · efeito pontual de prazo, sem acumular mensalmente.</p></div>
          <div className="cbs-metrics">
            <div><span>CBS líquida mensal estimada</span><b>{money(result.netTax)}</b></div>
            <div><span>Créditos utilizáveis estimados</span><b>{money(result.creditsUsable)}</b></div>
            <div><span>Separação líquida no recebimento*</span><b>{money(result.splitNet)}</b></div>
            <div><span>Ciclo financeiro operacional</span><b>{result.cycleDays} dias</b></div>
          </div>
          <div className="cbs-result-note"><p>*Com créditos disponíveis e descontando imposto já recolhido. Antes desses ajustes, a parcela bruta potencial de CBS nas vendas sujeitas ao split é {money(result.splitGross)}.</p>
            <p>{result.timingDelta < 0 ? `Com créditos disponíveis, o modelo indica alívio de prazo de ${money(-result.timingDelta)}; isso não comprova sobra de caixa.` : `O efeito de antecipação, com créditos disponíveis, é de ${money(result.timingDelta)}.`} A espera adicional dos créditos gera exposição de {money(result.creditExposure)} ({decimal(result.creditGapDays)} dias no modelo).</p>
            <p>Diferença recorrente de imposto: {result.monthlyTaxDelta >= 0 ? '+' : '−'}{money(Math.abs(result.monthlyTaxDelta))}/mês. Esse efeito de carga deve ser tratado em preço/margem; não está acumulado na reserva de prazo.</p>
            {result.excessCredits > 0 && <p>Créditos excedentes: {money(result.excessCredits)}. Não foram tratados como dinheiro disponível nem ressarcimento imediato. O modelo pode subestimar o giro necessário para esse saldo.</p>}
          </div>
        </article>}
      </div>
    </div>
    <details className="cbs-method"><summary>Fontes e limites da referência setorial</summary><p>{dataset.description}</p><p>{dataset.population}. Ano-base {dataset.year}; coleta em {new Date(dataset.retrievedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Razão entre somas do setor, não média de percentuais individuais. Valores suprimidos pelo IBGE são excluídos, nunca convertidos em zero. Bases preservadas quando a atualização falha; não há consulta a dados do cliente.</p><p><a href={dataset.query} target="_blank" rel="noreferrer">Valores consultados na API SIDRA</a> · <a href={CBS_SOURCES.law} target="_blank" rel="noreferrer">LC 214/2025, arts. 27, 31–35, 47–48 e 347</a> · <a href={CBS_SOURCES.tcu} target="_blank" rel="noreferrer">Referência técnica do TCU</a></p></details>
    <p className="status">Estimativa educativa · sem apuração fiscal, promessa de economia ou compromisso de crédito.</p>
  </section>
}
