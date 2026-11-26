import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as formato from '../src/fichaFundo.js'

const require = createRequire(import.meta.url)
const CNPJ = '44315864000178'
const ID = 'cvm-c-' + CNPJ

test('a lâmina formata valores, prazos e datas no padrão brasileiro', () => {
  assert.equal(formato.pct(8.389), '8,39%')
  assert.equal(formato.pct(undefined), '—')
  assert.equal(formato.reais(1690000000), 'R$ 1,69 bi')
  assert.equal(formato.reais(2500000), 'R$ 2,50 mi')
  assert.equal(formato.reais(0, { minimo: true }), 'Sem mínimo')
  assert.equal(formato.reais(1), 'R$ 1,00')
  assert.equal(formato.prazo(21, 'Dias Corridos'), 'D+21 dias corridos')
  assert.equal(formato.simNao(false), 'Não')
  assert.equal(formato.dataBr('2024-03-27'), '27/03/2024')
  assert.equal(formato.competencia('2026-10-31'), 'out/2026')
  assert.deepEqual(formato.alturas([3.8, -0.2, 0, 1.9]), [100, 5, 2, 50])
})

test('a ficha baixa só o arquivo do fundo e aceita a cópia em JSON comum', async t => {
  const bucket = [...CNPJ].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 128, 0)
  const arquivo = 'fichas-' + bucket + '-' + 'e'.repeat(64) + '.json.gz'
  const pedidos = []
  globalThis.document = { baseURI: 'https://painel.example/cotacoes/' }
  t.after(() => { delete globalThis.document })
  t.mock.method(globalThis, 'fetch', async url => {
    const nome = url.pathname.split('/').at(-1)
    pedidos.push(url.pathname.split('/cvm/')[1])
    if (nome === 'manifest.json') {
      const files = Object.fromEntries(Array.from({ length: 128 }, (_, i) => [i, 'fichas-' + i + '-' + 'f'.repeat(64) + '.json.gz']))
      return Response.json({ version: 1, collected: '2026-11-26', files: { ...files, [bucket]: arquivo } })
    }
    if (nome === arquivo.replace(/\.gz$/, '')) return Response.json({ [CNPJ]: { cadastro: { codigo: '28258' } } })
    if (nome.startsWith('fichas-') && nome.endsWith('.json')) return Response.json({})
    return new Response(null, { status: 404 })
  })
  const cvm = await import('../src/fundosCvm.js?ficha')
  assert.equal(cvm.cnpjDoId(ID + '-A1'), CNPJ)
  assert.deepEqual(await cvm.carregarFichaCvm(CNPJ), { ficha: { cadastro: { codigo: '28258' } }, coletado: '2026-11-26' })
  assert.deepEqual(await cvm.carregarFichaCvm('00000000000000'), { ficha: null, coletado: '2026-11-26' })
  assert.deepEqual(pedidos.slice(0, 2), ['fichas/manifest.json', 'fichas/' + arquivo.replace(/\.gz$/, '')])
  assert.equal(pedidos.length, 3, 'o manifesto não baixa de novo')
})

