export const LIMITE_LINK = 2000

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = value => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.`
const rowText = row => `${row.mes ?? row.number} · ${row.vencimento ?? row.date} · ${money(row.parcela ?? row.payment)}`

const optionLabel = (item, index) => `Opção ${String.fromCharCode(65 + index)} · ${(item.custo || '').toUpperCase()}`
const summary = (item, index) => [
  `${optionLabel(item, index)}: ${item.linha || 'Finame Materiais'}`,
  `Valor financiado: ${money(item.valor ?? item.liberado)}`,
  `Prazo: ${item.prazo} meses · carência: ${item.carencia} meses · juros na carência: ${item.periodicidade || 'conforme contrato'}`,
  `Amortização: ${item.amortizacao || 'SAC'} · liberação: ${item.liberacao || '—'}`,
  `CET estimado: ${pct(item.cet)} · custo total: ${money(item.total)}`,
].join('\n')

const rates = (item, index) => [
  `${optionLabel(item, index)} · custo financeiro: ${(item.custo || '').toUpperCase()} ${pct(item.custoFinanceiro)}`,
  `Taxa BNDES: ${pct(item.taxaBndes)} · spread do agente: ${pct(item.taxaAgente)} · taxa final: ${pct(item.taxa)}`,
  `TAC: ${money(item.tac)} · IOF: ${money(item.iof)}`,
].join('\n')

export const bndesEmailText = ({ result, alternatives, completo = false } = {}) => {
  const items = alternatives?.length ? alternatives : [result]
  const rows = items[0]?.parcelas || []
  const blocks = [
    'RESUMO',
    items.map(summary).join('\n\n'),
    'TAXAS E ENCARGOS',
    items.map(rates).join('\n\n'),
    'PARCELAS',
    (completo ? rows : rows.slice(0, 8)).map(rowText).join('\n'),
  ]
  if (!completo && rows.length > 8) blocks.push(`… ${rows.length - 8} parcelas restantes; o cronograma completo será copiado.`)
  blocks.push('Estimativas sujeitas à confirmação das condições contratuais. A proposta do agente financeiro prevalece.')
  return blocks.join('\n\n')
}

const mailto = (subject, body) => `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

export const bndesEmailLink = ({ result, alternatives } = {}) => {
  const items = alternatives?.length ? alternatives : [result]
  const subject = `BNDES Finame · simulação de ${money(items[0]?.valor ?? items[0]?.liberado)}.`
  const fullText = bndesEmailText({ result, alternatives, completo: true })
  const compact = bndesEmailText({ result, alternatives })
  let text = compact
  if (mailto(subject, text).length > LIMITE_LINK) {
    const aviso = 'Estimativas sujeitas à confirmação das condições contratuais. A proposta do agente financeiro prevalece.'
    const parcelas = 'PARCELAS\nCronograma completo copiado para colar no e-mail (Ctrl+V).'
    text = [compact.split('\n\nPARCELAS')[0], parcelas, aviso].join('\n\n')
    if (mailto(subject, text).length > LIMITE_LINK) {
      text = ['RESUMO', items.map(optionLabel).join(' / '), 'TAXAS E ENCARGOS\nDetalhes na cópia completa.', parcelas, aviso].join('\n\n')
    }
  }
  return { href: mailto(subject, text), text, fullText, requiresCopy: fullText !== text }
}
