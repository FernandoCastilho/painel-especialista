import test from 'node:test'
import { withCalcBack } from './helpers/calcBack.mjs'
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
// Isolate product state tests from the expansion shell; dialog behavior has separate tests.
const panelStub = ({ title, children }) => createElement('section', null, createElement('h3', null, title), children)

const CalculatorHelp = ({ title, label }) => createElement('button', { type: 'button', 'aria-label': `Ajuda: ${title || label}`, 'aria-expanded': false }, '?')
async function compile(file, imports = {}) {
  const source = (await readFile(new URL('../src/' + file, import.meta.url), 'utf8')).replace(/^import ['"].+\.css['"]\s*$/gm, '')
  const { code } = await transform(source, { loader: 'jsx', format: 'cjs', jsx: 'automatic' })
  const module = { exports: {} }
  runInNewContext(code, { module, exports: module.exports, require: withCalcBack((name) => (name === './ExpandablePanel.jsx' ? panelStub : imports[name]) || require(name)) })
  return module.exports
}
const MoneyInput = await compile('MoneyInput.jsx', { './moneyInput.js': money })
// Linha mestra comum (19/11/2026): no teste, data de 05/11/2026 (a do exemplo de referência) e o padrão da linha mestra
// (R$ 3.000.000,00 desde 21/11/2026; o teste que lê o valor digita antes o R$ 1.000.000,00 de antes).
const lm = await import('../src/linhaMestra.js')
const lmTest = { ...lm, lmLoad: () => lm.lmDefaults('2026-11-05') }
const LinhaMestra = await compile('LinhaMestra.jsx', { './MoneyInput.jsx': MoneyInput, './CalculatorHelp.jsx': CalculatorHelp, './pracaContrato.js': praca, './linhaMestra.js': lmTest })
// Peças comuns do roteiro (21/11/2026): título numerado, linha do tempo e resultado.
const Roteiro = await compile('Roteiro.jsx', { './centavosDaTela.js': await import('../src/centavosDaTela.js') })
const component = await compile('AnaliseDesconto.jsx', { './Roteiro.jsx': Roteiro, './ReferenciaMercado.jsx': () => null, './iofRules.js': iof, './MoneyInput.jsx': MoneyInput, './analiseDesconto.js': engine, './CalculatorHelp.jsx': CalculatorHelp, './pracaContrato.js': praca, './format.js': await import('../src/format.js'), './contaGarantida.js': await import('../src/contaGarantida.js'), './LinhaMestra.jsx': LinhaMestra, './linhaMestra.js': lmTest })
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
  // Sair do campo: é quando o erro dele passa a aparecer.
  const blur = async (id) => { const element = find(id); assert.ok(element, id); element.props.onBlur({ target: {} }); await render.settle() }
  const html = () => renderToStaticMarkup(render.value)
  const ready = async () => { await set('titleFeeMode', 'percent'); await set('operations', '7') }
  return { render, find, set, blur, html, ready, back }
}

test('tela não oferece IOF ou juros manuais e exige títulos',async t=>{const h=await setup(t);assert.equal(h.find('iofAdditional'),undefined);assert.equal(h.find('iofPaid'),undefined);assert.equal(h.find('interest'),undefined);assert.match(h.html(),/Vencimento contratual/);await h.ready();assert.match(h.html(),/Base do IOF/);assert.doesNotMatch(h.html(),/NaN|Infinity/)})
test('editar taxa e projeção muda valores; erro remove resultado e recuperar restaura',async t=>{const h=await setup(t);await h.ready();const a=h.html();await h.set('discountRate','3,5');assert.notEqual(h.html(),a);const b=h.html();await h.set('operations','');assert.doesNotMatch(h.html(),/Preencha ou corrija/);assert.match(h.html(),/Preencha os campos que faltam para ver a comparação\./);await h.blur('operations');assert.match(h.html(),/Preencha ou corrija/);assert.equal(h.find('operations').props['aria-invalid'],true);await h.set('operations','7');assert.equal(h.html(),b);await h.set('averageValue','451.200,86');assert.notEqual(h.html(),b)})
test('adicionar e remover títulos preserva um grupo e volta navegação',async t=>{const h=await setup(t);const buttons=()=>nodes(h.render.value).filter(n=>n.type==='button');buttons().find(n=>textOf(n)==='Adicionar grupo de títulos').props.onClick();await h.render.settle();assert.match(h.html(),/Grupo 2/);buttons().find(n=>textOf(n)==='Remover grupo 2').props.onClick();await h.render.settle();assert.doesNotMatch(h.html(),/Grupo 2/);assert.equal(buttons().some(n=>n.props.className==='cx-back'),false);assert.equal(h.back.length,0)})
test('tabelas acessíveis não colidem com seletores de bloqueio publicitário',async t=>{const h=await setup(t);await h.ready();assert.equal(nodes(h.render.value).filter(n=>n.type==='table').length,3);assert.doesNotMatch(h.html(),/class="ad-table|class="ad-notice/)})
test('tela mostra CET dos dois lados, data de pagamento ajustada e não diz mais "não é CET"',async t=>{const h=await setup(t);await h.ready();const html=h.html();assert.match(html,/CET do desconto/);assert.match(html,/CET do giro/);assert.match(html,/Pago em 07\/12\/2026, próximo dia útil/);assert.ok((html.match(/\d+,\d{2}% a\.a\./g)||[]).length>=1+2+4);assert.doesNotMatch(html,/[Nn]ão é CET/)})
test('abre sem erro em vermelho; o erro da tarifa só aparece depois de passar pelo campo',async t=>{const h=await setup(t);assert.doesNotMatch(h.html(),/role="alert"|aria-invalid="true"/);assert.doesNotMatch(h.html(),/Preencha ou corrija/);assert.match(h.html(),/Escolha como a tarifa dos títulos é cobrada para ver a comparação\./);await h.blur('titleFeeMode');assert.equal(h.find('titleFeeMode').props['aria-invalid'],true);assert.match(h.html(),/role="alert">Escolha como a tarifa dos títulos é cobrada\.</);assert.match(h.html(),/Preencha ou corrija os campos sinalizados/);await h.set('titleFeeMode','percent');assert.doesNotMatch(h.html(),/role="alert"|aria-invalid="true"|Preencha/)})
// Roteiro de 21/11/2026: primeiro o custo do desconto (1 a 3; a linha do tempo saiu), depois a comparação com o giro. Os números são os de antes.
test('roteiro: blocos na ordem e os seis valores de antes dentro do resultado do desconto',async t=>{const h=await setup(t);await h.set('titleFeeMode','total');const html=h.html().replace(/\u00a0/g,' ');const at=['Demanda do cliente','Encargos','Resultado · custo final para o cliente','Comparação com o capital de giro','Projeção mensal do desconto','Premissas do capital de giro','Desconto × giro: resultado'].map(text=>html.indexOf(text));assert.ok(at.every((n,k)=>n>0&&(k===0||n>at[k-1])),JSON.stringify(at));assert.doesNotMatch(html,/Linha do tempo/);const result=html.slice(at[2],at[3]);for(const value of ['R$ 218.951,74','R$ 6.648,69','41,45% a.a.','2,93% a.m.','prazo real: 40,66% a.a.','R$ 4.403,72','R$ 1.420,97','R$ 564,00','R$ 260,00','R$ 6.084,69','R$ 221.196,71'])assert.ok(result.includes(value),value)})
test('roteiro: sem a tarifa escolhida, o resultado do desconto avisa o que falta e não mostra número',async t=>{const h=await setup(t);const html=h.html();assert.match(html,/Escolha como a tarifa dos títulos é cobrada para ver o resultado\./);assert.doesNotMatch(html,/% a\.a\./)})
test('valor da linha mestra continua como opção do principal usado no giro',async t=>{const h=await setup(t);await h.ready();assert.equal(h.find('giroPrincipal'),undefined);await h.set('giroPrincipalMode','linha');assert.equal(h.find('giroPrincipal').props.value,'3.000.000,00');await h.set('giroPrincipal','1.000.000,00');assert.equal(h.find('giroPrincipal').props.value,'1.000.000,00');assert.match(h.html(),/Valor para o giro comparado/);assert.match(h.html().replace(/\u00a0/g,' '),/Principal do giro: <b>R\$ 1\.000\.000,00<\/b>/);await h.set('giroPrincipalMode','manual');assert.equal(h.find('giroPrincipal').props.value,'')})
// A conta não arredonda no meio do caminho: quando as partes mostradas não somam o custo total mostrado, a tela explica a diferença.
test('arredondamento: a linha só aparece quando a soma das partes mostradas não fecha, e nenhum valor muda',async t=>{const h=await setup(t);await h.set('titleFeeMode','total');const html=()=>h.html().replace(/\u00a0/g,' ');assert.doesNotMatch(html(),/Arredondamento/);const nominal=nodes(h.render.value).find(n=>n.type===MoneyInput.default&&!n.props.id);nominal.props.onChange('123.456,78');await h.render.settle();const shown=html();for(const value of ['R$ 2.409,88','R$ 777,61','R$ 564,00','R$ 260,00','<dt>Custo total completo</dt><dd>R$ 4.011,48</dd>','<dt>Arredondamento: as partes somam R$ 4.011,49; a diferença vem de arredondar cada parte em centavos</dt><dd>-R$ 0,01</dd>'])assert.ok(shown.includes(value),value)})
