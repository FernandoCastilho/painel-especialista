# Revisão de arte — BNDES executivo

data_criacao: 2026-11-22

Responsável: Diretor de Arte 🎨, revisão separada da implementação. Esta é a primeira revisão deste executor; não produziu as prévias anteriores.

## Parecer

**Parecer final: favorável no escopo visual inspecionado, sem bloqueios visuais remanescentes. A direção executiva atende ao pedido no resultado Finame: duas colunas no desktop, CET e total a pagar em primeiro plano, condições reunidas e indexador explícito com série, taxa, fonte e data. Os cinco achados iniciais e o refinamento de Fase em 320 foram corrigidos e reinspecionados.** A hierarquia se mantém no empilhamento móvel. Valores monetários e datas do resultado estão completos nas áreas visíveis; a data da série em Taxas agora também aparece inteira. Os limites de captura, cobertura e testes permanecem descritos ao final.

O tema, a fonte e os padrões existentes foram usados como referência. A galeria `output/bndes-previas-2026-11-22` não foi tomada como evidência da implementação nem como padrão superior ao produto real.

## Achados por prioridade

| Impacto | Lei / aspecto | Onde e evidência | Problema observado | Correção indicada |
|---|---|---|---|---|
| Resolvido na inspeção final | Carga cognitiva, Postel, Tesler | `taxas-390-dark.png` e `taxas-390-light.png`, linha TFB 36 a 60 meses / 90 dias | A tabela móvel passou a duas colunas; “Data 19/11/2026” e “Dia —” aparecem no bloco da série. “16,48% a.a.” está inteiro e separado. | Sem correção obrigatória remanescente neste ponto. |
| Resolvido na inspeção final | Fitts, carga cognitiva | `tlp-viewport-320-dark.png` e `tlp-viewport-320-light.png` | Dias úteis e Fase foram empilhados; “Amortização” aparece inteira e Remover permanece visível. | Sem correção adicional exigida. |
| Resolvido na reinspeção | Semelhança, Fitts, contraste | Simulação desktop e móvel nos dois temas; resultado e apresentação nos dois temas | “Modo apresentação” passou a ter texto claro e contorno visível; a ajuda no CET azul ficou clara. | Nenhuma correção visual adicional exigida neste ponto. Hover e interação não foram exercitados por este executor. |
| Resolvido na reinspeção | Fitts, Tesler, Murphy | TLP/LCD móveis nos dois temas; viewports TLP 320/390 | Vencimento está em linha própria; Dias úteis, Fase e Remover estão visíveis e associados ao mesmo registro. | Preservar o agrupamento corrigido. |
| Resolvido na reinspeção | Proximidade, semelhança | Custos desktop e móvel nos dois temas | Título, busca e cards receberam recuo lateral coerente com as telas vizinhas. | Sem correção adicional exigida. |

Não há correção visual obrigatória remanescente no escopo inspecionado. Refinamento opcional de baixo impacto: uniformizar o alinhamento da série selecionada e a largura do fundo de Mês/Ano na tabela móvel de Taxas, que ainda variam em relação às linhas indisponíveis; a informação permanece legível e completa. Não há três correções materiais abertas.

## Pontos positivos observados

- Resultado financeiro e condições têm papéis distintos, sem repetição do total ou do indexador em vários cards de mesma hierarquia.
- CET é o destaque cromático principal; total a pagar tem peso tipográfico equivalente e contexto curto.
- Taxa final e equivalência em CDI são secundárias; parcelas e despesas usam rótulos e alinhamento de valores consistentes.
- TFC, Série C03, referência de 14,1453% a.a. e 19/11/2026 aparecem juntos. O rótulo “Indexador utilizado” elimina inferência.
- TLP/LCD mantêm unidades, rótulos persistentes, limites da projeção e estados de indisponibilidade visíveis; isso é observação de apresentação, sem validação financeira.
- “Pode usar” e “Não pode usar” distinguem os grupos por texto e região, sem depender somente de cor.

## Evidência efetivamente inspecionada

Todas as imagens abaixo foram abertas com `view_image`, nos temas `dark` e `light`. As dimensões são do arquivo real, conferidas com Pillow; os nomes 1440/390 identificam o cenário de captura, não a largura final recortada da imagem.

| Família de arquivo, em `docs/bndes-executivo-qa/` | Dimensões reais, escuro e claro |
|---|---|
| `resultado-1440-{dark,light}.png` | 1314 × 741 |
| `resultado-390-{dark,light}.png` | 304 × 1603 |
| `apresentacao-{dark,light}.png` | 1384 × 976 |
| `simulacao-1440-{dark,light}.png` / `simulacao-390-{dark,light}.png` | 1384 × 2477 / 358 × 4192 |
| `taxas-1440-{dark,light}.png` / `taxas-390-{dark,light}.png` | 1384 × 1537 / 358 × 2577 |
| `custos-1440-{dark,light}.png` / `custos-390-{dark,light}.png` | 1384 × 555 / 358 × 874 |
| `tlp-1440-{dark,light}.png` / `tlp-390-{dark,light}.png` | 1384 × 1293 / 358 × 2667 |
| `lcd-1440-{dark,light}.png` / `lcd-390-{dark,light}.png` | 1384 × 1617 / 358 × 3068 |
| `tlp-viewport-320-{dark,light}.png` / `tlp-viewport-390-{dark,light}.png` | 320 × 1000 / 390 × 1000 |

