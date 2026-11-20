import { useState } from 'react'
import './CalculatorStandard.css'
import './CambioFuturo.css'
import CalculatorHelp from './CalculatorHelp.jsx'
import CalcBack from './CalcBack.jsx'
import Flag from './Flag.jsx'
import { parseDecimal } from './cdiDolar.js'
import { parseMoneyInput } from './moneyInput.js'
import { marketDate } from './marketReturns.js'
import { fromInput, useCentralDaily, useIntraday } from './useHistory.js'
import { explicacaoFaixa, explicacaoPonto, mesaDailyEur, mesaIntradayCnh, mesaSpotRange, spotDayPlan } from './cambioFuturoSpot.js'
import { simularParcelaCambial } from './cambioFuturoParcela.js'

export function CambioFuturoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 9.5h18M8 3v4M16 3v4" />
      <path d="M8 14.5h7M13 12.5l2 2-2 2" />
    </svg>
  )
}

const dataBr = iso => iso ? iso.split('-').reverse().join('/') : '—'
const decimalBr = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const spotBr = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const horaBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const MOEDAS_MESA = [{ id: 'CNH', nome: 'Yuan (CNH)' }, { id: 'EUR', nome: 'Euro (EUR)' }]
const mesaVazia = () => Object.fromEntries(MOEDAS_MESA.map(({ id }) => [id, { cotacao: '', futuro: '' }]))
const comBandeira = (id, nome) => <span className="cf-com-bandeira"><Flag code={id} width={20} height={14} />{nome}</span>

function ReferenciaIndisponivel({ loading }) {
  return loading ? 'Consultando a referência à vista…' : 'Referência à vista indisponível.'
}

function EurDiario({ plan, price }) {
  const history = useCentralDaily()
  const ref = mesaDailyEur(history.data, plan)
  return ref ? <>Referência diária indicativa (compra): R$ {spotBr(ref.value)}/EUR · {dataBr(ref.date)} (data de Brasília) · AwesomeAPI. {explicacaoPonto(price, ref)}</>
    : <ReferenciaIndisponivel loading={history.status === 'loading'} />
}

function CnhIntradiario({ plan, price }) {
  const history = useIntraday('CNH', fromInput(plan.previous))
  const ref = mesaIntradayCnh(history.data, plan)
  return ref ? <>Yuan offshore à vista, último ponto indicativo de compra: R$ {spotBr(ref.value)}/CNH · {dataBr(ref.date)} às {horaBr.format(ref.t)} (hora de Brasília) · AwesomeAPI (cruzamento). {explicacaoPonto(price, ref)}</>
    : <ReferenciaIndisponivel loading={history.status === 'loading'} />
}

export function ReferenciaMesa({ code, quote, offer = '', plan }) {
  const ref = mesaSpotRange(code, quote, plan)
  const price = parseDecimal(offer)
  if (ref) {
    const confronto = explicacaoFaixa(price, ref)
    return <>{ref.today ? 'À vista hoje' : 'Última faixa à vista'} (compra–venda): R$ {spotBr(ref.bid)} a {spotBr(ref.ask)}/{code} · {dataBr(ref.date)} às {horaBr.format(ref.time)} (hora de Brasília) · {code === 'CNH' ? 'AwesomeAPI (CNH offshore, cruzamento)' : 'AwesomeAPI'}.{confronto && <> {confronto}</>}</>
  }
  if (plan.open || !plan.previous) return <ReferenciaIndisponivel />
  return code === 'EUR' ? <EurDiario plan={plan} price={price} /> : <CnhIntradiario plan={plan} price={price} />
}

function Campo({ id, label, value, onChange, type = 'text', placeholder, erro, observacao }) {
  return <div className="cx-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type={type} inputMode={type === 'text' ? 'decimal' : undefined}
      autoComplete="off" value={value} placeholder={placeholder} aria-invalid={erro ? true : undefined}
      aria-describedby={[erro && `${id}-erro`, observacao && `${id}-obs`].filter(Boolean).join(' ') || undefined} onChange={e => onChange(e.target.value)} />
    {observacao && <small id={`${id}-obs`} className="cf-observacao">{observacao}</small>}
    {erro && <small id={`${id}-erro`} className="cf-resultado-status">{erro}</small>}
  </div>
}

