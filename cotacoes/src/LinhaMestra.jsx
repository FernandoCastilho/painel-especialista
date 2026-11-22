// Quadro "Linha mestra · necessidade do cliente", igual no Comparador de Crédito, Capital de Giro, Conta Garantida
// e Análise de desconto (pedido de 19/11/2026). Mostra só os campos que valem para cada produto.
// Os campos próprios de cada calculadora entram como filhos, no fim do quadro.
// `details` (piloto do Capital de Giro, 21/11/2026) guarda numa gaveta "Detalhes do contrato" o que quase nunca muda.
// Tela limpa (21/11/2026): `help` (opcional) põe um "?" ao lado do título com a explicação do quadro; `foot={null}` tira a
// frase do rodapé (quem usa passa a frase para dentro do `help`). Sem essas propriedades, o quadro fica como era.
import { useEffect, useRef, useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import CalculatorHelp from './CalculatorHelp.jsx'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA } from './pracaContrato.js'
import { lmClear, lmLoad, lmSave } from './linhaMestra.js'
import './LinhaMestra.css'

const SYSTEMS = [['price', 'Price'], ['sac', 'SAC'], ['bullet', 'Bullet capitalizado']]
const LABELS = { value: 'Valor da operação', term: 'Prazo total', grace: 'Carência', system: 'Amortização', start: 'Data da liberação', praca: 'Praça do contrato' }
const FOOT = 'Os valores da linha mestra valem também nas outras calculadoras de empréstimo, até você fechar esta aba. Ficam só neste navegador.'

export default function LinhaMestra({ prefix, title = 'Linha mestra · necessidade do cliente', values, onChange, fields = ['value', 'term', 'grace', 'system', 'start', 'praca'], labels = {}, errors = {}, note, onClear, foot = FOOT, help, details, children }) {
  const id = key => `${prefix}-${key}`
  const label = key => labels[key] ?? LABELS[key]
  const invalid = key => ({ 'aria-invalid': !!errors[key], ...(errors[key] ? { 'aria-describedby': `${id(key)}-err` } : {}) })
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
  const field = key => <div className="lm-field" key={key}>
    <span className="lm-label"><label htmlFor={id(key)}>{label(key)}</label>
      {key === 'praca' && <CalculatorHelp title="Praça do contrato (feriados)"><p>{PRACA_AJUDA}</p><p>{PRACA_RESSALVA}</p></CalculatorHelp>}
      {key === 'grace' && <CalculatorHelp title="Carência"><p>Meses sem amortização, dentro do prazo total. Exemplo: 24 meses com 6 de carência = 18 parcelas, e a primeira vence 7 meses depois da liberação. Os juros da carência são somados ao saldo, salvo onde a calculadora tiver a opção de pagá-los no período.</p></CalculatorHelp>}
    </span>
    {control[key]()}
    {issue(key)}
  </div>
  // A gaveta abre sozinha quando um campo dela tem erro, para o aviso não ficar escondido.
  const drawer = useRef(null)
  useEffect(() => { if (details?.alert && drawer.current) drawer.current.open = true }, [details?.alert])
  return <section className="lm" aria-labelledby={`${prefix}-lm-title`}>
    <header className="lm-head">
      {help ? <div className="lm-head-title"><h3 id={`${prefix}-lm-title`}>{title}</h3><CalculatorHelp title={help.title}>{help.children}</CalculatorHelp></div>
        : <h3 id={`${prefix}-lm-title`}>{title}</h3>}
      <div className="lm-head-side">
        {note && <small>{note}</small>}
        {onClear && <button type="button" className="lm-clear" onClick={onClear}>Limpar</button>}
      </div>
    </header>
    <div className="lm-grid">
      {fields.map(field)}
      {children}
    </div>
    {details && <details className="lm-details" ref={drawer} open={details.open}>
      <summary>Detalhes do contrato{details.summary && <small> · {details.summary}</small>}{details.alert && <small className="lm-error"> · há um campo a conferir aqui</small>}</summary>
      <div className="lm-grid">{details.fields.map(field)}{details.children}</div>
    </details>}
    {foot && <p className="lm-foot">{foot}</p>}
  </section>
}

// Estado da linha mestra numa tela: lê o que já foi digitado nesta aba e grava a cada mudança. "Limpar" volta ao padrão.
export function useLinhaMestra(today) {
  const [values, setValues] = useState(() => lmLoad(today))
  const change = (key, value) => setValues(old => { const next = { ...old, [key]: value }; lmSave(next); return next })
  const reset = () => { lmClear(); setValues(lmLoad(today)) }
  return [values, change, reset]
}
