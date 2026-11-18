# Apresentar por seleção (17/11/2026)

A aba **Apresentar** foi refeita do zero a pedido. A montagem antiga (por setor, com leitura do site do cliente, cadeia e
perguntas da visita) foi removida.

**Acesso:** por enquanto a aba fica fora do menu, a pedido (17/11/2026). Abre pelo endereço `#apresentar` ou pelo
comando APRESENTAR. Para colocá-la no menu, tirar `oculto: true` em `appSections.js`; nesse caso o menu do topo passa
a ter onze abas e precisa do ajuste de espaçamento que está no histórico (commit `4f4fa79`, `TopBar.css`).

## O que faz
- O usuário marca blocos do painel e cada um vira um slide claro, em formato 16:9, na ordem da escolha.
- Os slides aparecem ao lado, enquanto são marcados. Clicar em um slide apresenta a partir dele.
- Capa com o nome do cliente, o setor (texto livre) e a data. O nome fica só na memória da página: não é gravado no
  navegador nem enviado a lugar nenhum. A montagem sobrevive à troca de aba e some ao recarregar.
- Enquanto a aba está aberta, o painel inteiro fica no tema claro. Ao sair, volta ao tema escolhido.
- Só tela (sem PDF nem PowerPoint), por decisão do pedido.

## O que pode virar slide
| Seção | Blocos |
|---|---|
| Mercado | indicadores do dia (com Selic, CDI e DI), tabela de câmbio, gráfico de cada moeda, comparação entre moedas, Panorama do dia, veículos pesados |
| Juros | CDI, CDI futuro, DI x pré, cupom cambial, SOFR, Fed, €STR, BCE, Japão, Treasuries, curva do euro |
| Cenários | Focus e bancos, histórico do Focus (geral e por indicador), agenda da semana, inadimplência, recuperação judicial (números, estado, setor), atividade e emprego, indexadores, IPCA, IPCA por grupos, fatores da inflação, dívida pública, commodities (tabela em dólar em dois slides, tabela em reais e gráfico de cada referência, inclusive celulose), combustíveis, frete |
| Notícias | por tema: mercado e moedas, tributos e trabalho, setores e insumos; a lista "Escolher notícias" tira manchetes |
| BNDES | resumo do dia, tabelas TFB, TLP, TFC (em dois slides) e moedas, histórico de 12 meses das quatro referências |
| Setores | por setor: leitura executiva; por estudo: resumo executivo, cadeia de valor, indicadores e perguntas; por insumo: o que move o preço |
| Bancos | tabela comparativa e histórico de quatro indicadores |
| Feriados | próximos três meses com feriado |
| Calculadoras | as 13 calculadoras, inclusive Faturamento, em dois modos: **Resultado** (números principais) e **Dados** (campos) |

Aprender e Configurações ficam de fora.

## Como foi construído
- Cada bloco usa a própria peça do painel (`apresentarBlocos.jsx`), então os números são os mesmos das outras abas.
  Nenhuma regra de cálculo foi alterada.
- O slide tem tamanho lógico fixo (1120 × 630) e é ampliado ou reduzido por inteiro: a miniatura e a tela cheia são o
  mesmo slide, na mesma instância (`Apresentar.jsx`).
- `ApresentarAjuste.jsx` amplia ou reduz a peça até ocupar o corpo do slide.
- Peças do painel ganharam parâmetros opcionais para mostrar um quadro de cada vez (`so`, `semHistorico`, `embutido`,
  `impactoInicial`). Sem o parâmetro, o comportamento das abas de origem não muda.
- Calculadoras: memórias de cálculo, tabelas de parcelas e qualquer tabela com mais de 14 linhas ficam fora do slide
  (`ApresentarCalculadora.jsx` e regras em `Apresentar.css`).
- `ApresentacaoBase.css` guarda só o visual compartilhado com as apresentações das calculadoras do BNDES e do 4131.

## Limites conhecidos
- Teto de 80 blocos por apresentação. Cada slide mantém viva uma peça do painel; com quase 190 blocos de uma vez o
  navegador de teste ficou sem memória. A tela avisa quando o teto é atingido.
