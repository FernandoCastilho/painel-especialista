// Tabela de funding do CDC (pedido de Fernando, 25/11/2026): não fica no código. O usuário cola as células do Excel no
// formato da planilha FUNDING (prazo em meses | taxas a.a. por vigência | taxas a.m. por vigência | linha SELIC). Usa só as
// colunas ao ano; a linha SELIC é ignorada. Com validade (pedido de Fernando, 26/11/2026): a tabela fica salva neste navegador
// (localStorage) até o fim do dia "válido até", no horário de Brasília; no dia seguinte, ao abrir, ela se apaga e a tela avisa.
const CHAVE = 'cdc-funding'
const VIGENCIA = /(\d{1,2})\/(\d{1,2})\s*(?:até|ate|a|-)\s*(\d{1,2})\/(\d{1,2})/i
const num = celula => {
  let t = String(celula ?? '').trim().replace('%', '').trim()
  t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null
}
const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
const dias = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5

// "dd/mm até dd/mm" → { inicio, fim }, com o ano que deixa o início mais perto de hoje. Data inválida → null.
function vigenciaDe(label, hoje) {
  const m = label.match(VIGENCIA)
  if (!m) return null
  const [d1, m1, d2, m2] = m.slice(1).map(Number)
  if (!(m1 >= 1 && m1 <= 12 && m2 >= 1 && m2 <= 12 && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31)) return null
  const ano = Number(hoje.slice(0, 4))
  const inicio = [ano - 1, ano, ano + 1].map(y => iso(y, m1, d1)).sort((a, b) => dias(a, hoje) - dias(b, hoje))[0]
  const y = Number(inicio.slice(0, 4))
  const fim = iso(y, m2, d2) < inicio ? iso(y + 1, m2, d2) : iso(y, m2, d2)
  return { inicio, fim }
}

// Texto colado do Excel (células separadas por tabulação) → { ok, tabela: [{ id, label, inicio, fim, taxas: { prazo: % a.a. } }] }.
// As colunas são lidas pela posição do cabeçalho de vigências: célula vazia é prazo sem taxa, não desloca as demais.
// Vigência repetida no cabeçalho (ao ano e ao mês, como na planilha): vale só a primeira, a ao ano.
export function lerFunding(texto, hoje) {
  const linhas = String(texto ?? '').split(/\r?\n/).map(l => l.split('\t').map(c => c.trim())).filter(l => l.some(Boolean))
  // Linha de prazo: a primeira célula preenchida é só o número de meses (a linha SELIC e os títulos ficam de fora).
  const dados = linhas.map(l => { const i = l.findIndex(Boolean); return /^\d{1,3}$/.test(l[i]) ? { prazo: Number(l[i]), i, l } : null }).filter(Boolean)
  if (dados.length < 2) return { ok: false, error: 'Não achei a tabela. Copie no Excel as células do prazo até as taxas e cole aqui.' }
  const cabecalho = linhas.find(l => l.some(c => VIGENCIA.test(c)))
  const metade = cabecalho && cabecalho.filter(c => VIGENCIA.test(c)).length % 2 === 0 && linhas.some(l => l.some(c => /a\.?\s*m\.?/i.test(c)))
  let colunas = []
  if (cabecalho) {
    const vistos = new Set()
    cabecalho.forEach((c, j) => { if (VIGENCIA.test(c) && !vistos.has(c)) { vistos.add(c); colunas.push({ j, label: c }) } })
    // Rótulos todos diferentes mas com colunas ao mês ao lado: as primeiras metades são as ao ano.
    if (metade && vistos.size === cabecalho.filter(c => VIGENCIA.test(c)).length) colunas = colunas.slice(0, colunas.length / 2)
  } else {
    colunas = [{ j: null, label: 'Tabela colada' }]
  }
  const tabela = []
  for (const [k, { j, label }] of colunas.entries()) {
    const datas = j === null ? { inicio: hoje, fim: null } : vigenciaDe(label, hoje)
    if (!datas) return { ok: false, error: `Vigência com data inválida: "${label}". Use o formato 19/11 até 25/11.` }
    const taxas = {}
    for (const { prazo, i, l } of dados) {
      const celula = j === null ? l.slice(i + 1).find(Boolean) : l[j]
      if (!celula) continue
      const v = num(celula)
      if (v === null || v <= 0 || v >= 100) return { ok: false, error: `Taxa inválida no prazo de ${prazo} meses (${label}). Use o formato 15,58%.` }
      taxas[prazo] = v
    }
    if (Object.keys(taxas).length < 2) return { ok: false, error: `A vigência ${label} tem menos de dois prazos com taxa.` }
    tabela.push({ id: `${k}-${datas.inicio}`, label, ...datas, taxas })
  }
  tabela.sort((a, b) => b.inicio.localeCompare(a.inicio))
  return { ok: true, tabela }
}

