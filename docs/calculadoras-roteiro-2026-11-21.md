# Calculadoras no roteiro Demanda, Encargos, Linha do tempo, Resultado (21/11/2026)

Pedido do Fernando em 21/11/2026: as calculadoras estão complexas no preenchimento e na apresentação e não contam a história da operação. Ideia dele: **Demanda** (valor, prazo, carência), **Encargos** (taxa, indexador, IOF, fee, TAC, outros) e **Resultado** (CET, valor total pago, custo final para o cliente), com as especificidades de cada produto.

Depois da análise das 13 calculadoras, Fernando escolheu começar por um **piloto no Capital de Giro**, para validar o desenho em uma tela antes de replicar.

Fotos de antes e depois: pasta `docs/calculadoras-roteiro/`.

## 1. O roteiro

Quatro blocos numerados, sempre nesta ordem:

| Bloco | O que responde | No Capital de Giro |
|---|---|---|
| 1 Demanda do cliente | O que o cliente precisa | valor, prazo total, carência, amortização |
| 2 Encargos | O que o banco cobra | taxa de juros (prefixada), IOF, Fee, TAC, Outros, cada um com valor e forma de pagamento |
| 3 Linha do tempo da operação | Quando o dinheiro entra e quando sai | liberação, carência, parcelas, quitação |
| 4 Resultado · custo final para o cliente | Quanto custa | quanto entra no caixa, quanto paga por mês, quanto paga no total, quanto custa (CET) e do que é feito o custo |

Dois acréscimos à ideia original, aprovados com o piloto:

- **Linha do tempo**, entre os encargos e o resultado.
- **Gaveta "Detalhes do contrato"**, dentro da demanda, para o que quase nunca muda: data da liberação, praça, 1º vencimento e garantia. O título da gaveta mostra o resumo do que está valendo. Ela abre sozinha se houver erro em um campo de dentro.

## 2. O que mudou no Capital de Giro

| Item | Antes | Agora |
|---|---|---|
| Blocos | Linha mestra, Taxas tributos e despesas, Condições do produto, Resultado ao lado | 1 Demanda, 2 Encargos, 3 Linha do tempo, 4 Resultado, de cima para baixo |
| Campos à vista | 18 | 13 (os outros ficam nas gavetas, já preenchidos com o padrão) |
| Nomes das despesas | IOF, Fee de estruturação, Tarifas, Outras despesas | IOF, Fee, TAC, Outros |
| Taxa | campo solto acima da tabela | primeira linha da tabela de encargos |
| "Periodicidade" | campo que não se podia editar | saiu como campo; a linha do tempo diz "parcelas mensais" ou "vencimento único" |
| CET | aparecia duas vezes | uma vez, como resposta de "Quanto custa" |
| Total pago | só dentro de "Comparar amortizações", fechado | resposta de "Quanto paga no total" e ponto final da linha do tempo |
| Composição do custo | não aparecia | juros, IOF e despesas, com uma barra de proporção, somando o custo total |
| Resultado no computador | coluna fixa ao lado dos dados | abaixo, na largura toda (a tela conta a operação de cima para baixo) |
| IOF no celular | o valor ficava cortado na coluna estreita | cabe inteiro |

Nenhuma conta mudou: taxa, juros, IOF, CET, parcelas e arredondamento são os mesmos. Com os mesmos dados, os números são idênticos aos de antes (exemplo de abertura: líquido R$ 972.057,48, parcela R$ 53.046,05, total pago R$ 1.301.047,61, custo R$ 301.047,61, CET 31,07% a.a.).

A linha mestra de 19/11 continua: o que se digita aqui segue para as outras calculadoras de empréstimo. Só o nome do bloco mudou nesta tela. As outras três telas que usam a linha mestra (Necessidade do Cliente, Conta Garantida e Análise de desconto) não mudaram.

## 3. Decisões tomadas sem consulta (reversíveis)

