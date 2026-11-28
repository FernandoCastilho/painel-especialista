import './JurosBancarios.css'
import { useEffect, useId, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import { TAXAS_METHOD_PAGE, TAXAS_SEGMENTS, TAXAS_SOURCE_PAGE, bankBrand, brDate, matchesBank, median, modalityLabel, pct, rankRows } from './taxasJuros.js'

// Logotipo oficial (decorativo: o nome vem ao lado) ou as iniciais da instituição.
const Marca = ({ bank }) => {
  const { logo, initials } = bankBrand(bank)
  return logo ? <img className="jb-logo" src={logo} alt="" width={22} height={22} loading="lazy" decoding="async" />
    : <span className="jb-logo jb-initials" aria-hidden="true">{initials}</span>
}
const Nome = ({ bank }) => {
  const { short } = bankBrand(bank)
  return short ? <><b>{short}</b><small>{bank}</small></> : <b>{bank}</b>
}

// Escolha da modalidade: datalist nativo, para digitar e filtrar as opções.
function ModalityPicker({ modalities, value, onChange }) {
  const id = useId(), selected = modalityLabel(value)
  const [draft, setDraft] = useState(selected)
  useEffect(() => setDraft(selected), [selected])
  return <label>Modalidade<input list={id} value={draft} onFocus={e => e.target.select()} onBlur={() => setDraft(selected)} placeholder="Digite para filtrar"
    onChange={e => { const text = e.target.value; setDraft(text); const match = modalities.find(m => modalityLabel(m.name).toLocaleLowerCase('pt-BR') === text.toLocaleLowerCase('pt-BR')); if (match) onChange(match.name) }} />
    <datalist id={id}>{modalities.map(m => <option key={m.name} value={modalityLabel(m.name)} />)}</datalist></label>
}

export default function JurosBancarios({ searchTarget }) {
  const file = useDataFile('taxas-juros.json')
  const segments = file.data?.segments || []
  const [segId, setSegId] = useState('pj'), [choice, setChoice] = useState({}), [query, setQuery] = useState(''), [onlyMajor, setOnlyMajor] = useState(false)
  // Resultado da busca do painel: abre no público e na modalidade encontrados.
  useEffect(() => {
    const ctx = searchTarget?.context
    if (!ctx?.segment) return
    setSegId(ctx.segment)
    if (ctx.modality) setChoice(c => ({ ...c, [ctx.segment]: ctx.modality }))
  }, [searchTarget])
  const seg = segments.find(s => s.id === segId) || segments[0]
  const meta = TAXAS_SEGMENTS.find(s => s.id === seg?.id)
  const modalities = seg?.modalities || []
  const modality = modalities.find(m => m.name === (choice[seg?.id] || meta?.defaultModality)) || modalities[0]
  const rows = modality?.rows || []
  const ranked = rankRows(rows)
  const shown = ranked.filter(r => matchesBank(r.bank, query) && (!onlyMajor || bankBrand(r.bank).major))
  const midAm = median(rows.map(r => r[1])), midAa = median(rows.map(r => r[2]))
  const top = Math.max(...rows.map(r => r[1]), 0) || 1
  const first = rows[0], last = rows.at(-1)
  return <section className="jb-panel" aria-labelledby="jb-title">
    <div className="history-head"><h2 id="jb-title">Juros bancários</h2><RefreshButton files={['taxas-juros.json']} label="Juros bancários" /></div>
    <p className="jb-sub">Taxa média que cada banco cobrou por linha de crédito · Banco Central · {seg?.period ? `operações de ${brDate(seg.period.inicio)} a ${brDate(seg.period.fim)}` : 'período indisponível'}</p>
    {file.status === 'loading' && <p role="status">Carregando os juros dos bancos…</p>}
    {file.status === 'error' && <p role="alert">Não foi possível carregar os juros dos bancos. Use o botão de atualizar para tentar de novo.</p>}
    {(file.stale || seg?.stale) && <p role="alert" className="jb-alert">A última consulta ao Banco Central falhou. As taxas abaixo são as últimas disponíveis; confira o período.</p>}
    {seg && <div className="jb-controls">
      <div className="seg" role="group" aria-label="Público">
        {segments.map(s => <button key={s.id} type="button" aria-pressed={s.id === seg.id} onClick={() => setSegId(s.id)}>{s.label}</button>)}
      </div>
      <div className="seg" role="group" aria-label="Instituições na lista">
        <button type="button" aria-pressed={!onlyMajor} onClick={() => setOnlyMajor(false)}>Todas</button>
        <button type="button" aria-pressed={onlyMajor} onClick={() => setOnlyMajor(true)}>Grandes bancos</button>
      </div>
      {modalities.length > 0 && <ModalityPicker modalities={modalities} value={modality.name} onChange={name => setChoice(c => ({ ...c, [seg.id]: name }))} />}
      <label>Buscar banco<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome do banco ou financeira" /></label>
    </div>}
    {modality && <>
      <dl className="jb-summary">
        <div><dt>Mediana</dt><dd><strong>{pct(midAm)} a.m.</strong><small>{pct(midAa)} a.a. · {rows.length} instituições</small></dd></div>
        <div><dt>Menor taxa</dt><dd><strong>{pct(first?.[1])} a.m.</strong><small className="jb-who"><Marca bank={first[0]} />{bankBrand(first[0]).short || first[0]}</small></dd></div>
        <div><dt>Maior taxa</dt><dd><strong>{pct(last?.[1])} a.m.</strong><small className="jb-who"><Marca bank={last[0]} />{bankBrand(last[0]).short || last[0]}</small></dd></div>
      </dl>
      {!shown.length && <p role="status">{onlyMajor ? 'Nenhum dos grandes bancos informou taxa nesta modalidade.' : 'Nenhuma instituição encontrada nesta modalidade.'}</p>}
      {shown.length > 0 && <div className="jb-scroll" role="region" aria-label={`Juros de ${modalityLabel(modality.name)} por instituição`} tabIndex={0}>
        <table className="jb-table"><caption>{seg.label} · {modalityLabel(modality.name)} · {shown.length === rows.length ? `${rows.length} instituições` : `${shown.length} de ${rows.length} instituições`}, da menor para a maior taxa</caption>
          <thead><tr><th scope="col">Posição</th><th scope="col">Instituição</th><th scope="col">% a.m.</th><th scope="col">% a.a.</th></tr></thead>
          <tbody>{shown.map((r, i) => <tr key={`${r.bank}-${i}`}>
            <td className="jb-pos">{r.pos}º</td>
            <th scope="row"><span className="jb-inst"><Marca bank={r.bank} /><span className="jb-name"><Nome bank={r.bank} /></span></span>
              <span className="jb-bar" aria-hidden="true"><i style={{ width: `${Math.max(1, (r.am / top) * 100)}%` }} className={midAm !== null && r.am > midAm ? 'jb-above' : undefined} /></span></th>
            <td>{pct(r.am)}</td><td>{pct(r.aa)}</td>
          </tr>)}</tbody>
        </table></div>}
      <p className="jb-legend"><i className="jb-dot" aria-hidden="true" /> até a mediana · <i className="jb-dot jb-above" aria-hidden="true" /> acima da mediana. A posição é sempre a da lista completa; taxas iguais dividem a posição.</p>
    </>}
    {file.status === 'ok' && seg && !modality && <p role="status">O Banco Central não divulgou taxas para este público neste período.</p>}
    <details className="jb-method"><summary>Como ler estas taxas</summary>
      <ul>
        <li>É a média das operações novas de cada instituição em 5 dias úteis, ponderada pelo valor contratado. Junta clientes de todos os portes: não é a taxa que o banco ofereceria a um cliente específico.</li>
        <li>A taxa é o custo efetivo médio: juros mais encargos fiscais e operacionais, como o IOF. Nas pós-fixadas, já inclui o indexador (por exemplo, o CDI) e o spread. Compare com o CET da proposta, não com a taxa nominal.</li>
        <li>O Banco Central divulga com cerca de duas semanas de atraso. Instituição sem operação na modalidade, ou que não informou, não aparece.</li>
        <li>Na ACC, a taxa é em moeda estrangeira e não inclui a variação do câmbio. Taxa 0,00% costuma indicar crédito subsidiado da própria rede (por exemplo, de montadora).</li>
        <li>Grandes bancos: Banco do Brasil, Bradesco, BTG Pactual, Caixa, Itaú Unibanco, Safra e Santander, com as financeiras do mesmo grupo. Os logotipos são os oficiais de cada banco; as demais instituições aparecem com as iniciais.</li>
      </ul>
      <p><a href={TAXAS_SOURCE_PAGE} target="_blank" rel="noreferrer">Taxas de juros por instituição · Banco Central</a> · <a href={TAXAS_METHOD_PAGE} target="_blank" rel="noreferrer">Metodologia</a></p>
    </details>
  </section>
}
