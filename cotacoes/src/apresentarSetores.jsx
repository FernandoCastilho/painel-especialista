import { useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { validSectorStudy } from './sectorStudySchema.js'
import { CATALOGO_SETORIAL } from './centralSetorial.js'
import { INSUMOS } from './insumos.js'
import { ResearchChart } from './ResearchedSectorStudy.jsx'
import SectorValueChain from './SectorValueChain.jsx'
import disponiveis from './sectorStudies/catalog.generated.json'
import { alternar } from './apresentar.js'

// Setores na aba Apresentar: cada estudo setorial publicado rende até quatro slides (resumo, cadeia, indicadores e perguntas).
// São muitos estudos, então a montagem escolhe primeiro o setor e o recorte e só então mostra os slides daquele estudo.
const PARTES = [
  ['resumo', 'Resumo executivo'],
  ['cadeia', 'Cadeia de valor'],
  ['indicadores', 'Indicadores do setor'],
  ['perguntas', 'Perguntas para a conversa'],
]
const ESTUDOS = CATALOGO_SETORIAL.flatMap((g) => g.topics.map((nome, i) => ({ grupo: g, i, nome, chave: `${g.id}-${i}` }))).filter((e) => disponiveis.includes(e.chave))
const data = (iso) => (iso ? iso.split('-').reverse().join('/') : 'data não informada')

function Estudo({ grupoId, topico, parte }) {
  const f = useDataFile(`sector-studies/${grupoId}-${topico}.json`)
  const study = f.data
  if (!validSectorStudy(study, grupoId, topico)) return <p className="sl-aviso" role="status">{f.status === 'loading' ? 'Carregando estudo…' : 'Não foi possível carregar este estudo agora.'}</p>
  const pendente = study.reviewStatus !== 'approved' && <p role="status" className="study-warning"><strong>NÃO CONFERIDO · revisão independente pendente. Versão de trabalho, não usar como estudo final.</strong></p>
  if (parte === 'cadeia') return study.diagram?.nodes?.length ? <div className="sl-estudo">{pendente}<SectorValueChain diagram={study.diagram} title={study.title} /></div> : <p className="sl-aviso">Este estudo não tem cadeia de valor desenhada.</p>
  if (parte === 'indicadores') return study.charts?.length ? <div className="sl-estudo sl-estudo-graficos">{pendente}{study.charts.map((chart) => <ResearchChart key={chart.id} chart={chart} />)}</div> : <p className="sl-aviso">Este estudo não tem séries históricas publicadas.</p>
  if (parte === 'perguntas') return <div className="sl-estudo">{pendente}<ol className="sl-estudo-perguntas">{study.canvasQuestions.map((item) => <li key={item.dimension}><strong>{item.dimension}</strong><span>{item.question}</span></li>)}</ol></div>
  return (
    <div className="sl-estudo sl-estudo-resumo">
      {pendente}
      {study.summary.map((texto, i) => <p key={texto} className={i === 0 ? 'sl-estudo-destaque' : undefined}>{texto}</p>)}
      <p className="sl-estudo-nota">Pesquisa pública de {data(study.reviewedAt)}. Os dados têm períodos próprios; a atualização não é automática.</p>
    </div>
  )
}

const idDe = (chave, parte) => `setores-${chave}-${parte}`
const BLOCOS_ESTUDOS = ESTUDOS.flatMap((e) => PARTES.map(([parte, nome]) => ({
  id: idDe(e.chave, parte), grupo: 'setores', oculto: true, label: `${e.nome} · ${nome}`, titulo: `${e.nome} · ${nome.toLowerCase()}`,
  fonte: 'estudo setorial do painel (fontes públicas citadas no estudo)', zoomMax: 1.8,
  Corpo: () => <Estudo grupoId={e.grupo.id} topico={e.i} parte={parte} />,
})))

// Escolha do estudo: setor, recorte e os slides daquele recorte.
export function SeletorEstudos({ sel, onSel }) {
  const grupos = CATALOGO_SETORIAL.filter((g) => ESTUDOS.some((e) => e.grupo.id === g.id))
  const [grupoId, setGrupoId] = useState(grupos[0]?.id)
  const recortes = ESTUDOS.filter((e) => e.grupo.id === grupoId)
  const [chave, setChave] = useState(recortes[0]?.chave)
  const atual = recortes.find((e) => e.chave === chave) ?? recortes[0]
  if (!atual) return null
  return (
    <div className="apz-estudo">
      <label>Setor
        <select value={grupoId} onChange={(e) => { setGrupoId(e.target.value); setChave(ESTUDOS.find((x) => x.grupo.id === e.target.value)?.chave) }}>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
        </select>
      </label>
      <label>Recorte do estudo
        <select value={atual.chave} onChange={(e) => setChave(e.target.value)}>
          {recortes.map((e) => <option key={e.chave} value={e.chave}>{e.nome}</option>)}
        </select>
      </label>
      <div className="apz-sub" role="group" aria-label={`Slides do estudo ${atual.nome}`}>
        {PARTES.map(([parte, nome]) => (
          <label key={parte} className="apz-opcao">
            <input type="checkbox" checked={sel.includes(idDe(atual.chave, parte))} onChange={() => onSel(alternar(sel, idDe(atual.chave, parte)))} />
            <span>{nome}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Insumos: o que move o preço (texto da Central de setores).
const BLOCOS_INSUMOS = INSUMOS.filter((i) => i.move?.length).map((i) => ({
  id: `setores-insumo-${i.id}`, grupo: 'setores', sub: 'Insumos · o que move o preço', label: i.label, titulo: `${i.label} · o que move o preço`, fonte: 'Central de setores do painel', zoomMax: 1.9,
  Corpo: () => <ul className="sl-lista">{i.move.map((texto) => <li key={texto}>{texto}</li>)}</ul>,
}))

export const SETORES = [...BLOCOS_ESTUDOS, ...BLOCOS_INSUMOS]
