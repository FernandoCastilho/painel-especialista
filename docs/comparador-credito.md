# Comparador de Crédito

## Versão por modalidade (10/11/2026)

A tela passou a seguir o modelo "Simulador de empréstimo · Compare modalidades". Rota igual: `#calculadora/comparador-credito`.

- O usuário escolhe de 2 a 5 comparações (começa com 2) e a modalidade de cada coluna: Giro prefixado, Giro pós-CDI, BNDES, FINIMP, Conta Garantida, Desconto de duplicata e Outra modalidade.
- Topo comum: valor, prazo, carência, amortização e data da liberação. Cada coluna pode ter valor, prazo, carência e amortização próprios (campo vazio segue o comum).
- Cada coluna pede os campos da sua modalidade. BNDES: linha (TFB, TFC, TLPCAP), custo financeiro, porte, spread do agente, participação, composição, periodicidade, IPCA, IOF, TAC e garantia FGI, com os limites de prazo e carência do BNDES. FINIMP: moeda, câmbio, prazo em dias, taxa simples, flat e TAC. Conta Garantida: taxa, base, conversão, contagem de dias, dias de uso. Desconto: convenção, taxa, tarifa dos títulos, TAC, títulos e prazo médio.
- O cartão mostra parcela estimada e CET na hora. A tabela completa, o gráfico e a leitura só aparecem ao clicar em "Comparar modalidades" e somem se qualquer condição mudar.
- Mantidos: cenários do CDI (só com coluna indexada), "mesmo valor líquido" (vale para todas as modalidades), declaração de conferência e apresentação em tela cheia.
- Código: `src/creditModalities.js` (organiza cada coluna e leva o resultado a um formato comum), `src/CreditComparison.jsx` (tela). Nenhum motor de cálculo foi alterado: usa `creditComparison.js`, `finameMateriais.js`, `finimpComparison.js`, `contaGarantida.js` e `analiseDesconto.js` como estão.
- CET de todas as modalidades: mesmo cálculo por fluxo de caixa (líquido na liberação, pagamentos datados, ACT/365), sempre "estimado".
- Giro pós-CDI (11/11/2026, Res. CMN 4.881/2020, art. 5º: taxa flutuante não entra no CET regulatório): a coluna mostra dois números. "CET · parte fixa (regra do BC)" é o mesmo contrato com CDI zero (só o spread, mesma base de dias úteis/252, feriados nacionais e informados, mesmas datas e IOF desse fluxo). "Custo com CDI projetado" é o número antigo e não é CET. A marca "menor CET" usa o CET da parte fixa. Nas modalidades prefixadas os dois coincidem. Vale também para "Outra modalidade" com indexador CDI. Exemplo (R$ 500.000, 24 meses Price, 100% do CDI + 0,35% a.m., liberação 10/11/2026, CDI 14,9%): CET parte fixa 7,08% a.a.; custo com CDI projetado 23,12% a.a. Campos do motor: `cetRegulatory` em `creditOperation`; `cet`, `projectedCost` e `floating` no resultado da coluna.

### Premissas que o usuário precisa saber

- FINIMP em reais pelo câmbio informado, constante. Sem variação cambial e sem IOF de câmbio, como na calculadora FINIMP. Para o CET, flat e TAC são pagos na liberação; juros e principal, no vencimento.
- BNDES: carência com juros pagos (convenção BNDES); no giro a carência é capitalizada. Cronograma em meses iguais a partir da liberação. BNDES aceita Price ou SAC (Bullet dá erro na coluna). Taxas do BNDES vêm do porte; custo financeiro e spread são digitados.
- Conta Garantida: saldo usado inteiro por todo o período, juros e IOF pagos no fim; tarifas não modeladas.
- Desconto: o valor é o nominal; juros descontados na liberação.
- "BDRS" no pedido foi entendido como BNDES.

### Verificações

`node --test test/credit-modalities.test.mjs test/credit-comparison-ui.test.mjs` (contas de cada modalidade conferidas contra o motor próprio, equivalência de líquido, tela) e `node scripts/smoke-credit-comparison.cjs` (navegador, 390/820/1440 em claro e escuro, apresentação). A parte abaixo descreve o motor do Giro (histórico: a primeira versão tratava só Capital de Giro com duas propostas; as demais modalidades, hoje na mesma tela, seguem usando os módulos próprios). Colunas escondidas ao reduzir a quantidade guardam o que foi digitado.

### Auditoria independente (10/11/2026)

Parecer 1: Requer correção (84,0). Corrigidos: total desembolsado do Desconto (era somado em duplicidade), aviso de que carência e amortização comuns não valem para pagamento único, porte/spread/participação do BNDES visíveis no cartão, aviso de valores de exemplo, aviso sonoro a cada tecla, câmbio escondido em BRL.

Primeira versão tecnicamente delimitada a Capital de Giro PJ em reais. Acesso: Calculadoras → Comparador de Crédito, rota `#calculadora/comparador-credito`. BNDES, FINIMP, Conta Garantida e desconto continuam em módulos próprios, sem reinterpretar suas regras.

## Entradas e convenções

Duas propostas independentes: principal, taxa mensal/anual efetiva, prefixado ou percentual de CDI mais spread, Price/SAC/Bullet, liberação, primeiro vencimento, encargos iniciais e por pagamento, perfil PJ/Simples, garantia e valor opcional. IOF/encargos iniciais são descontados da liberação, não financiados. O usuário deve incluir todos os custos aplicáveis e conferir as convenções. Não se armazenam dados de clientes.

