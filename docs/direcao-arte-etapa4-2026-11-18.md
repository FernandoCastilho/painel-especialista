# Direção de arte, etapa 4: tema claro, campos mais baixos e padrão do BNDES (18/11/2026)

Três pedidos do Fernando em 18/11/2026, numa entrega só:

1. Levar ao tema claro o mesmo padrão das etapas 1 a 3 ("Faça os ajustes").
2. Deixar menos altos os campos onde se preenche (por exemplo, a taxa), para ganhar espaço.
3. Na calculadora do BNDES, deixar preenchido por padrão: operação de R$ 1.000.000,00, prazo de 48 meses e 3 meses de carência.

Nenhuma regra de cálculo, dado ou fonte de dado mudou. O item 3 muda só o valor que já vem escrito nos campos.

Fotos de antes e depois do tema claro: pasta `docs/direcao-arte-etapa4/`.

## 1. Tema claro

| Antes | Depois |
|---|---|
| Fundo bege (`#f5f4f0`) com textos e linhas puxados para o marrom | Fundo cinza bem claro e neutro (`#f3f3f1`), texto quase preto, linhas cinza |
| Marca "PME" e aba aberta do topo em bloco âmbar cheio, abas em maiúsculas com divisórias | Igual ao escuro: "PME" com o quadradinho âmbar, abas em letra normal, aba aberta com o traço âmbar embaixo |
| Títulos, nomes de indicadores e links em marrom | Texto escuro; âmbar (marrom-escuro, legível no claro) só no selecionado e nos avisos |
| Regras das etapas 1 a 3 valiam só no escuro | Valem nos dois temas: manchete, ordem do Mercado, títulos, abas, tabelas, ícone de ampliar |

Junto, uma regra que valia nos dois temas:

- **Links** (manchetes, fontes, listas): em texto normal nos dois temas, âmbar ao passar o cursor. Antes eram dourados no escuro e marrons no claro.
- **Cabeçalho de dia nas notícias** ("Hoje · 18/11"): texto normal, como os demais títulos.

## 2. Campos de preenchimento

- **Computador (acima de 1000 px):** todos os campos das calculadoras com 36 px de altura, como o Finame já tinha desde 11/11. Antes: 44 a 46 px.
- **Celular e tablet:** continuam com 44 px, tamanho confortável para o dedo.
- Medido nas 10 calculadoras com campos: 36 px em todas no computador; 44 px em todas no celular.

## 3. Padrão da calculadora do BNDES

| Campo | Antes | Agora |
|---|---|---|
| Valor dos materiais | R$ 500.000,00 | R$ 1.000.000,00 |
| Prazo total | 60 meses | 48 meses |
| Carência | 12 meses | 3 meses |

Os valores estão dentro dos limites do produto: prazo de até 84 meses e carência de até 12 meses com taxa fixa. Quem abre a calculadora pode trocar qualquer valor, como antes.

## Decisões tomadas sem consulta (reversíveis)

- **Fundo do claro trocado** de bege para cinza neutro. A cor da barra do navegador no celular acompanha.
- **Âmbar do claro mantido em marrom-escuro** para texto (o amarelo vivo não dá leitura sobre fundo claro). O quadradinho da marca usa o amarelo vivo, que não é texto.
- **Links em texto normal nos dois temas**, fora das calculadoras.
- **Calculadoras:** mudou só a altura dos campos e o padrão do BNDES; as cores continuam as delas.

## O que foi conferido

- Levantamento automático do texto em âmbar nos dois temas, em 16 telas: o âmbar ficou nos mesmos lugares nos dois (selecionado, avisos, bolinha de impacto médio, feriado próximo).
- O tema escuro ficou idêntico ao publicado (mesmo levantamento antes e depois).
- Altura dos campos medida em todas as calculadoras, no computador e no celular.
- Testes do painel: 2.143 passando. Conferência de código: sem erros. Montagem: ok.
- Conferências de tela: as 33 da rotina automática mais 11 das telas e calculadoras mexidas. 41 passaram de primeira; 3 falharam porque esperavam os valores antigos (R$ 500.000,00, 60 meses, 12 de carência e campos de 44 px no computador). As expectativas foram atualizadas para os valores novos, sem mudar o que conferem, e as 3 passaram.

## O que não deu para conferir

- Aparelho físico (iPhone, Android) e Windows.
