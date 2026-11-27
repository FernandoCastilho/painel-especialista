import { useEffect, useState } from 'react'
import { DATA_BASE } from './useQuotes.js'
import { DATA_POLL_MS, startVisiblePolling } from './visiblePolling.js'

// Notícias publicadas perto de um horário (a máxima ou a mínima do dia): de 1 hora antes a 30 minutos depois.
// Mostram o que saiu na imprensa naquele momento; não comprovam a causa do movimento.
export const PERTO_ANTES = 60 * 60000
export const PERTO_DEPOIS = 30 * 60000
export const PERTO_LIMITE = 3

const chave = (n) => String(n.title ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, ' ').trim()

// Página de conversão de moeda (corretoras de cripto), não notícia.
const CONVERSOR = /\bconverter\b|\bpara usd\b|\bem usd\b/i
// Propaganda com o dólar no título (abra sua conta, cashback, cupom...).
const PROPAGANDA = /\babra sua conta\b|\bcashback\b|\bcupom\b|\bmelhores apps\b/i
export const descartavel = (title, faixa) => CONVERSOR.test(title) || PROPAGANDA.test(title) || citaOutroNivel(title, faixa)
// Cotação citada no título (ex.: "fecha a R$ 5,91"): fora da faixa do dia, a manchete é de outro dia, reindexada.
const COTACAO = /R\$\s?(\d+,\d{2,4})/g
export function citaOutroNivel(title, faixa) {
  if (!faixa) return false
  const [lo, hi] = faixa
  for (const m of String(title ?? '').matchAll(COTACAO)) {
    const v = Number(m[1].replace(',', '.'))
    if (v >= 1 && v <= 20 && (v < lo * 0.97 || v > hi * 1.03)) return true
  }
  return false
}

// `listas`: listas de manchetes ({ t, title, link, source, semHora? }). Até `limite`, as mais próximas do horário, em ordem de horário.
// `faixa`: [mínima, máxima] do dia, para descartar manchete que cita cotação de outro dia.
export function noticiasPerto(listas, t, { antes = PERTO_ANTES, depois = PERTO_DEPOIS, limite = PERTO_LIMITE, faixa } = {}) {
  if (!Number.isFinite(t)) return []
  const vistos = new Set()
  const out = []
  for (const n of listas.flat()) {
    if (!n?.title || !/^https?:\/\//.test(n.link ?? '') || n.semHora || !Number.isFinite(n.t)) continue
    if (n.t < t - antes || n.t > t + depois) continue
    if (descartavel(n.title, faixa)) continue
    const k = chave(n)
    if (vistos.has(n.link) || vistos.has(k)) continue
    vistos.add(n.link)
    vistos.add(k)
    out.push(n)
  }
  return out.sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t)).slice(0, limite).sort((a, b) => a.t - b.t)
}

// Manchetes do dia coletadas de 15 em 15 minutos junto com as cotações (fx-agora.json, na mesma origem do intraday.json).
export function useFxAgora(ativo) {
  const [estado, setEstado] = useState(null)
  useEffect(() => {
    if (!ativo) return undefined
    let vivo = true
    const carregar = async () => {
      try {
        const r = await fetch(`${DATA_BASE ? `${DATA_BASE}/` : './'}fx-agora.json?t=${Math.floor(Date.now() / 60000)}`)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const arq = await r.json()
        if (vivo && Array.isArray(arq?.itens)) setEstado(arq)
      } catch { /* sem o arquivo, o gráfico usa só as manchetes de hora em hora */ }
    }
    const parar = startVisiblePolling(carregar, DATA_POLL_MS)
    return () => { vivo = false; parar() }
  }, [ativo])
  return ativo ? estado : null
}

// Bolinhas de um dia guardado (pregão fixado): uma manchete por hora entre `t0` e `t1`, a melhor de cada hora
// (Valor Econômico e manchete que começa pelo dólar primeiro), para o gráfico contar o dia sem amontoar bolinhas.
export function destaquesPorHora(itens, t0, t1, faixa) {
  const porHora = new Map()
  const nota = (n) => (n.source === 'Valor Econômico' ? 2 : 0) + (/^d[oó]lar\b/i.test(n.title) ? 1 : 0)
  for (const n of itens ?? []) {
    if (!n?.title || !/^https?:\/\//.test(n.link ?? '') || n.semHora || !Number.isFinite(n.t) || n.t < t0 || n.t > t1) continue
    if (descartavel(n.title, faixa)) continue
    const h = Math.floor(n.t / 36e5)
    const atual = porHora.get(h)
    if (!atual || nota(n) > nota(atual)) porHora.set(h, n)
  }
  return [...porHora.values()].sort((a, b) => a.t - b.t)
}
