# Mascote do painel

A coruja aprovada foi convertida para WebP (384 × 408), sem redesenho, e recortada do fundo (recorte automático; a asa levantada é uma camada separada). O original permanece com o proprietário; o aplicativo entrega apenas a versão otimizada.

- **Pesquisar** abre a mesma `GlobalSearch` usada pelo atalho existente Ctrl+Shift+F. Índice, avisos de cobertura, repetição de carga e navegação são compartilhados.
- A busca iniciada pela coruja aparece como balão ancorado. Quando a posição/tela não comporta a cauda com segurança, o diálogo permanece dentro da tela e a cauda é omitida.
- **Sugestões** mantém o formulário verificado `xaeegypp`. Não houve novo envio real nesta implementação.
- **Aparência:** a coruja tem fundo transparente (duas imagens WebP com transparência: corpo e asa) e flutua sem caixa, com uma sombra leve e um movimento suave. Ao passar o mouse, tocar ou focar pelo teclado, ela pula e bate a asa. Os botões de mover e fechar aparecem com o mouse ou o foco (sempre visíveis em telas de toque). Quem pediu menos movimento no aparelho não vê animações.
- **Ocultar mascote** troca a coruja por uma bolinha com o rosto dela sem texto visível nem dica de texto (mantendo o rótulo acessível **Ampliar mascote**), logo abaixo do cabeçalho (no canto esquerdo do topo em telas abaixo de 700 px), com transferência de foco e persistência da preferência.
- **Mover mascote** permite arrastar, usar as setas do teclado (20 px), Home (repor) ou abrir botões de direção e **Posição inicial**. A posição é limitada à área disponível.
- Abaixo de 1000 px, a coruja também flutua sobre a página (sem área reservada), começa acima da navegação inferior e pode ser arrastada ou fechada. No computador, a margem direita continua reservada à posição inicial.
- Apenas ocultação e coordenadas do desktop são persistidas em `painel.mascot.ui.v1`. Consulta, resultados, rascunhos, nome e e-mail não são armazenados por esses controles. Falhas de storage não impedem o uso.

## Verificação

`npm test`, `npm run lint`, `npm run build` e `git diff --check`.

Smoke de navegador com todas as chamadas POST interceptadas (nunca envia ao Formspree):

```
SMOKE_BASE_URL=http://127.0.0.1:5231 SMOKE_CHANNEL=chromium node scripts/smoke-mascot-controls.cjs
```

O smoke cobre 360, 390 e 1280 px, imagem, movimento, ocultação/restauração, recarga, busca real, avisos de falha, navegação para resultado, retorno de foco, envio mockado e redimensionamento para 320 px. A execução local neste ambiente foi bloqueada antes da abertura de qualquer página porque o Chromium não pode criar sockets (`Operation not permitted`). A validação visual nos dois temas precisa ser concluída no preview privado existente antes da publicação.
