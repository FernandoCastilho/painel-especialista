import { lazy, Suspense, useState } from 'react'
import RatesSnapshot from './RatesSnapshot.jsx'
import { MacroStatus } from './Macro.jsx'
import { CdiFuturoTable } from './CdiFuturo.jsx'
import Curves from './Curves.jsx'
import { reduceMotion } from './motion.js'
const RateModal = lazy(() => import('./RateModal.jsx'))

// Linha da tabela -> gráfico que ela abre (ids das linhas de juros de referência; as demais já chegam prontas).
const KIND = { SELIC: 'selic', CDI: 'cdi', SOFR: 'sofr', ESTR: 'estr', FED: 'fed', ECB: 'ecb', BOJ: 'boj' }

// Atalhos do topo: a página tem seis tabelas; cada botão leva direto a uma delas (não esconde nada).
const ATALHOS = [['juros-ref', 'Referência'], ['juros-cdif', 'CDI futuro'], ['juros-curva-br', 'DI x pré'], ['juros-curva-cc', 'Cupom cambial'], ['juros-curva-us', 'Treasuries'], ['juros-curva-eu', 'Euro']]
const irPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })

// Aba Juros: só tabelas na página (referência, CDI futuro e curvas). Cada linha abre o gráfico em tela própria,
// como nas tabelas do Mercado e de Cenários.
export default function Juros({ macro, curves, hol }) {
  const [open, setOpen] = useState(null)
  const abrir = (id) => setOpen(KIND[id] ?? id)
  return (
    <>
      <nav className="learn-nav cen-nav juros-nav" aria-label="Atalhos da aba Juros">
        {ATALHOS.map(([id, label]) => <button key={id} type="button" onClick={() => irPara(id)}>{label}</button>)}
      </nav>
      <div id="juros-ref"><RatesSnapshot macro={macro} onOpen={abrir} /></div>
      <MacroStatus macro={macro} />
      <CdiFuturoTable curves={curves} onOpen={abrir} />
      <Curves curves={curves} onOpen={abrir} />
      {open && <Suspense fallback={null}><RateModal kind={open} macro={macro} curves={curves} hol={hol} onClose={() => setOpen(null)} /></Suspense>}
    </>
  )
}
