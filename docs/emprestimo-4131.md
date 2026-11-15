# Empréstimo externo (4131) (11/11/2026, ampliado em 14/11/2026)

Rota: `#calculadora/emprestimo-4131` (atalhos de terminal: `4131`, `LEI4131`, `EMPRESTIMO4131`).

Calcula o custo de um empréstimo em dólar ou em euro tomado direto no exterior e compara três caminhos em reais: sem proteção, com swap para CDI e com NDF (termo de moeda sem entrega) em cada pagamento. Desde 14/11/2026 aceita principal em parcelas e mostra o resultado com NDF no formato das cotações de banco (seção "Ampliação de 14/11/2026").

## Regras levantadas (fontes oficiais lidas em 11/11/2026; IOF relido em 14 e 15/11/2026)

| Tema | Regra | Fonte |
|---|---|---|
| Contratação | Livre, em qualquer moeda, sem aprovação prévia. Custos compatíveis com o mercado internacional e claros no contrato. | Res. BCB 278/2022, arts. 5º e 6º |
| Declaração ao BC | O devedor declara no SCE-Crédito a operação a partir de US$ 1 milhão. O código vai em toda remessa. Mudança de prazo ou condições: 30 dias. | Res. BCB 278, arts. 17, 21, 23 e 25 |
| Remessas | Limitadas a principal, juros e encargos. Liquidação antecipada permitida. | Res. BCB 278, arts. 7º e 8º |
| IOF de crédito | Não incide sobre operação de crédito externo; o imposto da operação é o IOF-câmbio. | Decreto 6.306/2007, art. 2º, § 2º |
| IOF-câmbio na entrada | Ingresso de empréstimo externo sujeito a registro no Banco Central, contratado direto ou por emissão de títulos, com prazo médio mínimo de até 364 dias: 3,5%, inclusive em operações simultâneas. Demais ingressos e saídas de empréstimos e financiamentos externos: zero. | Decreto 6.306/2007, art. 15-B, XI e XII (o XII com a redação do Decreto 12.499/2025; o XI vem do Decreto 8.325/2014) |
| IOF-câmbio na saída | Zero nas liquidações de câmbio de saída de recursos referentes a empréstimos e financiamentos externos. | Decreto 6.306, art. 15-B, XI |
| Quem cobra e quando | Fato gerador e cobrança na liquidação da operação de câmbio. Base: o valor em reais da operação. Contribuinte: quem compra ou vende a moeda. Responsável por cobrar e recolher: a instituição autorizada a operar em câmbio, até o terceiro dia útil seguinte ao decêndio. | Decreto 6.306, arts. 11 a 14 e 17 |
| Prazo médio | Média ponderada das parcelas de amortização de principal, com os prazos de amortização de cada parcela como fator de ponderação: soma(parcela × dias) ÷ principal. Juros não entram: só as parcelas de principal. Aplica-se também a empréstimo intercompanhia, qualquer que seja a participação no capital. O texto do ato não traz regra de arredondamento. | ADI RFB 41/2011, art. 1º, §§ 1º e 2º (DOU 02/08/2011, p. 19); SC Disit/SRRF08 234/2012 |
| Descumprimento do prazo | Perda do benefício da alíquota zero com efeitos retroativos: imposto pela alíquota vigente na data de liquidação do câmbio de ingresso, com juros moratórios e multa. | SC Cosit 61/2014 |
| Renovação, repactuação, assunção e conversão em capital | Renovação, repactuação e assunção de obrigação estão sujeitas a operações simultâneas de câmbio, consideradas operações efetivas. Conversão do empréstimo em investimento direto antes do prazo médio mínimo caracteriza liquidação antecipada; na conversão, a saída para quitar o empréstimo e a entrada para integralizar capital têm alíquota zero. Decisões dadas sob a regra anterior (art. 15-A, XXII: 6% e prazos de 720 a 1.080 dias), de mesma estrutura da atual. | SC Cosit 248/2014, 261/2014 e 597/2017 |
| Liquidação antecipada | Total ou parcial. Descumprido o prazo médio mínimo: imposto à alíquota do inciso XII, com juros moratórios e multa, sem prejuízo das penalidades do art. 23 da Lei 4.131/1962 e do art. 72 da Lei 9.069/1995. Prazo médio menor que o contratado, mas cumprido o mínimo: alíquota em vigor na data da liquidação do câmbio do pagamento. | Decreto 6.306, art. 15-B, §§ 2º e 3º |
| Títulos com put/call | Em empréstimo via títulos com cláusula de antecipação, a primeira data prevista de exercício define a incidência. | Decreto 6.306, art. 15-B, § 1º |
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
- **À vista, seis campos para preencher**: principal em reais (sempre em reais, primeiro campo), moeda, cotação de partida, parcelas mensais (ou prazo total, fora do padrão), taxa all-in e data da cotação. Logo depois da moeda, um campo somente de leitura mostra o valor convertido ("Valor em dólar" ou "Valor em euro"): principal em reais ÷ cotação de partida.
- **Proteção cambial (NDF)**: DI pré do prazo e cupom cambial (ou juro do euro). Na cotação de banco a taxa futura de cada parcela vem fechada pela mesa; a tela a estima com esses dois números.
- **Padrão, sem escolher**: pagamentos mensais, principal em parcelas iguais, datas a cada 30 dias em dia útil, carência zero, tarifa zero, fiança zero e IR já incluído na taxa all-in (nenhum gross-up é somado).
- **Mais opções** (recolhido, com a contagem do que está fora do padrão): frequência, regra das datas, amortização, carência, IR somado à taxa e alíquota, tarifa (flat), fiança, local de pagamento das comissões, acréscimo do banco no NDF e spread do banco no swap.
- **Resultado, na ordem da cotação**: custo efetivo total ao mês e ao ano (exp/360) com o equivalente em CDI; economia de IOF; equivalente em capital de giro; condições da operação; e o quadro parcela a parcela, aberto e em largura inteira (prazo, vencimento, amortização, saldo devedor, juros e encargos, parcela na moeda, taxa futura e parcela em reais).
- **Taxa futura** (no grupo da proteção): "Estimar" (padrão) ou "Colar as da mesa". Colando, o usuário informa as taxas futuras fechadas da cotação, uma por pagamento, na ordem dos vencimentos (uma por linha; vírgula ou ponto decimal; `lerTaxasFuturas`). `hedge4131` recebe `forwards` e usa essas taxas no lugar do câmbio a termo teórico: parcela em reais = parcela na moeda × taxa colada (× acréscimo do banco, se houver). O juro da moeda deixa de ser usado e a tela mostra o implícito no vencimento. O DI continua valendo para o equivalente em CDI e para a comparação em base 252. Quantidade diferente do número de pagamentos, zero ou texto são recusados. A comparação com swap usa as mesmas taxas.
- **Atingir meta** (no topo): o usuário informa a meta (custo efetivo ao mês, custo efetivo ao ano ou equivalente em CDI +) e a tela calcula a taxa all-in que leva o resultado com NDF a ela (`metaTaxa4131`). Busca por bisseção entre 0% e 100% a.a., porque o custo cresce com a taxa; o resto da operação fica igual. A taxa vai para o campo com quatro casas, então o resultado pode diferir da meta na quarta casa. Meta abaixo do custo com taxa zero (o câmbio a termo já embute a diferença de juros) ou acima do alcance é recusada com explicação.
- **Condições da operação** na ordem dos e-mails de cotação (data, produto, valor de principal, moeda, cotação de partida, taxa, prazo, principal, juros, prazo médio, carência, tarifa e IOF-câmbio), com o botão **Copiar resumo** (`resumoE4`): texto com as condições, o custo efetivo com o equivalente em CDI, a economia de IOF e a taxa equivalente em capital de giro. Tomador, CNPJ, credor e garantias ficam de fora: são dados do cliente e não passam pela calculadora.
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
- Prazo médio: soma(amortização × dias corridos desde o desembolso) ÷ principal. Para a regra do IOF vale a média exata (`avgTermExact`): até 364 dias paga 3,5%; qualquer fração acima de 364 não paga. O número mostrado (`avgTermDays`) é a média arredondada para cima, o que leva à mesma decisão. Decisão de Fernando em 14/11/2026; antes a tela arredondava para baixo. A tela avisa quando a média fica entre 355 e 365 dias. É o prazo usado no IOF-câmbio da entrada: parcelas encurtam o prazo médio e podem trazer o IOF de 3,5% (18 meses em parcelas mensais têm prazo médio perto de 290 dias).
- Custo efetivo com NDF, formato da cotação: taxa interna `y` do fluxo em reais (valor líquido recebido contra as parcelas travadas no NDF), com tempo em dias corridos ÷ 365. Ao mês: (1 + y)^(30/365) − 1. Ao ano, exp/360: (1 + y)^(360/365) − 1, que é o mês composto 12 vezes.
- Economia de IOF (`iofGiro4131`): IOF de crédito que um capital de giro em reais pagaria com o mesmo valor e o mesmo cronograma de principal, pessoa jurídica fora do Simples: 0,38% × principal em reais + soma(parcela de principal em reais × 0,0082% × mínimo(dias corridos, 365)). Principal em reais pelo câmbio de entrada. Alíquotas de `IOF_PJ` (`src/emprestimo.js`), as mesmas das outras calculadoras.
- Equivalente em capital de giro: a mesma taxa interna, com o IOF do giro somado ao valor líquido recebido; lida ao mês e ao ano do mesmo jeito. Giro com taxa abaixo dela sai mais barato que o 4131 com NDF.
- Equivalente em CDI: o spread sobre o CDI que a tela já calculava para o NDF (cada pagamento descontado pelo fator do DI do seu prazo, base 252).

