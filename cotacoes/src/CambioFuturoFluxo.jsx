import { useState } from 'react'
import CalcBack from './CalcBack.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { marketDate } from './marketReturns.js'
import { isBusinessDay } from './holidays.js'
import { formatMoneyText, parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './cdiDolar.js'
import { lerTabelaMesa } from './cambioFuturoColar.js'
import { MAX_PARCELAS_FLUXO, MAX_PRAZO_DIAS, amortizacoesIguais, calcularFluxoCambio, irRemissivelPadrao, vencimentoPorPrazo } from './cambioFuturoFluxo.js'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import './CambioFuturoJornada.css'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const taxa4 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
const taxaTexto = n => taxa4.format(n)
// Só agrupa o milhar e completa 2 casas: nunca arredonda o que foi digitado.
const decimalLivre = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 20 })
const fmt = (n, format = dec) => Number.isFinite(n) ? format.format(n) : '—'
const pct = n => Number.isFinite(n) ? dec.format(n) + '%' : '—'
const dataBrasil = data => data ? data.split('-').reverse().join('/') : '—'
const linhaVazia = () => ({ prazo: '', amortizacao: '', futuro: '' })
const dinheiro = texto => {
  if (!texto.trim()) return null
  const v = parseMoneyInput(texto)
  return v.ok ? v.value : null
}
const numero = texto => {
  if (!texto.trim()) return null
  const v = parseDecimal(texto)
  return Number.isFinite(v) ? v : null
}
const prazoDias = texto => /^\d{1,4}$/.test(texto.trim()) && Number(texto) >= 1 && Number(texto) <= MAX_PRAZO_DIAS ? Number(texto.trim()) : null
// Ao sair do campo, o número fica no padrão brasileiro (ponto no milhar, vírgula nos decimais); texto inválido fica como está.
const formatarDecimal = texto => {
  const v = numero(texto)
  return v == null ? texto : decimalLivre.format(v)
}

function Campo({ id, label, value, change, formatar, type = 'text', mode = 'decimal', placeholder, error, hint }) {
  return <div className="cx-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} inputMode={type === 'text' ? mode : undefined} autoComplete="off"
      value={value} onChange={e => change(e.target.value)} placeholder={placeholder}
      onBlur={formatar ? e => { const f = formatar(e.target.value); if (f !== e.target.value) change(f) } : undefined}
      aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-erro' : hint ? id + '-dica' : undefined} />
    {error && <small className="cf-j-error" id={id + '-erro'}>{error}</small>}
    {hint && !error && <small className="cx-hint" id={id + '-dica'}>{hint}</small>}
  </div>
}

