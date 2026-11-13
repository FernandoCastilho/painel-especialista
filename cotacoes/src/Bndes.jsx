import { useMemo } from 'react'
import { Aviso } from './Avisos.jsx'
import Estado from './Estado.jsx'
import { FilterScope } from './ChartFilters.jsx'
import ComparaSeries from './BndesCompare.jsx'
import SeriesChart from './BndesChart.jsx'
import { Panel } from './TerminalDesk.jsx'
import { useDataFile } from './useDataFile.js'
import { useCurves } from './useCurves.js'
import { dmy } from './format.js'
import { FAMILIES, familyRows, seriesFor } from './bndesView.js'
import { buildRoute, parseRoute } from './bndesRoute.js'
import { TLP_LABEL, TLP_NOTE } from './tlp.js'
import { LCD_SNAPSHOT_AS_OF, withOfficialLcdSnapshot } from './lcdOfficialSnapshot.js'
import './Bndes.css'

const stamp = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const Delta = ({ c }) => (c ? <><span className={`bn-delta bn-${c.dir}`} title={`em relação a ${dmy(c.ref)}`}>{c.text}</span>{c.jump && <span className="bn-jump" role="img" aria-label={`salto: ${c.hint}`} title={c.hint}>salto</span>}</> : <span className="muted">—</span>)

// Cartões do topo: "como está hoje" em poucos segundos; tocar leva ao histórico da série.
const CSV = [['tfb.csv', 'TFB (8 séries)'], ['tlp.csv', TLP_LABEL], ['tfc.csv', 'TFC (24 séries)'], ['moedas.csv', 'Moedas contratuais']]
// TFB e TFC comparáveis: mesma sigla de prazo (meses) e liberação (dias); MPME = micro, pequenas e médias empresas.
const MESMO_PRAZO = [
  ['60 meses · 90 dias (TFB, TFC e TFC MPME)', ['TFB_60_90', 'C01', 'C03']],
  ['120 meses · 90 dias (TFB, TFC e TFC MPME)', ['TFB_120_90', 'C02', 'C04']],
]
const CARDS = [['tfb', 'TFB_60_90', 'TFB 60 meses · 90 dias', 'day'], ['tlp', 'TLP', TLP_LABEL, 'month'], ['tfc', 'C01', 'TFC_60.90', 'day'], ['moedas', '604', 'Dólar contratual', 'day']]

