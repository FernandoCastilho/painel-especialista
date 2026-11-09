# Grafo contextual dos estudos

## Objetivo e comportamento

Após “Conversa com a empresa”, os estudos exibem o mapa já usado no Aprender, recortado ao setor/subsetor aberto. O recorte liga o subsetor ao catálogo e a conteúdos mencionados nos textos do estudo; cada ligação informa trecho e seção. Notícias e leituras do setor mais amplo são identificadas como contexto, sem afirmar que tratam especificamente do subsetor.

A navegação preserva os destinos existentes. Busca, filtros, lista, menu, zoom, tela cheia, teclado e preferência por movimento reduzido reutilizam o componente existente. “Voltar ao setor” restaura o recorte; a memória da sessão é separada por estudo e não contamina o Aprender.

## Critérios de conteúdo

Somente correspondências editoriais explícitas ou pertencimento ao catálogo; nunca causalidade econômica inferida. O mapa geral deve manter todas as notícias válidas na janela editorial de sete dias, com ligação temática ou agrupamento explícito de classificação pendente. Esse agrupamento não é setor nem comprovação de relevância econômica. Registros inválidos, futuros e expirados continuam excluídos.

## Verificação

- Testes do modelo usam o estudo real de transporte de madeira e cobrem isolamento, vínculos rastreáveis e ausência de mutação.
- Testes do componente cobrem título, memória, reset, navegação e regressões do Aprender.
- Smoke de navegador incluído no CI: 390/1280 px, claro/escuro, posição após o roteiro, lista, busca vazia, tela cheia/Escape, navegação/Voltar e isolamento de TIC/Aprender.
- Execução local do Chromium indisponível nesta sessão: criação de socket bloqueada pelo ambiente mesmo na execução autorizada. Não confundir build/testes unitários com aprovação visual. Evidências de navegador dependem do CI.

## Checklist de UX do escopo alterado

1. Hick: controles existentes agrupados; recorte reduz escolhas iniciais.
2. Fitts: componente existente preservado; medição visual pendente no CI.
3. Jakob: reutilização explícita do padrão do Aprender.
4. Proximidade: mapa imediatamente após roteiro da empresa.
5. Miller: contexto e rótulos visíveis, sem exigir memorizar rotas.
6. Doherty: latência não medida; estados de leitura existentes preservados.
7. Von Restorff: subsetor inicial selecionado; sem novo destaque concorrente.
8. Fitts/distância: ações próximas ao mapa; inspeção em tamanho real pendente.
9. Posição serial: roteiro, relações, síntese e estudo mantêm sequência clara.
10. Pico-fim: abertura de conteúdo e retorno ao setor disponíveis.
11. Zeigarnik: memória separada por estudo; não cria pendências fictícias.
12. Occam: reutilização de componente, sem biblioteca visual nova.
13. Tesler: recorte e relações calculados pelo sistema, com justificativa.
14. Postel: normalização textual conservadora; datas/URLs continuam validadas.
15. Murphy: falha de notícias não remove catálogo; filtros e reset recuperáveis.
16. Semelhança: tipos e comportamentos existentes; agrupamentos rotulados.
17. Conectividade: relações de conteúdo documentadas, não correlações econômicas.
18. Parkinson: sem etapas, prazos ou urgências artificiais.
19. Carga cognitiva: recorte específico e detalhes sob demanda.
20. Gradiente de meta: não aplicável, exploração sem meta fechada; contagens são reais.

Não certifica conformidade integral WCAG ou teste em aparelho físico.

## Associações, órgãos e players de referência (09/11/2026)

O mapa de cada subsetor mostra também pontos quadrados: associações e entidades de classe (por exemplo, Abimaq em Máquinas industriais), órgãos públicos e reguladores, e nomes nacionais de referência. Fonte única: `src/sectorEntities.js`; os 68 subsetores do catálogo têm entrada (teste `sector-entities.test.mjs`).

- A busca do mapa encontra sigla, nome completo e descrição. O filtro "Associações e players" liga e desliga o grupo.
- Associações e órgãos abrem o site oficial. Players não têm link, para não manter endereço desatualizado.
- É lista editorial de partida: não é ranking, não mede participação de mercado e não indica relação com qualquer empresa. Subsetor sem player confiável fica sem player (ex.: Transporte de madeira, Tubetes).
- Endereços não foram abertos na redação (sem rede). Conferir no site oficial antes de citar.
- Para incluir ou corrigir: editar `ASSOCIATIONS`, `PLAYERS` e `TOPICS` no mesmo arquivo e rodar `npm test`.
