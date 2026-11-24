// Arquivo de manchetes por dia para as bolinhas do gráfico de câmbio (fx-noticias.json).
// Sem dependências: as funções puras daqui são testadas em test/fx-noticias.test.mjs.
import { FILING, canonicalSource, mentionsCurrency } from './news-lib.mjs'

export const FX_ARQUIVO = 'fx-noticias.json'
// MERCADO: manchetes gerais do dia (bolsa, juros, dólar, exterior). Completam o quadro quando a moeda tem pouca notícia própria.
export const FX_MOEDAS = ['USD', 'EUR', 'JPY', 'CNH', 'MERCADO']
export const FX_ITENS_POR_DIA = 4
export const FX_RETENCAO_DIAS = 400

// Buscas em português, por dia. A busca por data do Google Notícias aceita after:/before:; o dia exato é conferido depois pelo horário de publicação.
export const FX_BUSCAS = {
  USD: ['dólar câmbio real', 'dólar site:valor.globo.com'],
  EUR: ['euro câmbio real', 'euro BCE moeda'],
  JPY: ['iene câmbio', 'iene Banco do Japão'],
  CNH: ['yuan câmbio China', 'yuan PBOC moeda chinesa'],
  MERCADO: ['Ibovespa dólar juros fecha', 'mercado financeiro bolsa dólar site:valor.globo.com'],
}

const TZ = 'America/Sao_Paulo'
export const diaBrasilia = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
const somaDias = (dia, n) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

// Dias úteis (segunda a sexta) dos últimos `n` dias corridos, do mais antigo para o mais recente, terminando em `hoje`.
export function diasUteis(n, agora = Date.now()) {
  const hoje = diaBrasilia(agora)
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const dia = somaDias(hoje, -i)
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay()
    if (semana !== 0 && semana !== 6) out.push(dia)
  }
  return out
}

