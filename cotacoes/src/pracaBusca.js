import { PRACAS_CONTRATO } from './pracaContrato.js'

const normalize = value => value.normalize('NFD').replace(/\p{Mark}/gu, '').toLowerCase().trim()

export function findPracasContrato(query) {
  const tokens = normalize(query).split(/[\s().·,–-]+/u).filter(Boolean)
  return PRACAS_CONTRATO.filter(praca => {
    const name = normalize(praca.label)
    return tokens.every(token => name.includes(token))
  })
}
