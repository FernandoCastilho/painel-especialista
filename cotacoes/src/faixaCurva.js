// Faixa de prazos da curva DI x pré nas calculadoras de crédito. Só apresentação do gráfico; nenhuma conta financeira.

// Regra do Fernando (23/11/2026): em todas as calculadoras, o gráfico termina no prazo da operação digitado ("se é 48, é 48;
// se é 12, é 12"). Com `prazoMeses`, o fim do gráfico é esse prazo; o começo segue em 12 meses,
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

// Prazo em dias (Conta Garantida, títulos do desconto) em meses do gráfico, arredondado para cima; no mínimo 1 mês.
export const mesesDoPrazoEmDias = dias => Number.isFinite(dias) && dias > 0 ? Math.max(1, Math.ceil(dias / 30)) : undefined
