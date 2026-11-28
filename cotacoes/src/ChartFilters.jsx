import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Filtros de um gráfico ampliado, numa só linha no topo: período (e datas) || escala dos pontos.
// O gráfico encaixa o seletor de escala no mesmo bloco, para não haver dois conjuntos de filtros na tela.
// O bloco vive num nó próprio: ao maximizar o gráfico, a tela cheia leva esse nó para o topo dela,
// e os filtros continuam à mão sem remontar nada (período, datas e escala ficam como estavam).
const Scope = createContext({ slot: null, setSlot: () => {}, filtros: null, setFiltros: () => {} })
export const useFilterSlot = () => useContext(Scope).slot
// { host, inline }: o nó com os filtros e o lugar dele na página. Nulo sem bloco de filtros no escopo.
export const useFiltros = () => useContext(Scope).filtros

// Envolve o conteúdo da tela ampliada: liga o bloco de filtros aos gráficos que estão dentro dela.
export function FilterScope({ children }) {
  const [slot, setSlot] = useState(null)
  const [filtros, setFiltros] = useState(null)
  return <Scope.Provider value={{ slot, setSlot, filtros, setFiltros }}>{children}</Scope.Provider>
}

export default function ChartFilters({ children, label = 'Filtros do gráfico' }) {
  const { setSlot, setFiltros } = useContext(Scope)
  const [host] = useState(() => {
    if (typeof document === 'undefined') return null
    const div = document.createElement('div')
    div.className = 'chart-filters-host'
    return div
  })
  const inline = useRef(null)
  useLayoutEffect(() => {
    if (!host) return
    const lugar = inline.current
    lugar.appendChild(host)
    setFiltros({ host, inline: lugar })
    return () => { setFiltros(null); host.remove() }
  }, [host, setFiltros])
  const section = (
    <section className="chart-filters" aria-label={label}>
      <div className="cf-row"><span className="cf-label" aria-hidden="true">Período</span><div className="cf-body">{children}</div></div>
      <span className="cf-sep" aria-hidden="true">||</span>
      <div className="cf-row cf-scale"><span className="cf-label" aria-hidden="true">Escala</span><div className="cf-body" ref={setSlot} /></div>
    </section>
  )
  if (!host) return section
  return <><div ref={inline} className="chart-filters-place" />{createPortal(section, host)}</>
}
