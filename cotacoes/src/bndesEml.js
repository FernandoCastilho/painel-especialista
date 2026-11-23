// E-mail executivo do BNDES Finame em arquivo do Outlook (.eml), pedido do Fernando em 23/11/2026.
// Só apresentação: todos os números vêm prontos do cálculo da tela (cada alternativa já calculada).
import { html, montarEml, nomeDeArquivo } from './emlOutlook.js'

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const taxa = v => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% a.a.` : '—'
const dmy = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('/') : (iso || '—')
const meses = n => `${n} ${n === 1 ? 'mês' : 'meses'}`
const opcao = (item, i, varias) => varias ? `Opção ${String.fromCharCode(65 + i)} · ${String(item.custo || '').toUpperCase()}` : String(item.custo || '').toUpperCase()

// Cores do painel: azul-marinho, laranja e cinzas neutros. Estilos em linha, que é o que o Outlook respeita.
const AZUL = '#0b2e63', LARANJA = '#ff6200', TINTA = '#10284c', CINZA = '#5b6b82', LINHA = '#d5dfec', FUNDO = '#f4f7fb'
const fonte = 'font-family:Segoe UI,Arial,Helvetica,sans-serif;'
const celula = (conteudo, { th = false, dir = false, forte = false, fundo = '' } = {}) =>
  `<${th ? 'th' : 'td'} style="${fonte}padding:7px 10px;border-bottom:1px solid ${LINHA};text-align:${dir ? 'right' : 'left'};font-size:13px;color:${th ? CINZA : TINTA};${forte ? 'font-weight:700;' : 'font-weight:400;'}${fundo ? `background:${fundo};` : ''}">${conteudo}</${th ? 'th' : 'td'}>`
const titulo = texto => `<h3 style="${fonte}margin:24px 0 8px;font-size:15px;color:${AZUL};border-left:4px solid ${LARANJA};padding-left:8px;">${html(texto)}</h3>`
const tabela = (cabecalho, linhas) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${cabecalho ? `<tr>${cabecalho}</tr>` : ''}${linhas.join('')}</table>`

