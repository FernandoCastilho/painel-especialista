# Ajustes da revisão de design (13/11/2026)

Entrega dos ajustes pedidos a partir de `docs/revisao-design-2026-11-13.md`. Os números de item são os daquele relatório. Nenhuma regra de cálculo financeiro mudou. Nada foi juntado ao ramo principal nem publicado.

## O que mudou, por item

| Item | Situação | O que mudou |
|---|---|---|
| 1. Coruja sobre o título | Feito | A coruja pequena ganhou lugar próprio no cabeçalho em todas as larguras. A grande abre abaixo da linha de ícones. |
| 2. "Dado antigo" com mercado fechado | Feito, com outra saída | Fora da janela de coleta do painel (dias úteis, 9h05 às 18h), a referência do fim da janela aparece com data e hora em tom neutro ("Referência de 12/11 19:41", topo "Fora do horário de coleta"). A regra de 10 minutos não mudou. O painel segue sem afirmar "mercado fechado", que era regra antiga registrada nos testes. |
| 3. Erro vermelho ao abrir | Feito | Conta Garantida e Análise de desconto abrem sem erro; o erro aparece depois que a pessoa mexe no campo. |
| 4. Menu de Cenários no celular | Feito em parte | Os assuntos ficam numa linha que desliza. Fiscal e Frete não foram juntados a outras abas: a separação foi decisão anterior, registrada nos testes de tela. |
| 5. Três aparências | Feito em parte | Textos sem acabamento em BNDES, Bancos e histórico de indicadores foram alinhados; botões de escolha das calculadoras ficaram iguais. O tema escuro de Finame, 4131 e Comparador não foi mexido (ver pendências). |
| 6. Bancos | Feito | Variação de provisão e inadimplência sem verde e vermelho; tabela inteira em janela alta; filtros em duas colunas no celular. |
| 7. Texto de bastidor | Feito em parte | Saíram "conferência pendente", "histórico indisponível", "Sem setor", "Classificação pendente". As siglas do BNDES (TFB_36_30, TFC_60.90, 143, LD1) ficaram: são os nomes oficiais do banco e os testes dependem delas. |
| 8. Ressalvas antes do dado | Feito | Projeções, Recuperação judicial, Feriados e Curvas: uma linha e o detalhe sob clique. |
| 9. Títulos repetidos | Feito em parte | Setores, Commodities, Inflação e Comparador ("Comparador de Crédito" em todo lugar). PME e PEME não foram mexidos (ver pendências). |
| 10. Idiomas e formatos | Feito em parte | Calendário traduzido e com números no padrão brasileiro; unidade "US$" em Commodities; datas dos eixos padronizadas. Manchete em inglês sem tradução depende da coleta, não da tela. |
| 11. Gráficos | Ver seção "Gráficos" | |
| 12. Projeções sem destaque útil | Feito | Fundo das células removido; data de cada projeção sob o nome do banco. |
| 13. Recuperação judicial | Feito | Cartões sem informação saem quando não há filtro; o −71% ganhou explicação logo abaixo. A conta não mudou. |
| 14. Juros no celular | Ver seção "Gráficos" | |
| 15. BNDES | Feito em parte | No celular, o nome da série fica ao lado da caixa de comparar. Os jeitos de comparar não foram reduzidos: cada um tem função própria e teste. |
| 16. Título colado na borda | Feito | Painéis no celular e margens em BNDES, Acessos e Apresentar. |
| 17. Textos sobrepostos | Feito | Ibovespa, "Cenário econômico" e a data ao lado do botão de atualizar. |
| 18. Notícias | Feito em parte | Sobra do agregador no fim da manchete é limpa na tela. A regra da etiqueta de moeda é da coleta e não foi mexida. |
| 19. Contraste | Feito | Selo invisível removido; "% a.a.", CET e etiquetas de moeda no tema claro acima de 4,5. |
| 20. Configurações | Feito em parte | Novidades antigas recolhidas; ajustes de uso antes das tabelas em telas estreitas. A tela segue longa (Base de dados). |
| 21. Feriados | Feito | Abre em "Brasil e B3"; a escolha fica guardada no navegador. |
| 22. Vazio à esquerda no Mercado | Não feito | Medido de novo: são cerca de 150 px, não 500. Baixo impacto. |
| 23. Setores | Feito em parte | Contorno discreto e títulos enxutos. Emojis do diagrama ficaram. |
| 24. Calculadoras vazias | Feito | FINIMP e Conta Garantida abrem com dica do que preencher, sem valores inventados. |
| 25. Ícones e dois botões de atualizar | Não feito | Dois testes de tela usam o botão da linha de estado. Baixo impacto. |

## Pendências que pedem decisão

- **PME ou PEME.** O topo e a tela de acesso dizem "PME"; calculadoras, Panorama, caixa de sugestões e aplicativo instalado dizem "PEME". A mudança de 12/11 mexeu só no topo e na entrada.
- **Tema escuro de Finame, 4131 e Comparador.** O estilo dessas telas está registrado como identidade aprovada, independente do tema. Mudar exige decisão.
- **Juntar Fiscal com Inflação e Frete com Commodities.** A separação atual foi decisão anterior.
- **Dado a conferir na fonte:** ponto do dólar em 18/10/2026, um domingo.

## Outras mudanças

- O teste do intradiário falhava se rodasse entre 00h00 e 00h10 de Brasília. Passou a usar hora fixa.
- Testes de tela da coruja e do Mercado foram atualizados para o novo comportamento.
