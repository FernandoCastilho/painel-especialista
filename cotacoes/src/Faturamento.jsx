import ChartFullscreen from './ChartFullscreen.jsx'
import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useRef, useState } from 'react'
import Help from './CalculatorHelp.jsx'
import { EXEMPLO, compararPeriodo, parseFaturamento, resumoPorAno, rotuloMes, serieContinua, totalCurto } from './faturamento.js'
import './Faturamento.css'

const num = (v, casas = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))
const valor = (v) => (v == null ? '—' : num(v, Number.isInteger(v) ? 0 : 2))
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)
const sinal = (v) => (v == null || Math.abs(v) < 0.0005 ? '' : v > 0 ? 'ft-up' : 'ft-down')

export function FaturamentoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21v-6M9 21v-9M13 21v-7M17 21v-11" />
      <path d="M4 10l5-4 4 3 7-6" />
    </svg>
  )
}

// Geometria do gráfico (unidades do desenho; o SVG se ajusta à largura da tela).
const SLOT = 56, TOPO = 84, BASE = 28, ALT = 338, BARRA = 20
// Faixa de cima: seta da variação (y 10-24), total de cada período (y 40) e topo dos quadros (y 48).
const Y_SETA = 22, Y_TOTAL = 40, Y_QUADRO = 48
const larguraRotulo = (txt) => txt.length * 6.6 + 10

