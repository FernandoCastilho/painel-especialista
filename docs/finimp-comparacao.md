# FINIMP: comparação de propostas

Descrição da interface e do motor vigentes, revisada em 06/11/2026. Os exemplos são sintéticos, não valores de cliente nem ofertas comerciais. Entrada em Calculadoras, endereço `#calculadora/finimp` e comando FINIMP. Os campos do formulário não são enviados nem indexados pela busca. O rascunho segue a política de sessão descrita abaixo.

## Roteiro da tela (21/11/2026)

A tela segue o roteiro das calculadoras de crédito (`docs/calculadoras-roteiro-2026-11-21.md`). Nenhuma conta mudou: só a ordem, os nomes e a apresentação.

1. **Demanda do cliente:** principal, moeda e prazo. O prazo é o mesmo seletor dos doze prazos fixos que fica na tabela; escolher em um muda o outro. Sem escolha, vale o prazo da meta, como antes.
2. **Encargos:** uma coluna por instituição, com taxa de juros (anual simples) e flat; a TAC à vista continua opcional, com o câmbio logo abaixo.
3. **Resultado · custo final para o cliente:** quanto recebe, quanto custa em cada instituição e a diferença (Instituição 2 menos Instituição 1), no prazo escolhido. Abaixo, do que é feito o custo de cada uma: juros, flat e TAC, com seus percentuais. A tela continua sem apontar vencedor.

Depois do resultado ficam "Atingir meta de custo" (campos e taxa requerida juntos) e a tabela dos doze prazos, recolhida em "Ver todos os prazos". No modo Apresentar, o slide de resultado mostra os resultados do prazo selecionado.

Cada valor é arredondado sozinho na tela, como na tabela. Quando há fração de centavo (dízima dos juros em prazos como 30 dias), a soma das linhas pode diferir em um centavo do total; a conta não é arredondada. `test/finimp-roteiro.test.mjs` confere isso.

## Premissas explícitas

- Principal e resultados na moeda selecionada: USD, EUR, JPY, CNH ou BRL. Trocar a moeda muda a unidade, não converte automaticamente o principal. A troca limpa o câmbio da TAC para exigir nova conferência.
- Juros simples com divisor 360. A UI usa doze prazos fixos de 30 a 360 dias, em passos de 30; não há campo de dias livres. O motor puro aceita dias inteiros em seu domínio. A tela não calcula datas nem escolhe ACT/360 ou 30/360.
- Flat único sobre o principal. O contrato determina quando ele é pago; não há desconto a valor presente.
- TAC opcional informada em reais (R$), paga à vista, sem financiamento nem juros. Se a moeda do principal for estrangeira e houver TAC positiva, informe câmbio explícito em R$ por unidade da moeda. TAC convertida = TAC em R$ ÷ câmbio. Para BRL, o fator é 1. TAC zero ou excluída dispensa câmbio.
- Pagamento do principal no vencimento. Sem estimar impostos, câmbio, hedge, seguros, outras tarifas ou indexadores. Não é custo final travado em reais nem CET anual.
- Doze prazos fixos, de 30 a 360 dias em passos de 30, usam as mesmas condições; não presumem uma oferta válida para todos os vencimentos.

O rascunho FINIMP fica somente em memória e sobrevive à navegação interna. Recarregar ou fechar a aba apaga os campos; “Nova simulação” reinicia o rascunho. Não usa armazenamento persistente do navegador.

## Fórmulas auditáveis

Com principal P, taxa anual em percentual r, flat percentual f, TAC T já convertida para a moeda do principal e dias d:

J = P × (r / 100) × (d / 360)

F = P × (f / 100)

C = J + F + T

Custo percentual no período = C / P × 100

Diferença = C da Instituição 2 − C da Instituição 1; positivo significa Instituição 2 mais cara.

