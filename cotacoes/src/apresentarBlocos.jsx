import { useMemo, useState } from 'react'
import { useDataFile } from './useDataFile.js'
import { CURRENCIES } from './useQuotes.js'
import { rateTiles } from './snapshot.js'
import { normalizeIpca } from './ipca.js'
import { KpiRow } from './TerminalDesk.jsx'
import { kpiItems } from './terminal.js'
import HistoryChart from './HistoryChart.jsx'
import { CambioTabela, ResumoChart, SPARK, useCambio } from './Resumo.jsx'
import HeavyVehicles from './HeavyVehicles.jsx'
import { Panorama } from './MarketPopup.jsx'
import { marketMoment } from './marketPopup.js'
import { CdiChart, rangeFor } from './Macro.jsx'
import SofrChart from './Sofr.jsx'
import CdiFuturo from './CdiFuturo.jsx'
import { CurveDetail } from './Curves.jsx'
import { Estr, Policy } from './RateModal.jsx'
import Projecoes from './Projecoes.jsx'
import FocusHistorico from './FocusHistorico.jsx'
import Calendario from './Calendario.jsx'
import Inadimplencia from './Inadimplencia.jsx'
import RecoveryHistoryPanel from './RecoveryHistoryPanel.jsx'
import MarketContext from './MarketContext.jsx'
import SeriesHistory from './SeriesHistory.jsx'
import Indexadores from './Indexadores.jsx'
import Outros from './Outros.jsx'
import { brentContext, unidadeEmDolar, validContextItem } from './marketContext.js'
import { NOTICIAS } from './apresentarNoticias.jsx'
import { SETORES, SeletorEstudos } from './apresentarSetores.jsx'
import Bndes from './Bndes.jsx'
import SeriesChart from './BndesChart.jsx'
import { FilterScope } from './ChartFilters.jsx'
import { seriesFor } from './bndesView.js'
import { withOfficialLcdSnapshot } from './lcdOfficialSnapshot.js'
import Bancos from './Bancos.jsx'
import BankMetricHistory from './BankMetricHistory.jsx'
import { BANKS, bankComparison, latestBankPoint } from './bancos.js'
import { bankMetricLeaders } from './bancosHistory.js'
import Feriados from './Feriados.jsx'
import Calculadora from './Calculadora.jsx'
import CalculadoraSlide from './ApresentarCalculadora.jsx'

// Catálogo do que pode virar slide. Cada bloco usa a própria peça do painel (mesmos dados e mesma conta das outras abas).
// id: estável (a seleção guarda só o id) · grupo: seção da montagem · sub: subgrupo opcional · label: nome na lista ·
// titulo: título do slide (padrão: label) · fonte: rodapé do slide · Corpo: componente que recebe { ctx, opcoes, onOpcoes, ativo }.
export const GRUPOS = [
  { id: 'mercado', label: 'Mercado', aberto: true },
  { id: 'juros', label: 'Juros' },
  { id: 'cenarios', label: 'Cenários' },
  { id: 'noticias', label: 'Notícias', nota: 'Entram as notícias recentes de cada tema. Depois de marcar, use "Escolher notícias" para tirar as que não quiser.' },
  { id: 'bndes', label: 'BNDES' },
  { id: 'setores', label: 'Setores', Extra: SeletorEstudos, nota: 'Escolha o setor e o recorte para ver os slides do estudo. Mais abaixo, o que move o preço de cada insumo.' },
  { id: 'bancos', label: 'Bancos' },
  { id: 'feriados', label: 'Feriados' },
  { id: 'calculadoras', label: 'Calculadoras', nota: 'Só o resultado resumido. Os números são digitados no próprio slide, durante a apresentação.' },
]

const Aviso = ({ children }) => <p className="sl-aviso" role="status">{children}</p>

const nada = () => {}
const UM_ANO = rangeFor(365)

