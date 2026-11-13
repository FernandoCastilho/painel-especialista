import './Projecoes.css'
import RefreshButton from './RefreshButton.jsx'
import { onRefresh } from './refreshBus.js'
import { Aviso } from './Avisos.jsx'
import { useEffect, useState } from 'react'
import { FOCUS_MARK, INDICATORS, INSTITUTIONS, PROJECAO_ANTIGA_DIAS, compareToFocus, idadeProjecao, scenarioValue, textoHaDias } from './scenarios.js'
import FocusHistorico from './FocusHistorico.jsx'

const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value.split('-').reverse().join('/') : 'data não informada'
const YEARS = ['2026', '2027']
const format = (value) => value === null ? '—' : value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function Projecoes({ macro, searchTarget }) {
  const [year, setYear] = useState('2026')
  useEffect(()=>{const target=searchTarget?.context?.year;if(YEARS.includes(target))setYear(target)},[searchTarget])
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
  const idades = Object.fromEntries(INSTITUTIONS.slice(1).map((name) => [name, idadeProjecao(banks?.institutions?.find((item) => item.name === name)?.date)]))
  const algumaAntiga = Object.values(idades).some((idade) => idade?.antiga)
  return (
    <section className="scenarios" aria-labelledby="scenarios-heading">
      <div className="history-head">
        <h2 id="scenarios-heading">Cenário econômico</h2>
        <RefreshButton files={['cenarios.json', 'macro.json', 'focus-history.json']} label="Cenário econômico" />
        <div className="seg scenario-year" role="group" aria-label="Ano das projeções">
          {YEARS.map((y) => <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      </div>
      <article className="chart">
        <div className="scroll scenario-scroll" tabIndex={0} role="region" aria-label="Comparação das projeções por instituição">
          <table className="focus-table scenario-table" data-year={year}>
            <caption>Projeções por instituição, comparadas com o Focus da mesma coluna: <b className="fm up">▲</b> acima · <b className="fm down">▼</b> abaixo · <b className="fm same">=</b> igual (2 casas) · — sem projeção.</caption>
            <thead>
              <tr><th scope="col" rowSpan={2}>Instituição</th>{YEARS.map((y) => <th scope="colgroup" colSpan={INDICATORS.length} key={y} data-y={y} className="sc-year">{y}</th>)}</tr>
              <tr>{YEARS.map((y) => INDICATORS.map((indicator, i) => <th scope="col" key={`${y}-${indicator.id}`} data-y={y} className={i === 0 ? 'sc-first' : undefined} title={indicator.unit}>{indicator.label}<small>{indicator.unit.split(' · ')[0]}</small></th>))}</tr>
            </thead>
            <tbody>{INSTITUTIONS.map((name) => {
              const ref = name === 'FOCUS'
              const idade = idades[name]
              return <tr key={name} className={ref ? 'sc-ref' : undefined}>
                <th scope="row">{ref ? 'Focus' : name}
                  {ref
                    ? <small>mediana<span className="sc-wide"> do mercado</span>{focus && <><span className="sc-sep"> · </span><span className="sc-age">até {date(focus.date).slice(0, 5)}</span></>}</small>
                    : banks && <small>{idade?.antiga && <span className="sc-warn" aria-hidden="true">⚠ </span>}{idade ? <>{idade.data}<span className="sc-sep"> · </span><span className="sc-age">{textoHaDias(idade)}</span></> : 'fonte pendente'}{idade?.antiga && <span className="sc-sr"> · pode estar desatualizada</span>}</small>}
                </th>
                {YEARS.map((y) => INDICATORS.map((indicator, i) => {
                  const value = scenarioValue(name, indicator, y, focus, banks)
                  const cmp = ref ? null : compareToFocus(value, scenarioValue('FOCUS', indicator, y, focus, banks))
                  const mark = cmp && FOCUS_MARK[cmp]
                  return <td key={`${y}-${indicator.id}`} data-y={y} className={[i === 0 && 'sc-first', value === null && 'sc-nil'].filter(Boolean).join(' ') || undefined}>{format(value)}{mark && <span className={`fm ${cmp}`} role="img" aria-label={mark.text} title={mark.text}>{mark.symbol}</span>}</td>
                }))}
              </tr>
            })}</tbody>
          </table>
        </div>
        {algumaAntiga && <p className="scenario-note"><span className="sc-warn" aria-hidden="true">⚠ </span>Projeção com mais de {PROJECAO_ANTIGA_DIAS} dias: pode estar desatualizada.</p>}
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
