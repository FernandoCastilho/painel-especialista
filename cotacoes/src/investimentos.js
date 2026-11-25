import { busDaysIn, isBusinessDay } from './holidays.js'
import { compareWithDi } from './operacaoDi.js'

const falha = erro => ({ ok: false, erro })
const positivo = x => Number.isFinite(x) && x > 0
const naoNegativo = x => Number.isFinite(x) && x >= 0
const dataValida = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s)
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === s
}

export function numeroPt(s, opcional = false) {
  const v = String(s ?? '').trim()
  if (!v && opcional) return 0
  if (!/^(?:\d+(?:,\d+)?|\d{1,3}(?:\.\d{3})+,\d+)$/.test(v)) return NaN
  return Number(v.replaceAll('.', '').replace(',', '.'))
}

function resultado(inicial, final) {
  const ganho = final - inicial, retorno = ganho / inicial
  return [final, ganho, retorno].every(Number.isFinite)
    ? { ok: true, final, ganho, retorno } : falha('O valor calculado está fora do intervalo válido.')
}

export function cdb({ principal, percentual, dataBase, vencimento, vertices }) {
  if (!positivo(principal) || !positivo(percentual)) return falha('Informe o valor e um percentual do CDI maior que zero.')
  if (!dataValida(dataBase) || !dataValida(vencimento) || vencimento <= dataBase) return falha('Escolha um vencimento posterior à data-base.')
  if (!isBusinessDay(vencimento, 'BR')) return falha('Escolha um vencimento em dia útil no calendário brasileiro.')
  if (!Array.isArray(vertices) || !vertices.length || vertices.some(v => !Array.isArray(v) || !Number.isInteger(v[0]) || !positivo(v[0]) || !Number.isFinite(v[1]) || v[1] <= -100) || new Set(vertices.map(v => v[0])).size !== vertices.length)
    return falha('Curva DI inválida ou incompleta.')
  const dias = busDaysIn(dataBase, vencimento, ['BR'])
  const r = compareWithDi({ value: principal, kind: 'pct', rate: percentual, pts: vertices, d1: 0, d2: dias })
  return r.ok ? { ...resultado(principal, r.finalOp), dias } : falha(r.error)
}

export function fundo(valor, cotaInicial, cotaFinal) {
  return [valor, cotaInicial, cotaFinal].every(positivo)
    ? resultado(valor, valor * (cotaFinal / cotaInicial)) : falha('Informe o valor e as duas cotas, todos maiores que zero.')
}

export function acoes({ quantidade, compra, venda, proventos, custos }) {
  if (!Number.isSafeInteger(quantidade) || quantidade <= 0 || !positivo(compra) || ![venda, proventos, custos].every(naoNegativo))
    return falha('Informe uma quantidade inteira, preço de compra positivo e valores finais não negativos.')
  return resultado(quantidade * compra + custos, quantidade * (venda + proventos))
}

const limparCnpj = s => String(s ?? '').replace(/[./-]/g, '').trim()
export function cotasCvm(csvs, { tipo, cnpj, sub = '' }) {
  const alvo = limparCnpj(cnpj)
  if (!/^\d{14}$/.test(alvo) || !['fundo','classe'].includes(tipo) || !/^[A-Za-z0-9_-]*$/.test(sub)) throw Error('Informe o CNPJ de 14 dígitos e a subclasse exata, se houver.')
  const datas = new Map()
  for (const csv of csvs) {
    const [h, ...linhas] = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/)
    const separar = linha => linha.split(';').map(s => s.trim().replace(/^"|"$/g, ''))
    const col = separar(h)
    const ci = col.indexOf('CNPJ_FUNDO_CLASSE'), fi = col.indexOf('CNPJ_FUNDO'), si = col.indexOf('ID_SUBCLASSE')
    const di = col.indexOf('DT_COMPTC'), vi = col.indexOf('VL_QUOTA')
    if ((ci >= 0) === (fi >= 0) || di < 0 || vi < 0) throw Error('Arquivo fora do padrão do Informe Diário CVM.')
    if ((tipo === 'classe') !== (ci >= 0)) continue
    for (const linha of linhas) {
      const p = separar(linha)
      if (limparCnpj(p[tipo === 'classe' ? ci : fi]) !== alvo || (p[si] ?? '') !== sub) continue
      const d = p[di], texto = p[vi]
      const v = /^\d+(?:[.,]\d+)?$/.test(texto) ? Number(texto.replace(',', '.')) : NaN
      if (!dataValida(d) || !positivo(v)) continue
      if (datas.has(d) && datas.get(d) !== v) throw Error('Cotas conflitantes para o mesmo dia. Use a competência revisada.')
      datas.set(d, v)
    }
  }
  return [...datas].sort(([a],[b]) => a.localeCompare(b))
}
