# CBS — impacto indicativo no caixa

## Escopo e decisões

Pedido: orientar a conversa comercial sobre o efeito da reforma no caixa e na necessidade **adicional** de capital de giro. Não é apuração tributária, proposta de crédito nem cálculo da NCG integral.

Fernando escolheu referência econômica por setor (em vez de exigir gastos do cliente) e informação dos prazos aproximados de recebimento, pagamento e estoque pelo cliente. São entradas também faturamento e regime. Gastos, condições de crédito, split, alíquotas e prazos tributários podem ser ajustados. O exemplo inicial está identificado; não representa uma empresa real.

Rota: `#calculadora/cbs-caixa`. Reutiliza React, MoneyInput, CalculatorHelp e o espaço visual das calculadoras. Sem nova dependência, servidor, banco, coleta de dados pessoais ou armazenamento do cliente. O formulário fica apenas na memória da aba. Especificação, direção e execução aplicadas pelas instruções disponíveis de Ideação, Tributário, Engenheiro de APP, Diretor de Arte e Simplificador; não houve transferência a pessoas. A revisão independente da primeira versão apontou correção no tratamento da espera por créditos com split parcial. A correção foi aplicada; a nova versão aguarda parecer final vinculado à sua nova árvore, sem aprovação presumida.

## Referência econômica e obtenção

`scripts/fetch-ibge-cbs.py` acessa a API SIDRA e os metadados oficiais. Tabelas 10655 (PAC, empresas com 20+ pessoas), 10474 (PIA, empresas com 5+ pessoas) e 10758 (PAS, população coberta de serviços). Primeira base coletada: ano 2024. O snapshot contém URL exata, população, data da consulta, variáveis, valores em mil reais e razões de gastos por categoria. Não somar categorias agregadas com seus subsetores.

Os numeradores são proxies econômicas de compras/consumo, explicitadas no snapshot. Não são uma estatística oficial de crédito fiscal. Não usar total de despesas menos folha como crédito. Depreciação, tributos, despesas financeiras e rubricas genéricas não viram automaticamente crédito. Não extrapolar PAS a saúde e educação regular. Há diferenças entre compras, custo das mercadorias e consumo, explicitadas na interface.

Coletor com timeout por requisição e limite de tamanho. Respostas incompletas não substituem a última pesquisa válida. Falha não atualiza a data de consulta. Uma primeira base incompleta não é gravada. Sem fallback com números inventados. Fontes registradas na Base de dados.

### Estado da atualização em 08/11/2026

