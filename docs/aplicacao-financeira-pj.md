# Aplicação financeira PJ no Comparador de Crédito (11/11/2026)

Regras aprovadas por Fernando em 11/11/2026, após pesquisa. Código: `cotacoes/src/aplicacaoPj.js`. Tela: Comparador de Crédito (`#calculadora/comparador-credito`).

## O que a tela faz
- Linha mestra ganha **Regime tributário da empresa** (Real, Presumido, Simples) e **Paga adicional de IR** (IRPJ + CSLL = 34% ou 24%).
- Linha nova em todas as comparações: **Custo após IRPJ/CSLL** (só muda no Lucro Real).
- Opção **Comparar com aplicação financeira**: CDB pós (% do CDI), CDB pré, fundo de renda fixa longo ou curto prazo (com taxa de administração). DI pela curva DI x pré da B3 do dia; cenários de alta/queda deslocam a curva na mesma variação.
- Bloco da aplicação (resgate único no fim do maior prazo): bruto, IOF, PIS/Cofins, imposto final, IR retido (antecipação), líquido e taxa líquida ao ano.
- **Tomar o crédito e manter o caixa aplicado**: a empresa aplica o líquido do crédito e resgata para pagar cada parcela; a sobra no fim (positiva = compensa o crédito; negativa = melhor usar o caixa).

## Regras por regime
| | Lucro Real | Lucro Presumido | Simples |
|---|---|---|---|
| Rendimento | IRPJ+CSLL 34% (24% sem adicional), competência, fim de cada mês | 34% (24%) no resgate | IR retido é o imposto final |
| IR retido / come-cotas | antecipação | antecipação | definitivo; come-cotas 15% (LP) ou 20% (CP) em maio e novembro |
| PIS/Cofins sobre rendimento | 4,65% até 31/12/2026, dedutível do IRPJ/CSLL; zero em 2027+ | não incide | não incide |
| Despesas do crédito (juros, IOF, tarifas) | reduzem IRPJ/CSLL | não | não |

IOF regressivo sobre o rendimento no resgate com menos de 30 dias, antes do IR. LCI/LCA não são isentas para PJ. FGC: R$ 250 mil por CNPJ por instituição.

## Simplificações declaradas
- Lucro Real: imposto pago no fim de cada mês, saindo da aplicação. Presumido: no resgate. Prejuízo fiscal e compensações não simulados.
- Resgate parcial leva principal e rendimento na mesma proporção.
- Falta de caixa na aplicação (parcelas maiores que o saldo) é somada sem correção.
- Adicional de IRPJ tratado como tudo ou nada.

## Fontes
- MP 1.303/2025 perdeu a validade (Ato Declaratório CN 67/2025): tabela regressiva mantida.
- LC 123/2006, art. 13, § 1º, V (Simples: IR na fonte definitivo).
- Lei 9.430/1996, art. 25, II; IN RFB 1.700/2017, art. 216, § 1º (Presumido: rendimento na base no resgate).
- Soluções de Consulta Cosit 84/2016 e 470/2017 (PIS/Cofins cumulativo não incide sobre receita financeira).
- Decreto 8.426/2015 (PIS/Cofins 0,65% + 4% no não cumulativo).
- LC 214/2025, art. 6º, V (IBS/CBS não incidem sobre rendimentos financeiros).
- Decreto 6.306/2007 (IOF regressivo).

Recomendado: revisão de um tributarista antes de uso com cliente.

## Verificações
`node --test test/aplicacao-pj.test.mjs test/credit-comparison-ui.test.mjs`.
