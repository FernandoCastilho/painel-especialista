import { validSectorStudy } from './sectorStudySchema.js'
import { useDataFile, loadDataFile } from './useDataFile.js'
import ResearchedSectorStudy from './ResearchedSectorStudy.jsx'
import RefreshButton from './RefreshButton.jsx'
import { TOPICOS_ESTUDO } from './centralSetorial.js'
import available from './sectorStudies/catalog.generated.json'

export default function SectorStudyLoader({ group, topicIndex }) {
  const key = `${group.id}-${topicIndex}`
  if (!available.includes(key)) return <>
    <p className="central-kicker">{group.label}</p><h3>{group.topics[topicIndex]}</h3>
    <p className="central-note">Tópico disponível no catálogo. Estudo setorial não incluído ainda. A pesquisa deste recorte está pendente de revisão; não há indicadores ou conclusões publicados aqui.</p>
    <h4>Estrutura para estudo</h4><ol>{TOPICOS_ESTUDO.map(topic => <li key={topic}>{topic}</li>)}</ol>
  </>
  return <AvailableStudy group={group} topicIndex={topicIndex} file={`sector-studies/${key}.json`} />
}

function AvailableStudy({ group, topicIndex, file }) {
  const resource = useDataFile(file)
  const study = resource.data
  if (validSectorStudy(study, group.id, topicIndex)) return <>
    {resource.stale && <p className="central-note" role="status">Não foi possível atualizar o estudo. Mantido o conteúdo anterior, com suas datas originais.</p>}
    <ResearchedSectorStudy key={file} study={study} />
  </>
  return <section aria-label={group.topics[topicIndex]}>
    <h3>{group.topics[topicIndex]}</h3>
    <p role="status">{resource.status === 'loading' ? 'Carregando estudo…' : 'Não foi possível carregar este estudo agora.'}</p>
    {resource.status !== 'loading' && <RefreshButton label="este estudo" custom={{ run: async () => {
      const result = await loadDataFile(file, Date.now(), true)
      return result.status === 'ok' && !result.stale && validSectorStudy(result.data, group.id, topicIndex)
    } }} />}
  </section>
}
