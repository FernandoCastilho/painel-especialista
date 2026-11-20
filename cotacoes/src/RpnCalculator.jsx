import { useId, useState } from 'react'
import { createRpnEngine } from './rpnEngine.mjs'
import { rpnKeyFromEvent } from './rpnKeyboard.mjs'
import './RpnCalculator.css'

const keys = [
  ['clearAll', 'Limpar', 'Limpar pilha'], ['clearEntry', 'CLx', 'Limpar X'],
  ['swap', 'X↔Y', 'Trocar X e Y'], ['drop', '↓', 'Descer pilha'],
  ['lastX', 'LAST X', 'Recuperar último X'], ['sqrt', '√', 'Raiz quadrada'],
  ['power', 'Yˣ', 'Potência: Y elevado a X'], ['percent', '%', 'Porcentagem'],
  ['7'], ['8'], ['9'], ['divide', '÷', 'Dividir'],
  ['4'], ['5'], ['6'], ['multiply', '×', 'Multiplicar'],
  ['1'], ['2'], ['3'], ['subtract', '−', 'Subtrair'],
  ['0'], ['decimal', ',', 'Vírgula decimal'], ['changeSign', '±', 'Trocar sinal'], ['add', '+', 'Somar'],
  ['enter', 'ENTER', 'Enter: separar os números'],
]
const finance = [
  ['n', 'n', 'Número de períodos'],
  ['i', 'i', 'Taxa por período (%)'],
  ['pv', 'VP', 'Valor presente'],
  ['pmt', 'PGTO', 'Pagamento periódico'],
  ['fv', 'VF', 'Valor futuro'],
]
const fmt = new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 12 })
const show = value => Number.isFinite(value) ? fmt.format(value) : '—'
const engineError = 'Não foi possível usar a calculadora. Abra a seção novamente para reiniciar.'

