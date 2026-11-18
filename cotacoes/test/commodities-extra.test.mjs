import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEiaDaily, parsePinkRows, validCommodity, commodityFallback, CENTS_PER_LB } from '../scripts/commodities-lib.mjs'
import { icbrItem, ICBR, monthlyFx, sojaSacaItem, itemFallback } from '../scripts/commodities-brl-lib.mjs'
import { discoverWeeklyFiles, parseWeek, mergeWeeks, fuelItems, fuelFallback, excelDay } from '../scripts/fuels-lib.mjs'
const now = new Date('2026-10-30T14:00:00Z')
const eia = (title, cells) => `<title>${title}</title><table><tr><td>2026 Oct-26 to Oct-30</td>${cells.map(c => `<td>${c}</td>`).join('')}</tr></table><td>Release Date: 10/28/2026</td><td>Next Release Date: 11/4/2026</td>`

test('EIA diária: Henry Hub, diesel e gasolina de Nova York usam a mesma leitura do WTI', () => {
  const gas = buildEiaDaily('henry-hub', eia('Henry Hub Natural Gas Spot Price (Dollars per Million Btu)', ['2.52', '2.76', '', '', '']), now)
  assert.equal(gas.value, 2.76); assert.equal(gas.period, '2026-10-27'); assert.equal(gas.previousValue, 2.52); assert.equal(gas.unit, 'USD/MMBtu')
  assert.ok(validCommodity(gas, 'henry-hub'))
  const diesel = buildEiaDaily('ny-diesel', eia('New York Harbor Ultra-Low Sulfur No 2 Diesel Spot Price (Dollars per Gallon)', ['4.833', '4.687', '', '', '']), now)
  assert.equal(diesel.value, 4.687); assert.equal(diesel.decimals, 3); assert.ok(validCommodity(diesel, 'ny-diesel'))
  const gasoline = buildEiaDaily('ny-gasoline', eia('New York Harbor Conventional Gasoline Regular Spot Price FOB (Dollars per Gallon)', ['2.1', '2.2', '', '', '']), now)
  assert.equal(gasoline.value, 2.2); assert.ok(validCommodity(gasoline, 'ny-gasoline'))
})
test('EIA diária rejeita série ou unidade trocada e URL de outra série', () => {
  assert.throws(() => buildEiaDaily('henry-hub', eia('Henry Hub Natural Gas Spot Price (Dollars per Gallon)', ['2.5', '', '', '', '']), now))
  assert.throws(() => buildEiaDaily('ny-diesel', eia('Cushing, OK WTI Spot Price FOB (Dollars per Barrel)', ['4', '', '', '', '']), now))
  const gas = buildEiaDaily('henry-hub', eia('Henry Hub Natural Gas Spot Price (Dollars per Million Btu)', ['2.5', '', '', '', '']), now)
  assert.equal(validCommodity({ ...gas, sourceUrl: 'https://www.eia.gov/dnav/pet/hist/RWTCD.htm' }, 'henry-hub'), false)
  assert.equal(commodityFallback('ny-gasoline', [], new Error('x')).variationBasis, 'observação diária anterior')
})
const pink = () => [
  { A: 'World Bank Commodity Price Data (The Pink Sheet)' }, { A: 'monthly prices in nominal US dollars, 1960 to present' }, { A: 'Updated on October 02, 2026' },
  { B: 'Iron ore, cfr spot', C: 'Soybeans', D: 'Maize', E: 'Gold', F: 'Sugar, world', G: 'Coffee, Arabica', H: 'Copper', I: 'Urea ', J: 'DAP', K: 'Aluminum', L: 'Wheat, US HRW', M: 'Beef **', N: 'Cotton, A Index', O: 'Coal, Australian', P: 'Cocoa' },
  { B: '($/dmtu)', C: '($/mt)', D: '($/mt)', E: '($/troy oz)', F: '($/kg)', G: '($/kg)', H: '($/mt)', I: '($/mt)', J: '($/mt)', K: '($/mt)', L: '($/mt)', M: '($/kg)', N: '($/kg)', O: '($/mt)', P: '($/kg)' },
  { A: '2026M08', B: '96.3', C: '482', D: '224', E: '4411', F: '0.40', G: '9.00', H: '9800', I: '420', J: '700', K: '2500', L: '230', M: '6.1', N: '1.60', O: '110', P: '5.8' },
  { A: '2026M09', B: '97.7', C: '524', D: '239.6', E: '4319', F: '0.42', G: '9.50', H: '10100', I: '430', J: '710', K: '2550', L: '235', M: '6.3', N: '1.65', O: '115', P: '6.0' },
]
const url = 'https://thedocs.worldbank.org/en/doc/example/related/CMO-Historical-Data-Monthly.xlsx'
test('Pink Sheet: açúcar e café saem em US¢/libra-peso; cobre e fertilizantes em USD/tonelada', () => {
  const r = Object.fromEntries(parsePinkRows(pink(), url, now).map(c => [c.id, c]))
  assert.deepEqual(Object.keys(r).sort(), ['aluminum', 'beef', 'coal', 'cocoa', 'coffee', 'copper', 'corn', 'cotton', 'dap', 'gold', 'iron-ore', 'soybeans', 'sugar', 'urea', 'wheat'])
  assert.equal(r.wheat.value, 235); assert.equal(r.beef.value, 6.3); assert.equal(r.beef.unit, 'USD/kg'); assert.ok(Math.abs(r.cotton.value - 1.65 * CENTS_PER_LB) < 1e-9); assert.equal(r.coal.value, 115); assert.equal(r.cocoa.value, 6)
  assert.ok(Math.abs(r.sugar.value - 0.42 * CENTS_PER_LB) < 1e-9); assert.equal(r.sugar.unit, 'US¢/libra-peso'); assert.ok(r.sugar.value > 15 && r.sugar.value < 25)
  assert.ok(Math.abs(r.coffee.previousValue - 9 * CENTS_PER_LB) < 1e-9)
  assert.equal(r.copper.value, 10100); assert.equal(r.aluminum.value, 2550); assert.equal(r.urea.value, 430)
  assert.ok(Object.values(r).every(c => validCommodity(c, c.id)))
})
test('Pink Sheet: série opcional com unidade trocada ou coluna ausente sai sem derrubar as obrigatórias', () => {
  const r = pink(); r[4].F = '($/mt)'; r[3].J = 'Outro'
  const ids = parsePinkRows(r, url, now).map(c => c.id)
  assert.ok(!ids.includes('sugar') && !ids.includes('dap')); assert.ok(ids.includes('copper') && ids.includes('gold'))
  const bad = pink(); bad[4].C = '($/kg)'; assert.throws(() => parsePinkRows(bad, url, now))
})

