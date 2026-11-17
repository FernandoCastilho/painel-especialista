import { useState } from 'react'
import ChartFilters from './ChartFilters.jsx'
import { MacroStatus, CdiChart, RatesPeriod, fromInput, rangeFor } from './Macro.jsx'
import SofrChart from './Sofr.jsx'
import { CdiFuturoTable } from './CdiFuturo.jsx'
import Curves from './Curves.jsx'
import RateModal, { Estr, Policy } from './RateModal.jsx'
import { reduceMotion } from './motion.js'
import './Juros.css'

// Indicadores de referência de cada região, na ordem da página. A Selic meta saiu da aba a pedido (17/11/2026):
// o CDI já acompanha a meta, e a Selic continua na barra do topo e em Cenários.
const INDICADORES = {
  brasil: [['cdi', 'CDI']],
  exterior: [['sofr', 'SOFR'], ['fed', 'Fed (faixa-alvo)'], ['estr', '€STR'], ['ecb', 'BCE (depósito)'], ['boj', 'Japão (meta overnight)']],
}

// Atalhos do topo: cada botão leva direto a um bloco da página (não esconde nada).
const ATALHOS = [['juros-ref-brasil', 'Brasil · referência'], ['juros-cdif', 'CDI futuro'], ['juros-curva-br', 'DI x pré'], ['juros-curva-cc', 'Cupom cambial'], ['juros-ref-exterior', 'Exterior · referência'], ['juros-curva-us', 'Treasuries'], ['juros-curva-eu', 'Euro']]
const irPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })

// Gráficos dos indicadores de uma região. Cada um tem o botão "Ampliar", que abre o mesmo gráfico no centro da tela,
// com a leitura descritiva e a comparação por datas fixas.
function Indicadores({ region, macro, range, onOpen }) {
  const data = macro?.data
  return (
    <div className="charts juros-charts">
      {INDICADORES[region].map(([kind, nome]) => (
        <div className="juros-grafico" key={kind}>
          <button type="button" className="juros-ampliar" onClick={() => onOpen(kind)} aria-label={`Ampliar gráfico: ${nome}`}>Ampliar <span aria-hidden="true">⤢</span></button>
          {kind === 'cdi' && (data?.cdi?.length ? <CdiChart macro={data} range={range} /> : <p className="status">CDI indisponível no momento.</p>)}
          {kind === 'sofr' && (data?.sofr?.length ? <SofrChart macro={data} range={range} /> : <p className="status">SOFR indisponível no momento.</p>)}
          {kind === 'estr' && <Estr range={range} />}
          {['fed', 'ecb', 'boj'].includes(kind) && <Policy kind={kind} range={range} />}
        </div>
      ))}
    </div>
  )
}

// Aba Juros: indicadores de referência em gráfico; CDI futuro e curvas em tabela. Gráficos e linhas das tabelas
// abrem o detalhe no centro da tela.
export default function Juros({ macro, curves, hol }) {
  const [open, setOpen] = useState(null)
  const [preset, setPreset] = useState('365')
  const [range, setRange] = useState(() => rangeFor(365))
  const onPreset = (p) => { setPreset(p.id); setRange(rangeFor(p.days)) }
  const onDates = (a, b) => {
    let start = fromInput(a), end = fromInput(b)
    if (start > end) [start, end] = [end, start]
    setPreset('custom'); setRange({ start, end })
  }
  const abrir = (id) => setOpen(id)
  return (
    <>
      <nav className="learn-nav cen-nav juros-nav" aria-label="Atalhos da aba Juros">
        {ATALHOS.map(([id, label]) => <button key={id} type="button" onClick={() => irPara(id)}>{label}</button>)}
      </nav>
      <section className="macro juros-periodo" aria-label="Período dos gráficos de juros">
        <ChartFilters><RatesPeriod range={range} preset={preset} onPreset={onPreset} onDates={onDates} /></ChartFilters>
      </section>
      <section className="macro" aria-labelledby="juros-brasil">
        <h2 id="juros-brasil">Brasil</h2>
        <div id="juros-ref-brasil"><Indicadores region="brasil" macro={macro} range={range} onOpen={abrir} /></div>
        <MacroStatus macro={macro} region="brasil" />
        <CdiFuturoTable curves={curves} onOpen={abrir} />
        <Curves curves={curves} region="brasil" onOpen={abrir} />
      </section>
      <section className="macro" aria-labelledby="juros-exterior">
        <h2 id="juros-exterior">Outros países</h2>
        <div id="juros-ref-exterior"><Indicadores region="exterior" macro={macro} range={range} onOpen={abrir} /></div>
        <MacroStatus macro={macro} region="exterior" />
        <Curves curves={curves} region="exterior" onOpen={abrir} />
      </section>
      {open && <RateModal kind={open} macro={macro} curves={curves} hol={hol} onClose={() => setOpen(null)} />}
    </>
  )
}
