import { useState } from 'react'
import './Calculadora.css'
import './CalculatorLayout.css'
import './CalculatorTheme.css'
import './FinimpCotacao.css'
import MoneyInput from './MoneyInput.jsx'
import Help from './CalculatorHelp.jsx'
import { FinimpIcon } from './FinimpComparacao.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { MOEDAS, lerTaxasFuturas, moedaOf } from './emprestimo4131.js'
import { FI_IR_OPTIONS, FI_MAX_DIAS, FI_MAX_PARCELAS, FI_METAS, finimpCotacao, metaAllIn, prazosIguais } from './finimpCotacao.js'

const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const brl = (v) => `R$\u00a0${dec(v)}`
const pct = (v, d = 2) => `${dec(Math.abs(v) < 0.5 / 10 ** d ? 0 : v, d)}%`
const dm = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
const inteiro = (t) => (/^\d+$/.test(String(t ?? '').trim()) ? Number(t) : null)

// FINIMP no formato da cotação de banco: o usuário digita valor na moeda, cotação de partida, taxa all-in e as taxas
// futuras (NDF); o resto sai da conta. "Atingir meta" acha a taxa all-in que leva à TIR efetiva desejada.
export default function FinimpCotacao({ onBack, quotes }) {
  const [currency, setCurrency] = useState('USD')
  const [valorText, setValorText] = useState('100.000,00')
  const [spotText, setSpotText] = useState('')
  const [start, setStart] = useState(cgToday)
  const [parcelasText, setParcelasText] = useState('1')
  const [prazoText, setPrazoText] = useState('180')
  const [allInText, setAllInText] = useState('8,7093')
  const [externaText, setExternaText] = useState('5,4503')
  const [irrf, setIrrf] = useState('25')
  const [tacText, setTacText] = useState('0,00')
  const [fwdText, setFwdText] = useState('')
  const [ptaxText, setPtaxText] = useState('')
  const [metaKind, setMetaKind] = useState('tir')
  const [metaText, setMetaText] = useState('')
  const [meta, setMeta] = useState(null)

  const cur = moedaOf(currency)
  const painel = quotes?.[currency]?.bid > 0 ? quotes[currency].bid : null
  const spotShown = spotText || (painel ? dec(painel, 4) : '')
  const spot = parseDecimal(spotShown)
  const valor = parseMoneyInput(valorText)
  const parcelas = inteiro(parcelasText)
  const prazo = inteiro(prazoText)
  const allIn = parseDecimal(allInText)
  const externa = parseDecimal(externaText)
  const tac = parseMoneyInput(tacText, { optional: true })
  const fwd = lerTaxasFuturas(fwdText)
  // PTAX do vencimento é um cenário: vazia, repete a cotação de partida (como a planilha abre).
  const ptax = ptaxText.trim() ? lerTaxasFuturas(ptaxText) : { rates: spot ? [spot] : [], bad: null }

  const errors = {
    valor: valor.ok && valor.value > 0 ? null : 'Informe o valor na moeda, maior que zero.',
    spot: spot > 0 ? null : 'Informe a cotação de partida.',
    parcelas: parcelas >= 1 && parcelas <= FI_MAX_PARCELAS ? null : `De 1 a ${FI_MAX_PARCELAS} parcelas.`,
    prazo: prazo >= 1 && prazo <= FI_MAX_DIAS && (!parcelas || prazo >= parcelas) ? null : 'Prazo em dias corridos, pelo menos um dia por parcela.',
    allIn: allIn !== null ? null : 'Informe a taxa all-in em % ao ano.',
    externa: externa !== null ? null : 'Informe a comissão externa em % ao ano.',
    tac: tac.ok ? null : 'Informe a TAC em reais.',
    fwd: fwd.bad ? `"${fwd.bad}" não é uma taxa.` : !fwd.rates.length ? 'Cole a taxa futura de cada parcela.' : parcelas && fwd.rates.length > parcelas ? `Há ${fwd.rates.length} taxas para ${parcelas} parcelas.` : null,
    ptax: ptax.bad ? `"${ptax.bad}" não é uma cotação.` : null,
  }
  const params = Object.values(errors).some(Boolean) ? null : {
    valor: valor.value, spot, start, prazos: prazosIguais(prazo, parcelas), externa, irrf: Number(irrf), tac: tac.value, forwards: fwd.rates, ptax: ptax.rates,
  }
  const result = params ? finimpCotacao({ ...params, allIn }) : null
  const r = result?.ok ? result : null
  const pendencia = result?.error ?? (params ? null : 'Complete os campos indicados para calcular.')

  const atingir = () => {
    const alvo = parseDecimal(metaText)
    if (alvo === null) return setMeta({ erro: 'Informe a meta em % ao mês, por exemplo 1,33.' })
    if (!params) return setMeta({ erro: 'Complete os dados da operação antes de calcular.' })
    const m = metaAllIn(params, metaKind, alvo)
    if (!m.ok) return setMeta({ erro: m.error })
    const texto = dec(m.allIn, 4)
    setAllInText(texto)
    setMeta({ texto, alvo: `${metaKind === 'tir' ? 'TIR efetiva' : 'equivalente em giro'} de ${dec(alvo, 2)}% a.m.` })
  }

  const ajuda = (label, texto) => <Help label={`Ajuda: ${label}`}>{texto}</Help>
  const field = (key, label, control, hint, note) => (
    <div className="cx-field">
      <span className="fc-rotulo"><label htmlFor={`fc-${key}`}>{label}</label>{hint && ajuda(label, hint)}</span>
      {control}
      {note && <p className="fc-nota">{note}</p>}
      <p className="cx-error" id={`fc-${key}-err`} role={errors[key] ? 'alert' : undefined}>{errors[key] ?? ''}</p>
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`fc-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!errors[key]} aria-describedby={`fc-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} {...extra} />

  return (
    <section className="cx fc" aria-labelledby="fc-title">
      <button type="button" className="cx-back" onClick={onBack}>‹ Calculadoras</button>
      <h2 id="fc-title" className="cx-title cx-heading"><span className="cx-heading-text"><span className="cx-icon" aria-hidden="true"><FinimpIcon /></span><span>FINIMP · cotação com NDF</span></span>
        {ajuda('FINIMP · cotação', 'Reproduz a planilha de cotação de FINIMP com NDF de compra. Você digita o valor na moeda, a cotação de partida, a taxa all-in e as taxas futuras fechadas; comissões, IR, juros, parcelas, ajustes da NDF, TIR efetiva, economia de IOF e equivalente em giro saem da conta. Nada do que você digita é enviado ou guardado.')}</h2>

      <div className="fc-grid">
        <article className="desk-panel cx-panel fc-dados">
          <section className="fc-meta" aria-labelledby="fc-meta-h">
            <h3 id="fc-meta-h">Atingir meta{ajuda('Atingir meta', 'Digite a TIR efetiva (ou o equivalente em giro) que você quer, ao mês. A tela calcula a taxa all-in que leva a ela, mantendo o resto igual, coloca a taxa no campo com quatro casas e recalcula tudo. A comissão externa fica fixa; a comissão local absorve a diferença.')}</h3>
            <div className="fc-meta-campos">
              <select aria-label="Meta" value={metaKind} onChange={(e) => { setMetaKind(e.target.value); setMeta(null) }}>{FI_METAS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
              <div className="cx-rate"><input id="fc-meta" aria-label="Meta em % ao mês" aria-describedby="fc-meta-status" inputMode="decimal" autoComplete="off" placeholder="ex.: 1,33" value={metaText} onChange={(e) => setMetaText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') atingir() }} /><span className="fc-unidade">% a.m.</span></div>
              <button type="button" className="fc-btn" onClick={atingir}>Calcular taxa</button>
            </div>
            <p className="fc-nota" id="fc-meta-status" role="status">{meta?.erro ?? (meta && meta.texto === allInText ? `Taxa all-in de ${cur.Nome} + ${meta.texto}% a.a., calculada para chegar à ${meta.alvo}` : '')}</p>
          </section>

          <h3 className="fc-grupo">Operação</h3>
          <div className="cx-form fc-form">
            {field('currency', 'Moeda', <select id="fc-currency" value={currency} onChange={(e) => { setCurrency(e.target.value); setSpotText('') }}>{MOEDAS.map((m) => <option key={m.id} value={m.id}>{m.Nome}</option>)}</select>)}
            {field('valor', `Valor (${cur.sym})`, <MoneyInput prefix={cur.sym} id="fc-valor" aria-invalid={!!errors.valor} aria-describedby="fc-valor-err" value={valorText} onChange={setValorText} />, 'Valor financiado na moeda, como na primeira linha da cotação.')}
            {field('spot', `Cotação de partida (R$/${cur.sym})`, input('spot', spotShown, setSpotText, { placeholder: '5,5147' }), 'Reais por unidade da moeda no desembolso. Converte o valor para reais. Abre com a cotação do Painel, quando disponível.', !spotText && painel ? 'Cotação do Painel; digite para trocar.' : null)}
            <div className="cx-field"><span className="fc-rotulo"><label htmlFor="fc-brl">Valor (R$)</label></span><input id="fc-brl" readOnly value={r ? brl(r.valorBrl) : valor.ok && spot ? brl(valor.value * spot) : '—'} /></div>
            {field('parcelas', 'Parcelas', input('parcelas', parcelasText, setParcelasText, { inputMode: 'numeric' }), 'Número de parcelas de principal, em amortização constante. Os prazos dividem o prazo total em partes iguais.')}
            {field('prazo', 'Prazo (dias corridos)', input('prazo', prazoText, setPrazoText, { inputMode: 'numeric' }), 'Dias corridos do desembolso até o último vencimento.')}
            {field('start', 'Data do desembolso', input('start', start, setStart, { type: 'date', inputMode: undefined }), 'Os vencimentos contam a partir dela.')}
            {field('allIn', `Taxa all-in (${cur.Nome} +)`, <div className="cx-rate">{input('allIn', allInText, setAllInText)}<span className="fc-unidade">% a.a.</span></div>, 'Taxa ao ano sobre a moeda, já com comissões e IR. Juros lineares: saldo × taxa × dias corridos ÷ 360.')}
            {field('externa', 'Comissão externa', <div className="cx-rate">{input('externa', externaText, setExternaText)}<span className="fc-unidade">% a.a.</span></div>, 'Parte da all-in paga ao banco no exterior. Sobre ela incide o IR remetido; a comissão local é o que sobra da all-in. Só muda a divisão das colunas, não o total.')}
            {field('irrf', 'IR sobre juros remetidos', <select id="fc-irrf" value={irrf} onChange={(e) => setIrrf(e.target.value)}>{FI_IR_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>, 'Com gross-up: IR = comissão externa × alíquota ÷ (1 − alíquota). Na planilha de referência, 25% (o IR é um terço da comissão externa).')}
            {field('tac', 'TAC (R$)', <MoneyInput prefix="R$" id="fc-tac" aria-invalid={!!errors.tac} aria-describedby="fc-tac-err" value={tacText} onChange={setTacText} />, 'Tarifa cobrada na entrada. Sai do valor recebido no cálculo da TIR.')}
          </div>

          <h3 className="fc-grupo">Proteção (NDF de compra)</h3>
          <div className="cx-form fc-form">
            {field('fwd', `Taxa futura fechada (R$/${cur.sym})`, <textarea id="fc-fwd" rows={2} aria-invalid={!!errors.fwd} aria-describedby="fc-fwd-err" placeholder="5,6522" value={fwdText} onChange={(e) => setFwdText(e.target.value)} />, 'Taxa da NDF de cada parcela, da cotação da mesa. Uma por linha, na ordem dos vencimentos; se houver menos taxas que parcelas, a última se repete.')}
            {field('ptax', `PTAX-V D-1 do vencimento (R$/${cur.sym})`, <textarea id="fc-ptax" rows={2} aria-invalid={!!errors.ptax} aria-describedby="fc-ptax-err" placeholder={spotShown || '5,5147'} value={ptaxText} onChange={(e) => setPtaxText(e.target.value)} />, 'Cenário de câmbio no vencimento (coluna amarela da planilha). Vazio, usa a cotação de partida. Muda o empréstimo e o ajuste da NDF, mas não o total: o custo fica travado na taxa futura.')}
          </div>
        </article>

        <article className="desk-panel cx-panel fc-resultado" aria-live="polite">
          <header><h3 className="cx-heading"><span>Cotação</span></h3></header>
          {!r && <p className="status" role="status">{pendencia}</p>}
          {r && <>
            <dl className="fc-cards">
              <div className="fc-destaque"><dt>TIR efetiva{ajuda('TIR efetiva', 'Taxa que iguala o valor em reais recebido (menos a TAC) às parcelas em reais travadas na NDF, em dias corridos/365, lida ao mês como taxa de 30 dias.')}</dt><dd><b>{pct(r.tir.mes)} a.m.</b><small>{pct(r.tir.ano)} a.a.</small></dd></div>
              <div><dt>Economia de IOF{ajuda('Economia de IOF', 'IOF que um capital de giro em reais pagaria no mesmo cronograma: 0,38% sobre o valor mais 0,0082% ao dia sobre cada parcela de principal, até 365 dias. O FINIMP não paga esse IOF.')}</dt><dd><b>{brl(r.iofGiro)}</b></dd></div>
              <div><dt>Equivalente em giro{ajuda('Equivalente em giro', 'A taxa ao mês que um capital de giro precisaria ter para custar o mesmo, já considerando o IOF que ele pagaria.')}</dt><dd><b>{r.giro ? `${pct(r.giro.mes)} a.m.` : '—'}</b></dd></div>
            </dl>
            {r.avisoLocal && <p className="fc-aviso" role="alert">{r.avisoLocal}</p>}
            <p className="fc-taxas">All-in {pct(r.allIn, 4)} a.a. = comissão externa {pct(r.externa, 4)} + IR {pct(r.irRate, 4)} + comissão local {pct(r.localRate, 4)}</p>
          </>}
        </article>
      </div>

      {r && <article className="desk-panel cx-panel fc-quadro">
        <header><h3 className="cx-heading"><span>Fluxo da operação</span></h3></header>
        <div className="cx-wrap" role="region" tabIndex={0} aria-label="Fluxo parcela a parcela">
          <table className="cx-matrix fc-tabela">
            <thead><tr>
              <th scope="col">Prazo</th><th scope="col">Vencimento</th><th scope="col">Amortização em {cur.sym}</th><th scope="col">Saldo devedor {cur.sym}</th>
              <th scope="col">Comissão externa ({pct(r.externa, 4)})</th><th scope="col">IR juros remissível ({pct(r.irRate, 4)})</th><th scope="col">Comissão local ({pct(r.localRate, 4)})</th>
              <th scope="col">Juros total ({cur.sym} + {pct(r.allIn, 4)})</th><th scope="col">Parcela {cur.sym}</th><th scope="col">Taxa futura fechada</th><th scope="col">Parcela R$</th>
              <th scope="col" className="fc-ptax">PTAX-V D-1 vencimento</th><th scope="col">Empréstimo (1)</th><th scope="col">Ajuste bruto (2)</th><th scope="col">Ajuste líquido de IR na fonte</th><th scope="col">Total R$ (3)</th><th scope="col">Proteção</th>
            </tr></thead>
            <tbody>
              <tr className="fc-entrada"><td colSpan={10}>Desembolso em {dm(r.start)}{r.tac > 0 ? ` · TAC ${brl(r.tac)}` : ''}</td><td>−{brl(r.valorBrl)}</td><td className="fc-ptax">{dec(r.spot, 4)}</td><td colSpan={5} /></tr>
              {r.rows.map((x) => <tr key={x.n}>
                <td>{x.dias}</td><td>{dm(x.vencimento)}</td><td>{dec(x.amort)}</td><td>{dec(x.saldo)}</td><td>{dec(x.comExt)}</td><td>{dec(x.ir)}</td><td>{dec(x.comLocal)}</td>
                <td>{dec(x.juros)}</td><td>{dec(x.parcela)}</td><td>{dec(x.fwd, 4)}</td><td>{dec(x.parcelaBrl)}</td><td className="fc-ptax">{dec(x.ptax, 4)}</td>
                <td>{dec(x.emprestimo)}</td><td>{dec(x.ajuste)}</td><td title={x.ajuste > 0 ? `IR de ${dec(x.aliqAjuste, 1)}% sobre o ajuste positivo` : undefined}>{dec(x.ajusteLiq)}</td><td>{dec(x.total)}</td><td>NDF · compra</td>
              </tr>)}
              {r.rows.length > 1 && <tr className="fc-total"><th scope="row" colSpan={2}>Total</th><td>{dec(r.valor)}</td><td /><td>{dec(r.totals.comExt)}</td><td>{dec(r.totals.ir)}</td><td>{dec(r.totals.comLocal)}</td><td>{dec(r.totals.juros)}</td><td>{dec(r.totals.parcela)}</td><td /><td>{dec(r.totals.parcelaBrl)}</td><td className="fc-ptax" /><td>{dec(r.totals.emprestimo)}</td><td>{dec(r.totals.ajuste)}</td><td>{dec(r.totals.ajusteLiq)}</td><td>{dec(r.totals.total)}</td><td /></tr>}
            </tbody>
          </table>
        </div>
        <ul className="fc-notas">
          <li>A parcela em reais usa a taxa futura de cada NDF. O fluxo em reais desconsidera os efeitos fiscais de um possível ajuste positivo na NDF.</li>
          <li>Pode haver descasamento entre o câmbio à vista que liquida o empréstimo e a PTAX que calcula o ajuste da proteção.</li>
          <li>Ajuste positivo da NDF paga IR na fonte pela tabela regressiva (22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima). O total (3) usa o ajuste bruto.</li>
        </ul>
      </article>}
    </section>
  )
}
