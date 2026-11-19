import CaptureButton from './CaptureButton.jsx'
import { useEffect, useRef, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { creditStats } from './inadimplencia.js'
import MultiLinhas from './MultiLinhas.jsx'
import RefreshButton from './RefreshButton.jsx'
import './Inadimplencia.css'
const fmt = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%' : '—'
const pp = v => v == null ? 'Sem comparação' : `${v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`
const month = t => new Date(t).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export default function Inadimplencia({ searchTarget }) {
  const file = useDataFile('inadimplencia.json')
  const [type, setType] = useState('total'), [period, setPeriod] = useState(36)
  useEffect(() => { const desired=searchTarget?.context?.creditType; if(['total','livres','direcionados'].includes(desired))setType(desired) },[searchTarget])
  const ref = useRef(null), [width, setWidth] = useState(600)
  useEffect(() => { const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width)))); ro.observe(ref.current); return () => ro.disconnect() }, [])
  const selected = (file.data?.series || []).filter(s => s.type === type)
  const end = Math.max(0, ...selected.flatMap(s => s.points.map(p => p.t)))
  const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - period + 1)
  const series = selected.map(s => ({ ...s, name: s.person === 'PF' ? 'Pessoa física' : 'Pessoa jurídica', color: s.person === 'PF' ? 'var(--currency-usd)' : 'var(--currency-eur)', points: s.points.filter(p => !period || p.t >= start.getTime()) }))
  return <section data-capture-surface className="credit-panel" aria-labelledby="credit-title">
    <div className="history-head"><h2 id="credit-title">Inadimplência PF e PJ</h2><CaptureButton label="Inadimplência PF e PJ" /><RefreshButton files={['inadimplencia.json']} /></div>
    <p className="muted">Crédito no Sistema Financeiro Nacional · saldo com atraso superior a 90 dias · dados mensais</p>
    <div className="credit-controls"><label>Carteira <select value={type} onChange={e => setType(e.target.value)}><option value="total">Total</option><option value="livres">Recursos livres</option><option value="direcionados">Recursos direcionados</option></select></label><label>Período <select value={period} onChange={e => setPeriod(Number(e.target.value))}><option value={12}>12 meses</option><option value={36}>3 anos</option><option value={0}>Histórico completo</option></select></label></div>
    {file.status === 'loading' && <p role="status">Carregando inadimplência…</p>}
    {file.status === 'error' && <p role="alert">Dados indisponíveis. Tente atualizar o painel.</p>}
    {file.stale && <p role="alert">Falha ao reler os dados. Exibindo a última versão disponível.</p>}
    <div className="credit-cards">{selected.map(s => { const stats = creditStats(s.points); const aged = stats.last && Date.now() - stats.last.t > 100 * 86400000; return <article className="credit-card" key={s.key}><h3>{s.person === 'PF' ? 'Pessoa física' : 'Pessoa jurídica'}</h3><strong>{fmt(stats.last?.v)}</strong><p>{stats.last ? month(stats.last.t) : 'Sem dado disponível'}</p><p>{pp(stats.month)} no mês<br />{pp(stats.year)} em 12 meses</p>{(s.stale || aged) && <p role="status">{s.stale ? 'Falha na coleta · último dado preservado' : 'Referência antiga · verificar divulgação'}</p>}<small>Última coleta válida: {s.updatedAt ? new Date(s.updatedAt).toLocaleString('pt-BR') : 'indisponível'}</small></article> })}</div>
    <div ref={ref}><MultiLinhas series={series} history={selected} frequency="month" width={width} fmt={fmt} ariaLabel="Evolução mensal da inadimplência PF e PJ, em percentual do saldo de crédito" /></div>
    <details><summary>Dados mensais do período</summary><div className="credit-table"><table><thead><tr><th>Mês</th><th>PF</th><th>PJ</th></tr></thead><tbody>{[...new Set(series.flatMap(s => s.points.map(p => p.period)))].sort().reverse().map(m => <tr key={m}><th>{m}</th>{['PF', 'PJ'].map(person => <td key={person}>{fmt(series.find(s => s.person === person)?.points.find(p => p.period === m)?.v)}</td>)}</tr>)}</tbody></table></div></details>
    <p className="muted">O indicador mede a proporção do saldo das operações com ao menos uma parcela vencida há mais de 90 dias. Não representa o percentual de pessoas ou empresas negativadas. Total inclui recursos livres e direcionados; não some as taxas.</p>
    <p className="muted">Comparabilidade: mudanças contábeis a partir de janeiro de 2025 afetam os indicadores. Variações que cruzam esse marco exigem cautela. Documentação em Configurações › Base de dados.</p>
  </section>
}
