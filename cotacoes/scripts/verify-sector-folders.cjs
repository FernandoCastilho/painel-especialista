// Fail closed unless the complete folders browser matrix and captures exist.
const fs = require('node:fs')
const path = require('node:path')
const widths = [320, 390, 768, 1440]
const themes = ['light', 'dark']
const matrix = widths.flatMap(width => themes.map(theme => ({ width, theme })))
const requiredChecks = ['images', 'navigation', 'search', 'history', 'reload', 'focus', 'repeatSelection', 'clearFocus', 'reducedMotion', 'inputs', 'invalidRoute']

function verifySectorFolders(root) {
  const errors = []
  let report
  try { report = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8')) }
  catch (error) { errors.push(`report.json: ${error.message}`) }
  if (report?.schemaVersion !== 1 || report?.passed !== true || report?.failure) errors.push('folders smoke did not complete successfully')
  if (!Array.isArray(report?.errors) || report.errors.length) errors.push('folders smoke has missing or nonempty browser errors')
  const rows = Array.isArray(report?.results) ? report.results : []
  if (rows.length !== matrix.length) errors.push(`expected exactly ${matrix.length} folder scenarios`)
  for (const expected of matrix) {
    const label = `${expected.width}-${expected.theme}`
    const matches = rows.filter(row => row.width === expected.width && row.theme === expected.theme)
    const row = matches[0]
    if (matches.length !== 1 || row?.status !== 'pass' || row?.folders !== 15 || row?.overflow !== false || requiredChecks.some(check => row?.[check] !== true)) errors.push(`${label}: expected one complete passing record`)
    for (const state of ['pastas', 'subsetores', 'estudo']) {
      const file = `${label}-${state}.png`
      try { if (!fs.statSync(path.join(root, file)).isFile() || fs.statSync(path.join(root, file)).size === 0) throw Error('empty artifact') }
      catch { errors.push(`missing or empty artifact: ${file}`) }
    }
  }
  return { passed: errors.length === 0, expected: matrix, actual: rows, errors }
}
module.exports = { matrix, requiredChecks, verifySectorFolders }
if (require.main === module) {
  const root = process.argv[2]
  if (!root) throw Error('Pass the folders artifact directory')
  fs.mkdirSync(root, { recursive: true })
  const report = verifySectorFolders(root)
  fs.writeFileSync(path.join(root, 'matrix-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, expectedScenarios: matrix.length, errors: report.errors }, null, 2))
  if (!report.passed) process.exitCode = 1
}
