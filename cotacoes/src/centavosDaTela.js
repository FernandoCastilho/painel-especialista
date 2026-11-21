// Só apresentação, nenhuma regra de cálculo: confere se as partes de um custo, como aparecem na tela (cada uma arredondada
// a centavos), somam o total como aparece na tela. Quando a conta não arredonda no meio do caminho, pode sobrar 1 centavo.
// Devolve null quando fecha; senão, a soma das partes mostradas e a diferença (total mostrado menos essa soma), em reais.
// Os centavos saem do mesmo formatador de números da tela, para o arredondamento ser exatamente o que a pessoa vê
// (toFixed e Math.round arredondam diferente dele em valores terminados em meio centavo).
const twoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
const cents = (value) => Number(twoDecimals.format(value).replace('.', ''))

export function sobraDeCentavos(parts, total) {
  const sum = parts.reduce((acc, value) => acc + cents(value), 0)
  const diff = cents(total) - sum
  return diff === 0 ? null : { sum: sum / 100, diff: diff / 100 }
}
