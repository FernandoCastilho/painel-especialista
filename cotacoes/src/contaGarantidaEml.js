// E-mail executivo da Conta Garantida em arquivo do Outlook (.eml), no padrão do BNDES (pedido do Fernando, 24/11/2026).
// Dois modelos: o rotativo (utilização única ou lançamentos por dia) e o comparativo com o giro parcelado.
// Só apresentação: todos os números vêm prontos das contas da tela (contaGarantida.js e alongamento.js).
import { html, montarEml, nomeDeArquivo } from './emlOutlook.js'

const brl = v => Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const pct = v => Number.isFinite(v) ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
// Taxa digitada na tela (texto, com vírgula ou ponto): duas casas, como nas demais calculadoras.
const taxaAm = texto => { const n = Number(String(texto ?? '').replace(',', '.')); return Number.isFinite(n) && String(texto ?? '').trim() ? `${pct(n)} a.m.` : '—' }
const dmy = iso => /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('/') : '—'
const mesAno = iso => /^\d{4}-\d{2}/.test(iso || '') ? iso.slice(0, 7).split('-').reverse().join('/') : '—'

const AZUL = '#0b2e63', LARANJA = '#ff6200', TINTA = '#10284c', CINZA = '#5b6b82', LINHA = '#d5dfec', FUNDO = '#f4f7fb'
const fonte = 'font-family:Segoe UI,Arial,Helvetica,sans-serif;'
const celula = (conteudo, { th = false, dir = false, forte = false, fundo = '' } = {}) =>
  `<${th ? 'th' : 'td'} style="${fonte}padding:7px 10px;border-bottom:1px solid ${LINHA};text-align:${dir ? 'right' : 'left'};font-size:13px;color:${th ? CINZA : TINTA};${forte ? 'font-weight:700;' : 'font-weight:400;'}${fundo ? `background:${fundo};` : ''}">${conteudo}</${th ? 'th' : 'td'}>`
const titulo = texto => `<h3 style="${fonte}margin:24px 0 8px;font-size:15px;color:${AZUL};border-left:4px solid ${LARANJA};padding-left:8px;">${html(texto)}</h3>`
const tabela = (cabecalho, linhas) => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">${cabecalho ? `<tr>${cabecalho}</tr>` : ''}${linhas.join('')}</table>`
const pares = linhas => tabela('', linhas.map(([rotulo, valor, forte]) => `<tr>${celula(html(rotulo))}${celula(html(valor), { dir: true, forte })}</tr>`))
const grade = (cabecalho, linhas, totalLinha) => tabela(cabecalho.map((t, k) => celula(html(t), { th: true, dir: k > 0 })).join(''),
  [...linhas.map((valores, i) => `<tr>${valores.map((v, k) => celula(html(v), { dir: k > 0, fundo: i % 2 ? FUNDO : '' })).join('')}</tr>`),
    ...(totalLinha ? [`<tr>${totalLinha.map((v, k) => celula(html(v), { dir: k > 0, forte: true })).join('')}</tr>`] : [])])
const cartoes = itens => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:8px 0;margin:0 -8px;"><tr>${itens.map(([r, v], i) =>
  `<td style="${fonte}width:${Math.floor(100 / itens.length)}%;padding:12px;border:1px solid ${LINHA};border-radius:6px;background:${i === 1 ? AZUL : '#ffffff'};"><div style="font-size:11px;color:${i === 1 ? '#c9d6ee' : CINZA};text-transform:uppercase;letter-spacing:.04em;">${html(r)}</div><div style="font-size:18px;font-weight:700;color:${i === 1 ? '#ffffff' : TINTA};margin-top:4px;">${html(v)}</div></td>`).join('')}</tr></table>`

function documento({ chamada, titulo: tituloDoc, abertura, corpo, notas, emitido }) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="padding:16px;">
<table role="presentation" cellpadding="0" cellspacing="0" width="720" style="max-width:720px;width:100%;border-collapse:collapse;">
<tr><td style="${fonte}background:${AZUL};padding:18px 20px;color:#ffffff;"><div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#c9d6ee;">${html(chamada)}</div><div style="font-size:20px;font-weight:700;margin-top:4px;">${html(tituloDoc)}</div><div style="font-size:12px;color:#c9d6ee;margin-top:4px;">Emitida em ${html(emitido)}</div></td></tr>
<tr><td style="height:4px;background:${LARANJA};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="${fonte}padding:18px 4px 0;color:${TINTA};font-size:14px;line-height:1.5;">
<p style="margin:0 0 14px;">Olá,</p>
<p style="margin:0 0 16px;">${html(abertura)}</p>
${corpo}
<p style="${fonte}margin:22px 0 0;font-size:11px;color:${CINZA};line-height:1.5;">${notas.map(html).join(' ')}</p>
<p style="margin:16px 0 0;">Fico à disposição para conversar sobre as condições.</p>
</td></tr></table></td></tr></table></body></html>`
}

