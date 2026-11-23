import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
function harness(script) {
  const directory = mkdtempSync(join(tmpdir(), 'bndes-ci-'))
  writeFileSync(join(directory, 'check.cjs'), readFileSync(new URL('../scripts/smoke-bndes-executivo-check.cjs', import.meta.url)))
  writeFileSync(join(directory, 'smoke-bndes-executivo.cjs'), script)
  return require(join(directory, 'check.cjs'))
}
test('entrada existente do BNDES executa a nova conferência com a pasta de evidências', () => {
  const run = harness("process.exit(process.env.BNDES_EXECUTIVE_QA_OUTPUT === 'qa-executivo' ? 0 : 19)")
  assert.doesNotThrow(() => run('qa-executivo'))
})
test('falha da conferência executiva interrompe o teste pai e não libera o CI', () => {
  const run = harness('process.exit(7)')
  assert.throws(() => run('qa-executivo'), /7/)
})
