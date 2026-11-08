import { useEffect, useRef, useState } from 'react'
import { activityKinds, findIbgeActivities } from './cbsActivitySearch.js'

export default function IbgeActivitySearch({ datasets, selected, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const options = findIbgeActivities(datasets, query)
  const input = useRef(null)
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`cbs-activity-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  const choose = option => {
    onSelect(option)
    setQuery('')
    setOpen(false)
    setActive(-1)
  }
  const move = index => {
    setOpen(true)
    setActive(index)
  }
  const onKeyDown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (options.length) move(event.key === 'ArrowDown' ? Math.min(active + 1, options.length - 1) : active < 0 ? options.length - 1 : Math.max(active - 1, 0))
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setActive(-1)
    }
  }
  return <div className="cx-field cbs-activity-search">
    <label htmlFor="cbs-group">Atividade de referência do IBGE</label>
    <p id="cbs-activity-hint" className="cbs-field-hint">Busque por nome ou código nas atividades disponíveis de Comércio, Indústria e Serviços.</p>
    <input ref={input} id="cbs-group" role="combobox" autoComplete="off" placeholder="Digite uma atividade ou código"
      value={query} aria-autocomplete="list" aria-expanded={open} aria-controls="cbs-activity-options"
      aria-activedescendant={open && active >= 0 ? `cbs-activity-option-${active}` : undefined}
      aria-describedby="cbs-activity-hint cbs-activity-selected"
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1) }}
      onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1) }} onKeyDown={onKeyDown} />
    {open && <div className="cbs-activity-results">
      <p className="cbs-field-hint" role="status">{options.length ? `${options.length} atividades encontradas. Escolha uma opção.` : 'Nenhuma atividade encontrada. Tente outra palavra ou código.'}</p>
      <ul id="cbs-activity-options" role="listbox" aria-label="Atividades disponíveis do IBGE">
        {options.map((option, index) => <li key={option.id} id={`cbs-activity-option-${index}`} role="option"
          aria-selected={selected.id === option.id} className={active === index ? 'is-active' : ''}
          onPointerDown={event => event.preventDefault()} onMouseMove={() => setActive(index)}
          onClick={() => { choose(option); input.current?.focus() }}>
          <span>{option.label}</span><small>{option.sector}{selected.id === option.id ? ' · Selecionada' : ''}</small>
        </li>)}
      </ul>
    </div>}
    <p id="cbs-activity-selected" className="cbs-activity-selected"><b>Em uso: {selected.label}</b><span>{activityKinds[selected.kind]} · A busca não altera a simulação. Escolha uma atividade para aplicá-la.</span></p>
  </div>
}
