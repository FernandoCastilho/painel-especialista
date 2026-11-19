import { useEffect, useState } from 'react'
import './CalculatorStandard.css'
import './CdiDolar.css'
import './CalcPattern-cdi-dolar.css'
import './DividendosEmprestimo.css'
import CalculatorHelp from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { latestCdi } from './cdiDolar.js'
import { useMacro } from './useMacro.js'
import { IOF_PJ } from './emprestimo.js'
import { PIS_COFINS_FINANCEIRO, parseDecimal, simularDividendosEmprestimo } from './dividendosEmprestimo.js'

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = (n, d = 2) => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const pctCurto = (n) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const rateText = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = (d) => (d ? d.split('-').reverse().join('/') : '—')

export function DividendosEmprestimoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21V10l5-4 5 4v11" />
      <path d="M6.5 21v-4h3v4" />
      <path d="M15 8h4.5a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3H21" />
      <path d="M18 6.5V8M18 14v1.5" />
      <path d="M3 21h18" />
    </svg>
  )
}

export default function DividendosEmprestimo({ onBack }) {
  const [form, setForm] = useState({ valor: '10.000.000,00', taxa: '1,31', cdi: '', pctCdi: '100', aliquotaPj: '34', aliquotaDiv: '10' })
  const [cdiOwn, setCdiOwn] = useState(false)
  const [mutuo, setMutuo] = useState(false)
  const [sel, setSel] = useState(12)
  const macro = useMacro()
  const cdiPainel = latestCdi(macro.data)
  useEffect(() => {
    if (cdiPainel && !cdiOwn) setForm((old) => (old.cdi ? old : { ...old, cdi: rateText(cdiPainel.rate) }))
  }, [cdiPainel?.rate, cdiOwn]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (key, value) => { setForm((old) => ({ ...old, [key]: value })); if (key === 'cdi') setCdiOwn(true) }

  const money = parseMoneyInput(form.valor)
  const p = {
    valor: money.ok ? money.value : NaN,
    taxaMes: parseDecimal(form.taxa) / 100,
    cdi: parseDecimal(form.cdi) / 100,
    pctCdi: parseDecimal(form.pctCdi) / 100,
    aliquotaPj: parseDecimal(form.aliquotaPj) / 100,
    aliquotaDividendos: parseDecimal(form.aliquotaDiv) / 100,
    mutuo,
  }
  const filled = Object.values(form).every((v) => String(v).trim())
  const result = filled ? simularDividendosEmprestimo(p) : null
  const prazos = result?.ok ? result.prazos : null
  const r = prazos?.find((x) => x.n === sel)

  const field = (key, label, input, hint) => (
    <div className="cx-field" key={key}>
      <div className="cx-field-label"><label htmlFor={`de-${key}`}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>
      {input}
    </div>
  )
  const text = (key, label, hint, placeholder) => field(key, label, <input id={`de-${key}`} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={form[key]} onChange={(e) => set(key, e.target.value)} />, hint)
  const row = (label, get, fmt = brl, cls) => (
    <tr key={label} className={cls}><th scope="row">{label}</th>{prazos.map((x) => <td key={x.n}>{fmt(get(x))}</td>)}</tr>
  )
  const block = (title) => <tr className="de-block"><th scope="rowgroup" colSpan={prazos.length + 1}>{title}</th></tr>

  return (
    <section className="cx cx-cd bw calc-standard calc-workspace cd-pattern de-pattern" aria-labelledby="de-heading">
      <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <div className="bw-heading calc-workspace-heading">
        <h2 id="de-heading" className="cx-title"><strong aria-hidden="true">{'PME'}</strong><span>Dividendos via empréstimo</span></h2>
        <CalculatorHelp title="Dividendos via empréstimo"><p>A empresa de lucro real toma crédito, repassa o dinheiro ao sócio, o sócio aplica e deixa a aplicação como garantia. A tela compara com distribuir o dividendo hoje e pagar o imposto sobre ele.</p><p>Simulação para estudo. Não é recomendação tributária nem cotação.</p></CalculatorHelp>
      </div>
      <p className="cd-notice">Simulação para estudo, com CDI constante e regras tributárias simplificadas. Confirme a estrutura com o jurídico e o contador da empresa. Os dados ficam só nesta tela.</p>

      <div className="cd-layout">
        <div className="cd-grid">
          <article className="desk-panel cx-panel cd-input">
            <header className="cx-heading"><h3>1. Empréstimo da empresa</h3></header>
            <div className="cx-form">
              {field('valor', 'Lucros acumulados (valor da operação)', <MoneyInput id="de-valor" value={form.valor} onChange={(v) => set('valor', v)} />, 'Valor que seria distribuído como dividendo e que a empresa toma emprestado e repassa ao sócio.')}
              {text('taxa', 'Taxa do empréstimo (% a.m.)', 'Taxa mensal da operação, tabela Price. Garantia: 100% da aplicação do sócio.', 'ex.: 1,31')}
              {text('aliquotaPj', 'IR + CSLL da empresa (%)', 'Lucro real: 25% de IRPJ + 9% de CSLL = 34%. Juros e IOF do empréstimo reduzem esse imposto.', 'ex.: 34')}
            </div>
            <label className="de-check cd-pad-x"><input type="checkbox" checked={mutuo} onChange={(e) => setMutuo(e.target.checked)} /> Repasse ao sócio por mútuo (cobra IOF do sócio)</label>
            <p className="cx-hint cd-pad-x">IOF não financiado, pago na contratação: {rateText(IOF_PJ.fixed)}% + {IOF_PJ.daily.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% ao dia sobre cada amortização, até {IOF_PJ.maxDays} dias.</p>
          </article>

          <article className="desk-panel cx-panel cd-input">
            <header className="cx-heading"><h3>2. Aplicação do sócio e dividendos</h3></header>
            <div className="cx-form">
              {text('cdi', 'CDI (% a.a.)', 'Entra o último CDI do Banco Central coletado pelo painel. A conta mantém essa taxa constante em todo o prazo.', 'ex.: 14,15')}
              {text('pctCdi', 'Aplicação rende (% do CDI)', 'CDB ou fundo do sócio, sem resgates. O mesmo % vale para o caixa que a empresa mantém.', 'ex.: 100')}
              {text('aliquotaDiv', 'Imposto sobre dividendos evitado (%)', 'Imposto que o sócio pagaria se recebesse o valor como dividendo hoje. A retenção da Lei 15.270/2025 é de 10%, mas veja os avisos: o redutor pode devolver parte no ajuste anual.', 'ex.: 10')}
            </div>
            {cdiPainel && !cdiOwn && <p className="cx-hint cd-pad-x">CDI do painel: {rateText(cdiPainel.rate)}% a.a. em {dateLabel(cdiPainel.date)} (Banco Central).</p>}
            {cdiPainel && cdiOwn && <button type="button" className="cd-link cd-pad-x" onClick={() => { setCdiOwn(false); setForm((old) => ({ ...old, cdi: rateText(cdiPainel.rate) })) }}>Usar CDI do Painel ({rateText(cdiPainel.rate)}%)</button>}
            {form.valor && !money.ok && <p className="cx-error cx-pad" role="alert">{money.error}</p>}
          </article>
        </div>

        <aside className="cd-results" aria-label="Resultado estimado">
          <article className="desk-panel cx-panel cd-quote">
            <header className="cx-heading"><h3>3. Resultado estimado</h3><CalculatorHelp title="Resultado estimado"><p>Resultado justo = quanto a família (empresa + sócio) tem a mais na data final com o empréstimo, comparado a distribuir o dividendo hoje. Positivo: o empréstimo compensa.</p></CalculatorHelp></header>
            <div aria-live="polite" className="cd-status">
              {!filled && <p className="cd-notice cd-guide">Preencha os campos para ver o resultado.</p>}
              {result && !result.ok && <p className="cd-notice" role="alert">{result.error}</p>}
            </div>
            {r && (
              <div className="cd-result">
                <div className="de-prazos" role="group" aria-label="Prazo do empréstimo">
                  {prazos.map((x) => <button key={x.n} type="button" aria-pressed={x.n === sel} onClick={() => setSel(x.n)}>{x.n} meses</button>)}
                </div>
                <div className="cd-answer-main">
                  <small>Resultado justo em {r.n} meses</small>
                  <b className={r.resultado < 0 ? 'de-neg' : undefined}>{brl(r.resultado)}</b>
                  <span>{r.resultado >= 0 ? 'a mais do que distribuir o dividendo hoje' : 'a menos do que distribuir o dividendo hoje'}</span>
                </div>
                <div className="cd-kpis cd-highlight">
                  <div><span>Se o imposto for pago no fim</span><b className={r.resultadoAdiado < 0 ? 'de-neg-ink' : undefined}>{brl(r.resultadoAdiado)}</b><small>lucros seguem acumulados; imposto só adiado</small></div>
                  <div><span>Como a planilha calcula</span><b>{brl(r.montantePlanilha)}</b><small>soma simples, sem custo de oportunidade</small></div>
                  <div><span>Compensa se o imposto evitado for maior que</span><b>{r.aliquotaEmpate <= 0 ? '0% (sempre)' : pct(r.aliquotaEmpate)}</b><small>dos dividendos</small></div>
                </div>
                <p className={r.resultado >= 0 ? 'cd-answer' : 'cd-warn'}><span aria-hidden="true">{r.resultado >= 0 ? '✓' : '!'}</span><span>
                  Sócio: <b>{brl(r.socio)}</b> de imposto sobre dividendos evitado{r.custoMutuo > 0 ? ' menos o IOF do mútuo' : ''}, com o rendimento. Empresa: <b>{brl(r.empresa)}</b> de efeito do empréstimo, já com a economia de IR e o caixa mantido rendendo CDI. {r.aliquotaEmpate > 0 ? <>A operação só compensa se o imposto evitado for maior que <b>{pct(r.aliquotaEmpate)}</b>.</> : 'Aqui o empréstimo compensa mesmo sem imposto evitado.'}
                </span></p>

                <section className="cd-card" aria-labelledby="de-ponte">
                  <h4 id="de-ponte">Da planilha ao resultado justo · {r.n} meses</h4>
                  <table className="cd-steps"><caption className="sr-only">Ajustes da visão da planilha até o resultado justo</caption><tbody>
                    <tr><td className="cd-op" aria-hidden="true"></td><th scope="row">Montante final, como na planilha</th><td>{brl(r.montantePlanilha)}</td></tr>
                    <tr className="cd-minus"><td className="cd-op" aria-hidden="true">−</td><th scope="row">Rendimento que o sócio teria mesmo recebendo o dividendo líquido{r.custoMutuo > 0 ? ', e IOF do mútuo' : ''}</th><td>{brl(Math.abs(r.ajusteSocio))}</td></tr>
                    <tr className={r.ajusteEmpresa < 0 ? 'cd-minus' : undefined}><td className="cd-op" aria-hidden="true">{r.ajusteEmpresa < 0 ? '−' : '+'}</td><th scope="row">CDI do caixa da empresa sobre parcelas e economia de IR (valor futuro)</th><td>{brl(Math.abs(r.ajusteEmpresa))}</td></tr>
                    <tr className="cd-total"><td className="cd-op" aria-hidden="true">=</td><th scope="row">Resultado justo</th><td>{brl(r.resultado)}</td></tr>
                  </tbody></table>
                </section>
              </div>
            )}
          </article>
        </aside>

        {prazos && (
          <article className="desk-panel cx-panel de-table-panel">
            <header className="cx-heading"><h3>4. Comparativo por prazo</h3></header>
            <div className="cx-wrap"><table className="cx-matrix de-table"><caption className="sr-only">Empréstimo, aplicação e resultado por prazo</caption>
              <thead><tr><th scope="col">Prazo (meses)</th>{prazos.map((x) => <th scope="col" key={x.n}>{x.n}</th>)}</tr></thead>
              <tbody>
                {block('Empréstimo · pessoa jurídica')}
                {row('Parcela', (x) => x.parcela)}
                {row('IOF não financiado', (x) => x.iof)}
                {row('Pagamento total (P + J + IOF)', (x) => x.totalPago)}
                {row('Economia de IR/CSLL (juros + IOF)', (x) => x.reducaoIr)}
                {block('Aplicação do sócio · sem resgates')}
                {row('Ganho bruto', (x) => x.ganhoBruto)}
                {row('IR', (x) => x.ir, pctCurto)}
                {row('Ganho líquido', (x) => x.ganhoLiquido)}
                {block('Visão da planilha (soma simples)')}
                {row('Ganho (aplicação − pagamento)', (x) => x.ganhoPlanilha)}
                {row('Dividendos evitados', (x) => x.dividendos)}
                {row('Montante final', (x) => x.montantePlanilha, brl, 'de-sub')}
                {block('Comparação justa (valor futuro pelo CDI)')}
                {mutuo && row('IOF do mútuo ao sócio', (x) => x.custoMutuo)}
                {row(mutuo ? 'Sócio: imposto evitado − IOF do mútuo, com rendimento' : 'Sócio: imposto evitado + rendimento', (x) => x.socio)}
                {row('Empresa: caixa mantido − custo do empréstimo', (x) => x.empresa)}
                {row('Resultado justo', (x) => x.resultado, brl, 'de-total')}
                {row('Se o imposto for pago no fim (adiado)', (x) => x.resultadoAdiado, brl, 'de-sub')}
                {row('Imposto evitado mínimo para compensar', (x) => Math.max(x.aliquotaEmpate, 0), pct)}
              </tbody>
            </table></div>
          </article>
        )}

        <article className="desk-panel cx-panel de-avisos" aria-labelledby="de-avisos-h">
          <header className="cx-heading"><h3 id="de-avisos-h">Riscos e ressalvas</h3></header>
          <ul>
            <li><b>Como o dinheiro chega ao sócio.</b> Se o repasse for dividendo, há o imposto que a conta supõe evitar. Se for empréstimo da empresa ao sócio (mútuo), há novo IOF (marque a opção no quadro 1 para descontá-lo) e risco de a Receita tratar como distribuição disfarçada de lucros.</li>
            <li><b>Adiamento, não isenção.</b> Os lucros continuam acumulados na empresa; uma distribuição futura volta a ser tributada. Por isso a tela mostra também o resultado se o imposto for pago no fim.</li>
            <li><b>Retenção de 10% (Lei 15.270/2025).</b> Só vale quando a mesma empresa paga ao mesmo sócio mais de R$ 50 mil no mês. Pagamentos menores, mês a mês, não têm retenção na fonte, mas entram no imposto mínimo anual; no caminho direto, distribuir aos poucos também reduz o imposto que a conta supõe evitar. Lucros até 2025 com distribuição aprovada até 31/12/2025 ficam fora.</li>
            <li><b>Redutor e imposto mínimo anual.</b> Sócio com renda acima de R$ 600 mil no ano entra no imposto mínimo. Se a empresa já paga 34% de alíquota efetiva, o redutor pode devolver parte ou todo o imposto sobre os dividendos no ajuste anual. Nesse caso o imposto evitado é menor e a operação pode não compensar.</li>
            <li><b>Dedutibilidade.</b> Juros só reduzem o IR se a despesa for necessária à atividade. Crédito tomado para repassar ao sócio pode ter a dedução questionada.</li>
            <li>CDI constante, sem curva de juros. Sem PIS/Cofins sobre a despesa de juros. Meses de 30 dias. Fundo de investimento: a conta não aplica o come-cotas semestral, então o resultado de fundo sai um pouco otimista.</li>
            <li><b>Caixa da empresa.</b> A conta supõe que a empresa tem o valor em caixa rendendo CDI. Se o lucro acumulado já está investido no negócio, a comparação muda.</li>
          </ul>
        </article>
      </div>

      <div className="cx-heading cd-method"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Premissas e fórmulas"><ul>
        <li>Parcela Price = valor × i ÷ (1 − (1 + i)^−n). IOF = {rateText(IOF_PJ.fixed)}% do valor + {IOF_PJ.daily.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% ao dia sobre cada amortização (30 dias por mês, até 365 dias). A planilha original usa 0,0041% ao dia, regra anterior ao Decreto 12.499/2025.</li>
        <li>Economia de IR/CSLL = alíquota × (juros + IOF).</li>
        <li>Aplicação: CDI diário = (1 + CDI)^(1/252) − 1; rendimento = (1 + CDI diário × % do CDI)^(21 × meses) − 1. IR de pessoa física pelos dias corridos (meses × 365/12; 12 meses = 365 dias): 22,5% até 180; 20% até 360; 17,5% até 720; 15% acima. A planilha original usa 30 dias por mês (12 meses = 20%).</li>
        <li>IOF do mútuo (opcional): 0,38% + 0,0082% ao dia sobre o valor, até 365 dias, pago pelo sócio na contratação; não reduz o IR da empresa.</li>
        <li>Se o imposto for pago no fim = resultado justo − alíquota de dividendos × valor.</li>
        <li>Visão da planilha = (valor + ganho líquido) − pagamento total + dividendos evitados + economia de IR.</li>
        <li>Resultado justo = sócio + empresa, na data final. Sócio = (imposto evitado − IOF do mútuo) × (1 + rendimento líquido): no caminho direto ele aplicaria o dividendo líquido. Empresa = valor mantido em caixa, rendendo CDI líquido de PIS/Cofins ({pctCurto(PIS_COFINS_FINANCEIRO)}) e IR/CSLL, menos o IOF e cada parcela líquidos da economia de IR, todos levados à data final por esse mesmo CDI líquido.</li>
        <li>Imposto evitado mínimo = (IOF do mútuo × (1 + rendimento líquido) − empresa) ÷ (valor × (1 + rendimento líquido)).</li>
      </ul></CalculatorHelp></div>
    </section>
  )
}
