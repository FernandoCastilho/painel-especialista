const commands = Object.freeze({
  '.': 'decimal', ',': 'decimal',
  Enter: 'enter', '=': 'enter',
  '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'percent', '^': 'power',
  Backspace: 'backspace', Delete: 'clearAll',
})

// O teclado físico atua apenas com foco no quadro ou em uma tecla da calculadora.
export function rpnKeyFromEvent(event) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.nativeEvent?.isComposing) return null
  const target = event.target
  if (target?.closest?.('input, textarea, select, [contenteditable], summary, a')) return null
  // Enter/Space nas teclas focadas continuam usando a ativação nativa (evita executar duas vezes).
  if (event.key === 'Enter' && target?.closest?.('button')) return null
  if (/^[0-9]$/.test(event.key)) return event.key
  return Object.hasOwn(commands, event.key) ? commands[event.key] : null
}