### Revisões de 14/11/2026
- **Revisão independente da conta**: reimplementação em Python escrita só a partir desta nota, antes de ler o motor. 24 casos fictícios (261 datas): maior diferença na casa de 10⁻¹³ em custo all-in, total com NDF, custo base 252, custo ao mês e ao ano exp/360, economia de IOF, equivalente em giro, spread sobre o CDI, prazo médio, IOF-câmbio e datas. DI do prazo: 18 consultas em 3 curvas, diferença máxima de 3×10⁻¹² p.p. Principal no vencimento: versão anterior do motor contra a nova em 6.000 casos aleatórios, sem diferença em nenhum campo. Nenhum erro de conta; as premissas apontadas estão em "Limites desta ampliação" e viraram avisos na tela.
- **Revisão visual (Diretor de Arte)**: aprovada com ajustes, todos aplicados: origem de cada cotação (Painel, digitado ou exemplo), aviso do IOF-câmbio no quadro da economia de IOF, título da convenção exp/360, ordem e rótulos dos campos, celular e larguras de notebook.

### Revisão da regra do prazo médio exato (14/11/2026)
- **Revisão independente da conta**: prazo médio refeito por fora, com calendário próprio e aritmética de inteiros, em 8,8 milhões de combinações fictícias (datas de 2026 a 2028, 1 a 60 meses, todas as frequências, carências e regras de data) e 400 mil de prazos longos: nenhuma divergência em datas, prazo médio, alíquota e valor do IOF. Na comparação com a versão anterior, o IOF só mudou (de 3,5% para zero) entre 364 e 365 dias, e o prazo mostrado só subiu um dia quando há fração. A folga de 1e-9 da comparação é necessária: sem ela, parte dos casos de 364 dias cravados sairia com IOF zero por ruído da conta. Sem erro de conta.
- **Aplicado da revisão**: o aviso da fronteira deixou de aparecer com 365 dias cravados; dois testes novos (fração pequena acima de 364; 364 cravados com principal quebrado).
- **Efeito colateral medido**: o DI sugerido passa a ser lido para o prazo médio mostrado, até um dia útil adiante: cerca de 0,003 ponto percentual perto de um ano, em curvas fictícias.

