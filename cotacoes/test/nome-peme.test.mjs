import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

// O painel se chama PEME (Painel Especializado no Mercado). Telas novas não podem trazer o nome antigo de volta.
test('nome do painel: nenhuma tela usa o nome antigo e a marca do topo é PEME', async () => {
  const src = new URL('../src/', import.meta.url)
  const arquivos = (await readdir(src, { recursive: true })).filter(nome => /\.(jsx?|css)$/.test(nome)).map(nome => new URL(nome, src))
  arquivos.push(new URL('../index.html', import.meta.url), new URL('../public/manifest.webmanifest', import.meta.url))
  const comNomeAntigo = []
  for (const arquivo of arquivos) if (/Painel (do )?Especialista/i.test(await readFile(arquivo, 'utf8'))) comNomeAntigo.push(arquivo.pathname.split('/cotacoes/')[1])
  assert.deepEqual(comNomeAntigo, [])
  const topo = await readFile(new URL('TopBar.jsx', src), 'utf8')
  assert.match(topo, /className="topbar-brand" title="Painel Especializado no Mercado"/)
  assert.match(topo, />PEME<\/abbr>/)
  assert.match(await readFile(new URL('../index.html', import.meta.url), 'utf8'), /<title>PEME · Painel Especializado no Mercado<\/title>/)
  assert.equal(JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8')).short_name, 'PEME')
})
