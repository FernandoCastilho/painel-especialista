const assert = require('node:assert/strict')
const { gzipSync } = require('node:zlib')
const { chromium } = require('playwright')

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8768'
const real = process.env.SMOKE_CVM_REAL === '1'
const cnpj = '00017024000153'
const id = 'cvm-c-' + cnpj
const nome = 'Classe Crédito Privado'
const hash = 'a'.repeat(64)
const grupo = [...cnpj].reduce((total, char) => (total * 31 + char.charCodeAt(0)) % 128, 0)
const arquivo = 'cotas-' + grupo + '-' + hash + '.json.gz'
const catalogo = 'catalogo-' + hash + '.json.gz'
const rows = [['2025-09-30', 100], ['2025-10-28', 102], ['2025-10-31', 105], ['2025-11-28', 110]]
const normalizar = str => str.replace(/\s+/g, ' ').trim()

async function fixtures(page) {
  if (real) return
  await page.route('**/dados/serie/bcdata.sgs.*/dados?**', route => route.fulfill({ json: [
    { data: '30/09/2025', valor: '1' }, { data: '28/10/2025', valor: '1.01' }, { data: '28/11/2025', valor: '1.02' },
  ] }))
  let tentativas = 0
  await page.route('**/cvm/manifest.json*', route => {
    if (tentativas++ < 2) return route.fulfill({ status: 503 })
    return route.fulfill({ json: {
      version: 1, first: rows[0][0], last: rows.at(-1)[0], files: { catalogo, [grupo]: arquivo },
    } })
  })
  await page.route('**/cvm/' + catalogo, route => route.fulfill({ body: gzipSync(JSON.stringify([
    [id, nome, cnpj],
    ['cvm-c-23731495000124', 'ITAÚ FUND OF FUNDS ORION MULT CRÉDITO PRIVADO INVESTIMENTO NO EXTERIOR FIF DA CIC RESP LIMITADA', '23731495000124'],
    ['cvm-c-10000000000100', 'Atlântico Fundo de Investimento em Cotas', '10000000000100'],
  ])) }))
  await page.route('**/cvm/' + arquivo, route => route.fulfill({ json: { [id]: rows } }))
}

async function selecionarFundo(region) {
  await region.locator('summary:visible').filter({ hasText: /^Buscar fundos na CVM$/ }).click()
  const busca = region.getByRole('searchbox', { name: 'Nome do fundo, classe ou CNPJ' })
  await busca.fill('Itaú Of Funds Orion Mult CP IE FIF DA CIC RL')
  if (!real) await region.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await region.getByRole('button', { name: /23\.731\.495\/0001-24 · Classe$/ }).waitFor()
  if (!real) {
    await busca.fill('')
    await busca.pressSequentially('Atlantico FIC')
    await region.getByRole('button', { name: /10\.000\.000\/0001-00 · Classe$/ }).waitFor()
    assert.equal(await region.getByRole('button', { name: /23\.731\.495\/0001-24 · Classe$/ }).count(), 0)
  }
  await busca.fill(real ? 'renda fixa exponencial' : 'credito privado')
  await region.getByRole('button', { name: /00\.017\.024\/0001-53 · Classe$/ }).click()
}

async function main() {
  const browser = await chromium.launch({
    channel: process.env.SMOKE_CHANNEL || 'chrome',
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
  })
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, serviceWorkers: 'block' })
      page.setDefaultTimeout(15000)
      await fixtures(page)
      await page.goto(base.replace(/\/$/, '') + '/#calculadora/investimentos?ativos=')
      const region = page.getByRole('region', { name: 'Investimentos', exact: true })
      await selecionarFundo(region)
      const ativos = region.getByRole('region', { name: 'Ativos em comparação' })
      const ficha = ativos.getByRole('region', { name: 'Ficha do fundo', exact: true })
      const umMes = ficha.getByRole('row', { name: /^1 mês/ })
      await umMes.waitFor()
      if (real) {
        await umMes.getByRole('cell', { name: /%$/ }).nth(1).waitFor()
      } else {
        await umMes.getByRole('cell', { name: '1,01%', exact: true }).waitFor()
        assert.match(normalizar(await umMes.innerText()), /28\/10\/2025 a 28\/11\/2025.*7,84%.*1,01%/)
      }
      const remover = ativos.getByRole('button', { name: /^Remover .*00\.017\.024\/0001-53 · Classe$/ })
      assert.equal(await remover.count(), 0)
      await ficha.getByRole('button', { name: 'Adicionar à comparação', exact: true }).click()
      await remover.waitFor()
      const tabela = region.getByRole('region', { name: 'Retorno e risco' })
      await tabela.getByText(/00\.017\.024\/0001-53 · Classe$/).waitFor()
      if (!real) assert.match(normalizar(await tabela.innerText()), /10,00%/)
      await region.getByRole('button', { name: 'Simular carteira', exact: true }).first().click()
      const aplicacao = region.getByRole('textbox', { name: /00\.017\.024\/0001-53 · Classe$/ })
      await aplicacao.fill('2000')
      assert.match(normalizar(await region.innerText()), /Valor inicial R\$ 2\.000,00/)
      if (!real) assert.match(normalizar(await region.innerText()), /Valor final R\$ 2\.200,00/)
      await region.getByRole('button', { name: 'CDB, fundos e ações', exact: true }).click()
      await region.getByRole('button', { name: 'Fundos', exact: true }).click()
      await region.locator('summary:visible').filter({ hasText: /^Buscar fundos na CVM$/ }).click()
      await region.getByRole('searchbox', { name: 'Nome do fundo, classe ou CNPJ' }).fill(cnpj)
      await region.getByRole('button', { name: /00\.017\.024\/0001-53 · Classe$/ }).click()
      await region.getByRole('textbox', { name: 'Valor aplicado (R$)' }).fill('1000')
      const saida = region.getByRole('region', { name: 'Variação da cota' })
      await saida.waitFor()
      if (!real) {
        await region.getByLabel('Data da cota inicial', { exact: true }).selectOption('2025-10-31')
        assert.match(normalizar(await saida.innerText()), /Valor final R\$ 1\.047,62/)
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sem rolagem lateral')
      await page.goto('about:blank')
      await page.goto(base.replace(/\/$/, '') + '/#calculadora/investimentos?ativos=' + id)
      await tabela.getByText(/00\.017\.024\/0001-53 · Classe$/).waitFor()
      await page.close()
    }
    console.log('Fundos CVM: busca por nome, ficha, cálculo, comparação, carteira e reabertura em 390 e 1280 px aprovados.')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
