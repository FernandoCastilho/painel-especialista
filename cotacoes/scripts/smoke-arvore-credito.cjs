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
        const titulos = await folha.locator(':scope > .ac-card h4').allInnerTexts()
        assert.equal(titulos.length, 3, titulos.join(' | '))
        assert.match(titulos[0], /4131/)
        assert.match(titulos[1], /FINIMP/)
        assert.match(await page.locator('.ac-card').first().innerText(), /Lucro Presumido, o ganho no NDF é tributado/)
        assert.match(await page.locator('.ac-numeros').innerText(), /Sazonal/)
        const largura = await page.evaluate(() => document.documentElement.scrollWidth)
        assert.ok(largura <= viewport.width + 1, `rolagem lateral em ${nome}: ${largura}px`)
        await page.screenshot({ path: path.join(out, `arvore-${nome}-${tema}.png`), fullPage: true })
        await page.getByRole('button', { name: 'Visão para o cliente' }).click()
        await page.getByRole('heading', { name: 'Possibilidades de crédito' }).waitFor()
        const cliente = await page.locator('.ac-cliente').innerText()
        assert.doesNotMatch(cliente, /Outras opções|Saíram da folha|Simular na calculadora/)
        await page.screenshot({ path: path.join(out, `arvore-cliente-${nome}-${tema}.png`), fullPage: true })
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
