import { useDataFile } from './useDataFile.js'
import { normalizeEstr } from './estr.js'
import { summarizeRate } from './rateTrend.js'
const date = t => new Date(t).toLocaleDateString('pt-BR', { timeZone:'UTC' })
const n = v => v.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })
export default function RateTrend({ kind, macro, range }) {
  const policy = useDataFile('policy-rates.json'), estr = useDataFile('estr.json')
  const step = ['selic','fed','ecb','boj'].includes(kind)
  let points = [], pending = !!(macro.stale || macro.data?.stale?.[kind])
  if (['selic','cdi','sofr'].includes(kind)) points = (macro.data?.[kind] ?? []).map(([t,value])=>({t,value}))
  else if (kind === 'estr') {
    let series = null
    try { series=normalizeEstr(estr.data); points=(series.points ?? []).map(p=>({t:Date.parse(`${p.date}T12:00:00Z`),value:p.value})) } catch { /* ausência explícita abaixo */ }
    pending=!!(estr.stale || estr.status === 'error' || series?.stale)
  } else {
    const series=policy.data?.series?.[kind.toUpperCase()]
    points=(series?.usagePending ? [] : series?.points ?? []).map(p=>({t:Date.parse(`${p.date}T12:00:00Z`),value:p.upper ?? p.value}))
    pending=!!(policy.stale || series?.stale)
  }
  const result=summarizeRate(points,range,step)
  return <aside className="rate-trend" aria-label="Leitura da tendência">
    <strong>Leitura descritiva</strong>
    {!result ? <p>Sem observações suficientes no período selecionado.</p> : <>
      <p>{result.count < 2 ? (step ? 'Sem mudança registrada entre o nível de referência e o fim do período.' : 'Apenas uma observação no período: não permite avaliar tendência.') : `${result.change > 0 ? 'Alta' : result.change < 0 ? 'Queda' : 'Estabilidade'} de ${n(Math.abs(result.change))} p.p. entre as observações de ${date(result.first.t)} e ${date(result.last.t)}.`}</p>
      <p>Última observação considerada: {n(result.last.value)}% a.a. em {date(result.last.t)}.{kind === 'fed' ? ' Fed: leitura do limite superior da faixa-alvo, não da faixa inteira.' : ''}{step ? ' Séries de política monetária registram mudanças de nível, não cotações diárias.' : ''} Não é previsão.</p>
    </>}
    {pending && <p className="status stale" role="status">Atualização pendente. Leitura limitada às observações disponíveis.</p>}
  </aside>
}
