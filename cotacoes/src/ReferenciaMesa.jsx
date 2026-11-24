import { parseDecimal } from './cdiDolar.js'
import { fromInput, useCentralDaily, useIntraday } from './useHistory.js'
import { explicacaoFaixa, explicacaoPonto, mesaDailyEur, mesaIntradayCnh, mesaSpotRange, mesaUsdReference } from './cambioFuturoSpot.js'

const dataBr = iso => iso ? iso.split('-').reverse().join('/') : '—'
const spotBr = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const horaBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

function ReferenciaIndisponivel({ loading }) {
  return loading ? 'Consultando a referência à vista…' : 'Referência à vista indisponível.'
}

function EurDiario({ plan, price, compact }) {
  const history = useCentralDaily()
  const ref = mesaDailyEur(history.data, plan)
  if (ref && compact) return <>Compra indicativa · {dataBr(ref.date)}</>
  return ref ? <>Referência diária indicativa (compra): R$ {spotBr(ref.value)}/EUR · {dataBr(ref.date)} (data de Brasília) · AwesomeAPI. {explicacaoPonto(price, ref)}</>
    : <ReferenciaIndisponivel loading={history.status === 'loading'} />
}

function UsdIndicativo({ plan, price, compact }) {
  const intraday = useIntraday('USD', fromInput(plan.day))
  const daily = useCentralDaily()
  if (intraday.status === 'loading') return <ReferenciaIndisponivel loading />
  const ref = mesaUsdReference(intraday.stale ? null : intraday.data, daily.data, plan)
  if (!ref) return <ReferenciaIndisponivel loading={daily.status === 'loading'} />
  const momento = <>{dataBr(ref.date)}{ref.t && <> às {horaBr.format(ref.t)}</>}</>
  if (compact) return <>Compra indicativa · {momento}</>
  return <>Compra indicativa: R$ {spotBr(ref.value)}/USD · {momento} (Brasília) · AwesomeAPI. {explicacaoPonto(price, ref)}</>
}

function CnhIntradiario({ plan, price, compact }) {
  const history = useIntraday('CNH', fromInput(plan.previous))
  const ref = mesaIntradayCnh(history.data, plan)
  if (ref && compact) return <>Compra indicativa · {dataBr(ref.date)} às {horaBr.format(ref.t)}</>
  return ref ? <>Yuan offshore à vista, último ponto indicativo de compra: R$ {spotBr(ref.value)}/CNH · {dataBr(ref.date)} às {horaBr.format(ref.t)} (hora de Brasília) · AwesomeAPI (cruzamento). {explicacaoPonto(price, ref)}</>
    : <ReferenciaIndisponivel loading={history.status === 'loading'} />
}

export default function ReferenciaMesa({ code, quote, offer = '', plan, compact = false }) {
  const ref = mesaSpotRange(code, quote, plan)
  const price = parseDecimal(offer)
  if (ref) {
    if (compact) return <>Compra indicativa · {dataBr(ref.date)} às {horaBr.format(ref.time)}</>
    const confronto = explicacaoFaixa(price, ref)
    return <>{ref.today ? 'À vista hoje' : 'Última faixa à vista'} (compra–venda): R$ {spotBr(ref.bid)} a {spotBr(ref.ask)}/{code} · {dataBr(ref.date)} às {horaBr.format(ref.time)} (hora de Brasília) · {code === 'CNH' ? 'AwesomeAPI (CNH offshore, cruzamento)' : 'AwesomeAPI'}.{confronto && <> {confronto}</>}</>
  }
  if (plan.open || !plan.previous) return <ReferenciaIndisponivel />
  if (code === 'USD') return <UsdIndicativo plan={plan} price={price} compact={compact} />
  return code === 'EUR' ? <EurDiario plan={plan} price={price} compact={compact} /> : <CnhIntradiario plan={plan} price={price} compact={compact} />
}
