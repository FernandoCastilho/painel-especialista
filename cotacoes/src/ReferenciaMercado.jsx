import { useDataFile } from './useDataFile.js'
import './BndesPecas.css'

const pct = value => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`

export default function ReferenciaMercado({ tipos = ['pre'], prazoMeses = 48 }) {
  const curves = useDataFile('curves.json')
  const data = curves.data?.br
  const today = data?.compare?.find(item => item.id === 'hoje')
  const points = today ? data.curves[today.date] || [] : []
  const endDays = Math.max(252, prazoMeses * 21)
  const selected = points.filter(point => point[0] >= 252 && point[0] <= endDays)
  const title = tipos.includes('pre') && tipos.includes('pos') ? 'Referência de mercado · pré e pós' : tipos[0] === 'pre' ? 'Referência de mercado · DI x pré' : 'Referência de mercado · CDI futuro'
  return <section className="bndes-reference" aria-labelledby="bndes-reference-title"><header><h3 id="bndes-reference-title">{title}</h3><small>Curva encerrando em {prazoMeses} meses</small></header>{curves.status === 'loading' && <p>Carregando referência…</p>}{curves.status !== 'loading' && !selected.length && <p className="status">Referência indisponível nesta atualização.</p>}{selected.length > 0 && <div className="bndes-reference-chart" role="img" aria-label={`${title}, de 12 meses até ${prazoMeses} meses`}><svg viewBox="0 0 640 180" preserveAspectRatio="none"><polyline points={selected.map((point, index) => `${(index / Math.max(1, selected.length - 1)) * 620 + 10},${160 - ((point[1] - Math.min(...selected.map(item => item[1]))) / Math.max(.01, Math.max(...selected.map(item => item[1])) - Math.min(...selected.map(item => item[1]))) * 130)}`).join(' ')} /></svg><span>12 meses</span><span>{prazoMeses} meses</span></div>}{tipos.includes('pos') && <p className="cx-hint">CDI futuro: taxa a termo implícita nos futuros de DI. Não há curva de juro real neste painel.</p>}{selected.at(-1) && <p className="bndes-reference-value">Vértice final: <b>{pct(selected.at(-1)[1])}</b></p>}</section>
}