- **Nomes padrão dos encargos: Taxa, IOF, Fee, TAC, Outros**, na ordem da lista do Fernando. Foi a sugestão apresentada junto com a escolha do piloto.
- **"Quanto custa" em fundo azul-marinho, não em laranja.** Texto laranja sobre branco não tem contraste suficiente; o azul-marinho já era o destaque do CET nesta tela.
- **Demanda e encargos lado a lado só a partir de 1200 px de largura.** Abaixo disso ficam um sobre o outro, porque o campo da taxa ficava estreito demais (a conferência automática acusou em 1024 px).
- **"Saldo financiado" mantido**, no fim da composição do custo. Ele muda quando IOF ou despesas são financiados.
- **Carência na linha do tempo:** mostra os meses combinados na demanda e os juros somados ao saldo no período. Com 1º vencimento informado à mão, mostra "1º vencimento informado".
- **Modo Apresentar:** o slide de resultado mostra a linha do tempo e o resultado. Os detalhes do contrato ficam abertos no slide de dados.

## 4. O que foi conferido

- Testes do painel: 2.394 passando, 9 novos. Os novos provam que as repartições da tela fecham em centavos em seis casos (Price, SAC, Bullet, carência, despesas à vista e financiadas, IOF financiado): juros + IOF + despesas = custo total; valor solicitado + custo = total pago; valor solicitado menos o que é pago na liberação = líquido.
- Conferência de código: sem erros. Montagem: ok.
- Conferências de tela, com o navegador deste ambiente: Capital de Giro (390 e 1280 px), desenho das calculadoras em cinco larguras (320, 390, 768, 1024, 1440; 49 de 49), modo Apresentar e busca.
- Duas conferências foram atualizadas porque procuravam o desenho antigo (nomes dos blocos, nomes das despesas, resultado ao lado). Os valores esperados em reais não mudaram.
- Fotos da tela nos dois temas, no computador e no celular.
- Revisão de excesso (Simplificador): o Simplificador da central não está instalado neste ambiente; foi usado o simplificador de código da sessão. Ele enxugou repetições no código da tela e na conferência. Uma retirada dele foi desfeita, porque desalinhava a lista "Do que é feito o custo" (as regras gerais de lista do painel voltavam a valer). Depois disso, tudo foi conferido de novo.

## 5. O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows.
- Uso real com cliente.

## 6. Referência de mercado no fim da tela (pedido do Fernando, 21/11/2026)

Pedido: pôr sempre embaixo, ao final de tudo, um gráfico só para exemplificar. Taxa prefixada mostra o gráfico de juros do pré; pós-fixada mostra o CDI futuro da B3; operação em moeda mostra a moeda da tela.

Bloco novo, "Referência de mercado", o último de cada calculadora. Reaproveita os gráficos que o painel já tem, com os dados do próprio painel:

| Tipo de operação | Gráfico |
|---|---|
| Taxa prefixada | Curva DI x pré da B3 |
| Pós-fixada (% do CDI ou CDI + spread) | CDI futuro (taxa a termo dos futuros de DI da B3) |
| Em moeda estrangeira | Cotação diária da moeda escolhida na tela, com 30 dias, 90 dias ou 1 ano |

- O bloco avisa que é só para ilustrar: não entra na conta da simulação e não é previsão.
- Moedas com histórico no painel hoje: dólar, euro e yuan. Em outra moeda, o bloco diz que o histórico não está disponível.
- No modo Apresentar o bloco não entra no slide.
- No Capital de Giro (taxa prefixada) entra a curva DI x pré. Fotos: `giro-referencia-computador.png` e `giro-referencia-celular.png`.
- O BNDES já tem o "Histórico dos indexadores" no fim da tela e fica com ele como referência.

Conferido: os três tipos abertos na tela com os dados públicos do painel de 18/11/2026, nos dois temas; 2.395 testes passando (1 novo, que garante que a referência é o último bloco do Giro); conferências de tela do Giro, do modo Apresentar e da busca.

## 7. Próximo passo

Fernando valida o piloto. Depois, replicar o roteiro nas outras seis calculadoras de crédito (Necessidade do Cliente, BNDES, Conta Garantida, Análise de desconto, FINIMP e 4131) e, por último, ajustar as seis que não são de crédito, com os nomes Situação, Premissas e Resultado.
