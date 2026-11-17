import { useState } from 'react'
import { MacroStatus, CdiChart, rangeFor } from './Macro.jsx'
import SofrChart from './Sofr.jsx'
import CdiFuturo from './CdiFuturo.jsx'
import { CurveDetail, CurvesStatus } from './Curves.jsx'
import RateModal, { Estr, Policy } from './RateModal.jsx'
import { reduceMotion } from './motion.js'
import './Juros.css'

// Gráficos de cada região, na ordem da página: [tipo do detalhe, nome, id do bloco (alvo dos atalhos)].
// A Selic meta saiu da aba a pedido (17/11/2026): o CDI já acompanha a meta, e ela continua na barra do topo e em Cenários.
const GRAFICOS = {
  brasil: [['cdi', 'CDI', 'juros-ref-brasil'], ['cdif', 'CDI futuro', 'juros-cdif'], ['curva-br', 'DI x pré', 'juros-curva-br'], ['curva-cc', 'Cupom cambial', 'juros-curva-cc']],
  exterior: [['sofr', 'SOFR', 'juros-ref-exterior'], ['fed', 'Fed (faixa-alvo)'], ['estr', '€STR'], ['ecb', 'BCE (depósito)'], ['boj', 'Japão (meta overnight)'], ['curva-us', 'Treasuries', 'juros-curva-us'], ['curva-eu', 'Curva do euro', 'juros-curva-eu']],
}

// Atalhos do topo: cada botão leva direto a um gráfico da página (não esconde nada).
const ATALHOS = [['juros-ref-brasil', 'Brasil · referência'], ['juros-cdif', 'CDI futuro'], ['juros-curva-br', 'DI x pré'], ['juros-curva-cc', 'Cupom cambial'], ['juros-ref-exterior', 'Exterior · referência'], ['juros-curva-us', 'Treasuries'], ['juros-curva-eu', 'Euro']]
const irPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })

// Na página os gráficos mostram sempre o último ano; o período é escolhido dentro do detalhe.
const UM_ANO = rangeFor(365)
// Clique em qualquer ponto do gráfico abre o detalhe; os controles do próprio gráfico ("?", atualizar, agrupar, séries) seguem funcionando.
const CONTROLE = 'button, a, input, select, summary, label, [role="tooltip"]'

// Um gráfico por indicador, CDI futuro e curva. Clicar no gráfico (ou em "Ampliar") abre o detalhe no centro da tela,
// com a escolha de período e as tabelas logo abaixo.
function Graficos({ region, macro, curves, hol, onOpen }) {
  const data = macro?.data
  return (
    <div className="charts juros-charts">
      {GRAFICOS[region].map(([kind, nome, id]) => (
        <div className="juros-grafico" key={kind} id={id} onClick={(e) => { if (!e.target.closest(CONTROLE)) onOpen(kind) }}>
          <button type="button" className="juros-ampliar" onClick={() => onOpen(kind)} aria-label={`Ampliar gráfico: ${nome}`}>Ampliar <span aria-hidden="true">⤢</span></button>
          {kind === 'cdi' && (data?.cdi?.length ? <CdiChart macro={data} range={UM_ANO} /> : <p className="status">CDI indisponível no momento.</p>)}
          {kind === 'sofr' && (data?.sofr?.length ? <SofrChart macro={data} range={UM_ANO} /> : <p className="status">SOFR indisponível no momento.</p>)}
          {kind === 'estr' && <Estr range={UM_ANO} />}
          {['fed', 'ecb', 'boj'].includes(kind) && <Policy kind={kind} range={UM_ANO} />}
          {kind === 'cdif' && <CdiFuturo preview curves={curves} macro={data} hol={hol} />}
          {kind.startsWith('curva-') && <CurveDetail preview id={kind.slice(6)} curves={curves} />}
        </div>
      ))}
    </div>
  )
}

// Aba Juros: só gráficos na página (pedido de 17/11/2026). As tabelas e a escolha de período ficam no detalhe,
// que abre no centro da tela ao clicar em um gráfico.
export default function Juros({ macro, curves, hol }) {
  const [open, setOpen] = useState(null)
  const abrir = (id) => setOpen(id)
  return (
    <>
      <nav className="learn-nav cen-nav juros-nav" aria-label="Atalhos da aba Juros">
        {ATALHOS.map(([id, label]) => <button key={id} type="button" onClick={() => irPara(id)}>{label}</button>)}
      </nav>
      <p className="ind-note juros-dica">Clique em um gráfico para ampliar, escolher o período e ver as tabelas.</p>
      <CurvesStatus curves={curves} />
      <section className="macro" aria-labelledby="juros-brasil">
        <h2 id="juros-brasil">Brasil</h2>
        <MacroStatus macro={macro} region="brasil" />
        <Graficos region="brasil" macro={macro} curves={curves} hol={hol} onOpen={abrir} />
      </section>
      <section className="macro" aria-labelledby="juros-exterior">
        <h2 id="juros-exterior">Outros países</h2>
        <MacroStatus macro={macro} region="exterior" />
        <Graficos region="exterior" macro={macro} curves={curves} hol={hol} onOpen={abrir} />
      </section>
      {open && <RateModal kind={open} macro={macro} curves={curves} hol={hol} onClose={() => setOpen(null)} />}
    </>
  )
}
