# Revisão de direção de arte do painel (17/11/2026)

Revisão só de leitura. Nada no painel foi alterado. Responsável pela análise: Diretor de Arte, acionado pelo NEXO.

A revisão de 13/11 tratou de usabilidade e os 25 ajustes dela já estão no ar. Esta olha outra coisa: identidade, cor, letra, apresentação e movimento. A pergunta é o que falta para o painel parecer um produto só, de alto impacto.

Prévia viva da proposta (tela Mercado, com animações para testar): https://claude.ai/artifact/LBDfS7uUhCp3MCEMGML8Qo

## Como foi feita

- Site publicado, com dados reais de 17/11/2026, 18:41 (fora do horário de coleta).
- 19 telas fotografadas em computador (1440 px) e celular (390 px), nos temas escuro e claro. Mais 8 telas internas: três calculadoras, uma pasta e um estudo de setor, a janela de uma moeda e o menu "Mais".
- Medidas tiradas da tela e dos arquivos de estilo: altura do cabeçalho em 5 larguras, famílias e tamanhos de letra em uso, quantidade de cores, cantos e tempos de animação.
- Movimento: levantado pelo código e por imagens paradas. Não gravei vídeo.

## Veredito

O painel tem conteúdo de terminal profissional e uma identidade forte na parte de mercado: preto, âmbar, números em letra de largura fixa. Isso é raro e deve ficar.

O que tira impacto hoje são quatro coisas:

1. **São três produtos visuais dentro de um.** Terminal preto e âmbar (Mercado, Juros, Cenários, BNDES). Azul-marinho com laranja (Calculadoras). Azul claro (mapa do Aprender, Recuperação judicial). Mais fotos de dia claro sobre fundo preto (Setores).
2. **Tudo tem o mesmo peso.** 89% dos textos da tela Mercado têm 12,8 px ou menos. O âmbar faz seis trabalhos ao mesmo tempo. Quando tudo é destaque, nada é.
3. **A primeira impressão é gasta com avisos.** No celular, o primeiro número aparece depois de 40% da tela. No computador, o cabeçalho quebra em duas linhas nas larguras mais comuns de notebook.
4. **Quase nada se move com intenção.** As telas trocam de estado de forma seca. A espera é a palavra "Carregando…". O toque no celular não dá resposta.

## O que já é bom (manter)

- A identidade de terminal: densa, legível, com cara própria.
- Verde e vermelho sempre acompanhados de seta ou sinal. Não depende só de cor.
- Bandeiras e etiquetas coloridas por moeda nas notícias. Leitura rápida.
- A barra de resultado do Finame (CET em destaque no fim). É o melhor "momento de resultado" do painel.
- A tabela de Projeções, com a linha do Focus como referência.
- A barra de baixo no celular, no padrão que todo mundo conhece.
- O cuidado com "reduzir movimento": quem desliga animação no aparelho já é respeitado.

## Achados, por impacto

### Alto