### Revisões do desenho no formato da cotação (14/11/2026)
- **Revisão independente do atingir meta**: 48 operações fictícias e 1.536 metas, todas atingidas; maior desvio de 0,00017 ponto percentual, dentro do arredondamento da taxa a quatro casas; taxa conferida contra raiz própria. O custo cresce com a taxa em todos os 67.968 pontos testados. Sem erro de conta. Aplicado: meta com o campo da taxa vazio, meta negativa em CDI, mínimo com quatro casas, teto da busca que desce em operação muito curta com tarifa alta, e os textos do resumo (IR somado com alíquota e taxa final, fiança, acréscimo no NDF, aviso do IOF-câmbio, sinal do CDI, convenção exp/360).
- **Revisão independente das taxas coladas**: conta por fora em 42 operações fictícias e 606 pagamentos, com diferença máxima na casa de 10⁻¹⁴ ponto percentual; colando as taxas que o próprio motor estima, o resultado é idêntico ao do modo estimado. Sem erro de conta. Aplicado: avisos, sem bloquear, para taxa menor que a anterior, juro implícito fora de −20% a 40% a.a., custo negativo e acréscimo do banco por cima das taxas coladas; faixa do juro implícito entre as parcelas; DI usado ao lado do CDI +; lista com posição vazia recusada; caracteres invisíveis removidos do texto colado; textos que diziam "teórica" no modo colado.
- **Revisão visual (Diretor de Arte)** do desenho novo: aprovada com ajustes, todos aplicados: condições em uma coluna sem quebrar número, tabela do celular com as quatro colunas essenciais, mensagem única ao colar taxas, botão da meta sem competir com o resultado, rótulos e toque no celular.

