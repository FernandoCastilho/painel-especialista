import { useState } from 'react'
import { CUSTOS_BNDES, PRODUTOS_BNDES, CUSTOS_PREMISSAS_FONTE, custosPermitidos } from './bndesCustosPorProduto.js'
import './BndesCustosProdutos.css'

const dmy = iso => iso.split('-').reverse().join('/')
const GRUPOS = [['pre', 'Custo prefixado'], ['pos', 'Custo pós-fixado']]

// Premissas de custo: o que cada produto ou programa do BNDES aceita. Só consulta; não muda nenhuma conta.
export default function BndesCustosProdutos() {
  const [query, setQuery] = useState('')
  const [produtoId, setProdutoId] = useState(PRODUTOS_BNDES[0].id)
  const produto = PRODUTOS_BNDES.find(item => item.id === produtoId)
  const aceitos = custosPermitidos(produtoId)
  const recusados = CUSTOS_BNDES.filter(custo => !produto.custos.includes(custo.id))
  return <section className="bcp" aria-labelledby="bcp-title">
    <h3 id="bcp-title" className="cx-heading">Custos permitidos por produto</h3>
    <p className="status">Premissas da calculadora do BNDES, registradas em {dmy(CUSTOS_PREMISSAS_FONTE.registradoEm)}. Mostram qual custo financeiro cada linha aceita; o agente financeiro confirma as condições de cada operação.</p>
    <label className="bcp-search">Buscar produto ou programa<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    {query.trim() && <div className="bcp-search-results" aria-label="Produtos encontrados">{PRODUTOS_BNDES.filter(item => item.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase())).map(item => <button key={item.id} type="button" onClick={() => { setProdutoId(item.id); setQuery('') }}>{item.nome}</button>)}</div>}
    <div className="bcp-pick">
      <label htmlFor="bcp-produto">Produto ou programa</label>
      <select id="bcp-produto" value={produtoId} onChange={event => setProdutoId(event.target.value)}>
        {['Produto', 'Programa'].map(tipo => <optgroup key={tipo} label={tipo === 'Produto' ? 'Produtos' : 'Programas'}>{PRODUTOS_BNDES.filter(item => item.tipo === tipo).map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</optgroup>)}
      </select>
    </div>
    <div className="bcp-lists">
      <div>
        <h4>Pode usar</h4>
        <ul className="bcp-ok">{aceitos.map(custo => <li key={custo.id}><b>{custo.sigla}</b> <small>{custo.grupo === 'pre' ? 'prefixado' : 'pós-fixado'} · base {custo.base}</small><span>{custo.descricao}</span>{custo.soMpme && <em>Só MPME.</em>}{custo.foraDoItau && <em>Não disponível no Itaú.</em>}</li>)}</ul>
      </div>
      <div>
        <h4>Não pode usar</h4>
        <p className="bcp-no">{recusados.map(custo => custo.sigla).join(' · ')}</p>
      </div>
    </div>
    <details className="bcp-table">
      <summary>Tabela completa</summary>
      <div className="bcp-scroll" tabIndex={0} role="region" aria-label="Tabela de custos por produto">
        <table>
          <caption className="sr-only">Custos financeiros aceitos por produto ou programa do BNDES. Sim = pode usar.</caption>
          <thead>
            <tr><th rowSpan={2} scope="col">Produto ou programa</th>{GRUPOS.map(([grupo, rotulo]) => <th key={grupo} scope="colgroup" colSpan={CUSTOS_BNDES.filter(c => c.grupo === grupo).length}>{rotulo}</th>)}</tr>
            <tr>{CUSTOS_BNDES.map(custo => <th key={custo.id} scope="col">{custo.sigla}</th>)}</tr>
          </thead>
          <tbody>{PRODUTOS_BNDES.map(item => <tr key={item.id} aria-current={item.id === produtoId ? 'true' : undefined}>
            <th scope="row"><small>{item.tipo}</small>{item.nome}</th>
            {CUSTOS_BNDES.map(custo => item.custos.includes(custo.id) ? <td key={custo.id} className="bcp-x"><span aria-hidden="true">✓</span><span className="sr-only">Sim</span></td> : <td key={custo.id}><span className="sr-only">Não</span></td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <ul className="bcp-notes">{CUSTOS_BNDES.map(custo => <li key={custo.id}><b>{custo.sigla}:</b> {custo.descricao} Base de cálculo {custo.base}.</li>)}</ul>
    </details>
  </section>
}
