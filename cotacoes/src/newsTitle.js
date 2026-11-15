// Tira do fim da manchete a assinatura que o agregador cola no título ("... Por Investing.com", "... - Investing.com").
// Só mexe no fim; se a manchete for só a assinatura, devolve como veio.
const SOBRA_AGREGADOR = /\s*(?:[-–—|·:]\s*|\s(?:por|by)\s+)investing\.com(?:\s+(?:brasil|brazil|br))?\s*\.?\s*$/i

// Nomes que continuam com maiúscula quando a manchete vem Com Maiúscula Em Cada Palavra.
const NOMES = new Set(['ibovespa', 'brasil', 'eua', 'fed', 'copom', 'petrobras', 'vale', 'itaú', 'bradesco', 'santander', 'caixa', 'banco', 'central',
  'tesouro', 'lula', 'haddad', 'galípolo', 'trump', 'powell', 'lagarde', 'china', 'japão', 'europa', 'estados', 'unidos', 'wall', 'street', 'nasdaq',
  'dow', 'jones', 's&p', 'selic', 'ipca', 'pib', 'focus', 'b3', 'opep', 'bce', 'nvidia', 'apple', 'microsoft', 'tesla', 'amazon', 'google', 'meta',
  'openai', 'embraer', 'ambev', 'natura', 'braskem', 'magalu', 'irã', 'israel', 'rússia', 'ucrânia', 'argentina', 'méxico', 'alemanha', 'frança',
  'londres', 'tóquio', 'pequim', 'nova', 'york', 'são', 'paulo', 'rio', 'janeiro', 'senado', 'câmara', 'stf', 'cvm', 'bndes', 'iof', 'fgts', 'inss'])

const palavras = (t) => t.split(/\s+/).filter((w) => /^[\p{L}]{3,}/u.test(w))
// Manchete "Em Título": quase todas as palavras de 3+ letras começam com maiúscula (e não é toda em caixa alta).
export function emCaixaDeTitulo(title) {
  const ws = palavras(title)
  if (ws.length < 4 || title === title.toUpperCase()) return false
  const altas = ws.filter((w) => /^\p{Lu}/u.test(w)).length
  return altas / ws.length >= 0.8
}

// Volta a manchete "Em Título" para a escrita normal do português: maiúscula no começo, depois de ; : ? ! e em nomes conhecidos;
// siglas (EUA, R$, 3T26) e palavras com números ficam como vieram. Só apresentação: o texto da fonte não muda.
export function caixaNormal(title) {
  if (!emCaixaDeTitulo(title)) return title
  let inicio = true
  return title.split(/(\s+)/).map((tok) => {
    if (/^\s+$/.test(tok) || !tok) return tok
    const nucleo = tok.replace(/^[^\p{L}\d]+|[^\p{L}\d&]+$/gu, '')
    const fim = /[;:?!]$/.test(tok)
    let out = tok
    if (!inicio && /^[EOAÀÉ]$/.test(nucleo)) out = tok.replace(nucleo, nucleo.toLocaleLowerCase('pt-BR'))
    else if (!inicio && nucleo && /^\p{Lu}[\p{Ll}]/u.test(nucleo) && !/\d/.test(nucleo) && !NOMES.has(nucleo.toLocaleLowerCase('pt-BR'))) out = tok.replace(nucleo, nucleo.toLocaleLowerCase('pt-BR'))
    if (nucleo) inicio = false
    if (fim) inicio = true
    return out
  }).join('')
}

export function limparManchete(title) {
  if (typeof title !== 'string') return title
  const limpo = title.replace(SOBRA_AGREGADOR, '').trim()
  return caixaNormal(limpo || title)
}
