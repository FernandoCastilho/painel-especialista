import test from 'node:test'
import assert from 'node:assert/strict'
import { hedge4131, loan4131 } from '../src/emprestimo4131.js'
import { E4_FX_SCENARIOS, E4_SLIDES, E4_TITLE, buildE4Slides, captureE4 } from '../src/emprestimo4131Presentation.js'

const loan = loan4131({ principal: 1e7, rate: 5.8, spot: 5.4, start: '2026-11-11', months: 24, freq: 6, irrf: 15, grossUp: true, flat: 0.5, guarantee: 0 })
const hedge = hedge4131(loan, { di: 12.75, cupom: 5.2 })
const labels = { freq: 'Semestral', irPayer: 'Tomador (gross-up)' }

test('cópia congelada · guarda os números da tela e os cenários de câmbio, sem recalcular depois', () => {
  const snapshot = captureE4({ loan, hedge, labels }, 1794400000000)
  assert.equal(snapshot.capturedAt, 1794400000000)
  assert.equal(snapshot.loan.allIn, loan.allIn)
  assert.equal(snapshot.hedge.swap.spread, hedge.swap.spread)
  assert.equal(snapshot.hedge.ndf.totalBrl, hedge.ndf.totalBrl)
  assert.deepEqual(snapshot.scenarios.map((item) => item.fxChange), [...E4_FX_SCENARIOS])
  assert.equal(snapshot.hedge.flows.length, loan.flows.length)
  assert.deepEqual(snapshot.labels, labels)
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.loan.flows[0]) && Object.isFrozen(snapshot.hedge.ndf))
  // A cópia é independente: é outro objeto, não o resultado vivo da tela.
  assert.notEqual(snapshot.loan, loan)
})

test('cópia congelada · sem empréstimo, sem proteção ou com número ausente, não gera nada', () => {
  assert.equal(captureE4({ loan: null, hedge, labels }), null)
  assert.equal(captureE4({ loan, hedge: null, labels }), null)
  assert.equal(captureE4({ loan, hedge: { ok: false } }), null)
  assert.equal(captureE4({ loan: { ...loan, allIn: NaN }, hedge, labels }), null)
  assert.equal(captureE4({ loan, hedge: { ...hedge, ndf: { ...hedge.ndf, breakeven: undefined } }, labels }), null)
  assert.equal(captureE4({ loan, hedge: { ...hedge, flows: hedge.flows.slice(1) }, labels }), null)
  assert.equal(captureE4({ loan, hedge, labels }, NaN), null)
})

test('slides · obrigatórios sempre entram, na ordem; título vazio usa o padrão', () => {
  const snapshot = captureE4({ loan, hedge, labels })
  assert.deepEqual(buildE4Slides(snapshot).slides, E4_SLIDES.map((item) => item.id))
  const curto = buildE4Slides(snapshot, { title: '   ', sections: ['flow'], textSize: 'enorme' })
  assert.deepEqual(curto.slides, ['results', 'flow', 'premises'])
  assert.equal(curto.title, E4_TITLE)
  assert.equal(curto.textSize, 'normal')
  assert.equal(buildE4Slides(null), null)
})
