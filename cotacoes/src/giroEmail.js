// E-mail do resultado do Capital de Giro (21/11/2026), no mesmo padrão do envelope da Necessidade do Cliente: abre um
// rascunho no Outlook com assunto e corpo em texto. Três blocos, nesta ordem: Resumo, Taxas e encargos, Parcelas.
// Só apresentação: todos os números vêm prontos da conta (giroConta).
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rate = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`
const dmy = iso => iso.split('-').reverse().join('/')
const months = m => `${m} ${m === 1 ? 'mês' : 'meses'}`

// d: { result, request: { term, grace, start, systemLabel, periodLabel, paymentLabel, graceInterest, rate, unit, profileLabel,
//   charges: [{ label, value, timing, note }] } }
export function giroEmailText({ result, request }) {
  const r = result, q = request
  const line = '----------------------------------------'
  const monthly = q.unit === 'am' ? q.rate : (Math.pow(1 + q.rate / 100, 1 / 12) - 1) * 100
  const annual = q.unit === 'aa' ? q.rate : (Math.pow(1 + q.rate / 100, 12) - 1) * 100
  const bullet = r.system === 'bullet'
  const grace = bullet ? 'Não se aplica (pagamento único)' : q.grace > 0
    ? `${months(q.grace)}, ${q.graceInterest ? 'com juros pagos na carência' : 'com juros somados ao saldo'}` : 'Sem carência'
  const resumo = [
    `Valor solicitado: ${brl(r.value)}`,
    `Prazo: ${months(q.term)}`,
    `Carência: ${grace}`,
    `Periodicidade: ${q.periodLabel}`,
    `Amortização: ${q.systemLabel}`,
    `Liberação: ${dmy(q.start)}`,
    `Quanto entra no caixa: ${brl(r.net)}`,
    `${q.paymentLabel}: ${brl(bullet ? r.rows.at(-1).payment : r.installment)}`,
    `Total pago: ${brl(r.total)}`,
    `Custo total: ${brl(r.cost)}`,
    `CET: ${rate(r.cet * 100)} a.a.`,
    ...(r.earlyEnd ? [`Quitação antecipada pelos ajustes: parcela ${r.earlyEnd.number}, em ${dmy(r.earlyEnd.date)}`] : []),
  ]
  const taxas = [
    `Taxa de juros: ${rate(monthly)} a.m. (${rate(annual)} a.a.), prefixada`,
    ...q.charges.map(c => `${c.label}: ${brl(c.value)}${c.note ? ` (${c.note})` : ''} · ${c.timing}`),
    `Perfil tributário: ${q.profileLabel}`,
  ]
  const parcelas = [
    'Nº | Vencimento | Amortização | Juros | Pagamento | Saldo (R$)',
    ...r.rows.map(row => [`${row.number}${row.juros ? ' (só juros)' : ''}${row.fixed ? ' (ajustada)' : ''}`, dmy(row.date),
      num(row.amortization), num(row.interest), num(row.payment), num(row.balance)].join(' | ')),
    `Total das parcelas: ${brl(r.paid)}`,
  ]
  const body = [
    'Olá,',
    'Segue a simulação de Capital de Giro.',
    ['RESUMO', line, ...resumo].join('\r\n'),
    ['TAXAS E ENCARGOS', line, ...taxas].join('\r\n'),
    [`PARCELAS${r.rows.some(row => row.fixed) ? ' (com ajustes)' : ''}`, line, ...parcelas].join('\r\n'),
    'Estimativas sujeitas à confirmação das condições contratuais.',
  ].join('\r\n\r\n')
  return { subject: `Capital de Giro · simulação de ${brl(r.value)}`, body }
}

export function giroEmailLink(data) {
  const { subject, body } = giroEmailText(data)
  return `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
