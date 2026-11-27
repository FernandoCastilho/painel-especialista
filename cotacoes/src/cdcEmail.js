// E-mail do CDC em arquivo do Outlook (.eml), no padrão do BNDES (pedido de Fernando, 25/11/2026): o envelope baixa um
// rascunho já formatado, com o resumo, o cronograma e os avisos. Só apresentação: os números vêm prontos da cdcConta.
// O spread é informação interna e não vai para o cliente.
import { html, montarEml, nomeDeArquivo } from './emlOutlook.js'

const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
const dmy = iso => iso.split('-').reverse().join('/')

// Avisos da cotação (e-mail e imagem do WhatsApp).
export const AVISOS_CDC = [
  'Simulação de caráter meramente indicativo e ilustrativo, elaborada com as informações disponíveis na data de emissão.',
  'Não constitui proposta, oferta firme, promessa de contratação nem compromisso de concessão de crédito, e não gera obrigação para nenhuma das partes.',
  'A contratação depende de análise e aprovação de crédito, de cadastro, de documentação e das condições vigentes na data da contratação.',
  'Taxas, tarifas, IOF, parcelas e datas podem mudar sem aviso; prevalecem os valores do contrato assinado, inclusive o CET.',
  'Valores estimados e arredondados; não incluem seguros, tarifas ou despesas que não estejam indicados.',
  'Válida somente na data de emissão. Documento sem valor contratual.',
]

// Resumo comum ao e-mail e à imagem: [rótulo, valor].
export function cdcResumo(r, { carenciaDias, dataSimulacao }) {
  const taxaAa = ((1 + r.taxa / 100) ** 12 - 1) * 100
  return {
    parcela: brl(r.parcela),
    prazo: `${r.rows.length} parcelas mensais`,
    fatos: [
      ['Produto', 'CDC · financiamento de veículo'],
      ['Valor do bem', brl(r.valorBem)],
      ['Valor liberado', brl(r.valorLiberado)],
      ['Entrada', `${brl(r.entrada)} (${pct(r.pctEntrada * 100)})`],
      ['Prazo', `${r.rows.length} parcelas mensais`],
      ['Carência até a 1ª parcela', `${carenciaDias} dias`],
      ['Taxa de juros', `${pct(r.taxa)} a.m. (${pct(taxaAa)} a.a.)`],
      ['1ª e última parcela', `${dmy(r.primeira)} a ${dmy(r.ultima)}`],
      ['Tarifa de cadastro (financiada)', brl(r.tarifas)],
      ['IOF total (financiado)', brl(r.iof)],
      ['Valor financiado', brl(r.principal)],
      ['Total das parcelas', brl(r.paid)],
    ],
    emitido: dmy(dataSimulacao),
  }
}

const AZUL = '#0b2e63', LARANJA = '#ff6200', TINTA = '#10284c', CINZA = '#5b6b82', LINHA = '#d5dfec', FUNDO = '#f4f7fb'
const fonte = 'font-family:Segoe UI,Arial,Helvetica,sans-serif;'
const td = (c, { dir = false, forte = false, th = false, fundo = '' } = {}) => `<${th ? 'th' : 'td'} style="${fonte}padding:7px 10px;border-bottom:1px solid ${LINHA};text-align:${dir ? 'right' : 'left'};font-size:13px;color:${th ? CINZA : TINTA};font-weight:${forte ? 700 : 400};${fundo ? `background:${fundo};` : ''}">${c}</${th ? 'th' : 'td'}>`
const titulo = t => `<h3 style="${fonte}margin:24px 0 8px;font-size:15px;color:${AZUL};border-left:4px solid ${LARANJA};padding-left:8px;">${html(t)}</h3>`
const tabela = linhas => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${linhas.join('')}</table>`

export function cdcEmlConteudo({ result: r, info }) {
  const s = cdcResumo(r, info)
  const cab = ['Mês', 'Vencimento', 'Amortização', 'Juros', 'Parcela', 'Saldo']
  const linhas = [['0', dmy(info.dataSimulacao), '—', '—', '—', num(r.principal)],
    ...r.rows.map(x => [String(x.number), dmy(x.date), num(x.amortization), num(x.interest), num(x.payment), num(x.balance)])]
  const corpo = [
    `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="${fonte}padding:14px;background:${AZUL};color:#fff;border-radius:6px;"><div style="font-size:11px;color:#c9d6ee;text-transform:uppercase;letter-spacing:.04em;">Valor da parcela</div><div style="font-size:24px;font-weight:700;margin-top:4px;">${html(s.parcela)}</div><div style="font-size:12px;color:#c9d6ee;margin-top:2px;">${html(`${r.rows.length} parcelas mensais`)}</div></td></tr></table>`,
    titulo('Resumo da simulação'),
    tabela(s.fatos.map(([a, b]) => `<tr>${td(html(a))}${td(html(b), { dir: true, forte: true })}</tr>`)),
    titulo('Parcelas'),
    tabela([`<tr>${cab.map((c, k) => td(html(c), { th: true, dir: k > 1 })).join('')}</tr>`,
      ...linhas.map((l, i) => `<tr>${l.map((c, k) => td(html(c), { dir: k > 1, fundo: i % 2 ? FUNDO : '' })).join('')}</tr>`)]),
  ].join('\n')
  const htmlDoc = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="720" style="max-width:720px;width:100%;border-collapse:collapse;">
<tr><td style="${fonte}background:${AZUL};padding:18px 20px;color:#ffffff;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#c9d6ee;">Cotação indicativa</div><div style="font-size:20px;font-weight:700;margin-top:4px;">Financiamento de veículo (CDC)</div><div style="font-size:12px;color:#c9d6ee;margin-top:4px;">Simulação de ${html(s.emitido)}</div></td></tr>
<tr><td style="height:4px;background:${LARANJA};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="${fonte}padding:18px 4px 0;color:${TINTA};font-size:14px;line-height:1.5;">
<p style="margin:0 0 14px;">Olá,</p>
<p style="margin:0 0 16px;">Segue a simulação indicativa do financiamento do veículo, com as condições e as parcelas estimadas.</p>
${corpo}
${titulo('Avisos importantes')}
<ul style="${fonte}margin:0;padding-left:18px;font-size:11.5px;color:${CINZA};line-height:1.5;">${AVISOS_CDC.map(a => `<li>${html(a)}</li>`).join('')}</ul>
<p style="margin:16px 0 0;">Fico à disposição para conversar sobre as condições.</p>
</td></tr></table></td></tr></table></body></html>`
  const texto = ['Olá,', '', 'Segue a simulação indicativa do financiamento do veículo (CDC).', '',
    `Valor da parcela: ${s.parcela} (${r.rows.length} parcelas mensais)`, ...s.fatos.map(([a, b]) => `${a}: ${b}`), '',
    'PARCELAS', cab.join(' | '), ...linhas.map(l => l.join(' | ')), '', 'AVISOS IMPORTANTES', ...AVISOS_CDC.map(a => `- ${a}`)].join('\r\n')
  return { assunto: `CDC · cotação indicativa de ${brl(r.valorLiberado)} em ${r.rows.length}x`, texto, html: htmlDoc,
    nome: nomeDeArquivo(`Cotacao CDC ${brl(r.valorLiberado)} ${r.rows.length}x ${s.emitido.replaceAll('/', '-')}`) }
}

export const cdcEml = dados => { const c = cdcEmlConteudo(dados); return { nome: c.nome, conteudo: montarEml(c) } }
