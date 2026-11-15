import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Apoio ao toque nos gráficos. Só interação e posição do balão: não altera pontos nem cálculos financeiros.

// O foco veio do teclado (Tab)? Toque e clique também dão foco ao gráfico, mas não podem levar o cursor ao primeiro ponto.
export function focoPorTeclado(e) {
  try { return e.currentTarget.matches(':focus-visible') } catch { return true }
}

// Dedo levantado dispara "saída" do ponteiro; o balão deve continuar à mostra até tocar fora ou em outro ponto.
export const saidaDeToque = (e) => e?.pointerType === 'touch'

// Centro do balão (px) para que ele caiba inteiro no contêiner, com folga nas duas bordas. Balão maior que o contêiner fica centralizado.
export function limitarBalao(centro, larguraBalao, larguraConteiner, folga = 4) {
  const metade = larguraBalao / 2
  const min = folga + metade
  const max = larguraConteiner - folga - metade
  if (!(min <= max)) return larguraConteiner / 2
  return Math.min(Math.max(centro, min), max)
}

// Margem esquerda do eixo vertical pelo maior rótulo (algarismos tabulares de 12 px ocupam até cerca de 7 px), nunca menor que a margem padrão.
export function margemEixo(rotulos, minimo = 58, larguraChar = 7, respiro = 9) {
  const maior = Math.max(0, ...rotulos.map((r) => String(r).length))
  return Math.max(minimo, Math.ceil(maior * larguraChar + respiro))
}

// Rótulo do eixo em formato brasileiro, com sinal de menos tipográfico.
export const rotuloEixo = (v, casas) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).replace('-', '−')

// Fora do navegador (testes que montam a página em texto) não há o que medir.
const useMedir = typeof window === 'undefined' ? useEffect : useLayoutEffect

// Largura real do balão, medida depois de desenhar. `ponto` é o ponto à mostra: o texto (e a largura) muda com ele.
export function useLarguraBalao(ponto) {
  const ref = useRef(null)
  const [largura, setLargura] = useState(0)
  useMedir(() => {
    setLargura(ref.current?.offsetWidth ?? 0)
  }, [ponto])
  return [ref, largura]
}

// Com o balão à mostra, tocar ou clicar fora do gráfico o esconde.
export function useTocarFora(ativo, limpar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ativo) return
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) limpar(null) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [ativo, limpar])
  return ref
}
