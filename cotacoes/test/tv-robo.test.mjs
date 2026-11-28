import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { conferirLiberacao, interpretarPaginaAoVivo, juntar, lerRespostaDoPlayer } from '../scripts/fetch-tv.mjs'
import { TV_CANAIS, TV_VALIDADE_MS, tvDadosUrl, tvFonte } from '../src/tvCanais.js'

const pagina = (canonica, player) => `<html><head><link rel="canonical" href="${canonica}"></head><body>
<script>var ytInitialPlayerResponse = ${JSON.stringify(player)};var meta = {"x":"}"};</script></body></html>`
const player = (extra = {}) => ({
  playabilityStatus: { status: 'OK', playableInEmbed: true, ...extra.status },
  videoDetails: { videoId: 'abcDEF12345', title: 'CNN Brasil ao vivo: "Agora" {especial}', isLive: true, ...extra.video },
})
const cnn = TV_CANAIS[0]

test('robô: lê o objeto do player mesmo com chaves e aspas dentro dos textos', () => {
  const r = lerRespostaDoPlayer(pagina('https://www.youtube.com/watch?v=abcDEF12345', player()))
  assert.equal(r.videoDetails.title, 'CNN Brasil ao vivo: "Agora" {especial}')
  assert.equal(lerRespostaDoPlayer('<html>sem player</html>'), null)
})

test('robô: classifica a página do canal ao vivo', () => {
  const watch = 'https://www.youtube.com/watch?v=abcDEF12345'
  assert.deepEqual(interpretarPaginaAoVivo(pagina(watch, player())), { estado: 'ao-vivo', videoId: 'abcDEF12345', titulo: 'CNN Brasil ao vivo: "Agora" {especial}' })
  assert.equal(interpretarPaginaAoVivo(pagina(watch, player({ status: { playableInEmbed: false } }))).estado, 'nao-libera')
  // Transmissão marcada para mais tarde ou já encerrada: não é ao vivo.
  assert.equal(interpretarPaginaAoVivo(pagina(watch, player({ video: { isLive: false } }))).estado, 'sem-live')
  // Sem live, o YouTube mostra a página do canal.
  assert.equal(interpretarPaginaAoVivo(pagina('https://www.youtube.com/channel/UCvdwhh_fDyWccR42-rReZLw', {})).estado, 'sem-live')
  // Bloqueio de robô ou página estranha: não dá para saber, nunca vira "sem live".
  assert.equal(interpretarPaginaAoVivo(pagina('undefined', { playabilityStatus: { status: 'LOGIN_REQUIRED' } })).estado, 'falhou')
  assert.equal(interpretarPaginaAoVivo('<html><link rel="canonical" href="https://consent.youtube.com/"></html>').estado, 'falhou')
  assert.equal(interpretarPaginaAoVivo('').estado, 'falhou')
})

test('robô: canal que falhou mantém o último dado bom, com a data dele', () => {
  const anterior = { canais: { 'cnn-brasil': { estado: 'ao-vivo', videoId: 'velho123456', conferido: '2026-11-28T09:00:00.000Z' } } }
  const r = juntar(anterior, { 'cnn-brasil': { estado: 'falhou' }, bloomberg: { estado: 'ao-vivo', videoId: 'novo1234567' } }, '2026-11-28T10:00:00.000Z')
  assert.deepEqual(r.canais['cnn-brasil'], anterior.canais['cnn-brasil'])
  assert.deepEqual(r.canais.bloomberg, { estado: 'ao-vivo', videoId: 'novo1234567', conferido: '2026-11-28T10:00:00.000Z' })
})

