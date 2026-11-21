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

## 9. Ideia inicial de Fernando para a tela (18/11/2026)

**Fluxo pedido:** o especialista informa a necessidade de crédito → a tela captura informações do cliente (cidade, CNAE, tributação, S.A. ou Ltda., informações de risco) e as perguntas próprias daquela necessidade → a tela devolve duas ou três sugestões.

Isso encaixa nos passos desta árvore: as informações do cliente alimentam os filtros da seção 4, e as perguntas por necessidade são as fichas da seção 6.

### O que cada informação muda (hipóteses a validar **[V]**, salvo marca)

| Informação | Para que serviria |
|---|---|
| Cidade / UF | Linhas regionais; leitura de risco da região (o Painel já tem recuperação judicial por UF). |
| CNAE | Ligar ao estudo setorial do Painel; sazonalidade; linhas próprias do setor (exportador, agro, bem elegível ao BNDES). |
| Tributação | Simples Nacional paga IOF de crédito menor em operação de até R$ 30 mil **[R]** `iofRules.js`. O regime muda o peso dos juros no imposto da empresa. |
| S.A. ou Ltda. | Acesso a instrumentos de mercado de capitais. |
| Risco | Garantia exigida, prazo possível e linhas ao alcance. |

### O que o Painel já tem e pode ser reaproveitado

- Calculadoras para simular cada sugestão (seção 5).
- Estudos setoriais em 12 grupos e 37 temas. Não há ligação automática com CNAE (`setores-bancarios.md`); essa ponte teria de ser criada.
- Busca de atividade do IBGE por nome ou código (usada na calculadora de CBS).
- Regime tributário já tratado em duas calculadoras: IOF (Simples ou não) e Aplicação PJ (Lucro Real, Presumido, Simples).
- Recuperação judicial por UF e setor, com dados públicos.
- O Painel é um site sem servidor próprio: o que se digita nas calculadoras fica só na tela.

### Projetos públicos encontrados no GitHub (busca de 18/11/2026)

Avaliação só por descrição, estrelas, licença e data da última atualização. O código de cada um não foi aberto.

| Para que | Projeto | Estrelas | Licença | Última atualização |
|---|---|---|---|---|
| Regras de decisão em tabela | CacheControl/json-rules-engine | 3.149 | ISC | 2026-02-16 |
| Regras de decisão em tabela | gorules/zen | 2.139 | MIT | 2026-11-17 |
| Regras de decisão em tabela | jwadhams/json-logic-js | 1.489 | MIT | 2024-07-09 |
| Formulário guiado por perguntas | surveyjs/survey-library | 4.931 | MIT | 2026-11-17 |
| Dados públicos da empresa pelo CNPJ | BrasilAPI/BrasilAPI | 11.596 | MIT | 2026-11-17 |
| Dados públicos da empresa pelo CNPJ | cuducos/minha-receita | 1.611 | não informada | 2026-01-04 |
| Dados públicos da empresa pelo CNPJ | Hitmasu/OpenCNPJ | 430 | MIT | 2026-11-03 |
| Base da Receita para consulta própria | rictom/cnpj-sqlite | 246 | MIT | 2026-10-26 |
| Lista de CNAE | endersonmaia/ibge-cnae-sql | 30 | MIT | 2022-02-13 |

Não apareceu projeto pronto que escolha modalidade de crédito para empresa brasileira. Os "motores de crédito" encontrados dão nota de risco ao tomador, o que é outra coisa.

### Riscos e limites

- **Sigilo:** consultar o CNPJ de um cliente em serviço de terceiro revela quem o banco está analisando. Depende de autorização de Fernando.
- **Risco interno:** rating, limite e dados internos de cliente não entram no Painel em nenhuma hipótese.
- **Sugestão não é oferta:** a tela indicaria candidatas; aprovação, preço e enquadramento continuam fora dela.

---

## 10. Entrevista de 18/11/2026 — o que ficou entendido

Entrevista conduzida com Fernando para cruzar necessidade, operação, risco e retorno. As regras públicas pesquisadas no mesmo dia estão em `arvore-credito-regras-produtos.md`.

### Decisões de Fernando

