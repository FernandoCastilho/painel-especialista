import { useState } from 'react'
import CalcBack from './CalcBack.jsx'
import Flag from './Flag.jsx'
import ReferenciaMesa from './ReferenciaMesa.jsx'
import { marketDate } from './marketReturns.js'
import { spotDayPlan } from './cambioFuturoSpot.js'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './cdiDolar.js'
import { alterarVencimento, calcularCotacaoMesa, cotacaoVazia, quantidadeCotacao } from './cambioFuturoJornada.js'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import './CambioFuturoJornada.css'

const moedas = { USD: 'Dólar', EUR: 'Euro', CNH: 'Yuan offshore' }
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const taxa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
const fmt = (n, format = dec) => Number.isFinite(n) ? format.format(n) : '—'
const pct = n => Number.isFinite(n) ? fmt(n) + '%' : '—'
const dataBrasil = data => data ? data.split('-').reverse().join('/') : '—'
const linhaVazia = id => ({ id, vencimento: '', principal: '', juros: '', ...cotacaoVazia() })
const dinheiro = texto => {
  if (!texto.trim()) return null
  const v = parseMoneyInput(texto)
  return v.ok ? v.value : null
}
const cotacao = texto => {
  if (!texto.trim()) return null
  const v = parseDecimal(texto)
  return Number.isFinite(v) && v > 0 ? v : null
}
const bandeira = code => <span className="cf-com-bandeira"><Flag code={code} width={20} height={14} />{moedas[code]} ({code})</span>

function CampoCotacao({ id, label, value, change, type = 'text', mode = 'decimal', placeholder, error }) {
  return <div className="cx-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} inputMode={type === 'text' ? mode : undefined} autoComplete="off"
      value={value} onChange={e => change(e.target.value)} placeholder={placeholder}
      aria-invalid={error ? true : undefined} aria-describedby={error ? id + '-erro' : undefined} />
    {error && <small className="cf-j-error" id={id + '-erro'}>{error}</small>}
  </div>
}

