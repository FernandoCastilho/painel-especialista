# Conta Garantida

Descrição dos modos de apuração da conta garantida, revisada em 06/11/2026. Rota `#calculadora/conta-garantida`; motor `cotacoes/src/contaGarantida.js`; tela `ContaGarantida.jsx`.

## Escopo e modos

Estimativa de crédito rotativo adimplente com reutilização contratualmente prevista. Não é extrato nem cotação bancária.

**CET (11/11/2026, aprovado por Fernando).** Campo opcional "Limite contratado (R$)", vazio no início. Preenchido, a tela mostra o "CET (art. 6º · 30 dias sobre o limite)", ao ano e ao mês (equivalente composto). Regra: Resolução CMN 4.881/2020, arts. 4º e 6º, texto oficial conferido em 11/11/2026 (adiantamento a depositantes, desconto, cheque especial e crédito rotativo: prazo de 30 dias e limite pactuado). Fluxo: o limite é liberado na data inicial, descontado o IOF adicional (0,38%, cobrado na utilização, como nas demais calculadoras); no 30º dia corrido sai limite + juros de 30 dias (taxa, divisor 30 e contagem de dias da tela) + IOF diário de 30 dias. Ajuste da revisão independente de 11/11/2026: antes, todo o IOF entrava no pagamento final. Não há tarifas no motor. Desconto em dias corridos/365 (`creditCet`). Exemplo: limite de R$ 100.000, 3% a.m., PJ, dias corridos → líquido R$ 99.620,00 e pagamento R$ 103.246,00 → CET 54,49% a.a. (3,69% a.m.). Sem limite, a tela mostra só um pedido curto do limite. O limite não muda o resultado do período. A regra do art. 6º foi conferida no texto oficial da norma em 11/11/2026; a obrigação vale para pessoa física, ME e EPP (art. 1º).

1. **Utilização única:** valor, data inicial e prazo em dias corridos ou data de quitação. O principal é quitado no início da data final, antes da apuração desse dia.
2. **Lançamentos por dia:** utilizações e amortizações de principal até a data final, inclusive. Não há quitação automática no último dia.
3. **Comparar com parcelado:** entrega paralela incorporada à produção em `0a9b237`, preservada neste lote. O comparativo de substituição total/parcial por giro e o diagnóstico opcional de NCG têm [documentação própria](conta-garantida-alongamento.md). As regras de apuração abaixo descrevem os dois primeiros modos; não substituem as premissas do comparativo.

Na conta garantida, juros e IOF são pagos à parte, **nunca incorporados ao principal**. Não existe capitalização de encargos da CG, juros sobre juros, financiamento de IOF ou coluna de encargos debitados. No comparativo, a carência do novo giro tem regras próprias, documentadas separadamente. Essa premissa foi solicitada para o produto; não é afirmação sobre todos os contratos bancários.

A apuração da CG na UI fixa taxa **mensal, proporcional, divisor 30**. A taxa é obrigatória e começa vazia: zero é válido, vazio não é zero. Opções alternativas de base/conversão existentes no motor puro são cobertas por testes, mas não são controles da tela atual.

## Cálculo e datas

- Saldo anterior ao primeiro dia = zero. Para uma operação já em andamento, inclua o histórico desde a utilização original. Informar saldo antigo como novo saque cobra adicional novamente; não é importação de saldo inicial já tributado.
- Lançamentos na mesma data são compensados antes do fechamento, sem ordem intradia. Amortização superior ao principal utilizado bloqueia o resultado.
- Saldo[d] = saldo[d−1] + utilizações[d] − amortizações[d].
- Juros diários na UI = saldo devedor no fechamento × taxa mensal/100/30.
- Para juros, escolha dias corridos ou dias úteis. Dias úteis (desde 11/11/2026) = segunda a sexta, menos os feriados nacionais do calendário do painel (`isBusinessDay(dia, 'BR')` de `holidays.js`, o mesmo do Comparador: inclui Carnaval, Sexta-feira Santa e Corpus Christi) e menos os feriados extras que você informar (locais ou do contrato). Antes, só os feriados digitados eram descontados. **IOF continua em dias corridos.**
- IOF diário = saldo devedor de fechamento × alíquota diária.
- IOF adicional = max(0, saldo[d] − saldo[d−1]) × alíquota adicional. Amortizar não estorna IOF; reutilizar o crédito pode gerar novo adicional.
- Dez dias no modo único produzem dez saldos positivos e onze linhas, sendo a última de quitação com zero. Uso e quitação no mesmo dia resultam em fechamento zero nesta convenção.
- No modo lançamentos, o fechamento final participa do cálculo e o saldo pode permanecer aberto.
- Custo total = juros + IOF diário + adicional. Principal é mostrado separadamente, sem ser chamado de custo.
- Totais preservam precisão integral até a apresentação. Somar valores diários já exibidos em centavos pode diferir do total; não é uma política de escrituração bancária.
- Apuração mensal segue meses civis, sem reaplicar adicional por mera permanência do saldo. Não define datas de recolhimento; primeiro/último mês podem ser parciais.

