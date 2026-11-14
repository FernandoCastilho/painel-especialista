import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CONCEITO_ACC, diferencaCambial, jurosAcc, reaisAdiantados } from '../src/acc.js'
import { CONCEITOS, buscarConceitos, conexoesDe, porTopico } from '../src/educacao.js'
import { parseCommand } from '../src/terminal.js'

const c = CONCEITO_ACC
const texto = (v) => JSON.stringify(v)

test('ACC: contas do exemplo', () => {
  assert.equal(reaisAdiantados({ valorMe: 100_000, taxaContrato: 5 }), 500_000)
  assert.ok(Math.abs(jurosAcc({ valorMe: 100_000, taxaAno: 0.07, dias: 180 }) - 3_500) < 1e-6)
  assert.ok(Math.abs(diferencaCambial({ valorMe: 100_000, taxaContrato: 5, taxaDia: 5.4 }) - 40_000) < 1e-6)
  assert.ok(Math.abs(diferencaCambial({ valorMe: 100_000, taxaContrato: 5, taxaDia: 4.8 }) + 20_000) < 1e-6)
  for (const v of [null, undefined, '', '5', -1, NaN, Infinity]) {
    assert.equal(reaisAdiantados({ valorMe: v, taxaContrato: 5 }), null)
    assert.equal(jurosAcc({ valorMe: 100_000, taxaAno: v, dias: 180 }), null)
    assert.equal(diferencaCambial({ valorMe: 100_000, taxaContrato: 5, taxaDia: v }), null)
  }
})

test('ACC: o texto exibido traz os mesmos números das contas', () => {
  const ex = texto(c.exemplo)
  for (const n of ['R$ 500.000', 'US$ 3.500', 'R$ 540.000', 'R$ 40.000', 'R$ 18.900']) assert.ok(ex.includes(n), n)
  assert.match(c.exemplo.resultado, /ilustrativos/)
  assert.match(c.preciso.texto, /convenção usual, não regra/)
})

test('ACC: fluxo normal, desvios e custos cobrem o material de origem', () => {
  assert.equal(c.fluxo.principal.passos.length, 4)
  assert.deepEqual(c.fluxo.desvio.passos.map(p => p.quem), ['Devolução', 'Débito em conta', 'Cancelamento ou baixa'])
  assert.equal(c.fluxo.custos.itens.length, 6)
  assert.match(texto(c.lacunas), /baixa é só um registro contábil/)
  assert.match(texto(c.lacunas), /5\.056/)
  assert.match(texto(c.lacunas), /registrado no contrato/)
  assert.match(c.fluxo.desvio.fim, /só fecha/)
  assert.match(texto(c.lacunas), /ACE/)
  assert.match(texto(c.lacunas), /art\. 49, § 4º/)
})

test('ACC: aparece em Comércio exterior, na busca, nos atalhos e nas ligações', () => {
  assert.equal(CONCEITOS.filter(x => x.id === 'acc').length, 1)
  assert.ok(porTopico(CONCEITOS).find(g => g.topico === 'Comércio exterior').itens.some(x => x.id === 'acc'))
  for (const termo of ['ACC', 'adiantamento sobre contrato de cambio', 'ACE', 'deságio', 'baixa']) assert.ok(buscarConceitos(termo).some(x => x.id === 'acc'), termo)
  assert.deepEqual(parseCommand('acc'), { kind: 'tab', id: 'aprender', sub: 'acc' })
  assert.deepEqual(conexoesDe('acc').map(x => x.id).sort(), ['cupom-cambial', 'drawback', 'sofr'])
  assert.ok(c.fontes.length >= 3 && c.fontes.every(f => /\.gov\.br$/.test(new URL(f.url).hostname)))
  assert.match(readFileSync(new URL('../src/Aprender.jsx', import.meta.url), 'utf8'), /c\.fluxo && <LearnFlow/)
})
