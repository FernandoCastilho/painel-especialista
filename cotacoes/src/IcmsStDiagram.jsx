import { useEffect, useRef } from 'react'
import { CONCEITO_ICMS_ST, FONTES_ICMS_ST, exemploIcmsSt } from './icmsSt.js'
import './IcmsStDiagram.css'

const EMPRESAS = ['Fabricante', 'Distribuidor', 'Loja', 'Consumidor']
const exemplo = exemploIcmsSt()
const dinheiro = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function Empresa({ tipo }) {
  return <svg className="icms-building" viewBox="0 0 80 72" aria-hidden="true" focusable="false">
    {tipo === 0 ? <><path className="icms-building-fill" d="M7 62V31l19 9V28l21 12V22h16v40Z"/><path d="M54 22V8h9v14M7 62h65M15 49h8v7h-8ZM32 49h8v7h-8ZM50 49h7v13M63 49h4M63 55h4"/><path className="icms-building-detail" d="M54 6c-8-3-13 2-20-1"/></> : tipo === 1 ? <><path className="icms-building-fill" d="M7 31 40 12l33 19v31H7Z"/><path d="M7 31h66M19 62V39h42v23M19 46h42M19 53h42M5 62h70"/><path className="icms-building-detail" d="M34 21h12M30 62V51h10v11M43 62V51h10v11"/></> : tipo === 2 ? <><path className="icms-building-fill" d="M10 34h60v28H10ZM7 34l6-18h54l6 18"/><path d="M7 34c0 8 13 8 13 0 0 8 13 8 13 0 0 8 14 8 14 0 0 8 13 8 13 0 0 8 13 8 13 0M24 17l-4 17M35 17l-2 17M45 17l2 17M56 17l4 17M17 45h20v12H17ZM47 62V44h15v18M5 62h70"/></> : <><circle className="icms-building-fill" cx="33" cy="15" r="9"/><path className="icms-building-fill" d="M17 61V42c0-9 6-15 16-15s16 6 16 15v19"/><path d="M24 46v15M43 43l10 8M8 62h65"/><path className="icms-building-detail" d="m46 40 17-4 11 9-18 4Zm0 0v17l10 9V49m18-4v16l-18 5M55 38l11 9"/></>}
  </svg>
}

function Cadeia({ st }) {
  const id = st ? 'st' : 'rpa'
  return <figure className="icms-flow" data-scenario={id} data-motion="false" aria-labelledby={`icms-${id}-caption`}>
    <div className="icms-flow-legend"><span><i className="icms-goods-key" aria-hidden="true"/>Mercadoria</span><span><i className="icms-tax-key" aria-hidden="true"/>Recolhimento ao Fisco</span></div>
    <ol className="icms-chain">
      {EMPRESAS.map((nome, index) => {
        const recolhe = st ? index === 0 : index < 3
        return <li className="icms-actor" data-payer={recolhe} key={nome} style={{ '--icms-order': index }}>
          <Empresa tipo={index}/>
          <div className="icms-actor-name"><strong>{nome}</strong><span>{index === 3 ? 'Compra para consumo' : st ? index === 0 ? 'Substituto tributário' : 'Substituído' : 'Contribuinte no RPA'}</span></div>
          {index < 3 && <span className="icms-goods-link" aria-hidden="true"><i className="icms-goods-packet"/></span>}
          <div className="icms-actor-tax">{recolhe ? <><strong>{st ? 'ICMS próprio + das revendas' : 'Débito − crédito admitido'}</strong><span className="icms-tax-link" aria-hidden="true"><i className="icms-tax-packet"/></span></> : index < 3 ? <span>Revenda com imposto<br className="icms-desktop-break"/> já retido*</span> : null}</div>
        </li>
      })}
    </ol>
    <div className="icms-fisco"><svg viewBox="0 0 40 34" aria-hidden="true"><path d="m3 11 17-9 17 9ZM6 14v14m9-14v14m10-14v14m9-14v14M3 30h34"/></svg><div><strong>Fisco estadual</strong><span>{st ? 'Um responsável recolhe por mais de uma etapa.' : 'Cada contribuinte recolhe sua apuração no prazo fiscal.'}</span></div></div>
    <figcaption id={`icms-${id}-caption`}>{st ? '* Fluxo interno típico. Exceções, complementação e ressarcimento dependem da operação. Outro agente pode ser o responsável previsto em lei.' : 'Este desenho é do RPA. No Simples Nacional, a apuração segue regras próprias no DAS.'}</figcaption>
  </figure>
}

