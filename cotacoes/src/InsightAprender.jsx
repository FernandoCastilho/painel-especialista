import { useEffect, useState } from 'react'
import { chaveInsight, sortearInsight } from './insightAprender.js'
import { conceitoDoDia, conceitoVisto, marcarConceito } from './conceitoDiario.js'
import ConceitoDiario from './ConceitoDiario.jsx'

// Linha "💡 Aprender" no Mercado: muda a cada entrada no app e a cada atualização manual das cotações (evento quotes-refresh).
// O conceito do dia não abre mais sozinho: fica no botão "Conceito do dia" desta faixa, com um ponto enquanto o de hoje não foi aberto.
const KEY = 'insight-aprender-ultimo'
const ultimo = () => { try { return sessionStorage.getItem(KEY) ?? '' } catch { return '' } }
const novo = () => { const i = sortearInsight(Math.random, ultimo()); try { sessionStorage.setItem(KEY, chaveInsight(i)) } catch { /* sem armazenamento */ } return i }

export default function InsightAprender({ goto }) {
  const [i, setI] = useState(novo)
  const [conceitoAberto, setConceitoAberto] = useState(false)
  const [lido, setLido] = useState(() => conceitoVisto(conceitoDoDia().dia))
  useEffect(() => {
    const trocar = () => setI(novo())
    window.addEventListener('quotes-refresh', trocar)
    return () => window.removeEventListener('quotes-refresh', trocar)
  }, [])
  if (!i) return null
  const abrirConceito = () => { marcarConceito(conceitoDoDia().dia); setLido(true); setConceitoAberto(true) }
  return (
    <>
      <p className="insight-aprender" aria-live="polite">
        <span aria-hidden="true">💡</span>
        <span><b>{i.nome}</b> · <i>{i.tipo}:</i> {i.texto}</span>
        {goto && <button type="button" className="linklike" onClick={() => goto('aprender', i.id)}>Ver em Aprender ›</button>}
        {goto && <button type="button" className="linklike sinal-novo-host" aria-haspopup="dialog" title={lido ? undefined : 'Conceito de hoje ainda não aberto'} onClick={abrirConceito}>Conceito do dia{!lido && <><span className="sinal-novo" aria-hidden="true" /><span className="sr-only"> (novo hoje)</span></>}</button>}
      </p>
      {goto && <ConceitoDiario open={conceitoAberto} onClose={() => setConceitoAberto(false)} goto={goto} />}
    </>
  )
}
