# Publicação e calendário de coleta

Revisão: 08/11/2026.

## Verificações da publicação

Em push de código e execução manual, Pages aguarda o workflow reutilizável `cotacoes-ci.yml`: lint, testes, build e os testes reais de interface existentes. Se qualquer trabalho falha, a publicação é bloqueada e a issue registra a falha. O build de produção e a validação do pacote semanal continuam no próprio job de publicação. Agendas que só atualizam dados mantêm seus testes e validações, sem repetir toda a suíte de navegador a cada hora. Antes do checkout, exigem uma execução anterior de Pages com o mesmo SHA exato, originada de push ou execução manual, concluída com sucesso e com os três trabalhos de `verify-source` aprovados. Código novo ou reprovado não pode passar pela agenda; ausência de comprovação ou falha na consulta bloqueia a publicação.

A conferência no endereço publicado permanece após o deploy. Uma falha nessa etapa **não restaura automaticamente** a versão anterior. A issue distingue falha anterior, falha retornada pelo serviço de publicação e falha posterior ao deploy. Esta última pode deixar a nova versão no ar.

Não há rollback automático homologado: não existe neste fluxo um artefato anterior fixado e validado para restauração. Para recuperar, conferir a execução e a versão publicada, selecionar um commit comprovadamente válido e executar seu workflow de publicação, que também deve passar pelas verificações. Reexecutar apenas o job de deploy de uma execução antiga não valida código novo.

## Calendário B3

Fonte primária de 2026: [calendário oficial da B3](https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm), publicado em 09/01/2026; a coleta usa a errata oficial de 2026 indicada em `B3_CALENDAR_SOURCE`, em `cotacoes/scripts/data-schedules.mjs`.

Na revisão de 08/11/2026, não foi localizado calendário oficial de 2027 nas buscas e páginas oficiais consultadas. Filtros de ano do portal não comprovam um calendário publicado. Portanto, 2027 permanece **não verificado**: a coleta recusa esse ano e informa o motivo, em vez de inventar feriados. `b3CalendarStatus` expõe a cobertura e a fonte. A atualização de 2027 depende de localizar a publicação oficial, revisar datas e horários especiais e incluir regressões antes de liberar o ano.

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

**Teste de alerta.** Em Actions, abra "Alerta de coleta com falhas seguidas" e clique em "Run workflow". A rotina envia ao Teams uma mensagem que começa com "TESTE de alerta do Painel do Especialista" e escreve no resumo da execução:

- "CHEGOU": o Teams aceitou a mensagem. Confira no canal se ela aparece (a rotina só enxerga o aceite, não a tela do Teams).
- "NÃO CHEGOU": com o motivo. Nesse caso a execução termina em vermelho.

O teste não abre pendência e não mexe em nenhuma coleta. Vale repetir sempre que o segredo ou o canal mudar.
