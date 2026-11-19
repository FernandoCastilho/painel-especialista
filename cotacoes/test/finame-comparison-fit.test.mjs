import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const jsx = await readFile(new URL('../src/FinameMateriais.jsx', import.meta.url), 'utf8')
const css = await readFile(new URL('../src/FinameComparisonLayout.css', import.meta.url), 'utf8')

// Comparação do Finame: as tabelas de opções ocupam só o necessário e crescem a cada alternativa, em vez de esticar pela tela toda.
test('tabelas de opções do Finame têm largura pelo número de colunas', () => {
  assert.match(jsx, /const fitStyle = \{ '--fm-opcoes': Math\.max\(1, alternatives\.length\) \}/)
  assert.match(jsx, /const matrizStyle = \{ '--fm-opcoes': alternatives\.length \+ \(comDiferenca \? 1 : 0\) \}/)
  assert.match(jsx, /aria-label=\{`Resultados \$\{custo\.toUpperCase\(\)\} e \$\{outro\.toUpperCase\(\)\}`\}><table className="cx-matrix fm-fit fm-exec-matrix" style=\{matrizStyle\}>/)
  for (const rotulo of ['Composição das alternativas', 'Datas e parcelas das alternativas']) {
    assert.match(jsx, new RegExp(`aria-label="${rotulo}"><table className="cx-matrix fm-fit" style=\\{fitStyle\\}>`), rotulo)
  }
  assert.match(css, /table\.cx-matrix\.fm-fit[^{]*\{[^}]*width:min\(100%,calc\(var\(--fm-rotulo\) \+ var\(--fm-opcoes,2\) \* var\(--fm-coluna\)\)\) !important;[^}]*table-layout:fixed;/)
})

test('comparação executiva: conclusão primeiro, uma tabela só e sem barra de rolagem nos indicadores', () => {
  // A faixa de conclusão vem antes da tabela e só mostra resultados já calculados.
  assert.ok(jsx.indexOf('className="fm-verdict"') > 0 && jsx.indexOf('className="fm-verdict"') < jsx.indexOf('fm-exec-matrix'))
  // Taxas, parcelas e composição do custo ficam na mesma tabela, com os rótulos que os demais testes e o cliente já conhecem.
  // Os três assuntos viram abas da mesma tabela (taxas, parcelas, custo total), uma por vez, para não encher a tela.
  for (const aba of ['taxas', 'parcelas', 'custo']) assert.ok(jsx.includes(`abaComparacao === '${aba}'`), aba)
  for (const linha of ['Taxa de referência', 'Taxa final', 'CET estimado', 'Primeira parcela após carência', 'Última parcela', 'Juros totais', 'TAC à vista', 'IOF', 'ECG à vista', 'Custo total estimado']) assert.ok(jsx.includes(`'${linha}'`), linha)
  // A diferença só aparece com duas opções e, em reais, usa os valores já arredondados para centavos.
  assert.match(jsx, /const comDiferenca = resumida && alternatives\.length === 2/)
  assert.match(jsx, /\(Math\.round\(valores\[1\] \* 100\) - Math\.round\(valores\[0\] \* 100\)\) \/ 100/)
  // Na comparação, a composição não se repete em outro quadro; sem comparar, o quadro continua e não tem rolagem.
  assert.match(jsx, /\{resumida \? detalhamento : <section className="fm-composicao-details" aria-labelledby="fm-composicao-h"><h4 id="fm-composicao-h">Composição do resultado<\/h4>/)
  assert.match(jsx, /className="fm-parcel-scroll fm-composicao"/)
  assert.match(css, /\.bw \.fm-composicao \{ max-height:none; overflow:visible; \}/)
  // A lista completa só abre a pedido, pelo sumário ou comando dos marcos.
  assert.match(jsx, /className="fm-marcos-todas" onClick=\{abrirParcelas\} aria-controls="fm-parcelas"/)
  assert.match(jsx, /<details id="fm-parcelas" ref=\{parcelasRef\}[^>]*>/)
  assert.doesNotMatch(jsx, /<details id="fm-parcelas"[^>]*\bopen[= >]/)
  assert.match(jsx, /detalhes\.open = true/)
})