export default function CambioFuturoFluxo({ onBack }) {
  const [op, setOp] = useState(() => ({ inicio: marketDate(Date.now()), valor: '', allIn: '', tac: '0', spot: '', externa: '', ir: '', local: '' }))
  const [quantidade, setQuantidade] = useState(1)
  const [linhas, setLinhas] = useState(() => Array.from({ length: MAX_PARCELAS_FLUXO }, linhaVazia))
  const mudar = chave => valor => setOp(old => ({ ...old, [chave]: valor }))
  const [colado, setColado] = useState({ texto: '', lido: null, allIn: null })
  // Tabela da mesa colada do Excel: preenche início, valor, taxas, parcelas, prazos e amortizações. Tudo segue editável.
  const colar = texto => {
    const lido = texto.trim() ? lerTabelaMesa(texto) : null
    if (!lido?.ok) { setColado(old => ({ ...old, texto, lido })); return }
    const { externa, ir, local } = lido.taxas
    // O all-in digitado fica; o que veio de uma colagem anterior (e não foi mexido) é trocado pela nova soma.
    const allInColado = taxaTexto(externa + ir + local)
    const manterAllIn = op.allIn.trim() && op.allIn !== colado.allIn
    setColado({ texto, lido, allIn: manterAllIn ? null : allInColado })
    setOp(old => ({ ...old, inicio: lido.inicio, valor: dec.format(lido.valorUsd), externa: taxaTexto(externa), local: taxaTexto(local),
      ir: ir === irRemissivelPadrao(externa) ? '' : taxaTexto(ir), // igual a 1/3 da externa: fica no automático
      allIn: manterAllIn ? op.allIn : allInColado }))
    setQuantidade(lido.parcelas.length)
    // O câmbio futuro só fica na parcela de mesmo prazo; linhas além das coladas são limpas.
    setLinhas(old => old.map((l, i) => {
      const p = lido.parcelas[i]
      if (!p) return linhaVazia()
      return { prazo: String(p.prazo), amortizacao: dec.format(p.amortizacao), futuro: l.prazo.trim() === String(p.prazo) ? l.futuro : '' }
    }))
  }
  const { lido } = colado
  const lidoOk = lido?.ok ? lido : null
  const erroColar = lido && !lido.ok ? lido.erro : null
  const mudarLinha = (i, chave) => valor => setLinhas(old => old.map((l, j) => j === i ? { ...l, [chave]: valor } : l))

  const irSugerido = irRemissivelPadrao(numero(op.externa))
  const irEditado = op.ir.trim() !== ''
  const irTexto = irEditado ? op.ir : irSugerido == null ? '' : taxa4.format(irSugerido)
  const valorUsd = dinheiro(op.valor)
  const tacBrl = op.tac.trim() ? dinheiro(op.tac) ?? NaN : 0
  const padrao = amortizacoesIguais(valorUsd, quantidade)
  const ativas = linhas.slice(0, quantidade)
  const r = calcularFluxoCambio({
    inicio: op.inicio, valorUsd, tacBrl, spot: numero(op.spot),
    taxas: { externa: numero(op.externa), ir: numero(irTexto), local: numero(op.local) },
    parcelas: ativas.map((l, i) => ({ prazo: prazoDias(l.prazo), amortizacao: l.amortizacao.trim() ? dinheiro(l.amortizacao) : padrao[i], futuro: numero(l.futuro) })),
  })
  const allIn = numero(op.allIn)
  const somaDifere = Number.isFinite(allIn) && Number.isFinite(r.somaTaxas) && Math.abs(allIn - r.somaTaxas) >= 0.01
  const bullet = quantidade === 1
  const colunas = ['Prazo (dias)', 'Principal USD', 'Vencimento', 'Juros total USD', 'Câmbio futuro (R$/USD)', 'Fluxo em R$']

  return <section className="cx cf cf-pattern bw calc-standard calc-workspace cf-j cf-f" aria-labelledby="cf-f-title">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-f-title" className="cx-title">Câmbio futuro</h2>
        <CalculatorHelp title="O que é câmbio futuro">
          <p>Câmbio futuro é a taxa de câmbio (R$ por US$) combinada hoje para uma data futura. Com ela, a empresa sabe agora quanto vai pagar ou receber em reais em cada vencimento, sem depender do dólar daquele dia.</p>
          <p>Não é previsão do dólar. Ele sai do dólar à vista (spot) corrigido pela diferença entre os juros em reais e os juros em dólar até o vencimento. Com juros em reais mais altos, o câmbio futuro fica acima do spot; essa diferença são os pontos (forward points).</p>
          <p>Conta de referência do mercado: câmbio futuro ≈ spot × (1 + juro pré em R$)^(dias úteis ÷ 252) ÷ (1 + cupom cambial × dias corridos ÷ 360). O cupom cambial é o juro em dólar no Brasil. Na operação, quem informa o câmbio futuro é a mesa.</p>
          <p>A trava costuma ser feita com um termo de moeda sem entrega (NDF): no vencimento, as partes acertam só a diferença, em reais, entre a taxa travada e a PTAX de referência.</p>
          <p>Nesta tela, cada parcela em US$ (principal + juros) é convertida pelo câmbio futuro do seu vencimento. Assim saem o fluxo em reais e a TIR em base 252, que é o custo da operação em reais.</p>
          <figure className="cf-video">
            <iframe src="https://www.youtube-nocookie.com/embed/xJr3uf1CXSo" title="Vídeo: Dólar futuro não é aposta, a matemática da taxa forward" loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            <figcaption>Vídeo da Damke Consultoria e Treinamento sobre como se calcula o dólar futuro e a taxa forward para o hedge da empresa. Para ver em tela cheia ou no YouTube, use os botões do próprio vídeo.</figcaption>
          </figure>
        </CalculatorHelp>
      </div>
    </div>

    <article className="desk-panel cx-panel cf-input cf-j-azul" aria-labelledby="cf-f-op">
      <header className="cx-heading"><h3 id="cf-f-op">1. Dados da operação</h3></header>
      <div className="cx-field cf-f-colar">
        <label htmlFor="cf-f-colar">Colar a tabela da mesa (opcional): do Prazo até a Parcela USD, ex.: A10 até H13</label>
        <textarea id="cf-f-colar" rows={3} value={colado.texto} onChange={e => colar(e.target.value)} spellCheck={false}
          placeholder={'91\t22/02/2027\t25.000,00\t100.000,00\t1.553,77\t517,92\t497,31\t27.569,01'}
          aria-describedby="cf-f-colar-status" aria-invalid={erroColar ? true : undefined} />
        <div id="cf-f-colar-status" role="status">
          {erroColar && <small className="cf-j-error">{erroColar}</small>}
          {lidoOk && <small className="cx-hint">Tabela colada: {lidoOk.parcelas.length} {lidoOk.parcelas.length === 1 ? 'parcela' : 'parcelas'}, início {dataBrasil(lidoOk.inicio)}, comissão externa {taxaTexto(lidoOk.taxas.externa)}%, IR {taxaTexto(lidoOk.taxas.ir)}% e local {taxaTexto(lidoOk.taxas.local)}% a.a.{r.falta ? ' Falta o spot e o câmbio futuro de cada parcela.' : ''}</small>}
          {lidoOk?.avisos.length > 0 && <ul className="cf-f-avisos">{lidoOk.avisos.map(a => <li key={a}>{a}</li>)}</ul>}
        </div>
      </div>
      <div className="cf-j-grid">
        <Campo id="cf-f-valor" label="Valor em USD" value={op.valor} change={mudar('valor')} formatar={formatMoneyText} placeholder="ex.: 100.000,00"
          error={op.valor && !(valorUsd > 0) ? 'Informe um valor maior que zero.' : null} />
        <div className="cx-field"><label htmlFor="cf-f-parcelas">Parcelas</label>
          <select id="cf-f-parcelas" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))}>
            {Array.from({ length: MAX_PARCELAS_FLUXO }, (_, i) => <option key={i} value={i + 1}>{i + 1 === 1 ? '1 (bullet)' : i + 1}</option>)}
          </select></div>
        <Campo id="cf-f-allin" label="Taxa all-in da empresa (% a.a.)" value={op.allIn} change={mudar('allIn')} formatar={formatarDecimal} placeholder="ex.: 11,20" />
        <Campo id="cf-f-tac" label="TAC (R$)" value={op.tac} change={mudar('tac')} formatar={formatMoneyText} placeholder="0"
          error={Number.isNaN(tacBrl) ? 'Informe a TAC em reais, ex.: 1.500,00.' : null} />
      </div>
      <div className="cf-j-grid cf-f-taxas">
        <Campo id="cf-f-externa" label="Comissão externa (% a.a.)" value={op.externa} change={mudar('externa')} formatar={formatarDecimal} placeholder="ex.: 6,6581" />
        <Campo id="cf-f-ir" label="IR juros remissível (% a.a.)" value={irTexto} change={mudar('ir')} formatar={irEditado ? formatarDecimal : undefined} placeholder="1/3 da comissão externa"
          hint={irEditado ? 'Valor seu. Apague para voltar a 1/3 da externa.' : '1/3 da comissão externa; pode editar.'} />
        <Campo id="cf-f-local" label="Comissão local (% a.a.)" value={op.local} change={mudar('local')} formatar={formatarDecimal} placeholder="ex.: 2,3204" />
      </div>
      <p className="cf-notice" id="cf-f-soma">Soma das três taxas: {pct(r.somaTaxas)} a.a.{Number.isFinite(allIn) ? ` · all-in informado: ${pct(allIn)} a.a.` : ''}
        {somaDifere && <strong> A soma não bate com o all-in; confira as taxas.</strong>}</p>
    </article>

    <article className="desk-panel cx-panel cf-input cf-j-amarelo" aria-labelledby="cf-f-mesa">
      <header className="cx-heading"><h3 id="cf-f-mesa">2. Cotação da mesa</h3></header>
      <p className="cf-notice">O spot vale para a operação toda. O câmbio futuro de cada vencimento vai na tabela abaixo.</p>
      <div className="cf-j-grid"><Campo id="cf-f-spot" label="Spot (R$/USD)" value={op.spot} change={mudar('spot')} formatar={formatarDecimal} placeholder="ex.: 5,916"
        error={op.spot && !(numero(op.spot) > 0) ? 'Cotação inválida.' : null} /></div>
      <dl className="cf-j-grid cf-j-totais cf-f-mesa">
        <div><dt>Valor em R$</dt><dd id="cf-f-valor-brl">{fmt(r.valorBrl, brl)}</dd></div>
        <div><dt>Valor recebido (menos a TAC)</dt><dd id="cf-f-liquido">{fmt(r.liquidoBrl, brl)}</dd></div>
      </dl>
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-f-tabela">
      <header className="cx-heading"><h3 id="cf-f-tabela">3. Parcelas e fluxo em R$</h3>
        <CalculatorHelp title="Como o cálculo é feito">
          <p>A data de início é a de hoje ou, com a tabela colada, o 1º vencimento menos o 1º prazo; ela aparece na linha Início. Vencimento = início + prazo em dias corridos. O principal vem em partes iguais e pode ser mudado; a soma precisa fechar o valor em USD.</p>
          <p>Juros total = soma das três comissões (externa, IR juros remissível e local), cada uma = saldo devedor × taxa ao ano × dias do período ÷ 360. O IR vem como 1/3 da comissão externa e pode ser editado.</p>
          <p>Tabela colada: cada taxa sai das linhas (soma da coluna × 360 ÷ soma de saldo × dias do período), com 4 casas. A calculadora refaz a tabela com elas e avisa o que não bater com o colado.</p>
          <p>Fluxo em R$: no início entra o valor em R$ menos a TAC; em cada vencimento sai (principal + juros total) em USD, em centavos, × câmbio futuro da parcela.</p>
          <p>TIR ao ano em base 252: dias úteis (feriados nacionais) entre o início e cada vencimento, divididos por 252. Vencimento em dia não útil conta até o último dia útil antes dele. Não substitui o CET contratual.</p>
        </CalculatorHelp>
      </header>
      <p className="cf-notice">Informe o prazo e o câmbio futuro de cada parcela; o resto é calculado.</p>
      <div className="cf-j-scroll" tabIndex={0} role="region" aria-label="Parcelas e fluxo em R$">
        <table className="cf-j-matriz cf-f-matriz">
          <thead><tr>{colunas.map(t => <th scope="col" key={t} className={t === 'Fluxo em R$' ? 'cf-f-fc' : undefined}>{t}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Início</th><td /><td>{dataBrasil(op.inicio)}</td><td colSpan={2} /><td className="cf-f-fc" id="cf-f-fc-0">{fmt(r.liquidoBrl == null ? null : -r.liquidoBrl, brl)}</td></tr>
            {ativas.map((l, i) => {
              const calc = r.linhas[i] ?? {}
              const venc = vencimentoPorPrazo(op.inicio, prazoDias(l.prazo))
              const nome = bullet ? 'bullet' : `parcela ${i + 1}`
              return <tr key={i}>
                <td><Campo id={`cf-f-${i + 1}-prazo`} label={`Prazo em dias · ${nome}`} mode="numeric" value={l.prazo} change={mudarLinha(i, 'prazo')} placeholder="ex.: 361"
                  error={l.prazo && prazoDias(l.prazo) == null ? `De 1 a ${MAX_PRAZO_DIAS} dias.` : null} /></td>
                <td><Campo id={`cf-f-${i + 1}-amort`} label={`Principal em USD · ${nome}`} value={l.amortizacao} change={mudarLinha(i, 'amortizacao')} formatar={formatMoneyText}
                  placeholder={fmt(padrao[i])} error={l.amortizacao && dinheiro(l.amortizacao) == null ? 'Valor inválido.' : null} /></td>
                <td>{dataBrasil(venc)}{venc && !isBusinessDay(venc, 'BR') && <small className="cf-j-error"><br />Dia não útil</small>}</td>
                <td id={`cf-f-${i + 1}-juros`}>{fmt(calc.juros)}</td>
                <td><Campo id={`cf-f-${i + 1}-futuro`} label={`Câmbio futuro · ${nome}`} value={l.futuro} change={mudarLinha(i, 'futuro')} formatar={formatarDecimal} placeholder="ex.: 6,5027"
                  error={l.futuro && !(numero(l.futuro) > 0) ? 'Cotação inválida.' : null} /></td>
                <td className="cf-f-fc" id={`cf-f-${i + 1}-fc`}>{fmt(calc.fcBrl, brl)}</td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
      {(r.erro || r.falta) && <p className="cf-notice" role="status">{r.erro || r.falta}</p>}

      <dl className="cf-j-grid cf-j-totais">
        <div><dt>Total em USD</dt><dd id="cf-f-total-usd">{fmt(r.totalUsd)}</dd></div>
        <div><dt>Total pago em R$</dt><dd id="cf-f-total-brl">{fmt(r.totalBrl, brl)}</dd></div>
        <div><dt>TIR ao ano (base 252)</dt><dd id="cf-f-tir">{pct(r.tirPct)}</dd></div>
        {bullet && <div><dt>Custo no período (sem anualizar)</dt><dd id="cf-f-periodo">{pct(r.periodoPct)}</dd></div>}
      </dl>
      <p className="cf-notice">TIR ao ano pelas datas do fluxo: dias úteis ÷ 252. Não substitui o CET contratual.</p>
    </article>
  </section>
}
