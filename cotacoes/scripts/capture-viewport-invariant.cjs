const assert=require('node:assert/strict')
function pngDimensions(bytes){
 assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],'PNG válido')
 assert.equal(bytes.toString('ascii',12,16),'IHDR','Cabeçalho IHDR')
 return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}
}
async function viewportInvariant(page,snapshot){
 const before=await snapshot()
 assert.equal(before.dpr,2,'DPR2 antes da referência')
 const png=await page.screenshot({type:'png',fullPage:false,scale:'device'})
 const after=await snapshot()
 // Retorna as evidências mesmo em caso de divergência; o chamador salva antes de exigir validade.
 const dimensions=pngDimensions(png)
 return {png,before,after,dimensions}
}
function validate({before,after,dimensions}){
 assert.deepEqual(after,before,'Screenshot alterou DPR, viewport, geometria, texto ou rolagem')
 assert.equal(after.dpr,2,'DPR2 após referência')
 assert.deepEqual(dimensions,{width:780,height:1900},'Viewport390x950 em DPR2, sem redimensionamento')
}
module.exports={viewportInvariant,validate,pngDimensions}