| # | Princípio | Onde | Problema (medido) | Correção |
|---|---|---|---|---|
| 1 | Semelhança, Jakob | Site inteiro | Três identidades. Nos arquivos de estilo há 378 cores diferentes. O âmbar aparece 79 vezes; o azul-marinho das calculadoras, 25; o azul vivo, 18; dois laranjas, 31. O usuário sai do Mercado e entra em "outro aplicativo" ao abrir uma calculadora. | Um sistema só, o do terminal. Calculadoras, Aprender e Recuperação passam a usar os mesmos fundos e o âmbar. O azul-marinho com laranja fica para o que sai do painel: PDF e modo Apresentar. Depende de decisão do Fernando (ver "Decisão pendente"). |
| 2 | Von Restorff | Site inteiro | O âmbar é marca, aba ativa, link, título de seção, valor (taxas do BNDES), aviso de dado antigo, "Sem dado" e seta de comparação (Projeções). Em Projeções, a seta "acima do Focus" e o aviso "projeção antiga" têm a mesma cor. | Âmbar só para marca e para o que está selecionado. Números em branco. Aviso com ícone próprio e texto neutro. Links sublinhados em branco, âmbar ao passar o cursor. |
| 3 | Carga cognitiva, posição serial | Cabeçalho, computador | Em 1366 e 1440 px o cabeçalho tem 89 px e duas linhas: "Calculadoras" cai sozinha embaixo. Em 1280, 1536 e 1920 px tem 45 px. O bloco "PME" vira um quadrado âmbar de 89 px, o elemento mais pesado da tela. O selo "0 online", com ponto verde, chama mais atenção que as cotações. | Uma linha em qualquer largura: abas mais justas, relógio e estado mais curtos, "online" dentro do "i". Indicador fino sob a aba ativa no lugar do bloco cheio. |
| 4 | Posição serial, pico-fim | Mercado, primeira tela | Antes do primeiro número vêm dois avisos (Feriados e Conceito do dia). No celular somam cerca de 230 px e o dólar só aparece a 372 px de 844. As quatro moedas aparecem três vezes na mesma tela: fita, cartões e tabela. | Abrir com uma manchete de uma linha montada dos próprios números ("Dólar a 5,7731, −0,19% no dia…"). Um cartão grande para o dólar, com gráfico, e quatro menores. Feriados e Conceito do dia viram uma linha discreta abaixo. |
| 5 | Semelhança | Letras, site inteiro | O painel não tem letra própria. Usa a do aparelho: no Windows sai uma, no iPhone outra, no Android outra. Nos estilos há 126 tamanhos de letra diferentes. Só na tela Mercado convivem 15. | Duas famílias embutidas no painel: uma para texto e uma de largura fixa para números. Escala de 7 tamanhos (11, 12, 13,5, 15, 20, 24, 40). |
| 6 | Doherty, Fitts | Movimento, site inteiro | 13 transições em 5.657 linhas de estilo. 101 reações ao cursor e só 5 ao toque: no celular, apertar um botão não dá resposta visual. 37 animações em ritmo constante, que parece mecânico. A espera é texto ("Carregando…", em 8 versões). Os valores trocam sem transição. | Regra de movimento com 3 tempos (120, 220 e 420 ms) e 2 curvas. Detalhe na seção "Movimento". |

### Médio

