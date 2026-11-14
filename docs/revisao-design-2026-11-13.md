# Revisão de design, textos e simplicidade do painel (13/11/2026)

Revisão só de leitura. Nada no painel foi alterado. Responsável pela análise: Diretor de Arte, acionado pelo NEXO.

## Como foi feita

- Site publicado, com dados reais de 12/11/2026 (noite, mercado fechado).
- 31 telas fotografadas em quatro versões: computador (1440 px) e celular (390 px), temas claro e escuro. 248 imagens.
- Medidas automáticas em cada tela: altura, quantidade de texto, tamanhos de letra, botões pequenos, transbordo lateral.
- Conferência automática de contraste e de nomes de botões em 13 telas (3 versões).
- Testes de uso: toque no gráfico pelo celular, gráfico com valor negativo, larguras de 768 a 1366 px, abertura de um estudo de subsetor, tela de primeiro acesso.

## O que melhorou desde a análise de 10/11 (conferido agora)

- Tocar no gráfico pelo celular mostra o dia tocado.
- O eixo mostra o sinal negativo (emprego formal: −500.000).
- O cabeçalho não quebra mais em duas linhas (1024 a 1366 px).
- O Panorama do dia não abre mais sozinho.
- O Finame mostra o resultado ao lado dos campos e, no celular, numa barra fixa.
- Nenhuma tela transborda para o lado no celular. Nenhum erro de programa nas 31 telas (só 2 avisos em "Apresentar", que é protótipo).

## O que já é bom (manter)

- Identidade de terminal na parte de mercado: densa, legível, com bom contraste.
- Finame no computador: campos à esquerda, resultado à direita, tudo numa tela. É o modelo para as outras calculadoras.
- Diagrama "Como funciona" nos estudos de setor: produto em azul, dinheiro em laranja, ciclo de caixa embaixo. É a melhor explicação gráfica do painel.
- Inadimplência, Commodities e Capital de Giro: telas simples e diretas.
- Base de acessibilidade: 34 das 39 conferências automáticas sem nenhum achado.

## Achados, por impacto

### Alto

| # | Princípio | Onde | Problema | Correção |
|---|---|---|---|---|
| 1 | Proximidade, Murphy | Celular, todas as abas | A coruja fica em cima do título da tela ("C..ÁRIOS", "J..OS") e do primeiro relógio. Medido: coruja de 40×40 px a 12 px da borda; o título começa a 16 px. Em Aprender ela cobre o início do parágrafo durante a leitura. | Levar a coruja para a fileira de ícones da direita ou reservar o espaço dela ao lado do título. |
| 2 | Von Restorff, carga cognitiva | Mercado, topo, detalhe da moeda | Com o mercado fechado, tudo aparece como "Dado antigo", "Atualização parcial" e "Última amostra com mais de 10 minutos". A regra olha só os 10 minutos, não o horário do pregão. À noite e no fim de semana a primeira tela tem 4 avisos amarelos para uma situação normal. | Fora do pregão, dizer "Fechamento de 12/11, 19:41" em tom neutro. Guardar o amarelo para atraso durante o pregão. Só texto e cor; não muda dado. |
| 3 | Murphy, pico-fim | Conta Garantida, Análise de desconto | A tela abre com mensagens de erro em vermelho antes de a pessoa digitar (3 na Conta Garantida). A primeira impressão é de defeito. | Mostrar o erro só depois de sair do campo ou de pedir o cálculo. Ou abrir com exemplo, como as outras. |
| 4 | Hick, Fitts | Cenários, celular | Os 10 assuntos ocupam 5 linhas, cerca de 210 px (um quarto da tela), em todas as telas de Cenários. Fiscal e Frete marítimo têm 2 linhas de dado cada. | Uma faixa de uma linha que desliza, ou um seletor. Juntar Fiscal com Inflação e Frete com Commodities. |
| 5 | Semelhança, Jakob | Site inteiro | Três aparências convivem: terminal escuro (mercado), cartões claros azul-marinho (calculadoras) e texto sem acabamento dentro de painéis (BNDES "Linhas oficiais" e "Cobertura", Bancos "Falha parcial", histórico do emprego). No tema escuro, Finame, 4131 e o diagrama dos setores ficam brancos sobre preto; a Conta Garantida fica escura. As 9 calculadoras usam 4 tipos de cabeçalho e 4 tipos de botão de escolha. Numa mesma tela convivem até 20 tamanhos de letra (Finame), 18 (Recuperação judicial) e 17 (Comparador). | Um padrão único de calculadora, a partir do Finame. Uma regra para o tema escuro. Uma escala curta de tamanhos de letra (6 a 8). Fazer aos poucos, tela a tela. |
| 6 | Semelhança | Bancos | Alta de inadimplência e de provisão aparece em verde, e há troféu no "melhor". O texto diz "setas mostram variação, não qualidade", mas a cor diz o contrário. A tabela fica numa caixa com rolagem própria e corta a linha "ROE" ao meio. | Cor neutra nas variações desses indicadores (ou vermelho para alta de inadimplência). Deixar a tabela crescer com a página. |

