import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { captureE4 } from './emprestimo4131Presentation.js'
import BndesIcon from './BndesIcon.jsx'
import './BndesPrint.css'

const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const amount = (value, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const pct = (value, digits = 2) => `${amount(Math.abs(value) < 0.5 / 10 ** digits ? 0 : value, digits)}%`
const signed = (value, format) => `${value >= 0 ? '+' : '−'} ${format(Math.abs(value))}`
const day = (value) => (value ? value.split('-').reverse().join('/') : 'Indisponível')

// Mesmo padrão do PDF do BNDES: prévia congelada e impressão pelo navegador.
export default function Emprestimo4131Print({ loan, hedge, labels }) {
  const [snapshot, setSnapshot] = useState(null)
  const close = useCallback(() => setSnapshot(null), [])
  return <><button type="button" className="bnprint-launch" disabled={!loan || !hedge} onClick={() => setSnapshot(captureE4({ loan, hedge, labels }))}><BndesIcon kind="print" />Imprimir PDF</button>{snapshot && createPortal(<PrintDialog snapshot={snapshot} onClose={close} />, document.body)}</>
}

function PrintDialog({ snapshot, onClose }) {
  const dialog = useRef(null), printButton = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current, trigger = document.activeElement, previousOverflow = document.body.style.overflow
    element.showModal(); printButton.current?.focus(); document.body.style.overflow = 'hidden'; document.body.classList.add('bnprint-active')
    window.addEventListener('hashchange', onClose)
    return () => { window.removeEventListener('hashchange', onClose); document.body.classList.remove('bnprint-active'); document.body.style.overflow = previousOverflow; element.close(); if (trigger?.isConnected) trigger.focus() }
  }, [onClose])
  const print = () => { setError(''); try { window.print() } catch { setError('Não foi possível abrir a impressão. Use a opção Imprimir do navegador e escolha Salvar como PDF.') } }
  return <dialog className="bnprint-dialog" ref={dialog} aria-label="Prévia do PDF da simulação de empréstimo externo" onCancel={(event) => { event.preventDefault(); onClose() }}>
    <div className="bnprint-controls"><div><strong>Prévia da simulação</strong><p>Na janela de impressão, escolha Salvar como PDF. Todos os pagamentos estão incluídos.</p></div><button type="button" ref={printButton} onClick={print}>Imprimir / salvar PDF</button><button type="button" onClick={onClose}>Fechar prévia</button>{error && <p role="alert">{error}</p>}</div>
    <Emprestimo4131PrintDocument snapshot={snapshot} />
  </dialog>
}

