import { simularParcelasCambiais, mostrarBrutoTravaCruzada } from './cambioFuturoCenario.js'

const valido = value => Number.isFinite(value) && value > 0
const dataValida = date => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const parsed = Date.parse(date + 'T12:00:00Z')
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date
}
export const quantidadeCotacao = (modalidade, quantidade) => modalidade === 'bullet' ? 1 : quantidade
export const cotacaoVazia = () => ({ spotUsd: '', futuroUsd: '', spotAlvo: '', futuroAlvo: '', produtoUsd: '', produtoAlvo: '' })
export const alterarVencimento = (linha, vencimento) => linha.vencimento === vencimento ? linha : { ...linha, ...cotacaoVazia(), vencimento }

export function calcularCotacaoMesa(inicio, parcelas) {
  const linhas = parcelas.map(linha => {
    const apta = dataValida(inicio) && dataValida(linha.vencimento) && linha.vencimento > inicio &&
      valido(linha.principal) && Number.isFinite(linha.juros) && linha.juros >= 0
    const soma = apta ? (Math.round(linha.principal * 100) + Math.round(linha.juros * 100)) / 100 : null
    const comJuros = valido(soma) ? soma : null
    const valorInicial = apta ? mostrarBrutoTravaCruzada(linha.principal, linha.spotUsd, 1) : null
    const paridade = valido(linha.spotUsd) && valido(linha.spotAlvo) ? linha.spotUsd / linha.spotAlvo : null
    return { ...linha, comJuros, valorInicial, paridade, equivalente: valido(comJuros * paridade) ? comJuros * paridade : null }
  })
  const desembolso = linhas.length && linhas.every(linha => valido(linha.valorInicial))
    ? linhas.reduce((acc, linha) => acc + Math.round(linha.valorInicial * 100), 0) / 100 : null
  const cotar = (campoValor, campoTaxa) => simularParcelasCambiais({
    inicio, liquidoBrl: desembolso,
    parcelas: linhas.map(l => ({
      id: String(l.id), vencimento: l.vencimento, valorMoeda: l[campoValor],
      taxaTrava: valido(l[campoTaxa]) ? l[campoTaxa] : null,
    })),
  })
  return { linhas, desembolso, usd: cotar('comJuros', 'futuroUsd'), alvo: cotar('equivalente', 'futuroAlvo') }
}
