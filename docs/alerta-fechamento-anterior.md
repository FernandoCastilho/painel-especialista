# Alerta de câmbio: fechamento anterior

Decisão de 07/11/2026: USD e EUR usam fechamento anterior, em vez da primeira amostra após 9h. Alteração isolada, sem mudar coletores, fontes, permissões, persistência ou notificações de outras áreas.

## Referência

- O disparo usa `quote.pct` (`pctChange` da AwesomeAPI), exatamente o percentual do Δ dia da tabela. A base exibida é `bid - varBid`, da mesma resposta e do mesmo par.
- A base deve ser positiva/finita e a variação calculada por `varBid / base * 100` precisa concordar com `pctChange` em até 0,005 ponto percentual (arredondamento a duas casas). Dados ausentes ou incoerentes não disparam. Não substitui por PTAX, BCE, primeira amostra intraday ou histórico diário potencialmente incompleto.
- O fechamento de referência é o anterior fornecido para a observação, inclusive depois de fins de semana/feriados. Não é exigido um registro no dia civil imediatamente anterior. Como a resposta não data essa base separadamente, a interface não inventa uma data/hora para ela.
- Permanece estritamente acima de ±0,30%, início às 9h de Brasília e cotação válida do dia com até dez minutos de idade. A primeira cotação observada já pode disparar. Persistem um alerta por moeda/sentido/dia, dispensa por “Ok” e gravação de entrega só após aceitação pela API do navegador. Estado salvo anteriormente não é apagado nem renotificado por mudança de regra.
- Não há monitoramento contínuo com o app fechado. Não houve pedido real de permissão nem envio de notificação real nos testes.

## Evidência da fonte

Documentação oficial: https://docs.awesomeapi.com.br/api-de-moedas (consultada em 07/11/2026). Identifica os campos `bid`, `varBid`, `pctChange` e o endpoint diário como fechamento. O endpoint `last` não fornece data do fechamento base.

Conferência nos arquivos públicos da branch `data`, consultados em 07/11/2026:

- USD, observação 06/11 19:04:49 BRT: bid 5,5030, varBid −0,0008, pctChange −0,014534%. Base 5,5038, igual ao registro diário de 05/11.
- EUR, observação 06/11 19:14:30 BRT: bid 6,1303, varBid −0,0486, pctChange −0,786544%. Base 6,1789, igual ao registro diário de 05/11.

Esta conferência valida a compatibilidade da referência nos dois registros observados, não certifica todas as observações futuras nem transforma a cotação do fornecedor em fixing oficial ou preço de execução.

## Verificação

Testes focados: `node --test test/alerta-variacao.test.mjs test/alerta-notificacao.test.mjs test/quote-freshness.test.mjs`. Incluem limiar exato, dois sentidos, USD/EUR independentes, primeira observação, abertura, segunda/pós-feriado, virada de Brasília, dados faltantes/incoerentes/retidos/antigos/futuros e fluxo completo de permissões/dispensa/retry.

O smoke existente usa fixtures sintéticas e mantém a primeira amostra intraday igual ao preço atual: só o fechamento anterior pode produzir o alerta esperado. Verifica texto, permissão tardia/externa, falha/retry, dispensa/reload, deduplicação e ausência de overflow em 390/1280 px. Requer build servido conforme `cotacoes/TESTING.md`.

Validação local: 1.268 testes passaram, lint sem erros (cinco avisos preexistentes) e build aprovado. Tentativa de smoke local bloqueada no lançamento do Chromium por restrição de sockets, sem acesso a página e sem capturas. O smoke do CI e a revisão de suas capturas permanecem pendentes.

Merge/deploy dependem da sequência coordenada e do CI do candidato integrado final.

## Candidato integrado após #300 e #312

Base `eedf6005e7c43c780ba2a9a5715fee238ea709dc`. Sincronização sem alteração adicional da lógica do alerta; índice de busca regenerado a partir de todos os fontes integrados. Passaram 1.281 testes, lint sem erros (cinco avisos preexistentes), build e preservação dos 37 arquivos semanais. O CI inicial do head `0ed2095` passou integralmente: https://github.com/FernandoCastilho/painel-especialista/actions/runs/42369143538. Esse resultado anterior não substitui CI, capturas e aprovação do Auditor no novo candidato integrado.


## Correção pedida pelo Auditor

O Auditor reproduziu uma cotação inicialmente válida com 9m59s enviada após envelhecer para 10m01s na autorização tardia. O cálculo não fica mais congelado no memo: cada tentativa revalida idade/dia e a cotação mais recente; o callback é novamente consultado depois de aguardar o registro do service worker, imediatamente antes de chamar a API de envio. Alertas expirados ou do dia anterior não são marcados como entregues. Reversão, dispensa e desmontagem também cancelam um despacho que ainda não começou. Uma chamada já aceita/iniciada pelo sistema não pode ser cancelada por esta guarda.

Regressões adicionadas: autorização posterior, diálogo de permissão demorado, liberação externa, retry, espera pelo registro com e sem service worker, atualização/reversão/dispensa durante a espera e virada de Brasília. O smoke de 390/1280 px também atravessa o limite de dez minutos antes de autorizar e antes de retry.

Validação local da correção: 1.288 testes passaram, lint sem erros (cinco avisos preexistentes), build e preservação dos 37 arquivos semanais aprovados. CI e parecer formal precisam ser renovados para o novo SHA; os resultados anteriores não liberam este candidato.

## Sincronização após #318

Base publicada `5ef302b84fcb4f0f752696dd02832d328cf63d6f`. Incorpora a correção de notificações da curadoria, sem alterar os arquivos de lógica, entrega, testes e smoke do alerta já aprovados no head `2ba1b61`. O candidato combinado passou 1.300 testes, lint sem erros (cinco avisos preexistentes), build e preservação dos 37 arquivos semanais. Exige CI integral e revisão do delta pelo Auditor para o novo SHA antes da integração.
