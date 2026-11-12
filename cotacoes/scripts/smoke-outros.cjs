const openCallouts = require('./smoke-aprender-disclosures.cjs')
// Cenários › Inflação (IPCA) e › Fiscal (dívida bruta) e Frete marítimo: tabela no formato do Mercado; clicar abre o gráfico em tela cheia com filtros no topo.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const { mkdir } = require('node:fs/promises'), path = require('node:path')
const points = []
let index = 100
for (let y = 2018; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
  if (y === 2026 && m > 9) break
  const mom = 0.2 + 0.5 * Math.abs(Math.sin(y * 12 + m)); index *= 1 + mom / 100
  points.push({ period: `${y}-${String(m).padStart(2, '0')}`, mom: +mom.toFixed(2), ytd: +(mom * m).toFixed(2), y12: +(mom * 12).toFixed(2), index: +index.toFixed(2) })
}
const ipca = { schemaVersion: 1, generatedAt: new Date().toISOString(), series: { id: 'ipca', sourceName: 'IBGE · SIDRA (fixture de teste)', sourceUrl: 'https://sidra.ibge.gov.br/tabela/1737', checkedAt: new Date().toISOString(), stale: false, points } }
const divida = { schemaVersion: 1, generatedAt: new Date().toISOString(), series: { id: 'divida-bruta', sourceName: 'Banco Central (fixture de teste)', sourceUrl: 'https://www.bcb.gov.br/estatisticas/historicoestatisticassetorpublico', checkedAt: new Date().toISOString(), stale: false,
  points: Array.from({ length: 30 }, (_, i) => ({ period: `${2024 + Math.floor((i + 3) / 12)}-${String(((i + 3) % 12) + 1).padStart(2, '0')}`, pib: +(72 + i * 0.2).toFixed(1), brl: Math.round(8200000 + i * 60000) })) } }
// últimos dois meses com a diferença de 0,06 p.p. que uma casa decimal esconderia (82,9% e 82,9%)
divida.series.points.at(-2).pib = 82.87; divida.series.points.at(-1).pib = 82.93
const grp = (id, name, a, b) => ({ id, name, byPeriod: { '2026-08': a, '2026-09': b } })
const ipcaGroups = { schemaVersion: 1, generatedAt: new Date().toISOString(), series: { id: 'ipca-groups', sourceName: 'IBGE · SIDRA (fixture de teste)', sourceUrl: 'https://sidra.ibge.gov.br/tabela/7060', checkedAt: new Date().toISOString(), stale: false, periods: ['2026-08', '2026-09'], groups: [
  grp(7169, 'Índice geral', { mom: 0.2, weight: 100, ytd: 3, y12: 4.5 }, { mom: 0.5, weight: 100, ytd: 3.5, y12: 4.7 }),
  grp(7170, 'Alimentação e bebidas', { mom: 0.2, weight: 21 }, { mom: 1.0, weight: 21.5, y12: 6 }),
  grp(7625, 'Transportes', { mom: 0.1, weight: 20 }, { mom: -0.5, weight: 20, y12: 3 })] } }
const jp = { schemaVersion: 1, generatedAt: new Date().toISOString(), series: { id: 'freight-jp-sppi', unit: 'pontos · média de 2020 = 100', frequency: 'monthly', sourceName: 'Banco do Japão (fixture de teste)', sourceUrl: 'https://www.boj.or.jp/en/statistics/pi/sppi_2020/index.htm', checkedAt: new Date().toISOString(), stale: false, releaseDate: null,
  points: Array.from({ length: 40 }, (_, i) => ({ period: `${2023 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`, value: 100 + i * 1.5 })) } }