- O tema de notícias "Madeira e base florestal" vem só da busca da imprensa (ver "Segunda rodada"). Aparece nos slides
  e, como os demais temas de `temas.json`, alimenta a busca do painel e o mapa de conhecimento. Não tem pasta própria na
  aba Notícias, que usa fontes institucionais por setor. Na busca do painel, a manchete de madeira ainda abre em
  Mercado › Notícias › Moedas, onde ela não aparece (o mesmo já acontece com trigo e outros insumos novos).
- Referência sem histórico na coleta do dia mostra aviso em vez de gráfico.
- Slides com muito conteúdo (os 4 gráficos do Focus juntos, bancos, TFC) ficam com letra menor. Há slides individuais
  para o Focus e para os indicadores dos bancos.
- Calculadoras sem valores iniciais abrem no modo Dados, com rolagem dentro do slide.

## Ficou de fora
- Bolinhas de notícia e de maiores altas e baixas do gráfico de moeda (também de 17/11/2026): ficam só no painel. No
  slide, as notícias entram pelo bloco de Notícias, onde dá para escolher as manchetes.
- Buscas do Google (Trends): o gráfico é carregado direto do Google, o painel não confirma o conteúdo e ele não cabe
  bem num slide.
- Pautas editoriais da Central de setores (são roteiro de pesquisa, não conteúdo para cliente).
- Finame e 4131 usam os mesmos identificadores internos; se os dois estiverem na mesma apresentação, um leitor de tela
  pode anunciar o título do primeiro. Os demais slides têm identificadores próprios (`apresentarIds.js`).

## Revisão independente (17/11/2026)
Leitura do código por revisor sem o histórico da montagem. Um ponto importante, corrigido: com uma janela de detalhe
aberta dentro do slide, Esc e as setas agiam na apresentação e podiam deixar a janela presa. Agora as teclas ficam com
a janela. Também corrigidos: "Limpar tudo" apaga cliente, setor e slides; o foco volta para a miniatura ao sair; a
contagem de notícias considera só as retiradas ainda na janela. Nenhuma regra de cálculo foi alterada.

## Não conferido
- Publicação e site no ar (só depois da autorização e do parecer do Auditor).
- `smoke-inadimplencia` não roda no ambiente da sessão (pede um navegador que não está instalado); não faz parte da
  conferência automática.
- Bloco a bloco dentro de cada aba de origem: as nove seções estão no catálogo, mas a comparação foi por seção.

## Ajuste em teste existente
`test/base-dados.test.mjs` proíbe o texto "Fonte:" nas telas do painel (as fontes ficam em Base de dados). O rodapé do
slide é a exceção aberta nesta entrega: o slide sai do painel para a visita e leva o nome curto da fonte.

## Parecer do Auditor Independente (17/11/2026)
Primeiro parecer: **Requer correção** (86,6). A aba passou; o ramo publicado tinha recebido duas mudanças depois dos
testes (bolinhas do dólar e calculadora Faturamento) e a entrega precisava ser atualizada e testada de novo. Correções
feitas: ramo atualizado, índice da busca refeito, bolinhas fora do slide, Faturamento declarada fora, aviso no slide de
indicadores quando não há cotação, e esta nota completada. O Auditor conferiu as notícias com os arquivos reais do
site: 61 slides de notícias, 31 com manchetes, nenhum erro.

## Atualizações do painel incorporadas (17/11/2026)
O ramo publicado andou quatro vezes durante a entrega, e ela foi atualizada a cada vez. Na terceira junção (maximizar
gráficos), os testes automáticos passaram, mas a varredura de todos os slides não foi refeita e dois slides de
recuperação judicial quebraram; o Auditor achou e a correção está abaixo. Desde então, cada junção é seguida de
varredura de todos os blocos com os arquivos reais do site.
- Bolinhas de notícia do dólar: ver "Ficou de fora". Calculadora Faturamento: entrou na segunda rodada (abaixo).
- Celulose (exportação do Brasil): entrou como gráfico em Cenários › Commodities.
- Maximizar gráficos: o botão não aparece no slide, que já é a visão ampliada.
- Filtro das manchetes do dólar (rascunho nº 464): sem efeito na aba.

## Segundo parecer do Auditor (17/11/2026)
**Requer correção** (83,2), no commit `1fb02f7`. Achados e correções:
- Recuperação judicial "por estado" e "por setor" saíam iguais e cortados depois da junção do maximizar gráficos. A
  regra que escolhe o cartão de cada slide passou a reconhecê-lo pelo título, e não pela posição.
