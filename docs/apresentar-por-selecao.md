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
- O tema de notícias "Madeira e base florestal" existe só na busca da imprensa e só aparece nos slides (ver "Segunda
  rodada"). Não tem pasta própria na aba Notícias, que usa fontes institucionais por setor.
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
  de cinco dias, como os demais). O título precisa citar o setor (madeira, serraria, MDF, MDP, compensado de pinus,
  florestas plantadas, eucalipto, pinus, Ibá, ABIMCI, moveleiro) e trazer contexto de mercado. Ficam de fora a Ilha e
  o Rio Madeira, fiscalização, apreensão e ocorrência policial. Na Apresentar ele aparece em Notícias › Setores ·
  Indústria e transformação. A coleta ganha quatro buscas por rodada.
- **Descrição dos slides de commodities em dólar** corrigida (primeira parte: energia, metais, minério, soja e milho;
  segunda: açúcar, café, fertilizantes, trigo, carne, algodão, carvão, cacau e celulose). Era o achado de baixa
  gravidade do terceiro parecer do Auditor.

Não conferido nesta rodada: o filtro do tema madeira com manchetes reais. O ambiente da sessão não alcança o Google
Notícias; o filtro foi testado com manchetes de exemplo. A primeira coleta real acontece na publicação, e o resultado
precisa ser lido no site depois dela.
