// Referência de mercado no fim das calculadoras de crédito (pedido do Fernando, 21/11/2026): um gráfico que o painel já
// tem, só para ilustrar de onde vêm os juros ou a moeda da tela. Não entra em nenhuma conta e não é previsão.
//   'pre'    → curva DI x pré da B3: o juro prefixado que o mercado negocia para cada prazo
//   'pos'    → CDI futuro: taxa a termo implícita nos futuros de DI da B3
//   'cambio' → histórico diário da moeda escolhida na tela (prop `moeda`: USD, EUR ou CNH)
import { useMemo, useState } from 'react'
import CalculatorHelp from './CalculatorHelp.jsx'
import CdiFuturo from './CdiFuturo.jsx'
import { CurvePanel } from './Curves.jsx'
import { Plot, useWidth } from './HistoryChart.jsx'
import { historicoCenario } from './CambioFuturoCenario.jsx'
import { marketDate } from './marketReturns.js'
import { useCurves } from './useCurves.js'
import { useCentralDaily } from './useHistory.js'
import { useHolidays } from './useHolidays.js'
import { useMacro } from './useMacro.js'
import './ReferenciaMercado.css'

const cotacao = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
const dataBr = iso => iso.split('-').reverse().join('/')
// Tela limpa (21/11/2026): as explicações de cada gráfico ficam no "?" do bloco; na tela, só o gráfico e os avisos.
const SO_PARA_ILUSTRAR = 'Só para ilustrar. Não entra na conta desta simulação e não é previsão.'
const AJUDA = {
  pre: 'Curva DI x pré (B3): o juro prefixado que o mercado negocia para cada prazo, em % a.a. A taxa prefixada de uma operação parte daqui, mais o spread do banco. O gráfico mostra os vencimentos de 12 a 48 meses, o prazo em que o mercado precifica a curva para estas operações (eixo em meses de 21 dias úteis, de 252 a 1.008 dias úteis). Abre só com a curva do último dia; as outras datas de comparação podem ser ligadas na legenda.',
  pos: 'O CDI que o mercado projeta nos futuros de DI da B3. É a referência de uma taxa pós-fixada (% do CDI ou CDI + spread).',
  cambio: 'Histórico diário da cotação da moeda escolhida na tela, em reais (AwesomeAPI, data de Brasília).',
}
// Curva pré nas calculadoras de crédito (pedido do Fernando, 21/11/2026): só os vértices de 12 a 48 meses, em dias úteis
// (21 por mês, a mesma conta do balão do gráfico), e só a curva do último dia ligada ao abrir.
const PRAZO_CREDITO = { de: 12 * 21, ate: 48 * 21 }

function Pre() {
  return <>
    <h4>Curva DI x pré (B3) · 12 a 48 meses</h4>
    <CurvePanel curves={useCurves()} prazo={PRAZO_CREDITO} soUltimo />
  </>
}

function Pos() {
  const curves = useCurves(), macro = useMacro(), hol = useHolidays()
  return <CdiFuturo preview curves={curves} macro={macro?.data} hol={hol} />
}

function Cambio({ moeda }) {
  const [dias, setDias] = useState(90)
  const [anchor, width] = useWidth()
  const { status, data } = useCentralDaily()
  const pontos = useMemo(() => historicoCenario(data, moeda, dias, marketDate(Date.now())), [data, moeda, dias])
  const titulo = `${moeda}/BRL · cotação diária`
  return <article className="rm-cambio">
    <header><div className="rm-titulo-linha"><h4>{titulo}</h4>{pontos.length >= 2 && <CalculatorHelp title={titulo}><p>Dados de {dataBr(marketDate(pontos[0].t))} a {dataBr(marketDate(pontos.at(-1).t))} (Brasília). Histórico diário da AwesomeAPI.</p></CalculatorHelp>}</div>
      <div className="rm-periodo" role="group" aria-label="Período do histórico">
        {[30, 90, 365].map(n => <button type="button" key={n} aria-pressed={dias === n} onClick={() => setDias(n)}>{n === 365 ? '1 ano' : `${n} dias`}</button>)}
      </div>
    </header>
    <div ref={anchor}>
      {pontos.length >= 2 ? <>
        <Plot points={pontos} width={width} color="#1683d5" code={moeda} label={titulo} intraday={false}
          fmt={v => 'R$ ' + cotacao.format(v)} dateLabel={t => dataBr(marketDate(t)).slice(0, 5)} compare={false} scales={false} />
      </> : <p className="rm-fonte" role="status">{status === 'loading' ? 'Consultando histórico…' : `Histórico ${moeda}/BRL indisponível neste período.`}</p>}
    </div>
  </article>
}

const GRAFICOS = { pre: Pre, pos: Pos, cambio: Cambio }

// `tipos`: quais gráficos mostrar, na ordem. Sempre o último bloco da calculadora.
export default function ReferenciaMercado({ tipos, moeda }) {
  return <section className="rm" aria-labelledby="rm-titulo">
    <div className="rm-titulo-linha"><h3 id="rm-titulo">Referência de mercado</h3><CalculatorHelp title="Referência de mercado"><p>{SO_PARA_ILUSTRAR}</p>{tipos.map(tipo => <p key={tipo}>{AJUDA[tipo]}</p>)}</CalculatorHelp></div>
    <div className="rm-graficos">{tipos.map(tipo => { const Grafico = GRAFICOS[tipo]; return <div className="rm-grafico" key={tipo}><Grafico moeda={moeda} /></div> })}</div>
  </section>
}
