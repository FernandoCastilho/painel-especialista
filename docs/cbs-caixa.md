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

CBS inicial de 8,4% (2027–2028) e 8,5% (2029–2033) é hipótese: escada da carga inicial do banco da Receita, retirada em 28/08/2026 (decisão de Fernando, 19/11/2026). A diferença de 0,1 p.p. em 2027–2028 segue a LC 214, art. 347; a alíquota de referência ainda depende de resolução do Senado (art. 349). Revisão documental em novembro/2026; não fixar como alíquota definitiva nem classificar tratamento fiscal apenas por setor. Split de 50% e vencimentos médios de 40 dias são hipóteses, não cronograma ou prazo legal.

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

# Reforma oficial (2026-11-19)

Pedido de Fernando: reformular a calculadora com as regras da calculadora oficial da Receita. Contrato: `docs/reforma-tributaria-oficial/combinado.md` (aprovado com "Ok"). Captura das fontes: `docs/reforma-tributaria-oficial/captura-2026-11-19.md`.

## O que mudou

- Tributos: CBS, IBS estadual, IBS municipal e Imposto Seletivo (IS). Antes só CBS.
- Base "por fora", como na oficial: o usuário informa as vendas sem ICMS, ISS, PIS, Cofins e IPI. Imposto = base × alíquota efetiva. O IS entra na base de CBS e IBS. Antes a CBS era tirada de dentro do faturamento bruto (`valor × t ÷ (100 + t)`).
- Seletor de ano de 2026 a 2033.
  - 2026: alíquotas oficiais do banco da Receita (CBS 0,9%, IBS estadual 0,1%, IBS municipal 0%), sem edição. Aviso de que 2026 é ano de teste.
  - 2027 a 2033: valores iniciais editáveis, rotulados "hipótese", com a origem na tela. CBS: escada da carga inicial do banco da Receita, 8,4% em 2027–2028 e 8,5% de 2029 a 2033 (decisão de Fernando, 19/11/2026; nota do art. 347 em 2027–2028). IBS 2027–2028: 0,05% estadual + 0,05% municipal, previstos na LC 214/2025, art. 344 (texto atualizado da Câmara, conferido em 19/11/2026, com link na tela). IBS 2029–2033: escada da carga inicial do banco da Receita (até 16% + 2,5% em 2033), que a própria Receita apagou em 28/08/2026 por não estar em lei. Na tela, essa origem aparece escrita; os números não são apresentados como oficiais. Ao trocar o ano, as alíquotas voltam ao valor inicial daquele ano.
- Reduções de 30% a 100% da tabela oficial de classificação (cClassTrib, CST 200 e 011): alíquota × (1 − redução), por tributo. CST 515 (redução com diferimento) ficou de fora do seletor.
- Simples Nacional (a partir de 2027): o usuário informa a parte de CBS e a parte de IBS do DAS (alíquotas efetivas do PGDAS-D). A calculadora reparte como a oficial: receita × fator do tipo de venda × alíquota. Venda interna 1; mista 0,5; exportação direta 0; exportação indireta suspensa (aparece como suspenso, fora do imposto a pagar). Sem crédito nas compras. Em 2026 o Simples fica bloqueado com aviso.
- Motor de caixa preservado (prazos, split, crédito com espera, reserva). Recebe CBS + IBS como imposto com split e crédito; o IS vence no prazo informado, sem split e sem crédito.
- "PIS/Cofins atual" virou "Tributos atuais substituídos, após créditos", em % das vendas sem tributos, com ajuda por ano (2027–2028 PIS/Cofins; 2029–2032 parte do ICMS/ISS que sai; 2033 todos).
- Fonte, versão (calculadora 1.6.1, tabela V0059 de 30/09/2026) e rótulo oficial/hipótese/informado ficam visíveis no quadro de alíquotas. Detalhes e licença em "Fonte das regras e das alíquotas".

## Arquivos