// Custo digitado à mão, prazo a prazo, no lugar da tabela colada (pedido de Fernando, 26/11/2026): os prazos da foto da
// tabela FUNDING, de 12 até 72 meses, com as duas colunas da foto: ao ano (a.a.) e ao mês (a.m.). Em cada prazo vale uma ou a
// outra. O ao mês vira ao ano pela mesma regra da tela: (1 + a.m.)^12 − 1. Prazo em branco fica de fora.
export const PRAZOS_DIGITADOS = Object.freeze([12, 18, 24, 36, 42, 48, 60, 72])
export const anoDoMes = am => ((1 + am / 100) ** 12 - 1) * 100
export function fundingDigitado(valores, hoje) {
  const taxas = {}
  for (const prazo of PRAZOS_DIGITADOS) {
    const aa = String(valores?.aa?.[prazo] ?? '').trim(), am = String(valores?.am?.[prazo] ?? '').trim()
    if (aa && am) return { ok: false, error: `No prazo de ${prazo} meses, preencha o custo ao ano ou ao mês, não os dois.` }
    if (!aa && !am) continue
    const v = num(aa || am)
    const limite = aa ? 100 : 10
    if (v === null || v <= 0 || v >= limite) return { ok: false, error: `Custo inválido no prazo de ${prazo} meses. Use o formato ${aa ? '15,58' : '1,21'}.` }
    taxas[prazo] = aa ? v : anoDoMes(v)
  }
  if (!Object.keys(taxas).length) return { ok: false, error: 'Preencha o custo de pelo menos um prazo.' }
  return { ok: true, tabela: [{ id: `digitada-${hoje}`, label: 'Custo digitado', inicio: hoje, fim: null, taxas }] }
}

// Vigência padrão: a que vale hoje; senão a mais recente já iniciada; senão a primeira.
export const vigenciaDeHoje = (tabela, hoje) => tabela.find(v => v.inicio <= hoje && (!v.fim || hoje <= v.fim))
  ?? tabela.find(v => v.inicio <= hoje) ?? tabela[0]

const valida = t => Array.isArray(t) && t.length > 0 && t.every(v => v && typeof v.id === 'string' && typeof v.label === 'string'
  && typeof v.inicio === 'string' && v.taxas && Object.keys(v.taxas).length >= 1 && Object.values(v.taxas).every(Number.isFinite))
const ISO = /^\d{4}-\d{2}-\d{2}$/

// Validade sugerida: o fim mais tardio das vigências da tabela colada (ex.: "26/11 até 02/12" → 02/12). Digitada: nenhuma.
export const validadePadrao = tabela => tabela.map(v => v.fim).filter(Boolean).sort().at(-1) ?? ''

// "Válido até" informado (aaaa-mm-dd, do campo de data) → { ok, validoAte } ou { ok: false, error }.
export function lerValidade(valor, hoje) {
  const v = String(valor ?? '').trim()
  if (!v) return { ok: false, error: 'Informe até quando vale o funding (válido até).' }
  if (!ISO.test(v) || Number.isNaN(Date.parse(v))) return { ok: false, error: 'Data de validade inválida.' }
  if (v < hoje) return { ok: false, error: 'A data de validade já passou. Informe hoje ou uma data futura.' }
  return { ok: true, validoAte: v }
}

// Vale até o fim do dia "válido até": no próprio dia ainda vale; no dia seguinte, venceu.
export const fundingVencido = (validoAte, hoje) => hoje > validoAte

// Salvo → { tabela, validoAte } se ainda vale; vencido → apaga e devolve { tabela: null, vencidoEm }; nada → { tabela: null }.
// A data do vencido fica lembrada enquanto a página estiver aberta (a tela pode montar mais de uma vez), até salvar outro.
let vencidoEm = null
export function carregarFunding(hoje) {
  let salvo = null
  try { salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') } catch { /* sem armazenamento ou dado estragado */ }
  if (!salvo || !valida(salvo.tabela) || typeof salvo.validoAte !== 'string' || !ISO.test(salvo.validoAte)) return vencidoEm ? { tabela: null, vencidoEm } : { tabela: null }
  if (fundingVencido(salvo.validoAte, hoje)) { guardarFunding(null); vencidoEm = salvo.validoAte; return { tabela: null, vencidoEm } }
  return { tabela: salvo.tabela, validoAte: salvo.validoAte }
}
export function guardarFunding(tabela, validoAte) {
  if (tabela) vencidoEm = null
  try {
    if (tabela) localStorage.setItem(CHAVE, JSON.stringify({ validoAte, tabela })); else localStorage.removeItem(CHAVE)
    sessionStorage.removeItem(CHAVE) // a versão anterior guardava só na aba, sem validade
  } catch { /* sem armazenamento: vale só enquanto a tela estiver aberta */ }
}

// Funding ao ano (%) para o prazo: o do prazo exato; entre dois prazos da tabela, reta entre eles; fora dela, o da ponta.
export function fundingDoPrazo(vigencia, prazo) {
  const prazos = Object.keys(vigencia.taxas).map(Number).sort((a, b) => a - b)
  if (prazo <= prazos[0]) return { taxa: vigencia.taxas[prazos[0]], nota: prazo < prazos[0] ? `prazo abaixo da tabela: usado o de ${prazos[0]} meses` : null }
  if (prazo >= prazos.at(-1)) return { taxa: vigencia.taxas[prazos.at(-1)], nota: prazo > prazos.at(-1) ? `prazo acima da tabela: usado o de ${prazos.at(-1)} meses` : null }
  const hi = prazos.findIndex(p => p >= prazo), b = prazos[hi], a = prazos[hi - 1]
  if (b === prazo) return { taxa: vigencia.taxas[b], nota: null }
  return { taxa: vigencia.taxas[a] + (vigencia.taxas[b] - vigencia.taxas[a]) * (prazo - a) / (b - a), nota: `interpolado entre ${a} e ${b} meses` }
}

// Spread composto: (1 + taxa ao ano) = (1 + funding ao ano) × (1 + spread ao ano). Taxas em %.
// A conta se inverte exatamente, então a taxa a partir do spread não precisa de "atingir meta".
export const spreadDaTaxa = (taxaAm, fundingAa) => ((1 + taxaAm / 100) ** 12 / (1 + fundingAa / 100) - 1) * 100
export const taxaDoSpread = (spreadAa, fundingAa) => (((1 + fundingAa / 100) * (1 + spreadAa / 100)) ** (1 / 12) - 1) * 100
