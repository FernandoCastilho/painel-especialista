# Direção de arte, etapa 1: base, cabeçalho e tela Mercado (17/11/2026)

Execução do combinado aprovado pelo Fernando em 17/11/2026, a partir de `docs/revisao-arte-2026-11-17.md`. Nenhuma regra de cálculo, dado ou fonte de dado mudou. Nada foi juntado ao ramo principal nem publicado.

Fotos de antes e depois: pasta `docs/direcao-arte-etapa1/` (computador e celular, tema escuro, dados de 17/11/2026 às 18:41).

## O que mudou

| Combinado | Situação | O que foi feito |
|---|---|---|
| Cabeçalho em uma linha de 1280 a 1920 px | Feito | Medido em 1000, 1100, 1199, 1280, 1366, 1440, 1536, 1700 e 1920 px no tema escuro: 45 px de altura em todas, sem aba cortada. Antes: 89 px (duas linhas) em 1366 e 1440. Entre 1300 e 1599 px o estado dos dados mostra o ponto e a hora; o texto completo fica na dica e na linha de consulta do Mercado. |
| Mercado abre pelo número | Feito | A tela abre com uma manchete de uma linha ("Dólar a 5,7731, −0,19% no dia. Ibovespa +0,31% no fechamento de 17/11."), depois os quadros. Feriados e a linha "Aprender" desceram para baixo dos quadros. No celular, o dólar aparece a 83 px de 844 (10% da tela). Antes: 372 px (44%). |
| Âmbar só na marca e no selecionado | Feito no cabeçalho e no Mercado | Aba aberta: texto branco com traço âmbar embaixo, no lugar do bloco âmbar cheio. Marca: "PME" em branco com um quadrado âmbar. Títulos de seção, nomes dos pares de moeda e botões do quadro "Mercado hoje" em branco. O aviso de dado atrasado em horário de coleta continua âmbar. |
| Letra própria embutida | Feito | Inter para texto e JetBrains Mono para números, as duas de licença aberta (OFL), dentro do pacote do painel. Peso na primeira visita: 87 KB (48 KB + 40 KB), medido. Um conjunto extra de 100 KB só é baixado se a tela usar caractere fora do alfabeto latino comum. |
| Resposta ao toque | Feito | Botões, abas e quadros afundam um pouco (97%) enquanto pressionados. Vale no cabeçalho, na barra do celular e em todas as telas, menos nas calculadoras. |
| Traço que desliza entre abas | Feito | 420 ms, no cabeçalho do computador. |
| Entrada em sequência | Feito | Manchete e quadros do Mercado sobem um depois do outro (55 ms entre eles); o minigráfico se revela da esquerda para a direita. Tudo termina em menos de 1 segundo. |
| Espera com a forma do conteúdo | Feito no topo do Mercado | Enquanto as cotações carregam, aparecem os quadros vazios com um brilho que passa, no lugar de nada. Quem usa leitor de tela ouve "Carregando cotações…". |
| Número que rola | Feito nos quadros do Mercado | Quando chega cotação nova, o número passa pelos valores intermediários por 0,42 s e acende em verde (subiu) ou vermelho (caiu). Na abertura o número aparece pronto, sem contagem. |
| Desliga com "reduzir movimento" | Feito | Conferido: sem entrada, sem traço deslizando, sem afundar, número troca direto. |

## Fora desta etapa (como combinado)

- Calculadoras: mesmas cores e mesmas letras de antes.
- Redesenho de Juros, Cenários, BNDES, Setores, Bancos, Aprender e Notícias.
- Tema claro: mantido como estava. Ganhou só o que é de disposição e movimento (manchete, ordem do topo do Mercado, cabeçalho em uma linha, resposta ao toque).
- Slides de Apresentar: não mudam.

## Decisões tomadas sem consulta (reversíveis)

- **Manchete só com dólar e Ibovespa.** São os dois números com referência clara ("no dia" e "no fechamento de dd/mm"). Usa os mesmos textos dos quadros; não calcula nada. Sem cotação do dólar, não aparece. Ibovespa com arquivo parado fica de fora.
- **Número não "conta" na abertura.** Uma contagem a partir de um valor inventado seria enfeite. O número só rola quando o valor muda de verdade.
- **Fundo do tema escuro mantido em `#050505`.** A cor da barra do navegador e três testes dependem dela. O painel passou de `#0d0d0e` para `#0e0e10` e ganhou um terceiro nível (`#17171a`) para destaque.
- **Abas em letra normal, 13 px**, no lugar de maiúsculas espaçadas de 12 px. Cabem melhor e leem mais rápido.
- **Selo "online" e relógios do cabeçalho mantidos.** A revisão sugeriu reduzir; fica para decidir depois.
- **Camada de estilo separada** (`Direcao.css`), carregada por último, para a nova direção poder ser revista ou desfeita de uma vez.

## Efeitos nas outras telas

- Todas as telas, menos as calculadoras, passaram a usar a letra nova. Em aparelhos que já mostravam uma letra parecida, a diferença é pequena; no Windows e no Android ela é visível.
- As telas que ainda não foram redesenhadas continuam com títulos em âmbar. O painel fica "meio a meio" até as próximas etapas.
- A coruja continua se mexendo em laço (item 14 da revisão). Não fazia parte desta etapa.

## O que foi conferido

- Testes do painel: 2.086 passaram (4 novos, da manchete e do número que rola). Conferência de código: 0 erros. Montagem: ok.
- Conferências de tela, rodadas aqui na versão final: 30 de 30 passaram. Incluem cabeçalho, Mercado, movimento, tema, calculadoras, BNDES, bancos, setores e recuperação judicial.
- Cabeçalho medido em 9 larguras; posição do dólar medida no celular.
- Movimento medido no navegador: entrada (420 ms, 55 ms entre quadros, uma vez), traço da aba (muda de posição e de largura), botão pressionado (97%), número rolando de 5,7731 a 5,7791 com valores intermediários, espera com 6 formas. Com "reduzir movimento": nada anima.
- Letras: só os dois arquivos latinos foram baixados na tela Mercado.
- Calculadoras: mesmas cores e mesmas letras, conferido por foto e pela letra em uso.

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows. As fotos são de um navegador de teste.
- As animações foram medidas, não assistidas em vídeo.
- Tema claro: só a tela Mercado foi vista depois da mudança.
- As outras telas com a letra nova: vistas Juros e Calculadoras; as demais passaram nas conferências automáticas, mas não foram olhadas uma a uma.
- A foto de "depois" usa as cotações coletadas às 18:05 de 17/11 e os demais dados publicados no momento da foto (por isso o Ibovespa aparece 169.817, e não 169.812).
- Revisão do Simplificador: não está disponível nesta sessão. Fica pendente.
