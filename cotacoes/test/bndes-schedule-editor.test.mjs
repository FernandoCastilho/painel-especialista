import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { parseTlpSchedule } from '../src/bndesTlpExigivel.js'
import { parseLcdSchedule } from '../src/bndesLcdCap.js'
import { hookRenderer } from './helpers/hooks.mjs'
const require = createRequire(import.meta.url)
async function api() {
  const source = await readFile(new URL('../src/BndesScheduleEditor.jsx', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader:'jsx', format:'cjs', jsx:'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require })
  return module.exports
}
test('grade preserva eventos e validação dos dois parsers existentes', async () => {
  const { scheduleRows, scheduleText } = await api()
  const text = '2027-02-15; 21; C\n2027-03-15; 20; A'
  const rows = scheduleRows(text)
  assert.equal(rows.length, 2)
  const encoded = scheduleText(rows)
  assert.deepEqual(parseTlpSchedule(encoded), parseTlpSchedule(text))
  assert.deepEqual(parseLcdSchedule(encoded), parseLcdSchedule(text))
  const bad = scheduleText([['2027-02-31', '0', 'A']])
  assert.equal(parseTlpSchedule(bad).ok, false)
  assert.equal(parseLcdSchedule(bad).ok, false)
})
test('texto com colunas extras não é truncado silenciosamente para caber na grade', async () => {
  const { scheduleRows } = await api()
  assert.equal(scheduleRows('2027-02-15; 21; A; EXTRA'), null)
})

test('fase minúscula aceita pelo parser aparece selecionada na grade; texto inválido fica editável sem ocultação', async () => {
  const { scheduleRows } = await api()
  assert.equal(scheduleRows('2027-02-15; 21; c')[0][2], 'C')
  assert.equal(scheduleRows('2027-02-15; 21; a')[0][2], 'A')
  for (const invalid of ['2026-02-31; 21; A', 'data inválida; 21; A', '2027-02-15; 21; X']) assert.equal(scheduleRows(invalid), null, invalid)
})

test('linha vazia intermediária rejeitada pelo parser não desaparece na edição em tabela', async () => {
  const { scheduleRows } = await api()
  const raw = '2027-02-15; 21; C\n\n2027-03-15; 20; A'
  assert.equal(parseTlpSchedule(raw).ok, false)
  assert.equal(scheduleRows(raw), null)
})

test('primeiro preenchimento da grade vazia mantém a data digitada', async t => {
  const { default: Editor } = await api()
  let value = ''
  const render = hookRenderer(() => Editor({ id: 'schedule', value, onChange: next => { value = next } }))
  t.after(() => render.close())
  await render.settle()
  const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
  const input = nodes(render.value).find(node => node.props?.['aria-label'] === 'Vencimento 1')
  input.props.onChange({ target: { value: '2027-02-15' } })
  assert.ok(value.startsWith('2027-02-15;'))
})
