import { useState } from 'react'
import './Feriados.css'
import { groupHolidayRows } from './holidayView.js'
import { calFlag, calendarYearCovered, holidayMap, HOLIDAY_SOURCES } from './holidays.js'
import Flag from './Flag.jsx'
import { marketDate } from './marketReturns.js'

// Aba Feriados: próximos 12 meses, em ordem de data, com o local e quantos dias faltam.
const LIST = [
  { id: 'CIVBR', where: 'Brasil · feriados nacionais por lei' },
  { id: 'B3', where: 'B3 · sessões de negociação' },
  { id: 'SPE', where: 'Estado de SP' },
  { id: 'SPC', where: 'São Paulo (capital)' },
  { id: 'PRE', where: 'Estado do Paraná' },
  { id: 'CWB', where: 'Curitiba' },
  { id: 'CPS', where: 'Campinas' },
  { id: 'RMC', where: 'Região de Campinas' },
  { id: 'SOR', where: 'Sorocaba' },
  { id: 'BAR', where: 'Barueri (Alphaville)' },
  { id: 'MG', where: 'Belo Horizonte' },
  { id: 'CVL', where: 'Cascavel' },
  { id: 'LDA', where: 'Londrina' },
  { id: 'MGA', where: 'Maringá' },
  { id: 'NY', where: 'Nova York' },
  { id: 'UK', where: 'Londres' },
  { id: 'JP', where: 'Tóquio' },
  { id: 'CN', where: 'China (continental)' },
]
const ms = (d) => new Date(`${d}T12:00:00Z`).getTime()
const fmt = (d) => {
  const dt = new Date(`${d}T12:00:00Z`)
  const wd = dt.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
  return { date: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }), wd }
}
const left = (n) => (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : `${n} dias`)
// Abre em "Brasil e B3" (feriados nacionais e pregões), que vale para quase todos; a escolha da pessoa fica guardada
// neste navegador. "Todos os calendários" continua no seletor.
const PADRAO = 'CIVBR+B3'
const CHAVE = 'painel-feriados-calendario'
const OPCOES = new Set(['all', PADRAO, ...LIST.map((item) => item.id)])
const lerEscolha = () => { try { const v = localStorage.getItem(CHAVE); return OPCOES.has(v) ? v : PADRAO } catch { return PADRAO } }
const guardarEscolha = (v) => { try { localStorage.setItem(CHAVE, v) } catch { /* sem armazenamento: só não lembra */ } }

