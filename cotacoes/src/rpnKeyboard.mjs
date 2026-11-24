const commands = Object.freeze({
  '.': 'decimal', ',': 'decimal',
  Enter: 'enter', '=': 'enter',
  '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'percent', '^': 'power',
  Backspace: 'backspace', Delete: 'clx', Escape: 'cancel', f: 'f', g: 'g', c: 'clx', n: 'n', i: 'i',
})

// Teclado físico é local ao quadro. Campos, links, disclosure e conversor mantêm seus eventos nativos.
export function rpnKeyFromEvent(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.nativeEvent?.isComposing) return null
  const target = event.target
  if (target?.closest?.('input, textarea, select, [contenteditable], summary, a, .rpn-rates')) return null
  // Enter/Space nas teclas focadas continuam usando a ativação nativa.
  if (event.key === 'Enter' && target?.closest?.('button')) return null
  if (/^[0-9]$/.test(event.key)) return event.key
  // O prefixo f/g fica no motor. C sempre envia a tecla física CLx.
  const key = /^[A-Z]$/.test(event.key) ? event.key.toLowerCase() : event.key
  return Object.hasOwn(commands, key) ? commands[key] : null
}
