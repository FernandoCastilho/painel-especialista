// E-mail do resultado do CDC, no mesmo padrão do Capital de Giro (giroEmail.js): rascunho no Outlook com Entrada, Saída e
// Parcelas. Se o cronograma inteiro não couber no endereço do rascunho, vai o resumo e o cronograma é copiado no clique.
// Só apresentação: todos os números vêm prontos da conta (cdcConta).
import { LIMITE_LINK } from './giroEmail.js'

const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = v => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dmy = iso => iso.split('-').reverse().join('/')
const line = '----------------------------------------'

// d: { result, info: { categoria, anoModelo, zeroKm, carenciaDias, inicio, cadastro, avaliacao, registro, spf, seguroAuto, socorro } }
export function cdcEmailText({ result: r, spread: sp, info: q }) {
  const entrada = [
    `Produto: CDC · ${q.categoria} · ano modelo ${q.anoModelo} · zero km: ${q.zeroKm ? 'sim' : 'não'}`,
    `Valor do bem: ${brl(r.valorBem)}`,
    `Valor liberado: ${brl(r.valorLiberado)}`,
    `Liberação: ${dmy(q.inicio)} · carência: ${q.carenciaDias} dias`,
    `Prazo: ${r.rows.length} parcelas mensais`,
    `Tarifa de cadastro: ${brl(q.cadastro)} · avaliação de bens: ${brl(q.avaliacao)} · registro de contrato: ${brl(q.registro)}`,
    `Seguro proteção financeira: ${brl(q.spf)} · seguro auto: ${brl(q.seguroAuto)} · socorro auto: ${brl(q.socorro)}`,
  ]
  const saida = [
    `Valor da parcela: ${brl(r.parcela)}`,
    `Taxa: ${pct(r.taxa / 100)} a.m.`,
    ...(sp ? [`Spread: ${pct(sp.spreadAa)} a.a. sobre funding de ${pct(sp.fundingAa)} a.a. (vigência ${q.vigenciaLabel ?? '—'})`] : []),
    `% de entrada: ${pct(r.pctEntrada)}`,
    `Coeficiente: ${r.coeficiente.toLocaleString('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`,
    `1ª parcela: ${dmy(r.primeira)} · última: ${dmy(r.ultima)}`,
    `IOF adicional: ${brl(r.iofAdicional)} · IOF sobre parcelas: ${brl(r.iofDiario)} · IOF total: ${brl(r.iof)}`,
    `Valor financiado (com tarifas, seguros e IOF): ${brl(r.principal)}`,
    `Total das parcelas: ${brl(r.paid)}`,
  ]
  const cronograma = [
    'Mês | Data pagto | Amortização | Juros | Parcela | Saldo (R$)',
    `0 | ${dmy(q.inicio)} | — | — | — | ${num(r.principal)}`,
    ...r.rows.map(x => [x.number, dmy(x.date), num(x.amortization), num(x.interest), num(x.payment), num(x.balance)].join(' | ')),
  ]
  const resumo = [
    `${r.rows.length} parcelas de ${brl(r.parcela)}, de ${dmy(r.primeira)} a ${dmy(r.ultima)}`,
    'Cronograma completo: cole aqui (Ctrl+V); se nada colar, copie de "Ver parcelas" na calculadora.',
  ]
  const montar = parcelas => [
    'Olá,',
    'Segue a simulação de CDC.',
    ['ENTRADA', line, ...entrada].join('\r\n'),
    ['SAÍDA', line, ...saida].join('\r\n'),
    ['PARCELAS', line, ...parcelas].join('\r\n'),
    'Estimativas sujeitas à confirmação das condições contratuais.',
  ].join('\r\n\r\n')
  return { subject: `CDC · simulação de ${brl(r.valorLiberado)} em ${r.rows.length}x`, body: montar(cronograma),
    bodyCurto: montar(resumo), cronograma: ['PARCELAS', line, ...cronograma].join('\r\n') }
}

const linkOutlook = (subject, body) => `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

export function cdcEmailLink(data) {
  const { subject, body, bodyCurto, cronograma } = cdcEmailText(data)
  const completo = linkOutlook(subject, body)
  return completo.length <= LIMITE_LINK ? { href: completo, copiar: null } : { href: linkOutlook(subject, bodyCurto), copiar: cronograma }
}
