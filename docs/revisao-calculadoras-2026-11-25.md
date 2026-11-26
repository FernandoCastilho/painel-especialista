# Revisão visual das Calculadoras (25/11/2026)

Revisão só de leitura. Nada no painel foi alterado. Responsável: Diretor de Arte, acionado pelo NEXO.

Ponto de partida respeitado: decisão de 17/11 — as calculadoras continuam em azul-marinho com laranja. Esta proposta não muda a paleta; organiza o uso dela.

## Como foi feita

- Painel rodando nesta sessão, sem dados de mercado (curvas e cotações indisponíveis). Por isso o resultado do Finame aparece vazio e há avisos de "referência indisponível".
- Fotos de 9 telas (lista e 8 calculadoras) em computador (1440 px) e celular (390 px), tema escuro; lista e Capital de Giro também no claro.
- Medidas tiradas da tela: tamanhos de letra, ícones "?", posição do botão Simular e do resultado.

## Veredito

A base é boa: as três etapas numeradas (1 Demanda, 2 Encargos, 3 Resultado) e o resultado com o CET em destaque já são um padrão. O que pesa hoje é que cada calculadora aplica esse padrão de um jeito. O usuário reaprende onde fica o botão, onde está o CET e o que cada cor quer dizer a cada tela.

## Achados, por impacto

| # | Lei | Onde | Problema (visto ou medido) | Correção | Impacto |
|---|---|---|---|---|---|
| 1 | Semelhança, Jakob | Todas | O botão principal muda de lugar: no cabeçalho (Finame, 4131, Necessidade), abaixo do formulário à esquerda (Giro) ou centralizado no fim (Necessidade tem os dois). No celular, o Simular do Giro só aparece a 1.308 px. | Um lugar só: fim do formulário, largura total no celular e fixo na base da tela enquanto houver mudança não simulada. Tirar do cabeçalho. | Alto |
| 2 | Von Restorff | Todas | O laranja faz cinco trabalhos: número da etapa, fio sob cada cabeçalho, borda do resultado, botão principal e opção selecionada ("Base", "90 dias", "2 operações"). Avisos ("Valor de exemplo") também em laranja. | Laranja só para a ação principal e a borda do resultado. Seleção em azul claro com contorno. Aviso com ícone e texto neutro. | Alto |
| 3 | Semelhança | Capital de Giro | A mesma palavra muda de cor: em "Do que é feito o custo" Juros é azul e IOF laranja; no gráfico de fluxo, Juros é laranja e Amortização azul. | Uma legenda fixa para todas as calculadoras: Juros laranja, Amortização azul, IOF e tarifas cinza. | Alto |
| 4 | Posição serial, pico-fim | Resultado | O CET está em lugares diferentes: 4º cartão à direita (Giro), primeiro e grande (4131), linha de tabela (Finame), rodapé de coluna (Necessidade). | CET sempre primeiro e maior, com valor líquido e parcela ao lado, nesta ordem em todas. | Alto |
| 5 | Occam, carga cognitiva | 4131, Conta Garantida, Desconto, Finame | Muitos "?": 45 no 4131 (celular), 28 na Conta Garantida, 26 na Análise de desconto, 17 no Finame. Na Necessidade, alguns "?" vêm dentro de caixa de 44 px com borda e pesam mais que o título. | Ajuda ao tocar no nome do campo (sublinhado pontilhado), como já proposto em 17/11. Manter "?" só no título de cada etapa. | Médio |
| 6 | Proximidade | Necessidade do Cliente | Faixa azul com fio laranja repetida em 4 níveis (etapa, comparação, cenários, aplicação). "2 Encargos" é uma faixa solta, sem conteúdo embaixo. Caixa de marcar dentro da faixa de título. | Faixa azul só no nível da etapa. Blocos internos com fundo do painel e título simples. | Médio |
| 7 | Semelhança | Todas | Até 21 tamanhos de letra numa tela (4131), 17 no Finame e na Análise de desconto. A lista tem 7. | Escala de 6: 12, 13,5, 15, 18, 24, 32. Números do resultado em largura fixa. | Médio |
| 8 | Occam | Finame, 4131 | Linha vazia no topo só com um "?" solto (cerca de 60 px). | Remover a linha; ajuda no título. | Baixo |
| 9 | Fitts | Finame | "Modo apresentação" encosta na borda do botão (texto não cabe). | Botão com folga ou ícone com rótulo. | Baixo |
| 10 | Semelhança | Finame | Na tabela do resultado, "Indicador" aparece sobre a coluna errada; a coluna dos nomes fica sem título. | Título alinhado à primeira coluna. | Baixo |
| 11 | Premissa de 23/11 | 4131 | "Em % do CDI: 107,1%" tem uma casa decimal. | 107,10%. É só formato de exibição; não muda o cálculo. | Baixo |
| 12 | Semelhança | Capital de Giro | Campos da mesma coluna com aparência diferente: Fee "0,00 R$" e TAC "R$ 0,00"; IOF mais alto que os vizinhos. | Mesmo formato e altura. | Baixo |
| 13 | Hick | Lista | 14 cartões com o mesmo peso. | As três mais usadas em cartões maiores no topo (precisa saber quais são). | Baixo |

## As 3 correções de maior retorno

1. **Um esqueleto só** (itens 1, 4 e 8): botão no mesmo lugar e resultado na mesma ordem, com o CET primeiro. Começar pelo Capital de Giro e aplicar às outras.
2. **Laranja com um trabalho só** (itens 2 e 3): ação principal e resultado. Legenda de cores fixa.
3. **Menos "?"** (item 5): ajuda no nome do campo.

## O que já é bom (manter)

- As três etapas numeradas e o resultado com borda.
- O cartão de CET em azul cheio do Capital de Giro e do 4131.
- A barra "Do que é feito o custo".
- A lista dividida em cinco grupos com descrição curta.
- Sem rolagem lateral no celular em nenhuma das 9 telas.

## Riscos e ressalvas

- Nenhuma proposta muda regra de cálculo, taxa, IOF ou CET. O item 11 é só exibição.
- Os testes de tela que conferem posição e cor vão precisar de atualização.
- Sem dados de mercado nesta sessão: não vi o resultado do Finame preenchido nem as curvas.
- Não testei teclado, leitor de tela nem tempo de resposta. Não percorri todas as 14 calculadoras (vi 8).

## Registro das 20 leis de UX

| Situação | Leis |
|---|---|
| Problema observado | Semelhança (1, 3, 7, 10, 12), Jakob (1), Von Restorff (2), posição serial e pico-fim (4), Occam (5, 8), carga cognitiva (5), proximidade (6), Fitts (9), Hick (13) |
| Atendido no que foi visto | Miller (grupos de 3 a 5 na lista), gradiente de meta (etapas 1-2-3), Tesler (o sistema faz a conta), conectividade uniforme |
| Não verificado | Doherty (tempo), Murphy e Postel (erros de digitação), Zeigarnik, Parkinson, Fitts no teclado |
