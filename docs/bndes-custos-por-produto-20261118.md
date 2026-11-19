# BNDES: custos permitidos por produto (registro)

Pedido de Fernando em 18/11/2026, com foto da tabela de premissas de custo da calculadora do BNDES. Registro de regra de operação de crédito, sem dado de cliente.

## Tabela (X = pode usar)

| Tipo | Produto ou programa | Custo Fixo | TFB | TFB TR | Pré 5 | Pré 3 | TFC | TFC MPME | TFC TR | TFBD | TLP | SELIC_LCD | SOFR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Produto | Finame - Demais BKs | | X | | X | X | | | | X | X | X | |
| Produto | Finame - Materiais Industrializados | | X | | | | X | X | | X | X | X | |
| Produto | Finame - Baixo Carbono | | X | | X | X | | | | X | X | X | |
| Produto | Finame - Máquinas 4.0 | | X | | X | X | | | | X | X | X | |
| Produto | BNDES - Crédito Pequenas e Médias Empresas | | X | | | | X | X | | X | X | X | |
| Produto | BNDES - Automático Projetos de Investimentos | | X | | X | X | | | | X | X | X | |
| Produto | BNDES - Automático Emergencial | | X | | | | X | X | | X | X | X | |
| Programa | BNDES - Fundo Clima Automático | X | | | | | | | | | | | |
| Programa | BNDES - Mais Inovação - Difusão Tecnológica | | | | | | | | X | | | | |
| Programa | BNDES - Mais Inovação - Investimento | | | X | | | | | | | | | |
| Programa | BNDES - Finame Funttel | | | X | | | | | | | | | |
| Programa | BNDES - Finame FUST Automático | | | X | | | | | | | | | |
| Programa | BNDES - EXIM Pré-Embarque | | | | | | | | | | X | | X |

Prefixados: Custo Fixo a TFC TR. Pós-fixados: TFBD, TLP, SELIC_LCD, SOFR.

## Descrição dos custos

- **Custo Fixo:** amparado pelo PAAR (Plano Anual de Aplicação de Recursos). Base 365/366.
- **TFB:** Taxa Fixa BNDES, pelo prazo da operação e prazo para liberação; carência de até 12 meses. Base 365/366.
- **TFB TR:** taxa fixa baseada em TR, pelo prazo da operação e prazo para liberação. Base 365/366.
- **Pré 5:** taxa prefixada FAT. Base 365/366.
- **Pré 3:** taxa prefixada FAT, só MPME. Base 365/366.
- **TFC:** Taxa Fixa Composta (blended: prefixada FAT + TFB), pelo prazo. Base 365/366.
- **TFC MPME:** igual à TFC, só MPME. Base 365/366.
- **TFC TR:** composta, FAT TR (60%) + TFB Selic (40%). Base 365/366.
- **TFBD:** TFB atualizada pela variação cambial. Base 360. Não disponível no Itaú.
- **TLP:** TLP exigível, juros prefixados + IPCA acumulado. Base 252.
- **SELIC_LCD:** Selic média diária capitalizada no saldo + sobretaxa fixa LD1. Base 252.
- **SOFR:** taxa americana (Fed de Nova York, via Bloomberg), pelo prazo; conversão do dólar no vencimento de cada parcela. Base 360.

## Onde está no painel

- Dados: `cotacoes/src/bndesCustosPorProduto.js` (fonte única; funções `custosPermitidos` e `avaliarCusto`).
- Tela: Calculadoras › BNDES › aba **Custos por produto** (escolha do produto, "pode usar", "não pode usar" e tabela completa).
- Testes: `cotacoes/test/bndes-custos-por-produto.test.mjs` conferem a tabela linha a linha e que as calculadoras do painel só oferecem custos permitidos.

## Conferência com as calculadoras atuais

Nenhuma regra de cálculo mudou. O que o painel já fazia está de acordo com a tabela:
- Finame Materiais oferece TFC (série MPME conforme o porte), TFB, TLP, Taxa LCD e TFBD (desde 19/11/2026): todos permitidos; Pré 5 e Pré 3 não aparecem, como manda a tabela.
- Carência de até 12 meses com TFB/TFC já era aplicada.
- TFB/TFC em dias corridos sobre 365/366; TLP exigível e Selic + LCD em dias úteis/252.

## Pendências

- Finame Veículos e BNDES Giro (opções de apresentação da mesma calculadora) não aparecem na tabela; ficaram como estão.
- Custo Fixo, TFB TR, TFC TR, Pré 5, Pré 3, TFBD e SOFR não têm calculadora no painel; só constam como regra.
