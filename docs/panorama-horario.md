# Panorama horário de mercado

- De segunda a sexta, 9h–18h, fuso America/Sao_Paulo, excluindo feriados nacionais civis (CIVBR). Carnaval, Corpus Christi e datas locais não são transformados em feriados nacionais.
- Abre somente com o Painel visível. Ao retornar, apresenta a edição corrente, sem acumular horas perdidas. A edição final pode abrir até 18h00min59s.
- Aguarda o aviso inicial e outros diálogos. Suspenso na apresentação. Fecha com Escape ou botão de 46px, restaura foco e não muda o endereço.
- Deduplicação por hora em localStorage, com memória de sessão se indisponível. Web Locks coordena abas quando suportado.
- Branco, azul-marinho e laranja em ambos os temas. Cartões 3+2 no desktop e empilhamento responsivo.

## Dados

Reutiliza as fontes existentes, sem coletor ou credencial adicional.

USD/BRL e EUR/BRL: preço indicativo, variação diária e horário. Antigo, retido e reserva diária recebem rótulos. Yuan: CNH/BRL por cruzamento, explicitamente diferente do CNY fictício da prévia.

Última hora: só com cotação fresca e amostra do mesmo dia a até cinco minutos do ponto t−60min. Sem cobertura, indisponível.

DI: curva diária B3 e vértices próximos de dois e cinco anos úteis, marcados ≈. Mudanças em pontos percentuais, apenas com prazos comparáveis. O gráfico mostra a curva por prazo, não intraday.

Brent: spot diário EIA, data real e variação entre observações. Histórico de até trinta observações, sem substituir por preço de topo ou ponto futuro.

O que mudou resume somente câmbio fresco do mesmo dia; variações retidas, antigas e referências diárias não entram como movimento atual. Brent traz a data na própria síntese. Não atribui causas econômicas não verificadas.

## Testes

market-popup.test.mjs cobre horário/fuso, feriados, deduplicação, armazenamento bloqueado, dados inválidos, última hora, DI e Brent.

smoke-market-popup.cjs cobre 390/820/1280 px em claro/escuro, com fontes sintéticas apenas nas interceptações de teste. Inclui teclado, foco, fechamento, recarga, virada da hora, 18h, fim de semana, feriado e fila de modais. Integra Cotações CI; capturas e relatório em smoke-capturas/qa-universal/market-popup.

Para verificar produção sem substituir dados, usar POPUP_REAL_DATA=1 e SMOKE_BASE_URL do site. O relógio do navegador continua simulado exclusivamente para provocar o agendamento; as datas das fontes reais permanecem visíveis.

Validação local: 13 testes focados, lint sem erros (5 avisos anteriores), build e 6 cenários de navegador aprovados. A suíte completa Windows teve 1.248/1.258 testes aprovados; 10 falhas de fsync de diretório e execução de CLI em caminhos Windows no teste sector-news-safe. O CI Linux deve passar antes do merge.
