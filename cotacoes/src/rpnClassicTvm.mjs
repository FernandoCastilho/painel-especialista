// Compatibility adapter for the classic keypad only. The existing motor remains unchanged.
// HP 12c User's Guide pp. 40–41, 50–53 and Appendix D.
import { solveTvm } from './rpnEngine.mjs'
const fields=['n','i','pv','pmt','fv']
const limit=10_000
const fail=message=>{ throw new RangeError(message) }
const finite=x=>Number.isFinite(x)?(Object.is(x,-0)?0:x):fail('Resultado fora do domínio numérico.')
const rate=i=>i>-100&&Number.isFinite(i)?i/100:fail('A taxa por período precisa ser maior que −100%.')
const annuity=(n,r,begin)=>r===0?n:-Math.expm1(-n*Math.log1p(r))/r*(begin?1+r:1)
const accrual=(f,r,c)=>c?Math.exp(f*Math.log1p(r)):1+f*r

function classicTerm({i,pv,pmt,fv}, begin) {
  const r=rate(i)
  let n
  if(r===0) n=pmt===0?NaN:-(pv+fv)/pmt
  else {
    const adjusted=pmt*(begin?1+r:1)/r
    n=-Math.log1p(-(pv+fv)/(fv-adjusted))/Math.log1p(r)
  }
  if(!(n>0&&n<=limit))return fail('Prazo inexistente ou fora do intervalo.')
  const low=Math.floor(n)
  const rounded=n-low<.005?low:low+1
  if(rounded===0)return fail('Prazo calculado inferior ao mínimo suportado.')
  return rounded
}

function oddRate({pv,pmt,fv}, n, fraction, begin, compound) {
  // Normaliza para evitar estouro e exige perfil de sinais monotônico. Fora dele, não escolhe raiz em silêncio.
  if(!pv||(!pmt&&!fv)||[pmt,fv].some(x=>x&&Math.sign(x)===Math.sign(pv))) return fail('Taxa no período irregular exige fluxos de sentidos opostos sem ambiguidade.')
  const scale=Math.max(Math.abs(pv),Math.abs(pmt),Math.abs(fv))
  const x=pv/scale,p=pmt/scale,f=fv/scale
  function valueAt(y) {
    const r=Math.expm1(y), fractionFactor=accrual(fraction,r,compound)
    if(r<0) return x*fractionFactor*Math.exp(n*y)+p*(begin?1+r:1)*Math.expm1(n*y)/r+f
    return x*fractionFactor+p*annuity(n,r,begin)+f*Math.exp(-n*y)
  }
  let lo=-30,hi=30,first=valueAt(lo)
  if(!Number.isFinite(first)||Math.sign(first)===Math.sign(valueAt(hi)))return fail('Não foi possível validar a taxa no intervalo.')
  let mid
  for(let iter=0;iter<115;iter++){
    mid=lo+(hi-lo)/2
    const value=valueAt(mid)
    if(Math.abs(value)<=1e-13||mid===lo||mid===hi)break
    if(Math.sign(value)===Math.sign(first)){lo=mid;first=value}else hi=mid
  }
  if(Math.abs(valueAt(mid))>1e-9)return fail('Não foi possível validar a taxa.')
  return finite(100*Math.expm1(mid))
}

export function solveClassicTvm(field, values, {begin=false, compound=false}={}) {
  if(!fields.includes(field)||fields.some(key=>key!==field&&!Number.isFinite(values[key])))return fail('Registradores financeiros inválidos.')
  if(field==='n')return classicTerm(values,begin)
  const {n,i,pv,pmt,fv}=values
  if(!(n>=1&&n<=limit))return fail('Informe de 1 a 10.000 períodos.')
  const whole=Math.floor(n), fraction=n-whole, timing=begin?'begin':'end'
  if(!fraction)return solveTvm(field,values,timing)
  if(field==='i')return oddRate(values,whole,fraction,begin,compound)
  const factor=accrual(fraction,rate(i),compound)
  const adjusted={...values,n:whole,pv:field==='pv'?0:finite(pv*factor)}
  const solved=solveTvm(field,adjusted,timing)
  return field==='pv'?finite(solved/factor):solved
}
