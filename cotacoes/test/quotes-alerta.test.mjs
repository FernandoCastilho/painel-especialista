// Aviso de cotação parada no pregão (vigia) e leitura segura da branch `data` na coleta. Nada aqui usa a rede.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ALERTA_MIN, LIMITE_MIN, quotesAlertDecision, quotesWatchDecision } from '../scripts/quotes-watch.mjs'
import { b3ClosedDay } from '../scripts/data-schedules.mjs'

const yml = (f) => readFileSync(new URL(`../../.github/workflows/${f}`, import.meta.url), 'utf8')
// `min` = minutos desde a última coleta publicada
const em = (iso, min, quotes) => quotesAlertDecision({ generatedAt: Date.parse(iso) - min * 60000, quotes, now: Date.parse(iso) })
const par = (iso, minAtras, stale) => ({ timestamp: String(Math.floor((Date.parse(iso) - minAtras * 60000) / 1000)), ...(stale ? { stale: true } : {}) })

test('cotação parada: avisa com 30 min ou mais dentro do pregão, em dia útil', () => {
  assert.equal(ALERTA_MIN, 30)
  const tarde = '2026-11-03T17:00:00Z' // terça, 14h de Brasília
  assert.equal(em(tarde, 30).alert, true)
  assert.equal(em(tarde, 45).alert, true)
  assert.match(em(tarde, 45).reason, /não publica nada novo há 45 min, em pleno pregão/)
  assert.equal(em(tarde, 29).alert, null) // ainda abaixo de 30 min: não avisa nem fecha
  assert.equal(em(tarde, 16).alert, null)
  assert.equal(em(tarde, LIMITE_MIN).alert, false) // em dia: pode fechar a pendência
  assert.equal(em(tarde, 3).alert, false)
})

test('cotação parada: sem alarme falso fora do pregão, no fim de semana e em feriado', () => {
  assert.equal(em('2026-11-03T12:15:00Z', 300).alert, null) // 9h15: antes da abertura
  assert.equal(em('2026-11-03T21:15:00Z', 300).alert, null) // 18h15: depois do fechamento
  assert.equal(em('2026-11-03T03:00:00Z', 300).alert, null) // madrugada
  assert.equal(em('2026-11-07T15:00:00Z', 900).alert, null) // sábado
  assert.equal(em('2026-11-08T15:00:00Z', 900).alert, null) // domingo
  assert.equal(em('2026-11-20T15:00:00Z', 900).alert, null) // Consciência Negra (sexta), feriado no calendário da B3
  assert.match(em('2026-11-20T15:00:00Z', 900).reason, /feriado/)
  assert.equal(em('2026-12-24T15:00:00Z', 900).alert, null) // véspera de Natal: sem sessão na B3
  assert.equal(b3ClosedDay(Date.parse('2026-11-20T15:00:00Z')), true)
  assert.equal(b3ClosedDay(Date.parse('2026-11-19T15:00:00Z')), false)
  assert.equal(b3ClosedDay(Date.parse('2027-01-04T15:00:00Z')), null) // ano sem calendário conferido: não dá para saber
})

test('cotação parada: o tempo só conta a partir da abertura do pregão', () => {
  // 9h45: a última coleta é de antes da abertura (53 min), mas o pregão só tem 15 min
  assert.equal(em('2026-11-03T12:45:00Z', 53).alert, null)
  assert.equal(em('2026-11-03T12:59:00Z', 300).alert, null) // 9h59
  assert.equal(em('2026-11-03T13:00:00Z', 300).alert, true) // 10h00: 30 min de pregão sem coleta
})

test('cotação parada: arquivo ilegível não vira alarme (o vigia continua religando a coleta)', () => {
  const agora = Date.parse('2026-11-03T17:00:00Z')
  const a = quotesAlertDecision({ generatedAt: NaN, now: agora })
  assert.equal(a.alert, null)
  assert.match(a.reason, /não foi possível ler/)
  assert.equal(quotesWatchDecision({ generatedAt: NaN, now: agora }).run, true)
})

test('cotação retida pela régua de segurança: avisa quando um par em reais fica 30 min sem cotação válida', () => {
  const tarde = '2026-11-03T17:00:00Z'
  // a coleta roda (arquivo novo), mas o dólar está retido há 40 min
  const retido = em(tarde, 2, { USDBRL: par(tarde, 40, true), EURBRL: par(tarde, 1), JPYBRL: par(tarde, 1) })
  assert.equal(retido.alert, true)
  assert.match(retido.reason, /cotação do dólar está retida há 40 min/)
  // retido há pouco: nem avisa nem dá por normalizado
  assert.equal(em(tarde, 2, { USDBRL: par(tarde, 10, true) }).alert, null)
  // cotação antiga mas NÃO retida (ex.: par sem negócio) não é problema da coleta
  assert.equal(em(tarde, 2, { USDBRL: par(tarde, 500), EURBRL: par(tarde, 1), JPYBRL: par(tarde, 1) }).alert, false)
  // o cruzamento do yuan tem retenção própria e fica fora deste aviso
  assert.equal(em(tarde, 2, { USDCNH: par(tarde, 90, true) }).alert, false)
  // feriado: retenção não gera aviso
  assert.equal(em('2026-11-20T15:00:00Z', 2, { USDBRL: par('2026-11-20T15:00:00Z', 900, true) }).alert, null)
})

