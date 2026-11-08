import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import Help from './CalculatorHelp.jsx'
import IbgeActivitySearch from './IbgeActivitySearch.jsx'
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
const hints = {
  receiveDays: 'Em quantos dias a venda vira dinheiro? Receber depois pode exigir mais caixa.',
  payDays: 'Em quantos dias você paga a compra? Este prazo também ajuda a situar quando o crédito poderá ser usado.',
  stockDays: 'Quantos dias a compra espera até virar venda? Sem estoque, use zero.',
  spendingPct: 'De cada R$ 100 vendidos, quanto é gasto em compras e consumo? O setor sugere apenas uma referência.',
  eligibleShare: 'Qual parte dos gastos pode gerar abatimento de CBS? 70% significa R$ 70 de cada R$ 100 de gastos, não R$ 70 de crédito.',
  cbsRate: 'Percentual hipotético sobre o preço sem CBS. O total cobrado do cliente é mantido nesta simulação.',
  currentNetRate: 'Parte do faturamento paga em PIS/Cofins, depois de descontar os créditos atuais.',
  splitShare: 'Parte das vendas com imposto separado no pagamento. 50% das vendas não significa reter 50% do dinheiro.',
  currentDueDays: 'Quantos dias depois da venda o imposto atual sai do caixa? É uma média do cenário.',
  futureDueDays: 'Quantos dias depois da venda venceria a CBS? O split pode antecipar a saída, mas não adia o vencimento.',
  creditDelayDays: 'Depois de pagar a compra, quantos dias até poder usar o abatimento? Não é prazo de depósito na conta.',
}
export function CbsIcon() {
  return <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 5h18v14H3zM3 10h18M8 5v14M13 14h5M16 12l2 2-2 2" /></svg>
}