// Mercado: os quadros da aba Mercado hoje.
function CartoesMercado({ ctx }) {
  const ipcaFile = useDataFile('ipca.json')
  const indices = useDataFile('indices.json')
  const ipca = useMemo(() => { try { return ipcaFile.data ? normalizeIpca(ipcaFile.data) : null } catch { return null } }, [ipcaFile.data])
  const rates = rateTiles(ctx.macro?.data, ctx.curves?.data)
  // Sem nenhum indicador válido (cotações fora do ar ou ainda carregando), o slide avisa em vez de ficar em branco.
  if (!kpiItems(ctx.quotes, rates, ipca, indices.data).length) return <Aviso>Indicadores do dia indisponíveis no momento.</Aviso>
  return <KpiRow quotes={ctx.quotes} rates={rates} ipca={ipca} ibov={indices.data} macro={ctx.macro?.data} colors={ctx.colors} onOpen={nada} onRate={nada} goto={nada} />
}
function TabelaCambio({ ctx }) {
  const { returns, ptaxes } = useCambio(ctx.quotes, ctx.macro?.data?.ptax)
  return <CambioTabela quotes={ctx.quotes} returns={returns} ptaxes={ptaxes} colors={ctx.colors} />
}
const ANO_CAMBIO = rangeFor(360) // a série diária central cobre 360 dias
const moeda = (code, nome) => ({
  id: `mercado-moeda-${code}`, sub: 'Gráfico de cada moeda', label: nome, titulo: `${nome} em reais · último ano`, fonte: 'coleta central do painel (AwesomeAPI) e PTAX do Banco Central',
  Corpo: ({ ctx }) => <HistoryChart currency={CURRENCIES.find((c) => c.code === code)} color={ctx.colors?.[code]} start={ANO_CAMBIO.start} end={ANO_CAMBIO.end} />,
})
function CompararMoedas({ ctx }) {
  const [sel, setSel] = useState(['USD', 'EUR'])
  return <ResumoChart comparison colors={ctx.colors} spark={SPARK.find((s) => s.id === 'year')} selection={sel} onSelection={setSel} onPrevious={nada} />
}
// Panorama do dia: câmbio, juros futuros, Brent e "O que mudou", como no botão Panorama da aba Mercado.
function PanoramaSlide({ ctx }) {
  const oil = useDataFile('oil.json')
  const [momento] = useState(() => marketMoment())
  if (!momento) return <Aviso>O Panorama do dia não tem edição disponível neste momento.</Aviso>
  return <div className="market-popup"><Panorama slot={momento} quotes={ctx.quotes} curves={ctx.curves?.data} oil={oil.data} /></div>
}
const MERCADO = [
  { id: 'mercado-cartoes', label: 'Indicadores do dia', dica: 'Dólar, euro, IPCA, Ibovespa, Selic, CDI e DI', titulo: 'Mercado hoje', fonte: 'coleta central do painel, Banco Central, IBGE e B3', Corpo: CartoesMercado },
  { id: 'mercado-cambio', label: 'Tabela de câmbio', dica: 'Cotação, variação do dia, mês, ano e PTAX', titulo: 'Câmbio em reais', fonte: 'coleta central do painel (AwesomeAPI) e PTAX do Banco Central', Corpo: TabelaCambio },
  moeda('USD', 'Dólar'), moeda('EUR', 'Euro'), moeda('JPY', 'Iene'), moeda('CNH', 'Yuan'),
  { id: 'mercado-comparar', sub: 'Gráfico de cada moeda', label: 'Comparação entre moedas', dica: 'Variação em % no último ano', titulo: 'Moedas comparadas · último ano', fonte: 'coleta central do painel (AwesomeAPI)', Corpo: CompararMoedas },
  { id: 'mercado-panorama', sub: 'Outros quadros do Mercado', label: 'Panorama do dia', dica: 'Câmbio, juros futuros, Brent e o que mudou', titulo: 'Panorama do dia', fonte: 'coleta central do painel, B3 e EIA', classe: 'sl-panorama', Corpo: PanoramaSlide },
  { id: 'mercado-veiculos-pesados', sub: 'Outros quadros do Mercado', label: 'Veículos pesados', dica: 'Caminhões e ônibus: emplacamento, produção e exportação', titulo: 'Veículos pesados · caminhões e ônibus', fonte: 'ANFAVEA', classe: 'sl-veiculos', Corpo: () => <HeavyVehicles /> },
].map((b) => ({ ...b, grupo: 'mercado' }))