test('Painel: toca o vídeo do robô enquanto o dado é recente; sem dado, usa o endereço do canal', () => {
  const agora = Date.parse('2026-11-28T10:00:00Z')
  const dados = estado => ({ canais: { 'cnn-brasil': { estado, videoId: 'abcDEF12345', conferido: '2026-11-28T09:30:00Z' } } })
  const video = tvFonte(cnn, dados('ao-vivo'), agora)
  assert.equal(video.tipo, 'video')
  assert.match(video.url, /^https:\/\/www\.youtube\.com\/embed\/abcDEF12345\?.*mute=1/)
  assert.deepEqual(tvFonte(cnn, dados('sem-live'), agora), { tipo: 'sem-live' })
  assert.deepEqual(tvFonte(cnn, dados('nao-libera'), agora), { tipo: 'nao-libera' })
  assert.equal(tvFonte(cnn, null, agora).tipo, 'canal')
  assert.match(tvFonte(cnn, null, agora).url, /live_stream\?channel=UCvdwhh_fDyWccR42-rReZLw/)
  // Velho demais: volta ao endereço do canal.
  assert.equal(tvFonte(cnn, dados('ao-vivo'), Date.parse('2026-11-28T09:30:00Z') + TV_VALIDADE_MS + 1).tipo, 'canal')
  // Identificação estranha nunca entra no endereço.
  assert.equal(tvFonte(cnn, { canais: { 'cnn-brasil': { estado: 'ao-vivo', videoId: 'x"/><script', conferido: '2026-11-28T09:30:00Z' } } }, agora).tipo, 'canal')
})

test('Painel: o arquivo do robô fica na branch tv, ao lado da data', () => {
  assert.equal(tvDadosUrl('https://raw.githubusercontent.com/dono/repo/data'), 'https://raw.githubusercontent.com/dono/repo/tv/tv.json')
  assert.equal(tvDadosUrl('http://127.0.0.1:8768/'), 'http://127.0.0.1:8768/tv.json')
  assert.equal(tvDadosUrl(undefined), null)
})

test('robô agendado publica só fora de pull request e só a branch tv', () => {
  const y = readFileSync(new URL('../../.github/workflows/tv-ao-vivo.yml', import.meta.url), 'utf8')
  assert.match(y, /- cron: '/)
  assert.match(y, /if: github\.event_name != 'pull_request'/)
  assert.match(y, /git push -q -f "\$PUSH_URL" tv\b/)
  assert.doesNotMatch(y, /HEAD:data|\s data\s*$/m)
})

test('robô: com o player recusado (pedido de login), usa a marcação da transmissão e confere a liberação à parte', async () => {
  const agora = Date.parse('2026-11-28T10:00:00Z')
  const marc = (inicio, fim = '') => `<span itemprop="publication" itemscope itemtype="http://schema.org/BroadcastEvent"><meta itemprop="isLiveBroadcast" content="True"><meta itemprop="startDate" content="${inicio}">${fim ? `<meta itemprop="endDate" content="${fim}">` : ''}</span>`
  const bloqueada = extra => `<link rel="canonical" href="https://www.youtube.com/watch?v=abcDEF12345"><meta name="title" content="Bloomberg Business News Live">${extra}
<script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in"}};</script>`
  assert.deepEqual(interpretarPaginaAoVivo(bloqueada(marc('2026-11-28T08:00:00+00:00')), agora), { estado: 'ao-vivo', videoId: 'abcDEF12345', titulo: 'Bloomberg Business News Live', liberacao: 'conferir' })
  assert.equal(interpretarPaginaAoVivo(bloqueada(marc('2026-11-28T12:00:00+00:00')), agora).estado, 'sem-live', 'marcada para mais tarde')
  assert.equal(interpretarPaginaAoVivo(bloqueada(marc('2026-11-28T07:00:00+00:00', '2026-11-28T08:00:00+00:00')), agora).estado, 'sem-live', 'já acabou')
  assert.equal(interpretarPaginaAoVivo(bloqueada(''), agora).estado, 'falhou', 'sem marcação não dá para saber')
  const resposta = status => async () => ({ status, ok: status >= 200 && status < 300 })
  assert.equal(await conferirLiberacao('abcDEF12345', resposta(200)), true)
  assert.equal(await conferirLiberacao('abcDEF12345', resposta(401)), false)
  await assert.rejects(conferirLiberacao('abcDEF12345', resposta(500)))
})