### Limites do modo de taxas coladas
- O equivalente em CDI passa a depender quase ponto por ponto do DI informado (no modo estimado, não depende). Use o DI do momento da cotação da mesa. A tela mostra o DI usado ao lado do CDI +.
- A coluna "Com swap" da comparação usa as mesmas taxas coladas: é o fluxo do NDF lido em CDI, não uma cotação de swap, e já traz a margem embutida nas taxas da mesa.
- O juro da moeda implícito depende do DI e da cotação de partida informados; serve de conferência grosseira da colagem, não de taxa de mercado.
- Taxas implausíveis geram aviso, não bloqueio: a conta é feita com o que foi colado.

### Limites desta ampliação
- Prazo médio entre 364 e 365 dias: a tela usa o prazo exato, mostra 365 e aplica IOF zero (o texto legal fala em prazo médio mínimo de até 364 dias). Não localizamos regra oficial de arredondamento nem confirmamos como banco e Receita tratam a fração: se desprezarem a fração, o IOF é de 3,5% do valor que entra. A tela avisa na fronteira, e o mesmo aviso acompanha o resumo copiado, o PDF e a apresentação (`avisoFronteiraE4`).
- Regra de 30 dias: 12 meses somam 360 dias e trazem o IOF de 3,5%, que uma operação contratada com 365 dias não paga. Em trimestral e semestral a regra segue a mesma lógica do mensal (90 e 180 dias por período).
- Leitura exp/360: fica abaixo da mesma taxa lida em ano de 365 dias (20% a.a. em 365 dias viram 19,70% a.a. e 1,51% a.m.). Comparar com giro cotado por mês de calendário ou com CET em 365 dias favorece o 4131 em cerca de 0,02 ponto ao mês. A ajuda do quadro mostra a taxa em 365 dias.
- Equivalente em giro: o IOF do giro é calculado sobre principal × câmbio, não sobre o valor que o giro precisaria ter para entregar o mesmo líquido (diferença de −0,08 a +0,13 ponto ao ano nos exemplos da revisão). Fica de fora: tarifa do giro, reciprocidade e limite de crédito do NDF. A igualdade só é exata contra um giro com parcelas iguais nas mesmas datas.
- Economia de IOF e IOF-câmbio usam as alíquotas atuais para qualquer data; para desembolso antes de 17/07/2025 a tela avisa.
- Dias úteis do DI: contagem do Painel (data inicial fora, final dentro). Quando o pagamento cai em dia não útil, conta um dia útil a menos que a convenção de mercado; efeito de centésimos de ponto. Anterior a esta ampliação.
- Prazo que não é múltiplo do período, em parcelas: a última parcela vence no fim do prazo, em intervalo mais curto; a tela avisa.
- A cotação de banco usa a taxa futura fechada pela mesa em cada vencimento. A tela estima o câmbio a termo com um DI e um juro da moeda iguais para todos os prazos: o custo fica próximo, não igual.
- O expoente da leitura ao mês (30/365) é convenção adotada pela tela; falta confirmar em fonte escrita.
- O equivalente em CDI é convenção adotada pela tela; falta confirmar em fonte escrita.
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

