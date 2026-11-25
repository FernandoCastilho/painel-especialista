import './Historias.css'
import logoIfood from './assets/historias/ifood.svg'
import logoNetflix from './assets/historias/netflix.svg'
import logoBlockbuster from './assets/historias/blockbuster.svg'
import logoSpotify from './assets/historias/spotify.svg'
import logoUber from './assets/historias/uber.svg'
import logoApple from './assets/historias/apple.svg'
import { HISTORIAS, TEMAS_HISTORIAS, casosDoTema } from './historias.js'

const logos = { ifood: logoIfood, netflix: logoNetflix, blockbuster: logoBlockbuster, spotify: logoSpotify, uber: logoUber, 'apple-iphone': logoApple }
const centro = [50, 50]
// Mantenha um ponto no mapa para cada marca e tema cadastrados em historias.js.
const pontos = {
  ifood: [18, 10], netflix: [50, 10], blockbuster: [82, 10],
  uber: [18, 90], 'apple-iphone': [50, 90], spotify: [82, 90],
  'origem-fisica': [18, 30], 'locacao-video': [50, 30], logistica: [82, 30],
  'plataformas-locais': [18, 70], 'ecossistema-mobile': [50, 70], streaming: [82, 70],
}
const posicao = ([x, y]) => ({ left: x + '%', top: y + '%' })
const linha = (key, [x1, y1], [x2, y2], className) => (
  <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} className={className} />
)

function Historia({ caso }) {
  return (
    <article className="historia-detalhe">
      <p className="historia-eyebrow">{caso.local} · {caso.setor} · {caso.rotuloData ?? 'Fundação'}: {caso.anoLancamento ?? caso.fundacao}</p>
      <h2>{caso.nome}: {caso.titulo}</h2>
      <h3>Como começou</h3>
      <p>{caso.origem}</p>
      <h3>A virada</h3>
      <p>{caso.virada}</p>
      <h3>Linha do tempo</h3>
      <ol className="historia-marcos">
        {caso.marcos.map(([ano, descricao]) => (
          <li key={ano}><strong>{ano}</strong><span>{descricao}</span></li>
        ))}
      </ol>
      <h3>Leitura de negócios</h3>
      <p>{caso.leitura}</p>
      <h3>Fontes</h3>
      <ul className="historia-fontes">
        {caso.fontes.map(({ titulo, url }) => (
          <li key={url}><a href={url} target="_blank" rel="noreferrer">{titulo}</a></li>
        ))}
      </ul>
    </article>
  )
}

export default function Historias({ view, onView }) {
  const caso = HISTORIAS.find(({ id }) => id === view)
  const tema = TEMAS_HISTORIAS.find(({ id }) => 'tema/' + id === view)
  const ligados = tema ? casosDoTema(tema.id) : []
  const ativa = (c, t) => tema?.id === t.id || caso?.id === c.id

  return (
    <section className="historias" aria-label="Histórias de empresas">
      <p className="historia-intro">Como grandes empresas começaram, o que mudou no caminho e o que suas trajetórias têm em comum.</p>
      <figure className="historia-figura">
        <div className="historia-mapa">
          <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
            {HISTORIAS.map(c => linha(c.id, centro, pontos[c.id], 'historia-eixo'))}
            {TEMAS_HISTORIAS.flatMap(t => casosDoTema(t.id).map(c =>
              linha(t.id + c.id, pontos[t.id], pontos[c.id], 'historia-ligacao' + (ativa(c, t) ? ' is-active' : '')),
            ))}
          </svg>
          <button className="historia-no historia-centro" style={posicao(centro)} onClick={() => onView('')} aria-controls="historia-detalhe" aria-pressed={!caso && !tema}>Histórias</button>
          {HISTORIAS.map(c => (
            <button key={c.id} className="historia-no historia-marca" style={posicao(pontos[c.id])}
              aria-label={c.nome} aria-controls="historia-detalhe" aria-pressed={caso?.id === c.id}
              data-relacionado={ligados.some(item => item.id === c.id)}
              onClick={() => onView(c.id)}>
              <img src={logos[c.id]} alt="" />
            </button>
          ))}
          {TEMAS_HISTORIAS.map(t => (
            <button key={t.id} className="historia-no historia-tema" style={posicao(pontos[t.id])}
              aria-controls="historia-detalhe" aria-pressed={tema?.id === t.id}
              onClick={() => onView('tema/' + t.id)}>{t.titulo}</button>
          ))}
        </div>
        <figcaption><a href="#historia-conteudo" onClick={e => { e.preventDefault(); document.getElementById('historia-conteudo')?.focus() }}>Ir ao conteúdo selecionado</a>. Escolha uma marca para ler a história ou toque em um tema para comparar as empresas ligadas a ele.</figcaption>
      </figure>
      <div id="historia-detalhe" className="historia-painel" aria-live="polite">
        <div id="historia-conteudo" tabIndex={-1}>
        {caso ? <Historia caso={caso} /> : tema ? (
          <section className="historia-detalhe">
            <p className="historia-eyebrow">Conexão entre casos</p>
            <h2>{tema.titulo}</h2>
            <p>{tema.leitura}</p>
            <ul className="historia-comparacao">
              {ligados.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => onView(c.id)}>{c.nome}</button>
                  <p>{c.conexoes[tema.id]}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="historia-detalhe">
            <h2>Casos para explorar</h2>
            <ul className="historia-comparacao">
              {HISTORIAS.map(c => (
                <li key={c.id}><button type="button" onClick={() => onView(c.id)}>{c.nome}</button><p>{c.titulo}.</p></li>
              ))}
            </ul>
          </section>
        )}
        </div>
      </div>
    </section>
  )
}
