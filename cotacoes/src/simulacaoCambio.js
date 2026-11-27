// Efeito em reais de um trecho do gráfico de câmbio sobre um valor em moeda estrangeira.
// Conta simples, para referência: valor × (cotação final − cotação inicial), pela própria
// cotação do gráfico. Não inclui spread, IOF nem tarifas.

// Lê um valor digitado em pt-BR: "500.000", "500000", "1.250.000,50", "500 mil", "1,5 mi", "US$ 500.000".
export function lerValor(texto) {
  if (typeof texto !== 'string' || /[-−–(]/.test(texto)) return null // valor negativo não faz sentido aqui
  let s = texto.toLowerCase().replace(/\s+/g, ' ').trim()
  let mult = 1
  const suf = s.match(/\s*(mil|mi|milh[ãa]o|milh[õo]es|bi|bilh[ãa]o|bilh[õo]es)\.?$/)
  if (suf) {
    mult = suf[1] === 'mil' ? 1e3 : suf[1].startsWith('b') ? 1e9 : 1e6
    s = s.slice(0, suf.index)
  }
  s = s.replace(/^[^\d,.-]+/, '').trim()
  if (!/^\d[\d.,]*$/.test(s)) return null
  let n
  if (s.includes(',')) {
    if (s.split(',').length > 2 || /,.*\./.test(s)) return null
    if (mult === 1 && /^\d{1,3}(,\d{3})+$/.test(s)) return null // "500,000": ambíguo (milhar no padrão americano?), melhor recusar
    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s) && !/^\d+(,\d+)?$/.test(s)) return null
    n = Number(s.replace(/\./g, '').replace(',', '.'))
  } else if (s.includes('.')) {
    // sem vírgula: pontos em grupos de três dígitos são de milhar (500.000); um ponto solto é decimal (1.5 mi)
    n = /^[1-9]\d{0,2}(\.\d{3})+$/.test(s) ? Number(s.replace(/\./g, '')) : /^\d+\.\d+$/.test(s) ? Number(s) : NaN
  } else n = Number(s)
  const v = Math.round(n * mult * 100) / 100
  return Number.isFinite(v) && v > 0 ? v : null
}

const centavos = (v) => Math.round(v * 100) / 100

// lado: 'pagar' (vou comprar a moeda para pagar) ou 'receber' (vou vender a moeda recebida).
export function simular({ valor, v0, v1, lado = 'pagar' }) {
  if (!(valor > 0) || !(v0 > 0) || !(v1 > 0) || (lado !== 'pagar' && lado !== 'receber')) return null
  const r0 = centavos(valor * v0), r1 = centavos(valor * v1)
  const dif = centavos(r1 - r0)
  const pagar = lado !== 'receber'
  const efeito = dif === 0 ? 'igual' : pagar ? (dif > 0 ? 'custo' : 'economia') : (dif > 0 ? 'ganho' : 'perda')
  return { r0, r1, dif, pct: (v1 / v0 - 1) * 100, efeito, favoravel: efeito === 'economia' || efeito === 'ganho', lado: pagar ? 'pagar' : 'receber' }
}

const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function frase(s) {
  if (!s) return ''
  const v = reais(Math.abs(s.dif))
  return {
    custo: `você pagaria ${v} a mais`,
    economia: `você pagaria ${v} a menos`,
    ganho: `você receberia ${v} a mais`,
    perda: `você receberia ${v} a menos`,
    igual: s.lado === 'pagar' ? 'você pagaria o mesmo valor em reais' : 'você receberia o mesmo valor em reais',
  }[s.efeito]
}

export function moeda(valor, code) {
  try { return valor.toLocaleString('pt-BR', { style: 'currency', currency: code, maximumFractionDigits: 2 }) }
  catch { return `${code} ${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` }
}

export { reais }
