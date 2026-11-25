// E-mail executivo da Necessidade do Cliente em arquivo do Outlook (.eml), no padrão do BNDES (pedido do Fernando, 23/11/2026).
// Substitui o rascunho por endereço, que com 5 operações já passava de 2.900 caracteres e corria o risco do erro do Outlook
// ("AADSTS90015: Requested query string is too long"). Só apresentação: os números vêm prontos das contas de cada modalidade.
import { html, montarEml, nomeDeArquivo } from './emlOutlook.js'

const brl = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = v => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : 'Não mensurável'
const dmy = iso => /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('/') : (iso || '—')
const nome = (r, i, varias) => `${varias ? `${i + 1}. ` : ''}${String(r.label || 'Operação').replace(/\s+/g, ' ').trim()}`

const AZUL = '#0b2e63', LARANJA = '#ff6200', TINTA = '#10284c', CINZA = '#5b6b82', LINHA = '#d5dfec', FUNDO = '#f4f7fb'
const fonte = 'font-family:Segoe UI,Arial,Helvetica,sans-serif;'
const celula = (conteudo, { th = false, dir = false, forte = false, fundo = '' } = {}) =>
  `<${th ? 'th' : 'td'} style="${fonte}padding:7px 10px;border-bottom:1px solid ${LINHA};text-align:${dir ? 'right' : 'left'};vertical-align:top;font-size:13px;color:${th ? CINZA : TINTA};${forte ? 'font-weight:700;' : 'font-weight:400;'}${fundo ? `background:${fundo};` : ''}">${conteudo}</${th ? 'th' : 'td'}>`
const titulo = texto => `<h3 style="${fonte}margin:24px 0 8px;font-size:15px;color:${AZUL};border-left:4px solid ${LARANJA};padding-left:8px;">${html(texto)}</h3>`
const tabela = (cabecalho, linhas) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${cabecalho ? `<tr>${cabecalho}</tr>` : ''}${linhas.join('')}</table>`

// results: as operações calculadas da tela (só as válidas); contexto: { equivalent, scenario, cdi, complete, prazo, liberacao }.
export function creditEmlConteudo({ results, contexto = {}, emitidoEm = new Date() }) {
  const varias = results.length > 1
  const ctx = contexto
  const assunto = varias ? `Comparação de crédito · ${results.length} operações · ${brl(results[0].value)}` : `Cotação de crédito · ${nome(results[0], 0, false)} · ${brl(results[0].value)}`
  const cab = rotulo => celula(html(rotulo), { th: true }) + results.map((r, i) => celula(html(nome(r, i, varias)), { th: true, dir: true })).join('')
  const linha = (rotulo, valor, opts = {}) => `<tr>${celula(html(rotulo))}${results.map(r => celula(html(valor(r)), { dir: true, ...opts })).join('')}</tr>`
  // Pós-fixado: o CET é só a parte fixa (regra do BC), como diz a tela; o e-mail precisa dizer o mesmo.
  const cetDe = r => r.cet === null || r.cet === undefined ? 'Não mensurável' : `${pct(r.cet * 100)} a.a.${/parte fixa/i.test(r.cetLabel || '') ? ' (parte fixa, regra do BC)' : ''}`
  const flutuante = results.some(r => r.floating && Number.isFinite(r.projectedCost))

  // Leitura: o menor custo sobre o valor líquido, como no quadro do resultado da tela.
  const menor = varias ? results.reduce((a, r, i) => (r.cost < results[a].cost ? i : a), 0) : null
  const leitura = menor === null ? '' : `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:4px 0 0;"><tr><td style="${fonte}background:${AZUL};color:#ffffff;padding:14px 16px;border-radius:6px;"><div style="font-size:11px;color:#c9d6ee;text-transform:uppercase;letter-spacing:.04em;">Menor custo sobre o valor líquido</div><div style="font-size:18px;font-weight:700;margin-top:4px;">${html(nome(results[menor], menor, true))}</div><div style="font-size:13px;color:#c9d6ee;margin-top:2px;">${html(brl(results[menor].cost))} de custo</div></td></tr></table>`

  const comparacao = tabela(cab('Indicador'), [
    linha('Taxa / indexador', r => r.rateLabel || '—'),
    linha(varias ? 'CET estimado' : 'CET estimado', cetDe, { forte: true }),
    ...(flutuante ? [linha('Custo com CDI projetado (não é CET)', r => r.floating && Number.isFinite(r.projectedCost) ? `${pct(r.projectedCost * 100)} a.a.` : '—')] : []),
    linha('Valor contratado', r => brl(r.value)),
    linha('Valor líquido recebido', r => brl(r.net)),
    linha('Primeiro pagamento', r => brl(r.firstPayment ?? r.rows?.[0]?.payment)),
    linha('Maior pagamento', r => brl(r.maxPayment)),
    linha('Juros totais', r => brl(r.interest)),
    linha('IOF', r => brl(r.iof)),
    linha('Custo sobre o valor líquido', r => brl(r.cost), { forte: true }),
    linha('Total desembolsado', r => brl(r.total), { forte: true }),
    linha('Sistema e pagamentos', r => r.systemLabel || '—'),
    linha('Último vencimento', r => dmy(r.lastDate)),
  ])

  // Cronograma de cada operação: número, vencimento, juros, amortização, pagamento e saldo.
  const cronogramas = results.map((r, i) => {
    const rows = (r.rows || []).filter(p => p.payment > 0)
    if (!rows.length) return ''
    const cabC = ['Nº', 'Vencimento', 'Juros', 'Amortização', 'Pagamento', 'Saldo'].map((t, k) => celula(t, { th: true, dir: k > 1 })).join('')
    const corpo = rows.map((p, k) => { const f = k % 2 ? FUNDO : ''; const amort = Number.isFinite(p.amortization) ? p.amortization : p.payment - (p.interest || 0)
      return `<tr>${celula(String(p.number ?? k + 1), { fundo: f })}${celula(dmy(p.date), { fundo: f })}${[p.interest, amort, p.payment, p.balance].map((v, j) => celula(Number.isFinite(v) ? brl(v) : '—', { dir: true, forte: j === 2, fundo: f })).join('')}</tr>` })
    const total = `<tr>${celula('Total', { forte: true })}${celula(`${rows.length} pagamentos`)}${celula('')}${celula('')}${celula(brl(rows.reduce((t, p) => t + p.payment, 0)), { dir: true, forte: true })}${celula('')}</tr>`
    return titulo(`Cronograma · ${nome(r, i, varias)}`) + tabela(cabC, [...corpo, total])
  }).join('')

  const notas = [
    ctx.equivalent ? (varias ? 'Comparação pelo mesmo valor líquido.' : 'Simulação pelo valor líquido desejado.') : 'Simulação nas condições informadas.',
    ...(results.some(r => r.modality === 'giro-cdi' || (r.modality === 'outra' && r.floating)) && Number.isFinite(ctx.cdi) ? [`Cenário do CDI ${ctx.scenario || ''}: ${pct(ctx.cdi)} a.a., constante; o indexador pode variar.`] : []),
    'CET estimado do fluxo informado, não CET certificado do contrato.',
    ctx.complete ? 'Estimativas sujeitas à confirmação das condições contratuais.' : 'Simulação preliminar. Encargos e condições contratuais sujeitos à confirmação.',
  ]
  const emitido = emitidoEm.toLocaleDateString('pt-BR')
  const corpoHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="${varias ? 760 : 680}" style="max-width:${varias ? 760 : 680}px;width:100%;border-collapse:collapse;">
