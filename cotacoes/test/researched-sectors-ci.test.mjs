import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('CI executa smoke dos estudos na branch dedicada sem publicar', () => {
  const workflow = readFileSync('../.github/workflows/cotacoes-ci.yml', 'utf8')
  assert.match(workflow, /push:\s+branches: \['feat\/estudos-setoriais-completos'\]/)
  assert.match(workflow, /node scripts\/smoke-researched-sectors\.cjs/)
  assert.match(workflow, /name: estudos-setoriais-design/)
  assert.doesNotMatch(workflow, /deploy-pages|pages: write|id-token: write/)
})

test('smoke percorre dataset e cobre interações e artefatos exigidos', () => {
  const source = readFileSync('scripts/smoke-researched-sectors.cjs', 'utf8')
  for (const token of ['catalog.length, 81', 'studies.length <= 80', 'pending.entries()', 'pending-honest', '[1440, 390]', 'for (const study of studies)', 'chart.categoryLabel', 'research-bar-negative', 'playbackRate', 'preservesPitch', "reducedMotion: 'reduce'", "press('Escape')", 'page.goBack()', 'page.goForward()', 'report.json', 'interaction-failure.png']) assert.ok(source.includes(token), token)
})

test('smoke reproduz cada gravação e distingue controles de auditoria integral', () => {
  const source = readFileSync('scripts/smoke-researched-sectors.cjs', 'utf8')
  for (const token of ['verifyAudioPlayback', 'element.play()', 'element.pause()', 'audio.currentTime >= 0.08', 'const rates = [0.75, 1, 1.25, 1.5, 2]', 'element.duration - 0.25', 'audio.ended && audio.paused', 'Tempo total nesta velocidade:', 'report.audioPlayback.results.length, report.audioPlayback.expected', 'Not full-length listening', "process.env.GITHUB_ACTIONS === 'true' && process.env.SMOKE_CHANNEL === 'chrome'"]) assert.ok(source.includes(token), token)
})