export default function CbsCaixa({ onBack }) {
  const [form, setForm] = useState(initial)
  const [searchReset, setSearchReset] = useState(0)
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
        aria-invalid={invalid} aria-describedby={`cbs-${key}-hint${invalid ? ` cbs-${key}-error` : ''}`}
        onFocus={e => e.target.select()} onChange={e => set(key, e.target.value)} />
      <p className="cbs-field-hint" id={`cbs-${key}-hint`}>{hints[key]}</p>
      {invalid && <p id={`cbs-${key}-error`} className="cx-error">Informe {suffix === 'dias' ? 'dias inteiros de 0 a 365' : `um percentual de 0 a ${key === 'spendingPct' ? 500 : 100}`}.</p>}
    </div>
  }
  return <section className="cx cbs" aria-labelledby="cbs-title">
    <div className="cx-toolbar"><button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <button type="button" className="cx-action" onClick={() => { setForm(initial); setSearchReset(value => value + 1) }}>Restaurar exemplo</button></div>
    <h2 id="cbs-title" className="cx-title"><CbsIcon /> Reforma tributária · impacto no caixa</h2>
    <p className="cbs-intro">Caixa é o dinheiro disponível para pagar as contas. Veja como a CBS e os prazos podem mudar esse dinheiro.</p>
    <p className="cbs-assumptions">Exemplo editável, sem identificação de cliente. Estimativa de CBS em preços brutos mantidos; IBS, ICMS, ISS, IPI e demais tributos não são calculados aqui.</p>
    <div className="cbs-concepts" aria-label="Entenda antes de simular">
      <p><b>Imposto:</b> parte das vendas que precisa ser recolhida ao governo. Aqui simulamos apenas a CBS, que substitui PIS/Cofins.</p>
      <p><b>Crédito tributário:</b> abatimento permitido no imposto. Poder usá-lo reduz o pagamento; não coloca dinheiro automaticamente na conta.</p>
      <p><b>Split payment:</b> separação do imposto no pagamento. Essa parte vai para o governo e o restante segue para a empresa.</p>
    </div>
    <div className="cbs-workspace">
      <article className="desk-panel cx-panel">
        <header><h3>1. A empresa e seu ciclo</h3></header>
        <div className="cx-form">
          <IbgeActivitySearch key={searchReset} datasets={snapshot.datasets} selected={{ ...group, kind: form.kind }} onSelect={option => setForm(f => ({ ...f, kind: option.kind, group: option.id, spendingPct: '' }))} />
          <div className="cx-field"><label htmlFor="cbs-regime">Regime atual</label><select id="cbs-regime" value={form.regime} onChange={e => setForm(f => ({ ...f, regime: e.target.value, currentNetRate: e.target.value === 'real' ? '9,25' : '3,65' }))}><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option><option value="simples">Simples Nacional — IBS/CBS dentro do DAS</option></select><p className="cbs-field-hint">Forma de tributação usada como ponto de partida. Confira o percentual realmente pago; o regime sozinho não define esse valor.</p></div>
          <div className="cx-field"><div className="cx-field-label"><label htmlFor="cbs-revenue">Faturamento mensal bruto</label><Help title="Faturamento mensal"><p>Valor médio bruto das vendas, incluindo tributos. O modelo mantém o preço total cobrado do cliente e estima a parcela de CBS por dentro desse total: valor × alíquota ÷ (100 + alíquota). Não aplica a alíquota por fora diretamente ao faturamento bruto. Os demais tributos não são segregados; a base tributável real pode ser diferente.</p></Help></div><MoneyInput id="cbs-revenue" value={form.revenue} onChange={value => set('revenue', value)} aria-invalid={!parsedMoney.ok || parsedMoney.value <= 0} aria-describedby="cbs-revenue-hint" /><p id="cbs-revenue-hint" className="cbs-field-hint">Total vendido no mês, com tributos. Vender não significa receber no mesmo dia.</p></div>
          {field('receiveDays', 'Recebimento médio', 'Dias entre a venda e o recebimento. Use a média ponderada dos valores, incluindo vendas à vista.')}
          {field('payDays', 'Pagamento a fornecedores', 'Dias entre a compra e o pagamento ao fornecedor. Ajuda a situar o crédito: o imposto pode ser quitado em outra data, por isso o prazo de liberação é uma hipótese separada.')}
          {field('stockDays', 'Estoque médio', 'Dias entre a compra e a venda. Serviços sem estoque podem informar zero. Matérias-primas e produtos em elaboração exigem aproximação do ciclo completo.')}
        </div>
        {group && <div className="cbs-source"><b>Gastos sugeridos: {decimal(ratio * 100)}% do faturamento</b><p>{form.spendingPct ? 'Percentual ajustado pelo usuário.' : `${dataset.population} · IBGE ${dataset.year}.`}</p><p>É referência econômica de gastos, não percentual de crédito tributário.</p><a href={dataset.source} target="_blank" rel="noreferrer">Consultar tabela {dataset.table} no IBGE ↗</a></div>}
      </article>
      <div className="cbs-right">
        <article className="desk-panel cx-panel">
          <header><h3>2. Premissas do cenário</h3><Help title="Hipóteses, não enquadramento fiscal"><p>O setor estima gastos. Não define sozinho a alíquota, elegibilidade fiscal, regularidade do fornecedor ou adoção do split payment. Esses percentuais e prazos são hipóteses editáveis, não estatísticas do IBGE.</p><p>O exemplo usa CBS de 11,2% por fora: referência técnica de 11,3% calculada pelo TCU menos 0,1 ponto percentual na transição 2027/2028 (LC 214, art. 347). Não é alíquota definitiva para sua empresa. Benefícios, alíquota zero e regimes específicos exigem ajuste.</p></Help></header>
          <div className="cbs-premise-summary">Hipóteses editáveis — CBS: {form.cbsRate}% · gastos que podem gerar crédito: {form.eligibleShare}% · vendas com split: {form.splitShare}%<br />PIS/Cofins atuais, após créditos: {form.currentNetRate}% do faturamento{form.regime === 'real' ? ' — o exemplo de 9,25% ainda não desconta créditos; ajuste para representar o valor realmente pago' : ' — confira o percentual realmente pago'}.</div>
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
          <div className="cbs-reserve">
            <p>Quanto dinheiro pode ser necessário para cobrir a mudança de datas entre receber, pagar o imposto e usar os créditos?</p>
            <div className="cbs-scenarios">
              <div><small>1. Créditos já disponíveis</small><strong>{money(result.reserveImmediate)}</strong><p>Abatimentos prontos quando o imposto é pago.</p></div>
              <div><small>2. Créditos disponíveis após a espera</small><strong>{money(result.reserveDelayed)}</strong><p>Abatimentos liberados conforme os prazos informados.</p></div>
            </div>
            <p>São duas hipóteses de reserva adicional para cobrir prazos. Não é uma nova despesa mensal e não se multiplica por 12. Zero não significa que a empresa tenha caixa suficiente.</p>
          </div>
          <div className="cbs-explanation">
            <h4>Imposto por mês: entenda a conta</h4>
            <dl className="cbs-breakdown">
              <div><dt>CBS estimada nas vendas</dt><dd>{money(result.outputTax)}</dd></div>
              <div><dt>Menos créditos usados para abater</dt><dd>− {money(result.creditsUsable)}</dd></div>
              <div className="cbs-total"><dt>CBS restante a pagar</dt><dd>{money(result.netTax)}/mês</dd></div>
              <div><dt>PIS/Cofins atual, pela hipótese informada</dt><dd>{money(result.currentTax)}/mês</dd></div>
            </dl>
            <p className="cbs-monthly-change"><b>{result.monthlyTaxDelta > 0 ? 'Aumento' : result.monthlyTaxDelta < 0 ? 'Redução' : 'Sem mudança'} de imposto: {money(Math.abs(result.monthlyTaxDelta))}/mês.</b> Com o mesmo total vendido, essa diferença muda o dinheiro que sobra após pagar o tributo. Avalie preço e margem separadamente da reserva de prazo acima.</p>
            {result.excessCredits > 0 && <p>Há ainda {money(result.excessCredits)} de créditos acima da CBS das vendas. Esse saldo não virou dinheiro nesta conta. A espera para aproveitá-lo pode exigir mais giro do que o estimado.</p>}
          </div>
          <details className="cbs-details cbs-cash-details"><summary>Como isso aparece no recebimento e nos prazos?</summary>
            <div className="cbs-explanation">
              <h4>Do total vendido ao dinheiro recebido</h4>
              <p>Quando as vendas deste mês forem recebidas, o modelo considera:</p>
              <dl className="cbs-breakdown">
                <div><dt>Total bruto das vendas</dt><dd>{money(parsedMoney.value)}</dd></div>
                <div><dt>Menos CBS separada no recebimento</dt><dd>− {money(result.splitNet)}</dd></div>
                <div className="cbs-total"><dt>Entrada após essa separação</dt><dd>{money(result.receiptsAfterNetSplit)}</dd></div>
              </dl>
              <p>Esse valor ainda precisa pagar fornecedores, folha, outros tributos e despesas. Não é lucro nem saldo livre em conta.</p>
              <p>{inputs.receiveDays > inputs.futureDueDays ? 'O recebimento acontece depois do vencimento: a CBS já foi paga antes e não é descontada novamente.' : 'A CBS é separada na parcela das vendas indicada no cenário, considerando os créditos já disponíveis. A parte restante do imposto segue o vencimento informado.'}</p>
              <p>Antes dos créditos e do ajuste de imposto já pago, a CBS bruta das vendas com split seria {money(result.splitGross)}. Não some esse valor à reserva.</p>
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
        </article>}
      </div>
    </div>
    <details className="cbs-method"><summary>Fontes e limites da referência setorial</summary><p>{dataset.description}</p><p>{dataset.population}. Ano-base {dataset.year}; coleta em {new Date(dataset.retrievedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Razão entre somas do setor, não média de percentuais individuais. Valores suprimidos pelo IBGE são excluídos, nunca convertidos em zero. Bases preservadas quando a atualização falha; não há consulta a dados do cliente.</p><p><a href={dataset.query} target="_blank" rel="noreferrer">Valores consultados na API SIDRA</a> · <a href={CBS_SOURCES.law} target="_blank" rel="noreferrer">LC 214/2025, arts. 27, 31–35, 47–48 e 347</a> · <a href={CBS_SOURCES.tcu} target="_blank" rel="noreferrer">Referência técnica do TCU</a></p></details>
    <p className="status">Estimativa educativa · sem apuração fiscal, promessa de economia ou compromisso de crédito.</p>
  </section>
}
