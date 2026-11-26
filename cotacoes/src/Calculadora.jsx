import { lazy, Suspense, useState } from 'react'
import { CALCULATOR_GROUPS } from './calculatorGroups.js'
import { FinameIcon, CreditIcon, OperacaoDiIcon, CbsIcon, ContaGarantidaIcon, CdiDolarIcon,
  DividendosEmprestimoIcon, Emprestimo4131Icon, CambioFuturoIcon, FinimpIcon, GiroIcon, CdcIcon, DescontoIcon, FaturamentoIcon } from './CalculatorIcons.jsx'
import './CalculatorStandard.css'
import './Calculadora.css'
import './CalculatorWorkspace.css'
import './CalculatorLayout.css'
import './CalculatorTheme.css'
import './CalcUnificado.css'
import './CalcCatalogo.css'

const CapitalDeGiro = lazy(() => import('./CapitalDeGiro.jsx'))
const Cdc = lazy(() => import('./Cdc.jsx'))
const FinimpComparacao = lazy(() => import('./FinimpComparacao.jsx'))
const BndesWorkspace = lazy(() => import('./BndesWorkspace.jsx'))
const Investimentos = lazy(() => import('./Investimentos.jsx'))
const ContaGarantida = lazy(() => import('./ContaGarantida.jsx'))
const AnaliseDesconto = lazy(() => import('./AnaliseDesconto.jsx'))
const CreditComparison = lazy(() => import('./CreditComparison.jsx'))
const CbsCaixa = lazy(() => import('./CbsCaixa.jsx'))
const OperacaoDi = lazy(() => import('./OperacaoDi.jsx'))
const Emprestimo4131 = lazy(() => import('./Emprestimo4131.jsx'))
const Faturamento = lazy(() => import('./Faturamento.jsx'))
const ArvoreCredito = lazy(() => import('./ArvoreCredito.jsx'))
const CdiDolar = lazy(() => import('./CdiDolar.jsx'))
const CambioFuturoJornada = lazy(() => import('./CambioFuturoJornada.jsx'))
const CambioFuturo = lazy(() => import('./CambioFuturo.jsx'))
const CambioFuturoCenario = lazy(() => import('./CambioFuturoCenario.jsx'))
const DividendosEmprestimo = lazy(() => import('./DividendosEmprestimo.jsx'))

const CALCS = [
  { id: 'finame-materiais', title: 'BNDES', sub: 'Simular Finame, comparar custos e consultar taxas', Icon: FinameIcon },
  { id: 'comparador-credito', title: 'Necessidade do Cliente', sub: 'De 1 a 5 operações: cotação, custo, CET e fluxo', Icon: CreditIcon },
  { id: 'operacao-di', title: 'Operação x DI', sub: 'Pré, % do CDI ou CDI + spread contra o DI da curva B3', Icon: OperacaoDiIcon },
  { id: 'cbs-caixa', title: 'Reforma tributária · caixa', sub: 'CBS, IBS, créditos e necessidade adicional de giro', Icon: CbsIcon },
  { id: 'conta-garantida', title: 'Conta Garantida', sub: 'Juros e IOF sobre saldos', Icon: ContaGarantidaIcon },
  { id: 'cdi-dolar', title: 'CDI x Dólar', sub: 'Em quanto tempo o CDI líquido alcança a alta do dólar', Icon: CdiDolarIcon },
  { id: 'dividendos-emprestimo', title: 'Dividendos via empréstimo', sub: 'Lucro real: eficiência de pagar o dividendo com crédito na empresa', Icon: DividendosEmprestimoIcon },
  { id: 'emprestimo-4131', title: 'Empréstimo externo (4131)', sub: 'No formato da cotação: dólar ou euro, parcelas e NDF', Icon: Emprestimo4131Icon },
  { id: 'cambio-futuro', title: 'Câmbio futuro', sub: 'Cote bullet ou até 5 parcelas com taxas da mesa', Icon: CambioFuturoIcon },
  { id: 'finimp', title: 'FINIMP', sub: 'Compare propostas e atinja sua meta', Icon: FinimpIcon },
  { id: 'giro', title: 'Capital de Giro', sub: 'Parcelas, juros e total a pagar', Icon: GiroIcon },
  { id: 'cdc', title: 'CDC', sub: 'Financiamento de veículo: parcela, IOF e cronograma', Icon: CdcIcon },
  { id: 'analise-desconto', title: 'Análise de desconto', sub: 'Compare títulos com giro Price', Icon: DescontoIcon },
  { id: 'investimentos', title: 'CDB, Fundos e Ações', sub: 'Comparar ativos, simular carteiras e calcular rentabilidade', Icon: OperacaoDiIcon },
  { id: 'faturamento', title: 'Faturamento', sub: 'Cole o faturamento e o endividamento e compare com o ano anterior', Icon: FaturamentoIcon },
]

