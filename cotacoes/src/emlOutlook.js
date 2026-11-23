// Arquivo de mensagem para o Outlook (.eml), pedido do Fernando em 23/11/2026: o envelope baixa um e-mail já formatado,
// que abre no Outlook como rascunho pronto para enviar (cabeçalho X-Unsent: 1). Sem limite de tamanho, ao contrário do
// endereço de rascunho do Outlook na web. Só apresentação: o texto e a tabela chegam prontos de quem chama.

const CRLF = '\r\n'

// UTF-8 em base64, quebrado em linhas de 76 caracteres (padrão do formato de e-mail).
export function base64Utf8(texto) {
  const bytes = new TextEncoder().encode(texto)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario).replace(/.{1,76}/g, linha => linha + CRLF).trimEnd()
}

// Assunto com acentos, no formato que todo cliente de e-mail entende.
const assuntoCodificado = assunto => `=?UTF-8?B?${base64Utf8(assunto).replace(/\r\n/g, '')}?=`

// Monta o arquivo .eml: versão em texto simples e versão em HTML (a que o Outlook mostra).
export function montarEml({ assunto, texto, html, fronteira = 'painel-' + Math.random().toString(36).slice(2) }) {
  return [
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    `Subject: ${assuntoCodificado(assunto)}`,
    `Content-Type: multipart/alternative; boundary="${fronteira}"`,
    '',
    `--${fronteira}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(texto),
    `--${fronteira}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    base64Utf8(html),
    `--${fronteira}--`,
    '',
  ].join(CRLF)
}

// Nome de arquivo seguro para Windows e Mac, sem acentos: com acento, o navegador pode trocar o nome por "download".
export const nomeDeArquivo = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, ' ')
  .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) + '.eml'

// Baixa o arquivo no navegador.
export function baixarEml(nome, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'message/rfc822' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Escapa texto para dentro do HTML.
export const html = valor => String(valor ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
