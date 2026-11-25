// Parcelas do giro no formato do quadro Fluxo de pagamentos (24/11/2026). Na carência não há parcela: os juros são
// incorporados ao saldo e o mês fica de fora. Só apresentação.
export const linhasDoFluxoAlongamento = months => months.filter(m => m.installment > 0)
  .map((m, i) => ({ number: i + 1, date: m.date, payment: m.installment, interest: m.loanInterest, amortization: m.amortization, juros: false, fixed: false }))
// Prazo do giro em meses (carência + parcelas), para a curva terminar nele. Vazio enquanto não há parcelas válidas.
export const prazoDoGiro = (n, carencia) => { const total = Number(n) + (Number(carencia) || 0); return Number.isInteger(total) && Number(n) > 0 ? total : undefined }
