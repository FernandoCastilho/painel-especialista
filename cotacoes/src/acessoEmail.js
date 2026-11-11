// Entrada por e-mail com código de confirmação. A lista de quem entrou fica numa planilha do Google do Fernando
// (script em docs/cadastro-email/cadastro.gs). Sem endereço do script configurado, a tela não aparece.
// Aviso honesto: o painel é uma página pública; isto registra e filtra quem usa o site normalmente,
// mas não é uma trava de segurança contra quem sabe mexer no navegador.
import { ACESSO_URL } from './acessoConfig.js'
import { SITE_HOST } from './acessos.js'

export const CHAVE = 'painel-acesso'
const FORMATO = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]{2,}$/

export const normalizarEmail = (v) => String(v ?? '').trim().toLowerCase()
export const emailValido = (v) => { const e = normalizarEmail(v); return e.length <= 254 && FORMATO.test(e) }
export const codigoValido = (v) => /^\d{6}$/.test(String(v ?? '').trim())

// A tela só vale no endereço publicado do painel, com o script configurado e fora de navegador automatizado.
// No computador do desenvolvedor, nas prévias e nos testes automáticos o painel abre direto.
export const exigirAcesso = ({ url = ACESSO_URL, hostname = typeof location !== 'undefined' ? location.hostname : '', webdriver = typeof navigator !== 'undefined' && navigator.webdriver } = {}) => !!url && hostname === SITE_HOST && !webdriver

export function lerAcesso(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    const v = JSON.parse(storage?.getItem(CHAVE) ?? 'null')
    return v && emailValido(v.email) && typeof v.token === 'string' && v.token ? { email: normalizarEmail(v.email), token: v.token } : null
  } catch { return null }
}
export function guardarAcesso(acesso, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { storage?.setItem(CHAVE, JSON.stringify(acesso)) } catch { /* sem armazenamento: pede de novo na próxima visita */ }
}
export function limparAcesso(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { storage?.removeItem(CHAVE) } catch { /* nada a limpar */ }
}

// Chamada ao script (GET com parâmetros: é o que o Google aceita de uma página de outro endereço).
// Devolve { ok, ... } ou { ok: false, erro, rede: true } quando não foi possível falar com o script.
export async function chamar(acao, params, { url = ACESSO_URL, fetchFn = globalThis.fetch } = {}) {
  try {
    const q = new URLSearchParams({ acao, ...params })
    const r = await fetchFn(`${url}${url.includes('?') ? '&' : '?'}${q}`, { cache: 'no-store' })
    const d = await r.json()
    return d && typeof d === 'object' ? d : { ok: false, erro: 'Resposta inesperada.', rede: true }
  } catch {
    return { ok: false, erro: 'Não foi possível falar com o servidor agora. Tente de novo.', rede: true }
  }
}
export const pedirCodigo = (email, opts) => chamar('pedir', { email: normalizarEmail(email) }, opts)
export const confirmarCodigo = (email, codigo, opts) => chamar('confirmar', { email: normalizarEmail(email), codigo: String(codigo).trim() }, opts)
export const registrarVisita = (acesso, opts) => chamar('visita', acesso, opts)

// Uma tentativa por e-mail/credencial nesta abertura do documento. A promessa é
// compartilhada para não duplicar por efeitos React, remontagem ou navegação interna.
// Não repetir falhas de rede automaticamente: o servidor pode já ter gravado a linha.
export function criarRegistroDaAbertura(registrar = registrarVisita) {
  const registros = new Map()
  return (acesso) => {
    const email = normalizarEmail(acesso.email)
    const anterior = registros.get(email)
    if (anterior?.token === acesso.token) return anterior.pedido
    const pedido = Promise.resolve().then(() => registrar(acesso))
    registros.set(email, { token: acesso.token, pedido })
    return pedido
  }
}
export const registrarVisitaDaAbertura = criarRegistroDaAbertura()
