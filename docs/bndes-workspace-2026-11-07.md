# BNDES — calculadora e referências unificadas

## Entrega preparada

Uma entrada BNDES no catálogo de calculadoras. A central reúne Simular financiamento, Taxas e históricos e Exemplo conferido (histórico). O simulador Finame permanece específico de Materiais Industrializados; esta mudança não acrescenta motores para todas as linhas BNDES.

- Finame: dados à esquerda e resultado à direita em desktop; empilhados em telas menores. Primeira parcela, juros, IOF e total projetado visíveis. Composição e cronograma expansíveis.
- Comparação TFC × TFB opcional, usando os mesmos parâmetros e o motor existente. Exige mesma faixa e data; usa referência de liberação em 90 dias. Ao fechar, restaura a liberação anterior. Ausência de taxa não vira zero.
- Cotações: reutiliza integralmente as famílias TFB, TFC, TLP e moedas contratuais já disponíveis, com unidades, datas, histórico, CSV e fontes. Não cria outro coletor nem promete dados ao vivo. O histórico selecionado oferece link canônico para compartilhar.
- TLP e LCD conservam seus próprios motores, formulários e condições. O Finame não transfere condições para esses perfis.
- TFBD continua indisponível para simulação. O exemplo histórico TFB não é cotação atual.
- Rotas antigas preservadas. O formulário Finame permanece montado ao consultar taxas ou trocar de perfil na central.
- IOF continua automático e condicionado ao enquadramento de recursos FINAME. Estimativa sem tarifas, seguros ou garantias; não representa CET.

## Verificação local

| Critério | Evidência | Estado |
|---|---|---|
| Regressão geral | `npm test`: 1.371 testes, 0 falhas | Passou |
| Regressão da comparação | `test/finame-comparison.test.mjs`: resultados, invariantes, ausência/zero, datas, faixas e liberações | Passou |
| Preservação de estado e IOF | `test/finame-iof-ui.test.mjs`, incluindo 30 → 90 → 30 | Passou |
| Verificação estática | `npm run lint`: 0 erros; 5 avisos preexistentes fora do escopo | Passou com avisos |
| Compilação | `npm run build` | Passou; aviso preexistente de tamanho de pacote |
| Revisões de design e simplificação | Revisão documental do código; achados corrigidos e reconferidos | Concluída somente no código |
| Interface real | `smoke-bndes-workspace.cjs`, matriz preparada em 320/390/768/1440 px, claro/escuro | Não executada: Chromium local abortou por bloqueio de socket; navegador remoto recusou localhost |
| Envio externo | Tentativa de push da branch de trabalho | Bloqueado pela revisão automática; exige autorização explícita para envio ao repositório público |
| Publicação | GitHub Pages existente | Não realizada |

## Próxima atividade

Após autorização explícita para o destino público: enviar a branch ao repositório FernandoCastilho/painel-especialista, abrir PR para a branch vigente, executar os testes de navegador, corrigir falhas, inspecionar as capturas finais e só então integrar/publicar. Não ampliar público ou permissões.

O workflow `BNDES workspace QA` foi preparado para essa verificação em PR. Preparação não equivale a execução ou aprovação visual.

## Apresentação dentro do painel

Adicionado ao resultado válido do Finame Materiais um botão com ícone **Apresentar simulação**. Não gera PPTX. A configuração permite título, seleção de slides, texto normal/grande/extra grande e alternativa única ou comparação TFC × TFB quando válida.

O roteiro contém operação, condições e referências, resultado/comparação, fluxo ilustrativo e premissas. Resultado e premissas são obrigatórios. Cada resultado mantém o principal, prazo, carência, amortização, taxa final e exclusões; o rodapé preserva a natureza estimativa e os alertas de referência retida.

Os dados são copiados e congelados ao abrir a configuração, incluindo resultados, cronogramas, taxas, séries, datas, enquadramento, alertas e links das fontes oficiais. A apresentação não faz novas consultas nem grava título ou valores em armazenamento. Para novos dados é necessário fechar e abrir outra apresentação.

Navegação preparada: botões, setas, PageUp/PageDown, Home/End, espaço, Escape; tela cheia solicitada pelo usuário, com mensagem de indisponibilidade; retorno à configuração e restauração do foco. Apontador reaproveita a instância global, em encaixe dentro do host da apresentação. Primeiro Escape pode desligar o apontador conforme o comportamento global existente.

Testes adicionais em `test/bndes-presentation.test.mjs`: congelamento/cópia independente, bloqueios de resultado/IOF/referência, comparação elegível, slides obrigatórios e limites da navegação. O smoke de navegador preparado cobre abertura, navegação, comparação, fechamento e retorno do foco, com capturas em cada largura/tema. Ainda não foi executado neste ambiente.

Revisões documentais do Diretor de Arte e do Simplificador executadas, com correções reconferidas. Continuam pendentes inspeção visual e interação real, inclusive fullscreen, apontador e teclado. Nenhum envio externo foi feito nesta etapa; a autorização anterior de envio continua pendente.

Verificação final desta etapa: 1.371 testes passaram, sem falhas; lint sem erros e build concluído. A regra de fontes da interface recebeu exceção restrita ao bloco de referências do slide de premissas; as demais telas continuam com o catálogo centralizado.
