# Mapa do conhecimento — Aprender

Implementação de 07/11/2026. Reaproveita React, temas, catálogo setorial, conceitos e bases de notícias do painel. Sem dependência de visualização adicional, migração, nova fonte ou mudança de audiência.

## Comportamento

- Aprender abre o mapa; Conceitos mantém a leitura anterior e os endereços existentes.
- Grafo 2D com atração, repulsão e amortecimento. Arrastar pontos reorganiza a rede; arrastar fundo move a câmera. Roda/pinça e botões controlam zoom de 45% a 400%.
- Clicar um ponto abre somente ele e seus vizinhos diretos, com justificativa de cada ligação. Selecionar uma conexão explora a vizinhança seguinte. Voltar à matriz restaura a rede e centraliza a câmera.
- Seleção pausa o movimento. Pausa/retomada preserva zoom e posição da câmera. A animação acomoda a rede e respeita movimento reduzido; não exige movimento perpétuo.
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
| Clique mostra apenas vizinhos diretos; retorno à matriz | Modelo, eventos React e navegador | Passou |
| Janela 168h inclusiva, futuro/invalidade/precisão de dia | Testes de limites com relógio controlado | Passou |
| Retenção, dedupe, falha e data original da base | Testes de empacotamento e modelo | Passou |
| Pan/zoom/pausa sem perder câmera | Navegador; teste de efeitos React | Passou |
| Pinça, um dedo remanescente, cancelamento e arraste | Eventos simulados em teste de componente | Passou; dispositivo físico não testado |
| Celular sem corte horizontal | Navegador com iframe 320/390px | Passou; não equivale a aparelho real |
| Temas claro/escuro, lista, foco e instruções | Navegador e testes de UI | Passou no escopo inspecionado; sem certificação integral de acessibilidade |
| Layout com até 350 pontos e estabilidade finita | Testes do solver | Passou; não é medição de fluidez em celulares reais |

Validação local: suíte completa com 1.341 testes passou, lint sem erros (cinco avisos anteriores) e build passou. Capturas de computador, celular e seleção foram inspecionadas. O smoke de CI reproduz o fluxo em duas larguras e dois temas com dados simulados e rede externa bloqueada; sua execução é registrada pelo CI, separada dos testes locais.

## Operação e reversão

A publicação segue o GitHub Pages já configurado e a audiência existente. Não há mudança de banco nem autenticação. A reversão é o revert do commit desta funcionalidade; o arquivo de retenção é derivado e reconstruível. Falhas de coleta seguem visíveis, sem conteúdo fictício para preencher lacunas. O grafo é uma forma adicional de navegação: conceitos e setores continuam disponíveis nas telas anteriores.
