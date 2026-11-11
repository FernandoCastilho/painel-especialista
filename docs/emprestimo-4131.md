# Empréstimo externo (4131) (11/11/2026)

Rota: `#calculadora/emprestimo-4131` (atalhos de terminal: `4131`, `LEI4131`, `EMPRESTIMO4131`).

Calcula o custo de um empréstimo em dólar tomado direto no exterior e compara três caminhos em reais: sem proteção, com swap para CDI e com NDF (termo de moeda sem entrega) em cada pagamento.

## Regras levantadas (fontes oficiais lidas em 11/11/2026)

| Tema | Regra | Fonte |
|---|---|---|
| Contratação | Livre, em qualquer moeda, sem aprovação prévia. Custos compatíveis com o mercado internacional e claros no contrato. | Res. BCB 278/2022, arts. 5º e 6º |
| Declaração ao BC | O devedor declara no SCE-Crédito a operação a partir de US$ 1 milhão. O código vai em toda remessa. Mudança de prazo ou condições: 30 dias. | Res. BCB 278, arts. 17, 21, 23 e 25 |
| Remessas | Limitadas a principal, juros e encargos. Liquidação antecipada permitida. | Res. BCB 278, arts. 7º e 8º |
| IOF-câmbio na entrada | Prazo médio até 364 dias: 3,5%. Acima: zero, na entrada e na saída. | Decreto 6.306/2007, art. 15-B, XII e XI |
| Liquidação antecipada | Se descumprir o prazo de 364 dias, IOF de 3,5% com multa e juros. | Decreto 6.306, art. 15-B, § 2º |
| IOF sobre derivativos | Zero desde 13/06/2013. | Decreto 6.306, art. 32-C, § 15 |
| IRRF sobre juros | 15%, só sobre os juros. Tomador assumindo o imposto: base reajustada (100 viram 117,65). | RIR/2018, arts. 760 e 786 |
| Swap | IR na fonte sobre o ganho na liquidação, 22,5% a 15% conforme o prazo; compensável no IRPJ. | IN RFB 1.585/2015, arts. 46, 50 e 70 |
| NDF | Sem ajuste diário e sem margem; liquida pela diferença no vencimento; fixing pela PTAX de D-1 (B3 aceita D-1 a D-5); exige CGD. IR na fonte de 0,005%. | Ficha B3 do Termo de Moeda; Lei 11.033/2004, art. 2º |
| PIS/Cofins | 4,65% sobre ganho financeiro, inclusive de hedge. Zero sobre a variação cambial do empréstimo. Zero para hedge de proteção em bolsa ou balcão organizado. | Decreto 8.426/2015, art. 1º, §§ 3º e 4º |
| Perdas no hedge | Sem o limite dos ganhos quando a operação protege obrigação da empresa. | Lei 8.981/1995, art. 77; IN 1.585, art. 71 |

## Contas (`src/emprestimo4131.js`)
- Datas: desembolso + meses, mantendo o dia (fim de mês quando o mês é mais curto). Sem ajuste para dia útil.
- Juros de cada período: principal × taxa × dias corridos ÷ 360. Principal no vencimento.
- IR do tomador (gross-up): juros × alíquota ÷ (1 − alíquota). Sem gross-up, zero.
- Fiança/SBLC: principal × % a.a. × dias corridos ÷ 360, paga com os juros.
- IOF na entrada: automático pelo prazo médio em dias corridos (principal no vencimento: prazo médio = prazo total).
- Valor líquido: principal − flat − IOF. Em reais, pelo câmbio de entrada.
- Custo all-in em dólar: taxa ao ano que zera o fluxo, em dias corridos/365.
- Sem proteção: câmbio de cada pagamento = entrada × (1 + variação a.a.)^(dc/365). Vale (1 + custo) = (1 + all-in) × (1 + variação).
- Câmbio a termo teórico: entrada × (1 + DI)^(du/252) ÷ (1 + cupom × dc/360). Dias úteis com os feriados nacionais.
- Swap: taxa que zera o fluxo em reais a termo (base 252), composta com o spread do banco. CDI + spread = (1 + custo) ÷ (1 + DI) − 1. % do CDI = taxa diária do custo ÷ taxa diária do DI.
- NDF: taxa a termo × (1 + acréscimo do banco) em cada pagamento. Custo prefixado em base 252 e em dias corridos/365.
- Ponto de equilíbrio: (1 + custo do NDF em 365) ÷ (1 + all-in em dólar) − 1.

## Premissas e limites
- Um DI e um cupom para todos os vencimentos (curvas planas). A mesa do banco usa uma taxa por prazo, o spread do derivativo e o risco de crédito da contraparte.
- Só principal no vencimento. Amortização ao longo do prazo não é coberta.
- Fora da conta: IR na fonte sobre ganho de swap ou NDF, PIS/Cofins, custo de garantias do derivativo.
- A leitura "CDI + spread" do swap usa o DI informado; o custo real segue o CDI de cada período.

## Pontos não confirmados em fonte oficial
- IOF de 3,5%: vigente por liminar do STF de 16/07/2025 (ADC 96, ADIs 7.827 e 7.839). Sem notícia de julgamento do Plenário até 01/11/2026, segundo fonte de terceiros.
- IRRF de 25% para país com tributação favorecida: texto oficial (IN RFB 1.455/2014) não foi aberto.
- Alíquota do swap: Lei 8.981, art. 74, fala em 10%; IN 1.585, em 22,5% a 15% (lida em cópia não oficial).
- NDF de balcão: alcance dos 0,005% e dos 15% sobre ganho líquido não está expresso nos textos lidos.
- Fórmulas oficiais de swap da B3 e norma de registro obrigatório de derivativos: páginas não abriram.

## Verificações
`node --test test/emprestimo-4131.test.mjs`: 11 testes com resultado em fórmula fechada (juros, gross-up, IOF por prazo, custo all-in, relação com a variação do dólar, câmbio a termo, leitura em CDI, ponto de equilíbrio, entradas inválidas).
Conferência no navegador da tela aberta com o exemplo padrão. Não há ainda conferência de navegador automática (`smoke`) nem revisão independente da conta.
