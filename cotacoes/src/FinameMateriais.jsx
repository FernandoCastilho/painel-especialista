import { useState } from 'react'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import { parseDecimal } from './emprestimo.js'
import { useDataFile } from './useDataFile.js'
import { useMacro } from './useMacro.js'
import { keyOf, pointsOf } from './bndes.js'
import { COMPOSICOES, CUSTOS_FIXOS, FONTES, PERIODICIDADES, PORTES, REGRAS, SISTEMAS, TFC_NOMES, codigoTfc, faixaTfb, faixaTfc, simular, spreadSobreCdi, vencimento } from './finameMateriais.js'
import { FINAME_FUNDING_OPTIONS, FINAME_FUNDING_SOURCES, finameFundingAnnualRate, finameFundingOption, compareFinameFunding } from './finameFunding.js'
import { nf } from './format.js'
import Estado from './Estado.jsx'
import Help from './CalculatorHelp.jsx'
import BndesPresentation from './BndesPresentation.jsx'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (v, d = 2) => `${nf(v, d)}%`
const dmy = (iso) => (iso ? iso.split('-').reverse().join('/') : '—')
const data = (d) => d.toLocaleDateString('pt-BR')

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
export default function FinameMateriais({ onBack, onFundingView }) {
  const bndes = useDataFile('bndes.json')
  const moedas = useDataFile('moedas.json')
  const macro = useMacro()
  const [valorText, setValorText] = useState('500.000,00')
  const [partText, setPartText] = useState('100')
  const [prazoText, setPrazoText] = useState('60')
  const [carText, setCarText] = useState('12')
  const [custo, setCusto] = useState('tfc')
  const [comparar, setComparar] = useState(false)
  const [liberacao, setLiberacao] = useState(30)
  const [liberacaoAntesComparar, setLiberacaoAntesComparar] = useState(30)
  const [porte, setPorte] = useState('mpme')
  const [bndesText, setBndesText] = useState(String(REGRAS.taxaBndes.mpme).replace('.', ','))
  const [agenteText, setAgenteText] = useState('3,00')
  const [sistema, setSistema] = useState('sac')
  const [periodicidade, setPeriodicidade] = useState(3)
  const [composicao, setComposicao] = useState('capitalizada')
  const [finameEligible, setFinameEligible] = useState(false)
  const [hoje] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d })

  const money = parseMoneyInput(valorText)
  const participacao = parseDecimal(partText)
  const prazo = /^\d+$/.test(prazoText.trim()) ? Number(prazoText) : null
  const carencia = /^\d+$/.test(carText.trim()) ? Number(carText) : null
  const taxaBndes = parseDecimal(bndesText)
  const taxaAgente = parseDecimal(agenteText)

  // Custo financeiro do painel
  const faixa = prazo ? faixaTfb(prazo) : 60
  const tfbPts = pointsOf(bndes.data, keyOf(faixa, liberacao))
  const tfb = tfbPts.length ? { data: tfbPts.at(-1)[0], valor: tfbPts.at(-1)[1], codigo: keyOf(faixa, liberacao) } : null
  const tfcCodigo = codigoTfc(porte, prazo ?? 60)
  const tfcPts = Array.isArray(moedas.data?.series?.[tfcCodigo]?.points) ? moedas.data.series[tfcCodigo].points : []
  const tfc = tfcPts.length ? { data: tfcPts.at(-1)[0], valor: tfcPts.at(-1)[1], codigo: tfcCodigo, nome: TFC_NOMES[tfcCodigo], faixa: faixaTfc(prazo ?? 60) } : null
  const fixa = CUSTOS_FIXOS.has(custo)
  const cdi = Array.isArray(macro.data?.cdi) && macro.data.cdi.length ? macro.data.cdi.at(-1)[1] : null
  // Na TFB, o custo financeiro é a própria TFB (nominal). A TLP exigível usa motor próprio, sem correção capitalizada do saldo.
  const funding = finameFundingOption(custo)
  const custoFinanceiro = finameFundingAnnualRate(custo, { tfb: tfb?.valor, tfc: tfc?.valor })

  const erros = {
    valor: money.ok && money.value > 0 ? null : money.error || 'Informe um valor maior que zero.',
    part: participacao !== null && participacao >= REGRAS.participacaoMinPct && participacao <= 100 ? null : 'Participação de 1 a 100%.',
    prazo: prazo !== null && prazo >= 1 && prazo <= REGRAS.prazoMaxMeses ? null : `Prazo de 1 a ${REGRAS.prazoMaxMeses} meses (7 anos).`,
    car: carencia !== null && carencia >= 0 && carencia <= (fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses) && (prazo === null || carencia < prazo) ? null : `Carência de 0 a ${fixa ? REGRAS.carenciaMaxTfbMeses : REGRAS.carenciaMaxMeses} meses${fixa ? ` com ${custo.toUpperCase()}` : ''}, menor que o prazo.`,
    bndes: taxaBndes !== null && taxaBndes <= 100 ? null : 'Informe a taxa do BNDES em % a.a.',
    agente: taxaAgente !== null && taxaAgente <= 100 ? null : 'Informe o spread da instituição em % a.a.',
    iof: finameEligible ? null : 'Confirme os recursos FINAME elegíveis ao art. 8º, IX. Outras origens exigem análise tributária antes da simulação.',
  }
  const pronto = funding?.mode === 'inline' && !Object.values(erros).some(Boolean) && Number.isFinite(custoFinanceiro)
  const r = pronto ? simular({ valor: money.value, participacao, prazo, carencia, custo, custoFinanceiro, ipca: 0, taxaBndes, taxaAgente, sistema, periodicidade, composicao, iof: { fixed: 0, daily: 0 } }) : null
  const res = r?.ok ? r : null
  const comparison = comparar && pronto ? compareFinameFunding({ valor: money.value, participacao, prazo, carencia, custo, liberacao, ipca: 0, taxaBndes, taxaAgente, sistema, periodicidade, composicao, iof: { fixed: 0, daily: 0 } }, { tfc, tfb }) : null
  const spread = res ? spreadSobreCdi(res.taxaNominal, cdi) : null
  const referenceRetained = !!(((custo === 'tfc' || comparar) && (moedas.stale || moedas.status === 'error' || moedas.data?.stale?.[tfcCodigo])) || ((custo === 'tfb' || comparar) && (bndes.stale || bndes.status === 'error' || bndes.data?.stale?.[keyOf(faixa, liberacao)])))

  const ajuda = (label, texto) => (texto ? <Help label={`Ajuda: ${label}`}>{texto}</Help> : null)
  const field = (key, label, control, hint, valor) => (
    <div className="cx-field">
      <span className="fm-rotulo"><label htmlFor={`fm-${key}`}>{label}</label>{ajuda(label, hint)}</span>
      {control}
      {valor && <p className="cx-hint fm-custo-valor">{valor}</p>}
      <p className="cx-error" id={`fm-${key}-err`} role={erros[key] ? 'alert' : undefined}>{erros[key] ?? ''}</p>
    </div>
  )
  const seg = (id, label, hint, botoes, extra = null) => (
    <div className="cx-field">
      <span className="fm-rotulo"><span className="cx-label" id={`fm-${id}-l`}>{label}</span>{ajuda(label, hint)}</span>
      <div className="seg" role="group" aria-labelledby={`fm-${id}-l`}>{botoes}</div>
      {extra}
    </div>
  )
  const input = (key, value, onChange, extra = {}) => <input id={`fm-${key}`} inputMode="decimal" autoComplete="off" aria-invalid={!!erros[key]} aria-describedby={`fm-${key}-err`} value={value} onChange={(e) => onChange(e.target.value)} onFocus={(e) => e.target.select()} {...extra} />

  const regrasAjuda = (
    <>
        <ul>
          <li><b>O que financia:</b> {REGRAS.itens}. Fora: {REGRAS.foraDoProduto}. Nacionalização: {REGRAS.nacionalizacao}.</li>
          <li><b>Quem pede:</b> empresas de qualquer porte sediadas no país, empresário individual, MEI, produtor rural pessoa física, administração pública, cooperativas, fundações e associações; operação indireta, por agente financeiro credenciado.</li>
          <li><b>Limites:</b> até {REGRAS.participacaoMaxPct}% dos itens; {brl(REGRAS.tetoCliente12m)} por cliente a cada 12 meses (da homologação); reembolso de notas emitidas até {REGRAS.reembolsoMeses} meses antes do protocolo. O teto de {brl(REGRAS.tetoOperacao)} por operação aparece em materiais do BNDES e da CNI (2020 a 2025), mas não consta na página oficial em 04/11/2026: a calculadora só avisa; confirme com o agente.</li>
          <li><b>Prazo:</b> até {REGRAS.prazoMaxMeses} meses, com até {REGRAS.carenciaMaxMeses} de carência ({REGRAS.carenciaMaxTfbMeses} com TFB, TFC ou TFC MPME). Juros exigíveis na carência; depois, SAC ou Price mensal com juros junto do principal.</li>
          <li><b>Taxa:</b> custo financeiro (TFB, TFBD, TLP, Taxa LCD, Taxa Fixa Composta ou Taxa Fixa Composta MPME; Selic suspensa pela {REGRAS.selicSuspensa}) + taxa do BNDES ({pct(REGRAS.taxaBndes['mpme-nne'])} MPME N/NE; {pct(REGRAS.taxaBndes.mpme)} MPME nas demais regiões e grandes) + spread da instituição financeira (a "taxa do agente financeiro" do BNDES), negociado. TFC e TFB usam este cronograma aproximado; TLP exigível e Taxa LCD abrem projeções próprias, e TFBD identifica os dados e o modelo ainda necessários.</li>
          <li><b>IOF:</b> Alíquota zero apenas para recursos FINAME elegíveis, mediante confirmação (art. 8º, IX).</li>
          <li><b>Garantias:</b> livre negociação entre o agente e o cliente, observadas as normas do Banco Central; admitida a garantia do FGI (Tradicional ou PEAC) ou do FG BNDES-SEBRAE. Seguro conforme a política do agente.</li>
          <li><b>Conta:</b> taxa composta das três parcelas (capitalizada, padrão do BNDES: o exemplo oficial da página "Taxa de juros" é 1,07 × 1,015 × 1,03 − 1 = 11,86%; ou somada); taxa mensal por juros compostos em meses iguais de 1/12 do ano apenas nesta aproximação. A base de dias, o calendário e os ajustes do contrato precisam ser confirmados com o agente; diferenças de dias podem alterar os juros totais mesmo que a soma anual de dias úteis coincida, pois o saldo muda; juros da carência capitalizados dentro do período e pagos no fim dele; a parte dos juros que remunera cada um é apurada em camadas, no mesmo cronograma: custo financeiro = juros só com o custo; BNDES = juros com custo + BNDES menos juros só com o custo; spread da instituição = juros com a taxa completa menos juros com custo + BNDES; SAC ou Price mensal apenas em TFC/TFB nesta tela. TLP exigível tem perfil próprio, sem capitalizar IPCA positivo no principal. Esta tela calcula IOF zero apenas após confirmação de recursos FINAME elegíveis.</li>
          <li>O que ainda depende de conferência com o agente: valor mínimo, aceitação de Price no produto, periodicidade padrão dos juros na carência e a origem elegível dos recursos FINAME para o IOF zero. A conta aqui é estimativa; a proposta do agente prevalece.</li>
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
      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading">Dados da operação{ajuda('Regras do produto e fontes', regrasAjuda)}</h3><small>Regras: {dmy(REGRAS.conferidoEm)}</small></header>
        <div className="cx-form">
          {field('valor', 'Valor dos materiais', <MoneyInput id="fm-valor" aria-invalid={!!erros.valor} aria-describedby="fm-valor-err" value={valorText} onChange={setValorText} />, 'Bens industrializados novos, nacionais, enquadrados na lista NCM e nos critérios CST/CSOSN do Finame Materiais; não se trata do credenciamento CFI do Finame tradicional. Notas de até 12 meses antes do protocolo.')}
          {field('part', 'Participação do BNDES (%)', input('part', partText, setPartText), 'Até 100% dos itens financiáveis.')}
          {field('prazo', 'Prazo total (meses)', input('prazo', prazoText, setPrazoText, { inputMode: 'numeric' }), 'Até 84 meses (7 anos).')}
          {field('car', 'Carência (meses)', input('car', carText, setCarText, { inputMode: 'numeric' }), fixa ? `Até 12 meses com ${custo.toUpperCase()}; juros exigíveis durante a carência.` : 'Até 24 meses; juros exigíveis durante a carência.')}
          {field('custo', 'Custo financeiro', <select id="fm-custo" value={custo} onChange={event => { const next = finameFundingOption(event.target.value); if (next) { setCusto(next.id); setFinameEligible(false); if (next.mode !== 'inline') { setComparar(false); if (comparar) setLiberacao(liberacaoAntesComparar) } } }}>{FINAME_FUNDING_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}{option.mode === 'dedicated' ? ' · projeção própria' : option.mode === 'unavailable' ? ' · indisponível' : ''}</option>)}</select>,
            <><p>{funding?.hint} Selic pura suspensa como custo financeiro ({REGRAS.selicSuspensa}).</p><p>As moedas contratuais já exibidas pelo painel têm unidades diferentes: US$ (604) é nível cambial; 143 é índice Selic; LD1 é a sobretaxa LCD; 024 é sobretaxa Selic; 236 é o componente mensal TLP-IPCA; TR1 e TR2 são referências ligadas à TR. Esses valores não podem substituir indistintamente uma taxa anual do Finame.</p><ul>{FINAME_FUNDING_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></>)}
          {custo === 'tfc' ? (
            <div className="cx-field">
              <span className="fm-rotulo"><span className="cx-label">TFC · série do BNDES</span>{ajuda('TFC · série do BNDES', 'Série das Moedas Contratuais do BNDES escolhida pelo porte (MPME tem série própria) e pela faixa de prazo: TFC_60.90 ou TFC_MPME_60.90 até 60 meses; TFC_120.90 ou TFC_MPME_120.90 de 61 a 120 meses. Valor do último dia publicado, coletado pelo painel (aba BNDES).')}</span>
              <p className="cx-hint fm-custo-valor">{tfc ? <>{tfc.nome} ({tfc.codigo}), {PORTES.find((p) => p.id === porte).mpme ? 'MPME' : 'grande empresa'}, faixa {tfc.faixa === 60 ? 'até 60' : '61 a 120'} meses: <b>{pct(tfc.valor, 4)} a.a.</b> em {dmy(tfc.data)}.</> : moedas.status === 'loading' ? 'Carregando a TFC…' : 'TFC indisponível no painel; a conta fica sem custo financeiro.'}</p>
            </div>
          ) : custo === 'tfb' ? (
            seg('lib', 'TFB · liberação dos recursos', 'Prazo entre a contratação e a liberação dos recursos pelo BNDES: a TFB é cotada por faixa de prazo do financiamento e por liberação em 30 ou 90 dias. Valor do último dia publicado, coletado pelo painel (aba BNDES).',
              [30, 90].map((d) => <button key={d} type="button" aria-pressed={liberacao === d} disabled={comparar && d !== 90} onClick={() => setLiberacao(d)}>{d} dias</button>),
              <p className="cx-hint fm-custo-valor">{tfb ? <>TFB da faixa de {faixa} meses: <b>{pct(tfb.valor, 4)} a.a.</b> em {dmy(tfb.data)}.</> : bndes.status === 'loading' ? 'Carregando a TFB…' : 'TFB indisponível no painel; a conta fica sem custo financeiro.'}</p>)
          ) : <div className="cx-field"><span className="cx-label">{funding?.label}</span><p className="cx-hint" role="status">{funding?.notice}</p>{funding?.mode === 'dedicated' && <><p className="cx-hint">Usa condições próprias; os dados do Finame não serão transferidos.</p><a className="cx-action" href={`#calculadora/${funding.calculatorId}`} onClick={event => { if (onFundingView) { event.preventDefault(); onFundingView(funding.calculatorId) } }}>{custo === 'lcd' ? 'Abrir projeção Selic + LCD' : 'Abrir projeção TLP exigível'}</a></>}</div>}
          <div className="fm-compare-control">
            <label htmlFor="fm-compare"><input id="fm-compare" type="checkbox" checked={comparar} disabled={funding?.mode !== 'inline'} onChange={event => { setComparar(event.target.checked); if (event.target.checked) { setLiberacaoAntesComparar(liberacao); setLiberacao(90) } else setLiberacao(liberacaoAntesComparar) }} />Comparar outro custo financeiro</label>
            <p className="cx-hint">{comparar ? 'Comparação exige a mesma faixa e data de referência. Durante a comparação, a TFB usa liberação em 90 dias, como a série TFC.' : 'Abra a comparação TFC × TFB sem preencher novamente a operação.'}</p>
          </div>
          {seg('porte' , 'Taxa do BNDES · porte e região', '0,95% a.a. para MPMEs no Norte e Nordeste; 1,25% a.a. para MPMEs nas demais regiões e para grandes empresas (página do produto em 04/11/2026; a mudança de 1,15% para 1,25% em 22/01/2026 é informada pela Abimaq). O porte também escolhe a série da TFC. Editável.',
            PORTES.map((p) => <button key={p.id} type="button" aria-pressed={porte === p.id} onClick={() => { setPorte(p.id); setBndesText(String(p.taxa).replace('.', ',')) }}>{p.label}</button>),
            <><div className="cx-rate">{input('bndes', bndesText, setBndesText, { 'aria-label': 'Taxa do BNDES (% a.a.)' })}<span className="fm-unidade">% a.a.</span></div><p className="cx-error" id="fm-bndes-err" role={erros.bndes ? 'alert' : undefined}>{erros.bndes ?? ''}</p></>)}
          {field('agente', 'Remuneração do agente (% a.a.)', <div className="cx-rate">{input('agente', agenteText, setAgenteText)}<span className="fm-unidade">% a.a.</span></div>, 'É a "taxa do agente financeiro" na nomenclatura do BNDES: a remuneração do banco, negociada com o cliente conforme risco, garantias e relacionamento; não há teto público. Compõe a taxa final junto com o custo financeiro e a taxa do BNDES.')}
          {seg('sis', 'Sistema de amortização', `TFC/TFB nesta tela: SAC: ${SISTEMAS[0].hint}. Price: ${SISTEMAS[1].hint}. Parcelas mensais após a carência. Outras modalidades usam condições próprias.`,
            SISTEMAS.map((s) => <button key={s.id} type="button" aria-pressed={sistema === s.id} onClick={() => setSistema(s.id)}>{s.label}</button>))}
          {seg('per', 'Juros na carência', 'Juros exigíveis durante a carência, pagos em vencimentos contados retroativamente desde o fim da carência (Anexo I, item 5.3). Exemplo: 5 meses com periodicidade trimestral paga nos meses 2 e 5. Dentro de cada período, capitalizados mês a mês.',
            PERIODICIDADES.map((p) => <button key={p.id} type="button" aria-pressed={periodicidade === p.id} onClick={() => setPeriodicidade(p.id)}>{p.label}</button>))}
          {seg('comp', 'Composição da taxa', `Capitalizada: ${COMPOSICOES[0].hint}. Somada: ${COMPOSICOES[1].hint}.`,
            COMPOSICOES.map((c) => <button key={c.id} type="button" aria-pressed={composicao === c.id} onClick={() => setComposicao(c.id)}>{c.label}</button>))}
          <div className="cx-iof">
            <label htmlFor="fm-finame-eligible"><input id="fm-finame-eligible" type="checkbox" checked={finameEligible} onChange={e => setFinameEligible(e.target.checked)} />Confirmo com a instituição que esta operação utiliza recursos da FINAME elegíveis à alíquota zero do art. 8º, IX, do Decreto 6.306/2007.</label>
            <p className="cx-hint">IOF automático: zero somente com esse enquadramento confirmado. O nome BNDES ou o indexador, isoladamente, não comprovam a origem dos recursos. Para outras origens ou dúvida, a simulação fica bloqueada até confirmar o tratamento tributário.</p>
            <p className="cx-error" id="fm-iof-err" role={erros.iof ? 'alert' : undefined}>{erros.iof}</p>
          </div>
          <button type="button" className="fm-show-result" disabled={!res} onClick={() => { const element = document.getElementById('fm-result'); element?.focus(); element?.scrollIntoView({ block: 'start' }) }}>Ver resultado da simulação</button>
        </div>
      </article>

      <div className="fm-results">

      <article className="desk-panel cx-panel" aria-live="polite" id="fm-result" tabIndex={-1}>
        <header><h3 className="cx-heading">Resultado estimado{ajuda('Limites da projeção', 'Estimativa com as regras do produto e os custos financeiros do painel. Sem tarifas, seguros ou garantias; não representa o CET. A proposta do agente financeiro prevalece.')}</h3><BndesPresentation result={res} comparison={comparison} conditions={{ valor: money.value, participacao, prazo, carencia, custo, quote: custo === 'tfc' ? tfc : tfb, liberacao, porte: PORTES.find(item => item.id === porte).label, taxaBndes, taxaAgente, sistema, periodicidade: PERIODICIDADES.find(item => item.id === periodicidade).label, composicao, iofConfirmed: finameEligible, rulesDate: REGRAS.conferidoEm, retained: referenceRetained }} /><small>Projeção · não é CET</small></header>
        {!res && <p className="cx-hint cx-pad" role="status">{funding?.mode !== 'inline' ? funding?.notice : r?.erros?.length ? r.erros.join(' ') : 'Complete os campos indicados e confirme o enquadramento do IOF para calcular.'}</p>}
        {res && (
          <>
            <div className="fm-hero"><span>Primeira parcela após a carência · {custo.toUpperCase()}</span><b>{brl(res.primeiraParcela)}</b><small>{res.parcelasAmortizacao} parcelas mensais · taxa final {pct(res.taxa)} a.a.</small></div>
            <dl className="fm-summary"><div><dt>Juros totais</dt><dd>{brl(res.juros)}</dd></div><div><dt>IOF</dt><dd>{brl(res.iof)}</dd></div><div><dt>Total projetado sem despesas</dt><dd>{brl(res.total)}</dd></div></dl>
            <p className="cx-hint cx-pad">Atualização automática ao editar. Sem tarifas, seguros ou garantias · não é CET.</p>
            {referenceRetained && <p className="status stale cx-pad" role="status">Referência retida ou atualização indisponível. Confira as datas em Taxas e históricos antes de cotar.</p>}
            {comparar && <div className="fm-comparison" aria-label="Comparação TFC e TFB">
              {comparison?.ok ? <>
                <div className="cx-wrap" role="region" tabIndex={0} aria-label="Resultados TFC e TFB"><table className="cx-matrix"><thead><tr><th scope="col">Indicador</th>{comparison.alternatives.map(item => <th key={item.custo} scope="col">{item.custo.toUpperCase()}<small>{pct(item.quote.valor, 4)} a.a. · {dmy(item.quote.data)}<br />{item.custo === 'tfc' ? tfcCodigo : keyOf(faixa, 90)} · liberação 90 dias</small></th>)}</tr></thead><tbody>
                  {[['Primeira parcela após carência', item => brl(item.result.primeiraParcela)], ['Taxa final', item => `${pct(item.result.taxa)} a.a.`], ['Juros totais', item => brl(item.result.juros)], ['IOF', item => brl(item.result.iof)], ['Total projetado sem despesas', item => brl(item.result.total)]].map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{comparison.alternatives.map(item => <td key={item.custo}>{value(item)}</td>)}</tr>)}
                </tbody></table></div>
                <p className="fm-difference">{Math.abs(comparison.totalDifference) < .005 ? 'Os totais projetados são iguais.' : <>O total projetado em TFB é <b>{brl(Math.abs(comparison.totalDifference))}</b> {comparison.totalDifference > 0 ? 'maior' : 'menor'} que em TFC.</>} Mesmos valor, prazo, carência, amortização e remunerações. Diferença estimada, sem tarifas, seguros ou garantias.</p>
              </> : <p className="status stale" role="status">{comparison?.error || 'Complete os dados para comparar as alternativas.'}</p>}
            </div>}
            <details className="fm-details"><summary>Composição do resultado · {custo.toUpperCase()}</summary>
            <div className="fm-grade">
              <div className="fm-kpi"><span className="fm-rotulo">Taxa final{ajuda('Taxa final', <><p>{`Taxa final composta: (1 + custo financeiro) × (1 + taxa do BNDES) × (1 + spread da instituição) − 1${composicao === 'somada' ? ', ou a soma das três quando a composição é somada' : ''}. A taxa mensal é a equivalente em meses de 1/12 do ano.`}</p><p>{pct(res.taxaMensal, 3)} a.m. · {pct(custoFinanceiro, 2)} {custo.toUpperCase()} + {pct(taxaBndes, 2)} BNDES + {pct(taxaAgente, 2)} spread da instituição, {composicao === 'somada' ? 'somadas' : 'capitalizadas'}</p></>)}</span><b>{pct(res.taxa, 2)} a.a.</b><small>{pct(res.taxaMensal, 3)} a.m.</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Valor financiado{ajuda('Valor financiado', 'Valor dos materiais × participação do BNDES; o restante é recursos próprios do cliente.')}</span><b>{brl(res.financiado)}</b><small>{res.recursosProprios > 0 ? `${brl(res.recursosProprios)} de recursos próprios` : '100% dos itens financiáveis'}</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Juros na carência{ajuda('Juros na carência', 'Juros do período de carência, pagos na periodicidade escolhida (dentro do período, capitalizados mês a mês); sem amortização nesse período.')}</span><b>{brl(res.jurosCarencia)}</b><small>{carencia} {carencia === 1 ? 'mês' : 'meses'} · {PERIODICIDADES.find((p) => p.id === periodicidade).label.toLowerCase()}</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Parcelas{ajuda('Parcelas', 'Primeira parcela após a carência (juros + amortização). No SAC as parcelas caem; na Price são iguais em TFC e TFB, dentro da aproximação de períodos mensais iguais.')}</span><b>{brl(res.primeiraParcela)}</b><small>{res.parcelasAmortizacao}x mensais{sistema === 'sac' ? ` · última ${brl(res.ultimaParcela)}` : ' · iguais'}</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Spread da instituição{ajuda('Spread da instituição', <><p>{'Remuneração do banco (a "taxa do agente financeiro" do BNDES). Em R$: juros com a taxa completa menos juros com custo financeiro + taxa do BNDES, no mesmo cronograma; a parte do BNDES é juros com custo + BNDES menos juros só com o custo, e o custo financeiro é o restante. Em pontos: quanto o spread acrescenta à taxa final, que na composição capitalizada é o spread multiplicado por (1 + custo) × (1 + BNDES).'}</p><p>{brl(res.atribuicao.agente)} dos juros ({pct(res.juros > 0 ? (res.atribuicao.agente / res.juros) * 100 : 0, 1)}) · +{nf(res.spreadAgentePp, 2)} p.p. sobre custo + BNDES · BNDES {brl(res.atribuicao.bndes)} · custo financeiro {brl(res.atribuicao.custoFinanceiro)}</p></>)}</span><b>{pct(taxaAgente, 2)} a.a.</b><small>+{nf(res.spreadAgentePp, 2)} p.p. na taxa final</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Juros totais{ajuda('Juros totais', 'Soma dos juros da carência e das parcelas da projeção TFC/TFB.')}</span><b>{brl(res.juros)}</b><small>{pct((res.juros / res.financiado) * 100, 1)} do financiado</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">IOF{ajuda('IOF', 'Alíquota zero condicionada à confirmação de recursos FINAME elegíveis (Decreto 6.306/2007, art. 8º, IX).')}</span><b>{brl(res.iof)}</b><small>{res.iof > 0 ? `${brl(res.iofFixo)} adicional + ${brl(res.iofDiario)} diário` : 'Alíquota zero'}</small></div>
              <div className="fm-kpi"><span className="fm-rotulo">Pagamento final{ajuda('Pagamento final', 'Valor financiado + juros totais + IOF: tudo o que o cliente paga nesta projeção TFC/TFB, sem tarifas, seguros ou garantias.')}</span><b>{brl(res.total)}</b></div>
            </div>
            </details>
            {spread != null && <p className="cx-hint cx-pad fm-rotulo">Equivale a <b>CDI + {pct(spread, 2)} a.a.</b>{ajuda('Equivale a CDI +', `Spread capitalizado sobre o CDI de hoje (${pct(cdi, 2)}) que dá a mesma taxa nominal: serve para comparar com o capital de giro.`)}</p>}
            {res.avisos.map((a) => <Estado key={a} tipo="aviso">{a}</Estado>)}
          </>
        )}
      </article>

      {res && (
        <details className="desk-panel cx-panel fm-fluxo-panel" open>
          <summary>Cronograma ilustrativo · {custo.toUpperCase()}</summary>
          <header><h3 className="cx-heading">Fluxo parcela a parcela{ajuda('Fluxo parcela a parcela', `Calendário hipotético: liberação ilustrativa hoje (${data(hoje)}) e datas no mesmo dia de cada mês, recuando para o último dia em meses mais curtos. Não aplica data-base, dia 15, feriados ou ajuste bancário de vencimentos; não é memória contratual. "Juros pagos" é o que vence no mês: na carência, os juros acumulam e são pagos na periodicidade escolhida. IOF zero no enquadramento FINAME confirmado.`)}</h3></header>
          <p className="cx-hint cx-pad" id="fm-calendario-hipotetico">Calendário hipotético, em meses iguais. Datas apenas ilustrativas, sem ajuste bancário ou feriados. Não use como memória contratual.</p>
          <div className="cx-wrap fm-fluxo" role="region" aria-label="Fluxo parcela a parcela" aria-describedby="fm-calendario-hipotetico" tabIndex={0}>
            <table className="cx-matrix fm-tabela">
              <thead><tr><th scope="col">Nº</th><th scope="col">Data ilustrativa</th><th scope="col">Saldo inicial</th><th scope="col">Juros pagos</th><th scope="col">Amortização</th><th scope="col">Parcela</th><th scope="col">IOF</th><th scope="col">Total pago</th><th scope="col">Saldo final</th></tr></thead>
              <tbody>
                <tr className="fm-liberacao"><th scope="row">0 · liberação hipotética</th><td>{data(hoje)}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{brl(res.iofFixo)}</td><td>{brl(res.iofFixo)}</td><td>{brl(res.financiado)}</td></tr>
                {res.parcelas.map((p) => <tr key={p.mes} className={p.carencia ? 'fm-carencia' : undefined}><th scope="row">{p.mes}{p.carencia ? ' · carência' : ''}</th><td>{data(vencimento(hoje, p.mes))}</td><td>{brl(p.saldoInicial)}</td><td>{brl(p.juros)}</td><td>{brl(p.amortizacao)}</td><td>{brl(p.parcela)}</td><td>{brl(p.iof)}</td><td>{brl(p.pago)}</td><td>{brl(p.saldo)}</td></tr>)}
              </tbody>
              <tfoot><tr><th scope="row">Total</th><td>{res.parcelas.length} meses</td><td>—</td><td>{brl(res.juros)}</td><td>{brl(res.financiado)}</td><td>{brl(res.juros + res.financiado)}</td><td>{brl(res.iof)}</td><td>{brl(res.total)}</td><td>—</td></tr></tfoot>
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
