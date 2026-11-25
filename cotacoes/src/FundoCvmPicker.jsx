import { useEffect, useMemo, useState } from 'react'
import { buscarFundos, carregarCatalogoCvm, carregarFundoCvm, FONTE_CVM, LICENCA_CVM, nomeFundo } from './fundosCvm.js'

const dateText = date => date.split('-').reverse().join('/')
const vazio = []

export function useCotasCvm(ids, retry = 0) {
  const key = ids.join(',')
  const [state, setState] = useState({ dados: {}, erros: [] })
  useEffect(() => {
    if (!key) return
    let vigente = true
    const selecionados = key.split(',')
    setState(current => ({ ...current, erros: [] }))
    Promise.allSettled(selecionados.map(carregarFundoCvm)).then(resultados => {
      if (!vigente) return
      const dados = {}
      const erros = []
      resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') dados[selecionados[i]] = r.value
        else erros.push(selecionados[i])
      })
      setState({ dados, erros })
    })
    return () => { vigente = false }
  }, [key, retry])
  return state
}

export default function FundoCvmPicker({ onSelect, excluidos = vazio, selecionado }) {
  const [busca, setBusca] = useState('')
  const [catalogo, setCatalogo] = useState(null)
  const [estado, setEstado] = useState('')
  const matches = useMemo(() => catalogo ? buscarFundos(catalogo.items, busca, excluidos) : [],
    [catalogo, busca, excluidos])
  async function carregar() {
    if (catalogo || estado === 'loading') return
    setEstado('loading')
    try {
      setCatalogo(await carregarCatalogoCvm())
      setEstado('')
    } catch {
      setEstado('error')
    }
  }
  return <details className="inv-import" onToggle={e => { if (e.currentTarget.open) void carregar() }}>
    <summary>Buscar fundos na CVM</summary>
    <label>Nome do fundo, classe ou CNPJ
      <input type="search" maxLength={120} value={busca} onChange={e => setBusca(e.target.value)} />
    </label>
    {estado === 'loading' && <p role="status">Carregando o catálogo de fundos…</p>}
    {estado === 'error' && <>
      <p role="status">Não foi possível carregar o catálogo de fundos.</p>
      <button type="button" onClick={carregar}>Tentar novamente</button>
    </>}
    {catalogo && <>
      {matches.length > 0
        ? <ul className="inv-cvm-matches" aria-label="Fundos encontrados">{matches.map(item =>
          <li key={item[0]}><button type="button" aria-pressed={selecionado === item[0] || undefined}
            onClick={() => { onSelect(item[0]); setBusca('') }}>{nomeFundo(item)}</button></li>)}</ul>
        : <p role="status">{busca.trim().length < 3 ? 'Digite ao menos três caracteres.' : 'Nenhum fundo encontrado.'}</p>}
      <p className="inv-nota">Base geral de {dateText(catalogo.manifest.first)} a {dateText(catalogo.manifest.last)}.
        A cobertura varia por fundo.</p>
    </>}
    <p className="inv-nota">Dados adaptados do <a href={FONTE_CVM} target="_blank" rel="noreferrer">Informe Diário da CVM</a>,
      sob <a href={LICENCA_CVM} target="_blank" rel="noreferrer">licença ODbL</a>.</p>
  </details>
}
