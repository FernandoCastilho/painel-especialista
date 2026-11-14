# Empréstimo externo (4131) (11/11/2026, ampliado em 14/11/2026)

Rota: `#calculadora/emprestimo-4131` (atalhos de terminal: `4131`, `LEI4131`, `EMPRESTIMO4131`).

Calcula o custo de um empréstimo em dólar ou em euro tomado direto no exterior e compara três caminhos em reais: sem proteção, com swap para CDI e com NDF (termo de moeda sem entrega) em cada pagamento. Desde 14/11/2026 aceita principal em parcelas e mostra o resultado com NDF no formato das cotações de banco (seção "Ampliação de 14/11/2026").

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

## Ampliação de 14/11/2026: parcelas, euro, cotações do dia e formato da cotação
Origem: pedido de Fernando para a calculadora simular a operação como as cotações de banco de 4131 com NDF. A conta foi remontada com convenções de mercado e com regras que o Painel já usava. Nada de material interno de banco nem de operação real entra no projeto: os testes usam números fictícios.

### Desenho da tela (formato da cotação)
Pedido de Fernando em 14/11/2026: a tela deve seguir a cotação de banco, sem excesso de campos.
- **À vista, seis campos**: valor em reais, moeda, cotação de partida, parcelas mensais (ou prazo total, fora do padrão), taxa all-in e data da cotação. O principal na moeda é o valor em reais ÷ cotação de partida e aparece como "Valor na moeda".
- **Proteção cambial (NDF)**: DI pré do prazo e cupom cambial (ou juro do euro). Na cotação de banco a taxa futura de cada parcela vem fechada pela mesa; a tela a estima com esses dois números.
- **Padrão, sem escolher**: pagamentos mensais, principal em parcelas iguais, datas a cada 30 dias em dia útil, carência zero, tarifa zero, fiança zero e IR já incluído na taxa all-in (nenhum gross-up é somado).
- **Mais opções** (recolhido, com a contagem do que está fora do padrão): frequência, regra das datas, amortização, carência, IR somado à taxa e alíquota, tarifa (flat), fiança, local de pagamento das comissões, acréscimo do banco no NDF e spread do banco no swap.
- **Resultado, na ordem da cotação**: custo efetivo total ao mês e ao ano (exp/360) com o equivalente em CDI; economia de IOF; equivalente em capital de giro; condições da operação; e o quadro parcela a parcela, aberto e em largura inteira (prazo, vencimento, amortização, saldo devedor, juros e encargos, parcela na moeda, taxa futura e parcela em reais).
- **Comparar com swap e sem proteção** (recolhido): a tabela dos três caminhos em base 252, a composição do custo na moeda e os cenários de câmbio. Nada foi retirado.
- Mudou o padrão de abertura da tela (antes: dólar, 24 meses, juros semestrais, principal no vencimento, IR somado à taxa, flat de 0,50%). As contas não mudaram.

### Entradas novas
- **Moeda**: dólar ou euro. A conta é a mesma. No euro, o campo de cupom vira "Juro do euro" (linear, base 360).
- **Pagamentos**: inclui mensal.
- **Principal**: no vencimento (padrão, sem mudança de resultado) ou em parcelas. Em parcelas, a amortização é constante: principal ÷ número de parcelas. A última parcela leva o saldo, para o total fechar no principal.
- **Carência do principal**: número de pagamentos só de juros antes da primeira parcela. As parcelas ocupam os pagamentos restantes.
- **Regra das datas**: dia fixo (padrão: mesmo dia do mês, sem ajuste) ou cada 30 dias. Na segunda regra, o primeiro pagamento é desembolso + 30 dias × meses do período, levado ao próximo dia útil (feriados nacionais); os demais são essa data + 30 dias × meses decorridos, cada um levado ao próximo dia útil. O ajuste de um pagamento não desloca os seguintes.
- **Câmbio**: já vem com a cotação do Painel (preço de compra, o mesmo da tela Mercado) da moeda escolhida, com data e hora ao lado. Fica a primeira cotação que chegar; cotações novas não mudam o resultado sozinhas (link Atualizar). Digitar passa a valer o digitado, com link para voltar à do Painel. Sem cotação, fica um valor de exemplo, avisado na tela.
- **DI pré do prazo**: já vem da curva DI x pré da B3 que o Painel coleta, para o prazo médio da operação: taxa a termo entre o desembolso e desembolso + prazo médio, em dias úteis (`diDoPrazo`). Arredondado a duas casas, como aparece no campo. Digitar passa a valer o digitado. Sem curva, com desembolso antes da data-base ou prazo além da curva, fica um valor de exemplo, avisado na tela.
- **Cupom cambial / juro do euro**: continua digitado. O valor inicial é de exemplo e a tela avisa.

