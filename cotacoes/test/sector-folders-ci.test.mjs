import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { matrix, requiredChecks, verifySectorFolders } = require('../scripts/verify-sector-folders.cjs')
const source = file => readFileSync(new URL(file, import.meta.url), 'utf8')

function artifacts(t) {
  const root = mkdtempSync(join(tmpdir(), 'folders-matrix-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const file = (name, body = 'synthetic validator fixture, not browser evidence') => {
    const target = join(root, name)
    mkdirSync(join(target, '..'), { recursive: true })
    writeFileSync(target, body)
  }
  const report = { schemaVersion: 1, passed: true, errors: [], results: matrix.map(row => ({ ...row, status: 'pass', folders: 15, overflow: false, ...Object.fromEntries(requiredChecks.map(check => [check, true])) })) }
  const save = () => file('report.json', JSON.stringify(report))
  save()
  for (const { width, theme } of matrix) for (const state of ['pastas', 'subsetores', 'estudo']) file(`${width}-${theme}-${state}.png`)
  return { root, file, report, save }
}

test('folders gate requires all eight width/theme combinations and 24 captures', t => {
  assert.deepEqual(matrix, [320, 390, 768, 1440].flatMap(width => ['light', 'dark'].map(theme => ({ width, theme }))))
  const { root, file, report, save } = artifacts(t)
  assert.equal(verifySectorFolders(root).passed, true)
  report.results.pop(); save()
  assert.match(verifySectorFolders(root).errors.join('\n'), /1440-dark: expected one complete passing record/)
  file('320-light-pastas.png', '')
  assert.match(verifySectorFolders(root).errors.join('\n'), /empty artifact: 320-light-pastas/)
})

test('folders gate rejects duplicate rows and every incomplete required flow', t => {
  const { root, report, save } = artifacts(t)
  for (const check of requiredChecks) {
    report.results[0][check] = false; save()
    assert.equal(verifySectorFolders(root).passed, false, check)
    report.results[0][check] = true
  }
  report.results[0].overflow = true; save()
  assert.equal(verifySectorFolders(root).passed, false)
  report.results[0].overflow = false
  report.results[1] = { ...report.results[0] }; save()
  assert.equal(verifySectorFolders(root).passed, false)
})

test('folders gate rejects missing or failed reports and browser exceptions', t => {
  const { root, report, save } = artifacts(t)
  report.passed = false; save()
  assert.equal(verifySectorFolders(root).passed, false)
  report.passed = true; report.errors.push('synthetic browser error'); save()
  assert.equal(verifySectorFolders(root).passed, false)
  rmSync(join(root, 'report.json'))
  assert.equal(verifySectorFolders(root).passed, false)
})

test('CI adds the folders gates without replacing the calculator matrix or artifact upload', () => {
  const workflow = source('../../.github/workflows/cotacoes-ci.yml')
  assert.match(workflow, /FOLDERS_QA_OUTPUT="\$RUNNER_TEMP\/qa-universal\/folders" node scripts\/smoke-sector-folders\.cjs/)
  assert.match(workflow, /node scripts\/verify-sector-folders\.cjs "\$RUNNER_TEMP\/qa-universal\/folders"/)
  assert.match(workflow, /node scripts\/verify-smoke-matrix\.cjs "\$RUNNER_TEMP\/qa-universal"/)
  assert.match(workflow, /Capturas de tela dos smokes\n\s+if: always\(\)[\s\S]*?\$\{\{ runner\.temp \}\}\/qa-universal/)
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/)
  assert.ok(workflow.indexOf('smoke-sector-folders.cjs') < workflow.indexOf('verify-sector-folders.cjs'))
  assert.match(workflow, /Capturas e relatório das pastas\n\s+if: always\(\)[\s\S]*?name: pastas-setoriais-design[\s\S]*?path: \$\{\{ runner\.temp \}\}\/qa-universal\/folders/)
  assert.ok(workflow.indexOf('name: pastas-setoriais-design') < workflow.indexOf('Conferir tema, Trends'))
})

test('folders smoke exercises reload after history, checks the actual theme and isolates remote calls', () => {
  const smoke = source('../scripts/smoke-sector-folders.cjs')
  assert.match(smoke, /require\('\.\/smoke-launch\.cjs'\)/)
  assert.match(smoke, /document\.documentElement\.dataset\.theme === expected/)
  assert.match(smoke, /route\.request\(\)\.url\(\)\)\.origin === new URL\(base\)\.origin/)
  assert.match(smoke, /page\.goForward\(\)[\s\S]*?value === 'compensados'\)[\s\S]*?page\.reload\(\)/)
  assert.ok((smoke.match(/await page\.reload\(\)/g) || []).length >= 3)
  assert.match(smoke, /report\.passed = true/)
  assert.match(smoke, /report\.failureContext = await activePage\.evaluate/)
  assert.match(smoke, /finally \{ fs\.writeFileSync/)
})

test('existing navigation smokes use the new path while keeping content and browser-history checks', () => {
  const nav = source('../scripts/smoke-setores-navigation.cjs')
  const others = source('../scripts/smoke-outros.cjs')
  const studies = source('../scripts/smoke-researched-sectors.cjs')
  for (const script of [nav, others]) {
    assert.match(script, /name: 'Explore por setor'/)
    assert.match(script, /name: 'Todos os setores'/)
    assert.doesNotMatch(script, /name: 'Central de setores'/)
  }
  assert.match(nav, /classList\.contains\('central-surface'\)/)
  assert.match(nav, /Math\.abs\(content\.width - surface\.width\) <= 1/)
  assert.match(nav, /value === 'móveis'/)
  assert.match(studies, /waitForFunction\(title => document\.querySelector\('\.central-search input'\)\?\.value === title, destination\.title\)/)
  assert.match(studies, /name: selected\.title, exact: true/)
})


test('folders smoke requires repeated-study and both clear-search keyboard focus paths', () => {
  const smoke = source('../scripts/smoke-sector-folders.cjs')
  assert.match(smoke, /for \(let repeat = 0; repeat < 2; repeat\+\+\)/)
  assert.match(smoke, /document\.activeElement\?\.classList\.contains\('central-surface'\)/)
  assert.match(smoke, /history\.length\), historyBeforeRepeat/)
  assert.match(smoke, /locator\('\.central-empty'\)\.getByRole\('button'/)
  assert.equal((smoke.match(/document\.activeElement === document\.querySelector\('\.central-search input'\)/g) || []).length, 2)
  assert.ok(requiredChecks.includes('repeatSelection'))
  assert.ok(requiredChecks.includes('clearFocus'))
})