// Rotativo. modo: 'single' ou 'ledger'; params, result e cet como devolve parseContaGarantidaForm;
// taxa: o texto da taxa da tela; diasLabel e perfilLabel: os rótulos escolhidos; lancamentos: linhas da tabela (só no ledger).
export function contaGarantidaEmlConteudo({ modo, params, result, cet, taxa, diasLabel, perfilLabel, lancamentos = [], emitidoEm = new Date() }) {
  const t = result.totals
  const unica = modo === 'single'
  const emitido = emitidoEm.toLocaleDateString('pt-BR')
  const cobrir = t.payment + t.cost
  const cetTexto = cet?.ok ? `${pct(cet.annual * 100)} a.a. (${pct(cet.monthly * 100)} a.m.)` : 'Não calculado: informe o limite contratado'
  const destaques = [['Valor utilizado', brl(t.draw)], ['Custo total do período', brl(t.cost)], ['Taxa do contrato', taxaAm(taxa)], cet?.ok ? ['CET · 30 dias', `${pct(cet.annual * 100)} a.a.`] : ['Saldo devedor final', brl(result.balance)]]
  const condicoes = pares([
    ['Modalidade', unica ? 'Conta garantida · utilização única' : 'Conta garantida · lançamentos por dia'],
    ['Período', `${dmy(params.start)} a ${dmy(params.end)}`],
    ['Dias com saldo e juros', String(t.interestDays)],
    ['Taxa do contrato', taxaAm(taxa)],
    ['Dias que geram juros', diasLabel || '—'],
    ['Enquadramento do IOF', perfilLabel || '—'],
    ['IOF diário · adicional', `${String(params.iofDaily ?? '—').replace('.', ',')}% ao dia · ${String(params.iofAdditional ?? '—').replace('.', ',')}%`],
    ...(cet?.ok ? [['Limite contratado', brl(cet.limit)]] : []),
  ])
  const custos = pares([
    ['Juros do período', brl(t.interest)],
    ['IOF diário', brl(t.dailyIof)],
    ['IOF adicional', brl(t.additionalIof)],
    ['Custo total (juros + IOF)', brl(t.cost), true],
    ['CET estimado (art. 6º, 30 dias sobre o limite)', cetTexto],
    ...(unica ? [['Para cobrir a conta (principal + custos)', brl(cobrir), true]] : [['Total de amortizações', brl(t.payment)]]),
    ['Saldo devedor final', brl(result.balance)],
  ])
  const movimento = unica ? '' : titulo('Lançamentos informados') + grade(['Data', 'Utilização', 'Amortização'],
    lancamentos.filter(l => l.draw > 0 || l.payment > 0).map(l => [dmy(l.date), brl(l.draw), brl(l.payment)]), ['Total', brl(t.draw), brl(t.payment)])
  const mensal = titulo('Apuração mensal') + grade(['Mês', 'Juros', 'IOF diário', 'IOF adicional', 'Custo'],
    result.months.map(m => [mesAno(m.month), brl(m.interest), brl(m.dailyIof), brl(m.additionalIof), brl(m.interest + m.dailyIof + m.additionalIof)]),
    ['Total', brl(t.interest), brl(t.dailyIof), brl(t.additionalIof), brl(t.cost)])
  const notas = [
    'Estimativa para conta garantida adimplente; juros e IOF pagos à parte, sem capitalização.',
    'Juros proporcionais: saldo × taxa mensal ÷ 30 por dia.',
    cet?.ok ? 'CET pela Resolução CMN 4.881/2020, art. 6º: prazo de 30 dias sobre o limite contratado.' : 'CET não calculado: o limite contratado não foi informado.',
    'Não é extrato nem cotação bancária. Estimativas sujeitas à confirmação das condições contratuais.',
  ]
  const assunto = `Conta garantida · ${brl(t.draw)} · ${dmy(params.start)} a ${dmy(params.end)}`
  const corpo = cartoes(destaques) + titulo('Condições') + condicoes + titulo('Custos do período') + custos + movimento + mensal
  const texto = ['Olá,', '', 'Segue a simulação da conta garantida.', '',
    `Período: ${dmy(params.start)} a ${dmy(params.end)}. Taxa: ${taxaAm(taxa)}.`,
    `Valor utilizado: ${brl(t.draw)}. Juros: ${brl(t.interest)}. IOF: ${brl(t.iof)}. Custo total: ${brl(t.cost)}.`,
    `CET: ${cetTexto}. Saldo devedor final: ${brl(result.balance)}.`, '', ...notas].join('\r\n')
  return { assunto, texto, nome: nomeDeArquivo(`Conta garantida - ${brl(t.draw)} - ${emitido.replace(/\//g, '-')}`),
    html: documento({ chamada: 'Simulação de crédito', titulo: 'Conta garantida', abertura: 'Segue a simulação da conta garantida, com as condições, os custos do período e a apuração mês a mês.', corpo, notas, emitido }) }
}

