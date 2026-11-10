import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { refreshScenarios } from '../scripts/refresh-scenarios.mjs'
import { RETAIN_FILES, RETAIN_JSON_FILES, loadPublishedFile, createWeeklySnapshot, verifyWeeklyData, acceptRefreshedFile } from '../scripts/weekly-data.mjs'
import { weeklyFixture, previousMacro, nextFocus } from './helpers/weekly-package.mjs'

const refresh = options => refreshScenarios({ load: async file => weeklyFixture()[file], collect: async () => nextFocus, now: 20, ...options })
async function packageDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'painel-weekly-test-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return directory
}
const diskSave = directory => async (file, text) => {
  await mkdir(dirname(join(directory, file)), { recursive: true })
  await writeFile(join(directory, file), text, 'utf8')
}

test('weekly package preserves every JSON and CSV byte, changing only the Focus fields', async t => {
  const directory = await packageDirectory(t), input = weeklyFixture()
  const retained = await refresh({ load: async file => input[file], save: diskSave(directory) })
  const macro = JSON.parse(retained['macro.json'])
  assert.deepEqual(macro.focus, nextFocus)
  assert.equal(macro.focusCheckedAt, 20)
  assert.deepEqual(macro.focusSchedule, { cadence: 'segunda 08:30 America/Sao_Paulo (repete terça 08:30)', skipped: false, error: null })
  assert.equal(macro.stale.focus, undefined)
  const withoutFocus = value => {
    const copy = structuredClone(value)
    for (const key of ['focus', 'focusCheckedAt', 'focusSchedule']) delete copy[key]
    delete copy.stale.focus
    return copy
  }
  assert.deepEqual(withoutFocus(macro), withoutFocus(previousMacro))
  assert.equal(previousMacro.stale.focus, 9, 'não modifica a origem')
  for (const file of RETAIN_FILES.filter(file => file !== 'macro.json')) {
    assert.equal(await readFile(join(directory, file), 'utf8'), input[file], file)
  }
  await verifyWeeklyData(directory, createWeeklySnapshot(retained))
})

test('weekly missing prerequisite aborts before any write or Focus collection, for every base', async () => {
  for (const missing of RETAIN_FILES) {
    let writes = 0, collections = 0
    await assert.rejects(refresh({
      load: async file => file === missing ? null : weeklyFixture()[file],
      collect: async () => { collections++; return nextFocus },
      save: async () => { writes++ },
    }), error => error.message.includes('preservar ' + missing))
    assert.equal(writes, 0, missing)
    assert.equal(collections, 0, missing)
  }
})

test('weekly rejects broken JSON, error payloads, unexpected roots and invalid CSV before writing', async () => {
  for (const [file, body] of [
    ['bndes.json', '<html>erro</html>'], ['calendar.json', '{'],
    ['indexadores.json', 'null'], ['estr.json', '[]'],
    ['euro-curve.json', '{}'], ['macro.json', '{"error":"offline"}'],
    ['csv/tfb.csv', '<html>erro</html>'], ['csv/tlp.csv', ''],
    ['csv/tfc.csv', 'serie,nome,data,valor,unidade\r\n'],
  ]) {
    let writes = 0
    await assert.rejects(refresh({ load: async name => name === file ? body : weeklyFixture()[name], save: async () => { writes++ } }),
      error => error.message.includes('preservar ' + file))
    assert.equal(writes, 0, file)
  }
})

test('weekly Focus failure retains its last values and date, along with other alerts and timestamps', async () => {
  const written = {}
  const retained = await refresh({ collect: async () => { throw new Error('HTTP 503') }, save: async (file, text) => { written[file] = text } })
  const macro = JSON.parse(retained['macro.json'])
  assert.deepEqual(macro.focus, previousMacro.focus)
  assert.equal(macro.generatedAt, previousMacro.generatedAt)
  assert.deepEqual(macro.stale, previousMacro.stale)
  assert.equal(macro.focusCheckedAt, 20)
  assert.equal(macro.focusSchedule.error, 'HTTP 503')
  assert.deepEqual(written, retained)
  for (const file of RETAIN_FILES.filter(file => file !== 'macro.json')) assert.equal(retained[file], weeklyFixture()[file])
})

test('weekly loader reports HTTP and network failure instead of falling back to old checkout files', async () => {
  for (const status of [404, 503]) {
    await assert.rejects(loadPublishedFile('bndes.json', { repo: 'Owner/Repo', fetchImpl: async () => ({ ok: false, status }) }), new RegExp('bndes.json.*HTTP ' + status))
  }
  await assert.rejects(loadPublishedFile('calendar.json', { repo: 'Owner/Repo', fetchImpl: async () => { throw new Error('timeout') } }), /calendar.json.*timeout/)
  await assert.rejects(loadPublishedFile('macro.json', { repo: '' }), /repositório não configurado/)
})

test('weekly loader retains CSV BOM, Unicode and CRLF exactly', async () => {
  const body = weeklyFixture()['csv/moedas.csv']
  const text = await loadPublishedFile('csv/moedas.csv', { repo: 'Owner/Repo', fetchImpl: async (url, options) => {
    assert.equal(url.origin, 'https://owner.github.io')
    assert.equal(url.pathname, '/Repo/csv/moedas.csv')
    assert.ok(url.searchParams.has('weekly'))
    assert.ok(options.signal)
    return new Response(Buffer.from(body, 'utf8'))
  } })
  assert.equal(text, body)
  assert.equal(text.charCodeAt(0), 0xFEFF)
})

