# Tela de entrada por e-mail

**O que faz:** quem abre o painel digita o e-mail, recebe um código de 6 números nesse e-mail e só entra com o código certo. Cada entrada vira uma linha numa planilha sua (aba `Acessos`: data e hora, e-mail, tipo). Quem já confirmou entra direto nas próximas vezes; a visita do dia também é anotada.

**Custo:** zero. Usa o Google (planilha + envio de e-mail pela sua conta Gmail).

## O que ligar (uma vez, uns 5 minutos)
1. Crie uma planilha nova no Google Drive (nome sugerido: "Acessos do Painel").
2. Na planilha: **Extensões > Apps Script**. Apague o que estiver lá e cole o conteúdo de `cadastro.gs` (esta pasta). Salve.
3. **Implantar > Nova implantação > Tipo: App da Web.** Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**. Implantar e autorizar (o Google pede permissão para planilha e envio de e-mail).
4. Copie o endereço que termina em `/exec`.
5. Cole esse endereço em `cotacoes/src/acessoConfig.js` (`ACESSO_URL`) e publique. Enquanto estiver vazio, a tela fica desligada e o painel abre direto.

## Limites e cuidados
- **Envio:** conta Gmail comum envia até ~100 códigos por dia. Passou disso, a tela avisa para tentar no dia seguinte.
- **Proteções:** no máximo 5 códigos por hora por e-mail; o código vale 10 minutos e erra-se no máximo 5 vezes.
- **Não é cofre.** O painel é um site público. A tela barra quem usa normalmente, mas quem sabe mexer no navegador consegue contornar. Serve para saber quem acessa, não para guardar segredo. Nunca ponha dado de cliente no painel.
- **Privacidade (LGPD):** e-mail é dado pessoal. A tela traz o aviso de uso. A planilha fica só na sua conta; não ponha a lista no git.
- Se mudar o código do script, é preciso **Implantar > Gerenciar implantações > editar > Nova versão**, mantendo o mesmo endereço.
