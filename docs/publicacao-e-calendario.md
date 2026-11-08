# Publicação e calendário de coleta

Revisão: 08/11/2026.

## Verificações da publicação

Em push de código e execução manual, Pages aguarda o workflow reutilizável `cotacoes-ci.yml`: lint, testes, build e os testes reais de interface existentes. Se qualquer trabalho falha, a publicação é bloqueada e a issue registra a falha. O build de produção e a validação do pacote semanal continuam no próprio job de publicação. Agendas que só atualizam dados mantêm seus testes e validações, sem repetir toda a suíte de navegador a cada hora.

A conferência no endereço publicado permanece após o deploy. Uma falha nessa etapa **não restaura automaticamente** a versão anterior. A issue distingue falha anterior, falha retornada pelo serviço de publicação e falha posterior ao deploy. Esta última pode deixar a nova versão no ar.

Não há rollback automático homologado: não existe neste fluxo um artefato anterior fixado e validado para restauração. Para recuperar, conferir a execução e a versão publicada, selecionar um commit comprovadamente válido e executar seu workflow de publicação, que também deve passar pelas verificações. Reexecutar apenas o job de deploy de uma execução antiga não valida código novo.

## Calendário B3

Fonte primária de 2026: [calendário oficial da B3](https://www.b3.com.br/pt_br/noticias/calendario-de-negociacao-da-b3-confira-o-funcionamento-da-bolsa-em-2026.htm), publicado em 09/01/2026; a coleta usa a errata oficial de 2026 indicada em `B3_CALENDAR_SOURCE`, em `cotacoes/scripts/data-schedules.mjs`.

Na revisão de 08/11/2026, não foi localizado calendário oficial de 2027 nas buscas e páginas oficiais consultadas. Filtros de ano do portal não comprovam um calendário publicado. Portanto, 2027 permanece **não verificado**: a coleta recusa esse ano e informa o motivo, em vez de inventar feriados. `b3CalendarStatus` expõe a cobertura e a fonte. A atualização de 2027 depende de localizar a publicação oficial, revisar datas e horários especiais e incluir regressões antes de liberar o ano.