### Contas novas (`src/emprestimo4131.js`)
- Juros e fiança de cada período: saldo devedor × taxa × dias corridos ÷ 360. Com principal no vencimento, o saldo é sempre o principal (resultado igual ao de antes).
- Prazo médio: soma(amortização × dias corridos desde o desembolso) ÷ principal. Para a regra do IOF vale o inteiro arredondado para baixo (cobra na dúvida); a média exata fica em `avgTermExact` e a tela avisa quando ela cai entre 355 e 365 dias. É o prazo usado no IOF-câmbio da entrada: parcelas encurtam o prazo médio e podem trazer o IOF de 3,5% (18 meses em parcelas mensais têm prazo médio perto de 290 dias).
- Custo efetivo com NDF, formato da cotação: taxa interna `y` do fluxo em reais (valor líquido recebido contra as parcelas travadas no NDF), com tempo em dias corridos ÷ 365. Ao mês: (1 + y)^(30/365) − 1. Ao ano, exp/360: (1 + y)^(360/365) − 1, que é o mês composto 12 vezes.
- Economia de IOF (`iofGiro4131`): IOF de crédito que um capital de giro em reais pagaria com o mesmo valor e o mesmo cronograma de principal, pessoa jurídica fora do Simples: 0,38% × principal em reais + soma(parcela de principal em reais × 0,0082% × mínimo(dias corridos, 365)). Principal em reais pelo câmbio de entrada. Alíquotas de `IOF_PJ` (`src/emprestimo.js`), as mesmas das outras calculadoras.
- Equivalente em capital de giro: a mesma taxa interna, com o IOF do giro somado ao valor líquido recebido; lida ao mês e ao ano do mesmo jeito. Giro com taxa abaixo dela sai mais barato que o 4131 com NDF.
- Equivalente em CDI: o spread sobre o CDI que a tela já calculava para o NDF (cada pagamento descontado pelo fator do DI do seu prazo, base 252).

### Conferência contra uma cotação de banco
Feita em 14/11/2026, fora do projeto, contra uma cotação de banco de 4131 com NDF em parcelas mensais. Nenhum número dela foi gravado. Bateram as datas, o prazo médio, o saldo e as parcelas na moeda (diferença de centavos, por arredondamento da taxa exibida) e a economia de IOF, ao centavo. O custo efetivo e o equivalente em giro ficaram a cerca de 0,01 ponto percentual ao ano, com uma hipótese para a parte das taxas futuras que não estava disponível.

### Revisões de 14/11/2026
- **Revisão independente da conta**: reimplementação em Python escrita só a partir desta nota, antes de ler o motor. 24 casos fictícios (261 datas): maior diferença na casa de 10⁻¹³ em custo all-in, total com NDF, custo base 252, custo ao mês e ao ano exp/360, economia de IOF, equivalente em giro, spread sobre o CDI, prazo médio, IOF-câmbio e datas. DI do prazo: 18 consultas em 3 curvas, diferença máxima de 3×10⁻¹² p.p. Principal no vencimento: versão anterior do motor contra a nova em 6.000 casos aleatórios, sem diferença em nenhum campo. Nenhum erro de conta; as premissas apontadas estão em "Limites desta ampliação" e viraram avisos na tela.
- **Revisão visual (Diretor de Arte)**: aprovada com ajustes, todos aplicados: origem de cada cotação (Painel, digitado ou exemplo), aviso do IOF-câmbio no quadro da economia de IOF, título da convenção exp/360, ordem e rótulos dos campos, celular e larguras de notebook.

