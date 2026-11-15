import { useState } from 'react'
import { MacroStatus, CdiChart, SelicChart, rangeFor } from './Macro.jsx'
import CdiFuturo from './CdiFuturo.jsx'
import { CurveDetail } from './Curves.jsx'
import SofrChart from './Sofr.jsx'
import RateModal, { Estr, Policy } from './RateModal.jsx'
import { reduceMotion } from './motion.js'
import './Juros.css'

const ATALHOS = [['juros-ref-brasil', 'Brasil · referência'], ['juros-cdif', 'CDI futuro'], ['juros-curva-br', 'DI x pré'], ['juros-curva-cc', 'Cupom cambial'], ['juros-ref-exterior', 'Exterior · referência'], ['juros-curva-us', 'Treasuries'], ['juros-curva-eu', 'Euro']]
const irPara = id => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
function GraphCard({ id, title, kind, onOpen, children }) {
  const detailLabel = kind.startsWith('curva-') || kind === 'cdif' ? 'Ver gráfico e tabela' : 'Ver tendência e tabela'
  return <div id={id} className="juros-graph-card">
    <button type="button" className="juros-graph-open" onClick={() => onOpen(kind)} aria-label={`Ampliar ${title}: ${detailLabel.toLowerCase()}`}>{title}<span aria-hidden="true"> ⤢</span></button>
    <div className="juros-graph-preview" onClick={e => { if (!e.target.closest('button, a, input, select, summary, [role="button"]')) onOpen(kind) }}>{children}</div>
    <button type="button" className="juros-graph-detail" onClick={() => onOpen(kind)}>{detailLabel}</button>
  </div>
}
export default function Juros({ macro, curves, hol }) {
  const [open, setOpen] = useState(null)
  const range = rangeFor(365)
  const curve = (id, title) => <GraphCard key={id} id={`juros-curva-${id}`} title={title} kind={`curva-${id}`} onOpen={setOpen}><CurveDetail preview id={id} curves={curves} /></GraphCard>
  return <div className="juros-charts">
    <nav className="learn-nav cen-nav juros-nav" aria-label="Atalhos da aba Juros">{ATALHOS.map(([id, label]) => <button key={id} type="button" onClick={() => irPara(id)}>{label}</button>)}</nav>
    <p className="ind-note">Gráficos de referência: último ano. Clique no gráfico ou no botão de detalhe para ampliar e consultar os dados. Curvas mostram taxas por prazo, não previsões garantidas.</p>
    <section aria-labelledby="juros-brasil">
      <h2 id="juros-brasil">Brasil</h2>
      <MacroStatus macro={macro} region="brasil" />
      <div className="juros-graph-grid" id="juros-ref-brasil">
        <GraphCard title="Selic meta" kind="selic" onOpen={setOpen}>{macro.data?.selic?.length ? <SelicChart macro={macro.data} range={range} /> : <p role="status">Selic indisponível no momento.</p>}</GraphCard>
        <GraphCard title="CDI" kind="cdi" onOpen={setOpen}>{macro.data?.cdi?.length ? <CdiChart macro={macro.data} range={range} /> : <p role="status">CDI indisponível no momento.</p>}</GraphCard>
        <GraphCard id="juros-cdif" title="CDI futuro" kind="cdif" onOpen={setOpen}><CdiFuturo preview curves={curves} macro={macro.data} hol={hol} /></GraphCard>
        {curve('br', 'DI x pré')}{curve('cc', 'Cupom cambial')}
      </div>
    </section>
    <section aria-labelledby="juros-exterior">
      <h2 id="juros-exterior">Outros países</h2>
      <MacroStatus macro={macro} region="exterior" />
      <div className="juros-graph-grid" id="juros-ref-exterior">
        <GraphCard title="SOFR" kind="sofr" onOpen={setOpen}>{macro.data?.sofr?.length ? <SofrChart macro={macro.data} range={range} /> : <p role="status">SOFR indisponível no momento.</p>}</GraphCard>
        <GraphCard title="€STR" kind="estr" onOpen={setOpen}><Estr range={range} /></GraphCard>
        {[['fed', 'Fed · faixa-alvo'], ['ecb', 'BCE · depósito'], ['boj', 'Japão · meta overnight']].map(([kind, title]) => <GraphCard key={kind} title={title} kind={kind} onOpen={setOpen}><Policy kind={kind} range={range} /></GraphCard>)}
        {curve('us', 'Treasuries')}{curve('eu', 'Curva soberana AAA · euro')}
      </div>
    </section>
    {open && <RateModal kind={open} macro={macro} curves={curves} hol={hol} onClose={() => setOpen(null)} />}
  </div>
}
