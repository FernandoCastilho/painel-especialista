# Panorama horário de mercado

- Desde 10/11/2026 o Panorama nunca abre sozinho. Antes ele abria a cada hora e podia cobrir a tela no meio de uma reunião com cliente. Agora abre só pelo botão "Panorama do dia", no topo do quadro "Mercado hoje".
- Edições: de segunda a sexta, 9h–18h, fuso America/Sao_Paulo, excluindo feriados nacionais civis (CIVBR). Carnaval, Corpus Christi e datas locais não são transformados em feriados nacionais. A edição final vale até 18h00min59s.
- Edição nova só acende um ponto no botão (e muda o nome lido pelo leitor de tela para "Panorama do dia (edição nova)"). Abrir o Panorama apaga o ponto; ele reacende na hora seguinte. Fora do horário das edições não há ponto, mas o botão continua abrindo o Panorama com os últimos dados e o texto "Fora do horário das edições · últimos dados".
- Fecha com Escape ou botão de 46px, devolve o foco ao botão que abriu e não muda o endereço.
- Edição já aberta fica guardada por hora em localStorage, com memória da visita se o armazenamento estiver indisponível.

## Pop-ups de entrada (10/11/2026)

- Aviso de entrada: aparece na primeira vez neste aparelho e só volta quando o texto do aviso mudar. O app guarda em localStorage (`aviso-inicial-visto`) uma marca tirada do próprio texto (`avisoInicial.js`); as "Novidades da semana" não entram na marca. Sem armazenamento, o aviso aparece a cada entrada. Para reler: janela do "i" (Informações e avisos gerais) › "Ver o aviso de entrada".
- Conceito do dia: não abre mais sozinho. Abre pelo botão "Conceito do dia" da faixa Aprender, no Mercado; um ponto indica que o de hoje ainda não foi aberto.
- Não mudaram: alerta de variação cambial, recado da administração, aviso de feriado, notificações do navegador e mascote.
- Navegador automatizado (`navigator.webdriver`) continua sem receber o aviso de entrada nem o recado; os smokes que testam esses diálogos desligam a exceção.
- Branco, azul-marinho e laranja em ambos os temas. Cartões 3+2 no desktop e empilhamento responsivo.

## Dados

Reutiliza as fontes existentes, sem coletor ou credencial adicional.

USD/BRL e EUR/BRL: preço indicativo, variação diária e horário. Antigo, retido e reserva diária recebem rótulos. Yuan: CNH/BRL por cruzamento, explicitamente diferente do CNY fictício da prévia.

Última hora: só com cotação fresca e amostra do mesmo dia a até cinco minutos do ponto t−60min. Sem cobertura, indisponível.

DI: curva diária B3 e vértices próximos de dois e cinco anos úteis, marcados ≈. Mudanças em pontos percentuais, apenas com prazos comparáveis. O gráfico mostra a curva por prazo, não intraday.

Brent: spot diário EIA, data real e variação entre observações. Histórico de até trinta observações, sem substituir por preço de topo ou ponto futuro.

O que mudou resume somente câmbio fresco do mesmo dia; variações retidas, antigas e referências diárias não entram como movimento atual. Brent traz a data na própria síntese. Não atribui causas econômicas não verificadas.

## Testes

market-popup.test.mjs cobre horário/fuso, feriados, edição já aberta, ponto de edição nova, abertura manual fora do horário, ausência de abertura automática, armazenamento bloqueado, dados inválidos, última hora, DI e Brent. aviso-inicial.test.mjs cobre a marca do texto e a regra "devo mostrar o aviso?".

smoke-market-popup.cjs cobre 390/820/1280 px em claro/escuro, com fontes sintéticas apenas nas interceptações de teste. Confere que nada abre sozinho (entrada, virada da hora, 18h, fim de semana, feriado, outro diálogo aberto), o botão e o ponto de edição nova, teclado, foco, fechamento e recarga. Integra Cotações CI; capturas e relatório em smoke-capturas/qa-universal/market-popup.

Para verificar produção sem substituir dados, usar POPUP_REAL_DATA=1 e SMOKE_BASE_URL do site. O relógio do navegador continua simulado exclusivamente para provocar o agendamento; as datas das fontes reais permanecem visíveis.

Validação da entrega original (abertura automática, hoje desligada): 13 testes focados, lint sem erros (5 avisos anteriores), build e 6 cenários de navegador aprovados. A suíte completa Windows teve 1.248/1.258 testes aprovados; 10 falhas de fsync de diretório e execução de CLI em caminhos Windows no teste sector-news-safe. O CI Linux deve passar antes do merge.
