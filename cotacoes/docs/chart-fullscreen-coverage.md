# Maximização de gráficos

## Cobertura de implementação (verificável por import/uso de ChartFullscreen)

| Componente | Conteúdo maximizado |
|---|---|
| ChartComparison | Comparação principal; modo compact continua miniatura clicável |
| HistoryChart | Área plot inteira, SVG e tooltip |
| Curves | Área plot inteira, SVG e tooltip |
| Apresentacao | SVG de apresentação |
| BankMetricHistory | Histórico de indicadores bancários |
| BndesLcdCap, BndesPresentation | Gráficos de LCD/BNDES |
| CbsAnnualScenario, CbsOverview | Gráficos CBS |
| CreditComparison | Comparação de crédito |
| Faturamento | Evolução de faturamento |
| GoogleTrends | SVG e iframe de tendências |
| HBars | Barras horizontais reutilizadas nas seções |
| MarketPopup | Gráfico no popup de mercado |
| RecoveryHistoryPanel | Artigos completos do mapa e ranking, incluindo instruções, seleção e tooltip |
| ResearchedSectorStudy, SectorStudy | Gráficos setoriais |

Miniaturas dentro de botões não recebem botão aninhado. Abrem o gráfico detalhado, que possui maximização. Ícones SVG e diagramas não quantitativos não são gráficos de dados.

## QA em navegador real, 17/11/2026

Fixture local React com o componente real e seu CSS, gráfico SVG selecionável, contador de estado, iframe navegável e dialog pai. Navegador Chrome da nuvem, sem sessão do usuário.

- Maximizar/restaurar: conteúdo e contador React preservados em aberturas repetidas.
- Escape em seleção: primeiro limpa a seleção; segundo fecha maximização.
- Foco inicial no botão Restaurar; ao fechar volta a Maximizar.
- Tab entra no botão interno do iframe e retorna ao fluxo do dialog; controles do fundo não ficam disponíveis na árvore acessível.
- Dialog aninhado: Escape fecha apenas gráfico maximizado, preservando dialog pai.
- Troca de hash fecha gráfico e restaura foco.
- CSS: retângulo do dialog coincide com viewport (2360 × 1514, origem 0,0).

O teste unitário de ciclo de vida verifica host estável, cleanup, scroll, cancel e ausência de captura global de Escape. Não substitui o QA de navegador acima.

## Limitações explícitas

A fixture não constitui inspeção visual de todas as rotas reais. Smoke integrado do mapa e ranking realizado abaixo. Iframe pode recarregar ao mover seu nó; preservação do estado refere-se aos componentes React. Maximização ocupa a janela do navegador, não oculta a interface do navegador.

### Reproduzir o QA

Fixture versionada: `test/fixtures/chart-fullscreen.jsx`. Gerar um bundle com esbuild (`--bundle --jsx=automatic`), servir uma página com `<div id="root"></div>`, o bundle e seu CSS. Executar os passos acima em navegador real. Não usa serviços ou dados externos.

## Smoke integrado após celulose

Base exata `301e9e97c633b01b53b974fb6d4c18d1cacd93f5`; patch aplicado sem conflito. Build real local, dados versionados, rota `#cenarios/recuperacao`.

- Mapa real maximizado mostra instruções, tooltip, seletor UF e fonte.
- Viewport 390 × 844 em iframe local: mapa e tooltip legíveis, sem corte horizontal; botão Restaurar visível. Não é emulação de dispositivo físico.
- Ranking real maximizado: textos quebram corretamente, barras e valores legíveis, rolagem vertical disponível.
- Encontrada e corrigida interação Escape do mapa: handler local consome Escape com tooltip aberto. Verificado primeiro Escape remove tooltip mantendo dialog; segundo fecha dialog.
- Celulose preservada pela base; nenhum dado ou cálculo financeiro alterado.