function Grafico({ meses, sel, onSelecionar, comparacao, unidade }) {
  const arrastando = useRef(false)
  const svg = useRef(null)
  const W = meses.length * SLOT
  const max = Math.max(1, ...meses.flatMap((m) => [m.faturamento ?? 0, m.endividamento ?? 0]))
  const plotH = ALT - TOPO - BASE
  const y = (v) => TOPO + (1 - Math.max(0, v) / max) * plotH
  const cx = (i) => i * SLOT + SLOT / 2
  const temDivida = meses.some((m) => m.endividamento != null)

  const indice = (e) => {
    const r = svg.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    return Math.min(meses.length - 1, Math.max(0, Math.floor(x / SLOT)))
  }
  const down = (e) => {
    if (e.button != null && e.button !== 0) return
    const k = meses[indice(e)].chave
    arrastando.current = true
    svg.current.setPointerCapture?.(e.pointerId)
    onSelecionar(k, k)
  }
  const move = (e) => {
    if (!arrastando.current || !sel) return
    onSelecionar(sel.de, meses[indice(e)].chave)
  }
  const up = () => { arrastando.current = false }

  const [ini, fim] = sel ? [Math.min(sel.de, sel.ate), Math.max(sel.de, sel.ate)] : [null, null]
  // Um quadro pontilhado por período (escolhido e mesmo período do ano anterior), como em apresentação.
  const pos = new Map(meses.map((m, i) => [m.chave, i]))
  const quadro = (a, b) => {
    const ia = [...Array(b - a + 1)].map((_, j) => pos.get(a + j)).filter((i) => i != null)
    if (!ia.length) return null
    const x0 = ia[0] * SLOT + 4, x1 = (ia.at(-1) + 1) * SLOT - 4
    return { x0, x1, meio: (x0 + x1) / 2 }
  }
  const qAtual = sel ? quadro(ini, fim) : null
  const qAnterior = sel ? quadro(ini - 12, fim - 12) : null
  const f = comparacao?.faturamento
  const v = f?.variacao
  const temSeta = qAtual && qAnterior && v != null && qAtual.x0 - qAnterior.x1 > 30
  const pontos = meses.map((m, i) => (m.endividamento == null ? null : `${cx(i)},${y(m.endividamento)}`))
  const linha = pontos.filter(Boolean).join(' ')

  return (
    <ChartFullscreen><svg
      ref={svg}
      className="ft-chart"
      style={{ minWidth: `${Math.max(640, meses.length * 46)}px` }}
      viewBox={`0 0 ${W} ${ALT}`}
      role="img"
      aria-label={`Gráfico de ${meses.length} meses, de ${meses[0].rotulo} a ${meses.at(-1).rotulo}. Clique em um mês ou arraste para escolher o período.`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {[['ant', qAnterior, f?.anterior], ['atu', qAtual, f?.atual]].map(([id, q, total]) => q && (
        <g key={id}>
          <rect className="ft-box" x={q.x0} y={Y_QUADRO} width={q.x1 - q.x0} height={ALT - Y_QUADRO - 3} />
          {total != null && <text className="ft-box-total" x={q.meio} y={Y_TOTAL}>{totalCurto(total, unidade)}</text>}
        </g>
      ))}
      {temSeta && (
        <g className={v < 0 ? 'ft-arrow ft-arrow-down' : 'ft-arrow ft-arrow-up'}>
          <line x1={qAnterior.x1 + 10} x2={qAtual.x0 - 14} y1={Y_SETA} y2={Y_SETA} />
          <polygon points={`${qAtual.x0 - 6},${Y_SETA} ${qAtual.x0 - 16},${Y_SETA - 5} ${qAtual.x0 - 16},${Y_SETA + 5}`} />
          <text x={(qAnterior.x1 + qAtual.x0) / 2} y={Y_SETA - 6}>{pct(v)}</text>
        </g>
      )}
      {!temSeta && qAtual && v != null && <text className={v < 0 ? 'ft-arrow ft-arrow-down' : 'ft-arrow ft-arrow-up'} x={qAtual.meio} y={Y_SETA - 4}>{pct(v)} vs. ano anterior</text>}
      <line className="ft-axis" x1="0" x2={W} y1={ALT - BASE} y2={ALT - BASE} />
      {temDivida && <polygon className="ft-area" points={`${cx(meses.findIndex((m) => m.endividamento != null))},${ALT - BASE} ${linha} ${cx(meses.findLastIndex((m) => m.endividamento != null))},${ALT - BASE}`} />}
      {meses.map((m, i) => m.faturamento != null && (
        <rect key={`f${m.chave}`} className="ft-bar" x={cx(i) - BARRA / 2} y={y(m.faturamento)} width={BARRA} height={ALT - BASE - y(m.faturamento)} rx="3" />
      ))}
      {temDivida && <polyline className="ft-line" points={linha} />}
      {meses.map((m, i) => {
        const yf = m.faturamento != null ? y(m.faturamento) : null
        let yd = m.endividamento != null ? y(m.endividamento) : null
        // Rótulo do endividamento sobe se for encostar no do faturamento.
        if (yf != null && yd != null && Math.abs(yd - yf) < 22) yd = Math.min(yd, yf) - 22
        const tf = valor(m.faturamento), td = valor(m.endividamento)
        return (
          <g key={`l${m.chave}`}>
            {yf != null && <><rect className="ft-tag-f" x={cx(i) - larguraRotulo(tf) / 2} y={yf - 22} width={larguraRotulo(tf)} height="17" rx="3" /><text className="ft-tag-ft" x={cx(i)} y={yf - 9.5}>{tf}</text></>}
            {yd != null && <><circle className="ft-dot" cx={cx(i)} cy={y(m.endividamento)} r="3" /><rect className="ft-tag-d" x={cx(i) - larguraRotulo(td) / 2} y={Math.max(2, yd - 24)} width={larguraRotulo(td)} height="17" rx="3" /><text className="ft-tag-dt" x={cx(i)} y={Math.max(2, yd - 24) + 12.5}>{td}</text></>}
            <text className="ft-month" x={cx(i)} y={ALT - 9}>{m.rotulo}</text>
          </g>
        )
      })}
    </svg></ChartFullscreen>
  )
}

function Comparacao({ c }) {
  if (!c) return <p className="cx-hint ft-pad">Clique em um mês do gráfico, ou clique e arraste sobre vários meses, para comparar com o mesmo período do ano anterior.</p>
  const f = c.faturamento, d = c.endividamento
  const linhas = [
    ['Faturamento no período', f.atual, f.anterior, f.variacao],
    ['Faturamento médio mensal', f.mediaAtual, f.mediaAnterior, f.variacao],
    ['Endividamento médio', d.mediaAtual, d.mediaAnterior, d.variacaoMedia],
    [d.ultimoRotulo ? `Endividamento em ${d.ultimoRotulo} x ${d.ultimoAnteriorRotulo}` : 'Endividamento no último mês', d.ultimoAtual, d.ultimoAnterior, d.variacaoUltimo],
  ]
  return (
    <div className="ft-compare">
      <p className="ft-compare-title"><b>{c.rotulo}</b> comparado com <b>{c.rotuloAnterior}</b></p>
      {c.mesesComparados === 0
        ? <p className="cx-hint" role="status">Não há dados do ano anterior para esses meses.</p>
        : (
          <div className="cx-wrap" role="region" aria-label="Comparação com o ano anterior" tabIndex={0}>
            <table className="cx-matrix ft-table">
              <thead><tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col">{c.rotulo}</th><th scope="col">{c.rotuloAnterior}</th><th scope="col">Variação</th></tr></thead>
              <tbody>
                {linhas.map(([rotulo, a, b, v]) => (
                  <tr key={rotulo}><th scope="row">{rotulo}</th><td>{valor(a)}</td><td>{valor(b)}</td><td className={sinal(v)}>{pct(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      {c.mesesComparados > 0 && c.mesesComparados < c.mesesNoPeriodo && <p className="cx-hint">Faturamento comparado em {c.mesesComparados} de {c.mesesNoPeriodo} meses: os demais não têm o mesmo mês do ano anterior. No período todo, o faturamento soma {valor(c.faturamento.totalPeriodo)}.</p>}
      {c.mesesComparados > 0 && d.mesesComparados < c.mesesComparados && <p className="cx-hint">Endividamento comparado em {d.mesesComparados} {d.mesesComparados === 1 ? 'mês' : 'meses'}: saldo zero ou vazio conta como sem informação.</p>}
    </div>
  )
}

export default function Faturamento({ onBack }) {
  const [texto, setTexto] = useState('')
  const [sel, setSel] = useState(null)
  const { meses, avisos, unidade } = parseFaturamento(texto)
  const serie = serieContinua(meses)
  const chaves = new Set(serie.map((m) => m.chave))
  const selValida = sel && chaves.has(sel.de) && chaves.has(sel.ate) ? sel : null
  const comparacao = selValida ? compararPeriodo(meses, selValida.de, selValida.ate) : null
  const anos = resumoPorAno(meses)
  const selecionar = (de, ate) => setSel({ de, ate })
  const [ini, fim] = selValida ? [Math.min(selValida.de, selValida.ate), Math.max(selValida.de, selValida.ate)] : ['', '']

  return (
    <section className="cx bw calc-standard calc-workspace ft" aria-labelledby="ft-h">
      <button type="button" className="cx-back" onClick={onBack}><span aria-hidden="true">‹</span> Calculadoras</button>
      <div className="bw-heading calc-workspace-heading"><h2 id="ft-h" className="cx-title"><strong aria-hidden="true">{'PME'}</strong><span>Faturamento</span></h2><Help title="Faturamento: como usar"><p>Cole a tabela com uma linha por mês: competência, faturamento e endividamento (por exemplo, copiada do DAC). Aceita meses como Jan/24, out/2024 ou 10/2024 e números como 7.123 ou 7.123,45; traço (– ou -) é mês sem informação. Também aceita a tabela com barras (| Jan/25 | 350 | 2.235 |). Linhas de título e cabeçalho são ignoradas, e a unidade do cabeçalho, como (R$ mil), aparece no gráfico.</p><p>Os valores ficam na unidade em que foram colados (normalmente R$ mil). Clique em um mês ou arraste sobre vários para comparar com os mesmos meses do ano anterior. Só entram na variação os meses que existem nos dois anos. Endividamento zero ou vazio conta como sem informação, porque costuma ser mês ainda não fechado.</p><p>Os dados ficam só nesta tela: nada é salvo nem enviado.</p></Help></div>

      <article className="desk-panel cx-panel">
        <header><h3 className="cx-heading"><span>Dados</span></h3></header>
        <div className="ft-input">
          <label htmlFor="ft-texto">Cole aqui: Competência (mês), Faturamento e Endividamento</label>
          <textarea id="ft-texto" rows={8} spellCheck={false} placeholder={'Faturamento e endividamento\nCompetência\tFaturamento (R$ mil)\tEndividamento (R$ mil)\nJan/24\t87\t–\nFev/24\t1.246\t–\nJan/25\t350\t2.235'} value={texto} onChange={(e) => setTexto(e.target.value)} aria-describedby="ft-status" />
          <div className="ft-actions">
            <button type="button" onClick={() => { setTexto(EXEMPLO); setSel(null) }}>Usar exemplo fictício</button>
            {texto && <button type="button" onClick={() => { setTexto(''); setSel(null) }}>Limpar</button>}
          </div>
          <p id="ft-status" className="cx-hint" role="status">{meses.length ? `${meses.length} ${meses.length === 1 ? 'mês lido' : 'meses lidos'}, de ${meses[0].rotulo} a ${meses.at(-1).rotulo}${unidade ? `, valores em ${unidade}` : ''}.` : 'Nenhum mês lido ainda.'}</p>
          {avisos.length > 0 && (
            <ul className="ft-avisos" role="alert">
              {avisos.slice(0, 6).map((a) => <li key={a.linha}>Linha {a.linha} ignorada: {a.motivo} <code>{a.texto}</code></li>)}
              {avisos.length > 6 && <li>Mais {avisos.length - 6} linhas ignoradas.</li>}
            </ul>
          )}
        </div>
      </article>

      {meses.length > 0 && (
        <article className="desk-panel cx-panel calc-result-shell" aria-live="polite" data-apz-pronto="">
          <ExpandablePanel title={`Faturamento x Endividamento${unidade ? ` (${unidade})` : ''}`}>
            <div className="ft-legend" aria-hidden="true"><span className="ft-key-f" /> Faturamento <span className="ft-key-d" /> Endividamento <span className="ft-key-box" /> Período escolhido e mesmo período do ano anterior</div>
            <div className="ft-chart-wrap"><Grafico meses={serie} sel={selValida} onSelecionar={selecionar} comparacao={comparacao} unidade={unidade} /></div>
            <div className="ft-range">
              <label>De <select value={ini} onChange={(e) => { const k = Number(e.target.value); selecionar(k, fim === '' || fim < k ? k : fim) }}><option value="" disabled>mês</option>{serie.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}</select></label>
              <label>Até <select value={fim} onChange={(e) => { const k = Number(e.target.value); selecionar(ini === '' || ini > k ? k : ini, k) }}><option value="" disabled>mês</option>{serie.map((m) => <option key={m.chave} value={m.chave}>{m.rotulo}</option>)}</select></label>
              {selValida && <button type="button" onClick={() => setSel(null)}>Limpar seleção</button>}
            </div>
            <Comparacao c={comparacao} />
            <div className="ft-years">
              {anos.map((a) => (
                <div key={a.ano} className="ft-year">
                  <b>{a.ano}</b>
                  <span>Média mensal <strong>{valor(Math.round(a.media * 100) / 100)}</strong></span>
                  <span>Total ({a.meses} {a.meses === 1 ? 'mês' : 'meses'}) <strong>{valor(a.total)}</strong></span>
                </div>
              ))}
            </div>
          </ExpandablePanel>
        </article>
      )}
      <p className="status">{unidade ? `Valores em ${unidade}` : 'Valores na unidade colada'} · Meses do ano anterior: {!selValida ? 'escolha um período' : ini === fim ? rotuloMes(ini - 12) : `${rotuloMes(ini - 12)} a ${rotuloMes(fim - 12)}`}</p>
    </section>
  )
}
