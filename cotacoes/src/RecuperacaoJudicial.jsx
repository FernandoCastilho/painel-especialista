import {useMemo,useState} from 'react'
import {useDataFile} from './useDataFile.js'
import RefreshButton from './RefreshButton.jsx'
import RecoveryHistoryPanel from './RecoveryHistoryPanel.jsx'
import {RECOVERY_STAGES,normalizeRecoveryStatus,recoveryWeek,shiftRecoveryWeek} from './recuperacao.js'
import './RecuperacaoJudicial.css'
const date=d=>d?.split('-').reverse().join('/') || 'não informada'
function RecoveryWeeklyCoverage({onSources}){
  const resource=useDataFile('recuperacao.json'),[week,setWeek]=useState(()=>recoveryWeek())
  const data=useMemo(()=>{try{return normalizeRecoveryStatus(resource.data)}catch{return null}},[resource.data])
  const today=recoveryWeek()
  return <section className="recovery-panel" aria-labelledby="recovery-heading">
    <div className="history-head"><h2 id="recovery-heading">Recuperação judicial</h2><RefreshButton files={['recuperacao.json']}/></div>
    <p className="recovery-intro">Acompanhamento de eventos por semana e de empresas por setor, com cobertura explícita.</p>
    <div className="recovery-coverage" role="status"><strong>Dados semanais por setor ainda indisponíveis</strong><p>Não há fonte nacional semanal por setor validada neste painel. Pedidos, deferimentos e concessões não foram contados. Ausência de dado não significa zero.</p></div>
    <div className="recovery-week" role="group" aria-label="Semana de acompanhamento"><button type="button" className="btn" onClick={()=>setWeek(w=>shiftRecoveryWeek(w,-7))}>Semana anterior</button><label>Semana de <input type="date" aria-label="Escolher semana de recuperação judicial" value={week.start} max={today.end} onChange={e=>{const w=recoveryWeek(e.target.value);if(w && w.start<=today.start)setWeek(w)}}/></label><button type="button" className="btn" disabled={week.start>=today.start} onClick={()=>setWeek(w=>shiftRecoveryWeek(w,7))}>Próxima semana</button></div>
    <p className="muted">{date(week.start)} a {date(week.end)} · segunda a domingo · datas civis de Brasília.</p>
    <div className="recovery-stages">{RECOVERY_STAGES.map(s=><article key={s.id}><h3>{s.title}</h3><strong><span aria-hidden="true">—</span><span className="sr-only">Dado indisponível</span></strong><p>{s.description}</p><small>Sem base semanal validada.</small></article>)}</div>
    <h3>Setores com mais pedidos na semana</h3><div className="recovery-table"><table><caption>Ranking setorial · {date(week.start)} a {date(week.end)}</caption><thead><tr><th>Setor / CNAE</th><th>Pedidos verificados</th><th>Participação</th></tr></thead><tbody><tr><td colSpan="3">Ranking indisponível para a semana selecionada. Nenhum setor foi classificado por estimativa.</td></tr></tbody></table></div>
    <div className="recovery-empty" role="status"><h3>Evolução semanal</h3><p>Sem série comparável validada para desenhar o gráfico. Não foram gerados pontos ou barras fictícios.</p></div>
    <h3>Cadastro mensal de empresas: indicador diferente</h3><p>O cadastro CNPJ contém situação especial, data dessa situação e CNAE dos estabelecimentos. Um eventual estoque de empresas com anotação cadastral de recuperação judicial será mensal e contará CNPJs básicos distintos, pelo CNAE principal da matriz.</p><p>Esse estoque não mede pedidos da semana e não identifica, sozinho, a etapa do processo. A base ainda não foi processada e validada; não há total nem distribuição setorial publicada aqui.</p>
    <details><summary>O que falta para preencher os números</summary><ul><li>Uma fonte de eventos com cobertura, datas, etapas e permissão de uso compatíveis com o painel.</li><li>Regra de contagem que diferencie processos, empresas e grupos econômicos, sem duplicar pedidos e decisões.</li><li>Para o cadastro mensal, validar os valores reais da situação especial, a codificação, a referência dos arquivos e a qualidade da ligação entre CNPJ básico e CNAE da matriz.</li></ul></details>
    {resource.status==='loading' && <p role="status">Carregando a conferência de cobertura.</p>}
    {(resource.status==='error' || resource.stale || (resource.status==='ok' && !data)) && <p role="status">Não foi possível confirmar a revisão das referências. Os números continuam indisponíveis.</p>}
    {data && <p className="recovery-review">Revisão dos endereços de referência: {new Date(data.reviewedAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}. Próxima revisão prevista: {new Date(data.nextReviewAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'})}. A rotina confere endereços semanalmente; não coleta nem valida contagens de processos.{data.sourceChecks.some(s=>!s.available) && ' A conferência automática não confirmou alguma referência.'}</p>}
    <button type="button" className="btn" onClick={onSources}>Ver referências em Base de dados</button>
  </section>
}

export default function RecuperacaoJudicial({onSources}) {
  return <>
    <RecoveryHistoryPanel />
    <details className="rj-weekly-detail">
      <summary>Conferência semanal e cadastro de referência</summary>
      <RecoveryWeeklyCoverage onSources={onSources} />
    </details>
  </>
}
