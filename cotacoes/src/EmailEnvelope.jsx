import { useState } from 'react'
import { bndesEml } from './bndesEml.js'
import { baixarEml } from './emlOutlook.js'

// Envelope do BNDES (pedido do Fernando em 23/11/2026): baixa um arquivo de mensagem do Outlook (.eml), já formatado em
// estilo executivo e com o cronograma completo. Aberto, o arquivo vira um rascunho no Outlook, pronto para enviar.
// Mesmo ícone do Capital de Giro. Aviso na tela só se o arquivo não puder ser gerado (tela limpa).
export default function EmailEnvelope({ result, alternatives }) {
  const [erro, setErro] = useState('')
  const label = 'Baixar e-mail da cotação para o Outlook'
  const baixar = () => {
    try {
      const { nome, conteudo } = bndesEml({ itens: alternatives?.length ? alternatives : [result] })
      baixarEml(nome, conteudo)
      setErro('')
    } catch { setErro('Não foi possível gerar o arquivo do e-mail. Tente de novo.') }
  }
  return <span className="bndes-email"><button type="button" className="credit-email" onClick={baixar} aria-label={label} title={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
  </button>{erro && <small role="alert">{erro}</small>}</span>
}