| Decisão | Observação |
|---|---|
| Perfil do cliente preenchido pelo CNPJ | Substitui a escolha anterior, de entrada manual. A entrada manual fica como alternativa. |
| Risco informado por faixa (baixo, médio, alto) mais garantias | Não aparece na visão que o cliente enxerga. O que a faixa muda na folha ainda não foi definido. |
| Vinte necessidades | As dez da nota original mais as dez sugeridas (N11 a N20). |
| Nada do banco na tela | Substitui o objetivo anterior de mostrar retorno para o banco. Custo de captação e ordem entre linhas ficam fora da tela e deste documento. |
| Uso: o especialista prepara sozinho e depois mostra ao cliente uma visão de apresentação | — |
| Números em modo misto | A folha sempre traz a comparação em texto. Parcelas e custo total só nas operações em que o especialista digitar a taxa. |
| Abertura da tela | Primeiro quem é o cliente; depois o pedido (o que precisa, para quê, valor e prazo); em seguida a checagem do pedido contra o faturamento. |
| Faturamento e endividamento entram pela mesma tabela colada da calculadora Faturamento | Competência, faturamento e endividamento, mês a mês. Fica só na tela. |

### Como Fernando decide (relato, caso da máquina importada de R$ 5 milhões)

1. **Cobertura e regras:** o que a operação paga e quais impostos incidem. O FINIMP, na prática do time, não paga os impostos de importação; o 4131 paga máquina e impostos e não tem IOF de crédito.
2. **Fluxo:** prazo e parcelas casados com o caixa da empresa.
3. **Moeda:** dívida em moeda estrangeira com NDF, para ficar em reais.
4. **Custo para o cliente:** custo efetivo total, com imposto e proteção.

**Ordem da folha nesse caso:** 4131 com NDF; FINIMP com proteção cambial (valor menor, só a máquina); CPR, se a empresa estiver apta pelo CNAE e pela validação das notas fiscais; Finame, pelo custo; capital de giro por último. As operações em que a empresa não se enquadra saem da folha.

**Ressalva registrada:** o Finame Materiais financia bem de fabricação nacional (conteúdo importado de até 40%). Para máquina importada, só entraria se houvesse alternativa nacional.

### Regras relatadas por Fernando

- **Tributação:** no Lucro Presumido, o ganho do NDF é tributado e a empresa não abate o outro lado; no Lucro Real a operação fecha. Conferido nos textos de lei; falta validação de tributarista. Deve ser considerado em todas as modalidades.
- **Cidade:** muda o acesso a linhas e condições de fomento (exemplo: Nordeste).
- **S.A.:** pode fazer nota comercial no regime FÁCIL. A pesquisa mostrou que nota comercial também serve para Ltda.; FÁCIL e debênture, só para S.A.
- **CNAE e porte:** CNAE habilita a CPR; o banco não faz CPR para microempresa (regra do banco, não da lei).
- **BNDES:** linha que aceite o bem ou saia mais barata deve entrar na comparação.

### Parcela sazonal (relato)

- Mês de faturamento baixo: sem parcela de principal; no mínimo, pagar os juros, para a dívida não crescer.
- Mês de faturamento alto: parcela maior.
- Critério: equilíbrio entre o que a empresa aguenta no mês fraco e o custo total.
- Objetivo: nunca haver estrangulamento de caixa nem dívida excessiva de curto prazo. Dívida curta demais pede alongamento.

### O que a tabela de faturamento e endividamento permite

- **Permite:** ver picos e vales de faturamento (sazonalidade), a evolução do saldo de dívida e o tamanho da dívida em meses de faturamento.
- **Não permite:** saber quanto da dívida vence em cada mês. A tabela traz o saldo, não os vencimentos. Dívida concentrada no curto prazo só aparece se o especialista informar quanto vence em 12 meses.

### Continuação da entrevista (18/11/2026)

