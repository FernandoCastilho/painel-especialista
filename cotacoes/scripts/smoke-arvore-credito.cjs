// Teste de tela da Árvore de Crédito: preenche um caso fictício de máquina importada, confere a folha,
// que a consulta de CNPJ está desligada (nenhum pedido externo) e a visão para o cliente, em celular e computador.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const out = process.env.ARVORE_QA_OUTPUT || 'workspace-qa/arvore'
const escala = Number(process.env.ARVORE_QA_SCALE || 1)

// Resposta fictícia no formato documentado da BrasilAPI; nenhuma consulta real é feita.
const CNPJ_FICTICIO = { razao_social: 'EMPRESA EXEMPLO INDUSTRIA S.A.', municipio: 'SOROCABA', uf: 'SP', cnae_fiscal: 2813500, cnae_fiscal_descricao: 'Fabricação de válvulas, registros e dispositivos semelhantes', codigo_natureza_juridica: 2054, natureza_juridica: 'Sociedade Anônima Fechada', descricao_situacao_cadastral: 'ATIVA', data_inicio_atividade: '2001-03-15', opcao_pelo_simples: false, regime_tributario: [{ ano: 2025, forma_de_tributacao: 'LUCRO PRESUMIDO' }] }

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox'] })
  const erros = []
  const consultas = []
  try {
    for (const [nome, viewport] of [['celular', { width: 390, height: 900 }], ['computador', { width: 1440, height: 1000 }]]) {
      for (const tema of ['dark', 'light']) {
        const page = await browser.newPage({ viewport, deviceScaleFactor: escala, colorScheme: tema })
        page.on('pageerror', (e) => erros.push(e.message))
        await page.route('**/*', (route) => {
          const url = route.request().url()
          if (url.startsWith('https://brasilapi.com.br/api/cnpj/v1/')) { consultas.push(url); return route.fulfill({ json: CNPJ_FICTICIO }) }
          return url.startsWith(base + '/') ? route.continue() : route.abort()
        })
        await page.goto(`${base}/#calculadora/arvore-credito`)
        await page.getByRole('heading', { name: 'Árvore de Crédito' }).waitFor()
        // Consulta de CNPJ desligada: o botão não existe e os dados são preenchidos à mão.
        assert.equal(await page.getByRole('button', { name: 'Consultar dados públicos' }).count(), 0)
        const receita = page.getByRole('link', { name: /Consultar CNPJ no site da Receita Federal/ })
        assert.equal(await receita.getAttribute('target'), '_blank')
        const recuo = await receita.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft))
        assert.ok(recuo >= 8, `botão da Receita sem recuo lateral em ${nome}: ${recuo}px`)
        await page.fill('#ac-nome', CNPJ_FICTICIO.razao_social)
        await page.fill('#ac-uf', 'SP')
        await page.fill('#ac-cnae', '2813500')
        await page.selectOption('#ac-tipo', 'sa')
        await page.selectOption('#ac-regime', 'presumido')
        await page.selectOption('#ac-nec', 'maquina-importada')
        await page.fill('#ac-valor', '5.000.000,00')
        await page.fill('#ac-prazo', '36')
        await page.getByRole('button', { name: 'Usar exemplo fictício' }).click()
        const folha = page.locator('.ac-cards').first()
        await folha.waitFor()
        // Triagem da 4131 em todas as necessidades (21/11/2026): sem os três pontos, a 4131 não aparece.
        assert.doesNotMatch((await folha.locator(':scope > .ac-card h4').allInnerTexts()).join(' '), /4131/)
        for (const criterio of ['caixa', 'alavancagem', 'repagamento']) await page.locator(`#ac-alongar-${criterio}`).selectOption('sim')
        // Ciclo de caixa opcional: com prazos, custo e compras, aparece a necessidade permanente estimada.
        await page.fill('#ac-pmr', '60'); await page.fill('#ac-pme', '45'); await page.fill('#ac-pmp', '30')
        await page.fill('#ac-custo', '1.800.000,00'); await page.fill('#ac-compras', '1.500.000,00')
        assert.match(await page.locator('.calc-result-shell', { hasText: 'Ciclo de caixa' }).innerText(), /75 dias[\s\S]*Necessidade permanente/)
        const titulos = await folha.locator(':scope > .ac-card h4').allInnerTexts()
        assert.equal(titulos.length, 3, titulos.join(' | '))
        assert.match(titulos[0], /4131/)
        assert.match(titulos[1], /FINIMP/)
        assert.match(await page.locator('.ac-card').first().innerText(), /Lucro Presumido, o ganho no NDF é tributado/)
        assert.equal(await page.locator('.ac-numeros', { hasText: 'Sazonal' }).count(), 1)
        const largura = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.ok(largura <= viewport.width + 1, `rolagem lateral em ${nome}: ${largura}px`)
        await page.screenshot({ path: path.join(out, `arvore-${nome}-${tema}.png`), fullPage: true })
        await page.getByRole('button', { name: 'Visão para o cliente' }).click()
        await page.getByRole('heading', { name: 'Possibilidades de crédito' }).waitFor()
        const cliente = await page.locator('.ac-cliente').innerText()
        assert.doesNotMatch(cliente, /Outras opções|Saíram da folha|Simular na calculadora/)
        await page.screenshot({ path: path.join(out, `arvore-cliente-${nome}-${tema}.png`), fullPage: true })
        await page.getByRole('button', { name: 'Voltar à preparação' }).click()
        await page.selectOption('#ac-nec', 'alongar-divida')
        const triagem = page.getByRole('group', { name: 'Triagem da 4131' })
        await triagem.waitFor()
        const direta = page.locator('.ac-cards .ac-card h4')
        const indireta = page.getByRole('region', { name: 'Alívio indireto de caixa' })
        const tem4131 = async () => (await direta.allInnerTexts()).some((titulo) => titulo.includes('4131'))
        assert.equal(await tem4131(), false, 'sem confirmação não há 4131')
        assert.equal(await indireta.count(), 0, 'sem confirmação não há Finame')
        const giroBndes = page.locator('.ac-card').filter({ has: page.getByRole('heading', { name: /Giro BNDES/ }) })
        const atalho = /Simular na calculadora/
        await giroBndes.waitFor()
        assert.equal(await giroBndes.getByRole('button', { name: atalho }).count(), 0, 'Giro BNDES não oferece atalho ao Finame sem notas elegíveis')
        for (const criterio of ['caixa', 'alavancagem', 'repagamento']) await triagem.locator(`#ac-alongar-${criterio}`).selectOption('nao')
        assert.equal(await tem4131(), false, 'caixa pressionado, alavancagem excessiva e sem repagamento excluem 4131')
        for (const criterio of ['caixa', 'alavancagem', 'repagamento']) await triagem.locator(`#ac-alongar-${criterio}`).selectOption('sim')
        assert.equal(await tem4131(), true, 'três confirmações liberam a comparação')
        const capacidade = triagem.locator('#ac-alongar-repagamento')
        for (const [campo, novo] of [['#ac-prazo', '48'], ['#ac-valor', '4.000.000,00']]) {
          await page.fill(campo, novo)
          assert.equal(await capacidade.inputValue(), '', `${campo} exige confirmar novamente a capacidade de pagamento`)
          assert.equal(await triagem.locator('#ac-alongar-caixa').inputValue(), 'sim')
          assert.equal(await triagem.locator('#ac-alongar-alavancagem').inputValue(), 'sim')
          assert.equal(await tem4131(), false, 'a 4131 sai se a proposta mudar')
          await capacidade.selectOption('sim')
          assert.equal(await tem4131(), true, 'a 4131 volta após confirmar o repagamento na nova proposta')
        }
        await triagem.locator('#ac-alongar-repagamento').selectOption('')
        assert.equal(await tem4131(), false, 'limpar uma confirmação exclui 4131 de novo')
        await triagem.getByRole('checkbox', { name: /Há despesa elegível separada/ }).check()
        await indireta.waitFor()
        assert.match(await indireta.innerText(), /BNDES Finame Materiais[\s\S]*não quita diretamente a dívida/)
        assert.match((await direta.allInnerTexts())[0], /Capital de giro/)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= viewport.width + 1)
        await page.screenshot({ path: path.join(out, `arvore-alongamento-${nome}-${tema}.png`), fullPage: true })
        await page.getByRole('button', { name: 'Visão para o cliente' }).click()
        await page.getByRole('heading', { name: 'Possibilidades de crédito' }).waitFor()
        assert.equal(await tem4131(), false)
        assert.match(await indireta.innerText(), /não quita diretamente a dívida/)
        await page.getByRole('button', { name: 'Voltar à preparação' }).click()
        await page.selectOption('#ac-nec', 'gap-caixa')
        // Desde 21/11/2026 a triagem da 4131 vale também no gap de caixa, sem herdar respostas da necessidade anterior.
        assert.equal(await triagem.count(), 1)
        assert.equal(await triagem.locator('#ac-alongar-caixa').inputValue(), '')
        assert.equal(await triagem.getByRole('checkbox', { name: /Há despesa elegível separada/ }).count(), 0)
        await page.selectOption('#ac-nec', 'alongar-divida')
        assert.equal(await tem4131(), false, 'não herda respostas ao trocar de necessidade')
        assert.equal(await indireta.count(), 0, 'não herda notas de outro cenário')
        await triagem.getByRole('checkbox', { name: /Há despesa elegível separada/ }).check()
        await indireta.waitFor()
        assert.equal(await giroBndes.getByRole('button', { name: atalho }).count(), 0, 'Giro BNDES continua sem atalho mesmo com despesa separada')
        await indireta.getByRole('button', { name: atalho }).click()
        await page.waitForURL(/#calculadora\/finame-materiais$/)
        await page.close()
      }
    }
    assert.deepEqual(consultas, [], 'nenhum CNPJ pode sair da tela com a consulta desligada')
    assert.deepEqual(erros, [])
    console.log(`ok: nenhuma consulta externa, capturas em ${out}`)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
