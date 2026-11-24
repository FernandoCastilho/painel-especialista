# BNDES executivo — especificação de implementação
data_criacao: 2026-11-22

Objetivo: implementar a proposta visual da seção BNDES até instalação e verificação, sobre a versão canônica atual 3ed91b3. Autorização: meta de Fernando para implementar até instalada e verificada.

## Escopo e aceite
- Todas as áreas existentes: Simular, Taxas e históricos, Custos por produto; modalidades Finame/TFC/TFB/pós-fixadas, TLP exigível, Selic + LCD e conferência histórica.
- Resultado executivo em duas colunas quando houver largura, CET e total prioritários, parcelas e composição sem repetição na mesma vista.
- Condições e referência explicitam nome/código do indexador, taxa, unidade, fonte, data, eventual taxa manual ou referência retida. CDI-base e data visíveis na equivalência.
- Um controle de apresentação do resultado, sem maximizações internas concorrentes; detalhes recolhíveis sem perda de informação.
- Preservar e-mail, fluxo, comparação, gráficos, memórias, fontes, controles de cenários e tema claro/escuro.
- Cronogramas próprios podem ser preenchidos por grade com opção de colar o texto já aceito; nenhuma alteração de interpretação financeira.
- Reorganização responsiva sem rolagem horizontal da página; tabelas largas com rolagem local e valores íntegros.
- Preservar roteiro Demanda, Encargos, Resultado incorporado na versão atual. Manter nomes e cores reais, em vez de reproduzir imprecisões das imagens de IA.
- Validar com testes, lint, build, navegador desktop/mobile, revisão independente, CI da candidata e versão instalada. Publicação via PR e fluxo GitHub Actions, sem desviar controles. A autorização final de merge/publicação será obtida se necessária antes de publicar.

## Limites
Nenhuma regra de CET, juros, IOF, calendário, FGI, projeção ou elegibilidade será alterada. Não usar números fictícios das imagens. Novas funcionalidades de produtos não são inferidas das variantes de apresentação. Fontes datadas e ausência de dados devem permanecer honestas.

## Decisões
A implementação adapta o layout à estrutura atual, não substitui o produto por imagens. A galeria da conversa é referência visual; dados e estados do aplicativo prevalecem. Não reintroduzir linha do tempo removida pela atualização canônica.
