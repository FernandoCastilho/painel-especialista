# TLP exigível: API de projeção

Fonte: [BNDES, Circular 13/2022, Anexo IV, seção 1, páginas 1–4](https://www.bndes.gov.br/sbn/BNDES_online/Arquivos/04-22Cir13-Anexo-IV-Condicoes-a-Serem-Observadas-na-Contratacao.pdf), consultada em 06/11/2026. A seção 2 (TLPCAP) é outra modalidade.

## Entrada e saída

`simulateTlpExigivel` em `cotacoes/src/bndesTlpExigivel.js` aceita somente:

```js
{
  mode: 'projection',
  principalCents: 1000000,
  releaseDate: '2026-10-15',
  j: { annualPct: '5', source: 'Contrato / referência do J já ajustado', confirmed: true },
  spreads: { bndes: '2', agent: '3' },
  ipcaScenario: { annualPct: '4', acknowledged: true },
  schedule: {
    source: 'Cronograma informado e conferido', confirmed: true,
    events: [
      { date: '2027-10-15', businessDays: 252, amortize: false },
      { date: '2028-10-16', businessDays: 252, amortize: true }
    ]
  }
}
```

Taxas são textos decimais em percentual anual, com ponto e até 12 casas. Zero precisa ser explícito. `j` é a taxa prefixada já multiplicada pelo fator de ajuste aplicável à contratação; não é a TLP total com inflação. Spread BNDES inclui remuneração básica e intermediação quando aplicável. Spread do agente é separado e multiplicativo, não somado ao do BNDES. Limites técnicos: taxas até 100%; IPCA/J maiores que −100%; spreads não negativos; principal e totais até 10¹² centavos, até 600 eventos e 400 dias corridos por período.

Cada evento representa vencimento dos juros de todo o período anterior. `amortize:false` indica carência; `true` inicia SAC. Não há retorno à carência. A parcela de principal é saldo remanescente dividido pelas amortizações restantes, arredondada a centavos. A última zera o saldo. Sem inflação negativa excedente, isso mantém SAC constante, salvo centavos. Após redução do principal por juros negativos, as amortizações futuras são recalculadas sobre o saldo remanescente: hipótese de projeção que deve ser conferida no cronograma contratual.

`parseTlpSchedule(texto)` lê linhas `AAAA-MM-DD;DU;C` ou `AAAA-MM-DD;DU;A`, retornando `{ok,events,error}`. A validação completa ocorre em `simulateTlpExigivel`.

Sucesso retorna `ok:true`, `status:'projection-not-contract-validated'`, `profile`, `source`, `annualIpcaScenarioPct`, `rows`, `totals`, `cet:null`, `error:null`, `warnings`. Cada linha traz datas, DU, fase, `openingCents`, fatores IPCA/J/spreads/total, `interestCents`, `amortizationCents`, `negativeInterestPrincipalReductionCents`, `paymentCents`, `closingCents`. Totais: `principalCents`, `interestCents`, `amortizationCents`, `negativeInterestPrincipalReductionCents`, `paymentCents`, `closingCents`. Erro é atômico: `ok:false`, `status:'blocked'`, `rows:[]`, `totals:null`, `cet:null`, `error:{code,message}`.

## Regra e limites

A fórmula oficial exige produto dos IPCA mensais com expoentes dup/dut e defasagem vinculada ao aniversário no dia 15, multiplicado por J e pelos dois spreads em DU/252. Juros incidem sobre principal inicial do período. IPCA positivo não é capitalizado no saldo na TLP exigível ordinária.

Este motor **não implementa cálculo histórico contratual**. Substitui apenas o produto mensal por `(1 + IPCA anual hipotético)^(DU/252)`. O cenário é uma convenção explícita e não equivale à regra mensal oficial. Nenhum índice faltante é preenchido. Datas e DU são fornecidos externamente; não há calendário de feriados, ajuste de vencimento ou seleção automática de periodicidades. Rejeita fins de semana e DU incompatíveis com o máximo de segunda a sexta, mas não certifica o calendário.

Juros negativos descontam a prestação. Se excedem a amortização, a diferença reduz principal e a prestação é zero; em carência, todo juro negativo reduz principal. Com fatores estritamente positivos e taxas admitidas, juros negativos não superam o principal inicial, portanto a hipótese de pagamento BNDES à instituição por saldo líquido negativo não é alcançável; esse fluxo não é modelado nem confundido com pagamento ao cliente.

A fonte exige intermediários com 16 casas sem arredondamento. Este motor usa Number para expoentes fracionários e **não certifica essa precisão**. Bloqueia arredondamento fracionário numericamente incerto próximo a meio centavo. Períodos de 252 DU usam aritmética racional para cálculo final dos juros, com arredondamento de meio centavo para fora de zero. A aritmética racional não transforma a projeção em memória contratual.

IOF (11/11/2026, lacuna apontada pela revisão independente): escolha na tela entre **Zero (recursos BNDES/FINAME elegíveis)**, padrão; **PJ geral** (0,0082% ao dia); e **Simples/MEI** (0,00274% ao dia até R$ 30 mil, com confirmação do enquadramento), mais 0,38% de adicional sobre o valor, pelas regras compartilhadas de `iofRules.js`. O IOF diário incide sobre o principal de cada amortização, pelos dias corridos da liberação até o vencimento, com teto de 365 dias. Tudo é cobrado na liberação e sai do valor líquido do CET, nas duas linhas (parte fixa e custo projetado). Juros e parcelas não mudam e seguem em dias úteis/252. Cálculo em `src/bndesProfileIof.js`, arredondado uma vez em centavos.

A alíquota zero cita o Decreto 6.306/2007, art. 8º, IX, que o painel usa para recursos FINAME. **Não foi conferido se esse inciso alcança a TLP fora do FINAME**; o enquadramento depende da origem dos recursos e o painel não o verifica. A tela avisa isso no campo, na ajuda e nos avisos do resultado.

Não suporta Price, liberação adicional, pagamento extraordinário, atraso, evento financeiro fora de vencimento (que possui regra própria na fonte) ou seguros. Tarifa na liberação e CET (Res. CMN 4.881/2020) foram acrescentados depois; IOF conforme acima. Campos desconhecidos são bloqueados, nunca silenciosamente ignorados. Não modifica o motor Finame anterior.

## Verificação

`node --test cotacoes/test/bndes-tlp-exigivel.test.mjs` testa oracle anual independente, fator de meio ano, inflação sem aumento do principal, carência, zero versus ausência, três situações de juros negativos, fechamento de centavos, esquema fechado e validação de datas/DU.
