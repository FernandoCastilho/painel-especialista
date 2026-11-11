// Script do Google (Apps Script) que recebe os pedidos da tela de entrada do painel.
// Cola-se dentro da planilha: Extensões > Apps Script. Passo a passo em LEIAME.md.
// Faz quatro coisas: envia o código de 6 números para qualquer e-mail, confere o código,
// anota quem confirmou na aba "Liberados" (sem precisar de aprovação) e registra cada entrada na aba "Acessos".
// Para barrar alguém, ponha o e-mail na aba "Bloqueados". Quem está na aba "Entrada direta" entra sem código.

// Deixe vazio se o script foi colado dentro da planilha (Extensões > Apps Script).
// Preencha com o código da planilha (o trecho entre /d/ e /edit no endereço dela) se o script for um projeto separado.
var ID_PLANILHA = ''

var LIMITE_PEDIDOS_POR_HORA = 5   // por e-mail
var LIMITE_TENTATIVAS = 5         // por código
var VALIDADE_CODIGO_S = 600       // 10 minutos
var MSG_BLOQUEADO = 'Este e-mail está bloqueado. Fale com o administrador.'

function doGet(e) {
  var p = (e && e.parameter) || {}
  try {
    if (p.acao === 'pedir') return resposta_(pedir_(p.email, p.pedido))
    if (p.acao === 'confirmar') return resposta_(confirmar_(p.email, p.codigo))
    if (p.acao === 'visita') return resposta_(visita_(p.email, p.token))
    return resposta_({ ok: false, erro: 'Pedido desconhecido.' })
  } catch (err) {
    return resposta_({ ok: false, erro: 'Erro no servidor. Tente de novo em instantes.' })
  }
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function normalizar_(v) { return String(v || '').trim().toLowerCase() }
function emailValido_(e) {
  return e.length > 0 && e.length <= 254 && /^[^\s@<>()\[\],;:"\\]+@[^\s@<>()\[\],;:"\\]+\.[^\s@<>()\[\],;:"\\]{2,}$/.test(e)
}

// Solicitação é uma tentativa declarada, não prova de identidade ou acesso autenticado.
// O identificador evita repetir a mesma submissão; novas submissões têm novos IDs.
function pedir_(emailBruto, pedidoBruto) {
  var email = normalizar_(emailBruto)
  if (!emailValido_(email)) return { ok: false, erro: 'E-mail inválido.' }
  if (bloqueado_(email)) return { ok: false, erro: MSG_BLOQUEADO }
  var pedido = String(pedidoBruto || '')
  if (pedido && !/^[a-zA-Z0-9_-]{16,80}$/.test(pedido)) return { ok: false, erro: 'Pedido inválido.' }
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var cache = CacheService.getScriptCache()
    var chave = pedido ? 'pedido:' + token_(email) + ':' + pedido : ''
    var anterior = chave && cache.get(chave)
    if (anterior) return JSON.parse(anterior)
    registrar_('solicitacao', email)
    // Salva a deduplicação antes do envio: falha inesperada não duplica o registro.
    if (chave) cache.put(chave, JSON.stringify({ ok: false, erro: 'Pedido já recebido. Aguarde ou faça uma nova solicitação.' }), 600)
    var resposta = enviarPedido_(email)
    if (chave) cache.put(chave, JSON.stringify(resposta), 600)
    return resposta
  } finally {
    lock.releaseLock()
  }
}

function enviarPedido_(email) {
  if (entradaDireta_(email)) {
    liberar_(email)
    registrar_('entrada direta', email)
    return { ok: true, token: token_(email) }
  }
  var cache = CacheService.getScriptCache()
    var chaveQtd = 'qtd:' + email
    var qtd = Number(cache.get(chaveQtd) || 0)
    if (qtd >= LIMITE_PEDIDOS_POR_HORA) return { ok: false, erro: 'Muitos pedidos para este e-mail. Tente de novo em 1 hora.' }
    if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, erro: 'Limite diário de envios atingido. Tente amanhã.' }
    var codigo = ('000000' + Math.floor(Math.random() * 1000000)).slice(-6)
    cache.put('cod:' + email, JSON.stringify({ c: codigo, t: 0 }), VALIDADE_CODIGO_S)
    cache.put(chaveQtd, String(qtd + 1), 3600)
    try {
      MailApp.sendEmail({
        to: email,
        subject: 'Seu código de acesso ao PEME: ' + codigo,
        body: 'Seu código de acesso é ' + codigo + '.\n\nEle vale por 10 minutos. Se você não pediu, ignore esta mensagem.',
        name: 'PEME',
      })
    } catch (errEnvio) {
      return { ok: false, erro: 'Não foi possível enviar para este e-mail. Confira o endereço.' }
    }
    return { ok: true }
}

