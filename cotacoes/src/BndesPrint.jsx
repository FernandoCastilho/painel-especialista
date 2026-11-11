import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { captureBndesPrint } from './bndesPrint.js'
import BndesIcon from './BndesIcon.jsx'
import './BndesPrint.css'
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const amount = value => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = (value, digits = 2) => `${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}% a.a.`
const day = value => value ? value.split('-').reverse().join('/') : 'Indisponível'

export default function BndesPrint(props) {
  const [snapshot, setSnapshot] = useState(null)
  const close = useCallback(() => setSnapshot(null), [])
  return <><button type="button" className="bnprint-launch" disabled={!props.result || (props.compareRequested && !props.comparison?.ok)} onClick={() => setSnapshot(captureBndesPrint(props))}><BndesIcon kind="print" />Imprimir PDF</button>{snapshot && createPortal(<PrintDialog snapshot={snapshot} onClose={close} />, document.body)}</>
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
  return <dialog className="bnprint-dialog" ref={dialog} aria-label="Prévia do PDF da simulação BNDES" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="bnprint-controls"><div><strong>Prévia da simulação</strong><p>Na janela de impressão, escolha Salvar como PDF. Todos os meses estão incluídos.</p></div><button type="button" ref={printButton} onClick={print}>Imprimir / salvar PDF</button><button type="button" onClick={onClose}>Fechar prévia</button>{error && <p role="alert">{error}</p>}</div>
    <BndesPrintDocument snapshot={snapshot} />
  </dialog>
}
export function BndesPrintDocument({ snapshot }) {
  const c = snapshot.conditions, choices = snapshot.choices
  const gracePayments = choices.some(item => item.schedule.some(row => row.carencia && row.pago > 0))
  const facts = [['Valor dos materiais', money(c.valor)], ['Participação', `${amount(c.participacao)}%`], ['Valor financiado', money(snapshot.result.financiado)], ['Recursos próprios', money(snapshot.result.recursosProprios)], ['Porte/região', c.porte], ['Modalidade', 'Finame Materiais Industrializados'], ['Prazo total', `${c.prazo} meses`], ['Carência incluída no prazo', `${c.carencia} meses`], ['Juros na carência', c.periodicidade], ['Amortização', 'SAC (fixo)'], ['Remuneração BNDES', percent(c.taxaBndes)], ['Remuneração do agente', percent(c.taxaAgente)], ['Garantia FGI Tradicional', snapshot.result.fgi ? `${amount(snapshot.result.fgi.percentual)}% · ECG à vista` : 'Não informada'], ['Liberação hipotética', day(snapshot.releaseDate)]]
  return <article className="bnprint-document">
    <header className="bnprint-heading"><div><strong>Simulação BNDES</strong><span>Finame Materiais Industrializados</span></div><small>Simulador independente</small></header>
    <p className="bnprint-stamp">Gerada em {new Date(snapshot.capturedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília). Valores congelados nesta prévia.</p>
    <section><h2>Dados da operação</h2><dl className="bnprint-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section><h2>{choices.length === 2 ? 'Comparação de resultados' : `Resultado estimado · ${choices[0].custo.toUpperCase()}`}</h2><table className="bnprint-comparison"><thead><tr><th scope="col">Indicador</th>{choices.map(item => <th scope="col" className={`bnprint-${item.custo}`} key={item.custo}>Com {item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{[['Custo total estimado', 'total'], ['Primeira parcela após carência', 'primeiraParcela'], ['Última parcela', 'ultimaParcela'], ['Taxa final', 'taxa'], ['Juros totais', 'juros'], ['Juros na carência', 'jurosCarencia'], ['IOF', 'iof'], ['TAC à vista', 'tac'], ['ECG do FGI à vista', 'ecg']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{choices.map(item => <td className={`bnprint-${item.custo}`} key={item.custo}>{key === 'taxa' ? percent(item.result.taxa) : money(key === 'ecg' ? item.result.fgi?.ecg ?? 0 : item.result[key])}</td>)}</tr>)}</tbody></table><p className="bnprint-note">A primeira parcela indicada é a primeira com amortização.{gracePayments && ' Há cobranças anteriores de juros durante a carência.'}</p></section>
    <section><h2>Taxas e referências utilizadas</h2>{choices.map(item => <p key={item.custo}><b>{item.custo.toUpperCase()}: {percent(item.rate.value, 4)}{item.rate.manual ? ' · TAXA MANUAL' : ' · referência do painel'}</b><br />{item.quote ? `Cotação publicada: ${percent(item.quote.valor, 4)} · ${item.quote.codigo} · ${day(item.quote.data)}.` : 'Cotação publicada indisponível.'}{item.rate.manual && ' A taxa manual é uma entrada desta simulação e não uma cotação oficial.'}</p>)}{c.retained && <p className="bnprint-warning">Referência retida ou atualização indisponível. Confira as datas antes de cotar.</p>}</section>
    <p className="bnprint-disclaimer">{snapshot.notice}</p>
    <section className="bnprint-premises"><h2>Premissas e limites</h2><ul><li>SAC e composição capitalizada das taxas. Liberação em até 90 dias para TFC e TFB é a premissa da série, não promessa de desembolso.</li><li>Taxas constantes e períodos mensais iguais de 1/12 do ano. Vencimentos ilustrativos no dia 15, ajustados ao próximo dia útil considerando feriados nacionais. Não é memória de cálculo contratual.</li><li>Juros exigíveis na carência, na periodicidade informada. A carência está incluída no prazo total.</li><li>Recursos FINAME elegíveis e IOF zero (Decreto 6.306/2007, art. 8º, IX), sujeito à confirmação do enquadramento.</li><li>TAC e ECG do FGI, quando informado, pagos à vista e contados uma única vez no total. O ECG não é financiado. Outras tarifas, seguros e despesas não estão incluídos.</li><li>Garantia FGI não é seguro e não dispensa o pagamento da dívida. Demais garantias e condições dependem de negociação e aprovação da instituição.</li>{[...new Set(choices.flatMap(item => item.result.avisos))].map(warning => <li key={warning}>{warning}</li>)}</ul><p>Regras conferidas em {day(c.rulesDate)}. A proposta e o contrato da instituição financeira prevalecem.</p><p className="bnprint-sources">Fontes: {snapshot.sources.map(source => <a href={source.url} key={source.url}>{source.label}</a>)}</p></section>
    {choices.map(item => <section className="bnprint-schedule" key={item.custo}><h2>Cronograma completo · {item.custo.toUpperCase()}{item.rate.manual && ' · taxa manual'}</h2><p className="bnprint-note">Valores em R$. Liberação hipotética: {day(snapshot.releaseDate)}. {item.schedule.length} meses, incluindo a carência.</p><table><thead><tr>{['Nº', 'Vencimento', 'Saldo inicial', 'Juros pagos', 'Amortização', 'Parcela', 'Total pago', 'Saldo final'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr className="bnprint-upfront"><th scope="row">0 · lib.</th><td>{day(snapshot.releaseDate)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{amount(item.upfront)}</td><td>{amount(item.result.financiado)}</td></tr>{item.schedule.map(row => <tr key={row.mes} className={row.carencia ? 'bnprint-grace' : undefined}><th scope="row">{row.mes}{row.carencia ? ' *' : ''}</th><td>{day(row.date)}</td>{['saldoInicial', 'juros', 'amortizacao', 'parcela', 'pago', 'saldo'].map(key => <td key={key}>{amount(row[key])}</td>)}</tr>)}<tr className="bnprint-total"><th scope="row">Total</th><td>{item.schedule.length} meses</td><td>—</td><td>{amount(item.result.juros)}</td><td>{amount(item.result.financiado)}</td><td>{amount(item.result.juros + item.result.financiado)}</td><td>{amount(item.result.total)}</td><td>—</td></tr></tbody></table><p className="bnprint-note">* Mês de carência. Linha 0: despesas à vista. Total pago inclui as despesas aplicáveis; parcela é amortização mais juros.</p><p className="bnprint-disclaimer">{snapshot.notice}</p></section>)}
  </article>
}
