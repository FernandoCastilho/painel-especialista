const assert=require('node:assert/strict')
async function snapshot(target){
 return target.evaluate(el=>{
  const box=n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,scrollTop:n.scrollTop,scrollLeft:n.scrollLeft,scrollHeight:n.scrollHeight,scrollWidth:n.scrollWidth}}
  return {dpr:devicePixelRatio,innerWidth,innerHeight,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},target:box(el),fixture:box(el.querySelector('#capture-scroll-fixture'))}
 })
}
async function stable(target){
 let last=null,count=0
 for(let attempt=0;attempt<60;attempt++){
  await target.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)))
  const current=await snapshot(target)
  count=JSON.stringify(last)===JSON.stringify(current)?count+1:0;last=current
  if(count>=3)return current
 }
 throw new Error('Geometria/rolagem não estabilizou em 60 frames')
}
function unchanged(before,after){assert.deepEqual(after,before,'Captura alterou geometria ou rolagem do DOM original')}
module.exports={snapshot,stable,unchanged}
