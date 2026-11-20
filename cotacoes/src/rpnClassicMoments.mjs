// Exact dyadic moments from IEEE-754 inputs. R1–R6 still expose numbers, but
// differences of large, nearly equal moments are taken before rounding.
const bits = new DataView(new ArrayBuffer(8))
const zero=[0n,0]
export function exact(value) {
  if(value===0)return zero
  bits.setFloat64(0,value,false)
  const b=bits.getBigUint64(0,false), exp=Number((b>>52n)&2047n)
  const mantissa=(b&((1n<<52n)-1n))+(exp===0?0n:1n<<52n)
  return [b>>63n?-mantissa:mantissa,(exp===0?1:exp)-1075]
}
export function plus([a,e],[b,f]) {
  const min=Math.min(e,f)
  return [(a<<BigInt(e-min))+(b<<BigInt(f-min)),min]
}
export const minus=(a,[b,e])=>plus(a,[-b,e])
export const times=([a,e],[b,f])=>[a*b,e+f]
export function number([a,e]) {
  if(a===0n)return 0
  const magnitude=a<0n?-a:a
  const shift=Math.max(0,magnitude.toString(2).length-53)
  let rounded=magnitude>>BigInt(shift)
  if(shift){
    const half=1n<<BigInt(shift-1)
    const tail=magnitude-(rounded<<BigInt(shift))
    if(tail>half||(tail===half&&rounded%2n))rounded++
  }
  const scale=e+shift
  const value=scale < -1022 ? Number(rounded)*2**(scale+1022)*2**-1022 : Number(rounded)*2**scale
  return a<0n?-value:value
}
