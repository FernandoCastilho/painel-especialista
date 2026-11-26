import { useEffect, useState } from 'react'
import { imagemCotacao } from './cotacaoImagem.js'
import { bndesPdf } from './bndesPdfEml.js'

// Ícone do WhatsApp ao lado do envelope (pedido do Fernando em 24/11/2026): copia o quadro da cotação como imagem, pronto
// para colar na conversa. Sem área de transferência no navegador: abre o compartilhar do celular ou baixa o PNG.
// `gerar` e `arquivo` permitem outra imagem (CDC, 25/11/2026); o padrão continua sendo a cotação do BNDES.
export default function WhatsAppCotacao({ dados, gerar = imagemCotacao, arquivo = 'cotacao-bndes.png', titulo = 'Cotação BNDES' }) {
  const [aviso, setAviso] = useAviso()
  const label = 'Copiar a cotação como imagem para o WhatsApp'
  const copiar = async () => {
    const blob = gerar(dados)
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('sem área de transferência')
      // A promessa vai direto para o ClipboardItem: o Safari só aceita a cópia dentro do clique.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setAviso('Imagem copiada. Cole na conversa do WhatsApp.')
      return
    } catch { /* tenta compartilhar ou baixar */ }
    try {
      if (await compartilhar(new File([await blob], arquivo, { type: 'image/png' }), titulo)) return
      setAviso('Não deu para copiar neste navegador; a imagem foi baixada.')
    } catch { setAviso('Não foi possível gerar a imagem. Tente de novo.') }
  }
  return <Botao label={label} onClick={copiar} aviso={aviso} />
}

// PDF da simulação para o WhatsApp (sugestões do Painel, 26/11/2026): no celular abre o compartilhar, onde se escolhe o
// WhatsApp; no computador baixa o PDF para anexar na conversa. O PDF é o mesmo do envelope PDF do Outlook.
export function WhatsAppPdf({ itens, historico = null }) {
  const [aviso, setAviso] = useAviso()
  const enviar = async () => {
    try {
      const arquivoPdf = new File([bndesPdf({ itens, historico })], 'BNDES-Finame-Simulacao.pdf', { type: 'application/pdf' })
      if (!await compartilhar(arquivoPdf, 'Simulação BNDES')) setAviso('PDF baixado. Anexe na conversa do WhatsApp.')
    } catch { setAviso('Não foi possível gerar o PDF. Tente de novo.') }
  }
  return <Botao label="Enviar a simulação em PDF pelo WhatsApp" onClick={enviar} aviso={aviso} pdf />
}

function useAviso() {
  const [aviso, setAviso] = useState('')
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t) }, [aviso])
  return [aviso, setAviso]
}

// Abre o compartilhar do aparelho quando ele aceita arquivos (devolve true); senão baixa o arquivo (devolve false).
async function compartilhar(file, title) {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }) } catch { /* cancelado */ }
    return true
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a'); a.href = url; a.download = file.name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return false
}

function Botao({ label, onClick, aviso, pdf = false }) {
  return <span className="bndes-email bndes-whatsapp"><button type="button" className="credit-email" onClick={onClick} aria-label={label} title={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 20.5 4.8 16.4A8.5 8.5 0 1 1 8 19.3Z" /><path d="M9 8.6c0 3.3 3 6.4 6.4 6.4l1.1-1.4-2-1-1 .9a5 5 0 0 1-2.9-2.9l.9-1-1-2Z" /></svg>
    {pdf && <span className="bndes-email-pdf" aria-hidden="true">PDF</span>}
  </button>{aviso && <small role="status">{aviso}</small>}</span>
}
