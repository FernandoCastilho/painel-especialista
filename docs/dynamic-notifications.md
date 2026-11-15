# Notificações dinâmicas no Painel Especialista

Referência visual e de interação: https://github.com/rit3zh/expo-dynamic-notifications

O projeto de referência é um template React Native/Expo com Skia, Reanimated e gestos nativos. O Painel usa React 18 e Vite para web. Esta adaptação usa código próprio em React/CSS, sem copiar ou executar o template e sem adicionar dependências.

Os botões de atualização dos painéis apresentam um aviso compacto no topo, com detalhes expansíveis. Confirmações fecham após nove segundos; foco, hover e detalhes abertos suspendem o prazo. Falhas ficam até o fechamento manual. Escape fecha o aviso e restaura o foco quando ele estava dentro do aviso. A região de status anuncia o resultado sem mover o foco. O CSS respeita movimento reduzido e a área segura do dispositivo.

Uma nova resposta substitui a anterior; não há fila histórica. Não são notificações push nem Live Activities do sistema operacional. Recados administrativos e conceito diário preservam seu comportamento. (Desde 10/11/2026 o conceito diário não abre mais sozinho; ver panorama-horario.md.)

## Validação em 03/11/2026

- Build Vite aprovado.
- ESLint sem erros; sete avisos preexistentes em arquivos não alterados.
- 18 testes focados aprovados (novas notificações, barramento e atualização).
- Suíte existente: 463/464 aprovados. O teste XLSX chama `python3`; a execução desse comando retorna EACCES neste ambiente Windows, antes de executar o leitor. Não foi alterado para contornar a restrição.
- Detector mecânico Impeccable: nenhum achado nos arquivos de UI alterados.
- Inspeção visual pendente: IAB recusou conexão e Edge teve timeout ao abrir a prévia local. Servidores Vite iniciaram corretamente, inclusive em loopback fora do isolamento; o navegador não conseguiu acessá-los. Não houve validação visual desktop/mobile nem alegação de aprovação completa de acessibilidade.

Próximo passo: abrir a prévia em um navegador com acesso ao ambiente, verificar desktop e celular, teclado e leitor de tela; depois revisar a branch antes de merge/publicação.

## Diagnóstico complementar

- `node spawnSync("python3", ["--version"])`: status null, EACCES. O comando resolve para `C:\Users\ferna\AppData\Local\Microsoft\WindowsApps\python3.exe`.
- `python --version` e o caminho explícito do Python instalado: sucesso, Python 3.13.17. Nenhuma permissão, alias ou PATH foi alterado.
- A mesma fixture ZIP/XLSX do teste (1132 bytes), gerada e lida com o interpretador permitido: exit 0 e resultado exato `[{"BR":"Gold","A":"2026M09","C":"4319"}]`. Esta validação complementar não altera nem torna aprovado o teste original que chama python3.
- Prévia artificial criada em `cotacoes/workspace-qa/notifications-standalone.html`, com o componente real e textos fictícios, sem consultas de dados. Pasta ignorada no Git.
- Tentativa de prévia HTTP em 127.0.0.1:5191 encontrou restrição de socket no ambiente. Nenhum firewall ou permissão foi alterado.
- Abrir a prévia estática via URL file: no Edge foi explicitamente NEGADO pela política do navegador: apenas http:/https: permitidos. A negativa proíbe contornos por outra superfície ou execução indireta; nenhuma tentativa adicional foi feita. Validação visual continua bloqueada, sem screenshot aprovado.
- Nenhuma configuração de identidade Git, commit, push ou publicação foi realizada nesta continuação.


## Continuação em 04/11/2026

O teste original XLSX foi executado com python3 apontando para uma cópia local do interpretador Python instalado, apenas no ambiente do comando; código e fixture não foram alterados. A suíte completa passou. A prévia atual é servida por HTTP no ambiente autorizado; não se usou URL file nem se contornou a negativa anterior. Novos testes reais de navegador cobrem consulta, foco, Escape, prazo, falha e movimento reduzido em 390/1280 px. Nenhuma publicação é alegada por este documento sem CI/deploy confirmados.