const monthly = (v0) => Array.from({ length: 60 }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 15)); d.setUTCMonth(d.getUTCMonth() - (59 - i)); return { period: d.toISOString().slice(0, 7), value: +(v0 * (1 + 0.1 * Math.sin(i / 8) + i / 600)).toFixed(2) } })
const commodity = (id, label, unit, value, history) => ({ id, label, unit, nature: 'média mensal', sourceName: 'Banco Mundial • Pink Sheet (fixture)', sourceUrl: 'https://www.worldbank.org/en/research/commodity-markets', benchmark: 'teste', value, period: '2026-09', releaseDate: '2026-10-02', checkedAt: '2026-10-05T00:00:00Z', stale: false, error: null, previousValue: null, previousPeriod: null, variationPct: null, variationBasis: 'mês anterior', history })
const brlItem = (id, label, unit, value, extra = {}) => ({ ...commodity(id, label, unit, value, monthly(value * 0.9)), sourceName: 'Banco Central (fixture)', decimals: 2, ...extra })
const weekly = (v0) => Array.from({ length: 70 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 24)); d.setUTCDate(d.getUTCDate() - 7 * (69 - i)); return { period: d.toISOString().slice(0, 10), value: +(v0 * (1 + i / 900)).toFixed(2) } })
const fuel = (id, label, unit, value) => ({ ...commodity(id, label, unit, value, weekly(value * 0.95)), nature: 'média semanal ao consumidor', sourceName: 'ANP (fixture)', sourceUrl: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos-de-combustiveis-ultimas-semanas-pesquisadas', period: '2026-10-24', decimals: 2 })
const commoditiesBrl = { schemaVersion: 1, generatedAt: new Date().toISOString(), commodities: [brlItem('ic-br', 'IC-Br · geral', 'índice', 462.94), brlItem('ic-br-agro', 'IC-Br · agropecuária', 'índice', 454.03), brlItem('ic-br-metal', 'IC-Br · metais', 'índice', 754.19), brlItem('ic-br-energia', 'IC-Br · energia', 'índice', 216.23), brlItem('soja-saca', 'Soja · R$/saca', 'R$/saca de 60 kg', 172.9, { nature: 'estimativa mensal' })] }
const fuels = { schemaVersion: 1, generatedAt: new Date().toISOString(), commodities: [fuel('anp-gasolina', 'Gasolina comum · bomba', 'R$/litro', 6.51), fuel('anp-etanol', 'Etanol hidratado · bomba', 'R$/litro', 4.4), fuel('anp-diesel', 'Diesel S10 · bomba', 'R$/litro', 6.31), fuel('anp-glp', 'Gás de cozinha (botijão 13 kg)', 'R$/botijão 13 kg', 105.9)] }
const commodities = { schemaVersion: 1, generatedAt: new Date().toISOString(), commodities: [commodity('gold', 'Ouro', 'USD/onça troy', 4319, monthly(4000)), commodity('iron-ore', 'Minério de ferro', 'USD/tonelada seca', 97.7, monthly(90)), commodity('soybeans', 'Soja', 'USD/tonelada', 524, []), commodity('corn', 'Milho', 'USD/tonelada', 239.6, monthly(230))] }
;(async () => {
  const { CONCEITOS, porTopico } = await import('../src/educacao.js')
  const topicCount = porTopico(CONCEITOS).length
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  const out = process.env.SMOKE_OUT
  if (out) await mkdir(out, { recursive: true })
  const offline = async (p) => { await p.route('**/*', (r) => r.request().url().startsWith(base) ? r.continue() : r.abort()); return p }
  const openPage = async (options) => offline(await b.newPage(options))
  try {
    const { FONTES } = await import('../src/governanca.js')
    assert.equal(new Set(FONTES.map((fonte) => fonte.id)).size, FONTES.length, 'catálogo não duplica fonte por id')
    const expectedSources = FONTES.map((fonte) => fonte.nome)
    assert.equal(new Set(expectedSources).size, expectedSources.length, 'catálogo não duplica nome de fonte')
    // aviso de entrada: aparece na primeira visita, não volta nas seguintes, volta se o texto mudar e continua acessível pelo "i"
    for (const width of [390, 1280]) {
      const ctx = await b.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' })
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
      const p = await offline(await ctx.newPage())
      await p.goto(base + '/#resumo')
      const aviso = p.getByRole('dialog', { name: 'Aviso', exact: true }); await aviso.waitFor()
      const texto = /aplicativo educacional[\s\S]*informação ilustrativa[\s\S]*Não é recomendação de crédito[\s\S]*Quase ao vivo[\s\S]*Diário[\s\S]*Manual/i
      assert.match(await aviso.innerText(), texto)
      // linha das novidades da semana logo abaixo do aviso, antes do botão (o conteúdo depende da data; só confere a estrutura)
      const nov = aviso.locator('.aviso-novidades'); if (await nov.count()) { assert.match(await nov.innerText(), /NOVIDADES DA SEMANA|Novidades da semana/i); assert.ok((await nov.locator('li').count()) <= 4) }
      const box = await aviso.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 800, 'aviso cabe na tela')
      assert.equal(await p.evaluate(() => localStorage.getItem('aviso-inicial-visto')), null, 'só marca como lido ao fechar')
      await aviso.getByRole('button', { name: 'Entendi' }).click(); await aviso.waitFor({ state: 'hidden' })
      const marca = await p.evaluate(() => localStorage.getItem('aviso-inicial-visto'))
      assert.match(marca, /^v1-[0-9a-f]{8}$/, 'marca tirada do texto do aviso')
      await p.goto(base + '/#juros'); assert.equal(await aviso.count(), 0, 'não reaparece ao trocar de aba')
      // segunda visita: nenhum pop-up
      await p.reload(); await p.locator('main#conteudo').waitFor(); await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog:modal').count(), 0, 'segunda visita sem aviso')
      // o conteúdo continua a um clique, pela janela do "i" (presente em todas as telas)
      await p.getByRole('button', { name: 'Informações e avisos gerais' }).filter({ visible: true }).first().click()
      const info = p.getByRole('dialog', { name: 'Informações e avisos gerais' }); await info.waitFor()
      const rever = info.getByRole('button', { name: 'Ver o aviso de entrada' })
      await rever.scrollIntoViewIfNeeded()
      assert.ok((await rever.boundingBox()).height >= 44, 'link do aviso com alvo de 44px')
      await rever.click(); await aviso.waitFor()
      assert.match(await aviso.innerText(), texto)
      const again = await aviso.boundingBox(); assert.ok(again.x >= 0 && again.x + again.width <= width && again.y >= 0 && again.y + again.height <= 800, 'aviso reaberto cabe na tela')
      await p.keyboard.press('Escape'); await aviso.waitFor({ state: 'hidden' })
      assert.equal(await info.isVisible(), true, 'volta para a janela de avisos')
      await info.getByRole('button', { name: 'Fechar' }).click(); await info.waitFor({ state: 'hidden' })
      // marca de outro texto (o aviso mudou desde a última visita): volta uma vez e regrava a marca atual
      await p.evaluate(() => localStorage.setItem('aviso-inicial-visto', 'v1-00000000'))
      await p.reload(); await aviso.waitFor()
      await p.keyboard.press('Escape'); await aviso.waitFor({ state: 'hidden' })
      assert.equal(await p.evaluate(() => localStorage.getItem('aviso-inicial-visto')), marca)
      await p.reload(); await p.locator('main#conteudo').waitFor(); await p.waitForTimeout(1500)
      assert.equal(await p.locator('dialog:modal').count(), 0, 'lido de novo, não volta')
      await ctx.close()
    }
    // Juros: sem Reino Unido e com a bandeira de cada país nas linhas e nos títulos dos gráficos
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      const hoje = Date.now(), dia = 864e5
      const estr = { schemaVersion: 1, generatedAt: new Date().toISOString(), series: { id: 'estr', sourceName: 'BCE (fixture de teste)', sourceUrl: 'https://www.ecb.europa.eu/', checkedAt: new Date().toISOString(), stale: false,
        points: Array.from({ length: 400 }, (_, i) => ({ date: new Date(hoje - (400 - i) * dia).toISOString().slice(0, 10), value: +(1.9 + i * 0.0005).toFixed(3) })) } }
      await p.route('**/estr.json*', (r) => r.fulfill({ json: estr }))
      // macro simulado: no CI não há arquivos de dados reais (eles são gerados no deploy), então os gráficos de Juros precisam deles
      const dias = Array.from({ length: 400 }, (_, i) => { const d = new Date(hoje - (400 - i) * dia); d.setUTCHours(12, 0, 0, 0); return d.getTime() })
      const macro = { generatedAt: hoje, focus: null, ptax: {}, ptaxHist: {}, sofrAvg: dias.map((t) => [t, 3.2, 3.3, 3.4]),
        cdi: dias.map((t, i) => [t, +(14.1 + (i % 7) * 0.01).toFixed(2)]), selic: [[dias[0], 14.5], [dias[200], 14.25]], sofr: dias.map((t, i) => [t, +(4.3 - i * 0.003).toFixed(2), 4.2, 4.4]) }
      await p.route('**/macro.json*', (r) => r.fulfill({ json: macro }))
      // curva do euro simulada: 3 datas de comparação com os 10 prazos do BCE
      const prazos = [[0.25, '3M'], [0.5, '6M'], [1, '1A'], [2, '2A'], [3, '3A'], [5, '5A'], [7, '7A'], [10, '10A'], [20, '20A'], [30, '30A']]
      const datas = [[hoje - dia, 'hoje', 'Último dia'], [hoje - 8 * dia, 'w1', '1 semana'], [hoje - 32 * dia, 'm1', '1 mês']].map(([t, id, label]) => ({ id, label, days: 0, date: new Date(t).toISOString().slice(0, 10) }))
      const euroCurve = { schemaVersion: 1, generatedAt: new Date().toISOString(), curve: { id: 'euro-curve', sourceName: 'BCE (fixture de teste)', sourceUrl: 'https://www.ecb.europa.eu/', checkedAt: new Date().toISOString(), stale: false, sourceDate: datas[0].date, compare: datas,
        curves: Object.fromEntries(datas.map((d, k) => [d.date, prazos.map(([anos, rot], j) => [anos, +(2.5 + j * 0.12 - k * 0.1).toFixed(4), rot])])) } }
      await p.route('**/euro-curve.json*', (r) => r.fulfill({ json: euroCurve }))
      await p.goto(base + '/#juros'); await p.locator('.executive-rates__table tbody tr').first().waitFor()
      const linhas = p.locator('.executive-rates__table tbody tr .executive-rates__name')
      const n = await linhas.count()
      assert.ok(n >= 7, 'Selic, CDI, SOFR, Fed, €STR, BCE e BoJ')
      await p.locator('.executive-rates__table tbody tr', { hasText: '€STR' }).filter({ hasText: /\d,\d{3}%/ }).first().waitFor() // o arquivo simulado chega depois da primeira renderização
      assert.match(await p.locator('.executive-rates__table tbody tr', { hasText: '€STR' }).first().innerText(), /Área do euro · €STR overnight[\s\S]*\d,\d{3}%/)
      assert.equal(await p.locator('.executive-rates__table tbody tr .executive-rates__name .flag').count(), n, 'bandeira em cada linha')
      // tooltips: toda linha do quadro tem o "?" e o balão abre inteiro (não cortado pela rolagem da tabela)
      const helps = p.locator('.executive-rates__table tbody tr .executive-rates__name .help button')
      assert.equal(await helps.count(), n, 'tooltip em cada linha do quadro')
      for (const [rot, rx] of [['Selic meta', /meta é definida pelo Copom/], ['CDI overnight', /B3 calcula a média/], ['SOFR overnight', /mediana, ponderada pelo volume/], ['Fed', /faixa/], ['€STR', /sem os 25% menores/], ['BCE', /piso do juro/], ['Japão', /Banco do Japão/]]) {
        const btn = p.locator('.executive-rates__table tbody tr', { hasText: rot }).first().locator('.help button')
        await btn.hover(); const tip = p.locator('[role="tooltip"]'); await tip.waitFor()
        assert.match(await tip.innerText(), rx, rot)
        const box = await tip.boundingBox()
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0, `balão de ${rot} dentro da tela`)
        const topo = await tip.evaluate((el) => { const r = el.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 30)); return !!e?.closest('[role="tooltip"]') })
        assert.ok(topo, `balão de ${rot} visível por inteiro, sem ficar atrás ou cortado`)
        if (width < 700) { await tip.locator('.pop-close').click(); assert.equal(await p.locator('[role="tooltip"]').count(), 0, `no celular o balão de ${rot} fecha pelo botão Fechar`) }
        await p.mouse.move(2, 2)
      }
      const corpo = await p.locator('main').innerText()
      assert.doesNotMatch(corpo, /Reino Unido|Bank Rate|Bank of England|BoE/, 'sem Reino Unido em Juros')
      assert.match(await p.locator('section[aria-labelledby="juros-exterior"] .executive-rates__table tbody').innerText(), /Área do euro · BCE[\s\S]*Japão/)
      await p.locator('.chart h3', { hasText: 'Área do euro · €STR' }).first().waitFor()
      await p.locator('.chart h3', { hasText: 'Brasil · CDI' }).first().waitFor()
      const curvaEuro = p.locator('.chart', { has: p.locator('h3', { hasText: 'Área do euro · Curva soberana AAA' }) })
      await curvaEuro.waitFor()
      assert.ok(await curvaEuro.locator('h3 .flag').count() === 1, 'bandeira da zona do euro na curva')
      assert.equal(await curvaEuro.locator('.curve-legend > button').count(), 3, 'três datas de comparação')
      assert.ok(await curvaEuro.locator('svg path').count() >= 3, 'uma linha por data')
      const eixo = await curvaEuro.locator('svg text.tick').allTextContents()
      assert.ok(eixo.includes('3M') && eixo.includes('30A'), 'eixo do 3M ao 30A')
      assert.ok(await p.locator('.chart h3 .flag').count() >= 4, 'bandeira nos títulos dos gráficos e curvas por região')
      await p.close()
    }
    // governança dos dados em Configurações: tabela por fonte, regras e nenhuma rolagem lateral da página
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      await p.goto(base + '/#config')
      const gov = p.locator('.desk-panel', { has: p.getByRole('heading', { name: 'Governança dos dados' }) }); await gov.waitFor()
      const sourceNames = (await gov.locator('.config-gov tbody tr > th[scope="row"]').allTextContents()).map((name) => name.trim())
      assert.deepEqual(sourceNames, expectedSources, 'uma linha para cada fonte do catálogo, sem omissões ou duplicatas')
      assert.equal(new Set(sourceNames).size, sourceNames.length, 'cada fonte aparece uma única vez na tabela')
      assert.match(await gov.locator('.config-gov tbody tr', { has: p.getByRole('rowheader', { name: 'Google Trends: Em alta no Brasil', exact: true }) }).innerText(), /RSS oficial[\s\S]*08h e 15h[\s\S]*25 h/)
      assert.match(await gov.locator('.config-gov tbody tr',{hasText:'Veículos pesados'}).innerText(),/ANFAVEA[\s\S]*1080 h/i)
      const txt = await gov.innerText()
      assert.match(txt, /A cada 5 min na janela intensiva/i); assert.match(txt, /Em resumo[\s\S]*Só o câmbio é coletado de 5 em 5 minutos[\s\S]*Coletar não é o mesmo que o número mudar/i); assert.match(txt, /Relê os arquivos publicados a cada 1 min/); assert.match(txt, /30 por dia/); assert.match(txt, /Atrasado após/i)
      assert.match(await gov.locator('.config-gov tbody tr', { hasText: 'Dívida bruta' }).innerText(), /72 h/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem rolagem lateral a ${width}px`)
      if (width < 700) assert.equal(await p.evaluate(() => { const sc = document.querySelector('.config-gov').closest('.config-scroll'); return sc.scrollWidth > sc.clientWidth + 1 }), false, 'no celular a tabela vira cartões, sem rolagem interna')
      await p.close()
    }
    // Setores: notícias institucionais em 120h e preço, com a preparação de visita removida.
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      // Relógio e publicações sintéticas compartilham o instante; nenhuma URL é consultada.
      const agora = Date.parse('2026-11-05T15:00:00Z'), min = 60e3, stamp = new Date(agora).toISOString()
      await p.clock.setFixedTime(agora)
      const mat = (title, atras, slug) => ({ title: `QA: ${title}`, link: `https://www.gov.br/mdic/pt-br/assuntos/noticias/qa-${slug}`, sourceId: 'mdic', type: 'comunicado', licenseUrl: 'https://creativecommons.org/licenses/by-nd/3.0/', publishedAt: new Date(agora - atras * min).toISOString(), collectedAt: stamp })
      const sectorNews = { schemaVersion: 1, generatedAt: stamp, windowDays: 5, sourceStates: { mdic: { status: 'ok', checkedAt: stamp, lastSuccessAt: stamp, reason: 'Fixture sintética do teste; não é publicação real.' } }, topics: {
        industria: { items: [mat('Produção industrial cai com juros altos', 2, 'industria'), mat('Produção industrial expirada', 121 * 60, 'industria-expirada')] },
        cobre: { items: [mat('Cobre atinge máxima com demanda da China', 1, 'cobre-demanda'), mat('Estoques de cobre na LME recuam', 30 * 60, 'cobre-estoques'), mat('Preço do cobre expirado', 121 * 60, 'cobre-expirado')] } } }
      const comm = { schemaVersion: 1, generatedAt: stamp, commodities: [{ id: 'copper', label: 'Cobre', unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Banco Mundial · Pink Sheet', benchmark: 'Grau A · LME', value: 10000, period: '2026-09', checkedAt: stamp, variationPct: 2.5, variationBasis: 'mês anterior' }] }
      await p.route('**/sector-news.json*', (r) => r.fulfill({ json: sectorNews }))
      await p.route('**/commodities.json*', (r) => r.fulfill({ json: comm }))
      await p.goto(base + '/#setores/industria')
      const painel = p.locator('.setores .desk-panel'); await painel.waitFor()
      await painel.locator('.sector-news-list > li').first().waitFor()
      assert.match(await painel.innerText(), /Produção industrial cai/)
      assert.equal(await painel.locator('.sector-news-list > li').count(), 1, 'somente publicação industrial dentro de 120h')
      assert.doesNotMatch(await painel.locator('.sector-news').innerText(), /Produção industrial expirada/)
      const central = p.locator('.central-setorial')
      await central.getByRole('heading', { name: 'Explore por setor', exact: true }).waitFor()
      assert.equal(await central.locator('.central-catalog').count(), 0, 'conteúdo setorial usa a largura sem catálogo lateral')
      assert.equal(await central.getByLabel('Trocar subsetor', { exact: true }).count(), 1)
      assert.equal(await central.getByRole('button', { name: 'Referência B3', exact: true }).count(), 0)
      await central.getByRole('button', { name: 'Todos os setores', exact: true }).click()
      await central.locator('.central-folder').first().waitFor()
      await central.getByRole('button', { name: 'Cobre', exact: true }).click()
      await p.waitForURL('**/#setores/cobre')
      await painel.locator('.setor-preco').waitFor()
      assert.match(await painel.locator('.setor-preco').innerText(), /10\.000,00/)
      await painel.locator('.sector-news-list > li').first().waitFor()
      assert.equal(await painel.locator('.sector-news-list > li').count(), 2, 'duas notícias do cobre em 120h')
      assert.doesNotMatch(await painel.locator('.sector-news').innerText(), /Preço do cobre expirado/)
      assert.equal(await painel.locator('.sector-news-meta').first().innerText(), 'Publicações de 31/10/2026 a 05/11/2026.') // Frozen fixture clock; retention assertions above remain in place.
      assert.equal(await painel.getByRole('region', { name: /Preparar a visita/ }).count(), 0, 'preparação de visita removida conforme o catálogo atual')
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem rolagem lateral a ${width}px`)
      if (out) await p.screenshot({ path: path.join(out, `setores-${width}-cobre.png`), fullPage: true })
      assert.deepEqual(errors, [])
      console.log(`${width} PASS central de setores com notícias institucionais, janela120h e insumos`)
      await p.close()
    }
    // Resumo › Notícias: Manchetes e Reforma tributária como linha do tempo da semana, quebrada por dia
    const newsTimes = [
      { name: 'meio-dia', iso: '2026-11-05T15:00:00Z', day: /^Hoje.*05\/11(?:\s|$)/i },
      { name: 'antes da meia-noite', iso: '2026-11-05T02:59:50Z', day: /^Hoje.*04\/11(?:\s|$)/i },
      { name: 'depois da meia-noite', iso: '2026-11-05T03:00:10Z', day: /^Quarta-feira.*04\/11(?:\s|$)/i },
    ]
    for (const width of [390, 1280]) for (const clockCase of newsTimes) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      // Navegador e fixture compartilham o mesmo instante; timers/RAF continuam funcionando.
      const agora = Date.parse(clockCase.iso), min = 60e3
      await p.clock.setFixedTime(agora)
      const mat = (title, atras, source) => ({ title, link: `https://exemplo.com/${encodeURIComponent(title)}`, source, sourceUrl: 'https://www.gov.br', t: agora - atras * min })
      const reforma = { schemaVersion: 1, generatedAt: agora, topic: 'reforma-tributaria', windowDays: 7, stale: false, error: null, items: [
        mat('Reforma tributária: Senado vota regulamentação', 1, 'Valor Econômico'), mat('IBS e CBS: o que muda para o varejo', 2, 'Folha'), mat('Comitê Gestor do IBS é instalado', 3, 'Valor Econômico'),
        mat('Imposto seletivo entra em debate na Câmara', 30 * 60, 'Estadão'), mat('Reforma tributária e o cashback para famílias', 55 * 60, 'Valor Econômico')] }
      await p.route('**/curadoria-noticias.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: agora, windowDays: 7, topics: { reforma: { label: 'Reforma tributária', checkedAt: agora, lastSuccessAt: agora, status: 'ok', items: reforma.items } } } }))
      // Um minuto antes pode ser o dia anterior em Brasília: o rótulo esperado muda no caso após meia-noite.
      const nota = (title, source = 'Valor Econômico') => ({ title, link: `https://exemplo.com/n/${encodeURIComponent(title)}`, source, t: agora - 60e3 })
      await p.route('**/news.json*', (r) => r.fulfill({ json: { generatedAt: agora, stale: {}, errors: [], news: { USD: [nota('Dólar sobe com fala do Fed')], EUR: [nota('BCE mantém juros na zona do euro')], JPY: [], CNH: [], MERCADO: [nota('Ibovespa e juros futuros recuam; iene dispara'), nota('Safra de soja avança no Mato Grosso')] } } }))
      await p.goto(base + '/#resumo')
      const painel = p.locator('.desk-panel', { has: p.getByRole('tab', { name: 'Reforma tributária' }) }); await painel.waitFor()
      assert.equal(await painel.getByRole('tab', { name: 'Moedas' }).getAttribute('aria-selected'), 'true', 'abre em Moedas')
      assert.equal(await painel.locator('.refresh-btn').count(), 0, 'Notícias se atualizam sozinhas: sem botão de atualizar')
      await painel.getByRole('tab', { name: 'Manchetes' }).click()
      // Manchetes: bandeira das moedas de que cada matéria fala (busca + título)
      const flags = painel.locator('.market-news li .news-flags'); await flags.first().waitFor()
      assert.match(await painel.locator('.market-news .reforma-day').first().innerText(), clockCase.day, `manchetes: ${clockCase.name} de Brasília`)
      assert.equal(await flags.count(), 3, 'uma linha de bandeiras por matéria que cita moeda; a de soja não tem')
      assert.equal(await painel.locator('.market-news li', { hasText: 'Dólar sobe' }).locator('.news-flags').getAttribute('aria-label'), 'Moedas citadas: dólar')
      assert.equal(await painel.locator('.market-news li', { hasText: 'iene dispara' }).locator('.news-flags .flag').count(), 2, 'iene e real (Ibovespa), as duas citadas no título')
      assert.equal(await painel.locator('.market-news li', { hasText: 'Safra de soja' }).locator('.news-flags').count(), 0)
      await painel.getByRole('tab', { name: 'Reforma tributária' }).click()
      assert.equal(await painel.getByRole('tab', { name: 'Reforma tributária' }).getAttribute('aria-selected'), 'true')
      const lista = painel.locator('.reforma'); await lista.locator('li').first().waitFor()
      assert.equal(await lista.locator('li').count(), 5, 'todas as matérias da semana')
      assert.ok(await lista.locator('.reforma-day').count() >= 2, 'agrupadas por dia')
      // linha do tempo enxuta: só a semana, de hoje para trás, quebrada por dia; sem filtro de dia, busca nem legenda
      assert.doesNotMatch(await painel.innerText(), /Curadoria automática|Última consulta|Última coleta completa/)
      assert.equal(await painel.locator('.refresh-btn').count(), 0, 'Reforma: atualização automática, sem botão de atualizar')
      assert.equal(await lista.getByLabel('Buscar nas matérias').count(), 0, 'sem busca')
      assert.equal(await lista.locator('.reforma-days').count(), 0, 'sem filtro de dia')
      assert.match(await lista.innerText(), /últimos 7 dias \(168 horas\)/)
      assert.match(await lista.locator('.reforma-day').first().innerText(), clockCase.day, `reforma: ${clockCase.name} de Brasília`)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem rolagem lateral a ${width}px`)
      await painel.getByRole('tab', { name: 'Manchetes' }).click(); await painel.locator('.market-news').waitFor()
      assert.deepEqual(errors, [])
      console.log(`${width} PASS notícias com relógio controlado: ${clockCase.name} (${clockCase.iso})`)
      await p.close()
    }
    // laser pointer (estilo Excalidraw): botão discreto liga, arrastar risca, o traço se apaga sozinho, Esc e novo clique param; funciona dentro de diálogo modal
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto(base + '/#config')
      const botao = p.getByRole('button', { name: 'Laser pointer: riscar a tela' }); await botao.waitFor()
      // O portal muda o botão para o encaixe do cabeçalho no primeiro frame; aguarda visibilidade e estabilidade antes de medir.
      await botao.click({ trial: true })
      const box = await botao.boundingBox(); assert.ok(box && box.width >= 44 && box.height >= 44, 'área de toque estável de 44 px')
      assert.equal(await botao.getAttribute('aria-pressed'), 'false'); assert.equal(await p.locator('.laser-canvas').count(), 0)
      const pixels = () => p.evaluate(() => { const c = document.querySelector('.laser-canvas'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return n })
      await botao.click(); await p.locator('.laser-canvas').waitFor()
      assert.equal(await p.getByRole('button', { name: 'Laser pointer: riscar a tela' }).getAttribute('aria-pressed'), 'true')
      await p.mouse.move(60, 200); await p.mouse.down(); for (let i = 1; i <= 14; i++) await p.mouse.move(60 + i * 12, 200 + Math.sin(i / 2) * 40); await p.mouse.up()
      assert.ok(await pixels() > 300, 'o traço aparece na tela')
      await p.waitForTimeout(2000)
      assert.equal(await pixels(), 0, 'o traço se apaga sozinho, aos poucos')
      // o mouse segue normal com o laser ligado: clique simples chega à página; arrastar (mesmo começando num botão) só risca; Ctrl faz retângulo e Shift, seta
      const info = p.getByRole('button', { name: 'Informações e avisos gerais', exact: true }).first(), ib = await info.boundingBox()
      await p.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2); await p.mouse.down(); await p.mouse.move(ib.x + ib.width / 2 - 120, ib.y + ib.height / 2 + 90, { steps: 8 }); await p.mouse.up()
      assert.equal(await p.locator('dialog[open]').count(), 0, 'arrastar a partir de um botão não clica nele')
      assert.ok(await pixels() > 100, 'o arrasto riscou')
      await p.waitForTimeout(1800)
      await p.keyboard.down('Control'); await p.mouse.move(80, 300); await p.mouse.down(); await p.mouse.move(280, 420, { steps: 8 }); const rect = await pixels(); await p.mouse.up(); await p.keyboard.up('Control')
      assert.ok(rect > 300, 'Ctrl: retângulo na tela')
      await p.waitForTimeout(1800); assert.equal(await pixels(), 0, 'o retângulo também se apaga')
      await p.keyboard.down('Shift'); await p.mouse.move(80, 300); await p.mouse.down(); await p.mouse.move(280, 420, { steps: 8 }); const seta = await pixels(); await p.mouse.up(); await p.keyboard.up('Shift')
      assert.ok(seta > 150 && seta < rect, 'Shift: seta (linha e ponta), com menos tinta que o retângulo')
      await p.waitForTimeout(1800)
      await info.click(); await p.locator('dialog[open]').first().waitFor()
      await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.locator('.laser-canvas').waitFor({ state: 'detached' })
      await p.locator('dialog[open]').first().waitFor({ state: 'detached' }).catch(() => {})
      assert.equal(await p.getByRole('button', { name: 'Laser pointer: riscar a tela' }).getAttribute('aria-pressed'), 'false')
      await p.keyboard.press('Control+Backquote'); await p.locator('.laser-canvas').waitFor()
      await p.keyboard.press('Control+Backquote'); await p.locator('.laser-canvas').waitFor({ state: 'detached' })
      await p.keyboard.press('Control+Shift+Backquote'); await p.locator('.laser-canvas').waitFor()
      await p.getByRole('button', { name: 'Laser pointer: riscar a tela' }).click(); await p.locator('.laser-canvas').waitFor({ state: 'detached' })
      // dentro de um diálogo modal (tela ampliada), a camada vai para dentro dele
      await p.getByRole('button', { name: 'Informações e avisos gerais', exact: true }).first().click(); await p.locator('dialog[open]').first().waitFor()
      await p.keyboard.press('Alt+l'); await p.locator('dialog[open] .laser-canvas').waitFor()
      await p.keyboard.press('Escape'); await p.locator('.laser-canvas').waitFor({ state: 'detached' })
      assert.equal(await p.locator('dialog[open]').count() >= 1, true, 'o primeiro Esc para o laser sem fechar o diálogo')
      assert.deepEqual(errors, [])
      await p.close()
    }
    // base de dados em Configurações: uma linha por referência, com órgão, API e arquivo; busca; sem rolagem lateral
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      await p.goto(base + '/#config')
      const bd = p.locator('.desk-panel', { has: p.getByRole('heading', { name: 'Base de dados' }) }); await bd.waitFor()
      assert.ok(await bd.locator('.config-base tbody tr').count() >= 40, 'uma linha por referência')
      const t = await bd.innerText()
      assert.match(t, /economia\.awesomeapi\.com\.br\/json\/last/); assert.match(t, /SGS 432/); assert.match(t, /resumo_semanal_lpc/); assert.match(t, /BLS\.gov não pode atestar/)
      await bd.getByLabel('Buscar na base de dados').fill('SGS 4389')
      assert.equal(await bd.locator('.config-base tbody tr').count(), 1, 'a busca filtra por série')
      assert.match(await bd.locator('.config-base tbody tr').innerText(), /CDI/)
      await bd.getByLabel('Buscar na base de dados').fill('xyz inexistente'); assert.match(await bd.innerText(), /Nenhuma referência encontrada/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `sem rolagem lateral a ${width}px`)
      await p.close()
    }
    // minigráficos de IPCA, Selic e CDI nos cards do Mercado: só com dados observados, nada inventado
    {
      const day = 864e5, now = Date.now(), noon = (t) => { const d = new Date(t); d.setUTCHours(12, 0, 0, 0); return d.getTime() }
      const cdi = [], selic = [[noon(now - 700 * day), 14.9], [noon(now - 200 * day), 14.5], [noon(now - 2 * day), 14.5]]
      for (let t = now - 420 * day; t <= now - day; t += day) { const w = new Date(t).getUTCDay(); if (w && w < 6) cdi.push([noon(t), t < now - 200 * day ? 14.9 : 14.4]) }
      const macroOk = { generatedAt: now, cdi, selic, sofr: [], sofrAvg: [], ptax: {}, ptaxHist: {}, focus: null }
      for (const [label, macro, expected] of [['com dados', macroOk, true], ['sem dados', { ...macroOk, cdi: [], selic: [[noon(now - 2 * day), 14.5]] }, false]]) {
        const p = await openPage({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' })
        await p.route('**/ipca.json*', (r) => r.fulfill({ json: ipca }))
        await p.route('**/macro.json*', (r) => r.fulfill({ json: macro }))
        await p.goto(base + '/#resumo')
        const cards = p.locator('.kpis .kpi'); await cards.first().waitFor()
        const spark = (name) => cards.filter({ hasText: name }).first().locator('.kpi-spark[role="img"]')
        for (const name of ['Selic', 'CDI']) assert.equal(await spark(name).count(), expected ? 1 : 0, `${name} ${label}`)
        assert.equal(await spark('IPCA 12m').count(), 1, 'IPCA sempre tem 12 meses divulgados')
        if (expected) {
          assert.match(await spark('CDI').getAttribute('aria-label'), /CDI: fechamento mensal, 12 meses/)
          assert.match(await spark('IPCA 12m').getAttribute('aria-label'), /IPCA: últimos 12 meses divulgados/)
          assert.ok(await spark('CDI').locator('svg path.line').count() > 0)
        }
        await p.close()
      }
    }
    for (const width of [390, 1280]) {
      const p = await openPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' }), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.route('**/ipca.json*', (r) => r.fulfill({ json: ipca }))
      await p.route('**/divida.json*', (r) => r.fulfill({ json: divida }))
      await p.route('**/commodities.json*', (r) => r.fulfill({ json: commodities }))
      await p.route('**/commodities-brl.json*', (r) => r.fulfill({ json: commoditiesBrl }))
      await p.route('**/oil.json*', (r) => r.fulfill({ json: { benchmark: 'Brent', kind: 'spot', unit: 'USD/barril', value: 103.4, observationDate: '2026-10-27', releaseDate: '2026-10-28', generatedAt: new Date().toISOString(), stale: false, error: null, sourceName: 'EIA (fixture)', points: Array.from({ length: 40 }, (_, i) => { const d = new Date(Date.UTC(2026, 9, 27) - (39 - i) * 864e5); return { date: d.toISOString().slice(0, 10), value: +(95 + i * 0.2).toFixed(2) } }) } }))
      await p.route('**/fuels.json*', (r) => r.fulfill({ json: fuels }))
      await p.route('**/ipca-groups.json*', (r) => r.fulfill({ json: ipcaGroups }))
      await p.route('**/freight-jp.json*', (r) => r.fulfill({ json: jp }))
      // Cenários › Projeções: sinais ▲ ▼ = de cada banco contra o FOCUS, linha a linha
      await p.route('**/macro.json*', (r) => r.fulfill({ json: { generatedAt: Date.now(), cdi: [], selic: [], sofr: [], sofrAvg: [], ptax: {}, ptaxHist: {}, focus: { date: '2026-10-26', rows: [
        { label: 'PIB', values: { 2026: { median: 2.5 }, 2027: { median: 2 } } }, { label: 'IPCA', values: { 2026: { median: 4.5 }, 2027: { median: 4 } } },
        { label: 'Selic', values: { 2026: { median: 14.25 }, 2027: { median: 12 } } }, { label: 'Câmbio', values: { 2026: { median: 5.4 }, 2027: { median: 5.5 } } }] } } }))
      await p.route('**/cenarios.json*', (r) => r.fulfill({ json: { institutions: [
        { name: 'Itaú BBA', date: '2026-10-20', years: { 2026: { pib: 2.8, ipca: 4.2, selic: 14.25, usd: 5.4 } } },
        { name: 'Bradesco', date: '2026-10-20', years: { 2026: { pib: 2.5, ipca: 4.5 } } }] } }))
      const semana = (i) => new Date(Date.now() - i * 7 * 864e5).toISOString().slice(0, 10)
      const serieFocus = (base, passo) => Array.from({ length: 52 }, (_, i) => ({ d: semana(51 - i), v: +(base + i * passo).toFixed(2) }))
      const focusHist = { schemaVersion: 1, generatedAt: new Date().toISOString(), semanas: 52, anos: ['2026', '2027'], stale: false, error: null, series: { Selic: { 2026: serieFocus(11, 0.03), 2027: serieFocus(9.5, 0.02) }, IPCA: { 2026: serieFocus(3.8, 0.015), 2027: serieFocus(3.5, 0.01) }, PIB: { 2026: serieFocus(2.1, -0.01), 2027: serieFocus(1.8, 0) }, Câmbio: { 2026: serieFocus(5.6, -0.006), 2027: serieFocus(5.7, -0.004) } } }
      await p.route('**/focus-history.json*', (r) => r.fulfill({ json: focusHist }))
      await p.goto(base + '/#cenarios/projecoes')
      const sc = p.locator('.scenario-table'); await sc.waitFor()
      // histórico do Focus abaixo da tabela: 4 gráficos (PIB, IPCA, Selic, USD), 2 linhas cada (2026 e 2027), legenda com os anos
      const foc = p.locator('.focus-hist'); await foc.locator('.ml-svg').first().waitFor()
      assert.equal(await foc.locator('.focus-hist-item').count(), 4)
      assert.equal(await foc.locator('.ml-line').count(), 8)
      assert.match(await foc.locator('.ml-legend').first().innerText(), /2026[\s\S]*2027/)
      const tabelaBox = await sc.boundingBox(), focBox = await foc.boundingBox()
      assert.ok(focBox.y > tabelaBox.y, 'histórico abaixo da tabela')
      const rowOf = (name) => sc.locator('tbody tr', { hasText: name }).first()
      await rowOf('PIB').locator('.fm').first().waitFor()
      assert.equal(await rowOf('PIB').getByRole('img', { name: 'acima do Focus' }).count(), 1, 'Itaú acima no PIB')
      assert.equal(await rowOf('PIB').getByRole('img', { name: 'igual ao Focus' }).count(), 1, 'Bradesco igual no PIB')
      assert.equal(await rowOf('IPCA').getByRole('img', { name: 'abaixo do Focus' }).count(), 1, 'Itaú abaixo no IPCA')
      assert.equal(await rowOf('Selic').getByRole('img', { name: 'igual ao Focus' }).count(), 1)
      assert.equal(await sc.locator('tbody tr', { hasText: 'IPCA' }).first().locator('td').first().locator('.fm').count(), 0, 'a coluna FOCUS não recebe sinal')
      assert.equal(await rowOf('USD').getByRole('img', { name: 'igual ao Focus' }).count(), 1)
      assert.match(await sc.locator('caption').innerText(), /▲[\s\S]*acima[\s\S]*▼[\s\S]*abaixo[\s\S]*=[\s\S]*igual/)
      // menu na ordem pedida
      const names = await p.getByRole('navigation', { name: /Navegação principal|Seções/ }).getByRole('button').allInnerTexts()
      if (width >= 700) assert.deepEqual(names.slice(0, 3).map((t) => t.trim().toLowerCase().split(' ')[0]), ['mercado', 'juros', 'cenários'])
      // card do topo do Mercado: IPCA 12m no lugar do Brent; clique leva a Cenários › Inflação
      await p.route('**/indices.json*', (r) => r.fulfill({ json: { schemaVersion: 1, generatedAt: Date.now(), stale: false, errors: [], series: { ibov: { symbol: '^BVSP', unit: 'pontos', points: Array.from({ length: 10 }, (_, i) => [Date.now() - (10 - i) * 864e5, 130000 - (i === 9 ? 2600 : 0)]), stale: false } } } }))
      await p.goto(base + '/#resumo')
      const card = p.locator('.kpis .kpi', { hasText: 'IPCA 12m' })
      await card.waitFor()
      assert.equal(await p.locator('.kpis .kpi', { hasText: 'Brent' }).count(), 0)
      // Ibovespa no Mapa de variação; Selic/CDI/DI 1 ano só no celular (no computador já estão na faixa do topo)
      const ibov = p.locator('.kpis .kpi', { hasText: 'Ibovespa' }); await ibov.waitFor()
      assert.match(await ibov.innerText(), /127\.400[\s\S]*2,00%/)
      if (width >= 700) assert.equal(await p.locator('.kpis .kpi-taxa:visible').count(), 0, 'no computador os juros ficam só na faixa do topo'); else assert.equal(await p.locator('.kpis .kpi-taxa:visible').count(), await p.locator('.kpis .kpi-taxa').count(), 'no celular os cartões de juros continuam visíveis') // depende só do CSS, não de quando os juros carregam
      assert.match(await card.innerText(), /%[\s\S]*p\.p\./)
      await card.click()
      await p.waitForURL('**/#cenarios/inflacao')
      assert.equal((await p.locator('.cen-nav button[aria-current="true"]').textContent()).trim(), 'Inflação')
      assert.equal(await p.locator('.cen-nav button', { hasText: /^Outros$/ }).count(), 0, 'sem a aba genérica Outros')
      const table = p.locator('.ind-table').first()
      await table.waitFor()
      assert.equal(await table.locator('tbody').count(), 4, 'quatro leituras do IPCA')
      assert.match(await table.innerText(), /Acumulado em 12 meses/)
      // quadro abaixo de Inflação · IPCA: grupos do índice e fatores fora dele
      const infl = p.locator('section.infl'); await infl.waitFor()
      assert.ok((await infl.boundingBox()).y > (await table.boundingBox()).y, 'quadro abaixo da tabela do IPCA')
      const g = infl.locator('table').first()
      assert.equal(await g.locator('tbody tr').count(), 2, 'só os grupos: o índice geral já está na tabela Inflação · IPCA')
      assert.doesNotMatch(await g.innerText(), /Índice geral/)
      assert.match(await g.innerText(), /Alimentação e bebidas[\s\S]*\+0,22[\s\S]*Transportes[\s\S]*−0,10/)
      assert.equal(await g.getByRole('img', { name: 'acima do mês anterior' }).count(), 1, 'alimentação acelera; transportes cai')
      assert.equal(await g.getByRole('img', { name: 'abaixo do mês anterior' }).count(), 1)
      assert.match(await infl.locator('p.infl-summary').innerText(), /maior pressão veio de Alimentação e bebidas[\s\S]*maior alívio, de Transportes/)
      // clicar no grupo abre o gráfico mês a mês (barras da variação mensal), com valores ao passar o mouse, tabela e Fechar
      assert.match(await infl.locator('.infl-hint').innerText(), /Clique em um grupo/)
      await infl.getByRole('button', { name: 'Ver a variação mensal de Alimentação e bebidas nos últimos 12 meses' }).click()
      const gc = infl.locator('.infl-chart'); await gc.waitFor()
      assert.match(await gc.locator('h4').innerText(), /Alimentação e bebidas · variação mensal, últimos 12 meses/)
      assert.equal(await gc.locator('.infl-bar').count(), 2, 'uma barra por mês com dado (a fixture traz dois meses)')
      assert.equal(await infl.getByRole('button', { name: 'Ver a variação mensal de Alimentação e bebidas nos últimos 12 meses' }).getAttribute('aria-pressed'), 'true')
      await gc.locator('g[data-period="2026-09"]').hover(); assert.match(await gc.locator('.infl-pick').innerText(), /set\/26: \+1,00% no mês · contribuição \+0,22 p\.p\./)
      await gc.locator('summary').click(); assert.match(await gc.locator('table').innerText(), /Mês[\s\S]*set\/26[\s\S]*\+1,00[\s\S]*21,50[\s\S]*6,00/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await infl.getByRole('button', { name: 'Ver a variação mensal de Transportes nos últimos 12 meses' }).click()
      assert.match(await infl.locator('.infl-chart h4').innerText(), /Transportes/)
      await infl.getByRole('button', { name: 'Fechar o gráfico do grupo' }).click(); assert.equal(await infl.locator('.infl-chart').count(), 0)
      const ft = infl.locator('table.infl-factors')
      for (const label of ['Câmbio', 'Petróleo', 'Soja', 'Milho', 'Expectativas', 'Juros']) await ft.getByRole('rowheader', { name: new RegExp(label) }).waitFor()
      assert.match(await ft.locator('tr', { hasText: 'Expectativas' }).innerText(), /4,50%.*meta 3,0%/)
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      // dívida bruta do governo geral: assunto próprio (Cenários › Fiscal), fora da tela de inflação; a linha abre o histórico
      assert.equal(await p.locator('.ind-table').count(), 1, 'a tela de Inflação não traz a dívida')
      await p.locator('.cen-nav button', { hasText: 'Fiscal' }).click(); await p.waitForURL('**/#cenarios/fiscal')
      assert.equal((await p.locator('#outros-title').textContent()).trim(), 'Fiscal')
      assert.equal(await p.locator('section.infl').count(), 0, 'o quadro da inflação fica em Inflação')
      const dt = p.locator('.ind-table').first(); await dt.waitFor()
      assert.equal(await dt.locator('tbody').count(), 2, 'duas leituras da dívida bruta')
      assert.match(await dt.innerText(), /Máxima da série[\s\S]*DBGG · % do PIB[\s\S]*DBGG · saldo em R\$ bilhões/)
      assert.match(await dt.locator('tbody').first().innerText(), /82,93%[\s\S]*82,87%[\s\S]*\+0,06 p\.p\./, '% do PIB com duas casas, como o BCB publica: variação de 0,06 p.p. visível')
      await p.getByRole('button', { name: /DBGG . % do PIB: abrir gráfico/ }).click()
      const dd = p.getByRole('dialog', { name: /histórico de DBGG/i }); await dd.waitFor()
      assert.equal(await dd.locator('.chart-filters').count(), 1)
      await dd.locator('.plot svg').first().waitFor()
      await p.keyboard.press('Escape'); await dd.waitFor({ state: 'hidden' })
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem rolagem lateral com a tabela da dívida')
      // endereço antigo (#cenarios/outros) abre Inflação e vira o novo
      await p.goto(base + '/#cenarios/outros'); await p.waitForURL('**/#cenarios/inflacao')
      await p.locator('.ind-table').first().waitFor()
      await p.getByRole('button', { name: 'Acumulado em 12 meses: abrir gráfico' }).click()
      const d = p.getByRole('dialog', { name: /histórico de IPCA/ })
      await d.waitFor()
      assert.deepEqual(await d.locator('.expandable-controls button').allInnerTexts(), ['Fechar ×'])
      assert.equal(await d.locator('.chart-filters').count(), 1, 'filtros num bloco só, acima do gráfico')
      await d.getByRole('group', { name: 'Período do indicador' }).getByRole('button', { name: 'Tudo' }).click()
      await d.locator('.plot svg').first().waitFor()
      // período mensal no mesmo seletor de intervalo: grade de meses; dois cliques aplicam
      assert.equal(await d.locator('input[type="month"], input[type="date"]').count(), 0)
      const trig = d.getByRole('button', { name: /^Período do indicador: de .* a .*Abrir calendário$/ }); await trig.click()
      const cal = d.getByRole('dialog', { name: 'Período do indicador: calendário' }); await cal.waitFor()
      assert.equal(await cal.locator('.drp-grid-months .drp-cell').count(), 12)
      const ms = cal.locator('.drp-cell:not(:disabled)'); await ms.first().click(); await ms.last().click()
      await cal.waitFor({ state: 'hidden' })
      assert.match(await trig.innerText(), /^[a-zç]{3}\/\d{2} → [a-zç]{3}\/\d{2}$/)
      await p.keyboard.press('Escape'); await d.waitFor({ state: 'hidden' })
      // frete marítimo: mesma tabela; a linha abre o gráfico
      await p.goto(base + '/#cenarios/frete')
      const f = p.locator('.ind-table', { hasText: 'Transporte marítimo' })
      await f.waitFor()
      assert.match(await f.innerText(), /Δ mês %[\s\S]*12 meses %[\s\S]*Ano %/)
      assert.equal(await f.locator('tbody').count(), 2, 'EUA e Japão')
      assert.match(await f.innerText(), /Japão · Transporte marítimo/)
      await f.getByRole('button', { name: /Japão.*abrir histórico e gráfico/ }).click()
      const jd = p.getByRole('dialog', { name: /histórico de Japão/i }); await jd.waitFor()
      await p.keyboard.press('Escape'); await jd.waitFor({ state: 'hidden' })
      await f.getByRole('button', { name: /EUA.*abrir histórico e gráfico/ }).click()
      const fd = p.getByRole('dialog', { name: /histórico de /i }); await fd.waitFor()
      assert.equal(await fd.locator('.chart-filters').count(), 1)
      await p.keyboard.press('Escape'); await fd.waitFor({ state: 'hidden' })
      // atividade e emprego: tabela; a linha abre o gráfico em tela cheia
      await p.goto(base + '/#cenarios/atividade')
      const at = p.locator('.ind-table', { hasText: 'Payroll' }); await at.waitFor()
      assert.equal(await at.locator('tbody').count(), 5, 'cinco indicadores de atividade e emprego')
      assert.match(await at.innerText(), /Anterior[\s\S]*Variação[\s\S]*Ano anterior/)
      await at.getByRole('button', { name: /Payroll . EUA: abrir gráfico/ }).click()
      const ad = p.getByRole('dialog', { name: /histórico de Payroll/i }); await ad.waitFor()
      assert.equal(await ad.locator('.chart-filters').count(), 1)
      assert.deepEqual(await ad.locator('.expandable-controls button').allInnerTexts(), ['Fechar ×'])
      await p.keyboard.press('Escape'); await ad.waitFor({ state: 'hidden' })
      // commodities: tabela com variações; a linha com histórico abre o gráfico, a sem histórico não abre
      await p.goto(base + '/#cenarios/commodities')
      const ct = p.locator('.ind-table', { hasText: 'Ouro' }); await ct.waitFor()
      assert.match(await ct.innerText(), /Δ %[\s\S]*12 meses %[\s\S]*Ano %/)
      assert.equal(await ct.getByRole('button', { name: /Soja: histórico indisponível/ }).isDisabled(), true)
      await ct.getByRole('button', { name: /Ouro: abrir gráfico/ }).click()
      const cd = p.getByRole('dialog', { name: /histórico de Ouro/i }); await cd.waitFor()
      assert.equal(await cd.locator('.chart-filters').count(), 1)
      assert.deepEqual(await cd.locator('.expandable-controls button').allInnerTexts(), ['Fechar ×'])
      await cd.locator('.plot svg').first().waitFor()
      await p.keyboard.press('Escape'); await cd.waitFor({ state: 'hidden' })
      // o petróleo (Brent) mora aqui, na tabela de Commodities, e não mais solto no Mercado
      assert.match(await ct.innerText(), /Petróleo Brent/)
      // commodities em reais (IC-Br e soja) e combustíveis ao consumidor (ANP): tabelas próprias, com histórico semanal nos combustíveis
      const brlT = p.locator('.ind-table', { hasText: 'IC-Br · geral' }); await brlT.waitFor()
      assert.equal(await brlT.locator('tbody').count(), 5, 'quatro IC-Br e a soja em reais')
      assert.match(await brlT.innerText(), /Soja · R\$\/saca[\s\S]*estimativa mensal/)
      const fuT = p.locator('.ind-table', { hasText: 'Gasolina comum · bomba' }); await fuT.waitFor()
      assert.equal(await fuT.locator('tbody').count(), 4, 'gasolina, etanol, diesel e gás de cozinha')
      assert.match(await fuT.innerText(), /6,51[\s\S]*média semanal ao consumidor/)
      await fuT.getByRole('button', { name: /Gasolina comum · bomba: abrir gráfico/ }).click()
      const fh = p.getByRole('dialog', { name: /histórico de Gasolina comum/i }); await fh.waitFor()
      assert.match(await fh.innerText(), /observações semanais/)
      await fh.locator('.plot svg').first().waitFor()
      await p.keyboard.press('Escape'); await fh.waitFor({ state: 'hidden' })
      // o painel mostra só a data e a hora da última atualização: carimbo no cabeçalho e nenhuma fonte no texto
      assert.match(await p.locator('.refresh-stamp').first().innerText(), /\d{2}\/\d{2}\/\d{4}/)
      assert.doesNotMatch(await p.locator('.market-context').innerText(), /Fonte:|AwesomeAPI|SGS \d|EIA|Banco Mundial|ANP/)
      assert.equal(await p.getByText(/Cobertura parcial/).count(), 1, 'só a tabela de commodities em dólar está incompleta (fixture sem os novos ids)')
      // feriados: Londres, Tóquio e China entram na aba, com a bandeira do país em cada linha
      // O recorte móvel precisa de data conhecida; os escopos locais não herdam feriados nacionais.
      await p.clock.setFixedTime(Date.parse('2026-11-05T15:00:00Z'))
      await p.goto(base + '/#feriados')
      await p.locator('.fer-filter select').waitFor()
      const opts = await p.locator('.fer-filter option').allInnerTexts()
      for (const praca of ['Londres', 'Tóquio', 'China (continental)', 'Curitiba']) assert.ok(opts.includes(praca), praca)
      assert.ok(await p.locator('.fer-where .flag').count() > 0, 'bandeiras nas linhas de feriado')
      await p.locator('.fer-filter select').selectOption('JP')
      assert.ok(await p.locator('.fer-list li').count() > 0, 'feriados do Japão')
      await p.locator('.fer-filter select').selectOption('CWB')
      const padroeira = p.locator('.fer-list li', { hasText: 'Nossa Senhora da Luz dos Pinhais' })
      assert.equal(await padroeira.count(), 1, 'feriado religioso municipal de Curitiba dentro do recorte')
      assert.equal(await padroeira.locator('.fer-date b').innerText(), '08/09/27')
      assert.equal(await padroeira.locator('.fer-where').innerText(), 'Curitiba', 'a linha conserva somente o calendário selecionado')
      assert.doesNotMatch(await p.locator('.fer-months').innerText(), /Aniversário de Curitiba/, 'aniversário não é feriado municipal')
      await p.locator('.fer-filter select').selectOption('PRE')
      assert.equal(await p.locator('.fer-filter select').inputValue(), 'PRE')
      assert.equal(await p.locator('.fer-list li').count(), 0, 'sem datas estaduais inventadas ou herdadas dos calendários nacionais e municipais')
      assert.match(await p.locator('.fer-count').innerText(), /^0 datas cadastradas nesta seleção · cobertura parcial$/)
      assert.match(await p.locator('.feriados [role="status"]').innerText(), /Cobertura parcial: Estado do Paraná \(2026, 2027\) sem calendário completo verificado nesta base\. A ausência de registros não permite afirmar que não haverá feriados ou suspensões\./)
      assert.match(await p.locator('.feriados').innerText(), /Não há datas cadastradas nesta seleção\. Consulte a fonte oficial: a cobertura incompleta não indica ausência de feriados\./)
      assert.doesNotMatch(await p.locator('.feriados').innerText(), /Emancipação Política do Paraná/, '19 de dezembro não volta a ser apresentado como feriado civil estadual')
      // aprender: lista de conceitos de um lado, explicação do outro, sem texto sobre o método
      await p.goto(base + '/#aprender/conceitos')
      await p.locator('.learn-list').waitFor()
      const expandir = async () => {
        const button = p.getByRole('button', { name: 'Expandir todas', exact: true })
        if (!(await button.isDisabled())) await button.click()
        assert.equal(await p.locator('.learn-group[open]').count(), topicCount)
      }
      assert.equal(await p.locator('.learn-list li').count(), CONCEITOS.length)
      assert.deepEqual((await p.locator('.learn-list li button b').allTextContents()).sort(), CONCEITOS.map(concept => concept.nome.replace(/ \(.*\)/, '')).sort())
      assert.equal(await p.locator('.learn-list button', { hasText: 'Regime FÁCIL' }).count(), 1, 'o conceito existente de Regime FÁCIL está preservado')
      assert.equal(await p.locator('.learn-group[open]').count(), 0, 'categorias começam recolhidas')
      if (out) await p.screenshot({ path: path.join(out, `aprender-${width}-recolhido.png`), fullPage: true })
      await expandir()
      if (out) await p.screenshot({ path: path.join(out, `aprender-${width}-expandido.png`), fullPage: true })
      await p.getByRole('button', { name: 'Recolher todas', exact: true }).click()
      assert.equal(await p.locator('.learn-group[open]').count(), 0)
      await expandir()
      assert.doesNotMatch(await p.locator('main').innerText(), /feynman/i)
      await p.locator('.learn-list button', { hasText: 'Diferencial de juros' }).click()
      await p.locator('.learn-detail h2', { hasText: 'Diferencial de juros' }).waitFor()
      await openCallouts(p)
      assert.match(await p.locator('.learn-detail').innerText(), /9,62%[\s\S]*R\$ 5,48/)
      // tópicos e busca
      assert.deepEqual((await p.locator('.learn-topic > span').allTextContents()).map((t) => t.trim()), ['Juros e câmbio', 'Funding e risco', 'Operações de crédito', 'Comércio exterior', 'Inflação', 'Commodities', 'Tributos e trabalho'])
      const busca = p.getByRole('searchbox', { name: 'Buscar conceito' })
      await busca.fill('FIDC')
      assert.equal(await p.locator('.learn-list li').count(), 2) // FIDC e CRA (que cita a subordinação como num FIDC)
      assert.deepEqual((await p.locator('.learn-topic > span').allTextContents()).map((t) => t.trim()), ['Operações de crédito'], 'só o tópico com resultado')
      assert.equal(await p.locator('.learn-group[open]').count(), 1, 'busca revela categoria com resultado')
      assert.match(await p.locator('.learn-count').innerText(), /2 conceitos encontrados/)
      await busca.fill('debenture'); assert.equal(await p.locator('.learn-list li', { hasText: 'Debênture' }).count(), 1, 'busca sem acento')
      await busca.fill('zzzxyz'); assert.match(await p.locator('.learn-count').innerText(), /Nenhum conceito encontrado/); assert.equal(await p.locator('.learn-list li').count(), 0)
      await p.getByRole('button', { name: 'Limpar busca' }).click(); assert.equal(await busca.inputValue(), ''); assert.equal(await p.locator('.learn-list li').count(), CONCEITOS.length)
      assert.equal(await p.locator('.learn-group[open]').count(), topicCount, 'limpar busca restaura categorias abertas manualmente')
      await busca.fill('recebiveis'); await p.locator('.learn-list button', { hasText: 'FIDC' }).click()
      await p.locator('.learn-detail h2', { hasText: 'FIDC' }).waitFor()
      await openCallouts(p, [/^Onde você pode travar$/, /^Exemplo numérico/, /^Conecta com$/])
      assert.match(await p.locator('.learn-detail').innerText(), /subordinação[\s\S]*30%[\s\S]*R\$ 1\.000\.000[\s\S]*R\$ 1\.000\.000/)
      // conexões: em cada conceito, "Conecta com" leva ao conceito ligado; o quadro geral cobre todos
      assert.match(await p.locator('.learn-detail').innerText(), /Conecta com[\s\S]*Liquidação antecipada ›[\s\S]*Debênture ›[\s\S]*Nota comercial ›/i)
      await p.locator('.learn-detail .learn-conecta .learn-link', { hasText: 'Debênture' }).click()
      await p.locator('.learn-detail h2', { hasText: 'Debênture' }).waitFor()
      await busca.fill('')
      await expandir()
      for (const [nome, rx] of [['Debênture', /16,28%[\s\S]*162\.800/], ['Nota comercial', /17,42%[\s\S]*0,50 ano/], ['Inflação', /4,91%[\s\S]*9,1\d%/]]) {
        await p.locator('.learn-list button', { hasText: nome }).first().click()
        await p.locator('.learn-detail h2', { hasText: nome }).waitFor()
        await openCallouts(p)
        assert.match(await p.locator('.learn-detail').innerText(), rx, nome)
      }
      await p.locator('.learn-detail .learn-go').click(); await p.waitForURL('**/#cenarios/inflacao')
      await p.goto(base + '/#aprender/conceitos')
      await p.locator('.learn-list').waitFor()
      const geral = p.locator('.learn-detail')
      await geral.getByRole('heading', { name: 'Como as peças se encaixam' }).waitFor()
      assert.equal(await geral.locator('.learn-links').first().locator('li').count(), CONCEITOS.length, 'um papel para cada conceito')
      assert.match(await geral.innerText(), /O caminho de ponta a ponta[\s\S]*Inflação →[\s\S]*Quem se liga a quem[\s\S]*Liquidação antecipada ↔ FIDC/i)
      const buscaFinal = p.getByRole('searchbox', { name: 'Buscar conceito' })
      for (const [buscaTema, titulo, slug] of [['Escala 6x1', /Escala 6x1/, 'escala-6x1'], ['Reforma Tributária', /Reforma Tributária/, 'reforma-tributaria'], ['Split Payment', /Split Payment/, 'split-payment'], ['Dividendos', /Dividendos/, 'dividendos'], ['CET', /CET \(Custo Efetivo Total\)/, 'cet']]) {
        await buscaFinal.fill(buscaTema)
        await p.locator('.learn-list li button', { hasText: slug === 'cet' ? /^CET/ : titulo }).first().click()
        await p.locator('.learn-detail h2', { hasText: titulo }).waitFor()
        assert.equal(await p.locator('.learn-detail details').filter({ has: p.locator('summary', { hasText: /^Fontes$/ }) }).count(), 1, 'novo tema informa fontes')
        if (slug === 'cet') {
          await openCallouts(p)
          assert.match(await p.locator('.learn-detail').innerText(), /13,40% ao ano/)
          await p.locator('.learn-detail summary', { hasText: /^Versão precisa$/ }).click()
          assert.match(await p.locator('.learn-detail [role="math"]').innerText(), /dj − d0.*365/)
          await p.locator('.learn-detail summary', { hasText: /^Fontes$/ }).click()
          assert.equal(await p.locator('.learn-detail a[href="https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolu%C3%A7%C3%A3o4881.pdf"]').count(), 1)
        }
        if (out) await p.screenshot({ path: path.join(out, `aprender-${width}-${slug}.png`), fullPage: true })
      }
      await buscaFinal.fill('')
      await expandir()
      await p.locator('.learn-list button', { hasText: 'Liquidação antecipada' }).click()
      await p.locator('.learn-detail h2', { hasText: 'Liquidação antecipada' }).waitFor()
      await openCallouts(p)
      assert.match(await p.locator('.learn-detail').innerText(), /Na curva[\s\S]*1\.150\.000[\s\S]*1\.180\.804[\s\S]*Break funding[\s\S]*10\.089/)
      await p.locator('.learn-list button', { hasText: 'SOFR' }).click()
      await p.locator('.learn-detail h2', { hasText: 'SOFR' }).waitFor()
      if (width >= 1000) { const l = await p.locator('.learn-list').boundingBox(), d = await p.locator('.learn-detail').boundingBox(); assert.ok(d.x > l.x + l.width - 1, 'explicação ao lado da lista') }
      assert.deepEqual(errors, [])
      console.log(width + ' PASS IPCA em Inflação, dívida em Fiscal (tabela, gráfico em tela cheia, filtros no topo) e frete em tabela')
      await p.close()
    }
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
