import { publicAgencySources } from './sectorSourceVisibility.js'
const link = source => <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>

export function StudyTable({ section }) {
  return section.rows ? <div className="study-table-wrap"><table><caption>{section.tableTitle || section.title}</caption><thead><tr>{section.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{section.rows.map(row => <tr key={row[0]}>{row.map((cell, index) => index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : null
}

export function StudyMethod({ study }) {
  return <details className="study-section"><summary>Fontes, método e limitações</summary><p>{study.method}</p><ul>{publicAgencySources(study.sources).map(source => <li key={source.url}>{link(source)} — {source.purpose}</li>)}</ul><ul>{study.limitations.map(text => <li key={text}>{text}</li>)}</ul></details>
}
