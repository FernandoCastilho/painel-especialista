// Quadro "Fluxo de pagamentos" do Capital de Giro (pedido do Fernando em 22/11/2026): uma barra por mês da operação.
// Altura = quanto é pago no mês; dentro da barra, a parte de juros. Mês sem pagamento fica vazio, para mostrar a periodicidade.
// Só apresentação: os números são os do cronograma da simulação.
import { useId, useMemo, useState } from 'react'
import CalculatorHelp from './CalculatorHelp.jsx'
import { useWidth } from './HistoryChart.jsx'
import { focoPorTeclado, limitarBalao, margemEixo, saidaDeToque, useLarguraBalao, useTocarFora } from './chartToque.js'
import { fluxoMensal } from './fluxoPagamentos.js'
import './FluxoPagamentos.css'

const H = 300
const M = { t: 48, r: 12, b: 28 } // no alto, o resumo dentro do gráfico
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dmy = iso => iso.split('-').reverse().join('/')
// Eixo em reais, curto: "R$ 160 mil", "R$ 1,2 mi".
const compacto = (v, casas = 1) => v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: casas })} mi`
  : v >= 1e3 ? `R$ ${Math.round(v / 1e3).toLocaleString('pt-BR')} mil` : `R$ ${Math.round(v)}`

// Valor curto escrito nas barras: "118 mil", "1,06 mi".
const curto = v => v >= 1e6 ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : `${Math.round(v)}`
const LETRA = 6 // largura média de um caractere a 10 px, para saber se o rótulo cabe

// Até 4 divisões "redondas" (1, 2, 2,5 ou 5 vezes uma potência de 10) de zero ao maior pagamento.
function divisoes(max) {
  if (!(max > 0)) return [0]
  const bruto = max / 4, base = 10 ** Math.floor(Math.log10(bruto))
  const passo = [1, 2, 2.5, 5, 10].map(f => f * base).find(p => p >= bruto)
  return Array.from({ length: Math.ceil(max / passo) + 1 }, (_, i) => i * passo)
}

// Topo arredondado (4 px) e base reta, presa ao eixo.
const barra = (x, y, w, h, raio) => {
  const r = Math.min(raio, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

export default function FluxoPagamentos({ rows, inicio }) {
  const meses = useMemo(() => fluxoMensal(rows, inicio), [rows, inicio])
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const plotRef = useTocarFora(hover != null, setHover)
  const [tipRef, tipW] = useLarguraBalao(hover)
  const id = useId()
  if (!meses.length) return null

  const maior = Math.max(...meses.map(m => m.pagamento))
  const L0 = margemEixo([compacto(maior)], 52)
  const iw = width - L0 - M.r, ih = H - M.t - M.b
  const slot = iw / meses.length
  const w = Math.max(1, Math.min(28, slot * 0.7))
  // Valor de cada barra escrito nela (pedido do Fernando, 22/11/2026): o total no alto da barra (deitado se couber, senão em pé)
  // e, dentro, os juros e a amortização quando a parte comporta o texto. Sem espaço para todas, uma barra sim e outra não.
  const deitado = slot >= curto(maior).length * LETRA + 6
  const folga = deitado ? 16 : curto(maior).length * LETRA + 10
  const ticks = divisoes(maior * ih / (ih - folga))
  const topo = ticks.at(-1)
  const L = L0
  const X = i => L + slot * i + (slot - w) / 2
  const Y = v => M.t + ih - (v / topo) * ih
  const passo = Math.max(1, Math.ceil(meses.length / Math.max(2, Math.floor(iw / 56))))
  const comPagamento = meses.filter(m => m.linhas.length).map(m => m.mes - 1)
  const atual = hover != null ? meses[hover] : null
  // Barras que levam rótulo: da primeira em diante, só quando há espaço desde a última rotulada; a última sempre que couber.
  const espaco = deitado ? curto(maior).length * LETRA + 6 : 13
  const rotulados = new Set()
  for (const i of comPagamento) if (!rotulados.size || slot * (i - [...rotulados].at(-1)) >= espaco) rotulados.add(i)
  const fim = comPagamento.at(-1)
  if (!rotulados.has(fim) && slot * (fim - [...rotulados].at(-1)) >= espaco / 2) { rotulados.delete([...rotulados].at(-1)); rotulados.add(fim) }
  const totalPago = meses.reduce((t, m) => t + m.pagamento, 0), totalJuros = meses.reduce((t, m) => t + m.juros, 0)

  const onMove = e => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - box.left) * (width / box.width) - L) / slot)
    setHover(meses[i]?.linhas.length ? i : null)
  }
  const onKey = e => {
    const pos = comPagamento.indexOf(hover)
    const next = { ArrowRight: pos + 1, ArrowLeft: pos - 1, Home: 0, End: comPagamento.length - 1 }[e.key]
    if (next == null) return
    e.preventDefault()
    setHover(comPagamento[Math.min(Math.max(next, 0), comPagamento.length - 1)])
  }

  return <section className="rm fp" aria-labelledby={`${id}-t`}>
    <div className="rm-titulo-linha"><h3 id={`${id}-t`}>Fluxo de pagamentos</h3>
      <CalculatorHelp title="Fluxo de pagamentos">
        <p>Uma barra por mês da operação, contado da liberação. A altura é o valor pago no mês: em laranja, a parte de juros; em azul, a amortização. Mês sem barra não tem pagamento: no bimestral, por exemplo, há barra a cada dois meses.</p>
        <p>No alto do gráfico, o resumo: quantos pagamentos, o total pago nas barras e quanto disso é juros. Em cada barra, o valor pago no mês e, dentro dela, os juros e a amortização, em mil ou milhões de reais. Quando não há espaço para todas, os valores aparecem em barras alternadas; tocando ou passando o mouse, o balão mostra os valores exatos.</p>
        <p>Os valores são os do cronograma da simulação (Ver parcelas), com carência, pagamentos só de juros e ajustes. IOF e encargos pagos na liberação não entram nas barras.</p>
      </CalculatorHelp>
    </div>
    <ul className="fp-legenda" aria-hidden="true"><li><i className="fp-juros" />Juros</li><li><i className="fp-amort" />Amortização</li></ul>
    <div ref={ref}>
      <div ref={plotRef} className="plot" onPointerLeave={e => { if (!saidaDeToque(e)) setHover(null) }}>
        <span id={`${id}-h`} className="chart-access-text">Use as setas para percorrer os pagamentos; Home e End vão ao primeiro e ao último. A tabela completa está em Ver parcelas.</span>
        <span className="chart-access-text" role="status" aria-live="polite">{atual ? `${atual.rotulo}: pagamento ${brl(atual.pagamento)}, juros ${brl(atual.juros)}` : ''}</span>
        <ul className="fp-resumo" aria-label="Resumo do fluxo">
          <li><span>Pagamentos </span>{comPagamento.length}</li>
          <li><span>Total pago </span>{compacto(totalPago, 2)}</li>
          <li><span>Juros </span>{compacto(totalJuros, 2)} ({(totalJuros / totalPago * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</li>
        </ul>
        <svg tabIndex={0} role="img" aria-label={`Fluxo de pagamentos: ${comPagamento.length} pagamentos em ${meses.length} meses`} aria-describedby={`${id}-h`}
          viewBox={`0 0 ${width} ${H}`} width="100%" height={H} onPointerMove={onMove} onPointerDown={onMove}
          onFocus={e => { if (focoPorTeclado(e)) setHover(comPagamento[0]) }} onBlur={() => setHover(null)} onKeyDown={onKey}>
          {ticks.map(v => <g key={v}>
            <line x1={L} x2={width - M.r} y1={Y(v)} y2={Y(v)} className="gridline" />
            <text x={L - 8} y={Y(v)} dy="0.32em" textAnchor="end" className="tick">{compacto(v)}</text>
          </g>)}
          {meses.map((m, i) => (i === meses.length - 1 || (i % passo === 0 && meses.length - 1 - i >= passo)) // o último mês sempre; sem encavalar
            && <text key={m.mes} x={L + slot * (i + 0.5)} y={H - 8} textAnchor="middle" className="tick">{m.rotulo}</text>)}
          {meses.map((m, i) => {
            if (!m.linhas.length) return null
            const yTopo = Y(m.pagamento), yJuros = Y(m.pagamento - m.juros)
            const gap = w >= 4 && yJuros - yTopo >= 4 && Y(0) - yJuros >= 4 ? 2 : 0 // 2 px de fundo entre juros e amortização
            const cx = X(i) + w / 2
            // Texto em pé dentro de uma parte da barra, se couber na largura e na altura.
            const dentro = (valor, y0, y1, classe) => {
              const t = curto(valor)
              return rotulados.has(i) && w >= 12 && y1 - y0 >= t.length * LETRA + 6
                && <text className={classe} transform={`translate(${cx},${(y0 + y1) / 2}) rotate(-90)`} textAnchor="middle" dy="0.35em">{t}</text>
            }
            return <g key={m.mes} className={hover === i ? 'fp-ativa' : undefined}>
              {m.pagamento - m.juros > 0 && <path className="fp-amort" d={barra(X(i), yJuros + gap, w, Y(0) - yJuros - gap, m.juros > 0 ? 0 : 4)} />}
              {m.juros > 0 && <path className="fp-juros" d={barra(X(i), yTopo, w, yJuros - yTopo - gap, 4)} />}
              {m.juros > 0 && dentro(m.juros, yTopo, yJuros - gap, 'fp-rotulo-juros')}
              {m.pagamento - m.juros > 0 && dentro(m.pagamento - m.juros, yJuros + gap, Y(0), 'fp-rotulo-amort')}
              {rotulados.has(i) && (deitado
                ? <text className="fp-rotulo-total" x={cx} y={yTopo - 4} textAnchor="middle">{curto(m.pagamento)}</text>
                : <text className="fp-rotulo-total" transform={`translate(${cx},${yTopo - 4}) rotate(-90)`} dy="0.35em">{curto(m.pagamento)}</text>)}
            </g>
          })}
          <line x1={L} x2={width - M.r} y1={Y(0)} y2={Y(0)} className="fp-base" />
        </svg>
        {atual && <div ref={tipRef} className="tip" style={{ left: limitarBalao(L + slot * (hover + 0.5), tipW, width) }}>
          <strong>{atual.rotulo} · mês {atual.mes}</strong>
          {atual.linhas.map(row => <span key={row.number}>{row.juros ? `Pagamento ${row.number}, só juros` : `Parcela ${row.number}`}{row.fixed ? ' (ajustada)' : ''} · {dmy(row.date)}</span>)}
          <span>Pagamento: {brl(atual.pagamento)}</span>
          <span>Juros: {brl(atual.juros)}</span>
          <span>Amortização: {brl(atual.pagamento - atual.juros)}</span>
        </div>}
      </div>
    </div>
  </section>
}
