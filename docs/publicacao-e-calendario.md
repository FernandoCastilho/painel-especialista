# Publicação e calendário de coleta

Revisão do fluxo de publicação: 20/11/2026.

## Verificações da publicação

Em push de código e execução manual, Pages aguarda o workflow reutilizável `cotacoes-ci.yml`: lint, testes, build e os testes reais de interface existentes. Se qualquer trabalho falha, a publicação é bloqueada e a issue registra a falha. O build de produção e a validação do pacote semanal continuam no próprio job de publicação. Agendas que só atualizam dados mantêm seus testes e validações, sem repetir toda a suíte de navegador a cada hora. Antes do checkout, exigem uma execução anterior de Pages com o mesmo SHA exato, originada de push ou execução manual, concluída com sucesso e com os três trabalhos de `verify-source` aprovados. Código novo ou reprovado não pode passar pela agenda; ausência de comprovação ou falha na consulta bloqueia a publicação.

Depois do deploy, o workflow busca o marcador público com consulta sem cache e confirma o SHA, a execução e a tentativa que acabaram de publicar. Nos releases de código, em seguida roda a conferência de navegação no endereço publicado. Uma falha nessa etapa **não restaura automaticamente** a versão anterior. A issue distingue falha anterior, falha retornada pelo serviço de publicação e falha posterior ao deploy. Esta última pode deixar a nova versão no ar.

Não há rollback automático homologado: não existe neste fluxo um artefato anterior fixado e validado para restauração. Para recuperar, conferir a execução e a versão publicada, reverter no ramo de publicação para um estado comprovadamente válido e rodar novamente todas as verificações. Reexecutar apenas o job de deploy de uma execução antiga não valida código novo.

## Release de código e coleta

- O Pages aceita somente o ramo canônico `claude/obsidian-plugin-analysis-bagjz3`. Todo push nesse ramo, inclusive só de documentação, testa e publica o SHA correspondente. PRs também rodam o CI sem filtro de arquivos, mas não publicam. Hermes, Cloud e notebook seguem a mesma sequência quando enviam ao mesmo fluxo GitHub.
- Push ou disparo manual normal publica o código após o CI, sem recolher as fontes. Sob o lock de Pages, valida e preserva o conjunto completo de dados coletados que já está no site (inclusive CSV, manchetes acumuladas de câmbio e notícias do mapa). Compara o hash de cada arquivo com o pacote compilado. Arquivo ausente, inválido ou alterado interrompe a publicação. Conteúdo editorial do Git não é sobrescrito; a coleta externa no ramo `data` segue separada.
- O cron hourly, Trends e Focus conserva as rotinas atuais. O cron só republica o SHA já aprovado que o Pages identifica como ativo. A fila única não substitui outro deploy pendente; a ponta do ramo é conferida sob o lock e novamente antes de publicar.
- Para recuperar dados, dispare manualmente o workflow do **ramo atual de publicação** com `refresh_data=true`. Continua exigindo CI e mantém o procedimento anterior de coleta sob o mesmo lock. O modo normal é preservar. O vigia automático do Focus envia `focus_retry=true` para manter a coleta de recuperação, sem consultar novamente o IBGE CBS.
- O snapshot IBGE CBS validado acompanha o release como dados públicos agregados e é preservado no próximo build; mudança explícita do arquivo versionado pode substituí-lo. No primeiro rollout, sem marcador anterior (HTTP 404), usa o snapshot versionado. Depois disso, arquivo ausente ou incompatível não é substituído silenciosamente. Antes do primeiro rollout, compare o snapshot versionado com o dado efetivo exibido.
- Para voltar ao código anterior, faça uma reversão no ramo atual e passe pelo CI. Não publique um SHA antigo por uma reexecução; a proteção de SHA recusa código obsoleto.

## Calendário B3

Fonte primária de 2026: [calendário oficial da B3](https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm), publicado em 09/01/2026; a coleta usa a errata oficial de 2026 indicada em `B3_CALENDAR_SOURCE`, em `cotacoes/scripts/data-schedules.mjs`.

