// Fluxo de pagamentos do Capital de Giro em barras, mês a mês (pedido do Fernando em 22/11/2026).
// Só apresentação: agrupa as linhas do cronograma já calculado (giroConta) pelo mês contado da liberação. Nenhum valor é refeito.
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIA = 86400000
const dias = (de, ate) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA)

// Mês da operação de um vencimento: 1 = um mês depois da liberação. Pelos dias corridos, para que o vencimento
// empurrado para o próximo dia útil (ex.: 31 que vira dia 2) fique no mesmo mês da conta.
export const mesDaOperacao = (inicio, data) => Math.max(1, Math.round(dias(inicio, data) / (365.25 / 12)))

// Rótulo curto do mês da operação, a partir do mês da liberação: "dez/26".
export function rotuloDoMes(inicio, mes) {
  const [ano, m] = inicio.split('-').map(Number)
  const total = m - 1 + mes
  return `${MESES[total % 12]}/${String((ano + Math.floor(total / 12)) % 100).padStart(2, '0')}`
}

// rows: [{ number, date, payment, interest, amortization, juros, fixed }]. Devolve um item por mês, do 1º até o do último
// pagamento; mês sem pagamento (ex.: bimestral) vem com `linhas` vazio e valores zero.
export function fluxoMensal(rows, inicio) {
  if (!rows?.length || !inicio) return []
  // Um vencimento por mês, sempre depois do anterior: com o 1º período curto (ex.: liberação em 31/01 e vencimentos no dia 15),
  // o arredondamento poria dois pagamentos no mesmo mês; aqui cada um avança ao menos um mês, como no calendário.
  const porMes = new Map()
  let anterior = 0
  for (const row of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
    const mes = Math.max(anterior + 1, mesDaOperacao(inicio, row.date))
    porMes.set(mes, [...(porMes.get(mes) ?? []), row])
    anterior = mes
  }
  const ultimo = Math.max(...porMes.keys())
  return Array.from({ length: ultimo }, (_, i) => {
    const linhas = porMes.get(i + 1) ?? []
    const soma = key => linhas.reduce((total, row) => total + row[key], 0)
    return { mes: i + 1, rotulo: rotuloDoMes(inicio, i + 1), linhas, pagamento: soma('payment'), juros: soma('interest') }
  })
}
