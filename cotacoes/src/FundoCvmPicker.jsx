import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { buscarFundos, carregarCatalogoCvm, carregarFundoCvm, nomeFundo } from './fundosCvm.js'

const dateText = date => date.split('-').reverse().join('/')
const minimo = 2
const semSelecao = []
const termoBusca = texto => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()

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

function useBusca(catalogo, busca) {
  const worker = useRef(null)
  const [resposta, setResposta] = useState(null)
  const [fallback, setFallback] = useState(false)
  const buscaAdiada = useDeferredValue(busca)
  const pronta = busca.trim().length >= minimo
  useEffect(() => {
    if (!catalogo) return
    let instancia
    try {
      instancia = new Worker(new URL('./buscaFundosCvm.worker.js', import.meta.url), { type: 'module' })
      worker.current = instancia
      instancia.onmessage = ({ data }) => setResposta(data)
      instancia.onerror = () => {
        instancia.terminate()
        worker.current = null
        setFallback(true)
      }
      instancia.postMessage({ catalogo: catalogo.items })
    } catch {
      instancia?.terminate()
      worker.current = null
      setFallback(true)
    }
    return () => {
      instancia?.terminate()
      worker.current = null
    }
  }, [catalogo])
  useEffect(() => {
    if (pronta) worker.current?.postMessage({ busca })
  }, [pronta, busca, catalogo])
  // Alguns computadores (antivírus, política da empresa) carregam a busca em segundo plano mas ela nunca responde.
  // Sem resposta em 3 segundos, a busca passa a rodar na própria tela.
  useEffect(() => {
    if (!pronta || !catalogo || fallback || resposta?.busca === busca) return
    const espera = setTimeout(() => setFallback(true), 3000)
    return () => clearTimeout(espera)
  }, [pronta, catalogo, fallback, resposta, busca])
  const locais = useMemo(() => fallback && catalogo ? buscarFundos(catalogo.items, buscaAdiada) : [],
    [fallback, catalogo, buscaAdiada])
  if (!pronta || !catalogo) return { matches: [], atualizando: false }
  return fallback
    ? { matches: locais, atualizando: busca !== buscaAdiada }
    : { matches: resposta?.itens ?? [], atualizando: resposta?.busca !== busca }
}

export default function FundoCvmPicker({ onSelect, selecionado, inline = false, referencias, ativos = semSelecao, lotado = false }) {
  const [busca, setBusca] = useState('')
  const [catalogo, setCatalogo] = useState(null)
  const [ativado, setAtivado] = useState(inline)
  const [tentativa, setTentativa] = useState(0)
  const [estado, setEstado] = useState('')
  const campo = useRef(null)
  const { matches, atualizando } = useBusca(catalogo, busca)
  useEffect(() => {
    if (!ativado) return
    let vigente = true
    setEstado('loading')
    carregarCatalogoCvm().then(dados => {
      if (!vigente) return
      setCatalogo(dados)
      setEstado('')
    }, () => { if (vigente) setEstado('error') })
    return () => { vigente = false }
  }, [ativado, tentativa])
  function escolher(id, nome) {
    onSelect(id, nome)
    setBusca('')
    campo.current?.focus({ preventScroll: true })
  }
  if (referencias) {
    const consulta = termoBusca(busca)
    const pronta = consulta.length >= minimo
    const encontrados = referencias.filter(item => termoBusca(item.name).includes(consulta))
    const resultados = atualizando ? encontrados : [...encontrados, ...matches.map(item => ({ id: item[0], name: nomeFundo(item) }))]
    return <section className="inv-panel inv-busca-principal" aria-label="Adicionar ativo à comparação">
      <label>Buscar ativo
        <input ref={campo} type="search" maxLength={120} placeholder="Nome do fundo, CNPJ, CDI, IPCA ou dólar"
          value={busca} onChange={e => setBusca(e.target.value)} />
      </label>
      {lotado && <p className="inv-nota">Limite de seis ativos. Remova um para adicionar outro.</p>}
      {pronta && <>
        {resultados.length > 0 &&
          <ul className="inv-cvm-matches" aria-label="Ativos encontrados">
            {resultados.map(item => {
              const incluido = ativos.includes(item.id)
              return <li key={item.id}><button type="button" disabled={incluido || lotado}
                onClick={() => escolher(item.id, item.name)}>
                {item.name}{incluido && <small className="inv-nota"> · Já na comparação</small>}
              </button></li>
            })}
          </ul>}
        {estado === 'error' ? <div className="inv-flex">
          <p role="status">Não foi possível baixar a base de fundos da CVM neste aparelho. Se estiver na rede da empresa, ela pode estar bloqueando o arquivo.</p>
          <button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button>
        </div> : estado === 'loading' || atualizando ? <p role="status">Buscando fundos…</p>
          : catalogo && !resultados.length && <p role="status">Nenhum ativo encontrado.</p>}
      </>}
    </section>
  }
  const conteudo = <>
    <label>Nome do fundo, classe ou CNPJ
      <input type="search" maxLength={120} placeholder="Digite pelo menos dois caracteres" value={busca} onChange={e => setBusca(e.target.value)} />
    </label>
    {estado === 'loading' && <p role="status">Carregando o catálogo de fundos…</p>}
    {estado === 'error' && <>
      <p role="status">Não foi possível baixar a base de fundos da CVM neste aparelho. Se estiver na rede da empresa, ela pode estar bloqueando o arquivo.</p>
      <button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button>
    </>}
    {catalogo && <>
      {matches.length > 0
        ? <ul className="inv-cvm-matches" aria-label="Fundos encontrados" aria-busy={atualizando}>{matches.map(item =>
          <li key={item[0]}><button type="button" aria-pressed={selecionado === item[0] || undefined}
            disabled={atualizando}
            onClick={() => escolher(item[0])}>{nomeFundo(item)}</button></li>)}</ul>
        : !atualizando && busca.trim().length >= minimo && <p role="status">Nenhum fundo encontrado.</p>}
      <p className="inv-nota">Base geral de {dateText(catalogo.manifest.first)} a {dateText(catalogo.manifest.last)}.</p>
    </>}
  </>
  return inline ? <section className="inv-panel inv-busca-principal" aria-label="Buscar fundos na CVM">{conteudo}</section>
    : <details className="inv-import" onToggle={e => { if (e.currentTarget.open) setAtivado(true) }}>
        <summary>Buscar fundos na CVM</summary>
        {conteudo}
      </details>
}
