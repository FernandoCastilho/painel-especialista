import { useState } from 'react'
import CalcBack from './CalcBack.jsx'
import InvestmentWorkspace from './InvestmentWorkspace.jsx'
import FundoCvmPicker, { useCotasCvm } from './FundoCvmPicker.jsx'
import { FONTE_CVM } from './fundosCvm.js'
import { numeroPt, cdb, fundo, acoes, cotasCvm } from './investimentos.js'
import './Investimentos.css'

const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = n => n.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const data = d => d?.split('-').reverse().join('/')

function Campo({ label, value = '', onChange, tipo = 'text', modo = 'decimal' }) {
  return <label>{label}<input type={tipo} value={value} inputMode={tipo === 'text' ? modo : undefined} onChange={e => onChange(e.target.value)} /></label>
}

function Saida({ resultado, titulo, nota }) {
  if (!resultado) return null
  if (!resultado.ok) return <p role="alert">{resultado.erro}</p>
  return <section className="inv-resultado" aria-label={titulo} aria-live="polite">
    <h3>{titulo}</h3><p>{nota}</p>
    <dl><div><dt>Valor final</dt><dd>{brl(resultado.final)}</dd></div>
      <div><dt>Ganho ou perda</dt><dd>{brl(resultado.ganho)}</dd></div>
      <div><dt>Retorno no período</dt><dd>{pct(resultado.retorno)}</dd></div></dl>
  </section>
}

function Cdb({ v, set }) {
  const r = v.principal && v.taxa && v.dataBase && v.vencimento ? cdb({
    principal: numeroPt(v.principal), taxaAnual: numeroPt(v.taxa),
    dataBase: v.dataBase, vencimento: v.vencimento,
  }) : null
  return <>
    <p>Informe a taxa anual bruta do CDB. Se o título for pós-fixado, use uma taxa anual estimada para simular um cenário, não o percentual do CDI.</p>
    <div className="inv-grade">
      <Campo label="Valor aplicado (R$)" value={v.principal} onChange={x => set('principal', x)} />
      <Campo label="Taxa anual bruta (% a.a.)" value={v.taxa} onChange={x => set('taxa', x)} />
      <Campo label="Data da aplicação (dia útil)" value={v.dataBase} onChange={x => set('dataBase', x)} tipo="date" />
      <Campo label="Vencimento (dia útil)" value={v.vencimento} onChange={x => set('vencimento', x)} tipo="date" />
    </div>
    <p className="inv-nota">Taxa constante informada por você. O cálculo capitaliza em 252 dias úteis por ano, sem consultar curvas ou taxas de mercado.</p>
    <Saida resultado={r} titulo="Projeção bruta de CDB" nota={r?.ok ? r.dias + ' dias úteis, antes de IR, IOF e taxas.' : ''} />
  </>
}

function Fundos({ v, set }) {
  const [arquivo, setArquivo] = useState(null)
  const [mensagem, setMensagem] = useState('')
  const [fundoId, setFundoId] = useState('')
  const [retry, setRetry] = useState(0)
  const cvm = useCotasCvm(fundoId ? [fundoId] : [], retry)
  const fundoCvm = cvm.dados[fundoId]
  const tipo = v.tipo ?? 'classe', cnpj = v.cnpj ?? '', sub = tipo === 'classe' ? (v.sub ?? '').trim() : ''
  const chave = JSON.stringify([tipo, cnpj, sub])
  const pontos = fundoId ? fundoCvm?.rows : arquivo?.chave === chave ? arquivo.pontos : null
  const fontes = pontos && new Map(pontos)
  const data1 = fontes?.has(v.data1) ? v.data1 : pontos?.[0][0]
  const data2 = fontes?.has(v.data2) ? v.data2 : pontos?.at(-1)[0]
  const preenchido = pontos ? data1 && data2 : !fundoId && v.cota1 && v.cota2
  const r = v.valor && preenchido ? pontos && data1 >= data2
    ? { ok: false, erro: 'A data final precisa ser posterior à inicial.' }
    : fundo(numeroPt(v.valor), fontes ? fontes.get(data1) : numeroPt(v.cota1), fontes ? fontes.get(data2) : numeroPt(v.cota2))
    : null
  async function importar(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setArquivo(null)
    if (files.length > 3 || files.reduce((n,x) => n+x.size, 0) > 96*1024*1024) {
      setMensagem('Selecione até três CSVs, com no máximo 96 MB no total.'); return
    }
    setMensagem('Lendo CSVs…')
    try {
      const lista = cotasCvm(await Promise.all(files.map(f => f.text())), { tipo, cnpj, sub })
      if (lista.length < 2) { setMensagem('Não encontrei duas cotas para esse identificador. Confira o CNPJ, a subclasse e os arquivos.'); return }
      setArquivo({ chave, pontos: lista })
      setFundoId('')
      set('data1', lista[0][0]); set('data2', lista.at(-1)[0])
      setMensagem(lista.length + ' cotas encontradas para a série selecionada.')
    } catch (erro) { setMensagem(erro.message) }
  }
  return <>
    <p>Veja como o valor teria variado com as cotas informadas. Sem aportes ou resgates intermediários, distribuições ou impostos do cotista.</p>
    <div className="inv-grade"><Campo label="Valor aplicado (R$)" value={v.valor} onChange={x => set('valor',x)} /></div>
    <FundoCvmPicker selecionado={fundoId} onSelect={id => {
      setFundoId(id)
      setArquivo(null)
      set('data1', '')
      set('data2', '')
    }} />
    {fundoId && <>
      {fundoCvm ? <p><strong>{fundoCvm.name}</strong> · cotas da CVM</p>
        : cvm.erros.includes(fundoId) ? <>
          <p role="status">Não foi possível carregar as cotas deste fundo.</p>
          <button type="button" onClick={() => setRetry(x => x + 1)}>Tentar carregar cotas novamente</button>
        </> : <p role="status">Carregando cotas da CVM…</p>}
      <button type="button" onClick={() => setFundoId('')}>Usar cotas manuais</button>
    </>}
    <details className="inv-import">
      <summary>Importar Informe Diário da CVM</summary>
      <p>Baixe o ZIP pelo <a href={FONTE_CVM} target="_blank" rel="noreferrer">portal da CVM</a> e extraia o CSV. Nada é enviado: a leitura ocorre neste navegador.</p>
      <div className="inv-grade">
        <label>Tipo de registro<select value={tipo} onChange={e => set('tipo', e.target.value)}><option value="classe">Classe (CVM 175)</option><option value="fundo">Fundo (cadastro anterior)</option></select></label>
        <Campo label="CNPJ do fundo ou classe" value={v.cnpj} onChange={x => set('cnpj',x)} modo="numeric" />
        {tipo === 'classe' && <Campo label="Subclasse (se houver)" value={v.sub} onChange={x => set('sub',x)} modo="text" />}
      </div>
      <label>Arquivos CSV da CVM<input type="file" accept=".csv,text/csv" multiple onChange={importar} /></label>
      <p role="status">{mensagem}</p>
      {pontos && !fundoId && <button type="button" onClick={() => { setArquivo(null); setMensagem('Cotas manuais selecionadas.') }}>Usar cotas manuais</button>}
    </details>
    <div className="inv-grade">{pontos
      ? [['data1','Data da cota inicial', data1], ['data2','Data da cota final', data2]].map(([id,l,valor]) =>
        <label key={id}>{l}<select aria-label={l} value={valor} onChange={e => set(id,e.target.value)}>{pontos.map(([d]) => <option key={d} value={d}>{data(d)}</option>)}</select></label>)
      : !fundoId && ['Cota inicial','Cota final'].map((l,i) =>
        <Campo key={l} label={l} value={v['cota'+(i+1)]} onChange={x => set('cota'+(i+1),x)} />)}
    </div>
    <Saida resultado={r} titulo="Variação da cota" nota={pontos ? 'CVM · ' + data(data1) + ' a ' + data(data2) + '.' : 'Cotas informadas pelo usuário.'} />
  </>
}

