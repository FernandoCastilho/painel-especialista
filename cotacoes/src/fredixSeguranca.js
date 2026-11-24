// Regras do Fredix compartilhadas pelo painel e pelo servidor intermediário.
// O painel avisa antes de enviar; o servidor repete a checagem e é quem decide.

export const FREDIX_LIMITES = { pergunta: 600, mensagens: 8, totalCaracteres: 6000 }

// CPF, CNPJ, e-mail e telefone: dados de pessoa ou cliente que não devem ir para a IA.
const PADROES_SENSIVEIS = [
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, // CPF formatado
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, // CNPJ formatado
  /(?<![\d.,])\d{11}(?![\d.,])/, // CPF ou celular com DDD, só números
  /(?<![\d.,])\d{14}(?![\d.,])/, // CNPJ só números
  /[^\s@]+@[^\s@]+\.[^\s@]{2,}/, // e-mail
  /\(?\b\d{2}\)?\s?9?\d{4}-\d{4}\b/, // telefone formatado
]

export function temDadoSensivel(texto) {
  return typeof texto === 'string' && PADROES_SENSIVEIS.some(padrao => padrao.test(texto))
}

export const AVISO_DADO_SENSIVEL = 'Não envie CPF, CNPJ, telefone, e-mail ou outro dado de cliente. Reescreva a pergunta sem esses dados.'

// Confere o histórico enviado pelo navegador: só turnos de texto, alternados, terminando na pergunta do usuário.
export function validarConversa(mensagens) {
  if (!Array.isArray(mensagens) || !mensagens.length) return 'Escreva uma pergunta.'
  if (mensagens.length > FREDIX_LIMITES.mensagens) return 'A conversa ficou longa. Comece uma nova conversa.'
  let total = 0
  for (const [i, m] of mensagens.entries()) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) return 'Mensagem vazia.'
    if (m.role !== (i % 2 === 0 ? 'user' : 'assistant')) return 'Conversa em formato inválido.'
    if (m.role === 'user' && m.content.length > FREDIX_LIMITES.pergunta) return `A pergunta deve ter até ${FREDIX_LIMITES.pergunta} caracteres.`
    if (m.role === 'user' && temDadoSensivel(m.content)) return AVISO_DADO_SENSIVEL
    total += m.content.length
  }
  if (mensagens.at(-1).role !== 'user') return 'Conversa em formato inválido.'
  if (total > FREDIX_LIMITES.totalCaracteres) return 'A conversa ficou longa. Comece uma nova conversa.'
  return ''
}
