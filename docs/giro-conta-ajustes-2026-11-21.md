# Capital de Giro: regras da conta com os ajustes de 21/11/2026

Mudança de regra de cálculo autorizada por Fernando em 21/11/2026, para revisão independente.
Código: `cotacoes/src/giroConta.js` (função `giroConta`). Testes: `cotacoes/test/giro-conta.test.mjs` e `cotacoes/test/giro-email.test.mjs`.

## O que não mudou

- `giroOperation` e `simulateCredit` em `creditComparison.js` ficaram intactos. Eles continuam servindo o Comparador (Necessidade do Cliente) e a Análise de desconto.
- A tela do Capital de Giro passou a usar `giroConta`, uma cópia do caminho do Giro do `simulateCredit` (prefixado, em centavos), com as novidades como opções.
- Com as opções de hoje (mensal, juros da carência somados ao saldo, sem flex, Fee em R$) o resultado de `giroConta` é idêntico ao de `giroOperation`, campo a campo e centavo a centavo. O teste compara 600 operações sorteadas (Price, SAC e Bullet; prazos de 1 a 72 meses; carência; 1º vencimento à mão; taxa a.m. e a.a.; PJ e Simples; despesas à vista e financiadas; IOF à vista e financiado; seis praças), cada uma chamada de dois jeitos: sem os parâmetros novos e com eles explícitos no valor padrão.

Regras que continuam iguais: juros por dias corridos, `(1 + i)^(dias/30) − 1`, com `i` ao mês (taxa ao ano convertida por juros compostos); vencimento em fim de semana ou feriado vai para o próximo dia útil da praça; centavos como no `giroOperation` (arredonda o principal acumulado por vencimento, última parcela fecha o saldo); IOF = 0,38% do valor da operação + diária (0,0082% PJ; 0,00274% Simples até R$ 30 mil) × principal de cada amortização × min(dias, 365); CET anual em dias corridos/365 sobre o líquido e as parcelas.

## 1. Periodicidade

- `p` em meses: mensal 1, bimestral 2, trimestral 3, quadrimestral 4, semestral 6. Vale para Price e SAC. No Bullet, não se aplica (pagamento único no fim; `p` é tratado como 1).
- Parcelas = (prazo − carência) / p. Se não for inteiro, a tela mostra erro no campo Periodicidade com os prazos possíveis mais próximos (exemplo: prazo 25, carência 0, trimestral → "use prazo de 24 ou 27 meses").
- 1º vencimento automático = liberação + carência + p meses. Os seguintes, a cada p meses, no mesmo dia do mês do 1º vencimento (no fim do mês, o último dia). Cada um vai para o próximo dia útil. O 1º vencimento digitado à mão prevalece.
- Juros pagos junto com o principal, na mesma periodicidade, por dias corridos entre os vencimentos.
- Price: pagamento teórico igual pelo valor presente com os fatores de cada período (igual ao de hoje, agora com períodos de p meses). SAC: amortização = saldo / parcelas.
- Carência somada ao saldo: dias do 1º período além de 30 × p são capitalizados no saldo antes da 1ª parcela (no mensal, além de 30, exatamente como hoje).

## 2. Pagar juros na carência (opção; desligada = como hoje)

- Fim da carência = 1º vencimento (contratual, antes do ajuste de dia útil) menos p meses. Se não for depois da liberação, não há carência e a opção não muda nada.
- Pagamentos só de juros em liberação + p, + 2p, ... enquanto forem antes do fim da carência, e um último no próprio fim da carência (quando a carência é múltipla de p, ele coincide com o último da série). Cada um vai para o próximo dia útil.
- Juros de cada um por dias corridos desde o anterior (o primeiro, desde a liberação), sobre o valor financiado. Amortização zero. Não há capitalização: o saldo continua igual ao valor financiado.
- Depois começam as parcelas; os juros da 1ª contam desde o último pagamento de juros.
- Essas linhas entram na tabela (marcadas "só juros"), no total pago, nos juros, no custo e no CET. O IOF continua sobre as amortizações e seus prazos (as linhas de juros têm amortização zero, logo não pagam IOF).

## 3. Fee em R$ ou %

- Em %: Fee = arredondamento a centavos de (valor solicitado × percentual / 100). Daí em diante é igual ao Fee em R$, à vista ou financiado. Percentual aceito de 0 a 100.

## 4. Parcela flex

Entrada: `{ nº da parcela: { date?, payment? } }`. A numeração conta também as linhas só de juros. Não vale no Bullet.

1. Toda parcela alterada fica fixa. Seja f a primeira fixa.
2. Parcelas antes de f: valores, datas e saldos de antes, sem mudança.
3. Data alterada: vai para o próximo dia útil e precisa ficar depois do vencimento anterior e antes do seguinte (senão, erro "Parcela N: o vencimento precisa ficar entre ... e ..."). Os juros de cada período contam pelos dias entre os vencimentos (ajustados).
4. Parcela fixa só na data: mantém a amortização que tinha; muda o juro dela e o da seguinte.
5. Parcela fixa no valor: amortização = valor − juros do período. Valor menor que os juros: erro ("Parcela N: o valor não cobre os juros do período (R$ ...)").
6. Parcelas não fixas depois de f, ao mesmo tempo:
   - linhas só de juros (carência) continuam só de juros;
   - as demais são recalculadas juntas: no Price, com um mesmo pagamento X; no SAC, com uma mesma amortização X.
   - X é o valor que zera o saldo no último vencimento. O saldo final é linear em X: calcula-se o saldo final sem arredondar com X = 0 e X = 1, e X = saldo(0) / (saldo(0) − saldo(1)), arredondado a centavos.
   - Depois, o fluxo é refeito em centavos (juros de cada período arredondados) e a última parcela fecha o saldo, absorvendo os centavos de arredondamento (também quando ela é fixa; diferença de poucos centavos).