## Regras do IOF: o que foi lido e como (14 e 15/11/2026)
- **Lido na íntegra**, no texto atualizado do Decreto 6.306/2007 publicado pela Câmara dos Deputados: art. 2º, § 2º; arts. 11 a 14; art. 15-B, caput, incisos XI e XII e §§ 1º a 3º; art. 17; art. 32-C, § 15. O decreto não traz fórmula do prazo médio.
- **Lido na íntegra**: Manual do Declarante do SCE-Crédito do Banco Central (versão de outubro de 2026). Não traz definição nem fórmula de prazo médio.
- **Lido na íntegra em 15/11/2026, no site de normas da Receita Federal**: Ato Declaratório Interpretativo RFB 41, de 01/08/2011 (DOU de 02/08/2011, página 19). O site o mostra como vigente e sem modificação por outro ato. O art. 1º, § 2º, define o prazo médio mínimo como a média ponderada das parcelas de amortização de principal, com os prazos de amortização de cada parcela como fator de ponderação; o § 1º estende a regra a empréstimo intercompanhia. O caput ainda cita a regra da época (art. 15-A, XXII: 720 dias e 6%); a definição do prazo médio é a que vale para o inciso XII atual. A fórmula em si só aparece na página do Diário Oficial ("A Fórmula encontra-se publicada na pág. 19") e não foi vista; a definição em palavras é a mesma média da calculadora. O texto do ato não traz regra de arredondamento nem de fração de dia.
- **Lidas as ementas em 15/11/2026, na busca do mesmo site** (não o inteiro teor): SC Disit/SRRF08 234/2012 (juros não entram no prazo médio; só as parcelas de principal); SC Cosit 61/2014 (descumprimento do prazo: perda retroativa da alíquota zero, imposto pela alíquota da data do câmbio de ingresso, com juros e multa); SC Cosit 248/2014 (renovação, repactuação e assunção sujeitas a operações simultâneas de câmbio); SC Cosit 261/2014 e SC Cosit 597/2017 (conversão do empréstimo em investimento direto). Todas tratam da regra anterior, de mesma estrutura.
- **Vigência da alíquota de 3,5%**: redação do Decreto 12.499/2025, sustada pelo Decreto Legislativo 176/2025 e restabelecida por decisão cautelar do STF na ADC 96, de 16/07/2025. Segundo fontes de terceiros, sem referendo do Plenário nem julgamento de mérito até 01/11/2026.
- **A conta da calculadora** usa a média ponderada definida no ato: soma(amortização × dias corridos desde o desembolso) ÷ principal. Na fronteira entre 364 e 365 dias a tela decide pelo prazo exato, mostra o número arredondado para cima e avisa (ver "Limites desta ampliação").

## Conferência de vigência das normas (15/11/2026)
Pedido de Fernando: conferir as leis atualizadas, para não haver nada desatualizado nos cálculos. Resultado: nenhuma alíquota ou regra usada nas contas mudou.

