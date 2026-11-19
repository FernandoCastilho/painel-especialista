# Capturas V2: candidato, não publicado

Produto só escreve PNG no clipboard. Sem download ou envio.

## Alterações
Rolagem interna passa a viewport SVG com x/y serializados. Fidelidade proposta, ainda não comprovada no navegador. Smoke compara imagens reais com screenshot independente: título, valor e curva, diferença média e recuperação dos pixels de conteúdo. Fundo sólido não passa pelo critério de traços. Inclui Mercado, Juros e Cenários/Calendário, claro/escuro e390/1440px, detalhe e rolagem vertical/horizontal.

## Runner descartável autorizado
Usar dependências/navegador já disponíveis e prévia local do build. Não instalar, publicar demonstração, alterar permissões ou contornar isolamento. O job clipboard-capture de Cotações CI usa a própria VM descartável, com o Chrome já disponível, build em localhost e o mesmo Playwright do smoke existente. O job roda os dois testes e salva o artefato clipboard-capture-design, inclusive logs se houver falha. A única escrita de clipboard sem mock é a do passo Ctrl+V nessa VM.

Na pasta cotacoes, prévia já em execução:
SMOKE_CHANNEL=chromium SMOKE_BASE_URL=http://127.0.0.1:8768 CAPTURE_QA_OUTPUT=/tmp/qa-capturas node scripts/smoke-capture-image.cjs

Esse teste simula só clipboard. PNG e comparação de imagens são reais.

Somente com autorização para substituir o clipboard transitório de um runner descartável:
REAL_CLIPBOARD=1 SMOKE_CHANNEL=chromium SMOKE_BASE_URL=http://127.0.0.1:8768 CAPTURE_QA_OUTPUT=/tmp/qa-capturas node scripts/smoke-capture-paste.cjs

A segunda prova não usa mocks, dispatchEvent, clipboard.read ou grantPermissions. Clica no produto e usa Control+V num campo local; verifica evento paste confiável com PNG. Não lê conteúdo preexistente. Fecha contexto depois. Recusa do navegador faz teste falhar: não adicionar permissão permanente ou download alternativo.

Artefatos: PNGs gerados/referências/métricas; colagem-real.png e colagem-real.json (trusted=true, image/png, dimensões). Conferir título, número, filtro e datas nas imagens. Prova no runner não assegura suporte em qualquer outro app/navegador.

## Limites
Chromium local não inicia: socket Operation not permitted. Nenhum smoke ou Ctrl+V real foi executado aqui. Solução de rolagem ainda precisa passar na prova. Imagens externas/fundos com URL recusados; telas muito longas podem exceder limite de legibilidade/memória. Layout atual preservado, não convertido de móvel para desktop. Recolhidos continuam recolhidos. Cobertura de todas as telas exige matriz/auditoria; não liberar produção antes disso.

## V3 (base PR #523 0d301c5)
- Câmera legada do Mercado substituída pela cópia PNG; não chama shareQuotesImage. Uma câmera de quadro no cabeçalho, sem repetir a mesma ação no Expandable.
- Câmera no host ChartFullscreen, preservando o mesmo conteúdo no zoom; cobre mapa/quadros de recuperação judicial, Trends e minigráficos do Panorama. Câmera no Panorama completo e nos quadros Inadimplência/IPCA.
- Imagens já carregadas da mesma origem viram data PNG por canvas sem fetch. Imagens de outra origem continuam recusadas. Ainda não carregadas pedem aguardar.
- Iframes/vídeos não são acessados. O PNG contém um retângulo identificado como conteúdo externo não incluído, e o status explica o recorte. Isso NÃO equivale a copiar o gráfico externo.
- Smoke expandido às oito subabas de Cenários (além de Mercado/Juros), logo local comparado com referência e iframe com aviso. A prova visual/colagem deve ser executada no runner; não houve navegador local.
- Workflow e correção CAPTURE_QA_OUTPUT do runner preservados sem alteração.


## Complemento V3: fidelidade de fontes e geometria (CI 44512756037)
- Evidência recebida: h3 meanError 0,057734 / inkRecall 0,149410; PNG móvel capturado não foi salvo antes da falha. O PNG de colagem é desktop e não pode ser comparado geometricamente à referência móvel.
- Defeitos identificados no código: o SVG isolado não recebia as definições @font-face do documento; remover o nó da câmera alterava a linha flex e a baseline do cabeçalho. Corrigido: incorporar fontes do próprio app em data URLs e ocultar os controles conservando sua estrutura e geometria.
- A leitura de fontes usa somente URLs de mesma origem, sem credenciais, com cache; fontes externas são recusadas, nunca contornadas. Não instala fontes ou dependências. `document.fonts.ready` sozinho não transfere fontes para a imagem SVG.
- A referência de comparação oculta exclusivamente `[data-capture-ignore]` sem remover espaço. Título, valores, gráfico e limiares permanecem intactos. Guarda referência bruta, referência usada, PNG e métricas antes da assertiva.
- Não há confirmação de correção visual até nova execução no runner. Ctrl+V real verde comprova entrega do PNG, não fidelidade. Build local pode avisar fontes ausentes no node_modules reutilizado; CI usa as dependências já declaradas/lockadas. Não baixar/instalar dependências nesta tarefa.
