// Contrato dos controles do quadro, sem copiar imagem ou alterar o clipboard do runner.
const assert = require('node:assert/strict')
module.exports = async function captureControls(dialog) {
  const controls = dialog.locator('.expandable-controls')
  const camera = controls.getByRole('button', { name: /^Copiar imagem: quadro completo: / })
  const close = controls.getByRole('button', { name: 'Fechar detalhes', exact: true })
  assert.equal(await controls.getByRole('button').count(), 2, 'somente câmera e fechar no quadro modal')
  assert.equal(await camera.count(), 1, 'uma câmera identificada por nome acessível')
  assert.equal(await camera.isVisible(), true)
  assert.equal(await camera.isEnabled(), true)
  await camera.focus()
  assert.equal(await camera.evaluate(el => el === document.activeElement), true, 'câmera alcançável por foco')
  assert.equal(await close.count(), 1)
  assert.equal(await close.innerText(), 'Fechar ×')
  assert.equal(await close.isEnabled(), true)
  assert.equal(await controls.getByRole('button', { name: /^(Maximizar|Restaurar) / }).count(), 0, 'sem zoom duplicado no modal')
  return close
}