- `cotacoes/src/rtcCalc.js`: fórmulas oficiais em JavaScript (8 casas internas, arredondamento bancário, como `ArredondamentoUtils.java`).
- `cotacoes/src/rtcOficial.json`: tabela extraída (fonte, versão, commit `150cccbe`, alíquotas de referência, 59 classificações com redução).
- `cotacoes/scripts/extract-rtc-oficial.py`: lê os arquivos SQL oficiais **como texto** e grava o JSON. Nada do repositório oficial é executado (não monta banco). Para em erro diante de comando que não reconhece.
- `cotacoes/src/rtcAnos.js`: alíquotas por ano e origem de cada número.
- `cotacoes/src/cbsCash.js`, `CbsCaixa.jsx`: motor e tela.
- `.github/workflows/reforma-oficial-versao.yml`: rotina semanal (segundas, 09h17 de Brasília) que compara a versão da calculadora e da tabela oficial com o JSON e abre issue + aviso no Teams (mesmo padrão de `alerta-coleta.yml`). Não troca dados. Só roda depois de ir para o ramo principal.

## Decisões tomadas sozinho (escolha mais segura, para revisão)

1. Alíquotas iniciais de 2027+: decidido por Fernando em 19/11/2026 (ver seção "Escada da Receita" abaixo). A referência técnica do TCU (11,2%/11,3%) saiu da tela e da lista de fontes.
2. Crédito nas compras usa a mesma alíquota efetiva das vendas (com a redução). Conservador: venda reduzida gera crédito menor.
3. CST 515 (diferimento) fora do seletor de reduções; diferimento, crédito presumido, regimes específicos e compras do governo fora do cálculo, como no combinado.
4. A comparação com os tributos atuais depende do percentual informado pelo usuário; a calculadora não modela a escada de redução do ICMS/ISS.

## Limites

- Não é cálculo por item de nota, apuração fiscal nem alíquota do DAS.
- Os números de 2027–2033 são hipóteses; a lei ainda não os fixou.
- Imposto Seletivo só com alíquota ad valorem; ad rem (por unidade) só nas fórmulas e testes.
- Autenticidade da cópia oficial não conferida contra a Portaria Cotec 342/2026 (site bloqueado na sessão).

## Matriz de evidências

| Critério do combinado | Evidência |
| --- | --- |
| Contas batem com a oficial (≥ 10 casos) | `test/cbs-rtc-oficial.test.mjs`: 17 casos oficiais (12 do regime regular, 5 do Simples). Regime regular: Teste_000001_1, _2, _5, _6, _9 (6 variações de base), Teste_011002_1, Teste_200032_1, _2, Teste_200002_1, _2, `docs/exemplos.md` (educação 200028 e totais de 3 itens). Simples: Teste_SimplesNacionalCalculoService casos 01, 02, 03, 04, 05a07. Arredondamento de `ArredondamentoUtils.java` |
| Reduções vindas da tabela oficial | os testes acima leem as reduções do `rtcOficial.json` (011002, 200032, 200002, 200028, 200003) |
| 2026 oficial; 2027+ sem alíquota oficial | teste de dados em `cbs-rtc-oficial.test.mjs`; smoke confere rótulos "oficial"/"hipótese" e campos bloqueados em 2026 |
| Extrator lê o SQL sem executar e para em forma desconhecida | teste com arquivos de exemplo em `cbs-rtc-oficial.test.mjs` |
| Motor de caixa preservado com novos tributos | `test/cbs-cash.test.mjs` (14 testes, inclui IBS, redução, IS, Simples com DAS dentro da receita e 2026 só ilustrativo), `cbs-annual`, `cbs-ncg` |
| Tela: ano, redução, Simples, fonte e versão | `scripts/smoke-cbs.cjs` (Chromium), capturas em `cotacoes/workspace-qa/reforma-oficial/` (390 e 1440, claro e escuro) |
| Rotina semanal só avisa | `reforma-oficial-versao.yml`; lógica conferida com simulação local (igual, versão nova, fechar aviso). Chamada real à API do GitHub não conferida na sessão |
| Testes, build, lint | `npm test` 2210/2210 (44 nos arquivos `cbs-*`); build ok; lint 0 erros (5 avisos antigos em outros arquivos) |
| CI verde | pendente: só depois do envio do ramo |
| Revisões | Simplificador da central não instalado: usados o simplificador de código da sessão (passada única, sem subagentes) e a revisão ponytail; Diretor de Arte (instruções da skill) revisou as capturas e pediu título e rótulo curto no Simples, aplicados. **Revisão independente do cálculo: pendente** |

