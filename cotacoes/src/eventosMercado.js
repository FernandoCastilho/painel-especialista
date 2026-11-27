import { confirmadosEntre, zonedToUtc } from './agenda.js'

// Eventos de mercado marcados com seta nos gráficos de câmbio.
// Lista editável: só entra evento com fonte pública verificável (nome e link). `data` no fuso de Brasília;
// `hora` (HH:MM) opcional, para aparecer também no gráfico do dia; `ate` opcional, para um período (ex.: vários dias).
// Rótulo curto (até ~16 letras), sem opinião sobre a causa do movimento.
export const EVENTOS_MERCADO = [
  { data: '2026-10-04', rotulo: '1º turno', fonte: 'TSE: calendário das Eleições 2026', link: 'https://www.tse.jus.br/comunicacao/noticias/2026/Marco/eleicoes-2026-confira-as-principais-datas-do-calendario-eleitoral' },
  { data: '2026-10-25', rotulo: '2º turno', fonte: 'TSE: calendário das Eleições 2026', link: 'https://www.tse.jus.br/comunicacao/noticias/2026/Marco/eleicoes-2026-confira-as-principais-datas-do-calendario-eleitoral' },
]

// Rótulo curto dos eventos da agenda do painel (decisões e dados com data oficial).
const CURTO = { Copom: 'Copom', FOMC: 'Fed', Payroll: 'Payroll' }

const valido = (e) => /^\d{4}-\d{2}-\d{2}$/.test(e?.data ?? '') && e.rotulo && e.fonte && /^https:\/\//.test(e.link ?? '') && (!e.ate || e.ate >= e.data) && (!e.hora || /^\d{2}:\d{2}$/.test(e.hora))

// Marcas entre t0 e t1 (ms). Gráfico do dia (`intradiario`): só eventos com horário. Primeiro os da lista, depois os da agenda.
export function marcosEntre(t0, t1, { intradiario = false, lista = EVENTOS_MERCADO, agenda = confirmadosEntre } = {}) {
  if (!(t1 >= t0)) return []
  const tz = 'America/Sao_Paulo'
  const proprios = lista.filter(valido).filter((e) => !intradiario || e.hora).map((e) => ({
    t: zonedToUtc(e.data, e.hora ?? '12:00', tz),
    ...(e.ate ? { ate: zonedToUtc(e.ate, '18:00', tz) } : {}),
    rotulo: e.rotulo,
    fonte: e.fonte,
    link: e.link,
  }))
  const daAgenda = agenda(t0, t1).filter((e) => CURTO[e.kind]).map((e) => ({ t: e.t, rotulo: CURTO[e.kind], fonte: `${e.label} (${e.source})`, agenda: true }))
  return [...proprios.filter((m) => (m.ate ?? m.t) >= t0 && m.t <= t1), ...daAgenda]
}

// Marcas que cabem sem encavalar os rótulos (distância mínima em px), na ordem de prioridade recebida; devolvidas em ordem de tempo.
export function marcosQueCabem(marcos, x, { gap = 56, de = -Infinity, ate = Infinity } = {}) {
  const ok = []
  for (const m of marcos) {
    const px = x(Math.min(Math.max(m.t, de), ate))
    if (ok.some((o) => Math.abs(o.px - px) < gap)) continue
    ok.push({ ...m, px })
  }
  return ok.sort((a, b) => a.t - b.t)
}
