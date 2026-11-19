// Apresentar (#apresentar): montagem por seleção de blocos, slides claros com as peças do painel, notícias com ajuste,
// calculadora em dois modos, apresentação em tela com teclado e Escape; computador e celular.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const DIA = 864e5, agora = Date.now()
const diaria = (n, de, ate) => Array.from({ length: n }, (_, i) => ({ t: agora - (n - 1 - i) * DIA, bid: +(de + ((ate - de) * i) / (n - 1)).toFixed(4), high: ate, low: de }))
// Dólar com degraus de 1,2% a cada 60 dias: dias de variação forte, que o painel marca com bolinhas de notícia.
const usdPontos = diaria(400, 5.0, 5.3).map((p, i) => ({ ...p, bid: +(p.bid * (Math.floor(i / 60) % 2 ? 1.012 : 1)).toFixed(4) }))
const diaBr = (t) => new Date(t - 3 * 3600e3).toISOString().slice(0, 10)
const fxNoticias = { generatedAt: agora, moedas: { USD: { dias: Object.fromEntries(usdPontos.map((p) => [diaBr(p.t), { itens: [{ t: p.t, title: 'Manchete de teste sobre o dólar', source: 'Veículo de teste', link: `https://exemplo.test/fx/${diaBr(p.t)}` }] }])) } } }
// Tabela de commodities com as 20 referências do painel (mais o Brent, de oil.json): 21 linhas, como no site.
const IDS_COMMODITIES = ['wti', 'henry-hub', 'ny-diesel', 'ny-gasoline', 'gold', 'copper', 'aluminum', 'iron-ore', 'soybeans', 'corn', 'sugar', 'coffee', 'urea', 'dap', 'wheat', 'beef', 'cotton', 'coal', 'cocoa', 'pulp-br']
const mesesAtras = (i) => { const d = new Date(agora); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7) }
const commodities = { schemaVersion: 1, generatedAt: new Date(agora).toISOString(), commodities: IDS_COMMODITIES.map((id, k) => ({ id, label: `Referência ${id}`, unit: 'USD/tonelada', nature: 'média mensal', sourceName: 'Fonte de teste', sourceUrl: 'https://exemplo.test/fonte', benchmark: 'ref', value: 100 + k, period: mesesAtras(1), checkedAt: new Date(agora).toISOString(), stale: false, error: null, history: Array.from({ length: 13 }, (_, i) => ({ period: mesesAtras(13 - i), value: 90 + k + i })) })) }
const history = { generatedAt: agora, series: { USD: { source: 'USD', points: usdPontos }, EUR: { source: 'EUR', points: diaria(400, 5.8, 6.1) }, JPY: { source: 'JPY', points: diaria(400, 0.034, 0.035) }, CNH: { source: 'CNH', points: diaria(400, 0.7, 0.74) } } }
const raw = (bid, pct) => ({ bid: String(bid), ask: String(bid * 1.0003), high: String(bid * 1.01), low: String(bid * 0.99), pctChange: String(pct), varBid: '0.01', timestamp: String(Math.floor((agora - 60000) / 1000)) })
const quotes = { generatedAt: agora - 60000, source: 'AwesomeAPI', rejected: {}, quotes: { USDBRL: raw(5.3, 0.25), EURBRL: raw(6.1, -0.1), JPYBRL: raw(0.035, 0), USDCNH: raw(7.16, 0.05) } }
const macro = { generatedAt: agora, cdi: Array.from({ length: 260 }, (_, i) => [agora - (259 - i) * DIA, +(14.9 - Math.floor(i / 52) * 0.25).toFixed(2)]), selic: [[agora - 300 * DIA, 15], [agora - 40 * DIA, 13.75]], sofr: [], sofrAvg: [], focus: { date: new Date(agora - 4 * DIA).toISOString().slice(0, 10), rows: [] }, ptax: {}, ptaxHist: {}, errors: [], stale: {} }
const materia = (i, assunto) => ({ t: agora - (i + 1) * 3 * 3600e3, title: `${assunto}: matéria de teste ${i + 1}`, source: 'Veículo de teste', link: `https://exemplo.test/${assunto}/${i + 1}` })
const news = { generatedAt: agora, news: { USD: [0, 1, 2].map((i) => materia(i, 'dolar')), EUR: [], JPY: [], CNH: [], MERCADO: [materia(0, 'mercado')] }, stale: {}, errors: [] }
const temas = { schemaVersion: 1, generatedAt: agora, windowDays: 5, stale: false, errors: [], temas: { 'moeda-usd': { label: 'Dólar', grupo: 'moeda', items: [materia(3, 'dolar-imprensa')] }, madeira: { label: 'Madeira e base florestal', grupo: 'setor', items: [materia(0, 'madeira'), materia(1, 'madeira')] } } }
const mesIso = (i) => { const d = new Date(agora); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7) }
const ipca = { schemaVersion: 1, generatedAt: new Date(agora).toISOString(), series: { id: 'ipca', sourceName: 'IBGE', sourceUrl: 'https://exemplo.test/ipca', checkedAt: new Date(agora).toISOString(), stale: false, points: Array.from({ length: 30 }, (_, i) => ({ period: mesIso(30 - i), mom: +(0.2 + (i % 5) * 0.1).toFixed(2), ytd: +(1 + (i % 12) * 0.35).toFixed(2), y12: +(4 + (i % 7) * 0.1).toFixed(2), index: 7000 + i * 25 })) } }
const NOME = 'Cliente Fictício de Teste'
const out = process.env.SMOKE_OUT || '/tmp'
;(async () => {
  const b = await chromium.launch(require('./smoke-launch.cjs')()), base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5216'
  try {
    for (const width of [1280, 390]) {
      const ctx = await b.newContext({ viewport: { width, height: width > 700 ? 800 : 844 }, serviceWorkers: 'block' })
      await ctx.addInitScript(() => { try { localStorage.setItem('painel-theme', 'dark') } catch { /* sem armazenamento */ } })
      const p = await ctx.newPage(), errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await ctx.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()))
      await p.route('**/quotes.json*', (r) => r.fulfill({ json: quotes }))
      await p.route('**/history.json*', (r) => r.fulfill({ json: history }))
      await p.route('**/macro.json*', (r) => r.fulfill({ json: macro }))
      await p.route('**/news.json*', (r) => r.fulfill({ json: news }))
      await p.route('**/temas.json*', (r) => r.fulfill({ json: temas }))
      await p.route('**/ipca.json*', (r) => r.fulfill({ json: ipca }))
      await p.route('**/fx-noticias.json*', (r) => r.fulfill({ json: fxNoticias }))
      await p.route('**/commodities.json*', (r) => r.fulfill({ json: commodities }))
      await p.goto(base + '/#apresentar')
      const tela = p.locator('.apz'); await tela.waitFor()
      const tema = () => p.evaluate(() => document.documentElement.dataset.theme)
      // a aba é sempre clara, mesmo com o painel no tema escuro; a escolha guardada não muda
      assert.equal(await tema(), 'light')
      assert.equal(await p.evaluate(() => localStorage.getItem('painel-theme')), 'dark')
      // sem bloco marcado: só a capa, orientação na tela e apresentar desligado
      const apresentar = p.getByRole('button', { name: 'Iniciar apresentação' })
      assert.ok(await apresentar.isDisabled())
      await p.locator('.apz-vazio').waitFor()
      assert.equal(await p.locator('.apz-item').count(), 1)
      await p.getByRole('textbox', { name: /Cliente/ }).fill(NOME)
      await p.getByRole('textbox', { name: /Setor/ }).fill('Indústria de madeira')
      assert.match(await p.locator('.apz-item .sl-capa').innerText(), new RegExp(`${NOME}[\\s\\S]*Indústria de madeira`))
      // marca um bloco de cada tipo: tabela, gráfico, notícias e calculadora
      const grupo = async (nome) => { const g = p.locator('.apz-grupo', { has: p.locator('.apz-grupo-nome', { hasText: new RegExp(`^${nome}$`) }) }); if ((await g.getAttribute('open')) === null) await g.locator('summary').click(); return g }
      const marcar = async (g, rotulo) => g.locator('.apz-opcao', { hasText: rotulo }).first().locator('input').check()
      await marcar(await grupo('Mercado'), 'Tabela de câmbio')
      await marcar(await grupo('Juros'), /^CDI$/)
      const noticias = await grupo('Notícias')
      await marcar(noticias, /^Dólar$/)
      await marcar(await grupo('Calculadoras'), 'Capital de Giro')
      assert.equal(await p.locator('.apz-total').innerText(), '5 slides')
      assert.equal(await p.locator('.apz-item').count(), 5)
      assert.deepEqual(await p.locator('.apz-nome').allInnerTexts(), ['Capa', 'Câmbio em reais', 'CDI no último ano', 'Notícias · Dólar', 'Capital de Giro'])
      // miniaturas são o slide real, sem foco nem clique dentro delas
      assert.equal(await p.locator('.apz-escala[inert]').count(), 5)
      await p.locator('.apz-item', { hasText: 'Câmbio em reais' }).locator('.market-table').waitFor()
      // notícias: juntam as coleções do tema; dá para tirar uma manchete
      const slideNoticias = p.locator('.apz-item', { hasText: 'Notícias · Dólar' })
      await slideNoticias.locator('.sl-noticias li').first().waitFor()
      assert.equal(await slideNoticias.locator('.sl-noticias li').count(), 4)
      await noticias.locator('.apz-ajuste summary').click()
      assert.equal(await noticias.locator('.apz-ajuste li').count(), 4)
      await noticias.locator('.apz-ajuste li', { hasText: 'matéria de teste 1' }).first().locator('input').uncheck()
      assert.equal(await slideNoticias.locator('.sl-noticias li').count(), 3)
      assert.ok(!(await slideNoticias.innerText()).includes('dolar: matéria de teste 1'))
      // ordem: o CDI sobe uma posição
      await p.getByRole('button', { name: 'Subir o slide CDI no último ano' }).click()
      assert.deepEqual((await p.locator('.apz-nome').allInnerTexts()).slice(1, 3), ['CDI no último ano', 'Câmbio em reais'])
      // busca de blocos: acha pelo nome, sem acento
      await p.getByRole('searchbox', { name: 'Buscar um bloco' }).fill('historico focus selic')
      assert.deepEqual(await p.locator('.apz-achados .apz-opcao').allInnerTexts().then((t) => t.map((x) => x.split('\n')[0])), ['Histórico do Focus · Selic'])
      await p.getByRole('searchbox', { name: 'Buscar um bloco' }).fill('')
      await p.screenshot({ path: `${out}/apresentar-montagem-${width}.png`, fullPage: true })
      // sem rolagem lateral na página
      assert.ok(await p.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1), 'a montagem não pode rolar para o lado')

      // apresentação em tela
      await apresentar.click()
      const palco = p.getByRole('dialog', { name: 'Apresentação' }); await palco.waitFor()
      const contador = palco.locator('.apr-contador')
      const atual = palco.locator('.apz-atual .sl')
      assert.equal(await contador.innerText(), '1 / 5')
      assert.match(await atual.innerText(), new RegExp(NOME))
      // slide claro, inteiro na tela e sem corte do conteúdo
      const conferir = async () => {
        await p.waitForTimeout(700)
        const m = await p.evaluate(() => {
          const sl = document.querySelector('.apz-atual .sl'), r = sl.getBoundingClientRect(), c = sl.querySelector('.sl-ajuste:not(.sl-ajuste-rolar)'), mi = c?.querySelector('.sl-miolo')
          return { fundo: getComputedStyle(sl).backgroundColor, dentro: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, sobra: c ? mi.getBoundingClientRect().height - c.getBoundingClientRect().height : 0 }
        })
        assert.ok(m.dentro, 'o slide cabe inteiro na tela')
        assert.ok(m.sobra <= 2, `conteúdo cortado em ${m.sobra}px`)
        return m
      }
      await p.keyboard.press('ArrowRight')
      assert.equal(await contador.innerText(), '2 / 5')
      assert.equal((await conferir()).fundo, 'rgb(255, 255, 255)')
      await atual.locator('svg.hist-svg, .plot svg').first().waitFor() // o gráfico do CDI é o do painel
      assert.match(await atual.locator('.sl-rodape').innerText(), /Fonte: Banco Central do Brasil[\s\S]*Cliente Fictício de Teste · 2 \/ 5/)
      await p.screenshot({ path: `${out}/apresentar-cdi-${width}.png` })
      await p.keyboard.press('ArrowRight')
      await atual.locator('.market-table tbody').first().waitFor()
      await conferir()
      assert.match(await atual.innerText(), /USD\/BRL[\s\S]*5,3000/)
      await p.keyboard.press('ArrowRight')
      await conferir()
      assert.equal(await atual.locator('.sl-noticias li').count(), 3)
      // calculadora: abre no resultado (há valores padrão); "Dados" mostra os campos; o que foi digitado vale no resultado
      await p.keyboard.press('End')
      assert.equal(await contador.innerText(), '5 / 5')
      await conferir()
      const modos = atual.locator('.sl-calc-modos')
      assert.equal(await modos.getByRole('button', { name: 'Resultado' }).getAttribute('aria-pressed'), 'true')
      const antes = await atual.locator('.calc-result-shell').innerText()
      assert.match(antes, /R\$\s[\d.]+,\d\d/)
      assert.equal(await atual.locator('.giro-form:visible').count(), 0) // no modo Resultado os campos saem
      await modos.getByRole('button', { name: 'Dados' }).click()
      await atual.locator('.giro-form').waitFor()
      assert.equal(await atual.locator('.calc-result-shell:visible').count(), 0)
      // Data da liberação fica à vista, na linha mestra (19/11/2026).
      assert.equal(await atual.getByLabel('Data da liberação', { exact: true }).isVisible(), true)
      const iof = atual.getByText('Enquadramento do IOF', { exact: true })
      await iof.click()
      assert.equal(await atual.getByLabel('Perfil tributário', { exact: true }).isVisible(), true)
      await iof.click()
      const valor = atual.getByLabel('Valor solicitado', { exact: true })
      await valor.fill('250.000,00'); await valor.blur()
      // dentro de um campo, as setas e o espaço são do campo: o slide não troca
      await valor.focus(); await p.keyboard.press('ArrowLeft')
      assert.equal(await contador.innerText(), '5 / 5')
      await modos.getByRole('button', { name: 'Resultado' }).click()
      await atual.locator('.calc-result-shell').waitFor()
      const depois = await atual.locator('.calc-result-shell').innerText()
      assert.notEqual(depois, antes, 'o resultado acompanha os números digitados')
      await conferir()
      await p.screenshot({ path: `${out}/apresentar-calculadora-${width}.png` })
      // botões da barra e Escape
      await palco.getByRole('button', { name: 'Slide anterior' }).click()
      assert.equal(await contador.innerText(), '4 / 5')
      await p.keyboard.press('Home')
      assert.equal(await contador.innerText(), '1 / 5')
      await p.keyboard.press('Escape')
      await palco.waitFor({ state: 'detached' })
      await tela.waitFor()
      // o que foi digitado na calculadora continua no mesmo slide ao voltar para a montagem
      assert.equal(await p.locator('.apz-item', { hasText: 'Capital de Giro' }).locator('.calc-result-shell').innerText(), depois)
      // clicar numa miniatura apresenta a partir dela
      await p.getByRole('button', { name: /Apresentar a partir do slide 3/ }).click()
      assert.equal(await p.getByRole('dialog', { name: 'Apresentação' }).locator('.apr-contador').innerText(), '3 / 5')
      await p.getByRole('dialog', { name: 'Apresentação' }).getByRole('button', { name: 'Sair' }).click()
      // o nome do cliente não foi gravado no navegador
      const guardado = await p.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))
      assert.ok(!guardado.includes('Fictício'), 'o nome do cliente não pode ficar guardado')
      // a montagem sobrevive à troca de aba; ao sair, o painel volta ao tema escolhido
      await p.evaluate(() => { location.hash = '#feriados' })
      await p.locator('.feriados').waitFor()
      assert.equal(await tema(), 'dark')
      await p.evaluate(() => { location.hash = '#apresentar' })
      await tela.waitFor()
      assert.equal(await tema(), 'light')
      assert.equal(await p.locator('.apz-total').innerText(), '5 slides')
      assert.equal(await p.getByRole('textbox', { name: /Cliente/ }).inputValue(), NOME)
      // janela de detalhe aberta dentro do slide: Esc fecha só a janela e as setas não trocam o slide por baixo
      await marcar(await grupo('Cenários'), /^IPCA$/)
      await p.getByRole('button', { name: /Apresentar a partir do slide 6/ }).click()
      const palco2 = p.getByRole('dialog', { name: 'Apresentação' })
      await palco2.locator('.apz-atual table button').first().click()
      const detalhe = p.locator('dialog[open]').last(); await detalhe.waitFor()
      await p.keyboard.press('ArrowLeft')
      assert.equal(await palco2.locator('.apr-contador').innerText(), '6 / 6')
      await p.keyboard.press('Escape')
      await detalhe.waitFor({ state: 'detached' })
      assert.equal(await palco2.locator('.apr-contador').innerText(), '6 / 6', 'a apresentação continua aberta')
      await p.keyboard.press('Escape')
      await palco2.waitFor({ state: 'detached' })
      // saindo, o foco volta para a miniatura do slide mostrado
      assert.match(await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || ''), /Apresentar a partir do slide 6/)
      // a mesma peça em dois slides (IPCA e IPCA por grupos): cada quadro continua ligado ao título do próprio slide
      await marcar(await grupo('Cenários'), /^IPCA por grupos/)
      await p.waitForTimeout(400)
      const ligacoes = await p.evaluate(() => {
        const refs = [...document.querySelectorAll('.apz-item [aria-labelledby]')].map((el) => ({ el, id: el.getAttribute('aria-labelledby').split(/\s+/)[0] }))
        const achar = (base, id) => base.querySelectorAll(`[id="${CSS.escape(id)}"]`).length
        return { total: refs.length, repetidos: refs.filter((r) => achar(document, r.id) > 1).map((r) => r.id), fora: refs.filter((r) => achar(document, r.id) === 1 && !achar(r.el.closest('.apz-item'), r.id)).map((r) => r.id) }
      })
      assert.ok(ligacoes.total > 2)
      assert.deepEqual(ligacoes.repetidos, [], 'identificador repetido entre slides')
      assert.deepEqual(ligacoes.fora, [], 'quadro ligado a título de outro slide')
      // indicadores do dia: cartões de câmbio no slide; sem cotação válida o slide avisa em vez de ficar em branco
      await marcar(await grupo('Mercado'), 'Indicadores do dia')
      const indicadores = p.locator('.apz-item', { hasText: 'Mercado hoje' })
      await indicadores.locator('.kpi').first().waitFor()
      assert.ok(await indicadores.locator('.kpi').count() >= 2)
      // o gráfico de moeda vai sem as bolinhas de notícia do painel (no slide, notícia entra pelo bloco de Notícias)
      await marcar(await grupo('Mercado'), /^Dólar$/)
      const dolar = p.locator('.apz-item', { hasText: 'Dólar em reais' })
      await dolar.locator('.plot, .placeholder').first().waitFor()
      await dolar.locator('.plot').first().waitFor()
      assert.ok(await dolar.locator('.fx-dots button').count() > 0, 'o teste precisa de bolinhas no gráfico para provar que elas ficam fora do slide')
      assert.equal(await dolar.locator('.fx-dots:visible, .fx-dots button:visible, .fx-legend:visible, .fx-news:visible').count(), 0)
      // o conteúdo de um slide da montagem cabe inteiro no corpo dele (nada cortado embaixo nem do lado)
      const semCorte = async (item, nome) => {
        await p.waitForTimeout(900)
        const m = await item.evaluate((el) => { const c = el.querySelector('.sl-ajuste'), mi = el.querySelector('.sl-miolo'), rc = c.getBoundingClientRect(); return { baixo: mi.getBoundingClientRect().height - rc.height, lado: Math.max(0, ...[...mi.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right - rc.right)) } })
        assert.ok(m.baixo <= 2 && m.lado <= 2, `${nome}: conteúdo cortado (${Math.round(m.baixo)}px embaixo, ${Math.round(m.lado)}px ao lado)`)
      }
      // recuperação judicial: cada slide mostra só o seu cartão (mapa por estado ou barras por setor), sem corte
      const cenarios = await grupo('Cenários')
      await marcar(cenarios, 'Recuperação judicial · por estado')
      await marcar(cenarios, 'Recuperação judicial · por setor')
      for (const [nome, titulo] of [['distribuição por estado', 'Distribuição por UF'], ['distribuição por setor', 'Distribuição por setor']]) {
        const item = p.locator('.apz-item', { hasText: `Recuperação judicial · ${nome}` })
        await item.locator('.rj-card:visible').first().waitFor()
        assert.deepEqual(await item.locator('.rj-card:visible h3').allInnerTexts(), [titulo], `slide ${nome}: um cartão só`)
        await semCorte(item, `Recuperação judicial · ${nome}`)
      }
      // commodities em dólar: 21 referências em dois slides complementares, todas as linhas dentro do slide
      await marcar(cenarios, 'Commodities em dólar · primeira parte')
      await marcar(cenarios, 'Commodities em dólar · segunda parte')
      const linhas = []
      for (const parte of ['primeira parte', 'segunda parte']) {
        const item = p.locator('.apz-item', { hasText: `Commodities em dólar · ${parte}` })
        await item.locator('.ind-table tbody:visible').first().waitFor()
        linhas.push(await item.locator('.ind-table tbody:visible .market-open b').allInnerTexts())
        await semCorte(item, `Commodities em dólar · ${parte}`)
      }
      assert.equal(linhas[0].length, 11)
      assert.equal(linhas[0].length + linhas[1].length, 21, 'nenhuma referência fica de fora')
      assert.equal(new Set([...linhas[0], ...linhas[1]]).size, 21, 'nenhuma referência repetida')
      assert.ok(linhas[1].some((t) => /pulp-br/.test(t)), 'a celulose aparece na segunda parte')
      // notícias de madeira: tema só da busca na imprensa, dentro de Indústria e transformação
      if ((await noticias.getAttribute('open')) === null) await noticias.locator('summary').first().click()
      await marcar(noticias, /^Madeira e base florestal$/)
      const slideMadeira = p.locator('.apz-item', { hasText: 'Notícias · Madeira e base florestal' })
      await slideMadeira.locator('.sl-noticias li').first().waitFor()
      assert.equal(await slideMadeira.locator('.sl-noticias li').count(), 2)
      // Faturamento: sem números, abre nos campos; com o exemplo fictício, o gráfico entra e cabe no slide; o período compara com o ano anterior
      await marcar(await grupo('Calculadoras'), /^Faturamento/)
      const posicao = (await p.locator('.apz-nome').allInnerTexts()).indexOf('Faturamento') + 1
      assert.ok(posicao > 1, 'o slide do Faturamento entrou na montagem')
      await p.getByRole('button', { name: new RegExp(`Apresentar a partir do slide ${posicao}\\b`) }).click()
      const palcoFat = p.getByRole('dialog', { name: 'Apresentação' }), fat = palcoFat.locator('.apz-atual .sl')
      await fat.locator('.ft-input').waitFor()
      assert.ok(await fat.getByRole('button', { name: 'Resultado', exact: true }).isDisabled(), 'sem números não há resultado')
      assert.match(await fat.locator('.sl-rodape').innerText(), /nada é salvo nem enviado/)
      await fat.getByRole('button', { name: 'Usar exemplo fictício' }).click()
      await fat.locator('.ft-chart').waitFor()
      assert.equal(await fat.getByRole('button', { name: 'Resultado', exact: true }).getAttribute('aria-pressed'), 'true')
      assert.equal(await fat.locator('.ft-input:visible').count(), 0) // no resultado, a caixa de colar sai
      const meses = await fat.locator('.ft-range select').first().locator('option:not([disabled])').evaluateAll((os) => os.map((o) => o.value))
      await fat.locator('.ft-range select').nth(0).selectOption(meses.at(-6))
      await fat.locator('.ft-range select').nth(1).selectOption(meses.at(-1))
      await fat.locator('.ft-table').waitFor()
      await p.waitForTimeout(700)
      const encaixe = await p.evaluate(() => {
        const sl = document.querySelector('.apz-atual .sl'), c = sl.querySelector('.sl-ajuste'), mi = c.querySelector('.sl-miolo'), g = sl.querySelector('.ft-chart').getBoundingClientRect(), r = c.getBoundingClientRect()
        const q = sl.closest('.apz-quadro')
        return { sobra: mi.getBoundingClientRect().height - r.height, graficoDentro: g.left >= r.left - 1 && g.right <= r.right + 1, anos: sl.querySelectorAll('.ft-year').length, rolagem: q ? [q.scrollLeft, q.scrollTop] : [0, 0], caixas: sl.querySelectorAll('.ft-box').length }
      })
      assert.ok(encaixe.sobra <= 2, `Faturamento cortado em ${encaixe.sobra}px`)
      assert.ok(encaixe.graficoDentro, 'o gráfico do Faturamento cabe na largura do slide')
      assert.ok(encaixe.anos >= 2, 'o resumo por ano aparece')
      assert.deepEqual(encaixe.rolagem, [0, 0], 'escolher o período não pode tirar o slide do lugar')
      assert.equal(encaixe.caixas, 2, 'o período escolhido e o do ano anterior ficam marcados no gráfico')
      await p.screenshot({ path: `${out}/apresentar-faturamento-${width}.png` })
      await palcoFat.getByRole('button', { name: 'Sair' }).click()
      // os números colados ficam só na página
      const guardadoFat = await p.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))
      assert.ok(!/Jan\/2[0-9]|Faturamento \(R\$/.test(guardadoFat), 'os números do Faturamento não podem ficar guardados')
      // leitura executiva do setor entra pela escolha do setor
      const setores = await grupo('Setores')
      await setores.locator('.apz-opcao', { hasText: 'Leitura executiva do setor' }).locator('input').check()
      assert.match(await p.locator('.apz-item').last().innerText(), /O QUE ACOMPANHAR|O que acompanhar/)
      // limpar tudo apaga cliente, setor e slides; fica só a capa
      await p.getByRole('button', { name: 'Limpar tudo' }).click()
      assert.equal(await p.locator('.apz-item').count(), 1)
      assert.equal(await p.getByRole('textbox', { name: /Cliente/ }).inputValue(), '')
      assert.deepEqual(errors, [])
      await ctx.close()
    }
    // a aba saiu do menu (computador e celular) em 18/11/2026, a pedido, e continua abrindo pelo endereço direto;
    // o menu do topo fica em uma linha também com o contador de pessoas online, que só aparece no site publicado
    for (const [width, tema] of [[1920, 'light'], [1820, 'light'], [1820, 'dark'], [1600, 'light'], [1280, 'light'], [1205, 'dark'], [1024, 'light'], [1024, 'dark'], [390, 'light']]) {
      const ctx = await b.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' })
      await ctx.addInitScript((t) => { try { localStorage.setItem('painel-theme', t) } catch { /* sem armazenamento */ } }, tema)
      const p = await ctx.newPage()
      await ctx.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()))
      await ctx.route('**/acessos.json*', (r) => r.fulfill({ json: { generatedAt: Date.now(), online: 12, hoje: { visitantes: 30, views: 90 }, semana: { visitantes: 120, views: 400 }, dias: [] } }))
      await ctx.route('**/quotes.json*', (r) => r.fulfill({ json: quotes })) // estado dos dados como no site (texto do estado ocupa espaço no topo)
      await ctx.route('**/macro.json*', (r) => r.fulfill({ json: macro }))
      await p.goto(base + '/')
      await p.locator('#conteudo').waitFor()
      if (width < 700) { await p.getByRole('button', { name: /^Mais/ }).filter({ visible: true }).first().click(); await p.getByRole('menuitem').first().waitFor() }
      assert.ok(await p.locator('nav button, nav [role="menuitem"]').filter({ visible: true }).count() >= 5)
      const item = p.locator('nav button, nav [role="menuitem"]', { hasText: /^Apresentar$/ }).filter({ visible: true })
      assert.equal(await item.count(), 0, 'Apresentar fica fora do menu')
      if (width < 700) await p.keyboard.press('Escape')
      await p.evaluate(() => { location.hash = '#apresentar' }) // fora do menu, abre pelo endereço direto
      await p.locator('.apz').waitFor()
      // no computador, o menu do topo continua em uma linha
      if (width > 700) {
        await p.locator('.online-badge').waitFor()
        await p.evaluate(() => document.fonts.ready)
        const umaLinha = () => p.evaluate(() => { const b = [...document.querySelectorAll('.topbar-tabs > button')].filter((e) => e.getClientRects().length); return new Set(b.map((e) => Math.round(e.getBoundingClientRect().top))).size === 1 })
        assert.ok(await umaLinha(), `menu do topo em uma linha a ${width}px (${tema})`)
        // os estados mais longos do texto dos dados (dataHealth.js): "Fora do horário de coleta" toda noite e fim de semana, e o erro escrito
        for (const [classe, rotulo] of [['idle', 'Fora do horário de coleta'], ['err', 'Indisponível']]) {
          await p.evaluate(([classe, rotulo]) => { const f = document.querySelector('.topbar-feed'); f.className = `topbar-feed ${classe}`; const t = [...f.childNodes].find((n) => n.nodeType === 3); if (t) t.textContent = rotulo; else f.append(rotulo) }, [classe, rotulo])
          assert.ok(await umaLinha(), `menu do topo em uma linha a ${width}px (${tema}) com o estado "${rotulo}"`)
        }
        assert.match(await p.locator('.online-badge').getAttribute('aria-label'), /12 online agora/) // o texto completo continua para leitor de tela
      }
      await p.evaluate(() => { location.hash = '#resumo' }); await p.evaluate(() => { location.hash = '#apresentar' })
      await p.locator('.apz').waitFor()
      await ctx.close()
    }
    console.log('smoke-apresentar ok')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
