# ANEEL e Susep: revisão e procedimento de liberação proposto

Estado: adaptador construído; fontes continuam suspensas. Este documento não executa nem concede liberação.

## Evidência técnica em 08/11/2026

Os índices oficiais responderam 200 com licença CC BY-ND 3.0. Usam `customSearch` no cliente Plone; o HTML inicial não contém os resultados carregados. A consulta GET `@querystring-search` através de `++api++` foi identificada no JavaScript público do próprio portal. A consulta final construída por `ploneDiscoveryUrl` (primeira página, `b_size=5`, `limit=5`) respondeu 200 com cinco itens para cada fonte. Nenhuma paginação foi seguida.

A descoberta retorna somente candidatos com título e URL. Datas, licença e elegibilidade vêm da leitura posterior do artigo original. Um artigo de cada fonte foi lido com sucesso: ANEEL, “Usinas eólicas lideram expansão da matriz elétrica em outubro”, publicação 06/11/2026 19:57:21 UTC; Susep, “Susep divulga Estratégia Nacional de Educação Securitária e Previdenciária”, publicação 06/11/2026 17:35:50 UTC. Isso não comprova uma rodada produtiva completa.

O adaptador mantém os limites de rede e journal existentes. Não altera `HISTORICAL_HOLDS`, `PRODUCTION_SOURCE_IDS`, as referências do estado/feed, raízes, credenciais ou permissões.

## Teste integrado isolado

`sector-news-plone-integration.test.mjs` copia módulos para uma pasta temporária, remove exclusivamente as duas linhas de bloqueio de parser nessa cópia e usa somente transportes/publicadores de fixtures fechadas. A substituição representa um estado hipotético após revisão, não um desbloqueio autorizado. O checkout, o journal real e as demais suspensões não são modificados. O teste percorre o runner real nessa cópia: robots, índice/licença, descoberta, artigos, intenção/escrita/releitura anteriores a cada acesso e publicação confirmada fictícia. Inclui 301/403/429, desafio, JSON inválido, timeout, falha incerta de journal, publicação incerta e reinício recusado.

O teste não substitui validação do futuro mecanismo de migração, GitHub Actions ou publicação pública. O teste separado de fontes pendentes comprova que o código normal continua impedindo requests para ANEEL/Susep.

## Liberação controlada: proposta para implementação e auditoria separadas

1. Concluir auditoria do código final e dos testes, incluindo o mecanismo de migração isolado. Confirmar base atual e preservar mudanças paralelas.
2. Revisar uma transição explícita de estado exclusiva para `aneel` e `susep`, cujo único bloqueio deve ser `parser_review_required`. Não aceitar códigos de acesso, licença, robots, operação incerta ou bloqueio compartilhado. Não permitir seleção arbitrária de fontes.
3. Antes da transição, ler e validar o journal protegido até as raízes fixadas; exigir ausência de execução/request/publicação em voo e confirmar que os dois bloqueios ainda são os revisados. Fixar o hash do estado anterior e o recibo de revisão. Se o estado mudar, parar para nova revisão, nunca atualizar silenciosamente o hash esperado.
4. Produzir diff explícito: somente liberação dessas duas suspensões de parser e registro imutável da revisão, sem alterar datas de sucesso, feed, demais fontes, bloqueios compartilhados ou raízes. Implementar transição append-only compare-and-swap, com confirmação por releitura. O validador histórico deve continuar aceitando e verificando os registros anteriores. Não apagar nem recriar o journal.
5. A migração deve usar a mesma exclusão mútua do coletor para não concorrer com uma rodada. Uma falha/resultado incerto interrompe; conferir HEAD, registro e recibo antes de qualquer nova ação. Nenhuma repetição automática.
6. Somente após auditoria e transição confirmada, incluir as duas fontes na seleção de produção e executar uma rodada real no Actions. Qualquer 403/429, desafio, robots restritivo, erro de parser, timeout ou incerteza deve voltar ao estado bloqueado normal, sem contorno. Validar feed confirmado, atribuição, datas e janela móvel.
7. Rodar CI completo no commit final, confirmar deploy desse commit e conferir arquivo público/contagens reais. Não declarar 11 fontes ativas antes dessa comprovação. Se a publicação falhar, preservar o último feed confirmado e comunicar o ponto exato.

