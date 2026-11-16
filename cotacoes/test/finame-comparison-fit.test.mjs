import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Comparação do Finame: as tabelas de opções ocupam só o necessário e crescem a cada alternativa, em vez de esticar pela tela toda.
test('tabelas da comparação do Finame têm largura pelo número de opções', async () => {
  const jsx = await readFile(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
  const css = await readFile(new URL('../src/FinameComparisonLayout.css', import.meta.url), 'utf8')
  assert.match(jsx, /const fitStyle = \{ '--fm-opcoes': Math\.max\(1, alternatives\.length\) \}/)
  for (const rotulo of ['Resultados TFC e TFB', 'Composição das alternativas', 'Datas e parcelas das alternativas']) {
    assert.match(jsx, new RegExp(`aria-label="${rotulo}"><table className="cx-matrix fm-fit" style=\\{fitStyle\\}>`), rotulo)
  }
  assert.match(jsx, /Detalhes da comparação<\/summary><div className="cx-wrap"><table className="cx-matrix fm-fit" style=\{fitStyle\}>/)
  assert.match(css, /table\.cx-matrix\.fm-fit[^{]*\{[^}]*width:min\(100%,calc\(var\(--fm-rotulo\) \+ var\(--fm-opcoes,2\) \* var\(--fm-coluna\)\)\) !important;[^}]*table-layout:fixed;/)
  // No celular não sobra espaço para encolher: a tabela volta a ocupar a largura disponível, sem cortar valores.
  assert.match(css, /@media\(max-width:700px\) \{ \.bw table\.cx-matrix\.fm-fit[^{]*\{ width:100% !important; table-layout:auto; \}/)
})