async function montar(t, resposta) {
  const source = await readFile(new URL('../src/LaminaFundoCvm.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  const fundos = { cnpjDoId: id => id.slice(6, 20), carregarFichaCvm: async () => resposta() }
  runInNewContext(code, { module, exports: module.exports, require: nome =>
    nome === 'react' ? React : nome === './fundosCvm.js' ? fundos : nome === './fichaFundo.js' ? formato : require(nome) })
  let fechado = false
  const render = hookRenderer(() => module.exports.default({ id: ID, nome: 'Alfa RF GARB · 44.315.864/0001-78', fechar: () => { fechado = true } }))
  t.after(() => render.close())
  await render.settle()
  return { html: () => renderToStaticMarkup(render.value), render, fechado: () => fechado }
}

test('a lâmina mostra o nome do fundo no cabeçalho, condições, anos, meses e carteira', async t => {
  const lamina = {
    data: '2026-10-31', pl: 1690000000, risco: 3, taxaAdm: 0, despesas: 0.04, cotaResgate: 0, pagamento: 0,
    objetivo: 'Buscar retorno.', publico: 'Investidores em geral.', exterior: 0, credito: 100, perdaAlemDoAplicado: false,
    aplicInicial: 0, horario: '16:00', carencia: 0, tipoPagamento: 'Dias Úteis', indice: 'CDI',
    anos: [[2025, 14.95, 14.31, 104.4], [2026, 8.39, 11.7, 71.8]], rentab5: 73.64, indice5: 79.84, anosPerda: 0,
    meses: [['2025-11', 0.7, 1], ['2026-03', -0.2, 1]], carteira: [['Títulos de crédito privado', 86.31], ['Derivativos', -3.78]],
  }
  const { html, render, fechado } = await montar(t, () => ({ ficha: { cadastro: { codigo: '1' }, lamina }, coletado: '2026-11-26' }))
  const texto = html()
  assert.match(texto, /Lâmina do fundo/)
  assert.match(texto, /<h3[^>]*>Alfa RF GARB<\/h3>/)
  assert.match(texto, /CVM · lâmina de out\/2026 · CNPJ 44\.315\.864\/0001-78/)
  assert.match(texto, /R\$ 1,69 bi/)
  assert.match(texto, /aria-label="Risco 3 de 5"/)
  assert.match(texto, /Sem mínimo/)
  assert.match(texto, /D\+0 dias úteis/)
  assert.match(texto, /<th scope="col">% do CDI<\/th>/)
  assert.ok(texto.indexOf('2026') < texto.indexOf('2025'), 'o ano mais recente vem primeiro')
  assert.match(texto, /Em 5 anos: fundo 73,64% · CDI 79,84%\. Anos com perda: 0\./)
  assert.match(texto, /class="neg"/)
  assert.match(texto, /-3,78%/)
  const botao = (function procurar(no) {
    if (!no || typeof no !== 'object') return null
    if (Array.isArray(no)) return no.map(procurar).find(Boolean)
    if (no.props?.['aria-label'] === 'Fechar lâmina') return no
    return procurar(no.props?.children)
  })(render.value)
  botao.props.onClick()
  assert.ok(fechado())
})

test('sem lâmina na CVM, a ficha avisa e mostra cadastro, extrato e código CVM', async t => {
  const ficha = {
    cadastro: { codigo: '28258', tipo: 'Renda Fixa', anbima: 'Renda Fixa Duração Livre Crédito Livre', publico: 'Público Geral',
      indicador: 'DI de um dia', pl: 6490000000, inicio: '2024-03-27', exclusivo: false, condominio: 'Aberto' },
    extrato: { data: '2026-03-31', aplicMin: 1, conversao: 21, pagamento: 21, tipoPagamento: 'Dias Corridos', taxaAdm: 0.06,
      performance: false, politica: 'ATIVA E NÃO-REFERENCIADA', credito: true },
  }
  const { html } = await montar(t, () => ({ ficha, coletado: '2026-11-26' }))
  const texto = html()
  assert.match(texto, /Ficha do fundo/)
  assert.match(texto, /CVM · cadastro e extrato de mar\/2026 · Código CVM 28258/)
  assert.match(texto, /A CVM não traz a lâmina deste fundo em dados abertos/)
  assert.match(texto, /0,06% a\.a\./)
  assert.match(texto, /D\+21 dias corridos/)
  assert.match(texto, /27\/03\/2024/)
  assert.doesNotMatch(texto, /Tributação de longo prazo/, 'linha sem dado não aparece')
})

test('falha no download oferece nova tentativa; fundo fora da base avisa', async t => {
  let falhar = true
  const { html, render } = await montar(t, () => { if (falhar) throw new Error('rede'); return { ficha: null } })
  assert.match(html(), /Lâmina indisponível agora/)
  falhar = false
  const procurar = no => !no || typeof no !== 'object' ? null : Array.isArray(no) ? no.map(procurar).find(Boolean)
    : no.type === 'button' && no.props.children === 'Tentar novamente' ? no : procurar(no.props?.children)
  procurar(render.value).props.onClick()
  await render.settle()
  assert.match(html(), /A CVM não traz lâmina nem cadastro deste fundo/)
})