Nenhuma parte desse procedimento foi executada no estado de produção. O mecanismo de migração está implementado, mas sem concessões de produção; comando e workflow manual preparados, não publicados nem disparados.


## Mecanismo implementado, ainda fechado para produção

`parser-release.mjs` mantém `APPROVED_PARSER_RELEASES` vazio. Cada concessão futura deve fixar literalmente o token anterior, digest integral do estado, identificador da revisão, instante e a lista exata `[aneel, susep]`. Não há argumento para acrescentar concessões em produção; `createGitHubStore` rejeita essa configuração. Apenas o construtor de Git local de testes admite concessões fictícias, sem conexão externa.

`applyParserRelease` mantém exclusão mútua local durante leitura, verificação, CAS, append e releitura. Concorrentes em outros processos são resolvidos pelo CAS e pelo push sem force. Exige ausência de execução em voo e de qualquer bloqueio compartilhado. A operação comum `compareAndSwap` não pode introduzir uma concessão. O journal conserva o registro imutável da revisão, e sua verificação histórica admite somente a transição integral exata aprovada; nenhuma outra alteração acompanha a liberação. Uma fonte novamente suspensa depois dessa liberação não pode reutilizá-la para se desbloquear.

Testes usam repositórios bare locais: preservam raízes e feed, verificam leitura integral por nova conexão, disputa entre dois escritores, estado anterior alterado, bloqueios incompatíveis e perda da confirmação após append. Nesta última condição, a operação não repete e uma leitura nova reconcilia o único commit existente.

Ainda falta auditoria final da barreira/operação de manutenção e preparar a concessão final somente após estabilizar o estado real. Nenhuma concessão real foi criada e nenhum estado externo foi alterado.

## Sequência revisada com barreira de manutenção

O código da barreira está em `maintenance.mjs`/`maintenance-config.json`; a configuração neste pacote continua `enabled: false`. Quando uma alteração auditada ativá-la, `runSectorNewsProduction` retorna manutenção antes de qualquer acesso a fonte ou mutação, inclusive em chamadas diretas e via `--collect`. O consumidor continua entregando o último snapshot confirmado, sem renovar datas, e apresenta aviso explícito de manutenção. As agendas não são removidas.

A implantação deve ocorrer em etapas: (1) incorporar código/barreira após auditoria; (2) ativar barreira explicitamente e aguardar todas as execuções antigas que possam escrever terminarem; (3) ler novamente o journal protegido e só então fixar e auditar a concessão final; (4) publicar a concessão enquanto a barreira mantém o estado estável; (5) executar manutenção pelo workflow sob `institutional-news-collector`; (6) confirmar releitura e auditar retomada/seleção das duas fontes; (7) desativar barreira e verificar rodada real/publicação. Nenhum token é renovado automaticamente. Cabe ao responsável considerar a pausa temporária de atualização das nove fontes atuais antes de ativar a barreira.

`parser-release-candidate.json` registra apenas o candidato preliminar da revisão 485 observado antes da barreira. Não integra `APPROVED_PARSER_RELEASES` e não autoriza escrita. Deve ser substituído por uma nova revisão explícita depois da estabilidade comprovada; não deve ser aplicado se o HEAD mudar.

O workflow `institutional-news-release.yml` é somente manual, com planejamento padrão e permissões de leitura no planejamento. Apenas o job de aplicação tem escrita. O wrapper recusa aplicação sem concessão exata no código e exige releitura final consistente. Testes adicionais em cópias temporárias cobrem apply positivo, confirmação final divergente/incerta sem retry, bloqueio de chamada direta do coletor e aviso sem renovação de datas. Não houve dispatch ou alteração de produção.
