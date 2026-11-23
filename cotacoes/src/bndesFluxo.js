// Adaptador de apresentação: o cronograma do BNDES continua sendo a fonte dos valores.
export const linhasDoFluxoBndes = (parcelas = []) => parcelas
  .filter(p => p.parcela > 0 && p.vencimento)
  .map((p, i) => ({
    number: i + 1,
    date: p.vencimento,
    payment: p.parcela,
    interest: p.juros,
    amortization: p.parcela - p.juros,
    juros: !!p.carencia,
    fixed: false,
  }))
