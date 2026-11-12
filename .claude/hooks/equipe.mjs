// Equipe em ação, versão para a nuvem: sem painel, só avisos no chat.
// Roda como gancho do Claude Code (SubagentStart, SubagentStop, Notification).
// Nunca falha: qualquer erro termina em silêncio, para não atrapalhar a sessão.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'

const mask = s =>
  String(s ?? '')
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '$1-•••')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{16,}/g, 'gh•••')
    .replace(/\bBearer\s+\S+/gi, 'Bearer •••')
    .replace(/:\/\/([^/\s:@]+):[^@\s]+@/g, '://$1:•••@')
    .replace(/(api[_-]?key|token|secret|password|senha|authorization)(\s*[=:]\s*|\s+)\S+/gi, '$1$2•••')

const fmt = ms => {
  if (ms < 1000) return '<1s'
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}`
}

const median = a => {
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const load = (file, fallback) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const save = (file, value) => {
  try {
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, JSON.stringify(value))
  } catch {
    // sem gravar: segue sem histórico
  }
}

export const run = (input, now = Date.now(), dirs = {}) => {
  const stateFile = dirs.state ?? join(tmpdir(), 'equipe-em-acao-estado.json')
  const histFile = dirs.hist ?? join(homedir(), '.claude', 'equipe-em-acao-historico.json')
  const state = load(stateFile, { running: {} })
  const hist = load(histFile, {})
  const who = String(input.agent_type ?? 'agente')
  const id = String(input.agent_id ?? '')
  const event = input.hook_event_name

  const eta = name => {
    const h = hist[name]
    return h && h.length ? `~${fmt(median(h))} (mediana de ${h.length})` : 'estimativa: calculando…'
  }
  const active = () => {
    const names = Object.values(state.running).map(r => r.who)
    return names.length ? ` · ativos: ${[...new Set(names)].join(', ')}` : ''
  }

  let message = ''
  if (event === 'SubagentStart' && id) {
    state.running[id] = { who, start: now }
    message = `● ${who} começou · ${eta(who)}${active()}`
  } else if (event === 'SubagentStop' && id) {
    const r = state.running[id]
    delete state.running[id]
    if (r) {
      const ms = now - r.start
      const h = hist[who] ?? []
      const med = h.length ? median(h) : undefined
      hist[who] = [...h, ms].slice(-20)
      const slow = med && h.length >= 3 && ms > 2 * med ? ' · demorou mais que o normal' : ''
      message = `✓ ${who} terminou em ${fmt(ms)}${med ? ` (mediana ${fmt(med)})` : ''}${slow}${active()}`
      save(histFile, hist)
    }
  } else if (event === 'Notification' && input.notification_type === 'permission_prompt') {
    message = `⚠ Aguardando sua autorização: ${mask(input.message).slice(0, 120)}`
  }
  save(stateFile, state)

  return message
}

// Só roda como gancho (com dados na entrada padrão), nunca ao ser importado.
if (process.argv[1]?.endsWith('equipe.mjs')) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
    const message = run(input)
    if (message) process.stdout.write(JSON.stringify({ systemMessage: message }))
  } catch {
    // silêncio
  }
  process.exit(0)
}
