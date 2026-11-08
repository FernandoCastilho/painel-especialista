import { useMemo } from 'react'
import { useDataFile } from './useDataFile.js'
import { useNewsClock } from './useNewsClock.js'
import { CURADORIA_TOPICS, normalizeCuradoria } from './curadoria.js'
import NoticiasPorDia from './NoticiasPorDia.jsx'
import Estado from './Estado.jsx'

export default function CuradoriaNoticias({ id }) {
  const now = useNewsClock()
  const file = useDataFile('curadoria-noticias.json')
  const data = useMemo(() => normalizeCuradoria(file.data, id, now), [file.data, id, now])
  const label = CURADORIA_TOPICS.find(topic => topic.id === id)?.label ?? 'Notícias'
  return <div className="curadoria-noticias">
    <h3>{label}</h3>
    {file.status === 'loading' && !data && <Estado>Carregando a curadoria…</Estado>}
    {!data && file.status !== 'loading' && <Estado tipo="erro">Curadoria indisponível no momento. Não foi possível confirmar as publicações dos últimos sete dias.</Estado>}
    {data && <NoticiasPorDia key={id} data={{ ...data, stale: data.stale || file.stale || file.status === 'error' }} windowDays={7} simples ariaLabel={`${label}: notícias dos últimos sete dias`} />}
  </div>
}
