// Faixa de prazos da curva DI x pré nas calculadoras de crédito. Só apresentação do gráfico; nenhuma conta financeira.

// Com `prazoMeses` (Capital de Giro, 22/11/2026), o fim do gráfico é o prazo total digitado; o começo segue em 12 meses,
// ou no início da curva quando o prazo é de até 12 meses.
export function faixaDaCurva(prazoMeses) {
  const propria = Number.isInteger(prazoMeses) && prazoMeses > 0
  const ate = propria ? prazoMeses : 48
  return { de: ate > 12 ? 12 : 0, ate, propria }
}

// Rótulos do eixo em meses (curva das calculadoras): passo de 1, 2, 3, 6, 12 ou 24 meses, no máximo 7 rótulos, sempre com o fim.
export function mesesDoEixo(de, ate) {
  const passo = [1, 2, 3, 6, 12, 24].find((p) => (ate - de) / p <= 6) ?? 24
  const meses = []
  for (let m = Math.ceil(de / passo) * passo; m < ate; m += passo) meses.push(m)
  if (meses.length && ate - meses.at(-1) < passo / 2) meses.pop()
  return [...meses, ate]
}
