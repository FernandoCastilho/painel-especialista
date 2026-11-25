import { useState } from 'react'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import CalcBack from './CalcBack.jsx'
import EmailEnvelope from './OutlookEnvelope.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import { cdcConta } from './cdcConta.js'
import { cdcEmailLink } from './cdcEmail.js'
import { Respostas, Resultado, step } from './Roteiro.jsx'
import './CalculatorStandard.css'
import './LinhaMestra.css'
import './CapitalDeGiro.css'

// CDC (financiamento de veículo): reconstrução da planilha de CDC de Fernando (25/11/2026). Ficaram de fora, a pedido dele,
// os botões de buscar dados e de preencher dados do sistema; os campos de identificação (proposta, CNPJ, gerente) também,
// porque são dado de cliente. A conta está em cdcConta.js.
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = v => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dmy = iso => iso.split('-').reverse().join('/')
const TARIFAS = [['cadastro', 'Tarifa de cadastro'], ['avaliacao', 'Tarifa de avaliação de bens'], ['registro', 'Registro de contrato']]
const SEGUROS = [['spf', 'Seguro proteção financeira'], ['seguroAuto', 'Seguro auto'], ['socorro', 'Socorro auto']]
const INICIAL = { categoria: 'Pesado', anoModelo: String(new Date().getFullYear()), zeroKm: true, valorBem: '500.000,00', valorLiberado: '500.000,00',
  carencia: '30', prazo: '48', taxa: '1,55', inicio: cgToday(),
  cadastro: '2.523,00', avaliacao: '0,00', registro: '0,00', spf: '0,00', seguroAuto: '0,00', socorro: '0,00' }

