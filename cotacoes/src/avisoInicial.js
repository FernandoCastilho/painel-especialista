// Aviso de entrada: aparece na primeira vez neste aparelho e só volta quando o texto mudar.
// O texto fica aqui para que a marca guardada seja tirada do próprio conteúdo: mudou uma palavra, a marca muda e o aviso reaparece.
export const AVISO_KEY = 'aviso-inicial-visto'
export const AVISO_RESUMO = 'Aplicativo educacional, com informação ilustrativa. Não é recomendação de crédito.'
export const AVISO_FONTES = [
  ['Quase ao vivo', 'câmbio, a cada poucos minutos em dias úteis (9h05 às 18h), sem garantia de tempo real.'],
  ['Diário', 'curvas de juros da B3, uma referência por dia útil.'],
  ['Semanal', 'Focus, às segundas.'],
  ['Manual', 'projeções dos bancos, conferidas à mão; cada uma mostra a sua data.'],
]

export const textoDoAviso = () => [AVISO_RESUMO, ...AVISO_FONTES.map(([rotulo, texto]) => `${rotulo}: ${texto}`)].join('\n')

// Marca curta e estável do texto (FNV-1a de 32 bits). Espaços a mais ou a menos não contam como mudança.
export function marcaDoAviso(texto = textoDoAviso()) {
  const limpo = String(texto ?? '').replace(/\s+/g, ' ').trim()
  let h = 0x811c9dc5
  for (let i = 0; i < limpo.length; i++) { h ^= limpo.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return `v1-${(h >>> 0).toString(16).padStart(8, '0')}`
}

// Devo mostrar o aviso? Sim se nunca foi visto neste aparelho ou se a marca guardada é de outro texto.
export const deveMostrarAviso = (marcaAtual, marcaGuardada) => !marcaGuardada || marcaGuardada !== marcaAtual

const guardado = () => { try { return globalThis.localStorage } catch { return null } }

// Sem armazenamento (bloqueado ou indisponível), o aviso aparece a cada entrada: melhor repetir a ressalva do que escondê-la.
export function avisoPendente(storage = guardado(), texto = textoDoAviso()) {
  let marca = null
  try { marca = storage?.getItem(AVISO_KEY) ?? null } catch { marca = null }
  return deveMostrarAviso(marcaDoAviso(texto), marca)
}

export function marcarAvisoVisto(storage = guardado(), texto = textoDoAviso()) {
  try { storage?.setItem(AVISO_KEY, marcaDoAviso(texto)) } catch { /* sem armazenamento: vale só para esta entrada */ }
}
