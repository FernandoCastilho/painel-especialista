# Focus: referência pela data de publicação do boletim (17/11/2026)

## O que mudou
- A linha do Focus em Cenário econômico mostrava a data da coleta ("até 13/11"). Agora mostra a data de publicação do boletim ("16/11").
- A data é lida na página do próprio boletim no site do Banco Central (campo `data` de `https://www.bcb.gov.br/api/servico/sitebcb/focus/principal`, filtro pelo identificador `DDMMAAAA` da sexta de coleta), no horário de Brasília.
- A nota de método traz o link do boletim: "boletim publicado em 16/11/2026 · coleta até 13/11/2026".
- A mesma data vale no resumo para WhatsApp. (A apresentação foi refeita em outra entrega e não mostra a data do Focus.)

## Regras
- Nada de data presumida: antes o arquivo guardava "a segunda seguinte" como divulgação (errado em feriado). Agora só vale a data confirmada na página (`focus.release` + `focus.link`).
- Se o site do Banco Central não responder: mantém a data já confirmada da mesma semana; sem confirmação, a tela volta a mostrar "até <data da coleta>".
- A data da coleta (`focus.date`) continua sendo a usada para saber se o boletim da semana já entrou no painel.

## Conferido
- Leitura real em 17/11/2026: boletim de 13/11 publicado em 16/11; boletim de 06/11 publicado em 09/11.
- Testes, revisão de estilo e montagem do painel; tela conferida com os dados do ar.
