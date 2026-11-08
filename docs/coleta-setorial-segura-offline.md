# Coleta institucional — operação real e protótipo isolado

## Operação implementada em 08/11/2026

O protótipo descrito abaixo continua isolado e não foi transformado em um atalho de rede. A operação real usa `sector-news-live.mjs`, transporte fechado e o journal Git de `sector-news-safe/git-store.mjs`. O antigo CLI `fetch-sector-news.mjs` continua recusando `--live`.

- Nove fontes foram verificadas no Actions: MAPA, ANTT, MDIC, ANP, ANM, ANA, CVM, ANS e IPEN. A rodada `42486036968` confirmou 24 notícias elegíveis em 120 horas: 21 lidas na rodada e três anteriores da ANTT preservadas integralmente. IPEN teve leitura confirmada, sem item elegível na seleção. As outras nove fontes mantêm os bloqueios ou a revisão pendente.
- Estado e feed ficam nas referências próprias `sector-news-state` e `sector-news-feed`; suas raízes estão fixadas em `production-config.json`. A regra GitHub `26798792` impede exclusão e atualização sem avanço do histórico, sem exceções de atores. O token temporário não recebe administração. Como a API omite a lista de exceções para esse token, a versão `updated_at` verificada por administração também está fixada; qualquer mudança bloqueia até revisão.
- `--collect` grava e relê a intenção antes de cada acesso, respeita as suspensões e publica somente com confirmação. Lê no máximo cinco artigos por fonte por rodada, sem seguir redirecionamentos ou repetir requisições. O histórico é verificado localmente após sincronização Git, evitando uma chamada REST por registro histórico.
- `--snapshot` não consulta os sites: confere o último recibo e o digest do payload original, acrescenta a confirmação pública e substitui o arquivo local atomicamente. O digest identifica o payload original do journal, anterior aos campos públicos de confirmação. Falha não renova a data de matéria nem substitui um arquivo por um candidato não confirmado.
- Pages aprova o código antes da coleta; somente o job institucional recebe escrita. A frequência existente foi mantida. Os pacotes exclusivos de Trends/Focus preservam o snapshot. Não foi criada agenda adicional nem serviço pago.
- Uma operação interrompida ou publicação incerta permanece bloqueada para revisão. Não existe desbloqueio nem recuperação automáticos. O procedimento deve conferir a execução, a referência e o recibo antes de autorizar qualquer retomada; não apagar o journal ou recriar as raízes.

A confirmação de implantação do painel deve ser conferida no fluxo Pages; a evidência acima comprova a coleta e o feed separado. O material abaixo registra o protótipo anterior e seus controles, preservados para auditoria.

Revisão: 05/11/2026. Base: candidato setorial `2e5e8b3`.

## O que está entregue

Infraestrutura de segurança exercitável **somente com dados simulados**. Não habilita atualização contínua real. O modo padrão é `off`; `live`, `on`, funções de rede injetadas e publicadores arbitrários são recusados. Não há uso de `fetch`, sockets, comandos Git, credenciais, cron ou escrita remota nos novos módulos. O CLI existente continua recusando `--live`, e nenhum workflow legado foi alterado.

Arquivos:

- `cotacoes/scripts/sector-news-safe/state.mjs`: esquema completo, versões, cadastro fixado por hash, bloqueios por fonte/rota compartilhada e invariantes de transição.
- `cotacoes/scripts/sector-news-safe/local-state-store.mjs`: journal local de homologação, fora do checkout e da pasta do feed; revisões imutáveis encadeadas, comparação de versão, lock exclusivo, fsync e confirmação por releitura.
- `cotacoes/scripts/sector-news-safe/fixtures.mjs`: transporte e publicador fechados, exclusivamente de fixtures em memória. Não aceita callback de rede.
- `cotacoes/scripts/sector-news-safe/runner.mjs`: orquestração desligada ou simulada, persistência anterior a cada acesso simulado, interrupção imediata e publicação separada.
- `cotacoes/test/sector-news-safe.test.mjs`: testes de falha, concorrência e recuperação proibida.

Comando seguro de teste, a partir de `cotacoes`:

`node --test test/sector-news-safe.test.mjs`

O bootstrap explícito cria **apenas** um journal de simulação, nunca inicializa automaticamente estado ausente e nunca usa o feed como autorização. Todos os cadastros começam suspensos; somente fontes individualmente selecionadas pelo teste recebem aprovação sintética. Essa aprovação não é evidência de autorização operacional.

