import { useEffect, useState } from 'react'
import { ETAPAS_ICMS, exemploIcmsSt } from './icmsSt.js'
import './IcmsStDiagram.css'

const EMPRESAS = ['Fabricante', 'Distribuidor', 'Loja', 'Consumidor']
const dinheiro = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const exemplo = exemploIcmsSt()

export default function IcmsStDiagram() {
  const [modo, setModo] = useState('st')
  const [etapa, setEtapa] = useState(0)
  const [tocando, setTocando] = useState(false)
  const [reduzido, setReduzido] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true)
  const [visivel, setVisivel] = useState(() => !document.hidden)
  const atual = ETAPAS_ICMS[modo][etapa]
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const mudar = () => { setReduzido(media?.matches ?? true); setTocando(false) }
    media?.addEventListener('change', mudar)
    const ocultar = () => { setVisivel(!document.hidden); if (document.hidden) setTocando(false) }
    document.addEventListener('visibilitychange', ocultar)
    return () => { media?.removeEventListener('change', mudar); document.removeEventListener('visibilitychange', ocultar) }
  }, [])
  useEffect(() => {
    if (!tocando || reduzido || !visivel) return undefined
    const timer = setTimeout(() => {
      if (etapa === 3) setTocando(false)
      else setEtapa(etapa + 1)
    }, 8000)
    return () => clearTimeout(timer)
  }, [tocando, etapa, reduzido, visivel])
  function escolherModo(novo) { setModo(novo); setEtapa(0); setTocando(false) }
  function escolherEtapa(nova) { setEtapa(nova); setTocando(false) }
  function reproduzir() { if (etapa === 3) setEtapa(0); setTocando(!tocando) }
  return <section className="icms-lesson" aria-labelledby="icms-diagram-title">
    <div className="icms-intro"><span className="icms-eyebrow">Da fábrica ao consumidor</span><h3 id="icms-diagram-title">O produto segue. O imposto muda de momento.</h3><p>Compare uma cadeia interna típica com ST e sem ST. O diagrama é didático, não determina o enquadramento de uma operação.</p></div>
    <div className="icms-modes" role="group" aria-label="Regime do diagrama">
      <button type="button" aria-pressed={modo === 'st'} onClick={() => escolherModo('st')}>Com ST · antecipação</button>
      <button type="button" aria-pressed={modo === 'normal'} onClick={() => escolherModo('normal')}>Sem ST · exemplo no RPA</button>
    </div>
    <div className="icms-stage" data-mode={modo} data-step={etapa} data-playing={tocando} data-reduced={reduzido}>
      <div className="icms-stage-top"><strong>{modo === 'st' ? 'Um responsável antecipa as próximas etapas' : 'Cada contribuinte apura débitos e créditos'}</strong><span>Etapa {etapa + 1} de 4</span></div>
      <p className="icms-diagram-legend">Entre empresas: fluxo da mercadoria. Para o Fisco: recolhimento do ICMS.</p>
      <ol className="icms-chain" aria-label="Fluxo da mercadoria e responsabilidade tributária">
        {EMPRESAS.map((nome, i) => <li className={`icms-node ${atual.ativos.includes(i) ? 'is-active' : ''}`} key={nome}>
          <div className="icms-company"><span className="icms-node-number" aria-hidden="true">0{i + 1}</span><strong>{nome}</strong><small>{i === 3 ? 'Compra para consumo' : modo === 'st' ? i === 0 ? 'Substituto tributário' : 'Substituído' : 'Contribuinte · RPA'}</small></div>
          {i < 3 && <div className={`icms-goods ${atual.fluxo === 'mercadoria' ? 'is-moving' : ''}`} aria-hidden="true"><svg viewBox="0 0 100 16"><path d="M2 8H96M89 2L96 8 89 14" /><circle cx="5" cy="8" r="4" /></svg></div>}
          {i < 3 && <div className={`icms-tax ${(modo === 'st' ? i === 0 : true) ? 'is-taxpayer' : ''} ${atual.fluxo === 'tributo' ? 'is-moving' : ''}`}>
            <span className="icms-tax-arrow" aria-hidden="true">↓</span>
            <span>{modo === 'st' ? i === 0 ? 'ICMS próprio + ICMS-ST → Fisco' : 'Revenda com ICMS já retido*' : 'Débito − crédito admitido → Fisco'}</span>
          </div>}
        </li>)}
      </ol>
      <div className="icms-fisco"><strong>Fisco estadual</strong><span>{modo === 'st' ? 'Recebe imposto próprio e antecipação das operações seguintes.' : 'Recebe a apuração de cada contribuinte, no prazo fiscal aplicável.'}</span></div>
      <p className="icms-diagram-note">{modo === 'st' ? '* Fluxo interno típico, sem tratar as exceções, complementações e ressarcimentos. O responsável pode ser outro agente previsto em lei.' : 'O Simples Nacional tem regras próprias no DAS. Este fluxo de débitos e créditos é do RPA.'}</p>
      <div className="icms-caption" key={`${modo}-${etapa}`} role="status" aria-live="polite" aria-atomic="true"><span className="icms-eyebrow">{String(etapa + 1).padStart(2, '0')} / 04</span><h4>{atual.titulo}</h4><p>{atual.texto}</p></div>
      <div className="icms-controls" role="group" aria-label="Controles da animação">
        {!reduzido && <button type="button" className="icms-play" onClick={reproduzir}>{tocando ? 'Pausar' : etapa === 3 ? 'Reproduzir novamente' : 'Reproduzir'}</button>}
        <button type="button" disabled={etapa === 0} onClick={() => escolherEtapa(etapa - 1)}>Anterior</button>
        <button type="button" disabled={etapa === 3} onClick={() => escolherEtapa(etapa + 1)}>Próxima etapa</button>
        <button type="button" onClick={() => escolherEtapa(0)}>Reiniciar</button>
      </div>
      <p className="icms-play-note">{reduzido ? 'Movimento reduzido ativo. Explore as quatro etapas pelos botões, sem animação.' : 'Começa pausado. Reproduzir avança a cada 8 segundos e para no fim. Você também pode avançar no seu ritmo.'}</p>
    </div>
    <details className="icms-transcript"><summary>Ler todas as etapas sem animação</summary>{Object.entries(ETAPAS_ICMS).map(([id, etapas]) => <section key={id}><h4>{id === 'st' ? 'Com ST' : 'Sem ST, no RPA'}</h4><ol>{etapas.map(item => <li key={item.titulo}><strong>{item.titulo}.</strong> {item.texto}</li>)}</ol></section>)}</details>
    <section className="icms-numbers" aria-labelledby="icms-numbers-title"><h3 id="icms-numbers-title">Mesma cadeia hipotética. Outro momento de recolher.</h3><p>Vendas de R$ 100 → R$ 150 → R$ 200. Alíquota fictícia de 18% e base presumida final de R$ 200. Créditos anteriores ao fabricante e outros ajustes excluídos.</p><div className="icms-number-grid"><div><strong>Com ST</strong><b>{dinheiro(exemplo.proprio)} + {dinheiro(exemplo.antecipado)}</b><span>Fabricante: próprio + antecipação</span></div><div><strong>Sem ST · RPA</strong><b>{exemplo.recolhimentos.map(dinheiro).join(' + ')}</b><span>Fabricante + distribuidor + loja</span></div></div><p><strong>Total: {dinheiro(exemplo.total)} em cada cenário, somente nestas hipóteses.</strong> O exemplo não prova redução nem igualdade de carga em operações reais. O detalhamento da conta está abaixo.</p></section>
    <section className="icms-sp" aria-labelledby="icms-sp-title"><span className="icms-eyebrow">São Paulo · desde 1º de outubro de 2026</span><h3 id="icms-sp-title">O que mudou com a Portaria SRE 34/2026</h3><p><strong>Terminou a antecipação por ST para os itens alcançados. O ICMS continua.</strong> A norma revogou os Anexos VII, VIII, XIV, XVIII e XXI e os itens 2 a 10 e 15 do Anexo XXII da CAT 68/2019.</p>
      <div className="icms-sp-grid"><section><h4>1. Confira a mercadoria</h4><p>As listas abrangem pneumáticos, câmaras e protetores, tintas e vernizes, determinados produtos químicos, autopeças, ferramentas, materiais elétricos e determinados equipamentos de refrigeração e lava-louças.</p><p><strong>Não basta pertencer ao setor.</strong> Compare descrição, NCM, item da lista e operação. Nem todo eletroeletrônico foi excluído. Instrumentos de medição NCM 9030.3, por exemplo, permanecem sujeitos à ST nas hipóteses da RC 40205/2026. Para outros estados, confira a regra do destino.</p></section>
      <section><h4>2. Separe o estoque antigo</h4><p>O estoque ao final de <strong>30/09/2026</strong> segue a CAT 28/2020. Para aproveitar o crédito, faça levantamento por mercadoria, confira documentos fiscais e escriture o inventário. A partir de 01/10, as saídas seguem as regras comuns, inclusive mercadorias compradas antes.</p><p>O cálculo depende do regime, do fornecedor e da operação. Não é simplesmente copiar o campo ICMS-ST da nota. A falta da base de retenção exigida pode impedir o crédito; a norma prevê saneamento por nota complementar nas condições legais.</p></section>
      <section><h4>3. Use o crédito no ritmo legal</h4><p><strong>RPA:</strong> crédito apurado em 12 parcelas mensais, iguais e sucessivas, a partir da referência outubro/2026.</p><p><strong>Simples Nacional:</strong> dedução própria no PGDAS-D contra o ICMS devido no mês posterior à exclusão, com saldo remanescente para meses seguintes. Não aplicar as 12 parcelas do RPA ao Simples.</p><p>É aproveitamento fiscal, <strong>não depósito automático em conta</strong>. Valide o procedimento com o contador.</p></section>
      <section><h4>4. Refaça o ciclo de caixa</h4><p>Menos imposto antecipado na compra pode reduzir o financiamento do estoque, se o efeito chegar ao preço e às condições negociadas. Mas vender a prazo pode exigir recolher imposto antes de receber do cliente.</p><p>Na análise PJ, separe benefício recorrente de caixa, crédito transitório do estoque e projeção não comprovada. Confira participação dos produtos atingidos, regime fiscal, inventário, cronograma do crédito e prazos de compra, giro e recebimento.</p></section></div>
      <p className="icms-caution">A mudança paulista não é o fim nacional da ST e não deve ser confundida com a substituição gradual do ICMS pelo IBS. Conteúdo educacional revisto em 08/11/2026; aplicação por empresa exige validação fiscal.</p>
    </section>
  </section>
}
