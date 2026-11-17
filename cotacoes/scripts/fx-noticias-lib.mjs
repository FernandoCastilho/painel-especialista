// Arquivo de manchetes por dia para as bolinhas do gráfico de câmbio (fx-noticias.json).
// Sem dependências: as funções puras daqui são testadas em test/fx-noticias.test.mjs.
import { FILING, canonicalSource, mentionsCurrency } from './news-lib.mjs'

export const FX_ARQUIVO = 'fx-noticias.json'
export const FX_MOEDAS = ['USD']
export const FX_ITENS_POR_DIA = 4
export const FX_RETENCAO_DIAS = 400

// Buscas em português, por dia. A busca por data do Google Notícias aceita after:/before:; o dia exato é conferido depois pelo horário de publicação.
export const FX_BUSCAS = {
  USD: ['dólar câmbio real', 'dólar site:valor.globo.com'],
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
// Manchete cujo assunto é outro ativo (ouro, açúcar, euro, ações...) e cita o dólar só de passagem fica de fora.
const OUTRO_ASSUNTO = /^(ouro|prata|acucar|cafe|soja|milho|trigo|algodao|cacau|boi|petroleo|brent|cobre|minerio|acoes|bitcoin|cripto|euro|iene|yuan|libra)\b/
const plano = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const chave = (s) => plano(s).replace(/[^a-z0-9]+/g, ' ').trim()
export const pontuar = (it) => (MOVIMENTO.test(plano(it.title)) ? 2 : 0) + (it.source === 'Valor Econômico' ? 1 : 0)

// Escolhe até `limite` manchetes do dia: só as publicadas naquele dia (Brasília), que falam da moeda, sem repetir título.
export function escolherDoDia(itens, dia, code, limite = FX_ITENS_POR_DIA) {
  const vistos = new Set()
  const validos = []
  for (const it of itens) {
    if (!it?.title || !/^https?:\/\//.test(it.link ?? '') || !Number.isFinite(it.t) || it.t <= 0) continue
    if (diaBrasilia(it.t) !== dia || FILING.test(it.title) || !mentionsCurrency(code, it.title) || VALOR_EM_DOLAR.test(plano(it.title)) || OUTRO_ASSUNTO.test(plano(it.title).trim())) continue
    const k = chave(it.title)
    if (vistos.has(k)) continue
    vistos.add(k)
    // Busca por data devolve muitas matérias antigas só com o dia (horário cheio, ex.: 07:00:00 GMT): a hora não é confiável.
    const semHora = it.t % 36e5 === 0
    validos.push({ title: it.title, link: it.link, source: it.source || canonicalSource(it), t: it.t, ...(semHora ? { semHora } : {}) })
  }
  return validos.sort((a, b) => pontuar(b) - pontuar(a) || a.t - b.t).slice(0, limite)
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
