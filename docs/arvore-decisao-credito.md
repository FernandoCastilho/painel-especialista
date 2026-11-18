# Árvore de decisão de crédito PJ — versão estruturada para o especialista

Proposta de 18/11/2026. Ainda não é tela do Painel, política do banco, parecer de crédito nem cotação.

**Origem:** nota "Árvore de decisão de crédito PJ" do Obsidian (LLM Wiki, 17/11/2026, estado "em desenvolvimento", confiança baixa). Esta versão organiza aquele conteúdo na ordem em que o especialista conversa com o cliente. As decisões de Fernando registradas na nota foram mantidas. A nota do Obsidian não foi alterada.

**Como ler as marcas de confiança**

| Marca | Significado |
|---|---|
| **[R]** | Regra pública já conferida e documentada no Painel (o arquivo de origem está citado). |
| **[F]** | Prática relatada por Fernando. Não é regra legal geral. |
| **[V]** | A validar. Conhecimento geral de mercado, sem fonte conferida nesta rodada. |

Sem dados de cliente: nada aqui identifica empresa, operação, limite ou rating.

---

## 1. O caminho em cinco passos

1. **Entender** a necessidade com seis perguntas (seção 2).
2. **Escolher o ramo** e a situação parecida (seção 3).
3. **Passar as modalidades candidatas por seis filtros**, na ordem (seção 4). Os quatro primeiros eliminam; o quinto compara preço; o sexto confirma se dá para fazer.
4. **Simular** as que sobraram nas calculadoras do Painel (seções 5 e 6).
5. **Levar ao cliente** uma recomendação, uma alternativa e o motivo (seção 7).

Regra de ouro da árvore: **partir da necessidade, não do produto**. A pergunta que manda em tudo é: *de onde vem o dinheiro para pagar o crédito, e quando ele entra no caixa?*

---

## 2. Passo 1 — As seis perguntas de entrada

| # | Pergunta ao cliente | O que a resposta decide |
|---|---|---|
| 1 | **Para que é o dinheiro?** O que será pago, a quem e em que moeda. | O ramo da árvore e as linhas que podem ser usadas. |
| 2 | **Quanto e quando?** Valor e datas de cada saída. Inclui impostos, frete e despesas? | Se uma linha só cobre tudo ou se é preciso combinar duas. |
| 3 | **De onde vem o dinheiro para pagar, e quando entra?** | Prazo, carência e forma de pagamento. |
| 4 | **É pontual, sazonal ou permanente?** Há data certa para o buraco fechar? | Linha curta rotativa ou linha parcelada mais longa. |
| 5 | **Há moeda estrangeira em algum ponto?** No pagamento ou na receita. | Se dívida em moeda estrangeira faz sentido e se precisa de proteção cambial. |
| 6 | **O que a empresa tem de lastro?** Duplicatas, o próprio bem, contrato de exportação, aplicação, imóvel, aval. | Quais linhas estão ao alcance e a que custo. |

Em todos os casos, separar **descasamento temporário com saída identificável** de **déficit recorrente**. O primeiro pede crédito curto; o segundo pede investigar a causa antes de emprestar.

---

## 3. Passo 2 — Os ramos e as situações

Os quatro ramos são os da nota original. A distribuição das dez situações entre eles é proposta desta versão.

```
Qual é a necessidade?
│
├─ A. Comprar ou investir ........ quando o investimento começa a gerar caixa?
│    ├─ Máquina importada ............................ N01
│    └─ Frota ou máquina nacional .................... N07
│
├─ B. Cobrir falta de caixa ...... qual entrada cobre o buraco, e em que data?
│    ├─ Buraco pontual ............................... N03
│    ├─ Estoque sazonal .............................. N04
│    ├─ Insumos para contrato ainda não faturado ..... N05
│    ├─ Crescimento que aperta o caixa ............... N06
│    └─ Produzir para exportar antes de receber ...... N08
│
├─ C. Reorganizar dívida ......... quanto é permanente e quanto oscila?
│    └─ Alongar desconto e Conta Garantida ........... N02
│
└─ D. Dar garantia a terceiro .... qual obrigação precisa ser garantida?
     ├─ Fornecedor estrangeiro pede segurança ........ N09
     └─ Garantia de execução de contrato ............. N10
```