7. Se o saldo chega a zero numa parcela antes da última (as fixas quitam antes), essa parcela paga exatamente saldo + juros, as seguintes saem e o resultado traz `earlyEnd` (a tela avisa "A operação termina antes"). Se para fechar no fim as parcelas livres precisariam amortizar negativo, elas ficam só com os juros até a quitação pelas fixas; se mesmo assim as fixas não quitam, erro.
8. Sem parcela livre depois de f e com a última fixa no valor: se o valor não fecha o saldo, erro com o valor necessário.
9. IOF: o principal de cada parcela (sem juros capitalizados) segue a proporção do saldo amortizado. Antes de f, o de antes; de f em diante, principal restante × (saldo em f − saldo após a parcela) / saldo em f, em centavos acumulados; a última leva o resto.
10. Total pago, juros, custo e CET usam o fluxo ajustado. Na tela, qualquer mudança na demanda ou nos encargos desfaz os ajustes; "Desfazer ajustes" volta ao fluxo padrão.

## Casos de referência

Todos com valor solicitado R$ 1.000.000,00, 2% a.m., liberação em 21/11/2026, praça Nacional (BR), PJ geral, IOF à vista, sem despesas (salvo o caso 6). "1ª" é a primeira parcela com amortização. Custo = juros + IOF + despesas; total = solicitado + custo; CET anual em dias corridos/365.

| Caso | Linhas | 1ª parcela | Última | Juros | IOF | Despesas | Custo | Total pago | CET a.a. |
|---|---|---|---|---|---|---|---|---|---|
| 1. Hoje: mensal, Price, 24 parcelas, 1º venc. 21/12/2026 | 24 | 53.046,05 | 53.046,05 | 273.105,09 | 27.942,52 | 0,00 | 301.047,61 | 1.301.047,61 | 31,0667% |
| 2. Trimestral, Price, 8 parcelas (prazo 24, carência 0), 1º venc. 21/02/2027 | 8 | 162.433,36 | 162.433,36 | 299.466,87 | 29.033,62 | 0,00 | 328.500,49 | 1.328.500,49 | 30,8878% |
| 3. Semestral, SAC, 4 parcelas, 1º venc. 21/05/2027 | 4 | 376.410,81 | 282.284,96 | 320.371,49 | 29.958,00 | 0,00 | 350.329,49 | 1.350.329,49 | 30,7699% |
| 4. Trimestral, Price, prazo 24, carência 6 com juros pagos (6 parcelas, 1º venc. 21/08/2027) | 8 (2 só juros) | 205.008,62 | 205.008,63 | 353.171,24 | 32.689,46 | 0,00 | 385.860,70 | 1.385.860,70 | 30,7537% |
| 5. Igual ao 4, juros da carência somados ao saldo | 6 | 231.025,46 | 231.025,46 | 386.152,75 | 32.681,09 | 0,00 | 418.833,84 | 1.418.833,84 | 30,4594% |
| 6. Igual ao 1, Fee 1,5% à vista (= R$ 15.000,00) | 24 | 53.046,05 | 53.046,05 | 273.105,09 | 27.942,52 | 15.000,00 | 316.047,61 | 1.316.047,61 | 33,2306% |
| 7. Igual ao 1, flex: parcela 5 = R$ 100.000,00 | 24 | 53.046,05 | 50.042,88 | 262.999,44 | 27.234,39 | 0,00 | 290.233,83 | 1.290.233,83 | 31,1034% |
| 8. Igual ao 1 em SAC, flex: parcela 3 em 26/02/2027 e parcela 8 = R$ 80.000,00 | 24 | 61.666,67 | 41.245,13 | 250.704,41 | 26.729,71 | 0,00 | 277.434,12 | 1.277.434,12 | 31,1977% |
| 9. Igual ao 1, flex: parcela 6 = R$ 2.000.000,00 (quita antes) | 6 | 53.046,05 | 845.402,50 | 110.632,72 | 17.406,68 | 0,00 | 128.039,40 | 1.128.039,40 | 32,5045% |

Detalhes úteis para recalcular:
- Caso 4: linhas só de juros em 22/02/2027 (21/02 é domingo) com R$ 63.311,55 e em 21/05/2027 com R$ 59.807,94; parcelas a partir de 23/08/2027 (21/08 é sábado). No caso 5 a carência capitalizada soma os juros ao saldo e a 1ª parcela é maior.
- Caso 7: parcelas 6 a 23 com R$ 50.042,91 (mesmo pagamento); a 24ª fecha com R$ 50.042,88.
- Caso 9: a parcela 6 (21/05/2027) paga R$ 845.402,50 = saldo + juros e a operação termina nela.
- Casos 4 e 5 têm IOF diferente em centavos porque, no Price, a distribuição teórica do principal depende dos fatores de cada período, que mudam quando a carência é paga.

## Limites conhecidos

- Na parcela flex, quando a última parcela é fixa no valor e há parcelas livres antes dela, a última pode diferir do valor digitado em alguns centavos (ela fecha o saldo).
- O "?" da Carência na linha mestra (peça comum, `LinhaMestra.jsx`) ainda diz que os juros da carência são somados ao saldo; com "Pagar juros na carência" marcado isso não vale. A explicação correta está no "?" do Capital de Giro.