O deploy [42440114846](https://github.com/FernandoCastilho/painel-especialista/actions/runs/42440114846), job 128607326901, registrou HTTP 403 nas três pesquisas às 02:49:17 UTC, no acesso aos metadados do SIDRA. O deploy mais recente [42474439295](https://github.com/FernandoCastilho/painel-especialista/actions/runs/42474439295), job 128712487293, repetiu os três HTTP 403 às 11:09:00 UTC. Os logs não identificam qual camada gerou a recusa. A falha não comprova ausência de dados mais recentes nem que 2024 seja o último ano disponível. O acesso não foi contornado.

A coleta automática está suspensa para não repetir a requisição recusada a cada publicação. `python3 scripts/fetch-ibge-cbs.py` agora valida a presença da base versionada sem acessar a rede nem escrever no snapshot. A suíte confere a reconciliação de todos os percentuais. A tela apresenta ano-base, data da última coleta válida e suspensão da atualização; fonte e aviso permanecem visíveis mesmo quando o usuário ajusta o percentual de gastos.

O coletor é mantido para uso explícito com `--refresh`, somente depois de restabelecido o acesso permitido e autorizada a nova consulta. A atualização obtida deve ser revisada, testada e versionada antes de publicar. Não se deve coletar apenas no diretório temporário de um deploy: um deploy posterior reconstruiria a base antiga do repositório. A rotina de publicação não usa esse argumento. Nenhum proxy, troca de identidade, credencial ou nova rota de acesso foi incluído. Não há novo monitoramento.

Este ajuste trata transparência e preservação, não restabelece a conexão ao IBGE. As referências, datas de coleta, variáveis, razões, alíquotas e fórmulas da calculadora permanecem inalteradas. A revisão independente e a validação de navegador deste ajuste devem ser vinculadas ao commit candidato, sem reaproveitar aprovação da primeira versão.

## Método e limites

Faturamento e gastos são valores brutos; preços finais mantidos. Parcela de CBS simplificada: `valor × taxa / (100 + taxa)`. Demais tributos não são segregados. É aproximação de cenário homogêneo, não a base de cálculo legal real de cada operação.

Crédito estimado = gastos sugeridos × parcela de CBS × proporção elegível hipotética. O padrão de 70% não é extraído do IBGE. Mesma alíquota presumida para vendas e aquisições elegíveis; mix de alíquotas, Simples, créditos presumidos e regimes específicos requerem ajuste. Créditos utilizáveis limitados ao débito; excedentes aparecem separados, sem ressarcimento imediato nem falsa entrada de caixa.

Carga atual líquida = faturamento × percentual de hipótese. Presumido inicia em 3,65%; Real em 9,25% **sem créditos atuais**, com alerta para ajustar. Não é apuração de PIS/Cofins e não afirma que esses percentuais sejam os efetivos da empresa. Simples com IBS/CBS no DAS não usa o modelo regular.

CBS inicial de 11,2% é hipótese: referência técnica TCU de 11,3% menos 0,1 p.p. da transição (LC 214, art. 347). Revisão documental em novembro/2026; não fixar como alíquota definitiva nem classificar tratamento fiscal apenas por setor. Split de 50% e vencimentos médios de 40 dias são hipóteses, não cronograma ou prazo legal.

Financiamento tributário atual `F0 = imposto atual × (vencimento atual − PMR) / 30`. No futuro, prazo ponderado de recolhimento `D = split × min(PMR, vencimento futuro) + (1−split) × vencimento futuro`. Financiamento futuro `F1 = CBS líquida × (D − PMR) / 30`. Efeito de prazo `F0−F1` admite sinal negativo. O split não posterga vencimento nem cobra novamente o débito já quitado.

Cenário 1: créditos já disponíveis, reserva `max(0, F0−F1)`. Cenário 2: crédito disponível no dia aproximado `C = PMP−estoque+espera adicional`. Dias de espera ponderados `G = split × max(0, C−min(PMR, vencimento futuro)) + (1−split) × max(0, C−vencimento futuro)`; exposição = crédito utilizável × `G / 30`; reserva `max(0, F0−F1+exposição)`. Cada atraso positivo é calculado antes da ponderação: o vencimento posterior não pode anular a espera da parcela antecipada. São sensibilidades aproximadas de fluxo uniforme, não intervalo estatístico ou déficit máximo. Não somar a retenção bruta novamente às reservas. Não multiplicar reserva de prazo por 12. A diferença recorrente de carga aparece separada em R$/mês. Ciclo operacional `PMR+estoque−PMP` é informado em dias, sem representar sozinho a NCG em reais. A empresa pode precisar de giro mesmo com reserva adicional zero.

## Matriz de aceitação e evidências

| Critério | Evidência |
| --- | --- |
| Mesma base bruta, créditos sem dinheiro fictício | `test/cbs-cash.test.mjs` |
| Split não posterga vencimento, sem cobrança dupla | teste específico de recebimento após vencimento |
| Crédito com espera e sinal do descasamento | testes de sensibilidade e ciclo |
| Valores inválidos não produzem resultado | testes numéricos e `scripts/smoke-cbs.cjs` |
| Três populações e razão reconciliada aos valores oficiais | `test/cbs-ibge.test.mjs` |
| Falha de coleta preserva valores e data | teste offline Python acionado pela suíte Node |
| Navegação, troca de setor, bloqueio Simples, ajuda e responsividade | smoke CBS no CI; capturas `cbs-caixa-design` |
| Regressões | `npm test`, build e CI existente |

QA local do navegador bloqueado pelo ambiente (`socket(): Operation not permitted` no Chromium). Não representa falha observada no produto. O CI42437110676 e suas capturas foram observados: a primeira versão passou nos testes e no ensaio visual e funcional do Chrome. Essas evidências pertencem à árvore anterior; o parecer final da revisão independente se vinculará à nova árvore corrigida. A nova versão ainda aguarda esse parecer, sem aprovação presumida.

Direção visual: reutilizar identidade do painel; laranja somente na reserva prioritária, demais blocos neutros e responsivos. Campos persistentes e ajuda existente. Complexidade tributária recolhida em detalhes; resumo das hipóteses visível. Checklist UX do Diretor de Arte: Hick/Jakob/proximidade/Miller/Tesler/Occam atendidos por inspeção estrutural; feedback/estado/recuperação atendidos por lógica e critérios dos testes; Fitts, distância, contraste, teclado/foco, fonte ampliada, responsividade e efeito de posição dependem da inspeção visual no CI. Desempenho percebido não medido. Urgência, persuasão, compromisso e automações de cliente não se aplicam. Sem aprovação visual presumida.

## Implantação e reversão

Mudança isolada de rota e fontes, sem migração de dados. Reverter o commit da funcionalidade restaura a base anterior. Preservar alterações simultâneas de outras conversas. Publicação somente pelo workflow existente após validações aplicáveis; link ou build local não comprovam publicação.
