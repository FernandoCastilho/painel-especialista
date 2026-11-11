# Visual compacto e impressão da simulação BNDES

Implementação inicialmente baseada no commit c4a64ca0db54ba0b7daf29276cb03863ba32c883, da PR 390, e conciliada com a base PEME cb1fef4090c57ec1ccce8e86274e62426345c2ff. Preservados o nome PEME, as mudanças simultâneas da base e todos os gates de publicação. O diff contra essa base contém somente calculadora, testes e documentação.

## Escopo

- Identidade marinho/laranja, ícones próprios, três quadros Operação/Custos/Pagamento no desktop e resultado abaixo, seguindo a imagem aprovada.
- Quadro Pagamento: SAC fixo, liberação de referência em até 90 dias e ECG à vista. Capitalização permanece fixa no cálculo e explicada nas premissas, sem seletor ou duplicação no rodapé. Todos os campos reais permanecem, inclusive participação, porte/região, TAC, remunerações, periodicidade e FGI.
- Resumo com custo total, primeira parcela após carência e última parcela. Taxas/origens permanecem visíveis. Comparação detalhada recolhida mantém taxa final, juros, IOF, TAC e ECG.
- A área do botão Imprimir PDF não repete os chips de premissas. Não se usam logo oficial nem linguagem de emissão oficial.
- Botão abre prévia congelada com cabeçalho, operação, resultado/comparação, referências, taxas manuais, premissas, aviso não vinculante e cronograma integral de cada alternativa válida. O usuário escolhe Salvar como PDF no diálogo de impressão do navegador. Não há envio automático a cliente.
- PDF usa os resultados já calculados e o mesmo calendário ilustrativo da tela. Não refaz o motor nem busca nova cotação. Comparação inválida bloqueia a impressão comparativa, sem trocar silenciosamente pelo cenário simples.
- Sem dependências novas e sem mudanças nos motores financeiros, coletores, fontes ou perfis TLP/LCD.

## Verificação e limites

- Testes unitários e de componentes verificam campos preservados, resultados idênticos ao payload de impressão, ausência de números inválidos, fontes indisponíveis, taxa manual, 60/84 meses e conciliação de despesas e pagamentos.
- Auditoria independente read-only conciliou 48 cenários sem achar bloqueador financeiro. Apontou aviso impreciso quando não há carência; corrigido e coberto por teste. Falhas de harness e expectativas do layout foram ajustadas sem reduzir as validações financeiras.
- Smoke de interface atualizado para três quadros, resumo, detalhes e prévia/PDF, incluindo abertura repetida, Escape, restauração de foco, dois temas e 320/390/768/1440 px.
- **Smoke e revisão visual ainda não executados com sucesso.** Chromium instalado não inicia por `socket() failed: Operation not permitted`, mesmo com execução escalada. Navegador conectado recusou o protocolo file da prévia local por política de URL. A recusa não foi contornada.
- O arquivo PDF ainda não foi renderizado por um navegador; paginação, legibilidade e comportamento de impressão precisam ser aprovados antes de publicar. Testes de HTML não certificam a paginação.
- A publicação exige CI aprovado no commit integrado, revisão das capturas e conferência de todas as páginas do PDF.

Resultado final local: 1.757 testes aprovados, nenhum falhou; build aprovado; lint sem erros, com cinco avisos preexistentes fora do escopo. `git diff --check` sem problemas. Esses resultados não substituem os gates de navegador e revisão visual pendentes.

## Preparação da integração

Conferência dos smokes legados preservou alvo mínimo de 44 px em campos e checkboxes, espaço de 32 px para o prefixo monetário e o aviso curto de elegibilidade do IOF sempre visível junto ao resultado. Os testes gerais das calculadoras agora conferem as três linhas do resumo e sua igualdade com a composição, incluindo a última parcela; a ajuda da taxa final continua verificada dentro da composição. Nenhum gate foi removido.

O smoke também rola explicitamente a comparação e a tabela da apresentação em 320/390 px, mede os limites de cada valor da última coluna e salva captura da região no final da rolagem. Não considera uma captura apenas da primeira coluna como prova de leitura completa.

## Revisão da integração

Auditoria independente: 273 testes Finame/BNDES e 120 combinações adicionais aprovados (prazos de 1 a 84 meses, taxas zero/manual/100%, carência e FGI). Cronogramas completos e pagamentos conciliados. Nenhum motor compartilhado, workflow ou rotina de coleta alterado em relação à base PEME.