Uma necessidade pode cair em dois ramos ao mesmo tempo (por exemplo, máquina importada cujo fornecedor exige garantia: N01 + N09). Nesse caso, a solução é uma combinação.

---

## 4. Passo 3 — Os seis filtros, na ordem

| # | Filtro | Pergunta | Se a resposta for "não" |
|---|---|---|---|
| 1 | **Cobertura** | A linha paga tudo o que precisa ser pago (bem, impostos, frete, despesas)? | Combinar com uma segunda linha para o que sobra, ou descartar. |
| 2 | **Prazo** | O vencimento casa com a data em que o caixa entra? | Ajustar prazo e carência, ou descartar. Dívida curta para necessidade longa vira rolagem. |
| 3 | **Moeda** | A moeda da dívida é a mesma da receita que vai pagá-la? | Somar o custo da proteção cambial antes de comparar. Sem proteção, o risco precisa ser dito ao cliente. |
| 4 | **Lastro** | A empresa tem a garantia ou o lastro que a linha exige? | Descartar, ou ver se outra garantia serve. |
| 5 | **Custo total** | Somando juros, impostos, tarifas e proteção, qual sai mais barata **para o mesmo valor líquido recebido**? | Ordenar as que sobraram. Comparar custo total, nunca só a taxa. |
| 6 | **Viabilidade** | Dá tempo? Há limite, documentos e enquadramento? | Guardar como alternativa e explicar o que falta. |

Critérios de desempate, quando o custo é parecido: liberdade para quitar antes, preservar o limite de curto prazo da empresa, simplicidade da operação.

O retorno para o banco continua sendo objetivo da árvore (decisão de Fernando). Nesta etapa de organização ele não entra como filtro, porque não se usam indicadores internos aqui.

---

## 5. Ficha das modalidades — o que cada uma financia

Fernando definiu em 13/11/2026 que comparar modalidades exige detalhar o que cada uma financia, impostos, prazo, custos e limitações. Esta ficha é o esqueleto dessa comparação. Onde está **[V]**, falta fonte.

