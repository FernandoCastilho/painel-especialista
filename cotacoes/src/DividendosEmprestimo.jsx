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
import { FORMATOS, PIS_COFINS_FINANCEIRO, parseDecimal, simularDividendosEmprestimo } from './dividendosEmprestimo.js'
import CalcBack from './CalcBack.jsx'

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pctCurto = (n) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const rateText = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = (d) => (d ? d.split('-').reverse().join('/') : '—')
const nomeFormato = (id) => FORMATOS.find((f) => f.id === id)?.label ?? id
const resultadoDo = (linha, id) => linha?.formatos.find((x) => x.formato === id)
const iofDiaText = IOF_PJ.daily.toLocaleString('pt-BR', { maximumFractionDigits: 4 })

export default function DividendosEmprestimo({ onBack }) {
  const [form, setForm] = useState({ valor: '10.000.000,00', taxa: '1,31', cdi: '', pctCdi: '100', aliquotaPj: '34', aliquotaDiv: '10' })
  const [comIof, setComIof] = useState(true)
  const [temAta, setTemAta] = useState(true)
  const [cdiOwn, setCdiOwn] = useState(false)
  const [prazo, setPrazo] = useState(12)
  const [formatoEscolhido, setFormatoEscolhido] = useState(null) // null = o mais eficiente do prazo
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
    comIof,
    temAta,
  }
  const filled = ['valor', 'taxa', 'cdi', 'pctCdi', 'aliquotaPj'].every((k) => String(form[k]).trim()) && (temAta || String(form.aliquotaDiv).trim())
  const result = filled ? simularDividendosEmprestimo(p) : null
  const prazos = result?.ok ? result.prazos : null
  const linha = prazos?.find((x) => x.n === prazo)
  const formato = formatoEscolhido ?? linha?.melhor
  const r = resultadoDo(linha, formato)
  const melhor = resultadoDo(linha, linha?.melhor)

  const field = (key, label, input, hint) => (
    <div className="cx-field" key={key}>
      <div className="cx-field-label"><label htmlFor={`de-${key}`}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>
      {input}
    </div>
  )
  const text = (key, label, hint, placeholder, disabled = false) => field(key, label, <input id={`de-${key}`} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={form[key]} disabled={disabled} onChange={(e) => set(key, e.target.value)} />, hint)
  const check = (id, checked, onChange, label) => <label className="de-check cd-pad-x" htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}</label>

  return (
    <section className="cx cx-cd bw calc-standard calc-workspace cd-pattern de-pattern" aria-labelledby="de-heading">
      <div className="bw-heading calc-workspace-heading">
        <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="de-heading" className="cx-title"><span>Dividendos via empréstimo</span></h2></div>
        <CalculatorHelp title="Dividendos via empréstimo"><p>A empresa de lucro real toma crédito e paga ao sócio o dividendo aprovado em ata. O sócio aplica e deixa a aplicação como garantia. Os juros reduzem o IR da empresa e o dinheiro rende na pessoa física.</p><p>A tela mede a eficiência total na data final: rendimento líquido do sócio + economia de IR da empresa − juros e IOF − o rendimento que o caixa da empresa deixa de ter com os pagamentos (e o imposto sobre o dividendo, se não houver ata). Indica o formato de pagamento mais eficiente.</p><p>Simulação para estudo. Não é recomendação tributária nem cotação.</p></CalculatorHelp>
      </div>
      <p className="cd-notice">Simulação para estudo, com CDI constante e regras tributárias simplificadas. Confirme a estrutura com o jurídico e o contador da empresa. Os dados ficam só nesta tela.</p>

      <div className="cd-layout">
        <div className="cd-grid">
          <article className="desk-panel cx-panel cd-input">
            <header className="cx-heading"><h3>1. Empréstimo da empresa</h3></header>
            <div className="cx-form">
              {field('valor', 'Valor do dividendo (valor da operação)', <MoneyInput id="de-valor" value={form.valor} onChange={(v) => set('valor', v)} />, 'Valor que a empresa toma emprestado e paga ao sócio como dividendo.')}
              {text('taxa', 'Taxa do empréstimo (% a.m.)', 'Taxa mensal da operação. Garantia: aplicação do sócio.', 'ex.: 1,31')}
              {text('aliquotaPj', 'IR + CSLL da empresa (%)', 'Lucro real: IRPJ de 15% + adicional de 10% sobre o lucro acima de R$ 20 mil por mês, mais 9% de CSLL = 34%. Empresa com lucro menor tem alíquota efetiva abaixo disso. Juros e IOF do empréstimo reduzem esse imposto.', 'ex.: 34')}
            </div>
            {check('de-iof', comIof, setComIof, 'Operação com IOF')}
            <p className="cx-hint cd-pad-x">{comIof
              ? <>IOF pago na contratação: {rateText(IOF_PJ.fixed)}% + {iofDiaText}% ao dia sobre cada amortização, até {IOF_PJ.maxDays} dias.</>
              : 'Sem IOF: para operações estruturadas sem incidência. Confirme o enquadramento.'}</p>
          </article>

          <article className="desk-panel cx-panel cd-input">
            <header className="cx-heading"><h3>2. Sócio e dividendo</h3></header>
            <div className="cx-form">
              {text('cdi', 'CDI (% a.a.)', 'Entra o último CDI do Banco Central coletado pelo painel. A conta mantém essa taxa constante em todo o prazo.', 'ex.: 14,15')}
              {text('pctCdi', 'Aplicação rende (% do CDI)', 'CDB ou fundo do sócio, sem resgates. O mesmo % vale para o caixa da empresa.', 'ex.: 100')}
              {text('aliquotaDiv', 'Imposto sobre o dividendo (%)', 'Usado só sem ata. A retenção da Lei 15.270/2025 é de 10% quando a mesma empresa paga ao mesmo sócio mais de R$ 50 mil no mês.', 'ex.: 10', temAta)}
            </div>
            {check('de-ata', temAta, setTemAta, 'Distribuição aprovada em ata até 31/12/2025 (isenta)')}
            {cdiPainel && !cdiOwn && <p className="cx-hint cd-pad-x">CDI do painel: {rateText(cdiPainel.rate)}% a.a. em {dateLabel(cdiPainel.date)} (Banco Central).</p>}
            {cdiPainel && cdiOwn && <button type="button" className="cd-link cd-pad-x" onClick={() => { setCdiOwn(false); setForm((old) => ({ ...old, cdi: rateText(cdiPainel.rate) })) }}>Usar CDI do Painel ({rateText(cdiPainel.rate)}%)</button>}
            {form.valor && !money.ok && <p className="cx-error cx-pad" role="alert">{money.error}</p>}
          </article>
        </div>

        <aside className="cd-results" aria-label="Resultado estimado">
          <article className="desk-panel cx-panel cd-quote">
            <header className="cx-heading"><h3>3. Eficiência da operação</h3><CalculatorHelp title="Eficiência da operação"><p>Quanto empresa e sócio ganham juntos, na data final: rendimento líquido da aplicação do sócio + economia de IR da empresa − juros e IOF − o rendimento que o caixa usado nos pagamentos teria na empresa (e o imposto sobre o dividendo, se não houver ata).</p><p>O formato vencedor depende da taxa do empréstimo depois do IR: se ela fica acima do rendimento líquido do caixa da empresa, pagar antes (SAC, Price) ganha; se fica abaixo, pagar no fim ganha. SAC e Price supõem que a empresa tem caixa para as parcelas.</p></CalculatorHelp></header>
            <div aria-live="polite" className="cd-status">
              {!filled && <p className="cd-notice cd-guide">Preencha os campos para ver o resultado.</p>}
              {result && !result.ok && <p className="cd-notice" role="alert">{result.error}</p>}
            </div>
            {r && (
              <div className="cd-result">
                <div className="de-prazos" role="group" aria-label="Prazo do empréstimo">
                  {prazos.map((x) => <button key={x.n} type="button" aria-pressed={x.n === prazo} onClick={() => setPrazo(x.n)}>{x.n} meses</button>)}
                </div>
                <div className="de-formatos" role="group" aria-label="Formato de pagamento">
                  {linha.formatos.map((x) => (
                    <button key={x.formato} type="button" aria-pressed={x.formato === formato} onClick={() => setFormatoEscolhido(x.formato)}>
                      <span>{nomeFormato(x.formato)}{x.formato === linha.melhor && <em>Mais eficiente</em>}</span>
                      <b className={x.eficiencia < 0 ? 'de-neg-ink' : undefined}>{brl(x.eficiencia)}</b>
                    </button>
                  ))}
                </div>
                <div className="cd-answer-main">
                  <small>Eficiência em {r.n} meses · {nomeFormato(r.formato)}</small>
                  <b className={r.eficiencia < 0 ? 'de-neg' : undefined}>{brl(r.eficiencia)}</b>
                  <span>{r.eficiencia >= 0 ? 'de ganho para empresa + sócio' : 'de perda para empresa + sócio'}</span>
                </div>
                {r.formato !== linha.melhor && <p className="cd-warn"><span aria-hidden="true">!</span><span>Neste prazo, <b>{nomeFormato(linha.melhor)}</b> é mais eficiente: <b>{brl(melhor.eficiencia)}</b> ({brl(melhor.eficiencia - r.eficiencia)} a mais). <button type="button" className="cd-link" onClick={() => setFormatoEscolhido(null)}>Usar o mais eficiente</button></span></p>}

                <section className="cd-card" aria-labelledby="de-composicao">
                  <h4 id="de-composicao">De onde vem o resultado · {r.n} meses</h4>
                  <table className="cd-steps"><caption className="sr-only">Composição da eficiência</caption><tbody>
                    <tr><td className="cd-op" aria-hidden="true">+</td><th scope="row">Rendimento líquido da aplicação do sócio (IR de {pctCurto(r.ir)})</th><td>{brl(r.ganhoSocio)}</td></tr>
                    <tr className="cd-minus"><td className="cd-op" aria-hidden="true">−</td><th scope="row">Juros e IOF do empréstimo</th><td>{brl(r.juros + r.iof)}</td></tr>
                    <tr><td className="cd-op" aria-hidden="true">+</td><th scope="row">Economia de IR/CSLL da empresa sobre juros e IOF</th><td>{brl(r.economiaIr)}</td></tr>
                    <tr className={r.efeitoTempo > 0 ? 'cd-minus' : undefined}><td className="cd-op" aria-hidden="true">{r.efeitoTempo > 0 ? '−' : '+'}</td><th scope="row">{r.efeitoTempo > 0 ? 'Rendimento que o caixa da empresa deixa de ter com os pagamentos antes do fim' : 'Rendimento do caixa da empresa até os pagamentos'}</th><td>{brl(Math.abs(r.efeitoTempo))}</td></tr>
                    {r.impostoDividendo > 0 && <tr className="cd-minus"><td className="cd-op" aria-hidden="true">−</td><th scope="row">Imposto sobre o dividendo (sem ata)</th><td>{brl(r.impostoDividendo)}</td></tr>}
                    <tr className="cd-total"><td className="cd-op" aria-hidden="true">=</td><th scope="row">Eficiência da operação</th><td>{brl(r.eficiencia)}</td></tr>
                  </tbody></table>
                </section>
                <p className={r.emprestimoVsCaixa >= 0 ? 'cd-answer' : 'cd-warn'}><span aria-hidden="true">{r.emprestimoVsCaixa >= 0 ? '✓' : '!'}</span><span>
                  {r.emprestimoVsCaixa >= 0
                    ? <>Mesmo se a empresa tivesse o caixa, o empréstimo sai <b>{brl(r.emprestimoVsCaixa)}</b> mais barato que pagar o dividendo com caixa próprio.</>
                    : <>Se a empresa tem o caixa, pagar o dividendo com caixa próprio daria <b>{brl(-r.emprestimoVsCaixa)}</b> a mais. O empréstimo vale quando o caixa não existe ou é necessário na operação.</>}
                </span></p>
              </div>
            )}
          </article>
        </aside>

        {prazos && (
          <article className="desk-panel cx-panel de-table-panel">
            <header className="cx-heading"><h3>4. Eficiência por prazo e formato</h3></header>
            <div className="cx-wrap"><table className="cx-matrix de-table"><caption className="sr-only">Eficiência da operação por prazo e formato de pagamento</caption>
              <thead><tr><th scope="col">Formato</th>{prazos.map((x) => <th scope="col" key={x.n}>{x.n} meses</th>)}</tr></thead>
              <tbody>
                {FORMATOS.map((f) => (
                  <tr key={f.id}><th scope="row">{f.label}</th>{prazos.map((x) => {
                    const c = resultadoDo(x, f.id)
                    return <td key={x.n} className={x.melhor === f.id ? 'de-best' : c.eficiencia < 0 ? 'de-neg-cell' : undefined}>{brl(c.eficiencia)}</td>
                  })}</tr>
                ))}
                <tr className="de-block"><th scope="rowgroup" colSpan={prazos.length + 1}>No formato mais eficiente</th></tr>
                {[
                  ['Primeiro pagamento mensal da empresa', (c) => c.primeiroPagamento],
                  ['Juros e IOF', (c) => c.juros + c.iof],
                  ['Economia de IR/CSLL', (c) => c.economiaIr],
                  ['Rendimento líquido do sócio', (c) => c.ganhoSocio],
                  ['Empréstimo x caixa próprio (+ = empréstimo mais barato)', (c) => c.emprestimoVsCaixa],
                ].map(([label, get]) => <tr key={label}><th scope="row">{label}</th>{prazos.map((x) => <td key={x.n}>{brl(get(resultadoDo(x, x.melhor)))}</td>)}</tr>)}
              </tbody>
            </table></div>
            <p className="cx-hint cd-pad-x">Em destaque, o formato mais eficiente de cada prazo.</p>
          </article>
        )}

        <article className="desk-panel cx-panel de-avisos" aria-labelledby="de-avisos-h">
          <header className="cx-heading"><h3 id="de-avisos-h">Riscos e ressalvas</h3></header>
          <ul>
            <li><b>Ata de distribuição.</b> A isenção vale para lucros apurados até 2025 com distribuição aprovada até 31/12/2025 e paga nos termos da ata, dentro do prazo da regra de transição da Lei 15.270/2025. Confirme a ata e o prazo com o contador.</li>
            <li><b>Sem ata.</b> A retenção de 10% vale quando a mesma empresa paga ao mesmo sócio mais de R$ 50 mil no mês; pagamentos menores não têm retenção na fonte, mas entram no imposto mínimo anual de quem ganha mais de R$ 600 mil. A retenção é antecipação do imposto mínimo anual: com o redutor que limita a carga empresa + sócio a 34%, parte ou todo o valor pode voltar no ajuste anual. A conta trata o imposto como custo final (visão conservadora).</li>
            <li><b>Dedutibilidade.</b> Juros só reduzem o IR se a despesa for necessária à atividade. Crédito tomado para pagar dividendo pode ter a dedução questionada pela Receita. A economia só existe se a empresa tiver lucro tributável no período; a conta supõe abatimento todo mês, e na apuração trimestral ou anual ele chega mais tarde.</li>
            <li><b>Caixa da empresa.</b> A conta supõe que o caixa usado nos pagamentos renderia o mesmo % do CDI na empresa, com PIS/Cofins e IR/CSLL. Se a empresa usa esse caixa na operação, o custo de oportunidade é outro.</li>
            <li>CDI constante, sem curva de juros. Meses de 30 dias. Sem PIS/Cofins sobre a despesa de juros. Fundo de investimento: a conta não aplica o come-cotas semestral, então o resultado de fundo sai um pouco otimista.</li>
          </ul>
        </article>
      </div>

      <div className="cx-heading cd-method"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Premissas e fórmulas"><ul>
        <li>Formatos: Price (parcelas iguais), SAC (amortização constante + juros), juros mensais com principal no fim, e tudo no fim (juros acumulados mês a mês, pagos com o principal no vencimento).</li>
        <li>IOF (opcional) = {rateText(IOF_PJ.fixed)}% do valor + {iofDiaText}% ao dia sobre cada amortização do principal (30 dias por mês, até 365 dias), pago na contratação.</li>
        <li>Economia de IR/CSLL = alíquota × (juros + IOF). Juros entram no mês em que correm, mesmo quando pagos no fim.</li>
        <li>Aplicação do sócio: CDI diário = (1 + CDI)^(1/252) − 1; rendimento = (1 + CDI diário × % do CDI)^(21 × meses) − 1. IR pelos dias corridos (meses × 365/12): 22,5% até 180; 20% até 360; 17,5% até 720; 15% acima.</li>
        <li>Custo da empresa, na data final = IOF e cada pagamento, menos a economia de IR do mês, corrigidos pelo CDI líquido do caixa da empresa (PIS/Cofins {pctCurto(PIS_COFINS_FINANCEIRO)} e IR/CSLL), menos o valor recebido no empréstimo.</li>
        <li>Eficiência = rendimento líquido do sócio − imposto sobre o dividendo (sem ata) − custo da empresa. O formato mais eficiente é o de maior eficiência no prazo.</li>
        <li>Empréstimo x caixa próprio = rendimento que o valor teria no caixa da empresa no prazo − custo da empresa com o empréstimo.</li>
      </ul></CalculatorHelp></div>
    </section>
  )
}
