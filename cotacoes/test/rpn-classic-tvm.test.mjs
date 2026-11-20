import test from 'node:test'
import assert from 'node:assert/strict'
import {solveClassicTvm as tvm} from '../src/rpnClassicTvm.mjs'
import {createClassicRpnController} from '../src/rpnClassicController.mjs'
const near=(a,b,t=1e-8)=>assert.ok(Math.abs(a-b)<t,a+' vs '+b)
const input=(c,text,key)=>{for(const k of String(Math.abs(text))) c.press(k==='.'?'decimal':k);if(text<0)c.press('chs');if(key)c.press(key)}
const run=(c,...keys)=>keys.forEach(k=>c.press(k))
test('HP p.40: n=328 with no rewrite to PMT; fractional portion below 0.005 rounds down',()=>{
 const data={pv:35000,i:10.5/12,pmt:-325,fv:0}
 assert.equal(tvm('n',data),328)
 assert.equal(tvm('n',{pv:100.019,i:0,pmt:-10,fv:0}),10)
 assert.equal(tvm('n',{pv:100.051,i:0,pmt:-10,fv:0}),11)
 const c=createClassicRpnController()
 input(c,10.5);run(c,'g','i');input(c,35000,'pv');input(c,-325,'pmt');run(c,'g','8','n')
 assert.equal(c.snapshot().display,'328,00')
 assert.equal(c.snapshot().finance.pmt,-325)
})
test('HP pp.52–53: compounded odd first period PMT; simple mode i; PV/FV inverses',()=>{
 const data={n:36+16/30,i:1.25,pv:4500,fv:0}
 const pmt=tvm('pmt',data,{compound:true})
 assert.equal(pmt.toFixed(2),'-157.03')
 for(const compound of [true,false]){
  const set={...data,pmt:tvm('pmt',data,{compound})}
  near(tvm('pv',set,{compound}),4500)
  near(tvm('fv',set,{compound}),0)
  near(tvm('i',set,{compound}),1.25,1e-7)
 }
 assert.equal(tvm('i',{n:42+13/30,pv:3950,pmt:-120,fv:0}).toFixed(2),'1.16')
})
test('STO EEX toggles C; official dates establish fractional n through keypad',()=>{
 const c=createClassicRpnController()
 run(c,'g','5','g','8','sto','eex')
 assert.equal(c.snapshot().indicators.compound,true)
 input(c,2.152004,'enter');input(c,3.012004);run(c,'g','eex','swap')
 assert.equal(c.snapshot().x,16)
 input(c,30,'divide');input(c,36,'add');run(c,'n')
 input(c,15);run(c,'g','i');input(c,4500,'pv');run(c,'pmt')
 assert.equal(c.snapshot().display,'-157,03')
 run(c,'sto','eex');assert.equal(c.snapshot().indicators.compound,false)
})
