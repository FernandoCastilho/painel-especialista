// Lê o trecho da tabela da mesa copiado do Excel (colunas A a H: Prazo, Vencimento, Amortização USD,
// Saldo devedor USD, Comissão externa, IR juros remissível, Comissão local, Parcela USD) e devolve o que
// a calculadora precisa: início, valor em USD, prazos, amortizações e as três taxas ao ano.
// O trecho não traz o cabeçalho com as taxas; cada taxa sai das linhas:
// soma dos valores da coluna × 360 ÷ soma de (saldo × dias do período), com 4 casas (pedido de Fernando em 27/11/2026).
// Depois a calculadora refaz a tabela com essas taxas; o que não bater com o colado vira aviso.
import { addDays } from './holidays.js'
import { MAX_PARCELAS_FLUXO, MAX_PRAZO_DIAS, centavos } from './cambioFuturoFluxo.js'

// Número no padrão do Excel em português ("1.553,77", "25.000,00", "91") ou com ponto decimal ("1553.77").
export function numeroColado(texto) {
  const t = String(texto ?? '').trim().replace(/\s|US\$|R\$|\$|%/g, '')
  if (!t) return NaN
  if (t === '-') return 0 // zero no formato contábil do Excel
  // Ponto de milhar só com o primeiro grupo sem zero à esquerda ("0.500" não vira 500).
  if (/^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+(,\d+)?$/.test(t)) return Number(t.replaceAll('.', '').replace(',', '.'))
  if (/^-?\d+\.\d{1,2}$/.test(t)) return Number(t)
  return NaN
}

// "22/02/2027" ou "2027-02-22" → "2027-02-22".
export function dataColada(texto) {
  const t = String(texto ?? '').trim()
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t)
  const iso = br ? `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

const real = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quatroCasas = v => Math.round(v * 10000 + 1e-7) / 10000
const COLUNAS = ['externa', 'ir', 'local']
const NOMES = { externa: 'comissão externa', ir: 'IR juros remissível', local: 'comissão local' }

export function lerTabelaMesa(texto) {
  const erro = mensagem => ({ ok: false, erro: mensagem })
  const linhasTexto = String(texto ?? '').split(/\r?\n/).filter(l => l.trim())
  // Linhas de cabeçalho ou de título (primeira célula que não é um prazo) são ignoradas.
  const todas = linhasTexto.map(l => l.split(l.includes('\t') ? '\t' : ';').map(c => c.trim()))
  // Uma linha que começa com número mas não com um prazo inteiro (ex.: "91,0") é dado mal copiado, não título.
  const torta = todas.find(c => /^\d/.test(c[0]) && !/^\d{1,4}$/.test(c[0]))
  if (torta) return erro(`Não entendi o prazo "${torta[0]}". Use dias inteiros, ex.: 91.`)
  const celulas = todas.filter(c => /^\d{1,4}$/.test(c[0]))
  if (!celulas.length) return erro('Cole as linhas da tabela, da coluna Prazo até Parcela USD (ex.: A10 até H13).')
  if (celulas.length > MAX_PARCELAS_FLUXO) return erro(`A calculadora aceita até ${MAX_PARCELAS_FLUXO} parcelas.`)
  if (celulas.some(c => c.length < 7)) return erro('Cada linha precisa ter de Prazo até Comissão local (7 colunas), copiadas juntas do Excel.')

  const linhas = []
  for (const [i, c] of celulas.entries()) {
    const prazo = Number(c[0]), vencimento = dataColada(c[1])
    const [amortizacao, saldo, externa, ir, local] = c.slice(2, 7).map(numeroColado)
    const parcela = c[7] ? numeroColado(c[7]) : null
    const anterior = i ? linhas[i - 1].prazo : 0
    const n = i + 1
    if (!(prazo >= 1 && prazo <= MAX_PRAZO_DIAS)) return erro(`Linha ${n}: o prazo precisa ser de 1 a ${MAX_PRAZO_DIAS} dias.`)
    if (prazo <= anterior) return erro(`Linha ${n}: os prazos precisam ser crescentes.`)
    if (!vencimento) return erro(`Linha ${n}: não entendi o vencimento "${c[1]}". Use dd/mm/aaaa.`)
    if (!(amortizacao >= 0) || !(saldo > 0)) return erro(`Linha ${n}: confira a amortização e o saldo devedor.`)
    if (![externa, ir, local].every(v => v >= 0)) return erro(`Linha ${n}: confira as colunas de comissão e IR.`)
    if (parcela !== null && !(parcela >= 0)) return erro(`Linha ${n}: não entendi a parcela "${c[7]}".`)
    linhas.push({ prazo, vencimento, amortizacao, saldo, externa, ir, local, parcela, dias: prazo - anterior })
  }

  const valorUsd = linhas[0].saldo
  const amortizado = centavos(linhas.reduce((s, l) => s + l.amortizacao, 0))
  if (Math.abs(amortizado - centavos(valorUsd)) >= 0.005) return erro(`A soma das amortizações (${real(amortizado)}) não bate com o saldo da primeira linha (${real(valorUsd)}).`)

  const inicio = addDays(linhas[0].vencimento, -linhas[0].prazo)
  const base = linhas.reduce((s, l) => s + l.saldo * l.dias, 0)
  const taxas = Object.fromEntries(COLUNAS.map(k => [k, quatroCasas(linhas.reduce((s, l) => s + l[k], 0) * 360 / base * 100)]))

  // Conferência: a tabela refeita com as taxas lidas precisa dar o que foi colado (até 1 centavo, pelas 4 casas).
  const avisos = []
  let saldo = valorUsd
  linhas.forEach((l, i) => {
    const n = i + 1
    if (addDays(inicio, l.prazo) !== l.vencimento) avisos.push(`Linha ${n}: o vencimento colado não é o início + ${l.prazo} dias; a calculadora usa o prazo.`)
    if (Math.abs(saldo - l.saldo) >= 0.005) avisos.push(`Linha ${n}: o saldo colado não é o saldo anterior menos a amortização.`)
    for (const k of COLUNAS) {
      const refeito = centavos(saldo * taxas[k] / 100 * l.dias / 360)
      if (Math.abs(refeito - l[k]) > 0.0101) avisos.push(`Linha ${n}: a ${NOMES[k]} colada (${real(l[k])}) difere da refeita com ${taxas[k].toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% (${real(refeito)}).`)
    }
    if (l.parcela !== null && Math.abs(l.parcela - (l.amortizacao + l.externa + l.ir + l.local)) > 0.0201) avisos.push(`Linha ${n}: a parcela colada não é a amortização mais as três colunas.`)
    saldo -= l.amortizacao
  })

  return { ok: true, inicio, valorUsd, taxas, avisos,
    parcelas: linhas.map(l => ({ prazo: l.prazo, amortizacao: l.amortizacao })) }
}
