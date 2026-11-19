# Finame: TLP, Taxa LCD e TFBD na mesma calculadora

Pedido do Fernando em 19/11/2026: "quando eu colocar TLP, ela preenche, ao invés de TFC ali, ela coloca a TLP; TFBD e LCD, se for possível, da mesma forma". Combinado aprovado na mesma data, com estas escolhas:

- Índice futuro pelo **Focus ano a ano**, editável: IPCA (TLP), Selic (LCD) e dólar de fim de ano (TFBD).
- Comparativo com **qualquer par** de custos.

## Como cada custo é calculado

| Custo | Taxa do painel | Hipótese (Focus, editável) | Conta | Base |
|---|---|---|---|---|
| TLP (exigível) | J, moeda 777 (mensal) | IPCA por ano | juros = saldo × [(1 + IPCA)^(du/252) × (1 + J ⊕ BNDES ⊕ agente)^(du/252) − 1]; o IPCA não corrige o saldo | dias úteis/252 |
| Taxa LCD | LD1 (trimestral, pode ser negativa) | Selic média de cada ano: média dos fins de ano do Focus; no ano da liberação, a Selic atual | saldo × (1 + Selic)^(du/252); juros = saldo corrigido × [(1 + LD1 ⊕ BNDES ⊕ agente)^(du/252) − 1] | dias úteis/252 |
| TFBD | TD1 (até 24 m), TD2 (25 a 72 m), TD3 (acima de 72 m) | dólar de fim de ano, a partir do dólar do dia (604) | saldo × (dólar no vencimento ÷ dólar anterior); juros = saldo corrigido × (TFBD ⊕ BNDES ⊕ agente) × dias/360 | dias corridos/360 |

"⊕" é a composição capitalizada do BNDES: (1 + a)(1 + b)(1 + c) − 1.

Comum aos três: vencimento no dia 15 ou próximo dia útil (feriados nacionais e da praça do contrato), carência de até 24 meses com juros pela periodicidade escolhida (capitalizados dentro do período), SAC, IOF zero (recursos FINAME). FGI Tradicional só na TLP exigível: o regulamento veda TLP capitalizada, Selic/LCD capitalizada e TFBD (decisão de 19/11/2026, após a revisão independente). Período que cruza o ano usa a taxa de cada ano pelos dias úteis de cada lado. Depois do último ano do Focus, vale o último valor.

CET: duas linhas. "Projetado", com a hipótese do Focus; "parte fixa", com o índice zerado (Res. CMN 4.881/2020, art. 5º).

A TFBD mostra o aviso "não disponível no Itaú" (tabela de premissas da calculadora BNDES).

## Onde está

- Motor: `cotacoes/src/finamePosFixado.js`.
- Tela: `cotacoes/src/FinameMateriais.jsx` (taxa do painel, campos do Focus por ano, comparativo com qualquer par).
- Opções e comparativo: `cotacoes/src/finameFunding.js` (`mode: 'pos'`, `resolvePosRate`, `compareFinamePair`).
- Testes: `cotacoes/test/finame-pos-fixado.test.mjs` (contas de conferência feitas à parte, dias úteis contados à mão).

As telas próprias "TLP exigível" e "Selic + LCD" continuam como estavam, para cronogramas informados à mão.

## Limites

- Projeção, não memória contratual: o contrato usa IPCA mensal defasado, aniversário no dia 15 e arredondamentos próprios.
- A taxa do painel é a última publicada. O J da TLP vale para o mês de contratação; contratar em outro mês pede outro J.
- O Focus traz Selic e dólar de fim de ano. A Selic de cada ano é a média dos fins de ano (o BNDES capitaliza a média diária); o dólar é interpolado entre os fins de ano. Liberação perto do fim do ano faz o dólar caminhar até o Focus de 31/12 em poucos dias (revisão independente, ressalva baixa).
- O dólar inicial é a última cotação da moeda 604, mesmo com liberação futura.

## Revisão independente (19/11/2026)

Parecer: **Aprovado**. Recálculo por fora em 12 casos (TLP, LCD e TFBD; 12 a 84 meses; carências mensal, trimestral e semestral) bateu com o motor, com diferença máxima de 1e-8 real por parcela. Ajustes feitos depois do parecer, com o aval do Fernando: FGI liberado na TLP exigível; Selic da LCD pela média dos fins de ano; índice mostrado na tela pelos 12 meses seguintes à liberação (só exibição e equivalente em CDI).
