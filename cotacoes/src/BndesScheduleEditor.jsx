import { useState } from 'react'
// Converte somente a edição visual. A modalidade continua validando o texto com seu parser original.
export function scheduleRows(text) {
  const lines = text.trim() ? text.trim().split(/\r?\n/) : []
  if (lines.some(line => !line.trim())) return null
  const rows = lines.map(line => line.split(';').map(value => value.trim()))
  for (const row of rows) {
    if (row.length > 3) return null
    const date = row[0]
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return null
    const phase = row[2]?.toUpperCase()
    if (phase && !['C', 'A'].includes(phase)) return null
    if (phase) row[2] = phase
  }
  return rows.map(row => [row[0] || '', row[1] || '', row[2] || ''])
}
export const scheduleText = rows => rows.filter(row => row.some(Boolean)).map(row => row.join('; ')).join('\n')
export default function BndesScheduleEditor({ id, value, onChange, describedBy }) {
  const [textMode, setTextMode] = useState(false)
  const rows = scheduleRows(value)
  const useText = textMode || rows === null
  const edit = (index, column, next) => {
    const updated = (rows.length ? rows : [['', '', '']]).map(row => [...row])
    updated[index][column] = next
    onChange(scheduleText(updated))
  }
  const visible = rows?.length ? rows : [['', '', '']]
  return <div className="bndes-schedule-editor">
    <button type="button" className="bndes-schedule-mode" onClick={() => setTextMode(!useText)} aria-pressed={useText}>{useText ? 'Editar cronograma em tabela' : 'Colar cronograma em texto'}</button>
    {useText ? <><textarea id={id} value={value} onChange={event => onChange(event.target.value)} aria-describedby={describedBy} rows={7} spellCheck={false} placeholder="AAAA-MM-DD; dias úteis; C ou A" />{rows === null && <p role="status">Confira o texto: há dados que não podem ser exibidos na tabela. Nenhum conteúdo foi removido.</p>}</> :
      <div className="bndes-schedule-scroll" role="region" aria-label="Edição do cronograma" tabIndex={0}>
        <table><thead><tr><th>Vencimento</th><th>Dias úteis</th><th>Fase</th><th><span className="sr-only">Remover linha</span></th></tr></thead>
          <tbody>{visible.map((row, index) => <tr key={index}>
            <td data-label="Vencimento"><input id={index === 0 ? id : `${id}-${index + 1}`} type="date" aria-describedby={describedBy} aria-label={`Vencimento ${index + 1}`} value={row[0]} onChange={event => edit(index, 0, event.target.value)} /></td>
            <td data-label="Dias úteis"><input inputMode="numeric" aria-label={`Dias úteis ${index + 1}`} value={row[1]} onChange={event => edit(index, 1, event.target.value)} /></td>
            <td data-label="Fase"><select aria-label={`Fase ${index + 1}`} value={row[2]} onChange={event => edit(index, 2, event.target.value)}><option value="">Escolha</option><option value="C">Carência</option><option value="A">Amortização</option></select></td>
            <td data-label="Ação"><button type="button" aria-label={`Remover linha ${index + 1}`} onClick={() => onChange(scheduleText(visible.filter((_, i) => i !== index)))}>Remover</button></td>
          </tr>)}</tbody>
        </table>
        <button type="button" onClick={() => onChange(scheduleText([...visible, ['', '', 'A']]))}>Adicionar linha</button>
      </div>}
  </div>
}