## IOF e fronteiras do modelo

Regime suportado desde **17/07/2025**: PJ/PF 0,0082% ao dia e 0,38% adicional; Simples/MEI elegível confirmado até R$ 30 mil, 0,00274% ao dia e 0,38%. No Simples o formulário exige valor contratual da operação e confirmação do enquadramento; utilização acima desse valor bloqueia o cálculo. O enquadramento não é inferido do saldo momentâneo nem juridicamente certificado pela tela.

Datas anteriores a 17/07/2025 são **bloqueadas**, sem alternativa de alíquota manual na UI. Não há tabela histórica, transição automática ou previsão de mudanças legais futuras. A tela fixa operação adimplente; o motor também rejeita estados não suportados.

Não se aplica teto genérico de 365 dias à soma dos saldos desta operação rotativa adimplente. Não estão implementados inadimplência, renegociação, principal contratualmente definido, excesso de limite, indexadores variáveis, tarifas ou encargos incorporados. Ampliar o período observado nos dois modos de apuração não converte saldo em empréstimo parcelado. O modo separado Comparar com parcelado projeta uma nova proposta, sem efetivar renegociação ou contratação.

Fontes: [Decreto 6.306/2007, art. 7º I(a), VI e §§ 1º, 12, 15, 16, 18 e 19](https://www2.camara.leg.br/legin/fed/decret/2007/decreto-6306-14-dezembro-2007-566561-normaatualizada-pe.html) e [orientação da Receita de 17/07/2025](https://www.gov.br/fazenda/pt-br/canais_atendimento/imprensa/notas-a-imprensa/2025/julho/receita-federal-do-brasil-explica-como-ficam-os-pagamentos-do-iof-diante-do-novo-entendimento/).

## Interface e privacidade

Até 3.660 dias por simulação e 500 lançamentos; diário paginado em até 31 datas. Labels, cabeçalhos e regiões roláveis têm nomes. Entradas inválidas removem o resultado anterior.

Campos permanecem na memória do componente: trocar os modos mantém os rascunhos; sair da calculadora ou recarregar descarta-os. A calculadora não transmite os campos nem os inclui na busca estática.

## Exemplos vigentes e regressões

Os dois exemplos principais estão vinculados a `test/calculator-doc-examples.test.mjs`:

- R$ 100 mil utilizados em 06/11/2026 por dez dias, 3% a.m. proporcional/30, PJ: juros R$ 1.000; IOF diário R$ 82; adicional R$ 380; custo R$ 1.462; saldo final zero.
- O mesmo principal por quarenta dias: juros R$ 4.000; IOF diário R$ 328; adicional ainda R$ 380; custo R$ 4.708. Saldo não cresce com encargos nem a extensão reaplica adicional.
- Em quatrocentos dias adimplentes, R$ 100 mil geram IOF diário R$ 3.280, sem corte genérico em 365 dias.
- Dias úteis: R$ 100 mil utilizados de 18/11/2026 a 23/11/2026, 3% a.m., PJ. Saldo em cinco dias (18 a 22); juros só em 18 e 19, porque 20/11 é feriado nacional e 21 e 22 são fim de semana: juros R$ 200 (antes, sem digitar o feriado, R$ 300); IOF diário R$ 41 (cinco dias corridos); adicional R$ 380.

`node --test test/conta-garantida*.test.mjs test/calculator-doc-examples.test.mjs` verifica fórmulas, calendários, feriados, saques e amortizações, Simples, limites, não capitalização e interação React. Testes em memória não comprovam foco, layout ou uso por leitor de tela; ver o relatório da revisão correspondente para o que foi realmente executado.

## Histórico documental

A documentação inicial de 05/11/2026 listava bases 1/30/360/365/252, conversão equivalente e alíquota manual para datas antigas como se fossem opções da tela. São descrições superadas: a UI atual usa mensal proporcional/30 e bloqueia o histórico anterior a 17/07/2025. Os registros antigos de execução parcial e restrições de ambiente descreviam aquela tarefa, não constituem instruções operacionais da versão atual.
