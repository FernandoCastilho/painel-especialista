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
| Cenários | Focus e bancos, histórico do Focus (geral e por indicador), agenda da semana, inadimplência, recuperação judicial (números, estado, setor), atividade e emprego, indexadores, IPCA, IPCA por grupos, fatores da inflação, dívida pública, commodities (tabelas e gráfico de cada referência), combustíveis, frete |
| Notícias | por tema: mercado e moedas, tributos e trabalho, setores e insumos; a lista "Escolher notícias" tira manchetes |
| BNDES | resumo do dia, tabelas TFB, TLP, TFC (em dois slides) e moedas, histórico de 12 meses das quatro referências |
| Setores | por setor: leitura executiva; por estudo: resumo executivo, cadeia de valor, indicadores e perguntas; por insumo: o que move o preço |
| Bancos | tabela comparativa e histórico de quatro indicadores |
| Feriados | próximos três meses com feriado |
| Calculadoras | as 12 calculadoras, em dois modos: **Resultado** (números principais) e **Dados** (campos) |

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
- Não há tema de notícias "madeira". O mais próximo é "Têxtil, vestuário e móveis". Criar o tema mexe na coleta de
  notícias e depende de decisão à parte.
- Referências sem histórico na coleta (hoje: WTI, ouro, minério, soja e milho em dólar) mostram aviso em vez de gráfico.
- Slides com muito conteúdo (os 4 gráficos do Focus juntos, bancos, TFC) ficam com letra menor. Há slides individuais
  para o Focus e para os indicadores dos bancos.
- Calculadoras sem valores iniciais abrem no modo Dados, com rolagem dentro do slide.

## Ficou de fora
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

## Conferência
- `test/apresentar.test.mjs`: seleção, ordem, teclado, notícias, busca de blocos, montagem só em memória, tema imposto.
- `scripts/smoke-apresentar.cjs` (na conferência automática): montagem, slides claros sem corte, notícias com ajuste,
  calculadora nos dois modos, teclado, celular e computador, nome do cliente fora do armazenamento.
