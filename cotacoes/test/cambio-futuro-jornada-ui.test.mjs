import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'

const require = createRequire(import.meta.url)
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el?.props ? [el, ...nodes(el.props.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join(' ') : el?.props ? text(el.props.children) : typeof el === 'string' ? el : ''
test('preenche a jornada, alterna cinco parcelas e não reutiliza taxa de vencimento alterado', async t => {
  const module = { exports: {} }
  const paths = ['marketReturns', 'cambioFuturoSpot', 'moneyInput', 'cdiDolar', 'cambioFuturoJornada']
  const deps = Object.fromEntries(await Promise.all(paths.map(async p => ['./' + p + '.js', await import('../src/' + p + '.js')])))
  const { code } = await transform(await readFile(new URL('../src/CambioFuturoJornada.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  runInNewContext(code, { module, exports: module.exports, require: name => name.endsWith('.jsx') ? () => null : name.endsWith('.css') ? {} : deps[name] ?? require(name) })
  const ui = hookRenderer(() => module.exports.default({}))
  t.after(() => ui.close())
  await ui.settle()
  const field = id => nodes(ui.value).find(n => n.props.id === 'cf-j-' + id)
  const fill = async (id, value) => {
    const el = field(id)
    if (el.props.change) el.props.change(value)
    else el.props.onChange({ target: { value } })
    await ui.settle()
  }
  assert.equal(field('quantidade'), undefined)
  assert.match(text(field('resultado')), /Bullet/)
  await fill('inicio', '2026-11-16')
  await fill('1-venc', '2027-11-16')
  await fill('1-principal', '100.000,00')
  await fill('1-juros', '11.229,01')
  assert.equal(text(field('total-usd')), '—')
  for (const [id, value] of Object.entries({ '1-spot-USD': '5,9160', '1-futuro-USD': '6,5027', '1-spot-EUR': '6,4933', '1-futuro-EUR': '7,2529' })) await fill(id, value)
  assert.match(text(field('total-usd')), /723\.288,88/)
  assert.match(text(field('total-alvo')), /735\.008,66/)
  const out = nodes(ui.value).find(n => n.props['aria-labelledby'] === 'cf-j-resultado')
  assert.equal(nodes(out).filter(n => n.type === 'input' || n.type?.name === 'CampoCotacao').length, 0)
  await fill('modalidade', 'parcelado')
  assert.equal(field('quantidade').props.value, 1)
  assert.match(text(field('resultado')), /Parcelado/)
  assert.equal(field('1-futuro-USD').props.value, '')
  assert.equal(field('1-principal').props.value, '100.000,00')
  await fill('quantidade', '5')
  assert.ok(field('out-5'))
  assert.equal(text(field('total-usd')), '—')
  await fill('1-futuro-USD', '6,51')
  await fill('1-venc', '2027-11-17')
  assert.equal(field('1-futuro-USD').props.value, '')
  await fill('modalidade', 'bullet')
  assert.equal(field('quantidade'), undefined)
  assert.equal(field('out-5'), undefined)
})
