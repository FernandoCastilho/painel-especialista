import { useState } from 'react'
import CalcBack from './CalcBack.jsx'
import { useCurves } from './useCurves.js'
import { numeroPt, cdb, fundo, acoes, cotasCvm } from './investimentos.js'
import './Investimentos.css'

const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = n => n.toLocaleString('pt-BR', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const data = d => d?.split('-').reverse().join('/')
const fonte = 'https://dados.cvm.gov.br/dataset/fi-doc-inf_diario'

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
  const curva = useCurves()
  const br = curva.data?.br
  const base = br?.compare?.find(x => x.id === 'hoje')?.date
  const vertices = base ? br.curves?.[base] : null
  const percentual = v.percentual ?? '100'
  const r = v.principal && percentual && v.vencimento && vertices?.length ? cdb({
    principal: numeroPt(v.principal), percentual: numeroPt(percentual),
    dataBase: base, vencimento: v.vencimento, vertices,
  }) : null
  return <>
    <p>Simule um CDB pós-fixado. A curva DI × Pré é um cenário de mercado, não uma previsão do CDI realizado.</p>
    <div className="inv-grade">
      <Campo label="Valor aplicado (R$)" value={v.principal} onChange={x => set('principal', x)} />
      <Campo label="Percentual do CDI (%)" value={percentual} onChange={x => set('percentual', x)} />
      <Campo label="Vencimento (dia útil)" value={v.vencimento} onChange={x => set('vencimento', x)} tipo="date" />
    </div>
    <p className="inv-nota">{vertices?.length ? 'Data-base e início da projeção: ' + data(base) + '. ' + (curva.stale ? 'Última curva disponível; houve falha na atualização. ' : '') : curva.status === 'loading' ? 'Carregando a curva… ' : 'Curva indisponível; sem projeção. '}Dias úteis brasileiros, base 252. O simulador não altera o vencimento nem extrapola a curva.</p>
    <Saida resultado={r} titulo="Projeção bruta de CDB" nota={r?.ok ? r.dias + ' dias úteis, antes de IR, IOF e taxas.' : ''} />
  </>
}

function Fundos({ v, set }) {
  const [arquivo, setArquivo] = useState(null)
  const [mensagem, setMensagem] = useState('')
  const tipo = v.tipo ?? 'classe', cnpj = v.cnpj ?? '', sub = tipo === 'classe' ? (v.sub ?? '').trim() : ''
  const chave = JSON.stringify([tipo, cnpj, sub])
  const pontos = arquivo?.chave === chave ? arquivo.pontos : null
  const fontes = pontos && new Map(pontos)
  const preenchido = pontos ? v.data1 && v.data2 : v.cota1 && v.cota2
  const r = v.valor && preenchido ? pontos && v.data1 >= v.data2
    ? { ok: false, erro: 'A data final precisa ser posterior à inicial.' }
    : fundo(numeroPt(v.valor), fontes ? fontes.get(v.data1) : numeroPt(v.cota1), fontes ? fontes.get(v.data2) : numeroPt(v.cota2))
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
      set('data1', lista[0][0]); set('data2', lista.at(-1)[0])
      setMensagem(lista.length + ' cotas encontradas para a série selecionada.')
    } catch (erro) { setMensagem(erro.message) }
  }
  return <>
    <p>Veja como o valor teria variado com as cotas informadas. Sem aportes ou resgates intermediários, distribuições ou impostos do cotista.</p>
    <div className="inv-grade"><Campo label="Valor aplicado (R$)" value={v.valor} onChange={x => set('valor',x)} /></div>
    <details className="inv-import">
      <summary>Importar Informe Diário da CVM</summary>
      <p>Baixe o ZIP pelo <a href={fonte} target="_blank" rel="noreferrer">portal da CVM</a> e extraia o CSV. Nada é enviado: a leitura ocorre neste navegador.</p>
      <div className="inv-grade">
        <label>Tipo de registro<select value={tipo} onChange={e => set('tipo', e.target.value)}><option value="classe">Classe (CVM 175)</option><option value="fundo">Fundo (cadastro anterior)</option></select></label>
        <Campo label="CNPJ do fundo ou classe" value={v.cnpj} onChange={x => set('cnpj',x)} modo="numeric" />
        {tipo === 'classe' && <Campo label="Subclasse (se houver)" value={v.sub} onChange={x => set('sub',x)} modo="text" />}
      </div>
      <label>Arquivos CSV da CVM<input type="file" accept=".csv,text/csv" multiple onChange={importar} /></label>
      <p role="status">{mensagem}</p>
      {pontos && <button type="button" onClick={() => { setArquivo(null); setMensagem('Cotas manuais selecionadas.') }}>Usar cotas manuais</button>}
    </details>
    <div className="inv-grade">{pontos
      ? [['data1','Data da cota inicial'], ['data2','Data da cota final']].map(([id,l]) =>
        <label key={id}>{l}<select value={v[id]} onChange={e => set(id,e.target.value)}>{pontos.map(([d]) => <option key={d} value={d}>{data(d)}</option>)}</select></label>)
      : ['Cota inicial','Cota final'].map((l,i) =>
        <Campo key={l} label={l} value={v['cota'+(i+1)]} onChange={x => set('cota'+(i+1),x)} />)}
    </div>
    <Saida resultado={r} titulo="Variação da cota" nota={pontos ? 'CVM: de ' + data(v.data1) + ' a ' + data(v.data2) + '.' : 'Cotas informadas pelo usuário.'} />
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

export default function Investimentos({onBack}) {
  const [modo,setModo] = useState('cdb')
  const [valores,setValores] = useState({cdb:{},fundos:{},acoes:{}})
  const props = id => ({v:valores[id],set:(k,x) => setValores(all => ({ ...all,[id]:{...all[id],[k]:x} }))})
  return <section className="cx bw calc-workspace inv-workspace" aria-labelledby="inv-titulo">
    <div className="bw-heading calc-workspace-heading"><div className="calc-title-row"><CalcBack onBack={onBack}/><h2 id="inv-titulo">Investimentos</h2></div></div>
    <div className="inv-corpo">
      <div className="inv-modos" role="group" aria-label="Tipo de investimento">
        {[['cdb','CDB'],['fundos','Fundos'],['acoes','Ações']].map(([id,l]) => <button key={id} type="button" aria-pressed={modo===id} onClick={() => setModo(id)}>{l}</button>)}
      </div>
      <p className="inv-nota" id="inv-formato">Use vírgula para decimais: 1,234 para uma cota fracionária ou 1234 para mil duzentos e trinta e quatro. Não use ponto sozinho.</p>
      {modo==='cdb' && <Cdb {...props('cdb')}/>}
      <div hidden={modo!=='fundos'}><Fundos {...props('fundos')}/></div>
      {modo==='acoes' && <Acoes {...props('acoes')}/>}
      <p className="inv-nota">Para estudo. Rentabilidade passada e projeções não garantem resultados futuros. Não é recomendação de investimento.</p>
    </div>
  </section>
}
