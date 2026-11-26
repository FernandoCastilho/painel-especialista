import { useState } from 'react'
import { bndesEml } from './bndesEml.js'
import { bndesPdfEml } from './bndesPdfEml.js'
import { baixarEml } from './emlOutlook.js'

// Envelope que baixa um arquivo de mensagem do Outlook (.eml), já formatado em estilo executivo (pedido do Fernando em
// 23/11/2026). Aberto, o arquivo vira um rascunho no Outlook, pronto para enviar. `gerar` devolve { nome, conteudo }.
// Mesmo ícone do Capital de Giro. Aviso na tela só se o arquivo não puder ser gerado (tela limpa).
export function EnvelopeEml({ label, gerar, pdf = false }) {
  const [erro, setErro] = useState('')
  const baixar = () => {
    try {
      const { nome, conteudo } = gerar()
      baixarEml(nome, conteudo)
      setErro('')
    } catch { setErro('Não foi possível gerar o arquivo do e-mail. Tente de novo.') }
  }
  return <span className="bndes-email"><button type="button" className="credit-email" onClick={baixar} aria-label={label} title={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
    {pdf && <span className="bndes-email-pdf" aria-hidden="true">PDF</span>}
  </button>{erro && <small role="alert">{erro}</small>}</span>
}

// BNDES: a cotação, com as alternativas lado a lado quando houver comparação.
export default function EmailEnvelope({ result, alternatives }) {
  return <EnvelopeEml label="Baixar e-mail da cotação para o Outlook" gerar={() => bndesEml({ itens: alternatives?.length ? alternatives : [result] })} />
}

export function EmailEnvelopePdf({ itens, historico = null }) {
  return <EnvelopeEml label="Baixar e-mail com PDF em anexo para o Outlook" pdf gerar={() => bndesPdfEml({ itens, historico })} />
}
