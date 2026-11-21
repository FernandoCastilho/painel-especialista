import { useState } from 'react'
import ExpandablePanel from './ExpandablePanel.jsx'
import Help from './CalculatorHelp.jsx'
import MoneyInput from './MoneyInput.jsx'
import { parseMoneyInput } from './moneyInput.js'
import {
  NECESSIDADES, CRITERIOS_4131, OPERACOES, necessidadePorId, cicloDeCaixa, MARCAS, CONSULTA, MAX_FOLHA, UNIDADES, PORTE_ROTULO, CNPJ_SERVICO,
  montarFolha, analisarFaturamento, consultarCnpj, cnpjValido, formatarCnpj, soDigitos, porteBndes, CONSULTA_CNPJ_ATIVA, RECEITA_CNPJ,
} from './arvoreCredito.js'
import './CalculatorStandard.css'
import './ArvoreCredito.css'
import CalcBack from './CalcBack.jsx'

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const um = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const pct = (v) => `${Math.round(v * 100)}%`

const TIPOS = [['', 'Escolha'], ['sa', 'S.A.'], ['ltda', 'Ltda.'], ['cooperativa', 'Cooperativa'], ['outra', 'Outra']]
const REGIMES = [['', 'Escolha'], ['real', 'Lucro Real'], ['presumido', 'Lucro Presumido'], ['simples', 'Simples Nacional']]
const GARANTIAS = [['duplicatas', 'Duplicatas ou recebíveis'], ['bem', 'O próprio bem'], ['imovel', 'Imóvel'], ['aplicacao', 'Aplicação financeira'], ['aval', 'Aval dos sócios']]
const ROTULO_TIPO = Object.fromEntries(TIPOS)
const ROTULO_REGIME = Object.fromEntries(REGIMES)

// Ícone: árvore com três galhos (as três possibilidades da folha).
export function ArvoreCreditoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v5M12 11 5 16M12 11l7 5M12 11v5" />
      <rect x="2.5" y="16" width="5" height="4" rx="1" />
      <rect x="9.5" y="16" width="5" height="4" rx="1" />
      <rect x="16.5" y="16" width="5" height="4" rx="1" />
    </svg>
  )
}

const EXEMPLO_FAT = `Faturamento e endividamento (fictício)
Competência\tFaturamento (R$ mil)\tEndividamento (R$ mil)
Dez/25\t3.900\t5.200
Jan/26\t1.800\t5.400
Fev/26\t1.500\t5.600
Mar/26\t1.700\t5.500
Abr/26\t2.400\t5.300
Mai/26\t2.600\t5.100
Jun/26\t2.500\t5.000
Jul/26\t2.700\t4.900
Ago/26\t2.900\t5.000
Set/26\t3.100\t5.100
Out/26\t3.600\t5.300
Nov/26\t3.800\t5.400`

function Campo({ id, label, children, ajuda }) {
  return (
    <div className="cx-field">
      <div className="cx-field-label"><label htmlFor={id}>{label}</label>{ajuda && <Help title={label}><p>{ajuda}</p></Help>}</div>
      {children}
    </div>
  )
}

function Fontes({ fontes }) {
  return (
    <p className="ac-fontes">
      Base: {fontes.map((f, i) => <span key={f.nome}>{i > 0 && ' · '}<a href={f.url} target="_blank" rel="noreferrer">{f.nome}</a>{f.marca !== 'of' && <em> ({MARCAS[f.marca].toLowerCase()})</em>}</span>)}
      {' '}· conferido em {CONSULTA}
    </p>
  )
}

function Cartao({ op, posicao, onView, cliente }) {
  return (
    <li className="ac-card">
      <h4>{posicao != null && <span className="ac-pos" aria-hidden="true">{posicao}</span>}{op.nome}</h4>
      <p className="ac-resumo">{op.resumo}</p>
      <dl className="ac-dl">
        <dt>Cobre</dt><dd>{op.cobre}</dd>
        {op.foraDeCobertura !== '—' && <><dt>Fica de fora</dt><dd>{op.foraDeCobertura}</dd></>}
        {op.impostos !== '—' && <><dt>Impostos</dt><dd>{op.impostos}</dd></>}
        <dt>Parcela</dt><dd>{op.parcelaAjustavel ? 'Pode ser ajustada aos meses fortes e fracos (só juros nos fracos).' : 'Fixa.'}</dd>
      </dl>
      {op.avisosPerfil.length > 0 && <ul className="ac-avisos">{op.avisosPerfil.map((a) => <li key={a}>{a}</li>)}</ul>}
      <Fontes fontes={op.fontes} />
      {!cliente && op.calculadora && <button type="button" className="ac-sim" onClick={() => onView(op.calculadora)}>Simular na calculadora ›</button>}
    </li>
  )
}