| Modalidade | Serve para | Limitações | Custos a somar | Moeda | Onde simular no Painel |
|---|---|---|---|---|---|
| **Capital de giro parcelado** (prefixado ou pós-CDI) | Uso livre. Parte permanente da necessidade de caixa. | Parcela precisa caber na sobra mensal. | Juros + tarifa + IOF de crédito: 0,0082% ao dia sobre o principal amortizado, até 365 dias, mais 0,38% **[R]** `comparador-credito.md` | Reais | Capital de Giro; Comparador de Crédito |
| **Conta Garantida** | Descasamento pontual, de dias ou semanas. | Cara quando o saldo fica parado; não serve para necessidade permanente. Renovação do limite não é garantida. | Juros sobre o saldo usado + IOF sobre os saldos **[R]** `conta-garantida-alongamento.md` | Reais | Conta Garantida (inclui "Comparar com parcelado") |
| **Desconto de duplicatas / antecipação** | Transformar em caixa a venda a prazo já faturada. | Só existe se houver títulos elegíveis. O prazo é o dos títulos. | Juros descontados na liberação + tarifa por título + TAC + IOF **[R]** `analise-desconto.md` | Reais | Análise de desconto; Comparador |
| **Finame / BNDES** | Bem nacional elegível e projetos. | Depende de o bem e a empresa serem elegíveis **[V]**. Prazo e carência têm limites próprios. | Custo financeiro do BNDES + spread do agente. IOF: confirmar caso a caso; o Painel mantém o Finame bloqueado até confirmar o enquadramento em IOF zero **[R]** `finame-auditoria-2026-11-06.md` | Reais (ou moeda contratual do BNDES) | Área BNDES; Comparador |
| **FINIMP** | Pagar o fornecedor estrangeiro de bem ou insumo importado. | Impostos da importação ficam de fora **[F]**. A calculadora do Painel vai de 30 a 360 dias; prazo maior precisa ser validado **[V]**. | Juros simples (base 360) + flat + TAC **[R]** `finimp-comparacao.md`. Impostos, câmbio e proteção ficam fora da calculadora. | Estrangeira: há risco cambial se a receita é em reais. | FINIMP; Comparador |
| **Empréstimo externo (4131)** | Uso livre; pode abranger também os impostos **[F]**. | A partir de US$ 1 milhão, declaração no Banco Central **[R]**. | Juros + IR de 15% sobre os juros (mais caro se o tomador assume o imposto) + IOF de câmbio na entrada: **3,5% se o prazo médio for de até 364 dias; zero acima disso**. Não paga IOF de crédito. + custo da proteção cambial **[R]** `emprestimo-4131.md` | Estrangeira: comparar sem proteção, com swap para CDI e com NDF. | Empréstimo externo (4131) |
| **ACC / ACE** | Antecipar em reais a receita de uma exportação: ACC antes do embarque, ACE depois. | Só para quem exporta. Se a exportação não acontecer, a devolução é em reais, com juros, despesas, efeito do câmbio e possível encargo do Banco Central **[R]** `aprender-acc.md`. Prazos máximos e impostos **[V]**. | Deságio (juros) + comissões + tarifas **[R]** | Estrangeira, paga pela própria receita em moeda estrangeira. | Aprender › ACC (não há calculadora) |
| **Carta de crédito de importação** | Dar ao fornecedor estrangeiro a segurança de que será pago. | **Não é dinheiro**: não resolve falta de caixa nem prazo. | Comissões **[V]** | — | Não há tela |
| **Fiança bancária** | Garantir uma obrigação da empresa perante terceiro. | **Não é dinheiro.** O texto e o prazo exigidos por quem recebe a garantia mandam. | Comissão sobre o valor garantido **[V]** | — | Não há tela |
| **Proteção cambial** (NDF, swap) | Travar o câmbio de uma dívida ou de um pagamento em moeda estrangeira. | **Não é crédito**; acompanha a dívida. NDF liquida pela diferença no vencimento e exige contrato global de derivativos (CGD) **[R]** `emprestimo-4131.md` | Embutido na taxa a termo ou no swap. | — | Empréstimo externo (4131) |

---

## 6. Fichas das situações

Cada ficha tem a mesma forma: a pergunta que decide, o que mais perguntar, as candidatas, como ler, cuidados e onde simular. "Candidata" não é oferta nem produto garantido.

### N01 — Máquina importada (exemplo: 36 meses, 3 de carência)
- **Pergunta que decide:** quando o fornecedor recebe, quando a máquina começa a produzir e em que moeda a empresa fatura?
- **Perguntar também:** quanto é o bem e quanto são impostos e despesas de nacionalização? O fornecedor exige garantia (ver N09)? Há receita em moeda estrangeira? Existe similar nacional?
- **Candidatas:** FINIMP, 4131, crédito em reais, e combinações.
- **Como ler:**
  - FINIMP paga o bem; os impostos ficam de fora **[F]**. Sobra uma segunda necessidade, em reais.
  - 4131 pode cobrir bem e impostos numa operação só **[F]**. Com 36 meses, o prazo médio tende a passar de 364 dias, o que zera o IOF de câmbio na entrada **[R]**; conferir na calculadora. Somar IR sobre os juros e a proteção cambial.
  - Crédito em reais cobre tudo e não tem risco cambial, mas paga IOF de crédito **[R]**.
  - Isto é relato de prática: **não prova que o 4131 seja sempre melhor**. A resposta sai da comparação de custo total.
