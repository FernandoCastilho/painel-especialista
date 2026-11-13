# Ajustes da revisão de design (13/11/2026)

Entrega dos ajustes pedidos a partir de `docs/revisao-design-2026-11-13.md` ("ajuste tudo" e "faça todos os ajustes"). Os números de item são os daquele relatório. Nenhuma regra de cálculo financeiro mudou. Nada foi juntado ao ramo principal nem publicado.

## O que mudou, por item

| Item | Situação | O que mudou |
|---|---|---|
| 1. Coruja sobre o título | Feito | A coruja pequena ganhou lugar próprio no cabeçalho, em todas as larguras. A grande abre abaixo da linha de ícones. |
| 2. "Dado antigo" com mercado fechado | Feito | Fora da janela de coleta do painel (dias úteis, 9h05 às 18h), a referência do fim da janela aparece em tom neutro com data e hora ("Referência de 12/11 19:41"; no topo, "Fora do horário de coleta"). A regra de 10 minutos não mudou. Uma coleta parada no meio da tarde continua em alerta. O painel continua sem afirmar "mercado fechado". |
| 3. Erro vermelho ao abrir | Feito | Conta Garantida e Análise de desconto abrem sem erro. O erro só aparece depois que a pessoa mexe no campo. |
| 4. Cenários no celular | Feito | Os assuntos ficam numa linha que desliza. Fiscal passou para a tela de Inflação e Frete marítimo para a de Commodities (de 10 para 8 assuntos). Os endereços antigos continuam funcionando. |
| 5. Três aparências | Feito | No tema escuro, Finame, 4131 e Comparador agora ficam escuros, com a mesma paleta das outras calculadoras. Apresentação e PDF continuam claros. Os botões de escolha ficaram iguais em todas as calculadoras. Os textos sem acabamento de BNDES, Bancos e histórico de indicadores foram alinhados ao terminal. |
| 6. Bancos | Feito | A variação de provisão e de inadimplência aparece sem verde nem vermelho. Em janela alta, a tabela aparece inteira. No celular, os filtros ficam em duas colunas. |
| 7. Texto de bastidor | Feito | Saíram "conferência pendente", "histórico indisponível", "Sem setor" e "Classificação pendente". As siglas do BNDES (TFB_36_30, TFC_60.90, 143, LD1) ficaram, porque são os nomes oficiais do banco e aparecem como segunda linha, sob o nome em português. |
| 8. Ressalvas antes do dado | Feito | Projeções, Recuperação judicial, Feriados, Curvas e Atividade: uma linha curta, com o detalhe sob clique. |
| 9. Títulos e nomes repetidos | Feito | Setores, Commodities, Inflação e Comparador ("Comparador de Crédito" em todo lugar). A marca visível nas telas é **PME**, em todas, como no topo e na entrada desde 12/11. "PEME" fica só no aplicativo instalado, no assunto do e-mail de sugestões e nos alertas do Teams, para não quebrar instalação nem filtros. |
| 10. Idiomas e formatos | Feito | Calendário em português, com números no padrão brasileiro. Unidade "US$" em Commodities. Datas dos eixos num formato só. Manchetes em inglês que escapavam da tradução passam a ser traduzidas a partir da próxima coleta. |
| 11. Gráficos | Feito | Eixos com números redondos. O selo de variação não quebra. "Agrupar" mostra só as opções possíveis. A escala do cupom cambial deixa de fora os vencimentos de menos de 3 meses. Parágrafo repetido das curvas encurtado. Mapa do conhecimento abre em lista no celular, com "Outras notícias" no lugar de "Classificação pendente". |
| 12. Projeções | Feito | Sem fundo nas células. A data de cada projeção fica sob o nome do banco, com uma nota única quando alguma passa de 14 dias. |
| 13. Recuperação judicial | Feito | Os cartões sem informação saem quando não há filtro. O −71% ganhou explicação logo abaixo. A conta não mudou. |
| 14. Juros no celular | Feito | O "?" fica na linha do nome. Cabem duas datas sem deslizar. As linhas caíram de 106 para cerca de 60 px. A data do cabeçalho não quebra mais no meio. |
| 15. BNDES | Feito | Os atalhos de comparação (Selic × LCD, somar ao gráfico, mesmo prazo) estão reunidos logo acima do gráfico. No celular, o nome da série fica ao lado da caixa de comparar. |
| 16. Título colado na borda | Feito | Painéis no celular e margens em BNDES, Acessos e Apresentar. |
| 17. Textos sobrepostos | Feito | Ibovespa, "Cenário econômico" e a data ao lado do botão de atualizar. |
| 18. Notícias | Feito | A sobra do agregador no fim da manchete é limpa na tela. A etiqueta de moeda só é posta quando a manchete fala da moeda ou de câmbio, a partir da próxima coleta. |
| 19. Contraste | Feito | Selo invisível removido. "% a.a.", CET, textos miúdos das calculadoras e etiquetas de moeda no tema claro passam de 4,5. |
| 20. Configurações | Feito | Novidades antigas e grupos da Base de dados recolhidos (abrem por clique ou pela busca). Em telas estreitas, os ajustes de uso vêm antes das tabelas. |
| 21. Feriados | Feito | Abre em "Brasil e B3"; a escolha fica guardada no navegador. |
| 22. Vazio no Mercado | Feito | No computador, a coluna de notícias acompanha a altura da tabela de câmbio e rola por dentro. |
| 23. Setores | Feito | Contorno discreto, títulos enxutos e ícones do diagrama em tom único. |
| 24. Calculadoras vazias | Feito | FINIMP e Conta Garantida abrem com a dica do que preencher, sem valores inventados. O Comparador ficou com o primeiro campo mais perto do topo. |
| 25. Botões repetidos | Feito | Um único botão de atualizar o câmbio no Mercado. |

## Decisões tomadas sem consulta (reversíveis)

- **Marca PME nas telas**, seguindo a mudança de 12/11 no topo e na entrada.
- **Fiscal dentro de Inflação e Frete dentro de Commodities.** Os endereços antigos levam à seção certa.
- **Tema escuro para Finame, 4131 e Comparador.** O comentário que tratava essas cores como identidade fixa foi atualizado com esta decisão.
- **Siglas do BNDES mantidas** como segunda linha (nome oficial do banco).

## Ressalvas

- **Etiqueta de moeda e tradução das manchetes:** valem a partir da próxima coleta de notícias (de hora em hora). As notícias já publicadas continuam como estão.
- **Cupom cambial:** mesmo com a nova escala, a curva continua bem plana, porque os dados vão de cerca de 0 a 21%.
- **IPCA por grupo:** o gráfico de barras de 12 meses ainda mostra os meses sem o ano.
- **Dado a conferir na fonte:** o histórico do dólar tem um ponto em 18/10/2026, que é domingo.
- **Teste instável:** o teste de tela do mapa do conhecimento falhou 1 vez em 4 numa etapa de toque longo. Parece instável, sem relação com estas mudanças.

## Outras mudanças

- O teste do intradiário falhava se rodasse entre 00h00 e 00h10 de Brasília. Passou a usar hora fixa.
- Testes de tela atualizados para o novo comportamento: coruja, Mercado, Feriados, Calendário, Recuperação, Base de dados, mapa do conhecimento, BNDES (campo escuro no tema escuro) e Cenários (abas juntas).
- As pastas de fotos geradas pelos testes de tela passaram a ser ignoradas pelo git.