const sgs = (from, n, base) => Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(from, i, 1)); return { data: `01/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`, valor: String(base + i) } })
test('IC-Br: item mensal com variação, histórico e fonte do SGS', () => {
  const it = icbrItem(ICBR[1], sgs(2025, 20, 400), now)
  assert.equal(it.id, 'ic-br-agro'); assert.equal(it.period, '2026-08'); assert.equal(it.value, 419); assert.equal(it.previousValue, 418)
  assert.match(it.sourceUrl, /sgs\.27575/); assert.equal(it.history.length, 20); assert.equal(it.unit, 'índice')
  assert.throws(() => icbrItem(ICBR[0], sgs(2025, 5, 400), now))
  const zero = sgs(2025, 20, 400); zero[19].valor = '0'; assert.throws(() => icbrItem(ICBR[0], zero, now))
  const dup = sgs(2025, 20, 400); dup[3] = dup[2]; assert.throws(() => icbrItem(ICBR[0], dup, now))
})
test('soja em R$/saca: USD/t × 0,06 × dólar médio do mês; mês sem cotações suficientes fica de fora', () => {
  const day = (m, d, v) => ({ data: `${String(d).padStart(2, '0')}/${m}/2026`, valor: String(v) })
  const fxRows = [...Array.from({ length: 20 }, (_, i) => day('08', i + 1, 5)), ...Array.from({ length: 20 }, (_, i) => day('09', i + 1, 5.5)), ...Array.from({ length: 5 }, (_, i) => day('10', i + 1, 5.4))]
  const fx = monthlyFx(fxRows)
  assert.deepEqual([...fx.keys()], ['2026-08', '2026-09'])
  const it = sojaSacaItem([{ period: '2026-08', value: 500 }, { period: '2026-09', value: 520 }, { period: '2026-10', value: 530 }], fx, now)
  assert.equal(it.period, '2026-09'); assert.ok(Math.abs(it.value - 520 * 0.06 * 5.5) < 1e-9); assert.ok(Math.abs(it.previousValue - 500 * 0.06 * 5) < 1e-9)
  assert.throws(() => sojaSacaItem([{ period: '2026-10', value: 530 }], fx, now))
  assert.equal(itemFallback('soja-saca', [it], new Error('x')).stale, true)
  assert.equal(itemFallback('ic-br', [], new Error('x')).value, null)
})