- **Combinações a testar:** FINIMP (bem) + giro (impostos); 4131 integral + NDF ou swap; qualquer uma + carta de crédito, se o fornecedor exigir.
- **Cuidados:** dívida em moeda estrangeira sem proteção quando a receita é só em reais. Carência menor que o tempo até a máquina produzir.
- **Simular:** FINIMP, Empréstimo externo (4131), Comparador de Crédito.
- **Pendente:** revalidar na fonte oficial a linha do BNDES para importado sem similar nacional antes de incluí-la.

### N02 — Alongar desconto de duplicatas e Conta Garantida
- **Pergunta que decide:** quanto continua usado mesmo depois de a empresa receber as vendas?
- **Perguntar também:** saldo médio e saldo mínimo dos últimos meses; sobra mensal de caixa; por que o uso virou permanente (prazo ao cliente, estoque, prejuízo).
- **Candidatas:** giro parcelado para a parte permanente; manter a linha curta só para a oscilação.
- **Como ler:** o saldo mínimo recorrente é a parte permanente. Trocar essa parte por parcelado tende a baixar o custo e faz a dívida cair. A parcela precisa caber na sobra mensal.
- **Cuidados:** se a causa é prejuízo na operação, alongar não resolve. Risco de a empresa voltar a usar a Conta Garantida e ficar com as duas dívidas.
- **Simular:** Conta Garantida › Comparar com parcelado; Análise de desconto.

### N03 — Falta de caixa
- **Pergunta que decide:** qual entrada cobre o buraco, em que data e com que grau de certeza?
- **Como ler:**
  - Entrada certa, com títulos emitidos → desconto ou antecipação.
  - Entrada certa, sem títulos, em dias ou semanas → Conta Garantida.
  - Sem entrada identificada, ou buraco que se repete → é necessidade permanente: tratar como N02 ou N06 e entender a causa antes.
- **Simular:** Análise de desconto; Conta Garantida; Capital de Giro.

### N04 — Estoque sazonal
- **Pergunta que decide:** quando o estoque vira venda, e quando a venda vira caixa?
- **Candidatas:** giro com vencimento alinhado ao pico de recebimento (pagamento único ou carência); depois da venda, antecipação da parte faturada.
- **Cuidados:** prazo maior que a estação transforma dívida sazonal em permanente. Estoque importado puxa a análise de moeda (N01).
- **Simular:** Comparador de Crédito (pagamento único ou carência).

### N05 — Insumos para contrato antes do faturamento
- **Pergunta que decide:** o contrato paga adiantamento ou por etapas?
- **Candidatas:** giro casado com o cronograma de recebimento; antecipação depois de faturar; fiança, se o contratante exigir garantia (N10).
- **Cuidados:** atraso de medição ou de entrega atrasa o pagamento. Dependência de um único pagador.
- **Simular:** Capital de Giro; Comparador.

### N06 — Crescimento que aperta o caixa
- **Pergunta que decide:** o caixa está sendo consumido em estoque, em prazo dado ao cliente ou nos dois?
- **Candidatas:** giro parcelado para a necessidade permanente; antecipação seletiva nos picos; rever prazos de compra e de venda.
- **Cuidados:** financiar crescimento permanente com linha curta rotativa.
- **Simular:** Conta Garantida tem a conta da necessidade de capital de giro (por saldos ou por prazos); Capital de Giro.

### N07 — Frota ou máquina nacional
- **Pergunta que decide:** o bem é elegível, e quando passa a gerar receita ou economia?
- **Candidatas:** Finame, quando elegível; financiamento em reais.
- **Simular:** Área BNDES; Comparador (BNDES contra giro).

### N08 — Produzir para exportar antes de receber
- **Pergunta que decide:** já houve embarque? Quando o comprador paga?
- **Como ler:** antes do embarque, ACC; depois, ACE. Enquadramento a validar **[V]**.
- **Cuidados:** se a exportação não acontecer, a saída é cara **[R]**.
- **Simular:** não há calculadora; material em Aprender › ACC.

