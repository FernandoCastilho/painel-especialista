import { useMemo, useState } from 'react'
import { ATRIBUICOES, BASE_DADOS } from './baseDados.js'

const plain = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const link = (url) => /^https:\/\//.test(url)

// Configurações › Base de dados: de onde vem cada referência (órgão, API, página pública, arquivo e série), por grupo, com busca.
export default function BaseDados() {
  const [q, setQ] = useState('')
  const grupos = useMemo(() => {
    const palavras = plain(q).split(/\s+/).filter(Boolean)
    return BASE_DADOS.map((g) => ({ ...g, itens: g.itens.filter((i) => { const t = plain([g.grupo, i.nome, i.orgao, i.api, i.arquivo, i.serie, i.freq].join(' ')); return palavras.every((w) => t.includes(w)) }) })).filter((g) => g.itens.length)
  }, [q])
  const total = grupos.reduce((n, g) => n + g.itens.length, 0)
  // Os grupos abrem por clique; com busca, abrem sozinhos para mostrar o que foi achado (a lista inteira passava de 25 telas no celular).
  const buscando = q.trim() !== ''
  return (
    <>
      <div className="base-busca">
        <label>Buscar na base de dados
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Selic, SGS, EIA, quotes.json" />
        </label>
        <span role="status">{total} {total === 1 ? 'referência' : 'referências'}</span>
      </div>
      {grupos.length === 0 && <p className="config-note" role="status">Nenhuma referência encontrada para essa busca.</p>}
      {grupos.map((g) => (
        <details key={g.grupo} className="base-grupo" open={buscando || undefined} aria-label={g.grupo}>
          <summary><h3 className="config-sub">{g.grupo}</h3><small>{g.itens.length} {g.itens.length === 1 ? 'referência' : 'referências'}</small></summary>
          <div className="config-scroll" role="region" aria-label={`Fontes de ${g.grupo}`} tabIndex={0}>
            <table className="config-table config-gov config-base">
              <thead><tr><th scope="col">Referência</th><th scope="col">Quem publica</th><th scope="col">API ou endereço consultado</th><th scope="col">Série</th><th scope="col">Arquivo no app</th><th scope="col">Coleta</th></tr></thead>
              <tbody>
                {g.itens.map((i) => (
                  <tr key={i.nome}>
                    <th scope="row">{i.nome}</th>
                    <td data-label="Quem publica">{link(i.pagina) ? <a href={i.pagina} target="_blank" rel="noopener noreferrer">{i.orgao} ↗</a> : i.orgao}</td>
                    <td data-label="API ou endereço"><code className="base-api">{i.api}</code></td>
                    <td data-label="Série">{i.serie}</td>
                    <td data-label="Arquivo no app"><code>{i.arquivo}</code></td>
                    <td data-label="Coleta">{i.freq}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      <h3 className="config-sub">Atribuições e termos de uso</h3>
      <ul className="config-list">
        {ATRIBUICOES.map((a) => (
          <li key={a.fonte}><b>{a.fonte}.</b> {a.texto}{a.links.map(([rot, href]) => <span key={href}> · <a href={href} target="_blank" rel="noopener noreferrer">{rot}</a></span>)}</li>
        ))}
      </ul>
      <p className="config-note">Os painéis mostram só a data e a hora da última atualização. Tudo o que diz respeito à origem do dado (órgão, API, série e frequência) fica aqui.</p>
    </>
  )
}
