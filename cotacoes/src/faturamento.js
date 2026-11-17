// Faturamento x Endividamento: lê o texto colado (Mês, Faturamento, Endividamento) e compara
// um período escolhido com os mesmos meses do ano anterior. Não há regra financeira aqui: só soma,
// média e variação percentual dos números colados, na unidade em que vieram (ex.: R$ mil).

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Mês em "out/24", "out/2024", "outubro/24", "Out. 2024", "10/2024" ou "2024-10".
export function parseMes(token) {
  const t = semAcento(String(token).trim()).replace(/\./g, '')
  let m = t.match(/^([a-z]{3})[a-z]*\s*[/\- ]?\s*(\d{2}|\d{4})$/)
  if (m) {
    const i = MESES.indexOf(m[1])
    if (i < 0) return null
    const ano = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])
    return { ano, mes: i + 1 }
  }
  m = t.match(/^(\d{1,2})[/-](\d{2}|\d{4})$/)
  if (m) {
    const mes = Number(m[1])
    if (mes < 1 || mes > 12) return null
    return { ano: m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]), mes }
  }
  m = t.match(/^(\d{4})-(\d{1,2})$/)
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { ano: Number(m[1]), mes: Number(m[2]) }
  return null
}

// Número no padrão brasileiro: "7.123", "7.123,45", "R$ 7.123", "-12,5". Vazio ou "-" = sem dado (null).
// Retorna undefined quando o texto não é número.
export function parseNumero(token) {
  let t = String(token ?? '').replace(/R\$/gi, '').replace(/\s/g, '')
  if (t === '' || t === '-' || t === '—') return null
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-')
  t = t.replace(/^[(-]|\)$/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  const v = Number(t)
  return negativo ? -v : v
}

export const chaveMes = (ano, mes) => ano * 12 + (mes - 1)
export const rotuloMes = (chave) => `${MESES[((chave % 12) + 12) % 12]}/${String(Math.floor(chave / 12)).slice(-2)}`

const INICIO = /^\s*([A-Za-zÀ-ÿ]{3,9}\.?\s*[/-]?\s*\d{2,4}|\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2})(?=\s|;|\t|$)(.*)$/

// Lê o texto colado. Cabeçalho e linhas vazias são ignorados; o resto que não for mês + números vira aviso.
export function parseFaturamento(texto) {
  const linhas = String(texto ?? '').split(/\r?\n/)
  const porChave = new Map()
  const avisos = []
  linhas.forEach((bruta, i) => {
    const linha = bruta.trim()
    if (!linha) return
    const m = linha.match(INICIO)
    const mes = m && parseMes(m[1])
    if (!mes) {
      if (/m[eê]s|faturamento|endividamento/i.test(linha)) return
      avisos.push({ linha: i + 1, texto: linha, motivo: 'Mês não reconhecido (use o formato out/24).' })
      return
    }
    const partes = m[2].split(/[\t; ]+/).filter(Boolean)
    const nums = partes.map(parseNumero)
    if (nums.length === 0 || nums.some((n) => n === undefined)) {
      avisos.push({ linha: i + 1, texto: linha, motivo: 'Valor não reconhecido.' })
      return
    }
    const chave = chaveMes(mes.ano, mes.mes)
    if (porChave.has(chave)) {
      avisos.push({ linha: i + 1, texto: linha, motivo: `Mês repetido (${rotuloMes(chave)}); valeu a primeira linha.` })
      return
    }
    porChave.set(chave, { chave, rotulo: rotuloMes(chave), ano: mes.ano, mes: mes.mes, faturamento: nums[0] ?? null, endividamento: nums.length > 1 ? nums[1] : null })
  })
  const meses = [...porChave.values()].sort((a, b) => a.chave - b.chave)
  return { meses, avisos }
}

const soma = (xs) => xs.reduce((s, x) => s + x, 0)
const media = (xs) => (xs.length ? soma(xs) / xs.length : null)
// Saldo de endividamento zerado ou vazio é tratado como "sem informação" (ex.: mês ainda não fechado no SCR).
const temSaldo = (v) => v != null && v > 0
export const variacao = (atual, anterior) => (atual == null || anterior == null || anterior === 0 ? null : atual / anterior - 1)

