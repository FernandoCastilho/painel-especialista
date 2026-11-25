// Imagem (PNG) da cotação de CDC para o WhatsApp (pedido de Fernando, 25/11/2026): resumo, parcela em destaque e os avisos
// de cotação indicativa. Só desenha os textos prontos de cdcResumo; nenhuma conta aqui. Sem spread (informação interna).
import { AVISOS_CDC } from './cdcEmail.js'

const FONTE = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const AZUL = '#0b2e63', LARANJA = '#ff6200', TINTA = '#10284c', CINZA = '#5b6b82', LINHA = '#d5dfec'
const W = 900, M = 32

function escrever(ctx, t, x, y, { peso = 400, tam = 16, cor = TINTA, alinhar = 'left' } = {}) {
  ctx.font = `${peso} ${tam}px ${FONTE}`; ctx.fillStyle = cor; ctx.textAlign = alinhar; ctx.fillText(t, x, y); ctx.textAlign = 'left'
}
// Quebra o texto em linhas que cabem em `largura`.
function quebrar(ctx, t, largura, fonte) {
  ctx.font = fonte
  const out = []; let atual = ''
  for (const palavra of t.split(' ')) {
    const teste = atual ? `${atual} ${palavra}` : palavra
    if (ctx.measureText(teste).width > largura && atual) { out.push(atual); atual = palavra } else atual = teste
  }
  if (atual) out.push(atual)
  return out
}

function desenhar(ctx, d) {
  const fonteAviso = `400 13px ${FONTE}`
  const avisos = AVISOS_CDC.flatMap(a => quebrar(ctx, `• ${a}`, W - 2 * M, fonteAviso))
  const H = 120 + 110 + d.fatos.length * 38 + 50 + avisos.length * 19 + 30
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = AZUL; ctx.fillRect(0, 0, W, 96)
  ctx.fillStyle = LARANJA; ctx.fillRect(0, 96, W, 5)
  escrever(ctx, 'COTAÇÃO INDICATIVA · SEM COMPROMISSO', M, 34, { tam: 13, cor: '#c9d6ee', peso: 600 })
  escrever(ctx, 'Financiamento de veículo (CDC)', M, 66, { tam: 26, cor: '#ffffff', peso: 700 })
  escrever(ctx, `Simulação de ${d.emitido}`, W - M, 66, { tam: 14, cor: '#c9d6ee', alinhar: 'right' })
  let y = 124
  ctx.fillStyle = '#eef3fa'; ctx.fillRect(M, y, W - 2 * M, 86)
  escrever(ctx, 'Valor da parcela', M + 18, y + 30, { tam: 14, cor: CINZA })
  escrever(ctx, d.parcela, M + 18, y + 68, { tam: 32, peso: 700, cor: AZUL })
  escrever(ctx, d.prazo, W - M - 18, y + 68, { tam: 15, cor: CINZA, alinhar: 'right' })
  y += 110
  for (const [a, b] of d.fatos) {
    escrever(ctx, a, M, y + 24, { tam: 15, cor: CINZA })
    escrever(ctx, b, W - M, y + 24, { tam: 15, peso: 700, alinhar: 'right' })
    ctx.fillStyle = LINHA; ctx.fillRect(M, y + 37, W - 2 * M, 1)
    y += 38
  }
  y += 30
  escrever(ctx, 'Avisos importantes', M, y, { tam: 15, peso: 700, cor: AZUL }); y += 24
  for (const l of avisos) { escrever(ctx, l, M, y, { tam: 13, cor: CINZA }); y += 19 }
  return H
}

export async function cdcImagem(dados) {
  try { await document.fonts?.ready } catch { /* fonte do sistema */ }
  const H = desenhar(document.createElement('canvas').getContext('2d'), dados)
  const S = 2, cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S
  const ctx = cv.getContext('2d'); ctx.scale(S, S)
  desenhar(ctx, dados)
  return new Promise((ok, erro) => cv.toBlob(b => (b ? ok(b) : erro(new Error('imagem'))), 'image/png'))
}
