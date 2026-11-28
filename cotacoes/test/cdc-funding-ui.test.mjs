import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { transform } from 'esbuild'
import { hookRenderer } from './helpers/hooks.mjs'

// Tela do CDC com o funding salvo (validade pedida por Fernando, 26/11/2026): vencido apaga e avisa; sem funding, o spread
// não calcula e avisa; pela taxa, segue normal.
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
globalThis.localStorage = mem(); globalThis.sessionStorage = mem()
const require = createRequire(import.meta.url)
const source = (await readFile(new URL('../src/Cdc.jsx', import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
const Resultado = () => null
const nada = { __esModule: true, default: () => null }
const deps = {
  './CalculatorHelp.jsx': nada, './MoneyInput.jsx': nada, './CalcBack.jsx': nada, './WhatsAppCotacao.jsx': nada,
  './EmailEnvelope.jsx': { EnvelopeEml: () => null }, './CalculatorIcons.jsx': { CdcIcon: () => null },
  './Roteiro.jsx': { Respostas: () => null, Resultado, step: (n, t) => t },
  './cdcEmail.js': { cdcEml: () => '', cdcResumo: () => ({}) }, './cdcImagem.js': { cdcImagem: () => null },
  './moneyInput.js': await import('../src/moneyInput.js'), './emprestimo.js': await import('../src/emprestimo.js'), './numeroBr.js': await import('../src/numeroBr.js'),
  './contaGarantida.js': await import('../src/contaGarantida.js'), './cdcConta.js': await import('../src/cdcConta.js'),
  './cdcFunding.js': await import('../src/cdcFunding.js'),
}
const module = { exports: {} }
runInNewContext(code, { module, exports: module.exports, require: name => deps[name] ?? require(name) })
const nodes = el => Array.isArray(el) ? el.flatMap(nodes) : el && typeof el === 'object' ? [el, ...nodes(el.props?.children)] : []
const text = el => Array.isArray(el) ? el.map(text).join('') : el && typeof el === 'object' ? text(el.props?.children) : typeof el === 'string' || typeof el === 'number' ? String(el) : ''
const TABELA = [{ id: 'digitada', label: 'Custo digitado', inicio: '2026-11-26', fim: null, taxas: { 12: 14.52, 72: 15.99 } }]

async function setup(t, validoAte) {
  deps['./cdcFunding.js'].guardarFunding(TABELA, '2999-12-31'); deps['./cdcFunding.js'].guardarFunding(null) // zera o aviso lembrado
  if (validoAte) localStorage.setItem('cdc-funding', JSON.stringify({ validoAte, tabela: TABELA }))
  const render = hookRenderer(() => module.exports.default({ onBack() {} }))
  t.after(() => render.close()); await render.settle()
  const modo = async v => { nodes(render.value).find(n => n.props?.id === 'cdc-modo').props.onChange({ target: { value: v } }); await render.settle() }
  const simular = async () => { nodes(render.value).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await render.settle() }
  const alerta = () => nodes(render.value).find(n => n.type === Resultado).props.alert
  const aviso = () => nodes(render.value).find(n => n.props?.className === 'cdc-funding-aviso')
  return { modo, simular, alerta, aviso, texto: () => text(render.value) }
}

test('funding vencido: some ao abrir e a tela avisa; pela taxa calcula normal, pelo spread não calcula', async t => {
  const h = await setup(t, '2020-01-01')
  assert.match(text(h.aviso()), /venceu em 01\/01\/2020 e foi apagada/)
  assert.equal(localStorage.getItem('cdc-funding'), null)
  await h.simular(); assert.equal(h.alerta(), null) // pela taxa: resultado sai
  await h.modo('spread'); await h.simular()
  assert.match(h.alerta().text, /venceu em 01\/01\/2020.*Para simular pelo spread, cadastre/)
})

test('sem funding cadastrado: spread avisa que falta o funding; com funding válido, o spread calcula', async t => {
  const sem = await setup(t, null)
  assert.equal(sem.aviso(), undefined)
  await sem.modo('spread'); await sem.simular()
  assert.match(sem.alerta().text, /Não há funding cadastrado\. Para simular pelo spread/)
  const com = await setup(t, '2999-12-31')
  assert.equal(com.aviso(), undefined)
  await com.modo('spread'); await com.simular()
  assert.equal(com.alerta(), null)
})
