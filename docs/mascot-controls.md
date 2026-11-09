# Mascote do painel

A coruja aprovada foi convertida para WebP (384 × 408, 21.630 bytes), sem redesenho. O original permanece com o proprietário; o aplicativo entrega apenas a versão otimizada.

- **Pesquisar** abre a mesma `GlobalSearch` usada pelo atalho existente Ctrl+Shift+F. Índice, avisos de cobertura, repetição de carga e navegação são compartilhados.
- A busca iniciada pela coruja aparece como balão ancorado. Quando a posição/tela não comporta a cauda com segurança, o diálogo permanece dentro da tela e a cauda é omitida.
- **Sugestões** mantém o formulário verificado `xaeegypp`. Não houve novo envio real nesta implementação.
- **Ocultar mascote** troca o componente por **Mostrar mascote**, com transferência de foco e persistência da preferência.
- **Mover mascote** permite arrastar, usar as setas do teclado (20 px), Home (repor) ou abrir botões de direção e **Posição inicial**. A posição é limitada à área disponível.
- Abaixo de 1000 px, a coruja fica numa área própria no fluxo da página, acima da margem da navegação inferior. Os movimentos ficam nessa área e isso é explicado nos controles. Não cobre os botões das calculadoras.
- Apenas ocultação e coordenadas do desktop são persistidas em `painel.mascot.ui.v1`. Consulta, resultados, rascunhos, nome e e-mail não são armazenados por esses controles. Falhas de storage não impedem o uso.

## Verificação

`npm test`, `npm run lint`, `npm run build` e `git diff --check`.

Smoke de navegador com todas as chamadas POST interceptadas (nunca envia ao Formspree):

```
SMOKE_BASE_URL=http://127.0.0.1:5231 SMOKE_CHANNEL=chromium node scripts/smoke-mascot-controls.cjs
```

O smoke cobre 360, 390 e 1280 px, imagem, movimento, ocultação/restauração, recarga, busca real, avisos de falha, navegação para resultado, retorno de foco, envio mockado e redimensionamento para 320 px. A execução local neste ambiente foi bloqueada antes da abertura de qualquer página porque o Chromium não pode criar sockets (`Operation not permitted`). A validação visual nos dois temas precisa ser concluída no preview privado existente antes da publicação.
