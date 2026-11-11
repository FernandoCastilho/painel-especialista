# Operação x DI (11/11/2026)

Rota: `#calculadora/operacao-di` (atalho de terminal: `OPERACAODI`, `OPXDI`).

Compara uma operação com aplicar o mesmo valor no DI, do início ao vencimento, usando a curva DI x pré da B3 da data-base (`curves.json`, curva "hoje").

## Contas (`src/operacaoDi.js`)
- Dias úteis contados da data-base da curva com os feriados nacionais (`busDaysIn`, praça BR). DU = d2 − d1.
- Fator do DI = growthAt(d2) / growthAt(d1); entre vértices, taxa a termo constante (interpolação do log do fator, a mesma do CDI futuro).
- Pré a.a.: (1 + taxa)^(DU/252). Pré a.m.: (1 + taxa)^(12 × DU/252). Pré no período: 1 + taxa.
- % do CDI: produto, dia útil a dia útil, de (1 + p × DI do dia), como na metodologia B3.
- CDI + spread: fator do DI × (1 + spread)^(DU/252).
- Taxa ao ano = fator^(252/DU) − 1. Diferença em bps = (taxa ao ano da operação − CDI médio ao ano) × 10.000.
- Equivalentes: % do CDI por bisseção; CDI + spread = (fator op / fator DI)^(252/DU) − 1.

## Visão Crédito (regras de 11/11/2026, `creditVsDi`)
Desde 11/11/2026 a visão Crédito usa o mesmo motor do Capital de Giro e do Comparador (`creditOperation`, `creditCet`):
- Vencimento em fim de semana ou feriado nacional passa para o próximo dia útil (`nextBusinessDay`).
- Pré a.m.: (1 + taxa)^(dias corridos/30); a.a. convertida para a.m. composta; no período, usada como está.
- % do CDI e CDI + spread: DI da curva em dias úteis/252 com feriados nacionais; spread também em dias úteis/252.
  O DI começa a correr no primeiro dia útil a partir da liberação.
- IOF de PJ (ou Simples elegível) e tarifas informadas descontados na liberação.
- CET pela Res. CMN 4.881/2020, art. 4º (dias corridos/365, sobre o líquido). No pós-fixado, art. 5º: "CET · parte fixa
  (regra do BC)" com o CDI zerado e, à parte, "Custo com CDI projetado" pela curva (não é CET).
- A taxa equivalente ao ano (252 d.u.), a diferença em bps e os equivalentes continuam comparando juros contra o DI.

## Premissas e limites
- Projeção do mercado na data-base, não garantia. Pagamento único no vencimento.
- Visão Aplicação: convenção de renda fixa em dias úteis/252, sem IOF, IR e tarifas: não é rentabilidade líquida.
- Início antes da data-base ou vencimento além do último vértice: a tela recusa.
- Spread negativo não é aceito no campo.

## Verificações
`node --test test/operacao-di.test.mjs` (curva plana com resultado fechado, conversões, % do CDI, spread, termo entre vértices, entradas inválidas). Conferência visual em 390 px (claro) e 1440 px (escuro) com curva de exemplo.
Visão Crédito: testes com recálculo independente (feriados à mão, CET de pagamento único em fórmula fechada) e conferência de navegador `scripts/smoke-operacao-di.cjs` (390 e 1440 px), também no CI.
