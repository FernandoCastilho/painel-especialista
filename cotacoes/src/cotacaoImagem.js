// Imagem (PNG) do quadro "Resultado financeiro" + "Condições da operação" da calculadora BNDES, para colar no WhatsApp
// (pedido do Fernando em 24/11/2026). Só desenha textos que a tela já mostra, já formatados: nenhuma conta nova aqui.
const FONTE = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const COR = { fundo: '#0b1220', cartao: '#111a2b', linha: '#263247', texto: '#e8eef6', mudo: '#9aa7b8', cet: '#083965', cetBorda: '#397fb7', cetMudo: '#dceaff', ref: '#16213a', refBorda: '#5468a8' }
const W = 1180, M = 28, GAP = 20
const COL_E = Math.round((W - 2 * M - GAP) * 0.555), COL_D = W - 2 * M - GAP - COL_E
const PAD = 22

function caixa(ctx, x, y, w, h, r, fundo, borda) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
  if (fundo) { ctx.fillStyle = fundo; ctx.fill() }
  if (borda) { ctx.strokeStyle = borda; ctx.lineWidth = 1; ctx.stroke() }
}

// Escreve o texto e encolhe a fonte até caber na largura.
function texto(ctx, t, x, y, { peso = 400, tam = 15, cor = COR.texto, alinhar = 'left', max } = {}) {
  let s = tam
  ctx.font = `${peso} ${s}px ${FONTE}`
  while (max && s > 9 && ctx.measureText(t).width > max) { s -= 1; ctx.font = `${peso} ${s}px ${FONTE}` }
  ctx.fillStyle = cor; ctx.textAlign = alinhar; ctx.fillText(t, x, y); ctx.textAlign = 'left'
}

function linha(ctx, x, y, w) { ctx.fillStyle = COR.linha; ctx.fillRect(x, y, w, 1) }

// Linha rótulo/valor com nota opcional embaixo do valor. Devolve a altura usada.
function fato(ctx, x, y, w, [rotulo, valor, nota]) {
  texto(ctx, rotulo, x, y + 24, { tam: 14, cor: COR.mudo, max: w * 0.5 })
  texto(ctx, String(valor), x + w, y + 24, { peso: 700, tam: 15, alinhar: 'right', max: w * 0.5 })
  if (nota) texto(ctx, nota, x + w, y + 44, { tam: 12.5, cor: COR.mudo, alinhar: 'right', max: w * 0.5 })
  const h = nota ? 60 : 44
  linha(ctx, x, y + h, w)
  return h + 1
}

function esquerda(ctx, x0, y0, d) {
  const x = x0 + PAD, w = COL_E - 2 * PAD
  let y = y0 + PAD
  texto(ctx, 'Resultado financeiro', x, y + 22, { peso: 700, tam: 21 }); y += 44
  const bw = (w - 12) / 2, bh = 122
  caixa(ctx, x, y, bw, bh, 8, COR.cet, COR.cetBorda)
  texto(ctx, d.cet.rotulo, x + 18, y + 30, { tam: 14, cor: '#fff', max: bw - 36 })
  texto(ctx, d.cet.anual, x + 18, y + 74, { peso: 700, tam: 32, cor: '#fff', max: bw - 36 })
  if (d.cet.mensal) texto(ctx, d.cet.mensal, x + 18, y + 102, { tam: 13, cor: COR.cetMudo, max: bw - 36 })
  caixa(ctx, x + bw + 12, y, bw, bh, 8, null, COR.linha)
  texto(ctx, 'Total estimado a pagar', x + bw + 30, y + 30, { tam: 14, max: bw - 36 })
  texto(ctx, d.total, x + bw + 30, y + 74, { peso: 700, tam: 32, max: bw - 36 })
  texto(ctx, 'Principal, juros e despesas informadas', x + bw + 30, y + 102, { tam: 13, cor: COR.mudo, max: bw - 36 })
  y += bh + 6
  for (const f of d.fatos) y += fato(ctx, x, y, w, f)
  if (d.equivalencia) {
    texto(ctx, 'Equivalência em CDI', x, y + 26, { tam: 14.5 })
    texto(ctx, d.equivalencia.valor, x + w, y + 26, { peso: 700, tam: 15, alinhar: 'right' })
    if (d.equivalencia.nota) texto(ctx, d.equivalencia.nota, x, y + 48, { tam: 12.5, cor: COR.mudo, max: w })
    y += d.equivalencia.nota ? 62 : 44; linha(ctx, x, y, w); y += 1
  }
  if (d.parcelas.length) {
    texto(ctx, 'Parcelas', x, y + 38, { peso: 700, tam: 16 }); y += 54
    const pw = (w - 16) / d.parcelas.length
    d.parcelas.forEach(([rotulo, valor], i) => {
      const px = x + i * (pw + 16)
      texto(ctx, rotulo, px, y + 18, { tam: 13.5, cor: COR.mudo, max: pw })
      texto(ctx, valor, px, y + 48, { peso: 700, tam: 21, max: pw })
      linha(ctx, px, y + 64, pw)
    })
    y += 65
  }
  if (d.despesas.length) {
    texto(ctx, 'Juros e despesas', x, y + 38, { peso: 700, tam: 16 }); y += 48
    for (const f of d.despesas) y += fato(ctx, x, y, w, f)
  }
  return y + PAD
}

