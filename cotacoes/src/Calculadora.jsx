import { CALCULATOR_GROUPS } from './calculatorGroups.js'
import CapitalDeGiro from './CapitalDeGiro.jsx'
import './CalculatorStandard.css'
import './Calculadora.css'
import FinimpComparacao, { FinimpIcon } from './FinimpComparacao.jsx'
import { FinameIcon } from './FinameMateriais.jsx'
import BndesWorkspace from './BndesWorkspace.jsx'
import ContaGarantida, { ContaGarantidaIcon } from './ContaGarantida.jsx'
import AnaliseDesconto, { DescontoIcon } from './AnaliseDesconto.jsx'
import './CalculatorLayout.css'
import CreditComparison, { CreditIcon } from './CreditComparison.jsx'
import CbsCaixa, { CbsIcon } from './CbsCaixa.jsx'
import OperacaoDi, { OperacaoDiIcon } from './OperacaoDi.jsx'
import Emprestimo4131, { Emprestimo4131Icon } from './Emprestimo4131.jsx'
import Faturamento, { FaturamentoIcon } from './Faturamento.jsx'
import ArvoreCredito from './ArvoreCredito.jsx'
import CdiDolar, { CdiDolarIcon } from './CdiDolar.jsx'
import CambioFuturo, { CambioFuturoIcon } from './CambioFuturo.jsx'
import CambioFuturoCenario from './CambioFuturoCenario.jsx'
import DividendosEmprestimo, { DividendosEmprestimoIcon } from './DividendosEmprestimo.jsx'
import './CalculatorTheme.css'

// Ícone do Capital de Giro: pilha de moedas com a seta de retorno do caixa.
function GiroIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="9" cy="6.5" rx="5.5" ry="2.5" />
      <path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-4" />
      <path d="M3.5 10.5v4c0 1.4 2.5 2.5 5.5 2.5 1 0 1.9-.1 2.7-.4" />
      <path d="M21 13.5a4.5 4.5 0 10-1.3 3.2" />
      <path d="M21 10.5v3h-3" />
    </svg>
  )
}

const CALCS = [
  { id: 'finame-materiais', title: 'BNDES', sub: 'Simular Finame, comparar custos e consultar taxas', Icon: FinameIcon },
  { id: 'comparador-credito', title: 'Necessidade do Cliente', sub: 'De 1 a 5 operações: cotação, custo, CET e fluxo', Icon: CreditIcon },
  { id: 'operacao-di', title: 'Operação x DI', sub: 'Pré, % do CDI ou CDI + spread contra o DI da curva B3', Icon: OperacaoDiIcon },
  { id: 'cbs-caixa', title: 'Reforma tributária · caixa', sub: 'CBS, IBS, créditos e necessidade adicional de giro', Icon: CbsIcon },
  { id: 'conta-garantida', title: 'Conta Garantida', sub: 'Juros e IOF sobre saldos', Icon: ContaGarantidaIcon },
  { id: 'cdi-dolar', title: 'CDI x Dólar', sub: 'Em quanto tempo o CDI líquido alcança a alta do dólar', Icon: CdiDolarIcon },
  { id: 'dividendos-emprestimo', title: 'Dividendos via empréstimo', sub: 'Lucro real: eficiência de pagar o dividendo com crédito na empresa', Icon: DividendosEmprestimoIcon },
  { id: 'emprestimo-4131', title: 'Empréstimo externo (4131)', sub: 'No formato da cotação: dólar ou euro, parcelas e NDF', Icon: Emprestimo4131Icon },
  { id: 'cambio-futuro', title: 'Câmbio futuro', sub: 'Compare com e sem trava até 5 parcelas em euro ou yuan', Icon: CambioFuturoIcon },
  { id: 'finimp', title: 'FINIMP', sub: 'Compare propostas e atinja sua meta', Icon: FinimpIcon },
  { id: 'giro', title: 'Capital de Giro', sub: 'Parcelas, juros e total a pagar', Icon: GiroIcon },
  { id: 'analise-desconto', title: 'Análise de desconto', sub: 'Compare títulos com giro Price', Icon: DescontoIcon },
  { id: 'faturamento', title: 'Faturamento', sub: 'Cole o faturamento e o endividamento e compare com o ano anterior', Icon: FaturamentoIcon },
]

