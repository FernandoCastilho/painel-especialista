# Direção de arte, etapa 2: Juros e Cenários (18/11/2026)

Pedido do Fernando em 18/11/2026 ("Faça"), seguindo a ordem da revisão `docs/revisao-arte-2026-11-17.md`. Mesmas regras da etapa 1, agora em Juros e nos oito assuntos de Cenários (Projeções, Calendário econômico, Inadimplência, Recuperação judicial, Atividade e emprego, Commodities, Indexadores e Inflação). Vale no tema escuro. Nenhuma regra de cálculo, dado ou fonte de dado mudou.

Fotos de antes e depois: pasta `docs/direcao-arte-etapa2/`.

## O que mudou

| Antes | Depois |
|---|---|
| Título da página ("JUROS", "CENÁRIOS") em âmbar, maiúsculas espaçadas de 12 px | "Juros" e "Cenários" em branco, 22 px, letra normal |
| Abas de Cenários e atalhos de Juros em maiúsculas espaçadas; a aberta em âmbar | Letra normal; a aberta em branco com o traço âmbar embaixo, como no cabeçalho |
| Títulos de seção ora em âmbar e maiúsculas ("COMMODITIES", "CENÁRIO ECONÔMICO"), ora brancos e grandes ("Calendário econômico", "Inflação") | Todos iguais: branco, 18 px, letra normal, sem traço depois |
| Subtítulos ("IPCA", "Inflação · o que pesa", "Dívida Bruta…") em âmbar | Branco |
| Nome de cada indicador nas tabelas (Petróleo Brent, PMI, Variação mensal…) em âmbar | Branco, com o "›" em cinza; âmbar ao passar o cursor |
| Setas de comparação (acima/abaixo do Focus nas Projeções; vs mês anterior na Inflação) em âmbar | Branco: indicam posição, não alerta |
| "▲ Pressiona" e "▼ Alivia" (fatores da inflação) em âmbar e azul | Branco, com a seta |
| Siglas e valores dos Indexadores (TR, TBF, taxas) em âmbar | Branco |
| Quadros de Juros aparecem de uma vez | Entram um depois do outro (55 ms entre eles, uma vez, menos de 1 s); com "reduzir movimento", aparecem prontos |

## O que continua em âmbar (de propósito)

- A aba aberta (o traço) e os botões selecionados (por exemplo, "Esta semana", "Alto" no Calendário).
- Avisos: ⚠ de projeção antiga e o aviso de dado não confirmado.
- A bolinha de impacto médio do Calendário (o alto continua vermelho).

## Decisões tomadas sem consulta (reversíveis)

- **Setas de comparação em branco.** "Acima do Focus" e "abaixo do Focus" não são bom nem ruim; o âmbar ficava igual ao do aviso de projeção antiga.
- **"Pressiona" e "Alivia" sem cor.** Pintar de vermelho ou verde seria um julgamento que a tabela não faz.
- **Calendário: bolinhas de impacto mantidas.** São uma escala de três níveis, e a cor ajuda a ler de longe.
- **Traço depois dos títulos de seção retirado** em Juros e Cenários. Ele existia em algumas seções e em outras não.
- **Escopo pela tela.** As regras novas valem só quando a tela aberta é Juros ou Cenários. BNDES, Setores, Bancos, Aprender e Notícias ficam para as próximas etapas.

## O que foi conferido

- Levantamento automático de todo texto em âmbar nas nove telas, antes e depois. Antes: 30 tipos de elemento; depois, só os avisos (⚠) e a bolinha de impacto médio.
- Fotos das nove telas no computador e no celular, antes e depois.
- Testes, conferência de código, montagem e conferências de tela (resultado no relato da entrega e no PR).

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows.
- O movimento de entrada dos quadros de Juros foi medido pelo código, não assistido em vídeo.
