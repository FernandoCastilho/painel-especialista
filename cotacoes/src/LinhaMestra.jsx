// Quadro "Linha mestra · necessidade do cliente", igual no Comparador de Crédito, Capital de Giro, Conta Garantida
// e Análise de desconto (pedido de 19/11/2026). Mostra só os campos que valem para cada produto.
// Os campos próprios de cada calculadora entram como filhos, no fim do quadro.
import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA } from './pracaContrato.js'
import { lmClear, lmLoad, lmSave } from './linhaMestra.js'
import './LinhaMestra.css'

const SYSTEMS = [['price', 'Price'], ['sac', 'SAC'], ['bullet', 'Bullet capitalizado']]
const LABELS = { value: 'Valor da operação', term: 'Prazo total', grace: 'Carência', system: 'Amortização', start: 'Data da liberação', praca: 'Praça do contrato' }

export default function LinhaMestra({ prefix, values, onChange, fields = ['value', 'term', 'grace', 'system', 'start', 'praca'], labels = {}, errors = {}, note, onClear, children }) {
  const id = key => `${prefix}-${key}`
  const label = key => labels[key] ?? LABELS[key]
  const invalid = key => errors[key] ? { 'aria-invalid': true, 'aria-describedby': `${id(key)}-err` } : {}
  const issue = key => errors[key] ? <small id={`${id(key)}-err`} className="lm-error" role="alert">{errors[key]}</small> : null
  const months = key => <div className="lm-unit"><input id={id(key)} inputMode="numeric" autoComplete="off" value={values[key] ?? ''} {...invalid(key)}
    onChange={e => onChange(key, e.target.value.replace(/\D/g, '').slice(0, 3))} /><span aria-hidden="true">meses</span></div>
  const control = {
    value: () => <MoneyInput id={id('value')} value={values.value ?? ''} {...invalid('value')} onChange={v => onChange('value', v)} />,
    term: () => months('term'),
    grace: () => values.system === 'bullet'
      ? <input id={id('grace')} disabled value="" placeholder="Pagamento único" />
      : months('grace'),
    system: () => <select id={id('system')} value={values.system ?? 'price'} onChange={e => onChange('system', e.target.value)}>{SYSTEMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>,
    start: () => <input id={id('start')} type="date" max="9999-12-31" value={values.start ?? ''} {...invalid('start')} onChange={e => onChange('start', e.target.value)} />,
    praca: () => <select id={id('praca')} value={values.praca ?? PRACA_PADRAO} onChange={e => onChange('praca', e.target.value)}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>,
  }
  return <section className="lm" aria-labelledby={`${prefix}-lm-title`}>
    <header className="lm-head">
      <h3 id={`${prefix}-lm-title`}>Linha mestra · necessidade do cliente</h3>
      <div className="lm-head-side">
        {note && <small>{note}</small>}
        {onClear && <button type="button" className="lm-clear" onClick={onClear}>Limpar</button>}
      </div>
    </header>
    <div className="lm-grid">
      {fields.map(key => <div className="lm-field" key={key}>
        <span className="lm-label"><label htmlFor={id(key)}>{label(key)}</label>
          {key === 'praca' && <CalculatorHelp title="Praça do contrato (feriados)"><p>{PRACA_AJUDA}</p><p>{PRACA_RESSALVA}</p></CalculatorHelp>}
          {key === 'grace' && <CalculatorHelp title="Carência"><p>Meses sem amortização, dentro do prazo total. Exemplo: 24 meses com 6 de carência = 18 parcelas, e a primeira vence 7 meses depois da liberação. Os juros da carência são somados ao saldo.</p></CalculatorHelp>}
        </span>
        {control[key]()}
        {issue(key)}
      </div>)}
      {children}
    </div>
    <p className="lm-foot">Os valores da linha mestra valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.</p>
  </section>
}

// Estado da linha mestra numa tela: lê o que já foi digitado nesta aba e grava a cada mudança. "Limpar" volta ao padrão.
export function useLinhaMestra(today) {
  const [values, setValues] = useState(() => lmLoad(today))
  const change = (key, value) => setValues(old => { const next = { ...old, [key]: value }; lmSave(next); return next })
  const reset = () => { lmClear(); setValues(lmLoad(today)) }
  return [values, change, reset]
}
