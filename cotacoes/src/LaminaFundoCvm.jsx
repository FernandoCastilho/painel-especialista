import { useEffect, useState } from 'react'
import { carregarFichaCvm, cnpjDoId } from './fundosCvm.js'
import { alturas, competencia, dataBr, mesCurto, pct, prazo, reais, simNao } from './fichaFundo.js'

const cnpjFormatado = documento => documento.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
const diasCorridos = dias => dias === undefined ? undefined : dias === 0 ? 'Não tem' : dias + (dias === 1 ? ' dia' : ' dias')
const dMais = dias => dias === undefined ? undefined : 'D+' + dias
const taxa = valor => valor === undefined ? undefined : pct(valor) + ' a.a.'
const taxaSeExiste = (existe, valor) => existe === false ? 'Não tem' : existe ? (valor ? pct(valor) : 'Tem') : undefined
const ate = valor => valor === undefined ? undefined : 'até ' + pct(valor, 0)

function Linhas({ linhas }) {
  const visiveis = linhas.filter(([, valor]) => valor !== undefined && valor !== null && valor !== '—')
  return visiveis.length ? <dl className="inv-lamina-linhas">{visiveis.map(([rotulo, valor]) =>
    <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl> : null
}

function Indicadores({ itens }) {
  return <div className="inv-lamina-kpis">{itens.filter(([, valor]) => valor !== undefined && valor !== null && valor !== '—')
    .map(([rotulo, valor]) => <div key={rotulo}><span>{rotulo}</span><strong>{valor}</strong></div>)}</div>
}

function Risco({ nivel }) {
  return <span className="inv-lamina-risco" role="img" aria-label={`Risco ${nivel} de 5`}>
    {[1, 2, 3, 4, 5].map(n => <i key={n} className={n <= nivel ? 'ativo' : undefined}>{n}</i>)}
  </span>
}

function Lamina({ lamina }) {
  const indice = lamina.indice && lamina.indice.length <= 12 ? lamina.indice : 'Índice'
  const resgate = [lamina.cotaResgate !== undefined && 'D+' + lamina.cotaResgate + ' cota',
    lamina.pagamento !== undefined && 'D+' + lamina.pagamento + ' pagamento'].filter(Boolean).join(' · ')
  const meses = lamina.meses ?? []
  const barras = alturas(meses.map(([, fundo]) => fundo))
  const maiorCarteira = Math.max(...(lamina.carteira ?? []).map(([, valor]) => Math.abs(valor)), 0)
  return <>
    <Indicadores itens={[
      ['Patrimônio', lamina.pl !== undefined ? reais(lamina.pl) : undefined],
      ['Risco (1 a 5)', lamina.risco >= 1 && lamina.risco <= 5 ? <Risco nivel={lamina.risco} /> : undefined],
      ['Taxa de administração', lamina.taxaAdm !== undefined
        ? taxa(lamina.taxaAdm) + (lamina.taxaAdmMax > lamina.taxaAdm ? ' (máx. ' + pct(lamina.taxaAdmMax) + ')' : '') : undefined],
      ['Despesas totais (12 meses)', lamina.despesas !== undefined ? pct(lamina.despesas) : undefined],
      ['Resgate', resgate || undefined],
    ]} />
    <div className="inv-lamina-colunas">
      {(lamina.objetivo || lamina.publico || lamina.exterior !== undefined) && <div className="inv-lamina-bloco">
        {lamina.objetivo && <><h4>Objetivo</h4><p>{lamina.objetivo}</p></>}
        {lamina.publico && <><h4>Público-alvo</h4><p>{lamina.publico}</p></>}
        {lamina.restricao && <><h4>Restrições</h4><p>{lamina.restricao}</p></>}
        <h4>Limites da política</h4>
        <Linhas linhas={[['Ativos no exterior', ate(lamina.exterior)], ['Crédito privado', ate(lamina.credito)],
          ['Alavancagem', ate(lamina.alavancagem)], ['Pode perder mais que o aplicado', simNao(lamina.perdaAlemDoAplicado)]]} />
      </div>}
      <div className="inv-lamina-bloco">
        <h4>Condições</h4>
        <Linhas linhas={[
          ['Aplicação inicial', lamina.aplicInicial !== undefined ? reais(lamina.aplicInicial, { minimo: true }) : undefined],
          ['Aplicação adicional', lamina.aplicAdicional !== undefined ? reais(lamina.aplicAdicional, { minimo: true }) : undefined],
          ['Resgate mínimo', lamina.resgateMin !== undefined ? reais(lamina.resgateMin, { minimo: true }) : undefined],
          ['Horário limite', lamina.horario],
          ['Carência', diasCorridos(lamina.carencia)],
          ['Cota da aplicação', dMais(lamina.cotaAplicacao)],
          ['Cota do resgate', dMais(lamina.cotaResgate)],
          ['Pagamento do resgate', lamina.pagamento !== undefined ? prazo(lamina.pagamento, lamina.tipoPagamento) : undefined],
          ['Taxa de entrada', lamina.taxaEntrada !== undefined ? pct(lamina.taxaEntrada) : undefined],
          ['Taxa de saída', lamina.taxaSaida !== undefined ? pct(lamina.taxaSaida) : undefined],
          ['Taxa de performance', lamina.taxaPerf ?? (lamina.data ? 'Não tem' : undefined)],
        ]} />
        {lamina.taxaAdmObs && <p className="inv-nota">{lamina.taxaAdmObs}</p>}
      </div>
      {lamina.anos?.length > 0 && <div className="inv-lamina-bloco">
        <h4>Rentabilidade por ano</h4>
        <div className="inv-table"><table aria-label="Rentabilidade por ano informada na lâmina">
          <thead><tr><th scope="col">Ano</th><th scope="col">Fundo</th><th scope="col">{indice}</th><th scope="col">% do {indice}</th></tr></thead>
          <tbody>{[...lamina.anos].reverse().map(([ano, fundo, referencia, relativo]) => <tr key={ano}>
            <th scope="row">{ano}</th><td>{pct(fundo)}</td><td>{pct(referencia)}</td><td>{pct(relativo, 1)}</td>
          </tr>)}</tbody>
        </table></div>
        {(lamina.rentab5 !== undefined || lamina.anosPerda !== undefined) && <p className="inv-nota">
          {lamina.rentab5 !== undefined && <>Em 5 anos: fundo {pct(lamina.rentab5)}{lamina.indice5 !== undefined && <> · {indice} {pct(lamina.indice5)}</>}. </>}
          {lamina.anosPerda !== undefined && <>Anos com perda: {lamina.anosPerda}.</>}
        </p>}
      </div>}
    </div>
    {meses.length > 0 && <div className="inv-lamina-bloco">
      <h4>Últimos {meses.length} {meses.length === 1 ? 'mês' : 'meses'}</h4>
      <div className="inv-lamina-meses" role="list">{meses.map(([mes, fundo], i) =>
        <div key={mes} role="listitem" aria-label={`${competencia(mes + '-01')}: ${pct(fundo, 1)}`}>
          <i className={fundo < 0 ? 'neg' : undefined} style={{ height: barras[i] + '%' }} />
          <span>{pct(fundo, 1)}</span><small>{mesCurto(mes)}</small>
        </div>)}</div>
    </div>}
    {lamina.carteira?.length > 0 && <div className="inv-lamina-bloco">
      <h4>Composição da carteira</h4>
      <ul className="inv-lamina-carteira">{lamina.carteira.map(([tipo, valor]) => <li key={tipo}>
        <span>{tipo}</span>
        <i><b className={valor < 0 ? 'neg' : undefined} style={{ width: (maiorCarteira ? Math.max(1, Math.abs(valor) / maiorCarteira * 100) : 0) + '%' }} /></i>
        <strong>{pct(valor)}</strong>
      </li>)}</ul>
    </div>}
    <p className="inv-nota">Dados abertos da CVM (lâmina mensal). Rentabilidade passada não garante resultado futuro. Leia a lâmina completa antes de investir.</p>
  </>
}

function Ficha({ cadastro = {}, extrato = {} }) {
  const performance = extrato.performance === undefined ? undefined
    : extrato.performance ? (extrato.taxaPerf ? pct(extrato.taxaPerf) : 'Tem') : 'Não tem'
  return <>
    <p className="inv-lamina-aviso">A CVM não traz a lâmina deste fundo em dados abertos. Esta ficha mostra o que consta no cadastro{extrato.data ? ' e no extrato anual' : ''}.</p>
    <Indicadores itens={[
      ['Patrimônio', cadastro.pl !== undefined ? reais(cadastro.pl) : undefined],
      ['Classificação ANBIMA', cadastro.anbima],
      ['Público', cadastro.publico],
      ['Taxa de administração', taxa(extrato.taxaAdm)],
      ['Indicador de desempenho', cadastro.indicador],
    ]} />
    <div className="inv-lamina-colunas">
      {extrato.data && <div className="inv-lamina-bloco">
        <h4>Condições</h4>
        <Linhas linhas={[
          ['Aplicação mínima', extrato.aplicMin !== undefined ? reais(extrato.aplicMin, { minimo: true }) : undefined],
          ['Conversão da cota', dMais(extrato.conversao)],
          ['Pagamento do resgate', extrato.pagamento !== undefined ? prazo(extrato.pagamento, extrato.tipoPagamento) : undefined],
          ['Taxa de performance', performance],
          ['Taxa de entrada', taxaSeExiste(extrato.entrada)],
          ['Taxa de saída', taxaSeExiste(extrato.saida)],
        ]} />
      </div>}
      <div className="inv-lamina-bloco">
        <h4>Cadastro</h4>
        <Linhas linhas={[
          ['Tipo', cadastro.tipo],
          ['Início', cadastro.inicio ? dataBr(cadastro.inicio) : undefined],
          ['Situação', cadastro.situacao],
          ['Tributação de longo prazo', simNao(cadastro.longoPrazo)],
          ['Exclusivo', simNao(cadastro.exclusivo)],
          ['Condomínio', cadastro.condominio],
          ['Investe no exterior', simNao(extrato.exterior)],
          ['Crédito privado', simNao(extrato.credito)],
        ]} />
      </div>
    </div>
    {extrato.politica && <div className="inv-lamina-bloco">
      <h4>Política de investimento</h4>
      <p>{extrato.politica}</p>
    </div>}
    <p className="inv-nota">Dados abertos da CVM (cadastro e extrato anual). A rentabilidade do fundo aparece acima, pela cota diária da CVM.</p>
  </>
}

export default function LaminaFundoCvm({ id, nome, fechar }) {
  const documento = cnpjDoId(id)
  const [estado, setEstado] = useState({ documento: null })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let ativo = true
    carregarFichaCvm(documento).then(
      resultado => { if (ativo) setEstado({ documento, ...resultado }) },
      () => { if (ativo) setEstado({ documento, erro: true }) })
    return () => { ativo = false }
  }, [documento, tentativa])
  const atual = estado.documento === documento ? estado : null
  const ficha = atual?.ficha
  const lamina = ficha?.lamina
  const codigo = ficha?.cadastro?.codigo
  const titulo = (nome ?? '').split(' · ')[0] || 'Fundo CVM'
  const subtitulo = lamina
    ? ['CVM', 'lâmina de ' + competencia(lamina.data), 'CNPJ ' + cnpjFormatado(documento)]
    : ['CVM', ficha?.extrato?.data ? 'cadastro e extrato de ' + competencia(ficha.extrato.data) : 'cadastro',
      codigo ? 'Código CVM ' + codigo : 'CNPJ ' + cnpjFormatado(documento)]
  return <section className="inv-panel inv-lamina" aria-labelledby="inv-lamina-titulo">
    <header className="inv-lamina-cabecalho">
      <div>
        <span className="inv-lamina-tipo">{lamina ? 'Lâmina do fundo' : 'Ficha do fundo'}</span>
        <h3 id="inv-lamina-titulo">{titulo}</h3>
        {ficha && <p className="inv-nota">{subtitulo.join(' · ')}</p>}
      </div>
      <button type="button" aria-label="Fechar lâmina" onClick={fechar}>×</button>
    </header>
    {!atual ? <p role="status">Carregando a lâmina…</p>
      : atual.erro ? <p role="status">Lâmina indisponível agora. <button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button></p>
        : !ficha ? <p role="status">A CVM não traz lâmina nem cadastro deste fundo em dados abertos.</p>
          : lamina ? <Lamina lamina={lamina} /> : <Ficha cadastro={ficha.cadastro} extrato={ficha.extrato} />}
  </section>
}