// Juros: os mesmos gráficos da aba Juros, com o último ano.
const JUROS = [
  { id: 'juros-cdi', sub: 'Brasil', label: 'CDI', titulo: 'CDI no último ano', fonte: 'Banco Central do Brasil', Corpo: ({ ctx }) => (ctx.macro?.data?.cdi?.length ? <CdiChart macro={ctx.macro.data} range={UM_ANO} /> : <Aviso>CDI indisponível no momento.</Aviso>) },
  { id: 'juros-cdi-futuro', sub: 'Brasil', label: 'CDI futuro', titulo: 'CDI futuro', fonte: 'B3, futuros de DI', Corpo: ({ ctx }) => <CdiFuturo preview curves={ctx.curves} macro={ctx.macro?.data} hol={ctx.hol} /> },
  { id: 'juros-di-pre', sub: 'Brasil', label: 'Curva DI x pré', titulo: 'Curva de juros · DI x pré', fonte: 'B3', Corpo: ({ ctx }) => <CurveDetail preview id="br" curves={ctx.curves} /> },
  { id: 'juros-cupom', sub: 'Brasil', label: 'Cupom cambial', titulo: 'Cupom cambial', fonte: 'B3', Corpo: ({ ctx }) => <CurveDetail preview id="cc" curves={ctx.curves} /> },
  { id: 'juros-sofr', sub: 'Outros países', label: 'SOFR (EUA)', titulo: 'SOFR no último ano', fonte: 'Federal Reserve de Nova York', Corpo: ({ ctx }) => (ctx.macro?.data?.sofr?.length ? <SofrChart macro={ctx.macro.data} range={UM_ANO} /> : <Aviso>SOFR indisponível no momento.</Aviso>) },
  { id: 'juros-fed', sub: 'Outros países', label: 'Fed (juro básico dos EUA)', titulo: 'Fed · faixa-alvo dos juros', fonte: 'Federal Reserve', Corpo: () => <Policy kind="fed" range={UM_ANO} /> },
  { id: 'juros-estr', sub: 'Outros países', label: '€STR (zona do euro)', titulo: '€STR no último ano', fonte: 'Banco Central Europeu', Corpo: () => <Estr range={UM_ANO} /> },
  { id: 'juros-bce', sub: 'Outros países', label: 'BCE (juro básico do euro)', titulo: 'BCE · taxa de depósito', fonte: 'Banco Central Europeu', Corpo: () => <Policy kind="ecb" range={UM_ANO} /> },
  { id: 'juros-boj', sub: 'Outros países', label: 'Japão (juro básico)', titulo: 'Banco do Japão · meta overnight', fonte: 'Banco do Japão', Corpo: () => <Policy kind="boj" range={UM_ANO} /> },
  { id: 'juros-treasuries', sub: 'Outros países', label: 'Treasuries (EUA)', titulo: 'Curva de juros dos EUA · Treasuries', fonte: 'Tesouro dos EUA', Corpo: ({ ctx }) => <CurveDetail preview id="us" curves={ctx.curves} /> },
  { id: 'juros-curva-euro', sub: 'Outros países', label: 'Curva do euro', titulo: 'Curva de juros do euro', fonte: 'Banco Central Europeu', Corpo: ({ ctx }) => <CurveDetail preview id="eu" curves={ctx.curves} /> },
].map((b) => ({ ...b, grupo: 'juros' }))