### Médio

| # | Princípio | Onde | Problema | Correção |
|---|---|---|---|---|
| 7 | Carga cognitiva | Vários | Texto de bastidor na tela: "conferência pendente", "histórico indisponível", "Classificação pendente" (vira um ponto no mapa), "745 notícias com classificação pendente", "TFB_36_30", "TFC_60.90", "Selic D-2 · 143", "LD1", "Identificação não exibida", "Sem setor", "cruzado", "ref. cruz.", nomes completos de atividade do IBGE. | Trocar pela palavra do usuário ou esconder em "detalhes". |
| 8 | Occam, carga cognitiva | Recuperação judicial, Feriados, Projeções, Curvas, Bancos | Muita ressalva antes do dado. Projeções tem 5 avisos "pode estar desatualizada" (todos os bancos, de 24 a 55 dias). Curvas repete o mesmo parágrafo nos dois gráficos. | Uma linha e um "saiba mais". Data da projeção no cabeçalho de cada banco. |
| 9 | Occam | Setores, Commodities, Comparador, marca | Títulos repetidos: Setores tem 6 linhas que dizem o mesmo; "Commodities" aparece 4 vezes. O Comparador tem 3 nomes (Comparador de Crédito, Comparação de operações, Comparador de operações). A marca é "PME" no topo e na tela de acesso e "PEME" nas calculadoras, no Panorama, na caixa de sugestões e no aplicativo instalado. | Um título por tela. Um nome por calculadora. Decidir entre PME e PEME. |
| 10 | Semelhança | Calendário, Notícias, Commodities, gráficos | Idiomas e formatos misturados: eventos em inglês ("GDP m/m", "Unemployment Claims"), número com ponto ("0.0%", "194K"), manchete em inglês sem tradução, "US$" e "USD" na mesma tabela, três formatos de data nos eixos ("nov de 26", "12/11", "14/11/25"). | Padronizar em português e no formato brasileiro. |
| 11 | Explicação gráfica | Juros, BNDES, câmbio, Aprender, Recuperação | Eixos com números quebrados (BNDES 17,11 / 16,14; curva 15,44 / 14,95; câmbio 5,661 / 5,639). O cupom cambial vai de −16 a 24 por causa da ponta curta, e a curva vira quase uma reta. O par CDI e Selic fica desalinhado porque o cabeçalho de um quebra em 4 linhas. O controle "Agrupar" aparece em todo gráfico, quase sempre com opções apagadas. O mapa do conhecimento segue ilegível (237 pontos, 579 ligações). O mapa de recuperação tem bolhas pequenas e fundo claro no tema escuro. | Números redondos nos eixos. Cortar a ponta curta do cupom ou dar zoom padrão. Cabeçalho de gráfico com altura fixa. "Agrupar" dentro de um menu. Mapa do conhecimento abrindo em lista. |
| 12 | Von Restorff | Projeções | Quase todas as células têm fundo de destaque e todas as setas têm a mesma cor. O destaque não destaca. | Destacar só a diferença relevante (por exemplo, acima de 0,25 ponto). |
| 13 | Carga cognitiva | Recuperação judicial | Dois dos quatro números de destaque não informam ("160 de 160", "100%"). O "−71%" vem em destaque numa base de cobertura parcial; pode ser lido como queda real de pedidos. | Tirar os dois primeiros. Explicar o −71% ao lado ou tirar do destaque. |
| 14 | Fitts, Miller | Juros, celular | A tabela mostra um período por vez. A primeira coluna ocupa um terço. Cada linha tem 106 px porque o "?" cai para baixo. A tela tem quase 10 alturas de rolagem. | Um cartão por indicador, com as 4 datas. "?" na mesma linha do nome. |
| 15 | Hick | BNDES | Quatro jeitos de comparar séries na mesma tela. No celular a linha da tabela se desmonta: valor em cima, nome embaixo. | Um jeito só de comparar. Linha em cartão no celular. |
| 16 | Espaçamento | Indexadores, BNDES, Apresentar, Configurações (celular) | Título do painel colado na borda de cima. Conteúdo sem margem lateral em BNDES, Apresentar e Configurações. | Margem interna padrão do painel. |
| 17 | Espaçamento | Projeções, Mercado, Juros | Textos se sobrepõem: "CENÁRIO ECONÔMICO" sobre a data (celular); "IBOVESPA" sobre "pontos · fech." (celular e 1024 px); data quebrada no meio do ano em Juros (celular). | Deixar a data cair para a linha de baixo quando não couber. |
| 18 | Conteúdo | Notícias | Matéria da Samsung e da Expensify marcada como "JPY". Sobra "Por Investing.com" no fim da manchete. | Rever a regra de etiqueta. Limpar o fim da manchete. |
| 19 | Contraste | Comparador, Finame, Notícias | Selo "Crédito x caixa" é branco sobre branco (1,06; invisível). "% a.a." no Finame tem 2,9. Etiquetas de moeda nas Notícias no tema claro têm 3,5. O mínimo é 4,5. | Escurecer o texto ou o fundo. |
| 20 | Carga cognitiva | Configurações | 10.225 palavras: 18 telas no computador e 62 no celular. | Abrir recolhido, uma linha por fonte, com busca. |

