# Caixa de sugestões

Mascote vetorial discreto, aberto somente por clique. O formulário contém tipo (sugestão/dica/problema), mensagem obrigatória e nome/e-mail opcionais. Não inclua dados de clientes nem informações confidenciais.

## Estado da ativação

**Envio verificado.** ID público do formulário: `xaeegypp`. Um único teste técnico com conteúdo fictício foi aceito pelo serviço e teve recebimento confirmado na caixa autorizada em `2026-11-08T23:38:29Z`. Nenhum reenvio foi realizado. Identificadores da caixa, destinatário privado e texto do teste não são publicados neste documento.

O componente real foi conferido em prévia privada autenticada, sem ampliar acesso. Revisão em larguras simuladas de 320, 390, 768 e 1100 px, nos temas claro/escuro; ausência de overflow horizontal nas medições de 390 e 1100 px. Escape fecha e restaura foco; rascunho preservado ao reabrir. Não equivale a teste em dispositivos físicos nem auditoria integral com leitor de tela.

A configuração de produção só foi habilitada após essa confirmação. Publicação final continua sujeita ao CI do commit de ativação. As proteções de spam do serviço não foram desativadas. Não repetir o teste real durante verificações automatizadas ou validação pública.

## Comportamento e limites

- Mensagem: até 4.000 caracteres; nome: 100; e-mail: 254.
- Apenas campos digitados são transmitidos. URL, histórico, cotações e dados financeiros não são coletados. A requisição omite cookies e referer.
- Campo honeypot e bloqueio de clique repetido reduzem erros; não substituem proteções de spam do servidor.
- A resposta precisa ser HTTP de sucesso e JSON `ok: true`. Isso comprova aceitação pelo serviço, não entrega ao destinatário.
- Erros preservam o texto. Não há reenvio automático. Falha de rede/timeout pode ocorrer após aceitação; o aviso pede aguardar para evitar duplicidade.
- Fechar enquanto envia mantém a operação. Reabrir mostra o estado. O rascunho fica apenas na memória da página e se perde ao recarregar/sair.
- O diálogo nativo fecha com Escape e botão, restaura foco e fecha ao navegar sem roubar foco da nova tela.
- Nenhum plano pago foi contratado. Conferir limite vigente do plano gratuito no serviço.

## Testes

`node --test test/feedback*.test.mjs`: 12 cenários sintéticos de validação, bloqueio de configuração não verificada e evidência de ativação, privacidade, quota/erro, aborto, honeypot, cliques repetidos, foco, fechamento, reabertura e navegação. Nenhum envia e-mail real.

`test/fixtures/feedback-responsive.html`: prévia de desenvolvimento do componente real em 320/390/768/1100 px com temas claro/escuro. Não é emulação de dispositivo físico e não entra no build.

Em 7/11/2026, a suíte local completa passou (1.258 testes), o build passou e o lint não apresentou erros (cinco avisos existentes em outros componentes). A prévia não foi alcançável pelo navegador de revisão deste executor; a validação visual não foi concluída. A entrega real também não foi testada porque o cadastro permanece pendente.

No CI inicial, o botão flutuante cobria a ação final do CET em 390 px. Em telas estreitas, ele agora ocupa espaço próprio ao fim do conteúdo, alinhado à direita, em vez de se sobrepor às calculadoras. O mascote permanece no canto fixo no desktop. A correção deve passar novamente pelo CI.

## Histórico: reconciliação de 8/11/2026

Integrado à base `43d5ed32fd97dabef4d58df6b49987db92ded8f9`, preservando os recursos publicados em paralelo. O conflito em `base-dados.test.mjs` foi resolvido mantendo as exceções específicas da apresentação BNDES e da política do processador. O índice de busca foi regenerado pelo build, incluindo o áudio já presente em Aprender.

Verificação do candidato integrado: 1.558 testes passaram; build passou; lint sem erros e com cinco avisos preexistentes. Revisão visual no navegador interno, CI do novo commit e entrega real continuam pendentes. O envio permanece desativado e este registro não autoriza publicar o formulário como funcional.

## Histórico: retomada antes da entrega de 8/11/2026

Candidato reconciliado também com a base `5ac2b122d9ffccaf1f738474f98a4079cc79c5b5`, em checkout isolado, preservando a reconciliação anterior. Suíte completa: 1.559 testes aprovados; build aprovado. O formulário público continua sem ID e com `verified: false`.

O formulário `xaeegypp` existe no Formspree e o destino autorizado foi conferido sem alteração. A tela de submissões informa que nenhum formulário foi enviado; spam zero. A consulta da caixa de destino não encontrou mensagem de teste. Nenhum POST foi realizado nesta retomada. A prévia Vite iniciada em loopback não foi alcançada pelo navegador de revisão (`ERR_CONNECTION_REFUSED`), portanto a aparência e o recebimento real permanecem pendentes. Não publicar como funcional nem ativar o envio antes de concluir essas verificações. Nenhum acesso público de prévia foi criado.
