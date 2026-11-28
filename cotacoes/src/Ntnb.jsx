import { useMemo } from 'react'
import { RateChart } from './Macro.jsx'
import { CurveChart } from './Curves.jsx'
import Estado from './Estado.jsx'
import IndicatorTable from './IndicatorTable.jsx'
import { useNtnb } from './useNtnb.js'
import { historicoNtnb, ntnbView, rotuloVenc, taxaEm, vencPadrao } from './ntnb.js'

const DAY = 864e5
const n2 = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rate = (v) => `${n2(v)}% a.a.`
const dia = (iso) => iso.split('-').reverse().join('/')
const FONTE = 'Tesouro Direto (Tesouro Transparente), taxa de compra da manhã da NTN-B (Tesouro IPCA+ com Juros Semestrais). É o juro acima do IPCA que o Tesouro paga a quem compra o título hoje e leva até o vencimento: expectativa de mercado, não o juro real calculado pela Selic e pela inflação passada. Atualizada 1 vez por dia útil, com o fechamento do dia útil anterior.'

// Lê e confere o arquivo; undefined = carregando, null = indisponível.
function useView() {
  const data = useNtnb()
  return useMemo(() => (data === undefined ? undefined : ntnbView(data)), [data])
}

function Indisponivel({ carregando }) {
  return <Estado tipo={carregando ? 'info' : 'erro'}>{carregando ? 'Carregando NTN-B…' : 'NTN-B indisponível no momento.'}</Estado>
}

const Atraso = ({ view }) => view.atrasado && <p className="status stale" role="status">Atualização da NTN-B pendente; mantidas as taxas de {dia(view.ref)}.</p>

// Histórico da taxa de um vencimento no período escolhido. `onVenc` (no detalhe) mostra a escolha do vencimento.
export function NtnbHistorico({ range, venc, onVenc }) {
  const view = useView()
  const v = view && (view.vencimentos.includes(venc) ? venc : vencPadrao(view))
  const all = useMemo(() => (v ? historicoNtnb(view, v) : []), [view, v])
  const from = range.start.getTime(), to = range.end.getTime() + DAY
  const points = useMemo(() => all.filter((p) => p.t >= from && p.t <= to), [all, from, to])
  if (!view) return <Indisponivel carregando={view === undefined} />
  const ultimo = all.at(-1)
  return (
    <>
      <Atraso view={view} />
      <RateChart
        id="NTNB"
        title={`Brasil · ${rotuloVenc(v)}`}
        help="ntnb"
        subtitle="juro real (acima do IPCA), % a.a."
        color="var(--chart-gold)"
        points={points}
        history={all}
        fmt={rate}
        label={rotuloVenc(v)}
        refresh={null}
        actions={onVenc && (
          <div className="seg" role="group" aria-label="Vencimento da NTN-B">
            {view.vencimentos.map((x) => <button key={x} type="button" aria-pressed={x === v} onClick={() => onVenc(x)}>{x.slice(0, 4)}</button>)}
          </div>
        )}
        note={`${ultimo ? `Última: IPCA + ${rate(ultimo.bid)} em ${dia(view.ref)} · ` : ''}Vencimento em ${dia(v)} · ${FONTE}`}
      />
    </>
  )
}

// Curva de hoje por vencimento, com 1 mês e 1 ano atrás para comparar (mesmos títulos).
export function NtnbCurva() {
  const view = useView()
  if (!view) return <Indisponivel carregando={view === undefined} />
  return (
    <>
      <Atraso view={view} />
      <CurveChart title="Brasil · Curva da NTN-B" subtitle="juro real (acima do IPCA), % a.a. por vencimento" data={view.curve} mode="us" help="curvaNtnb" source={FONTE} refresh={null} />
    </>
  )
}

// Tabela do detalhe: cada vencimento hoje, há 1 mês e há 1 ano (linhas sem clique, como as outras tabelas do detalhe).
export function NtnbTabela() {
  const view = useView()
  if (!view) return null
  const cols = view.curve.compare
  const pp = (a, b) => (a && b ? `${a.taxa - b.taxa >= 0 ? '+' : '−'}${n2(Math.abs(a.taxa - b.taxa))} p.p.` : '—')
  return (
    <div className="executive-rates curve-table juros-tabela">
      <p className="table-swipe-hint">Deslize a tabela para ver as outras datas →</p>
      <div className="executive-rates__scroll">
        <IndicatorTable
          first="Vencimento"
          caption="NTN-B: juro real por vencimento"
          columns={[...cols.map((c) => ({ label: c.label, small: dia(c.date), aria: `${c.label}, ${dia(c.date)}` })), { label: 'Variação', small: `hoje × ${cols.at(-1).label}`, aria: `Variação entre hoje e ${cols.at(-1).label}, em pontos percentuais` }]}
          rows={view.vencimentos.map((v) => {
            const em = cols.map((c) => taxaEm(view, v, c.date))
            const valido = em.map((x, i) => (x?.date === cols[i].date ? x : null)) // só a taxa do próprio dia; título sem taxa naquela data fica em branco
            return { id: v, name: rotuloVenc(v), sub: `vence ${dia(v)}`, cells: [...valido.map((x) => ({ text: x ? rate(x.taxa) : '—' })), { text: pp(valido[0], valido.at(-1)) }] }
          })}
        />
      </div>
    </div>
  )
}
