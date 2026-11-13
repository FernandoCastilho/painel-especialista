import test from 'node:test'
import assert from 'node:assert/strict'
import { MARKET_QUERIES, balance, canonicalSource, freshOnly, googleUrl } from '../scripts/news-lib.mjs'
import { fillNewsFromPrevious } from '../scripts/prev-lib.mjs'
import { topHeadlines } from '../src/snapshot.js'
import { buildFeed } from '../src/feed.js'

test('googleUrl: janela padrão de 5 dias e janela curta para o mercado de hoje', () => {
  assert.match(decodeURIComponent(googleUrl('dólar', 'pt')), /dólar when:5d/)
  assert.match(decodeURIComponent(googleUrl('Ibovespa site:valor.globo.com', 'pt', '2d')), /Ibovespa site:valor\.globo\.com when:2d/)
  assert.equal(MARKET_QUERIES.length, 3)
})

test('freshOnly: descarta matéria velha ou sem horário', () => {
  const now = Date.parse('2026-10-29T12:00:00Z')
  const items = [{ t: now - 3600e3, title: 'novo' }, { t: now - 6 * 864e5, title: 'velho' }, { t: 0, title: 'sem data' }, { t: now - 2 * 864e5, title: 'ontem+' }]
  assert.deepEqual(freshOnly(items, now).map((i) => i.title), ['novo', 'ontem+'])
})

test('Valor Econômico entra no mercado de hoje e o balanceamento o mantém junto das demais fontes', () => {
  const v = { title: 'Ibovespa cai', source: canonicalSource({ source: 'Valor Econômico', sourceUrl: 'https://valor.globo.com' }), t: 3, link: 'https://v/1' }
  const o = { title: 'Dólar fecha', source: 'InfoMoney', t: 2, link: 'https://i/1' }
  assert.equal(v.source, 'Valor Econômico')
  assert.deepEqual(balance([o, v], 2).map((i) => i.source), ['Valor Econômico', 'InfoMoney'])
})

test('mercado hoje: aparece no feed, nas manchetes de destaque e é preservado se a coleta vier vazia', () => {
  const news = { news: { USD: [{ title: 'u', link: 'l1', t: 5 }], MERCADO: [{ title: 'm1', link: 'l2', t: 9 }, { title: 'm2', link: 'l3', t: 8 }, { title: 'm3', link: 'l4', t: 7 }, { title: 'm4', link: 'l5', t: 6 }] } }
  const feed = buildFeed(news.news, 'MERCADO', 10, 10)
  assert.deepEqual(feed.map((n) => n.title), ['m1', 'm2', 'm3', 'm4'])
  assert.deepEqual(buildFeed(news.news, 'ALL', 10, 10).map((n) => n.title).slice(0, 2), ['m1', 'm2'])
  const heads = topHeadlines(news, undefined, 3, 10)
  assert.deepEqual(heads.map((h) => h.code + ':' + h.title), ['MERCADO:m1', 'MERCADO:m2', 'MERCADO:m3', 'USD:u'])
  assert.deepEqual(topHeadlines({ news: { USD: [{ title: 'u', t: 1 }] } }, undefined, 3, 10).map((h) => h.code), ['USD'])
  const fresh = { USD: [], MERCADO: [] }
  const stale = fillNewsFromPrevious(fresh, { generatedAt: 123, news: { MERCADO: [{ title: 'antigo', link: 'x', t: 1 }] }, stale: {} }, 10)
  assert.equal(fresh.MERCADO[0].title, 'antigo'); assert.equal(stale.MERCADO, 123)
})

test('etiqueta de moeda só quando a manchete fala da moeda ou de câmbio', async () => {
  const { mentionsCurrency } = await import('../scripts/news-lib.mjs')
  // casos reais que apareciam com etiqueta errada
  for (const [code, titulo] of [
    ['JPY', 'Samsung negocia compra da Modine'], ['JPY', 'Diretor da Expensify adquire ações'], ['USD', 'Braskem registra prejuízo de R$ 1,07 bilhão no 3º trimestre'],
    ['USD', 'Lucro da B3 cresce no trimestre'], ['EUR', 'Nasa anuncia mais de US$ 10 bi em contratos para base lunar'], ['JPY', 'WTI Trader Bias Not Far Off Shifting as Longs Unwind'],
    ['EUR', 'Volume diário de transações com Pix bate novo recorde'], ['JPY', 'Multicampeão do judô Teddy Riner anuncia candidatura à Presidência da França'],
  ]) assert.equal(mentionsCurrency(code, titulo), false, `${code}: ${titulo}`)
  for (const [code, titulo] of [
    ['USD', 'Dólar fecha em alta de 1,5%'], ['USD', 'Gold, EUR/USD Hit 2026 Lows as US Yields Erupt'], ['EUR', 'Euro cai face ao dólar pela terceira sessão'], ['EUR', 'BCE mantém juros'],
    ['JPY', 'O iene japonês paira perto de 160,00'], ['JPY', 'Japanese Yen hovers near 160.00'], ['JPY', 'Bank of Japan signals hike'], ['CNH', 'PBOC fixa o yuan mais forte'],
    ['EUR', 'Câmbio: moedas emergentes recuam'], ['USD', 'Dollar Retreats From 19-Month High'],
  ]) assert.equal(mentionsCurrency(code, titulo), true, `${code}: ${titulo}`)
  // basta a menção no título original ou no traduzido; código sem lista (Mercado hoje) não é filtrado
  assert.equal(mentionsCurrency('JPY', 'Mercado sobe', 'Yen rises'), true)
  assert.equal(mentionsCurrency('MERCADO', 'Lucro da Yduqs cresce 20%'), true)
})
test('a coleta por moeda aplica a regra antes de escolher as manchetes', async () => {
  const { readFile } = await import('node:fs/promises')
  const src = await readFile(new URL('../scripts/fetch-news.mjs', import.meta.url), 'utf8')
  assert.match(src, /freshOnly\(items\)\.filter\(\(it\) => mentionsCurrency\(code, it\.title\)\)/)
})