// Executa o passo real de quotes-watch.yml com GitHub simulado.
async function rodarAviso(env, abertas = []) {
  const passo = yml('quotes-watch.yml').split('      - name: Avisar cotação parada no pregão')[1]
  const script = passo.split('          script: |\n')[1].split('\n').map((l) => l.replace(/^ {12}/, '')).join('\n')
  const feito = { criadas: [], comentarios: [], fechadas: [], avisos: [], info: [] }
  // A busca vem em páginas de 2 para provar que o passo lê todas (github.paginate), e não só a primeira.
  const listForRepo = async ({ page = 1 }) => ({ data: abertas.slice((page - 1) * 2, page * 2) })
  const paginate = async (fn, args) => { const tudo = []; for (let page = 1; ; page++) { const { data } = await fn({ ...args, page }); if (!data.length) return tudo; tudo.push(...data) } }
  const github = { paginate, rest: { issues: { listForRepo, create: async (i) => feito.criadas.push(i), createComment: async (c) => feito.comentarios.push(c), update: async (u) => feito.fechadas.push(u) } } }
  const core = { warning: (m) => feito.avisos.push(m), info: (m) => feito.info.push(m) }
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  await new AsyncFunction('process', 'github', 'context', 'fetch', 'core', script)({ env }, github, { repo: { owner: 'fixture', repo: 'painel' }, serverUrl: 'https://github.com', runId: 11 }, () => { throw new Error('rede proibida no teste') }, core)
  return feito
}

