import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hpAmort,hpSimpleInterest,hpBondPrice,hpBondYield,hpDepreciation} from '../src/rpnClassicFinancial.mjs'

const cents = x => Number(x.toFixed(2))
test('HP guide §3, AMORT: two consecutive batches and history', () => {
  const p = {pv:50000,pmt:-573.35,i:13.25/12,count:12}
  const first = hpAmort(p)
  assert.deepEqual(first,{interest:-6608.89,principal:-271.31,pv:49728.69,n:12,count:12})
  assert.deepEqual(hpAmort({...p,pv:first.pv,n:first.n}),{interest:-6570.72,principal:-309.48,pv:49419.21,n:24,count:12})
})
test('HP guide Appendix D, AMORT begin applies zero interest only first period', () => {
  const p = {pv:100,pmt:-20,i:10,count:1,begin:true}
  const first = hpAmort(p)
  assert.equal(first.interest,0)
  assert.equal(hpAmort({...p,n:1,pv:first.pv}).interest,-8)
  assert.throws(()=>hpAmort({...p,count:0.5}),{code:5})
})
test('HP guide §3 INT', () => {
  const out = hpSimpleInterest({pv:-450,i:7,n:60})
  assert.equal(out.interest360,5.25)
  assert.equal(cents(out.interest365),5.18)
  assert.equal(out.principal+out.interest360,455.25)
})
test('HP guide §4 PRICE/YTM', () => {
  const p = {coupon:6.75,settlement:'2004-04-28',maturity:'2018-06-04'}
  const out=hpBondPrice({...p,yieldRate:8.25})
  assert.equal(cents(out.price),87.62)
  assert.equal(cents(out.price+out.accrued),90.31)
  assert.equal(cents(hpBondYield({...p,price:88.375}).yieldRate),8.15)
})
test('Appendix D discount for last coupon and invalid date', () => {
  const p={coupon:12,settlement:'2024-04-01',maturity:'2024-07-01'}
  assert.equal(hpBondPrice({...p,yieldRate:8}).price,106/1.02-3)
  assert.ok(Math.abs(hpBondYield({...p,price:106/1.02-3}).yieldRate-8)<1e-10)
  assert.throws(()=>hpBondPrice({...p,yieldRate:8,settlement:'2024-02-30'}),{code:8})
})
test('HP guide §4 DB official example; SL and SOYD derived from Appendix D', () => {
  const p={pv:10000,fv:500,n:5,i:200}
  for(const [year,dep,rem] of [[1,4000,5500],[2,2400,3100],[3,1440,1660]]){
    const out=hpDepreciation({...p,year,method:'DB'})
    assert.equal(cents(out.depreciation),dep)
    assert.equal(cents(out.remaining),rem)
  }
  assert.deepEqual(hpDepreciation({...p,year:2,method:'SL'}),{depreciation:1900,remaining:5700})
  assert.equal(cents(hpDepreciation({...p,year:1,method:'SOYD'}).depreciation),3166.67)
})
test('zero coupon at par, 40-year roundtrip', () => {
  const d = { coupon: 0, settlement: '2000-02-01', maturity: '2040-02-01' }
  assert.equal(hpBondPrice({...d,yieldRate:0}).price,100)
  assert.equal(hpBondYield({...d,price:100}).yieldRate,0)
})
test('reject nonfinite public results and invalid HP coupon dates', () => {
  const d={coupon:0,settlement:'2024-04-01',maturity:'2024-07-01'}
  assert.throws(()=>hpBondYield({...d,price:Number.MIN_VALUE}),{code:5})
  assert.throws(()=>hpSimpleInterest({pv:1e308,i:1e308,n:1e308}),{code:0})
  assert.throws(()=>hpAmort({pv:1e308,pmt:1e308,i:1e308,count:1}),{code:0})
  assert.throws(()=>hpBondYield({...d,maturity:'2025-12-31',price:100}),{code:8})
})
test('Appendix D literal DB leaves residual separate from book balance', () => {
  // Derived, not an HP physical fixture: 1000 × 0.5 = 500; remaining depreciable = 500 − 900.
  assert.deepEqual(hpDepreciation({method:'DB',pv:1000,fv:900,n:2,i:100,year:1}),
    {depreciation:500,remaining:-400})
})

test('500 calendar years allowed, 500 years and a day rejected', () => {
  const q={coupon:0,yieldRate:0,settlement:'1900-01-01'}
  assert.equal(hpBondPrice({...q,maturity:'2400-01-01'}).price,100)
  assert.throws(()=>hpBondPrice({...q,maturity:'2400-01-02'}),{code:8})
  assert.throws(()=>hpBondYield({...q,maturity:'2400-01-02',price:100}),{code:8})
})
test('YTM rejects an output numerically on the open PRICE bound', () => {
  const q={coupon:0,settlement:'2024-01-01',maturity:'2024-07-01'}
  assert.throws(()=>hpBondYield({...q,price:1e100}),{code:5})
  assert.throws(()=>hpBondPrice({...q,yieldRate:-200}),{code:5})
})
