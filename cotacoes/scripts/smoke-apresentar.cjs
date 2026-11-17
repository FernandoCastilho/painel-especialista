// Apresentar (#apresentar): montagem por seleção de blocos, slides claros com as peças do painel, notícias com ajuste,
// calculadora em dois modos, apresentação em tela com teclado e Escape; computador e celular.
const { chromium } = require('playwright'), assert = require('node:assert/strict')
const DIA = 864e5, agora = Date.now()
const diaria = (n, de, ate) => Array.from({ length: n }, (_, i) => ({ t: agora - (n - 1 - i) * DIA, bid: +(de + ((ate - de) * i) / (n - 1)).toFixed(4), high: ate, low: de }))
const history = { generatedAt: agora, series: { USD: { source: 'USD', points: diaria(400, 5.0, 5.3) }, EUR: { source: 'EUR', points: diaria(400, 5.8, 6.1) }, JPY: { source: 'JPY', points: diaria(400, 0.034, 0.035) }, CNH: { source: 'CNH', points: diaria(400, 0.7, 0.74) } } }
const raw = (bid, pct) => ({ bid: String(bid), ask: String(bid * 1.0003), high: String(bid * 1.01), low: String(bid * 0.99), pctChange: String(pct), varBid: '0.01', timestamp: String(Math.floor((agora - 60000) / 1000)) })
const quotes = { generatedAt: agora - 60000, source: 'AwesomeAPI', rejected: {}, quotes: { USDBRL: raw(5.3, 0.25), EURBRL: raw(6.1, -0.1), JPYBRL: raw(0.035, 0), USDCNH: raw(7.16, 0.05) } }
const macro = { generatedAt: agora, cdi: Array.from({ length: 260 }, (_, i) => [agora - (259 - i) * DIA, +(14.9 - Math.floor(i / 52) * 0.25).toFixed(2)]), selic: [[agora - 300 * DIA, 15], [agora - 40 * DIA, 13.75]], sofr: [], sofrAvg: [], focus: { date: new Date(agora - 4 * DIA).toISOString().slice(0, 10), rows: [] }, ptax: {}, ptaxHist: {}, errors: [], stale: {} }
const materia = (i, assunto) => ({ t: agora - (i + 1) * 3 * 3600e3, title: `${assunto}: matéria de teste ${i + 1}`, source: 'Veículo de teste', link: `https://exemplo.test/${assunto}/${i + 1}` })
const news = { generatedAt: agora, news: { USD: [0, 1, 2].map((i) => materia(i, 'dolar')), EUR: [], JPY: [], CNH: [], MERCADO: [materia(0, 'mercado')] }, stale: {}, errors: [] }
const temas = { schemaVersion: 1, generatedAt: agora, windowDays: 5, stale: false, errors: [], temas: { 'moeda-usd': { label: 'Dólar', grupo: 'moeda', items: [materia(3, 'dolar-imprensa')] } } }
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
      assert.equal(await atual.locator('.cx-form:visible').count(), 0) // no modo Resultado os campos saem
      await modos.getByRole('button', { name: 'Dados' }).click()
      await atual.locator('.cx-form').waitFor()
      assert.equal(await atual.locator('.calc-result-shell:visible').count(), 0)
      const valor = atual.locator('.cx-form input').first()
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
      // limpar tira os blocos e mantém a capa
      await p.getByRole('button', { name: 'Limpar' }).click()
      assert.equal(await p.locator('.apz-item').count(), 1)
      assert.deepEqual(errors, [])
      await ctx.close()
    }
    // a aba aparece no menu do computador
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
    const p = await ctx.newPage()
    await ctx.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()))
    await p.goto(base + '/')
    await p.locator('nav.topbar-tabs button', { hasText: 'Apresentar' }).click()
    await p.locator('.apz').waitFor()
    assert.match(await p.evaluate(() => location.hash), /^#apresentar/)
    await ctx.close()
    console.log('smoke-apresentar ok')
  } finally { await b.close() }
})().catch((e) => { console.error(e); process.exit(1) })
