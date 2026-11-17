import { useMemo } from 'react'
import { useDataFile } from './useDataFile.js'
import { useNewsClock } from './useNewsClock.js'
import { recentNews } from './newsWindow.js'
import { normalizeTemas } from './reforma.js'
import { normalizeSectorNews } from './sectorNews.js'
import { CURADORIA_TOPICS, normalizeCuradoria } from './curadoria.js'
import { limparManchete } from './newsTitle.js'
import { BANKING_GROUPS } from './bankingSectors.js'
import { chaveNoticia, noticiasDoSlide } from './apresentar.js'

// Notícias da aba Apresentar: cada tema junta as coleções do painel que tratam do mesmo assunto.
// fontes: [[coleção, id]] com coleção = 'manchetes' (news.json), 'temas' (temas.json), 'setor' (sector-news.json) ou 'curadoria'.
// As regras de janela e de validação são as de cada coleção; aqui só se juntam e ordenam as matérias.
const LIMITE = 6 // manchetes que cabem com boa leitura em um slide
const tenta = (f) => { try { return f() ?? [] } catch { return [] } }
const LEITORES = {
  manchetes: (data, id, now) => recentNews(data?.news?.[id], now),
  temas: (data, id, now) => normalizeTemas(data, now)[id]?.items,
  setor: (data, id, now) => normalizeSectorNews(data, now).topics[id]?.items,
  curadoria: (data, id, now) => normalizeCuradoria(data, id, now)?.items,
}

export function useNoticias(fontes) {
  const now = useNewsClock()
  const manchetes = useDataFile('news.json'), temas = useDataFile('temas.json'), setor = useDataFile('sector-news.json'), curadoria = useDataFile('curadoria-noticias.json')
  return useMemo(() => {
    const arquivos = { manchetes, temas, setor, curadoria }
    const vistos = new Set(), itens = []
    for (const [colecao, id] of fontes) {
      for (const n of tenta(() => (arquivos[colecao].data ? LEITORES[colecao](arquivos[colecao].data, id, now) : []))) {
        const chave = chaveNoticia(n)
        if (!n?.title || vistos.has(chave)) continue
        vistos.add(chave)
        itens.push({ ...n, chave })
      }
    }
    itens.sort((a, b) => (b.t ?? 0) - (a.t ?? 0))
    return { itens, carregando: !itens.length && fontes.some(([c]) => arquivos[c].status === 'loading'), falhou: !itens.length && fontes.every(([c]) => arquivos[c].status === 'error') }
  }, [fontes, now, manchetes, temas, setor, curadoria])
}

const dm = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })

function NoticiasSlide({ fontes, opcoes }) {
  const { itens, carregando, falhou } = useNoticias(fontes)
  const lista = noticiasDoSlide(itens, opcoes?.ocultas, LIMITE)
  const fora = new Set(opcoes?.ocultas ?? [])
  const sobram = itens.filter((n) => !fora.has(n.chave)).length // só conta as retiradas que ainda estão na janela de notícias
  if (!lista.length) return <p className="sl-aviso" role="status">{carregando ? 'Carregando notícias…' : falhou ? 'Notícias indisponíveis no momento.' : itens.length ? 'Todas as notícias deste tema foram tiradas da apresentação.' : 'Nenhuma notícia deste tema nos últimos dias.'}</p>
  return (
    <div className="sl-noticias">
      <ol>
        {lista.map((n) => (
          <li key={n.chave}>
            <time dateTime={new Date(n.t).toISOString()}>{dm(n.t)}</time>
            <div><a href={n.link} target="_blank" rel="noopener noreferrer">{limparManchete(n.title)}</a>{n.source && <small>{n.source}</small>}</div>
          </li>
        ))}
      </ol>
      <p className="sl-noticias-nota">{sobram > lista.length ? `As ${lista.length} mais recentes de ${sobram} notícias do período` : `${lista.length} ${lista.length === 1 ? 'notícia' : 'notícias'} do período`} · títulos das fontes originais</p>
    </div>
  )
}

