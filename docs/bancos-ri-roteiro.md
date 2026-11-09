# Roteiro: histórico de RI para BB, Caixa, Safra e BTG

Objetivo: complementar o gráfico de histórico (série tracejada) com dados dos relatórios de resultado de cada banco. Hoje só Itaú, Bradesco e Santander têm isso em `cotacoes/public/bancos-ri.json` (`banks`). BB, Caixa, Safra e BTG só têm ROE em `supplements`.

## Trimestres
4T24, 1T25, 2T25, 3T25, 4T25, 1T26, 2T26 (e 3T26, se já divulgado). Prioridade: 3T25 e 4T25, que faltam no Banco Central.

## Indicadores (os mesmos já usados para Itaú, Bradesco e Santander)
Basileia, capital principal (CET1), ROE, inadimplência total, ativos totais, lucro líquido contábil do trimestre, carteira total (critério do próprio banco).

## Regras de cada transcrição
- Um valor por indicador e trimestre, vindo do relatório de resultados ou release do próprio banco (central de resultados do RI).
- Anotar o link do documento e a página.
- Valores em reais (não em bilhões); percentuais como número (15,4 = 15,4%).
- Descrever o critério em `note` (consolidado, prudencial, gerencial etc.) e usar um mesmo `basis` por indicador em todos os trimestres do banco (ex.: `bb-ativos`).
- Lucro do trimestre isolado, não acumulado no ano.
- Indicador que o banco não divulga: deixar de fora. Não estimar.

## Onde registrar
`cotacoes/public/bancos-ri.json`, em `banks.<id>` (lista de pontos com `period`, `origin: "ri"`, `scope`, `metrics`), seguindo o formato de `banks.itau`. Depois rodar `npm test` em `cotacoes/` e atualizar `reviewedAt`.

## Páginas de partida
- BB: https://ri.bb.com.br/informacoes-financeiras/central-de-resultados/
- Caixa: https://ri.caixa.gov.br/
- Safra: https://www.safra.com.br/sobre/relacoes-com-investidores/informacoes-financeiras.htm
- BTG Pactual: https://ri.btgpactual.com/
