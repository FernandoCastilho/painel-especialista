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
  const { busca } = data
  timer = setTimeout(() => self.postMessage({ busca, itens: buscarFundos(catalogo, busca) }), 0)
}
