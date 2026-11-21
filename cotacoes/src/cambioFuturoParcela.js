import { daysBetween } from './cambioFuturo.js'
import { irr } from './emprestimo4131.js'

const dataValida = iso => {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso
}
const positivo = n => Number.isFinite(n) && n > 0
const falha = error => ({ ok: false, error })

export function simularParcelaCambial({ parcelaUsd, spotUsd, taxaPct, start, vencimento, spotMoeda, futuroMoeda }) {
  if (!positivo(parcelaUsd)) return falha('Informe o valor da parcela em USD, já com juros.')
  if (!dataValida(start) || !dataValida(vencimento) || vencimento <= start) return falha('Informe um vencimento posterior à data-base.')
  if (!positivo(spotUsd)) return falha('Informe a cotação de partida do dólar.')
  if (!Number.isFinite(taxaPct) || taxaPct < 0 || taxaPct > 100) return falha('Informe uma taxa all-in de 0% a 100% a.a.')
  if (!positivo(spotMoeda)) return falha('Informe a cotação de partida da moeda.')

  const dias = daysBetween(start, vencimento)
  // A parcela USD já contém os juros. Para recuperar o principal, desfazemos os juros
  // simples dias/360, em vez de acrescentá-los de novo à parcela convertida.
  const parcelaNoSpotBrl = parcelaUsd * spotUsd
  const recebidoBrl = parcelaNoSpotBrl / (1 + taxaPct / 100 * dias / 360)
  const parcelaMoeda = parcelaNoSpotBrl / spotMoeda
  if (![recebidoBrl, parcelaMoeda].every(positivo)) return falha('Os valores informados excedem a faixa da simulação.')
  const resumo = { ok: true, parcelaMoeda, recebidoBrl, dias, pagamentoBrl: null, tir: null }
  if (!positivo(futuroMoeda)) return resumo
  const pagamentoBrl = parcelaMoeda * futuroMoeda
  if (!positivo(pagamentoBrl)) return falha('A cotação futura excede a faixa da simulação.')
  // Mesma raiz de VPL e convenção dias/365 do motor compartilhado, na visão do tomador.
  const taxa = irr([{ v: recebidoBrl, t: 0 }, { v: -pagamentoBrl, t: dias / 365 }])
  return { ...resumo, pagamentoBrl, tir: taxa == null ? null : taxa * 100 }
}
