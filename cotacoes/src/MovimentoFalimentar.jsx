import {useMemo} from 'react'
import {useDataFile} from './useDataFile.js'
import {latestMovement, movementSummary} from './movimentoFalimentar.js'

const date = d => d.split('-').reverse().join('/')
const labels = {pedido: 'RJ requerida', deferimento: 'Deferimento do processamento', concessao: 'Concessão de RJ'}
export default function MovimentoFalimentar() {
  const resource = useDataFile('movimento-falimentar.json')
  const edition = useMemo(() => {try {return latestMovement(resource.data)} catch {return null}}, [resource.data])
  if (!edition) return <div className="movement-edition" role="status">{resource.status === 'loading' ? 'Carregando a edição do Movimento Falimentar.' : 'Não foi possível confirmar a compilação do Valor. As contagens desta edição estão indisponíveis.'}</div>
  const {counts, requests, byUf} = movementSummary(edition)
  return <section className="movement-edition" aria-labelledby="movement-heading">
    <h3 id="movement-heading">Movimento Falimentar · Valor</h3>
    <p className="muted">Edição de <time dateTime={edition.source.publicationDate}>{date(edition.source.publicationDate)}</time> · consulta em {new Date(edition.source.consultedAt).toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})} · <a href={edition.source.url} target="_blank" rel="noopener noreferrer">Ver publicação no Valor</a></p>
    {(resource.stale || resource.status === 'error') && <p role="status">Não foi possível atualizar a leitura. Exibindo a última edição carregada.</p>}
    <p>Menções empresariais nesta edição</p>
    <dl className="movement-counts">{Object.entries(labels).map(([type, label]) => <div key={type}><dt>{label}</dt><dd><strong>{counts[type]}</strong> <span>{counts[type] === 1 ? 'menção' : 'menções'}</span></dd></div>)}</dl>
    <p className="movement-limits">Esta edição do Valor reúne menções empresariais e não representa o total nacional. A data é da publicação, não do protocolo. A fonte não informa o número de processos.</p>
    <p>{edition.source.coverage}</p>
    <h4>UF do endereço nas menções a pedidos</h4>
    <ul>{byUf.map(row => <li key={row.uf || 'unknown'}>{row.uf || 'UF empresarial não informada'}: {row.count} de {requests.length} menções ({row.share.toLocaleString('pt-BR', {maximumFractionDigits: 1})}%)</li>)}</ul>
    <details><summary>Ver as {requests.length} empresas mencionadas em pedidos</summary><ul className="movement-companies">{requests.map(e => <li key={e.cnpjRaw}><strong>{e.companyName}</strong><span>CNPJ: {e.cnpjRaw}</span><span>UF do endereço: {e.historicalUf || 'não informada'} · setor: não informado</span></li>)}</ul></details>
    <p className="muted">Cada menção se refere a uma empresa ou estabelecimento, não necessariamente a um processo. A UF vem do endereço informado na publicação; a comarca não foi usada para completar o endereço.</p>
  </section>
}
