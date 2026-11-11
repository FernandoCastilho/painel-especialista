// Aviso ao Teams nas rotinas: executa o trecho real dos workflows com Teams e GitHub simulados. Não envia nada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const dir = new URL('../../.github/workflows/', import.meta.url)
const workflows = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => [f, readFileSync(new URL(f, dir), 'utf8')]))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const INICIO = '            // Aviso ao Teams: nunca falha em silêncio'
const SEGREDO = 'https://teams.exemplo.invalid/webhook/segredo-123'

// todas as cópias da função avisarTeams (o texto do bloco, do comentário até o fechamento da função)
const copias = Object.entries(workflows).flatMap(([file, yml]) => yml.split(INICIO).slice(1).map((resto) => ({ file, bloco: INICIO + resto.split('\n            }\n')[0] + '\n            }\n' })))
const semRecuo = (bloco) => bloco.split('\n').map((l) => l.replace(/^ {12}/, '')).join('\n')
const carregar = (bloco, { env, fetch }) => {
  const avisos = []
  const avisarTeams = new Function('core', 'process', 'fetch', semRecuo(bloco) + '\nreturn avisarTeams')({ warning: (m) => avisos.push(m) }, { env }, fetch)
  return { avisarTeams, avisos }
}

test('Teams: todo envio das rotinas passa pela mesma função, sem engolir erro', () => {
  assert.ok(copias.length >= 5, 'alerta-coleta (2), pages (3) e as rotinas novas')
  for (const c of copias) assert.equal(c.bloco, copias[0].bloco, `${c.file}: cópia de avisarTeams diferente das demais`)
  for (const [file, yml] of Object.entries(workflows)) {
    assert.doesNotMatch(yml, /\.catch\(\(\) => \{\}\)/, `${file}: erro engolido`)
    if (!yml.includes('TEAMS_WEBHOOK_URL')) continue
    const envios = yml.split('fetch(').length - 1
    assert.equal(envios, yml.split(INICIO).length - 1, `${file}: envio ao Teams fora de avisarTeams`)
    assert.doesNotMatch(yml, /run:[^\n]*TEAMS_WEBHOOK_URL|echo[^\n]*TEAMS_WEBHOOK_URL/, `${file}: segredo em comando`)
    // o segredo só entra por env do passo
    for (const linha of yml.split('\n').filter((l) => l.includes('secrets.TEAMS_WEBHOOK_URL'))) assert.match(linha, /^\s+TEAMS_WEBHOOK_URL: \$\{\{ secrets\.TEAMS_WEBHOOK_URL \}\}$/)
  }
})

test('Teams: segredo ausente vira aviso claro e nada é enviado', async () => {
  let chamadas = 0
  const { avisarTeams, avisos } = carregar(copias[0].bloco, { env: {}, fetch: async () => { chamadas++ } })
  const r = await avisarTeams('oi')
  assert.equal(r.ok, false)
  assert.equal(chamadas, 0)
  assert.equal(avisos.length, 1)
  assert.match(avisos[0], /Aviso ao Teams NÃO enviado: o segredo TEAMS_WEBHOOK_URL não está configurado/)
})

test('Teams: envio aceito não gera aviso; erro, entrega recusada e falha de rede geram aviso sem mostrar o endereço', async () => {
  const env = { TEAMS_WEBHOOK_URL: SEGREDO }
  const resposta = (status, corpo = '') => async (url, init) => {
    assert.equal(url, SEGREDO)
    assert.deepEqual(JSON.parse(init.body), { text: 'oi' })
    return { ok: status >= 200 && status < 300, status, text: async () => corpo }
  }
  for (const [status, corpo] of [[200, '1'], [202, '']]) {
    const { avisarTeams, avisos } = carregar(copias[0].bloco, { env, fetch: resposta(status, corpo) })
    assert.deepEqual(await avisarTeams('oi'), { ok: true })
    assert.deepEqual(avisos, [])
  }
  const casos = [
    [resposta(403), /código 403/],
    [resposta(500), /código 500/],
    [resposta(200, 'Webhook message delivery failed with error: Microsoft Teams endpoint returned HTTP error 429'), /entrega falhou/],
    [async () => { throw new TypeError(`Failed to parse URL from ${SEGREDO}`) }, /falha de rede ou tempo esgotado \(TypeError\)/],
    [async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }) }, /TimeoutError/],
  ]
  for (const [fetch, esperado] of casos) {
    const { avisarTeams, avisos } = carregar(copias[0].bloco, { env, fetch })
    const r = await avisarTeams('oi') // não lança: a rotina não cai por causa do Teams
    assert.equal(r.ok, false)
    assert.equal(avisos.length, 1)
    assert.match(avisos[0], esperado)
    assert.ok(!avisos[0].includes('segredo-123') && !r.motivo.includes('segredo-123'), 'endereço do segredo apareceu no aviso')
  }
})

