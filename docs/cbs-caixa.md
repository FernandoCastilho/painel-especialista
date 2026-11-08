# CBS — impacto indicativo no caixa

## Escopo e decisões

Pedido: orientar a conversa comercial sobre o efeito da reforma no caixa e na necessidade **adicional** de capital de giro. Não é apuração tributária, proposta de crédito nem cálculo da NCG integral.

Fernando escolheu referência econômica por setor (em vez de exigir gastos do cliente) e informação dos prazos aproximados de recebimento, pagamento e estoque pelo cliente. São entradas também faturamento e regime. Gastos, condições de crédito, split, alíquotas e prazos tributários podem ser ajustados. O exemplo inicial está identificado; não representa uma empresa real.

Rota: `#calculadora/cbs-caixa`. Reutiliza React, MoneyInput, CalculatorHelp e o espaço visual das calculadoras. Sem nova dependência, servidor, banco, coleta de dados pessoais ou armazenamento do cliente. O formulário fica apenas na memória da aba. Especificação, direção e execução aplicadas pelas instruções disponíveis de Ideação, Tributário, Engenheiro de APP, Diretor de Arte e Simplificador; não houve transferência a pessoas. A revisão independente da primeira versão apontou correção no tratamento da espera por créditos com split parcial. A correção foi aplicada; a nova versão aguarda parecer final vinculado à sua nova árvore, sem aprovação presumida.

## Referência econômica e obtenção

`scripts/fetch-ibge-cbs.py` acessa a API SIDRA e os metadados oficiais. Tabelas 10655 (PAC, empresas com 20+ pessoas), 10474 (PIA, empresas com 5+ pessoas) e 10758 (PAS, população coberta de serviços). Primeira base coletada: ano 2024. O snapshot contém URL exata, população, data da consulta, variáveis, valores em mil reais e razões de gastos por categoria. Não somar categorias agregadas com seus subsetores.

Os numeradores são proxies econômicas de compras/consumo, explicitadas no snapshot. Não são uma estatística oficial de crédito fiscal. Não usar total de despesas menos folha como crédito. Depreciação, tributos, despesas financeiras e rubricas genéricas não viram automaticamente crédito. Não extrapolar PAS a saúde e educação regular. Há diferenças entre compras, custo das mercadorias e consumo, explicitadas na interface.

Coleta em paralelo para três pesquisas, timeout por requisição e limite de tamanho. Respostas incompletas não substituem a última pesquisa válida. Falha não atualiza a data de consulta. Uma primeira base incompleta não é gravada. Sem fallback com números inventados. A atualização roda na publicação por push ou disparo manual do workflow existente; as execuções periódicas preservam o snapshot versionado. Não há monitoramento novo. Fontes registradas na Base de dados.

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

## Revisão didática de 2026-11-08

Pedido de Fernando: explicações muito simples, seguindo Aprender e a metodologia Feynman quando adequada. Implementação localizada: definição de caixa, imposto, crédito e split; dicas junto a todas as entradas; dois cenários de reserva nomeados; decomposição vertical do imposto; recebimento, ciclo, exemplo mensal e pergunta de entendimento em seção complementar. As ligações dos conceitos Reforma Tributária e Split Payment no Aprender agora levam à simulação. Crédito como abatimento, reserva em reais e diferença de imposto em reais/mês permanecem distintos. Fórmulas, hipóteses iniciais e base IBGE preservadas.

Ideação realizou triagem; Engenheiro de APP implementou; Simplificador revisou os textos; Diretor de Arte orientou a hierarquia e inspecionou capturas reais, recomendando decomposição vertical e maior largura da atividade IBGE, aplicadas. O Diretor reinspecionou as quatro capturas finais e aprovou o visual no escopo visto; contraste instrumental, leitor de tela e desempenho não foram medidos. Cobertura: calculadora CBS inteira, sua função de cálculo, dados setoriais, ajuda/entrada monetária, Aprender e rotas pertinentes. Não é auditoria integral do código do painel.

