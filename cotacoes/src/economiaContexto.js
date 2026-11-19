// Seleção manual de links, conferida na editoria Economia em 19/11/2026.
// Rótulos e perguntas são originais do Painel. Sem cópia de matérias, imagens ou coleta.
export const ECONOMIA_REVIEWED_AT = '2026-11-19'
export const ECONOMIA_READINGS = [
  {
    id: 'juros-credito', label: 'Juros e capacidade de pagamento',
    url: 'https://braziljournal.com/como-acabar-com-a-jabuticaba-dos-juros-sem-truque',
    publishedAt: '2026-11-16', kind: 'Entrevista · opiniões do entrevistado',
    question: 'Se os juros permanecerem elevados, o caixa suporta o serviço da dívida e os investimentos previstos?',
  },
  {
    id: 'custos-competitividade', label: 'Custos e competitividade',
    url: 'https://braziljournal.com/custo-brasil-chega-a-27-5-do-pib-ainda-maior-do-que-se-imaginava',
    publishedAt: '2026-11-18', kind: 'Reportagem',
    question: 'Quais custos de logística, estoque e financiamento mais pressionam a margem desta empresa?',
    note: 'Indicadores nacionais não representam um percentual de custo aplicável à empresa individual.',
  },
  {
    id: 'tributos-caixa', label: 'Tributos e capital de giro',
    url: 'https://braziljournal.com/o-split-payment-pode-acabar-com-a-sonegacao-mas-vai-ser-bem-confuso',
    publishedAt: '2026-07-27', kind: 'Reportagem · leitura de contexto',
    question: 'Quanto do capital de giro depende do intervalo entre receber a venda e recolher o tributo?',
    note: 'Leitura de julho de 2026. Não use como cronograma vigente; confirme regras e datas nas fontes oficiais.',
  },
]
export function economiaReadings(items = ECONOMIA_READINGS) {
  const seen = new Set()
  return items.filter(item => {
    if (!item?.id || !item.label || !item.question || !/^\d{4}-\d{2}-\d{2}$/.test(item.publishedAt || '')) return false
    try {
      const url = new URL(item.url)
      const key = url.origin + url.pathname.replace(/\/$/, '')
      if (url.protocol !== 'https:' || url.hostname !== 'braziljournal.com' || url.username || url.password || seen.has(key)) return false
      seen.add(key)
      return true
    } catch { return false }
  }).slice(0, 3)
}
export const economiaDate = value => value.split('-').reverse().join('/')
