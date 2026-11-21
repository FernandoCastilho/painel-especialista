// Referência de mercado no fim das calculadoras de crédito (pedido do Fernando, 21/11/2026): um gráfico que o painel já
// tem, só para ilustrar de onde vêm os juros ou a moeda da tela. Não entra em nenhuma conta e não é previsão.
//   'pre'    → curva DI x pré da B3: o juro prefixado que o mercado negocia para cada prazo
//   'pos'    → CDI futuro: taxa a termo implícita nos futuros de DI da B3
//   'cambio' → histórico diário da moeda escolhida na tela (prop `moeda`: USD, EUR ou CNH)
import { useMemo, useState } from 'react'
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

function Pre() {
  return <>
    <h4>Curva DI x pré (B3)</h4>
    <p className="rm-fonte">O juro prefixado que o mercado negocia para cada prazo, em % a.a. A taxa prefixada de uma operação parte daqui, mais o spread do banco.</p>
    <CurvePanel curves={useCurves()} />
  </>
}

function Pos() {
  const curves = useCurves(), macro = useMacro(), hol = useHolidays()
  return <>
    <p className="rm-fonte">O CDI que o mercado projeta nos futuros de DI da B3. É a referência de uma taxa pós-fixada (% do CDI ou CDI + spread).</p>
    <CdiFuturo preview curves={curves} macro={macro?.data} hol={hol} />
  </>
}

function Cambio({ moeda }) {
  const [dias, setDias] = useState(90)
  const [anchor, width] = useWidth()
  const { status, data } = useCentralDaily()
  const pontos = useMemo(() => historicoCenario(data, moeda, dias, marketDate(Date.now())), [data, moeda, dias])
  return <article className="rm-cambio">
    <header><h4>{moeda}/BRL · cotação diária</h4>
      <div className="rm-periodo" role="group" aria-label="Período do histórico">
        {[30, 90, 365].map(n => <button type="button" key={n} aria-pressed={dias === n} onClick={() => setDias(n)}>{n === 365 ? '1 ano' : `${n} dias`}</button>)}
      </div>
    </header>
    <div ref={anchor}>
      {pontos.length >= 2 ? <>
        <Plot points={pontos} width={width} color="#1683d5" code={moeda} label={`${moeda}/BRL · cotação diária`} intraday={false}
          fmt={v => 'R$ ' + cotacao.format(v)} dateLabel={t => dataBr(marketDate(t)).slice(0, 5)} compare={false} scales={false} />
        <p className="rm-fonte">Dados de {dataBr(marketDate(pontos[0].t))} a {dataBr(marketDate(pontos.at(-1).t))} (Brasília). Histórico diário da AwesomeAPI.</p>
      </> : <p className="rm-fonte" role="status">{status === 'loading' ? 'Consultando histórico…' : `Histórico ${moeda}/BRL indisponível neste período.`}</p>}
    </div>
  </article>
}

const GRAFICOS = { pre: Pre, pos: Pos, cambio: Cambio }

// `tipos`: quais gráficos mostrar, na ordem. Sempre o último bloco da calculadora.
export default function ReferenciaMercado({ tipos, moeda }) {
  return <section className="rm" aria-labelledby="rm-titulo">
    <h3 id="rm-titulo">Referência de mercado</h3>
    <p className="rm-nota">Só para ilustrar. Não entra na conta desta simulação e não é previsão.</p>
    <div className="rm-graficos">{tipos.map(tipo => { const Grafico = GRAFICOS[tipo]; return <div className="rm-grafico" key={tipo}><Grafico moeda={moeda} /></div> })}</div>
  </section>
}
