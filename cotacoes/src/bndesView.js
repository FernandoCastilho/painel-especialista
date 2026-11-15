// Visão única da aba BNDES: famílias (TFB, TLP, TFC, Moedas) com as mesmas colunas e a série escolhida para o gráfico.
import { tfbSpread } from './spread.js'
import { PRAZO_LABEL, TFB_DEFINICAO, TLP_DEFINICAO, bndesRows, pointsOf as tfbPoints, tlpView } from './bndes.js'
import { MOEDAS_DEFINICAO, TFC_DEFINICAO, GROUPS, groupRows, pointsOf as moedaPoints } from './moedas.js'
import { TLP_LABEL } from './tlp.js'

export const FAMILIES = [
  { id: 'tfb', label: 'TFB', title: 'Taxa Fixa do BNDES', definition: TFB_DEFINICAO, source: 'Serviço público de taxas do BNDES (arquivos TFB_prazo_liberação). Uma cotação por dia útil, já disponível no próprio dia (prática observada nas coletas; não há norma publicada sobre o horário). Faixas de 36, 60, 84 e 120 meses com liberação em 30 e 90 dias.' },
  { id: 'tlp', label: 'TLP', title: TLP_LABEL, definition: TLP_DEFINICAO, source: 'Moedas Contratuais do BNDES, moeda 777 (parcela prefixada da TLP), desde 2018 (quando a TLP substituiu a TJLP nos contratos do BNDES). Divulgada no último dia útil do mês anterior ao da vigência (Res. CMN 4.600/2017); a data é calculada com o calendário de feriados do Brasil.' },
  { id: 'tfc', label: 'TFC', title: 'TFC · Moedas Contratuais', definition: TFC_DEFINICAO, source: 'Arquivos de cotação das Moedas Contratuais do BNDES (códigos C01 a C26; C19 e C21 não existem na tabela). Uma cotação por dia útil, com histórico a partir de 2025 ou 2026, conforme a série.' },
  { id: 'moedas', label: 'Moedas', title: 'Moedas contratuais', definition: MOEDAS_DEFINICAO, source: 'Arquivos de cotação das Moedas Contratuais do BNDES. Dólar (604) e índice Selic acumulada (143) têm variação em %; as sobretaxas (024 e LD1), TLP-IPCA, TFBTR e TFBD, em pontos percentuais. LD1 tem referências trimestrais para novas contratações; pode ser negativa. A TFBTR (TR1 e TR2) tem um valor por mês. A TFBD (TD1, TD2 e TD3) é a taxa fixa em dólar das operações indiretas, por faixa de prazo total. A TLP (777) está na aba TLP.' },
]
export const DEFAULT_SELECTION = { tfb: 'TFB_60_90', tlp: 'TLP', tfc: 'C01', moedas: '604' }

const toRow = (r, id, name, sub) => ({ id, name, sub, missing: !!r.missing, text: r.text, day: r.day ?? null, month: r.month ?? null, year: r.year ?? null, date: r.date, stale: r.stale ?? null, ...('lastChange' in r ? { lastChange: r.lastChange } : {}) })

// Linhas da tabela de uma família (mesmas colunas em todas): série, valor, variações no dia, mês e ano, data.
// `br`: curva DI x pré da B3 (curves.br); com ela, as linhas da TFB ganham o spread contra o DI.
export function familyRows(family, bndes, moedas, now = Date.now(), br = null) {
  if (family === 'tfb') return bndesRows(bndes).map((r) => ({ ...toRow(r, r.key, `${PRAZO_LABEL[r.prazo]} · ${r.liberacao} dias`, `${r.key} · % a.a.`), spread: tfbSpread(tfbPoints(bndes, r.key), br, r.prazo), hasSpread: true }))
  if (family === 'tlp') {
    const v = tlpView(bndes, now)
    return [v ? { ...toRow({ ...v, missing: false }, 'TLP', TLP_LABEL, '777 · % a.a. · mensal'), nextRelease: v.nextRelease } : { id: 'TLP', name: TLP_LABEL, sub: '777 · % a.a. · mensal', missing: true }]
  }
  return groupRows(moedas, family, now).map((r) => toRow(r, r.id, r.name, `${r.id} · ${r.unit}`))
}

// Série escolhida para o gráfico: nome, código, unidade, casas decimais, tipo de cobertura e pontos até hoje.
export function seriesFor(family, id, bndes, moedas, now = Date.now()) {
  const list = (pts) => pts.map(([period, value]) => ({ period, value }))
  if (family === 'tfb') {
    const [, prazo, lib] = id.split('_')
    return { name: `TFB · ${PRAZO_LABEL[prazo] ?? `${prazo} meses`} · liberação em ${lib} dias`, code: `tfb-${id}`, unit: '% a.a.', kind: 'day', decimals: 2, list: list(tfbPoints(bndes, id)) }
  }
  if (family === 'tlp') return { name: `${TLP_LABEL} · % a.a.`, code: 'tlp-bndes', unit: '% a.a.', kind: 'month', decimals: 2, list: list(tlpView(bndes, now)?.points ?? []) }
  const s = GROUPS[family].find((x) => x.id === id) ?? GROUPS[family][0]
  return { name: `${s.name} (${s.id})`, code: `moeda-${s.id}`, unit: s.unit, kind: 'sparse', stepped: s.id === 'LD1', decimals: s.id === 'LD1' ? 6 : s.kind === 'level' ? (s.id === '143' ? 6 : 4) : 2, list: list(moedaPoints(moedas, s.id, now)) }
}