Delta em pontos percentuais = custo percentual no período Instituição 2 − custo percentual no período Instituição 1, usando os custos não arredondados. Diferença monetária não nula abaixo de meio centavo é apresentada como +/− < 0,01 na moeda escolhida, sem esconder seu sinal atrás de 0,00.

Meta: r = (C alvo − F Instituição 2 − T Instituição 2) / P / (d / 360) × 100.

Taxas são não negativas. Alvo inferior ao custo fixo não tem solução nesse domínio. Com d = 0, alvo igual ao custo fixo é indeterminado (qualquer taxa), e alvo diferente é impossível. Principal zero/negativo, negativos nos custos, dados não finitos e dias fracionários são recusados. Igualdades usam tolerância proporcional ao epsilon da máquina apenas para ruído binário, sem arredondar custos a centavos. Os cálculos mantêm precisão de ponto flutuante, sem arredondamento intermediário; moeda é apresentada com centavos.

## Revisão pelo procedimento Auditor

Revisão feita pelo próprio executor, separando conferência algébrica dos testes de código; não se apresenta como parecer de terceiro. Verificação das dimensões (taxa anual × fração de ano), sinal da diferença, flat único, TAC sem juros, distinção entre custo no período e CET anual, resolução inversa e substituição da taxa calculada na fórmula original. A meta de igualdade independe da taxa atual da Instituição 2.

Matriz sintética, P = 100.000, TAC = 0. Instituição 1 r = 6%, f = 1%; Instituição 2 r = 8%, f = 0,5%. Valores abaixo arredondados apenas nesta apresentação:

| Dias | Custo Instituição 1 | Custo Instituição 2 | Diferença |
| --- | ---: | ---: | ---: |
| 30 | 1.500,00 | 1.166,67 | −333,33 |
| 60 | 2.000,00 | 1.833,33 | −166,67 |
| 90 | 2.500,00 | 2.500,00 | 0,00 |
| 120 | 3.000,00 | 3.166,67 | 166,67 |
| 150 | 3.500,00 | 3.833,33 | 333,33 |
| 180 | 4.000,00 | 4.500,00 | 500,00 |
| 210 | 4.500,00 | 5.166,67 | 666,67 |
| 240 | 5.000,00 | 5.833,33 | 833,33 |
| 270 | 5.500,00 | 6.500,00 | 1.000,00 |
| 300 | 6.000,00 | 7.166,67 | 1.166,67 |
| 330 | 6.500,00 | 7.833,33 | 1.333,33 |
| 360 | 7.000,00 | 8.500,00 | 1.500,00 |

Teste inverso adicional no motor: P = 100.000, flat Instituição 2 = 0,5%, TAC convertida da Instituição 2 = 100 (por exemplo R$ 600 com câmbio 6 R$/USD). Para igualar a Instituição 1 acima, taxa requerida de 6,8% em 180 dias e 6,4% em 360 dias. Recalculando: 3.400 + 500 + 100 = 4.000; 6.400 + 500 + 100 = 7.000.

Cobertura automatizada: 24 cenários diretos (12 prazos × dois bancos), três sinais da diferença, TAC, zeros, valores inválidos/overflow, metas em 180/360 dias, ausência/indeterminação de solução e precisão. Smoke de interface preenche os 24 resultados, aplica meta, altera moeda e TAC, testa erros e busca em 390/820/1280 px. Não substitui validação das condições comerciais de um contrato concreto.

## Tabela de prazos fixos

As linhas não são editáveis. Cabeçalho agrupa Instituição 1, Instituição 2 e Comparação; cada banco mostra juros, flat, TAC opcional, custo e percentual no período. A comparação mostra diferença monetária e delta em p.p. A tabela mantém todas as colunas e linhas em qualquer largura, com rolagem, cabeçalhos e prazo fixos durante a leitura. O seletor da meta usa os mesmos doze prazos. Nenhuma fórmula financeira foi alterada.

