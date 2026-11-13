import './Projecoes.css'
import RefreshButton from './RefreshButton.jsx'
import { onRefresh } from './refreshBus.js'
import { Aviso } from './Avisos.jsx'
import { useEffect, useState } from 'react'
import { FOCUS_MARK, INDICATORS, INSTITUTIONS, PROJECAO_ANTIGA_DIAS, compareToFocus, idadeProjecao, scenarioValue, textoIdadeProjecao } from './scenarios.js'
import FocusHistorico from './FocusHistorico.jsx'

const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value.split('-').reverse().join('/') : 'data não informada'
const format = (value) => value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Projecoes({ macro, searchTarget }) {
  const [year, setYear] = useState('2026')
  useEffect(()=>{const target=searchTarget?.context?.year;if(['2026','2027'].includes(target))setYear(target)},[searchTarget])
  const [banks, setBanks] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    const load = (force = false) => fetch(`./cenarios.json?t=${force ? Date.now() : Math.floor(Date.now() / 600000)}`, { signal: ctrl.signal, ...(force ? { cache: 'no-store' } : {}) })
      .then((response) => { if (!response.ok) throw new Error('Dados indisponíveis'); return response.json() })
      .then((data) => { setBanks(data); setFailed(false) })
      .catch((error) => { if (error.name !== 'AbortError') setFailed(true); if (force) throw error })
    load().catch(() => {})
    const off = onRefresh((files) => files.includes('cenarios.json') ? load(true) : undefined)
    return () => { off(); ctrl.abort() }
  }, [])
  const focus = macro?.data?.focus
  const ages = Object.fromEntries(INSTITUTIONS.slice(1).map((name) => [name, idadeProjecao(banks?.institutions?.find((item) => item.name === name)?.date)]))
  const someOld = Object.values(ages).some((idade) => idade?.antiga)
  return (
    <section className="scenarios" aria-labelledby="scenarios-heading">
      <div className="history-head">
        <h2 id="scenarios-heading">Cenário econômico</h2>
        <RefreshButton files={['cenarios.json', 'macro.json', 'focus-history.json']} label="Cenário econômico" />
        <label className="scenario-year">Ano <select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Ano das projeções">
          <option value="2026">2026</option><option value="2027">2027</option>
        </select></label>
      </div>
      <article className="chart">
        <p className="scroll-hint">Deslize para ver os demais bancos →</p>
        <div className="scroll scenario-scroll" tabIndex={0} role="region" aria-label={`Comparação das projeções para ${year}`}>
          <table className="focus-table scenario-table">
            <caption >Projeções para {year}, por instituição. Abaixo de cada nome, a data da projeção. Valores ausentes indicados por travessão. <span className="focus-legend">Sinais comparam cada banco com o FOCUS da mesma linha: <b className="fm up">▲</b> acima · <b className="fm down">▼</b> abaixo · <b className="fm same">=</b> igual (2 casas).</span></caption>
            <thead><tr><th scope="col">Indicador</th>{INSTITUTIONS.map((name) => {
              // data de cada coluna logo abaixo do nome: coleta do Focus ou data da projeção do banco
              const idade = name === 'FOCUS' ? idadeProjecao(focus?.date) : ages[name]
              const semData = name !== 'FOCUS' && banks && !idade
              return <th scope="col" key={name}>{name}{(idade || semData) && <small className="scenario-date" title={name === 'FOCUS' ? `Coleta até ${idade.data}` : textoIdadeProjecao(idade)}><span className="sr-only">{name === 'FOCUS' ? ' coleta até ' : ' projeção de '}</span>{idade ? idade.data : 'sem data'}</small>}</th>
            })}</tr></thead>
            <tbody>{INDICATORS.map((indicator) => <tr key={indicator.id}>
              <th scope="row">{indicator.label}<small>{indicator.unit}</small></th>
              {INSTITUTIONS.map((name) => {
                const value = scenarioValue(name, indicator, year, focus, banks)
                const cmp = name === 'FOCUS' ? null : compareToFocus(value, scenarioValue('FOCUS', indicator, year, focus, banks))
                const mark = cmp && FOCUS_MARK[cmp]
                return <td key={name} className={cmp ? `vs-focus vs-${cmp}` : undefined}>{format(value)}{mark && <span className={`fm ${cmp}`} role="img" aria-label={mark.text} title={mark.text}>{mark.symbol}</span>}</td>
              })}
            </tr>)}</tbody>
          </table>
        </div>
        {someOld && <p className="scenario-note">Há projeção de banco com mais de {PROJECAO_ANTIGA_DIAS} dias: pode estar desatualizada. Confira a data abaixo de cada nome.</p>}
        <Aviso title="Cenário econômico · método">
        <p className="status">USD: Focus = média de dezembro; Itaú BBA = dezembro; demais bancos = fim do período. Selic: Itaú = dezembro; demais fontes = fim do ano. As medidas não são idênticas. — = projeção não verificada ou indisponível, nunca zero.</p>
        <div className="scenario-sources">
          <p>Focus: {focus ? `coleta até ${date(focus.date)}` : 'indisponível'}{macro?.data?.stale?.focus ? ' · dado de reserva' : ''}.</p>
          {INSTITUTIONS.slice(1).map((name) => {
            const bank = banks?.institutions?.find((item) => item.name === name)
            return <p key={name}>{name}: {bank?.date ? date(bank.date) : 'fonte pendente'}{bank?.note ? ` · ${bank.note}` : ''}.</p>
          })}
          <p>Projeções dos bancos são revisadas manualmente; datas e metodologias podem diferir.{banks?.reviewedAt ? ` Conferidas em ${date(banks.reviewedAt)}.` : ''} Sujeitas a revisão, não constituem recomendação.</p>
        </div>
        </Aviso>
          {failed && <p role="status">Não foi possível carregar as projeções dos bancos.</p>}
      </article>
      <article className="chart"><FocusHistorico /></article>
    </section>
  )
}
