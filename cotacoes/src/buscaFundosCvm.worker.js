import { buscarFundos, prepararBuscaCvm } from './fundosCvm.js'

let catalogo = []
let timer

self.onmessage = ({ data }) => {
  if (data.catalogo) {
    catalogo = data.catalogo
    prepararBuscaCvm(catalogo)
    return
  }
  clearTimeout(timer)
  const { busca, ids } = data
  timer = setTimeout(() => self.postMessage({ busca, ids, itens: buscarFundos(catalogo, busca, ids.split(',')) }), 0)
}