| # | Princípio | Onde | Problema (medido) | Correção |
|---|---|---|---|---|
| 7 | Proximidade | Fundos e cantos | No tema escuro a página (#050505) e o painel (#0d0d0e) são quase a mesma cor. Só um fio separa os blocos e tudo parece no mesmo plano. Há mais de 20 arredondamentos de canto diferentes (8 px em 100 lugares, 6 em 55, 10 em 44, 12 em 36, reto em 33). | Três níveis de fundo: página, painel, destaque. Três cantos: 2 px em célula, 8 em botão e campo, 12 em cartão e janela. |
| 8 | Hick, proximidade | Juros | Cada gráfico tem dois botões de aumentar: "Ampliar" fora do cartão e "Maximizar gráfico" dentro. Na primeira tela são 4. Por causa deles, os dois cartões lado a lado começam em alturas diferentes (34 px). No celular, a linha do gráfico só começa a 520 px de 844. | Um ícone de aumentar no canto do cartão. Título, valor, variação e data numa linha só. O gráfico sobe. |
| 9 | Occam | Tabelas do BNDES | "a.a." repetido em toda linha, "p.p." quatro vezes por linha e a mesma data em todas as linhas. As caixas de marcar são cinza cheias e parecem desligadas. | Unidade e data no cabeçalho da coluna. Caixa de marcar com contorno. |
| 10 | Semelhança | Bancos | Troféu em emoji para o maior valor. Emoji muda de desenho em cada aparelho e destoa do traço fino dos ícones. O mesmo vale para a lâmpada do "Conceito do dia". | Marca discreta (ponto âmbar ou negrito) e ícone de traço. |
| 11 | Carga cognitiva | Estudo de setor | No computador, o texto corre de ponta a ponta: mais de 150 letras por linha. O confortável é de 60 a 80. O cartão de resumo tem borda laranja ao lado de rótulos âmbar: dois laranjas juntos. O diagrama "Como funciona" é branco e brilha no meio da página preta. | Coluna de leitura de até 720 px, com índice ao lado. Uma cor só de destaque. Diagrama com fundo do painel no tema escuro. |
| 12 | Apresentação | Setores | As fotos são um bom recurso, mas claras demais sobre preto e sem tratamento comum. Em cada cartão sobra uma faixa vazia entre o nome e "6 subsetores". | Mesmo corte e um leve escurecimento em todas. Nome sobre a foto. Zoom suave ao passar o cursor. |
| 13 | Occam | Calculadoras | No Finame há 14 ícones "?" numa tela. O logotipo do BNDES aparece duas vezes. No início, os 10 cartões têm o mesmo peso. | Ajuda ao tocar no nome do campo (sublinhado pontilhado), sem ícone. Um logotipo. As três calculadoras mais usadas maiores. |
| 14 | Jakob | Coruja | A coruja colorida no canto superior direito, dentro de um círculo, lê como "foto do usuário". É o botão de sugestões. O desenho colorido destoa do terminal. Ela se mexe em laço, e a regra do próprio painel diz "nunca em laço". | Coruja em traço âmbar no cabeçalho. A colorida fica dentro da janela de sugestões. Mexer só quando houver novidade. |
| 15 | Semelhança | Títulos | Título de seção, aba, sub-aba e cabeçalho de tabela têm o mesmo estilo: maiúsculas espaçadas de 12 px. São quatro níveis com a mesma cara. | Título de tela em letra normal de 20 px. Maiúsculas espaçadas só em rótulo pequeno. |
| 16 | Apresentação | Notícias | No computador, a manchete ocupa a esquerda e sobra metade da largura vazia. Todas as notícias têm o mesmo peso. | Uma notícia de destaque no topo e lista em duas colunas em tela larga. |

### Baixo

| # | Onde | Problema | Correção |
|---|---|---|---|
| 17 | Tema claro | Bege com marrom. É legível, mas perde a força da marca: o âmbar vira marrom e os links parecem "já visitados". | Tratar por último. Posicionar como modo de leitura e impressão. |
| 18 | Celular, topo do Mercado | A fileira de 5 relógios do mundo ocupa a primeira linha da tela. | Um relógio (Brasília) e os demais sob toque. |
| 19 | Celular, barra de baixo | "Mercado hoje" quebra em duas linhas; os outros nomes têm uma. | "Mercado". |
| 20 | Fita de cotações | Entra e sai seca pelas bordas. | Bordas que esmaecem. |
| 21 | Marca | "PME" é texto simples num bloco âmbar. Não há símbolo. | Um símbolo simples (a coruja em traço) ao lado do nome. |

## Movimento: a proposta

Regra geral: movimento explica o que aconteceu. Nunca enfeita.

**Tempos e curvas**

| Tempo | Uso |
|---|---|
| 120 ms | Resposta ao toque. Todo botão, aba e cartão afunda um pouco. |
| 220 ms | Troca de estado: aba, filtro, realce da linha da tabela. |
| 420 ms | Entrada de conteúdo e abertura de janela. |
| Contínuo | Só a fita de cotações, que pausa com o cursor em cima. |

Duas curvas: uma que chega rápido e desacelera (entradas) e uma padrão (trocas). Nada em ritmo constante, fora a fita.

**Sete momentos, do mais visto ao menos visto**

1. **Abertura do Mercado.** Os cartões sobem em sequência, com 55 ms entre um e outro. A linha de cada gráfico se desenha da esquerda para a direita. Os números "rolam" até o valor.
2. **Chegada de cotação.** Só o número que mudou rola, com um brilho verde ou vermelho de menos de 1 segundo. Hoje o brilho já existe; falta o número rolar.
3. **Troca de aba.** O traço âmbar desliza de uma aba para a outra. O conteúdo novo entra com um esmaecer curto, que já existe.
4. **Do cartão para o detalhe.** O cartão da moeda cresce e vira a janela de detalhe. Hoje a janela surge do meio da tela, sem ligação com o que foi tocado.
5. **Espera.** No lugar de "Carregando…", a forma do conteúdo (linhas, cartões) com um brilho que passa.
6. **Gráficos.** A linha se desenha na primeira vez. Ao mudar o período, a linha se transforma na nova em vez de piscar.
7. **Linha da tabela.** Ao passar o cursor, um filete âmbar cresce na borda esquerda.

Os momentos 1, 2, 3, 5 e 7 estão na prévia e podem ser testados.

**O que tirar:** os laços sem motivo (coruja balançando, etapas de setor piscando, ponto "online" pulsando). O arquivo de regras de movimento do painel já diz "nunca em loop"; os estilos não seguem.

## Cor: a proposta

| Cor | Trabalho único |
|---|---|
| Âmbar `#ffb000` | Marca e o que está selecionado. |
| Branco quente `#edeae3` | Todo número e texto principal. |
| Verde `#19d37a` e vermelho `#ff5a52` | Alta e queda, sempre com seta ou sinal. Vermelho também para erro. |
| Azul `#6aa9ff` | Só séries de gráfico e conteúdo de estudo. |
| Cinzas quentes | Texto de apoio e linhas. |
| Três fundos | Página `#060607`, painel `#0e0e10`, destaque `#17171a`. |

Fica de fora do tema escuro: azul-marinho, azul vivo e os dois laranjas.

## Ordem sugerida de execução

1. **Base.** Cores com papel único, três fundos, três cantos, letras próprias com a escala de 7 tamanhos e os tempos de movimento. Não muda a posição de nada. Sozinha, já unifica o painel.
2. **Cabeçalho e primeira tela do Mercado.** Uma linha, manchete, cartão grande.
3. **Movimento base.** Resposta ao toque, abas, entrada, espera com forma, número que rola.
4. **Gráficos e tabelas.** Um botão de aumentar, unidades no cabeçalho.
5. **Calculadoras, Setores e Aprender no mesmo sistema.**
6. **Tema claro.**

## As três correções de maior retorno

1. **Um sistema visual só, com o âmbar fazendo um trabalho só** (itens 1, 2 e 7).
2. **Cabeçalho em uma linha e a primeira tela abrindo pelo número** (itens 3 e 4).
3. **Movimento com regra: resposta ao toque, espera com forma e número que rola** (item 6).

## Decisão pendente

O item 1 desfaz uma decisão registrada em 13/11: as calculadoras em azul-marinho com laranja. A recomendação é levar as calculadoras para o visual do terminal e guardar o azul-marinho para PDF e Apresentar, que são o material que vai para fora. Motivo: quem usa o painel passa de uma tela para outra o dia inteiro; o material para cliente é outro contexto e pode ter outra roupa. Se o Fernando preferir manter as calculadoras como estão, os demais itens continuam valendo.

## Riscos e ressalvas

- Nenhuma proposta mexe em regra de cálculo financeiro, em dado ou em fonte de dado.
- Letras próprias aumentam o que o painel baixa na primeira visita. Não medi quanto. Precisa ser medido antes de publicar.
- A base (etapa 1) muda cores e tamanhos em quase todas as telas. Os testes de tela que conferem cor e medida vão precisar de atualização.
- A manchete do Mercado tem de ser montada só com números que já estão na tela, com a mesma referência de data e hora. Sem texto livre.
- A prévia mostra só a tela Mercado, com números copiados da tela de 17/11 e traçado de gráfico ilustrativo. Calculadoras, Setores e celular ainda não foram desenhados na nova direção.
- Os números de "tempo" (120, 220, 420 ms) são ponto de partida de desenho. Não medi tempo de resposta do painel.

## Registro das 20 leis de UX

| Situação | Leis |
|---|---|
| Problema observado | Hick (8), Fitts (6), Jakob (1, 14), proximidade (7, 8), Von Restorff (2), posição serial (3, 4), pico-fim (4), Occam (9, 13), semelhança (1, 5, 10, 15), carga cognitiva (3, 11), Doherty (6: falta resposta visual ao toque e à espera) |
| Atendido no que foi visto | Miller (indicadores em grupos de 4 a 5), conectividade uniforme (diagrama dos setores), Tesler (calculadoras fazem a conta), Murphy e Postel (tratados na revisão de 13/11, sem regressão visível), Fitts em alvos de toque |
| Não verificado | Zeigarnik, gradiente de meta e Parkinson (não percorri um cálculo do começo ao fim); Doherty em tempo real (não medi tempo de resposta) |

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e projetor.
- As animações em movimento real. O levantamento veio do código e de imagens paradas.
- O tema claro foi fotografado nas 19 telas, mas só Mercado e Calculadoras foram examinados de perto.
- As janelas "Panorama do dia" e "i" (a foto automática não abriu).
- Preencher cada calculadora do começo ao fim, PDF e modo Apresentar.
- Não fiz pesquisa de referências externas. A direção parte da identidade de terminal já aprovada.
- Se os números mostrados batem com as fontes.