| O que a calculadora usa | Norma | Onde foi conferido em 15/11/2026 | Situação |
|---|---|---|---|
| IOF-câmbio de 3,5% com prazo médio até 364 dias; zero acima | Decreto 6.306/2007, art. 15-B, XI e XII | Texto atualizado da Câmara, baixado no dia (idêntico ao de 14/11) | Em vigor, com remissão ao Decreto Legislativo 176/2025 e à ADC 96 |
| IOF do capital de giro (comparação): 0,0082% ao dia, teto de 365 dias, mais 0,38% | Decreto 6.306/2007, art. 7º, I, b, e §§ 1º e 15 | Mesmo texto da Câmara | Em vigor, com a mesma remissão |
| Cálculo do prazo médio | ADI RFB 41/2011 | Site de normas da Receita | Vigente, sem alteração |
| IR na fonte de 15% sobre os juros | RIR/2018, art. 760; IN RFB 1.455/2014, art. 9º | IN no site da Receita (a alteração de 2025, IN RFB 2.271, não trata de juros de empréstimo). RIR não relido nesta data | IN vigente |
| IOF zero sobre derivativos | Decreto 6.306, art. 32-C, § 15; IN RFB 1.969/2020, art. 18 | Site da Receita (alterações de 2025 e 2026, IN RFB 2.286 e 2.334, tratam de outros temas) | Vigente |
| IR sobre swap (22,5% a 15%) e NDF (0,005%) | IN RFB 1.585/2015, arts. 46, 50, 63 e 70 | Site da Receita | Vigente; última alteração em 2019 |
| Declaração e remessas do crédito externo | Res. BCB 278/2022 | Site do Banco Central, versão atualizada em 30/09/2026 | Vigente. As Resoluções BCB 521/2025 e 575/2026 mudaram redações (ativos virtuais; prazo da declaração até o ingresso dos recursos), sem efeito nas contas |
| PIS/Cofins de 4,65% sobre ganho financeiro (fora da conta) | Decreto 8.426/2015 | Fontes de terceiros | Vale em 2026; extinto em 2027 pela reforma tributária |

Também foram vistas as ementas dos atos e decisões da Receita de 2025 e 2026 sobre IOF de câmbio (busca no site de normas): nenhuma trata de empréstimo externo ou de prazo médio.

## Pontos não confirmados em fonte oficial
- IR na fonte sobre flat e fiança pagos ao exterior: o art. 760 do RIR/2018 cita comissões, mas a aplicação a cada tipo de comissão deve ser confirmada com o tributário.
- IOF de 3,5% e alíquota diária de 0,0082% do capital de giro: vigentes por liminar do STF de 16/07/2025 (ADC 96, ADIs 7.827 e 7.839). Sem notícia de julgamento do Plenário até novembro de 2026, segundo fontes de terceiros; o portal do STF não pôde ser aberto nesta sessão. Se a liminar cair, volta a redação anterior do decreto e as contas precisam ser revistas (segundo fontes de terceiros, a regra anterior do empréstimo externo usava prazo médio de até 180 dias, e a alíquota diária do capital de giro era menor).
- RIR/2018, arts. 760 e 786: lidos em 11/11/2026; não relidos em 15/11 (o site do Planalto não abriu). Não foi localizada alteração.
- Lei 15.329/2026: segundo resumo de busca, trata da retenção do IR sobre juros de compra de bens a prazo, não de empréstimo. Não foi lida.
- PIS/Cofins a partir de 2027: extinção pela reforma tributária segundo fontes de terceiros; tratamento do ganho financeiro na CBS não verificado.
- Arredondamento do prazo médio: o Ato Declaratório Interpretativo RFB 41/2011 não traz critério; a fórmula publicada na página do Diário Oficial não foi vista. Não foi localizada regra oficial sobre fração de dia.
- As Soluções de Consulta citadas foram lidas pela ementa e tratam da regra anterior (6% e prazos maiores); a aplicação à regra atual (3,5% e 364 dias) é por mesma estrutura, sem decisão específica localizada.
- IOF zero na saída: o inciso XI fala em saída de recursos referentes a empréstimos externos, sem citar juros. A leitura de que o pagamento de juros também tem alíquota zero não foi confirmada em texto oficial.
- O inciso XII fala em empréstimo "sujeito a registro no Banco Central"; a declaração no SCE-Crédito vale a partir de US$ 1 milhão. Não foi confirmado como o IOF trata empréstimo abaixo desse valor.
- IRRF de 25% para país com tributação favorecida: texto oficial (IN RFB 1.455/2014) não foi aberto.
- Alíquota do swap: Lei 8.981, art. 74, fala em 10%; IN 1.585, em 22,5% a 15% (lida em cópia não oficial).
- NDF de balcão: alcance dos 0,005% e dos 15% sobre ganho líquido não está expresso nos textos lidos.
- Fórmulas oficiais de swap da B3 e norma de registro obrigatório de derivativos: páginas não abriram.

