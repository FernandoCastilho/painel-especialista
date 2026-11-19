import { useEffect, useRef, useState } from 'react'
import Ajuste from './ApresentarAjuste.jsx'

// Onde fica o resultado principal de cada calculadora (os quadros de resultado já seguem esta convenção de nomes).
const RESULTADO = '.calc-result-shell, .credit-results, .fm-results'
const visivel = (el) => el.getClientRects().length > 0
const TEM_NUMERO = /R\$\s?[\d.]+,\d|\d,\d+\s?%/
const LINHAS_DE_PLANILHA = 14 // acima disso a tabela é memória de cálculo ou planilha, e não entra no slide

// Marca o que sai da tela em cada modo, sem alterar a calculadora: no modo Resultado ficam só os quadros de resultado
// (e o caminho até eles); no modo Dados, os quadros de resultado saem e ficam os campos. Tabelas longas saem nos dois modos.
// Devolve quantos quadros de resultado já têm número para mostrar.
export function marcarModo(raiz, modo) {
  for (const el of raiz.querySelectorAll('[data-apz-fora]')) el.removeAttribute('data-apz-fora')
  for (const tabela of raiz.querySelectorAll('table')) if (tabela.rows.length > LINHAS_DE_PLANILHA) tabela.setAttribute('data-apz-fora', '')
  const todos = [...raiz.querySelectorAll(RESULTADO)]
  const resultados = todos.filter((el) => !todos.some((outro) => outro !== el && outro.contains(el)))
  // Conta só o que a pessoa veria (os quadros estão sem marca neste ponto): texto de ajuda e memórias escondidas não valem.
  // Quadro que já nasce pronto (gráfico sem R$ nem %) avisa com data-apz-pronto.
  const comNumero = resultados.filter((el) => visivel(el) && (el.hasAttribute('data-apz-pronto') || TEM_NUMERO.test(el.innerText ?? el.textContent))).length
  if (modo === 'dados') { for (const el of resultados) el.setAttribute('data-apz-fora', ''); return comNumero }
  if (!comNumero) return 0
  const manter = new Set()
  for (const el of resultados) for (let e = el; e && e !== raiz; e = e.parentElement) manter.add(e)
  for (const e of manter) for (const irmao of e.parentElement.children) if (!manter.has(irmao)) irmao.setAttribute('data-apz-fora', '')
  return comNumero
}

export default function CalculadoraSlide({ children }) {
  const raiz = useRef(null)
  const [modo, setModo] = useState('resultado') // o que a pessoa escolheu
  const [tem, setTem] = useState(false) // já há resultado com número para mostrar
  // Sem resultado ainda (dados carregando ou campos por preencher), o slide mostra os campos; o resultado entra quando existir.
  const efetivo = modo === 'resultado' && !tem ? 'dados' : modo
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    let quadro = 0
    const aplicar = () => setTem(marcarModo(el, efetivo) > 0)
    aplicar()
    const mo = new MutationObserver(() => { cancelAnimationFrame(quadro); quadro = requestAnimationFrame(aplicar) })
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => { mo.disconnect(); cancelAnimationFrame(quadro) }
  }, [efetivo])
  const dados = efetivo === 'dados'
  // Quem começa a digitar nos campos fica nos campos: o slide não troca para o resultado no meio da digitação.
  const aoDigitar = () => { if (modo === 'resultado' && dados) setModo('dados') }
  return (
    <div className={`sl-calc-quadro sl-calc-modo-${efetivo}`}>
      <div className="sl-calc-modos" role="group" aria-label="O que mostrar no slide">
        <span>{dados ? 'Digite os números da simulação.' : 'Resultado da simulação.'}</span>
        <button type="button" aria-pressed={!dados} disabled={!tem} title={!tem ? 'Preencha os dados para ver o resultado' : undefined} onClick={() => setModo('resultado')}>Resultado</button>
        <button type="button" aria-pressed={dados} onClick={() => setModo('dados')}>Dados</button>
      </div>
      <Ajuste min={dados ? 0.8 : 0.45} max={dados ? 1 : 1.6} rolar={dados}><div ref={raiz} onInput={aoDigitar} onChange={aoDigitar}>{children}</div></Ajuste>
    </div>
  )
}