// Executa o script do teste manual de alerta-coleta.yml com Teams simulado.
async function rodarTeste({ env, fetch }) {
  const yml = workflows['alerta-coleta.yml']
  const job = yml.split('\n  teste:\n')[1]
  const script = semRecuo(job.split('          script: |\n')[1])
  const saida = { avisos: [], resumo: [], falhou: null, nota: null, gravou: false }
  const summary = { addHeading: (t) => { saida.resumo.push(t); return summary }, addRaw: (t) => { saida.resumo.push(t); return summary }, write: async () => { saida.gravou = true } }
  const core = { warning: (m) => saida.avisos.push(m), notice: (m) => { saida.nota = m }, setFailed: (m) => { saida.falhou = m }, summary }
  const context = { serverUrl: 'https://github.com', repo: { owner: 'fixture', repo: 'painel' }, runId: 7, actor: 'dono' }
  // `github` não é passado: se o teste tentasse abrir issue, o script quebraria aqui.
  await new AsyncFunction('core', 'context', 'process', 'fetch', script)(core, context, { env }, fetch)
  return saida
}

test('teste de alerta manual: mensagem marcada como TESTE, resumo diz se chegou e nenhuma issue é aberta', async () => {
  const yml = workflows['alerta-coleta.yml']
  assert.match(yml, /\n {2}workflow_dispatch:\n/)
  assert.match(yml, /\n {2}alerta:\n {4}if: github\.event_name == 'workflow_run'\n/)
  assert.match(yml, /\n {2}teste:\n[^\n]*\n {4}if: github\.event_name == 'workflow_dispatch'\n {4}runs-on: ubuntu-latest\n {4}permissions: \{\}\n/)
  assert.doesNotMatch(yml.split('\n  teste:\n')[1], /github\.rest|issues\./)

  let enviado
  const ok = await rodarTeste({ env: { TEAMS_WEBHOOK_URL: SEGREDO }, fetch: async (_url, init) => { enviado = JSON.parse(init.body).text; return { ok: true, status: 202, text: async () => '' } } })
  assert.match(enviado, /^TESTE de alerta do PEME\. É só um teste: nenhuma ação é necessária\./)
  assert.match(enviado, /actions\/runs\/7$/)
  assert.equal(ok.falhou, null)
  assert.ok(ok.gravou)
  assert.match(ok.resumo.join(' '), /CHEGOU: o Teams aceitou a mensagem de TESTE/)
  assert.doesNotMatch(ok.resumo.join(' '), /NÃO CHEGOU/)

  const semSegredo = await rodarTeste({ env: {}, fetch: async () => { throw new Error('não deveria enviar') } })
  assert.match(semSegredo.resumo.join(' '), /NÃO CHEGOU: o segredo TEAMS_WEBHOOK_URL não está configurado/)
  assert.match(semSegredo.falhou, /NÃO CHEGOU/)
  assert.equal(semSegredo.avisos.length, 1)

  const recusado = await rodarTeste({ env: { TEAMS_WEBHOOK_URL: SEGREDO }, fetch: async () => ({ ok: false, status: 404, text: async () => '' }) })
  assert.match(recusado.resumo.join(' '), /NÃO CHEGOU: o Teams respondeu com erro \(código 404\)/)
  assert.ok(!JSON.stringify(recusado).includes('segredo-123'))
})
