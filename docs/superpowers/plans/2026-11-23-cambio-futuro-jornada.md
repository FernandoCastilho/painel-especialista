# Câmbio futuro: jornada de cotação
1. Azul: data-base, modalidade explícita Bullet ou Parcelado, quantidade apenas no Parcelado, moeda de cotação EUR/CNH, principal e juros em USD por vencimento. Total em USD é derivado.
2. Amarelo: retorno de mesa com datas e moedas vindas da operação, produto informado e spot/futuro das duas moedas para cada vencimento. Alterar termos limpa as taxas impactadas. Referência pública não vira taxa da mesa.
3. Resultado somente leitura: cronograma USD e equivalente na moeda escolhida, montantes em reais, referência direta USD e alternativa cruzada indicativa. TIR anual em dias corridos/365 com o motor já existente. Exibir custo estimado do fluxo informado, não CET contratual. Preservar comparador de cenários e TIR legado em rotas separadas.
4. Testar exemplo numérico sintético equivalente, fluxo com 1 e 5 parcelas, Bullet independente, validação, reset da mesa, ausência de totais parciais, navegação e responsividade. Entregar para revisão via PR.
