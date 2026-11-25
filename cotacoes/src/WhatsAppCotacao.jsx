import { useEffect, useState } from 'react'
import { imagemCotacao } from './cotacaoImagem.js'

// Ícone do WhatsApp ao lado do envelope (pedido do Fernando em 24/11/2026): copia o quadro da cotação como imagem, pronto
// para colar na conversa. Sem área de transferência no navegador: abre o compartilhar do celular ou baixa o PNG.
// `gerar` e `arquivo` permitem outra imagem (CDC, 25/11/2026); o padrão continua sendo a cotação do BNDES.
export default function WhatsAppCotacao({ dados, gerar = imagemCotacao, arquivo = 'cotacao-bndes.png', titulo = 'Cotação BNDES' }) {
  const [aviso, setAviso] = useState('')
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(''), 5000); return () => clearTimeout(t) }, [aviso])
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
      const arquivoPng = new File([await blob], arquivo, { type: 'image/png' })
      if (navigator.canShare?.({ files: [arquivoPng] })) {
        try { await navigator.share({ files: [arquivoPng], title: titulo }) } catch { /* cancelado */ }
        return
      }
      const url = URL.createObjectURL(arquivoPng)
      const a = document.createElement('a'); a.href = url; a.download = arquivoPng.name; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setAviso('Não deu para copiar neste navegador; a imagem foi baixada.')
    } catch { setAviso('Não foi possível gerar a imagem. Tente de novo.') }
  }
  return <span className="bndes-email bndes-whatsapp"><button type="button" className="credit-email" onClick={copiar} aria-label={label} title={label}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 20.5 4.8 16.4A8.5 8.5 0 1 1 8 19.3Z" /><path d="M9 8.6c0 3.3 3 6.4 6.4 6.4l1.1-1.4-2-1-1 .9a5 5 0 0 1-2.9-2.9l.9-1-1-2Z" /></svg>
  </button>{aviso && <small role="status">{aviso}</small>}</span>
}