## Estado separado do feed e da branch data

O contrato identifica `refs/heads/sector-news-state` como a referência futura exclusiva de controle, e `refs/heads/sector-news-feed` como a referência futura de publicação. São **identificadores de contrato, não branches remotas criadas por esta entrega**. O journal local armazena esse identificador, mas não é um adaptador Git.

A branch `data` atual sofre force push pelo coletor de cotações. Ela não é usada para autorizar coleta, guardar suspensões, importar último sucesso ou reparar estado. O publicador do protótipo mantém um payload em memória, separado do journal. Uma falha de publicação não apaga bloqueios nem provoca recolha das fontes.

Para uso real será necessário provisionar e auditar, sob autorização separada, um serviço durável com CAS ou uma referência exclusiva com histórico protegido contra force push/rollback, retenção garantida e leitores/escritores autenticados. Nenhuma permissão de repositório, proteção de branch ou credencial foi criada/modificada.

## Ordem de segurança

1. Com modo `off`, retornar antes de ler estado ou executar transporte/publicador.
2. No modo simulado, exigir fixture registrada, estado confirmado e completo, identidade/esquema/cadastro válidos, relógio coerente e feed válido separado.
3. Se existir `run`, request pendente, publicação incerta ou lock de processo interrompido, parar. Não há expiração de lease nem roubo de lock.
4. Persistir e reler `run.in_flight` antes de qualquer acesso.
5. Para cada robots, índice ou artigo, persistir a intenção `request`, incluindo ID, fonte, URL e data; confirmar CAS e reler o mesmo estado antes do transporte.
6. Validar código HTTP, redirecionamento, tamanho, desafio, robots, licença, parsing, datas e limites. Não seguir redirecionamentos nem trocar domínio, proxy, rota ou transporte.
7. Na primeira falha, persistir a suspensão antes de qualquer outro acesso e encerrar a coleta da rodada. Se a gravação falhar ou ficar incerta, não repetir a gravação: o `in_flight` já durável bloqueia a próxima rodada.
8. Robots comum negado/indeterminado bloqueia a rota compartilhada. 401/403/429 ou desafio bloqueiam também a origem comum de forma conservadora. Outra fonte do mesmo domínio não pode ser usada para repetir o acesso negado.
9. Gerar o feed com projeção pública do estado. Gravar intenção de publicação e confirmá-la separadamente. Falha/resultado incerto conserva a barreira até revisão.

A rodada registra suas fontes planejadas. Usa no máximo uma leitura de robots por rota compartilhada, um índice e 40 artigos por fonte, 370 requests no total e dez minutos. A pausa mínima de 1,1 segundo é apenas prudência própria; nenhuma configuração representa uma autorização do site. Há uma única tentativa por operação. Mesmo falhas transitórias e mudanças de parser suspendem para revisão neste protótipo. Não há backoff que reabra fonte, retry de publicação ou mecanismo de desbloqueio automático. Uma operação incerta nunca é tratada como não executada.

## Bloqueios históricos

Permanecem suspensos Anvisa (desafio detectado, natureza não confirmada), IBGE (403 na licença), Anatel e MEC (desafio), e MTur (resultado de operação complementar anterior não confirmado). A classificação preserva a diferença entre negação do site e resultado incerto no executor. ANEEL e Susep também ficam em revisão de parser, sem simulação de aprovação automática. Fontes sem homologação, como BCB, também não são selecionáveis automaticamente.

Nem o bootstrap de simulação nem a lista de fontes solicitadas conseguem remover esses bloqueios. Transições rejeitam a remoção de qualquer bloqueio de fonte ou rota compartilhada. **Não foi implementada interface de revisão/desbloqueio.** Uma futura retomada exige evidência de autorização, revisão específica da fonte/rota e nova auditoria do procedimento; mudar o feed não serve para isso.

## Datas e cobertura

- `publishedAt` da matéria: publicação original, preservada. A revalidação nunca troca por atualização da página.
- `collectedAt`: término da leitura/parsing daquela matéria.
- `checkedAt`: início da tentativa da fonte; não é prova de sucesso.
- `lastCollectedAt` / `lastSuccessAt`: última matéria cuja leitura e estrutura foram verificadas. Uma falha posterior não renova nem apaga essas datas. Matéria antiga pode comprovar leitura bem-sucedida, mas continua excluída da janela pública.
- `feed.generatedAt`: geração do candidato.
- `feed.publishedAt` / `receipt`: somente a confirmação da publicação do candidato. Ficam nulos enquanto a nova publicação está preparada/incerta.
- `feed.lastPublication`: confirmação anterior preservada separadamente, com data, digest e recibo; não é reutilizada como data de publicação de um candidato novo.