// Ajuste na montagem: a lista das notícias do tema, para tirar as que não devem ir para a visita.
function NoticiasAjuste({ fontes, opcoes, onOpcoes }) {
  const { itens, carregando } = useNoticias(fontes)
  const ocultas = opcoes?.ocultas ?? []
  if (!itens.length) return <p className="apz-ajuste-nota">{carregando ? 'Carregando notícias…' : 'Sem notícias deste tema nos últimos dias.'}</p>
  const alternar = (chave) => onOpcoes({ ...opcoes, ocultas: ocultas.includes(chave) ? ocultas.filter((x) => x !== chave) : [...ocultas, chave] })
  return (
    <details className="apz-ajuste">
      <summary>Escolher notícias <small>({itens.filter((n) => !ocultas.includes(n.chave)).length} de {itens.length}; o slide mostra até {LIMITE})</small></summary>
      <ul>
        {itens.map((n) => (
          <li key={n.chave}><label><input type="checkbox" checked={!ocultas.includes(n.chave)} onChange={() => alternar(n.chave)} /><span><small>{dm(n.t)}{n.source ? ` · ${n.source}` : ''}</small>{limparManchete(n.title)}</span></label></li>
        ))}
      </ul>
    </details>
  )
}

const tema = (id, sub, label, fontes) => ({
  id: `noticias-${id}`, grupo: 'noticias', sub, label, titulo: `Notícias · ${label}`, fonte: 'veículos e órgãos indicados em cada notícia',
  Corpo: (props) => <NoticiasSlide fontes={fontes} {...props} />, Ajustes: (props) => <NoticiasAjuste fontes={fontes} {...props} />,
})
// Temas que também têm busca na imprensa (temas.json), além das fontes institucionais por setor.
const NA_IMPRENSA = ['industria', 'veiculos-pesados', 'comercio', 'servicos', 'telecom']
// Temas de setor que só existem na busca da imprensa (sem pasta própria na aba Notícias): [grupo do setor, id em temas.json, nome].
const SO_NA_IMPRENSA = [['Indústria e transformação', 'madeira', 'Madeira e base florestal']]
const COM_FONTE_SETORIAL = ['cobre', 'aluminio', 'aco', 'minerio', 'petroleo']
const INSUMOS = [['cobre', 'Cobre'], ['aluminio', 'Alumínio'], ['aco', 'Aço'], ['minerio', 'Minério de ferro'], ['petroleo', 'Petróleo e diesel'], ['trigo', 'Trigo'], ['acucar', 'Açúcar'], ['carne', 'Carne bovina'], ['algodao', 'Algodão'], ['carvao', 'Carvão'], ['cacau', 'Cacau'], ['cafe', 'Café'], ['fertilizantes', 'Fertilizantes']]

export const NOTICIAS = [
  tema('mercado', 'Mercado e moedas', 'Mercado hoje', [['manchetes', 'MERCADO']]),
  ...[['USD', 'Dólar'], ['EUR', 'Euro'], ['JPY', 'Iene'], ['CNH', 'Yuan']].map(([code, nome]) => tema(`moeda-${code.toLowerCase()}`, 'Mercado e moedas', nome, [['manchetes', code], ['temas', `moeda-${code.toLowerCase()}`]])),
  tema('eleicoes-eua', 'Mercado e moedas', 'Eleições nos EUA', [['temas', 'eleicoes-eua']]),
  ...CURADORIA_TOPICS.map((t) => tema(`curadoria-${t.id}`, 'Tributos e trabalho', t.label, [['curadoria', t.id]])),
  ...BANKING_GROUPS.flatMap((g) => [
    ...g.topics.map(([id, label]) => tema(`setor-${id}`, `Setores · ${g.label}`, label, [['setor', id], ...(NA_IMPRENSA.includes(id) ? [['temas', id]] : [])])),
    ...SO_NA_IMPRENSA.filter(([grupo]) => grupo === g.label).map(([, id, label]) => tema(`setor-${id}`, `Setores · ${g.label}`, label, [['temas', id]])),
  ]),
  ...INSUMOS.map(([id, label]) => tema(`insumo-${id}`, 'Insumos', label, [['temas', id], ...(COM_FONTE_SETORIAL.includes(id) ? [['setor', id]] : [])])),
]
