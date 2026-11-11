import { useState } from 'react'
import { useHolidays } from './useHolidays.js'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { useDataFile } from './useDataFile.js'
import { useMacro } from './useMacro.js'
import { keyOf, pointsOf } from './bndes.js'
import { CUSTOS_FIXOS, FGI, FONTES, PERIODICIDADES, PORTES, REGRAS, ecgFgi, erroPercentualFgi, fatorKFgi, TFC_NOMES, codigoTfc, faixaTfb, faixaTfc, periodos30Datas, simular, spreadSobreCdi, vencimentoDia15 } from './finameMateriais.js'
import { FINAME_FUNDING_OPTIONS, FINAME_FUNDING_SOURCES, finameFundingOption, compareFinameFunding, FINAME_PREMISES, resolveFinameRate, finameSimulationParams, validFinameQuote, finameCet } from './finameFunding.js'
import { nf } from './format.js'
import Estado from './Estado.jsx'
import { GLOSSARY } from './glossary.js'
import Help from './CalculatorHelp.jsx'
import BndesPresentation from './BndesPresentation.jsx'
import BndesPrint from './BndesPrint.jsx'
import BndesIcon from './BndesIcon.jsx'
import { PRACAS_CONTRATO, PRACA_AJUDA, PRACA_PADRAO, PRACA_RESSALVA, pracaCalendars } from './pracaContrato.js'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v, d = 2) => `${nf(v, d)}%`
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
const data = (d) => d.toLocaleDateString('pt-BR')
// Exemplos da ajuda do ECG: [valor liberado em R$, % garantido, prazo total em meses], calculados pela fórmula do Anexo V.
const ECG_EXEMPLOS = [[500000, 80, 60], [1000000, 80, 84], [300000, 50, 36]]

// Ícone: caixa de materiais com a marca do BNDES (barras) ao lado.
export function FinameIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l9-4 9 4-9 4-9-4z" /><path d="M3 8v8l9 4 9-4V8" /><path d="M12 12v8" />
    </svg>
  )
}

