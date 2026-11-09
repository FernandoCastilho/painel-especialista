// All dimensions and measurements are CSS pixels, so small screens do not get tiny SVG text.
export function recoveryCellLabel(label, count, width, height, measure) {
  const number = new Intl.NumberFormat('pt-BR').format(count)
  const available = width - 12
  if (height >= 44 && measure(label) <= available && measure(number) <= available) return { mode:'full', number }
  if (height >= 16 && measure(number) <= width - 4) return { mode:'number', number }
  return { mode:'none', number }
}