[Ofício B3 057/2026-VNC](https://www.b3.com.br/data/files/30/44/54/98/ECAE1A108E6A2C1AAC094EA8/OC%20057-2026-VNC%20CALENDARIO%20DE%20FERIADOS%20EM%202027%20E%20FUNCIONAMENTO%20DA%20B3%20EM%2010022027%20QUARTAFEIRA%20DE%20CINZAS_PT.pdf) confirma 2027. A cobertura de pregão termina em 31/12/2027. A Quarta-feira de Cinzas tem sessão de derivativos listados a partir das 13h de Brasília, sem aplicar esse horário a Treasury ou câmbio à vista. 24 e 31/12 não têm pregão listado, mas têm expediente reduzido para o Balcão sem contraparte central (13h; alocação até 13h30). Registro, compensação, liquidação e calendário contratual são escopos distintos.

**Lembrete automático (10/11/2026).** A 60 dias ou menos do fim da cobertura, a rotina existente abre uma pendência e avisa o Teams. Atualizar somente a coleta de curvas e a visão B3 em Feriados, com fonte oficial e testes. Nunca copiar para cálculos contratuais. Nenhum gatilho ou destinatário mudou. Em ano de pregão ainda não verificado, a coleta de curvas B3 retém a última referência e mostra pendência.

## Leitura do dado já publicado (revisão de 10/11/2026)

Vários coletores leem o arquivo que já está no ar para completar o que a fonte não entregou. Essa leitura (`cotacoes/scripts/prev-lib.mjs`) agora:

- tenta 3 vezes, com espera de 2 s e depois 4 s;
- separa "não existe" (resposta 404, primeira publicação) de "não consegui ler" (rede, tempo esgotado, erro do servidor, resposta vazia ou arquivo inválido).

Em três arquivos o dado anterior só existe no site publicado e não pode ser refeito na hora: `macro.json` (Focus), `focus-history.json` (52 semanas) e `curves.json` (curvas da B3). Neles, "não consegui ler" **interrompe a coleta**. Como esses passos não continuam em caso de erro, a rodada inteira falha antes de montar o site, nada novo é publicado e o que está no ar fica exatamente como está. A rodada seguinte (uma hora depois) tenta de novo. É o mesmo padrão já usado quando CDI/Selic não chegam ou quando o histórico das curvas não pode ser lido.

Por que a rodada inteira e não só o arquivo: o site é montado do zero a cada rodada e esses três arquivos não estão no git. Se só o passo falhasse e a publicação seguisse, o arquivo sumiria do site, e na rodada seguinte seria tratado como "não existe".

Efeitos esperados: uma rodada com falha abre (ou comenta) a pendência "Deploy da página de cotações falhou"; três seguidas abrem a de falhas seguidas. Os demais coletores continuam como antes (seguem sem o dado anterior), só que agora com 3 tentativas.

Saída de emergência: se um arquivo publicado ficar inválido de forma permanente (a leitura falharia para sempre), crie a variável do repositório `PREV_IGNORAR_ILEGIVEL` com valor `true`, rode a publicação e apague a variável em seguida. Com ela, a leitura falha volta a ser tratada como "não existe".

## Avisos ao dono (revisão de 10/11/2026)

Todo aviso tem duas pontas: uma pendência (issue) no GitHub e uma mensagem no Teams. A mensagem no Teams depende do segredo `TEAMS_WEBHOOK_URL`.

**O envio ao Teams não falha mais em silêncio.** Se o segredo não estiver configurado, se o Teams responder com erro ou se a rede falhar, a execução registra um aviso amarelo ("Aviso ao Teams NÃO enviado: ...") com o motivo. A rotina não cai por isso e o endereço do segredo nunca aparece no registro. A pendência no GitHub continua sendo aberta normalmente.

**Teste de alerta.** Em Actions, abra "Alerta de coleta com falhas seguidas" e clique em "Run workflow". A rotina envia ao Teams uma mensagem que começa com "TESTE de alerta do PEME" e escreve no resumo da execução:

- "CHEGOU": o Teams aceitou a mensagem. Confira no canal se ela aparece (a rotina só enxerga o aceite, não a tela do Teams).
- "NÃO CHEGOU": com o motivo. Nesse caso a execução termina em vermelho.

O teste não abre pendência e não mexe em nenhuma coleta. Vale repetir sempre que o segredo ou o canal mudar.

## Cotação parada no pregão (revisão de 10/11/2026)

A coleta de cotações (`quotes.yml`) nunca termina em falha por causa da fonte: ela guarda a última cotação válida e segue. Por isso o alerta de "3 falhas seguidas" não serve para ela, e a validação de hora em hora só reclamava depois de 6 horas.

Agora o vigia das cotações (`quotes-watch.yml`, que já roda de 15 em 15 minutos no pregão e ao fim de cada coleta ou publicação) também avisa o dono:

- **Quando avisa:** de segunda a sexta, das 9h30 às 18h de Brasília, fora dos feriados do calendário da B3, se (a) a coleta não publica nada novo há 30 minutos ou mais, ou (b) dólar, euro ou iene estão retidos pela régua de segurança há 30 minutos ou mais. O tempo só conta a partir das 9h30: o primeiro aviso possível do dia é às 10h.
- **Como avisa:** abre a pendência "Cotações paradas no pregão" e manda mensagem no Teams. Enquanto a pendência estiver aberta, as rodadas seguintes não abrem outra nem comentam. Ela fecha sozinha quando a cotação volta a atualizar.
- **Quando não avisa:** fora do pregão, no fim de semana, em feriado da B3 e quando o próprio vigia não consegue ler a data da última coleta (nesse caso ele só tenta religar a coleta, como antes).

Nada mudou na régua de segurança das cotações nem no limite de 10 minutos mostrado na tela. A regra está em `quotesAlertDecision`, em `cotacoes/scripts/quotes-watch.mjs`. Em ano sem calendário da B3 conferido (2028 em diante, até o calendário entrar), o aviso considera todo dia de semana como dia de pregão.

**Leitura dos dados anteriores na coleta.** A cada rodada a coleta publica a branch `data` inteira de novo. Antes, uma falha de rede ao consultar essa branch era tratada como "a branch não existe", e o intradiário de 5 dias podia recomeçar do zero. Agora a coleta separa os dois casos: branch inexistente é a primeira publicação e segue normal; branch que existe mas não pôde ser lida (3 tentativas) faz a rodada **não coletar nem publicar**, com aviso no registro, e a rodada seguinte (5 minutos depois, no pregão) tenta de novo.

## Fila de publicação (18/11/2026)
O que acontecia: a fila valia para a execução inteira de Pages e o GitHub guarda só uma execução em espera por fila. Uma
publicação de código (push) que esperava atrás da atualização de hora em hora era trocada pela agenda seguinte e
cancelada. Essa agenda e as próximas falhavam em "Exigir código já aprovado nas agendas de dados", porque o código novo
não tinha publicação aprovada, e os dados deixavam de ser atualizados até alguém repetir a publicação cancelada (17/11,
execuções 644 e 645; 18/11, execuções 678 e 679).

Como fica:
- A fila (`concurrency: pages`, com `queue: max` e sem cancelamento de trabalho em execução) vale só para o job `deploy`.
  Os testes de código correm sem esperar.
- A agenda que encontra push ou disparo manual de Pages em andamento, inclusive a recuperação do Focus, encerra sem entrar
  na fila. Não houve coleta naquele disparo. Um release de código normal preserva dados; não repõe a coleta perdida.
- Uma agenda posterior pode coletar quando o SHA canônico atual estiver aprovado, publicado e identificado no marcador.
  Se a publicação de código falhar, a agenda segue bloqueada até uma publicação aprovada.
- Se uma agenda anterior já entrou na fila, ela só pode publicar se o SHA continuar atual e aprovado. Tanto o deploy de
  código quanto o de dados conferem a ponta do ramo sob o lock e novamente antes de publicar.
- Testes: `test/publication-gates.test.mjs` e `test/pages-release-data.test.mjs`.
