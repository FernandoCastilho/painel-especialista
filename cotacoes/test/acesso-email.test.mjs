// Tela de entrada por e-mail: regras do navegador e o script do Google (simulado, sem rede).
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { createHmac } from 'node:crypto'
import { chamar, codigoValido, emailValido, exigirAcesso, guardarAcesso, lerAcesso, limparAcesso, normalizarEmail } from '../src/acessoEmail.js'

test('e-mail válido: aceita endereços comuns e recusa os malformados', () => {
  for (const ok of ['a@b.co', 'nome.sobrenome@empresa.com.br', ' Fulano+x@Itau.COM.br ']) assert.equal(emailValido(ok), true, ok)
  for (const ruim of ['', 'semarroba', 'a@b', 'a@@b.com', 'a b@c.com', '@b.com', 'a@.com', 'a@b.c', 'a@b.com,c@d.com', `${'a'.repeat(250)}@b.com`, null, undefined]) assert.equal(emailValido(ruim), false, String(ruim))
  assert.equal(normalizarEmail('  Ana@X.COM '), 'ana@x.com')
})

test('código: exatamente 6 números', () => {
  assert.equal(codigoValido('012345'), true)
  for (const ruim of ['12345', '1234567', 'abcdef', '12 345', '']) assert.equal(codigoValido(ruim), false)
})

test('tela só liga no endereço publicado, com o endereço do script e fora de navegador automatizado', () => {
  const u = 'https://script.google.com/x/exec'
  const h = 'fernandocastilho.github.io'
  assert.equal(exigirAcesso({ url: '', hostname: h, webdriver: false }), false)
  assert.equal(exigirAcesso({ url: u, hostname: h, webdriver: true }), false)
  assert.equal(exigirAcesso({ url: u, hostname: '127.0.0.1', webdriver: false }), false, 'testes e prévia locais abrem direto')
  assert.equal(exigirAcesso({ url: u, hostname: h, webdriver: false }), true)
})

test('acesso guardado: lê, grava, limpa e ignora lixo', () => {
  const mem = new Map()
  const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) }
  assert.equal(lerAcesso(st), null)
  guardarAcesso({ email: 'A@b.com', token: 't' }, st)
  assert.deepEqual(lerAcesso(st), { email: 'a@b.com', token: 't' })
  mem.set('painel-acesso', '{"email":"nao-e-email","token":"t"}')
  assert.equal(lerAcesso(st), null)
  mem.set('painel-acesso', 'não é json')
  assert.equal(lerAcesso(st), null)
  guardarAcesso({ email: 'a@b.com', token: 't' }, st); limparAcesso(st)
  assert.equal(lerAcesso(st), null)
})

test('chamada ao script: monta o endereço e trata falha de rede sem liberar o acesso', async () => {
  let pedido
  const ok = await chamar('pedir', { email: 'a@b.com' }, { url: 'https://s/exec', fetchFn: async (u) => { pedido = u; return { json: async () => ({ ok: true }) } } })
  assert.equal(ok.ok, true)
  assert.equal(pedido, 'https://s/exec?acao=pedir&email=a%40b.com')
  const falha = await chamar('pedir', {}, { url: 'https://s/exec', fetchFn: async () => { throw new Error('rede') } })
  assert.equal(falha.ok, false)
  assert.equal(falha.rede, true)
})

