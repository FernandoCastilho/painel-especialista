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

## Premissas e limites
- Projeção do mercado na data-base, não garantia. Pagamento único no vencimento. Sem IOF, IR, tarifas e garantias: não é CET nem rentabilidade líquida.
- Início antes da data-base ou vencimento além do último vértice: a tela recusa.
- Spread negativo não é aceito no campo.

## Verificações
`node --test test/operacao-di.test.mjs` (curva plana com resultado fechado, conversões, % do CDI, spread, termo entre vértices, entradas inválidas). Conferência visual em 390 px (claro) e 1440 px (escuro) com curva de exemplo.