// Aba Calculadoras: lista de calculadoras (ícones) e a calculadora aberta, com endereço próprio (#calculadora/giro).
function formulario({ view, onView, quotes, apresentacao = false }) {
  if (view === 'cbs-caixa') return <CbsCaixa onBack={() => onView('')} />
  if (view === 'bndes-tlp-exigivel') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-credito-tfb') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-selic-lcd') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'finimp') return <FinimpComparacao onBack={() => onView('')} />
  if (view === 'investimentos' || view?.startsWith('investimentos?')) {
    return <Investimentos key={view} comparisonLink={view.slice('investimentos?'.length)} onBack={() => onView('')} />
  }
  if (view === 'conta-garantida') return <ContaGarantida onBack={() => onView('')} />
  if (view === 'comparador-credito') return <CreditComparison onBack={() => onView('')} apresentacao={apresentacao} />
  if (view === 'operacao-di') return <OperacaoDi onBack={() => onView('')} />
  if (view === 'emprestimo-4131') return <Emprestimo4131 onBack={() => onView('')} quotes={quotes} apresentacao={apresentacao} />
  if (view === 'cambio-futuro') return <CambioFuturoJornada onBack={() => onView('')} quotes={quotes} />
  if (view === 'cambio-futuro/cenarios') return <CambioFuturoCenario onBack={() => onView('cambio-futuro')} quotes={quotes} />
  if (view === 'cambio-futuro/tir-usd') return <CambioFuturo onBack={() => onView('cambio-futuro')} quotes={quotes} />
  if (view === 'cdi-dolar') return <CdiDolar onBack={() => onView('')} quotes={quotes} />
  if (view === 'dividendos-emprestimo') return <DividendosEmprestimo onBack={() => onView('')} />
  if (view === 'giro') return <CapitalDeGiro onBack={() => onView('')} apresentacao={apresentacao} />
  if (view === 'cdc') return <Cdc onBack={() => onView('')} />
  if (view === 'analise-desconto') return <AnaliseDesconto onBack={() => onView('')} apresentacao={apresentacao} />
  if (view === 'faturamento') return <Faturamento onBack={() => onView('')} />
  // Árvore de Crédito: fora do menu e da busca (decisão de Fernando, 18/11/2026); abre só pelo endereço #calculadora/arvore-credito ou pelo atalho ARVORE.
  if (view === 'arvore-credito') return <ArvoreCredito onBack={() => onView('')} onView={onView} />
  if (view === 'finame-materiais') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} apresentacao={apresentacao} />
  return null
}

// As três em destaque no topo (premissa: as primeiras da lista; ajustar quando houver dado de uso).
export const MAIS_USADAS = ['finame-materiais', 'comparador-credito', 'giro']
const semAcento = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const byId = id => CALCS.find(calc => calc.id === id)
// Grupos da primeira tela sem repetir as "Mais usadas"; grupo que ficar vazio sai da lista.
const GRUPOS_SEM_DESTAQUE = CALCULATOR_GROUPS
  .map(group => ({ ...group, calculators: group.calculators.filter(id => !MAIS_USADAS.includes(id)) }))
  .filter(group => group.calculators.length)

function Tile({ calc: { id, title, sub, Icon }, onView }) {
  return <button type="button" className="cx-tile" onClick={() => onView(id)} aria-label={`${title}: abrir calculadora`}>
    <span className="cx-icon" aria-hidden="true"><Icon /></span>
    <span className="cx-tile-text"><b>{title}</b><small>{sub}</small></span>
    <span className="cx-go" aria-hidden="true">›</span>
  </button>
}

// Lista da primeira tela, sem estado próprio: a busca filtra por nome e descrição, sem acento.
export function CatalogoLista({ query = '', onQuery = () => {}, onView }) {
  const term = semAcento(query.trim())
  const found = term ? CALCS.filter(calc => semAcento(`${calc.title} ${calc.sub}`).includes(term)) : []
  return (
    <section className="cx bw calc-workspace calc-catalog calc-catalog-v2" aria-labelledby="calc-title">
      <div className="bw-heading calc-workspace-heading calc-catalog-head">
        <h2 id="calc-title">Calculadoras</h2>
        <input className="calc-catalog-search" type="search" value={query} onChange={event => onQuery(event.target.value)}
          placeholder="Buscar calculadora (ex.: giro, 4131, CDI)" aria-label="Buscar calculadora" autoComplete="off" />
      </div>
      <p className="cx-construcao" role="note"><strong>Em construção!</strong> Os cálculos podem conter erros. Use somente para estudo.</p>
      {term ? <section className="calc-catalog-group calc-catalog-found" aria-labelledby="calc-group-busca">
        <h3 id="calc-group-busca">{found.length ? `Resultado da busca (${found.length})` : 'Nenhuma calculadora encontrada'}</h3>
        <div className="cx-tiles">{found.map(calc => <Tile key={calc.id} calc={calc} onView={onView} />)}</div>
      </section> : <div className="calc-catalog-groups">
        <section className="calc-catalog-group calc-catalog-top" aria-labelledby="calc-group-mais-usadas">
          <div className="calc-catalog-group-head"><h3 id="calc-group-mais-usadas">Mais usadas</h3><a className="calc-bndes-rates" aria-label="Taxas BNDES · consultar séries e históricos" href="#bndes">Taxas BNDES ›</a></div>
          <div className="cx-tiles">{MAIS_USADAS.map(id => <Tile key={id} calc={byId(id)} onView={onView} />)}</div>
        </section>
        {GRUPOS_SEM_DESTAQUE.map(group => (
          <section key={group.id} className="calc-catalog-group" aria-labelledby={`calc-group-${group.id}`}>
            <h3 id={`calc-group-${group.id}`}>{group.title}</h3>
            <div className="cx-tiles">{group.calculators.map(id => <Tile key={id} calc={byId(id)} onView={onView} />)}</div>
          </section>
        ))}
      </div>}
    </section>
  )
}

function Catalogo({ onView }) {
  const [query, setQuery] = useState('')
  return <CatalogoLista query={query} onQuery={setQuery} onView={onView} />
}

export default function Calculadora(props) {
  const form = formulario(props)
  if (form) return <Suspense fallback={<p className="status" role="status">Carregando calculadora…</p>}>{form}</Suspense>
  return <Catalogo onView={props.onView} />
}