function Acoes({ v, set }) {
  const r = v.quantidade && v.compra && v.venda ? acoes({
    quantidade: numeroPt(v.quantidade), compra: numeroPt(v.compra), venda: numeroPt(v.venda),
    proventos: numeroPt(v.proventos, true), custos: numeroPt(v.custos,true),
  }) : null
  return <>
    <p>Informe preços e proventos para avaliar um período passado ou um cenário. A cotação não é automática.</p>
    <div className="inv-grade">{[
      ['quantidade','Quantidade de ações'], ['compra','Preço de compra por ação (R$)'], ['venda','Preço final por ação (R$)'],
      ['proventos','Proventos por ação no período (R$, opcional)'], ['custos','Custos iniciais totais (R$, opcional)'],
    ].map(([id,l]) => <Campo key={id} label={l} value={v[id]} onChange={x => set(id,x)} modo={id === 'quantidade' ? 'numeric' : 'decimal'} />)}</div>
    <Saida resultado={r} titulo="Simulação de ações" nota="Inclui proventos informados, sem reinvestimento, tributos ou custos de venda." />
  </>
}

export default function Investimentos({ onBack, comparisonLink }) {
  const [aba, setAba] = useState('comparar')
  const [modo,setModo] = useState('cdb')
  const [valores,setValores] = useState({cdb:{},fundos:{},acoes:{}})
  const props = id => ({v:valores[id],set:(k,x) => setValores(all => ({ ...all,[id]:{...all[id],[k]:x} }))})
  return <section className="cx bw calc-workspace inv-workspace" aria-labelledby="inv-titulo">
    <div className="bw-heading calc-workspace-heading"><div className="calc-title-row"><CalcBack onBack={onBack}/><h2 id="inv-titulo">Investimentos</h2></div></div>
    <div className="inv-corpo">
      <div className="inv-modos inv-tabs" role="group" aria-label="Investimentos">
        {[['comparar', 'Comparar ativos'], ['fundos', 'Consultar fundos'], ['simular', 'Simular carteira'], ['calculadoras', 'CDB, fundos e ações']].map(([id, label]) =>
          <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)}>{label}</button>)}
      </div>
      <InvestmentWorkspace link={comparisonLink} mode={aba} visible={aba !== 'calculadoras'}
        showComparison={() => setAba('comparar')} showPortfolio={() => setAba('simular')} />
      <div className="inv-manual" hidden={aba !== 'calculadoras'}>
        <div className="inv-modos" role="group" aria-label="Tipo de investimento">
          {[['cdb','CDB'],['fundos','Fundos'],['acoes','Ações']].map(([id,l]) => <button key={id} type="button" aria-pressed={modo===id} onClick={() => setModo(id)}>{l}</button>)}
        </div>
        <p className="inv-nota" id="inv-formato">Use vírgula para decimais: 1,234 para uma cota fracionária ou 1234 para mil duzentos e trinta e quatro. Não use ponto sozinho.</p>
        {modo==='cdb' && <Cdb {...props('cdb')}/>}
        <div hidden={modo!=='fundos'}><Fundos {...props('fundos')}/></div>
        {modo==='acoes' && <Acoes {...props('acoes')}/>}
        <p className="inv-nota">Para estudo. Rentabilidade passada e projeções não garantem resultados futuros. Não é recomendação de investimento.</p>
      </div>
    </div>
  </section>
}
