# Câmbio futuro: parcelas, comissões e TIR base 252 (26/11/2026)

Pedido de Fernando, a partir das telas da planilha "Comparativo HPA" (bullet e 4 parcelas).

## O que mudou
- A tela principal de Câmbio futuro (`#calculadora/cambio-futuro`) agora segue a planilha: valor em USD, parcelas (1 a 12), taxa all-in, TAC em R$, spot da mesa, as três taxas (comissão externa, IR juros remissível, comissão local) e, por parcela, prazo em dias, amortização (partes iguais, editável) e câmbio futuro.
- Calculados: vencimento (início + prazo), saldo devedor, as três comissões (saldo × taxa × dias do período ÷ 360), juros total, parcela USD e fluxo em R$.
- Fluxo em R$: início = −(valor em R$ − TAC); vencimento = parcela USD em centavos × câmbio futuro da parcela.
- TIR ao ano em base 252 (aprovada por Fernando, "Sim, base 252"): dias úteis com feriados nacionais entre o início e cada vencimento. O "TIR aa 22,26%" da planilha é o custo no período sem anualizar; ele aparece separado no bullet. Exemplo bullet: 22,86% a.a. (246 dias úteis).
- Título "Juros Total (EUR+…)" da planilha corrigido para USD.
- A tela anterior (cotação via euro ou yuan, TIR em dias corridos/365) continua em `#calculadora/cambio-futuro/euro-yuan`, sem mudança de regra.

## Decisões registradas
- Cada parcela tem o seu câmbio futuro (informado pela mesa). Data de início é um campo (padrão hoje).
- Prazo de 1 a 3.650 dias. Vencimento em dia não útil é sinalizado na tabela e conta até o último dia útil antes dele.
- Parcela USD arredondada a centavos antes de converter (é o que reproduz os R$ 723.288,88 da planilha).

## Conferência
- Testes com os dois exemplos da planilha (`test/cambio-futuro-fluxo.test.mjs`), revisão independente do cálculo e revisão de simplificação (simplificador de código da sessão; o Simplificador da central não está instalado neste ambiente).

## Ajuste de 27/11/2026: IR remissível automático
- Aprovado por Fernando ("Sim, preencher sozinha, mas permita que o usuário também possa editar"): o campo IR juros remissível vem preenchido com 1/3 da comissão externa, com 4 casas (6,6581 → 2,2194; 6,1468 → 2,0489), igual às duas planilhas.
- O usuário pode digitar outro valor; ele não é sobrescrito se a comissão externa mudar. Apagando o campo, volta ao 1/3.

## Ajuste de 27/11/2026: colar a tabela da mesa
- Pedido de Fernando: campo para colar o trecho da planilha (ex.: A10 até H13, de Prazo até Parcela USD) e preencher tudo sozinho, como no funding do CDC.
- Preenche: data de início (1º vencimento − 1º prazo), valor em USD (saldo da 1ª linha), número de parcelas, prazos, amortizações e as três taxas. O all-in só é preenchido (soma das três) se estiver vazio. Spot e câmbio futuro continuam com o usuário.
- As taxas não vêm no trecho; saem das linhas: soma da coluna × 360 ÷ soma de (saldo × dias do período), com 4 casas. Na foto dá 6,1468%, 2,0489% e 1,9674%, as do cabeçalho; no bullet, 6,6581%, 2,2194% e 2,3204%.
- A calculadora refaz a tabela com essas taxas e avisa, linha a linha, vencimento, saldo, comissão ou parcela que não bater com o colado (tolerância de 1 centavo nas comissões).
- Aceita o que o Excel copia (tabulação, vírgula decimal, ponto de milhar), linhas de cabeçalho no meio e ponto e vírgula. Todos os campos seguem editáveis.
