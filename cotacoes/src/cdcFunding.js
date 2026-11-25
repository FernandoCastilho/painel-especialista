// Tabela de funding do CDC (pedido de Fernando, 25/11/2026): não fica no código. O usuário cola as células do Excel no
// formato da planilha FUNDING (prazo em meses | taxas a.a. por vigência | taxas a.m. por vigência | linha SELIC) e a tabela
// fica só nesta aba do navegador (sessionStorage): fechou, apagou. Usa só as colunas ao ano; a linha SELIC é ignorada.
const CHAVE = 'cdc-funding'
const VIGENCIA = /(\d{1,2})\/(\d{1,2})\s*(?:até|a|-)\s*(\d{1,2})\/(\d{1,2})/i
const num = celula => {
  let t = String(celula ?? '').trim().replace('%', '').trim()
  t = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null
}
const iso = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Texto colado do Excel (células separadas por tabulação) → { ok, tabela: [{ id, label, fim, taxas: { prazo: % a.a. } }] }.
// `hoje` (AAAA-MM-DD) dá o ano das vigências "dd/mm até dd/mm".
export function lerFunding(texto, hoje) {
  const linhas = String(texto ?? '').split(/\r?\n/).map(l => l.split('\t').map(c => c.trim())).filter(l => l.some(Boolean))
  const cabecalho = linhas.find(l => l.some(c => VIGENCIA.test(c)))
  const labels = cabecalho ? cabecalho.filter(c => VIGENCIA.test(c)) : []
  const temMensal = linhas.some(l => l.some(c => /a\.?\s*m\.?/i.test(c)))
  // Com as colunas ao mês ao lado (como na planilha), as vigências se repetem: as primeiras são as ao ano.
  const nAnual = labels.length ? (temMensal && labels.length % 2 === 0 ? labels.length / 2 : labels.length) : 1
  const dados = linhas.map(l => { const i = l.findIndex(c => /^\d{1,3}$/.test(c)); return i < 0 ? null : [Number(l[i]), l.slice(i + 1).filter(Boolean)] })
    .filter(Boolean)
  if (dados.length < 2) return { ok: false, error: 'Não achei a tabela. Copie no Excel as células do prazo até as taxas (sem a linha SELIC, se quiser) e cole aqui.' }
  const ano = Number(hoje.slice(0, 4))
  const tabela = []
  for (let k = 0; k < nAnual; k++) {
    const taxas = {}
    for (const [prazo, celulas] of dados) {
      const v = num(celulas[k])
      if (v === null || v <= 0 || v >= 100) return { ok: false, error: `Taxa inválida no prazo de ${prazo} meses. Use o formato 15,58%.` }
      taxas[prazo] = v
    }
    const m = labels[k]?.match(VIGENCIA)
    const inicio = m ? iso(ano, m[2], m[1]) : hoje
    const fimMesmoAno = m ? iso(ano, m[4], m[3]) : null
    const fim = fimMesmoAno && fimMesmoAno < inicio ? iso(ano + 1, m[4], m[3]) : fimMesmoAno
    tabela.push({ id: `${k}-${inicio}`, label: m ? labels[k] : 'Tabela colada', inicio, fim, taxas })
  }
  // A vigência mais recente primeiro: é a padrão da tela.
  tabela.sort((a, b) => b.inicio.localeCompare(a.inicio))
  return { ok: true, tabela }
}

export function carregarFunding() {
  try { const t = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null'); return Array.isArray(t) && t.length ? t : null } catch { return null }
}
export function guardarFunding(tabela) {
  try { if (tabela) sessionStorage.setItem(CHAVE, JSON.stringify(tabela)); else sessionStorage.removeItem(CHAVE) } catch { /* sem armazenamento: vale só enquanto a tela estiver aberta */ }
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