function OpcoesComplementares({ opcoes, onView, cliente }) {
  if (!opcoes?.length) return null
  return <section aria-label="Alívio indireto de caixa">
    <h3>Alívio indireto de caixa</h3>
    <ul className="ac-cards">{opcoes.map((op) => <Cartao key={op.id} op={op} onView={onView} cliente={cliente} />)}</ul>
  </section>
}

export default function ArvoreCredito({ onBack, onView = () => {} }) {
  const [cnpj, setCnpj] = useState('')
  const [consulta, setConsulta] = useState({ estado: 'parado' })
  const [empresa, setEmpresa] = useState({ razaoSocial: '', municipio: '', uf: '', cnae: '', cnaeDescricao: '', tipo: '', regime: '' })
  const [necessidade, setNecessidade] = useState('')
  const [alongamento, setAlongamento] = useState({})
  const [notasAlongamento, setNotasAlongamento] = useState(false)
  const [finalidade, setFinalidade] = useState('')
  const [valorTexto, setValorTexto] = useState('')
  const [prazoTexto, setPrazoTexto] = useState('')
  const [receitaTexto, setReceitaTexto] = useState('')
  const [marcas, setMarcas] = useState({ exporta: false, importa: false, notasFiname: false, notasCpr: false, maquinaCredenciada: true })
  const [garantias, setGarantias] = useState([])
  const [fatTexto, setFatTexto] = useState('')
  const [unidade, setUnidade] = useState('')
  const [curtaTexto, setCurtaTexto] = useState('')
  const [ciclo, setCiclo] = useState({ pmr: '', pme: '', pmp: '', custo: '', compras: '' })
  const [visaoCliente, setVisaoCliente] = useState(false)

  const valor = parseMoneyInput(valorTexto, { optional: true })
  const receita = parseMoneyInput(receitaTexto, { optional: true })
  const curta = parseMoneyInput(curtaTexto, { optional: true })
  const prazo = /^\d+$/.test(prazoTexto.trim()) ? Number(prazoTexto) : 0
  const fat = fatTexto.trim() ? analisarFaturamento(fatTexto, { unidade, valorPedido: valor.ok ? valor.value : 0, dividaCurta: curta.ok && curtaTexto.trim() ? curta.value : null }) : null
  const receitaAnual = receita.ok && receita.value > 0 ? receita.value : fat?.ok ? fat.receitaAnualizada : 0
  const folha = necessidade ? montarFolha({
    necessidade, valor: valor.ok ? valor.value : 0, prazoMeses: prazo, receitaAnual,
    regime: empresa.regime, tipo: empresa.tipo, uf: empresa.uf, cnae: empresa.cnae, garantias, ...marcas,
    alongamento: Object.fromEntries(CRITERIOS_4131.map(([id]) => [id, alongamento[id] === 'sim'])),
    ...(necessidade === 'alongar-divida' && { notasFiname: notasAlongamento }),
  }) : null
  const porte = porteBndes(receitaAnual)
  const tem4131 = Boolean(necessidadePorId(necessidade)?.ordem.includes('4131'))
  const dias = (k) => (/^\d{1,4}$/.test(ciclo[k].trim()) ? Number(ciclo[k]) : NaN)
  const reais = (k) => { const r = parseMoneyInput(ciclo[k], { optional: true }); return r.ok && ciclo[k].trim() ? r.value : NaN }
  const cic = cicloDeCaixa({ pmr: dias('pmr'), pme: dias('pme'), pmp: dias('pmp'), vendas: fat?.ok ? fat.media : NaN, custo: reais('custo'), compras: reais('compras') })
  const marcar = (k) => (e) => setMarcas((m) => ({ ...m, [k]: e.target.checked }))
  const invalidarRepagamento = () => {
    if (alongamento.repagamento) {
      setAlongamento((anterior) => ({ ...anterior, repagamento: '' }))
    }
  }
  const alterarValor = (novo) => {
    if (novo !== valorTexto) invalidarRepagamento()
    setValorTexto(novo)
  }
  const alterarPrazo = (novo) => {
    if (novo !== prazoTexto) invalidarRepagamento()
    setPrazoTexto(novo)
  }
  const alterar = (k) => (e) => setEmpresa((d) => ({ ...d, [k]: e.target.value }))
  const nec = folha?.necessidade

  async function consultar() {
    setConsulta({ estado: 'consultando' })
    const r = await consultarCnpj(cnpj)
    if (!r.ok) { setConsulta({ estado: 'erro', erro: r.erro }); return }
    setEmpresa((d) => ({ ...d, ...Object.fromEntries(Object.entries(r.dados).filter(([, v]) => v !== '' && v != null)) }))
    setConsulta({ estado: 'ok', dados: r.dados })
  }

  if (visaoCliente && folha) {
    return (
      <section className="cx bw calc-standard calc-workspace ac ac-cliente" aria-labelledby="ac-cli-h">
        <button type="button" className="cx-back" onClick={() => setVisaoCliente(false)}><span aria-hidden="true">‹</span> Voltar à preparação</button>
        <div className="bw-heading calc-workspace-heading"><h2 id="ac-cli-h" className="cx-title"><span>Possibilidades de crédito</span></h2></div>
        <article className="desk-panel cx-panel calc-result-shell">
          <ExpandablePanel title={nec.nome}>
            <p className="ac-pedido">
              {empresa.razaoSocial && <><b>{empresa.razaoSocial}</b> · </>}
              {nec.nome}{valor.ok && valor.value > 0 && <> · {brl(valor.value)}</>}{prazo > 0 && <> · {prazo} meses</>}
              {finalidade.trim() && <> · {finalidade.trim()}</>}
            </p>
            {folha.frente.length ? <ol className="ac-cards">{folha.frente.map((op, i) => <Cartao key={op.id} op={op} posicao={i + 1} cliente />)}</ol> : <p className="cx-hint">Nenhuma possibilidade com os dados informados.</p>}
            <OpcoesComplementares opcoes={folha.complementares} onView={onView} cliente />
            {folha.observacoes.length > 0 && <ul className="ac-avisos">{folha.observacoes.map((o) => <li key={o}>{o}</li>)}</ul>}
            <p className="cx-hint">Possibilidades para análise. Não é oferta, aprovação nem cotação: prazos, taxas e enquadramento dependem da análise de crédito.</p>
          </ExpandablePanel>
        </article>
      </section>
    )
  }

  return (
    <section className="cx bw calc-standard calc-workspace ac" aria-labelledby="ac-h">
      <div className="bw-heading calc-workspace-heading">
        <div className="calc-title-row"><CalcBack onBack={onBack} /><h2 id="ac-h" className="cx-title"><span>Árvore de Crédito</span></h2></div>
        <Help title="Árvore de Crédito: como usar">
          <p>Informe quem é o cliente, o que ele precisa e, se tiver, a tabela de faturamento e endividamento. A tela mostra até {MAX_FOLHA} possibilidades, na ordem combinada para cada necessidade: primeiro as mais baratas em que a empresa se enquadra, por último as linhas livres em reais.</p>
          <p>Cada possibilidade traz o que cobre, o que fica de fora, os impostos e a regra com fonte e data. As operações em que a empresa não se enquadra saem da folha, com o motivo.</p>
          <p>Nada é salvo e nada sai desta tela.</p>
        </Help>
      </div>
      <p className="cx-construcao" role="note"><strong>Em construção!</strong> Sugestões para estudo, não oferta nem parecer de crédito. Regras conferidas em {CONSULTA}.</p>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>1. Quem é o cliente</span></h3></header>
        {CONSULTA_CNPJ_ATIVA ? <>
        <div className="cx-form cx-pad">
          <Campo id="ac-cnpj" label="CNPJ">
            <input id="ac-cnpj" inputMode="numeric" autoComplete="off" value={cnpj} onChange={(e) => { setCnpj(e.target.value); setConsulta({ estado: 'parado' }) }} onBlur={() => cnpjValido(cnpj) && setCnpj(formatarCnpj(cnpj))} aria-invalid={soDigitos(cnpj).length === 14 && !cnpjValido(cnpj)} aria-describedby="ac-cnpj-nota" />
          </Campo>
          <div className="cx-field ac-acao">
            <button type="button" onClick={consultar} disabled={!cnpjValido(cnpj) || consulta.estado === 'consultando'}>{consulta.estado === 'consultando' ? 'Consultando…' : 'Consultar dados públicos'}</button>
          </div>
        </div>
        <p id="ac-cnpj-nota" className="cx-hint cx-pad">Ao consultar, o CNPJ é enviado à {CNPJ_SERVICO.nome}, serviço público e gratuito fora do banco, que devolve os dados da Receita Federal. Nada fica guardado. Sem consulta, preencha os campos abaixo.</p>
        {consulta.estado === 'erro' && <p className="cx-hint cx-pad ac-erro" role="alert">{consulta.erro}</p>}
        {consulta.estado === 'ok' && (
          <p className="cx-hint cx-pad" role="status">
            {consulta.dados.razaoSocial}{consulta.dados.situacao && <> · situação: {consulta.dados.situacao}</>}{consulta.dados.inicioAtividade && <> · início em {consulta.dados.inicioAtividade.split('-').reverse().join('/')}</>}
            {consulta.dados.cnaeDescricao && <> · {consulta.dados.cnaeDescricao}</>}
            {consulta.dados.regime && consulta.dados.anoRegime && <> · regime informado para {consulta.dados.anoRegime}</>}
          </p>
        )}
        </> : (
          <>
            <div className="cx-form cx-pad">
              <Campo id="ac-nome" label="Cliente (opcional)"><input id="ac-nome" autoComplete="off" value={empresa.razaoSocial} onChange={alterar('razaoSocial')} maxLength={120} /></Campo>
            </div>
            <div className="cx-pad ac-linha">
              <a className="ac-receita" href={RECEITA_CNPJ.url} target="_blank" rel="noreferrer">Consultar CNPJ no site da {RECEITA_CNPJ.nome} ↗</a>
            </div>
            <p className="cx-hint cx-pad">No site da Receita, digite o CNPJ e copie para cá CNAE, município e UF, e use a natureza jurídica para escolher o tipo societário. O CNPJ vai só para a Receita. A consulta automática pelo CNPJ está desligada até a confirmação da política do banco sobre consulta em serviço externo: nenhum dado sai desta tela.</p>
          </>
        )}
        <div className="cx-form cx-pad">
          <Campo id="ac-uf" label="UF"><input id="ac-uf" maxLength={2} value={empresa.uf} onChange={(e) => setEmpresa((d) => ({ ...d, uf: e.target.value.toUpperCase() }))} /></Campo>
          <Campo id="ac-mun" label="Município"><input id="ac-mun" value={empresa.municipio} onChange={alterar('municipio')} /></Campo>
          <Campo id="ac-cnae" label="CNAE principal" ajuda="Código da atividade principal. Habilita linhas como a CPR."><input id="ac-cnae" inputMode="numeric" value={empresa.cnae} onChange={alterar('cnae')} /></Campo>
          <Campo id="ac-tipo" label="Tipo societário"><select id="ac-tipo" value={empresa.tipo} onChange={alterar('tipo')}>{TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
          <Campo id="ac-regime" label="Regime tributário" ajuda="A base pública costuma informar só se a empresa é do Simples. Lucro Real ou Presumido: confirme com o cliente. O regime muda o custo do 4131 e do FINIMP com proteção cambial."><select id="ac-regime" value={empresa.regime} onChange={alterar('regime')}>{REGIMES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></Campo>
          <Campo id="ac-receita" label="Faturamento anual" ajuda="Define o porte para as linhas do BNDES. Se ficar vazio, a tela usa os últimos 12 meses da tabela de faturamento."><MoneyInput id="ac-receita" value={receitaTexto} onChange={setReceitaTexto} /></Campo>
        </div>
        {porte && <p className="cx-hint cx-pad">Porte no BNDES: <b>{PORTE_ROTULO[porte]}</b>{!(receita.ok && receita.value > 0) && ' (pelos últimos meses da tabela)'}.</p>}
      </article>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>2. O que ele precisa</span></h3></header>
        <div className="cx-form cx-pad">
          <Campo id="ac-nec" label="Necessidade">
            <select id="ac-nec" value={necessidade} onChange={(e) => { setNecessidade(e.target.value); setAlongamento({}); setNotasAlongamento(false) }}>
              <option value="">Escolha</option>
              <optgroup label="Folhas confirmadas">{NECESSIDADES.filter((n) => n.confirmada).map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</optgroup>
              <optgroup label="Propostas, a revisar">{NECESSIDADES.filter((n) => !n.confirmada).map((n) => <option key={n.id} value={n.id}>{n.nome}</option>)}</optgroup>
            </select>
          </Campo>
          <Campo id="ac-fin" label="Para quê (opcional)"><input id="ac-fin" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} maxLength={120} /></Campo>
          <Campo id="ac-valor" label="Valor pedido"><MoneyInput id="ac-valor" value={valorTexto} onChange={alterarValor} /></Campo>
          <Campo id="ac-prazo" label="Prazo pedido (meses)"><input id="ac-prazo" inputMode="numeric" value={prazoTexto} onChange={(e) => alterarPrazo(e.target.value)} /></Campo>
        </div>
        <fieldset className="ac-checks cx-pad">
          <legend>Situação da empresa</legend>
          <label><input type="checkbox" checked={marcas.exporta} onChange={marcar('exporta')} /> Exporta</label>
          <label><input type="checkbox" checked={marcas.importa} onChange={marcar('importa')} /> Importa</label>
          {necessidade !== 'alongar-divida' && <label><input type="checkbox" checked={marcas.notasFiname} onChange={marcar('notasFiname')} /> Tem notas de compra elegíveis ao Finame Materiais (últimos 12 meses)</label>}
          <label><input type="checkbox" checked={marcas.notasCpr} onChange={marcar('notasCpr')} /> Notas fiscais validadas para a CPR</label>
          {necessidade === 'maquina-nacional' && <label><input type="checkbox" checked={marcas.maquinaCredenciada} onChange={marcar('maquinaCredenciada')} /> Máquina credenciada no Finame</label>}
        </fieldset>
        {tem4131 && <fieldset className="ac-checks cx-pad">
          <legend>Triagem da 4131</legend>
          <p className="cx-hint">Para considerar a 4131, confirme os três pontos. Campo sem confirmação não libera a opção. Mudou valor ou prazo? Confirme novamente a capacidade de pagamento.</p>
          {CRITERIOS_4131.map(([id, pergunta]) => <Campo key={id} id={`ac-alongar-${id}`} label={pergunta}>
            <select id={`ac-alongar-${id}`} value={alongamento[id] ?? ''} onChange={(e) => setAlongamento((anterior) => ({ ...anterior, [id]: e.target.value }))}>
              <option value="">Não comprovado</option><option value="sim">Sim</option><option value="nao">Não</option>
            </select>
          </Campo>)}
          {necessidade === 'alongar-divida' && <>
            <label><input type="checkbox" checked={notasAlongamento} onChange={(e) => setNotasAlongamento(e.target.checked)} /> Há despesa elegível separada, com notas de compra dos últimos 12 meses, para avaliar reembolso pelo Finame Materiais</label>
            <p className="cx-hint">Finame Materiais pode aliviar o caixa. Não é quitação direta da dívida.</p>
          </>}
        </fieldset>}
        <fieldset className="ac-checks cx-pad">
          <legend>Garantias disponíveis</legend>
          {GARANTIAS.map(([id, r]) => <label key={id}><input type="checkbox" checked={garantias.includes(id)} onChange={(e) => setGarantias((g) => e.target.checked ? [...g, id] : g.filter((x) => x !== id))} /> {r}</label>)}
        </fieldset>
      </article>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>3. Faturamento e endividamento (opcional)</span></h3></header>
        <div className="cx-pad ac-fat">
          <label htmlFor="ac-fat">Cole a tabela: competência (mês), faturamento e endividamento, como na calculadora Faturamento</label>
          <textarea id="ac-fat" rows={6} spellCheck={false} value={fatTexto} onChange={(e) => setFatTexto(e.target.value)} placeholder={'Competência\tFaturamento (R$ mil)\tEndividamento (R$ mil)\nJan/26\t1.800\t5.400'} />
          <div className="ac-linha">
            <button type="button" onClick={() => setFatTexto(EXEMPLO_FAT)}>Usar exemplo fictício</button>
            {fatTexto && <button type="button" onClick={() => setFatTexto('')}>Limpar</button>}
            <label>Unidade da tabela <select value={unidade} onChange={(e) => setUnidade(e.target.value)}><option value="">Do cabeçalho</option>{Object.keys(UNIDADES).map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
          </div>
          <Campo id="ac-curta" label="Dívida que vence em 12 meses (opcional)" ajuda="A tabela traz o saldo da dívida, não os vencimentos. Informe quanto vence em 12 meses para ver a concentração no curto prazo."><MoneyInput id="ac-curta" value={curtaTexto} onChange={setCurtaTexto} /></Campo>
          {fat && !fat.ok && <p className="cx-hint" role="alert">{fat.precisaUnidade ? 'Escolha a unidade da tabela (o cabeçalho não diz se é R$, R$ mil ou R$ milhões).' : 'Nenhum mês com faturamento lido.'}</p>}
          <fieldset className="ac-checks ac-ciclo">
            <legend>Ciclo de caixa (opcional)</legend>
            <div className="cx-form">
              {[['pmr', 'Prazo médio de recebimento (dias)'], ['pme', 'Prazo médio de estoque (dias)'], ['pmp', 'Prazo médio de pagamento a fornecedor (dias)']].map(([k, r]) => (
                <Campo key={k} id={`ac-${k}`} label={r}><input id={`ac-${k}`} inputMode="numeric" value={ciclo[k]} onChange={(e) => setCiclo((c) => ({ ...c, [k]: e.target.value }))} /></Campo>
              ))}
              <Campo id="ac-custo" label="Custo das vendas por mês" ajuda="Com custo e compras, a tela estima a necessidade permanente de capital de giro pela mesma conta da calculadora Conta Garantida. O faturamento mensal vem da média da tabela acima."><MoneyInput id="ac-custo" value={ciclo.custo} onChange={(v) => setCiclo((c) => ({ ...c, custo: v }))} /></Campo>
              <Campo id="ac-compras" label="Compras por mês"><MoneyInput id="ac-compras" value={ciclo.compras} onChange={(v) => setCiclo((c) => ({ ...c, compras: v }))} /></Campo>
            </div>
          </fieldset>
        </div>
      </article>

      {cic && (
        <article className="desk-panel cx-panel calc-result-shell" aria-live="polite">
          <ExpandablePanel title="Ciclo de caixa">
            <ul className="ac-numeros">
              <li>Ciclo de caixa: <b>{cic.dias} dias</b> (estoque + recebimento − pagamento a fornecedor).</li>
              {cic.ncg != null && <li>Necessidade permanente de capital de giro estimada: <b>{brl(cic.ncg)}</b>.</li>}
              {cic.erro && <li>{cic.erro}</li>}
            </ul>
            <p className="cx-hint">{cic.ncg != null ? 'A parte permanente pede linha longa; o que passa dela, comparado com a dívida atual e o pedido, tende a ser pico, para linha curta.' : 'Com a tabela de faturamento, o custo das vendas e as compras por mês, a tela estima a necessidade permanente de capital de giro.'} Mesma conta da calculadora Conta Garantida (saldos médios pelos prazos), sem projeção.</p>
          </ExpandablePanel>
        </article>
      )}

      {fat?.ok && (
        <article className="desk-panel cx-panel calc-result-shell" aria-live="polite">
          <ExpandablePanel title="Pedido contra o faturamento">
            <ul className="ac-numeros">
              <li>Faturamento de {fat.periodo} ({fat.mesesConsiderados} meses): <b>{brl(fat.total12)}</b> · média mensal <b>{brl(fat.media)}</b></li>
              {fat.divida != null && <li>Dívida em {fat.dividaRotulo}: <b>{brl(fat.divida)}</b>, ou <b>{um(fat.dividaEmMeses)}</b> meses de faturamento médio</li>}
              {fat.pedidoEmMeses != null && <li>Pedido: <b>{um(fat.pedidoEmMeses)}</b> meses de faturamento médio; dívida com o pedido: <b>{um(fat.dividaComPedidoEmMeses)}</b> meses</li>}
              {fat.curtoPrazoPct != null && <li>Vence em 12 meses: <b>{pct(fat.curtoPrazoPct)}</b> da dívida</li>}
              <li>{fat.sazonal ? <>Sazonal: meses fracos <b>{fat.fracos.join(', ')}</b>; meses fortes <b>{fat.fortes.join(', ')}</b>. Nas operações com parcela ajustável, prefira só juros nos fracos e parcela maior nos fortes.</> : fat.fracos.length ? <>Meses fracos: <b>{fat.fracos.join(', ')}</b>.</> : 'Sem meses muito abaixo ou acima da média.'}</li>
            </ul>
            <div className="ac-barras" aria-hidden="true">{fat.meses.map((m) => <span key={m.rotulo} className={m.indice < 0.8 ? 'fraco' : m.indice > 1.2 ? 'forte' : ''} style={{ height: `${Math.max(6, Math.min(100, (m.indice ?? 0) * 50))}%` }} title={m.rotulo} />)}</div>
            <p className="cx-hint">Mês fraco: abaixo de 80% da média dos últimos 12 meses; forte: acima de 120%. Somas e médias dos números colados, sem projeção. O ponto de alerta do peso da dívida ainda será definido.</p>
          </ExpandablePanel>
        </article>
      )}

      {folha && (
        <article className="desk-panel cx-panel calc-result-shell" aria-live="polite">
          <ExpandablePanel title={`Possibilidades · ${nec.nome}`}>
            {!nec.confirmada && <p className="ac-proposta" role="note">Ordem proposta, ainda não revisada por Fernando.</p>}
            <p className="cx-hint">
              {empresa.regime ? ROTULO_REGIME[empresa.regime] : 'Regime não informado'} · {empresa.tipo ? ROTULO_TIPO[empresa.tipo] : 'tipo societário não informado'}
              {empresa.uf && <> · {empresa.uf}</>}{porte && <> · porte {PORTE_ROTULO[porte].toLowerCase()}</>}
            </p>
            {folha.frente.length ? <ol className="ac-cards">{folha.frente.map((op, i) => <Cartao key={op.id} op={op} posicao={i + 1} onView={onView} />)}</ol> : <p className="cx-hint">Nenhuma possibilidade com os dados informados. Veja abaixo por que cada uma saiu.</p>}
            <OpcoesComplementares opcoes={folha.complementares} onView={onView} />
            {folha.observacoes.length > 0 && <ul className="ac-avisos">{folha.observacoes.map((o) => <li key={o}>{o}</li>)}</ul>}
            {folha.outras.length > 0 && (
              <details className="ac-mais">
                <summary>Outras opções ({folha.outras.length}), só para você</summary>
                <ol className="ac-cards">{folha.outras.map((op, i) => <Cartao key={op.id} op={op} posicao={MAX_FOLHA + i + 1} onView={onView} />)}</ol>
              </details>
            )}
            {folha.sairam.length > 0 && (
              <details className="ac-mais">
                <summary>Saíram da folha ({folha.sairam.length})</summary>
                <ul className="ac-sairam">{folha.sairam.map((op) => <li key={op.id}><b>{OPERACOES[op.id].nome}:</b> {op.motivo}</li>)}</ul>
              </details>
            )}
            <div className="ac-linha"><button type="button" onClick={() => setVisaoCliente(true)} disabled={!folha.frente.length}>Visão para o cliente</button></div>
          </ExpandablePanel>
        </article>
      )}
      <p className="status">Até {MAX_FOLHA} possibilidades · regras de {CONSULTA} · nada é salvo</p>
    </section>
  )
}