// Cenários: os quadros da aba Cenários, um por slide.
const ALTO_IMPACTO = ['high']
const focusUm = (so, nome) => ({ id: `cen-focus-${so}`, sub: 'Projeções', label: `Histórico do Focus · ${nome}`, titulo: `Focus · ${nome} nas últimas 52 semanas`, fonte: 'Boletim Focus, Banco Central do Brasil', Corpo: () => <FocusHistorico so={so} /> })
// Gráfico de 12 meses de uma referência de preço (commodity, índice em reais ou combustível).
function SerieDePreco({ arquivo, id }) {
  const f = useDataFile(arquivo)
  const bruto = id === 'brent' ? brentContext(f.data) : (f.data?.commodities ?? []).find((i) => i.id === id && validContextItem(i))
  if (!bruto) return <Aviso>{f.status === 'loading' ? 'Carregando…' : 'Esta referência não está disponível na coleta de hoje.'}</Aviso>
  return <SeriesHistory embutido item={{ ...bruto, unit: unidadeEmDolar(bruto.unit) }} points={bruto.history || []} />
}
const serie = (arquivo, sub, fonte) => ([id, nome]) => ({ id: `cen-serie-${id}`, sub, label: nome, titulo: `${nome} · últimos 12 meses`, fonte, Corpo: () => <SerieDePreco arquivo={arquivo} id={id} /> })
const COMMODITIES = [['wti', 'Petróleo WTI'], ['henry-hub', 'Gás natural (Henry Hub)'], ['ny-diesel', 'Diesel (Nova York)'], ['ny-gasoline', 'Gasolina (Nova York)'], ['gold', 'Ouro'], ['copper', 'Cobre'], ['aluminum', 'Alumínio'], ['iron-ore', 'Minério de ferro'], ['soybeans', 'Soja'], ['corn', 'Milho'], ['sugar', 'Açúcar'], ['coffee', 'Café'], ['urea', 'Ureia'], ['dap', 'Fertilizante DAP'], ['wheat', 'Trigo'], ['beef', 'Carne bovina'], ['cotton', 'Algodão'], ['coal', 'Carvão'], ['cocoa', 'Cacau'], ['pulp-br', 'Celulose (exportação do Brasil)']]
const EM_REAIS = [['ic-br', 'IC-Br geral'], ['ic-br-agro', 'IC-Br agropecuária'], ['ic-br-metal', 'IC-Br metais'], ['ic-br-energia', 'IC-Br energia'], ['soja-saca', 'Soja em R$ por saca']]
const COMBUSTIVEIS = [['anp-gasolina', 'Gasolina na bomba'], ['anp-etanol', 'Etanol na bomba'], ['anp-diesel', 'Diesel S10 na bomba'], ['anp-glp', 'Gás de cozinha (13 kg)']]
const CENARIOS = [
  { id: 'cen-projecoes', sub: 'Projeções', label: 'Focus e bancos', dica: 'PIB, IPCA, Selic e dólar para 2026 e 2027', titulo: 'Projeções · Focus e bancos', fonte: 'Boletim Focus (Banco Central) e relatórios dos bancos', classe: 'sl-projecoes', Corpo: ({ ctx }) => <Projecoes macro={ctx.macro} semHistorico /> },
  { id: 'cen-focus-hist', sub: 'Projeções', label: 'Histórico do Focus · os 4 indicadores', titulo: 'Focus nas últimas 52 semanas', fonte: 'Boletim Focus, Banco Central do Brasil', Corpo: () => <FocusHistorico /> },
  focusUm('selic', 'Selic'), focusUm('ipca', 'IPCA'), focusUm('pib', 'PIB'), focusUm('usd', 'Dólar'),
  { id: 'cen-calendario', sub: 'Agenda', label: 'Calendário econômico da semana', dica: 'Eventos de alto impacto', titulo: 'Agenda da semana · eventos de alto impacto', fonte: 'calendário do painel (órgãos oficiais)', classe: 'sl-calendario', Corpo: () => <Calendario impactoInicial={ALTO_IMPACTO} /> },
  { id: 'cen-inadimplencia', sub: 'Crédito', label: 'Inadimplência PF e PJ', titulo: 'Inadimplência · pessoa física e jurídica', fonte: 'Banco Central do Brasil', classe: 'sl-inadimplencia', Corpo: () => <Inadimplencia /> },
  { id: 'cen-rj-numeros', sub: 'Crédito', label: 'Recuperação judicial · números do período', titulo: 'Recuperação judicial · números do período', fonte: 'base histórica do painel (cobertura parcial, não é o total do país)', classe: 'sl-rj sl-rj-numeros', Corpo: () => <RecoveryHistoryPanel /> },
  { id: 'cen-rj-uf', sub: 'Crédito', label: 'Recuperação judicial · por estado', titulo: 'Recuperação judicial · distribuição por estado', fonte: 'base histórica do painel (cobertura parcial, não é o total do país)', classe: 'sl-rj sl-rj-uf', Corpo: () => <RecoveryHistoryPanel /> },
  { id: 'cen-rj-setor', sub: 'Crédito', label: 'Recuperação judicial · por setor', titulo: 'Recuperação judicial · distribuição por setor', fonte: 'base histórica do painel (cobertura parcial, não é o total do país)', classe: 'sl-rj sl-rj-setor', Corpo: () => <RecoveryHistoryPanel /> },
  { id: 'cen-atividade', sub: 'Atividade', label: 'Atividade e emprego', dica: 'PMI dos EUA, CAGED, desemprego e payroll', titulo: 'Atividade e emprego', fonte: 'ISM, CAGED, IBGE e BLS', Corpo: () => <MarketContext part="atividade" /> },
  { id: 'cen-indexadores', sub: 'Inflação e indexadores', label: 'Indexadores (TR, TBF e TLP)', titulo: 'Indexadores · TR, TBF e TLP', fonte: 'Banco Central do Brasil e BNDES', Corpo: () => <Indexadores onBndes={nada} /> },
  { id: 'cen-ipca', sub: 'Inflação e indexadores', label: 'IPCA', titulo: 'Inflação · IPCA', fonte: 'IBGE', Corpo: ({ ctx }) => <Outros macro={ctx.macro} so="ipca" /> },
  { id: 'cen-ipca-grupos', sub: 'Inflação e indexadores', label: 'IPCA por grupos', dica: 'O que mais pesou no mês', titulo: 'Inflação · IPCA por grupos', fonte: 'IBGE', classe: 'sl-pesos sl-pesos-grupos', Corpo: ({ ctx }) => <Outros macro={ctx.macro} so="pesos" /> },
  { id: 'cen-ipca-fatores', sub: 'Inflação e indexadores', label: 'Fatores que pressionam a inflação', dica: 'Câmbio, petróleo, alimentos e expectativas', titulo: 'Inflação · fatores fora do índice', fonte: 'Banco Central e fontes de preços do painel', classe: 'sl-pesos sl-pesos-fatores', Corpo: ({ ctx }) => <Outros macro={ctx.macro} so="pesos" /> },
  { id: 'cen-fiscal', sub: 'Inflação e indexadores', label: 'Dívida pública', titulo: 'Fiscal · dívida bruta do governo', fonte: 'Banco Central do Brasil', Corpo: ({ ctx }) => <Outros macro={ctx.macro} so="fiscal" /> },
  // A tabela em dólar tem mais de 20 referências: vai em dois slides complementares (nenhuma linha fica de fora).
  { id: 'cen-commodities-usd', sub: 'Commodities · tabelas', label: 'Commodities em dólar · primeira parte', dica: 'Energia, metais, minério, soja e milho', titulo: 'Commodities em dólar · primeira parte', fonte: 'EIA, Banco Mundial e demais fontes do painel', classe: 'sl-tabela-parte-1', Corpo: () => <MarketContext part="commodities" so="usd" /> },
  { id: 'cen-commodities-usd-2', sub: 'Commodities · tabelas', label: 'Commodities em dólar · segunda parte', dica: 'Açúcar, café, fertilizantes, trigo, carne, algodão, carvão, cacau e celulose', titulo: 'Commodities em dólar · segunda parte', fonte: 'EIA, Banco Mundial e demais fontes do painel', classe: 'sl-tabela-parte-2', Corpo: () => <MarketContext part="commodities" so="usd" /> },
  { id: 'cen-commodities-brl', sub: 'Commodities · tabelas', label: 'Commodities em reais', dica: 'IC-Br e soja por saca', titulo: 'Commodities em reais', fonte: 'Banco Central do Brasil (IC-Br) e estimativa do painel para a soja', Corpo: () => <MarketContext part="commodities" so="brl" /> },
  { id: 'cen-combustiveis', sub: 'Commodities · tabelas', label: 'Combustíveis ao consumidor', titulo: 'Combustíveis ao consumidor', fonte: 'ANP', Corpo: () => <MarketContext part="commodities" so="combustiveis" /> },
  { id: 'cen-frete', sub: 'Commodities · tabelas', label: 'Frete marítimo', titulo: 'Frete marítimo · referência de preços', fonte: 'BLS (EUA) e Banco do Japão', Corpo: () => <MarketContext part="commodities" so="frete" /> },
  serie('oil.json', 'Commodities · gráfico de cada uma', 'EIA')(['brent', 'Petróleo Brent']),
  ...COMMODITIES.map(serie('commodities.json', 'Commodities · gráfico de cada uma', 'EIA, Banco Mundial e demais fontes do painel')),
  ...EM_REAIS.map(serie('commodities-brl.json', 'Em reais · gráfico de cada um', 'Banco Central do Brasil (IC-Br) e estimativa do painel para a soja')),
  ...COMBUSTIVEIS.map(serie('fuels.json', 'Combustíveis · gráfico de cada um', 'ANP')),
].map((b) => ({ ...b, grupo: 'cenarios' }))

