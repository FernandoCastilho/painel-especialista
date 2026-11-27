import { useEffect, useId, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import { DEFAULT_MODALITY, TAXAS_METHOD_PAGE, TAXAS_SOURCE_PAGE, brDate, matchesBank, median, modalityLabel, pct } from './taxasJuros.js'

// Escolha da modalidade: datalist nativo, para digitar e filtrar as opções.
function ModalityPicker({ modalities, value, onChange }) {
  const id = useId(), selected = modalityLabel(value)
  const [draft, setDraft] = useState(selected)
  useEffect(() => setDraft(selected), [selected])
  return <label>Modalidade<input list={id} value={draft} onFocus={e => e.target.select()} onBlur={() => setDraft(selected)} placeholder="Digite para filtrar"
    onChange={e => { const text = e.target.value; setDraft(text); const match = modalities.find(m => modalityLabel(m.name).toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR')); if (match) onChange(match.name) }} />
    <datalist id={id}>{modalities.map(m => <option key={m.name} value={modalityLabel(m.name)} />)}</datalist></label>
}

export default function TaxasBancos() {
  const file = useDataFile('taxas-juros.json')
  const modalities = file.data?.modalities || []
  const [choice, setChoice] = useState(DEFAULT_MODALITY), [query, setQuery] = useState('')
  const modality = modalities.find(m => m.name === choice) || modalities[0]
  const rows = modality?.rows || []
  // Mesma taxa, mesma posição; a posição é sempre a da lista completa, mesmo com a busca.
  const ranked = rows.map(([bank, am, aa]) => ({ bank, am, aa, pos: 1 + rows.filter(r => r[1] < am).length }))
  const shown = ranked.filter(r => matchesBank(r.bank, query))
  const midAm = median(rows.map(r => r[1])), midAa = median(rows.map(r => r[2]))
  const period = file.data?.period
  return <section className="banks-panel" aria-labelledby="rates-title">
    <div className="banks-heading"><div><h2 id="rates-title">Bancos · taxas cobradas de empresas</h2><p className="muted">Taxa média por instituição e modalidade · Banco Central · {period ? `operações de ${brDate(period.inicio)} a ${brDate(period.fim)}` : 'período indisponível'}</p></div><RefreshButton files={['taxas-juros.json']} label="taxas" /></div>
    {file.status === 'loading' && <p role="status">Carregando taxas dos bancos…</p>}
    {file.status === 'error' && <p role="alert">Não foi possível carregar as taxas. Use “Atualizar taxas” para tentar novamente.</p>}
    {(file.stale || file.data?.stale) && <p role="alert" className="banks-alert">A última consulta ao Banco Central falhou. As taxas abaixo são as últimas disponíveis; confira o período.</p>}
    {modality && <>
      <div className="banks-controls">
        <ModalityPicker modalities={modalities} value={modality.name} onChange={setChoice} />
        <label>Buscar instituição<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome da instituição" /></label>
      </div>
      <dl className="rates-summary">
        <div><dt>Mediana</dt><dd>{pct(midAm)} a.m.<small>{pct(midAa)} a.a.</small></dd></div>
        <div><dt>Menor</dt><dd>{pct(rows[0]?.[1])} a.m.<small>{rows[0]?.[0]}</small></dd></div>
        <div><dt>Maior</dt><dd>{pct(rows.at(-1)?.[1])} a.m.<small>{rows.at(-1)?.[0]}</small></dd></div>
      </dl>
      {!shown.length && <p role="status">Nenhuma instituição encontrada nesta modalidade.</p>}
      {shown.length > 0 && <div className="banks-table-scroll" role="region" aria-label={`Taxas de ${modalityLabel(modality.name)} por instituição`} tabIndex={0}>
        <table className="rates-table"><caption>{modalityLabel(modality.name)} · {shown.length === rows.length ? `${rows.length} instituições` : `${shown.length} de ${rows.length} instituições`}, da menor para a maior taxa</caption>
          <thead><tr><th scope="col">Posição</th><th scope="col">Instituição</th><th scope="col">% a.m.</th><th scope="col">% a.a.</th></tr></thead>
          <tbody>{shown.map((r, i) => <tr key={i}><td>{r.pos}º</td><th scope="row">{r.bank}</th><td>{pct(r.am)}</td><td>{pct(r.aa)}</td></tr>)}</tbody>
        </table></div>}
    </>}
    {file.status === 'ok' && !modality && <p role="status">O Banco Central não divulgou taxas para empresas neste período.</p>}
    <details className="banks-method"><summary>Como ler estas taxas</summary>
      <ul>
        <li>É a média das operações novas de cada instituição em 5 dias úteis, ponderada pelo valor contratado. Junta empresas de todos os portes e não é a taxa de um cliente específico.</li>
        <li>A taxa é o custo efetivo médio: juros mais encargos fiscais e operacionais, como o IOF. Nas pós-fixadas, já inclui o indexador (por exemplo, o CDI) e o spread. Compare com o CET da proposta, não com a taxa nominal.</li>
        <li>O Banco Central divulga com cerca de duas semanas de atraso. Instituição sem operação na modalidade, ou que não informou, não aparece.</li>
        <li>Na ACC, a taxa é em moeda estrangeira e não inclui a variação do câmbio.</li>
      </ul>
      <p><a href={TAXAS_SOURCE_PAGE} target="_blank" rel="noreferrer">Taxas de juros por instituição · Banco Central</a> · <a href={TAXAS_METHOD_PAGE} target="_blank" rel="noreferrer">Metodologia</a></p>
    </details>
  </section>
}