// Aba Calculadoras: lista de calculadoras (ícones) e a calculadora aberta, com endereço próprio (#calculadora/giro).
export default function Calculadora({ view, onView, quotes, apresentacao = false }) {
  if (view === 'cbs-caixa') return <CbsCaixa onBack={() => onView('')} />
  if (view === 'bndes-tlp-exigivel') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-credito-tfb') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'bndes-selic-lcd') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  if (view === 'finimp') return <FinimpComparacao onBack={() => onView('')} />
  if (view === 'conta-garantida') return <ContaGarantida onBack={() => onView('')} />
  if (view === 'comparador-credito') return <CreditComparison onBack={() => onView('')} />
  if (view === 'operacao-di') return <OperacaoDi onBack={() => onView('')} />
  if (view === 'emprestimo-4131') return <Emprestimo4131 onBack={() => onView('')} quotes={quotes} />
  if (view === 'cambio-futuro') return <CambioFuturoCenario onBack={() => onView('')} quotes={quotes} />
  if (view === 'cambio-futuro/tir-usd') return <CambioFuturo onBack={() => onView('cambio-futuro')} quotes={quotes} />
  if (view === 'cdi-dolar') return <CdiDolar onBack={() => onView('')} quotes={quotes} />
  if (view === 'dividendos-emprestimo') return <DividendosEmprestimo onBack={() => onView('')} />
  if (view === 'giro') return <CapitalDeGiro onBack={() => onView('')} apresentacao={apresentacao} />
  if (view === 'analise-desconto') return <AnaliseDesconto onBack={() => onView('')} apresentacao={apresentacao} />
  if (view === 'faturamento') return <Faturamento onBack={() => onView('')} />
  // Árvore de Crédito: fora do menu e da busca (decisão de Fernando, 18/11/2026); abre só pelo endereço #calculadora/arvore-credito ou pelo atalho ARVORE.
  if (view === 'arvore-credito') return <ArvoreCredito onBack={() => onView('')} onView={onView} />
  if (view === 'finame-materiais') return <BndesWorkspace profile={view} onView={onView} onBack={() => onView('')} />
  return (
    <section className="cx bw calc-workspace calc-catalog" aria-labelledby="calc-title">
      <a className="calc-bndes-rates" href="#bndes">Taxas BNDES · consultar séries e históricos</a>
      <div className="bw-heading calc-workspace-heading"><h2 id="calc-title"><span>Calculadoras</span></h2></div>
      <p className="cx-construcao" role="note"><strong>Em construção!</strong> Os cálculos podem conter erros. Use somente para estudo.</p>
      <div className="calc-catalog-groups">
        {CALCULATOR_GROUPS.map(group => (
          <section key={group.id} className="calc-catalog-group" aria-labelledby={`calc-group-${group.id}`}>
            <h3 id={`calc-group-${group.id}`}>{group.title}</h3>
            <p className="calc-group-description">{group.description}</p>
            <div className="cx-tiles">
        {group.calculators.map(calcId => CALCS.find(calc => calc.id === calcId)).map(({ id, title, sub, Icon }) => (
          <button key={id} type="button" className="cx-tile" onClick={() => onView(id)} aria-label={`${title}: abrir calculadora`}>
            <span className="cx-icon" aria-hidden="true"><Icon /></span>
            <span className="cx-tile-text"><b>{title}</b><small>{sub}</small></span>
            <span className="cx-go" aria-hidden="true">›</span>
          </button>
        ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
