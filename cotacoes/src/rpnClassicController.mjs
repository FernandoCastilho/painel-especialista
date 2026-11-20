import { calcNpv, calcIrr } from './rpnEngine.mjs'
import { solveClassicTvm } from './rpnClassicTvm.mjs'
import {exact,plus,minus,times,number as approximate} from './rpnClassicMoments.mjs'
import { hpAmort, hpSimpleInterest, hpBondPrice, hpBondYield, hpDepreciation } from './rpnClassicFinancial.mjs'

export const CLASSIC_KEYS = Object.freeze([
  'n','i','pv','pmt','fv','chs','7','8','9','divide',
  'power','reciprocal','pctTotal','pctDiff','percent','eex','4','5','6','multiply',
  'runStop','sst','roll','swap','clx','enter','1','2','3','subtract',
  'on','f','g','sto','rcl','0','decimal','sum','add',
])
const keyCode=Object.freeze({
 n:'11',i:'12',pv:'13',pmt:'14',fv:'15',chs:'16',divide:'10',
 power:'21',reciprocal:'22',pctTotal:'23',pctDiff:'24',percent:'25',eex:'26',multiply:'20',
 runStop:'31',sst:'32',roll:'33',swap:'34',clx:'35',enter:'36',subtract:'30',
 on:'41',f:'42',g:'43',sto:'44',rcl:'45',decimal:'48',sum:'49',add:'40',
})
const indent=n=>String(n).padStart(2,'0')
const financial = ['n','i','pv','pmt','fv']
const arithmetic = { add:(y,x)=>y+x, subtract:(y,x)=>y-x, multiply:(y,x)=>y*x, divide:(y,x)=>y/x }
const fOps = { n:'amort', i:'int', pv:'npv', pmt:'rnd', fv:'irr', power:'price', reciprocal:'ytm',
  pctTotal:'sl', pctDiff:'soyd', percent:'db', runStop:'program', sst:'clearStats', roll:'clearProgram',
  swap:'clearFinance', clx:'clearRegisters', enter:'prefix' }
const gOps = { n:'months', i:'monthlyRate', pv:'cf0', pmt:'cfj', fv:'nj', chs:'date',
  power:'sqrt', reciprocal:'exp', pctTotal:'ln', pctDiff:'frac', percent:'integer',
  '7':'begin','8':'end','9':'mem','4':'dmy','5':'mdy','6':'weighted',eex:'days',
  runStop:'pause',sst:'backStep',roll:'goto',swap:'xleY',clx:'xeq0',enter:'last',
  '0':'mean',decimal:'stdev',sum:'removeStats','1':'linearX','2':'linearY','3':'factorial',
}
const finite = (x) => {
  if (!Number.isFinite(x)) throw Error('Resultado fora do domínio numérico.')
  return Object.is(x,-0) ? 0 : x
}
const raise = (message) => { throw Error(message) }
const toBrazil = (v, places, scientific) => new Intl.NumberFormat('pt-BR', scientific ?
  {notation:'scientific', minimumFractionDigits:places, maximumFractionDigits:places} :
  {minimumFractionDigits:places, maximumFractionDigits:places}).format(v)
const isDigit = key => /^[0-9]$/.test(key)
const emptyFinance = () => Object.fromEntries(financial.map(key=>[key,0]))
const dayMs = 86400000
const minDate=Date.UTC(1582,9,15), maxDate=Date.UTC(4046,10,25)
const validDate=d=>+d>=minDate&&+d<=maxDate

