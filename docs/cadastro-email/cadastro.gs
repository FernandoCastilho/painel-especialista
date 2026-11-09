// Script do Google (Apps Script) que recebe os pedidos da tela de entrada do painel.
// Cola-se dentro da planilha: Extensões > Apps Script. Passo a passo em LEIAME.md.
// Faz três coisas: envia o código de 6 números por e-mail, confere o código e registra quem entrou.

var LIMITE_PEDIDOS_POR_HORA = 5   // por e-mail
var LIMITE_TENTATIVAS = 5         // por código
var VALIDADE_CODIGO_S = 600       // 10 minutos

function doGet(e) {
  var p = (e && e.parameter) || {}
  try {
    if (p.acao === 'pedir') return resposta_(pedir_(p.email))
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

function pedir_(emailBruto) {
  var email = normalizar_(emailBruto)
  if (!emailValido_(email)) return { ok: false, erro: 'E-mail inválido.' }
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
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
        subject: 'Seu código de acesso ao Painel Especialista: ' + codigo,
        body: 'Seu código de acesso é ' + codigo + '.\n\nEle vale por 10 minutos. Se você não pediu, ignore esta mensagem.',
        name: 'Painel Especialista',
      })
    } catch (errEnvio) {
      return { ok: false, erro: 'Não foi possível enviar para este e-mail. Confira o endereço.' }
    }
    return { ok: true }
  } finally {
    lock.releaseLock()
  }
}

function confirmar_(emailBruto, codigoBruto) {
  var email = normalizar_(emailBruto)
  var codigo = String(codigoBruto || '').trim()
  if (!emailValido_(email) || !/^\d{6}$/.test(codigo)) return { ok: false, erro: 'Código incorreto.' }
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
    registrar_('cadastro', email)
    return { ok: true, token: token_(email) }
  } finally {
    lock.releaseLock()
  }
}

function visita_(emailBruto, token) {
  var email = normalizar_(emailBruto)
  if (!emailValido_(email) || String(token || '') !== token_(email)) return { ok: false, erro: 'Acesso não reconhecido.' }
  registrar_('visita', email)
  return { ok: true }
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
  var planilha = SpreadsheetApp.getActiveSpreadsheet()
  var aba = planilha.getSheetByName('Acessos')
  if (!aba) { aba = planilha.insertSheet('Acessos'); aba.appendRow(['Data e hora', 'E-mail', 'Tipo']) }
  aba.appendRow([new Date(), email, tipo])
}
