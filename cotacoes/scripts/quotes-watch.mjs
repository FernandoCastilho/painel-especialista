// Vigia da coleta de cotações: o agendamento do GitHub às vezes pula a partida do pregão (03/11/2026: coleta parada das 7h44
// às 11h15). De 15 em 15 min, no pregão (9h05 às 18h de Brasília, dias de pregão da B3), se o quotes.json da branch `data` tiver mais de
// 15 min e não houver coleta rodando ou na fila, dispara a coleta (quotes.yml), que fica ligada até o fim do pregão.
// O mesmo vigia avisa o dono (issue + Teams, em quotes-watch.yml) quando a cotação fica parada por 30 min dentro do pregão.
import { appendFile, readFile } from 'node:fs/promises'
import { b3ClosedDay, fxSessionOpen, FX_ABERTURA as ABERTURA, saoPauloParts } from './data-schedules.mjs'

export const LIMITE_MIN = 15
// Relógio do pregão em Brasília: minuto do dia e se o câmbio está aberto (9h05 às 18h, dia de pregão da B3).
function pregao(now) {
  const p = saoPauloParts(now)
  return { min: Number(p.hour) * 60 + Number(p.minute), aberto: fxSessionOpen(now) }
}
export function quotesWatchDecision({ generatedAt, running = false, now = Date.now() }) {
  if (!fxSessionOpen(now)) return { run: false, reason: b3ClosedDay(now) === true ? 'sem pregão (fim de semana ou feriado da B3)' : 'fora do pregão' }
  const idade = Number.isFinite(generatedAt) ? Math.round((now - generatedAt) / 60000) : Infinity
  if (idade <= LIMITE_MIN) return { run: false, reason: `coleta em dia (${idade} min)` }
  if (running) return { run: false, reason: `coleta com ${idade} min, mas já há execução rodando ou na fila` }
  return { run: true, reason: `coleta parada há ${idade === Infinity ? '?' : idade} min: disparando` }
}

// Aviso ao dono: cotação parada há 30 min ou mais dentro do pregão. Devolve `alert`:
// - true: abrir a pendência (se ainda não houver uma aberta);
// - false: tudo em dia, pode fechar a pendência aberta;
// - null: não mexer (fora do pregão, feriado da B3, arquivo não lido ou atraso ainda abaixo de 30 min).
// "Parada" é a coleta sem publicar (generatedAt velho) ou um par em reais retido pela régua de segurança (stale) há 30 min.
// O tempo só conta a partir da abertura (9h05): o que ficou parado antes do pregão não gera aviso às 9h06.
export const ALERTA_MIN = 30
const PARES_BRL = { USDBRL: 'dólar', EURBRL: 'euro', JPYBRL: 'iene' }
export function quotesAlertDecision({ generatedAt, quotes, now = Date.now() }) {
  const idade = Number.isFinite(generatedAt) ? (now - generatedAt) / 60000 : null
  const retidos = Object.keys(PARES_BRL).filter((par) => quotes?.[par]?.stale)
  if (idade !== null && idade >= 0 && idade <= LIMITE_MIN && !retidos.length) return { alert: false, reason: `cotações em dia (coleta há ${Math.round(idade)} min)` }
  if (b3ClosedDay(now) === true) return { alert: null, reason: 'feriado no calendário da B3' }
  const { min, aberto } = pregao(now)
  if (!aberto) return { alert: null, reason: 'fora do pregão' }
  if (idade === null) return { alert: null, reason: 'não foi possível ler a data da última coleta; sem aviso para não dar alarme falso' }
  const desdeAbertura = min - ABERTURA
  if (Math.min(idade, desdeAbertura) >= ALERTA_MIN) return { alert: true, reason: `A coleta de cotações não publica nada novo há ${Math.round(idade)} min, em pleno pregão.` }
  for (const par of retidos) {
    const semValida = (now - Number(quotes[par].timestamp) * 1000) / 60000
    if (Number.isFinite(semValida) && Math.min(semValida, desdeAbertura) >= ALERTA_MIN) return { alert: true, reason: `A cotação do ${PARES_BRL[par]} está retida há ${Math.round(semValida)} min, em pleno pregão: a fonte está entregando dado que a régua de segurança recusa.` }
  }
  return { alert: null, reason: `atraso abaixo de ${ALERTA_MIN} min dentro do pregão` }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // QUOTES_FILE: quotes.json baixado da branch `data` pelo workflow (vazio ou ilegível = data desconhecida)
  let file = null
  try { file = JSON.parse(await readFile(process.env.QUOTES_FILE, 'utf8')) } catch { /* arquivo ilegível */ }
  const generatedAt = Number(file?.generatedAt ?? process.env.GENERATED_AT)
  const running = process.env.RUNNING === 'true'
  const d = quotesWatchDecision({ generatedAt, running })
  const a = quotesAlertDecision({ generatedAt, quotes: file?.quotes })
  console.log('Cotações:', d.reason)
  console.log('Aviso ao dono:', a.alert === true ? `ABRIR. ${a.reason}` : a.alert === false ? `em dia (${a.reason})` : `nada a fazer (${a.reason})`)
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `run=${d.run}\nalert=${a.alert ?? ''}\nalert_reason=${a.reason.replace(/[\r\n]+/g, ' ')}\n`)
}
