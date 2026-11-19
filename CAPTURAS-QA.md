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