### Baixo

| # | Onde | Problema | Correção |
|---|---|---|---|
| 21 | Feriados | O padrão "Todos os calendários" mistura aniversário de Cascavel e de Londrina com feriado nacional. Quase 9 telas no celular. | Padrão "Nacional e B3". |
| 22 | Mercado, computador | Abaixo das 4 moedas, a metade esquerda fica vazia (cerca de 500 px) enquanto as notícias seguem à direita. | Completar com juros e commodities do dia, ou encurtar a coluna de notícias. |
| 23 | Setores | Contorno laranja em volta de toda a grade, de borda a borda. Emojis como ícones no diagrama, fora do padrão de traço do resto. | Tirar o contorno. Trocar os emojis quando houver tempo. |
| 24 | Calculadoras | FINIMP e Conta Garantida abrem vazias; as outras abrem com exemplo. No Comparador há cerca de 510 px de cabeçalho antes do primeiro campo, e o resultado fica a 3 telas. | Abrir todas com exemplo. Resumo fixo do resultado, como no Finame. |
| 25 | Topo | Ícones sem rótulo (ponto vermelho, "i"). Há 2 botões de atualizar na primeira tela do Mercado. | Rótulo ao passar o mouse já existe; avaliar um só botão de atualizar. |

## As três correções de maior retorno

1. **Tirar a coruja de cima do título no celular.** Aparece em todas as telas e é um ajuste pequeno.
2. **Trocar a linguagem de "dado antigo" quando o mercado está fechado.** É a primeira coisa que se lê e hoje passa ideia de defeito.
3. **Calculadoras: não abrir com erro em vermelho e seguir um padrão só (o do Finame).** Resolve a sensação de vários aplicativos diferentes.

Em seguida: o menu de Cenários no celular (item 4).

## Riscos e ressalvas

- O item 2 muda só texto e cor. A regra de 10 minutos continua valendo durante o pregão.
- O item 13 é risco de leitura, não erro confirmado: não conferi a base por trás do −71%.
- Dado a conferir na fonte (não é design): o gráfico de 30 dias do dólar tem um ponto em 18/10/2026, que é domingo.
- As calculadoras estão fora do menu desde 10/11, por decisão registrada. Hoje só se chega a elas pela busca e por link direto.
- Nenhuma correção proposta mexe em regra de cálculo financeiro.

## Registro das 20 leis de UX

| Situação | Leis |
|---|---|
| Problema observado | Hick (4, 15), Fitts (14), Jakob (5), proximidade (1, 16, 17), Miller (14), Von Restorff (2, 12), Occam (8, 9), Murphy (1, 3), semelhança (5, 6, 10), carga cognitiva (2, 7, 8, 13, 20), pico-fim (3) |
| Atendido no que foi visto | Fitts em alvos de toque (poucos abaixo de 24 px fora de Configurações), Postel (valores validados com mensagem), conectividade uniforme (diagrama dos setores), Tesler (Finame faz as contas e mostra o resumo) |
| Não verificado | Doherty (tempo de resposta não medido), Zeigarnik e gradiente de meta (não percorri um cálculo do começo ao fim), posição serial, Parkinson |

## O que não deu para conferir

- Aparelho físico (iPhone, Android), leitor de tela e projetor.
- Tablet: só o cabeçalho foi visto em 768 e 1024 px.
- Tempo de resposta.
- Preencher cada calculadora do começo ao fim, imprimir PDF e o modo de apresentação.
- O aviso que aparece depois do código de e-mail no primeiro acesso (a tela de e-mail foi vista; não informei e-mail).
- A busca e o menu "Mais" do celular.
- Se os números mostrados batem com as fontes.
