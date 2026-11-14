# FINIMP · cotação com NDF (14/11/2026)

Calculadora nova em Calculadoras › "FINIMP · cotação" (`#calculadora/finimp-cotacao`). Reproduz a planilha de cotação de FINIMP com NDF de compra. A comparação de propostas ("FINIMP") continua como estava.

## Entradas
Moeda, valor na moeda, cotação de partida (abre com a do Painel), parcelas, prazo em dias, data do desembolso, taxa all-in, comissão externa, alíquota do IR remetido (25% como na planilha), TAC, taxa futura fechada de cada parcela e PTAX do vencimento (cenário; vazia = cotação de partida).

## Regras (deduzidas da planilha e conferidas com a cotação de referência)
- Valor R$ = valor × cotação.
- Juros total = saldo × all-in × dias ÷ 360. Comissão externa = saldo × externa × dias ÷ 360. IR = externa × alíquota ÷ (1 − alíquota) (25%: um terço da externa). Comissão local = juros − externa − IR. Cada coluna arredondada ao centavo.
- Parcela US$ = amortização + juros. Parcela R$ = parcela US$ × taxa futura.
- Empréstimo (1) = parcela US$ × PTAX. Ajuste bruto (2) = (PTAX − taxa futura) × parcela US$. Total (3) = (1) − (2) = parcela travada na NDF.
- Ajuste líquido: ajuste positivo paga IR pela tabela regressiva (22,5% a 15%). **Suposição**: a foto da planilha não mostra caso positivo.
- TIR efetiva: fluxo em reais (valor − TAC na entrada, total (3) nos vencimentos), dias corridos/365, lida ao mês como 30 dias (mesma leitura do 4131).
- Economia de IOF: 0,38% + 0,0082% ao dia por parcela (até 365 dias), regra já usada no Painel. Equivalente em giro: a TIR com esse IOF somado ao valor recebido.
- Atingir meta: busca a all-in que leva à TIR (ou ao equivalente em giro) pedida; a comissão externa fica fixa e a local absorve a diferença.
- Várias parcelas: amortização constante, prazos iguais dentro do prazo total, juros do período sobre o saldo. **Suposição**: a planilha de referência tem uma parcela só.

## Conferência com a cotação de referência (1 parcela, 122 dias)
Bate: valor R$, vencimento, comissão externa, IR, economia de IOF (R$ 7.325,89), TIR 1,33% a.m., giro 0,99% a.m.
Diferença: juros 1 centavo acima (2.840,36 x 2.840,35) e parcela R$ 6 centavos acima, porque a all-in da planilha tem casas além das quatro exibidas.

## Pendências
- Revisão independente da conta (regra do projeto para cálculo financeiro).
- Confirmar com a mesa: alíquota do IR remetido (25%), regra do ajuste positivo e o IOF do giro (o decreto de 2025 pode ter mudado a alíquota de PJ; o Painel ainda usa 0,0082% + 0,38%).