- "Commodities em dólar" cortava as últimas linhas com as 21 referências do site. Virou dois slides complementares.
- O teste de tela não provava que as bolinhas do dólar ficam fora do slide (a série de teste não gerava bolinhas).
  Agora gera, e o teste exige que existam e não apareçam. Também cobre os dois slides de recuperação judicial e as
  21 referências de commodities.
- Base atualizada de novo (rascunho nº 464) e textos corrigidos.

## Conferência
- `test/apresentar.test.mjs`: seleção, ordem, teclado, notícias, busca de blocos, montagem só em memória, tema imposto.
- `scripts/smoke-apresentar.cjs` (na conferência automática): montagem, slides claros sem corte, notícias com ajuste,
  calculadora nos dois modos, teclado, celular e computador, nome do cliente fora do armazenamento.

## Segunda rodada (17/11/2026, depois da publicação)
Decisões do Fernando no mesmo dia: incluir a calculadora Faturamento, criar o tema de notícias "madeira" e manter a aba
fora do menu.
- **Faturamento nos slides.** Entra em Calculadoras, como as demais. Sem números, o slide abre nos campos; depois de
  colar a tabela (ou usar o exemplo fictício), o botão "Resultado" mostra o gráfico de faturamento e endividamento, o
  resumo por ano e, com um período escolhido, a comparação com o ano anterior. O gráfico cabe inteiro na largura do
  slide (no painel ele rola para o lado). A conta é a da calculadora; nenhuma regra mudou. O rodapé do slide diz
  "números informados na tela; nada é salvo nem enviado". Como nas outras calculadoras, o que for colado fica só na
  memória da página e some ao recarregar. Fernando informou que os números usados são genéricos; a regra do projeto
  continua valendo: extrato e dado real de cliente não vão para o git.
- **Tema "Madeira e base florestal".** Novo tema em `scripts/temas-lib.mjs` (quatro buscas no Google Notícias, janela
  de cinco dias, como os demais). O título precisa citar o setor (madeira, serraria, MDF, MDP, compensado, florestas
  plantadas, concessão ou manejo florestal, eucalipto, pinus, Ibá, ABIMCI, moveleiro, indústria de móveis, Dexco,
  Duratex, Eucatex, Berneck, Arauco) e trazer contexto de mercado. O filtro tira, pelas palavras do título: a Ilha da
  Madeira (governo, turismo, hotel, imóveis, Portugal), o Rio Madeira (hidrelétricas, hidrovia), o MDF-e, sobrenome
  Madeira em cargo público, a loja MadeiraMadeira, objetos de madeira (berço, brinquedo, ponte), apreensão de carga,
  fiscalização, furto, acidente e incêndio em empresa. "Apreensão" no sentido de preocupação e a lei antidesmatamento
  europeia entram. Um título que cite a ilha ou o rio sem nenhuma dessas palavras ainda pode passar. Na Apresentar o
  tema aparece em Notícias › Setores · Indústria e transformação. A coleta ganha quatro buscas por rodada.
- **Descrição dos slides de commodities em dólar** corrigida (primeira parte: energia, metais, minério, soja e milho;
  segunda: açúcar, café, fertilizantes, trigo, carne, algodão, carvão, cacau e celulose). Era o achado de baixa
  gravidade do terceiro parecer do Auditor.

- **Quadro do slide não rola.** Escolher um campo dentro de um slide podia deslocar o slide alguns pontos no celular
  (visto no teste de tela). O quadro agora não rola por foco nem por código.

### Atualização do ramo publicado nesta rodada
O ramo publicado recebeu o rascunho nº 470 (Faturamento: quadro pontilhado por período, total e seta da variação)
depois da primeira conferência. O ramo foi juntado (`d61e49f`), o slide do Faturamento foi refeito com o gráfico novo
(quadros pontilhados, totais e seta dentro do slide; tabela de comparação mais compacta para o gráfico ficar maior) e
testes, teste de tela e varredura dos slides foram repetidos no estado juntado.
Depois entrou o nº 466 (Focus com a data de publicação do boletim; aviso "Em construção" na primeira tela das
calculadoras), juntado em `cc9739b`. O aviso fica só na lista de calculadoras, não dentro de cada uma, então não
aparece nos slides; o slide "Focus e bancos" passa a mostrar a data de publicação do boletim, como na aba Cenários.
Testes, teste de tela e varredura repetidos também nesse estado.

