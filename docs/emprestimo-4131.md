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
- Flat e fiança pagos ao exterior (opção na tela, desligada por padrão): o mesmo IR incide sobre a comissão (RIR/2018, art. 760 cita comissões). Com gross-up, o IR do flat sai do valor recebido na entrada e o da fiança é pago com ela.
- Fiança/SBLC: principal × % a.a. × dias corridos ÷ 360, paga com os juros.
- IOF na entrada: automático pelo prazo médio em dias corridos (principal no vencimento: prazo médio = prazo total).
- Valor líquido: principal − flat − IOF − IR sobre o flat (quando pago ao exterior). Em reais, pelo câmbio de entrada.
- Custo all-in em dólar: taxa ao ano que zera o fluxo, em dias corridos/365.
- Sem proteção: câmbio de cada pagamento = entrada × (1 + variação a.a.)^(dc/365). Vale (1 + custo) = (1 + all-in) × (1 + variação).
- Câmbio a termo teórico: entrada × (1 + DI)^(du/252) ÷ (1 + cupom × dc/360). Dias úteis com os feriados nacionais.
- Swap, custo total: taxa que zera o fluxo em reais a termo sobre o valor líquido (base 252), composta com o spread do banco. Spread sobre o CDI: mesma conta com cada pagamento descontado pelo fator do DI do seu prazo; com um DI único, equivale a (1 + custo) ÷ (1 + DI) − 1. % do CDI = taxa diária do custo ÷ taxa diária do DI até o vencimento.
- Swap, spread do swap: a mesma leitura calculada sobre o principal × câmbio de entrada, sem flat, IOF e IR do flat. Inclui juros, IR do tomador, fiança e o spread do banco. Sem fiança, é o número mais próximo da cotação da mesa (que cota o swap sobre juros e principal).
- NDF: taxa a termo × (1 + acréscimo do banco) em cada pagamento. Custo prefixado em base 252 e em dias corridos/365.
- Ponto de equilíbrio: (1 + custo do NDF em 365) ÷ (1 + all-in em dólar) − 1.

## Premissas e limites
- Um DI e um cupom para todos os vencimentos (curvas planas). A mesa do banco usa uma taxa por prazo, o spread do derivativo e o risco de crédito da contraparte.
- Só principal no vencimento. Amortização ao longo do prazo não é coberta.
- Fora da conta: IR na fonte sobre ganho de swap ou NDF, PIS/Cofins, custo de garantias do derivativo.
- A leitura "CDI + spread" do swap usa o DI informado; o custo real segue o CDI de cada período. É o custo total equivalente: inclui flat, IOF, IR e fiança diluídos no prazo, por isso fica acima do spread que a mesa cota para o swap (em 6 meses com IOF de 3,5%, a diferença passa de 8 pontos percentuais).
- Sem proteção em dias corridos/365; swap e NDF em base 252. O ponto de equilíbrio usa 365 dos dois lados.
- Um cupom linear igual em todos os prazos não é curva plana: encarece a leitura em prazo longo (taxa igual ao cupom, sem custos: CDI + 0,19% em 24 meses, + 0,51% em 60, + 0,90% em 120).
- Spread do swap composto com o custo, não somado. Acréscimo do NDF é percentual fixo sobre o termo: pesa mais ao ano em prazo curto.
- Custo acima de 1.000% a.a. não é calculado. Prazos muito longos com juros trimestrais recalculam devagar.

## Curvas do Painel: prontas no motor, desligadas na tela
`curveFactors` monta os fatores de DI e de cupom por prazo a partir das curvas da B3 que o Painel já coleta, e `hedge4131` aceita esses fatores (testes em `test/emprestimo-4131-curvas.test.mjs`). A opção está desligada na tela (`CURVAS_DO_PAINEL = false`) porque a curva de cupom coletada é a DI x dólar das taxas referenciais da B3, que é o cupom sujo: referido à PTAX do dia anterior, com o trecho curto distorcido (em 10/11/2026, −9,32% a.a. em 21 dias úteis e 0,81% em 63). Usá-la com o câmbio do dia desloca todo o câmbio a termo na proporção câmbio do dia ÷ PTAX anterior, cerca de 1% naquela data. Com câmbio 1,2% acima da PTAX anterior, o erro no spread do swap seria de cerca de +0,65 p.p. em 24 meses e +2,6 p.p. em 6 meses. Para religar: coletar o cupom limpo (a B3 publica nas mesmas taxas referenciais; código a confirmar) ou limpar o sujo com a PTAX de referência, rever a regra "antes do primeiro vértice vale a taxa dele", conferir se as duas curvas têm a mesma data-base e validar contra uma cotação de mesa.

## Pontos não confirmados em fonte oficial
- IR na fonte sobre flat e fiança pagos ao exterior: o art. 760 do RIR/2018 cita comissões, mas a aplicação a cada tipo de comissão deve ser confirmada com o tributário.
- IOF de 3,5%: vigente por liminar do STF de 16/07/2025 (ADC 96, ADIs 7.827 e 7.839). Sem notícia de julgamento do Plenário até 01/11/2026, segundo fonte de terceiros.
- IRRF de 25% para país com tributação favorecida: texto oficial (IN RFB 1.455/2014) não foi aberto.
- Alíquota do swap: Lei 8.981, art. 74, fala em 10%; IN 1.585, em 22,5% a 15% (lida em cópia não oficial).
- NDF de balcão: alcance dos 0,005% e dos 15% sobre ganho líquido não está expresso nos textos lidos.
- Fórmulas oficiais de swap da B3 e norma de registro obrigatório de derivativos: páginas não abriram.

## Tela (padrão da calculadora BNDES)
`src/Emprestimo4131.jsx` usa a mesma estrutura e o mesmo estilo do BNDES (`BndesWorkspace.css`): cartão claro, título com abas (Simular · Regras e fontes), grupos Operação, Custos e tributos e Proteção cambial à esquerda; à direita, botões Apresentar simulação e Imprimir PDF, cotação comparativa em destaque com ampliação na tela, composição do custo, cenários de câmbio, cronograma e premissas recolhidos.
- Apresentação (`Emprestimo4131Presentation.jsx`) e PDF (`Emprestimo4131Print.jsx`) trabalham sobre uma cópia congelada (`emprestimo4131Presentation.js`): não recalculam nem buscam taxa nova.
- Estilo próprio só em `Emprestimo4131.css` (grade da proteção cambial e lista de regras).
- A aba Regras e fontes mostra as regras da tabela acima, com a fonte de cada uma.

## Verificações
`node --test test/emprestimo-4131*.test.mjs`: 20 testes. Conta com resultado em fórmula fechada (juros, gross-up, IOF por prazo, custo all-in, relação com a variação do dólar, câmbio a termo, leitura em CDI, ponto de equilíbrio, entradas inválidas), IR sobre comissões ao exterior, spread do swap sem custos de entrada, fatores por curva e cópia congelada da apresentação e do PDF.
Conferência no navegador em 1440 px e 375 px: simulação, aba de regras, apresentação (6 slides), prévia do PDF e ausência de rolagem lateral da página.
Revisão independente da conta em 11/11/2026, em duas rodadas: reimplementação em Python, 12 casos na primeira (diferença máxima de 2×10⁻¹⁴ contra o motor) e 12 na segunda, cobrindo spread do swap, IR sobre comissões e curvas (diferença máxima de 1×10⁻¹³). Achados de rótulo e de validação de data corrigidos; os de premissa estão em "Premissas e limites".
Não há ainda conferência de navegador automática (`smoke`).