// Aba BNDES: uma só área de trabalho. Abas por família (TFB, TLP, TFC, Moedas) escolhem a tabela; clicar numa linha ou num cartão troca a série
// do gráfico; o período (atalhos e datas) é único e vale para todas as séries; as observações ficam recolhidas. Tudo mora no endereço
// (#bndes/<família>/<série>?p=<período>), então dá para copiar o link e abrir igual em outro lugar.
export default function Bndes({ view = '', onView = () => {}, embedded = false }) {
  const bndes = useDataFile('bndes.json')
  const moedas = useDataFile('moedas.json')
  const moedasData = useMemo(() => withOfficialLcdSnapshot(moedas.data), [moedas.data])
  const curves = useCurves()
  const br = curves.data?.br ?? null
  const rowsByFamily = useMemo(() => Object.fromEntries(FAMILIES.map((f) => [f.id, familyRows(f.id, bndes.data, moedasData, Date.now(), br)])), [bndes.data, moedasData, br])
  const ids = useMemo(() => Object.fromEntries(FAMILIES.map((f) => [f.id, rowsByFamily[f.id].map((r) => r.id)])), [rowsByFamily])
  const route = parseRoute(view, ids)
  const { family, id, preset, custom, compare } = route
  const go = (patch, replace = false) => onView(buildRoute({ ...route, ...patch }), replace)
  const fam = FAMILIES.find((f) => f.id === family)
  const rows = rowsByFamily[family]
  const series = useMemo(() => seriesFor(family, id, bndes.data, moedasData), [family, id, bndes.data, moedasData])
  const own = family === 'tfb' || family === 'tlp' ? bndes : moedas
  const loading = own.status === 'loading'
  // O snapshot LD1 sustenta somente Moedas; não é dado disponível de TFC.
  const ownData = family === 'moedas' ? moedasData : own.data
  const error = own.status === 'error' && !ownData ? own.error : null
  const next = rows[0]?.nextRelease
  const hasSpread = !!rows[0]?.hasSpread
  const spreadDate = rows.find((r) => r.spread)?.spread.curveDate
  const sel = rows.find((r) => r.id === id)
  // A comparação vale entre famílias: cada código é procurado na família a que pertence; o nome leva a sigla da família (TFB · …, TFC · …).
  const familyOf = useMemo(() => Object.fromEntries(FAMILIES.flatMap((f) => ids[f.id].map((cid) => [cid, f.id]))), [ids])
  const compareItems = useMemo(() => compare.filter((cid) => familyOf[cid]).map((cid) => {
    const f = familyOf[cid], label = FAMILIES.find((x) => x.id === f).label
    const s = seriesFor(f, cid, bndes.data, moedasData), r = rowsByFamily[f].find((x) => x.id === cid)
    const nome = r?.name ?? s.name, name = nome.toUpperCase().startsWith(label) ? nome : `${label} · ${nome}`
    return { id: cid, name, short: f === 'tlp' ? 'TLP · prefixada' : name, unit: s.unit, decimals: s.decimals, stepped: s.stepped, list: s.list }
  }), [compare, familyOf, rowsByFamily, bndes.data, moedasData])
  const toggleCompare = (cid) => go({ compare: compare.includes(cid) ? compare.filter((x) => x !== cid) : [...compare, cid] }, true)
  const noCompare = compare.filter((cid) => familyOf[cid] === family).length
  const lcdComparisonAvailable = ['143', 'LD1'].every((cid) => rowsByFamily.moedas.some((r) => r.id === cid && !r.missing))
  const showLcdNote = family === 'moedas' || ['143', 'LD1'].includes(id) || compare.some((cid) => ['143', 'LD1'].includes(cid))
  const lcdLastChange = rowsByFamily.moedas.find((row) => row.id === 'LD1')?.lastChange
  const period = { preset, custom, setPreset: (v) => go({ preset: v, custom: null }, true), setCustom: (c) => go({ custom: c }, true) }

  return (
    <div className="bn">
      <div className="bn-cards" role="group" aria-label="Resumo do dia">
        {CARDS.map(([f, cid, label, col]) => {
          const r = rowsByFamily[f].find((x) => x.id === cid)
          const c = r && !r.missing ? (col === 'month' ? r.month : r.day) : null
          return (
            <button key={cid} type="button" className={`bn-card${family === f && id === cid ? ' bn-on' : ''}`} aria-pressed={family === f && id === cid} aria-label={`Ver histórico: ${label}`} onClick={() => go({ family: f, id: cid })}>
              <span className="bn-card-l">{label}</span>
              <b className="bn-card-v">{r?.missing || !r ? '—' : r.text}</b>
              <span className="bn-card-d">{c ? <Delta c={c} /> : <span className="muted">{r?.missing ? 'indisponível' : '—'}</span>}</span>
              <small className="bn-card-t">{r && !r.missing ? `${col === 'month' ? 'vs mês anterior · ' : ''}${dmy(r.date)}` : ''}</small>
            </button>
          )
        })}
      </div>

      <Panel title="BNDES · taxas e moedas contratuais" note="BNDES" refresh={['bndes.json', 'moedas.json']}>
        <nav className="bn-official-links" aria-label="Linhas oficiais BNDES">
          <span>Linhas oficiais BNDES:</span>
          <a href="https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/finame-materiais-industrializados" target="_blank" rel="noopener noreferrer">Materiais Industrializados <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>
          <a href="https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-finame-bk-aquisicao-comercializacao" target="_blank" rel="noopener noreferrer">Máquinas e Equipamentos <span aria-hidden="true">↗</span><span className="sr-only"> (abre em nova aba)</span></a>
        </nav>
        <div className="seg bn-fam" role="group" aria-label="Família de séries">
          {FAMILIES.map((f) => <button key={f.id} type="button" aria-pressed={family === f.id} onClick={() => go({ family: f.id, id: undefined })}>{f.label}</button>)}
        </div>
        <h3 className="bn-sub">{fam.title}</h3>
        {(family === 'tfb' || family === 'tlp') && bndes.stale && <p className="status stale" role="status">Não foi possível atualizar as séries {fam.label}. Os dados anteriores exibidos podem estar desatualizados.</p>}
        {family === 'moedas' && (moedas.status === 'error' || moedas.stale) && <p className="status stale" role="status">Não foi possível atualizar as moedas contratuais. LD1 permanece no snapshot oficial datado; demais dados anteriores, quando disponíveis, podem estar desatualizados.</p>}
        {family === 'tfc' && moedas.stale && <p className="status stale" role="status">Não foi possível atualizar as séries TFC. Os dados anteriores exibidos podem estar desatualizados.</p>}
        {!error && rows.length > 0 && (
          <div className="bn-cmp-bar" role="group" aria-label="Comparar séries no mesmo gráfico">
            <span>Comparar no mesmo gráfico (vale entre famílias, ex.: TFB com TFC):</span>
            <button type="button" onClick={() => go({ compare: [...new Set([...compare, ...rows.filter((r) => !r.missing).map((r) => r.id)])] }, true)}>Marcar todas desta família</button>
            <button type="button" onClick={() => go({ compare: [] }, true)} disabled={!compare.length}>Limpar</button>
            <small role="status">{compare.length >= 2 ? `${compare.length} séries no gráfico${noCompare < compare.length ? ` (${noCompare} desta família)` : ''}` : compare.length === 1 ? 'Marque ao menos duas séries' : 'Marque duas ou mais séries'}</small>
          </div>
        )}
        {error ? <Estado tipo="erro" erro={error}>Séries indisponíveis agora. Voltam na próxima coleta.</Estado> : (
          <div className={`bn-scroll ${rows.length > 8 ? 'bn-grp' : ''}`} role="region" aria-label={`${fam.title}; role para ver todas as colunas`} tabIndex={0}>
            <table className="bn-table bn-main">
              <thead><tr><th scope="col">Série</th><th scope="col">Valor</th><th scope="col">Dia</th><th scope="col" className="bn-wide">Mês</th><th scope="col" className="bn-wide">Ano</th>{hasSpread && <th scope="col" className="bn-wide" title="TFB menos a taxa DI x pré (B3) do mesmo prazo e do mesmo dia da curva">Spread DI</th>}<th scope="col">Data</th></tr></thead>
              <tbody>
                {rows.flatMap((r) => [
                  <tr key={r.id} className={r.id === id ? 'bn-on' : undefined}>
                    <th scope="row">{<label className="bn-cmp"><input type="checkbox" checked={compare.includes(r.id)} disabled={r.missing} onChange={() => toggleCompare(r.id)} /><span className="sr-only">Comparar {r.name}</span></label>}<button type="button" className="bn-pick" aria-pressed={r.id === id} aria-label={`Ver histórico: ${r.name} (${r.id})`} onClick={() => go({ id: r.id })}>{r.name}<small>{r.sub}</small></button></th>
                    {r.missing ? <td colSpan={hasSpread ? 6 : 5} className="muted">{loading ? 'carregando' : 'indisponível'}</td> : (
                      <>
                        <td className="num">{r.text}{r.stale && <em className="old"> · dado anterior ({stamp(r.stale)})</em>}</td>
                        <td><Delta c={r.day} /></td><td className="bn-wide"><Delta c={r.month} /></td><td className="bn-wide"><Delta c={r.year} /></td>
                        {hasSpread && <td className="bn-wide">{r.spread ? <span className="bn-spread" title={`TFB ${r.spread.tfb.toLocaleString('pt-BR')}% (${dmy(r.spread.tfbDate)}) menos DI ${r.spread.di.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% no vértice de ${r.spread.du} dias úteis (${dmy(r.spread.curveDate)})`}>{r.spread.text}</span> : <span className="muted">—</span>}</td>}
                        <td>{dmy(r.date).slice(0, 5)}<span className="bn-yr">{dmy(r.date).slice(5)}</span></td>
                      </>
                    )}
                  </tr>,
                  // celular: Mês e Ano saem da tabela e aparecem sob a linha tocada
                  r.id === id && !r.missing ? <tr key={`${r.id}-x`} className="bn-extra"><td colSpan={4}><span>Mês <Delta c={r.month} /></span><span>Ano <Delta c={r.year} /></span>{hasSpread && r.spread && <span>Spread DI {r.spread.text}</span>}</td></tr> : null,
                ])}
              </tbody>
            </table>
          </div>
        )}
        {next && <p className="bn-def">Próxima divulgação da TLP: {dmy(next)}.</p>}
        {(family === 'tlp' || (compareItems.length >= 2 && compare.includes('TLP'))) && <p className="bn-def bn-tlp-note">{family === 'tlp' ? TLP_NOTE : `${TLP_LABEL}: ${TLP_NOTE}`}</p>}
        {showLcdNote && <p className="bn-def">LD1: as colunas Dia, Mês e Ano não se aplicam a esta série de vigências.{lcdLastChange && <> Última mudança: <Delta c={lcdLastChange} /> entre as vigências de {dmy(lcdLastChange.ref)} e {dmy(lcdLastChange.date)}.</>}</p>}
        {showLcdNote && <p className="bn-def">143 é o código do índice acumulado do BNDES, com Selic defasada em dois dias úteis, e não uma taxa anual nem série SGS do Banco Central. LD1 é a sobretaxa LCD para operações indiretas, em % a.a., fixada na contratação; seu histórico mostra as referências para novas contratações, atualizadas trimestralmente. A sobretaxa pode ser negativa; seu histórico é apresentado em degraus. LD1 usa snapshot oficial consultado em {dmy(LCD_SNAPSHOT_AS_OF)}, sem atualização automática; valores após essa cobertura não estão confirmados. A comparação tem unidades diferentes e não representa o custo total do financiamento. Não some o índice 143 à sobretaxa. Em comparação percentual, base negativa pode inverter o sinal da variação; isso não indica rentabilidade. Uma referência zero não permite normalização percentual. Dados ausentes não são substituídos por zero.</p>}
        {hasSpread && <p className="bn-def">{spreadDate ? `Spread DI: TFB de ${dmy(spreadDate)} menos a taxa DI x pré do mesmo dia, no vértice de mesmo prazo (36, 60, 84 e 120 meses ≈ 21 dias úteis por mês). Aproximação: o prazo médio do financiamento é menor que o prazo final.` : 'Spread DI indisponível: sem curva DI x pré ou sem TFB no dia da curva.'}</p>}

        {/* Atalhos de comparação num lugar só, logo acima do gráfico (antes ficavam espalhados em três pontos da tela) */}
        {(
          <div className="bn-atalhos">
            <div className="seg bn-quick" role="group" aria-label="Históricos Selic e LCD">
              <span className="bn-quick-label">Selic × LCD:</span>
              <button type="button" aria-pressed={family === 'moedas' && id === '143' && compare.length < 2} onClick={() => go({ family: 'moedas', id: '143', compare: [] })}>Selic D-2 · 143</button>
              <button type="button" aria-pressed={family === 'moedas' && id === 'LD1' && compare.length < 2} onClick={() => go({ family: 'moedas', id: 'LD1', compare: [] })}>Sobretaxa LCD · LD1</button>
              <button type="button" disabled={!lcdComparisonAvailable} onClick={() => go({ family: 'moedas', id: '143', compare: ['143', 'LD1'] })}>Comparar os históricos</button>
            </div>
          {!error && <>
          <div className="seg bn-quick" role="group" aria-label="Comparar no gráfico: TFB, TLP, TFC e dólar">
            <span className="bn-quick-label">Somar ao gráfico:</span>
            {CARDS.map(([, cid, label]) => {
              const on = compare.includes(cid)
              // sem comparação aberta, o primeiro clique junta a série do gráfico com a escolhida
              const next = on ? compare.filter((x) => x !== cid) : compare.length ? [...compare, cid] : [...new Set([id, cid])]
              return <button key={cid} type="button" aria-pressed={on} onClick={() => go({ compare: next }, true)}>{label}</button>
            })}
            {compare.length > 0 && <button type="button" onClick={() => go({ compare: [] }, true)}>Limpar</button>}
          </div>
          <div className="bn-prazo">
            <div className="seg bn-quick" role="group" aria-label="Comparar TFB e TFC de mesmo prazo">
              <span className="bn-quick-label">Mesmo prazo:</span>
              {MESMO_PRAZO.map(([label, ids]) => {
                const on = compare.length === ids.length && ids.every((x) => compare.includes(x))
                return <button key={label} type="button" aria-pressed={on} onClick={() => go({ compare: on ? [] : ids }, true)}>{label}</button>
              })}
            </div>
            <p className="bn-def">Pares pela sigla do BNDES (prazo em meses e liberação em dias: TFC_60.90 ↔ TFB_60_90). TFB de 36 e 84 meses e de liberação em 30 dias não têm TFC correspondente; as TFC_TR são corrigidas pela TR, não prefixadas, e ficam fora.</p>
          </div>
          </>}
          </div>
        )}
        <FilterScope>
          {compareItems.length >= 2 ? (
            <>
              <h3 className="bn-sub">Comparação · {compareItems.length} séries · {[...new Set(compare.map((cid) => FAMILIES.find((x) => x.id === familyOf[cid])?.label).filter(Boolean))].join(' + ')}</h3>
              <ComparaSeries items={compareItems} loading={loading} period={period} />
            </>
          ) : (
            <>
              <h3 className="bn-sub">Histórico · {series.name}</h3>
              <SeriesChart list={series.list} name={series.name} code={series.code} label="série" kind={series.kind} loading={loading} decimals={series.decimals} unit={series.unit} stepped={series.stepped} period={period} />
            </>
          )}
        </FilterScope>


        <details className="bn-src">
          <summary>Dados para o Excel (CSV)</summary>
          <p className="bn-def">Arquivos com endereço fixo, atualizados a cada coleta horária, com as séries coletadas e o mesmo snapshot datado LD1 usado na tela. LD1 não recebe atualização automática. Colunas: serie, nome, data (AAAA-MM-DD), valor (ponto decimal) e unidade. No Excel: Dados &gt; Obter Dados &gt; Da Web, cole o endereço; se o valor vier como texto, mude a localidade da coluna para Inglês (EUA).</p>
          <ul className="bn-csv">
            {CSV.map(([file, label]) => { const url = new URL(`./csv/${file}`, window.location.href).href; return <li key={file}><a href={`./csv/${file}`} download>{label}</a> <code>{url}</code></li> })}
          </ul>
        </details>
        <details className="bn-src">
          <summary>Definição · {fam.label}</summary>
          <p className="bn-def">{fam.definition}</p>
          <p className="bn-def">Variações em pontos percentuais (dólar e Selic acumulada, em %) contra o dia útil anterior e as datas de um mês e um ano antes, ou a mais próxima anterior; sem histórico suficiente, a coluna fica vazia. LD1 não usa essas colunas: sua última mudança é informada entre datas de vigência.</p>
        </details>
        <Aviso title="BNDES · taxas e moedas"><p className="bn-def">O BNDES não detalha a sigla TFC na consulta de Moedas Contratuais; os nomes e códigos seguem a tabela do banco. A TFB (taxa fixa) e a TFC são séries diferentes. O período escolhido vale para todas as séries; séries que começam depois do início do período mostram só o que existe. {embedded ? <>Use <a href={`#bndes/${buildRoute(route)}`}>Abrir este histórico com endereço próprio</a> para compartilhar a seleção de série e período.</> : <>O endereço da página guarda a série e o período: copie-o para compartilhar{sel ? ` (${sel.name})` : ''}.</>}</p></Aviso>
      </Panel>
    </div>
  )
}
