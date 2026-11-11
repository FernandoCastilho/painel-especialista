# Tela de entrada por e-mail

**O que faz:** registra quem acessa, sem você precisar aprovar ninguém. Quem abre o painel digita o e-mail, recebe um código de 6 números e entra com o código certo. Ao confirmar, o e-mail entra sozinho na aba `Liberados` (com a data). Cada entrada vira uma linha na aba `Acessos` (data e hora, e-mail, tipo). Quem já confirmou entra direto nas próximas vezes; cada nova abertura ou recarregamento também registra uma visita, mesmo no mesmo dia. Navegar entre telas do painel não gera outra visita.

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

## Contagem de entradas (11/11/2026)
- Conte apenas linhas do tipo `visita` para a frequência de abertura/recarregamento. `cadastro` e `entrada direta` são etapas de autenticação e não devem ser somadas às visitas.
- A mudança remove o antigo limite diário no navegador. Não reconstrói visitas anteriores que não foram registradas.
- Cada documento aberto faz uma tentativa, compartilhada entre efeitos React e navegação interna. Falha de rede não é repetida automaticamente, para evitar duplicação quando a resposta se perde; portanto pode haver subcontagem em falhas.
- A identificação é por e-mail. O acesso direto continua sem verificação de identidade por código. Nenhum token é gravado na planilha ou no relatório.
