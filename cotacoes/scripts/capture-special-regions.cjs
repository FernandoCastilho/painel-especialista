// Avaliado no DOM original pelo Playwright; sem ignorar regiões ausentes.
module.exports = function captureSpecialRegions(el) {
 const root=el.getBoundingClientRect(),line=el.querySelector('svg[role="img"] path.line'),value=el.querySelector('.pct')
 if(!line||!value)throw new Error('Diagnóstico incompleto: curva ou valor ausente.')
 const b=line.getBoundingClientRect(),rgb=getComputedStyle(line).stroke.match(/[\d.]+/g)?.slice(0,3).map(Number)
 if(!rgb||rgb.length!==3||rgb.some(v=>!Number.isFinite(v)))throw new Error('Diagnóstico incompleto: cor da curva não reconhecida.')
 const result=[{selector:'curva-sem-eixos',x:b.x-root.x-2,y:b.y-root.y-2,w:b.width+4,h:b.height+4,color:rgb}]
 for(const [name,pattern] of [['sinal',/[▲▼■]/],['digito',/\d/]]){
  // React pode renderizar símbolo, espaço e número em Text nodes distintos.
  const node=[...value.childNodes].find(n=>n.nodeType===3&&pattern.test(n.textContent))
  if(!node)throw new Error('Diagnóstico incompleto: glifo de '+name+' ausente.')
  const index=node.textContent.search(pattern)
  if(index<0||index>=node.textContent.length)throw new Error('Diagnóstico incompleto: índice inválido de '+name)
  const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+1)
  const rect=range.getBoundingClientRect()
  if(!(rect.width>0&&rect.height>0))throw new Error('Diagnóstico incompleto: glifo de '+name+' sem área visível.')
  result.push({selector:name,x:rect.x-root.x,y:rect.y-root.y,w:rect.width,h:rect.height})
 }
 return result
}
