// Fórmulas da calculadora oficial da Receita (regime regular e Simples), reescritas em JavaScript.
// Fonte: github.com/ReceitaFederal/calculadora-rtc-regime-regular (MIT) e calculadora-rtc-simples-nacional (MIT).
// Contas internas com 8 casas e arredondamento bancário, como em core/util/ArredondamentoUtils.java.
// Função pura: os dados oficiais (alíquotas e reduções) chegam por parâmetro.

const ESCALA = 100000000n // 8 casas

function paraInterno(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new TypeError('valor numérico inválido')
  const [inteiro, fracao = ''] = Math.abs(valor).toFixed(10).split('.')
  const bruto = BigInt(inteiro + fracao) // 10 casas
  const resto = bruto % 100n
  let base = bruto / 100n
  if (resto > 50n || (resto === 50n && base % 2n === 1n)) base += 1n
  return valor < 0 ? -base : base
}
const dividirPar = (a, b) => {
  const negativo = (a < 0n) !== (b < 0n)
  const x = a < 0n ? -a : a, y = b < 0n ? -b : b
  let q = x / y
  const r2 = (x % y) * 2n
  if (r2 > y || (r2 === y && q % 2n === 1n)) q += 1n
  return negativo ? -q : q
}
const multiplicar = (a, b) => dividirPar(a * b, ESCALA)
const porCem = a => dividirPar(a, 100n)
const paraNumero = a => Number(a) / 1e8

/** Arredondamento bancário para centavos, como a apresentação oficial (2 casas). */
export function moeda(valor) {
  return Number(dividirPar(paraInterno(valor), 1000000n)) / 100
}

/** Alíquota efetiva = alíquota × (1 − redução). Ex.: 8,8% com redução de 60% = 3,52%. */
export function aliquotaEfetiva(aliquota, reducao = 0) {
  return paraNumero(multiplicar(paraInterno(aliquota), paraInterno(1) - porCem(paraInterno(reducao))))
}

/** Imposto Seletivo: base × alíquota ad valorem + quantidade × alíquota ad rem. */
export function impostoSeletivo({ base = 0, adValorem = 0, quantidade = 0, adRem = 0 }) {
  return paraNumero(multiplicar(paraInterno(base), porCem(paraInterno(adValorem))) + multiplicar(paraInterno(quantidade), paraInterno(adRem)))
}

/**
 * Um item do regime regular. Base "por fora": valor sem ICMS, ISS, PIS, Cofins e IPI, com o IS.
 * baseCalculo informada − IS informado + IS calculado; sem base informada, parte da base do IS.
 */
export function calcularRegular({ baseCalculo = null, impostoSeletivo: is = null, aliquotas, reducao = {} }) {
  let vIS = 0
  let base
  if (is) {
    vIS = impostoSeletivo(is)
    base = baseCalculo == null
      ? paraInterno(is.base) + paraInterno(vIS)
      : paraInterno(baseCalculo) - paraInterno(is.impostoInformado ?? 0) + paraInterno(vIS)
  } else {
    if (typeof baseCalculo !== 'number') throw new TypeError('base de cálculo obrigatória')
    base = paraInterno(baseCalculo)
  }
  const tributo = chave => {
    const efetiva = paraInterno(aliquotaEfetiva(aliquotas[chave], reducao[chave] ?? 0))
    return { aliquota: aliquotas[chave], reducao: reducao[chave] ?? 0, aliquotaEfetiva: paraNumero(efetiva), valor: paraNumero(multiplicar(base, porCem(efetiva))) }
  }
  const cbs = tributo('cbs'), ibsUf = tributo('ibsUf'), ibsMun = tributo('ibsMun')
  return { baseCalculo: paraNumero(base), impostoSeletivo: vIS, cbs, ibsUf, ibsMun, ibs: paraNumero(paraInterno(ibsUf.valor) + paraInterno(ibsMun.valor)) }
}

// Tipos de receita do Simples (V0050 linhas 150–156; teste oficial Teste_SimplesNacionalCalculoService).
export const TIPOS_RECEITA_SIMPLES = {
  1: { rotulo: 'Venda no mercado interno', fator: 1, pendente: false },
  5: { rotulo: 'Mercado interno e exportação', fator: 0.5, pendente: false },
  3: { rotulo: 'Exportação direta', fator: 0, pendente: false },
  4: { rotulo: 'Exportação indireta (fica suspenso)', fator: 1, pendente: true },
}

/**
 * Simples Nacional (CRT 1, regime normal do Simples): receita × fator × alíquota informada.
 * A alíquota efetiva de CBS e de IBS vem do DAS (PGDAS-D); a calculadora oficial não a calcula.
 * O IS fica fora da receita bruta (carga oficial), mas entra no total do item.
 */
export function calcularSimples({ receita, impostoSeletivo: vIS = 0, pCbs, pIbs, tipoReceita = 1 }) {
  const tipo = TIPOS_RECEITA_SIMPLES[tipoReceita]
  if (!tipo) throw new RangeError('tipo de receita desconhecido')
  const r = paraInterno(receita)
  const bc = multiplicar(r, paraInterno(tipo.fator))
  const valor = p => (p == null || tipo.fator === 0) ? 0n : multiplicar(bc, porCem(paraInterno(p)))
  const ibs = valor(pIbs), cbs = valor(pCbs)
  const devido = v => tipo.pendente ? 0n : v
  const pendente = v => tipo.pendente ? v : 0n
  return { receita: paraNumero(r), baseCalculo: paraNumero(bc), ibs: paraNumero(devido(ibs)), ibsPendente: paraNumero(pendente(ibs)),
    cbs: paraNumero(devido(cbs)), cbsPendente: paraNumero(pendente(cbs)), impostoSeletivo: vIS,
    total: paraNumero(devido(ibs) + devido(cbs) + paraInterno(vIS)) }
}
