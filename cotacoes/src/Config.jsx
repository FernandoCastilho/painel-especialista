import InstallApp from './InstallApp.jsx'
import BaseDados from './BaseDados.jsx'
import Novidades from './Novidades.jsx'
import { Panel } from './TerminalDesk.jsx'
import { centralMaxAge } from './useQuotes.js'
import { useMacro } from './useMacro.js'
import { useCurves } from './useCurves.js'
import { useNews } from './useNews.js'
import { useDataFile } from './useDataFile.js'
import { dataTimestamp } from './dataTimestamp.js'
import { SHORTCUTS, dataStatus } from './terminal.js'
import { ATRASO_H, FONTES, NAVEGADOR, REGRAS, RESUMO } from './governanca.js'
import { AcessosPanel } from './Acessos.jsx'

const H = 3600e3
const TONE = { ok: 'up', old: 'down', retained: 'down', partial: 'down', reserve: 'flat', missing: 'flat', loading: 'flat', offhours: 'flat' }

// Configurações: atalhos, estado de cada fonte de dados, aparência, instalação e histórico de mudanças.
export default function Config({ quotesAt, quotesVia, quotes, quotesHealth, fx, setFx }) {
  const macro = useMacro()
  const curves = useCurves()
  const news = useNews()
  const reforma = useDataFile('reforma-tributaria.json')
  const temas = useDataFile('temas.json')
  const trends = useDataFile('trends.json')
  const heavy = useDataFile('heavy-vehicles.json')
  const insumosPrecos = useDataFile('insumos-precos.json')
  const indices = useDataFile('indices.json')
  const policy = useDataFile('policy-rates.json')
  const oil = useDataFile('oil.json')
  const indexadores = useDataFile('indexadores.json')
  const commodities = useDataFile('commodities.json')
  const commoditiesBrl = useDataFile('commodities-brl.json')
  const fuels = useDataFile('fuels.json')
  const freight = useDataFile('freight.json')
  const bndes = useDataFile('bndes.json')
  const moedas = useDataFile('moedas.json')
  const ipca = useDataFile('ipca.json')
  const estr = useDataFile('estr.json')
  const euroCurve = useDataFile('euro-curve.json')
  const divida = useDataFile('divida.json')
  const calendar = useDataFile('calendar.json')
  const ipcaGroups = useDataFile('ipca-groups.json')
  const freightJp = useDataFile('freight-jp.json')
  const resources = { trends, 'heavy-vehicles':heavy, macro, curves, news, 'reforma-tributaria': reforma, temas, 'insumos-precos': insumosPrecos, indices, policy, oil, indexadores, commodities, 'commodities-brl': commoditiesBrl, fuels, freight, bndes, moedas, ipca, estr, 'euro-curve': euroCurve, divida, calendar, 'ipca-groups': ipcaGroups, 'freight-jp': freightJp }
  const rows = dataStatus(
    [
      { key: 'quotes', label: `Câmbio${quotesVia ? ` · ${quotesVia === 'central' ? 'coleta central' : quotesVia === 'direto' ? 'consulta direta' : 'fonte reserva'}` : ''}`, at: quotesAt ? new Date(quotesAt).getTime() : null, maxAge: centralMaxAge(), weekdays: false },
      { key: 'macro', label: 'Juros e Focus (Banco Central, NY Fed)', at: macro.data?.generatedAt, maxAge: ATRASO_H.macro * H, weekdays: true },
      { key: 'curves', label: 'Curvas DI x pré, cupom e Treasuries', at: curves.data?.generatedAt, maxAge: ATRASO_H.curves * H, weekdays: true },
      { key: 'trends', label: 'Google Trends: Em alta no Brasil', at: trends.data?.generatedAt, maxAge: ATRASO_H.trends * H, weekdays: false },
      { key: 'news', label: 'Notícias', at: news.data?.generatedAt, maxAge: ATRASO_H.news * H, weekdays: true },
      { key: 'reforma-tributaria', label: 'Reforma tributária (matérias dos últimos cinco dias)', at: reforma.data?.generatedAt, maxAge: ATRASO_H['reforma-tributaria'] * H, weekdays: true },
      { key:'heavy-vehicles',label:'Veículos pesados (ANFAVEA, publicação mensal)',at:heavy.data?.generatedAt,maxAge:ATRASO_H['heavy-vehicles'] * H,weekdays:true },
      { key: 'temas', label: 'Setores e insumos (matérias dos últimos cinco dias)', at: temas.data?.generatedAt, maxAge: ATRASO_H.temas * H, weekdays: true },
      { key: 'insumos-precos', label: 'Cobre: preço diário aproximado (COMEX)', at: insumosPrecos.data?.generatedAt, maxAge: ATRASO_H['insumos-precos'] * H, weekdays: true },
      { key: 'indices', label: 'Ibovespa (fechamento diário)', at: indices.data?.generatedAt, maxAge: ATRASO_H.indices * H, weekdays: true },
      { key: 'policy', label: 'Juros de política monetária (Fed, BCE, BoJ)', at: policy.data?.generatedAt, maxAge: ATRASO_H.policy * H, weekdays: true },
      { key: 'euro-curve', label: 'Curva de juros do euro (Banco Central Europeu)', at: euroCurve.data?.generatedAt, maxAge: ATRASO_H['euro-curve'] * H, weekdays: true },
      { key: 'estr', label: 'Taxa €STR (Banco Central Europeu)', at: estr.data?.generatedAt, maxAge: ATRASO_H.estr * H, weekdays: true },
      { key: 'indexadores', label: 'Indexadores TR, TBF e TLP (Banco Central e BNDES)', at: indexadores.data?.generatedAt, maxAge: ATRASO_H.indexadores * H, weekdays: true },
      { key: 'bndes', label: 'Taxa Fixa do BNDES (TFB)', at: bndes.data?.generatedAt, maxAge: ATRASO_H.bndes * H, weekdays: true },
      { key: 'moedas', label: 'TFC e moedas contratuais (BNDES)', at: moedas.data?.generatedAt, maxAge: ATRASO_H.moedas * H, weekdays: true },
      { key: 'oil', label: 'Petróleo Brent (EIA)', at: oil.data?.generatedAt, maxAge: ATRASO_H.oil * H, weekdays: true },
      { key: 'commodities', label: 'Commodities (EIA e Banco Mundial)', at: commodities.data?.generatedAt, maxAge: ATRASO_H.commodities * H, weekdays: true },
      { key: 'commodities-brl', label: 'IC-Br e soja em R$/saca (Banco Central e Banco Mundial)', at: commoditiesBrl.data?.generatedAt, maxAge: ATRASO_H['commodities-brl'] * H, weekdays: true },
      { key: 'fuels', label: 'Combustíveis ao consumidor (ANP)', at: fuels.data?.generatedAt, maxAge: ATRASO_H.fuels * H, weekdays: true },
      { key: 'freight', label: 'Transporte marítimo (BLS)', at: freight.data?.generatedAt, maxAge: ATRASO_H.freight * H, weekdays: true },
      { key: 'freight-jp', label: 'Transporte marítimo Japão (Banco do Japão)', at: freightJp.data?.generatedAt, maxAge: ATRASO_H['freight-jp'] * H, weekdays: true },
      { key: 'ipca', label: 'IPCA (IBGE)', at: ipca.data?.generatedAt, maxAge: ATRASO_H.ipca * H, weekdays: true },
      { key: 'divida', label: 'Dívida bruta do governo geral (Banco Central)', at: divida.data?.generatedAt, maxAge: ATRASO_H.divida * H, weekdays: true },
      { key: 'ipca-groups', label: 'IPCA por grupos (IBGE)', at: ipcaGroups.data?.generatedAt, maxAge: ATRASO_H['ipca-groups'] * H, weekdays: true },
      { key: 'calendar', label: 'Calendário econômico', at: calendar.data?.generatedAt, maxAge: ATRASO_H.calendar * H, weekdays: true },
    ].map(entry => ({ ...entry, resource: resources[entry.key], ...(entry.key === 'quotes' ? { health: quotesHealth } : {}) })),
    Date.now(),
  )
  // Uma linha por fonte: o estado e a coleta vêm das chaves que ela cobre (vale o pior estado e a coleta mais antiga).
  const RANK = { missing: 6, retained: 5, partial: 4, old: 3, reserve: 2, loading: 1, offhours: 0, ok: 0 }
  const fontes = FONTES.map((f) => {
    const mine = rows.filter((r) => f.chaves.includes(r.key))
    const worst = mine.reduce((w, r) => (!w || RANK[r.state] > RANK[w.state] || (RANK[r.state] === RANK[w.state] && (r.at ?? 0) < (w.at ?? 0)) ? r : w), null)
    const checked = mine.map(r => r.checkedAt).filter(Boolean)
    return { ...f, ...worst, state: worst?.state ?? 'missing', statusLabel: worst?.statusLabel ?? 'Indisponível', checkedAt: checked.length === mine.length ? Math.min(...checked) : null, parts: mine }
  })
  return (
    <div className="config-desk">
      <AcessosPanel />
      <Panel title="Governança dos dados" note="estado, origem e frequência de cada fonte" className="config-wide" refresh={['trends.json', 'macro.json', 'curves.json', 'news.json', 'reforma-tributaria.json', 'temas.json', 'insumos-precos.json', 'indices.json', 'policy-rates.json', 'estr.json', 'euro-curve.json', 'indexadores.json', 'bndes.json', 'moedas.json', 'oil.json', 'commodities.json', 'commodities-brl.json', 'fuels.json', 'freight.json', 'freight-jp.json', 'ipca.json', 'divida.json', 'ipca-groups.json', 'calendar.json']}>
        <h3 className="config-sub">Em resumo</h3>
        <ul className="config-list config-resumo">{RESUMO.map((t) => <li key={t}>{t}</li>)}</ul>
        <h3 className="config-sub">Fonte por fonte</h3>
        <div className="config-scroll" role="region" aria-label="Estado, origem e frequência de cada fonte" tabIndex={0}><table className="config-table config-gov">
          <thead><tr><th scope="col">Fonte</th><th scope="col">Estado</th><th scope="col">Horários</th><th scope="col">Origem</th><th scope="col">Coleta</th><th scope="col">Quando o dado muda</th><th scope="col">Atrasado após</th></tr></thead>
          <tbody>
            {fontes.map((f) => (
              <tr key={f.id}>
                <th scope="row">{f.nome}</th>
                <td data-label="Estado"><span className={`chip ${TONE[f.state]}`} title={f.detail}>{f.statusLabel}</span></td>
                <td data-label="Horários">
                  <div>Conferido no painel: {f.checkedAt ? dataTimestamp(f.checkedAt) : 'ainda não conferido'}</div>
                  {f.id === 'cambio' && quotesHealth?.observedAt && <div>Referência mais antiga: {dataTimestamp(quotesHealth.observedAt)}</div>}
                  <details className="config-times"><summary>Ver datas e estado</summary>
                    {f.parts.map(part => <div key={part.key}><b>{part.label}</b><p>{part.detail}</p><p>{part.key === 'quotes' && quotesVia !== 'central' ? 'Resposta recebida' : 'Arquivo gerado'}: {part.generatedAt ? dataTimestamp(part.generatedAt) : 'data não disponível'}<br />Última leitura bem-sucedida no painel: {part.lastSuccessAt ? dataTimestamp(part.lastSuccessAt) : 'data não disponível'}</p></div>)}
                    {f.id === 'cambio' ? <ul>{['USD', 'EUR', 'JPY', 'CNH'].map(code => <li key={code}>{code}/BRL: {quotes?.[code]?.timestamp ? dataTimestamp(quotes[code].timestamp) : 'referência indisponível'}</li>)}</ul> : <p>A referência e o período de cada dado aparecem no indicador correspondente. Uma taxa vigente pode permanecer igual entre divulgações.</p>}
                  </details>
                </td>
                <td data-label="Origem">{f.origem}</td>
                <td data-label="Coleta">{f.coleta}</td>
                <td data-label="Quando o dado muda">{f.muda}</td>
                <td data-label="Atrasado após">{f.atraso}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="config-note">Conferido no painel é a última tentativa de ler os dados neste navegador. Arquivo gerado é o horário da coleta publicada; não é o horário de cada observação. “Sem alerta” indica arquivo dentro do prazo e sem falha informada, sem certificar o número. No fim de semana, a pausa das coletas de dias úteis preserva os atrasos e as falhas anteriores. Horários em Brasília.</p>
        <h3 className="config-sub">No seu navegador</h3>
        <ul className="config-list">{NAVEGADOR.map((t) => <li key={t}>{t}</li>)}</ul>
        <h3 className="config-sub">Regras</h3>
        <ul className="config-list">{REGRAS.map((t) => <li key={t}>{t}</li>)}</ul>
      </Panel>
      <Panel title="Base de dados" note="órgão, API, série e arquivo de cada referência" className="config-wide">
        <BaseDados />
      </Panel>
      <div className="config-side">
        <Panel title="Atalhos" note="teclado">
          <div className="config-scroll" role="region" aria-label="Atalhos de teclado" tabIndex={0}><table className="config-table">
            <tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody>
          </table></div>
        </Panel>
        <Panel title="Aparência" note="só neste navegador">
          <div className="config-row">
            <button type="button" className="fx-toggle" aria-pressed={fx === 'neon'} onClick={() => setFx(fx === 'neon' ? 'off' : 'neon')}>Efeitos: {fx === 'neon' ? 'brilho ligado' : 'desligados'}</button>
            <span>Brilho discreto nas linhas dos gráficos.</span>
          </div>
        </Panel>
        <Panel title="Aplicativo" note="instalação">
          <p className="config-hint">Instale para abrir em tela cheia e offline. No Chrome e no Edge, use o botão de instalar quando ele aparecer; no iPhone e no iPad, Compartilhar e Adicionar à Tela de Início.</p>
          <div className="config-row"><InstallApp /></div>
        </Panel>
      </div>
      <Panel title="O que há de novo" className="config-wide"><Novidades open /></Panel>
    </div>
  )
}