### N09 — Fornecedor estrangeiro pede segurança
- **Pergunta que decide:** falta só a garantia de pagamento, ou a empresa também precisa de prazo?
- **Como ler:** só garantia → carta de crédito. Garantia e prazo → carta de crédito mais FINIMP, tratados como duas coisas separadas.
- **Simular:** FINIMP (para a parte de prazo).

### N10 — Garantia de execução de contrato
- **Pergunta que decide:** qual obrigação, valor, prazo e texto são exigidos?
- **Como ler:** fiança, quando aceita por quem exige. Se também falta caixa para executar, somar crédito de execução (N05).
- **Simular:** não há tela.

---

## 7. Passo 5 — O que levar ao cliente

Uma página, nesta ordem:

1. **A necessidade em uma frase**, com valor, datas e fonte de pagamento.
2. **Solução recomendada:** o que cobre, prazo, carência, custo total, garantia.
3. **Alternativa** e por que ficou em segundo lugar.
4. **O que fica de fora** da solução (por exemplo, impostos) e como será coberto.
5. **Riscos ditos com clareza:** câmbio, juros variáveis, renovação de limite.
6. **Próximos passos:** documentos e prazos.

O Comparador de Crédito do Painel tem modo de apresentação em tela cheia para mostrar os números.

---

## 8. O que falta

**Validar antes de usar como regra**
- Tudo o que está marcado **[V]** e **[F]** na seção 5.
- FINIMP com prazo acima de 360 dias.
- Prazos e impostos de ACC e ACE.
- Linha do BNDES para importado sem similar nacional.
- Elegibilidade, disponibilidade e prazos reais de cada modalidade: nada aqui presume aprovação nem economia de imposto.

**Dez situações que não foram recuperadas**
A nota original registra que existiu uma matriz de 20 necessidades e que só dez foram recuperadas. As dez abaixo são **sugestão nova desta versão**, não recuperação:

| ID sugerido | Necessidade | Primeiras candidatas a estudar **[V]** |
|---|---|---|
| N11 | Vender a prazo sem carregar o cliente no caixa | Vendor; antecipação de recebíveis de cartão |
| N12 | Ganhar prazo com fornecedor nacional | Compror; risco sacado |
| N13 | Importar insumos de giro (não máquina) | FINIMP curto; carta de crédito. Atenção: 4131 com prazo médio de até 364 dias paga 3,5% de IOF de câmbio **[R]** |
| N14 | Exportador que precisa de giro sem embarque específico | Nota de crédito à exportação; pré-pagamento de exportação |
| N15 | Obra, ampliação ou planta nova | BNDES para projetos; fundos regionais; mercado de capitais |
| N16 | Comprar imóvel operacional ou levantar caixa com imóvel em garantia | Financiamento imobiliário PJ; crédito com garantia de imóvel |
| N17 | Comprar empresa ou pagar saída de sócio | Giro longo; 4131; mercado de capitais |
| N18 | Saída pontual previsível (13º, impostos, dividendos) | Giro curto; Conta Garantida; antecipação |
| N19 | Dívida cara em outro banco | Troca por linha mais barata ou mais longa |
| N20 | Proteger dívida ou fluxo em moeda estrangeira já existente | NDF; swap |

Agronegócio (CPR, crédito rural) fica fora até Fernando dizer se entra no escopo.

**No Painel**
- Não há calculadora para ACC/ACE, carta de crédito e fiança.
- A árvore não está implementada no Painel. Esta versão já indica, em cada situação, qual calculadora existente serviria.

---

## Histórico
- 2026-11-18 — Claude: estruturação em passos, filtros, ficha de modalidades e fichas de situação, a partir da nota do Obsidian de 2026-11-17. Nenhuma regra de cálculo do Painel foi alterada. Proposta, sem validação de Fernando.
