// Explicações curtas (frase simples, exemplo concreto, uso na mesa). Textos fixos, sem dados ao vivo.
// a = o que é, em palavras do dia a dia; b = exemplo com números redondos; c = como isso ajuda na decisão.
// Tipo de taxa nas linhas da tabela "Juros de referência" (vai dentro do "?" de cada linha).
import { TLP_LABEL, TLP_DEFINITION } from './tlp.js'
export const TIPOS_TAXA = {
  'Mercado overnight': 'Taxa observada no mercado overnight: empréstimos de 1 dia entre instituições financeiras, em que o dinheiro sai hoje e volta no dia útil seguinte (no Brasil, entre bancos; nos EUA, com garantia de títulos do Tesouro). É calculada a partir das operações efetivamente feitas no dia, então mostra o custo real do dinheiro de curtíssimo prazo e anda colada na taxa do banco central.',
  'Política monetária': 'Taxa definida pelo banco central em reunião do seu comitê. Não é negociada no mercado: muda por degraus, só nas decisões, e serve de alvo para as taxas de mercado de 1 dia.',
}

// "Mercado overnight · % a.a." → tipo (explicado no "?") e unidade; quando todas as linhas têm a mesma unidade, ela vai para o cabeçalho.
export function splitUnit(unit = '') {
  const i = unit.lastIndexOf(' · ')
  return i < 0 ? { tipo: '', unidade: unit } : { tipo: unit.slice(0, i), unidade: unit.slice(i + 3) }
}

