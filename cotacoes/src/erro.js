// Mensagem de erro para o usuário: sem texto técnico (JSON inválido, HTTP 404, "Failed to fetch"). O detalhe original vai só no title do selo.
const U = '; mostrando o último valor conhecido, se houver'
export function mensagemErro(e) {
  const t = String(e?.message ?? e ?? '')
  if (!t) return `Sem resposta agora${U}`
  if (/Unexpected token|is not valid JSON|<!doctype|JSON/i.test(t)) return `Esses dados ainda não foram publicados ou vieram num formato inesperado${U}`
  if (/\b404\b/.test(t)) return `Esses dados ainda não foram publicados${U}`
  if (/\b5\d\d\b/.test(t)) return `A fonte das cotações está fora do ar agora${U}`
  if (/Failed to fetch|NetworkError|Load failed|timeout|abort|offline/i.test(t)) return `Sem conexão com as cotações agora${U}`
  return `Não consegui atualizar agora${U}`
}
