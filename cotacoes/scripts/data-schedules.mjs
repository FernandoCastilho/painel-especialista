// Calendar applies to B3 listed derivatives, not to NY holidays or CSD2 suspension.
export const B3_CALENDAR_SOURCE='https://www.b3.com.br/data/files/20/57/01/AA/06A1F910ADC36BE9AC094EA8/OC%20041-2026-VNC%20ERRATA%20-%20CALENDARIO%20DE%20FERIADOS%20EM%202026_PT.pdf'
const closed2026=new Set(['01-01','02-16','02-17','04-03','04-21','05-01','06-04','09-07','10-12','11-02','11-20','12-24','12-25','12-31'])
// Never extrapolate an exchange calendar from national holidays or a portal year filter.
export function b3CalendarStatus(year) {
 return String(year)==='2026'
  ? {verified:true,year:2026,source:B3_CALENDAR_SOURCE,reviewedAt:'2026-11-08'}
  : {verified:false,year:Number(year),source:null,reason:'calendário B3 do ano não verificado'}
}
export function saoPauloParts(now=Date.now()) {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit',weekday:'short'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]))
 return {date:`${p.year}-${p.month}-${p.day}`,hour:p.hour,minute:p.minute,weekday:p.weekday}
}
export function b3CollectionDecision(now,previousCheckedAt) {
 const p=saoPauloParts(now)
 const calendar=b3CalendarStatus(p.date.slice(0,4))
 if(!calendar.verified)return {run:false,reason:calendar.reason,...p}
 if(['Sat','Sun'].includes(p.weekday)||closed2026.has(p.date.slice(5)))return {run:false,reason:'sem sessão de derivativos listados no calendário B3',...p}
 if(previousCheckedAt){const prev=saoPauloParts(previousCheckedAt);if(prev.date===p.date&&prev.hour===p.hour)return {run:false,reason:'consulta desta hora já concluída',...p}}
 return {run:true,reason:'consulta horária; referência diária de ajuste',...p}
}
// Dia sem pregão? true = fim de semana ou feriado do calendário B3 conferido; false = dia de pregão; null = ano sem calendário conferido (não dá para saber).
export function b3ClosedDay(now=Date.now()) {
 const p=saoPauloParts(now)
 if(['Sat','Sun'].includes(p.weekday))return true
 if(!b3CalendarStatus(p.date.slice(0,4)).verified)return null
 return closed2026.has(p.date.slice(5))
}
// Lembrete ao dono: quantos dias faltam para o fim do calendário B3 conferido. Não inclui nem inventa ano novo; só conta.
// A cobertura vai até 31/12 do último ano conferido em sequência (hoje, 2026). Depois dessa data as curvas da B3 param de atualizar.
export const B3_CALENDAR_REMINDER_DAYS=60
export function b3CalendarReminder(now=Date.now(),days=B3_CALENDAR_REMINDER_DAYS) {
 const today=saoPauloParts(now).date,year=Number(today.slice(0,4))
 let last=year
 if(b3CalendarStatus(year).verified)while(b3CalendarStatus(last+1).verified)last++
 else{last=null;for(let y=year-1;y>=year-10&&last===null;y--)if(b3CalendarStatus(y).verified)last=y}
 if(last===null)return {due:true,daysLeft:null,coverageEnd:null,nextYear:year,today}
 const coverageEnd=`${last}-12-31`
 const daysLeft=Math.round((Date.parse(coverageEnd+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))/864e5)
 return {due:daysLeft<=days,daysLeft,coverageEnd,nextYear:last+1,today}
}
export const FOCUS_CRON='30 11 * * 1,2' // 08:30 America/Sao_Paulo (UTC-3), segunda e terça (segunda feriado → Focus na terça); GitHub best effort.