<tr><td style="${fonte}background:${AZUL};padding:18px 20px;color:#ffffff;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#c9d6ee;">${varias ? 'Comparação de crédito' : 'Cotação de crédito'}</div><div style="font-size:20px;font-weight:700;margin-top:4px;">${html(varias ? `${results.length} operações · ${brl(results[0].value)}` : nome(results[0], 0, false))}</div><div style="font-size:12px;color:#c9d6ee;margin-top:4px;">Emitida em ${html(emitido)}</div></td></tr>
<tr><td style="height:4px;background:${LARANJA};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="${fonte}padding:18px 4px 0;color:${TINTA};font-size:14px;line-height:1.5;">
<p style="margin:0 0 14px;">Olá,</p>
<p style="margin:0 0 16px;">Segue ${varias ? 'a comparação das operações de crédito' : 'a cotação de crédito'}, com as condições, os custos e o cronograma estimado de pagamentos.</p>
${leitura}
${titulo(varias ? 'Comparação das operações' : 'Condições e custos')}${comparacao}
${cronogramas}
<p style="${fonte}margin:22px 0 0;font-size:11px;color:${CINZA};line-height:1.5;">${notas.map(html).join(' ')}</p>
<p style="margin:16px 0 0;">Fico à disposição para conversar sobre as condições.</p>
</td></tr></table></td></tr></table></body></html>`

  const texto = [
    'Olá,', '', `Segue ${varias ? 'a comparação das operações de crédito' : 'a cotação de crédito'}.`, '',
    ...results.map((r, i) => `${nome(r, i, varias)}: contratado ${brl(r.value)}, líquido ${brl(r.net)}, CET ${cetDe(r)}, custo ${brl(r.cost)}, total ${brl(r.total)}.`),
    ...(menor === null ? [] : ['', `Menor custo sobre o valor líquido: ${nome(results[menor], menor, true)} (${brl(results[menor].cost)}).`]),
    '', ...notas,
  ].join('\r\n')
  return { assunto, html: corpoHtml, texto, nome: nomeDeArquivo(`${varias ? 'Comparacao de credito' : 'Cotacao de credito'} - ${brl(results[0].value)} - ${emitido.replace(/\//g, '-')}`) }
}

export const creditEml = dados => { const c = creditEmlConteudo(dados); return { nome: c.nome, conteudo: montarEml(c) } }