function confirmar_(emailBruto, codigoBruto) {
  var email = normalizar_(emailBruto)
  var codigo = String(codigoBruto || '').trim()
  if (!emailValido_(email) || !/^\d{6}$/.test(codigo)) return { ok: false, erro: 'Código incorreto.' }
  if (bloqueado_(email)) return { ok: false, erro: MSG_BLOQUEADO }
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var cache = CacheService.getScriptCache()
    var guardado = cache.get('cod:' + email)
    if (!guardado) return { ok: false, erro: 'Código vencido. Peça um novo.' }
    var d = JSON.parse(guardado)
    if (d.t >= LIMITE_TENTATIVAS) { cache.remove('cod:' + email); return { ok: false, erro: 'Muitas tentativas. Peça um novo código.' } }
    if (d.c !== codigo) {
      d.t += 1
      cache.put('cod:' + email, JSON.stringify(d), VALIDADE_CODIGO_S)
      return { ok: false, erro: 'Código incorreto.' }
    }
    cache.remove('cod:' + email)
    liberar_(email)
    registrar_('cadastro', email)
    return { ok: true, token: token_(email) }
  } finally {
    lock.releaseLock()
  }
}

function visita_(emailBruto, token) {
  var email = normalizar_(emailBruto)
  if (!emailValido_(email) || String(token || '') !== token_(email) || bloqueado_(email)) return { ok: false, erro: 'Acesso não reconhecido.' }
  registrar_('visita', email)
  return { ok: true }
}

// Aba "Liberados": quem já confirmou o código entra aqui sozinho (e-mail na coluna A, data na coluna B).
// Serve de cadastro de quem acessa; não é preciso aprovar ninguém.
function liberar_(email) {
  var aba = aba_('Liberados', ['E-mail liberado', 'Liberado em'])
  if (contem_(aba, email)) return
  aba.appendRow([email, new Date()])
}

// Aba "Bloqueados": um e-mail por linha na coluna A (a linha 1 é o título). Quem estiver aqui
// não recebe código e é barrado na próxima abertura do painel. Para desbloquear, apague a linha.
function bloqueado_(email) {
  return contem_(aba_('Bloqueados', ['E-mail bloqueado']), email)
}

// Aba "Entrada direta": um e-mail por linha na coluna A. Quem estiver aqui entra sem código:
// digita o e-mail e o painel abre. Cada entrada continua registrada em "Acessos".
function entradaDireta_(email) {
  return contem_(aba_('Entrada direta', ['E-mail sem código']), email)
}

function contem_(aba, email) {
  var n = aba.getLastRow()
  if (n < 2) return false
  var valores = aba.getRange(2, 1, n - 1, 1).getValues()
  for (var i = 0; i < valores.length; i++) if (normalizar_(valores[i][0]) === email) return true
  return false
}

function aba_(nome, titulo) {
  var planilha = planilha_()
  var aba = planilha.getSheetByName(nome)
  if (!aba) { aba = planilha.insertSheet(nome); aba.appendRow(titulo) }
  return aba
}

// Prova de que o e-mail foi confirmado: assinatura com uma chave secreta guardada só neste script.
function token_(email) {
  var props = PropertiesService.getScriptProperties()
  var segredo = props.getProperty('SEGREDO')
  if (!segredo) { segredo = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SEGREDO', segredo) }
  var bytes = Utilities.computeHmacSha256Signature(email, segredo)
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '')
}

function registrar_(tipo, email) {
  aba_('Acessos', ['Data e hora', 'E-mail', 'Tipo']).appendRow([new Date(), email, tipo])
}

function planilha_() {
  return ID_PLANILHA ? SpreadsheetApp.openById(ID_PLANILHA) : SpreadsheetApp.getActiveSpreadsheet()
}
