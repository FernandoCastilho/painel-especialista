import { useEffect, useRef, useState } from 'react'
import { formatRpnEntry, historyValue, parseHistoryValue, replayRpnEntry } from './rpnHistory.mjs'
import './RpnHistory.css'

const glyph = {
  edit: <><path d="m13.5 4.5 2 2M3 15l3.5-.8L16 4.7 13.3 2 3.8 11.5 3 15Z"/></>,
  remove: <><path d="M3 5h12M6 5V3h6v2M5 5l.7 10h6.6L13 5M7.5 8v4m3-4v4"/></>,
  copy: <><rect x="6" y="6" width="9" height="9" rx="1.5"/><path d="M12 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2"/></>,
}

function RowAction({ action, label, onClick }) {
  return <button className="rpn-history-icon" type="button" title={label} aria-label={label} onClick={onClick}>
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{glyph[action]}</svg>
  </button>
}

function Editor({ entry, onSave, onCancel }) {
  const [left, setLeft] = useState(historyValue(entry.left))
  const [right, setRight] = useState(historyValue(entry.right))
  const [error, setError] = useState('')
  const first = useRef(null)
  useEffect(() => { first.current?.focus() }, [])
  const save = event => {
    event.preventDefault()
    const a = parseHistoryValue(left), b = parseHistoryValue(right)
    if (a === null || b === null) { setError('Informe números sem separador de milhar. Use vírgula ou ponto decimal.'); return }
    const result = replayRpnEntry(entry.key, a, b)
    if (!result) { setError('Não foi possível calcular com esses valores. Confira os operandos.'); return }
    onSave({ ...result, id: entry.id })
  }
  return <form className="rpn-history-edit" onSubmit={save} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel() }
  }}>
    <label>Primeiro valor <input ref={first} value={left} onChange={e => setLeft(e.target.value)} inputMode="decimal" maxLength={36} /></label>
    <label>Segundo valor <input value={right} onChange={e => setRight(e.target.value)} inputMode="decimal" maxLength={36} /></label>
    <div><button type="submit">Salvar edição</button> <button type="button" onClick={onCancel}>Cancelar</button></div>
    {error && <p role="alert">{error}</p>}
  </form>
}

export default function RpnHistoryPanel({ id, entries, canUndo, onEdit, onRemove, onUndo, onClose }) {
  const heading = useRef(null)
  const [editing, setEditing] = useState(null)
  const [copied, setCopied] = useState('')
  const editButton = useRef(null)
  useEffect(() => { heading.current?.focus() }, [])
  const stopEditing = () => { const trigger = editButton.current; setEditing(null); requestAnimationFrame(() => trigger?.focus()); editButton.current = null }
  const copy = async entry => {
    try {
      await navigator.clipboard.writeText(formatRpnEntry(entry))
      setCopied('Conta copiada.')
    } catch { setCopied('Não foi possível copiar. Selecione o texto da conta e copie manualmente.') }
  }
  return <section id={id} className="rpn-history" aria-labelledby={id + '-title'} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose() }
  }}>
    <header><div><h2 ref={heading} id={id + '-title'} tabIndex={-1}>Histórico de contas</h2>
      <p>Operações aritméticas desta sessão. As contas não são enviadas nem sincronizadas.</p></div>
      <button type="button" onClick={onClose} aria-label="Fechar histórico">×</button></header>
    {(copied || canUndo) && <p role="status" className="rpn-history-feedback">{copied} {canUndo && <button type="button" onClick={() => { onUndo(); setCopied('Conta restaurada.') }}>Desfazer exclusão</button>}</p>}
    {entries.length === 0 ? <p>As operações aritméticas concluídas nesta sessão aparecem aqui.</p> : <ol className="rpn-history-entries">
      {entries.map(entry => <li key={entry.id}>
        <div className="rpn-history-row"><span>{formatRpnEntry(entry)}</span>
          <div className="rpn-history-actions">
            <RowAction action="edit" label="Editar conta" onClick={event => { editButton.current = event.currentTarget; setEditing(entry.id) }} />
            <RowAction action="copy" label="Copiar conta" onClick={() => { void copy(entry) }} />
            <RowAction action="remove" label="Excluir conta" onClick={() => {
              if (editing === entry.id) setEditing(null)
              onRemove(entry.id); setCopied('Conta excluída.'); heading.current?.focus()
            }} />
          </div>
        </div>
        {editing === entry.id && <Editor entry={entry} onCancel={stopEditing} onSave={value => { onEdit(value); stopEditing(); setCopied('Conta editada no histórico.') }} />}
      </li>)}
    </ol>}
  </section>
}