// BNDES: resumo do dia, tabela de cada família e histórico das quatro referências do resumo.
function BndesQuadro({ familia = '' }) {
  const [rota, setRota] = useState(familia)
  return <Bndes view={rota} onView={setRota} embedded />
}
function BndesHistorico({ familia, id }) {
  const bndes = useDataFile('bndes.json'), moedas = useDataFile('moedas.json')
  const moedasData = useMemo(() => withOfficialLcdSnapshot(moedas.data), [moedas.data])
  const serie = useMemo(() => seriesFor(familia, id, bndes.data, moedasData), [familia, id, bndes.data, moedasData])
  const [preset, setPreset] = useState(12), [custom, setCustom] = useState(null)
  const origem = familia === 'tfb' || familia === 'tlp' ? bndes : moedas
  return <FilterScope><SeriesChart list={serie.list} name={serie.name} code={serie.code} label="série" kind={serie.kind} loading={origem.status === 'loading'} decimals={serie.decimals} unit={serie.unit} stepped={serie.stepped} period={{ preset, custom, setPreset: (v) => { setPreset(v); setCustom(null) }, setCustom }} /></FilterScope>
}
const bndesTabela = (familia, nome, dica) => ({ id: `bndes-tabela-${familia}`, sub: 'Tabelas', label: nome, dica, titulo: `BNDES · ${nome}`, fonte: 'BNDES', classe: 'sl-bndes sl-bndes-tabela', Corpo: () => <BndesQuadro familia={familia} /> })
const bndesHistorico = (familia, id, nome) => ({ id: `bndes-historico-${id}`, sub: 'Histórico de 12 meses', label: nome, titulo: `BNDES · ${nome} em 12 meses`, fonte: 'BNDES', classe: 'sl-bndes-historico', Corpo: () => <BndesHistorico familia={familia} id={id} /> })
const BNDES = [
  { id: 'bndes-resumo', label: 'Resumo do dia', dica: 'TFB, TLP, TFC e dólar contratual', titulo: 'BNDES · resumo do dia', fonte: 'BNDES', classe: 'sl-bndes sl-bndes-resumo', zoomMax: 2, Corpo: () => <BndesQuadro /> },
  bndesTabela('tfb', 'TFB · taxa fixa', 'Todos os prazos'), bndesTabela('tlp', 'TLP'),
  // A tabela TFC tem mais de 20 séries: vai em dois slides complementares (nenhuma linha fica de fora).
  { ...bndesTabela('tfc', 'TFC · primeira parte', 'Séries do início da tabela'), id: 'bndes-tabela-tfc', classe: 'sl-bndes sl-bndes-tabela sl-bndes-parte-1' },
  { ...bndesTabela('tfc', 'TFC · segunda parte', 'Séries do fim da tabela'), id: 'bndes-tabela-tfc-2', classe: 'sl-bndes sl-bndes-tabela sl-bndes-parte-2' },
  bndesTabela('moedas', 'Moedas contratuais'),
  bndesHistorico('tfb', 'TFB_60_90', 'TFB 60 meses · 90 dias'), bndesHistorico('tlp', 'TLP', 'TLP'), bndesHistorico('tfc', 'C01', 'TFC 60.90'), bndesHistorico('moedas', '604', 'Dólar contratual'),
].map((b) => ({ ...b, grupo: 'bndes' }))