function readDate(x, dmy) {
  if (!(x > 0) || x >= 100) return raise('Data inválida.')
  const [head, tail] = x.toFixed(6).split('.')
  const first = +head, second = +tail.slice(0,2), year = +tail.slice(2)
  const month = dmy ? second : first, day = dmy ? first : second
  if (year < 1582 || year > 4046 || month < 1 || month > 12 || day < 1 || day > 31) return raise('Data inválida.')
  const stamp = Date.UTC(year,month-1,day), date=new Date(stamp)
  if (!validDate(date) || date.getUTCMonth()+1 !== month || date.getUTCDate() !== day) return raise('Data inválida.')
  return date
}
function writeDate(date, dmy) {
  const yr=date.getUTCFullYear(), mo=date.getUTCMonth()+1, dia=date.getUTCDate()
  if (!validDate(date)) return raise('Data fora do intervalo.')
  const first=dmy?dia:mo, second=dmy?mo:dia
  return first + (second*10000+yr)/1e6
}

export function createClassicRpnController({ schedule = globalThis.setTimeout, cancelScheduled = globalThis.clearTimeout } = {}) {
  let stack=[0,0,0,0], last=0, entry=null, lift=false, tvmArmed=false, shift=null
  let memory=null, memoryDot=false, memoryOperation=null, places=2, sci=false, prefixDisplay=false, begin=false, compound=false, dmy=false
  let dateView=null, auxiliaryView=null, pauseTimer=null, paused=false, remainingSteps=1000
  const subscribers=new Set()
  let on=true, program=false, programMemory=[], pc=0, jumpDigits=null, running=false, message='', finance=emptyFinance(), cashLength=0, repetitions=[]
  function push(x) { stack=[x,stack[0],stack[1],stack[2]] }
  function put(x) {
    const next=finite(x)
    if (lift) push(next)
    else stack[0]=next
    entry=null
    lift=true
  }
  function unary(fn) {
    const x=stack[0], out=finite(fn(x))
    stack[0]=out; entry=null; last=x; lift=true
  }
  function binary(fn) {
    const [x,y,z,t]=stack, out=finite(fn(y,x))
    stack=[out,z,t,t]; entry=null; last=x; lift=true
  }
  function startEntry() {
    if (entry!==null) return
    if (lift) push(0)
    else stack[0]=0
    entry='0'
  }
  function refreshEntry() {
    const value=Number(entry)
    if (Number.isFinite(value)) stack[0]=value
  }
  function enterDigit(key) {
    startEntry()
    if (entry.includes('e')) {
      if (entry.split('e')[1].replace('-','').length>=2) return
    } else if (entry.replace(/[^0-9]/g,'').length>=10) return
    entry=entry==='0'?key:entry==='-0'?'-'+key:entry+key
    refreshEntry()
  }
  function shifted(layer,key) {
    if (layer==='f' && isDigit(key)) return 'fix:'+key
    if (layer==='f' && key==='decimal') return 'sci'
    return (layer==='f'?fOps:gOps)[key] ?? null
  }
  function isSupported(key,layer=shift) {
    if (key==='cancel') return true
    if (key==='backspace') return on&&!program
    if (!CLASSIC_KEYS.includes(key)) return false
    if (key==='on') return true
    if (!on) return false
    if (key==='f'||key==='g') return true
    if (layer==null || (memory && (isDigit(key)||financial.includes(key)||key==='decimal'))) return true
    const id=shifted(layer,key)
    return id!==null
  }
  function snapshot() {
    const number=stack[0]
    const screen=entry!==null?entry.replace('.',','):toBrazil(number,places,sci||Math.abs(number)>=1e10||(number!==0&&Math.abs(number)<1e-9))
    return { display:!on?'':auxiliaryView??(program?programDisplay():dateView??screen),
      message, x:number, stack:[...stack], shift, begin, program, pc,
      indicators:{begin,compound,program,on,dmy,running:running||paused,paused}, memory:{programLines:programCapacity(),registers:dataCapacity()}, finance:{...finance}, registers:{...registers}, cashFlows:flowList(Math.min(cashLength-1,dataCapacity())) }
  }
  function setDisplay(value) {
    message='';dateView=null;auxiliaryView=null
    try { if (on && !program && !paused && typeof value==='number') {stack[0]=finite(value); entry=null; lift=false; tvmArmed=false; shift=null; memory=null; jumpDigits=null} else raise('Não foi possível usar esse valor no visor.') }
    catch (e) { message=e.message }
    return snapshot()
  }
  function financeKey(key) {
    if (tvmArmed) {
      const value=solveClassicTvm(key,finance,{begin,compound})
      finance[key]=value
      stack=[value,stack[1],stack[2],stack[3]]; lift=true
    } else {
      finance[key]=stack[0]; lift=false
    }
    tvmArmed=true; entry=null
  }
  function memoryAccess(key) {
    if(memory==='sto'&&key==='eex'&&!memoryDot&&!memoryOperation){
      memory=null
      if(running)return raise('O seletor C não é programável.')
      compound=!compound;entry=null;return true
    }
    if (key==='decimal' && !memoryDot) { memoryDot=true; return true }
    if (memory==='sto'&&Object.hasOwn(arithmetic,key)&&!memoryOperation&&!memoryDot) {memoryOperation=key; return true}
    const id=isDigit(key)?String(+key+(memoryDot?10:0)):!memoryDot&&financial.includes(key)?key:null
    if (id===null) { memory=null; return raise('Selecione um registrador com STO ou RCL.') }
    const isFinancial=financial.includes(id)
    if(memoryOperation&&(isFinancial||+id>4)){memory=null;return raise('A aritmética de STO aceita somente R0 a R4.')}
    if(!isFinancial&&+id>=dataCapacity()){memory=null;return raise('Registrador alocado à memória de programa.')}
    const target=isFinancial?finance:registers
    if (memory==='rcl') { entry=null; lift=true; put(target[id]??0); tvmArmed=false }
    else {
      try {
        const value=memoryOperation?finite(arithmetic[memoryOperation](target[id]??0,stack[0])):stack[0]
        if(isFinancial)target[id]=value
        else putRegister(id,value)
      }
      finally { memory=null }
      entry=null; lift=false
    }
    memory=null; return true
  }
  let registers={}, moments={}, gotoPosition=false, programPrefix=null, programAllocated=8
  const programCapacity=()=>programAllocated
  function putRegister(id,value,precision=exact(value)){
    registers[id]=value
    if(+id>=1&&+id<=6)moments[id]=precision
  }
  function truncateFlow(index){
    if(cashLength<=index)return
    cashLength=index
    repetitions.length=index
    message='A memória do programa liberou ou ocupou um registrador de fluxo. Confira n e informe novamente os valores afetados.'
  }
  const dataCapacity=()=>20-(programAllocated-8)/7
  function programDisplay() {
    const ins=programMemory[pc-1]??['jump','00']
    const rendered=ins[0]==='jump'?['43','33',ins[1]]:ins.map(k=>isDigit(k)?k:keyCode[k])
    return indent(pc)+'-'+(pc?' '+rendered.join(' '):'')
  }
  function flowAt(index){
    return index===dataCapacity()?finance.fv:(registers[String(index)]??0)
  }
  function flowList(lastIndex){
    return Array.from({length:Math.max(0,lastIndex+1)},(_,j)=>Array(repetitions[j]).fill(flowAt(j))).flat()
  }
  function flowIndex(minimum){
    const j=finance.n
    if(!Number.isInteger(j)||j<minimum||j>=cashLength||j>dataCapacity())return raise('Informe em n o número do fluxo cadastrado.')
    return j
  }
  function pauseProgram() {
    paused=true
    pauseTimer=schedule(()=>{
      pauseTimer=null;paused=false;message='';dateView=null;auxiliaryView=null
      try { runFromStep(false,true) } catch (e) { message=e.message }
      notify()
    },1000)
  }
  function notify() { for (const fn of subscribers) fn(snapshot()) }
  function subscribe(fn) {
    subscribers.add(fn)
    return ()=>subscribers.delete(fn)
  }
  function stopPause() {
    if(pauseTimer!==null)cancelScheduled(pauseTimer)
    pauseTimer=null;paused=false
  }
  function dispose() { stopPause(); subscribers.clear() }
  function runFromStep(single=false, resume=false) {
    if (running||!programMemory.length) return
    if(!resume)remainingSteps=1000
    running=true
    try {
      while (remainingSteps-->0) {
        if (pc>=programCapacity()) {pc=0;return}
        const instr=programMemory[pc++]??['jump','00']
        if (instr[0]==='jump') {
          const target=+instr[1]
          if(target===0){pc=0;return}
          if(target>programCapacity())return raise('Linha inexistente.')
          pc=target-1
          if(single)return
          continue
        }
        if (instr.length===1&&instr[0]==='runStop') return
        if (instr[0]==='g'&&instr[1]==='runStop') {
          if(single)return
          pauseProgram();return
        }
        for (const key of instr) dispatch(key)
        if (single) return
        if(instr[0]==='g'&&instr[1]==='chs') { pauseProgram();return }
      }
      raise('Programa interrompido após 1.000 instruções.')
    } finally { running=false }
  }
  const record = instruction => {
    if (pc>=99) return raise('Memória do programa cheia.')
    if(pc===programCapacity()){
      const register=dataCapacity()-1
      if(register<0)return raise('Memória do programa cheia.')
      truncateFlow(register)
      delete registers[String(register)]
      programAllocated+=7
    }
    programMemory[pc++]=instruction
  }
  function layerAction(op) {
    if (op.startsWith('fix:')) {places=+op.slice(4); sci=false; entry=null; return}
    if (op==='sci') {sci=true;entry=null;return}
    if (op==='program') {program=!program;if(!program)pc=0;entry=null;programPrefix=null;return}
    if (op==='clearProgram') {if (program){if(programAllocated!==8)truncateFlow(dataCapacity());programMemory=[];programAllocated=8}pc=0;programPrefix=null;return}
    if (op==='pause') {message='PSE faz uma pausa de um segundo dentro de um programa.';return}
    if (op==='backStep') {pc=pc===0&&program?programCapacity():Math.max(0,pc-1);return}
    if (op==='prefix') {prefixDisplay=true;return}
    if (op==='goto') {jumpDigits='';gotoPosition=!program;return}
    if (op==='xleY'||op==='xeq0') { if(running&&(op==='xleY'?stack[0]>stack[1]:stack[0]!==0))pc++;return }
    if (op==='begin'||op==='end') {begin=op==='begin';entry=null;return}
    if (op==='dmy'||op==='mdy') {dmy=op==='dmy';entry=null;return}
    if (op==='mem') {auxiliaryView='P-'+indent(programCapacity())+' r-'+indent(dataCapacity());return}
    if (op==='last') {put(last);return}
    if (op==='rnd') {unary(x=>Number(x.toFixed(places)));return}
    if (op==='clearFinance'||op==='clearRegisters') {
      finance=emptyFinance();entry=null
      if(op==='clearRegisters'){registers={};moments={};cashLength=0;repetitions=[];stack=[0,0,0,0];last=0;lift=false}
      return
    }
    if (op==='months'||op==='monthlyRate') {
      const key=op==='months'?'n':'i', val=finite(op==='months'?stack[0]*12:stack[0]/12)
      stack[0]=val; finance[key]=val; entry=null; lift=false; tvmArmed=true; return
    }
    if (op==='cf0'||op==='cfj') {
      const j=op==='cf0'?0:flowIndex(0)+1
      if(j>dataCapacity())return raise('São aceitos CF₀ e mais '+dataCapacity()+' valores de fluxo.')
      if(j===0){cashLength=0;repetitions=[]}
      if(j===dataCapacity())finance.fv=stack[0]
      else putRegister(String(j),stack[0])
      repetitions[j]=1;cashLength=Math.max(cashLength,j+1);finance.n=j;entry=null;lift=false;return
    }
    if(op==='nj') {
      const count=stack[0], j=flowIndex(1)
      if(!Number.isInteger(count)||count<1||count>99) return raise('Informe de 1 a 99 repetições para CFj.')
      repetitions[j]=count;entry=null;lift=false;return
    }
    if(op==='npv'||op==='irr') {
      const flows=flowList(flowIndex(1))
      const x=op==='npv'?calcNpv(flows,finance.i):calcIrr(flows)
      stack=[x,stack[1],stack[2],stack[3]];finance[op==='npv'?'pv':'i']=x;entry=null;lift=true;return
    }
    if(op==='date') {
      const days=stack[0], date=readDate(stack[1],dmy)
      if(!Number.isInteger(days)||Math.abs(days)>4000000)return raise('Informe um número inteiro de dias.')
      const future=new Date(date.getTime()+days*dayMs), value=writeDate(future,dmy)
      binary(()=>value)
      const [year,month,day]=future.toISOString().slice(0,10).split('-')
      dateView=[...(dmy?[day,month]:[month,day]),year].join(',')+' '+(future.getUTCDay()||7)
      return
    }
    if(op==='days') {
      const start=readDate(stack[1],dmy), end=readDate(stack[0],dmy)
      const d1=Math.min(start.getUTCDate(),30), d2=d1===30?Math.min(end.getUTCDate(),30):end.getUTCDate()
      const basis30=360*(end.getUTCFullYear()-start.getUTCFullYear())+30*(end.getUTCMonth()-start.getUTCMonth())+d2-d1
      stack=[(end-start)/dayMs,basis30,stack[2],stack[3]];entry=null;lift=true;return
    }
    if(op==='amort') {
      const x=hpAmort({ ...finance, count:stack[0], begin, decimals:places })
      stack=[finite(x.interest),finite(x.principal),x.count,stack[1]]
      finance.pv=x.pv; finance.n=x.n; entry=null; lift=true; return
    }
    if(op==='int') {
      const x=hpSimpleInterest(finance)
      stack=[finite(x.interest360),finite(x.principal),finite(x.interest365),stack[0]]
      entry=null;lift=true;return
    }
    if(op==='price'||op==='ytm') {
      const [m,s,z]=stack
      const opts={ settlement:readDate(s,dmy).toISOString().slice(0,10), maturity:readDate(m,dmy).toISOString().slice(0,10), coupon:finance.pmt, yieldRate:finance.i, price:finance.pv }
      if(op==='price'){
        const x=hpBondPrice(opts);stack=[finite(x.price),finite(x.accrued),m,s];finance.pv=x.price
      } else {
        const x=hpBondYield(opts);stack=[finite(x.yieldRate),m,s,z];finance.i=x.yieldRate
      }
      entry=null;lift=true;return
    }
    if(['sl','soyd','db'].includes(op)) {
      const x=hpDepreciation({ ...finance, method:op.toUpperCase(), year:stack[0] })
      stack=[finite(x.depreciation),finite(x.remaining),stack[0],stack[1]]
      entry=null;lift=true;return
    }
    if(['mean','stdev','weighted','linearX','linearY'].includes(op)) {
      const [n,sx,,sy,,sxy]=[1,2,3,4,5,6].map(i=>registers[i]??0)
      if(op==='weighted'){if(sx===0)return raise('Soma de pesos igual a zero.');unary(()=>sxy/sx);return}
      if(!(n>=(op==='mean'?1:2)))return raise('Dados estatísticos insuficientes.')
      const avgX=sx/n,avgY=sy/n
      if(op==='mean'){stack=[finite(avgX),finite(avgY),stack[2],stack[3]];entry=null;lift=true;return}
      const [en,ex,exx,ey,eyy,exy]=[1,2,3,4,5,6].map(i=>moments[i]??exact(0))
      const centered=(q,a,b)=>approximate(minus(times(en,q),times(a,b)))/n
      const vx=centered(exx,ex,ex),vy=centered(eyy,ey,ey),cv=centered(exy,ex,ey)
      if(op==='stdev'){
        stack=[finite(Math.sqrt(vx/(n-1))),finite(Math.sqrt(vy/(n-1))),stack[2],stack[3]]
        entry=null;lift=true;return
      }
      if(!(vx>0&&vy>0))return raise('A regressão precisa de variação nos dois conjuntos.')
      const slope=cv/vx
      if(op==='linearX'&&slope===0)return raise('A reta horizontal não permite estimar x.')
      const estimate=finite(op==='linearX'?avgX+(stack[0]-avgY)/slope:avgY+slope*(stack[0]-avgX))
      stack=[estimate,finite(cv/Math.sqrt(vx)/Math.sqrt(vy)),stack[2],stack[3]]
      entry=null;lift=true;return
    }
    if(op==='clearStats'){
      for(let i=1;i<=6;i++)putRegister(i,0)
      stack=[0,0,0,0];entry=null;lift=false;return
    }
    if(op==='removeStats'){sumStats(true);return}
    if(op==='factorial') {
      const x=stack[0]
      if(!Number.isInteger(x)||x<0||x>69)return raise('Fatorial exige um inteiro de 0 a 69.')
      unary(n=>{let y=1;for(let k=2;k<=n;k++)y*=k;return y});return
    }
    if(op==='sqrt'||op==='exp'||op==='ln'||op==='integer'||op==='frac') {
      unary(({sqrt:Math.sqrt,exp:Math.exp,ln:Math.log,integer:Math.trunc,frac:x=>x-Math.trunc(x)})[op]);return
    }
    raise('Função ainda não homologada neste modelo.')
  }
  function sumStats(remove=false) {
    const [x,y]=stack, direction=remove?-1:1
    const ex=exact(x),ey=exact(y)
    const op=direction<0?minus:plus
    const next=[exact(1),ex,times(ex,ex),ey,times(ey,ey),times(ex,ey)]
      .map((value,index)=>op(moments[index+1]??exact(0),value))
    const rounded=next.map(value=>finite(approximate(value)))
    rounded.forEach((value,index)=>putRegister(index+1,value,next[index]))
    last=x;stack[0]=rounded[0];entry=null;lift=false
  }
  function dispatch(key) {
    if(key==='cancel'){shift=null;memory=null;jumpDigits=null;programPrefix=null;return}
    if(key==='backspace'){
      if(!on||program)return
      if(shift||memory||jumpDigits!==null){dispatch('cancel');return}
      if(entry!==null){
        entry=entry.slice(0,-1)
        if(!entry||entry==='-')entry='0'
        refreshEntry()
      }
      return
    }
    if(!CLASSIC_KEYS.includes(key))return raise('Tecla desconhecida.')
    if(key==='on'){on=!on;shift=null;memory=null;return}
    if(!on)return
    if(key==='f'||key==='g'){shift=shift===key?null:key;return}
    if(jumpDigits!==null) {
      if(key==='decimal'&&program&&jumpDigits===''){gotoPosition=true;return}
      if(!isDigit(key)){jumpDigits=null;return raise('Informe uma linha de programa com dois dígitos.')}
      jumpDigits+=key
      if(jumpDigits.length===2){
        const text=jumpDigits,next=+text
        jumpDigits=null
        if(program&&!gotoPosition)record(['jump',text])
        else {if(next>programCapacity())return raise('Linha inexistente.');pc=next}
      }
      return
    }
    const layer=shift, opcode=layer?shifted(layer,key):null
    shift=null
    if(layer&&!opcode)return raise('Função ainda não homologada neste modelo.')
    if(program&&!running && !['program','clearProgram','backStep','goto','mem'].includes(opcode)) {
      if(programPrefix){
        const prefix=programPrefix[0]
        if(prefix==='sto'&&key==='eex'&&!layer){programPrefix=null;return raise('O seletor C não é programável.')}
        if(!layer&&(key==='decimal'||(prefix==='sto'&&Object.hasOwn(arithmetic,key)))){
          if(programPrefix.length>1){programPrefix=null;return raise('Prefixo de memória inválido.')}
          programPrefix.push(key);return
        }
        const chunk=programPrefix;programPrefix=null
        if(layer==='g'&&prefix==='rcl'&&['cf0','cfj','nj'].includes(opcode)){record([...chunk,layer,key]);return}
        if(layer||(!isDigit(key)&&!financial.includes(key)))return raise('Selecione um registrador com STO ou RCL.')
        record([...chunk,key]);return
      }
      if(!layer&&key==='sst') {pc=pc>=programCapacity()?0:pc+1;return}
      if(!layer&&(key==='sto'||key==='rcl')){programPrefix=[key];return}
      record(layer?[layer,key]:[key]);return
    }
    if(layer==='g'&&memory==='rcl'&&['cf0','cfj','nj'].includes(opcode)){
      memory=null;tvmArmed=false
      const j=opcode==='cf0'?(cashLength?0:flowIndex(0)):flowIndex(0)
      lift=true;put(opcode==='nj'?repetitions[j]:flowAt(j))
      if(opcode==='cfj'&&j>0)finance.n=j-1
      return
    }
    if(layer){if(opcode!=='begin'&&opcode!=='end')tvmArmed=false;memory=null;layerAction(opcode);return}
    if(memory){memoryAccess(key);return}
    if(financial.includes(key)){financeKey(key);return}
    tvmArmed=false
    if(isDigit(key)){enterDigit(key);return}
    if(key==='decimal'){startEntry();if(!entry.includes('.')&&!entry.includes('e'))entry+='.';return}
    if(key==='eex'){if(entry===null){entry=String(stack[0]||1)}if(!entry.includes('e'))entry+='e';return}
    if(key==='chs'){
      if(entry!==null){
        if(entry.includes('e')){const [m,e]=entry.split('e');entry=m+'e'+(e.startsWith('-')?e.slice(1):'-'+e)}
        else entry=entry.startsWith('-')?entry.slice(1):'-'+entry
        refreshEntry()
      }else stack[0]=finite(-stack[0])
      return
    }
    if(Object.hasOwn(arithmetic,key)){binary(arithmetic[key]);return}
    if(key==='power'){binary((y,x)=>y**x);return}
    if(key==='reciprocal'){unary(x=>1/x);return}
    if(key==='percent'||key==='pctTotal'||key==='pctDiff'){
      const [x,y]=stack
      unary(()=>key==='percent'?y*(x/100):key==='pctTotal'?(x/y)*100:((x-y)/y)*100);return
    }
    if(key==='enter'){entry=null;push(stack[0]);lift=false;return}
    if(key==='clx'){entry=null;stack[0]=0;lift=false;return}
    if(key==='swap'){entry=null;[stack[0],stack[1]]=[stack[1],stack[0]];lift=true;return}
    if(key==='roll'){entry=null;stack=[stack[1],stack[2],stack[3],stack[0]];lift=true;return}
    if(key==='sto'||key==='rcl'){memory=key;memoryOperation=null;memoryDot=false;entry=null;return}
    if(key==='sum'){sumStats();return}
    if(key==='runStop'||key==='sst'){if(key==='runStop')entry=null;runFromStep(key==='sst');return}
  }
  function press(key) {
    message='';dateView=null;auxiliaryView=null
    try {
      if(paused){stopPause();message='Programa interrompido.'}
      else dispatch(key)
    }
    catch(e) {message=e.message}
    const view=snapshot()
    if(prefixDisplay){prefixDisplay=false;view.message=Number(stack[0]).toPrecision(10)}
    return view
  }
  return { press, snapshot, isSupported, setDisplay, subscribe, dispose }
}
