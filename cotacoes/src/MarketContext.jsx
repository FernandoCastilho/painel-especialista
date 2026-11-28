import { Aviso } from './Avisos.jsx'
import { freightBase, freightContext } from './freight.js'
import IndicatorHistory from './IndicatorHistory.jsx'
import { normalizeIndicatorHistory } from './indicatorHistory.js'
import { useEffect, useState } from 'react'
import { MARKET_IDS, COMMODITY_IDS, BRL_IDS, FUEL_IDS, contextItems, contextDate, contextValue, brentContext, coffeeNyContext, activityNeedsReview, unidadeEmDolar, filterCommodities } from './marketContext.js'
import './MarketContext.css'
import RefreshButton from './RefreshButton.jsx'
import IndicatorTable from './IndicatorTable.jsx'
import SeriesHistory from './SeriesHistory.jsx'
import { seriesStats } from './seriesStats.js'
import { amplitudeText } from './format.js'
import { variationTone } from './variationTone.js'
import { monthlyStats } from './monthlyStats.js'
import Estado from './Estado.jsx'
import { onRefresh } from './refreshBus.js'

function useContextFile(file, parse) {
  const [state, setState] = useState({data:null, failed:false})
  useEffect(() => {
    let alive = true, pending = false
    const controller = new AbortController()
    const load = async (force = false) => {
      if (pending || (document.hidden && !force)) return
      pending = true
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${file}?t=${force ? Date.now() : Math.floor(Date.now()/600000)}`, {signal:controller.signal, ...(force ? {cache:'no-store'} : {})})
        if (!response.ok) throw new Error('Fonte indisponível')
        const data = parse(await response.json())
        if (alive) setState({data, failed:false})
      } catch (error) { if (alive && error.name !== 'AbortError') setState(old => ({...old, failed:true})); if (force) throw error }
      finally { pending = false }
    }
    load()
    const off = onRefresh(files => files.includes(file) ? load(true) : undefined)
    const timer = setInterval(load, 600000)
    const resume = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', resume)
    return () => { alive=false; off(); controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange',resume) }
  }, [file, parse])
  return state
}
const parseMarket = data => contextItems(data, 'indicators', MARKET_IDS)
const parseCommodities = data => contextItems(data, 'commodities', COMMODITY_IDS)
const parseBrl = data => contextItems(data, 'commodities', BRL_IDS)
const parseFuels = data => contextItems(data, 'commodities', FUEL_IDS)
const parseBrent = data => { const item = brentContext(data); if (!item) throw new Error('Brent inválido'); return item }
const parseCoffeeNy = data => { const item = coffeeNyContext(data); if (!item) throw new Error('Café de Nova York indisponível'); return item }
const fnum = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const fsgn = (v, d = 2, suffix = '') => (v > 0 ? '+' : v < 0 ? '−' : '') + fnum(Math.abs(v), d) + suffix
const ftone = variationTone
// Frete marítimo (EUA: BLS; Japão: Banco do Japão) no mesmo formato da tabela do Mercado; cada linha abre o gráfico com os filtros.
// Os níveis têm bases diferentes (jun/1988 = 100 nos EUA, média de 2020 = 100 no Japão): compare as variações, não os pontos.
function FreightTable({entries, onOpen}) {
  const pct = v => v == null ? {text:'—'} : {text:fsgn(v, 2, '%'), tone:ftone(v)}
  const rows = entries.filter(e => e.state.data).map(({state}) => {
    const {data} = state, stats = monthlyStats(data.series.points)
    if (!stats) return null
    return {
      id:data.item.id, flag:data.item.id === 'freight-jp-sppi' ? 'JPY' : 'USD', name:data.item.label, sub:`${freightBase(data.item.id)}`,
      openLabel:`${data.item.label}: abrir histórico e gráfico`,
      cells:[
        {text:fnum(stats.last.value, 2)},
        pct(stats.pct), pct(stats.yoyPct), pct(stats.ytdPct),
        {text:contextDate(stats.last.period)},
      ],
    }
  }).filter(Boolean)
  const pending = entries.some(e => e.state.failed || e.state.data?.series.stale)
  if (!rows.length) return <Estado tipo="aviso">Dado indisponível. Não representa zero.</Estado>
  return <>
    <IndicatorTable
      caption="Índices mensais de preços do transporte marítimo · EUA e Japão"
      ariaLabel="Tabela de frete marítimo; role para ver todas as colunas"
      columns={[{label:'Índice', small:'(pontos)'},{label:'Δ mês %', aria:'Variação percentual no mês'},{label:'12 meses %', aria:'Variação percentual em 12 meses'},{label:'Ano %', aria:'Variação percentual no ano'},{label:'Referência'}]}
      rows={rows}
      onOpen={onOpen}
    />
    {pending && <Estado tipo="aviso">Último dado preservado em ao menos uma fonte; atualização não confirmada.</Estado>}
  </>
}
// Commodities no mesmo formato da tabela do Mercado: último, anterior, variação, 12 meses e ano; a linha abre o histórico quando há série.
// Brent e WTI: observações diárias; demais: médias mensais. Sem série, a linha mostra só o que a fonte divulgou e não abre gráfico.
function CommodityTable({items, failed, onOpen, caption = 'Commodities em dólar', ariaLabel = 'Tabela de commodities; role para ver todas as colunas'}) {
  const pct = v => v == null ? {text:'—'} : {text:fsgn(v, 2, '%'), tone:ftone(v)}
  const rows = items.map(item => {
    const stats = seriesStats(item.history)
    const hasValue = Number.isFinite(item.value)
    const dec = item.decimals ?? (Math.abs(item.value) >= 1000 ? 0 : 2)
    const show = v => v == null ? '—' : fnum(v, dec)
    // dayPrev: fechamento anterior do mesmo vencimento, quando a fonte trocou de contrato entre os dois pregões.
    const dayPrev = Number.isFinite(item.dayPrev) && hasValue ? item.dayPrev : null
    const prev = dayPrev ?? stats?.prev?.value ?? (Number.isFinite(item.previousValue) ? item.previousValue : null)
    let delta = stats ? stats.pct : Number.isFinite(item.variationPct) ? item.variationPct : null
    if (dayPrev) delta = (item.value / dayPrev - 1) * 100
    return {
      id:item.id, name:item.label, sub:`${item.unit} · ${item.nature}${Number.isFinite(item.dayHigh) && Number.isFinite(item.dayLow) ? ` · máx. ${show(item.dayHigh)} · mín. ${show(item.dayLow)} no dia · ${amplitudeText(item.dayHigh, item.dayLow, dec).toLowerCase()}` : ''}${dayPrev ? ` · troca de contrato na bolsa: anterior e Δ % no vencimento ${item.contract}` : ''}${stats ? '' : ' · sem histórico'}`,
      openLabel:stats ? `${item.label}: abrir gráfico e histórico` : `${item.label}: histórico indisponível`,
      cells:[
        {text:hasValue ? show(item.value) : '—'},
        {text:show(prev)},
        pct(delta), pct(stats?.yoyPct), pct(stats?.ytdPct),
        {text:item.time ? `${contextDate(item.period)}, ${item.time}` : contextDate(item.period)},
      ],
      disabled:!stats,
    }
  })
  return <>
    <IndicatorTable
      caption={caption}
      ariaLabel={ariaLabel}
      columns={[{label:'Último'},{label:'Anterior'},{label:'Δ %', small:'(vs anterior)', aria:'Variação percentual sobre a observação anterior'},{label:'12 meses %', aria:'Variação percentual em 12 meses'},{label:'Ano %', aria:'Variação percentual no ano'},{label:'Referência'}]}
      rows={rows}
      onOpen={onOpen}
    />
    {(failed || items.some(i => i.stale || i.value === null)) && <Estado tipo="aviso">Último dado preservado ou indisponível em alguma referência; atualização não confirmada. Dado ausente não representa zero.</Estado>}
  </>
}
// Atividade e emprego em tabela (mesmo formato do Mercado): último, anterior, variação na unidade do indicador e mesmo mês do ano anterior.
// A comparação só vale quando o último ponto do histórico é o valor mostrado; sem histórico, os campos ficam em "—" (não viram zero).
const DELTA_UNIT = { '%': ' p.p.', pontos: ' pts' }
function ActivityTable({items, series, failed, historyFailed, historyLoading, onOpen}) {
  const rows = items.map(item => {
    const points = series?.find(s=>s.id===item.id)?.points || []
    const last = points.at(-1)
    const base = last && Number.isFinite(item.value) && Math.abs(last.value - item.value) < 1e-9 ? last : null
    const prev = base ? points.at(-2) ?? null : null
    const year = base ? points.find(p=>p.period===`${Number(base.period.slice(0,4))-1}${base.period.slice(4)}`) ?? null : null
    const val = v => `${contextValue({...item, value:v})}${item.unit === '%' ? '%' : ''}`
    return {
      id:item.id, flag:/-br$|^caged$/.test(item.id) ? 'BRL' : 'USD', name:item.label, sub:item.nature,
      openLabel:`${item.label}: abrir gráfico e histórico`,
      cells:[
        {text:val(item.value)},
        {text:prev ? val(prev.value) : '—'},
        {text:prev ? `${prev.value === item.value ? '' : item.value > prev.value ? '+' : '−'}${contextValue({...item, value:Math.abs(item.value - prev.value)})}${DELTA_UNIT[item.unit] ?? ''}` : '—', tone: prev ? variationTone(item.value - prev.value) : null},
        {text:year ? val(year.value) : '—'},
        {text:contextDate(item.period)},
        {text:contextDate(item.releaseDate)},
      ],
    }
  })
  return <>
    <IndicatorTable
      caption="Últimas leituras cadastradas"
      ariaLabel="Tabela de atividade e emprego; role para ver todas as colunas"
      columns={[{label:'Último'},{label:'Anterior'},{label:'Variação', small:'(vs anterior)'},{label:'Ano anterior', small:'(mesmo período)'},{label:'Referência'},{label:'Divulgação'}]}
      rows={rows}
      onOpen={onOpen}
    />
    {(failed || historyFailed) && <Estado tipo="aviso">Último dado preservado; atualização não confirmada.</Estado>}
    {items.some(item => activityNeedsReview(item)) && <Estado tipo="aviso">Alguns indicadores podem estar atrás da última divulgação. Confira a data de cada linha e a fonte.</Estado>}
    {historyLoading && <Estado>Carregando histórico para as comparações…</Estado>}
    {items.some(i=>i.value===null) && <Estado tipo="aviso">Dado indisponível em algum indicador. Não representa zero.</Estado>}
    <details><summary>Fontes e conferência dos indicadores</summary><p>Dados observados, com competências diferentes. Prazo de conferência editorial: até sete dias ou a próxima divulgação conhecida, quando cadastrada, o que ocorrer primeiro. Conferência vencida é sinalizada; o horário da consulta não altera a competência.</p><ul>{items.map(item => <li key={item.id}><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.label} · {item.sourceName}</a> — referência {contextDate(item.period)}; conferência {contextDate(item.checkedAt?.slice(0, 10))}{item.nextReviewAt && <>; próxima conferência até {contextDate(item.nextReviewAt.slice(0, 10))}</>}{item.nextReleaseSourceUrl && <> · <a href={item.nextReleaseSourceUrl} target="_blank" rel="noopener noreferrer">calendário da próxima divulgação</a></>}{activityNeedsReview(item) ? ' · pendente' : ''}.</li>)}</ul></details>
  </>
}
function Cards({state, children}) {
  return <>{!state.data && <Estado tipo={state.failed ? 'erro' : 'info'}>{state.failed ? 'Não foi possível carregar os dados.' : 'Carregando dados…'}</Estado>}{children}</>
}
// `so` (opcional, usado pela aba Apresentar): mostra só um quadro de Commodities: 'usd', 'brl', 'combustiveis' ou 'frete'.
export default function MarketContext({ part = '', so = '' }) {
  const [open,setOpen] = useState(null)
  const [openCommodity,setOpenCommodity] = useState(null)
  const [commodityQuery, setCommodityQuery] = useState('')
  const history = useContextFile('indicator-history.json', normalizeIndicatorHistory)
  const market = useContextFile('market-indicators.json', parseMarket)
  const commodities = useContextFile('commodities.json', parseCommodities)
  const brent = useContextFile('oil.json', parseBrent)
  const coffeeNy = useContextFile('insumos-precos.json', parseCoffeeNy)
  const brl = useContextFile('commodities-brl.json', parseBrl)
  const fuels = useContextFile('fuels.json', parseFuels)
  const freight = useContextFile('freight.json', freightContext)
  const freightJp = useContextFile('freight-jp.json', freightContext)
  const freightStates = { 'freight-us-ppi': freight, 'freight-jp-sppi': freightJp }
  // unidade mostrada sempre como US$ e US¢ (o arquivo de dados continua com USD)
  const usd = [brent.data, ...(commodities.data || [])].filter(Boolean)
  // Café diário de Nova York logo abaixo da média mensal do café (ou no fim, se a média não veio).
  const coffeeAt = usd.findIndex(i => i.id === 'coffee')
  if (coffeeNy.data) usd.splice(coffeeAt < 0 ? usd.length : coffeeAt + 1, 0, coffeeNy.data)
  const all = usd.map(item => ({...item, unit:unidadeEmDolar(item.unit)}))
  const query = so ? '' : commodityQuery
  const filteredUsd = filterCommodities(all, query)
  const filteredBrl = filterCommodities(brl.data ?? [], query)
  const filteredFuels = filterCommodities(fuels.data ?? [], query)
  const totalCommodities = all.length + (brl.data?.length ?? 0) + (fuels.data?.length ?? 0)
  const matchCount = filteredUsd.length + filteredBrl.length + filteredFuels.length
  return <div className="market-context">
    {openCommodity && <SeriesHistory item={openCommodity} points={openCommodity.history || []} onClose={()=>setOpenCommodity(null)} />}
    {open && <IndicatorHistory item={open} series={freightStates[open.id] ? freightStates[open.id].data?.series : history.data?.find(s=>s.id===open.id)} loading={freightStates[open.id] ? !freightStates[open.id].data&&!freightStates[open.id].failed : !history.data&&!history.failed} failed={freightStates[open.id] ? freightStates[open.id].failed || freightStates[open.id].data?.series.stale : history.failed} onClose={()=>setOpen(null)}/>}
    {(!part || part === 'atividade') && <section aria-labelledby="market-context-heading"><div className="ctx-head"><h2 id="market-context-heading">Indicadores de mercado</h2><RefreshButton files={['market-indicators.json', 'indicator-history.json']} label="Indicadores de mercado" /></div>
      <Aviso title="Atividade e emprego"><p className="context-intro">Atividade e emprego. Indicadores observados, não projeções. Competências e datas de divulgação diferem.</p></Aviso>
      <Cards state={market}>{market.data && <ActivityTable items={market.data} series={history.data} historyFailed={history.failed} historyLoading={!history.data&&!history.failed} failed={market.failed} onOpen={id=>setOpen(market.data.find(i=>i.id===id))} />}</Cards>
      {market.data && market.data.length < MARKET_IDS.length && <Estado tipo="aviso">Cobertura parcial: alguns indicadores não puderam ser carregados.</Estado>}
      <Aviso title="Atividade e emprego · método"><p className="context-method">Leituras conferidas manualmente; não há atualização automática destes indicadores. PMI ISM em pontos: acima de 50 indica expansão; abaixo de 50, contração. Saldos de emprego podem ser negativos e sujeitos a revisão.</p></Aviso>
    </section>}
    {(!part || part === 'commodities') && so !== 'frete' && <section aria-labelledby="commodities-context-heading"><div className="ctx-head"><h2 id="commodities-context-heading">Commodities</h2><RefreshButton files={['commodities.json', 'oil.json', 'insumos-precos.json', 'commodities-brl.json', 'fuels.json']} label="Commodities" /></div>
      <Aviso title="Commodities"><p className="context-intro">Referências em dólar, incluindo exportações brasileiras de celulose. Petróleo spot diário e demais produtos em médias mensais. O café arábica tem também a cotação diária da bolsa de Nova York (contrato futuro), atrasada e não oficial. Nada aqui é preço em tempo real.</p></Aviso>
      {!so && <div className="commodity-search">
        <label htmlFor="commodity-query">Buscar commodity</label>
        <div className="commodity-search__field">
          <input id="commodity-query" type="text" inputMode="search" autoComplete="off" value={commodityQuery} onChange={event => setCommodityQuery(event.target.value)} placeholder="Ex.: café, soja ou petróleo" />
          {commodityQuery && <button type="button" onClick={event => {
            event.currentTarget.parentElement.querySelector('input').focus()
            setCommodityQuery('')
          }}>Limpar</button>}
        </div>
        {query.trim() && totalCommodities > 0 && <p role="status">{matchCount === 0 ? 'Nenhuma commodity encontrada nos dados disponíveis.' : matchCount === 1 ? '1 referência encontrada.' : `${matchCount} referências encontradas.`}</p>}
      </div>}
      {(!so || so === 'usd') && <>
      {!all.length && <Estado tipo={commodities.failed || brent.failed ? 'erro' : 'info'}>{commodities.failed || brent.failed ? 'Não foi possível carregar as referências.' : 'Carregando referências…'}</Estado>}
      {filteredUsd.length > 0 && <CommodityTable items={filteredUsd} failed={commodities.failed || brent.failed} onOpen={id => setOpenCommodity(all.find(i => i.id === id))} />}
      {all.length > 0 && (!brent.data || !commodities.data || commodities.data.length < COMMODITY_IDS.length) && <Estado tipo="aviso">Cobertura parcial: uma das fontes ainda não está disponível.</Estado>}
      <Aviso title="Commodities · método"><p className="context-method">Em falhas, o painel preserva a última referência. A data da atualização não é a data do preço. Frequência de publicação e unidades variam; valores ausentes nunca são convertidos em zero. Petróleo, gás natural, diesel e gasolina de Nova York: spot diário (gás em US$/MMBtu; derivados em US$/galão, na costa leste dos EUA, antes de impostos, margens e frete). Açúcar e café: média mensal convertida de US$/kg para US¢/libra-peso, a unidade de mercado. Café arábica · bolsa de Nova York: contrato futuro "C" da ICE Futures U.S. (KC), o vencimento mais próximo, em US¢/libra-peso, pelo Yahoo Finance; consulta de hora em hora nos dias úteis, com atraso da fonte. Durante o pregão, o valor é o último negócio do dia, com o horário de Brasília na coluna Referência; depois, é o fechamento. Máxima e mínima do dia aparecem quando a fonte informa; não é preço de compra à vista nem de café físico no Brasil. Celulose: preço médio FOB mensal das exportações brasileiras (MDIC/SECEX), em US$/tonelada; não é cotação spot, preço de tabela ou referência exclusiva de fibra curta ou longa. Calculado como valor FOB total dividido pelo peso líquido total, convertido de kg para tonelada (SH4 4701 a 4706; exclui aparas 4707). A coleta preserva a última referência em caso de falha.</p></Aviso>
      </>}
      {brl.data && (!so || so === 'brl') && <>
        {filteredBrl.length > 0 && <CommodityTable items={filteredBrl} failed={brl.failed} onOpen={id => setOpenCommodity(brl.data.find(i => i.id === id))} caption="Em reais · IC-Br e soja" ariaLabel="Tabela de commodities em reais; role para ver todas as colunas" />}
        {brl.data.length < BRL_IDS.length && <Estado tipo="aviso">Cobertura parcial: parte dos índices em reais não está disponível.</Estado>}
        <Aviso title="Em reais · método"><p className="context-method">IC-Br: índice de commodities calculado em reais a partir das cotações internacionais e do câmbio; mensal. Soja em R$/saca: estimativa própria, igual à soja FOB Golfo EUA (US$/tonelada) × 0,06 (saca de 60 kg) × dólar médio do mês. É uma referência de nível e de tendência: não é o preço pago ao produtor, que varia com prêmio de porto, frete e região.</p></Aviso>
      </>}
      {!brl.data && brl.failed && (!so || so === 'brl') && <Estado tipo="erro">Não foi possível carregar as commodities em reais.</Estado>}
      {fuels.data && (!so || so === 'combustiveis') && <>
        {filteredFuels.length > 0 && <CommodityTable items={filteredFuels} failed={fuels.failed} onOpen={id => setOpenCommodity(fuels.data.find(i => i.id === id))} caption="Combustíveis ao consumidor" ariaLabel="Tabela de combustíveis ao consumidor; role para ver todas as colunas" />}
        {fuels.data.length < FUEL_IDS.length && <Estado tipo="aviso">Cobertura parcial: algum combustível não está disponível.</Estado>}
        <Aviso title="Combustíveis · método"><p className="context-method">Média semanal de revenda nos postos pesquisados no Brasil (domingo a sábado), já com impostos e margens. A semana mostrada é a última divulgada, com defasagem de alguns dias. Diesel: tipo S10. O histórico começa na primeira coleta do painel e cresce a cada semana.</p></Aviso>
      </>}
      {!fuels.data && fuels.failed && (!so || so === 'combustiveis') && <Estado tipo="erro">Não foi possível carregar os preços de combustíveis.</Estado>}
    </section>}
    {/* Frete marítimo fica dentro da tela de Commodities; #cenarios/commodities/frete abre já nesta seção */}
    {(!part || part === 'commodities') && (!so || so === 'frete') && <section id="cen-frete" className="cen-section" aria-labelledby="freight-heading"><div className="ctx-head"><h2 id="freight-heading">Frete marítimo · referência de preços</h2><RefreshButton files={['freight.json', 'freight-jp.json']} label="Transporte marítimo" /></div>
      <Aviso title="Transporte marítimo"><p className="context-intro">Índices de preços do transporte marítimo dos EUA e do Japão, em bases diferentes: compare as variações, não os níveis. Não medem fretes por rota (China–Brasil, Europa–Brasil); não substituem orçamento de transportadora.</p></Aviso>
      <Cards state={freight.data || freightJp.data ? {data:true} : freight.failed && freightJp.failed ? {failed:true} : {}}><FreightTable entries={[{state:freight},{state:freightJp}]} onOpen={id => setOpen(freightStates[id].data.item)} /></Cards>
      <Aviso title="Transporte marítimo · método"><p className="context-method">Japão: índice de preços de serviços (SPPI, base 2020), item transporte marítimo de carga, mensal desde 1985. EUA: índice de preços ao produtor do transporte marítimo; mensal, não dessazonalizado, jun/1988=100. Meses não são transformados em cotações diárias.</p></Aviso>
    </section>}
  </div>
}