// Bancos: a tabela comparativa e o histórico de quatro indicadores.
function BancoHistorico({ metric }) {
  const file = useDataFile('bancos.json')
  const banks = (file.data?.banks || []).filter((b) => BANKS.some((item) => item.id === b.id)).map((b) => ({ ...b, logo: BANKS.find((item) => item.id === b.id).logo }))
  if (!banks.length) return <Aviso>{file.status === 'loading' ? 'Carregando balanços dos bancos…' : 'Balanços dos bancos indisponíveis no momento.'}</Aviso>
  const colunas = banks.map((bank) => { const point = latestBankPoint(bank, 'latest'); return { bank, point, previous: bankComparison(bank, point, -1) } })
  return <BankMetricHistory banks={banks} metric={metric} mode="latest" comparison={-1} initialBank={banks[0].id} ranking={bankMetricLeaders(colunas, metric)} />
}
const bancoHistorico = (metric, nome) => ({ id: `bancos-historico-${metric}`, sub: 'Histórico por indicador', label: nome, titulo: `Bancos · ${nome}`, fonte: 'Banco Central (IF.data) e resultados divulgados pelos bancos', classe: 'sl-banco-historico', Corpo: () => <BancoHistorico metric={metric} /> })
const BANCOS = [
  { id: 'bancos-tabela', label: 'Comparação dos bancos', dica: 'Capital, crédito, provisão, inadimplência e resultado', titulo: 'Bancos · capital, crédito e resultado', fonte: 'Banco Central (IF.data) e resultados divulgados pelos bancos', classe: 'sl-bancos', Corpo: () => <Bancos /> },
  bancoHistorico('basel', 'Basileia'), bancoHistorico('creditPJ', 'Carteira PJ'), bancoHistorico('nplTotal', 'Inadimplência total'), bancoHistorico('roe', 'Rentabilidade (ROE)'),
].map((b) => ({ ...b, grupo: 'bancos' }))