- **Faixa de risco removida da tela** (decisão de Fernando). Substitui a escolha anterior, de faixa mais garantias. Ficam as garantias disponíveis e a checagem do pedido contra o faturamento.
- **Regras embutidas na tela** (pedido de Fernando): legislação e regras de BNDES, CPR, 4131, FINIMP, ACC/ACE, debênture e nota comercial, com fonte e data, para a sugestão sair correta. Cada possibilidade mostra a regra que a incluiu ou excluiu.
- **Necessidades que mais chegam ao time:** gap de caixa; importação de matéria-prima; operação estruturada para distribuir dividendos; compra de outra empresa; compra de estoque nacional por prazo longo; além da máquina importada.
- **Folha do gap de caixa, na ordem de Fernando:** 4131; Finame Materiais, se as notas estiverem validadas; CPR, se o CNAE permitir e as notas estiverem validadas; capital de giro, se o prazo passar de 12 meses; Conta Garantida ou desconto de duplicatas, se for pontual.
- **Regra geral de ordem (confirmada por Fernando):** primeiro as linhas mais baratas em que a empresa se enquadra; por último as linhas livres em reais.
- **Finame Materiais (correção de Fernando):** funciona como reembolso de notas de gastos já feitos, não só de compra futura. Fernando fala em 11 meses; o Painel registra notas de até 12 meses antes do protocolo. Em conferência no site do BNDES.
- **Parcela irregular e pagamento só de juros nos meses fracos:** dá em 4131, capital de giro, CPR e nota comercial (relato de Fernando). FINIMP e Finame não foram citados; tratados como parcela fixa até confirmação.
- **Cuidado registrado:** no Lucro Presumido, o 4131 continua na folha com aviso sobre o imposto do NDF.
- **Limite da folha (decisão de Fernando):** mostrar no máximo três possibilidades. As demais ficam disponíveis para o especialista escolher, se for o caso. Motivo dado: excesso de apresentação é ruim. Vale para todas as necessidades.
- **Folha de distribuição de dividendos (candidatas):** 4131, capital de giro, nota comercial, debênture (só S.A.) e giro do BNDES. Ordem ainda a definir por Fernando. Finame, CPR e as demais linhas do BNDES não servem: o dinheiro tem destino próprio, e nenhuma linha do BNDES cobre distribuição de lucro.
- **Folha de dividendos confirmada por Fernando:** 4131 (no Lucro Presumido desce por causa do imposto do NDF), capital de giro e giro do BNDES com aviso. Nota comercial e debênture ficam em "outras opções".
- **Critério de ordem (Fernando):** comparar o que é mais eficiente em repagamento (encaixe com o fluxo de caixa e o faturamento da empresa) e o que é mais barato. Os dois juntos, não só um deles.
- **Folha de máquina nacional (investimento), confirmada por Fernando:** 1) Finame (Finame BK; se a máquina for 4.0 ou eficiente em energia, a linha específica do BNDES: Finame Máquinas 4.0, Finame Baixo Carbono ou Fundo Clima); 2) 4131 com NDF; 3) capital de giro. Se houver obra ou ampliação junto, o BNDES Automático substitui o Finame (proposta do Claude, dentro do mesmo desenho).
- **Folha de matéria-prima importada, confirmada por Fernando:** 1) FINIMP com proteção cambial; 2) 4131 com NDF (em prazo curto, IOF de câmbio de 3,5% na entrada); 3) capital de giro para impostos e frete. Sem BNDES: nenhuma linha financia insumo importado.
- **Exportação e importação (relato de Fernando):** há clientes que exportam e importam. Na exportação, ACC; se o bem exportado for máquina, também linhas do BNDES.
- **Folha de exportação, confirmada por Fernando:** 1) ACC ou ACE; 2) BNDES Exim Pré-embarque, quando o bem exportado está na lista do BNDES (máquinas inclusive); 3) nota de crédito à exportação.
- **Cliente que exporta e importa (proposta do Claude, não confirmada):** a receita em moeda estrangeira pode pagar a dívida da importação (proteção natural), reduzindo ou dispensando o NDF; a tela compararia valores e prazos em dólar das duas pontas. Desde 01/10/2026 a exportadora pode ter conta em moeda estrangeira no Brasil (Res. BCB 575/2026).
- **Folha de compra de outra empresa, confirmada por Fernando:** 1) 4131 com NDF, prazo longo; 2) capital de giro de prazo longo; 3) nota comercial, para valor maior. BNDES só em operação direta, caso a caso, acima de R$ 20 milhões.
- **Folha de estoque nacional por prazo longo, confirmada por Fernando:** 1) Finame Materiais (reembolso das notas dos últimos 12 meses, itens da lista do BNDES); 2) 4131; 3) capital de giro. CPR entra no lugar do capital de giro quando a empresa estiver apta. Cartão BNDES em "outras opções" para MPME.
- **Fim da rodada de folhas (18/11/2026):** oito necessidades principais confirmadas por Fernando — máquina importada, máquina nacional, gap de caixa, matéria-prima importada, exportação, dividendos, compra de outra empresa e estoque nacional. As demais necessidades da árvore seguem como proposta do Claude, marcadas para revisão.
- **Giro do BNDES nos dividendos (decisão de Fernando):** entra com aviso. A página do BNDES diz que a linha é para "fortalecimento do capital de giro, visando à manutenção e/ou à geração de empregos" e "necessidades do dia a dia"; não exige comprovar o uso, mas o banco repassador pode pedir informações sobre a utilização. O aviso na folha diz isso. Recomendação do Claude era não incluir; registrada a divergência. Fonte: [BNDES Crédito Pequenas e Médias Empresas](https://www.bndes.gov.br/wps/portal/site/home/financiamento/produto/bndes-credito-pequenas-e-medias-empresas), consulta em 18/11/2026.

### Perguntas do dia (rotina autorizada em 21/11/2026)

Rotina "Árvore de Crédito — perguntas do dia", dias úteis às 7h47, convivendo com a pergunta diária do ChatGPT (decisão de Fernando em 21/11/2026: manter as duas). Base: este documento e a nota do Obsidian "Árvore de decisão de crédito PJ".

- **21/11/2026 — triagem da 4131 vale para todas as necessidades** (decisão de Fernando). A triagem definida em 19/11 e 20/11 para o alongamento de dívida (sem aperto relevante de caixa, alavancagem compatível e capacidade de pagamento demonstrada; proteção cambial pode ser parcial) passa a valer também no gap de caixa, dividendos, compra de empresa, máquina importada e nas demais folhas em que a 4131 aparece. Hoje a tela aplica a triagem só no alongamento; a mudança na tela ainda não foi feita.

- **21/11/2026 — lista de necessidades em proposta: vale a do Obsidian** (decisão de Fernando). As situações N11 a N20 da nota "Árvore de decisão de crédito PJ" (planta por etapas, locação, máquina urgente, safra, desconto à vista de fornecedor, carteira concentrada, insumo importado recorrente, vencimento concentrado, moedas diferentes, garantia à contraparte estrangeira) substituem as quatro propostas que a tela mostra hoje, como "proposta, a revisar". As perguntas do dia vão confirmá-las uma a uma. A mudança na tela ainda não foi feita.

- **21/11/2026 — ciclo de caixa entra como dado opcional** (decisão de Fernando). Três campos opcionais: prazo médio de recebimento, de estoque e de pagamento a fornecedor. Servem para separar a parte permanente da necessidade (linha longa) da parte de pico (linha curta), reaproveitando a conta de necessidade de capital de giro que o Painel já tem na Conta Garantida (`alongamento.js`, `estimateNcg`), sem regra nova. A mudança na tela ainda não foi feita.

**Aplicação na tela autorizada por Fernando em 21/11/2026** ("1": aplicar e publicar, com testes e parecer do Auditor). Detalhe em `docs/arvore-credito-tela.md`, seção "Atualização de 21/11/2026".

### Propostas do Claude ainda não confirmadas

- Mostrar, por mês, quanto do faturamento vai para pagar a nova operação, sem limite fixo; o ponto de alerta seria definido por Fernando.
- Campo opcional "quanto da dívida vence em 12 meses".
- A tela pode sugerir alongamento da dívida atual mesmo quando o pedido do cliente é outro.

### Pendências

- O que a faixa de risco muda na folha.
- Em quais operações o banco aceita parcela irregular e pagamento só de juros.
- O que é validado nas notas fiscais para a CPR.
- A ordem da folha para as outras 19 necessidades (Fernando só descreveu a da máquina importada).
- Validação tributária do efeito do regime sobre a proteção cambial.
- Teste dos serviços públicos de CNPJ (bloqueados na sessão de 18/11/2026).

---

## Histórico
- 2026-11-18 — Claude (Agente de Ideação): registrada a entrevista com Fernando (seção 10) e a pesquisa de regras dos produtos em arquivo próprio.
- 2026-11-18 — Claude: registrada a ideia inicial de Fernando para a tela e a busca de apoio no Painel e no GitHub (seção 9).
- 2026-11-18 — Claude: estruturação em passos, filtros, ficha de modalidades e fichas de situação, a partir da nota do Obsidian de 2026-11-17. Nenhuma regra de cálculo do Painel foi alterada. Proposta, sem validação de Fernando.
