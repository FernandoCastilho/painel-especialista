import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixadoAtivo, juntarPontos, pontosFixados, diaCurto } from '../src/pregaoFixado.js'
import { citaOutroNivel, noticiasPerto } from '../src/fxAgora.js'
import { SCALES, resample, scaleOptions } from '../src/resample.js'

const t = (iso) => Date.parse(iso)
const arq = {
  dia: '2026-11-27', ate: '2026-12-04', generatedAt: 1,
  series: { USD: [[t('2026-11-27T14:45:04Z'), 5.5826], [t('2026-11-27T13:00:04Z'), 5.4861], [t('2026-11-26T20:00:00Z'), 5.65], ['x', 1]] },
  noticias: { dia: '2026-11-27', itens: [] },
}

test('pregão fixado vale do dia até a data final (Brasília) e some depois', () => {
  assert.equal(fixadoAtivo(arq, t('2026-11-27T23:00:00Z')), arq)
  assert.equal(fixadoAtivo(arq, t('2026-12-05T02:59:00Z')), arq) // 04/12, 23h59 em Brasília
  assert.equal(fixadoAtivo(arq, t('2026-12-05T03:01:00Z')), null)
  assert.equal(fixadoAtivo(arq, t('2026-11-26T12:00:00Z')), null)
  assert.equal(fixadoAtivo({ ...arq, ate: 'x' }, t('2026-11-28T12:00:00Z')), null)
  assert.equal(fixadoAtivo(null), null)
})

test('amostras fixadas: só do dia pedido, válidas e em ordem', () => {
  const p = pontosFixados(arq, 'USD', '2026-11-27')
  assert.deepEqual(p.map((x) => x.bid), [5.4861, 5.5826])
  assert.deepEqual(pontosFixados(arq, 'USD', '2026-11-30'), [])
  assert.deepEqual(pontosFixados(arq, 'EUR', '2026-11-27'), [])
})

test('juntar com o ao vivo não repete horário e prefere o ao vivo', () => {
  const fix = [{ t: 1, bid: 5 }, { t: 2, bid: 6 }]
  const vivo = [{ t: 2, bid: 6.1 }, { t: 3, bid: 7 }]
  assert.deepEqual(juntarPontos(vivo, fix), [{ t: 1, bid: 5 }, { t: 2, bid: 6.1 }, { t: 3, bid: 7 }])
  assert.equal(diaCurto('2026-11-27'), '27/11')
})

test('arquivo publicado do pregão de 27/11 tem dólar, notícias e janela de 7 dias', () => {
  const pub = JSON.parse(readFileSync(new URL('../public/pregao-fixado.json', import.meta.url), 'utf8'))
  assert.equal(pub.dia, '2026-11-27'); assert.equal(pub.ate, '2026-12-04')
  assert.ok(pontosFixados(pub, 'USD', pub.dia).length > 50)
  for (const n of pub.noticias.itens) assert.match(n.link, /^https:\/\//)
})

test('notícias perto da máxima descartam conversor de moeda e cotação de outro dia', () => {
  assert.equal(citaOutroNivel('Dólar cai e fecha a R$ 5,91 após ajuste', [5.4861, 5.5826]), true)
  assert.equal(citaOutroNivel('Dólar hoje cai mais de 4% e toca R$ 5,48', [5.4861, 5.5826]), false)
  assert.equal(citaOutroNivel('Perdas de R$ 38,96 bilhões', [5.4861, 5.5826]), false)
  const m = t('2026-11-27T14:45:00Z')
  const itens = [
    { t: m - 50 * 60000, title: 'Dólar cai e fecha a R$ 5,91 após aprovação', link: 'https://a/1' },
    { t: m - 40 * 60000, title: 'Dólar hoje cai mais de 4% e toca R$ 5,48', link: 'https://a/2' },
    { t: m - 30 * 60000, title: 'Converter 1 BILL em USD', link: 'https://a/3' },
  ]
  assert.deepEqual(noticiasPerto([itens], m, { faixa: [5.4861, 5.5826] }).map((n) => n.link), ['https://a/2'])
})

test('escala de 5 minutos alinhada ao relógio no intradiário', () => {
  assert.ok(SCALES.find((s) => s.id === '5min').intradiario)
  const pts = [0, 4, 9, 11, 14].map((m) => ({ t: t('2026-11-27T13:00:00Z') + m * 60000 + 3000, bid: 5 + m / 100 }))
  assert.equal(resample(pts, '5min').length, 3)
  const cinco = Array.from({ length: 12 }, (_, i) => ({ t: t('2026-11-27T13:00:00Z') + i * 300000, bid: 5 }))
  assert.equal(scaleOptions(cinco).find((s) => s.id === '5min').enabled, true)
})

test('bolinhas do dia fixado: uma por hora, sem propaganda nem conversor', async () => {
  const { destaquesPorHora } = await import('../src/fxAgora.js')
  const h = (hm) => t(`2026-11-27T${hm}:00Z`)
  const itens = [
    { t: h('12:14'), title: 'Dólar à vista tem forte queda', link: 'https://v/1', source: 'Valor Econômico' },
    { t: h('12:22'), title: 'Dólar cai 3,85%', link: 'https://b/1', source: 'BPMoney' },
    { t: h('15:25'), title: 'Dólar em queda! Abra sua conta e ganhe cashback', link: 'https://p/1', source: 'X' },
    { t: h('19:03'), title: 'Converter 1 BILL em USD', link: 'https://c/1', source: 'Bybit' },
    { t: h('20:15'), title: 'Dólar recua para os R$ 5,5156', link: 'https://m/1', source: 'Money Times' },
  ]
  const r = destaquesPorHora(itens, h('12:00'), h('21:00'), [5.4861, 5.5826])
  assert.deepEqual(r.map((n) => n.link), ['https://v/1', 'https://m/1'])
})