// Calculadoras › BNDES Finame Materiais: condições do produto (prazo, carência, custo financeiro, taxas), resultado e fluxo
// parcela a parcela. O custo financeiro vem do painel: TFC ou TFB da faixa de prazo (aba BNDES). TLP exigível tem projeção própria.
// As explicações ficam no "?" ao lado de cada rótulo; na tela só os valores.
export default function FinameMateriais({ onBack, onFundingView, profileControl }) {
  const bndes = useDataFile('bndes.json')
  const moedas = useDataFile('moedas.json')
  const macro = useMacro()
  const { ctx: holidayCtx } = useHolidays()
  const [valorText, setValorText] = useState('500.000,00')
  const [partText, setPartText] = useState('100')
  const [prazoText, setPrazoText] = useState('60')
  const [carText, setCarText] = useState('12')
  const [custo, setCusto] = useState('tfc')
  const [comparar, setComparar] = useState(false)
  const { sistema, composicao, liberacao } = FINAME_PREMISES
  const [manualRates, setManualRates] = useState({})
  const [porte, setPorte] = useState('mpme')
  const [bndesText, setBndesText] = useState(String(REGRAS.taxaBndes.mpme).replace('.', ','))
  const [agenteText, setAgenteText] = useState('3,00')
  const [periodicidade, setPeriodicidade] = useState(3)
  const [tacText, setTacText] = useState('2.600,00') // TAC: tarifa de contratação, paga à vista; pré-preenchida e editável
  const [fgiOn, setFgiOn] = useState(false)
  const [praca, setPraca] = useState(PRACA_PADRAO) // praça do contrato: feriados locais que adiam vencimentos
  const calendarios = pracaCalendars(praca)
  const [fgiText, setFgiText] = useState(String(FGI.padraoPercentual))
  const [liberacaoText, setLiberacaoText] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  // Data da liberação: base do calendário real (vencimentos dia 15 ou próximo dia útil), dos juros por dias corridos e do CET.
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(liberacaoText) ? (([y, m, d]) => { const date = new Date(y, m - 1, d, 12); return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d && y >= 2000 && y <= 2100 ? date : null })(liberacaoText.split('-').map(Number)) : null

  const money = parseMoneyInput(valorText)
  const participacao = parseDecimal(partText)
  const prazo = /^\d+$/.test(prazoText.trim()) ? Number(prazoText) : null
  const carencia = /^\d+$/.test(carText.trim()) ? Number(carText) : null
  const taxaBndes = parseDecimal(bndesText)
  const taxaAgente = parseDecimal(agenteText)
  const tac = tacText.trim() === '' ? { ok: true, value: 0 } : parseMoneyInput(tacText)
  const fgiPct = parseDecimal(fgiText)
  // P do ECG: períodos de 30 dias completos entre a liberação ilustrativa e o último vencimento (dia 15, próximo dia útil).
  const fgiPeriodos = prazo && hoje ? periodos30Datas(hoje, vencimentoDia15(hoje, prazo, holidayCtx, calendarios)) : undefined

  // Custo financeiro do painel
  const faixa = prazo ? faixaTfb(prazo) : 60
  const tfbPts = pointsOf(bndes.data, keyOf(faixa, liberacao))
  const rawTfb = tfbPts.length ? { data: tfbPts.at(-1)[0], valor: tfbPts.at(-1)[1], codigo: keyOf(faixa, liberacao) } : null
  const tfcCodigo = codigoTfc(porte, prazo ?? 60)
  const tfcPts = Array.isArray(moedas.data?.series?.[tfcCodigo]?.points) ? moedas.data.series[tfcCodigo].points : []
  const rawTfc = tfcPts.length ? { data: tfcPts.at(-1)[0], valor: tfcPts.at(-1)[1], codigo: tfcCodigo, nome: TFC_NOMES[tfcCodigo], faixa: faixaTfc(prazo ?? 60) } : null
  const tfc = validFinameQuote(rawTfc) ? rawTfc : null
  const tfb = validFinameQuote(rawTfb) ? rawTfb : null
  const fixa = CUSTOS_FIXOS.has(custo)
  const cdi = Array.isArray(macro.data?.cdi) && macro.data.cdi.length ? macro.data.cdi.at(-1)[1] : null
  // Na TFB, o custo financeiro é a própria TFB (nominal). A TLP exigível usa motor próprio, sem correção capitalizada do saldo.
  const funding = finameFundingOption(custo)
  const quotes = { tfc, tfb }
  const rates = Object.fromEntries(['tfc', 'tfb'].map(id => [id, resolveFinameRate(id, quotes[id], manualRates[id] ?? null)]))
  const custoFinanceiro = rates[custo]?.value ?? null

  const erros = {
    valor: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    part: participacao !== null && participacao >= REGRAS.participacaoMinPct && participacao <= 100 ? null : 'Participação de 1 a 100%.',
    prazo: prazo !== null && prazo >= 1 && prazo <= REGRAS.prazoMaxMeses ? null : `Prazo de 1 a ${REGRAS.prazoMaxMeses} meses (7 anos).`,
    car: carencia !== null && carencia >= 0 && carencia <= (fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses) && (prazo === null || carencia < prazo) ? null : `Carência de 0 a ${fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses} meses${fixa ? ` com ${custo.toUpperCase()}` : ''}, menor que o prazo.`,
    bndes: taxaBndes !== null && taxaBndes <= 100 ? null : 'Informe a taxa do BNDES em % a.a.',
    agente: taxaAgente !== null && taxaAgente <= 100 ? null : 'Informe o spread da instituição em % a.a.',
    tac: tac.ok ? null : tac.error || 'Informe a TAC em R$ (zero se não houver).',
    'data-lib': hoje ? null : 'Informe a data da liberação (entre 2000 e 2100).',
    fgi: !fgiOn ? null : PORTES.find((p) => p.id === porte)?.mpme === false ? 'O FGI atende micro, pequenas e médias empresas (receita bruta de até R$ 300 milhões no ano anterior). Para grande empresa, desmarque a garantia.' : erroPercentualFgi(fgiPct ?? Number.NaN),
    'rate-tfc': (custo === 'tfc' || comparar) ? rates.tfc.error : null,
    'rate-tfb': (custo === 'tfb' || comparar) ? rates.tfb.error : null,
  }
  const garantiaFgi = fgiOn && !erros.fgi ? { percentual: fgiPct, incorporar: false, periodos: fgiPeriodos } : null
  const custosExtras = { tac: tac.ok ? tac.value : 0, fgi: garantiaFgi }
  const pronto = funding?.mode === 'inline' && !Object.values(erros).some(Boolean) && Number.isFinite(custoFinanceiro)
  const params = finameSimulationParams({ valor: money.value, participacao, prazo, carencia, custo, custoFinanceiro, ipca: 0, taxaBndes, taxaAgente, periodicidade, dataLiberacao: hoje, feriados: holidayCtx, calendarios, ...custosExtras })
  const r = pronto ? simular(params) : null
  const res = r?.ok ? r : null
  const comparison = comparar && pronto ? compareFinameFunding(params, quotes, manualRates) : null
  const spread = res ? spreadSobreCdi(res.taxaNominal, cdi) : null
  const financiadoTela = res ? res.liberado : !erros.valor && !erros.part ? money.value * participacao / 100 : null
  // CET estimado do fluxo projetado (Res. CMN 4.881: dias corridos/365 desde a data da liberação informada).
  const cet = res ? finameCet(res, hoje, holidayCtx, calendarios) : null
  const cets = comparison?.ok ? comparison.alternatives.map(item => finameCet(item.result, hoje, holidayCtx, calendarios)) : []
  const cetTexto = (c, unidade = 'anual') => c ? `${pct(unidade === 'anual' ? c.anual : c.mensal, 2)} ${unidade === 'anual' ? 'a.a.' : 'a.m.'}` : 'Não mensurável'
  const cetAjuda = 'CET estimado (Resolução CMN 4.881/2020): taxa anual que iguala o valor líquido recebido na liberação (valor liberado menos TAC, ECG do FGI à vista e IOF) às parcelas do cronograma, em dias corridos/365. Usa as datas hipotéticas do fluxo (dia 15 ou próximo dia útil) e não inclui seguros nem outras tarifas: o CET do contrato, informado pelo agente, prevalece.'
  const referenceRetained = !!(((custo === 'tfc' || comparar) && (moedas.stale || moedas.status === 'error' || moedas.data?.stale?.[tfcCodigo])) || ((custo === 'tfb' || comparar) && (bndes.stale || bndes.status === 'error' || bndes.data?.stale?.[keyOf(faixa, liberacao)])))

  const conditions = { valor: money.value, participacao, prazo, carencia, custo, quote: custo === 'tfc' ? tfc : tfb, liberacao, porte: PORTES.find(item => item.id === porte).label, taxaBndes, taxaAgente, sistema, periodicidade: PERIODICIDADES.find(item => item.id === periodicidade).label, composicao, finameEligible: true, rate: rates[custo], rulesDate: REGRAS.conferidoEm, retained: referenceRetained }

  const ajuda = (label, texto) => (texto ? <Help label={`Ajuda: ${label}`}>{texto}</Help> : null)
  const field = (key, label, control, hint, valor) => (
    <div className={`cx-field fm-field-${key}`}>
      <span className="fm-rotulo"><label htmlFor={`fm-${key}`}>{label}</label>{ajuda(label, hint)}</span>
      {control}
      {valor && <p className="cx-hint fm-custo-valor">{valor}</p>}
      <p className="cx-error" id={`fm-${key}-err`} role={erros[key] ? 'alert' : undefined}>{erros[key] ?? ''}</p>
    </div>
  )
  const seg = (id, label, hint, botoes, extra = null) => (
    <div className={`cx-field fm-field-${id}`}>
      <span className="fm-rotulo"><span className="cx-label" id={`fm-${id}-l`}>{label}</span>{ajuda(label, hint)}</span>
      {id === 'lib' ? <div className="seg" role="group" aria-labelledby={`fm-${id}-l`}>{botoes}</div> : <select id={`fm-${id}`} aria-labelledby={`fm-${id}-l`} value={botoes.findIndex(button => button.props['aria-pressed'])} onChange={event => botoes[Number(event.target.value)].props.onClick()}>{botoes.map((button, index) => <option key={button.key} value={index}>{button.props.children}</option>)}</select>}
      {extra}
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`fm-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!erros[key]} aria-describedby={`fm-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...extra} />

  // Quadros do resultado. Os destaques do topo e a "Composição do resultado" usam esta mesma lista: mesmo rótulo, mesmo valor, mesma nota.
  const quadros = res ? [
    { id: 'taxa', rotulo: 'Taxa final', ajuda: <><p>{`Taxa final composta: (1 + custo financeiro) × (1 + taxa do BNDES) × (1 + spread da instituição) − 1. A taxa mensal é a equivalente em meses de 1/12 do ano.`}</p><p>{pct(res.taxaMensal, 3)} a.m. · {pct(custoFinanceiro, 2)} {custo.toUpperCase()} + {pct(taxaBndes, 2)} BNDES + {pct(taxaAgente, 2)} spread da instituição, capitalizadas</p></>, valor: <>{pct(res.taxa, 2)} a.a.</>, nota: <>{pct(res.taxaMensal, 3)} a.m.</> },
    { id: 'cet', rotulo: 'CET estimado', ajuda: cetAjuda, valor: cetTexto(cet), nota: cet ? <>{cetTexto(cet, 'mensal')} · líquido {brl(cet.liquido)}</> : 'fluxo sem solução' },
    { id: 'financiado', rotulo: 'Valor financiado', ajuda: 'Valor dos materiais × participação do BNDES; o restante é recursos próprios do cliente.', valor: brl(res.liberado), nota: <>{res.recursosProprios > 0 ? `${brl(res.recursosProprios)} de recursos próprios` : '100% dos itens financiáveis'}</> },
    { id: 'carencia', rotulo: 'Juros na carência', ajuda: 'Juros do período de carência, pagos na periodicidade escolhida (dentro do período, capitalizados mês a mês); sem amortização nesse período.', valor: brl(res.jurosCarencia), nota: <>{carencia} {carencia === 1 ? 'mês' : 'meses'} · {PERIODICIDADES.find((p) => p.id === periodicidade).label.toLowerCase()}</> },
    { id: 'parcelas', rotulo: 'Parcelas', ajuda: 'Primeira parcela após a carência (juros + amortização). No SAC as parcelas caem; cada parcela tem os juros dos dias corridos desde o vencimento anterior.', valor: brl(res.primeiraParcela), nota: <>{res.parcelasAmortizacao}x mensais{` · última ${brl(res.ultimaParcela)}`}</> },
    { id: 'spread', rotulo: 'Spread da instituição', ajuda: <><p>{'Remuneração do banco (a "taxa do agente financeiro" do BNDES). Em R$: juros com a taxa completa menos juros com custo financeiro + taxa do BNDES, no mesmo cronograma; a parte do BNDES é juros com custo + BNDES menos juros só com o custo, e o custo financeiro é o restante. Em pontos: quanto o spread acrescenta à taxa final, que na composição capitalizada é o spread multiplicado por (1 + custo) × (1 + BNDES).'}</p><p>{brl(res.atribuicao.agente)} dos juros ({pct(res.juros > 0 ? (res.atribuicao.agente / res.juros) * 100 : 0, 1)}) · +{nf(res.spreadAgentePp, 2)} p.p. sobre custo + BNDES · BNDES {brl(res.atribuicao.bndes)} · custo financeiro {brl(res.atribuicao.custoFinanceiro)}</p></>, valor: <>{pct(taxaAgente, 2)} a.a.</>, nota: <>+{nf(res.spreadAgentePp, 2)} p.p. na taxa final</> },
    { id: 'juros', rotulo: 'Juros totais', ajuda: 'Soma dos juros da carência e das parcelas da projeção TFC/TFB.', valor: brl(res.juros), nota: <>{pct((res.juros / res.financiado) * 100, 1)} do saldo financiado</> },
    { id: 'iof', rotulo: 'IOF', ajuda: 'Alíquota zero condicionada à confirmação de recursos FINAME elegíveis (Decreto 6.306/2007, art. 8º, IX).', valor: brl(res.iof), nota: res.iof > 0 ? `${brl(res.iofFixo)} adicional + ${brl(res.iofDiario)} diário` : 'Alíquota zero' },
    { id: 'tac', rotulo: 'TAC', ajuda: 'Tarifa de contratação paga à vista na liberação, pelo valor informado. Não entra no cronograma de juros.', valor: brl(res.tac), nota: res.tac > 0 ? 'paga à vista' : 'sem TAC' },
    res.fgi && { id: 'fgi', rotulo: 'FGI · ECG', ajuda: <><p>{`Encargo por Concessão de Garantia do FGI Tradicional: %G × K × VL × P, com %G = ${nf(res.fgi.percentual, 0)}%, K = ${nf(res.fgi.k, 2)}% por período de 30 dias, VL = ${brl(res.liberado)} e P = ${res.fgi.periodos} períodos de 30 dias até o último vencimento.`}</p><p>Pago à vista na liberação (item 2.1.3 do Anexo V), sem financiar o encargo. O cliente só paga se o agente repassar o custo. Garantia não é seguro de crédito.</p><p>{`Por que parece alto: o ECG é cobrado de uma vez, na liberação, pelo prazo inteiro da operação. Nesta simulação ele equivale a ${pct((res.fgi.ecg / res.liberado) * 100, 2)} do valor liberado. Com 80% de garantia, fica perto de 5% do valor liberado em quase qualquer prazo acima de 24 meses, porque o fator K cai quando o prazo aumenta.`}</p><p>Exemplos pela mesma fórmula (à vista):</p><ul>{ECG_EXEMPLOS.map(([v, g, n]) => { const a = ecgFgi({ valor: v, percentual: g, prazo: n, incorporar: false }); return <li key={`${v}-${g}-${n}`}>{`${brl(v)}, ${n} meses, ${g}% garantido: ${brl(a.ecg)} (${pct((a.ecg / v) * 100, 2)})`}</li> })}</ul><p>Os exemplos contam o prazo em períodos de 30 dias a partir do número de meses; na simulação, o P usa as datas, e o valor muda com o dia da liberação. Só FGI Tradicional: o FGI PEAC e a tabela comercial de cada banco têm regras próprias. A tabela de custo mensal do site do BNDES é ilustrativa e pode não coincidir com esta conta.</p></>, valor: brl(res.fgi.ecg), nota: <>{nf(res.fgi.percentual, 0)}% garantido · à vista</> },
    { id: 'total', rotulo: 'Pagamento final', ajuda: 'Valor financiado + juros totais + IOF + TAC + ECG do FGI (quando marcado): tudo o que o cliente paga nesta projeção TFC/TFB, sem outras tarifas ou seguros.', valor: brl(res.total), nota: null },
  ].filter(Boolean) : []
  const quadro = (q) => <div className="fm-kpi" key={q.id}><span className="fm-rotulo">{q.rotulo}{ajuda(q.rotulo, q.ajuda)}</span><b>{q.valor}</b>{q.nota && <small>{q.nota}</small>}</div>

  const regrasAjuda = (
    <>
        <ul>
          <li><b>O que financia:</b> {REGRAS.itens}. Fora: {REGRAS.foraDoProduto}. Nacionalização: {REGRAS.nacionalizacao}.</li>
          <li><b>Quem pede:</b> empresas de qualquer porte sediadas no país, empresário individual, MEI, produtor rural pessoa física, administração pública, cooperativas, fundações e associações; operação indireta, por agente financeiro credenciado.</li>
          <li><b>Limites:</b> até {REGRAS.participacaoMaxPct}% dos itens; {brl(REGRAS.tetoCliente12m)} por cliente a cada 12 meses (da homologação); reembolso de notas emitidas até {REGRAS.reembolsoMeses} meses antes do protocolo. O teto de {brl(REGRAS.tetoOperacao)} por operação aparece em materiais do BNDES e da CNI (2020 a 2025), mas não consta na página oficial em 04/11/2026: a calculadora só avisa; confirme com o agente.</li>
          <li><b>Prazo:</b> até {REGRAS.prazoMaxMeses} meses, com até {REGRAS.carenciaMaxMeses} de carência ({REGRAS.carenciaMaxTfbMeses} com TFB, TFC ou TFC MPME). Juros exigíveis na carência; depois, SAC mensal com juros junto do principal.</li>
          <li><b>Taxa:</b> custo financeiro (TFB, TFBD, TLP, Taxa LCD, Taxa Fixa Composta ou Taxa Fixa Composta MPME; Selic suspensa pela {REGRAS.selicSuspensa}) + taxa do BNDES ({pct(REGRAS.taxaBndes['mpme-nne'])} MPME N/NE; {pct(REGRAS.taxaBndes.mpme)} MPME nas demais regiões e grandes) + spread da instituição financeira (a "taxa do agente financeiro" do BNDES), negociado. TFC e TFB usam este cronograma aproximado; TLP exigível e Taxa LCD abrem projeções próprias, e TFBD identifica os dados e o modelo ainda necessários.</li>
          <li><b>IOF:</b> Premissa de recursos FINAME elegíveis e alíquota zero (art. 8º, IX); confirmar o enquadramento na contratação.</li>
          <li><b>Garantias:</b> livre negociação entre o agente e o cliente, observadas as normas do Banco Central; admitida a garantia do FGI (Tradicional ou PEAC) ou do FG BNDES-SEBRAE. Seguro conforme a política do agente.</li>
          <li><b>Conta:</b> taxa composta das três parcelas (capitalizada, padrão do BNDES: o exemplo oficial da página "Taxa de juros" é 1,07 × 1,015 × 1,03 − 1 = 11,86%); juros de cada período por dias corridos entre vencimentos reais (dia 15 ou próximo dia útil, feriados nacionais), em juros compostos sobre os dias do ano civil (365 ou 366); a taxa mensal exibida é só a equivalente de 1/12 do ano. O contrato do agente prevalece: diferenças de dias podem alterar os juros totais mesmo que a soma anual de dias úteis coincida, pois o saldo muda; juros da carência capitalizados dentro do período e pagos no fim dele; a parte dos juros que remunera cada um é apurada em camadas, no mesmo cronograma: custo financeiro = juros só com o custo; BNDES = juros com custo + BNDES menos juros só com o custo; spread da instituição = juros com a taxa completa menos juros com custo + BNDES; SAC mensal apenas em TFC/TFB nesta tela. TLP exigível tem perfil próprio, sem capitalizar IPCA positivo no principal. Esta tela presume recursos FINAME elegíveis e IOF zero; confirme o enquadramento na contratação.</li>
          <li>O que ainda depende de conferência com o agente: valor mínimo, periodicidade padrão dos juros na carência e a origem elegível dos recursos FINAME para o IOF zero. A conta aqui é estimativa; a proposta do agente prevalece.</li>
        </ul>
        <p className="fm-fontes-titulo">{GLOSSARY.fgi.t}</p>
        <ul>
          <li><b>O que é:</b> {GLOSSARY.fgi.a}</li>
          <li><b>Exemplo:</b> {GLOSSARY.fgi.b}</li>
          <li><b>Na prática:</b> {GLOSSARY.fgi.c}</li>
          <li><b>Para dominar:</b> {GLOSSARY.fgi.d}</li>
        </ul>
        <p className="fm-fontes-titulo">Base legal e onde cada regra foi conferida</p>
        <ul>{FONTES.map((f) => <li key={f.regra}><b>{f.regra}.</b> <a href={f.url} target="_blank" rel="noopener noreferrer">{f.fonte}</a>.</li>)}</ul>
    </>
  )

  return (
    <section className="cx cx-finame" aria-labelledby="calc-h">
      <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
      <h2 id="calc-h" className="cx-title"><span className="cx-icon" aria-hidden="true"><FinameIcon /></span>BNDES Finame Materiais</h2>

      <div className="fm-workspace">
      <article className="desk-panel cx-panel fm-input-panel">
        <header className="fm-rules"><h3 className="cx-heading sr-only">Dados da operação</h3><small>Regras do produto conferidas em {dmy(REGRAS.conferidoEm)}</small>{ajuda('Regras do produto e fontes', regrasAjuda)}</header>
        <div className="cx-form">
          <section className="fm-group fm-operation" aria-labelledby="fm-operation-h"><h3 id="fm-operation-h"><BndesIcon kind="operation" />Operação</h3><div className="fm-group-fields">
          {profileControl && <div className="fm-field-linha">{profileControl}</div>}
          {field('valor', 'Valor dos materiais', <MoneyInput id="fm-valor" aria-invalid={!!erros.valor} aria-describedby="fm-valor-err" value={valorText} onChange={setValorText} />, 'Bens industrializados novos, nacionais, enquadrados na lista NCM e nos critérios CST/CSOSN do Finame Materiais; não se trata do credenciamento CFI do Finame tradicional. Notas de até 12 meses antes do protocolo.')}
          {field('part', 'BNDES financia (%)', input('part', partText, setPartText), 'Até 100% dos itens financiáveis.')}
          <p className="fm-financed" aria-live="polite"><span>Valor financiado</span><b>{financiadoTela === null ? '—' : brl(financiadoTela)}</b></p>
          {field('prazo', 'Prazo total (meses)', input('prazo', prazoText, value => { setPrazoText(value); setManualRates({}) }, { inputMode: 'numeric' }), 'Até 84 meses (7 anos).')}
          {field('car', 'Carência (meses)', input('car', carText, setCarText, { inputMode: 'numeric' }), fixa ? `Até 12 meses com ${custo.toUpperCase()}; juros exigíveis durante a carência.` : 'Até 24 meses; juros exigíveis durante a carência.')}
          {field('data-lib', 'Data da liberação', input('data-lib', liberacaoText, setLiberacaoText, { type: 'date', inputMode: undefined, min: '2000-01-01', max: '2100-12-31' }), 'Data em que o dinheiro é liberado. Os vencimentos caem todo dia 15 a partir do mês seguinte (ou no próximo dia útil, considerando os feriados nacionais e os da praça do contrato); os juros de cada parcela contam os dias corridos desde o vencimento anterior, sobre os dias do ano civil (365 ou 366). Mudar a data muda os juros e o CET.')}
          {field('praca', 'Praça do contrato (feriados)', <select id="fm-praca" value={praca} onChange={event => setPraca(event.target.value)}>{PRACAS_CONTRATO.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>, `${PRACA_AJUDA} ${PRACA_RESSALVA}`)}
          {seg('porte' , 'Porte e região', '0,95% a.a. para MPMEs no Norte e Nordeste; 1,25% a.a. para MPMEs nas demais regiões e para grandes empresas (página do produto em 04/11/2026; a mudança de 1,15% para 1,25% em 22/01/2026 é informada pela Abimaq). O porte também escolhe a série da TFC. Editável.',
            PORTES.map((p) => <button key={p.id} type="button" aria-pressed={porte === p.id} onClick={() => { setPorte(p.id); setManualRates({}); setBndesText(String(p.taxa).replace('.', ',')) }}>{p.label}</button>))}
          </div></section>
          <section className="fm-group fm-costs" aria-labelledby="fm-costs-h"><h3 id="fm-costs-h"><BndesIcon kind="costs" />Custos</h3><div className="fm-group-fields">
          {field('custo', 'Custo financeiro', <select id="fm-custo" value={custo} onChange={event => { const next = finameFundingOption(event.target.value); if (next) { setCusto(next.id); if (next.mode !== 'inline') setComparar(false) } }}>{FINAME_FUNDING_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}{option.mode === 'dedicated' ? ' · projeção própria' : option.mode === 'unavailable' ? ' · indisponível' : ''}</option>)}</select>,
            <><p>{funding?.hint} Selic pura suspensa como custo financeiro ({REGRAS.selicSuspensa}).</p><p>As moedas contratuais já exibidas pelo painel têm unidades diferentes: US$ (604) é nível cambial; 143 é índice Selic; LD1 é a sobretaxa LCD; 024 é sobretaxa Selic; 236 é o componente mensal TLP-IPCA; TR1 e TR2 são referências ligadas à TR; TD1, TD2 e TD3 são a taxa TFBD em % ao ano, sem a variação do dólar. Esses valores não podem substituir indistintamente uma taxa anual do Finame.</p><ul>{FINAME_FUNDING_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></>)}
          {funding?.mode === 'inline' ? <div className="fm-rates">{(comparar ? ['tfc', 'tfb'] : [custo]).map(id => <div className={`fm-rate-row fm-field-rate-${id}`} key={id}>
            <label htmlFor={`fm-rate-${id}`}>{id.toUpperCase()}<span className="sr-only"> · taxa de referência em % a.a.</span></label>
            {input(`rate-${id}`, manualRates[id] ?? (quotes[id] ? String(quotes[id].valor).replace('.', ',') : ''), value => setManualRates(previous => ({ ...previous, [id]: value })))}
            <span className={`fm-chip ${rates[id].manual ? 'fm-chip-manual' : quotes[id] ? 'fm-chip-painel' : 'fm-chip-falta'}`}>{rates[id].manual ? <>Taxa manual{quotes[id] && <button type="button" className="fm-rate-reset" onClick={() => setManualRates(previous => ({ ...previous, [id]: null }))}>Usar cotação<span className="sr-only"> {id.toUpperCase()}</span></button>}</> : quotes[id] ? `Painel · ${dmy(quotes[id].data)}` : 'Sem cotação'}</span>
            {ajuda(`Taxa ${id.toUpperCase()}`, <><p>Taxa de referência usada na simulação, em % a.a. Você pode digitar outra para refletir uma proposta: ela vale só nesta simulação e não altera a cotação do painel. Ao mudar prazo ou porte e região, a taxa volta à referência do painel.</p><p>{quotes[id] ? <>Cotação do painel: {pct(quotes[id].valor, 4)} a.a. em {dmy(quotes[id].data)} · {quotes[id].nome || 'TFB'} ({quotes[id].codigo}) · faixa {id === 'tfc' ? (quotes[id].faixa === 60 ? 'até 60' : '61 a 120') : faixa} meses.</> : 'Cotação do painel indisponível: informe a taxa manualmente ou aguarde a referência.'}</p></>)}
            <p className="sr-only fm-custo-valor">{quotes[id] ? <>Painel: {pct(quotes[id].valor, 4)} a.a. em {dmy(quotes[id].data)} · {quotes[id].nome || 'TFB'} ({quotes[id].codigo}) · faixa {id === 'tfc' ? (quotes[id].faixa === 60 ? 'até 60' : '61 a 120') : faixa} meses</> : 'Cotação do painel indisponível.'}</p>
            <p className="cx-error" id={`fm-rate-${id}-err`} role={erros[`rate-${id}`] ? 'alert' : undefined}>{erros[`rate-${id}`] ?? ''}</p>
          </div>)}</div> : <div className="cx-field"><span className="cx-label">{funding?.label}</span><p className="cx-hint" role="status">{funding?.notice}</p>{funding?.mode === 'dedicated' && <><p className="cx-hint">Usa condições próprias; os dados do Finame não serão transferidos.</p><a className="cx-action" href={`#calculadora/${funding.calculatorId}`} onClick={event => { if (onFundingView) { event.preventDefault(); onFundingView(funding.calculatorId) } }}>{custo === 'lcd' ? 'Abrir projeção Selic + LCD' : 'Abrir projeção TLP exigível'}</a></>}</div>}
          <div className="fm-compare-control">
            <label htmlFor="fm-compare"><input id="fm-compare" type="checkbox" role="switch" checked={comparar} disabled={funding?.mode !== 'inline'} onChange={event => setComparar(event.target.checked)} />Comparar TFC e TFB</label>
            {comparar && <p className="cx-hint">Mesma faixa e data de referência; liberação em até 90 dias.</p>}
          </div>
          {field('bndes', 'Taxa BNDES', <div className="cx-rate">{input('bndes', bndesText, setBndesText, { 'aria-label': 'Taxa do BNDES (% a.a.)' })}<span className="fm-unidade">% a.a.</span></div>, 'Taxa do BNDES conforme porte e região; editável para refletir a proposta da instituição.')}
          {field('agente', 'Spread do agente', <div className="cx-rate">{input('agente', agenteText, setAgenteText)}<span className="fm-unidade">% a.a.</span></div>, 'É a "taxa do agente financeiro" na nomenclatura do BNDES: a remuneração do banco, negociada com o cliente conforme risco, garantias e relacionamento; não há teto público. Compõe a taxa final junto com o custo financeiro e a taxa do BNDES.')}
          {field('tac', 'TAC (R$)', <MoneyInput id="fm-tac" aria-invalid={!!erros.tac} aria-describedby="fm-tac-err" value={tacText} onChange={setTacText} />, 'Tarifa de abertura de crédito cobrada pelo agente financeiro na contratação. Pré-preenchida com R$ 2.600,00 e editável; use zero se não houver. É somada ao custo total como despesa à vista, na liberação, e não entra no cronograma de juros. Confirme o valor na proposta do agente.')}
          {seg('per', 'Juros na carência', 'Juros exigíveis durante a carência, pagos em vencimentos contados retroativamente desde o fim da carência (Anexo I, item 5.3). Exemplo: 5 meses com periodicidade trimestral paga nos meses 2 e 5. Dentro de cada período, capitalizados mês a mês.',
            PERIODICIDADES.map((p) => <button key={p.id} type="button" aria-pressed={periodicidade === p.id} onClick={() => setPeriodicidade(p.id)}>{p.label}</button>))}
          <div className="fm-fgi">
            <label htmlFor="fm-fgi"><input id="fm-fgi" type="checkbox" role="switch" checked={fgiOn} onChange={e => setFgiOn(e.target.checked)} />FGI Tradicional</label>
            {fgiOn && field('fgipct', '% garantido', <select id="fm-fgipct" aria-invalid={!!erros.fgi} aria-describedby="fm-fgipct-err" value={fgiText} onChange={event => setFgiText(event.target.value)}>{Array.from({ length: (FGI.percentualMax - FGI.percentualMin) / FGI.percentualMultiplo + 1 }, (_, k) => String(FGI.percentualMin + k * FGI.percentualMultiplo)).map(v => <option key={v} value={v}>{v}%</option>)}</select>,
              <><p>{`De ${FGI.percentualMin} a ${FGI.percentualMax}% do financiamento, em múltiplos de ${FGI.percentualMultiplo} (art. 15 do Regulamento do FGI Tradicional). O agente define o percentual dentro do regulamento.`}</p><p>O FGI cobre parte da perda do banco. O agente pode repassar o ECG (Encargo por Concessão de Garantia) ao cliente, e aqui ele entra no custo total e no CET como despesa à vista, sem financiamento.</p>{prazo ? <p>{`Fator K da faixa de ${prazo} meses: ${nf(fatorKFgi(prazo), 2)}% por período de 30 dias. P = ${fgiPeriodos} períodos de 30 dias entre a liberação (${data(hoje)}) e o último vencimento (${data(vencimentoDia15(hoje, prazo, holidayCtx))}); o ECG muda com a data da liberação.${fgiPeriodos === 0 ? ' Com P zero o ECG é zero: o prazo é menor que 30 dias.' : ''}`}</p> : null}<p>O ECG é pago à vista na liberação (item 2.1.3 do Anexo V), sem incorporar ao saldo devedor e sem juros sobre o encargo. Só vale o FGI Tradicional; o FGI PEAC tem regras próprias e não é calculado aqui. A garantia não é seguro de crédito e não isenta o cliente de pagar. Limites: crédito garantido de até {brl(FGI.limiteCredito)} por cliente em cada agente, somadas as outras operações; não há teto para o valor do ECG. {FGI.vedacoes} Por isso a garantia vale aqui para TFC e TFB, com juros pagos na carência.</p></>)}
            {fgiOn && erros.fgi && <p className="cx-error" role="alert">{erros.fgi}</p>}
          </div>
          <ul className="fm-pills" aria-label="Condições fixas"><li>Amortização <b>SAC</b></li><li>Liberação <b>até 90 dias</b></li><li>ECG <b>à vista{res?.fgi ? ` · ${brl(res.fgi.ecg)}` : ''}</b></li></ul>
          </div></section>
          <button type="button" className="fm-show-result" disabled={!res} onClick={() => { const element = document.getElementById('fm-result'); element?.focus(); element?.scrollIntoView({ block: 'start' }) }}>{res ? <><span>{comparar && cets.every(Boolean) && cets.length ? 'Menor CET' : 'CET estimado'} <b>{comparar && cets.every(Boolean) && cets.length ? cetTexto(cets.reduce((best, item) => item.anual < best.anual ? item : best)) : cetTexto(cet)}</b></span><span>Ver resultado ↓</span></> : 'Ver resultado da simulação'}</button>
        </div>
      </article>

      <div className="fm-results">
      <div className="fm-print-actions"><BndesPresentation result={res} comparison={comparison} conditions={conditions} /><BndesPrint result={res} comparison={comparison} conditions={conditions} compareRequested={comparar} releaseDate={hoje} holidayCtx={holidayCtx} /></div>

      <article className="desk-panel cx-panel" aria-live="polite" id="fm-result" tabIndex={-1}>
        <header className={comparar ? 'fm-hero' : undefined}><h3 className="cx-heading">{comparar ? 'Cotação comparativa' : 'Cotação da operação'}</h3><small>Projeção · CET estimado</small>{ajuda('Limites da projeção', 'Estimativa com as regras do produto e os custos financeiros do painel. Inclui a TAC e o custo da garantia FGI quando informados; sem outras tarifas ou seguros. O CET mostrado é estimado a partir deste fluxo e não substitui o CET do contrato. A proposta do agente financeiro prevalece.')}</header>
        {res && <div className="fm-headline" aria-label="CET estimado e total">{(comparar ? (comparison?.ok ? comparison.alternatives.map((item, index) => ({ id: item.custo, cet: cets[index], total: item.result.total })) : []) : [{ id: custo, cet, total: res.total }]).map((item, index, all) => <div key={item.id} className={all.length > 1 && item.cet && all.every(other => other.cet) && item.cet.anual === Math.min(...all.map(other => other.cet.anual)) && all.some(other => other.cet.anual !== item.cet.anual) ? 'fm-best' : undefined}><span>{item.id.toUpperCase()} · CET estimado</span><b>{cetTexto(item.cet)}</b><small>Total {brl(item.total)}</small></div>)}</div>}
        <p className="fm-iof-premise">IOF zero presume recursos FINAME elegíveis. Confirme o enquadramento com a instituição.</p>
        {!res && <div className="fm-quote-empty cx-wrap"><table className="cx-matrix"><thead><tr><th scope="col">Indicador</th><th scope="col">TFC</th><th scope="col">TFB</th></tr></thead><tbody>{['Taxa de referência', 'Taxa final', 'CET estimado', 'Primeira parcela', 'Última parcela', 'Custo total estimado'].map(label => <tr key={label}><th scope="row">{label}</th><td>—</td><td>—</td></tr>)}</tbody></table></div>}
        {!res && <p className="cx-hint cx-pad" role="status">{funding?.mode !== 'inline' ? funding?.notice : r?.erros?.length ? r.erros.join(' ') : 'Complete os campos indicados para calcular.'}</p>}
        {res && (
          <>
            {referenceRetained && <p className="status stale cx-pad" role="status">Referência retida ou atualização indisponível. Confira as datas em Taxas e históricos antes de cotar.</p>}
            {!comparar && <section className="fm-destaques" aria-labelledby="fm-destaques-h">
              <h4 id="fm-destaques-h" className="sr-only">Principais números · {custo.toUpperCase()}</h4>
              <div className="fm-quote-empty cx-wrap"><table className="cx-matrix"><thead><tr><th scope="col">Resultado</th><th scope="col" className={`fm-result-${custo}`}>{custo.toUpperCase()}</th></tr></thead><tbody>
                <tr><th scope="row">Taxa de referência</th><td>{pct(custoFinanceiro, 2)}</td></tr>
                <tr><th scope="row">Taxa final</th><td>{pct(res.taxa, 2)}</td></tr>
                <tr className="fm-cet-row"><th scope="row">CET estimado{ajuda('CET estimado', cetAjuda)}</th><td>{cetTexto(cet)}</td></tr>
                <tr className="fm-summary-row"><th scope="row">Primeira parcela após carência{ajuda('Primeira parcela', 'Primeira parcela com amortização. Quando houver carência com juros, podem existir cobranças anteriores conforme a periodicidade informada.')}</th><td>{brl(res.primeiraParcela)}</td></tr>
                <tr><th scope="row">Última parcela</th><td>{brl(res.ultimaParcela)}</td></tr>
                <tr className="fm-total-row"><th scope="row">Custo total estimado{ajuda('Custo total estimado', quadros.find(item => item.id === 'total')?.ajuda)}</th><td>{brl(res.total)}</td></tr>
              </tbody></table></div>
            </section>}
            {comparar && <div className="fm-comparison" aria-label="Comparação TFC e TFB">
              {comparison?.ok ? <>
                <div className="cx-wrap" role="region" tabIndex={0} aria-label="Resultados TFC e TFB"><table className="cx-matrix"><thead><tr><th scope="col">% a.a. ou R$</th>{comparison.alternatives.map(item => <th key={item.custo} scope="col" className={`fm-result-${item.custo}`}>Com {item.custo.toUpperCase()}</th>)}</tr></thead><tbody>
                  <tr><th scope="row">Taxa de referência</th>{comparison.alternatives.map(item => <td key={item.custo} className={`fm-result-${item.custo}`}>{pct(item.rate.value, 2)}</td>)}</tr>
                  <tr><th scope="row">Taxa final</th>{comparison.alternatives.map(item => <td key={item.custo} className={`fm-result-${item.custo}`}>{pct(item.result.taxa, 2)}</td>)}</tr>
                  <tr className="fm-cet-row"><th scope="row">CET estimado{ajuda('CET estimado', cetAjuda)}</th>{comparison.alternatives.map((item, index) => <td key={item.custo} className={`fm-result-${item.custo}`}>{cetTexto(cets[index]).replace(' a.a.', '')}</td>)}</tr>
                  {[['Primeira parcela após carência', 'primeiraParcela'], ['Última parcela', 'ultimaParcela']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{comparison.alternatives.map(item => <td key={item.custo} className={`fm-result-${item.custo}`}>{brl(item.result[key])}</td>)}</tr>)}
                  <tr className="fm-total-row"><th scope="row">Custo total estimado</th>{comparison.alternatives.map(item => <td key={item.custo} className={`fm-result-${item.custo}`}>{brl(item.result.total)}</td>)}</tr>
                </tbody></table></div>
                <p className="fm-reference-sources">Referências do painel: {comparison.alternatives.map(item => `${item.custo.toUpperCase()} ${pct(item.rate.value, 4)} a.a.${item.rate.manual ? ' (taxa manual)' : ''} · referência ${item.quote.codigo} de ${dmy(item.quote.data)}`).join('; ')}. Taxas manuais, quando indicadas, substituem a referência apenas nesta simulação.</p>
                <p className="fm-difference">{Math.abs(comparison.totalDifference) < .005 ? 'Os totais projetados são iguais.' : <>Na TFB, o total fica <b>{brl(Math.abs(comparison.totalDifference))} {comparison.totalDifference > 0 ? 'maior' : 'menor'}</b></>}{cets.every(Boolean) && <>{Math.abs(comparison.totalDifference) < .005 ? ' O CET' : ' e o CET'} {Math.abs(cets[1].anual - cets[0].anual) < .005 ? 'é igual nas duas' : <><b>{nf(Math.abs(cets[1].anual - cets[0].anual), 2)} p.p. {cets[1].anual > cets[0].anual ? 'acima' : 'abaixo'}</b></>}</>}. Mesmas condições; inclui TAC e ECG do FGI quando informados, sem outras tarifas ou seguros.</p>
              </> : <p className="status stale" role="status">{comparison?.error || 'Complete os dados para comparar as alternativas.'}</p>}
            </div>}
            {comparar && comparison?.ok && <details className="fm-comparison-details fm-details"><summary>Detalhes da comparação</summary><div className="cx-wrap"><table className="cx-matrix"><thead><tr><th scope="col">Indicador</th>{comparison.alternatives.map(item => <th scope="col" key={item.custo}>{item.custo.toUpperCase()}</th>)}</tr></thead><tbody>{[['Taxa final', 'taxa'], ['CET estimado a.m.', 'cet'], ['Juros totais', 'juros'], ['IOF', 'iof'], ['TAC à vista', 'tac'], ['ECG à vista', 'ecg']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{comparison.alternatives.map(item => <td key={item.custo}>{key === 'cet' ? cetTexto(cets[comparison.alternatives.indexOf(item)], 'mensal') : key === 'taxa' ? `${pct(item.result.taxa)} a.a.` : brl(key === 'ecg' ? item.result.fgi?.ecg ?? 0 : item.result[key])}</td>)}</tr>)}</tbody></table></div></details>}
            {!comparar && <p className="fm-reference-sources">{custo.toUpperCase()}: {pct(custoFinanceiro, 4)} a.a. · {rates[custo].manual ? 'Taxa manual' : `Cotação de ${dmy(quotes[custo]?.data)}`}</p>}
            <details className="fm-details"><summary>Composição do resultado · {custo.toUpperCase()}</summary>
            <div className="fm-grade">{quadros.map(quadro)}</div>
            </details>
            {spread != null && <p className="cx-hint cx-pad fm-rotulo">Equivale a <b>CDI + {pct(spread, 2)} a.a.</b>{ajuda('Equivale a CDI +', `Spread capitalizado sobre o CDI de hoje (${pct(cdi, 2)}) que dá a mesma taxa nominal: serve para comparar com o capital de giro.`)}</p>}
            {res.avisos.map((a) => <Estado key={a} tipo="aviso">{a}</Estado>)}
          </>
        )}
      </article>

      <details className="fm-premises"><summary>Premissas e limites da simulação</summary><p>SAC · taxa capitalizada · liberação em até 90 dias para TFC e TFB · ECG à vista, quando houver FGI.</p><p>Recursos FINAME elegíveis e IOF zero (Decreto 6.306/2007, art. 8º, IX). Confirme o enquadramento com a instituição na contratação; outras origens de recursos exigem análise tributária.</p><p>Simulação indicativa, sujeita à análise e aprovação. Não constitui proposta ou compromisso de crédito.</p></details>

      {res && (
        <details className="desk-panel cx-panel fm-fluxo-panel">
          <summary>Cronograma ilustrativo · {custo.toUpperCase()}</summary>
          <header><h3 className="cx-heading">Fluxo parcela a parcela{ajuda('Fluxo parcela a parcela', `Liberação em ${data(hoje)}. Vencimentos todo dia 15; se não for dia útil (fim de semana ou feriado nacional), no próximo dia útil. Os juros de cada linha contam os dias corridos desde o vencimento anterior, sobre os dias do ano civil; não é memória contratual. O indexador (TFC ou TFB) é o da cotação em uso. "Juros pagos" é o que vence no mês: na carência, os juros acumulam e são pagos na periodicidade escolhida. IOF zero pela premissa de recursos FINAME elegíveis. Na linha de liberação, "Total pago" soma as despesas à vista: IOF, TAC e ECG do FGI quando pago à vista.`)}</h3></header>
          <p className="cx-hint cx-pad" id="fm-calendario-hipotetico">Calendário pela data da liberação: vencimento todo dia 15, ou no próximo dia útil, com juros por dias corridos. Não use como memória contratual.</p>
          <div className="cx-wrap fm-fluxo" role="region" aria-label="Fluxo parcela a parcela" aria-describedby="fm-calendario-hipotetico" tabIndex={0}>
            <table className="cx-matrix fm-tabela">
              <thead><tr><th scope="col">Nº</th><th scope="col">Vencimento</th><th scope="col">Saldo inicial</th><th scope="col">Juros pagos</th><th scope="col">Amortização</th><th scope="col">Parcela</th><th scope="col">Total pago</th><th scope="col">Saldo final</th></tr></thead>
              <tbody>
                <tr className="fm-liberacao"><th scope="row">0 · liberação</th><td>{data(hoje)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{brl(res.iofFixo + res.tac + (res.fgi && !res.fgi.incorporado ? res.fgi.ecg : 0))}</td><td>{brl(res.financiado)}</td></tr>
                {res.parcelas.map((p) => <tr key={p.mes} className={p.carencia ? 'fm-carencia' : undefined}><th scope="row">{p.mes}{p.carencia ? ' · carência' : ''}</th><td>{p.vencimento ? dmy(p.vencimento) : data(vencimentoDia15(hoje, p.mes, holidayCtx))}</td><td>{brl(p.saldoInicial)}</td><td>{brl(p.juros)}</td><td>{brl(p.amortizacao)}</td><td>{brl(p.parcela)}</td><td>{brl(p.pago)}</td><td>{brl(p.saldo)}</td></tr>)}
              </tbody>
              <tfoot><tr><th scope="row">Total</th><td>{res.parcelas.length} meses</td><td>—</td><td>{brl(res.juros)}</td><td>{brl(res.financiado)}</td><td>{brl(res.juros + res.financiado)}</td><td>{brl(res.total)}</td><td>—</td></tr></tfoot>
            </table>
          </div>
        </details>
      )}
      </div>
      </div>

      <p className="status">Base de regras: {dmy(REGRAS.conferidoEm)} · Custos: painel BNDES · Fontes em Configurações &gt; Base de dados.</p>
    </section>
  )
}