| Critério da revisão | Verificação local |
| --- | --- |
| Fórmulas preservadas e cenários coerentes | 9 testes de `cbs-cash.test.mjs` passaram |
| Aprender e navegação existentes | 4 testes de navegação/insight passaram |
| Integridade das razões setoriais | teste de reconciliação do snapshot passou |
| Coleta IBGE em indisponibilidade | bloqueado localmente: teste exige `python3` e caminho POSIX em ambiente Windows; coletor não foi alterado |
| Build e lint | build passou; lint sem erros, com 5 avisos preexistentes em outros componentes |
| Interface e interação Chrome | smoke em temas claro/escuro, larguras 390/1440; capturas e resultado em `cotacoes/workspace-qa/cbs-didatico/` |

O navegador local não acessou localhost por restrição do ambiente. O smoke foi executado com o build real servido por interceptação de arquivos no Playwright, sem alterar o produto. Isso valida a interface local, sem comprovar publicação ou conectividade em produção. Nenhuma publicação feita nesta revisão.

### Busca de atividades do IBGE

Pedido adicional de Fernando em 2026-11-08: buscar atividades à medida que digita e simplificar o design. O seletor de atividade foi substituído por uma busca única nas 225 atividades disponíveis do snapshot (Comércio, Indústria e Serviços). Nome, código, partes de palavras e termos combinados são pesquisados sem distinção de acentos/maiúsculas. Não é busca em todas as CNAEs nem busca semântica. Todas as correspondências aparecem na lista com rolagem; nenhuma é truncada silenciosamente.

O setor passou a acompanhar a atividade selecionada, evitando um filtro concorrente. A atividade vigente fica visível durante nova busca. Digitar, sair do campo ou pressionar Escape não troca a atividade nem os cálculos. Somente escolha por clique, toque ou Enter aplica a atividade, atualiza setor e referência de gastos e elimina o ajuste manual de gastos anterior. Restaurar exemplo limpa a busca e recupera a seleção inicial. Setas, Enter, Escape, rótulo persistente, lista de opções e anúncio de quantidade foram implementados; leitor de tela real não foi testado.

Diretor de Arte e Simplificador participaram da concepção e revisão. O Diretor aprovou o visual final após inspecionar desktop, mobile e as duas capturas de viewport móvel; teclado virtual de aparelho físico não foi testado. Testes `cbs-activity-search.test.mjs` cobrem normalização, busca parcial/código, cruzamento de setores, ausência, base completa e imutabilidade. Com os testes CBS/Aprender, 16 testes passaram; reconciliação IBGE continua válida e o limite do teste Python permanece. Build e lint dos arquivos envolvidos passaram. Smoke Chrome validou troca por teclado e toque, cálculo preservado sem seleção, reset da referência de gastos e do exemplo, Escape/blur e temas claro/escuro em 390/1440 px. Evidências em `cotacoes/workspace-qa/cbs-busca-ibge/`; capturas de viewport móvel conferem o campo fora da barra fixa. Sem publicação neste lote.
# Revisão de apresentação — novembro de 2026

O fluxo usa dados essenciais, uma reserva principal (cenário com espera pelos créditos) e explicações recolhidas. O imposto mensal permanece separado da reserva de prazos. No zero, a interface explica que não houve reserva adicional estimada, sem afirmar sobra de caixa ou medir o giro total.

A visão janeiro–dezembro aplica a mesma função `simulateCbsCash` a 12 cenários independentes. Por padrão, repete o faturamento principal, sem inventar sazonalidade; cada mês pode receber um faturamento próprio. Prazos e demais hipóteses permanecem comuns. Não há transferência de crédito ou saldo entre meses, soma anual de reservas, previsão de caixa ou cálculo integral de NCG. Faturamento inválido ou zero deixa o mês sem ponto, com orientação para corrigir, preservando o contrato de faturamento positivo da fórmula. Alterações mensais sobrevivem à correção de entradas principais inválidas; restaurar o exemplo as limpa.

O gráfico mantém os rótulos dos meses ancorados nos pontos e rolagem interna no celular. Controles separados permitem consultar faturamento e reserva exatos. A apresentação foi revisada novamente pelo Diretor de Arte e pelo Simplificador após rejeição do formato anterior. A revisão local não implica nova publicação.