- Reutiliza `monthlyRate` e `loanDates` de `emprestimo.js`, `resolveCreditIof` de `iofRules.js`, datas civis de `contaGarantida.js` e o arquivo de mercado `macro.json` pelo hook existente.
- Prefixado: composição ACT/30. CDI/spread: taxa DI diária equivalente multiplicada pelo percentual antes da composição DU/252; spread composto por fator separado, segunda a sexta menos os feriados informados, sem calendário bancário certificado ou ajuste de vencimentos.
- Price calcula pagamento constante pela soma dos fatores de desconto das datas. SAC amortiza o saldo inicial amortizável uniformemente. Prazo mensal ancorado no primeiro vencimento, limitado ao fim do mês quando necessário.
- Dias antes do primeiro período de 30 dias são carência capitalizada. Para Bullet há somente vencimento único, com todos os juros capitalizados. Não oferece carência com juros pagos, múltiplas liberações, pagamentos extraordinários ou renegociação.
- IOF adicional sobre principal original; diário sobre a parcela do principal original amortizado, até 365 dias. Juros capitalizados não viram novo principal tributável neste modelo. Enquadramento Simples depende de confirmação e limite da operação.
- CET estimado: recebimento líquido na liberação, pagamentos datados com encargos, desconto ACT/365 por bisseção em log(1+taxa). Mesma abordagem numérica do módulo BNDES de fluxo declarado; não é certificação contratual nem jurídica.
- Custo = pagamentos futuros − líquido recebido. Total desembolsado = pagamentos + IOF + encargos iniciais; estes foram descontados na liberação. Não confundir total com parcela final.
- Equivalência recalcula principal para mesmo líquido, preservando encargos fixos, taxas, garantia e datas. Resolve a relação linear principal/líquido em cada faixa do IOF e valida novamente o fluxo completo, evitando que uma tentativa acima do limite numérico rejeite valores viáveis. Não escala o fluxo original.
- Cobertura nominal = garantia / principal. Garantia não mensurável fica sem percentual, zero é distinto de ausente, e maior cobertura não recebe selo de melhor proposta.

## Cenários e apresentação

CDI usa última observação não futura de B3/BCB SGS4389 em `macro.json`, com data e aviso de atraso/falha; alternativa manual explícita. Base, alta e queda usam CDI constante e amplitude editável; queda limitada a zero. São hipóteses, não previsões. Prefixado permanece inalterado.

Tabela comparativa, pagamentos acumulados por datas e fluxos completos acessíveis. Análise por critérios separados, sem vencedor absoluto. Apresentação modal em tela cheia da página captura o resultado ao abrir; Escape, Fechar e mudança de rota encerram e devolvem foco. Exige declaração de conferência dos custos, que não substitui auditoria.

## Verificações

`node --test test/credit-comparison.test.mjs`: juros zero, paridade de período único com motor existente, datas reais, Price/SAC, carência, IOF, CDI/spread/feriados, custos, CET, equivalência, limite Simples, garantia ausente, inválidos, limite numérico e calendário.

`node scripts/smoke-credit-comparison.cjs`: propostas independentes, entradas inválidas sem resultado antigo, garantia, equivalência, CDI/cenários/manual vazio, 390/820/1440 em claro/escuro, apresentação e histórico/foco. O CI guarda capturas em `credit-comparison-design`.

No executor local de 08/11/2026, Chromium não iniciou: `socket() failed: Operation not permitted`. A tentativa com revisão de escalonamento teve o mesmo resultado. Portanto não houve inspeção visual local. Aprovação visual depende da execução e análise dos artefatos do CI, não somente dos testes matemáticos.

## Reauditoria de 08/11/2026

Corrigidos: equivalência em principal alto; gráfico Bullet com ponto inicial zero; condições contratuais completas na apresentação; declaração de conferência vinculada às entradas e à referência de mercado; percentual CDI aplicado à taxa diária antes de compor. A precisão integral da projeção não reproduz truncagens de registro B3; o contrato deve confirmar calendário e convenções.

Fontes primárias consultadas em 08/11/2026:
- [Decreto 6.306 consolidado pela Câmara](https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html): art. 7º I-b, VI e §§1º/15 fundamentam principal amortizado, PJ 0,0082% diário, Simples até R$30 mil 0,00274%, teto 365 dias e adicional 0,38%. Art.3º §2º distingue débito de encargos da disponibilização de crédito. A simulação não cobre risco sacado ou renegociação.
- [B3: metodologia DI acumulado](https://b3.com.br/main.jsp?lumA=1&lumII=2C9FBE63638CFE2501638D373B435E37&lumPageId=2C9FBE63638CFE2501638D3464C8577B): percentual aplicado na taxa diária antes do produtório; a simulação usa CDI constante, sem certificação de memória contratual.
- [Receita/Fazenda, nota sobre a decisão do IOF](https://www.gov.br/fazenda/pt-br/canais_atendimento/imprensa/notas-a-imprensa/2025/julho/receita-federal-do-brasil-explica-como-ficam-os-pagamentos-do-iof-diante-do-novo-entendimento), atualizada em 27/10/2026: orienta observância do Decreto 6.306 com redação do 12.499 após a decisão de 16/07/2025. O corte de 17/07 do simulador evita aplicar regras anteriores nesta ferramenta.