// Compara os meses de [de, ate] com os mesmos meses do ano anterior. Só entram na variação os meses que
// existem nos dois anos (pares); os totais do período escolhido usam todos os meses dele.
export function compararPeriodo(meses, de, ate) {
  if (de == null || ate == null) return null
  const [ini, fim] = de <= ate ? [de, ate] : [ate, de]
  const porChave = new Map(meses.map((m) => [m.chave, m]))
  const atuais = meses.filter((m) => m.chave >= ini && m.chave <= fim)
  if (!atuais.length) return null
  const pares = atuais.map((m) => [m, porChave.get(m.chave - 12)]).filter(([, p]) => p)

  const fatPar = pares.filter(([a, p]) => a.faturamento != null && p.faturamento != null)
  const fatAtual = soma(fatPar.map(([a]) => a.faturamento))
  const fatAnterior = soma(fatPar.map(([, p]) => p.faturamento))
  const divPar = pares.filter(([a, p]) => temSaldo(a.endividamento) && temSaldo(p.endividamento))
  const divMediaAtual = media(divPar.map(([a]) => a.endividamento))
  const divMediaAnterior = media(divPar.map(([, p]) => p.endividamento))
  const ultimo = divPar.at(-1)

  return {
    de: ini,
    ate: fim,
    rotulo: ini === fim ? rotuloMes(ini) : `${rotuloMes(ini)} a ${rotuloMes(fim)}`,
    rotuloAnterior: ini === fim ? rotuloMes(ini - 12) : `${rotuloMes(ini - 12)} a ${rotuloMes(fim - 12)}`,
    mesesNoPeriodo: atuais.length,
    mesesComparados: fatPar.length,
    faturamento: {
      totalPeriodo: soma(atuais.filter((m) => m.faturamento != null).map((m) => m.faturamento)),
      atual: fatPar.length ? fatAtual : null,
      anterior: fatPar.length ? fatAnterior : null,
      mediaAtual: fatPar.length ? fatAtual / fatPar.length : null,
      mediaAnterior: fatPar.length ? fatAnterior / fatPar.length : null,
      variacao: fatPar.length ? variacao(fatAtual, fatAnterior) : null,
    },
    endividamento: {
      mesesComparados: divPar.length,
      mediaAtual: divMediaAtual,
      mediaAnterior: divMediaAnterior,
      variacaoMedia: variacao(divMediaAtual, divMediaAnterior),
      ultimoRotulo: ultimo ? ultimo[0].rotulo : null,
      ultimoAnteriorRotulo: ultimo ? ultimo[1].rotulo : null,
      ultimoAtual: ultimo ? ultimo[0].endividamento : null,
      ultimoAnterior: ultimo ? ultimo[1].endividamento : null,
      variacaoUltimo: ultimo ? variacao(ultimo[0].endividamento, ultimo[1].endividamento) : null,
    },
  }
}

// Resumo por ano, só com os meses colados (como os quadros do DAC).
export function resumoPorAno(meses) {
  const anos = new Map()
  for (const m of meses) {
    if (m.faturamento == null) continue
    const a = anos.get(m.ano) ?? { ano: m.ano, meses: 0, total: 0 }
    a.meses += 1
    a.total += m.faturamento
    anos.set(m.ano, a)
  }
  return [...anos.values()].map((a) => ({ ...a, media: a.total / a.meses }))
}

export const EXEMPLO = `Mês\tFaturamento\tEndividamento
jan/25\t4.100\t7.200
fev/25\t3.950\t7.050
mar/25\t4.420\t7.600
abr/25\t4.310\t7.480
mai/25\t4.600\t7.390
jun/25\t4.250\t7.700
jul/25\t4.880\t7.520
ago/25\t4.700\t7.610
set/25\t4.530\t7.300
out/25\t4.960\t7.810
nov/25\t4.820\t7.690
dez/25\t3.400\t7.150
jan/26\t4.300\t7.740
fev/26\t4.050\t7.420
mar/26\t4.950\t7.950
abr/26\t4.010\t7.330
mai/26\t4.520\t8.120
jun/26\t4.180\t8.240
jul/26\t4.390\t7.760
ago/26\t3.560\t0
set/26\t3.700\t0`