// ---- Script do Google, rodado com peças simuladas ----
function criarScript({ bloqueados = [], diretos = [] } = {}) {
  const cache = new Map()
  const props = new Map()
  const emails = []
  let cota = 100
  // Abas simuladas: cada uma guarda as linhas (a primeira é o título).
  const abas = new Map()
  const novaAba = (nome) => {
    const rows = []
    const aba = { rows, getLastRow: () => rows.length, appendRow: (r) => rows.push(r), getRange: (l, c, n) => ({ getValues: () => rows.slice(l - 1, l - 1 + n).map((r) => [r[c - 1]]) }) }
    abas.set(nome, aba)
    return aba
  }
  const dir = novaAba('Entrada direta'); dir.appendRow(['E-mail sem código']); diretos.forEach((e) => dir.appendRow([e]))
  const bloq = novaAba('Bloqueados'); bloq.appendRow(['E-mail bloqueado']); bloqueados.forEach((e) => bloq.appendRow([e]))
  const ambiente = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ texto: t }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    MailApp: { getRemainingDailyQuota: () => cota, sendEmail: (m) => { emails.push(m) } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => abas.get(n) ?? null, insertSheet: (n) => novaAba(n) }) },
    Utilities: {
      getUuid: () => Math.random().toString(16).slice(2),
      computeHmacSha256Signature: (msg, chave) => [...createHmac('sha256', chave).update(msg).digest()],
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
    },
    JSON, Math, String, Number, Date, Error,
  }
  vm.createContext(ambiente)
  vm.runInContext(readFileSync(new URL('../../docs/cadastro-email/cadastro.gs', import.meta.url), 'utf8'), ambiente)
  const chamarScript = (parameter) => JSON.parse(ambiente.doGet({ parameter }).texto)
  const linhasDe = (nome) => (abas.get(nome)?.rows ?? []).slice(1)
  return { chamarScript, emails, bloq, linhasDe, get linhas() { return linhasDe('Acessos') }, setCota: (n) => { cota = n } }
}
const codigoDoEmail = (emails) => emails.at(-1).body.match(/é (\d{6})\./)[1]

test('script: fluxo completo — pede, erra, confirma, recebe assinatura e registra', () => {
  const s = criarScript()
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'Ana@Empresa.com' }).ok, true)
  assert.equal(s.emails.length, 1)
  assert.equal(s.emails[0].to, 'ana@empresa.com')
  const cod = codigoDoEmail(s.emails)
  const errado = cod === '000000' ? '111111' : '000000'
  assert.equal(s.chamarScript({ acao: 'confirmar', email: 'ana@empresa.com', codigo: errado }).ok, false)
  assert.equal(s.linhas.length, 1, 'código errado não registra além da solicitação')
  const r = s.chamarScript({ acao: 'confirmar', email: 'ana@empresa.com', codigo: cod })
  assert.equal(r.ok, true)
  assert.ok(r.token)
  assert.equal(s.linhas.length, 2)
  assert.equal(s.linhas[0][1], 'ana@empresa.com')
  assert.equal(s.chamarScript({ acao: 'confirmar', email: 'ana@empresa.com', codigo: cod }).ok, false, 'código só vale uma vez')
  assert.equal(s.chamarScript({ acao: 'visita', email: 'ana@empresa.com', token: r.token }).ok, true)
  assert.equal(s.chamarScript({ acao: 'visita', email: 'outro@empresa.com', token: r.token }).ok, false, 'assinatura de outro e-mail não vale')
  assert.equal(s.chamarScript({ acao: 'visita', email: 'ana@empresa.com', token: 'falso' }).ok, false)
})

test('script: recusa e-mail inválido, trava tentativas e limita pedidos', () => {
  const s = criarScript()
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'invalido' }).ok, false)
  assert.equal(s.emails.length, 0)
  s.chamarScript({ acao: 'pedir', email: 'b@c.com' })
  const cod = codigoDoEmail(s.emails)
  const errado = cod === '000000' ? '111111' : '000000'
  for (let i = 0; i < 5; i++) s.chamarScript({ acao: 'confirmar', email: 'b@c.com', codigo: errado })
  assert.equal(s.chamarScript({ acao: 'confirmar', email: 'b@c.com', codigo: cod }).ok, false, 'após 5 erros o código acerta mas já foi travado')
  for (let i = 0; i < 4; i++) s.chamarScript({ acao: 'pedir', email: 'b@c.com' })
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'b@c.com' }).ok, false, 'sexto pedido na hora é barrado')
})

test('script: sem cota diária de e-mails avisa e não envia', () => {
  const s = criarScript()
  s.setCota(0)
  const r = s.chamarScript({ acao: 'pedir', email: 'd@e.com' })
  assert.equal(r.ok, false)
  assert.equal(s.emails.length, 0)
})

