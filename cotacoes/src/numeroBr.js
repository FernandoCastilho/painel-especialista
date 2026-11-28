// Formato único dos números digitados: ao sair do campo, o valor aparece com ponto no milhar e vírgula nos
// decimais (1.234.567,89). Cada campo continua lendo o texto com o próprio leitor; o texto só muda se esse
// mesmo leitor reler o resultado com o mesmo número. Texto que o campo não entende fica como está.
// casas: 'decimal' (padrão) mostra ao menos duas casas; 'livre' não completa casas (prazos em dias, por exemplo).
const formato = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 20 })
const livre = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 })

// Leitor de taxa em texto dos motores do BNDES (LCD e TLP): vírgula vira ponto e vale o número simples.
export const lerTaxaTexto = (texto) => {
  const s = String(texto ?? '').trim().replace(',', '.')
  return /^-?(?:0|[1-9]\d*)(?:\.\d{1,12})?$/.test(s) ? Number(s) : null
}

// Número simples, sem milhar: 5,4321 ou 5.4321 (câmbios que a conta lê assim).
export const lerNumeroSimples = (texto) => {
  const t = String(texto ?? '').trim()
  return /^\d+(?:[.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : null
}

// Aceita sinal de menos na frente de um leitor que só lê números positivos.
export const comSinal = (ler) => (texto) => {
  const t = String(texto ?? '').trim().replace('\u2212', '-'), negativo = t.startsWith('-')
  const v = ler(negativo ? t.slice(1) : t)
  if (!Number.isFinite(v)) return null
  return negativo ? -v : v
}

const numero = v => (typeof v === 'number' ? v : v?.ok ? v.value : NaN)

export function formatarNumeroBr(texto, ler, { casas = 'decimal' } = {}) {
  const t = String(texto ?? '').trim()
  if (!t) return texto
  const valor = numero(ler(t))
  if (!Number.isFinite(valor)) return texto
  const saida = (casas === 'livre' ? livre : formato).format(valor).replace('−', '-')
  return Object.is(numero(ler(saida)), valor) ? saida : texto
}

// onBlur pronto para um campo: formata e devolve o novo texto pelo mesmo caminho da digitação.
export const formatarAoSair = (ler, mudar, opcoes) => (evento) => {
  const atual = evento?.target?.value
  if (typeof atual !== 'string') return
  const novo = formatarNumeroBr(atual, ler, opcoes)
  if (novo !== atual) mudar(novo)
}
