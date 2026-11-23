import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMa, filterMa, summarizeMa, readMaRoute, maRoute, maBubbleRadius } from '../src/ma.js'

const record = (id, props = {}) => ({ id, buyer:'Compradora', target:'Clínica Aurora', seller:null, sector:'Saúde', sectorId:'saude', sectorRoute:'pasta/saude', segment:'Clínicas', announcementDate:'2025-12-18', publicationDate:'2025-12-19', completionDate:null, updatedDate:'2026-01-19', dateBasis:'announcement', status:'Anunciada', value:null, currency:null, stake:null, uf:'SP', locationNote:'São Paulo, segundo a fonte', summary:'Aquisição anunciada.', sourceUrl:'https://fusoesaquisicoes.com/acontece-no-setor/negocio/', history:[{date:'2025-12-19', text:'Operação anunciada, segundo a fonte.'}], ...props })
const rows = [record('a'), record('b',{uf:null,sector:'Tecnologia',sectorId:'tic',announcementDate:null,dateBasis:'publication'}), record('c',{announcementDate:'2026-01-10',publicationDate:'2026-01-11', uf:'MG'})]

test('M&A: publicação e atualização não alteram o ano de anúncio', () => {
  assert.deepEqual(filterMa(rows,{year:'2025'}).map(x=>x.id),['b','a'])
  assert.deepEqual(filterMa(rows,{year:'2026'}).map(x=>x.id),['c'])
  assert.equal(filterMa(rows,{year:'2024'}).length,0)
})
test('M&A: filtros combinados, busca sem acento e vendedor', () => {
  assert.deepEqual(filterMa(rows,{year:'2025',uf:'SP',sector:'saude',query:'clinica'}).map(x=>x.id),['a'])
  assert.equal(filterMa(rows,{uf:'unknown'}).length,1)
  assert.equal(filterMa(rows,{status:'Concluída'}).length,0)
  assert.equal(filterMa([record('a',{seller:'Vendedora Ágil'})],{query:'agil'}).length,1)
})
test('M&A: total não perde UF ausente nem duplica operações', () => {
  const summary=summarizeMa(rows)
  assert.equal(summary.total,3)
  assert.equal(summary.located,2)
  assert.equal(summary.unknown,1)
  assert.equal(summary.states.length,2)
  assert.equal(summary.sectors.reduce((n,g)=>n+g.count,0),3)
  assert.equal(summary.states.reduce((n,g)=>n+g.count,0)+summary.unknown,3)
  assert.deepEqual(summarizeMa([]),{total:0,located:0,unknown:0,states:[],sectors:[]})
})
test('M&A: rejeita identidade repetida, data impossível, UF inválida e URL insegura', () => {
  assert.equal(validateMa(rows),true)
  for (const invalid of [[rows[0],rows[0]],[record('a',{uf:'XX'})],[record('a',{announcementDate:'2025-02-30'})],[record('a',{sourceUrl:'javascript:alert(1)'})],[record('a',{value:-1})],[record('a',{status:'Certa'})]]) assert.throws(()=>validateMa(invalid))
})
test('M&A: endereço preserva filtros e seleção ao voltar e abrir link direto', () => {
  const state={tab:'transacoes',year:'2025',month:'12',sector:'saude',uf:'SP',status:'Concluída',query:'São Domingos',selected:'dasa-hsd',page:2}
  assert.deepEqual(readMaRoute(maRoute(state)),state)
  assert.equal(readMaRoute('').tab,'visao-geral')
  assert.equal(readMaRoute('transacoes?year=banana&page=-3').page,1)
  assert.equal(readMaRoute('transacoes?year=banana').year,'')
})
test('M&A: área da bolha é proporcional à quantidade sem distorção por raio mínimo',()=>{
  const one=maBubbleRadius(1,4),four=maBubbleRadius(4,4)
  assert.equal((one*one)/(four*four),.25)
  assert.equal(maBubbleRadius(0,4),0)
})
