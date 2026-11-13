// Eixos dos gráficos: marcas em números redondos e rótulo de data num formato só.
// Só desenho: não altera pontos, valores nem cálculos financeiros.

const MULTIPLOS = [1, 2, 2.5, 5]
const FOLGA = 1e-9

// Casas decimais necessárias para escrever um passo redondo (0,5 → 1; 0,25 → 2; 2,5 → 1; 20 → 0).
const casasDoPasso = (multiplo, expoente) => Math.max(0, -expoente + (multiplo === 2.5 ? 1 : 0))

function marcasCom(lo, hi, multiplo, expoente) {
  const passo = multiplo * 10 ** expoente
  const casas = casasDoPasso(multiplo, expoente)
  const de = Math.floor(lo / passo + FOLGA)
  const ate = Math.ceil(hi / passo - FOLGA)
  return { passo, casas, de, ate, total: ate - de + 1 }
}

// Marcas do eixo vertical em números redondos (passos 1, 2, 2,5 ou 5 × 10ⁿ), cobrindo [lo, hi].
// O domínio é estendido até a marca redonda vizinha e o eixo fica com 4 a 6 marcas.
// Devolve { ticks, lo, hi, passo, casas }; `casas` é o número de casas decimais que o rótulo precisa.
export function marcasRedondas(lo, hi, { min = 4, max = 6 } = {}) {
  let a = Number.isFinite(lo) ? lo : Number.isFinite(hi) ? hi : 0
  let b = Number.isFinite(hi) ? hi : a
  if (a > b) [a, b] = [b, a]
  // série constante (ou faixa nula): abre uma faixa pequena em volta do valor, proporcional ao tamanho dele
  if (!(b - a > Math.max(Math.abs(a), Math.abs(b)) * 1e-12)) {
    const meia = a === 0 ? 1 : Math.abs(a) * 0.01
    b = a + meia
    a -= meia
  }
  const bruto = (b - a) / (max - 1)
  let expoente = Math.floor(Math.log10(bruto)) - 1
  let m = null
  // o menor passo redondo que cabe em até `max` marcas
  for (let guarda = 0; guarda < 40 && !m; guarda++, expoente++) {
    for (const multiplo of MULTIPLOS) {
      const tentativa = marcasCom(a, b, multiplo, expoente)
      if (tentativa.total > max) continue
      // o passo 2,5 pede uma casa a mais no rótulo (5,575): só entra quando o passo 5 deixaria marcas de menos
      const cinco = multiplo === 2.5 ? marcasCom(a, b, 5, expoente) : null
      m = cinco && cinco.total >= min ? cinco : tentativa
      break
    }
  }
  let { de, ate } = m
  // faixa que coube em menos marcas que o mínimo: estende uma marca por vez, alternando os lados (sem cruzar o zero à toa)
  let paraCima = true
  while (ate - de + 1 < min) {
    if (de === 0 || (paraCima && ate !== 0)) ate++
    else de--
    paraCima = !paraCima
  }
  const ticks = []
  for (let i = de; i <= ate; i++) ticks.push(Number((i * m.passo).toFixed(Math.min(100, m.casas + 2))))
  return { ticks, lo: ticks[0], hi: ticks[ticks.length - 1], passo: m.passo, casas: m.casas }
}