test('script: qualquer e-mail recebe código e, ao confirmar, entra sozinho na aba Liberados (sem repetir)', () => {
  const s = criarScript()
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'Novo@X.com' }).ok, true)
  assert.equal(s.emails.length, 1)
  assert.equal(s.linhasDe('Liberados').length, 0, 'só pedir o código não libera')
  const t = s.chamarScript({ acao: 'confirmar', email: 'novo@x.com', codigo: codigoDoEmail(s.emails) })
  assert.equal(t.ok, true)
  assert.equal(s.linhasDe('Liberados').length, 1)
  assert.equal(s.linhasDe('Liberados')[0][0], 'novo@x.com')
  assert.ok(s.linhasDe('Liberados')[0][1] instanceof Date)
  s.chamarScript({ acao: 'pedir', email: 'novo@x.com' })
  assert.equal(s.chamarScript({ acao: 'confirmar', email: 'novo@x.com', codigo: codigoDoEmail(s.emails) }).ok, true)
  assert.equal(s.linhasDe('Liberados').length, 1, 'segunda confirmação não duplica')
  assert.equal(s.linhas.filter((l) => l[2] === 'cadastro').length, 2, 'cada confirmação fica registrada em Acessos')
})

test('script: e-mail bloqueado não recebe código; quem é bloqueado depois perde o acesso', () => {
  const s = criarScript({ bloqueados: ['Estranho@x.com'] })
  const r = s.chamarScript({ acao: 'pedir', email: 'estranho@x.com' })
  assert.equal(r.ok, false)
  assert.match(r.erro, /bloqueado/)
  assert.equal(s.emails.length, 0, 'nenhum código enviado')
  s.chamarScript({ acao: 'pedir', email: 'ana@empresa.com' })
  const t = s.chamarScript({ acao: 'confirmar', email: 'ana@empresa.com', codigo: codigoDoEmail(s.emails) })
  assert.equal(t.ok, true)
  s.bloq.appendRow(['ana@empresa.com'])
  const antes = s.linhas.length
  assert.equal(s.chamarScript({ acao: 'visita', email: 'ana@empresa.com', token: t.token }).ok, false)
  assert.equal(s.linhas.length, antes)
})

test('script: e-mail da aba Entrada direta entra sem código, fica registrado e pode ser bloqueado', () => {
  const s = criarScript({ diretos: ['Colega@Banco.com.br'] })
  const r = s.chamarScript({ acao: 'pedir', email: 'colega@banco.com.br' })
  assert.equal(r.ok, true)
  assert.ok(r.token, 'devolve a assinatura na hora')
  assert.equal(s.emails.length, 0, 'nenhum código enviado')
  assert.equal(s.linhasDe('Liberados')[0][0], 'colega@banco.com.br')
  assert.equal(s.linhas.at(-1)[2], 'entrada direta')
  assert.equal(s.chamarScript({ acao: 'visita', email: 'colega@banco.com.br', token: r.token }).ok, true)
  const outro = s.chamarScript({ acao: 'pedir', email: 'outro@banco.com.br' })
  assert.equal(outro.token, undefined, 'quem não está na aba recebe código')
  s.bloq.appendRow(['colega@banco.com.br'])
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'colega@banco.com.br' }).ok, false, 'bloqueio vale mais que entrada direta')
})


test('script: cada nova solicitação gera uma linha antes do OTP, inclusive cadastrado e direto', () => {
  const s = criarScript({ diretos: ['direto@x.com'] })
  for (const email of ['novo@x.com', 'direto@x.com']) {
    for (let i = 0; i < 3; i++) {
      const pedido = `pedido_valido_${email[0]}_${i}`
      const r = s.chamarScript({ acao: 'pedir', email, pedido })
      assert.equal(r.ok, true)
      assert.deepEqual(s.chamarScript({ acao: 'pedir', email, pedido }), r)
      if (email === 'novo@x.com' && i === 0) s.chamarScript({ acao: 'confirmar', email, codigo: codigoDoEmail(s.emails) })
    }
    assert.equal(s.linhas.filter(l => l[1] === email && l[2] === 'solicitacao').length, 3)
  }
  assert.equal(s.emails.length, 3, 'repetição do mesmo ID não reenvia código')
  assert.equal(s.linhasDe('Liberados').length, 2)
})

test('script: inválido e bloqueado não contam; cota esgotada é tentativa, não sucesso', () => {
  const s = criarScript({ bloqueados: ['bloqueado@x.com'] })
  for (const email of ['invalido', 'bloqueado@x.com']) s.chamarScript({ acao: 'pedir', email })
  assert.equal(s.linhas.length, 0)
  s.setCota(0)
  assert.equal(s.chamarScript({ acao: 'pedir', email: 'valido@x.com' }).ok, false)
  assert.equal(s.linhas.length, 1)
  assert.equal(s.linhas[0][2], 'solicitacao')
  assert.equal(s.emails.length, 0)
})
