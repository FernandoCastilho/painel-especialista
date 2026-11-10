// Gera o relatório de dados desatualizados (usado pelo alerta do deploy). Nunca falha: é só informação.
import { readFile, writeFile } from 'node:fs/promises'
import { staleReport } from './stale-lib.mjs'
import { b3CalendarReminder } from './data-schedules.mjs'

const read = async (f) => {
  try {
    return JSON.parse(await readFile(new URL(`../public/${f}.json`, import.meta.url), 'utf8'))
  } catch {
    return null
  }
}
const hours = Number(process.env.STALE_HOURS ?? 6)
const items = staleReport({ macro: await read('macro'), curves: await read('curves'), news: await read('news'), indexadores: await read('indexadores'), bndes: await read('bndes'), moedas: await read('moedas') }, Date.now(), hours)
const out = `${process.env.RUNNER_TEMP ?? '/tmp'}/stale.json`
// calendarioB3: contagem regressiva do calendário de pregão conferido, para o lembrete do deploy (ver data-schedules.mjs)
const calendarioB3 = b3CalendarReminder()
await writeFile(out, JSON.stringify({ hours, items, calendarioB3 }))
console.log(items.length ? `Dados anteriores há mais de ${hours} h: ${items.map((i) => i.detail).join('; ')}` : `Nenhum bloco desatualizado há mais de ${hours} h`)
console.log(`Calendário B3: cobertura até ${calendarioB3.coverageEnd ?? 'nenhum ano conferido'}; faltam ${calendarioB3.daysLeft ?? '?'} dias${calendarioB3.due ? ' (lembrete ativo)' : ''}`)
