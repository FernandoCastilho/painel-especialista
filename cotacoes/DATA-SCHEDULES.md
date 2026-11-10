# Agendamentos de dados — escopo e evidências

Base: produção PR148, 7dd0155. PR149/UI não foi alterada. Sem dispatch, merge ou deploy nesta revisão.

## DI / B3
O workflow pages.yml já possui agenda horária: 17 3-23 * * 1-5 e 17 0-2 * * 2-6. Em UTC-3 isso cobre segunda a sexta, 00:17–23:17 Brasília. Não foi criado outro cron DI. Cron GitHub Actions é best effort: atraso, supressão por fila e concorrência não equivalem a atualização pontual garantida.

A PRE é curva de DI x pré baseada em preços de ajuste e publicação diária, não feed DI intradiário. Fonte oficial: https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/consultas/mercado-de-derivativos/precos-referenciais/taxas-referenciais-bm-fbovespa/ ; manual https://www.b3.com.br/data/files/F3/42/AE/8C/1942B9105B12E5A9AC094EA8/Manual%20de%20Curvas_V21.pdf . Consulta horária procura nova referência diária, sem mudar sourceDate/checkedAt do dado retido ou fórmulas252/fatores. Não foi comprovado horário fixo de publicação do arquivo diário.

Calendário usado: Ofício041/2026-VNC,30/06/2026, Anexo1, QuadroA e seção1.1, incluindo24/12e31/12. https://www.b3.com.br/data/files/20/57/01/AA/06A1F910ADC36BE9AC094EA8/OC%20041-2026-VNC%20ERRATA%20-%20CALENDARIO%20DE%20FERIADOS%20EM%202026_PT.pdf . 09/07 funciona normalmente; feriados EUA e suspensões CSD2 não são feriados de DI listado. Quarta de Cinzas é dia com sessão especial, não fechamento integral. O filtro é por dia, não certifica mercado aberto a cada hora. A B3 pode retificar o calendário. Ano não verificado, como2027, impede novas consultas B3 e preserva dado com pendência: exige atualização documental, sem gerar feriados por inferência.

Deduplicação por data/hora America/Sao_Paulo e último checkedAt concluído; falha sem consulta concluída pode ser tentada na próxima execução. Feriados/fim de semana preservam referência anterior e avisos anteriores. Brasil e cupom mantêm o coletor/paginação/validação existentes. Treasuries continuam separados.

Leitura real27/10/2026 00:56:10UTC: GetDate PRE retornou20datas; mais recente26/10. GetList 00:56:56UTC: page1/3,283registros totais, primeirovértice1DU taxa13,65%, último da página294DU taxa14,82%. Apenas leitura diagnóstica; não substitui validação das três páginas nem comprova cadência horária em produção. Endpoint existente referenceRatesProxy/Search. Nenhum acesso/chave adicional foi solicitado.

## Cenários / Focus
Única agenda nova:30 12 * * 1 = segunda09:30 America/Sao_Paulo. Reutiliza o workflow Pages e seu grupo de concorrência, com cancel-in-progress:false para aguardar a publicação ativa em vez de cancelá-la; esta ramificação pula os oito coletores usuais e executa refresh-scenarios.mjs. A coleta horária macro deixa de consultar Focus; preserva o Focus publicado sem marcar falha apenas por ter sido uma consulta programadamente pulada. Push/manual explícitos mantêm a coleta existente. Sem cron/automação de chat ou nova infraestrutura.

O refresh semanal recupera macro,curves,news,feriados,oil,commodities,freight,policy-rates publicados. Se algum não puder ser preservado, aborta publicação semanal inteira. Isso evita reverter dados correntes para snapshots do Git. Só Focus é alterado. generatedAt geral e datas das outras séries não são avançados; focusCheckedAt é consulta real separada da data da pesquisa Data. Quatro indicadores completos/mesma data/números finitos são exigidos; resposta incompleta/falha preserva todo Focus anterior e registra pendência. Mesmos valores/datas não viram uma nova publicação. Nenhuma data de divulgação é calculada como se comprovada.