## Correções das revisões independentes (2026-11-19)

Cálculo (revisor tributário, "Requer correção"; dentro do combinado, porque alinha à regra oficial):
- Simples: a base do DAS é a receita bruta, que já contém o tributo (caso 02 oficial). Nada é somado ao recebimento; o campo passa a se chamar "Receita bruta mensal". Teste: `cbs-cash.test.mjs` (R$ 100.000 com 2,75% + 1,25% → imposto R$ 4.000, recebimento R$ 100.000).
- 2026: CBS e IBS são compensados com PIS/Cofins ou dispensados (LC 214/2025, art. 348, conferido no texto atualizado). Não substituem tributo: o campo de tributos atuais some, não há reserva nem diferença, e a tela mostra só a "conta ilustrativa". Teste no mesmo arquivo.
- Aviso curto de que o crédito das compras pode ser maior (compras com alíquota cheia quando a venda tem redução) e virar saldo a ressarcir.
- IBS 2027–2028 rotulado como previsto na LC 214/2025, art. 344, com link. A EC 132/2023 (planalto.gov.br) não abriu nesta sessão; a lei complementar, sim. Valores iniciais de 2027+ não mudaram (aguardam decisão de Fernando).

Visual (Diretor de Arte, "Requer correção"): margem interna de 16 px (celular) e 24 px (computador) nos quadros de giro e de meses; gráficos presos à largura; frase do "exemplo inicial" removida; reserva e aumento de imposto lado a lado, com selo "hipótese" a partir de 2027; exemplo completo (Lucro Presumido, compras a prazo R$ 1,5 mi, CMV R$ 2,1 mi, prazos 60/30/45) que calcula sem alerta; meses iguais viram uma linha "igual em todos os meses"; selo "informado" neutro e "hipótese" visível no Simples; mês selecionado em azul #0131FF com texto branco; notas dos campos no mesmo estilo; um botão de ampliar por quadro e "?" junto ao título; "Restaurar exemplo" na linha do título; faixa "Ajustar hipóteses" mais curta; seta de aumento na cor de alerta.

Evidência: `npm test` 2210/2210; build e lint ok; smoke Chromium passou, com capturas novas em `cotacoes/workspace-qa/reforma-oficial/` (inclui `ano-2026-*` e `simples-dark-390.png`).

## Escada da Receita e rodada 2 das revisões (2026-11-19)

Decisão de Fernando (muda regra de cálculo só neste ponto): valores iniciais de 2027 a 2033 = números da carga inicial do banco oficial da Receita (B0001 linhas 36269–36440), apagados em 28/08/2026 pela V0053. Continuam editáveis e marcados "hipótese"; IBS 2027–2028 marcado como previsto na LC 214, art. 344.

| Ano | CBS | IBS estadual | IBS municipal | Total |
|---|---|---|---|---|
| 2027 | 8,4% | 0,05% | 0,05% | 8,5% |
| 2028 | 8,4% | 0,05% | 0,05% | 8,5% |
| 2029 | 8,5% | 1,6% | 0,25% | 10,35% |
| 2030 | 8,5% | 3,2% | 0,5% | 12,2% |
| 2031 | 8,5% | 4,8% | 0,75% | 14,05% |
| 2032 | 8,5% | 6,4% | 1% | 15,9% |
| 2033 | 8,5% | 16% | 2,5% | 27% |