const FERIADOS = [
  { id: 'feriados-proximos', grupo: 'feriados', label: 'Próximos feriados', dica: 'Os três próximos meses com feriado', titulo: 'Próximos feriados', fonte: 'calendários oficiais (lei federal, B3 e praças do painel)', classe: 'sl-feriados', Corpo: ({ ctx }) => <Feriados hol={ctx.hol} /> },
]

// Calculadoras: a própria calculadora dentro do slide (mesma conta da aba Calculadoras), em dois modos:
// "Resultado" mostra só os números principais, ocupando o slide; "Dados" mostra os campos para digitar.
// Memórias de cálculo, tabelas de parcelas e planilhas ficam de fora nos dois modos (regras em Apresentar.css).
const calculadora = ([view, nome, dica, fonte = 'simulação do painel, sem valor de proposta']) => ({
  id: `calc-${view}`, grupo: 'calculadoras', label: nome, dica, titulo: nome, fonte, classe: `sl-calc sl-calc-${view}`, semAjuste: true,
  Corpo: ({ ctx }) => <CalculadoraSlide><Calculadora view={view} onView={nada} quotes={ctx.quotes} /></CalculadoraSlide>,
})
const CALCULADORAS = [
  ['giro', 'Capital de Giro', 'Parcelas, juros e total a pagar'],
  ['comparador-credito', 'Comparador de Crédito', 'Modalidades lado a lado'],
  ['operacao-di', 'Operação x DI', 'Taxa da operação contra o DI'],
  ['conta-garantida', 'Conta Garantida', 'Juros e IOF sobre saldos'],
  ['analise-desconto', 'Análise de desconto', 'Desconto de títulos contra giro'],
  ['emprestimo-4131', 'Empréstimo externo (4131)', 'Dólar ou euro, com proteção'],
  ['finimp', 'FINIMP', 'Comparação de propostas'],
  ['finame-materiais', 'BNDES · Finame Materiais'],
  ['bndes-tlp-exigivel', 'BNDES · TLP exigível'],
  ['bndes-selic-lcd', 'BNDES · Selic + LCD'],
  ['bndes-credito-tfb', 'BNDES · Crédito TFB'],
  ['cbs-caixa', 'Reforma tributária · caixa', 'CBS, créditos e giro adicional'],
  // Faturamento: os números são colados no próprio slide (modo Dados) e ficam só na tela, como na aba Calculadoras.
  ['faturamento', 'Faturamento', 'Faturamento x endividamento, contra o ano anterior', 'números informados na tela; nada é salvo nem enviado'],
].map(calculadora)

export const BLOCOS = [...MERCADO, ...JUROS, ...CENARIOS, ...NOTICIAS, ...BNDES, ...SETORES, ...BANCOS, ...FERIADOS, ...CALCULADORAS]
export const BLOCO_POR_ID = Object.fromEntries(BLOCOS.map((b) => [b.id, b]))
