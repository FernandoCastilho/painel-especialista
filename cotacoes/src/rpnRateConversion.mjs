// Equivalência composta de taxas efetivas. Entrada e saída em percentual por período.
// Não conhece o estado da calculadora nem escreve no registrador financeiro i.
const units = ['day', 'month', 'year']
const fail = error => ({ ok: false, error })
const success = value => ({ ok: true, value: Object.is(value, -0) ? 0 : value })

export function convertEquivalentRate(input) {
  const { rate, from, to, dayBasis } = input ?? {}
  if (!units.includes(from) || !units.includes(to)) return fail('Selecione a unidade de origem e a de destino.')
  if ((from === 'day' || to === 'day') && dayBasis !== 365 && dayBasis !== 252) {
    return fail('Para converter taxas diárias, selecione 365 dias corridos ou 252 dias úteis.')
  }
  if (!Number.isFinite(rate) || rate <= -100) return fail('Informe uma taxa percentual finita maior que −100%.')
  if (from === to || rate === 0) return success(rate)

  const periods = { day: dayBasis, month: 12, year: 1 }
  const ratio = periods[from] / periods[to]
  // Preserve diferenças importantes perto de −100% e taxas pequenas perto de zero.
  const logarithm = rate < -50 ? Math.log((100 + rate) / 100) : Math.log1p(rate / 100)
  // Aqui as correções não lineares são menores do que a resolução do Number.
  // Multiplicar primeiro evita perder subnormais na passagem a taxa decimal.
  const value = Math.abs(rate) < 1e-290 ? rate * ratio : 100 * Math.expm1(ratio * logarithm)
  if (!Number.isFinite(value) || value <= -100 || value === 0) {
    return fail('A taxa equivalente excede a precisão numérica disponível.')
  }
  return success(value)
}
