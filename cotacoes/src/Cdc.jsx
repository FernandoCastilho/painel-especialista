import { useRef, useState } from 'react'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import CalcBack from './CalcBack.jsx'
import { EnvelopeEml } from './EmailEnvelope.jsx'
import WhatsAppCotacao from './WhatsAppCotacao.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { cgToday } from './contaGarantida.js'
import PracaContratoBusca from './PracaContratoBusca.jsx'
import { PRACA_AJUDA, pracaCalendars, pracaContrato } from './pracaContrato.js'
import { lmLoad, lmSave } from './linhaMestra.js'
import { CdcIcon } from './CalculatorIcons.jsx'
import { cdcConta } from './cdcConta.js'
import { cdcEml, cdcResumo } from './cdcEmail.js'
import { cdcImagem } from './cdcImagem.js'
import { carregarFunding, fundingDoPrazo, guardarFunding, lerFunding, spreadDaTaxa, taxaDoSpread, vigenciaDeHoje } from './cdcFunding.js'
import { Respostas, Resultado, step } from './Roteiro.jsx'
import './CalculatorStandard.css'
import './LinhaMestra.css'
import './CapitalDeGiro.css'
import './Cdc.css'

// CDC (financiamento de veículo): reconstrução da planilha de CDC de Fernando (25/11/2026), enxugada a pedido dele no mesmo
// dia: sem ano modelo, zero km, categoria, perfil de IOF (sempre PJ geral), seguros e tarifas além da de cadastro; data da
// simulação sempre a de hoje. Praça do contrato (feriados) igual à das outras calculadoras de crédito, guardada na linha mestra.
// Campos em grade horizontal (4 colunas no computador). A conta está em cdcConta.js; o funding colado, em cdcFunding.js.
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dmy = iso => iso.split('-').reverse().join('/')
const INICIAL = { valorBem: '500.000,00', valorLiberado: '500.000,00', carencia: '30', prazo: '48',
  modo: 'taxa', taxa: '1,55', spread: '4,00', cadastro: '2.523,00' }

// "!" discreto ao lado do "?": caixa para colar a tabela de funding copiada do Excel. Fica só nesta aba do navegador.
function FundingColar({ tabela, onTabela }) {
  const dialogo = useRef(null)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState('')
  const abrir = () => { setErro(''); dialogo.current?.showModal() }
  const fechar = () => dialogo.current?.close()
  const usar = () => {
    const lido = lerFunding(texto, cgToday())
    if (!lido.ok) { setErro(lido.error); return }
    guardarFunding(lido.tabela); onTabela(lido.tabela); setTexto(''); fechar()
  }
  const apagar = () => { guardarFunding(null); onTabela(null); setTexto(''); setErro('') }
  return <span className="fi-help cdc-funding">
    <button type="button" onClick={abrir} aria-haspopup="dialog" aria-label="Tabela de funding: colar ou atualizar" title="Tabela de funding">!</button>
    <dialog ref={dialogo} className="fi-help-dialog cdc-funding-dialog" aria-labelledby="cdc-funding-title" onCancel={e => { e.preventDefault(); fechar() }}>
      <h3 id="cdc-funding-title">Tabela de funding</h3>
      <p>No Excel, selecione a tabela FUNDING (dos prazos até as taxas), copie e cole aqui. Ela fica só nesta aba do navegador: fechou, apagou.</p>
      <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={8} aria-label="Colar a tabela de funding" placeholder={'6\t13,68%\t13,80%\t1,07%\t1,08%\n9\t13,96%\t14,12%\t1,09%\t1,11%'} />
      {erro && <small className="giro-error" role="alert">{erro}</small>}
      {tabela && <p className="cdc-funding-status">Em uso: {tabela.map(v => v.label).join(' · ')} · {Object.keys(tabela[0].taxas).length} prazos.</p>}
      <div className="cdc-funding-acoes">
        <button type="button" onClick={usar} disabled={!texto.trim()}>Usar esta tabela</button>
        {tabela && <button type="button" className="giro-link" onClick={apagar}>Apagar tabela</button>}
        <button type="button" className="fi-help-close" onClick={fechar}>Fechar</button>
      </div>
    </dialog>
  </span>
}