BCB: https://www.bcb.gov.br/controleinflacao/relatoriofocus informa divulgação semanal entre08:25–08:30. Endpoint público Olinda ExpectativasMercadoAnuais, mesmos indicadores/baseCalculo0 usados atualmente. Segunda feriado ainda tenta consultar: o calendário B3 não determina publicação BCB. Ausência de nova publicação mantém data anterior, sem deslocar automaticamente para terça. Execução e conclusão exatamente09:30 não são garantidas. Para SLA estrito seria necessário scheduler/hosting externo com monitoramento; não foi criado/contratado.

## Projeções bancárias manuais — NÃO automatizadas
Arquivo cenarios.json: ItaúBBA25/09/2026, Bradesco18/09/2026, Santander25/09/2026, BB16/10/2026, BTG19/10/2026. São datas existentes, não nova verificação do conteúdo nesta revisão. URLs e valores permaneceram íntegros. Itaú/Bradesco apontam páginas de projeções; Santander eBTG PDFs datados; BB PDF emURL estável. Não há parser implementado para verificar novos números de cada banco. O job semanal não renomeia datas nem revisa reviewedAt desses bancos.

Proposta concreta para etapa bancária: registrar URL oficial, hash do conteúdo, ETag/Last-Modified quando fornecidos, checkedAt e candidato novo em arquivo de auditoria. Mudança de hash indica revisão pendente, não projeção nova; para páginas de índice, descobrir linksPDF pelo domínio oficial e comparar identidade. Parser/fixture específico por banco/indicador/ano/unidade, verificando data impressa, antes de qualquer substituição. Até essa verificação manter valores e datas anteriores. Não requer compra/chave conhecida; requer implementar e validar os cinco formatos oficiais e suas condições de reprodução. Não prometer atualização automática integral só por consultar Focus.

## Verificação / limites
Testes cobrem horários SãoPaulo, viradaUTC, feriados nacionais/B3,09/07eferiadoEUA não fechados,2027failclosed, hora repetida, cron único, preservação do Focus/checagem/estado, erros503/vazio/incompleto/datas divergentes/NaN, resposta determinística. Build executado. Workflow não foi despachado; primeira execução em produção e cobertura de um pregão ainda não comprovadas. PR em draft; aprovação/publicação separadas.

Leitura real Focus27/10/2026 00:59:52UTC: quatro indicadores(Selic,IPCA,PIB,Câmbio),Data23/10/2026,anos2026–2030. Sem escrita/publicação. Validação final local:215testes ebuild; inclui120horários úteis semanais distintos no cronUTC e manutenção da execução ativa na concorrência. Credenciais/permissões do workflow permanecem iguais.

## Validação automática dos dados publicados

`scripts/validate-data.mjs` roda a cada deploy (após a coleta, sem falhar o deploy) sobre `quotes.json`, `history.json` e `intraday.json` da branch `data` e a PTAX recém-coletada. Regras em `scripts/validate-lib.mjs`:

- **quotes:** quatro pares presentes; campos positivos; compra ≤ venda; cotação dentro de máxima/mínima; `varBid` coerente com `pctChange`; CNH cruzado plausível e com as duas pontas a até 1 h entre si; EUR/USD implícito entre 0,8 e 1,6; coleta com menos de 6 h.
- **PTAX:** USD, EUR e JPY ao vivo a até 3% da PTAX publicada.
- **history/intraday:** mínimo de pontos, último ponto recente, valores plausíveis por moeda, ordem cronológica e saltos (12% entre diários; 6% entre amostras a até 30 min; 12% após pausas maiores).

Qualquer achado abre (ou comenta) a issue "Dados da página de cotações com problema de validação" e avisa o Teams, se configurado; ao normalizar, a issue é fechada.

Revisão de 10/11/2026: o limite de 6 h acima continua valendo na validação de hora em hora, mas a cotação parada no pregão agora gera aviso próprio em cerca de 30 minutos (vigia das cotações). O envio ao Teams registra aviso quando não chega, há um teste manual de alerta e um lembrete do fim do calendário da B3. Detalhes em `docs/publicacao-e-calendario.md`.
