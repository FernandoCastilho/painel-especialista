# Comparador de Crédito

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