export default function Feriados({ hol }) {
  const [place, setPlaceState] = useState(lerEscolha)
  const setPlace = (v) => { setPlaceState(v); guardarEscolha(v) }
  const today = marketDate(Date.now())
  const y = Number(today.slice(0, 4))
  const map = new Map()
  for (const c of LIST) {
    for (const yr of [y, y + 1]) {
      for (const [d, name] of holidayMap(c.id, yr, hol?.ctx)) {
        if (d < today || ms(d) - ms(today) > 366 * 864e5) continue
        const k = `${d}|${name}`
        if (!map.has(k)) map.set(k, { d, name, where: [], places: [] })
        map.get(k).where.push(c.where)
        map.get(k).places.push(c.id)
      }
    }
  }
  const ids = place === 'all' ? null : place.split('+')
  // com um recorte escolhido, cada linha mostra só os calendários desse recorte
  const rows = ids ? [...map.values()].flatMap((row) => {
    const keep = row.places.map((id, i) => ids.includes(id) ? i : -1).filter((i) => i >= 0)
    return keep.length ? [{ ...row, where: keep.map((i) => row.where[i]), places: keep.map((i) => row.places[i]) }] : []
  }) : [...map.values()]
  const groups = groupHolidayRows(rows)
  const selected = LIST.filter(c => !ids || ids.includes(c.id))
  const missing = selected.map(c => ({ ...c, years: [y, y + 1].filter(year => !calendarYearCovered(c.id, year, hol?.ctx)) })).filter(c => c.years.length)
  const count = groups.reduce((total, group) => total + group.rows.length, 0)
  const financial = ['B3', 'NY', 'UK', 'JP', 'CN'].includes(place)
  return (
    <section className="macro feriados" aria-labelledby="feriados-title">
      <div className="history-head">
        <div>
          <h1 id="feriados-title">Feriados e funcionamento</h1>
          <p className="fer-caption">Próximos 12 meses · calendários com escopos distintos</p>
        </div>
        <label className="fer-filter">Calendário
          <select value={place} onChange={(event) => setPlace(event.target.value)}>
            <option value={PADRAO}>Brasil e B3 · nacionais e pregões</option>
            <option value="all">Todos os calendários</option>
            {LIST.map((item) => <option key={item.id} value={item.id}>{item.where}</option>)}
          </select>
        </label>
      </div>
      <p className="status">{place === PADRAO ? 'Feriados nacionais previstos em lei e dias sem pregão na B3. Para estados, cidades e praças de fora, escolha outro calendário.' : place === 'all' ? 'A lista reúne feriados previstos em lei e datas sem funcionamento em calendários financeiros. Uma data pode valer apenas para o calendário indicado.' : financial ? place === 'B3' ? 'Suspensão de sessões de negociação da B3; não indica feriado civil, expediente bancário ou todas as regras de registro e liquidação. Em 24/12/2026 há exceção para alocação de registros de Balcão sem contraparte central.' : 'Calendário financeiro de referência da praça; não representa todas as bolsas ou modalidades de liquidação.' : place === 'CIVBR' ? 'Feriados nacionais de data fixa previstos em lei. Feriados religiosos, como Sexta-feira Santa e Corpus Christi, dependem da legislação municipal. Pontos facultativos e recessos administrativos não estão incluídos.' : 'Somente registros específicos desta cidade, estado ou região. Não inclui automaticamente os feriados nacionais nem os demais calendários aplicáveis; consulte também Brasil · feriados nacionais por lei.'}</p>
      {missing.length > 0 && <details className="fer-partial" role="status"><summary>Cobertura parcial em {missing.length} {missing.length === 1 ? 'calendário' : 'calendários'}</summary><p>Cobertura parcial: {missing.map(c => `${c.where} (${c.years.join(', ')})`).join('; ')} sem calendário completo verificado nesta base. A ausência de registros não permite afirmar que não haverá feriados ou suspensões.</p></details>}
      <div aria-live="polite" aria-atomic="true" className="fer-count">
        {count} {count === 1 ? 'data cadastrada' : 'datas cadastradas'} nesta seleção{missing.length > 0 ? ' · cobertura parcial' : ''}
      </div>
      {groups.length ? <div className="fer-months">{groups.map((group) => (
        <section className="fer-month" key={group.month} aria-labelledby={`month-${group.month}`}>
          <h2 id={`month-${group.month}`}>{new Date(`${group.month}-01T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })} <span className="fer-month-count">· {group.rows.length} {group.rows.length === 1 ? 'data' : 'datas'}</span></h2>
          <ul className="fer-list">
          {group.rows.map((r) => {
            const f = fmt(r.d)
            const n = Math.round((ms(r.d) - ms(today)) / 864e5)
            return (
              <li key={`${r.d}${r.name}`}>
                <div className="fer-date"><b>{f.date}</b><small>{f.wd}</small></div>
                <div className="fer-body"><span>{r.name}</span><small className="fer-where">{[...new Set(r.places.map(calFlag))].map((f) => <Flag key={f} code={f} width={18} height={12} />)}{r.where.join(' · ')}</small></div>
                <div className={`fer-left${n <= 7 ? ' soon' : ''}`}>{left(n)}</div>
              </li>
            )
          })}
          </ul>
        </section>
      ))}</div> : <p className="status">{missing.length ? 'Não há datas cadastradas nesta seleção. Consulte a fonte oficial: a cobertura incompleta não indica ausência de feriados.' : 'Não há datas cadastradas neste recorte e período. Confira o escopo do calendário selecionado.'}</p>}
      <details><summary>Escopo e fontes conferidas em 05/11/2026</summary><p>Feriados previstos em lei, pontos facultativos e sessões de mercado não são equivalentes. Calendários anuais de mercado não são extrapolados para anos sem conferência; regras locais dependem da legislação aplicável.</p><ul>{HOLIDAY_SOURCES.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul></details>
    </section>
  )
}