export default function CambioFuturo({ onBack, quotes }) {
  const [operacao, setOperacao] = useState({ valor: '', vencimento: '', cotacao: '', taxa: '' })
  const [mesa, setMesa] = useState(mesaVazia)
  const [diaCotacao, setDiaCotacao] = useState(() => marketDate(Date.now()))
  const now = Date.now()
  const start = marketDate(now)
  const spotPlan = spotDayPlan(now)
  const mudouDia = diaCotacao !== start
  const mesaAtual = mudouDia ? mesaVazia() : mesa
  const spotUsd = mudouDia ? '' : operacao.cotacao
  const mudarOp = (key, value) => {
    const hoje = marketDate(Date.now())
    if (key === 'cotacao' && hoje !== diaCotacao) {
      setDiaCotacao(hoje)
      setMesa(mesaVazia())
    } else if (key === 'vencimento' && value !== operacao.vencimento) {
      setMesa(old => Object.fromEntries(Object.entries(old).map(([id, cot]) => [id, { ...cot, futuro: '' }])))
    }
    setOperacao(old => ({ ...old, [key]: value }))
  }
  const mudarMesa = (id, key, value) => {
    const hoje = marketDate(Date.now())
    const mudou = hoje !== diaCotacao
    if (mudou) {
      setDiaCotacao(hoje)
      setOperacao(old => ({ ...old, cotacao: '' }))
    }
    setMesa(old => {
      const base = mudou ? mesaVazia() : old
      return { ...base, [id]: { ...base[id], [key]: value } }
    })
  }
  const parcelaUsd = parseMoneyInput(operacao.valor)
  const inputComplete = [operacao.valor, operacao.vencimento, spotUsd, operacao.taxa].every(v => v.trim())
  const futuroInvalido = texto => texto.trim() && !(Number.isFinite(parseDecimal(texto)) && parseDecimal(texto) > 0)
  const resultados = MOEDAS_MESA.map(({ id, nome }) => {
    const { cotacao, futuro } = mesaAtual[id]
    const resultado = !inputComplete || !cotacao.trim() ? null : !parcelaUsd.ok
      ? { ok: false, error: parcelaUsd.error }
      : simularParcelaCambial({ parcelaUsd: parcelaUsd.value, spotUsd: parseDecimal(spotUsd), taxaPct: parseDecimal(operacao.taxa),
          start, vencimento: operacao.vencimento, spotMoeda: parseDecimal(cotacao), futuroMoeda: futuroInvalido(futuro) || !futuro.trim() ? undefined : parseDecimal(futuro) })
    return { id, nome, resultado }
  })
  return <section className="cx cf cf-pattern bw calc-standard calc-workspace" aria-labelledby="cf-heading">
    <div className="bw-heading calc-workspace-heading">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="cf-heading" className="cx-title"><span>Câmbio futuro</span></h2></div>
      <CalculatorHelp title="Câmbio futuro"><p>Preencha os dados da parcela e informe as duas cotações recebidas da assessoria para cada moeda.</p></CalculatorHelp>
    </div>
    <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-operacao">
      <header className="cx-heading"><h3 id="cf-operacao">Operação</h3></header>
      <div className="cx-form cf-parcela-fields">
        <Campo id="cf-valor" label={comBandeira('USD', 'Valor da parcela (USD, com juros)')} value={operacao.valor} onChange={v => mudarOp('valor', v)} placeholder="ex.: 100.000,00" />
        <Campo id="cf-vencimento" label="Vencimento" type="date" value={operacao.vencimento} onChange={v => mudarOp('vencimento', v)} />
        <Campo id="cf-cotacao" label="Cotação de partida (R$/US$)" value={spotUsd} onChange={v => mudarOp('cotacao', v)} placeholder="ex.: 5,9160" />
        <Campo id="cf-taxa" label="Taxa all-in do empréstimo (% a.a.)" value={operacao.taxa} onChange={v => mudarOp('taxa', v)} placeholder="ex.: 11,20" />
      </div>
      <p className="cf-notice">Data-base da simulação: {dataBr(start)} (São Paulo).</p>
      {mudouDia && <p className="cf-notice" role="status">A data-base mudou. Informe novamente as cotações para calcular a TIR.</p>}
    </article>

    <article className="desk-panel cx-panel cf-input" aria-labelledby="cf-mesa">
      <header className="cx-heading"><h3 id="cf-mesa">Cotação da mesa</h3></header>
      <p className="cf-notice">Informe os preços da assessoria. Ao mudar o vencimento, informe novamente o câmbio futuro. A referência à vista segue a janela de coleta do Painel.</p>
      <div className="cf-mesa-grid">
        {MOEDAS_MESA.map(({ id, nome }) => <fieldset key={id} className="cf-moeda">
          <legend>{comBandeira(id, nome)}</legend>
          <Campo id={`cf-${id}-cotacao`} label={`Cotação de partida (R$/${id})`} value={mesaAtual[id].cotacao} onChange={v => mudarMesa(id, 'cotacao', v)}
            observacao={<ReferenciaMesa code={id} quote={quotes?.[id]} offer={mesaAtual[id].cotacao} plan={spotPlan} />} />
          <Campo id={`cf-${id}-futuro`} label={`Câmbio futuro (R$/${id})`} value={mesaAtual[id].futuro} onChange={v => mudarMesa(id, 'futuro', v)}
            observacao={operacao.vencimento ? `Taxa para ${dataBr(operacao.vencimento)}. Não é cotação à vista.` : 'Taxa para o vencimento da operação. Não é cotação à vista.'} erro={futuroInvalido(mesaAtual[id].futuro) ? 'Informe um câmbio futuro maior que zero.' : undefined} />
        </fieldset>)}
      </div>
    </article>

    <article className="desk-panel cx-panel cf-quote" aria-labelledby="cf-resultado">
      <header className="cx-heading"><h3 id="cf-resultado">Resultado</h3>
        <CalculatorHelp title="Como a TIR é calculada">
          <p>A parcela em USD já inclui juros. A taxa all-in serve para recuperar o valor recebido hoje, sem somar juros novamente. A cotação de partida converte a parcela para cada moeda; o câmbio futuro define o pagamento em reais. A TIR é a taxa que iguala os dois fluxos em dias corridos/365.</p>
        </CalculatorHelp>
      </header>
      <p className="cf-notice">A TIR usa o pagamento em reais pelo câmbio futuro. Não soma impostos ou tarifas fora da taxa informada.</p>
      <div className="cf-resultado-grid">
        {resultados.map(({ id, nome, resultado }) => <section key={id} className="cf-resultado-moeda" aria-labelledby={`cf-resultado-${id}`}>
          <h4 id={`cf-resultado-${id}`}>{comBandeira(id, nome)}</h4>
          <dl>
            <div><dt>Vencimento</dt><dd>{dataBr(operacao.vencimento)}</dd></div>
            <div><dt>Valor da parcela ({id})</dt><dd>{resultado?.ok ? decimalBr(resultado.parcelaMoeda) : '—'}</dd></div>
            <div className="cf-tir"><dt>TIR em reais (% a.a.)</dt><dd>{resultado?.ok && resultado.tir != null ? `${decimalBr(resultado.tir)}%` : '—'}</dd></div>
          </dl>
          <p className="cf-resultado-status" role="status">{!resultado ? 'Preencha os dados da operação e a cotação de partida desta moeda.' : !resultado.ok ? resultado.error : resultado.pagamentoBrl == null ? 'Informe um câmbio futuro válido para ver a TIR.' : resultado.tir == null ? 'A TIR não foi encontrada na faixa disponível (−99% a 1.000% a.a.).' : ''}</p>
        </section>)}
      </div>
    </article>
  </section>
}
