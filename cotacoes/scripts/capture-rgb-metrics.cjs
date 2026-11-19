// Mesmo gate RGB: distância <45, sem tolerância espacial.
module.exports = function compare({got,want,width,height,regions}) {
  return regions.map(r=>{
    let error=0,n=0;const colors=new Set(), histogram=new Map(), samples=[]
    // Identifica fundo dominante da região; exige coincidência nos traços/texto,
    // para que um PNG de fundo sólido não passe pela média de pixels.

    for(let y=Math.max(0,Math.ceil(r.y));y<Math.min(height,r.y+r.h);y++)
     for(let x=Math.max(0,Math.ceil(r.x));x<Math.min(width,r.x+r.w);x++){
      const i=(y*width+x)*4
      const key=[want[i]>>4,want[i+1]>>4,want[i+2]>>4].join(',')
      colors.add(key);histogram.set(key,(histogram.get(key)||0)+1);samples.push(i)
      for(let c=0;c<3;c++){error+=Math.abs(got[i+c]-want[i+c])/255;n++}
     }
    const dominant=[...histogram].sort((a,b)=>b[1]-a[1])[0][0].split(',').map(v=>Number(v)*16+8)
    let ink=0,matched=0
    for(const i of samples){
      if(r.color ? Math.max(...r.color.map((v,c)=>Math.abs(want[i+c]-v)))>=45 : Math.max(...dominant.map((v,c)=>Math.abs(want[i+c]-v)))<45)continue
      ink++
      if(Math.max(...dominant.map((_,c)=>Math.abs(want[i+c]-got[i+c])))<45)matched++
    }
    return {selector:r.selector,meanError:error/n,referenceColors:colors.size,samples:n,ink,inkRecall:ink?matched/ink:0}
  })
}
