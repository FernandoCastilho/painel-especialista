import { Aviso } from './Avisos.jsx'
import { useEffect, useState } from 'react'
import ExecutiveRatesTable from './ExecutiveRatesTable.jsx'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'
import { snapshotPeriods, snapshotRows, displayDate } from './ratesSnapshot.js'
import { useDataFile } from './useDataFile.js'
import { policyRows } from './policyRates.js'
import { estrRow, normalizeEstr } from './estr.js'
import { dataTimestamp } from './dataTimestamp.js'

export default function RatesSnapshot({ macro, onOpen }) {
  const [now, setNow] = useState(Date.now)
  const policy = useDataFile('policy-rates.json')
  const estr = useDataFile('estr.json')
  useEffect(() => startVisiblePolling(() => setNow(Date.now()), DATA_POLL_MS), [])
  const periods = snapshotPeriods(now)
  const domestic = snapshotRows({ macro: macro.data, periods, errors: {
    macro: macro.status === 'loading' ? 'Carregando juros…'
      : macro.status === 'error' ? 'Juros indisponíveis'
      : macro.stale ? 'Atualização pendente; último dado disponível' : undefined,
  } })
  const policyList = policyRows(policy.data, periods, { now, loading:policy.status === 'loading', error:policy.stale || policy.status === 'error' })
  let estrSeries = null
  try { estrSeries = estr.data ? normalizeEstr(estr.data) : null } catch { /* arquivo inválido: a linha mostra "—" */ }
  const estrLinha = estrRow(estrSeries, periods, { loading: estr.status === 'loading', error: estr.status === 'error' || !!estr.stale })
  const ecbAt = policyList.findIndex((r) => r.id === 'ECB')
  policyList.splice(ecbAt < 0 ? policyList.length : ecbAt, 0, estrLinha)
  const rows = [...domestic, ...policyList]
  const japan=policy.data?.series?.BOJ
  return <><ExecutiveRatesTable compareRates title="Juros de referência · Brasil e exterior" refresh={['macro.json', 'curves.json', 'policy-rates.json', 'estr.json']} rows={rows} onOpen={onOpen}
    periods={periods.map(p => ({ ...p, label: `${p.label} · ${displayDate(p.date)}` }))}
    description="Taxas na data indicada ou na última observação anterior. Comparação histórica de níveis, não de rendimentos acumulados. Toque em um indicador para abrir o gráfico."
    footnote="€STR é a taxa overnight do BCE (média ponderada aparada, dias úteis). Fed mostra os limites da faixa-alvo; BCE, a taxa de depósito; Japão, a série do alvo aproximado overnight. As datas de mudança da série japonesa indicam a primeira observação daquele nível. CDI e SOFR são taxas observadas de mercado — SOFR não é a taxa básica do Fed. Comparações usam a última vigência ou observação conhecida até cada data; lacunas ficam sem valor. CDI futuro e curvas por prazo ficam nas tabelas abaixo." />
    {japan?.provider==='BIS' && <Aviso title="Juros do Japão · nota"><p className="status rates-source-note">Japão: série do alvo aproximado overnight. Observações até {displayDate(japan.lastObservationDate)}; publicação semanal. Atualizado em {dataTimestamp(japan.checkedAt)}. Cobertura desde {displayDate(japan.coverageStart)}; a faixa anterior não foi convertida em uma taxa escalar.</p></Aviso>}
    </>
}