O payload público inclui `delivery.publishedAt: null` porque a confirmação de sua própria publicação ainda não ocorreu quando ele é gerado. A confirmação posterior fica no estado durável e no resultado da operação, sem reescrever o payload para fingir atomicidade entre dois armazenamentos.

O filtro público mantém 120 horas móveis, fonte/licença, precisão de data, relevância e deduplicação existentes. Falhas preservam apenas matérias anteriores ainda válidas. Não há mínimo artificial de notícias ou alegação de cobertura completa. Fixtures não são copiadas para `public/sector-news.json`.

## Concorrência, crash e integridade

O journal local cria lock exclusivo antes de escrever. Não espera nem rouba lock. Escrita com token desatualizado é rejeitada e o lock é retido para revisão. Cada revisão é gravada com exclusividade e fsync; só depois o HEAD é substituído atomicamente e o diretório sincronizado. A liberação do lock também exige sincronização. O runner exige confirmação do adaptador **e** releitura correspondente.

Leituras verificam raiz fixada, identidade, hash, sequência completa de versões, monotonicidade e invariantes em todo o histórico. Revisão ausente, órfã, adulterada, HEAD malformado, arquivo temporário, rollback de HEAD com revisões posteriores ainda presentes ou lock residual falham fechados. Estado que não pode ser lido não vira objeto vazio. Testes incluem encerramento de processo após commit de `in_flight` e antes do acesso.

**Limite de confiança importante:** o journal local não é defesa contra alguém que controla/restaura coerentemente todo o diretório. Restaurar HEAD antigo e apagar todas as revisões posteriores pode parecer uma história antiga válida. A raiz fixada autentica a gênese, não fornece uma âncora monotônica independente. Um backend operacional terá de impedir esse rollback ou usar high-water mark independente e autenticado. O protótipo não pode ser homologado para rede real enquanto essa garantia estiver ausente.

O teste concorrente com armazenamento simulado demonstra exclusão por CAS, não a conclusão automática de um vencedor no journal local. Neste adaptador conservador, um perdedor com versão antiga pode adquirir o lock depois do primeiro commit do vencedor e conservá-lo ao detectar conflito; isso pode interromper também o vencedor. Ambos ficam fechados para revisão, sem nova requisição. Disponibilidade/liveness de produção não está certificada.

O lock/CAS locais foram testados em filesystem local. Não foram certificados comportamento de NFS, perda física de disco, corrupção maliciosa, disponibilidade de CI, replicação entre regiões ou segurança de um serviço remoto. fsync é uma condição necessária aqui, não prova universal de durabilidade.

## Limites ainda abertos antes de qualquer ativação

- Backend remoto durável, concorrência distribuída, monotonicidade externa/antirollback e permissões mínimas.
- Aprovação específica do bootstrap real, inventário dos estados históricos e procedimento de revisão/recuperação que não contorne negativas.
- Adaptador real de transporte, com avaliação de robots/licenças/limites por fonte e testes próprios de timeout, cancelamento e limites de bytes em streaming.
- Publicador real separado, resultado verificável/recibo e reconciliação autorizada de publicação incerta.
- Agenda própria aprovada; nenhum workflow existente deve começar a chamar a biblioteca legada de coleta como atalho.
- Auditoria final e validação ponta a ponta do exato candidato antes de publicar ou ativar.

A aprovação dos testes desta entrega valida o protótipo **desligado**, não autoriza acesso a fontes ou publicação real.


## Revisão operacional de 08/11/2026

O painel agora informa expressamente que a atualização institucional automática está desativada. A revalidação local não é uma nova consulta: não renova `checkedAt`, `lastSuccessAt` nem a data de publicação. A elegibilidade no cadastro de fontes também não significa operação em produção.

A ativação continua bloqueada pelos requisitos desta nota: armazenamento remoto durável com controle de versão e proteção contra retorno a estado antigo, transporte/publicador reais homologados e revisão explícita dos bloqueios históricos de acesso. Não houve novas tentativas a fontes suspensas nem alteração de suas permissões. Os demais coletores de notícias são independentes desta seleção institucional.