export default function Cdc({ onBack }) {
  const [form, setForm] = useState(INICIAL)
  const [dirty, setDirty] = useState(false)
  const [tabela, setTabela] = useState(carregarFunding)
  const [praca, setPraca] = useState(() => lmLoad(cgToday()).praca)
  const [vigencia, setVigencia] = useState(() => { const t = carregarFunding(); return t ? vigenciaDeHoje(t, cgToday()).id : '' })
  const hoje = cgToday()
  const set = (key, value) => { setForm(old => ({ ...old, [key]: value })); setDirty(true) }
  const trocarPraca = id => { setPraca(id); lmSave({ ...lmLoad(cgToday()), praca: id }); setDirty(true) }
  const trocarTabela = t => { setTabela(t); setVigencia(t ? vigenciaDeHoje(t, cgToday()).id : ''); setDirty(true) }
  const int = key => /^\d+$/.test(String(form[key]).trim()) ? Number(form[key]) : NaN
  const valores = { valorBem: parseMoneyInput(form.valorBem), valorLiberado: parseMoneyInput(form.valorLiberado), cadastro: parseMoneyInput(form.cadastro, { optional: true }) }
  const erroValor = Object.values(valores).find(v => !v.ok)
  // Taxa ou spread: um vem digitado e o outro sai do funding do prazo (conta reversa direta).
  const vig = tabela ? tabela.find(v => v.id === vigencia) ?? vigenciaDeHoje(tabela, hoje) : null
  const funding = vig && int('prazo') > 0 ? fundingDoPrazo(vig, int('prazo')) : null
  const vencida = vig?.fim && hoje > vig.fim
  const futura = vig && hoje < vig.inicio
  const digitado = parseDecimal(form.modo === 'taxa' ? form.taxa : form.spread)
  // Pelo spread, a taxa é arredondada a duas casas antes da conta (decisão de Fernando, 25/11/2026): o cliente vê a taxa usada.
  const taxa = form.modo === 'taxa' ? digitado : digitado !== null && funding ? Math.round(taxaDoSpread(digitado, funding.taxa) * 100) / 100 : null
  const spread = form.modo === 'taxa' && digitado !== null && funding ? spreadDaTaxa(digitado, funding.taxa) : null
  const erroTaxa = form.modo === 'spread' && !funding ? 'Para simular pelo spread, cole a tabela de funding no "!" lá em cima.' : null
  const calc = dirty ? null : erroValor ? { ok: false, error: erroValor.error } : erroTaxa ? { ok: false, error: erroTaxa } : cdcConta({
    valorBem: valores.valorBem.value, valorLiberado: valores.valorLiberado.value, tarifas: valores.cadastro.value,
    taxa: taxa ?? NaN, prazo: int('prazo'), carenciaDias: int('carencia'), inicio: hoje, calendars: pracaCalendars(praca) })
  const r = calc?.ok ? calc : null
  const alerta = r ? null : { error: !!calc?.error, warning: !!calc?.error, text: calc?.error || 'Clique em Simular para atualizar o resultado.' }
  const info = { carenciaDias: int('carencia'), dataSimulacao: hoje, praca: pracaContrato(praca)?.label }
  const fundingNota = funding ? `funding de ${pct(funding.taxa)} a.a.${funding.nota ? ` (${funding.nota})` : ''}${vencida ? ` · tabela vencida em ${dmy(vig.fim)}` : ''}${futura ? ` · tabela só vale a partir de ${dmy(vig.inicio)}` : ''}` : null
  const derivado = form.modo === 'taxa'
    ? (spread !== null ? `Spread: ${pct(spread)} a.a. sobre ${fundingNota}` : tabela ? '' : 'Para ver o spread, cole a tabela de funding no "!".')
    : (taxa !== null ? `Taxa: ${pct(taxa)} a.m. (${pct(((1 + taxa / 100) ** 12 - 1) * 100)} a.a.) · spread efetivo de ${pct(spreadDaTaxa(taxa, funding.taxa))} a.a. com a taxa arredondada · ${fundingNota}` : '')
  const campo = (key, label, input, nota) => <div className={`lm-field cdc-${key}`} key={key}>
    <span className="lm-label"><label htmlFor={`cdc-${key}`}>{label}</label></span>{input}{nota && <small className="cdc-nota">{nota}</small>}</div>
  const texto = (key, label, mode = 'numeric', nota) => campo(key, label, <input id={`cdc-${key}`} inputMode={mode} value={form[key]} onChange={e => set(key, e.target.value)} />, nota)
  const dinheiro = (key, label) => campo(key, label, <MoneyInput id={`cdc-${key}`} value={form[key]} onChange={v => set(key, v)} />)

  return <section className="cx bw calc-standard calc-workspace giro-screen cdc-screen" aria-labelledby="calc-h">
    <div className="bw-heading calc-workspace-heading giro-header">
      <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="calc-h" className="cx-title"><span className="cx-icon cdc-icon" aria-hidden="true"><CdcIcon /></span><span>CDC</span></h2></div>
      <span className="cdc-header-tools">
        <Help title="CDC: cálculo e premissas">
          <p>Reconstrução da planilha de CDC. Valor financiado = valor liberado + tarifa de cadastro + IOF, tudo financiado. A data da simulação é sempre a de hoje.</p>
          <p>A 1ª parcela vence na data da simulação + carência (em dias); as seguintes no mesmo dia dos meses seguintes. Vencimento em fim de semana, feriado nacional, feriado da praça do contrato ou 31/12 passa para o próximo dia útil, e juros e IOF contam até essa data.</p>
          <p>Juros de cada parcela = saldo × ((1 + taxa ao mês) elevado a dias corridos do período ÷ 30, menos 1). Parcela fixa, que zera o saldo na última; a última acerta os centavos.</p>
          <p>% de entrada = (valor do bem − valor liberado) ÷ valor do bem.</p>
          <p>IOF (Decreto 6.306/2007, art. 7º), sempre pessoa jurídica geral e sempre financiado: adicional de 0,38% sobre o valor financiado, já com o próprio IOF; diário de 0,0082% sobre a amortização de cada parcela, pelos dias até o vencimento, com limite de 365 dias.</p>
          <p>Taxa ou spread: escolha qual informar. Spread composto: (1 + taxa ao ano) = (1 + funding ao ano) × (1 + spread ao ano), com a taxa ao ano = (1 + taxa ao mês)^12 − 1; informando o spread, a taxa é arredondada a duas casas antes da conta e a tela mostra o spread efetivo com essa taxa. O funding vem da tabela colada no "!", pelo prazo; entre dois prazos, em linha reta; fora da tabela, o da ponta.</p>
          <p>{PRACA_AJUDA}</p>
          <p>O spread não vai para o cliente.</p>
          <p>O envelope baixa um arquivo de e-mail do Outlook (.eml), com o resumo, as parcelas e os avisos de cotação indicativa. O ícone do WhatsApp copia o resultado como imagem, com os mesmos avisos.</p>
        </Help>
        <FundingColar tabela={tabela} onTabela={trocarTabela} />
      </span>
    </div>

    <div className="giro-flow">
      <form className="giro-form" noValidate onSubmit={e => { e.preventDefault(); setDirty(false) }}>
        <section className="lm" aria-labelledby="cdc-op">
          <header className="lm-head"><h3 id="cdc-op">{step(1, 'Entrada')}</h3>
            <div className="lm-head-side"><button type="button" className="lm-clear" onClick={() => { setForm(INICIAL); setDirty(true) }}>Limpar</button></div>
          </header>
          <div className="lm-grid">
            {dinheiro('valorBem', 'Valor do bem')}
            {dinheiro('valorLiberado', 'Valor liberado')}
            {dinheiro('cadastro', 'Tarifa de cadastro')}
            {campo('data', 'Data da simulação', <output id="cdc-data" className="giro-readonly">{dmy(hoje)}</output>)}
            {texto('prazo', 'Prazo (parcelas)')}
            {texto('carencia', 'Carência (dias)')}
            {campo('modo', 'Informar', <select id="cdc-modo" value={form.modo} onChange={e => set('modo', e.target.value)}>
              <option value="taxa">Taxa (% a.m.)</option><option value="spread">Spread (% a.a.)</option></select>)}
            {form.modo === 'taxa' ? texto('taxa', 'Taxa (% a.m.)', 'decimal', derivado) : texto('spread', 'Spread (% a.a.)', 'decimal', derivado)}
            {campo('praca', 'Praça do contrato', <PracaContratoBusca id="cdc-praca" value={praca} onChange={trocarPraca} />)}
            {tabela?.length > 1 && campo('vigencia', 'Funding (vigência)', <select id="cdc-vigencia" value={vig.id} onChange={e => { setVigencia(e.target.value); setDirty(true) }}>
              {tabela.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>)}
          </div>
        </section>
        <button className={`giro-simulate${dirty ? ' is-pending' : ''}`} type="submit">Simular</button>
      </form>

      <div className="rt-outcome giro-outcome calc-result-shell" aria-live="polite">
        <Resultado id="cdc-result-title" number={2} title="Resultado Simulação" className="giro-result" alert={alerta}>
          <Respostas items={[
            { question: 'Valor da parcela', value: r ? brl(r.parcela) : '—', note: r ? `${r.rows.length} parcelas mensais` : 'Parcela fixa', main: true },
            { question: 'Taxa', value: r ? `${pct(r.taxa)} a.m.` : '—', note: r ? `${pct(((1 + r.taxa / 100) ** 12 - 1) * 100)} a.a. · entrada de ${pct(r.pctEntrada * 100)}` : null },
          ]} />
          <dl className="rt-parts">
            <div><dt>1ª e última parcela</dt><dd>{r ? `${dmy(r.primeira)} a ${dmy(r.ultima)}` : '—'}</dd></div>
            <div className="rt-total"><dt>IOF total</dt><dd>{r ? brl(r.iof) : '—'}</dd></div>
            <div className="rt-muted"><dt>Valor financiado</dt><dd>{r ? brl(r.principal) : '—'}</dd></div>
            <div className="rt-muted"><dt>Total das parcelas</dt><dd>{r ? brl(r.paid) : '—'}</dd></div>
          </dl>
        </Resultado>
        {r && <div className="cdc-share">
          <EnvelopeEml label="Baixar e-mail da cotação para o Outlook" gerar={() => cdcEml({ result: r, info })} />
          <WhatsAppCotacao dados={cdcResumo(r, info)} gerar={cdcImagem} arquivo="cotacao-cdc.png" titulo="Cotação CDC" />
        </div>}
      </div>
    </div>

    {r ? <details className="giro-installments">
      <summary>Ver parcelas</summary>
      <div className="giro-table-scroll" role="region" aria-label="Cronograma de pagamentos" tabIndex={0}>
        <table>
          <thead><tr><th scope="col">Mês</th><th scope="col">Data pagto</th><th scope="col">Saldo</th><th scope="col">Amortização</th><th scope="col">Juros</th><th scope="col">Parcela</th></tr></thead>
          <tbody>
            <tr><th scope="row">0</th><td>{dmy(hoje)}</td><td>{brl(r.principal)}</td><td>{brl(0)}</td><td>{brl(0)}</td><td>{brl(0)}</td></tr>
            {r.rows.map(row => <tr key={row.number}><th scope="row">{row.number}</th><td>{dmy(row.date)}</td><td>{brl(row.balance)}</td>
              <td>{brl(row.amortization)}</td><td>{brl(row.interest)}</td><td>{brl(row.payment)}</td></tr>)}
          </tbody>
          <tfoot><tr><th scope="row" colSpan={5}>Total das parcelas</th><td>{brl(r.paid)}</td></tr></tfoot>
        </table>
      </div>
    </details> : <button className="giro-installments giro-installments-disabled" type="button" disabled>Ver parcelas</button>}
  </section>
}