// itens: as alternativas da tela (1 ou mais), cada uma com o cronograma em `parcelas`.
export function bndesEmlConteudo({ itens, linha = 'Finame Materiais Industrializados', emitidoEm = new Date() }) {
  const varias = itens.length > 1
  const a = itens[0]
  const assunto = `BNDES Finame · simulação de ${brl(a.valor)} · ${meses(a.prazo)}`
  const cab = rotulo => celula(html(rotulo), { th: true }) + itens.map((item, i) => celula(html(opcao(item, i, varias)), { th: true, dir: true })).join('')
  const linhaDe = (rotulo, valor, opts = {}) => `<tr>${celula(html(rotulo))}${itens.map(item => celula(html(valor(item)), { dir: true, ...opts })).join('')}</tr>`

  // Destaques: o que o cliente quer saber primeiro.
  const destaques = [['Valor financiado', brl(a.valor)], ['CET estimado', taxa(a.cet)], ['Total estimado a pagar', brl(a.total)], ['1ª parcela após a carência', brl(a.primeiraParcela)]]
  const cartoes = varias ? '' : `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px;"><tr>${destaques.map(([r, v], i) =>
    `<td style="${fonte}width:25%;padding:12px;border:1px solid ${LINHA};border-radius:6px;background:${i === 1 ? AZUL : '#ffffff'};"><div style="font-size:11px;color:${i === 1 ? '#c9d6ee' : CINZA};text-transform:uppercase;letter-spacing:.04em;">${html(r)}</div><div style="font-size:18px;font-weight:700;color:${i === 1 ? '#ffffff' : TINTA};margin-top:4px;">${html(v)}</div></td>`).join('')}</tr></table>`

  const condicoes = tabela(varias ? cab('Condição') : '', [
    linhaDe('Linha', () => linha),
    linhaDe('Prazo total', item => meses(item.prazo)),
    linhaDe('Carência', item => meses(item.carencia)),
    linhaDe('Juros na carência', item => item.periodicidade || '—'),
    linhaDe('Amortização', item => String(item.amortizacao || 'SAC').toUpperCase()),
    linhaDe('Liberação', item => item.liberacao || '—'),
    ...(varias ? [linhaDe('CET estimado', item => taxa(item.cet), { forte: true }), linhaDe('Total estimado a pagar', item => brl(item.total), { forte: true }), linhaDe('1ª parcela após a carência', item => brl(item.primeiraParcela))] : []),
  ])
  const taxas = tabela(varias ? cab('Taxa ou encargo') : '', [
    linhaDe('Custo financeiro', item => `${String(item.custo || '').toUpperCase()} · ${taxa(item.custoFinanceiro)}`),
    linhaDe('Taxa BNDES', item => taxa(item.taxaBndes)),
    linhaDe('Spread do agente financeiro', item => taxa(item.taxaAgente)),
    linhaDe('Taxa final', item => taxa(item.taxa), { forte: true }),
    linhaDe('TAC (à vista, na liberação)', item => brl(item.tac)),
    linhaDe('IOF', item => brl(item.iof)),
    // Garantia FGI (ECG): entra no total quando a garantia está marcada; sem a linha, quem lê não fecha a conta.
    ...(itens.some(item => item.fgi?.ecg > 0) ? [linhaDe('Garantia FGI · ECG', item => item.fgi?.ecg > 0 ? `${brl(item.fgi.ecg)}${item.fgi.incorporar ? ' (no saldo)' : ' (à vista)'}` : '—')] : []),
    linhaDe('Juros totais', item => brl(item.juros)),
  ])

  // Cronograma: só os meses com pagamento. Com comparação, as parcelas das demais opções ao lado, pela data.
  const pagas = item => (item.parcelas || []).filter(p => p.parcela > 0)
  const datas = [...new Set(itens.flatMap(item => pagas(item).map(p => p.vencimento)))].filter(Boolean).sort()
  const naData = (item, data) => pagas(item).find(p => p.vencimento === data)
  const cabCron = varias
    ? celula('Vencimento', { th: true }) + itens.map((item, i) => celula(html(`Parcela · ${opcao(item, i, true)}`), { th: true, dir: true })).join('')
    : ['Nº', 'Vencimento', 'Juros', 'Amortização', 'Parcela', 'Saldo'].map((r, i) => celula(r, { th: true, dir: i > 1 })).join('')
  const linhasCron = varias
    ? datas.map((data, k) => `<tr>${celula(dmy(data), { fundo: k % 2 ? FUNDO : '' })}${itens.map(item => { const p = naData(item, data); return celula(p ? brl(p.parcela) : '—', { dir: true, fundo: k % 2 ? FUNDO : '' }) }).join('')}</tr>`)
    : pagas(a).map((p, k) => { const f = k % 2 ? FUNDO : ''; return `<tr>${celula(`${k + 1}${p.carencia ? ' · só juros' : ''}`, { fundo: f })}${celula(dmy(p.vencimento), { fundo: f })}${[p.juros, p.parcela - p.juros, p.parcela, p.saldo].map((v, j) => celula(brl(v), { dir: true, forte: j === 2, fundo: f })).join('')}</tr>` })
  const totalCron = varias
    ? `<tr>${celula('Total', { forte: true })}${itens.map(item => celula(brl(pagas(item).reduce((t, p) => t + p.parcela, 0)), { dir: true, forte: true })).join('')}</tr>`
    : `<tr>${celula('Total', { forte: true })}${celula(`${pagas(a).length} pagamentos`)}${[pagas(a).reduce((t, p) => t + p.juros, 0), pagas(a).reduce((t, p) => t + p.parcela - p.juros, 0), pagas(a).reduce((t, p) => t + p.parcela, 0)].map(v => celula(brl(v), { dir: true, forte: true })).join('')}${celula('')}</tr>`

  const emitido = emitidoEm.toLocaleDateString('pt-BR')
  const corpoHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;"><tr><td align="center" style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="680" style="max-width:680px;width:100%;border-collapse:collapse;">
<tr><td style="${fonte}background:${AZUL};padding:18px 20px;color:#ffffff;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#c9d6ee;">Simulação de financiamento</div><div style="font-size:20px;font-weight:700;margin-top:4px;">BNDES Finame · ${html(linha)}</div><div style="font-size:12px;color:#c9d6ee;margin-top:4px;">Emitida em ${html(emitido)}</div></td></tr>
<tr><td style="height:4px;background:${LARANJA};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="${fonte}padding:18px 4px 0;color:${TINTA};font-size:14px;line-height:1.5;">
<p style="margin:0 0 14px;">Olá,</p>
<p style="margin:0 0 16px;">Segue a simulação do financiamento BNDES Finame${varias ? ', com as alternativas de custo lado a lado' : ''}, com as condições, as taxas e o cronograma estimado de pagamentos.</p>
${cartoes}
${titulo('Condições da operação')}${condicoes}
${titulo('Taxas e encargos')}${taxas}
${titulo('Cronograma de pagamentos')}${tabela(cabCron, [...linhasCron, totalCron])}
<p style="${fonte}margin:22px 0 0;font-size:11px;color:${CINZA};line-height:1.5;">Estimativa com as regras do produto e os custos financeiros vigentes na data da simulação. O CET é estimado a partir deste fluxo e não substitui o CET do contrato. Estimativas sujeitas à confirmação das condições contratuais; a proposta do agente financeiro prevalece.</p>
</td></tr></table></td></tr></table></body></html>`

  // Versão em texto simples, para quem não vê HTML.
  const texto = [
    'Olá,', '', `Segue a simulação do financiamento BNDES Finame (${linha}).`, '',
    ...itens.flatMap((item, i) => [`${opcao(item, i, varias)}: valor ${brl(item.valor)}, prazo ${meses(item.prazo)}, carência ${meses(item.carencia)}, taxa final ${taxa(item.taxa)}, CET estimado ${taxa(item.cet)}, total ${brl(item.total)}.`]),
    '', 'Cronograma (' + opcao(a, 0, varias) + '):',
    ...pagas(a).map((p, k) => `${k + 1} | ${dmy(p.vencimento)} | ${brl(p.parcela)}`),
    '', 'Estimativas sujeitas à confirmação das condições contratuais; a proposta do agente financeiro prevalece.',
  ].join('\r\n')

  return { assunto, html: corpoHtml, texto, nome: nomeDeArquivo(`BNDES Finame - simulação ${brl(a.valor)} - ${emitido.replace(/\//g, '-')}`) }
}

export const bndesEml = dados => { const c = bndesEmlConteudo(dados); return { nome: c.nome, conteudo: montarEml(c) } }