### Limites desta ampliação
- Prazo médio entre 364 e 365 dias: a tela arredonda para baixo e cobra o IOF de 3,5% (o texto legal fala em prazo médio mínimo de até 364 dias). Não foi confirmado como banco e Banco Central arredondam. A diferença é de 3,5% do principal; a tela avisa na fronteira.
- Regra de 30 dias: 12 meses somam 360 dias e trazem o IOF de 3,5%, que uma operação contratada com 365 dias não paga. A regra foi conferida contra cotação de banco só em parcelas mensais; em trimestral e semestral segue a mesma lógica, sem conferência externa.
- Leitura exp/360: fica abaixo da mesma taxa lida em ano de 365 dias (20% a.a. em 365 dias viram 19,70% a.a. e 1,51% a.m.). Comparar com giro cotado por mês de calendário ou com CET em 365 dias favorece o 4131 em cerca de 0,02 ponto ao mês. A ajuda do quadro mostra a taxa em 365 dias.
- Equivalente em giro: o IOF do giro é calculado sobre principal × câmbio, não sobre o valor que o giro precisaria ter para entregar o mesmo líquido (diferença de −0,08 a +0,13 ponto ao ano nos exemplos da revisão). Fica de fora: tarifa do giro, reciprocidade e limite de crédito do NDF. A igualdade só é exata contra um giro com parcelas iguais nas mesmas datas.
- Economia de IOF e IOF-câmbio usam as alíquotas atuais para qualquer data; para desembolso antes de 17/07/2025 a tela avisa.
- Dias úteis do DI: contagem do Painel (data inicial fora, final dentro). Quando o pagamento cai em dia não útil, conta um dia útil a menos que a convenção de mercado; efeito de centésimos de ponto. Anterior a esta ampliação.
- Prazo que não é múltiplo do período, em parcelas: a última parcela vence no fim do prazo, em intervalo mais curto; a tela avisa.
- A cotação de banco usa a taxa futura fechada pela mesa em cada vencimento. A tela estima o câmbio a termo com um DI e um juro da moeda iguais para todos os prazos: o custo fica próximo, não igual.
- O expoente da leitura ao mês (30/365) foi inferido pela conferência numérica: com 30/365, custo e giro fecham ao mesmo tempo; com 30/360, não. Falta confirmar a convenção em fonte escrita.
- O equivalente em CDI não foi conferido contra uma fórmula de banco.
- O custo ao ano aparece em duas convenções na mesma tela: base 252 (tabela dos três caminhos) e exp/360 (quadro da cotação). Os rótulos dizem qual é qual.
- Economia de IOF considera pessoa jurídica fora do Simples e não considera isenções ou alíquota zero de casos específicos.
- Juro do euro: o Painel não coleta; fica digitado.
- Sistema de amortização: só constante. Price e cronogramas livres não são cobertos.

## Premissas e limites
- Um DI e um cupom para todos os vencimentos (curvas planas). A mesa do banco usa uma taxa por prazo, o spread do derivativo e o risco de crédito da contraparte.
- Principal no vencimento ou em parcelas iguais (ver a ampliação de 14/11/2026). Outros sistemas de amortização não são cobertos.
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
`node --test test/emprestimo-4131*.test.mjs`: 36 testes (20 anteriores e 16 de `test/emprestimo-4131-parcelas.test.mjs`: parcelas, prazo médio, IOF por prazo médio, carência, datas a cada 30 dias, custo exp/360, economia de IOF, equivalente em giro, euro, regressão do principal no vencimento com números gravados da versão anterior, prazo médio na fronteira de 364 dias, regra de 30 dias no semestral, prazo não múltiplo do período e DI do prazo). Conta com resultado em fórmula fechada (juros, gross-up, IOF por prazo, custo all-in, relação com a variação do dólar, câmbio a termo, leitura em CDI, ponto de equilíbrio, entradas inválidas), IR sobre comissões ao exterior, spread do swap sem custos de entrada, fatores por curva e cópia congelada da apresentação e do PDF.
Conferência no navegador em 1440 px e 375 px: simulação, aba de regras, apresentação (6 slides), prévia do PDF e ausência de rolagem lateral da página.
Revisão independente da conta em 11/11/2026, em duas rodadas: reimplementação em Python, 12 casos na primeira (diferença máxima de 2×10⁻¹⁴ contra o motor) e 12 na segunda, cobrindo spread do swap, IR sobre comissões e curvas (diferença máxima de 1×10⁻¹³). Achados de rótulo e de validação de data corrigidos; os de premissa estão em "Premissas e limites".
Conferência de navegador automática: `scripts/smoke-emprestimo-4131.cjs` (390 e 1440 px), também no CI, com cotações e curva DI simuladas: câmbio e DI do dia preenchidos, três parcelas mensais no formato da cotação (recalculadas à parte), carência, datas a cada 30 dias, euro, pagamento único de 6 meses com IOF de 3,5%, números recalculados à parte, IR sobre comissões ao exterior, aviso de desembolso futuro, apresentação, prévia do PDF e aba de regras.
