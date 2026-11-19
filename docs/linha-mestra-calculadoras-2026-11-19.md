# Calculadoras: linha mestra e visual único (19/11/2026)

Pedidos do Fernando em 19/11/2026:

1. Capital de giro, Conta garantida e Análise de desconto no mesmo formato do Comparador de crédito, com uma **linha mestra da necessidade do cliente** no topo.
2. Cores, botões e ícones iguais em todas as calculadoras, com a calculadora do BNDES como modelo.

Combinado aprovado ("Ok, pode executar") com estas escolhas: as três calculadoras citadas (4131, Finimp e Operação DI ficam para depois); a linha mestra leva os valores de uma calculadora para a outra; padrão de R$ 1.000.000,00 em 24 meses; visual junto, com o Capital de giro no fundo escuro.

Fotos: pasta `docs/linha-mestra-calculadoras/`.

## 1. Linha mestra · necessidade do cliente

Um quadro só, o mesmo nas quatro calculadoras de empréstimo, sempre no topo:

| Calculadora | Campos da linha mestra | O que fica nas condições do produto |
|---|---|---|
| Comparador de crédito | valor, prazo total, carência, amortização, data da liberação, praça, regime tributário (só dele) | as colunas de comparação |
| Capital de giro | valor solicitado, prazo total, carência, amortização, data da liberação, praça | taxa, despesas, IOF, 1º vencimento (opcional), garantia |
| Conta garantida (utilização única) | valor utilizado, data da utilização, prazo em dias ou data de quitação | taxa, limite, dias que geram juros, IOF |
| Análise de desconto | data da operação, praça, valor para o giro comparado | títulos, convenção, tarifas, projeção mensal, giro |

- **Valores passam de uma calculadora para a outra:** o que se digita no Giro já aparece no Comparador, na Conta garantida e no Desconto. Ficam só nesta aba do navegador (somem ao fechar a aba) e nunca saem do aparelho. O botão **Limpar** volta ao padrão.
- **Padrão:** R$ 1.000.000,00 em 24 meses, sem carência, Price, data de hoje, praça nacional. O BNDES continua com o padrão dele (R$ 1 milhão, 48 meses, 3 de carência).
- **Conta garantida:** no modo "Lançamentos por dia" a tela continua como antes (a linha mestra vale para a utilização única).
- **Análise de desconto:** o valor e o prazo dos títulos continuam vindo dos títulos. O valor da linha mestra entra como opção nova no "Principal usado no giro" ("Valor da linha mestra"); o padrão continua "Igual ao volume bruto mensal do desconto". O exemplo de títulos passa a vencer 30 dias depois da data da operação, como no exemplo de referência (05/11 → 05/12).

## 2. Prazo e carência no Capital de giro (decisão do Fernando, 19/11/2026)

O Capital de giro passou a ler prazo e carência como o Comparador:

| | Antes | Agora |
|---|---|---|
| Prazo | número de parcelas depois da carência | prazo total em meses |
| Carência | em dias, além dos primeiros 30 | em meses, dentro do prazo |
| 1º vencimento | liberação + 30 dias | liberação + carência + 1 mês |
| Bullet | vencimento no fim do prazo | igual |

Exemplo: 24 meses com 6 de carência = 18 parcelas; a primeira vence 7 meses depois da liberação.

O campo **1º vencimento (opcional)** continua existindo: se preenchido, vale a data informada. A conta em si (taxa, juros, IOF, CET, arredondamento) não mudou.

**Efeito:** com o mesmo 1º vencimento, o resultado é idêntico ao de antes. Sem informar o 1º vencimento, a data automática passa de "liberação + 30 dias" para "liberação + 1 mês"; nos meses de 31 dias isso move o vencimento em 1 dia, e a parcela muda alguns centavos ou reais.

## 3. Visual único (modelo BNDES)

| Item | Antes | Agora |
|---|---|---|
| Selecionado (opções e abas do topo) | amarelo-âmbar, azul-marinho ou laranja, conforme a calculadora | laranja, com texto azul-marinho, em todas |
| Botão principal (Simular, Comparar modalidades, Calcular taxa) | azul vivo, laranja ou azul-marinho; letra de 13 a 19 px | laranja, letra de 14 px |
| Botões secundários (Apresentar, Imprimir, Adicionar grupo, Restaurar exemplo…) | fundos e cantos variados | contorno fino, cantos de 8 px, letra de 13 px |
| Cantos | retos, 8 px ou pílula | 8 px em todos |
| "‹ Calculadoras" | dois tons, um com fundo, um azul | um tom só, sem fundo |
| Ícone de ampliar | três versões (44 px cheio, contorno branco, 32 px) | uma: quadrado de 32 px com contorno (44 px no celular); a cor acompanha o fundo |
| "?" de ajuda | um com fundo próprio no Comparador | sem fundo em todas |
| Nomes dos campos | 12, 15 ou 16 px | 13 px em todas |
| Letra dentro dos campos | 14 a 16 px | 14 px no computador; 16 px no celular |
| Capital de giro | tela branca nos dois temas, título grande, botão azul | mesma moldura e cores das outras, nos dois temas |

## Decisões tomadas sem consulta (reversíveis)

- **Valores guardados na aba, não no navegador inteiro:** somem ao fechar a aba. É mais seguro em computador compartilhado, e o pedido era não redigitar entre calculadoras durante o atendimento.
- **Nomes dos campos em 13 px, inclusive no BNDES** (antes 12 px). Com 12 px, os nomes longos das outras calculadoras ficavam pequenos demais.
- **Letra de 16 px dentro dos campos no celular:** abaixo disso o iPhone aproxima a tela sozinho ao tocar no campo.
- **Laranja do selecionado e do botão principal com texto azul-marinho:** texto branco sobre esse laranja não tem contraste suficiente para leitura.
- **Barras de abrir e fechar ("Mais condições", "Premissas") não mexidas:** são títulos de bloco, não botões, e cada uma está no desenho do seu quadro.
- **Arquivo `CalcPattern-giro.css` retirado:** era o estilo da tela branca do Capital de giro, substituído pelo padrão.

## O que foi conferido

- **Mesmo resultado antes e depois, com os mesmos valores digitados** (versão publicada × versão nova, lado a lado): 13 de 13 casos iguais.
  - Capital de giro: 5 casos (Price, SAC e Bullet; de R$ 80 mil a R$ 1 milhão; 12 a 36 meses), com o mesmo 1º vencimento.
  - Comparador: 3 casos (Price, SAC com 6 meses de carência e Bullet), colunas e quadro de resultado completos.
  - Conta garantida: 3 casos (1, 10 e 45 dias; com limite para o CET).
  - Análise de desconto: exemplo de referência com tarifa total e com tarifa unitária.
- **Giro e Comparador agora dão o mesmo número para o mesmo caso:** 4 casos (Price, SAC com carência, Bullet e Price com carência), mesma parcela e mesmo CET.
- Testes do painel, conferência de código e montagem: ver o PR.
- Conferências de tela: ver o PR.
- Fotos de todas as calculadoras no tema escuro, seis no tema claro e quatro no celular.

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows.
