# Calculadora CDI x Dólar (18/11/2026)

Pedido de Fernando: incluir em Calculadoras a calculadora "CDI versus dólar", a partir da planilha
`Simulador_Dolar_x_CDI_Liquido` (fotos das abas Simulador e Fórmulas).

Endereço: `#calculadora/cdi-dolar`. Terminal: `CDIDOLAR`.

## Regras (iguais às da planilha)
- Oscilação necessária = dólar alvo ÷ dólar atual − 1.
- CDI diário = (1 + CDI a.a.)^(1/252) − 1; retorno diário = CDI diário × % do CDI.
- Rentabilidade bruta em n dias úteis = (1 + retorno diário)^n − 1.
- Dias corridos = arredondar para cima(n × 7/5); data final = início + dias corridos.
- IOF regressivo até 29 dias corridos; IR 22,5% / 20% / 17,5% / 15% (180, 360, 720 dias).
- Ganho líquido = ganho bruto × (1 − IOF) × (1 − IR).
- Prazo = primeiro dia útil em que ganho líquido ÷ valor aplicado ≥ oscilação. Busca até 5.000 dias úteis.

## Conferência
Exemplo da planilha (R$ 5,20 → R$ 5,50; R$ 520.000; CDI 14,15%; 98%; início 25/06/2026):
136 dias úteis, 02/01/2027, 191 dias corridos, bruto 7,25%, ganho bruto R$ 37.701,58, IR 20%,
ganho líquido R$ 30.161,27, valor líquido R$ 550.161,27. Igual ao Excel. Testes em `cotacoes/test/cdi-dolar.test.mjs`,
com uma conta independente para prazo curto (IOF e IR de 22,5%).

## Diferenças de apresentação em relação à planilha (não mudam o cálculo)
- Frase para o cliente com duas casas nos percentuais e valor em R$ formatado (a planilha arredondava 5,77% para 6% e 14,15% para 14%).
- Dólar alvo menor ou igual ao atual: a tela diz que não há prazo mínimo (a planilha mostraria 1 dia útil).
- Dólar atual vem da cotação do painel quando disponível; pode ser digitado.

## Limites
Data final por dias úteis × 7/5, sem feriados (como na planilha). CDI constante. Não considera spread e IOF de câmbio
nem tributação de pessoa jurídica.

## Ajustes de 18/11/2026 (tarde), pedidos de Fernando
- CDI atual preenchido com o último CDI do Banco Central coletado pelo painel (`macro.json`); pode ser digitado.
- Quadro 1: gráfico da PTAX do dólar nos últimos 12 meses, com mínima, máxima e posição do alvo.
- Quadro 2: gráfico do CDI projetado pela curva DI x pré da B3 (taxa a termo) até o prazo calculado, com o CDI médio projetado.
  É só apoio: a conta continua com o CDI informado constante, como na planilha (usar a curva na conta seria mudança de regra de cálculo).