const anpHtml = `<a href="/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc/2026/resumo_semanal_lpc_2026_10_18-2026_10_24.xlsx">a</a>
<a href="/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/arquivos-lpc/2026/resumo_semanal_lpc_2026-10-11_2026-10-17.xlsx">b</a>
<a href="https://evil.example/anp/resumo_semanal_lpc_2026-10-04_2026-10-10.xlsx">c</a>`
test('ANP: descobre só resumos semanais do domínio oficial, do mais recente ao mais antigo', () => {
  const files = discoverWeeklyFiles(anpHtml)
  assert.deepEqual(files.map(f => f.end), ['2026-10-24', '2026-10-17'])
  assert.ok(files.every(f => f.url.startsWith('https://www.gov.br/anp/')))
})
const sheet = (rows) => [{ A: 'LEVANTAMENTO' }, { A: 'DATA INICIAL', B: 'DATA FINAL', C: 'PRODUTO', D: 'NÚMERO DE POSTOS PESQUISADOS', E: 'UNIDADE DE MEDIDA', F: 'PREÇO MÉDIO REVENDA' }, ...rows]
const line = (p, price, unit = 'R$/l') => ({ A: '46313', B: '46319', C: p, D: '5000', E: unit, F: String(price) })
test('ANP: lê a aba BRASIL por nome de coluna, converte datas do Excel e arredonda a centavos', () => {
  assert.equal(excelDay(46319), '2026-10-24')
  const w = parseWeek(sheet([line('GASOLINA COMUM', 6.5149), line('ETANOL HIDRATADO', 4.4), line('ÓLEO DIESEL S10', 6.31), line('GLP', 105.9, 'R$/13kg'), line('GNV', 4.1, 'R$/m3')]))
  assert.equal(w.end, '2026-10-24'); assert.equal(w.start, '2026-10-18')
  assert.deepEqual(w.prices, { 'anp-gasolina': 6.51, 'anp-etanol': 4.4, 'anp-diesel': 6.31, 'anp-glp': 105.9 })
  assert.throws(() => parseWeek(sheet([line('GASOLINA COMUM', 0)])))
  assert.throws(() => parseWeek(sheet([line('GASOLINA COMUM', 6.5, 'R$/kg')])))
  assert.throws(() => parseWeek(sheet([line('GNV', 4)])))
  assert.throws(() => parseWeek([{ A: 'sem cabeçalho' }]))
  assert.throws(() => parseWeek(sheet([line('GASOLINA COMUM', 6.5), { ...line('ETANOL HIDRATADO', 4.4), B: '46326' }])))
})
test('ANP: histórico acumula por semana sem duplicar e a variação só vale com semana consecutiva', () => {
  const h1 = mergeWeeks({}, [{ end: '2026-10-17', prices: { 'anp-gasolina': 6.4 } }, { end: '2026-10-24', prices: { 'anp-gasolina': 6.5 } }])
  const h2 = mergeWeeks(h1, [{ end: '2026-10-24', prices: { 'anp-gasolina': 6.5 } }])
  assert.equal(h2['anp-gasolina'].length, 2)
  const it = fuelItems(h2, now)[0]
  assert.equal(it.value, 6.5); assert.equal(it.previousValue, 6.4); assert.ok(Math.abs(it.variationPct - (6.5 / 6.4 - 1) * 100) < 1e-9)
  const gap = fuelItems(mergeWeeks({}, [{ end: '2026-10-03', prices: { 'anp-gasolina': 6.4 } }, { end: '2026-10-24', prices: { 'anp-gasolina': 6.5 } }]), now)[0]
  assert.equal(gap.variationPct, null)
  assert.throws(() => fuelItems({}, now))
  assert.equal(fuelFallback([it], new Error('x'))[0].stale, true); assert.equal(fuelFallback([], new Error('x')).length, 4)
})
test('preço diário do cobre: libra → tonelada, pontos inválidos de fora, desatualizado quando tudo é reaproveitado', async () => {
  const { LB_PER_TONNE, INSUMOS_PRECOS, toDailyPoints, dailyFile } = await import('../scripts/insumos-precos-lib.mjs')
  const def = INSUMOS_PRECOS[0]
  assert.equal(def.symbol, 'HG=F'); assert.equal(def.unit, 'USD/tonelada')
  const pts = toDailyPoints([[1, 5], [2, NaN], [3, 0], [4, 5.2]], def)
  assert.deepEqual(pts, [[1, Math.round(5 * LB_PER_TONNE * 100) / 100], [4, Math.round(5.2 * LB_PER_TONNE * 100) / 100]])
  assert.ok(pts[0][1] > 10000 && pts[0][1] < 12000, 'US$ 5/lb ≈ US$ 11.000/t')
  assert.equal(dailyFile({ cobre: { stale: true } }, 1).stale, true); assert.equal(dailyFile({ cobre: { stale: false } }, 1).stale, false)
})

