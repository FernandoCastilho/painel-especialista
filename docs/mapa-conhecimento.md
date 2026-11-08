# Mapa do conhecimento — Aprender

Implementação de 07/11/2026. Reaproveita React, temas, catálogo setorial, conceitos e bases de notícias do painel. Sem dependência de visualização adicional, migração, nova fonte ou mudança de audiência.

## Comportamento

- Aprender abre o mapa; Conceitos mantém a leitura anterior e os endereços existentes.
- Grafo 2D com atração, repulsão e amortecimento. Arrastar pontos reorganiza a rede; arrastar fundo move a câmera. Roda/pinça e botões controlam zoom de 15% a 400%.
- Clicar uma notícia abre a matéria em outra aba e preserva o mapa. Nos demais pontos, clicar abre os vizinhos diretos, com justificativa de cada ligação. Voltar à matriz restaura a rede e centraliza a câmera.
- Botão direito, Shift+F10/tecla Menu ou toque prolongado de 500ms em qualquer ponto (Grafo e Lista) oferece Ir para a página e Ver conexões. Há também Mais opções no detalhe. A página interna abre no painel; a notícia abre em outra aba, sem acesso à janela de origem.
- O menu permanece dentro da tela, pausa a rede e fecha por ação, Escape, clique fora, rolagem ou zoom. Escape devolve foco ao ponto. Arrastar, usar pinça, cancelar gesto ou desmontar a tela cancela o toque prolongado; soltar após abrir o menu não abre a matéria por engano. Destino inválido fica indisponível.
- Seleção recompõe a vizinhança ao redor do nó e enquadra nós/rótulos na área útil em uma transição de 360ms. Resize, orientação, tela cheia e retorno à matriz refazem o enquadramento. Arrastar, pinça, roda ou zoom manual interrompem a câmera automática; Centralizar mapa recupera o enquadramento. Atualização equivalente das fontes não interrompe a transição nem reposiciona a rede.
- Seleção preserva a pausa escolhida pelo usuário. Pausa/retomada mantém zoom e posição da câmera. A animação acomoda a rede e respeita movimento reduzido, que aplica o enquadramento sem transição; não exige movimento perpétuo.
- Tela cheia amplia somente o mapa e seus controles/detalhes. Usa a API do navegador quando aceita e uma expansão na janela quando indisponível/negada. O botão Sair da tela cheia e Escape permitem retornar; foco, rolagem e saída nativa são sincronizados. Menus e ajuda permanecem dentro da superfície ampliada.
- Na tela cheia móvel, Detalhes começa recolhido para priorizar o mapa e pode ser aberto/fechado. Rótulos locais usam até 26 caracteres e fonte mínima de 11px na escala da tela; nome completo segue no título, menu, lista e conteúdo. Colisões de texto cedem prioridade à seleção/hover.
- Busca sem acentos, filtros por tipo, nomes opcionais e Lista como alternativa acessível. O grafo geral mostra até 36 notícias; a busca pode encontrar outras e a Lista permite ver todas as notícias relacionadas disponíveis. A seleção local mantém a notícia escolhida.
- Resumo à direita no computador e abaixo em telas menores. Estado da busca/seleção permanece na sessão ao abrir um conteúdo e voltar ao mapa. Não há promessa de persistir coordenadas entre visitas.

## Conteúdo e notícias

`knowledgeGraph.js` deriva o modelo dos catálogos e vínculos reais: não duplica o texto dos estudos. As ligações entre conceitos conservam as justificativas editoriais existentes. Setor/subsetor é relação de catálogo. Leituras complementares e correspondências pelo título são rotuladas como temáticas, nunca como prova de causa, impacto financeiro ou correlação estatística.