Total: 26 imagens principais abertas novamente na reinspeção e 4 novas imagens de viewport (30 arquivos). Na inspeção final, os quatro arquivos de Taxas 390 e TLP viewport 320 foram abertos novamente, confirmando as últimas correções e suas dimensões inalteradas. `debug-overflow-320-dark.png` não integra esta inspeção. `report.json` atualizado foi lido: registra `passed: true` para 320, 390, 768 e 1440 em ambos os temas; o JSON exibido contém largura, tema, resultado e aprovação, sem rácios individuais de contraste. O coordenador relatou medição do botão ≥ 4,5 e regressão completa aprovada, mas este executor não executou nem auditou essas medições. Não há revisão visual própria de 768; a cobertura visual de 320 limita-se ao recorte TLP descrito.

## Checklist dos 20 itens UX

“Atendido visualmente” se restringe aos estados capturados; não certifica interação, acessibilidade ou resultado de uso.

| Item | Aplicabilidade e evidência |
|---|---|
| 1. Hick | Atendido visualmente no resultado: dois grupos e dois números principais. Na tela de taxas há vários atalhos secundários, porém agrupados e rotulados; sem bloqueio adicional observado. |
| 2. Fitts | Comando de apresentação e controles de cronograma corrigidos visualmente, inclusive texto de Fase em 320. Dimensão acionável, toque e teclado não verificados. |
| 3. Jakob | Atendido visualmente: navegação por abas, campos rotulados, seletores e detalhes recolhíveis seguem padrões existentes. |
| 4. Proximidade | Atendido visualmente no resultado e no recuo corrigido de Custos por produto. |
| 5. Miller | Atendido visualmente: grupos semânticos evitam memorizar encargos e condições; não foi usado limite universal de quantidade. |
| 6. Doherty | Não verificado: nenhuma medição de latência ou transição foi feita nesta revisão. |
| 7. Von Restorff | Atendido no resultado: CET recebe fundo destacado; total usa tipografia. Comando apagado no claro é defeito de contraste, não redução aceitável de concorrência. |
| 8. Fitts — distância | Fase/Remover agora visíveis no mesmo grupo móvel; sequência de acionamento e alcance reais não verificados. |
| 9. Posição serial | Atendido visualmente: demanda → encargos → resultado; informações críticas intermediárias têm títulos. Leitura/memória não foram medidas. |
| 10. Pico-fim | Resultado Finame visualmente claro; conclusão do fluxo e pós-ação não verificados. |
| 11. Zeigarnik | Não verificado: retomada, persistência de rascunho e interrupção não foram exercitadas. Não há pendência artificial aparente nas capturas. |
| 12. Occam | Atendido visualmente no resumo executivo; detalhamento secundário está recolhido. |
| 13. Tesler | Cronograma móvel passou a revelar todos os campos e a tabela móvel exibe a data inteira. Automação de contas e esforço real não verificados. |
| 14. Postel | Atendido visualmente: valores e datas do resultado exibem formato brasileiro; data da tabela móvel corrigida. Aceitação/normalização de entradas não verificadas. |
| 15. Murphy | Avisos, referência indisponível e erro de linha LCD aparecem nas capturas. Prevenção, recuperação, preservação de dados e ações destrutivas não verificadas. |
| 16. Semelhança | Padrão coerente nas capturas reinspecionadas; comando de apresentação claro e recuo de Custos foram corrigidos. |
| 17. Conectividade uniforme | Atendido visualmente: cards, linhas e títulos ligam valores às condições reais. Nenhum conector enganoso observado. |
| 18. Parkinson | Sem passos artificiais aparentes; número de etapas e conclusão prática não verificados. Não se mede economia de tempo por captura. |
| 19. Carga cognitiva | Atendido visualmente no escopo: resultado com hierarquia pedida, data completa em Taxas e cronograma com campos visíveis. Não houve teste com usuários. |
| 20. Gradiente de meta | Aplicação parcial: numeração 1/2/3 indica sequência real da simulação, sem percentual inventado. Progresso dinâmico não verificado; telas de consulta não exigem meta. |

## Limites da conclusão

- A navegação global fixa atravessa regiões de conteúdo nas capturas integrais. Nos quatro novos viewports TLP, fica no rodapé esperado. A comparação sustenta tratar o corte central como limitação de captura, sem atribuir a ela obstrução permanente; o executor não exercitou a rolagem real nem afirma acesso a todos os elementos finais por essa evidência isolada.
- Nenhuma sessão de navegador foi controlada por este executor. Não foram testados menus, foco, teclado, leitores de tela, rolagem horizontal, erros recuperáveis, toque, orientação ou zoom.
- Contraste foi avaliado visualmente; não foram medidos rácios WCAG. A revisão não certifica WCAG 2.2 AA.
- Cálculos, regras financeiras, atualidade das fontes, lint, testes, build, CI, instalação e publicação não foram auditados por este executor.
- Nenhum código, prévia, configuração ou publicação foi alterado. A única escrita autorizada deste executor é este parecer.