export default function RpnCalculator() {
  const helpId = useId()
  const headingId = useId()
  const [unit] = useState(() => {
    try {
      const engine = createRpnEngine()
      return { engine, initial: engine.snapshot() }
    } catch {
      return { engine: null, initial: { display: '—', message: engineError } }
    }
  })
  const [view, setView] = useState(unit.initial)
  const [failed, setFailed] = useState(false)
  const disabled = failed || !unit.engine
  const press = key => {
    if (disabled) return
    try {
      const section = key.startsWith('cash:') ? 'cash' : key.includes(':') || key === 'clearFinance' ? 'finance' : 'keypad'
      setView({ ...unit.engine.press(key), section })
    } catch {
      setView({ display: '—', message: engineError })
      setFailed(true)
    }
  }
  const onKeyDown = event => {
    if (disabled || event.defaultPrevented) return
    const key = rpnKeyFromEvent(event)
    if (!key) return
    event.preventDefault()
    press(key)
  }

  return (
    <section className="rpn-workspace" aria-labelledby={headingId} aria-describedby={helpId} tabIndex={0} onKeyDown={onKeyDown}>
      <header className="rpn-heading">
        <h1 id={headingId}>Calculadora RPN</h1>
        <p id={helpId}>Digite o primeiro número, pressione ENTER, digite o segundo e escolha a operação. Exemplo: 2 ENTER 3 +.</p>
      </header>
      <div className="rpn-console">
        <div className="rpn-controls">
          <div className="rpn-display">
            <span>Visor · X</span>
            <output aria-label="Resultado da calculadora">{view.display}</output>
          </div>
          <p className="rpn-message" role="status">{!['cash', 'finance'].includes(view.section) && view.message}</p>
          <div className="rpn-keypad" role="group" aria-label="Teclado da calculadora">
            {keys.map(([id, label = id, name = label]) => (
              <button key={id} type="button" className={id === 'enter' ? 'rpn-enter' : undefined}
                aria-label={name} disabled={disabled} onClick={() => press(id)}>{label}</button>
            ))}
          </div>
          <p className="rpn-keyboard-tip">Com foco na calculadora: números, vírgula ou ponto, Enter, +, −, × (*) e ÷ (/). Backspace apaga um dígito enquanto você digita; Delete limpa a pilha.</p>
        </div>
        <aside className="rpn-stack" aria-label="Pilha de valores">
          <h2>Pilha</h2>
          <dl>{['X', 'Y', 'Z', 'T'].map((label, i) => <div key={label}><dt>{label}</dt><dd>{i === 0 ? view.display : show(view.stack?.[i])}</dd></div>)}</dl>
        </aside>
      </div>

      <section className="rpn-finance" aria-label="Funções financeiras">
        <h2>Funções financeiras</h2>
        <p>Digite um valor e use Guardar. Para descobrir um valor, preencha os demais campos necessários e use Calcular. Use número inteiro de períodos. Taxa i e pagamentos usam o mesmo período. Valores recebidos são positivos; valores pagos, negativos.</p>
        <div className="rpn-finance-timing" role="group" aria-label="Momento do pagamento">
          <span>Pagamento</span>
          {[['end', 'Fim do período'], ['begin', 'Início do período']].map(([id, label]) => (
            <button key={id} type="button" disabled={disabled} aria-pressed={view.settings?.paymentTiming === id} onClick={() => press(`timing:${id}`)}>{label}</button>
          ))}
        </div>
        <ul className="rpn-registers" aria-label="Valores guardados">
          {finance.map(([id, short, name]) => <li key={id}>
            <div className="rpn-register-label"><strong>{short}</strong><span>{name}</span></div>
            <span className="rpn-register-value" aria-label={name}>{show(view.finance?.[id])}</span>
            <button type="button" disabled={disabled} aria-label={`Guardar: ${name}`} onClick={() => press(`store:${id}`)}>Guardar</button>
            <button type="button" disabled={disabled} aria-label={`Calcular: ${name}`} onClick={() => press(`solve:${id}`)}>Calcular</button>
          </li>)}
        </ul>
        <button type="button" disabled={disabled} onClick={() => press('clearFinance')}>Limpar campos financeiros</button>
        <div className="rpn-local-result" role="status">
          {view.section === 'finance' && <><strong>Visor atual: {view.display}</strong>{view.message && <span>{view.message}</span>}</>}
        </div>
        <div className="rpn-cash" role="group" aria-label="Fluxo de caixa">
          <h3>Fluxo de caixa</h3>
          <p>Adicione o valor inicial e depois um valor por período, em ordem. Entradas são positivas; saídas, negativas. O VPL usa a taxa guardada em i; a TIR é por período e pode ser ambígua.</p>
          <p>Para repetir o último fluxo, digite em X o total de ocorrências e use Repetir. O valor inicial não se repete.</p>
          <p>{view.cashFlows?.length ?? 0} {view.cashFlows?.length === 1 ? 'valor informado' : 'valores informados'}</p>
          {!!view.cashFlows?.length && <details>
            <summary>Ver valores informados</summary>
            <ol start={0}>{view.cashFlows.map((value, index) => <li key={index}>{show(value)}</li>)}</ol>
          </details>}
          <div className="rpn-cash-actions">
            <button type="button" disabled={disabled} onClick={() => press('cash:add')}>Adicionar X</button>
            <button type="button" disabled={disabled} onClick={() => press('cash:repeat')}>Repetir último fluxo</button>
            <button type="button" disabled={disabled} onClick={() => press('cash:npv')}>Calcular VPL</button>
            <button type="button" disabled={disabled} onClick={() => press('cash:irr')}>Calcular TIR</button>
            <button type="button" disabled={disabled} onClick={() => press('cash:clear')}>Limpar fluxo</button>
          </div>
          <div className="rpn-local-result" role="status">
            {view.section === 'cash' && <><strong>Visor atual: {view.display}</strong>{view.message && <span>{view.message}</span>}</>}
          </div>
        </div>
      </section>
    </section>
  )
}
