// Versão nova publicada com o painel aberto: o pedaço de código de uma tela ainda não visitada
// deixa de existir no servidor e o download falha. A saída é recarregar a página uma única vez.

// Mensagens do Chrome, do Firefox e do Safari para falha ao baixar o código de uma tela,
// mais a do Vite quando falha o estilo (CSS) que acompanha a tela.
const MENSAGENS = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

export const ehErroDeCarregamentoDeModulo = (erro) => {
  const texto = typeof erro === 'string' ? erro : `${erro?.name ?? ''} ${erro?.message ?? ''}`
  return MENSAGENS.test(texto)
}

export const CHAVE_RECARGA = 'painel-recarga-versao'
// Se falhar de novo dentro desta janela, não recarrega outra vez (evita laço, por exemplo sem internet).
export const JANELA_RECARGA_MS = 5 * 60 * 1000

// Recarrega só se não houver marca recente de recarregamento por este motivo.
export const deveRecarregar = (marca, agora, janela = JANELA_RECARGA_MS) => {
  if (marca === null || marca === undefined || marca === '') return true
  const quando = Number(marca)
  if (!Number.isFinite(quando)) return false // marca ilegível: caminho seguro é não recarregar
  return agora - quando >= janela
}

let emCurso = false

// Recarrega a página uma vez, mantendo o endereço (o # da tela não muda ao recarregar).
// Devolve true se o recarregamento foi disparado. Sem conseguir gravar a marca, não recarrega:
// sem a marca não haveria proteção contra laço.
export const recarregarUmaVez = ({ storage, agora = Date.now(), recarregar } = {}) => {
  if (emCurso) return true
  try {
    const guarda = storage ?? window.sessionStorage
    if (!deveRecarregar(guarda.getItem(CHAVE_RECARGA), agora)) return false
    guarda.setItem(CHAVE_RECARGA, String(agora))
    if (guarda.getItem(CHAVE_RECARGA) !== String(agora)) return false
    emCurso = true
    ;(recarregar ?? (() => window.location.reload()))()
    return true
  } catch { return false }
}

// Só para os testes.
export const reiniciarRecargaParaTeste = () => { emCurso = false }