### Parecer do Auditor nesta rodada
Primeiro parecer: **Requer correção** (81,3), no commit `f3cbc0f`. Passou: Faturamento nos slides, nada colado é gravado
ou enviado, nenhuma conta mudou, aba fora do menu. Achados e correções: ramo publicado tinha andado (juntado, acima);
o filtro de madeira aceitava ruído (hotel na Madeira, hidrelétricas do Madeira, MDF-e) e recusava notícia do setor
("apreensão" com tarifa, lei antidesmatamento) — filtro refeito e testado com as baterias do Auditor (28 de 30
legítimas aceitas; as duas recusadas são celulose pura e título em inglês; 0 de 25 ruídos aceitos); duas frases desta
nota corrigidas; teste de tela passou a exigir o slide no lugar.

Não conferido nesta rodada: o filtro do tema madeira com manchetes reais. O ambiente da sessão não alcança o Google
Notícias; o filtro foi testado com manchetes de exemplo. A primeira coleta real acontece na publicação, e o resultado
precisa ser lido no site depois dela. Com mais de 24 meses colados, os rótulos do gráfico do Faturamento ficam
pequenos no slide; os números principais estão na tabela e no resumo por ano.

## Terceira rodada (18/11/2026): tema madeira sem descarte por palavra
Decisão do Fernando, literal: "Não pode nada ficar fora por conta de palavras como "desabon", por exemplo. Pode incluir
tudo, porque aqui é educativo." (Ele se referia a "desabam", do exemplo "Exportações de madeira desabam 40%".)
- O filtro do tema "Madeira e base florestal" deixa de descartar matérias por palavras do título (desaba, tomba,
  benefícios, Portugal, apreensão, polícia, ilegal, incêndio, acidente, objetos de madeira e outras) e deixa de exigir
  palavra de contexto econômico. Entra toda matéria que cite o setor, inclusive queda de preço, acidente, fiscalização e
  notícia de outros países.
