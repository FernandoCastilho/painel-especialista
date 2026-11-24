import { NEWS_WINDOW_DAYS } from './newsWindow.js'
import { useNewsClock } from './useNewsClock.js'
import { useMemo } from 'react'
import Flag from './Flag.jsx'
import { CURRENCIES } from './useQuotes.js'
import { useDataFile } from './useDataFile.js'
import { juntarMoedas, normalizeReforma, normalizeTemas } from './reforma.js'
import NoticiasPorDia from './NoticiasPorDia.jsx'
import Estado from './Estado.jsx'

// Resumo › "Reforma tributária": o que a imprensa publicou sobre o tema na semana, por dia, com busca.
export default function ReformaTributaria({ simples = false }) {
  const now = useNewsClock()
  const file = useDataFile('reforma-tributaria.json')
  const data = useMemo(() => { try { return file.data ? normalizeReforma(file.data, now) : null } catch { return null } }, [file.data, now])
  return (
    <>
      {file.status === 'loading' && <Estado>Carregando a reforma tributária…</Estado>}
      {file.status === 'error' && !data && <Estado tipo="erro" erro={file.error}>Reforma tributária indisponível no momento.</Estado>}
      {file.data && !data && <Estado tipo="erro">Arquivo da reforma tributária em formato inesperado.</Estado>}
      {data && <NoticiasPorDia data={{ ...data, stale: data.stale || file.stale || file.status === 'error' }} simples={simples} ariaLabel="Reforma tributária: matérias dos últimos cinco dias" />}
    </>
  )
}

// Resumo › "Moedas": as matérias dos últimos cinco dias sobre dólar, euro, iene e yuan numa só linha do tempo, com a bandeira da moeda.
export function MoedasNoticias() {
  const now = useNewsClock()
  const file = useDataFile('temas.json')
  const data = useMemo(() => {
    try {
      const t = file.data ? normalizeTemas(file.data, now) : null
      return t ? { items: juntarMoedas(t, now), generatedAt: file.data.generatedAt, windowDays: NEWS_WINDOW_DAYS, stale: Object.keys(t).some((k) => k.startsWith('moeda-') && t[k].stale) } : null
    } catch { return null }
  }, [file.data, now])
  const nome = Object.fromEntries(CURRENCIES.map((c) => [c.code, c.name]))
  return (
    <>
      {file.status === 'loading' && <Estado>Carregando as matérias…</Estado>}
      {file.status === 'error' && !data && <Estado tipo="erro" erro={file.error}>Matérias indisponíveis no momento.</Estado>}
      {data && <NoticiasPorDia data={{ ...data, stale: data.stale || file.stale || file.status === 'error' }} simples ariaLabel="Moedas: matérias dos últimos cinco dias" prefixo={(n) => <span className="news-flags" role="img" aria-label={`Moedas: ${n.codes.map((c) => nome[c]).join(', ')}`}>{n.codes.map((c) => <Flag key={c} code={c} width={18} height={12} />)}</span>} />}
    </>
  )
}