Notícias exigem publicação original válida nas últimas 168 horas, sem data futura. Coleta, geração e revisão não renovam a publicação. Data sem hora é tratada conservadoramente e exibida pelo dia original, sem conversão indevida de fuso. No caminho da curadoria, os campos originais de publicação são preservados antes da projeção compartilhada; um campo de tempo recente não substitui uma publicação antiga, futura ou inválida. URLs, origem institucional/licença e curadoria reaproveitam validações existentes. Duplicatas são removidas e matérias sem conexão objetiva ficam fora do grafo. A ausência de matéria não significa ausência de fatos.

`refresh-knowledge-news.mjs` monta `knowledge-news.json` com bases correntes e histórico local/publicado, antes da poda setorial de cinco dias. Cada leitura refaz validação e conexões. A montagem registra seu instante separadamente das datas originais das bases. Falhas ficam explícitas e não renovam títulos antigos. As demais telas preservam a janela de cinco dias.

A primeira montagem não recupera retroativamente notícias de seis/sete dias que nunca estiveram nas bases disponíveis. Coleta institucional continua sujeita às suspensões e lacunas anteriores; esta mudança não habilita coletores suspensos. A retenção acompanha a publicação existente, sem cron novo.

## Critérios e evidências

| Critério | Verificação | Resultado |
|---|---|---|
| Conteúdo real e rotas existentes | Testes do modelo; navegação manual para conceito e retorno | Passou |
| Notícia abre matéria; menu acessa qualquer tipo de ponto | Eventos React, URLs seguras, menus e navegador na prévia | Passou no escopo local; popup real também coberto pelo CI |
| Menu por toque prolongado e teclado; fechamento/foco; limite do viewport | Testes de eventos e prévia320px/desktop | Passou; toque prolongado em aparelho físico não testado |
| Clique mostra apenas vizinhos diretos; retorno à matriz | Modelo, eventos React e navegador | Passou |
| Janela 168h inclusiva, futuro/invalidade/precisão de dia | Testes de limites com relógio controlado | Passou |
| Retenção, dedupe, falha e data original da base | Testes de empacotamento e modelo | Passou |
| Pan/zoom/pausa sem perder câmera | Navegador; teste de efeitos React | Passou |
| Seleção e resize recompõem/enquadram sem disputar gestos; refresh em voo e movimento reduzido | Solver e componentes, incluindo rótulos compactos; prévia320×568/desktop | Passou local; smoke de navegador registrado no CI da versão |
| Tela cheia nativa/expansão alternativa, Escape, foco, rolagem e portais | Testes de componentes e prévia da expansão; smoke informa a modalidade real | Passou local; testes simulados não equivalem a todos os dispositivos |
| Detalhes recolhíveis e controles completos no celular curto | Componentes e prévia320×568 | Passou local |
| Pinça, um dedo remanescente, cancelamento e arraste | Eventos simulados em teste de componente | Passou; dispositivo físico não testado |
| Celular sem corte horizontal | Navegador com iframe 320/390px | Passou; não equivale a aparelho real |
| Temas claro/escuro, lista, foco e instruções | Navegador e testes de UI | Passou no escopo inspecionado; sem certificação integral de acessibilidade |
| Layout com até 350 pontos e estabilidade finita | Testes do solver | Passou; não é medição de fluidez em celulares reais |

Validação: testes do modelo, solver e componentes, lint e build são executados no CI. Capturas de computador, celular curto e seleção foram inspecionadas. O smoke reproduz o fluxo em390×844 e1280×1000, nos dois temas, com dados simulados e rede externa bloqueada; sua execução é registrada pelo CI, separada dos testes locais. Nenhuma captura ou simulação certifica aparelhos físicos ou acessibilidade integral.

## Operação e reversão

A publicação segue o GitHub Pages já configurado e a audiência existente. Não há mudança de banco nem autenticação. A reversão é o revert do commit desta funcionalidade; o arquivo de retenção é derivado e reconstruível. Falhas de coleta seguem visíveis, sem conteúdo fictício para preencher lacunas. O grafo é uma forma adicional de navegação: conceitos e setores continuam disponíveis nas telas anteriores.