export default function IcmsStDiagram({ goto }) {
  const article = useRef(null)
  useEffect(() => {
    const scenes = [...(article.current?.querySelectorAll('.icms-flow') ?? [])]
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const stop = () => { if (media?.matches || document.hidden) scenes.forEach(scene => { scene.dataset.motion = 'false' }) }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return
        target.dataset.motion = String(!media?.matches && !document.hidden)
        observer.unobserve(target)
      })
    }, { threshold: .15 }) : null
    scenes.forEach(scene => observer?.observe(scene))
    media?.addEventListener('change', stop)
    document.addEventListener('visibilitychange', stop)
    return () => { observer?.disconnect(); media?.removeEventListener('change', stop); document.removeEventListener('visibilitychange', stop) }
  }, [])
  return <article className="icms-lesson" ref={article} aria-labelledby="icms-title">
    <header className="icms-hero">
      <div className="icms-kicker"><span>Tributos · guia visual</span><span>ICMS / ST</span></div>
      <h2 id="icms-title">Substituição tributária do ICMS</h2>
      <p className="icms-headline">A mercadoria segue.<br/><em>O recolhimento muda.</em></p>
      <p className="icms-deck">Da fábrica ao consumidor, o produto percorre a mesma cadeia. A diferença está em <strong>quem recolhe o imposto das revendas e em qual momento.</strong></p>
      <p className="icms-thesis"><span aria-hidden="true">↳</span> Sair da ST não elimina o ICMS.</p>
    </header>

    <section className="icms-chapter" aria-labelledby="icms-st-title">
      <div className="icms-chapter-heading"><span className="icms-section-number">01</span><div><p className="icms-eyebrow">Com substituição tributária</p><h3 id="icms-st-title">Recolhimento concentrado.</h3><p>O substituto recolhe o imposto próprio e antecipa o das etapas seguintes.</p></div></div>
      <Cadeia st/>
      <div className="icms-reading"><p><strong>Uma responsabilidade definida em lei.</strong> Neste exemplo, o fabricante é o substituto. Distribuidor e loja são substituídos: recebem a mercadoria com o ICMS das revendas já retido. Isso não torna essas vendas isentas.</p><p><strong>Uma base presumida, não o lucro da loja.</strong> A ST usa o critério legal do produto, como preço fixado ou margem de valor agregado (MVA). Diferenças entre a base presumida e a operação real podem ter tratamento próprio.</p></div>
    </section>

    <section className="icms-chapter" aria-labelledby="icms-rpa-title">
      <div className="icms-chapter-heading"><span className="icms-section-number">02</span><div><p className="icms-eyebrow">Sem ST · exemplo no RPA</p><h3 id="icms-rpa-title">Apuração em cada etapa.</h3><p>Sem antecipar as revendas, cada contribuinte apura sua própria operação.</p></div></div>
      <Cadeia st={false}/>
      <div className="icms-reading"><p><strong>Débitos pelas vendas, créditos admitidos pelas compras.</strong> No Regime Periódico de Apuração (RPA), a não cumulatividade evita cobrar integralmente de novo o imposto das etapas anteriores, quando o crédito é permitido.</p><p><strong>O vencimento é fiscal.</strong> O imposto pode vencer antes de a empresa receber do cliente. A exclusão de ST não altera, por si só, a alíquota e não garante aumento de margem ou liberação de dinheiro.</p></div>
    </section>

    <section className="icms-example" aria-labelledby="icms-example-title">
      <p className="icms-eyebrow">Exemplo hipotético · não é cálculo fiscal</p><h3 id="icms-example-title">A mesma cadeia.<br/>Outro momento de recolher.</h3>
      <p>Vendas de <strong>R$ 100 → R$ 150 → R$ 200</strong>. Alíquota fictícia de 18%, base presumida final de R$ 200 e créditos anteriores ao fabricante excluídos. Sem frete, IPI, reduções ou outros ajustes.</p>
      <div className="icms-equations"><div><span className="icms-equation-label">Com ST</span><p><b>{dinheiro(exemplo.proprio)}</b><i>+</i><b>{dinheiro(exemplo.antecipado)}</b></p><span>Fabricante: próprio + antecipação das revendas</span></div><div><span className="icms-equation-label">Sem ST · RPA</span><p>{exemplo.recolhimentos.map((valor, i) => <span key={i}>{i > 0 && <i>+</i>}<b>{dinheiro(valor)}</b></span>)}</p><span>Fabricante + distribuidor + loja</span></div></div>
      <p className="icms-total"><strong>R$ 36 em cada cenário.</strong> Igual somente porque a base presumida foi escolhida igual ao preço final e as demais hipóteses foram mantidas. O exemplo não prova redução nem igualdade de carga em operações reais.</p>
      <details className="icms-detail"><summary>Veja a conta, etapa por etapa</summary><ol>{CONCEITO_ICMS_ST.exemplo.passos.slice(1).map(p => <li key={p}>{p}</li>)}</ol><p>{CONCEITO_ICMS_ST.preciso.texto}</p><p className="icms-formula">{CONCEITO_ICMS_ST.preciso.formula}</p></details>
    </section>

    <section className="icms-sp" aria-labelledby="icms-sp-title">
      <p className="icms-eyebrow">São Paulo · Portaria SRE 34/2026</p><h3 id="icms-sp-title">O que mudou.<br/><span>O que continua.</span></h3>
      <p>Terminou a antecipação por ST <strong>para os itens alcançados</strong>. O ICMS continua. A norma revogou os Anexos VII, VIII, XIV, XVIII e XXI e os itens 2 a 10 e 15 do Anexo XXII da CAT 68/2019.</p>
      <ol className="icms-timeline"><li><time dateTime="2026-09-30">30/09/2026</time><strong>Fotografia do estoque</strong><span>Levantamento ao final do dia, conforme a CAT 28/2020.</span></li><li><time dateTime="2026-10-01">01/10/2026</time><strong>Saídas pelas regras comuns</strong><span>Para os itens excluídos, inclusive mercadorias compradas antes.</span></li></ol>
      <div className="icms-legal-row"><span className="icms-legal-index" aria-hidden="true">A</span><div><h4>Confira o enquadramento.</h4><p>Compare <strong>mercadoria, descrição, NCM, item da lista e operação</strong>. CNAE ou setor, sozinhos, não bastam. As listas alcançam pneumáticos, câmaras e protetores, tintas e vernizes, determinados produtos químicos, autopeças, ferramentas, materiais elétricos e determinados equipamentos de refrigeração e lava-louças.</p><p>Nem todo eletroeletrônico saiu da ST. Instrumentos de medição NCM 9030.3, por exemplo, permanecem sujeitos à ST nas hipóteses da RC 40205/2026. Para outros estados, confira a regra do destino.</p></div></div>
      <div className="icms-legal-row"><span className="icms-legal-index" aria-hidden="true">B</span><div><h4>Trate o estoque.</h4><p>Para aproveitar o crédito do estoque antigo, levante cada mercadoria, confira documentos fiscais e escriture o inventário. O cálculo depende do regime, do fornecedor e da operação: <strong>não é copiar o campo ICMS-ST da nota.</strong> A falta da base de retenção exigida pode impedir o crédito; a norma admite nota complementar nas condições legais.</p><dl className="icms-regimes"><div><dt>RPA</dt><dd>Crédito apurado em <strong>12 parcelas mensais</strong>, iguais e sucessivas, a partir da referência outubro/2026.</dd></div><div><dt>Simples Nacional</dt><dd>Dedução própria no <strong>PGDAS-D</strong> contra o ICMS devido no mês posterior à exclusão; o saldo pode seguir nos meses seguintes. Não aplicar as 12 parcelas do RPA.</dd></div></dl></div></div>
      <div className="icms-legal-row"><span className="icms-legal-index" aria-hidden="true">C</span><div><h4>Reveja o caixa.</h4><p>Menos antecipação na compra pode reduzir a necessidade de financiar o estoque, <strong>se o efeito chegar ao preço e às condições negociadas.</strong> Prazos do fornecedor, giro e recebimentos fazem diferença. É preciso reservar caixa para o imposto das vendas.</p><p>Na análise PJ, confira a participação dos produtos atingidos, regime fiscal, inventário, cronograma do crédito e ciclo de compra e recebimento. Separe hipóteses financeiras de efeitos já comprovados.</p></div></div>
    </section>

    <aside className="icms-takeaway"><p className="icms-eyebrow">A distinção que importa para o caixa</p><h3>Crédito fiscal não é<br/>dinheiro na conta.</h3><p>É aproveitamento fiscal, <strong>não depósito automático</strong>. O crédito transitório do estoque é diferente de um possível efeito recorrente no ciclo de caixa. Valide o procedimento com o contador.</p></aside>
    <footer className="icms-footer"><p className="icms-caution">A mudança paulista não é o fim nacional da ST e não se confunde com a transição do ICMS para o IBS, nem com split payment de IBS/CBS. Conteúdo educacional revisto em 08/11/2026; aplicação por empresa exige validação fiscal.</p><details className="icms-detail"><summary>Fontes e base legal</summary><ul>{FONTES_ICMS_ST.map(f => <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.nome}</a></li>)}</ul></details><details className="icms-detail"><summary>Teste sua compreensão</summary><p><strong>{CONCEITO_ICMS_ST.teste.pergunta}</strong></p><p>{CONCEITO_ICMS_ST.teste.resposta}</p></details><nav className="icms-related learn-conecta" aria-label="Continue aprendendo"><span>Conecta com</span><button type="button" onClick={() => goto?.('aprender', 'reforma-tributaria')}>Reforma Tributária do consumo <span aria-hidden="true">↗</span></button><button type="button" onClick={() => goto?.('aprender', 'custo-de-funding')}>Custo de funding <span aria-hidden="true">↗</span></button></nav></footer>
  </article>
}
