# Tela de entrada por e-mail

**O que faz:** registra quem acessa, sem você precisar aprovar ninguém. Quem abre o painel digita o e-mail, recebe um código de 6 números e entra com o código certo. Ao confirmar, o e-mail entra sozinho na aba `Liberados` (com a data). Cada entrada vira uma linha na aba `Acessos` (data e hora, e-mail, tipo). Quem já confirmou entra direto nas próximas vezes; a visita do dia também é anotada.

**Custo:** zero. Usa o Google (planilha + envio de e-mail pela sua conta Gmail).

## As abas da planilha
- `Liberados`: preenchida sozinha. Cada e-mail que confirmou o código aparece uma vez, com a data do primeiro cadastro.
- `Acessos`: o histórico completo (cadastros e visitas).
- `Bloqueados`: para barrar alguém, escreva o e-mail na coluna A (a linha 1 é o título). A pessoa deixa de receber código e é barrada na próxima vez que abrir o painel. Para desbloquear, apague a linha. Apagar alguém de `Liberados` não barra: a pessoa volta a aparecer quando confirmar de novo.
- `Entrada direta`: quem estiver aqui (um e-mail por linha na coluna A) entra sem código: digita o e-mail e o painel abre. A entrada continua registrada em `Acessos`. Atenção: qualquer pessoa que digitar um desses e-mails entra, então use só para quem você confia e lembre que não há conferência de identidade. `Bloqueados` vale mais que esta aba.
- As abas que faltarem são criadas na primeira vez.

## O que ligar (uma vez, uns 5 minutos)
1. Crie uma planilha nova no Google Drive (nome sugerido: "Acessos do Painel").
2. Na planilha: **Extensões > Apps Script**. Apague o que estiver lá e cole o conteúdo de `cadastro.gs` (esta pasta). Salve.
3. **Implantar > Nova implantação > Tipo: App da Web.** Executar como: **Eu**. Quem tem acesso: **Qualquer pessoa**. Implantar e autorizar (o Google pede permissão para planilha e envio de e-mail).
4. Copie o endereço que termina em `/exec`.
5. Cole esse endereço em `cotacoes/src/acessoConfig.js` (`ACESSO_URL`) e publique. Enquanto estiver vazio, a tela fica desligada e o painel abre direto.

## Limites e cuidados
- **Envio:** conta Gmail comum envia até ~100 códigos por dia. Passou disso, a tela avisa para tentar no dia seguinte. Como qualquer e-mail pode pedir código, alguém mal-intencionado poderia gastar essa cota; se acontecer, bloqueie os e-mails na aba `Bloqueados`.
- **Proteções:** no máximo 5 códigos por hora por e-mail; o código vale 10 minutos e erra-se no máximo 5 vezes.
- **Não é cofre.** O painel é um site público. A tela barra quem usa normalmente, mas quem sabe mexer no navegador consegue contornar. Serve para saber quem acessa, não para guardar segredo. Nunca ponha dado de cliente no painel.
- **Privacidade (LGPD):** e-mail é dado pessoal. A tela traz o aviso de uso. A planilha fica só na sua conta; não ponha a lista no git.
- Se mudar o código do script, é preciso **Implantar > Gerenciar implantações > editar > Nova versão**, mantendo o mesmo endereço.


## Contagem de solicitações de entrada (11/11/2026)

Cada submissão válida de e-mail (inclusive reenvio deliberado) grava `solicitacao`
em Acessos antes do OTP. Novos, cadastrados e Entrada direta usam a mesma regra.
Não comprova identidade nem entrada concluída. Inválidos e bloqueados não contam.
Cota, limite horário e falha de envio podem resultar em tentativa sem sucesso.
O envio do código e as regras anteriores de autenticação são preservados.

No relatório, contar somente `solicitacao`; não somar cadastro/entrada direta/visita.
Não é possível reconstruir essa métrica retroativamente. Abrir/recarregar/navegar
com sessão lembrada não produz solicitação. Não forçamos novo login.

O navegador bloqueia submissões simultâneas e envia um ID por solicitação.
O servidor serializa e deduplica esse ID por até 10 minutos. Cache Apps Script
pode expirar antecipadamente, portanto não é garantia absoluta contra repetição.
Clientes anteriores sem ID continuam compatíveis sem essa deduplicação.

O deploy frontend não atualiza Apps Script. Atualizar código preservando ID_PLANILHA,
remetente e demais configurações existentes; salvar e atualizar a implantação
EXISTENTE para nova versão, mantendo URL, executor e permissões. Não criar endpoint.
