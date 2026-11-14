import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

// Marca visível nas telas: PME (Painel Especializado no Mercado), desde 12/11/2026. PEME fica só na identidade interna
// (aplicativo instalado, assunto do e-mail de sugestões e alertas do Teams), para não quebrar instalação e filtros já feitos.
test('nome do painel: nenhuma tela usa o nome antigo e a marca do topo é PME', async () => {
  const src = new URL('../src/', import.meta.url)
  const arquivos = (await readdir(src, { recursive: true })).filter(nome => /\.(jsx?|css)$/.test(nome)).map(nome => new URL(nome, src))
  arquivos.push(new URL('../index.html', import.meta.url), new URL('../public/manifest.webmanifest', import.meta.url))
  const comNomeAntigo = []
  for (const arquivo of arquivos) if (/Painel (do )?Especialista/i.test(await readFile(arquivo, 'utf8'))) comNomeAntigo.push(arquivo.pathname.split('/cotacoes/')[1])
  assert.deepEqual(comNomeAntigo, [])
  const topo = await readFile(new URL('TopBar.jsx', src), 'utf8')
  assert.match(topo, /className="topbar-brand" title="Painel Especializado no Mercado"/)
  assert.match(topo, />PME<\/abbr>/)
  assert.match(await readFile(new URL('../index.html', import.meta.url), 'utf8'), /<title>PME · Painel Especializado no Mercado<\/title>/)
  assert.equal(JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')).short_name, 'PEME')
})

test('entrada exibe PME sem alterar a identidade interna do aplicativo', async () => {
  const entrada = await readFile(new URL('../src/AcessoPorEmail.jsx', import.meta.url), 'utf8')
  assert.match(entrada, />PME · Painel Especializado no Mercado<\/h1>/)
})

test('telas mostram a mesma marca PME (13/11/2026: Panorama, sugestões, alerta de preço e Base de dados)', async () => {
  for (const nome of ['MarketPopup.jsx', 'FeedbackMascot.jsx', 'alertaNotificacao.js', 'baseDados.js', 'CreditComparison.jsx']) {
    const texto = await readFile(new URL(`../src/${nome}`, import.meta.url), 'utf8')
    assert.doesNotMatch(texto, />PEME<|PEME ·|'PEME'|<strong>PEME<\/strong>/, nome)
  }
})
