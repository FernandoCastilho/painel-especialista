import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { staleReport, describeStaleItem } from '../scripts/stale-lib.mjs'
import { withOfficialLcdSnapshot, LCD_SNAPSHOT_CAPTURED_AT, LCD_SNAPSHOT_POINTS } from '../src/lcdOfficialSnapshot.js'
import { SOURCE_STATUS } from '../scripts/moedas-lib.mjs'

const NOW = Date.parse('2026-11-08T02:54:00Z')

test('LD1 congelada conserva idade, motivo e pontos, sem alegar fonte fora do ar', () => {
  const moedas = withOfficialLcdSnapshot({ series: {}, stale: {} })
  const before = structuredClone(moedas)
  const [item] = staleReport({ moedas }, NOW)
  assert.equal(item.key, 'LD1')
  assert.equal(item.collectionDisabled, true)
  assert.equal(item.reason, SOURCE_STATUS.LD1.reason)
  assert.equal(item.since, Date.parse(LCD_SNAPSHOT_CAPTURED_AT))
  assert.equal(item.hours, 60)
  assert.match(item.detail, /coleta automática LD1 pendente de revisão de segurança e termos/)
  assert.match(item.detail, /60 h sem atualizar/)
  assert.match(item.detail, /não comprova falha da fonte/)
  assert.doesNotMatch(item.detail, /fonte fora do ar/)
  assert.deepEqual(moedas, before)
  assert.deepEqual(moedas.series.LD1.points, LCD_SNAPSHOT_POINTS)
  assert.equal(SOURCE_STATUS.LD1.automaticCollectionEnabled, false)
})

test('motivo LD1 não contamina retenções das outras séries nem arquivos', () => {
  const since = NOW - 10 * 36e5
  const items = staleReport({ moedas: { stale: { C01: since, LD1: since } }, macro: { stale: { selic: since, LD1: since } } }, NOW)
  assert.equal(items.filter(i => i.collectionDisabled).length, 1)
  for (const item of items.filter(i => !i.collectionDisabled)) {
    assert.equal(item.reason, undefined)
    assert.equal(item.detail, `${item.label}: 10 h sem atualizar`)
  }
})

test('limiar e data desconhecida continuam visíveis para a coleta desativada', () => {
  assert.deepEqual(staleReport({ moedas: { stale: { LD1: NOW - 6 * 36e5 } } }, NOW), [])
  const [item] = staleReport({ moedas: { stale: { LD1: null } } }, NOW)
  assert.equal(item.hours, null)
  assert.match(item.detail, /data da coleta desconhecida/)
  assert.equal(describeStaleItem({ label: 'Série', hours: null }), 'Série: data da coleta desconhecida')
})

// Executa o script real do workflow com GitHub/FS em memória. Não envia mensagem.
async function runAlert(items) {
  const workflow = readFileSync(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const section = workflow.split('      - name: Alertar dados desatualizados')[1].split('      - name: Alertar dados incoerentes')[0]
  const script = section.split('          script: |\n')[1].split('\n').map(line => line.startsWith('            ') ? line.slice(12) : line).join('\n')
  const sent = []
  const github = { rest: { issues: {
    listForRepo: async () => ({ data: [] }),
    create: async item => sent.push(item),
  } } }
  const fakeRequire = name => {
    assert.equal(name, 'fs')
    return { existsSync: () => true, readFileSync: () => JSON.stringify({ hours: 6, items }) }
  }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  await new AsyncFunction('require', 'process', 'github', 'context', 'fetch', 'core', script)(fakeRequire, { env: { RUNNER_TEMP: '/tmp' } }, github, { repo: { owner: 'fixture', repo: 'synthetic' }, serverUrl: 'https://github.com', runId: 123 }, () => { throw new Error('rede proibida no teste') }, { warning() {} })
  return sent
}

test('workflow relata motivo real e mantém itens de falha junto com LD1', async () => {
  const moedas = withOfficialLcdSnapshot({ series: {}, stale: { C01: NOW - 12 * 36e5 } })
  const sent = await runAlert(staleReport({ moedas }, NOW))
  assert.equal(sent.length, 1)
  assert.match(sent[0].body, /coleta automática LD1 pendente de revisão de segurança e termos/)
  assert.match(sent[0].body, /TFC_60.90 \(C01\): 12 h sem atualizar/)
  assert.doesNotMatch(sent[0].body, /A fonte destes dados está fora do ar/)
})

test('workflow continua compatível com relatório anterior sem detail', async () => {
  const [sent] = await runAlert([{ label: 'CDI', hours: 9 }, { label: 'PTAX', hours: null }])
  assert.match(sent.body, /CDI: 9 h sem atualizar/)
  assert.match(sent.body, /PTAX: data da coleta desconhecida/)
  assert.deepEqual(await runAlert([]), [])
})
