// Câmbio futuro em USD, montado a partir da planilha de Fernando (26/11/2026).
// Regras (iguais às da planilha, salvo onde indicado):
// - Valor em R$ = valor em USD × spot da mesa. A TAC (R$) sai do valor recebido.
// - Cada parcela tem prazo em dias corridos desde o início; vencimento = início + prazo.
// - Comissão externa, IR juros remissível e comissão local: saldo devedor × taxa ao ano × dias do período ÷ 360.
//   Juros total = soma das três; parcela em USD = amortização + juros.
// - Fluxo em R$ (coluna FC): no início, −(valor em R$ − TAC); em cada vencimento, parcela em USD (em centavos) × câmbio futuro da parcela.
// - TIR ao ano em base 252: taxa que zera o fluxo usando os dias úteis (feriados nacionais) entre o início e cada vencimento.
//   A planilha mostrava o retorno do período, sem anualizar; aqui ele aparece separado, no bullet.
import { addDays, busDaysIn } from './holidays.js'

export const MAX_PARCELAS_FLUXO = 12
export const MAX_PRAZO_DIAS = 3650 // 10 anos
const positivo = n => Number.isFinite(n) && n > 0
const naoNegativo = n => Number.isFinite(n) && n >= 0
const dataValida = iso => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso
}
// Arredonda para centavos, meio para cima (o resíduo de ponto flutuante não decide o arredondamento).
export const centavos = v => Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-7) / 100

export const vencimentoPorPrazo = (inicio, prazo) => dataValida(inicio) && Number.isInteger(prazo) && prazo > 0 && prazo <= MAX_PRAZO_DIAS ? addDays(inicio, prazo) : null

// Amortização em partes iguais, em centavos; a última parcela leva a sobra do arredondamento.
export function amortizacoesIguais(valor, n) {
  if (!positivo(valor) || !Number.isInteger(n) || n < 1) return []
  const parte = Math.floor(valor * 100 / n + 1e-7) / 100
  return Array.from({ length: n }, (_, i) => i < n - 1 ? parte : centavos(valor - parte * (n - 1)))
}

// Taxa que zera o fluxo: recebido no início e pagamentos em `anos` (dias úteis ÷ 252). O VPL cai com a taxa, então há uma raiz só.
export function tirBase252(recebido, pagamentos) {
  if (!positivo(recebido) || !pagamentos.length || pagamentos.some(p => !positivo(p.valor) || !(p.du >= 1))) return null
  const vpl = x => pagamentos.reduce((s, p) => s + p.valor * Math.exp(-x * p.du / 252), 0) - recebido // x = ln(1 + taxa)
  let baixo = -5, alto = 5
  if (vpl(baixo) < 0 || vpl(alto) > 0) return null
  for (let i = 0; i < 200; i++) {
    const meio = (baixo + alto) / 2
    if (vpl(meio) > 0) baixo = meio
    else alto = meio
  }
  return Math.expm1((baixo + alto) / 2) * 100
}

/**
 * @param {{ inicio: string, valorUsd: number, tacBrl?: number, spot?: number,
 *   taxas: { externa: number, ir: number, local: number },
 *   parcelas: { prazo: number, amortizacao: number, futuro?: number }[] }} entrada
 */
export function calcularFluxoCambio({ inicio, valorUsd, tacBrl = 0, spot, taxas, parcelas }) {
  const erros = []
  if (!dataValida(inicio)) erros.push('Informe a data de início.')
  if (!positivo(valorUsd)) erros.push('Informe o valor em USD.')
  if (!naoNegativo(tacBrl)) erros.push('A TAC não pode ser negativa.')
  const { externa, ir, local } = taxas ?? {}
  if (![externa, ir, local].every(t => naoNegativo(t) && t <= 100)) erros.push('Informe as três taxas, de 0% a 100% ao ano.')
  if (!Array.isArray(parcelas) || parcelas.length < 1 || parcelas.length > MAX_PARCELAS_FLUXO) erros.push(`Escolha de 1 a ${MAX_PARCELAS_FLUXO} parcelas.`)
  const valorBrl = positivo(valorUsd) && positivo(spot) ? centavos(valorUsd * spot) : null
  const liquidoBrl = valorBrl != null && naoNegativo(tacBrl) ? centavos(valorBrl - tacBrl) : null
  if (liquidoBrl != null && !(liquidoBrl > 0)) erros.push('A TAC consome todo o valor da operação.')
  const somaTaxas = [externa, ir, local].every(Number.isFinite) ? externa + ir + local : null
  if (erros.length) return { ok: false, erro: erros[0], valorBrl, liquidoBrl, linhas: [], somaTaxas }

  let saldo = valorUsd
  let prazoAnterior = 0
  let quebrou = false
  const linhas = parcelas.map((p, i) => {
    const vencimento = vencimentoPorPrazo(inicio, p.prazo)
    const apta = !quebrou && vencimento && p.prazo > prazoAnterior && naoNegativo(p.amortizacao)
    if (!apta) {
      quebrou = true
      return { completa: false }
    }
    const dias = p.prazo - prazoAnterior
    const juro = taxa => saldo * taxa / 100 * dias / 360
    const linha = { prazo: p.prazo, dias, vencimento, amortizacao: p.amortizacao, saldo,
      externa: juro(externa), ir: juro(ir), local: juro(local), futuro: positivo(p.futuro) ? p.futuro : null, completa: true }
    linha.juros = linha.externa + linha.ir + linha.local
    linha.parcela = centavos(linha.amortizacao + linha.juros)
    linha.du = busDaysIn(inicio, vencimento, ['BR'])
    linha.fcBrl = linha.futuro ? centavos(linha.parcela * linha.futuro) : null
    saldo -= p.amortizacao
    prazoAnterior = p.prazo
    return linha
  })
  const out = { ok: true, valorBrl, liquidoBrl, linhas, somaTaxas }
  if (linhas.some(l => !l.completa)) return { ...out, erro: 'Informe prazos crescentes e amortizações válidas em todas as parcelas.' }
  const amortizado = centavos(linhas.reduce((s, l) => s + l.amortizacao, 0))
  if (Math.abs(amortizado - centavos(valorUsd)) >= 0.005) return { ...out, erro: `A soma das amortizações (${amortizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) precisa ser igual ao valor em USD.` }
  if (linhas.some(l => l.du < 1)) return { ...out, erro: 'Cada vencimento precisa ter pelo menos um dia útil depois do início.' }
  const totalUsd = centavos(linhas.reduce((s, l) => s + l.parcela, 0))
  if (liquidoBrl == null || linhas.some(l => l.fcBrl == null)) return { ...out, totalUsd, completo: false, falta: 'Informe o spot e o câmbio futuro de cada parcela para ver o fluxo em R$ e a TIR.' }
  const totalBrl = centavos(linhas.reduce((s, l) => s + l.fcBrl, 0))
  return { ...out, totalUsd, completo: true, totalBrl,
    periodoPct: (totalBrl / liquidoBrl - 1) * 100,
    tirPct: tirBase252(liquidoBrl, linhas.map(l => ({ valor: l.fcBrl, du: l.du }))) }
}
