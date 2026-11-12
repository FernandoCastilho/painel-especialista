import { lazy, Suspense, useState } from 'react'
import RatesSnapshot from './RatesSnapshot.jsx'
import { MacroStatus } from './Macro.jsx'
import { CdiFuturoTable } from './CdiFuturo.jsx'
import Curves from './Curves.jsx'
const RateModal = lazy(() => import('./RateModal.jsx'))

// Linha da tabela -> gráfico que ela abre (ids das linhas de juros de referência; as demais já chegam prontas).
const KIND = { SELIC: 'selic', CDI: 'cdi', SOFR: 'sofr', ESTR: 'estr', FED: 'fed', ECB: 'ecb', BOJ: 'boj' }

// Aba Juros: só tabelas na página (referência, CDI futuro e curvas). Cada linha abre o gráfico em tela própria,
// como nas tabelas do Mercado e de Cenários.
export default function Juros({ macro, curves, hol }) {
  const [open, setOpen] = useState(null)
  const abrir = (id) => setOpen(KIND[id] ?? id)
  return (
    <>
      <RatesSnapshot macro={macro} onOpen={abrir} />
      <MacroStatus macro={macro} />
      <CdiFuturoTable curves={curves} onOpen={abrir} />
      <Curves curves={curves} onOpen={abrir} />
      {open && <Suspense fallback={null}><RateModal kind={open} macro={macro} curves={curves} hol={hol} onClose={() => setOpen(null)} /></Suspense>}
    </>
  )
}