export const GLOSSARY = {
  cotacao: {
    t: 'Cotação',
    a: 'Quanto custa 1 unidade da moeda estrangeira, em reais.',
    b: 'Dólar a R$ 5,00: com R$ 5,00 você compra US$ 1. A seta mostra se está mais caro (▲) ou mais barato (▼) que no fechamento anterior.',
    c: 'Dólar subindo encarece importação e dívida em dólar; ajuda quem exporta.',
  },
  mercadoHoje: {
    t: 'Mercado hoje: tabela e gráficos',
    a: 'Cotação é o preço em reais de uma unidade da moeda. Δ dia mostra a variação absoluta em reais e Δ dia % a variação percentual informada para a referência.',
    b: 'Um sinal positivo indica alta; um negativo indica queda. O traço significa que a fonte não forneceu aquela variação, e não variação zero.',
    c: 'Toque na linha para abrir o gráfico. Os filtros mudam os gráficos, não a última cotação da tabela. Confira fonte, data e avisos de cada referência.',
  },
  minigrafico: {
    t: 'Minigráfico e período',
    a: 'Um desenho do caminho do preço no período escolhido (Dia, Semana, Mês ou Ano).',
    b: 'Em "Mês", a linha mostra os últimos 30 dias; o % ao lado é quanto o preço mudou entre o primeiro e o último ponto.',
    c: 'Serve para ver direção e ritmo, não o valor exato. Para o valor de uma data, abra o gráfico.',
  },
  historico: {
    t: 'Gráfico de histórico',
    a: 'O preço de fechamento de cada dia, ligado por uma linha.',
    b: 'Se a linha sobe da esquerda para a direita, a moeda ficou mais cara em reais naquele período. Passe o mouse (ou o dedo) para ver a data e o valor.',
    c: 'Mostra se o preço de hoje é alto ou baixo comparado ao que foi nas últimas semanas.',
  },
  paridade: {
    t: 'Paridade EUR/USD',
    a: 'Quantos dólares são necessários para comprar 1 euro.',
    b: 'EUR/USD em 1,12: 1 euro vale US$ 1,12. Se sobe, o euro está se fortalecendo frente ao dólar.',
    c: 'Mostra a força do dólar no mundo, que influencia também o real. Aqui é calculada a partir do dólar e do euro em reais.',
  },
  variacao: {
    t: 'Variação e volatilidade',
    a: 'Variação é quanto o preço mudou (semana, mês, ano). Volatilidade é o quanto ele balança de um dia para o outro.',
    b: 'Vol. de 10% ao ano: balanço pequeno. 20% ou mais: o preço anda bem mais forte, para os dois lados.',
    c: 'Volatilidade alta pede mais cuidado em proteção (hedge) e em prazos; ela não diz se o preço vai subir ou cair.',
  },
  selic: {
    t: 'Selic',
    a: 'A taxa básica de juros do Brasil. A meta é definida pelo Copom a cada ~6 semanas; a Selic efetiva é a média das operações de 1 dia com títulos públicos, apurada pelo Banco Central e mantida junto da meta.',
    b: 'A 10% ao ano, R$ 100 emprestados rendem R$ 10 em um ano. A Selic é a referência para quase todos os outros juros.',
    c: 'Selic alta encarece crédito e atrai capital de fora, o que tende a segurar o dólar. Muda por degraus, só nas reuniões.',
    d: 'Meta e efetiva diferem: a efetiva (Selic over) fica cerca de 0,10 p.p. abaixo da meta. O Copom se reúne 8 vezes por ano, decide na quarta, depois do fechamento, e a ata sai na terça seguinte. O efeito no crédito e na inflação leva de 6 a 18 meses. Referência: meta de inflação de 3% (tolerância de 1,5 p.p.).',
    l: "Eixo horizontal: o tempo, no período escolhido acima dos gráficos; eixo vertical: a taxa em % a.a. em cada dia. O número no canto é quanto a taxa variou no período, em pontos percentuais. Passe o mouse para ver o valor de um dia; arraste sobre o gráfico para medir a variação entre duas datas; \"Agrupar\" só muda a granularidade (dia, mês, ano), não o período. A Selic meta anda em degraus: cada degrau é uma decisão do Copom, e trechos retos são períodos sem mudança."
  },
  cdi: {
    t: 'CDI',
    a: 'A taxa dos empréstimos de 1 dia entre bancos (depósitos interfinanceiros). A B3 calcula a média das operações de cada dia útil e divulga já anualizada, em base de 252 dias úteis. Anda colada na Selic, um pouco abaixo.',
    b: 'Um CDB que paga "100% do CDI" rende o mesmo que o CDI. Se o CDI é 10% ao ano, rende ~10%.',
    c: 'É a régua da renda fixa no Brasil: tudo que rende em reais é comparado a ele.',
    d: 'Fica cerca de 0,10 p.p. abaixo da Selic meta. Base de 252 dias úteis: o fator diário é (1 + CDI)^(1/252) e o rendimento do período é o produto dos fatores diários, não a soma. Indexa CDBs, debêntures e o swap DI x pré; contratos usam CDI + spread ou % do CDI.',
    l: "Eixo horizontal: o tempo, no período escolhido acima dos gráficos; eixo vertical: a taxa em % a.a. em cada dia. O número no canto é quanto a taxa variou no período, em pontos percentuais. Passe o mouse para ver o valor de um dia; arraste sobre o gráfico para medir a variação entre duas datas; \"Agrupar\" só muda a granularidade (dia, mês, ano), não o período. O CDI anda colado na Selic, um pouco abaixo; a distância entre o CDI e a SOFR é o diferencial de juros que atrai capital para o real."
  },
  sofr: {
    t: 'SOFR',
    a: 'O "CDI americano": a taxa de empréstimos de 1 dia em dólares, com garantia de títulos do Tesouro dos EUA. O Fed de Nova York calcula a mediana, ponderada pelo volume, dessas operações e divulga de manhã o valor do dia útil anterior.',
    b: 'Dívidas em dólar costumam ser "SOFR + spread". Se a SOFR é 4% e o spread 2%, o juro é ~6%.',
    c: 'A diferença Selic − SOFR mostra quanto o Brasil paga a mais que os EUA; é parte da atração do real.',
    d: 'Substituiu a LIBOR em dólar (descontinuada em 2023). É garantida por títulos do Tesouro, logo quase sem risco de crédito. Pode saltar no fim de mês e em datas de liquidação do Tesouro. Contratos usam SOFR composta ou a SOFR a prazo (Term SOFR), com base de 360 dias.',
    l: "Eixo horizontal: o tempo, no período escolhido acima dos gráficos; eixo vertical: a taxa em % a.a. em cada dia. O número no canto é quanto a taxa variou no período, em pontos percentuais. Passe o mouse para ver o valor de um dia; arraste sobre o gráfico para medir a variação entre duas datas; \"Agrupar\" só muda a granularidade (dia, mês, ano), não o período. A SOFR acompanha a faixa do Fed; saltos de um dia em fim de mês ou de trimestre são comuns e não mudam a tendência."
  },
  sofrMedia: {
    t: 'Médias da SOFR',
    a: 'A média da SOFR dos últimos 30, 90 ou 180 dias, com os juros compostos.',
    b: 'A taxa do dia pode saltar no fim do mês; a média de 30 dias alisa esses pulos.',
    c: 'Mostra a tendência de fundo, sem o ruído de um dia.',
    d: 'É a média composta usada em contratos de crédito: o juro do período é a média composta × dias ÷ 360. Muitos contratos aplicam defasagem de alguns dias úteis (lookback) para saber a taxa antes do pagamento. Média curta reage rápido; longa mostra o ciclo.',
  },
  di1: {
    t: 'DI de 1 ano',
    a: 'A taxa que o mercado cobra hoje para emprestar em reais por 1 ano, negociada na B3.',
    b: 'Se a Selic é 15% e o DI de 1 ano é 13,9%, o mercado aposta que os juros vão cair nos próximos meses.',
    c: 'Acima da Selic: o mercado espera juros mais altos. Abaixo: espera cortes.',
    d: 'O contrato DI1 da B3 negocia a taxa até o vencimento. O preço (PU) é 100.000 ÷ (1 + taxa)^(dias úteis ÷ 252): taxa sobe, PU cai. Compare com a Selic meta e com o Focus para separar aposta de juros de prêmio de risco fiscal.',
  },
  ust10: {
    t: 'Treasury de 10 anos',
    a: 'O juro que o governo dos EUA paga para pegar dinheiro emprestado por 10 anos.',
    b: 'É considerado o investimento "sem risco" do mundo. Se paga 5%, qualquer outro ativo precisa pagar mais para compensar o risco.',
    c: 'Quando sobe, o dólar costuma se fortalecer e os países emergentes sofrem; quando cai, o contrário.',
    d: 'A taxa nominal soma a taxa real (TIPS) e a inflação implícita (breakeven). 1 ponto-base = 0,01 p.p. A diferença entre 10 e 2 anos (2s10s) mede a inclinação da curva. É a taxa de desconto de quase todo ativo: se sobe, o valor presente de lucros futuros cai.',
  },
  curvaDi: {
    t: 'Curva de juros (DI x pré)',
    a: 'Um retrato das taxas para cada prazo: 3 meses, 1 ano, 5 anos. Cada ponto é o juro que o mercado cobra até aquela data.',
    b: 'Se a curva desce para a direita, o mercado aposta que os juros vão cair. Se sobe, aposta em alta ou em mais risco.',
    c: 'Ligue as datas na legenda: o desvio entre a linha de hoje e a de 1 mês atrás mostra como a aposta mudou.',
    d: 'Vértices em dias úteis (base 252), ligados por interpolação. A taxa a termo entre dois vértices é (1 + longa)^(du2/252) ÷ (1 + curta)^(du1/252) − 1, escalada ao período. Curva inclinada embute prêmio de prazo e risco fiscal; curva plana ou invertida indica aperto monetário.',
    l: "Eixo horizontal: o prazo, em anos úteis a partir de hoje (0a é amanhã; 10a, daqui a 10 anos). Eixo vertical: a taxa em % a.a. que o mercado cobra até aquele prazo; cada ponto é um vértice. Leia em três passos. 1) Nível: onde a curva toda está (perto de 15% é juro alto). 2) Formato: subindo para a direita, o mercado pede mais para prazos longos (prêmio de prazo, risco fiscal ou alta esperada); descendo, espera cortes da Selic; com corcova, alta no curto prazo e queda depois. 3) Movimento: ligue as datas da legenda; a linha de hoje acima da antiga quer dizer juros embutidos maiores. Se só a ponta longa subiu, a curva abriu (risco); se só a curta, aposta em Selic maior. Passe o mouse para ver cada vértice."
  },
  cupom: {
    t: 'Cupom cambial',
    a: 'O juro em dólar embutido nos contratos brasileiros: quanto se ganha em dólar por deixar dinheiro no Brasil.',
    b: 'Se a curva em reais paga 14% e o dólar deve subir 4%, o cupom é ~10%: o que sobra em dólar.',
    c: 'Sobe quando há muita procura por dólar no mercado local; é um termômetro do aperto de dólar.',
    d: 'Calculado em base linear de 360 dias corridos, a partir da curva DI e do dólar futuro. Cupom alto com DI estável sinaliza dólar escasso no mercado local. Compare com a SOFR: a diferença é o prêmio de se financiar em dólar via Brasil.',
    l: "Mesmos eixos da curva DI (prazo em anos úteis × % a.a.), mas a taxa é o juro em dólar. Nível alto indica dólar escasso aqui: quem precisa de dólar no Brasil paga caro por ele. Compare com as Treasuries: a distância entre o cupom e o Treasury do mesmo prazo é o prêmio do Brasil em dólar. Ligue as datas: cupom subindo com o DI parado sugere aperto de dólar no mercado local. Vértices de menos de 1 mês oscilam demais e ficam fora. A \"leitura de cenário\" logo abaixo resume esses números."
  },
  fedFaixa: {
    t: 'Fed: faixa-alvo da taxa de juros',
    a: 'A taxa básica dos EUA (fed funds). O comitê do Fed (FOMC) não fixa um número, e sim uma faixa, como 3,75%–4,00%; a taxa efetiva do mercado fica dentro dela. Decidida cerca de 8 vezes por ano.',
    b: 'Faixa de 3,75%–4,00%: os bancos americanos emprestam reservas entre si por um valor nesse intervalo.',
    c: 'Define o custo do dinheiro em dólar no mundo todo. Aqui são mostrados o limite inferior e o superior vigentes na data.',
    d: 'O FOMC se reúne 8 vezes por ano, divulga o comunicado às 14h de Nova York e publica projeções (dot plot) a cada trimestre. Mandato duplo: inflação de 2% (PCE) e pleno emprego. A taxa efetiva (EFFR) fica dentro da faixa. Ata sai 3 semanas depois.',
  },
  estr: {
    t: '€STR (taxa de curto prazo do euro)',
    a: 'A taxa dos empréstimos de 1 dia entre bancos na zona do euro, o equivalente da SOFR e do CDI. O BCE calcula a média ponderada pelo volume, sem os 25% menores e os 25% maiores valores, e divulga de manhã o dia útil anterior.',
    b: 'Se o €STR está em 2,44% e o BCE paga 2,50% de depósito, o dinheiro de 1 dia no mercado custa um pouco menos que o piso do BCE.',
    c: 'É o benchmark "sem risco" do euro: dívidas em euro costumam ser "€STR + spread".',
    d: 'Substituiu o EONIA em 2022. Dívidas de prazo mais longo usam a Euribor (3 e 6 meses), que é uma taxa a prazo. A diferença entre €STR e depósito do BCE mostra o excesso de liquidez no sistema. Meta de inflação do BCE: 2%.',
    l: "Eixo horizontal: o tempo, no período escolhido acima dos gráficos; eixo vertical: a taxa em % a.a. em cada dia. O número no canto é quanto a taxa variou no período, em pontos percentuais. Passe o mouse para ver o valor de um dia; arraste sobre o gráfico para medir a variação entre duas datas; \"Agrupar\" só muda a granularidade (dia, mês, ano), não o período. O €STR acompanha a taxa de depósito do BCE, um pouco abaixo; os degraus são decisões do BCE."
  },
  bceDeposito: {
    t: 'BCE: taxa de depósito',
    a: 'A principal taxa de política monetária do Banco Central Europeu: o juro que o BCE paga aos bancos pelo dinheiro deixado com ele por 1 dia. É fixada pelo Conselho do BCE, em reuniões a cada ~6 semanas.',
    b: 'Com o BCE a 2,50%, nenhum banco empresta dinheiro no mercado por menos disso, porque teria como deixá-lo no BCE a 2,50%.',
    c: 'Funciona como piso do juro de curto prazo na zona do euro; o €STR anda um pouco abaixo ou colado nela.',
    d: 'É o piso do corredor de juros do BCE; a taxa de refinanciamento e a de empréstimo marginal ficam acima, e o €STR tende a ficar colado ao piso quando há muita liquidez. O Conselho decide cerca de 8 vezes por ano. Meta: inflação de 2% no médio prazo.',
  },
  bojMeta: {
    t: 'Japão: meta do juro overnight',
    a: 'O alvo do Banco do Japão para a taxa de empréstimos de 1 dia entre bancos, decidido nas reuniões de política monetária. A série mostrada é compilada pelo BIS a partir das decisões; por isso aparece com "≈" e traz a data da primeira observação daquele nível.',
    b: 'Meta de ≈1,25%: o Banco do Japão conduz o mercado de 1 dia para perto desse valor.',
    c: 'Os juros do Japão foram perto de zero por décadas; a alta recente mexe com o iene e com o carry trade.',
    d: 'Em 2024 o banco saiu dos juros negativos e do controle da curva (YCC). Juro japonês baixo financia o carry trade: toma-se emprestado em iene para aplicar em ativos de juro alto. Alta de juros ou do iene força o fechamento dessas posições e derruba ativos de risco, como em agosto de 2024.',
  },
  tr: {
    t: 'TR (Taxa Referencial)',
    a: 'Índice calculado pelo Banco Central a partir da TBF, com um redutor, e divulgado todo dia útil. Corrige a poupança, o FGTS e parte do crédito imobiliário.',
    b: 'A poupança rende 0,5% ao mês mais a TR (quando a Selic está acima de 8,5% ao ano).',
    c: 'Com juros altos o redutor pesa e a TR fica perto de zero.',
    d: 'Poupança: com Selic acima de 8,5% ao ano rende 0,5% ao mês + TR; com Selic até 8,5%, 70% da Selic + TR. FGTS rende 3% ao ano + TR. A TR vale a partir do dia de aniversário, e cada data tem a sua. Com juros altos o redutor zera quase toda a TR.',
  },
  tbf: {
    t: 'TBF (Taxa Básica Financeira)',
    a: 'A média das taxas que os grandes bancos pagam em CDB e RDB prefixados, calculada pelo Banco Central. É a base do cálculo da TR. Vem em % ao mês; o equivalente anual é a composição de 12 meses iguais.',
    b: 'TBF de 1% ao mês equivale a cerca de 12,7% ao ano (1,01 elevado a 12).',
    c: 'Mostra quanto os bancos estão pagando para captar no curto prazo.',
    d: 'Taxa mensal calculada todo dia útil, com período de 30 dias a partir da data. Anualizar: (1 + TBF)^12 − 1. A TR de cada data é a TBF descontada de um redutor, e a TBF acompanha de perto os juros do CDB prefixado de 30 dias.',
  },
  tlp: {
    t: TLP_LABEL,
    a: TLP_DEFINITION,
    b: 'Ao avaliar uma operação com TLP, considere a parcela prefixada, a correção pelo IPCA e os spreads contratados.',
    c: 'Use este valor para consultar a parcela fixa. Considere também o IPCA e os spreads ao avaliar o custo do financiamento.',
    d: 'Divulgada uma vez por mês, com vigência mensal para novas contratações. A parcela prefixada é fixada na contratação; o IPCA varia ao longo do contrato. A TFB é outro custo financeiro e fica na aba BNDES.',
  },
  fgi: {
    t: 'FGI e FGI PEAC (garantia para o crédito)',
    a: 'O FGI (Fundo Garantidor para Investimentos), do BNDES, cobre parte da perda do banco se a empresa não paga. O PEAC é a versão criada na pandemia (Lei 14.042/2020), com recursos da União, para micro, pequenas e médias empresas.',
    b: 'A empresa pede R$ 1 milhão e não tem imóvel para dar em garantia. O fundo cobre parte do valor se houver calote, e o banco tende a aprovar.',
    c: 'No Finame Materiais, o FGI (Tradicional ou PEAC) é garantia admitida. Peça ao agente a disponibilidade, o percentual coberto e a comissão.',
    d: 'O Tradicional é o fundo de sempre, mantido pelas comissões das operações. O PEAC nasceu em 2020 como medida temporária, foi reaberto em 2022 e tem regras próprias. O fundo garante só uma parte da operação, e a comissão paga pela empresa depende do produto e do porte. Não substitui a análise de crédito do agente. Fonte: bndes.gov.br/peac.'
  },
  curvaEuro: {
    t: 'Curva de juros da área do euro',
    a: 'Os juros dos títulos de governo AAA da zona do euro para cada prazo, de 3 meses a 30 anos. O BCE estima a curva por um modelo (Svensson) a partir dos preços desses títulos.',
    b: 'Se o prazo de 10 anos paga mais que o de 3 meses, a curva é inclinada para cima, o normal em economia sem sinal de recessão próxima.',
    c: 'É a referência de preço do dinheiro em euro por prazo, o equivalente europeu das Treasuries; ao lado do €STR (overnight), mostra o juro de curto e de longo prazo na zona do euro.',
    d: 'A curva usa só emissores AAA da zona do euro (como a Alemanha), então fica abaixo do que Itália ou França pagam. O diferencial desses países contra o Bund alemão mede o risco-país europeu. Em crédito, a referência é a curva de swaps de Euribor.',
    l: "Mesmos eixos das Treasuries (vencimento × % a.a., aqui taxa spot). Compare o formato e o nível com a curva americana: a diferença entre os juros dos EUA e do euro é o que move o par EUR/USD. Inclinação para cima é o normal; achatada ou invertida indica expectativa de cortes do BCE. Ligue as datas para ver se o movimento veio da ponta curta (BCE) ou da longa (prêmio de prazo)."
  },
  periodosDi: {
    t: 'Curvas de comparação: DI x pré',
    a: 'Cada linha é a curva da data indicada: "Último dia" é a mais recente publicada; "1 dia" é a do dia anterior; "1 semana", "1 mês", "3 meses", "6 meses" e "1 ano" ficam 7, 30, 91, 182 e 365 dias corridos antes da última.',
    b: 'Sem curva no dia exato (fim de semana ou feriado), vale a mais recente anterior; a data real aparece ao lado do nome.',
    c: 'Compare a linha de hoje com as antigas: subiu, o mercado passou a embutir juros maiores; desceu, menores.',
    d: 'Abertura (prazos longos subindo mais) sugere prêmio de prazo e risco fiscal; subida nos curtos com fechamento sugere expectativa de aperto. Datas repetidas aparecem uma vez. A B3 só publica o último dia; as datas anteriores vêm do histórico que o painel guarda a cada pregão, desde 30/10/2026.',
  },
  periodosCupom: {
    t: 'Curvas de comparação: cupom cambial',
    a: 'Cada linha é a curva da data indicada: "Último dia" é a mais recente publicada; "1 dia" é a do dia anterior; "1 semana", "1 mês", "3 meses", "6 meses" e "1 ano" ficam 7, 30, 91, 182 e 365 dias corridos antes da última.',
    b: 'Sem curva no dia exato (fim de semana ou feriado), vale a mais recente anterior; a data real aparece ao lado do nome.',
    c: 'Cupom subindo indica dólar mais caro de obter no mercado local; caindo, alívio na demanda por dólar.',
    d: 'Compare por prazo: choques de curto prazo costumam vir de fluxo de dólar; os de longo, de juros e risco-país. Datas repetidas aparecem uma vez. A B3 só publica o último dia; as datas anteriores vêm do histórico que o painel guarda a cada pregão, desde 30/10/2026.',
  },
  periodosUst: {
    t: 'Curvas de comparação: Treasuries',
    a: 'Cada linha é a curva da data indicada: "Último dia" é a mais recente publicada; "1 dia" é a do dia anterior; "1 semana", "1 mês", "3 meses", "6 meses" e "1 ano" ficam 7, 30, 91, 182 e 365 dias corridos antes da última.',
    b: 'Sem curva no dia exato (fim de semana ou feriado), vale a mais recente anterior; a data real aparece ao lado do nome.',
    c: 'Curva deslocada para cima: os juros dos EUA subiram; para baixo, caíram. Inclinação trocando de sinal indica mudança de expectativa.',
    d: 'Treasuries mais altas fortalecem o dólar e pesam nos emergentes. Inversão (curtos acima dos longos) costuma anteceder desaceleração, com defasagem. Datas repetidas aparecem uma vez.',
  },
  periodosEuro: {
    t: 'Curvas de comparação: área do euro',
    a: 'Cada linha é a curva da data indicada: "Último dia" é a mais recente publicada; "1 dia" é a do dia anterior; "1 semana", "1 mês", "3 meses", "6 meses" e "1 ano" ficam 7, 30, 91, 182 e 365 dias corridos antes da última.',
    b: 'Sem curva no dia exato (fim de semana ou feriado), vale a mais recente anterior; a data real aparece ao lado do nome.',
    c: 'Curva acima da antiga: os juros do euro subiram; abaixo, caíram. A inclinação mostra as apostas de curto contra longo prazo.',
    d: 'É a curva soberana AAA (modelo de Svensson): serve de referência de preço do euro, não de um país específico. Datas repetidas aparecem uma vez.',
  },
  treasuries: {
    t: 'Curva do Tesouro dos EUA',
    a: 'Os juros dos títulos do governo americano para cada prazo, de 1 mês a 30 anos.',
    b: 'Normalmente prazos longos pagam mais. Quando os curtos pagam mais (curva invertida), o mercado costuma ver desaceleração à frente.',
    c: 'É a base de preço de todo o crédito em dólar no mundo.',
    d: 'Inversão (juro curto acima do longo) antecedeu várias recessões americanas, com defasagem de 6 a 24 meses. Termos de mesa: steepening (curva abre) e flattening (fecha); bull é queda de taxa, bear é alta. Cada prazo mistura juro real e inflação esperada.',
    l: "Eixo horizontal: os vencimentos dos títulos americanos (1 mês a 30 anos), em posições iguais, não proporcionais ao tempo. Eixo vertical: o rendimento em % a.a. O normal é subir para a direita. Invertida (curtos acima dos longos): o mercado espera cortes do Fed porque vê desaceleração. Ligue as datas: a curva toda subindo encarece o dólar no mundo e costuma pressionar moedas como o real; só a ponta curta mexendo é mudança de expectativa sobre o Fed; só a longa, prêmio de prazo ou risco fiscal americano."
  },
  cdiFuturo: {
    t: 'CDI futuro',
    a: 'O CDI que o mercado já embutiu nos preços para períodos à frente, calculado a partir da curva do DI.',
    b: 'Se o CDI de hoje é 14,9% e o "a termo" para daqui a 1 ano é 13,5%, o mercado aposta em queda de juros. "Médio até lá" é a média do caminho todo; "no trecho" é só aquele pedaço.',
    c: 'Não é previsão oficial: inclui um prêmio de risco. Compare com o Focus para ver onde mercado e analistas divergem.',
    d: 'É a taxa a termo da curva DI: (1 + taxa até o fim)^(du_fim/252) ÷ (1 + taxa até o início)^(du_início/252) − 1. Inclui prêmio de risco e de prazo, então tende a ficar acima do que o mercado realmente espera. Contratos de CDI + spread repassam essa expectativa ao custo.',
    l: "Eixo horizontal: as datas à frente; eixo vertical: o CDI que o mercado embute para cada momento (taxa a termo, % a.a.). Linha descendo quer dizer que o mercado precifica cortes da Selic; subindo, altas; os degraus acompanham as reuniões do Copom. Na tabela por horizonte, \"CDI médio até lá\" é o que vale para uma aplicação ou dívida até aquela data, e \"a termo no trecho\" é só aquele pedaço. Compare com a Selic de hoje e com o Focus."
  },
  focus: {
    t: 'Boletim Focus',
    a: 'Pesquisa semanal do Banco Central com bancos e consultorias sobre Selic, inflação, PIB e câmbio.',
    b: 'Cada número é a mediana: metade dos analistas espera mais, metade espera menos.',
    c: 'É a "opinião" do mercado. Se diverge do DI, vale perguntar quem está certo.',
    d: 'Publicado toda segunda-feira. Traz a mediana e o grupo Top 5, que reúne os que mais acertaram. As revisões da Selic de fim de ano e do IPCA guiam o debate sobre o Copom. Quando o DI diverge do Focus, a diferença é prêmio de risco ou aposta contra o consenso.',
  },
  projecoes: {
    t: 'Projeções do Itaú BBA',
    a: 'O cenário-base do Itaú BBA para as principais variáveis.',
    b: 'É a visão de uma instituição, não a média do mercado (essa é o Focus).',
    c: 'Use como uma referência a mais, com a data da revisão em mente.',
  },
  agenda: {
    t: 'Agenda de mercado',
    a: 'Os eventos que costumam mexer nos preços: decisões de juros (Copom, FOMC), inflação (IPCA), emprego (payroll) e o Focus.',
    b: 'No dia da decisão de juros, o dólar e o DI costumam se mexer mais na hora do anúncio. Horários em Brasília.',
    c: 'Ajuda a evitar surpresa: antes de fechar uma operação, veja se há evento próximo.',
  },
  noticias: {
    t: 'Notícias e tickers',
    a: 'Manchetes em ordem de horário. O ticker (USD, EUR, JPY, CNH) mostra a moeda ligada ao assunto.',
    b: 'Uma notícia sobre o Fed leva o ticker USD. Se tem dois tickers, vale para as duas moedas.',
    c: 'O ticker indica o tema, não a direção do preço. As manchetes em inglês são traduzidas automaticamente.',
  },
  faixaJuros: {
    t: 'Faixa de juros',
    a: 'Os juros-chave passando em fila: Selic, CDI, SOFR, DI de 1 ano e Treasury de 10 anos.',
    b: '"+2 bps" = subiu 0,02 ponto percentual desde o pregão anterior (100 bps = 1 ponto percentual). Passe o mouse para pausar.',
    c: 'Toque para abrir a aba Juros: lá cada indicador e gráfico tem o seu "?" com a explicação completa.',
  },
  feriados: {
    t: 'Praças e feriados',
    a: 'Cada praça tem o seu calendário: onde é feriado, o mercado fecha e o dinheiro não liquida.',
    b: 'Pagar em USD numa quinta de Thanksgiving não funciona: Nova York fecha. Um pagamento marcado para essa data só entra no dia útil seguinte.',
    c: 'Marque as praças da sua operação. O app avisa quando uma data cai em feriado e sugere o próximo dia útil comum, mas nunca muda a data sozinho.',
  },
}
