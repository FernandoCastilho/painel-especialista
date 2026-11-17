// Apresentar: lógica da montagem, sem tela. A seleção é uma lista ordenada de blocos; cada bloco marcado vira um slide.

// Palco lógico 16:9. O slide é sempre desenhado nesse tamanho e depois ampliado ou reduzido por inteiro,
// então a miniatura da montagem e a tela cheia têm exatamente a mesma composição.
export const PALCO = { w: 1120, h: 630 }

export const escala = (largura, altura = Infinity) => {
  const k = Math.min(largura / PALCO.w, altura / PALCO.h)
  return Number.isFinite(k) && k > 0 ? k : 1
}

// Cada slide mantém viva uma peça do painel (gráfico, tabela ou calculadora). Com blocos demais o navegador pode ficar sem
// memória no meio da visita; por isso a apresentação tem um teto, bem acima do que uma visita usa.
export const LIMITE_BLOCOS = 80
export const limitar = (sel) => sel.slice(0, LIMITE_BLOCOS)

// Marca ou desmarca um bloco; o novo entra no fim, na ordem em que foi escolhido.
export const alternar = (sel, id) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id])

// Marca ou desmarca um grupo inteiro: se todos já estão marcados, tira todos; senão, acrescenta os que faltam.
export function alternarVarios(sel, ids) {
  const todos = ids.every((id) => sel.includes(id))
  return todos ? sel.filter((id) => !ids.includes(id)) : [...sel, ...ids.filter((id) => !sel.includes(id))]
}

// Sobe (-1) ou desce (+1) um slide na ordem; nas pontas, nada muda.
export function mover(sel, id, passo) {
  const i = sel.indexOf(id), j = i + passo
  if (i < 0 || j < 0 || j >= sel.length) return sel
  const out = [...sel]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

// Só o que ainda existe no catálogo (um bloco pode sair de uma versão para outra).
export const validos = (sel, ids) => sel.filter((id) => ids.has(id))

// Teclado da apresentação: devolve o novo slide, ou o mesmo quando a tecla não navega.
export function passoTecla(i, tecla, n) {
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(tecla)) return Math.min(n - 1, i + 1)
  if (['ArrowLeft', 'PageUp', 'Backspace'].includes(tecla)) return Math.max(0, i - 1)
  if (tecla === 'Home') return 0
  if (tecla === 'End') return n - 1
  return i
}

export const dataCapa = (agora = Date.now()) => new Date(agora).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
export const dataHora = (agora = Date.now()) => new Date(agora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', ' ·')

// Quantos blocos de cada grupo estão marcados (para o resumo de cada seção da montagem).
export function contarPorGrupo(sel, blocos) {
  const grupoDe = new Map(blocos.map((b) => [b.id, b.grupo]))
  const out = {}
  for (const id of sel) { const g = grupoDe.get(id); if (g) out[g] = (out[g] ?? 0) + 1 }
  return out
}

// Busca de blocos na montagem: sem acento nem maiúsculas, todas as palavras digitadas precisam aparecer no nome, no subgrupo
// ou na seção. Menos de 2 letras: sem busca (null). Devolve no máximo `limite` blocos, na ordem do catálogo.
const semAcento = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export function buscarBlocos(blocos, texto, nomeDoGrupo = (id) => id, limite = 40) {
  const palavras = semAcento(texto).split(/\s+/).filter(Boolean)
  if (palavras.join('').length < 2) return null
  return blocos.filter((b) => { const onde = semAcento(`${b.label} ${b.sub ?? ''} ${b.dica ?? ''} ${nomeDoGrupo(b.grupo)}`); return palavras.every((p) => onde.includes(p)) }).slice(0, limite)
}

// Notícias de um slide: as mais recentes primeiro, sem as que o usuário tirou, até o limite que cabe no slide.
export const chaveNoticia = (n) => n.link || n.url || `${n.title}|${n.t}`
export function noticiasDoSlide(itens, ocultas = [], limite = 6) {
  const fora = new Set(ocultas)
  return [...(itens ?? [])].filter((n) => n?.title && !fora.has(chaveNoticia(n))).sort((a, b) => (b.t ?? 0) - (a.t ?? 0)).slice(0, limite)
}

// Montagem em memória: sobrevive à troca de aba dentro da visita, some ao recarregar ou fechar o painel.
// Nada vai para o armazenamento do navegador nem sai do aparelho: o nome do cliente fica só na tela.
let memoria = { cliente: '', setor: '', sel: [], opcoes: {} }
export const lerMontagem = () => memoria
export const guardarMontagem = (m) => { memoria = m }