As linhas têm espaçamento vertical compacto e podem ser destacadas por clique em qualquer célula. Pelo teclado, Tab alcança o botão do prazo; Enter ou Espaço selecionam a linha. O destaque cobre também a coluna fixa de prazo, é único e independe da meta escolhida. Alterar condições, moeda ou TAC conserva o prazo destacado; “Nova simulação” limpa a seleção. Os rótulos automáticos de maior/menor custo e igualdade foram removidos da célula de diferença, mantendo o valor monetário e seu sinal.

Valores numéricos não quebram linha, incluindo símbolo da moeda, sinal e centavos. A tabela usa layout automático: quantias longas ampliam a largura das colunas, e a região já rotulada e alcançável pelo teclado oferece rolagem horizontal, sem comprimir ou ocultar os valores. Células de erro continuam permitindo quebra de texto.

Taxas, percentuais no período e delta exibem duas casas decimais. Delta não nulo que arredondaria para zero aparece como +/− < 0,01 p.p. Campos de taxa e flat apresentam duas casas quando desfocados, mas recuperam o texto completo ao receber foco para edição. Essa formatação não grava de volta no rascunho, não arredonda cálculos e não altera a taxa integral aplicada pela meta.

Regressão sem navegador: `node --test test/finimp-presentation.test.mjs test/finimp-comparison.test.mjs test/audit-regressions.test.mjs`. O roteiro `smoke-finimp.cjs` também contempla clique, Enter/Espaço, destaque de todas as células, altura compacta e preservação de precisão ao desfocar; sua atualização não constitui execução nem revisão visual.

## Explicações em ajudas

A interface concentra as explicações nos botões “?” de simulação, moeda, prazo/base, taxa, flat, TAC, custo total, diferença/delta e atingir meta. Os textos continuam pesquisáveis no índice estático. Valores, unidades, erro de entrada/meta e o estado curto TAC incluída/excluída permanecem visíveis.

O flat é percentual editável em cada instituição, convertido automaticamente em valor sobre o principal. Não há regra de flat zero para a Instituição 2. O teste de interface usa principal de 100.000, flat de 1,5% e 2%: valores de 1.500 e 2.000, com juros independentes de cada proposta.

A ajuda da comparação usa o componente de diálogo das calculadoras, com acionamento por clique/toque/Enter, foco contido, botão Fechar e Escape com retorno ao acionador. O conversor de paridade em Mercado é um componente separado desta comparação. O smoke verifica abertura, dimensões, modalidade, foco, fechamento e ausência dos parágrafos longos na tela em 390/820/1280 px, além de repetir os cálculos e metas do FINIMP.

## Conversão da TAC e testes atuais

Exemplo reproduzível em `test/calculator-doc-examples.test.mjs`: USD 100.000 por 180 dias, câmbio 5 R$/USD. Instituição 1: 6% a.a., flat 1%, TAC R$ 1.000 → custo USD 4.200. Instituição 2: 8% a.a., flat 0,5%, TAC R$ 1.500 → custo USD 4.800. Para igualar USD 4.200, a taxa da Instituição 2 é 6,8% a.a. TAC é paga uma vez e não integra principal.

`test/finimp-inputs.test.mjs` cobre as cinco moedas, TAC em reais, fator unitário BRL, câmbio zero/inválido, exclusão de TAC e meta usando valor convertido sem arredondamento intermediário. `test/finimp-presentation.test.mjs` cobre limpeza do câmbio ao trocar moeda, rascunho e precisão de apresentação. Os roteiros de navegador são evidência apenas quando efetivamente executados.

## Histórico documental

A versão inicial deste documento descrevia apenas USD/EUR/BRL e TAC na moeda escolhida. Esse modelo de entrada foi substituído: a tela atual recebe TAC em reais e oferece cinco moedas. Exemplos antigos com TAC já convertida continuam úteis para o motor, mas não descrevem a unidade do campo da UI. A referência de integração `ceeb21c` era histórica, não a base desta revisão.