// Janela de busca com um dia de folga em cada lado (fuso); o filtro por dia de Brasília vem depois.
export const urlBuscaDia = (q, dia) => {
  const termo = `${q} after:${somaDias(dia, -1)} before:${somaDias(dia, 1)}`
  return `https://news.google.com/rss/search?q=${encodeURIComponent(termo)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
}

// Manchete que fala do movimento do dia (fecha, sobe, cai...) vem antes das demais.
const MOVIMENTO = /\b(fecha|fechou|sobe|subiu|cai|caiu|recua|recuou|avanca|avancou|dispara|disparou|despenca|despencou|salta|saltou|renova|alta|queda|maior|menor)\b/
// "Bilhões de dólares" é valor em dinheiro, não câmbio (ex.: matéria de empresa).
const VALOR_EM_DOLAR = /\b(mil|milhao|milhoes|bilhao|bilhoes|trilhao|trilhoes|bi|mi|tri) de dolares\b/
// Manchete cujo assunto é outro ativo (ouro, açúcar, outra moeda, ações...) e cita a moeda só de passagem fica de fora.
// A própria moeda não conta como "outro assunto"; as manchetes gerais de mercado (MERCADO) não passam por esse filtro.
const ATIVOS = ['ouro', 'prata', 'acucar', 'cafe', 'soja', 'milho', 'trigo', 'algodao', 'cacau', 'boi', 'petroleo', 'brent', 'cobre', 'minerio', 'acoes', 'bitcoin', 'cripto', 'libra', 'euro', 'iene', 'yuan']
const PROPRIA = { USD: [], EUR: ['euro'], JPY: ['iene'], CNH: ['yuan'] }
// Manchete que começa por "dólar" vale para todas: o dólar mexe com o real e com as demais moedas no mesmo dia.
const outroAssunto = (code) => new RegExp(`^(${ATIVOS.filter((a) => !(PROPRIA[code] ?? []).includes(a)).join('|')})\\b`)
const OUTRO_ASSUNTO = Object.fromEntries(Object.keys(PROPRIA).map((c) => [c, outroAssunto(c)]))
const plano = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const chave = (s) => plano(s).replace(/[^a-z0-9]+/g, ' ').trim()
// Euro, iene e yuan: a manchete precisa citar a própria moeda (só "câmbio" não basta: costuma ser de outra moeda).
const PROPRIO_NOME = { EUR: /\b(euro|euros|bce)\b/, JPY: /\b(iene|ienes|yen|boj|banco do japao)\b/, CNH: /\b(yuan|iuane|renminbi|pboc)\b/ }
// Mercado do dia: manchetes do mercado brasileiro (bolsa, dólar, juros) vêm antes das de outros temas.
const MERCADO_BR = /\b(ibovespa|bolsa|dolar|juros|di|selic|copom|fiscal)\b/
export const pontuar = (it, code) => (MOVIMENTO.test(plano(it.title)) ? 2 : 0) + (it.source === 'Valor Econômico' ? 1 : 0) + (code === 'MERCADO' && MERCADO_BR.test(plano(it.title)) ? 2 : 0)

// Escolhe até `limite` manchetes do dia: só as publicadas naquele dia (Brasília), que falam da moeda, sem repetir título.
export function escolherDoDia(itens, dia, code, limite = FX_ITENS_POR_DIA) {
  const vistos = new Set()
  const validos = []
  for (const it of itens) {
    if (!it?.title || !/^https?:\/\//.test(it.link ?? '') || !Number.isFinite(it.t) || it.t <= 0) continue
    if (diaBrasilia(it.t) !== dia || FILING.test(it.title) || !mentionsCurrency(code, it.title) || VALOR_EM_DOLAR.test(plano(it.title)) || OUTRO_ASSUNTO[code]?.test(plano(it.title).trim()) || (PROPRIO_NOME[code] && !PROPRIO_NOME[code].test(plano(it.title)))) continue
    const k = chave(it.title)
    if (vistos.has(k)) continue
    vistos.add(k)
    // Busca por data devolve muitas matérias antigas só com o dia (horário cheio, ex.: 07:00:00 GMT): a hora não é confiável.
    const semHora = it.t % 36e5 === 0
    validos.push({ title: it.title, link: it.link, source: it.source || canonicalSource(it), t: it.t, ...(semHora ? { semHora } : {}) })
  }
  return validos.sort((a, b) => pontuar(b, code) - pontuar(a, code) || a.t - b.t).slice(0, limite)
}

const vazio = () => ({ generatedAt: 0, fonte: 'Google Notícias (busca por data)', moedas: {} })

// Junta arquivos (base do git, publicado anterior, coleta nova). Para o mesmo dia, as manchetes se somam e são reescolhidas.
// Dias mais velhos que a retenção saem. Arquivo inválido é ignorado (nunca apaga o que veio dos outros).
export function juntar(arquivos, agora = Date.now(), retencao = FX_RETENCAO_DIAS) {
  const corte = diaBrasilia(agora - retencao * 864e5)
  const out = vazio()
  for (const arq of arquivos) {
    for (const [code, m] of Object.entries(arq?.moedas ?? {})) {
      if (!m?.dias || typeof m.dias !== 'object') continue
      const destino = (out.moedas[code] ??= { dias: {} }).dias
      for (const [dia, d] of Object.entries(m.dias)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia) || dia < corte || !Array.isArray(d?.itens)) continue
        const antes = destino[dia]?.itens ?? []
        const itens = escolherDoDia([...antes, ...d.itens], dia, code)
        if (itens.length) destino[dia] = { itens, coletadoEm: Math.max(destino[dia]?.coletadoEm ?? 0, d.coletadoEm ?? 0) }
      }
    }
  }
  return out
}

export const contarDias = (arq) => Object.values(arq?.moedas ?? {}).reduce((n, m) => n + Object.keys(m?.dias ?? {}).length, 0)
