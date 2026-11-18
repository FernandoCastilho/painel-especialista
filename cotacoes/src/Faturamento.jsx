import ChartFullscreen from './ChartFullscreen.jsx'
import ExpandablePanel from './ExpandablePanel.jsx'
import './CalculatorStandard.css'
import { useRef, useState } from 'react'
import Help from './CalculatorHelp.jsx'
import { EXEMPLO, compararPeriodo, emMilhoes, indicadores12m, leituraCrescimento, parseFaturamento, resumoPorAno, rotuloMes, serieContinua, totalCurto } from './faturamento.js'
import './Faturamento.css'

const num = (v, casas = 0) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }))
const valor = (v) => (v == null ? '—' : num(v, Number.isInteger(v) ? 0 : 2))
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)
const vezes = (v) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`)

// Gera a imagem PNG do gráfico (2x), em cores claras e com título, para colar em apresentação.
const PROPS_IMAGEM = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor']
async function imagemDoGrafico(svgEl, titulo, subtitulo) {
  const raiz = svgEl.closest('.ft')
  raiz?.setAttribute('data-ft-export', 'claro')
  let xml, W, H
  try {
    const clone = svgEl.cloneNode(true)
    const origem = svgEl.querySelectorAll('*'), copia = clone.querySelectorAll('*')
    origem.forEach((el, i) => {
      const cs = getComputedStyle(el)
      copia[i].setAttribute('style', PROPS_IMAGEM.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
    })
    const vb = svgEl.viewBox.baseVal
    W = vb.width; H = vb.height
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', W)
    clone.setAttribute('height', H)
    clone.setAttribute('style', 'font-family:system-ui,sans-serif')
    xml = new XMLSerializer().serializeToString(clone)
  } finally {
    raiz?.removeAttribute('data-ft-export')
  }
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  await img.decode()
  const escala = 2, topo = subtitulo ? 56 : 36
  const canvas = document.createElement('canvas')
  canvas.width = W * escala
  canvas.height = (H + topo) * escala
  const ctx = canvas.getContext('2d')
  ctx.scale(escala, escala)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H + topo)
  ctx.fillStyle = '#000d3c'
  ctx.textAlign = 'center'
  ctx.font = '700 18px system-ui, sans-serif'
  ctx.fillText(titulo, W / 2, 24)
  if (subtitulo) { ctx.font = '400 13px system-ui, sans-serif'; ctx.fillText(subtitulo, W / 2, 44) }
  ctx.drawImage(img, 0, topo, W, H)
  return new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('imagem'))), 'image/png'))
}

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

function Grafico({ meses, sel, onSelecionar, comparacao, unidade, rotulo = valor, svgRef }) {
  const arrastando = useRef(false)
  const local = useRef(null)
  const svg = svgRef || local
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
  const vd = comparacao?.endividamento?.variacaoMedia ?? null
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
      {temSeta && vd != null && <text className="ft-arrow-div" x={(qAnterior.x1 + qAtual.x0) / 2} y={Y_SETA + 16}>Endividamento {pct(vd)}</text>}
      {!temSeta && qAtual && v != null && <text className={v < 0 ? 'ft-arrow ft-arrow-down' : 'ft-arrow ft-arrow-up'} x={qAtual.meio} y={Y_SETA - 4}>Faturamento {pct(v)}{vd != null ? ` · Endividamento ${pct(vd)}` : ''} vs. ano anterior</text>}
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
        const tf = rotulo(m.faturamento), td = rotulo(m.endividamento)
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
  const cr = leituraCrescimento(c)
  const pp = (v) => `${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`
  const conclusao = cr.relacao == null ? null
    : cr.relacao === 'estavel' ? 'Faturamento e endividamento cresceram no mesmo ritmo: a relação dívida/faturamento ficou estável.'
      : cr.relacao === 'piorou' ? `O endividamento cresceu ${pp(cr.diferencaPp)} acima do faturamento: a relação dívida/faturamento piorou no período.`
        : `O faturamento cresceu ${pp(cr.diferencaPp)} acima do endividamento: a relação dívida/faturamento melhorou no período.`
  const linhas = [
    ['Faturamento no período', f.atual, f.anterior, f.variacao],
    ['Faturamento médio mensal', f.mediaAtual, f.mediaAnterior, f.variacao],
    ['Endividamento médio', d.mediaAtual, d.mediaAnterior, d.variacaoMedia],
    [d.ultimoRotulo ? `Endividamento em ${d.ultimoRotulo} x ${d.ultimoAnteriorRotulo}` : 'Endividamento no último mês', d.ultimoAtual, d.ultimoAnterior, d.variacaoUltimo],
  ]
  return (
    <div className="ft-compare">
      <p className="ft-compare-title"><b>{c.rotulo}</b> comparado com <b>{c.rotuloAnterior}</b></p>
      {c.mesesComparados > 0 && (
        <div className={`ft-cresc${cr.relacao === 'piorou' ? ' ft-cresc-alerta' : ''}`} role="group" aria-label="Crescimento do faturamento e do endividamento">
          <div><span>Faturamento</span><b className={sinal(cr.fat)}>{pct(cr.fat)}</b><small>soma do período</small></div>
          <div><span>Endividamento</span><b className={sinal(cr.div == null ? null : -cr.div)}>{pct(cr.div)}</b><small>{cr.div == null ? 'sem saldo nos dois períodos' : 'média do período'}</small></div>
          {conclusao && <p>{conclusao}</p>}
        </div>
      )}
      {c.mesesComparados === 0
        ? <p className="cx-hint" role="status">Não há dados do ano anterior para esses meses.</p>
        : (
          <div className="cx-wrap" role="region" aria-label="Comparação com o ano anterior" tabIndex={0}>
            <table className="cx-matrix ft-table">
              <thead><tr><th scope="col"><span className="sr-only">Item</span></th><th scope="col">{c.rotulo}</th><th scope="col">{c.rotuloAnterior}</th><th scope="col">Variação</th></tr></thead>
              <tbody>
                {linhas.map(([rotulo, a, b, v]) => (
                  // Endividamento subindo é sinal de alerta: cor invertida em relação ao faturamento.
                  <tr key={rotulo}><th scope="row">{rotulo}</th><td>{valor(a)}</td><td>{valor(b)}</td><td className={sinal(v == null ? null : rotulo.startsWith('Endividamento') ? -v : v)}>{pct(v)}</td></tr>
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
  const [milhoes, setMilhoes] = useState(false)
  const [aviso, setAviso] = useState('')
  const svgRef = useRef(null)
  const { meses, avisos, unidade } = parseFaturamento(texto)
  const serie = serieContinua(meses)
  const chaves = new Set(serie.map((m) => m.chave))
  const selValida = sel && chaves.has(sel.de) && chaves.has(sel.ate) ? sel : null
  const comparacao = selValida ? compararPeriodo(meses, selValida.de, selValida.ate) : null
  const anos = resumoPorAno(meses)
  const selecionar = (de, ate) => setSel({ de, ate })
  const ind = indicadores12m(meses)
  const emMil = unidade === 'R$ mil'
  const rotulo = milhoes ? emMilhoes : valor
  const unidadeGrafico = milhoes ? (emMil ? 'R$ MM' : 'em milhares') : unidade
  const tituloGrafico = `Faturamento x Endividamento${unidadeGrafico ? ` (${unidadeGrafico})` : ''}`
  const ultimo = meses.filter((m) => m.faturamento != null).at(-1)?.chave
  const primeiro = serie[0]?.chave
  const atalho = (n) => ultimo != null && selecionar(Math.max(primeiro, ultimo - n + 1), ultimo)
  const anoAteAgora = () => ultimo != null && selecionar(Math.max(primeiro, Math.floor(ultimo / 12) * 12), ultimo)
  const exportar = async (modo) => {
    if (!svgRef.current) return
    const sub = comparacao ? `${comparacao.rotulo} contra ${comparacao.rotuloAnterior}${comparacao.faturamento.variacao != null ? ` · faturamento ${pct(comparacao.faturamento.variacao)}` : ''}${comparacao.endividamento.variacaoMedia != null ? ` · endividamento médio ${pct(comparacao.endividamento.variacaoMedia)}` : ''}` : ''
    const blob = imagemDoGrafico(svgRef.current, tituloGrafico, sub)
    try {
      if (modo === 'copiar') {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('sem área de transferência')
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setAviso('Imagem copiada. Cole no PowerPoint com Ctrl+V.')
        return
      }
    } catch {
      setAviso('Não deu para copiar neste navegador; a imagem foi baixada.')
    }
    try {
      const url = URL.createObjectURL(await blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'faturamento-endividamento.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      if (modo !== 'copiar') setAviso('Imagem baixada.')
    } catch {
      setAviso('Não foi possível gerar a imagem.')
    }
  }
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
          <ExpandablePanel title={tituloGrafico}>
            {ind && (
              <div className="ft-kpis" role="group" aria-label="Últimos 12 meses e alavancagem">
                <div><span>Faturamento {ind.meses === 12 ? 'últimos 12 meses' : `últimos ${ind.meses} meses informados`}</span><b>{totalCurto(ind.total, unidade)}</b><small>{ind.de} a {ind.ate}</small></div>
                <div><span>12 meses anteriores</span><b>{ind.mesesAnterior ? totalCurto(ind.totalAnterior, unidade) : '—'}</b><small className={sinal(ind.variacao)}>{ind.variacao != null ? `${pct(ind.variacao)} contra ${ind.anteriorDe} a ${ind.anteriorAte}` : ind.mesesAnterior ? `só ${ind.mesesAnterior} de 12 meses informados` : 'sem dados do período'}</small></div>
                <div><span>Média mensal</span><b>{valor(Math.round(ind.media))}</b><small>{ind.meses} {ind.meses === 1 ? 'mês' : 'meses'}</small></div>
                <div><span>Endividamento</span><b>{valor(ind.endividamento)}</b><small className={ind.endividamentoForaDaJanela ? 'ft-down' : undefined}>{ind.endividamentoMes ? `último saldo: ${ind.endividamentoMes}${ind.endividamentoForaDaJanela ? ' (fora dos 12 meses)' : ''}` : 'sem saldo informado'}</small></div>
                <div><span>Alavancagem <Help title="Alavancagem e últimos 12 meses"><p>Mesmo critério do DAC. Alavancagem = endividamento do último mês com saldo ÷ média mensal do faturamento dos últimos 12 meses.</p><p>Os 12 meses terminam no último mês com faturamento informado. Endividamento zero ou vazio conta como mês sem informação. A comparação com os 12 meses anteriores só aparece quando os dois períodos têm os 12 meses.</p></Help></span><b>{ind.alavancagem != null ? `${vezes(ind.alavancagem)} faturamento` : '—'}</b><small>{ind.meses < 12 ? `média de ${ind.meses} meses` : 'endividamento ÷ média mensal'}</small></div>
              </div>
            )}
            <div className="ft-tools">
              <div className="ft-atalhos" role="group" aria-label="Atalhos de período">
                <span>Período:</span>
                <button type="button" onClick={() => atalho(3)}>Últimos 3 meses</button>
                <button type="button" onClick={() => atalho(6)}>Últimos 6 meses</button>
                <button type="button" onClick={() => atalho(12)}>Últimos 12 meses</button>
                <button type="button" onClick={anoAteAgora}>Ano até agora</button>
              </div>
              <div className="ft-atalhos" role="group" aria-label="Rótulos e imagem">
                <span className="seg" role="group" aria-label="Rótulos do gráfico">
                  <button type="button" aria-pressed={!milhoes} onClick={() => setMilhoes(false)}>{emMil ? 'R$ mil' : 'Como colado'}</button>
                  <button type="button" aria-pressed={milhoes} onClick={() => setMilhoes(true)}>{emMil ? 'R$ MM' : '÷ 1.000'}</button>
                </span>
                <button type="button" onClick={() => exportar('copiar')}>Copiar imagem</button>
                <button type="button" onClick={() => exportar('baixar')}>Baixar PNG</button>
              </div>
              <p className="cx-hint ft-aviso" role="status">{aviso}</p>
            </div>
            <div className="ft-legend" aria-hidden="true"><span className="ft-key-f" /> Faturamento <span className="ft-key-d" /> Endividamento <span className="ft-key-box" /> Período escolhido e mesmo período do ano anterior</div>
            <div className="ft-chart-wrap"><Grafico meses={serie} sel={selValida} onSelecionar={selecionar} comparacao={comparacao} unidade={unidade} rotulo={rotulo} svgRef={svgRef} /></div>
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
