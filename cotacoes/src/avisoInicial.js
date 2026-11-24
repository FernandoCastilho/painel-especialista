export const AVISO_KEY = 'aviso-inicial-visto'
export const AVISO_RESUMO = 'Aplicativo educacional, com informação ilustrativa. Não é recomendação de crédito.'
export const AVISO_FONTES = [
  ['Quase ao vivo', 'câmbio, a cada poucos minutos em dias úteis (9h05 às 18h), sem garantia de tempo real.'],
  ['Diário', 'curvas de juros da B3, uma referência por dia útil.'],
  ['Semanal', 'Focus, às segundas.'],
  ['Manual', 'projeções dos bancos, conferidas à mão; cada uma mostra a sua data.'],
]

const dataBrasilia = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})

const guardado = () => { try { return globalThis.localStorage } catch { return null } }

// Sem armazenamento, mantenha a ressalva visível em vez de suprimi-la.
export function avisoPendente(storage = guardado(), agora = new Date()) {
  try { return storage?.getItem(AVISO_KEY) !== dataBrasilia.format(agora) } catch { return true }
}

export function marcarAvisoVisto(storage = guardado(), agora = new Date()) {
  try { storage?.setItem(AVISO_KEY, dataBrasilia.format(agora)) } catch { /* vale só para esta entrada */ }
}
