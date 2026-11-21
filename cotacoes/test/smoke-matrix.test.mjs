import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
const require = createRequire(import.meta.url)
const { widths, layoutRoutes, profileRoutes, calculatorMatrix, headerMatrix } = require('../scripts/smoke-calculator-matrix.cjs')
const { verifySmokeMatrix } = require('../scripts/verify-smoke-matrix.cjs')
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8')

test('matrix declares exactly eight distinct routes at five required viewports', () => {
  assert.deepEqual(widths, [320, 390, 768, 1024, 1440])
  assert.equal(new Set([...layoutRoutes, ...profileRoutes]).size, 8)
  assert.equal(calculatorMatrix.length, 40)
  assert.equal(new Set(calculatorMatrix.map(row => `${row.route}:${row.width}`)).size, 40)
  assert.deepEqual(headerMatrix, ['dark', 'light'].map(theme => ({ route: 'setores', width: 320, theme })))
})

function syntheticArtifacts(t) {
  const root = mkdtempSync(join(tmpdir(), 'smoke-matrix-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = (name, body = 'synthetic artifact for validator unit test') => { const target = join(root, name); mkdirSync(join(target, '..'), { recursive: true }); writeFileSync(target, body) }
  const results = routes => calculatorMatrix.filter(row => routes.includes(row.route)).map(row => ({ ...row, status: 'pass' }))
  file('calculators/report.json', JSON.stringify(results(layoutRoutes)))
  file('bndes-profiles/report.json', JSON.stringify(results(profileRoutes)))
  file('theme/report.json', JSON.stringify({ passed: true, headerScenarios: headerMatrix.map(row => ({ ...row, status: 'pass' })) }))
  for (const width of widths) {
    for (const route of layoutRoutes) for (const state of ['initial', 'filled']) file(`calculators/${width}/${route}-${state}.png`)
    for (const state of ['initial', 'filled', 'ncg']) file(`calculators/${width}/alongamento-${state}.png`)
    for (const state of ['tfb-parcelas', 'tfb-caixa', 'tlp-projecao', 'tlp-negativo']) file(`bndes-profiles/${state}-${width}.png`)
  }
  for (const theme of ['dark', 'light']) for (const state of ['header', 'manual']) file(`theme/setores-${theme}-320-${state}.png`)
  return { root, file, results }
}

test('artifact verifier requires all 40 passes, alongamento and both Setores320 themes', t => {
  const { root, file, results } = syntheticArtifacts(t)
  assert.equal(verifySmokeMatrix(root).passed, true)
  const incomplete = results(profileRoutes).filter(row => !(row.width === 320 && row.route === 'bndes-tlp-exigivel'))
  file('bndes-profiles/report.json', JSON.stringify(incomplete))
  assert.match(verifySmokeMatrix(root).errors.join('\n'), /bndes-tlp-exigivel 320/)
  file('bndes-profiles/report.json', JSON.stringify(results(profileRoutes)))
  file('calculators/320/alongamento-ncg.png', '')
  assert.match(verifySmokeMatrix(root).errors.join('\n'), /empty artifact: calculators\/320\/alongamento-ncg/)
  file('calculators/320/alongamento-ncg.png')
  file('theme/report.json', JSON.stringify({ passed: true, headerScenarios: [] }))
  assert.match(verifySmokeMatrix(root).errors.join('\n'), /header dark 320/)
  assert.equal(verifySmokeMatrix(root).passed, false)
})

test('CI connects browser loops, alongamento, reports and always-uploaded matrix artifacts', () => {
  const workflow = source('../../.github/workflows/cotacoes-ci.yml')
  const layout = source('../scripts/smoke-calculator-layout.cjs')
  const profiles = source('../scripts/smoke-bndes-profiles.cjs')
  const theme = source('../scripts/smoke-theme.cjs')
  for (const script of [layout, profiles, theme]) {
    assert.match(script, /require\('\.\/smoke-calculator-matrix\.cjs'\)/)
    assert.match(script, /for \(const width of widths\)/)
  }
  assert.match(layout, /if \(route === 'conta-garantida'\) await require\('\.\/smoke-alongamento\.cjs'\)/)
  assert.match(layout, /finally \{\s*fs\.writeFileSync\(path\.join\(out, 'report\.json'\)/)
  assert.match(profiles, /finally \{\s*fs\.writeFileSync\(path\.join\(out, 'report\.json'\)/)
  assert.match(theme, /width === 320 \? \[\['setores'/)
  assert.match(theme, /headerScenarios\.push\(await assertSectorHeader/)
  assert.match(theme, /control\.width >= 43\.9 && control\.height >= 43\.9/)
  assert.match(theme, /geometry\.document <= geometry\.viewport \+ 1/)
  for (const script of ['smoke-calculator-layout', 'smoke-theme', 'smoke-bndes-profiles', 'smoke-tic-animation']) assert.ok(workflow.includes(script), script)
  assert.match(workflow, /node scripts\/verify-smoke-matrix\.cjs "\$RUNNER_TEMP\/qa-universal"/)
  const upload = workflow.split('      - name: Capturas de tela dos smokes\n')[1]?.split('\n      - name: ')[0] ?? ''
  assert.match(upload, /if: always\(\)/)
  assert.match(upload, /uses: actions\/upload-artifact@v4/)
  assert.match(upload, /name: smoke-capturas\b/)
  assert.match(upload, /\$\{\{ runner\.temp \}\}\/smoke-consolidado\/qa-universal/)
  assert.ok(workflow.indexOf('verify-smoke-matrix.cjs') < workflow.indexOf('name: Capturas de tela dos smokes'))
})

test('consolidated smoke keeps prior passing groups on rerun and fails closed on corrupt evidence', t => {
  const workflow = source('../../.github/workflows/cotacoes-ci.yml')
  const aggregate = workflow.split('      - name: Validar origem e consolidar evidências sem sobrescrever\n')[1]
    ?.split('      - name: Capturas de tela dos smokes')[0] ?? ''
  const script = aggregate.split("node --input-type=module - <<'JS'\n")[1]?.split('\n          JS')[0]
  assert.ok(script, 'execute the actual GitHub consolidation step')
  const sha = 'a'.repeat(40), run = '90'
  const groups = ['secoes', 'calculadoras', 'navegacao']
  for (const [scenario, expected] of [['mixed-attempts', 0], ['collision', 1], ['missing-group', 1], ['foreign-sha', 1]]) {
    const dir = mkdtempSync(join(tmpdir(), 'smoke-consolidation-'))
    t.after(() => rmSync(dir, { recursive: true, force: true }))
    for (const group of groups) {
      if (scenario === 'missing-group' && group === 'secoes') continue
      const base = join(dir, 'smoke-grupos', 'smoke-transfer-' + group)
      const qa = join(base, 'qa-universal')
      mkdirSync(qa, { recursive: true })
      const actualSha = scenario === 'foreign-sha' && group === 'secoes' ? 'b'.repeat(40) : sha
      const attempt = group === 'secoes' ? 1 : 2
      writeFileSync(join(base, 'manifest.txt'), `${actualSha} ${run} ${attempt} ${group}\n`)
      writeFileSync(join(qa, scenario === 'collision' ? 'shared.png' : group + '.png'), group)
    }
    const results = Object.fromEntries(groups.map(group => ['smoke-' + group, { result: 'success' }]))
    const result = spawnSync(process.execPath, ['--input-type=module', '-'], {
      input: script, encoding: 'utf8',
      env: { ...process.env, RUNNER_TEMP: dir, GITHUB_SHA: sha, GITHUB_RUN_ID: run, GITHUB_RUN_ATTEMPT: '2', CI_RESULTS: JSON.stringify(results) },
    })
    assert.equal(result.status, expected, `${scenario}: ${result.stderr}`)
    if (!expected) for (const group of groups) {
      assert.equal(readFileSync(join(dir, 'smoke-consolidado', 'qa-universal', group + '.png'), 'utf8'), group)
    }
  }
})

test('browser assertions wait for shared portals and select the intended help preview', () => {
  for (const file of ['smoke-researched-sectors', 'smoke-tic-animation']) {
    const script = source(`../scripts/${file}.cjs`)
    const wait = script.indexOf("getByRole('button', { name: 'Laser pointer: riscar a tela', exact: true }).waitFor()")
    assert.ok(wait >= 0, file)
    assert.ok(wait < script.indexOf("locator('button:visible').count()"), `${file}: wait before instantaneous count`)
  }
  const theme = source('../scripts/smoke-theme.cjs')
  assert.match(theme, /help\.getAttribute\('aria-describedby'\)/)
  assert.match(theme, /\[role="tooltip"\]\[id="\$\{previewId\}"\]/)
  assert.doesNotMatch(theme, /page\.getByRole\('tooltip'\)\.waitFor/)
  const calculator = source('../scripts/smoke-calculadora.cjs')
  assert.match(calculator, /\['Nº', 'Vencimento', 'Saldo inicial'/)
})

test('CI measures compact desktop branding and both amortization choices instead of hiding text', () => {
  const bndes = source('../scripts/smoke-bndes.cjs'), alongamento = source('../scripts/smoke-alongamento.cjs')
  assert.match(bndes, /\[1000, 1024, 1100, 1199, 1299\]/)
  assert.match(bndes, /topbar-geometry\.json/)
  assert.match(bndes, /geometry\.theme\.width >= 43\.9 && geometry\.theme\.height >= 43\.9/)
  assert.match(alongamento, /await assertSelections\('price'\)/)
  assert.match(alongamento, /await assertSelections\('sac'\)/)
  assert.match(alongamento, /alongamento-selections\.json/)
  assert.match(alongamento, /control\.width < control\.required/)
})
