import { useMemo, useState } from 'react'
import IpcaGrupoChart from './IpcaGrupoChart.jsx'
import './InflacaoPesos.css'
import { Aviso } from './Avisos.jsx'
import { useDataFile } from './useDataFile.js'
import { useCentralDaily } from './useHistory.js'
import { accumulatedReturns } from './marketReturns.js'
import { brentReturns } from './oilReference.js'
import { FOCUS_BAND, THRESHOLDS, factorRows, groupMonthly, groupRows, normalizeIpcaGroups } from './inflacao.js'
import { nf } from './format.js'
import { displayedVariation, variationTone } from './variationTone.js'

const sg = (raw, d = 2) => { const v = displayedVariation(raw, d); return (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d) }
const monthName = (period) => new Date(`${period}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '').replace(' de ', '/')
const TREND = { up: ['▲', 'acima do mês anterior'], down: ['▼', 'abaixo do mês anterior'], same: ['=', 'igual ao mês anterior'] }
const SIGNAL = { pressure: ['▲ Pressiona', 'pressiona a inflação'], relief: ['▼ Alivia', 'alivia a inflação'], neutral: ['= Neutro', 'neutro para a inflação'] }

// Cenários › Inflação › "Inflação · o que pesa": IPCA por grupo (IBGE) e fatores de fora do índice, no cenário atual.
export default function InflacaoPesos({ macro }) {
  const groupsFile = useDataFile('ipca-groups.json')
  const oil = useDataFile('oil.json')
  const commodities = useDataFile('commodities.json')
  const daily = useCentralDaily()
  const series = useMemo(() => { try { return groupsFile.data ? normalizeIpcaGroups(groupsFile.data) : null } catch { return null } }, [groupsFile.data])
  const [picked, setPicked] = useState(null)
  const groups = useMemo(() => (series?.groups?.length ? groupRows(series) : null), [series])
  const factors = useMemo(() => {
    const m = macro?.data
    const selic = m?.selic?.at?.(-1)?.[1]
    return factorRows({
      fx: daily.data ? accumulatedReturns(daily.data, 'USD') : null,
      brent: oil.data ? brentReturns(oil.data) : null,
      commodities: commodities.data?.commodities ?? [],
      focus: m?.focus, selic: Number.isFinite(selic) ? selic : null,
    })
  }, [macro, daily.data, oil.data, commodities.data])
  const failed = groupsFile.status === 'error' || (groupsFile.status === 'ok' && !series)
  return (
    <section className="infl" aria-labelledby="infl-title">
      <h3 id="infl-title">Inflação · o que pesa</h3>
      {!groups && <p role="status">{failed ? 'Não foi possível carregar o IPCA por grupos. Tente novamente mais tarde.' : 'Carregando IPCA por grupos…'}</p>}
      {groups && (
        <>
          <p className="infl-summary" role="status">
            {groups.top ? <>Em {monthName(groups.period)}, a maior pressão veio de <b>{groups.top.name}</b> (<span className={'pct ' + variationTone(groups.top.contribution, 2)}>{sg(groups.top.contribution)} p.p.</span>)</> : <>Em {monthName(groups.period)}, nenhum grupo pressionou o índice</>}
            {groups.bottom ? <>; o maior alívio, de <b>{groups.bottom.name}</b> (<span className={'pct ' + variationTone(groups.bottom.contribution, 2)}>{sg(groups.bottom.contribution)} p.p.</span>).</> : '.'}
          </p>
          <div className="infl-wrap" role="region" aria-label="IPCA por grupos; role para ver todas as colunas" tabIndex={0}>
            <table className="infl-table">
              <caption>IPCA por grupos · {monthName(groups.period)}</caption>
              <thead><tr><th scope="col">Grupo</th><th scope="col" title="Peso do grupo no índice do mês">Peso %</th><th scope="col">Mês %</th><th scope="col" title="Peso × variação do mês ÷ 100: quanto o grupo somou ao IPCA, em pontos percentuais (aproximado)">Contribuição p.p.</th><th scope="col">vs mês anterior</th><th scope="col">12 meses %</th></tr></thead>
              <tbody>
                {groups.rows.filter((r) => !r.general).map((r) => { // o índice geral já está na tabela "Inflação · IPCA" acima
                  const t = r.trend && TREND[r.trend]
                  return (
                    <tr key={r.id} className={`infl-row${r.general ? ' infl-general' : r.id === groups.top?.id ? ' infl-top' : r.id === groups.bottom?.id ? ' infl-bottom' : ''}${picked === r.id ? ' infl-on' : ''}`} onClick={() => setPicked(picked === r.id ? null : r.id)}>
                      <th scope="row"><button type="button" className="infl-pick-btn" aria-pressed={picked === r.id} aria-label={`Ver a variação mensal de ${r.name} nos últimos 12 meses`} onClick={(e) => { e.stopPropagation(); setPicked(picked === r.id ? null : r.id) }}>{r.name}</button></th>
                      <td>{r.weight == null ? '—' : nf(r.weight)}</td>
                      <td className={'pct ' + (variationTone(r.mom, 2) ?? '')}>{r.mom == null ? '—' : sg(r.mom)}</td>
                      <td className={'pct ' + (variationTone(r.contribution, 2) ?? '')}>{r.contribution == null ? '—' : sg(r.contribution)}</td>
                      <td>{t ? <span className={`fm ${r.trend}`} role="img" aria-label={t[1]} title={`${t[1]} (${r.prevMom == null ? '—' : sg(r.prevMom)}%)`}>{t[0]}</span> : '—'}</td>
                      <td className={'pct ' + (variationTone(r.y12, 2) ?? '')}>{r.y12 == null ? '—' : nf(displayedVariation(r.y12))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {picked == null && <p className="muted infl-hint">Clique em um grupo (por exemplo, Alimentação e bebidas) para ver como ele se comportou mês a mês nos últimos 12 meses.</p>}
          {picked != null && (() => { const g = groups.rows.find((x) => x.id === picked); const months = groupMonthly(series, picked); return g && months ? <IpcaGrupoChart key={picked} name={g.name} months={months} onClose={() => setPicked(null)} /> : null })()}
          {series.stale && <p className="status stale" role="status">Última série disponível; a atualização não foi confirmada.</p>}
        </>
      )}
      <h3 id="infl-fatores">Fatores fora do índice</h3>
      <div className="infl-wrap" role="region" aria-label="Fatores que impactam a inflação; role para ver todas as colunas" tabIndex={0}>
        <table className="infl-table infl-factors">
          <caption>Como cada fator está hoje, com leitura simples por limiares</caption>
          <thead><tr><th scope="col">Fator</th><th scope="col">Leitura atual</th><th scope="col">Efeito sobre a inflação</th><th scope="col">Por quê</th></tr></thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.label}</th>
                <td>{f.reading}</td>
                <td>{f.signal ? <span className={`infl-sig ${f.signal}`} role="img" aria-label={SIGNAL[f.signal][1]}>{SIGNAL[f.signal][0]}</span> : <span className="muted">—</span>}</td>
                <td className="infl-why">{f.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Aviso title="Inflação · método">
        <p className="ind-note">IPCA por grupos (peso e variação mensais; 12 meses). Contribuição = peso × variação do mês ÷ 100, aproximada: o órgão oficial publica o impacto exato, que usa o peso do mês anterior. Câmbio: histórico central (variação no mês e no ano); petróleo: Brent spot; grãos: média mensal contra a anterior; expectativas: Boletim Focus (mediana) contra a meta de {nf(FOCUS_BAND.target, 1)}% com banda de {nf(FOCUS_BAND.floor, 1)}% a {nf(FOCUS_BAND.ceiling, 1)}%; juros: Selic meta. Efeito: <b>pressiona</b> quando o câmbio sobe {nf(THRESHOLDS.fx, 0)}% ou mais no mês, o Brent {nf(THRESHOLDS.brent, 0)}% ou mais, os grãos {nf(THRESHOLDS.grains, 0)}% ou mais, ou o Focus de 2026 passa do teto da banda; <b>alivia</b> no movimento contrário (Focus: na meta ou abaixo). Leitura direcional de curto prazo, não é projeção do IPCA. Não cobertos: energia elétrica (bandeira tarifária), preços administrados, salários e serviços.</p>
      </Aviso>
    </section>
  )
}