export function Emprestimo4131PrintDocument({ snapshot }) {
  const { loan, hedge, scenarios, labels } = snapshot
  const parado = scenarios.find((item) => item.fxChange === 0)
  const facts = [
    ['Principal', `US$ ${amount(loan.principal)}`], ['Câmbio de entrada', `R$ ${amount(loan.spot, 4)}`],
    ['Taxa contratual', `${pct(loan.rate)} a.a. · linear 360`], ['Taxa com o IR por cima', `${pct(loan.grossedRate)} a.a.`],
    ['Desembolso', day(loan.start)], ['Vencimento', day(loan.end)],
    ['Prazo', `${loan.months} meses · ${loan.avgTermDays} dias corridos`], ['Juros', labels.freq || '—'],
    ['IR na fonte sobre os juros', `${pct(loan.irrf, 0)} · ${labels.irPayer || '—'}`], ['IOF-câmbio na entrada', `${pct(loan.iofRate)} · US$ ${amount(loan.iofUsd)}`],
    ['Flat · estruturação', `${pct(loan.flat)} · US$ ${amount(loan.flatUsd)}`], ['Fiança ou SBLC', `${pct(loan.guarantee)} a.a.`],
    ['Flat e fiança pagos a', labels.fees || '—'], ['IR do tomador sobre o flat', `US$ ${amount(loan.flatIrUsd)}`],
    ['Valor líquido recebido', `${brl(loan.netBrl)} · US$ ${amount(loan.netUsd)}`], ['Custo all-in em dólar', `${pct(loan.allIn)} a.a.`],
    ['DI até o vencimento', `${pct(hedge.di)} a.a. · base 252`], ['Cupom cambial até o vencimento', `${pct(hedge.cupom)} a.a. · linear 360`],
    ['Origem do DI e do cupom', labels.curve || '—'], ['Spread do swap, sem custos de entrada', `CDI ${signed(hedge.swap.runSpread, pct)}`],
    ['Spread do banco no swap', `${pct(hedge.swapSpread)} a.a.`], ['Acréscimo do banco no NDF', pct(hedge.ndfMarkup)],
  ]
  return <article className="bnprint-document">
    <header className="bnprint-heading"><div><strong>Simulação de empréstimo externo</strong><span>Operação 4131 · sem proteção, com swap e com NDF</span></div><small>Simulador independente</small></header>
    <p className="bnprint-stamp">Gerada em {new Date(snapshot.capturedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília). Valores congelados nesta prévia.</p>
    <section><h2>Dados da operação</h2><dl className="bnprint-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section><h2>Três caminhos em reais</h2><table className="bnprint-comparison"><thead><tr><th scope="col">Indicador</th><th scope="col">Sem proteção</th><th scope="col">Com swap</th><th scope="col">Com NDF</th></tr></thead><tbody>
      <tr><th scope="row">Custo em reais ao ano</th><td>{pct(parado.cost)} com o dólar parado</td><td>{pct(hedge.swap.pre)} com o DI informado</td><td>{pct(hedge.ndf.pre)} fixo</td></tr>
      <tr><th scope="row">A dívida fica em</th><td>Dólar</td><td>CDI</td><td>Reais, prefixada</td></tr>
      <tr><th scope="row">Spread do swap, sem custos de entrada</th><td>—</td><td>CDI {signed(hedge.swap.runSpread, pct)}</td><td>—</td></tr>
      <tr><th scope="row">Custo total em CDI</th><td>—</td><td>CDI {signed(hedge.swap.spread, pct)} · {pct(hedge.swap.pctCdi, 1)} do CDI</td><td>CDI {signed(hedge.ndf.spread, pct)} hoje</td></tr>
      <tr><th scope="row">Total a pagar em reais</th><td>{brl(parado.totalBrl)}</td><td>Segue o CDI de cada período</td><td>{brl(hedge.ndf.totalBrl)}</td></tr>
      <tr><th scope="row">Risco que sobra</th><td>Câmbio</td><td>Alta do CDI</td><td>Custo de desfazer antes</td></tr>
    </tbody></table><p className="bnprint-note">Ponto de equilíbrio: o NDF compensa se o dólar subir mais de {pct(hedge.ndf.breakeven)} ao ano. Custos com swap e NDF em base 252 dias úteis.</p></section>
    <section><h2>Sem proteção: custo conforme o dólar</h2><table><thead><tr><th scope="col">Dólar ao ano</th><th scope="col">Câmbio no vencimento</th><th scope="col">Total a pagar</th><th scope="col">Custo em reais ao ano</th></tr></thead><tbody>{scenarios.map((item) => <tr key={item.fxChange}><th scope="row">{item.fxChange === 0 ? 'Parado' : signed(item.fxChange, (value) => pct(value, 0))}</th><td>{amount(item.fxEnd, 4)}</td><td>{brl(item.totalBrl)}</td><td>{pct(item.cost)}</td></tr>)}</tbody></table><p className="bnprint-note">Variação constante do dólar ao ano, do desembolso a cada pagamento. Custo em dias corridos/365.</p></section>
    <p className="bnprint-disclaimer">{snapshot.printNotice}</p>
    <section className="bnprint-schedule"><h2>Cronograma completo</h2><p className="bnprint-note">Valores em US$, exceto o total com NDF, em R$. Desembolso: {day(loan.start)}. {hedge.flows.length} pagamentos.</p><table><thead><tr>{['Data', 'Dias', 'Juros', 'IR do tomador', 'Fiança', 'Principal', 'Total em dólar', 'Câmbio a termo', 'Total com NDF (R$)'].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>
      <tr className="bnprint-upfront"><th scope="row">{day(loan.start)} · entrada</th><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{amount(loan.flatUsd + loan.iofUsd + loan.flatIrUsd)}</td><td>{amount(loan.spot, 4)}</td><td>{amount((loan.flatUsd + loan.iofUsd + loan.flatIrUsd) * loan.spot)}</td></tr>
      {hedge.flows.map((flow) => <tr key={flow.date}><th scope="row">{day(flow.date)}</th><td>{flow.days}</td><td>{amount(flow.interest)}</td><td>{amount(flow.irrf)}</td><td>{amount(flow.guarantee)}</td><td>{amount(flow.principal)}</td><td>{amount(flow.usd)}</td><td>{amount(flow.ndfRate, 4)}</td><td>{amount(flow.brl)}</td></tr>)}
      <tr className="bnprint-total"><th scope="row">Total dos pagamentos</th><td>{loan.avgTermDays}</td><td>{amount(loan.totals.interest)}</td><td>{amount(loan.totals.irrf)}</td><td>{amount(loan.totals.guarantee)}</td><td>{amount(loan.totals.principal)}</td><td>{amount(loan.totals.usd)}</td><td>—</td><td>{amount(hedge.ndf.totalBrl)}</td></tr>
    </tbody></table><p className="bnprint-note">Na linha de entrada, o total soma flat, IOF e IR sobre o flat, descontados do valor recebido; eles não entram no total dos pagamentos.</p></section>
    <section className="bnprint-premises"><h2>Premissas e limites</h2><ul>
      <li>Empréstimo externo direto (Lei 4.131/62; Lei 14.286/2021 e Resolução BCB 278/2022). Principal no vencimento; juros lineares por dias corridos/360. Datas sem ajuste para dia útil.</li>
      <li>IR na fonte sobre os juros pagos ao exterior (RIR/2018, art. 760). Quando o tomador assume o imposto, a base é reajustada (art. 786). O mesmo vale para flat e fiança quando pagos ao exterior.</li>
      <li>IOF-câmbio na entrada: 3,5% com prazo médio até 364 dias e zero acima (Decreto 6.306/2007, art. 15-B, XI e XII). Liquidar antes do prazo pode gerar o IOF com multa e juros.</li>
      <li>Custo all-in em dólar: taxa ao ano que iguala o valor líquido recebido aos pagamentos, em dias corridos/365.</li>
      <li>Câmbio a termo teórico: câmbio de entrada × fator do DI (dias úteis/252) ÷ fator do cupom cambial (linear, dias corridos/360). Origem do DI e do cupom: {labels.curve}.</li>
      <li>O custo total em CDI inclui flat e IOF da entrada diluídos no prazo. O spread do swap é calculado sobre o principal, sem esses custos, para comparar com a cotação da mesa. Sem proteção em dias corridos/365; swap e NDF em base 252.</li>
      <li>Fora da conta: IR na fonte e PIS/Cofins sobre ganho do swap ou do NDF, e custo de garantias do derivativo.</li>
      <li>Operação a partir de US$ 1 milhão é declarada pelo devedor ao Banco Central (SCE-Crédito).</li>
    </ul><p className="bnprint-sources">{snapshot.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</p></section>
  </article>
}