Fontes: captura `docs/reforma-tributaria-oficial/captura-2026-11-19.md` (seção 3.2); [LC 214/2025 atualizada, Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/leicom/2025/leicomplementar-214-16-janeiro-2025-796905-normaatualizada-pl.html), arts. 344 (IBS 0,05% + 0,05% em 2027–2028), 347 (CBS de 2027–2028 = referência − 0,1 p.p.) e 349 (alíquota de referência fixada por resolução do Senado), relidos em 19/11/2026. Teste: `cbs-rtc-oficial.test.mjs` confere a escada ano a ano e o total de 27% em 2033.

Revisor de cálculo (ressalvas de texto): rótulo da CBS em 2026 mostra a alíquota efetiva (ex.: "CBS (0,36% com redução de 60%)"); no quadro anual de 2026, a diferença tributária diz "não se aplica em 2026".

Diretor de Arte (rodada 2):
- Gráfico "Reserva mês a mês" cabe na largura (sem rolagem lateral, sem vão à esquerda); no celular a letra do gráfico é maior para continuar legível.
- Meses iguais: "Reserva adicional: R$ X em todos os meses" no lugar do gráfico reto; seletor de mês só aparece quando os meses variam.
- Um só botão de ampliar no bloco Reserva (tirado o do "Gráfico mensal").
- "?" do cabeçalho azul e seta de aumento sobre o cartão azul em cores claras nos dois temas.
- Rótulos "Regime atual", "CMV" e "Compras mensais a prazo" com a mesma estrutura dos vizinhos (alinhados).
- Títulos dos quadros de giro sem margem de cima.
- Ciclo financeiro em palavras ("recebe 30 dias antes de pagar" / "paga 75 dias antes de receber").
- Simples com duas reservas iguais: conferido, está certo. No Simples não há crédito nas compras (crédito usado = 0), então "créditos já disponíveis" e "após a espera" dão o mesmo valor. Ex. da captura: R$ 1 mi, DAS 2,75% + 1,25% = R$ 40.000; atual 3,65% = R$ 36.500; recebe em 60 dias, vence em 40: 36.500 × (40 − 60)/30 = −24.333,33; 40.000 × (40 − 60)/30 = −26.666,67; diferença R$ 2.333,33 nos dois cenários. Os "110 dias" de espera eram mostrados sem haver crédito: agora a espera só aparece com crédito, e a tela explica por que os valores são iguais.
- Editor de meses da visão geral: não repete o faturamento digitado; mostra reserva, NCG e diferença (NCG mantida para não perder o valor exato que o gráfico manda consultar).
- Aviso de 2026 em nota neutra, não em faixa de alerta.

CI (smoke-published): a asserção antiga esperava nenhum resultado ao abrir ("sem premissas confirmadas"). Com o exemplo inicial completo, o comportamento certo é: abre já calculando e sem alertas; ao apagar os tributos atuais, a comparação some e aparece o aviso "Informe os tributos atuais". O teste agora confere as duas coisas, e o mês a mês passou a conferir o texto de meses iguais, o gráfico de 12 meses ao editar fevereiro, a lacuna de mês inválido e a volta aos meses iguais.

Evidência desta rodada: `npm test` 2211/2211; lint 0 erros (5 avisos antigos em outros arquivos); build ok; smokes `smoke-cbs`, `smoke-published` (390/820/1440) e `smoke-calculator-layout` passaram no Chromium contra o build servido como no CI. Capturas novas (locais, fora do git) em `cotacoes/workspace-qa/reforma-oficial/`, incluindo `ano-2033-*`. Simplificador da central não instalado: usados a passada de simplificação da sessão e a revisão ponytail (removidas regras de CSS e classe que ficaram sem uso).