test('weekly final guard blocks missing or modified files and incomplete snapshots', async t => {
  const directory = await packageDirectory(t)
  const retained = await refresh({ save: diskSave(directory) })
  const snapshot = createWeeklySnapshot(retained)
  await assert.rejects(verifyWeeklyData(directory, {}), /inventário.*incompleto/)
  await assert.rejects(verifyWeeklyData(directory, { ...snapshot, 'bndes.json': 'bad' }), /inventário.*incompleto/)
  for (const file of ['bndes.json', 'indexadores.json', 'estr.json', 'calendar.json', 'csv/moedas.csv']) {
    await writeFile(join(directory, file), retained[file] + ' ')
    await assert.rejects(verifyWeeklyData(directory, snapshot), error => error.message.includes(file) && error.message.includes('alterado'))
    await writeFile(join(directory, file), retained[file], 'utf8')
  }
  await rm(join(directory, 'bndes.json'))
  await assert.rejects(verifyWeeklyData(directory, snapshot), /bndes.json.*ausente/)
})

test('weekly inventory covers all collector outputs skipped by the special Pages schedule', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const collectors = [...workflow.matchAll(/run: node scripts\/((?:fetch-[\w-]+|sector-news-live)\.mjs)/g)].map(match => match[1])
  assert.ok(collectors.includes('sector-news-live.mjs'), 'o consumidor institucional integra o inventário real')
  assert.match(workflow, /run: node scripts\/sector-news-live\.mjs --snapshot/)
  const outputs = new Set()
  for (const collector of collectors) {
    const source = await readFile(new URL('../scripts/' + collector, import.meta.url), 'utf8')
    for (const match of source.matchAll(/\.\.\/public\/([\w-]+\.json)/g)) outputs.add(match[1])
  }
  assert.deepEqual([...outputs].sort(), [...RETAIN_JSON_FILES].sort())
  assert.equal(RETAIN_FILES.length, new Set(RETAIN_FILES).size)
  assert.ok(RETAIN_JSON_FILES.includes('sector-news.json'), 'a atualização semanal de Focus preserva a cobertura setorial')
  for (const name of ['tfb', 'tlp', 'tfc', 'moedas']) assert.ok(RETAIN_FILES.includes('csv/' + name + '.csv'))
})

test('weekly guard is blocking and checks the final package after the build and before Pages upload', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  assert.match(workflow, /refresh-scenarios\.mjs "\$RUNNER_TEMP\/weekly-data-snapshot\.json"/)
  const start = workflow.indexOf('      - name: Conferir todas as bases preservadas no pacote semanal')
  const upload = workflow.indexOf('      - uses: actions/upload-pages-artifact')
  assert.ok(start > workflow.indexOf('      - name: Build'))
  assert.ok(start < upload)
  const guard = workflow.slice(start, upload)
  assert.match(guard, /if: github.event.schedule == '30 11 \* \* 1,2'/)
  assert.match(guard, /weekly-data\.mjs dist "\$RUNNER_TEMP\/weekly-data-snapshot\.json"/)
  assert.doesNotMatch(guard, /continue-on-error/)
})

test('weekly Focus history refreshed after the inventory passes the final check; any other changed base still aborts', async t => {
  const directory = await packageDirectory(t)
  const retained = await refresh({ save: diskSave(directory) })
  const snapshot = createWeeklySnapshot(retained)
  const renovado = JSON.stringify({ ...JSON.parse(retained['focus-history.json']), generatedAt: '2026-11-10T11:30:00.000Z', series: { Selic: { 2027: [{ d: '2026-11-06', v: 12 }] } } })
  await writeFile(join(directory, 'focus-history.json'), renovado, 'utf8')
  await assert.rejects(verifyWeeklyData(directory, snapshot), /preservar focus-history\.json \(conteúdo alterado no pacote final\)/)
  await verifyWeeklyData(directory, acceptRefreshedFile(snapshot, 'focus-history.json', renovado))
  assert.throws(() => acceptRefreshedFile(snapshot, 'curves.json', retained['curves.json']), /não pode ser renovado/)
  assert.throws(() => acceptRefreshedFile(snapshot, 'focus-history.json', JSON.stringify({ generatedAt: 'x', series: {} })), /sem séries/)
  assert.throws(() => acceptRefreshedFile(snapshot, 'focus-history.json', '{'), /JSON inválido/)
  await writeFile(join(directory, 'curves.json'), JSON.stringify({ generatedAt: 1, outro: true }), 'utf8')
  await assert.rejects(verifyWeeklyData(directory, acceptRefreshedFile(snapshot, 'focus-history.json', renovado)), /preservar curves\.json/)
})

test('weekly workflow registers the refreshed Focus history after collecting it and before the build', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/pages.yml', import.meta.url), 'utf8')
  const accept = workflow.indexOf('run: node scripts/accept-focus-history.mjs "$RUNNER_TEMP/weekly-data-snapshot.json"')
  assert.ok(accept > workflow.indexOf('run: node scripts/fetch-focus-history.mjs'))
  assert.ok(accept < workflow.indexOf('      - name: Build'))
  assert.ok(workflow.slice(workflow.lastIndexOf('\n      - ', accept), accept).includes("if: github.event.schedule == '30 11 * * 1,2'"))
})
