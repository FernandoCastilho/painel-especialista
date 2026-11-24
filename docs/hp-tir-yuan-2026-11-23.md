---
data_criacao: 2026-11-23
tipo: validacao-de-entrega
atualizado_em: 2026-11-23
atualizado_por: codex
---
# HP 12C, TIR e yuan

Pedido: conferir as calculadoras, implementar os ajustes pendentes da HP 12C e da TIR e tratar o yuan. Base: 3ed91b313a7672396267c0c26dff7970ac2c576f, que já publica o roteiro nas seis calculadoras de crédito.

## Escopo e aceitação

| Item | Implementação | Evidência local |
| --- | --- | --- |
| HP 12C | Integra os rascunhos #557 e #562, resolve conflitos com a remoção já publicada do botão flutuante, preserva o menu. Guia e CET por colagem do Excel, teclado horizontal desktop/flutuante e paisagem móvel, fita pt-BR com cópia sem arredondamento adicional. | 34 testes de interface/CET/fita aprovados. Chrome: janela flutuante e giro retrato/paisagem/retrato aprovados. Navegação em sete larguras e dois temas; paisagem em 844x390, 640x320 e 568x280. |
| CET no celular | Ferramenta disponível independentemente do histórico; recolher o histórico não desmonta o painel nem perde os campos. | Regressão reproduzida antes da correção; teste e conferência do navegador passaram. Colagem de 1.000 recebidos/1.100 pagos em 365 dias produz 10%; 50 de custo inicial produz 15,79%. |
| TIR | Conserva o resolvedor e os valores usuais do legado. Quando ele não encontra a raiz, usa o resolvedor logarítmico já existente na tela atual. Convenção de sinais e dias/365 preservadas; motor compartilhado do 4131 não alterado. | 22 testes cambiais aprovados. Regressões de prazo curto positivo e negativo falharam antes da correção e passaram depois, com comparação analítica e VPL. |
| Yuan | Com lote USD/BRL e USD/CNH defasado, tenta uma vez cada endpoint individual da mesma AwesomeAPI. Só aceita duas pontas válidas, sem regressão temporal e dentro da régua existente de uma hora. Falha mantém referência retida e não cria intraday fictício. | 36 testes de coleta, recuperação e segurança aprovados. Recuperação real ainda depende de execução da coleta após publicar e da fonte fornecer horários compatíveis. |

## Sequência

- [x] Conferir base e rascunhos existentes, preservar seis calculadoras publicadas.
- [x] Integrar HP e reproduzir/corrigir falhas de TIR e montagem do CET.
- [x] Reproduzir e testar recuperação segura do yuan.
- [x] Executar lint, build, testes dirigidos e navegador local.
- [ ] Aprovar suíte e conferências no Ubuntu/Node 22 no commit candidato exato.
- [ ] Obter parecer independente sobre a versão congelada e concluir revisão visual localizada.
- [ ] Integrar com autorização de Fernando e conferir a versão pública.
- [ ] Executar a coleta existente e verificar os timestamps reais do yuan.

## Limites de verificação

A suíte completa local em Windows/Node 26 executou 2.506 testes: 2.476 passaram e 30 falharam. Falhas concentram-se em testes de caminhos POSIX, subprocessos e persistência/journal Git/fsync incompatíveis com este ambiente; o relatório completo está no diretório temporário local. A liberação depende do resultado integral da candidata no ambiente Ubuntu/Node 22 do projeto. Não se declara a suíte local aprovada.

Lint: zero erros e cinco avisos preexistentes. Build aprovado com aviso de tamanho de blocos. Teste físico de celular e Outlook não incluídos nesta entrega; Chrome usa viewport e toque emulados. Nenhuma cotação foi fabricada ou teve seu horário atualizado artificialmente. O CNH não foi substituído por CNY.

A fonte externa foi consultada pelos mecanismos autorizados. A AwesomeAPI pública respondeu 429/inacessibilidade durante o diagnóstico. Não se infere atualização real a partir dos testes simulados. Não há mudança da régua financeira nem dos limites de segurança.

Simplificação: reutilização do motor numérico e do coletor existentes; sem dependências ou rotina nova. Revisão de excesso feita na integração; Simplificador da central consta sem executor instalado no mapa. Parecer visual e independente são vinculados aos registros reais da execução e ao PR, sem simular participação.