export default function Cdc({ onBack }) {
  const [form, setForm] = useState(INICIAL)
  const [dirty, setDirty] = useState(false)
  const [copiaFalhou, setCopiaFalhou] = useState(false)
  const set = (key, value) => { setForm(old => ({ ...old, [key]: value })); setDirty(true) }
  const money = key => parseMoneyInput(form[key], { optional: !['valorBem', 'valorLiberado'].includes(key) })
  const int = key => /^\d+$/.test(String(form[key]).trim()) ? Number(form[key]) : NaN
  const valores = Object.fromEntries([...TARIFAS, ...SEGUROS, ['valorBem'], ['valorLiberado']].map(([key]) => [key, money(key)]))
  const erroValor = Object.entries(valores).find(([, v]) => !v.ok)
  const taxa = parseDecimal(form.taxa)
  const soma = keys => keys.reduce((s, [key]) => s + (valores[key].ok ? valores[key].value : 0), 0)
  const calc = dirty ? null : erroValor ? { ok: false, error: valores[erroValor[0]].error } : cdcConta({
    valorBem: valores.valorBem.value, valorLiberado: valores.valorLiberado.value, tarifas: soma(TARIFAS), seguros: soma(SEGUROS),
    taxa: taxa ?? NaN, prazo: int('prazo'), carenciaDias: int('carencia'), inicio: form.inicio })
  const r = calc?.ok ? calc : null
  const alerta = r ? null : { error: !!calc?.error, warning: !!calc?.error, text: calc?.error || 'Clique em Simular para atualizar o resultado.' }
  const email = r ? cdcEmailLink({ result: r, info: { ...form, carenciaDias: int('carencia'),
    ...Object.fromEntries([...TARIFAS, ...SEGUROS].map(([key]) => [key, valores[key].value])) } }) : undefined
  const campo = (key, label, input) => <div className="lm-field" key={key}>
    <span className="lm-label"><label htmlFor={`cdc-${key}`}>{label}</label></span>{input}</div>
  const texto = (key, label, mode = 'numeric') => campo(key, label, <input id={`cdc-${key}`} inputMode={mode} value={form[key]} onChange={e => set(key, e.target.value)} />)
  const dinheiro = (key, label) => campo(key, label, <MoneyInput id={`cdc-${key}`} value={form[key]} onChange={v => set(key, v)} />)

  return <section className="cx bw calc-standard calc-workspace giro-screen cdc-screen" aria-labelledby="calc-h">
    <div className="bw-heading calc-workspace-heading giro-header">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="calc-h" className="cx-title"><span>CDC</span></h2></div>
      <Help title="CDC: cálculo e premissas">
        <p>Reconstrução da planilha de CDC. Valor financiado = valor liberado + tarifas + seguros + IOF, tudo financiado.</p>
        <p>A 1ª parcela vence na liberação + carência (em dias); as seguintes no mesmo dia dos meses seguintes, sem mudar para dia útil.</p>
        <p>Juros de cada parcela = saldo × ((1 + taxa ao mês) elevado a dias corridos do período ÷ 30, menos 1). Parcela fixa, que zera o saldo na última; a última acerta os centavos.</p>
        <p>Coeficiente = parcela ÷ (valor liberado + tarifas + seguros). % de entrada = (valor do bem − valor liberado) ÷ valor do bem.</p>
        <p>IOF adicional: 0,38% sobre valor liberado + tarifas + seguros. IOF sobre as parcelas: 0,0082% ao dia sobre a amortização de cada parcela, pelos dias até o vencimento, com limite de 365 dias. O IOF é financiado e entra no próprio saldo.</p>
        <p>Retorno, spread, taxa net e score da revenda vêm das tabelas do sistema e não entram nesta versão.</p>
        <p>O envelope prepara um e-mail no Outlook com a entrada, a saída e as parcelas.</p>
      </Help>
    </div>

    <div className="giro-flow">
      <form className="giro-form" noValidate onSubmit={e => { e.preventDefault(); setDirty(false) }}>
        <section className="lm" aria-labelledby="cdc-op">
          <header className="lm-head"><h3 id="cdc-op">{step(1, 'Entrada')}</h3>
            <div className="lm-head-side"><button type="button" className="lm-clear" onClick={() => { setForm(INICIAL); setDirty(true) }}>Limpar</button></div>
          </header>
          <div className="lm-grid">
            {campo('categoria', 'Categoria', <select id="cdc-categoria" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {['Leve', 'Pesado'].map(c => <option key={c}>{c}</option>)}</select>)}
            {texto('anoModelo', 'Ano modelo')}
            {campo('zeroKm', 'Zero km?', <select id="cdc-zeroKm" value={form.zeroKm ? 'sim' : 'nao'} onChange={e => set('zeroKm', e.target.value === 'sim')}>
              <option value="sim">Sim</option><option value="nao">Não</option></select>)}
            {dinheiro('valorBem', 'Valor do bem')}
            {dinheiro('valorLiberado', 'Valor liberado')}
            {texto('prazo', 'Prazo (parcelas)')}
            {texto('carencia', 'Carência (dias)')}
            {texto('taxa', 'Taxa (% a.m.)', 'decimal')}
            {campo('inicio', 'Liberação', <input id="cdc-inicio" type="date" value={form.inicio} onChange={e => set('inicio', e.target.value)} />)}
          </div>
        </section>
        <section className="lm" aria-labelledby="cdc-tarifas">
          <header className="lm-head"><h3 id="cdc-tarifas">{step(2, 'Tarifas e seguros')}</h3><div className="lm-head-side"><small>financiados</small></div></header>
          <div className="lm-grid">{[...TARIFAS, ...SEGUROS].map(([key, label]) => dinheiro(key, label))}</div>
        </section>
        <button className={`giro-simulate${dirty ? ' is-pending' : ''}`} type="submit">Simular</button>
      </form>

      <div className="rt-outcome giro-outcome calc-result-shell" aria-live="polite">
        <Resultado id="cdc-result-title" number={3} title="Saída" className="giro-result" alert={alerta}>
          <Respostas items={[
            { question: 'Valor da parcela', value: r ? brl(r.parcela) : '—', note: r ? `${r.rows.length} parcelas mensais` : 'Parcela fixa', main: true },
            { question: 'Taxa', value: r ? `${pct(r.taxa / 100)} a.m.` : '—', note: r ? `% de entrada: ${pct(r.pctEntrada)}` : null },
            { question: 'Coeficiente', value: r ? r.coeficiente.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 }) : '—', note: 'Parcela ÷ (liberado + tarifas + seguros)' },
            { question: 'Datas', value: r ? `${dmy(r.primeira)} a ${dmy(r.ultima)}` : '—', note: '1ª e última parcela' },
          ]} />
          <dl className="rt-parts">
            <div><dt>Valor SPF</dt><dd>{r ? brl(valores.spf.value) : '—'}</dd></div>
            <div><dt>IOF adicional</dt><dd>{r ? brl(r.iofAdicional) : '—'}</dd></div>
            <div><dt>IOF sobre parcelas</dt><dd>{r ? brl(r.iofDiario) : '—'}</dd></div>
            <div className="rt-total"><dt>IOF total</dt><dd>{r ? brl(r.iof) : '—'}</dd></div>
            <div className="rt-muted"><dt>Valor financiado</dt><dd>{r ? brl(r.principal) : '—'}</dd></div>
            <div className="rt-muted"><dt>Total das parcelas</dt><dd>{r ? brl(r.paid) : '—'}</dd></div>
          </dl>
        </Resultado>
        <EmailEnvelope href={email?.href} copiar={email?.copiar} onFalha={setCopiaFalhou} />
        {copiaFalhou && email?.copiar && <small className="giro-copia" role="alert">O navegador não deixou copiar o cronograma para o e-mail. Copie de "Ver parcelas".</small>}
      </div>
    </div>

    {r ? <details className="giro-installments">
      <summary>Ver parcelas</summary>
      <div className="giro-table-scroll" role="region" aria-label="Cronograma de pagamentos" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Mês</th><th scope="col">Data pagto</th><th scope="col">Saldo</th><th scope="col">Amortização</th><th scope="col">Juros</th><th scope="col">Parcela</th></tr></thead>
          <tbody>
            <tr><th scope="row">0</th><td>{dmy(form.inicio)}</td><td>{brl(r.principal)}</td><td>{brl(0)}</td><td>{brl(0)}</td><td>{brl(0)}</td></tr>
            {r.rows.map(row => <tr key={row.number}><th scope="row">{row.number}</th><td>{dmy(row.date)}</td><td>{brl(row.balance)}</td>
              <td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td></tr>)}
          </tbody>
          <tfoot><tr><th scope="row" colSpan={5}>Total das parcelas</th><td>{brl(r.paid)}</td></tr></tfoot>
        </table>
      </div>
    </details> : <button className="giro-installments giro-installments-disabled" type="button" disabled>Ver parcelas</button>}
  </section>
}