function direita(ctx, x0, y0, d) {
  const x = x0 + PAD, w = COL_D - 2 * PAD
  let y = y0 + PAD
  texto(ctx, 'Condições da operação', x, y + 22, { peso: 700, tam: 21 }); y += 44
  const r = d.referencia, rh = 112 + (r.serie ? 24 : 0) + (r.nota ? 46 : 0)
  caixa(ctx, x, y, w, rh, 8, COR.ref, COR.refBorda)
  let ry = y + 30
  texto(ctx, 'Indexador utilizado', x + 18, ry, { tam: 14, cor: COR.mudo }); ry += 42
  texto(ctx, r.nome, x + 18, ry, { peso: 700, tam: 34, max: w - 36 }); ry += 6
  if (r.serie) { texto(ctx, r.serie, x + 18, ry + 20, { tam: 14, cor: COR.mudo }); ry += 24 }
  texto(ctx, 'Taxa de referência', x + 18, ry + 30, { tam: 13.5 })
  texto(ctx, r.taxa, x + w - 18, ry + 30, { peso: 700, tam: 15, alinhar: 'right' }); ry += 42
  if (r.nota) { linha(ctx, x + 18, ry, w - 36); texto(ctx, r.nota, x + 18, ry + 28, { tam: 13, cor: COR.mudo, max: w - 36 }) }
  y += rh + 10
  texto(ctx, 'Dados da operação', x, y + 30, { peso: 700, tam: 16 }); y += 40
  for (const f of d.condicoes) y += fato(ctx, x, y, w, f)
  return y + PAD
}

function desenhar(ctx, d, alturaPainel) {
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, W, alturaPainel + 150)
  texto(ctx, d.titulo, M, 46, { peso: 700, tam: 24 })
  texto(ctx, d.subtitulo, M, 72, { tam: 14, cor: COR.mudo, max: W - 2 * M })
  const y0 = 92
  if (alturaPainel) {
    caixa(ctx, M, y0, COL_E, alturaPainel, 12, COR.cartao, COR.linha)
    caixa(ctx, M + COL_E + GAP, y0, COL_D, alturaPainel, 12, COR.cartao, COR.linha)
  }
  const fim = Math.max(esquerda(ctx, M, y0, d), direita(ctx, M + COL_E + GAP, y0, d)) - y0
  if (alturaPainel) texto(ctx, d.rodape, M, y0 + alturaPainel + 32, { tam: 12.5, cor: COR.mudo, max: W - 2 * M })
  return fim
}

export async function imagemCotacao(dados) {
  try { await document.fonts?.ready } catch { /* segue com a fonte do sistema */ }
  const rascunho = document.createElement('canvas').getContext('2d')
  const alturaPainel = Math.ceil(desenhar(rascunho, dados, 0))
  const H = 92 + alturaPainel + 52, S = 2
  const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S
  const ctx = cv.getContext('2d'); ctx.scale(S, S)
  desenhar(ctx, dados, alturaPainel)
  return new Promise((ok, erro) => cv.toBlob(b => (b ? ok(b) : erro(new Error('imagem'))), 'image/png'))
}
