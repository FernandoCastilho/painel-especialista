import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
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
  assert.match(workflow, /Capturas de tela dos smokes\n\s+if: always\(\)[\s\S]*?\$\{\{ runner\.temp \}\}\/qa-universal/)
  assert.ok(workflow.indexOf('verify-smoke-matrix.cjs') < workflow.indexOf('name: Capturas de tela dos smokes'))
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
  assert.match(calculator, /\['Nº', 'Vencimento', 'Indexador \(% a\.a\.\)', 'Saldo inicial'/)
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
