import { focusFor } from './macro-lib.mjs'
export async function collectFocus({fetchImpl=fetch,now=Date.now()}={}) {
 const since=new Date(now-21*864e5).toISOString().slice(0,10),rows=[];let date=''
 for(const [indicator,label] of Object.entries({Selic:'Selic',IPCA:'IPCA','PIB Total':'PIB','Câmbio':'Câmbio'})) {
  const filter=encodeURIComponent(`Indicador eq '${indicator}' and Data ge '${since}' and baseCalculo eq 0`)
  const url=`https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais?$top=100&$filter=${filter}&$orderby=Data%20desc&$format=json`
  const response=await fetchImpl(url,{signal:AbortSignal.timeout(30000)})
  if(!response.ok)throw new Error(`Focus ${indicator}: HTTP ${response.status}`)
  const f=focusFor((await response.json())?.value)
  if(!f || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || Date.parse(f.date+'T12:00:00Z')>now || !Object.keys(f.values).length || Object.entries(f.values).some(([year,v])=>!/^\d{4}$/.test(year)||!Number.isFinite(v.median)) || (date && f.date!==date))throw new Error('Focus incompleto ou datas de coleta divergentes')
  date=f.date;rows.push({label,indicator,values:f.values})
 }
 return {date,rows}
}
export function preserveFocus(out,previous,{checkedAt,error,skipped=false}={}) {
 out.focus=previous?.focus ?? null
 out.focusCheckedAt=skipped ? previous?.focusCheckedAt ?? null : checkedAt
 out.focusSchedule={cadence:'segunda 08:30 America/Sao_Paulo (repete terça 08:30)',skipped,error:error || null}
 if(previous?.stale?.focus)out.stale={...out.stale,focus:previous.stale.focus}
 if(error && out.focus)out.stale={...out.stale,focus:previous?.stale?.focus ?? previous?.focusCheckedAt ?? previous?.generatedAt ?? null}
 return out
}
// Data de coleta do boletim desta semana: a sexta-feira anterior à segunda (o Focus sai segunda às 8h25; terça, se segunda for feriado).
export function expectedFocusDate(now = Date.now()) {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]))
 const day = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`), dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
 day.setUTCDate(day.getUTCDate() - ((dow + 6) % 7) - 3) // segunda desta semana − 3 dias = sexta anterior
 return day.toISOString().slice(0, 10)
}

// Boletim da semana em atraso: o painel ainda mostra uma coleta anterior à esperada e o boletim já deveria ter saído
// (segunda a partir das 08h25 de Brasília). Serve de rede de segurança: o GitHub nem sempre dispara a coleta semanal
// nem o vigia no horário (em 16/11/2026 nenhum dos dois rodou), então qualquer atualização automática que aconteça
// depois da divulgação busca o Focus, em vez de esperar o próximo disparo semanal.
export function focusDue(publishedDate, now = Date.now()) {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]))
 if (p.weekday === 'Mon' && Number(p.hour) * 60 + Number(p.minute) < 8 * 60 + 25) return false
 return !publishedDate || publishedDate < expectedFocusDate(now)
}

// Vigia do Focus (focus.yml): segunda (e terça, para segunda feriado), de 30 em 30 min. A tentativa 1 é a coleta semanal
// das 08:30 (pages.yml); o vigia faz as tentativas 2 a 10 (09:00 a 13:00) e só dispara a atualização se o boletim da semana
// ainda não estiver publicado no painel.
export const FOCUS_TENTATIVAS = 10
export function focusWatchDecision(publishedDate, now = Date.now()) {
 const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]))
 const attempt = Math.floor((Number(p.hour) * 60 + Number(p.minute) - (8 * 60 + 30)) / 30) + 1
 const expected = expectedFocusDate(now)
 if (!['Mon', 'Tue'].includes(p.weekday)) return { run: false, attempt, expected, reason: 'fora de segunda e terça' }
 if (publishedDate && publishedDate >= expected) return { run: false, attempt, expected, reason: `boletim da semana já publicado (coleta até ${publishedDate})` }
 if (attempt < 2 || attempt > FOCUS_TENTATIVAS) return { run: false, attempt, expected, reason: `fora da janela (tentativas 2 a ${FOCUS_TENTATIVAS}, 09:00 a 13:00)` }
 return { run: true, attempt, expected, reason: `tentativa ${attempt} de ${FOCUS_TENTATIVAS}: publicado até ${publishedDate ?? '—'}, esperado ${expected}` }
}
