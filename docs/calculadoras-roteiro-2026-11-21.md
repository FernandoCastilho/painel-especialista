# Roteiro das calculadoras de crédito

O roteiro das seis telas tem três blocos: **1. Demanda do cliente**, **2. Encargos** e **3. Resultado · custo final para o cliente**. O fluxo existente pode aparecer dentro do resultado. As explicações ficam nos botões de ajuda (?) e os erros, avisos de dados e diferenças de arredondamento aparecem na tela.

Em Conta Garantida, Análise de desconto e FINIMP, cada encargo mostra o valor e sua participação percentual no custo total quando esse custo é positivo. Os valores usados pelo cálculo permanecem os mesmos.

As capturas da versão atual e a validação em Ubuntu estão vinculadas no [PR #569](https://github.com/FernandoCastilho/painel-especialista/pull/569).

## Histórico do piloto e dos ajustes de 21/11/2026

Pedido do Fernando em 21/11/2026: as calculadoras estão complexas no preenchimento e na apresentação e não contam a história da operação. Ideia dele: **Demanda** (valor, prazo, carência), **Encargos** (taxa, indexador, IOF, fee, TAC, outros) e **Resultado** (CET, valor total pago, custo final para o cliente), com as especificidades de cada produto.

Depois da análise das 13 calculadoras, Fernando escolheu começar por um **piloto no Capital de Giro**, para validar o desenho em uma tela antes de replicar.

Capturas históricas do piloto: pasta `docs/calculadoras-roteiro/`.

## 1. Proposta inicial do piloto

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

Bloco novo, "Referência de mercado", sempre o último da tela. Nesta publicação ele entra só no Capital de Giro; nas outras calculadoras entra conforme cada uma for para o roteiro. Reaproveita os gráficos que o painel já tem, com os dados do próprio painel:

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

Conferido: a curva DI x pré aberta no Capital de Giro com os dados públicos do painel de 18/11/2026, nos dois temas; os outros dois tipos (CDI futuro e moeda) abertos em tela de teste, ainda sem calculadora que os use nesta publicação; 2.395 testes passando (1 novo, que garante que a referência é o último bloco do Giro); conferências de tela do Giro, do modo Apresentar, da busca e do desenho em cinco larguras (49 de 49).

Não conferido: o bloco com os dados do painel no ar (aqui foram dados públicos baixados em 21/11/2026); aparelho físico e Windows. A conferência automática do projeto não tem o arquivo da curva, então lá o bloco aparece com o aviso de dado indisponível, sem desenhar o gráfico.

## 6b. Peças comuns (segundo registro do rascunho)

A numeração dos blocos, a linha do tempo, o quadro de resultado, as respostas e a composição do custo saíram do Capital de Giro para `Roteiro.jsx` e `Roteiro.css`, para as outras calculadoras usarem o mesmo desenho. O estilo da gaveta "Detalhes do contrato" foi para junto da linha mestra. O Capital de Giro ficou idêntico: fotos de antes e depois iguais ponto a ponto, no computador e no celular.

## 6c. Parecer do Auditor Independente e ajustes (21/11/2026)

O Auditor conferiu os três registros do rascunho 553 e não encontrou correção obrigatória: contas intocadas, números idênticos em 16.486 operações sorteadas e em 10 operações digitadas na tela de antes e na nova, outras telas sem diferença. Parecer "Insuficiente para validar" por faltar o registro do ok de Fernando para publicar já com a "Referência de mercado", pedida depois do "Giro agora".

Ajustes feitos a partir dos achados dele, sem mexer em conta:

- **Gaveta abria sozinha com o prazo vazio.** Apagar o prazo para redigitar abria os "Detalhes do contrato" com um aviso de data, e ela não fechava mais. Agora o aviso de data só aparece quando o problema é de data; prazo ou carência inválidos avisam no próprio campo e a gaveta fica como estava.
- **Gaveta fechada com erro dentro.** O título da gaveta passa a dizer "há um campo a conferir aqui".
- **Textos de borda.** Com uma parcela só, "Parcela única" (antes "1ª de 1 parcelas mensais"). No Bullet e na parcela única, "Quanto paga no total" fala em "Pagamento único" (antes "Soma das parcelas").

Revisão de excesso dos três registros: o Simplificador da central não está instalado neste ambiente; foram usados o simplificador de código da sessão e a revisão de excesso (ponytail). A revisão não apontou correção obrigatória. Ficam anotados, sem mexer agora: o histórico da moeda reaproveita uma função que mora no arquivo da tela de Câmbio futuro; e os tipos "pós-fixada" e "moeda" do bloco de referência só passam a ser usados quando Necessidade do Cliente, FINIMP e 4131 entrarem no roteiro.

## 7. Conta Garantida, Análise de desconto e FINIMP no roteiro (21/11/2026)

Depois do piloto, Fernando respondeu "Aprovado, pode replicar". Estas são as três primeiras telas replicadas. Fotos de antes e depois de cada uma na pasta `docs/calculadoras-roteiro/` (`<tela>-antes-depois-computador.png` e `-celular.png`).

| Tela | 1 Demanda | 2 Encargos | 3 Linha do tempo | 4 Resultado | Depois do resultado |
|---|---|---|---|---|---|
| Conta Garantida (só o modo "Utilização única") | valor utilizado, data, prazo | taxa de juros, limite, dias que geram juros, IOF (enquadramento em gaveta) | utilização, período de uso, cobertura | quanto usou, quanto paga para cobrir, taxa efetiva (CET, com limite informado), quanto custa | tabelas, premissas |
| Análise de desconto | títulos, data da operação (praça em gaveta) | taxa de juros, convenção, tarifa dos títulos, TAC, IOF | operação, prazo, vencimento dos títulos | quanto entra no caixa, quanto é descontado, quanto custa (CET) | comparação com o capital de giro (projeção, premissas, resultado desconto × giro, tabelas) |
| FINIMP | principal, moeda, prazo | por instituição: taxa de juros e flat; TAC à vista | desembolso, flat, vencimento | quanto recebe, quanto custa em cada instituição, qual a diferença | atingir meta de custo, tabela dos 12 prazos (fechada) |

Referência de mercado no fim de cada uma: curva DI x pré na Conta Garantida e na Análise de desconto; cotação da moeda escolhida no FINIMP (em reais, o bloco não aparece).

### Centavos

Nestas três contas não há arredondamento no meio do caminho: cada parte do custo só é arredondada ao aparecer na tela. Por isso as partes, como aparecem, podem somar 1 centavo a mais ou a menos que o total, como aparece (medido: cerca de 3 em 10 casos no Desconto; 39 em 588 na Conta Garantida; no FINIMP, quando há fração de centavo, como em 30 dias). Isso já existia antes do roteiro. A conta não foi tocada. A lista "Do que é feito o custo" passou a mostrar, só quando a diferença existe, uma linha "Arredondamento: as partes somam R$ X; a diferença vem de arredondar cada parte em centavos". A regra mora na peça comum (`Roteiro.jsx`, com `centavosDaTela.js`) e vale para todas as calculadoras. No Capital de Giro a soma fecha sempre, porque aquela conta já arredonda cada lançamento.

### Decisões tomadas sem consulta (reversíveis)

- **Conta Garantida:** o roteiro entrou só no modo "Utilização única". "Lançamentos por dia" e "Comparar com parcelado" ficaram como eram. Na proposta, "Comparar com parcelado" viraria comparação depois do resultado; isso muda o funcionamento da tela e ficou para uma etapa própria, se Fernando quiser.
- **Conta Garantida:** a resposta principal é "Quanto custa" em reais. O CET desta conta só existe com limite informado e segue a regra de 30 dias sobre o limite, então fica como resposta ao lado.
- **Análise de desconto:** a comparação com o giro continua aberta, depois do resultado do desconto. É a razão de ser desta calculadora.
- **FINIMP:** a mais barata NÃO ficou em destaque. Há decisão anterior de Fernando de não apontar vencedor, protegida por teste; o destaque continua na diferença entre as duas.
- **FINIMP:** o prazo da demanda acompanha o prazo da meta quando nada foi escolhido, como já era.

### Sugestões dos executores, não aplicadas (dependem de Fernando)

- Conta Garantida: tirar o botão "Ampliar" do resultado (ele já ocupa a largura toda) e a linha "23/11 a 03/12 · 11 fechamentos…" (a linha do tempo já diz quase tudo).
- Análise de desconto: abrir a comparação com o giro fechada, para a tela ficar mais curta.
- FINIMP: separar de vez o prazo da demanda do prazo da meta.

### Tamanho das telas (altura em pontos, com o exemplo das fotos)

| Tela | Computador antes → depois | Celular antes → depois | Campos à vista |
|---|---|---|---|
| Capital de Giro | 1.097 → 1.814 | 2.334 → 3.177 | 18 → 13 |
| Conta Garantida | 1.181 → 2.217 | 2.845 → 3.774 | 8 → 7 |
| Análise de desconto | 2.348 → 2.999 | 5.097 → 6.000 | 19 → 16 |
| FINIMP | 1.869 → 1.876 | 2.597 → 3.556 | 9 → 10 |

As telas ficaram mais longas. A maior parte do aumento vem do bloco "Referência de mercado" (cerca de 520 pontos no computador e 800 no celular) e da linha do tempo. O preenchimento, que era a queixa original, ficou menor ou igual em campos.

### O que foi conferido

- Testes do painel: 2.427 passando. Novos nesta etapa: os de cada tela (repartições fecham na conta; a linha de arredondamento aparece só quando a diferença existe) e os da peça comum.
- Conferência de código sem erros; montagem ok.
- Conferências de tela, com o navegador deste ambiente: Capital de Giro, FINIMP (inclusive os textos de ajuda), Análise de desconto, modo Apresentar, busca e o desenho em cinco larguras (49 de 49).
- Números iguais aos de antes: cada executor comparou no navegador a versão de antes e a nova com os mesmos dados digitados (3 cenários na Conta Garantida, 3 no Desconto, 5 no FINIMP).
- Nenhum valor esperado em reais ou percentual foi alterado nas conferências.

### O que não deu para conferir

- Aparelho físico, Windows e uso real.

## 8. BNDES Finame, Necessidade do Cliente e Empréstimo 4131 no roteiro (21/11/2026)

Com estas três, as sete calculadoras de crédito estão no roteiro. Fotos de antes e depois na pasta `docs/calculadoras-roteiro/` (`finame-materiais-…`, `comparador-credito-…`, `emprestimo-4131-…`).

| Tela | 1 Demanda | 2 Encargos | 3 Linha do tempo | 4 Resultado | Fim da tela |
|---|---|---|---|---|---|
| BNDES · Finame Materiais | linha, valor, % financiado, prazo, carência, porte e região (data e praça em gaveta) | custo financeiro, taxa do BNDES, spread do agente, TAC, juros na carência, FGI | liberação, carência, parcelas SAC, quitação | a tabela de indicadores de antes (já respondia quanto financia, quanto paga e quanto custa) | Histórico dos indexadores (TFC, TFB), que já era a referência desta tela |
| Necessidade do Cliente | valor, prazo, carência, amortização (data, praça, regime e IRPJ em gaveta) | 1 a 5 operações; garantia foi para "Mais condições" | liberação, carência, parcelas, quitação (datas, sem valores) | quadro com as quatro perguntas, uma coluna por operação, antes do resultado de sempre | curva DI x pré e CDI futuro, conforme as operações |
| Empréstimo 4131 | principal, moeda, cotação, parcelas, carência (data e regras de pagamento em gaveta) | taxa all-in, IOF-câmbio, flat, fiança, proteção cambial (NDF); IR e raros em "Mais encargos" | desembolso, carência, parcelas, quitação | o quadro "Cotação · 4131 com NDF" de antes, abaixo dos dados | cotação diária da moeda (dólar ou euro) |

Campos à vista: Finame 16 → 14; Necessidade do Cliente 25 → 17; 4131 12 → 14 (subiram carência, flat e fiança; a data desceu para a gaveta).

### Decisões tomadas sem consulta (reversíveis)

- **Necessidade do Cliente:** o destaque de menor custo já existia e continua com a mesma regra (decisão de 11/11/2026: o CET só compara o mesmo tipo de taxa, sem vencedor absoluto). No pós-CDI, "Quanto custa" mostra o CET da parte fixa, como a conta devolve, com o custo com CDI projetado e o custo em reais ao lado.
- **Necessidade do Cliente:** "Cenários e comparações" (CDI, aplicação financeira, mesmo valor líquido) virou um bloco que abre e fecha antes do botão de comparar; abre sozinho quando há operação pós-CDI.
- **Finame:** a liberação na linha do tempo mostra o valor financiado e cita à parte o que é pago à vista (TAC, ECG), sem soma nova.
- **4131:** "Condições da operação" ficou dentro do quadro do resultado, para não sumir da cotação ampliada. A tabela de parcelas abre fechada.
- **Aviso de erro na gaveta:** sugestão do Auditor no parecer do Giro; o aviso "há um campo a conferir aqui" passa a sair na cor de erro.

### Sugestões dos executores, não aplicadas (dependem de Fernando)

- Finame: com custo pós-fixado (TLP, LCD, TFBD) o Histórico dos indexadores não aparece e a tela fica sem referência no fim. Já era assim. Mostrar a referência pós-fixada nesses casos.
- Necessidade do Cliente: coluna FINIMP em moeda poderia trazer também o gráfico da moeda.
- 4131: mandar flat e fiança para "Mais encargos" voltaria a 12 campos à vista.

### O que foi conferido

- As sete telas juntas, sobre a versão publicada do Capital de Giro: 2.468 testes passando, conferência de código sem erros, montagem ok.
- Cada executor rodou as conferências de tela da sua calculadora (Finame: BNDES, perfis, central BNDES e falhas de fonte; Necessidade do Cliente: comparador de crédito; 4131: a dele) e o desenho em cinco larguras (49 de 49), modo Apresentar e busca.
- Números iguais aos de antes, comparados no navegador com os mesmos dados: Finame em 14 cenários (5.472 valores), Necessidade do Cliente em 5 cenários, 4131 em 9 cenários (360 leituras, inclusive resumo copiado e PDF). Nenhum valor esperado em reais ou percentual foi alterado nas conferências.

### O que não deu para conferir

- Aparelho físico, Windows e uso real.
- Necessidade do Cliente: "Comparar com aplicação financeira" só coberta pelos testes (a versão de antes não tinha a curva para comparar no navegador).
- Defeito antigo no modo Apresentar, fora destas telas: ao trocar de "Dados" para "Resultado" com o slide rolado, o resultado aparece cortado. Registrado como tarefa à parte.

## 9. Próximo passo

As sete calculadoras de crédito estão no roteiro. Falta ajustar as seis que não são de crédito (Câmbio futuro, Operação x DI, CDI x Dólar, Dividendos, Faturamento, Reforma tributária), com os nomes Situação, Premissas e Resultado.
