import test from 'node:test'
import assert from 'node:assert/strict'
import { calcIrr, calcNpv, createRpnEngine, solveTvm } from '../src/rpnEngine.mjs'

const expectNear = (actual, target, absolute = 1e-9) => assert.ok(Math.abs(actual-target) <= absolute, `${actual} vs ${target}`)
const press = (engine, ...keys) => keys.reduce((_,key) => engine.press(key), engine.snapshot())
const moneyDisplay = number => Math.round(number * 100) / 100

test('sequências de pilha, ordem de operandos, Last X e repetição de T', () => {
  const engine = createRpnEngine()
  assert.deepEqual(press(engine, '8','enter','2','subtract').stack,[6,0,0,0])
  assert.deepEqual(engine.press('lastX').stack,[2,6,0,0])
  assert.deepEqual(press(engine,'clearAll','2','enter','3','add','4','multiply').stack,[20,0,0,0])
  assert.deepEqual(press(engine,'clearAll','1','enter','2','enter','3','enter','4','add').stack,[7,2,1,1])
  assert.deepEqual(engine.press('drop').stack,[2,1,1,7])
})
test('decimal visível não arredonda o armazenamento e erro não altera a pilha', () => {
  const engine = createRpnEngine()
  assert.equal(press(engine,'1','decimal','2','5').display,'1,25')
  assert.equal(press(engine,'backspace','changeSign').stack[0],-1.2)
  const before = press(engine,'enter','0').stack
  assert.match(engine.press('divide').message,/dividir por zero/)
  assert.deepEqual(engine.snapshot().stack,before)
  assert.deepEqual(engine.press('clearEntry').stack,[0,-1.2,0,0])
  assert.equal(press(engine,'clearAll','2','0','0','enter','5','percent').stack[0],10)
})
test('vetores do manual HP: prestação em END e valor futuro em BEGIN', () => {
  // Manual oficial HP 12C, pp. 47 e 49: https://h10032.www1.hp.com/ctg/Manual/c00363319.pdf
  const loan = { n:348, i:14.25/12, pv:43400, fv:0 }
  const savings = { n:24, i:6.25/12, pv:0, pmt:-50 }
  assert.equal(moneyDisplay(solveTvm('pmt',loan)), -523.99)
  assert.equal(moneyDisplay(solveTvm('fv',savings,'begin')), 1281.34)
})
test('TVM resolve os cinco registradores, inclusive taxa negativa e sem juros', () => {
  for (const timing of ['begin','end']) for (const rate of [0,1e-7,1.1,-0.75]) {
    const known = { n:24, i:rate, pv:12000, pmt:-400 }
    const fv = solveTvm('fv',known,timing)
    for (const field of ['pv','pmt','i','n']) {
      const complete = {...known,fv}
      const partial = {...complete}
      delete partial[field]
      expectNear(solveTvm(field,partial,timing),complete[field],field === 'n' ? 0 : 1e-6)
    }
  }
  assert.equal(solveTvm('pmt',{n:3,i:0,pv:300,fv:0}),-100)
  assert.throws(() => solveTvm('pmt',{n:3,i:0,pv:300,fv:0},'typo'), /Modo de pagamento inválido/)
  assert.throws(() => solveTvm('n',{i:0,pv:325,pmt:-100,fv:0}), /fracionário/)
  assert.throws(() => solveTvm('i',{n:2,pv:-100,pmt:230,fv:-362}), /múltiplas/)
})
test('vetores oficiais HP para VPL e TIR', () => {
  // HP 12C, pp. 60 e 62–63.
  assert.equal(moneyDisplay(calcNpv([-80000,-500,4500,5500,4500,130000],13)),212.18)
  const flows = [-79000,14000,11000,10000,10000,10000,9100,9000,9000,4500,100000]
  assert.equal(moneyDisplay(calcNpv(flows,13.5)),907.77)
  assert.equal(moneyDisplay(calcIrr(flows)),13.72)
  expectNear(calcNpv(flows,calcIrr(flows)),0,1e-8)
})
test('TIR negativa, zero, extremos e situações sem taxa única', () => {
  assert.equal(calcNpv([-100,30,50],0), -20)
  assert.equal(calcNpv([1e14,0.01,-1e14],0),0.01)
  assert.equal(calcNpv([1e16,1,-1e16],0),1)
  expectNear(calcIrr([-100,80]),-20)
  expectNear(calcIrr([-100,100]),0)
  expectNear(calcIrr([...Array(100).fill(0),-100,80,...Array(100).fill(0)]),-20)
  assert.throws(() => calcIrr([-100,230,-132]),/múltiplas/)
  assert.throws(() => calcIrr([0,-100,0,-20]),/entrada e saída/)
  assert.throws(() => calcNpv([-100,50],-100),/maior/)
})
test('registradores, modo BEGIN, cópia do snapshot e fluxo agrupado', () => {
  const engine = createRpnEngine()
  const partial = press(engine,'solve:pmt')
  assert.match(partial.message, /demais valores/)
  for (const [key,digits] of [['n','3'],['i','0'],['pv','300'],['fv','0']]) {
    press(engine,'clearEntry',...digits,'store:'+key)
  }
  assert.equal(engine.press('solve:pmt').stack[0],-100)
  assert.equal(engine.press('timing:begin').settings.paymentTiming,'begin')
  press(engine,'clearEntry','1','0','0','changeSign','cash:add','3','0','cash:add','3','cash:repeat')
  const state = engine.snapshot()
  assert.deepEqual(state.cashFlows,[-100,30,30,30])
  state.cashFlows.length = 1
  state.finance.i = 99
  assert.deepEqual(engine.snapshot().cashFlows,[-100,30,30,30])
  assert.equal(engine.press('cash:npv').stack[0],-10)
  expectNear(engine.press('cash:irr').stack[0],calcIrr([-100,30,30,30]))
  assert.equal(engine.snapshot().finance.i,0)
  assert.deepEqual(engine.press('cash:clear').cashFlows,[])
})

test('potência e raiz salvam X e não alteram a pilha em domínio inválido', () => {
  const engine = createRpnEngine()
  assert.equal(press(engine,'3','enter','2','power').stack[0],9)
  assert.equal(engine.press('sqrt').stack[0],3)
  assert.equal(engine.press('lastX').stack[0],9)
  const before = engine.press('changeSign').stack
  assert.match(engine.press('sqrt').message,/raiz real/)
  assert.deepEqual(engine.snapshot().stack,before)
})

test('juros pagos sem amortizar não mudam o saldo, mesmo em prazo longo', () => {
  for (const n of [12,360,500,10000]) {
    assert.equal(solveTvm('fv',{n,i:10,pv:125000,pmt:-12500}),-125000)
    assert.equal(solveTvm('fv',{n,i:10,pv:110000,pmt:-10000},'begin'),-110000)
    assert.equal(solveTvm('pv',{n,i:-10,fv:125000,pmt:-12500}),-125000)
    assert.equal(solveTvm('pv',{n,i:-10,fv:90000,pmt:-10000},'begin'),-90000)
  }
  assert.throws(() => solveTvm('fv',{n:10000,i:10,pv:125000,pmt:-12500.01}), /limite numérico/)
})

test('resolver prazo preserva um fator de desconto próximo de zero', () => {
  assert.equal(solveTvm('n',{i:100,pv:101,pmt:-100,fv:-100-2**60}),60)
})