- Outros sentidos da palavra não descartam a matéria. Expressões como "Ilha da Madeira", "Rio Madeira", "do Madeira",
  "Deputado Madeira" ou "Prefeitura de Serraria" são apagadas do título antes de procurar o setor: se o título ainda
  citar madeira, serraria, madeireiro, MDF, pinus ou outro termo do setor, a matéria entra ("Madeireiros escoam produção
  pelo Rio Madeira" entra; "Hidrelétricas do Madeira reduzem produção" não). O MDF-e (documento fiscal) não conta como
  MDF. Regra em `relevanteTema`, campo `homonimos`, usado só por este tema.
- Efeito esperado: mais matérias, inclusive de consumo ligado à madeira (piso, lenha, móveis planejados). Dá para tirar
  do slide as que não servirem em "Escolher notícias". Também passam títulos sobre a ilha que não usam as expressões
  acima, como "Madeira: aeroporto fecha por causa do vento", "hotel na Madeira" e jogo do clube Nacional da Madeira.
- Conferência do filtro: as 13 manchetes reais já coletadas continuam entrando; nas baterias do Auditor, todas as
  manchetes legítimas do setor entram, inclusive as que citam o rio, a ilha ou o "porto Santos" (ficam fora só duas sem
  palavra do setor: uma de celulose e uma em inglês).
- Os demais temas de notícias continuam com seus filtros; esta decisão vale só para madeira.

### Parecer do Auditor nesta rodada
Primeiro parecer: **Insuficiente** (81,2), no commit `fc50e0d`, com o CI ainda rodando. Achados: as exclusões de rio,
ilha e "Nacional da Madeira" ainda descartavam matéria do setor ("Madeireiros escoam produção pelo Rio Madeira", "Feira
Nacional da Madeira", "porto Santos"); esta nota dizia "só sai o que não é madeira" e citava Fernando sem o literal.
Correção: exclusão trocada pela regra dos homônimos acima, "Porto Santo" com fim de palavra, "Nacional da Madeira"
retirado, testes com os títulos do Auditor e nota corrigida.

## Quarta rodada (18/11/2026): palavras de mercado mais amplas nos demais temas
Pergunta do Fernando: qual a melhor sugestão "para não poluir também, porque a ideia é trazer as coisas o mais assertivas
possível". Decisão: opção 1, "Sim, ampliar e publicar".
- Os temas de setor e de insumo (indústria, comércio, serviços, telecom, veículos pesados, cobre, alumínio, aço, minério,
  petróleo, trigo, açúcar, carne, algodão, carvão, cacau, café e fertilizantes) continuam exigindo, além do assunto, uma
  palavra de mercado no título. É o que mantém fora o uso comum da palavra ("câmera cobre o show", receita de bolo de
  trigo, "como fazer o café perfeito").
- A lista de palavras de mercado ganhou uma parte comum a todos esses temas (`MERCADO_AMPLO` em
  `cotacoes/scripts/temas-lib.mjs`), com cada palavra presa ao sentido de mercado: demissão, férias coletivas, abertura ou
  fechamento de fábrica, mineradora, usina de açúcar ou siderúrgica, investimento, lucro, prejuízo líquido, faturamento,
  balanço trimestral, sobretaxa, tarifaço ou tarifa de importação, antidumping, aquisição, fusão com empresa, cotação,
  exportação, importação, financiamento, linha de crédito ou crédito rural, "recorde de exportação/vendas/produção", "capacidade
  produtiva", "amplia a produção", nova fábrica ou unidade e "abre/fecha/corta vagas". Palavra solta como "recorde",
  "capacidade", "balanço", "tarifa" ou "crédito" não conta. Safra e colheita contam só nos temas de insumo (em veículos
  pesados, "caminhão com safra de milho tomba" é acidente).
- Nas listas próprias e na lista comum, "importa" não pega mais "importante" nem "não importa", e "invest" não pega
  "investiga" nem "investe contra" (o defeito de "importante" já existia em trigo, petróleo, carvão, fertilizantes e
  alumínio). "Brasil importa mais trigo" continua valendo.
- Minério de ferro: "Vale do Silício" e outros vales com nome próprio não contam como a mineradora Vale. Aço: "nervos de
  aço", "homem de aço" e expressões parecidas não contam.
- Veículos pesados não tem mais lista de palavras que derrubam (acidente, roubo, morte). Como o título já precisa trazer
  assunto de mercado, "Acidente com ônibus deixa feridos" continua fora e "Roubo de carga encarece o frete de caminhões"
  passa a entrar.
- Defeito antigo corrigido: o tema Café não reconhecia "café" quando a palavra vinha seguida de espaço ou pontuação
  (a marca de fim de palavra não funciona depois de letra acentuada). Só entravam títulos com "arábica", "conilon" etc.
  O plural "cafés" continua reconhecido.
- Moedas e eleições nos EUA seguem só com a lista própria; madeira segue sem filtro de mercado (terceira rodada).
- Conferência: as 351 matérias reais coletadas hoje em todos os temas continuam entrando; testes novos em
  `cotacoes/test/temas-mercado-amplo.test.mjs` com manchetes que devem entrar e manchetes de uso comum que devem ficar fora.
- Passam a entrar com a lista comum, por usar o nome do tema em outro sentido junto com uma palavra de mercado (exemplos
  de teste, que ficavam fora antes): "Fábrica de Talentos abre vagas para jovens" (Indústria), "Bancos de praça:
  prefeitura investe em reforma" e "Tecnologia: governo investe em escolas" (Serviços), "Plano cobre financiamento de
  cirurgia" (Cobre), "Usina de ideias: café com empreendedores" (Café). Também entra "Roubo de caminhão com carga de
  exportação" (Veículos pesados), porque traz palavra de mercado. São casos raros e saem do slide em "Escolher notícias".
- Primeiro parecer do Auditor: **Requer correção** (72,0), no commit `888abe8`: a lista comum sem limite de palavra
  deixava entrar "Café faz bem? Estudo importante…" e "Polícia investiga acidente com ônibus…", e o plural "cafés" tinha
  deixado de ser reconhecido. Segundo parecer: **Requer correção** (80,0), no commit `c4397e8`: "não importa" e "PM
  investe contra" ainda entravam, "crédito" e "safra" soltos abriam poluição, e esta nota dizia "como antes" sobre casos
  novos. Corrigido como descrito acima, com essas manchetes nos testes.
- Não conferido: quanto cada tema ganha com a coleta real (o Google Notícias está fora da rede da sessão). Ler no site
  depois da publicação, principalmente cobre, alumínio, carvão e café.
