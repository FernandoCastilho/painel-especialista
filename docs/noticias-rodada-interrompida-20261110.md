# Notícias institucionais: rodada interrompida em 10/11/2026

## O que aconteceu
- Rodada `github-42846100438-1` (publicação do painel das 15:36 UTC) começou às 16:00:47 UTC.
- Às 16:01:20 UTC, depois de anotar a leitura de uma matéria do MAPA, a gravação seguinte no journal (`sector-news-state`) falhou com resultado incerto (`git_write_outcome_uncertain`).
- O desenho falha fechado: a marca de rodada em voo ficou gravada (revisão 3015, token `603bd042…`) e toda coleta seguinte parou com `unfinished_run_requires_authorized_review`. As notícias ficaram congeladas na publicação das 15:20 UTC.

## Decisão (Fernando, 10/11/2026)
Opção 1: encerrar a rodada com concessão exata no código, suspender só o MAPA (operação incerta) e deixar as demais fontes voltarem.

## Como foi feito
- `cotacoes/scripts/sector-news-safe/run-recovery.mjs`: uma concessão presa ao token, ao digest integral do estado, à rodada e à lista `[mapa]`. O plano recusa estado mudado, outra rodada, outras fontes, bloqueio compartilhado ou publicação pendente.
- O encerramento passa pelo `compareAndSwap` comum e pelas regras de transição existentes: nenhum bloqueio é removido; o MAPA ganha o bloqueio `operation_outcome_uncertain`, que não pode ser retirado por transição comum.
- `.github/workflows/institutional-news-recovery.yml`: manual, padrão só leitura (plano), mesma fila da coleta. Aplicar exige `apply: true`.
- Testes: `cotacoes/test/sector-news-run-recovery.test.mjs`, incluindo journal Git real relido até a raiz.

## Pendente
- MAPA fica suspenso até revisão própria (a matéria interrompida era leitura pública; o risco é baixo, mas a liberação exige decisão separada).

## Liberação de ANTT e MAPA (10/11/2026)
- ANTT parou em 09/11 às 19:26 UTC: o índice trouxe uma matéria com espaços no endereço (`...rodovirias%20-do%20-pais...`). O transporte recusa endereços com `%` **antes** de qualquer acesso, mas o runner classificou o erro como `operation_outcome_uncertain`. Correção: `extractGovArticleLinks` ignora esses links, com a mesma regra do transporte.
- `source-release.mjs`: concessão revisada que só libera bloqueios `operation_outcome_uncertain` e fica presa ao bloqueio exato de cada fonte (código e instante). Diferente da liberação de parser, não fixa o token do journal: o journal muda a cada coleta, e o que se revisa é o bloqueio em si. Se a fonte voltar a ser suspensa, o bloqueio novo tem outro instante e a concessão não vale. O registro (`sourceReleases`) fica no estado e não pode ser alterado nem reaplicado.
- `compareAndSwap` comum recusa qualquer mudança em `sourceReleases`; só a operação dedicada `applySourceRelease` grava, uma vez, com releitura.
- Workflow manual `institutional-news-source-release.yml`, padrão só leitura, na mesma fila da coleta.