import { filtraVeiculos, MIN_PREFERIDOS, mesmoFato, semInformacaoUtil } from '../scripts/temas-lib.mjs'
import { FILING, pick } from '../scripts/news-lib.mjs'
test('notícias: registros da SEC (Form 4, 13F…) ficam de fora; régua dos veículos tira só a repetição', () => {
  assert.ok(FILING.test('Formulário 4 Blue Biofuels Inc: Chris J. Kneppers (Diretor)')); assert.ok(FILING.test('Form 4 Acme Corp')); assert.ok(!FILING.test('Formação de preços do cobre'))
  assert.equal(pick([{ title: 'Form 4 X', link: 'https://a', t: 1 }, { title: 'Dólar sobe', link: 'https://b', t: 2 }], 5).length, 1)
  const bons = Array.from({ length: MIN_PREFERIDOS }, (_, i) => ({ title: `v${i}`, source: 'Valor Econômico' }))
  const fracos = [{ title: 'x', source: 'Jornal da Fronteira' }, { title: 'y', source: 'AcreNews' }]
  // Régua de 18/11/2026: com muita cobertura de referência, a matéria de outro portal com fato novo continua entrando.
  assert.equal(filtraVeiculos([...bons, ...fracos]).length, MIN_PREFERIDOS + 2, 'fato novo de outro portal não some')
  assert.equal(filtraVeiculos([bons[0], ...fracos]).length, 3, 'pouca cobertura: mantém tudo')
})

test('régua dos veículos: a repetição do mesmo fato por outro portal sai; fato diferente fica', () => {
  const dia = 864e5, t = 1_800_000_000_000
  const valor = { title: 'Preço do açúcar sobe 25% para valor mais elevado em quase dois anos', source: 'Valor Econômico', t }
  const copia = { title: 'Preço mundial do açúcar sobe 25% e atinge máximo de quase dois anos', source: 'Jornal da Região', t: t - 3600e3 }
  const outroFato = { title: 'Usinas de cana devem ter a menor margem operacional em dez anos', source: 'Jornal da Região', t }
  assert.deepEqual(filtraVeiculos([valor, copia, outroFato]), [valor, outroFato])
  // duas cópias entre portais menores: fica a primeira
  const a = { title: 'Preços do algodão avançam, mas seguem abaixo da paridade de exportação', source: 'Portal A', t }
  const b = { title: 'Algodão/Cepea: Preços internos avançam, mas seguem abaixo da paridade de exportação', source: 'Portal B', t }
  assert.deepEqual(filtraVeiculos([a, b]), [a])
  // números diferentes = fatos diferentes (outra data, outro percentual)
  assert.equal(mesmoFato({ title: 'Boi gordo, frango e suíno: veja os preços desta segunda (16)', t }, { title: 'Boi gordo, frango e suíno: veja os preços desta terça (17)', t }), false)
  // mesmo assunto, fato diferente
  assert.equal(mesmoFato({ title: 'Preço do algodão sobe no Brasil e Conab prevê safra de 4,157 milhões de toneladas', t }, { title: 'Preço do algodão sobe no Brasil com valorização do dólar', t }), false)
  // mais de 3 dias de distância não é repetição
  assert.equal(mesmoFato(valor, { ...copia, t: t - 4 * dia }), false)
})

test('régua dos veículos: repetição entre veículos de referência sai; título em outra língua e coluna traduzida do Vietnã saem', () => {
  const t = 1_800_000_000_000
  const recente = { title: 'Dólar fecha a R$ 5,77, maior valor desde abril de 2025', source: 'Valor Econômico', t }
  const repetida = { title: 'Dólar fecha cotado a R$ 5,77, maior valor desde abril de 2025', source: 'InfoMoney', t: t - 3600e3 }
  const outra = { title: 'Banco Central faz leilão de swap para conter alta do dólar', source: 'Folha de S.Paulo', t: t - 7200e3 }
  assert.deepEqual(filtraVeiculos([recente, repetida, outra]), [recente, outra], 'de cada fato fica a versão mais recente')
  assert.equal(semInformacaoUtil({ title: 'Giá dầu Algeria tăng vọt, dẫn đầu nhóm dầu thô Arab của OPEC', source: 'Vietnam.vn' }), true)
  assert.equal(semInformacaoUtil({ title: 'Preços da gasolina e do diesel hoje, 15 de novembro de 2026: Os preços globais caem', source: 'Vietnam.vn' }), true)
  assert.equal(semInformacaoUtil({ title: 'Os preços do petróleo subiram após incidentes no Estreito de Ormuz.', source: 'Vietnam.vn' }), false, 'matéria do Vietnam.vn sem ser coluna diária continua')
  assert.equal(semInformacaoUtil({ title: 'Petróleo hoje: preço sobe 2% com tensão no Oriente Médio', source: 'Valor Econômico' }), false, 'título em português com acento continua')
  assert.equal(semInformacaoUtil({ title: 'Ação da Petrobras sobe; câmbio e juros em foco', source: 'InfoMoney' }), false)
})