## Tela (padrão da calculadora BNDES)
A descrição de 11/11/2026 (grupos Operação, Custos e tributos e Proteção cambial; cotação comparativa em destaque; cronograma recolhido) foi substituída em 14/11/2026 pelo desenho no formato da cotação. O desenho atual está na seção "Desenho da tela (formato da cotação)". Em resumo:
- `src/Emprestimo4131.jsx` usa a estrutura e o estilo do BNDES (`BndesWorkspace.css`): cartão claro e título com abas (Simular · Regras e fontes). À esquerda: Atingir meta, Operação (seis campos e o valor convertido), Proteção cambial (NDF) e Mais opções, recolhido. À direita: botões Apresentar simulação e Imprimir PDF; cotação com o custo efetivo e o equivalente em CDI em destaque, com ampliação na tela; economia de IOF e equivalente em giro; condições da operação com Copiar resumo; comparação com swap e sem proteção e premissas, recolhidas. Abaixo, em largura inteira, o quadro parcela a parcela, aberto.
- Apresentação (`Emprestimo4131Presentation.jsx`) e PDF (`Emprestimo4131Print.jsx`) trabalham sobre uma cópia congelada (`emprestimo4131Presentation.js`): não recalculam nem buscam taxa nova.
- Estilo próprio só em `Emprestimo4131.css`, sempre com escopo `.e4`.
- A aba Regras e fontes mostra as regras da tabela do início desta nota, com a fonte de cada uma, mais a regra do IOF do capital de giro, a mesma das calculadoras de crédito do Painel.

## Verificações
`node --test test/emprestimo-4131*.test.mjs`: 43 testes (20 anteriores e 23 de `test/emprestimo-4131-parcelas.test.mjs`: parcelas, prazo médio, IOF por prazo médio, carência, datas a cada 30 dias, custo exp/360, economia de IOF, equivalente em giro, euro, regressão do principal no vencimento com números gravados da versão anterior, prazo médio na fronteira de 364 dias, regra de 30 dias no semestral, prazo não múltiplo do período, DI do prazo, atingir meta (inclusive contra conta fechada), resumo no formato de e-mail e taxas futuras da mesa coladas). Conta com resultado em fórmula fechada (juros, gross-up, IOF por prazo, custo all-in, relação com a variação do dólar, câmbio a termo, leitura em CDI, ponto de equilíbrio, entradas inválidas), IR sobre comissões ao exterior, spread do swap sem custos de entrada, fatores por curva e cópia congelada da apresentação e do PDF.
Conferência no navegador em 1440 px e 375 px: simulação, aba de regras, apresentação (6 slides), prévia do PDF e ausência de rolagem lateral da página.
Revisão independente da conta em 11/11/2026, em duas rodadas: reimplementação em Python, 12 casos na primeira (diferença máxima de 2×10⁻¹⁴ contra o motor) e 12 na segunda, cobrindo spread do swap, IR sobre comissões e curvas (diferença máxima de 1×10⁻¹³). Achados de rótulo e de validação de data corrigidos; os de premissa estão em "Premissas e limites".
Conferência de navegador automática: `scripts/smoke-emprestimo-4131.cjs` (390 e 1440 px), também no CI, com cotações e curva DI simuladas: câmbio e DI do dia preenchidos, três parcelas mensais no formato da cotação (recalculadas à parte), carência, datas a cada 30 dias, euro, pagamento único de 6 meses com IOF de 3,5%, números recalculados à parte, IR sobre comissões ao exterior, aviso de desembolso futuro, apresentação, prévia do PDF e aba de regras.
