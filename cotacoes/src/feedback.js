export const FEEDBACK_TYPES = ['Sugestão', 'Dica', 'Problema']
export const FEEDBACK_LIMITS = { message: 4000, name: 100, email: 254 }
export const EMPTY_FEEDBACK = { type: 'Sugestão', message: '', name: '', email: '', website: '' }

// Only a verified public form ID belongs in the client. Never put account credentials here.
export function feedbackEndpoint(config) {
  return config?.verified === true && /^[a-zA-Z0-9]{6,32}$/.test(config?.formId ?? '')
    ? `https://formspree.io/f/${config.formId}` : null
}

export function validateFeedback(values) {
  if (!FEEDBACK_TYPES.includes(values?.type)) return 'Escolha sugestão, dica ou problema.'
  if (typeof values?.message !== 'string' || !values.message.trim()) return 'Escreva sua mensagem antes de enviar.'
  if (values.message.length > FEEDBACK_LIMITS.message) return 'A mensagem deve ter até 4.000 caracteres.'
  if (typeof values.name !== 'string' || values.name.length > FEEDBACK_LIMITS.name) return 'O nome deve ter até 100 caracteres.'
  if (typeof values.email !== 'string' || values.email.length > FEEDBACK_LIMITS.email || (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))) return 'Confira o e-mail ou deixe esse campo em branco.'
  return ''
}

export async function sendFeedback(config, values, { fetcher = fetch, signal } = {}) {
  const endpoint = feedbackEndpoint(config)
  if (!endpoint) throw new Error('O envio de sugestões ainda não foi ativado. Sua mensagem continua nesta janela.')
  const error = validateFeedback(values)
  if (error) throw new Error(error)
  if (values.website) throw new Error('Não foi possível enviar a mensagem. Revise o formulário.')
  const response = await fetcher(endpoint, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assunto: `[Painel do Especialista] ${values.type}`, tipo: values.type,
      message: values.message.trim(), ...(values.name.trim() && { name: values.name.trim() }),
      ...(values.email.trim() && { email: values.email.trim() }), _gotcha: '',
    }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || result?.ok !== true) {
    if (response.status === 429) throw new Error('O serviço atingiu o limite de envios. Sua mensagem foi preservada; tente mais tarde.')
    throw new Error('O serviço não confirmou o recebimento. Sua mensagem foi preservada. Aguarde antes de tentar novamente para evitar duplicidade.')
  }
  return true
}
