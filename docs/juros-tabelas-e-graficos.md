# Juros: tabelas na página, gráfico em tela própria (12/11/2026)

## O que mudou
- A aba Juros passou a ter só tabelas. Os gráficos saíram do fim da página e abrem em tela própria (a mesma gaveta usada no Mercado e em Cenários) ao tocar na linha.
- **Juros de referência**: toda linha abre o seu gráfico (Selic meta, CDI, SOFR, €STR, Fed, BCE e Japão). Fed, BCE e Japão não tinham gráfico; agora têm, em degraus, a partir da mesma série oficial da tabela. No Fed a linha é o limite superior da faixa-alvo, e a nota traz a faixa vigente.
- **CDI futuro**: a tabela por horizonte fica na página; a linha abre o gráfico com a escolha de datas.
- **Curvas de juros** (DI x pré, cupom cambial, Treasuries e curva do euro): uma tabela por curva, com prazo nas linhas e as datas de comparação nas colunas. A linha abre o gráfico da curva. A leitura de cenário do cupom cambial fica na tela da curva do cupom.

## Regras de cálculo
Nenhuma regra mudou. As tabelas só organizam taxas já coletadas:
- curvas do Brasil: prazos padrão (1 mês a 10 anos) lidos pela mesma interpolação linear já usada na leitura do cupom (`interp`, em `cotacoes/src/cupom.js`), sem extrapolar; prazo fora da curva fica sem valor;
- Treasuries e euro: o próprio vencimento publicado, casado pelo prazo exato em cada data;
- CDI futuro: a mesma conta da tela de detalhe (`horizonTable`).

## Arquivos
`cotacoes/src/Juros.jsx` (página), `curveTable.js` (tabelas das curvas), `RateModal.jsx` (tela de detalhe), `Curves.jsx`, `CdiFuturo.jsx`, `Macro.jsx`, `ExecutiveRatesTable.jsx`, `RatesSnapshot.jsx`.

## Conferências
- Testes de lógica (`npm test`), build e lint.
- No navegador, em 390 e 1280 px, com dados sintéticos: `smoke-cupom` (tabelas, CDI futuro, curvas e cupom), `smoke-outros` (gráficos de cada linha de referência e curva do euro), `smoke-ui` (teclado e Escape), `smoke-motion`, `smoke-theme`.

## Pendências
- Direção visual não revisada por especialista: foi reaproveitado o padrão de tabela e de gaveta que já existia.
- O endereço não guarda qual gráfico está aberto (não dá para enviar o link de um gráfico específico).
