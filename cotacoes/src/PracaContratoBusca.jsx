import { useEffect, useState } from 'react'
import { pracaContrato, PRACA_PADRAO } from './pracaContrato.js'
import { findPracasContrato } from './pracaBusca.js'
import './PracaContratoBusca.css'

export default function PracaContratoBusca({ id, value, onChange }) {
  const [query, setQuery] = useState(null)
  const [active, setActive] = useState(-1)
  const current = pracaContrato(value) ?? pracaContrato(PRACA_PADRAO)
  const options = findPracasContrato(query ?? '')
  const open = query !== null
  const listId = id + '-opcoes'
  const activeId = open && options[active] ? listId + '-' + options[active].id : undefined

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function close() {
    setQuery(null)
    setActive(-1)
  }

  function choose(praca) {
    onChange(praca.id)
    close()
  }

  function onKeyDown(event) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setQuery('')
      if (!options.length) return
      const last = options.length - 1
      setActive(index => event.key === 'ArrowDown'
        ? Math.min(last, index + 1)
        : index < 0 ? last : Math.max(0, index - 1))
    } else if (open && event.key === 'Enter') {
      event.preventDefault()
      if (options[active]) choose(options[active])
      else if (options.length === 1) choose(options[0])
    } else if (open && event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  return <div className="praca-busca">
    <input id={id} role="combobox" type="text" autoComplete="off" spellCheck={false}
      placeholder="Digite o nome da cidade" value={query ?? current.label}
      aria-autocomplete="list" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={activeId} aria-describedby={id + '-ajuda'}
      onFocus={event => event.target.select()} onClick={() => { if (!open) setQuery('') }}
      onBlur={close} onKeyDown={onKeyDown}
      onChange={event => { setQuery(event.target.value); setActive(-1) }} />
    <small id={id + '-ajuda'} className="praca-busca-ajuda">{open ? 'Em uso: ' + current.label : 'Digite para buscar uma praça cadastrada.'}</small>
    {open && <>
      <ul className="praca-busca-opcoes" id={listId} role="listbox" aria-label="Praças cadastradas" hidden={!options.length}>
        {options.map((praca, index) => <li id={listId + '-' + praca.id} key={praca.id} role="option"
          aria-selected={praca.id === current.id} data-active={index === active}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(praca)}>{praca.label}</li>)}
      </ul>
      {!options.length && <small role="status" className="praca-busca-ajuda">Nenhuma praça cadastrada encontrada.</small>}
    </>}
  </div>
}
