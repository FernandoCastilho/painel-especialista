import './MarketContext.css'
import { useMemo, useState } from 'react'
import { Aviso } from './Avisos.jsx'
import IndicatorHistory from './IndicatorHistory.jsx'
import InflacaoPesos from './InflacaoPesos.jsx'
import IndicatorTable from './IndicatorTable.jsx'
import RefreshButton from './RefreshButton.jsx'
import { useDataFile } from './useDataFile.js'
import { ipcaRows, ipcaSeries, normalizeIpca } from './ipca.js'
import { dividaRows, dividaSeries, normalizeDivida } from './divida.js'
import { nf } from './format.js'

const sgn = (v, d, unit = '') => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d) + unit
const monthName = (period) => new Date(`${period}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('.', '')

// Cenários › Inflação: IPCA oficial, o quadro "o que pesa" e, abaixo, a seção Fiscal (dívida bruta), que antes era um assunto à parte.
// #cenarios/inflacao/fiscal abre a tela já na seção Fiscal (id cen-fiscal).
export default function Outros({ macro }) {
  const file = useDataFile('ipca.json')
  const parsed = useMemo(() => { try { return file.data ? normalizeIpca(file.data) : null } catch { return null } }, [file.data])
  const rows = useMemo(() => (parsed ? ipcaRows(parsed) : []), [parsed])
  const [openId, setOpenId] = useState(null)
  const row = rows.find((r) => r.metric.id === openId)
  const divida = useDataFile('divida.json')
  const dParsed = useMemo(() => { try { return divida.data ? normalizeDivida(divida.data) : null } catch { return null } }, [divida.data])
  const dRows = useMemo(() => (dParsed ? dividaRows(dParsed) : []), [dParsed])
  const [dOpenId, setDOpenId] = useState(null)
  const dRow = dRows.find((r) => r.metric.id === dOpenId)
  const dFailed = divida.status === 'error' || (divida.status === 'ok' && !dParsed)
  const dTable = dRows.map((r) => {
    const m = r.metric, u = m.pct ? '%' : '', d = m.decimals
    const delta = (v) => (v == null ? { text: '—' } : { text: sgn(v, d, m.pct ? ' p.p.' : '') })
    return {
      id: m.id, flag: 'BRL', name: m.label, sub: 'Governo Geral',
      cells: [
        { text: r.last ? `${nf(r.last.value, d)}${u}` : '—' },
        r.prev ? { text: `${nf(r.prev.value, d)}${u}` } : { text: '—' },
        delta(r.delta),
        r.yearAgo ? { text: `${nf(r.yearAgo.value, d)}${u}` } : { text: '—' },
        { text: r.peak ? `${nf(r.peak.value, d)}${u} · ${monthName(r.peak.period)}` : '—' },
        { text: r.last ? monthName(r.last.period) : '—' },
      ],
    }
  })
  const failed = file.status === 'error' || (file.status === 'ok' && !parsed)
  const fmt = (r, v) => nf(v, r.metric.decimals)
  const tableRows = rows.map((r) => {
    const pct = r.metric.rate
    return {
      id: r.metric.id, flag: 'BRL', name: r.metric.label, sub: pct ? 'IPCA' : 'IPCA · base dez/1993',
      cells: [
        { text: r.last ? `${fmt(r, r.last.value)}${pct ? '%' : ''}` : '—' },
        { text: r.prev ? `${fmt(r, r.prev.value)}${pct ? '%' : ''}` : '—' },
        r.delta == null ? { text: '—' } : pct ? { text: sgn(r.delta, 2, ' p.p.') } : { text: sgn(r.pct, 2, '%') },
        { text: r.yearAgo ? `${fmt(r, r.yearAgo.value)}${pct ? '%' : ''}` : '—' },
        { text: r.last ? monthName(r.last.period) : '—' },
      ],
    }
  })
  return (
    <div className="outros">
      <section aria-labelledby="outros-title">
      <div className="ctx-head"><h2 id="outros-title">Inflação</h2><RefreshButton files={['ipca.json', 'ipca-groups.json', 'oil.json', 'commodities.json', 'macro.json']} label="Inflação" /></div>
      <h3>IPCA</h3>
      {!parsed && <p role="status">{failed ? 'Não foi possível carregar o IPCA. Tente novamente mais tarde.' : 'Carregando IPCA…'}</p>}
      {parsed && (
        <>
          <IndicatorTable
            caption={`IPCA oficial · último mês divulgado: ${rows[0]?.last ? monthName(rows[0].last.period) : '—'}`}
            ariaLabel="Tabela do IPCA; role para ver todas as colunas"
            columns={[{ label: 'Último' }, { label: 'Mês anterior' }, { label: 'Variação', small: '(vs mês ant.)' }, { label: 'Ano anterior', small: '(mesmo mês)' }, { label: 'Referência' }]}
            rows={tableRows}
            onOpen={setOpenId}
          />
          {parsed.stale && <p className="status stale" role="status">Última série disponível; a atualização não foi confirmada.</p>}
          <Aviso title="IPCA · método"><p className="ind-note">IPCA (Índice Nacional de Preços ao Consumidor Amplo), série completa desde dez/1979. Variação mensal, acumulados no ano e em 12 meses e número-índice (dez/1993 = 100) são os valores divulgados oficialmente, sem recálculo. Em Variação, os percentuais são diferença em pontos percentuais; no número-índice, variação relativa. Conferência: {new Date(parsed.checkedAt).toLocaleDateString('pt-BR')}.</p></Aviso>
        </>
      )}
      <InflacaoPesos macro={macro} />
      </section>
      <section id="cen-fiscal" className="cen-section" aria-labelledby="fiscal-heading">
      <div className="ctx-head"><h2 id="fiscal-heading">Fiscal · dívida pública</h2><RefreshButton files={['divida.json']} label="Fiscal" /></div>
      <h3>Dívida Bruta do Governo Geral (DBGG)</h3>
      {!dParsed && <p role="status">{dFailed ? 'Não foi possível carregar a dívida bruta. Tente novamente mais tarde.' : 'Carregando dívida bruta…'}</p>}
      {dParsed && (
        <>
          <IndicatorTable
            caption={`Dívida bruta do governo geral · último mês divulgado: ${dRows[0]?.last ? monthName(dRows[0].last.period) : '—'}`}
            ariaLabel="Tabela da dívida bruta; role para ver todas as colunas"
            columns={[{ label: 'Último' }, { label: 'Mês anterior' }, { label: 'Variação', small: '(vs mês ant.)' }, { label: 'Ano anterior', small: '(mesmo mês)' }, { label: 'Máxima da série' }, { label: 'Referência' }]}
            rows={dTable}
            onOpen={setDOpenId}
          />
          {dParsed.stale && <p className="status stale" role="status">Última série disponível; a atualização não foi confirmada.</p>}
          <Aviso title="Dívida bruta · método"><p className="ind-note">Dívida Bruta do Governo Geral (DBGG): governo federal, INSS e governos estaduais e municipais, sem as empresas estatais e sem o Banco Central. Saldo ao fim do mês, divulgado nas Estatísticas Fiscais, em R$ e em % do PIB (PIB acumulado em 12 meses). Série mensal desde dez/2006, sem recálculo; meses anteriores são revisados quando muda a metodologia ou o PIB. Em Variação, a diferença da razão está em pontos percentuais do PIB e a do saldo, em R$ bilhões. Conferência: {new Date(dParsed.checkedAt).toLocaleDateString('pt-BR')}.</p></Aviso>
        </>
      )}
      </section>
      {dRow && (
        <IndicatorHistory
          item={{ id: dRow.metric.id, label: dRow.metric.label, unit: dRow.metric.unit, decimals: dRow.metric.decimals, sourceUrl: dParsed.sourceUrl, sourceName: dParsed.sourceName, checkedAt: dParsed.checkedAt }}
          series={{ id: dRow.metric.id, unit: dRow.metric.unit, frequency: 'monthly', points: dividaSeries(dParsed, dRow.metric), sourceName: dParsed.sourceName, sourceUrl: dParsed.sourceUrl, checkedAt: dParsed.checkedAt, revisionNote: 'O Banco Central pode revisar meses anteriores (metodologia, PIB e dados dos entes); o painel mostra o que está na série do SGS.' }}
          failed={!!dParsed.stale}
          onClose={() => setDOpenId(null)}
        />
      )}
      {row && (
        <IndicatorHistory
          item={{ id: row.metric.id, label: `IPCA · ${row.metric.label}`, unit: row.metric.unit, decimals: row.metric.decimals, sourceUrl: parsed.sourceUrl, sourceName: parsed.sourceName, checkedAt: parsed.checkedAt }}
          series={{ id: row.metric.id, unit: row.metric.unit, frequency: 'monthly', points: ipcaSeries(parsed, row.metric), sourceName: parsed.sourceName, sourceUrl: parsed.sourceUrl, checkedAt: parsed.checkedAt, revisionNote: 'O IBGE pode revisar divulgações anteriores em casos excepcionais; o painel mostra o que está na tabela 1737 do SIDRA.' }}
          failed={!!parsed.stale}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