export default function CambioFuturoJornada({ onBack, quotes }) {
  const [inicio, setInicio] = useState(() => marketDate(Date.now()))
  const [modalidade, setModalidade] = useState('bullet')
  const [quantidade, setQuantidade] = useState(1)
  const [moeda, setMoeda] = useState('EUR')
  const [linhas, setLinhas] = useState(() => Array.from({ length: 5 }, (_, i) => linhaVazia(i + 1)))
  const [aviso, setAviso] = useState('')
  const bullet = modalidade === 'bullet'
  const plan = spotDayPlan(Date.now())
  const ativas = linhas.slice(0, quantidadeCotacao(modalidade, quantidade))
  const itens = ativas.map(l => ({
    ...l, principal: dinheiro(l.principal), juros: dinheiro(l.juros),
    spotUsd: cotacao(l.spotUsd), futuroUsd: cotacao(l.futuroUsd),
    spotAlvo: cotacao(l.spotAlvo), futuroAlvo: cotacao(l.futuroAlvo),
  }))
  const r = calcularCotacaoMesa(inicio, itens)
  const nome = id => bullet ? 'Liquidação bullet' : 'Parcela ' + String(id).padStart(2, '0')
  const tinhaCotacao = l => Object.keys(cotacaoVazia()).some(k => l[k])
  const limpar = (atualizar, mensagem) => {
    if (linhas.some(tinhaCotacao)) setAviso(mensagem)
    atualizar()
    setLinhas(old => old.map(l => ({ ...l, ...cotacaoVazia() })))
  }
  const mudar = (id, chave, valor, entrada = false) => {
    const l = linhas.find(x => x.id === id)
    if (l[chave] === valor) return
    setAviso(entrada && tinhaCotacao(l) ? 'Os dados mudaram. Informe novamente as taxas desse vencimento.' : '')
    setLinhas(old => old.map(x => x.id !== id ? x : chave === 'vencimento' ? alterarVencimento(x, valor) :
      { ...x, ...(entrada ? cotacaoVazia() : {}), [chave]: valor }))
  }

  return <section className="cx cf cf-pattern bw calc-standard calc-workspace cf-j" aria-labelledby="cf-j-title">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-j-title" className="cx-title">Câmbio futuro</h2></div>
    </div>
    <p className="cf-notice cf-j-links"><a href="#calculadora/cambio-futuro/cenarios">Comparar cenários com e sem trava</a><a href="#calculadora/cambio-futuro/tir-usd">Simular TIR pela taxa all-in</a></p>

    <article className="desk-panel cx-panel cf-input cf-j-azul" aria-labelledby="cf-j-op">
      <header className="cx-heading"><h3 id="cf-j-op">1. Dados da operação</h3></header>
      <p className="cf-notice">Preencha os dados para pedir a cotação. Informe os juros em USD de cada vencimento (digite 0 se não houver).</p>
      <div className="cf-j-grid">
        <div className="cx-field"><label htmlFor="cf-j-modalidade">Forma de pagamento</label>
          <select id="cf-j-modalidade" value={modalidade} onChange={e => limpar(() => setModalidade(e.target.value), 'A forma de pagamento mudou. Informe novamente as taxas da mesa.')}>
            <option value="bullet">Bullet</option><option value="parcelado">Parcelado</option>
          </select></div>
        {!bullet && <div className="cx-field"><label htmlFor="cf-j-quantidade">Quantidade de parcelas</label>
          <select id="cf-j-quantidade" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
          </select></div>}
        <CampoCotacao id="cf-j-inicio" label="Data-base do fluxo" type="date" value={inicio}
          change={v => limpar(() => setInicio(v), 'A data-base mudou. Informe novamente as taxas da mesa.')} />
        <div className="cx-field"><label htmlFor="cf-j-moeda">Moeda para cotar</label>
          <select id="cf-j-moeda" value={moeda} onChange={e => {
            setMoeda(e.target.value)
            if (linhas.some(l => l.spotAlvo || l.futuroAlvo || l.produtoAlvo)) setAviso('A moeda mudou. Informe as taxas da nova moeda; as do dólar foram mantidas.')
            setLinhas(old => old.map(l => ({ ...l, spotAlvo: '', futuroAlvo: '', produtoAlvo: '' })))
          }}>{['EUR', 'CNH'].map(code => <option key={code} value={code}>{moedas[code]} ({code})</option>)}</select>
        </div>
      </div>
      {bullet && <p className="cf-notice">Bullet: nesta cotação, principal e juros são liquidados no vencimento final. A opção Parcelado tem sua própria quantidade, inclusive 1 parcela.</p>}
      {ativas.map((l, i) => <fieldset key={l.id} className="cf-j-box">
        <legend>{nome(l.id)}</legend>
        <div className="cf-j-grid">
          <CampoCotacao id={`cf-j-${l.id}-venc`} label={bullet ? 'Vencimento final' : `Vencimento da parcela ${l.id}`} type="date"
            value={l.vencimento} change={v => mudar(l.id, 'vencimento', v, true)}
            error={inicio && l.vencimento && l.vencimento <= inicio ? 'O vencimento deve ser posterior à data-base.' : null} />
          <CampoCotacao id={`cf-j-${l.id}-principal`} label="Principal (USD)" value={l.principal} change={v => mudar(l.id, 'principal', v, true)}
            placeholder="ex.: 100.000,00" error={l.principal && !(itens[i].principal > 0) ? 'Informe um principal maior que zero.' : null} />
          <CampoCotacao id={`cf-j-${l.id}-juros`} label="Juros (USD)" value={l.juros} change={v => mudar(l.id, 'juros', v, true)}
            placeholder="ex.: 11.229,01" error={l.juros && !(itens[i].juros >= 0 && itens[i].juros !== null) ? 'Informe juros válidos ou zero.' : null} />
          <dl className="cf-j-sum"><div><dt>Total com juros (USD)</dt><dd>{fmt(r.linhas[i].comJuros)}</dd></div></dl>
        </div>
      </fieldset>)}
    </article>

    <article className="desk-panel cx-panel cf-input cf-j-amarelo" aria-labelledby="cf-j-mesa">
      <header className="cx-heading"><h3 id="cf-j-mesa">2. Retorno da mesa</h3></header>
      <p className="cf-notice">Transcreva o produto, o spot e o futuro recebidos da mesa para cada moeda e vencimento. A referência do Painel é só para consulta.</p>
      <p role="status" className="cf-j-notice">{aviso}</p>
      {ativas.map(l => <fieldset key={l.id} className="cf-j-box">
        <legend>{nome(l.id)} · {dataBrasil(l.vencimento)}</legend>
        {[['USD', 'Usd'], [moeda, 'Alvo']].map(([code, sufixo]) => <div className="cf-j-mesa-row" key={code}>
          <h4>{bandeira(code)}</h4>
          <CampoCotacao id={`cf-j-${l.id}-produto-${code}`} label="Produto da mesa" mode="text"
            value={l['produto' + sufixo]} placeholder="ex.: Venda s/caixa" change={v => mudar(l.id, 'produto' + sufixo, v)} />
          {['spot', 'futuro'].map(k => {
            const field = k + sufixo
            return <CampoCotacao key={field} id={`cf-j-${l.id}-${k}-${code}`}
              label={`${k === 'spot' ? 'Spot' : 'Futuro'} (R$/${code})`} value={l[field]}
              change={v => mudar(l.id, field, v)} error={l[field] && cotacao(l[field]) == null ? 'Informe uma cotação maior que zero.' : null} />
          })}
          {l.id === 1 && <small className="cf-observacao"><ReferenciaMesa code={code} quote={quotes?.[code]} offer={l['spot' + sufixo]} plan={plan} /></small>}
        </div>)}
      </fieldset>)}
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-j-resultado">
      <header className="cx-heading"><h3 id="cf-j-resultado">3. Resultado · {bullet ? 'Bullet' : 'Parcelado'}</h3></header>
      <p className="cf-notice">Resultado calculado automaticamente. O cruzamento usa os spots da mesa (USD/BRL ÷ {moeda}/BRL). Sem uma conversão contratada, o resultado em {moeda} é indicativo.</p>
      <dl className="cf-j-grid cf-j-totais">
        <div><dt>Entrada inicial estimada</dt><dd>{fmt(r.desembolso, brl)}</dd></div>
        <div><dt>Total a pagar · USD direto</dt><dd id="cf-j-total-usd">{fmt(r.usd.totalComTravaBrl, brl)}</dd></div>
        <div><dt>Total indicativo · via {moeda}</dt><dd id="cf-j-total-alvo">{fmt(r.alvo.totalComTravaBrl, brl)}</dd></div>
        <div><dt>TIR anual · USD direto</dt><dd>{pct(r.usd.tirComTravaPct)}</dd></div>
        <div><dt>TIR anual indicativa · via {moeda}</dt><dd>{pct(r.alvo.tirComTravaPct)}</dd></div>
      </dl>
      <p className="cf-notice">A TIR anual usa as datas dos pagamentos (dias corridos/365). Sem tarifas ou tributos além dos valores informados, não representa o CET contratual.</p>
      {(!r.usd.ok || !r.alvo.ok) && <p className="cf-notice" role="status">{r.usd.erro || r.alvo.erro}</p>}
      {(r.usd.totalComTravaBrl == null || r.alvo.totalComTravaBrl == null) && <p className="cf-notice">Cada total aparece quando a respectiva cotação estiver completa para todos os vencimentos.</p>}
      <div className="cf-j-results">
        {r.linhas.map((l, i) => <section key={l.id} className="cf-j-box" aria-labelledby={`cf-j-out-${l.id}`}>
          <h4 id={`cf-j-out-${l.id}`}>{nome(l.id)} · {dataBrasil(l.vencimento)}</h4>
          <dl className="cf-j-grid">
            <div><dt>Principal (USD)</dt><dd>{fmt(l.principal)}</dd></div>
            <div><dt>Juros (USD)</dt><dd>{fmt(l.juros)}</dd></div>
            <div><dt>Total (USD)</dt><dd>{fmt(l.comJuros)}</dd></div>
            <div><dt>Spot / Futuro (R$/USD)</dt><dd>{fmt(l.spotUsd, taxa)} / {fmt(l.futuroUsd, taxa)}</dd></div>
            <div><dt>Principal convertido no spot</dt><dd>{fmt(l.valorInicial, brl)}</dd></div>
            <div><dt>Pagamento direto em reais</dt><dd>{fmt(r.usd.parcelas[i]?.comTravaBrl, brl)}</dd></div>
            <div><dt>Equivalente indicativo ({moeda})</dt><dd>{fmt(l.equivalente)}</dd></div>
            <div><dt>Spot / Futuro (R$/{moeda})</dt><dd>{fmt(l.spotAlvo, taxa)} / {fmt(l.futuroAlvo, taxa)}</dd></div>
            <div><dt>Pagamento indicativo em reais</dt><dd>{fmt(r.alvo.parcelas[i]?.comTravaBrl, brl)}</dd></div>
          </dl>
        </section>)}
      </div>
    </article>
  </section>
}
