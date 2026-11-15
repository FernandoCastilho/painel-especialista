# BNDES: comparação compacta e ampliável — 15/11/2026

## Preparado localmente
- Retorno acima do quadro; dados básicos presentes na comparação.
- Matriz com indicadores nas linhas e opções TFC/TFB nas colunas.
- Composição compacta, detalhamento recolhível e parcelas A/B pela data real do fluxo, sem recálculo.
- Histórico real dos indexadores separado das projeções; ausência de dados explícita.
- Quadros expansíveis via dialog nativo; Escape, navegação, foco e rolagem tratados.
- Grupos responsivos; fórmulas, IOF, CET, taxas e métodos financeiros inalterados.

## Marca e origem
`public/brands/bndes.png` conserva integralmente o PNG oficial 345 × 35 do recurso base64 em `#header-bndes #logo-container` da [CSS oficial BNDES](https://www.bndes.gov.br/pelev3/pele.css), referenciada pela [página BNDES](https://www.bndes.gov.br/wps/portal/site/home), consultadas em 15/11/2026. Sem geração por IA ou redesenho.

## Testes e limitações
306 testes focados passaram. Suíte integrada passou 1.972 testes sem falhas. Lint sem erros, cinco avisos preexistentes; build aprovado com aviso de chunks grandes. Teste de expansão em DOM simulado, não navegador real.

Revisão visual pendente: Chromium local falhou ao abrir socket (`Operation not permitted`); navegador da nuvem não alcançou localhost (`ERR_CONNECTION_REFUSED`). Conferir viewport 679 × 676, telas estreitas/amplas, logo, teclado e dialogs aninhados antes de publicar. Nenhuma publicação/push realizada; nenhuma aprovação visual final alegada.

ExpandablePanel remonta conteúdo ao ampliar: usar em resultados; não em formulários com estado local. Bloqueio de rolagem tem contador para diálogos aninhados.