test('vigia: abre uma pendência só, não repete a cada rodada e fecha quando normaliza', async () => {
  const w = yml('quotes-watch.yml')
  assert.match(w, /permissions:\n {2}contents: read\n {2}actions: write\n {2}issues: write[^\n]*\n\njobs:/) // nada além do necessário
  assert.match(w, /if: always\(\) && steps\.decide\.outputs\.alert != ''/)
  assert.match(w, /ALERTA: \$\{\{ steps\.decide\.outputs\.alert \}\}\n\s+MOTIVO: \$\{\{ steps\.decide\.outputs\.alert_reason \}\}/)
  for (const linha of w.split('\n').filter((l) => /^\s+run: /.test(l))) assert.doesNotMatch(linha, /\$\{\{/, 'valor interpolado direto em comando')

  const MOTIVO = 'A coleta de cotações não publica nada novo há 45 min, em pleno pregão.'
  const nova = await rodarAviso({ ALERTA: 'true', MOTIVO })
  assert.equal(nova.criadas.length, 1)
  assert.equal(nova.criadas[0].title, 'Cotações paradas no pregão')
  assert.match(nova.criadas[0].body, /^A coleta de cotações não publica nada novo há 45 min/)
  assert.match(nova.criadas[0].body, /fecha sozinha quando a cotação voltar a atualizar/)
  assert.match(nova.avisos[0], /Aviso ao Teams NÃO enviado/) // sem segredo no teste

  const repetida = await rodarAviso({ ALERTA: 'true', MOTIVO }, [{ number: 4, title: 'Cotações paradas no pregão' }])
  assert.deepEqual([repetida.criadas.length, repetida.comentarios.length, repetida.avisos.length], [0, 0, 0])

  const normal = await rodarAviso({ ALERTA: 'false', MOTIVO: 'cotações em dia' }, [{ number: 4, title: 'Cotações paradas no pregão' }, { number: 5, title: 'Outra' }])
  assert.deepEqual(normal.fechadas.map((f) => [f.issue_number, f.state]), [[4, 'closed']])
  assert.equal(normal.criadas.length, 0)
  // Pendência antiga na terceira página da busca: continua sendo achada, então não abre outra.
  const longe = [{ number: 1, title: 'A' }, { number: 2, title: 'B' }, { number: 3, title: 'C' }, { number: 6, title: 'PR', pull_request: {} }, { number: 4, title: 'Cotações paradas no pregão' }]
  assert.equal((await rodarAviso({ ALERTA: 'true', MOTIVO }, longe)).criadas.length, 0)
  // Se duas pendências iguais existirem, as duas fecham quando normaliza.
  const duplicadas = await rodarAviso({ ALERTA: 'false', MOTIVO: 'cotações em dia' }, [{ number: 4, title: 'Cotações paradas no pregão' }, { number: 7, title: 'Cotações paradas no pregão' }])
  assert.deepEqual(duplicadas.fechadas.map((f) => f.issue_number), [4, 7])
  // Uma rodada do vigia por vez, sem cancelar a que está em andamento.
  assert.match(w, /concurrency:\n {6}group: quotes-watch\n {6}cancel-in-progress: false/)
  const nada = await rodarAviso({ ALERTA: 'false', MOTIVO: 'cotações em dia' })
  assert.deepEqual([nada.criadas.length, nada.fechadas.length, nada.comentarios.length], [0, 0, 0])
})

test('vigia: o script lê o arquivo baixado e publica as duas decisões', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vigia-'))
  try {
    const saida = join(dir, 'out.txt'), arquivo = join(dir, 'quotes.txt')
    writeFileSync(arquivo, JSON.stringify({ generatedAt: Date.now() - 60000, quotes: {} }))
    writeFileSync(saida, '')
    execFileSync(process.execPath, [new URL('../scripts/quotes-watch.mjs', import.meta.url).pathname], { env: { ...process.env, QUOTES_FILE: arquivo, RUNNING: 'false', GITHUB_OUTPUT: saida } })
    const out = readFileSync(saida, 'utf8')
    assert.match(out, /^run=false\nalert=false\nalert_reason=cotações em dia/) // coleta de 1 min atrás: em dia a qualquer hora
    // arquivo vazio (leitura falhou): nunca pede aviso
    writeFileSync(arquivo, '')
    writeFileSync(saida, '')
    execFileSync(process.execPath, [new URL('../scripts/quotes-watch.mjs', import.meta.url).pathname], { env: { ...process.env, QUOTES_FILE: arquivo, RUNNING: 'false', GITHUB_OUTPUT: saida } })
    assert.match(readFileSync(saida, 'utf8'), /\nalert=\nalert_reason=/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

// Executa a função real de quotes.yml (bash) contra repositórios git temporários e locais.
function baixar(origem) {
  const q = yml('quotes.yml')
  const fn = q.split('          baixar_anteriores() {\n')[1].split('\n          }\n')[0].split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n')
  const dir = mkdtempSync(join(tmpdir(), 'coleta-'))
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' })
  git('init', '-q')
  git('remote', 'add', 'origin', origem)
  const dados = join(dir, 'dados')
  const r = spawnSync('bash', ['-c', `sleep() { :; }\nbaixar_anteriores() {\n${fn}\n}\nbaixar_anteriores`], { cwd: dir, env: { ...process.env, DATA_DIR: dados, GIT_TERMINAL_PROMPT: '0' }, encoding: 'utf8' })
  const lido = (f) => existsSync(join(dados, f)) ? readFileSync(join(dados, f), 'utf8') : null
  const resultado = { status: r.status, stdout: r.stdout, quotes: lido('quotes.json'), intraday: lido('intraday.json'), history: lido('history.json') }
  rmSync(dir, { recursive: true, force: true })
  return resultado
}
function origemCom(arquivos) {
  const dir = mkdtempSync(join(tmpdir(), 'origem-'))
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { stdio: 'pipe' })
  git('init', '-q')
  git('checkout', '-q', '-b', arquivos ? 'data' : 'main')
  for (const [f, texto] of Object.entries(arquivos ?? { 'leia.txt': 'x' })) writeFileSync(join(dir, f), texto)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  return dir
}

test('coleta: branch data inexistente é primeira publicação; branch ilegível não vira "não existe"', () => {
  const comDados = origemCom({ 'quotes.json': '{"generatedAt":1}', 'intraday.json': '{"series":{"USD":{"points":[[1,5]]}}}' })
  const semBranch = origemCom(null)
  try {
    const ok = baixar(comDados)
    assert.equal(ok.status, 0)
    assert.equal(ok.quotes, '{"generatedAt":1}')
    assert.equal(ok.intraday, '{"series":{"USD":{"points":[[1,5]]}}}')
    assert.equal(ok.history, null) // arquivo que não existe na branch não atrapalha

    const primeira = baixar(semBranch)
    assert.equal(primeira.status, 0)
    assert.match(primeira.stdout, /primeira publicação/)
    assert.equal(primeira.quotes, null)

    const fora = baixar(join(tmpdir(), 'repositorio-que-nao-existe-' + process.pid))
    assert.equal(fora.status, 1) // não consultou: a rodada não pode publicar
    assert.equal(fora.quotes, null)
  } finally { rmSync(comDados, { recursive: true, force: true }); rmSync(semBranch, { recursive: true, force: true }) }

  const q = yml('quotes.yml')
  // a rodada só coleta e publica depois de conhecer o estado da branch; senão registra aviso e espera a próxima
  assert.match(q, /collect_and_publish\(\) \{\n\s+if \[ "\$base_ok" != true \]; then\n\s+if baixar_anteriores; then base_ok=true\n\s+else echo "::warning::[^"]*Rodada sem coleta e sem publicação[^"]*"; return 0; fi\n\s+fi\n\s+node cotacoes\/scripts\/fetch-quotes\.mjs/)
  assert.doesNotMatch(q, /2>\/dev\/null \|\| true; done/) // o padrão antigo, que tratava falha de leitura como arquivo ausente
})
