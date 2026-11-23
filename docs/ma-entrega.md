# M&A — implementação de 2026-11-23

## Entrega
Menu M&A após Setores no computador e em Mais no celular, preservando atalhos. Visão geral com filtros digitáveis, totais, mapa IBGE com bolhas por UF e ranking setorial. Bolhas e setores abrem a lista filtrada. Busca sem acentos, paginação, detalhes, fontes e histórico por operação. Links entre M&A e os setores. Temas claro e escuro e laranja de contraste adequado.

O mapa localiza a adquirida/ativo, não o comprador. Área das bolhas proporcional à contagem; localização ausente permanece no total e fora do mapa. Estado, setor, ano, mês, busca e seleção têm endereço próprio; voltar/avançar preservam o recorte. Selecionar transação traz seu detalhe à vista.

## Acervo e histórico
Cinco operações reais publicadas em dezembro de 2025: Dasa/São Domingos, Bionexo/Tasy, V.tal/Um Telecom, Savencia/Quatá e Hindiana/Neogrid. Cobertura **inicial e parcial**, indicada nas telas. Não foi importado todo o portal. 2026 permanece consultável com estado vazio explicativo; atualização de notícia antiga não é nova transação. Situação preserva a informação da notícia datada, sem afirmar que continua atual.

Seis notas salvas e conferidas no Obsidian em `30. Recursos/LLM Wiki`: panorama em `concepts/ma-panorama.md`, operações em `queries/ma/2025/`. Índice e log atualizados. Manifesto e recibo em `ma-obsidian-manifest.json` e `ma-obsidian-receipt.json`. Script recusa divergências, usa trava e permite retomar execuções incompletas; testes usam pasta temporária separada.

O código versiona uma cópia conferida das notas. `build-ma-content.mjs` prepara o catálogo do painel a partir dessas notas. Alterações futuras no vault precisam ser reconciliadas com a cópia versionada antes do build; não existe sincronização automática nem coleta agendada nova. O painel não mostra detalhes de armazenamento.

## Verificações
- 69 testes direcionados de M&A, menu, comandos e Setores: passaram.
- Lint: sem erros, cinco avisos anteriores fora do módulo.
- Build: passou; aviso anterior de tamanho do pacote de Calculadoras permanece.
- Conferência visual/funcional: 320, 390, 820, 1024, 1440 e 1920 px, claro/escuro; 12 casos passaram. Inclui alvos do menu, mapa via teclado, busca, detalhe visível no celular, volta por Setores, filtros, vazio de 2026 e histórico de navegação.
- Regressão das pastas de Setores: oito cenários de teclado, histórico, recarga e estudos passaram localmente. Os roteiros antigos foram atualizados para incluir M&A no menu, sem mudar o comportamento das pastas.
- Sincronização do histórico: retomada parcial, segunda aplicação sem duplicações e preservação de divergências passaram em diretório temporário. Gravação real conferida por SHA-256.
- Suíte geral no Windows: 2.527 testes, 2.496 passaram e 31 falharam. Referência anterior à implementação: 2.516 testes, 2.484 passaram e 32 falharam. Comparação de nomes não encontrou falhas novas; não chamar a suíte local de verde. Ver `ma-qa/verification.json`. A maioria envolve suporte anterior de caminhos/Python/Git no Windows.

## Revisão independente e simplificação
Revisor em contexto separado identificou retomada de gravação, rolagem/detalhes no celular e proporção das bolhas. Ajustes aplicados e verificados. Reaproveitados mapa e rotas existentes; resumo calculado uma vez, sem dependências novas. Revisão de excesso feita diretamente; não foi acionado um agente Simplificador instalado.

## Publicação
Entrega em ramo separado para PR e CI. Não houve merge nem publicação. Os checks remotos da revisão candidata devem passar antes de solicitar autorização final de publicação, conforme AGENTS.md e CLAUDE.md.
