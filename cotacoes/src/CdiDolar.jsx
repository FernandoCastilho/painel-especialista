import { useEffect, useMemo, useState } from 'react'
import './CalculatorStandard.css'
import './CdiDolar.css'
import CalculatorHelp from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { latestCdi, parseDecimal, projectedCdi, ptaxSeries, simulateCdiDolar } from './cdiDolar.js'
import { Plot, useWidth } from './HistoryChart.jsx'
import { useMacro } from './useMacro.js'
import { useCurves } from './useCurves.js'

const brl = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fx = (n) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
const pct = (n, d = 2) => `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })}%`
const pctShort = (n) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const rate = (n) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const real4 = (n) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`
const rateText = (n) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dateLabel = (d) => (d ? d.split('-').reverse().join('/') : '—')
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }

export function CdiDolarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h18" />
      <path d="M4 16l5-5 3 3 6-7" />
      <path d="M15 7h3v3" />
      <path d="M7 3.5v5M8.6 4.5H6.4a1 1 0 000 2h1.2a1 1 0 010 2H5.4" />
    </svg>
  )
}

// Frase pronta para o cliente, no mesmo roteiro da planilha.
export function clientPhrase(r, f) {
  if (r.already) return `Considerando BRL/USD de ${fx(f.spot)} até ${fx(f.target)}, o dólar alvo não está acima do atual: a aplicação a ${pctShort(f.pct)} do CDI já supera o câmbio, sem prazo mínimo.`
  return `Considerando BRL/USD de ${fx(f.spot)} até ${fx(f.target)}, a oscilação necessária é de ${pct(r.oscillation)}. ` +
    `Para que o investimento alcance essa rentabilidade em termos líquidos, com aplicação de ${brl(f.amount)} a ${pctShort(f.pct)} do CDI e CDI de ${pct(f.cdi)} a.a., ` +
    `o prazo estimado é de ${r.n} dias úteis, com data estimada em ${dateLabel(r.end)}. Ganho líquido estimado: ${brl(r.netGain)}.`
}

// `quotes`: cotações do Painel; o dólar atual entra com a primeira cotação que chegar, até a pessoa digitar outro valor.
export default function CdiDolar({ onBack, quotes }) {
  const [form, setForm] = useState({ spot: '', target: '', amount: '', cdi: '', pct: '100', start: todayIso() })
  const [spotOwn, setSpotOwn] = useState(false)
  const [cdiOwn, setCdiOwn] = useState(false)
  const macro = useMacro()
  const curves = useCurves()
  const [fxRef, fxWidth] = useWidth()
  const [cdiRef, cdiWidth] = useWidth()
  const cdiPainel = latestCdi(macro.data)
  const ptax = useMemo(() => ptaxSeries(macro.data), [macro.data])
  useEffect(() => {
    if (cdiPainel && !cdiOwn) setForm((old) => (old.cdi ? old : { ...old, cdi: rateText(cdiPainel.rate) }))
  }, [cdiPainel?.rate, cdiOwn]) // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(false)
  const painel = quotes?.USD && quotes.USD.bid > 0 ? quotes.USD : null
  useEffect(() => {
    if (painel && !spotOwn) setForm((old) => (old.spot ? old : { ...old, spot: painel.bid.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) }))
  }, [painel, spotOwn])
  const set = (key, value) => { setForm((old) => ({ ...old, [key]: value })); setCopied(false); if (key === 'spot') setSpotOwn(true); if (key === 'cdi') setCdiOwn(true) }

  const money = parseMoneyInput(form.amount)
  const values = { spot: parseDecimal(form.spot), target: parseDecimal(form.target), amount: money.ok ? money.value : NaN, cdi: parseDecimal(form.cdi) / 100, pct: parseDecimal(form.pct) / 100, start: form.start }
  const filled = ['spot', 'target', 'amount', 'cdi', 'pct', 'start'].every((k) => String(form[k]).trim())
  const result = filled ? simulateCdiDolar(values) : null
  const r = result?.ok ? result : null
  const phrase = r ? clientPhrase(r, values) : ''
  const br = curves.data?.br
  const curveDay = br?.compare?.find((c) => c.id === 'hoje')
  const curvePts = curveDay ? br.curves?.[curveDay.date] : null
  const projection = useMemo(() => projectedCdi(curvePts, curveDay?.date, r && !r.already ? r.n : 252), [curvePts, curveDay?.date, r?.n, r?.already]) // eslint-disable-line react-hooks/exhaustive-deps
  const osc = values.spot > 0 && values.target > 0 ? values.target / values.spot - 1 : null

  const field = (key, label, input, hint) => (
    <div className="cx-field" key={key}>
      <div className="cx-field-label"><label htmlFor={`cd-${key}`}>{label}</label>{hint && <CalculatorHelp title={label}><p>{hint}</p></CalculatorHelp>}</div>
      {input}
    </div>
  )
  const text = (key, label, hint, placeholder) => field(key, label, <input id={`cd-${key}`} type="text" inputMode="decimal" autoComplete="off" placeholder={placeholder} value={form[key]} onChange={(e) => set(key, e.target.value)} />, hint)
  const copy = () => { navigator.clipboard?.writeText(phrase).then(() => setCopied(true), () => setCopied(false)) }

  return (
    <section className="cx cx-cd bw calc-standard calc-workspace" aria-labelledby="cd-heading">
      <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <div className="bw-heading calc-workspace-heading">
        <h2 id="cd-heading" className="cx-title"><strong aria-hidden="true">{'PME'}</strong><span>CDI x Dólar</span></h2>
        <CalculatorHelp title="CDI x Dólar"><p>Em quantos dias úteis o ganho líquido de uma aplicação em % do CDI alcança a alta do dólar entre o câmbio atual e o câmbio alvo de saída.</p><p>Estimativa com CDI constante. Não é cotação nem recomendação.</p></CalculatorHelp>
      </div>
      <p className="cd-notice">Estimativa com CDI constante no período, IR de renda fixa e IOF sobre o rendimento. Os dados ficam só nesta tela.</p>

      <div className="cd-grid">
        <article className="desk-panel cx-panel">
          <header className="cx-heading"><h3>1. Câmbio</h3></header>
          <div className="cx-form">
            {text('spot', 'Dólar atual (R$ por US$ 1)', 'Entra a cotação do dólar do Painel quando disponível. Digite outro valor se quiser.', 'ex.: 5,2000')}
            {text('target', 'Dólar alvo de saída (R$ por US$ 1)', 'Câmbio em que o cliente pretende comprar ou sair.', 'ex.: 5,5000')}
          </div>
          {painel && spotOwn && <button type="button" className="cd-link cd-pad-x" onClick={() => { setSpotOwn(false); setForm((old) => ({ ...old, spot: painel.bid.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) })) }}>Usar cotação do Painel ({fx(painel.bid)})</button>}
          <div className="cd-kpis">
            <div><span>Oscilação necessária</span><b>{osc == null ? '—' : pct(osc)}</b></div>
            <div><span>Variação em R$ por US$ 1</span><b>{osc == null ? '—' : brl(values.target - values.spot)}</b></div>
            <div className="cd-wide"><span>Leitura rápida</span><b>{osc == null ? '—' : osc >= 0 ? `Dólar precisa subir ${pct(osc)}` : `Dólar precisa cair ${pct(-osc)}`}</b></div>
          </div>
          <div className="cd-chart">
            <div className="cx-heading cd-chart-head"><span>Dólar nos últimos 12 meses (PTAX)</span><CalculatorHelp title="Dólar nos últimos 12 meses"><p>PTAX diária do dólar publicada pelo Banco Central, coletada pelo painel. Serve de apoio para escolher o câmbio alvo. A conta usa o dólar atual informado acima.</p></CalculatorHelp></div>
            <div ref={fxRef}>{ptax ? <Plot points={ptax.points} width={fxWidth} color="var(--chart-teal)" code="USD" fmt={real4} label="Dólar PTAX" compare={false} compareReason="gráfico de apoio da calculadora." scales={false} labels /> : <p className="cx-hint cx-pad">{macro.status === 'loading' ? 'Carregando o histórico do dólar…' : 'Histórico do dólar indisponível na última atualização.'}</p>}</div>
            {ptax && <p className="cx-hint cd-chart-note">Mínima de 12 meses: {real4(ptax.min)} · máxima: {real4(ptax.max)}{values.target > 0 && <> · alvo de {real4(values.target)} {values.target > ptax.max ? 'acima da máxima do período' : values.target < ptax.min ? 'abaixo da mínima do período' : 'dentro da faixa do período'}</>}.</p>}
          </div>
        </article>

        <article className="desk-panel cx-panel">
          <header className="cx-heading"><h3>2. Aplicação</h3></header>
          <div className="cx-form">
            {field('amount', 'Valor aplicado', <MoneyInput id="cd-amount" value={form.amount} onChange={(v) => set('amount', v)} />, 'Formato brasileiro: 520.000,00 ou 520000.')}
            {text('cdi', 'CDI atual (% a.a.)', 'Entra o último CDI do Banco Central coletado pelo painel. Digite outro valor se quiser. A conta mantém essa taxa constante em todo o prazo.', 'ex.: 14,15')}
            {text('pct', 'Produto rende (% do CDI)', 'Exemplo: 98 para um CDB a 98% do CDI.', 'ex.: 98')}
            {field('start', 'Data de início', <input id="cd-start" type="date" value={form.start} onChange={(e) => set('start', e.target.value)} />, 'A data final soma os dias corridos estimados a esta data.')}
          </div>
          {cdiPainel && !cdiOwn && <p className="cx-hint cd-chart-note cd-pad-x">CDI do painel: {rate(cdiPainel.rate)} a.a. em {dateLabel(cdiPainel.date)} (Banco Central).</p>}
          {cdiPainel && cdiOwn && <button type="button" className="cd-link cd-pad-x" onClick={() => { setCdiOwn(false); setForm((old) => ({ ...old, cdi: rateText(cdiPainel.rate) })) }}>Usar CDI do Painel ({rate(cdiPainel.rate)})</button>}
          {form.amount && !money.ok && <p className="cx-error cx-pad" role="alert">{money.error}</p>}
          {values.cdi > 0 && values.cdi < 0.01 && <p className="cd-notice cd-pad" role="alert">CDI abaixo de 1% ao ano. Confira: digite 14,15 para 14,15% a.a., não 0,1415.</p>}
          {values.pct > 0 && values.pct < 0.1 && <p className="cd-notice cd-pad" role="alert">Produto abaixo de 10% do CDI. Confira: digite 98 para 98% do CDI, não 0,98.</p>}
          <div className="cd-chart">
            <div className="cx-heading cd-chart-head"><span>CDI projetado pela curva de juros futuros (% a.a.)</span><CalculatorHelp title="CDI projetado"><p>Taxa a termo do DI implícita na curva DI x pré da B3: é o CDI que o mercado precifica para cada trecho do prazo, com prêmio de risco embutido. Não é projeção oficial.</p><p>O gráfico vai da data-base da curva até o prazo calculado (ou 1 ano, antes do cálculo). É só apoio: a conta da calculadora usa o CDI informado acima, constante, como na planilha.</p></CalculatorHelp></div>
            <div ref={cdiRef}>{projection ? <Plot points={projection.points} width={cdiWidth} color="var(--chart-teal)" code="cdif" fmt={rate} label="CDI projetado" compare={false} compareReason="a curva projeta taxas por horizonte, sem série histórica equivalente." scales={false} nice labels /> : <p className="cx-hint cx-pad">{curves.status === 'loading' ? 'Carregando a curva de juros…' : 'Curva de juros indisponível na última atualização.'}</p>}</div>
            {projection && <p className="cx-hint cd-chart-note">CDI médio projetado para os próximos {projection.days} dias úteis: <b>{rate(projection.average)} a.a.</b>{values.cdi > 0 && <> · CDI na conta: {rate(values.cdi * 100)}</>}{projection.clipped && ' · a curva não cobre o prazo inteiro'}. Curva DI x pré da B3 de {dateLabel(curveDay.date)}.</p>}
          </div>
        </article>
      </div>

      <div aria-live="polite">
        {!filled && <p className="cd-notice cd-guide">Preencha câmbio e aplicação para ver o prazo.</p>}
        {result && !result.ok && <p className="cd-notice" role="alert">{result.error}</p>}
      </div>

      {r && (
        <article className="desk-panel cx-panel">
          <header className="cx-heading"><h3>3. Resultado estimado</h3><CalculatorHelp title="Resultado estimado"><p>Prazo = primeiro dia útil em que o ganho líquido ÷ valor aplicado alcança a oscilação necessária do dólar.</p></CalculatorHelp></header>
          {r.already ? <p className="cd-notice cd-pad">O dólar alvo não está acima do atual: a aplicação já supera o câmbio, sem prazo mínimo.</p> : <div className="cd-result">
            <p className="cd-answer"><span aria-hidden="true">✓</span><span>Em <b>{r.n} dias úteis</b>, por volta de <b>{dateLabel(r.end)}</b>, o rendimento líquido da aplicação cobre a alta de <b>{pct(r.oscillation)}</b> do dólar.</span></p>
            <div className="cd-kpis cd-highlight">
              <div className="cd-main"><span>Prazo necessário</span><b>{r.n} dias úteis</b><small>≈ {r.days} dias corridos</small></div>
              <div><span>Data final estimada</span><b>{dateLabel(r.end)}</b><small>início em {dateLabel(form.start)}</small></div>
              <div><span>Ganho líquido</span><b>{brl(r.netGain)}</b><small>após IR e IOF</small></div>
            </div>
            <div className="cd-cols">
              <section className="cd-card" aria-labelledby="cd-waterfall">
                <h4 id="cd-waterfall">Do bruto ao líquido</h4>
                <table className="cd-steps"><caption className="sr-only">Do valor aplicado ao valor líquido</caption><tbody>
                  <tr><td className="cd-op" aria-hidden="true"></td><th scope="row">Valor aplicado</th><td className="cd-rate"></td><td>{brl(values.amount)}</td></tr>
                  <tr><td className="cd-op" aria-hidden="true">+</td><th scope="row">Rendimento bruto</th><td className="cd-rate">{pct(r.gross)}</td><td>{brl(r.grossGain)}</td></tr>
                  <tr className="cd-minus"><td className="cd-op" aria-hidden="true">−</td><th scope="row">IOF</th><td className="cd-rate">{pctShort(r.iof)}</td><td>{brl(r.iofAmount)}</td></tr>
                  <tr className="cd-minus"><td className="cd-op" aria-hidden="true">−</td><th scope="row">IR renda fixa</th><td className="cd-rate">{pctShort(r.ir)}</td><td>{brl((Math.round(r.grossGain * 100) - Math.round(r.iofAmount * 100) - Math.round(r.netGain * 100)) / 100)}</td></tr>
                  <tr className="cd-total"><td className="cd-op" aria-hidden="true">=</td><th scope="row">Valor líquido</th><td className="cd-rate">{pct(r.net)}</td><td>{brl(r.netValue)}</td></tr>
                </tbody></table>
              </section>
              <section className="cd-card" aria-labelledby="cd-vs">
                <h4 id="cd-vs">Líquido x alta do dólar</h4>
                <div className="cd-vs">
                  {(() => { const top = Math.max(r.net, r.oscillation) * 1.03; return <div className="cd-bar" role="img" aria-label={`Rendimento líquido de ${pct(r.net)} contra alta do dólar de ${pct(r.oscillation)}`}><i style={{ width: `${(r.net / top) * 100}%` }} /><em style={{ left: `${(r.oscillation / top) * 100}%` }} /></div> })()}
                  <div className="cd-legend"><span>Líquido no prazo <b>{pct(r.net)}</b></span><span>Alta do dólar <b>{pct(r.oscillation)}</b></span></div>
                  <div className="cd-facts">
                    <div><span>Dólar de {fx(values.spot)} para</span><b>{fx(values.target)}</b></div>
                    <div><span>Aplicação</span><b>{pctShort(values.pct)} do CDI · CDI {pct(values.cdi)} a.a.</b></div>
                  </div>
                  {r.taxStep && <p className="cd-warn"><span aria-hidden="true">!</span><span>{r.taxStep.irFrom > r.taxStep.irTo
                    ? <>Prazo logo acima de {r.taxStep.daysBefore} dias, quando o IR cai de {pctShort(r.taxStep.irFrom)} para {pctShort(r.taxStep.irTo)}. Antes disso, o IR maior impede alcançar a alta do dólar.</>
                    : <>Prazo logo depois de uma redução do IOF ({pctShort(r.taxStep.iofFrom)} para {pctShort(r.taxStep.iofTo)}). Antes disso, o IOF maior impede alcançar a alta do dólar.</>}</span></p>}
                </div>
              </section>
            </div>
            <details className="cd-memory">
              <summary>Memória de cálculo</summary>
              <div className="cx-wrap"><table className="cx-matrix cd-table"><caption className="sr-only">Memória do cálculo</caption><tbody>
                {[
                  ['CDI diário estimado', pct(r.dailyCdi, 4)],
                  ['Retorno diário do produto', pct(r.dailyProduct, 4)],
                  ['Dias corridos (dias úteis × 7/5, arredondado para cima)', String(r.days)],
                  ['Valor bruto ao atingir o alvo líquido', brl(r.grossValue)],
                ].map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
              </tbody></table></div>
            </details>
          </div>}
        </article>
      )}

      {r && (
        <article className="desk-panel cx-panel">
          <header className="cx-heading"><h3>4. Frase pronta para o cliente</h3></header>
          <p className="cd-phrase">{phrase}</p>
          <div className="cd-actions"><button type="button" className="cd-link" onClick={copy}>{copied ? 'Copiado' : 'Copiar frase'}</button></div>
        </article>
      )}

      <div className="cx-heading cd-method"><h3>Premissas e fórmulas</h3><CalculatorHelp title="Premissas e fórmulas"><ul>
        <li>Oscilação necessária = dólar alvo ÷ dólar atual − 1.</li>
        <li>CDI diário = (1 + CDI anual)^(1/252) − 1. Retorno diário do produto = CDI diário × % do CDI.</li>
        <li>Rentabilidade bruta em n dias úteis = (1 + retorno diário)^n − 1.</li>
        <li>Dias corridos = dias úteis × 7/5, arredondado para cima. Data final = data de início + dias corridos. É uma estimativa: não desconta feriados.</li>
        <li>IOF: tabela regressiva até 29 dias corridos; 0% a partir de 30 dias.</li>
        <li>IR: 22,5% até 180 dias; 20% de 181 a 360; 17,5% de 361 a 720; 15% acima de 720.</li>
        <li>Ganho líquido = ganho bruto × (1 − IOF) × (1 − IR).</li>
        <li>Prazo necessário: primeiro dia em que ganho líquido ÷ valor aplicado ≥ oscilação do câmbio. Busca até 5.000 dias úteis.</li>
        <li>O CDI entra preenchido com o último valor do Banco Central coletado pelo painel. O gráfico de CDI projetado (curva DI x pré da B3) é só apoio: a conta mantém o CDI informado constante.</li>
        <li>Não considera variação do CDI, cupom cambial, custo de câmbio (spread e IOF de câmbio) nem regime tributário de pessoa jurídica.</li>
      </ul></CalculatorHelp></div>
    </section>
  )
}
