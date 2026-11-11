import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hookRenderer } from './helpers/hooks.mjs'
import * as engine from '../src/analiseDesconto.js'
import * as iof from '../src/iofRules.js'
import * as money from '../src/moneyInput.js'
import * as praca from '../src/pracaContrato.js'

const require = createRequire(import.meta.url)
const CalculatorHelp = ({ title, label }) => createElement('button', { type: 'button', 'aria-label': `Ajuda: ${title || label}`, 'aria-expanded': false }, '?')
async function compile(file, imports = {}) {
  const source = (await readFile(new URL('../src/' + file, import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require: (name) => imports[name] || require(name) })
  return module.exports
}
const MoneyInput = await compile('MoneyInput.jsx', { './moneyInput.js': money })
const component = await compile('AnaliseDesconto.jsx', { './iofRules.js': iof, './MoneyInput.jsx': MoneyInput, './analiseDesconto.js': engine, './CalculatorHelp.jsx': CalculatorHelp, './pracaContrato.js': praca, './format.js': await import('../src/format.js') })
function nodes(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(nodes)
  return [node, ...nodes(node.props?.children)]
}
export const textOf = node => Array.isArray(node) ? node.map(textOf).join('') : node && typeof node === 'object' ? textOf(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''
async function setup(t) {
  const back = []
  const render = hookRenderer(() => component.default({ onBack: () => back.push(true) }))
  t.after(() => render.close()); await render.settle()
  const find = (id) => nodes(render.value).find((node) => node.props?.id === 'ad-' + id)
  const set = async (id, value) => {
    const element = find(id)
    assert.ok(element, id)
    element.props.onChange(element.type === MoneyInput.default ? value : { target: { value } })
    await render.settle()
  }
  const html = () => renderToStaticMarkup(render.value)
  const ready = async () => { await set('titleFeeMode', 'percent'); await set('operations', '7') }
  return { render, find, set, html, ready, back }
}

test('tela não oferece IOF ou juros manuais e exige títulos',async t=>{const h=await setup(t);assert.equal(h.find('iofAdditional'),undefined);assert.equal(h.find('iofPaid'),undefined);assert.equal(h.find('interest'),undefined);assert.match(h.html(),/Vencimento contratual/);await h.ready();assert.match(h.html(),/Base do IOF/);assert.doesNotMatch(h.html(),/NaN|Infinity/)})
test('editar taxa e projeção muda valores; erro remove resultado e recuperar restaura',async t=>{const h=await setup(t);await h.ready();const a=h.html();await h.set('discountRate','3,5');assert.notEqual(h.html(),a);const b=h.html();await h.set('operations','');assert.match(h.html(),/Preencha ou corrija/);await h.set('operations','7');assert.equal(h.html(),b);await h.set('averageValue','451.200,86');assert.notEqual(h.html(),b)})
test('adicionar e remover títulos preserva um grupo e volta navegação',async t=>{const h=await setup(t);const buttons=()=>nodes(h.render.value).filter(n=>n.type==='button');buttons().find(n=>textOf(n)==='Adicionar grupo de títulos').props.onClick();await h.render.settle();assert.match(h.html(),/Grupo 2/);buttons().find(n=>textOf(n)==='Remover grupo 2').props.onClick();await h.render.settle();assert.doesNotMatch(h.html(),/Grupo 2/);buttons().find(n=>n.props.className==='cx-back').props.onClick();assert.equal(h.back.length,1)})
test('tabelas acessíveis não colidem com seletores de bloqueio publicitário',async t=>{const h=await setup(t);await h.ready();assert.equal(nodes(h.render.value).filter(n=>n.type==='table').length,3);assert.doesNotMatch(h.html(),/class="ad-table|class="ad-notice/)})
test('tela mostra CET dos dois lados, data de pagamento ajustada e não diz mais "não é CET"',async t=>{const h=await setup(t);await h.ready();const html=h.html();assert.match(html,/CET do desconto/);assert.match(html,/CET do giro/);assert.match(html,/Pago em 07\/12\/2026, próximo dia útil/);assert.ok((html.match(/\d+,\d{2}% a\.a\./g)||[]).length>=1+2+4);assert.doesNotMatch(html,/[Nn]ão é CET/)})