// Comparativo com o giro parcelado. result: o que devolve parseAlongamentoForm; form: os campos da tela; valor: o valor que substitui a conta.
export function alongamentoEmlConteudo({ result, form, valor, emitidoEm = new Date() }) {
  const emitido = emitidoEm.toLocaleDateString('pt-BR')
  const economia = result.savings >= 0
  const sistema = form.system === 'sac' ? 'SAC · parcelas decrescentes' : 'Price · parcelas fixas'
  const destaques = [['Valor substituído', brl(valor)], [economia ? 'Economia de encargos' : 'Aumento de encargos', brl(Math.abs(result.savings))], ['1ª parcela do giro', brl(result.loan.firstInstallment)], ['Dívida ao final', brl(result.alternative.finalDebt)]]
  const condicoes = pares([
    ['Horizonte', `${dmy(result.start)} a ${dmy(result.end)} · ${result.horizonDays} dias`],
    ['Taxa da conta garantida', taxaAm(form.cgRate)],
    ['Taxa do giro parcelado', taxaAm(form.loanRate)],
    ['Parcelas · carência', `${form.n} parcelas · ${Number(form.graceMonths) || 0} ${Number(form.graceMonths) === 1 ? 'mês' : 'meses'} de carência`],
    ['Sistema de amortização', sistema],
    ['IOF + tarifa pagos no início', brl(result.loan.upfront)],
  ])
  const comparacao = grade(['Indicador', 'Manter a conta garantida', 'Giro + conta garantida residual'], [
    ['Juros no horizonte', brl(result.baseline.interest), brl(result.alternative.interest)],
    ['IOF futuro', brl(result.baseline.iof), brl(result.alternative.iof)],
    ['Tarifa da nova operação', brl(0), brl(result.loan.fee)],
    ['Custo financeiro total', brl(result.baseline.cost), brl(result.alternative.cost)],
    ['Total de desembolsos', brl(result.baseline.cashOut), brl(result.alternative.cashOut)],
    ['Dívida restante ao final', brl(result.baseline.finalDebt), brl(result.alternative.finalDebt)],
  ])
  const parcelas = result.months.filter(m => m.installment > 0)
  const cronograma = titulo('Cronograma do giro parcelado') + grade(['Vencimento', 'Juros', 'Amortização', 'Parcela', 'Desembolso combinado'],
    parcelas.map(m => [dmy(m.date), brl(m.loanInterest), brl(m.amortization), brl(m.installment), brl(m.cashOut)]),
    [`${parcelas.length} parcelas`, brl(parcelas.reduce((s, m) => s + m.loanInterest, 0)), brl(parcelas.reduce((s, m) => s + m.amortization, 0)), brl(parcelas.reduce((s, m) => s + m.installment, 0)), ''])
  const caixa = result.cashAssessment ? [result.cashAssessment.fits ? `As parcelas cabem na sobra de caixa informada; menor folga mensal de ${brl(result.cashAssessment.minSurplus)}.` : `Em pelo menos um mês faltam ${brl(Math.max(0, -result.cashAssessment.minSurplus))} para pagar a parcela e a conta garantida residual.`] : []
  const notas = [...caixa,
    'A diferença de encargos também reflete a redução do principal no parcelado; não é economia atribuível só à taxa.',
    'Sem novas utilizações do rotativo. Juros e IOF da conta garantida pagos à parte. Não calcula CET.',
    'Estimativas sujeitas à confirmação das condições contratuais.',
  ]
  const assunto = `Conta garantida x giro parcelado · ${form.n} parcelas · ${economia ? 'economia' : 'aumento'} de ${brl(Math.abs(result.savings))}`
  const corpo = cartoes(destaques) + titulo('Condições comparadas') + condicoes + titulo('Comparação no mesmo horizonte') + comparacao + cronograma
  const texto = ['Olá,', '', 'Segue a comparação entre manter a conta garantida e substituí-la por um giro parcelado.', '',
    `${economia ? 'Economia' : 'Aumento'} estimado de encargos: ${brl(Math.abs(result.savings))}.`,
    `Primeira parcela do giro: ${brl(result.loan.firstInstallment)}. Variação do desembolso mensal: ${brl(result.monthlyDelta)}.`,
    `Dívida ao final: ${brl(result.alternative.finalDebt)} (mantendo a conta garantida: ${brl(result.baseline.finalDebt)}).`, '', ...notas].join('\r\n')
  return { assunto, texto, nome: nomeDeArquivo(`Conta garantida x giro parcelado - ${emitido.replace(/\//g, '-')}`),
    html: documento({ chamada: 'Comparação de crédito', titulo: 'Conta garantida x giro parcelado', abertura: 'Segue a comparação entre manter a conta garantida e substituí-la por um giro parcelado, no mesmo horizonte, com o cronograma das parcelas.', corpo, notas, emitido }) }
}

const arquivo = c => ({ nome: c.nome, conteudo: montarEml(c) })
export const contaGarantidaEml = dados => arquivo(contaGarantidaEmlConteudo(dados))
export const alongamentoEml = dados => arquivo(alongamentoEmlConteudo(dados))
