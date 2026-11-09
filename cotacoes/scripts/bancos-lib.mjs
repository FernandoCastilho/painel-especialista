import { BANKS, shiftQuarter } from '../src/bancos.js'
export const IF_DATA = 'https://olinda.bcb.gov.br/olinda/servico/IFDATA/versao/v1/odata/'
export function bankDataUrl(period, report) {
  const params = new URLSearchParams({ '@AnoMes': period, '@TipoInstituicao': 1, '@Relatorio': `'${report}'`, '$format': 'json' })
  return `${IF_DATA}IfDataValores(AnoMes=@AnoMes,TipoInstituicao=@TipoInstituicao,Relatorio=@Relatorio)?${params}`
}
export function normalizeBankQuarter(period, reports, previousReports = {}) {
  const source = report => bankDataUrl(period, report)
  return BANKS.map(bank => {
    const row = (report, account, previous = false) => (previous ? previousReports : reports)[report]?.find(r => r.CodInst === bank.code && r.Conta === account)
    const value = (report, account, previous = false) => { const v = row(report, account, previous)?.Saldo; return typeof v === 'number' && Number.isFinite(v) ? v : null }
    const metrics = {}
    const add = (key, v, report, basis, note = '') => { if (Number.isFinite(v)) metrics[key] = { value: v, source: source(report), basis, note } }
    add('basel', value('1', '79664') == null ? null : value('1', '79664') * 100, '1', 'bc-prudencial-basileia')
    add('assets', value('1', '140220'), '1', 'bc-prudencial-ativos')
    add('creditPF', value('11', '24452'), '11', 'bc-scr-pf')
    add('creditPJ', value('13', '24453'), '13', 'bc-scr-pj')
    add('creditTotal', value('16', '24454'), '16', 'bc-scr-total', 'Crédito ativo SCR; difere da carteira contábil líquida e das carteiras ampliadas dos bancos.')
    // Resultado Cosif acumula dentro do semestre: junho/dezembro precisam da subtração do primeiro trimestre do semestre.
    const rawProfit = value('1', '141870'), prevProfit = value('1', '141870', true)
    add('profit', period % 100 === 6 || period % 100 === 12 ? (rawProfit != null && prevProfit != null ? rawProfit - prevProfit : null) : rawProfit, '1', 'bc-prudencial-lucro-trimestral', 'Lucro contábil do trimestre. Junho/dezembro: saldo semestral menos saldo de março/setembro.')
    const lossAccounts = ['140202', '140208', '140213', '145832']
    const grossAccounts = ['140201', '140207', '140212', '145831']
    const sum = accounts => { const vals = accounts.map(a => value('2', a)); return vals.every(v => v != null) ? vals.reduce((a, b) => a + b, 0) : null }
    const loss = sum(lossAccounts), gross = sum(grossAccounts)
    add('provisionTotal', loss == null ? null : Math.abs(loss), '2', 'bc-perda-esperada-creditos', 'Saldo de perda esperada das operações de crédito, arrendamento, outras operações com característica de crédito e recebíveis pós-pagos. Não é despesa de PDD nem inclui toda a carteira de títulos.')
    add('provisionRatioTotal', loss != null && gross > 0 ? Math.abs(loss) / gross * 100 : null, '2', 'bc-perda-esperada-sobre-bruto', 'Cálculo: perda esperada / valor contábil bruto das mesmas quatro categorias. Denominador diferente do SCR.')
    const npl = value('16', '148834'), total = value('16', '24454')
    add('nplTotal', npl != null && total > 0 ? npl / total * 100 : null, '16', 'bc-scr-inadimplencia-arrastada', 'Cálculo: carteira ativa inadimplida arrastada / total geral, conforme relatório SCR. Não substitui automaticamente a métrica gerencial de atraso >90 dias.')
    const porte = (reports['14'] || []).filter(r => r.CodInst === bank.code && ['23363', '23364', '23365', '23366', '101484'].includes(r.Conta)).map(r => ({ name: r.NomeColuna, value: r.Saldo, source: source('14') }))
    return { id: bank.id, period, origin: 'bc', scope: 'Conglomerado prudencial · crédito SCR', metrics, porte }
  }).filter(b => Object.keys(b.metrics).length)
}
// Série trimestral contínua (últimos 6 trimestres (a partir de 1T25, quando a contabilidade do BC mudou); o lucro de jun/dez usa o trimestre anterior, que está na série).
// Os três primeiros são os usados nas comparações e vão na frente, para sobreviverem ao limite de tempo da coleta.
export const comparisonPeriods = period => [...new Set([period, shiftQuarter(period, -1), shiftQuarter(period, -4), ...Array.from({ length: 6 }, (_, i) => shiftQuarter(period, -i))])]
