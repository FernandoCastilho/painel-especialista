# Nome PEME e rotina semanal do Focus (10/11/2026)

## Nome do painel
- O painel passa a se chamar **PEME** (Painel Especializado no Mercado).
- No topo, à esquerda de "Mercado", aparece "PEME"; ao passar o mouse, o nome completo. No celular a barra do topo não mostra a marca (já era assim).
- O nome também entrou na aba do navegador, na tela de acesso, no aplicativo instalado, nos alertas de preço, no panorama de mercado, na caixa de sugestões, na lista de fontes, no aviso de teste do Teams e no nome da rotina de publicação ("Deploy do PEME (GitHub Pages)").
- O assunto do e-mail de sugestões começa com `[PEME]`. Filtro de e-mail pelo assunto antigo deixa de pegar as novas mensagens.
- A cada publicação, a conferência do site no ar confere o nome na aba e a marca do topo. O teste `cotacoes/test/nome-peme.test.mjs` impede que uma tela nova traga o nome antigo de volta (aconteceu no selo da tela do BNDES, já corrigido).
- Ficam como estavam: o endereço do site, o nome do repositório e os títulos das notas antigas em `docs/`.

### Pendência manual: e-mail do código de acesso
`docs/cadastro-email/cadastro.gs` já traz "PEME" no assunto e no remetente, mas o script que envia o e-mail roda na conta Google do dono. Para o e-mail mudar de verdade, é preciso colar o arquivo atualizado no Apps Script e publicar nova versão (passo a passo em `docs/cadastro-email/LEIAME.md`).

## Rotina semanal do Focus
- A coleta semanal (segunda e terça, 08:30 de Brasília) falhava desde 07/11 com "não foi possível preservar focus-history.json (conteúdo alterado no pacote final)".
- Causa: a rotina tirava o inventário das bases, renovava de propósito o histórico de 52 semanas e depois conferia o pacote contra o inventário antigo.
- Correção: `scripts/accept-focus-history.mjs` registra o histórico recém-coletado no inventário, depois de conferir formato e séries. Só esse arquivo pode ser trocado; qualquer outra base alterada continua abortando a publicação.
- Os números do Focus no ar não ficaram parados: toda publicação de código também coleta o Focus.
- Prova em produção: a próxima rodada semanal é segunda, 16/11/2026, 08:30.

## Fila de publicação
Uma publicação de código que espera na fila pode ser substituída por uma atualização automática que chegue depois. Nesse caso a atualização automática falha de propósito ("código ainda não possui publicação aprovada") e é preciso rodar de novo a publicação do código. Aconteceu em 10/11 com a publicação do nome PEME.
