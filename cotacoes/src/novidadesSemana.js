// Linha "Novidades da semana" do aviso inicial: o resumo curto (`resumo`) das entradas de Novidades dos últimos 7 dias,
// da mais recente para a mais antiga, no máximo 6. Entrada sem `resumo` não aparece (detalhe técnico fica só em Novidades).
const toMs = (d) => { const [dd, mm, yy] = d.split('/').map(Number); return Date.UTC(yy, mm - 1, dd, 12) }
export function novidadesDaSemana(entries, now = Date.now(), max = 6) {
  const desde = now - 7 * 864e5
  return entries.filter((e) => e.resumo && toMs(e.date) >= desde - 864e5 / 2 && toMs(e.date) <= now + 864e5).map((e) => e.resumo).slice(0, max)
}
