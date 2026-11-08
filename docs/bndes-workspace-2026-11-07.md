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

## Validação e aceitação · registro pré-publicação

A publicação no repositório público e no GitHub Pages foi autorizada por Fernando. A implementação está no [PR 325](https://github.com/FernandoCastilho/painel-especialista/pull/325), na branch `codex/bndes-unificado-20261107`. Este registro documenta a validação antes da liberação em produção. O código testado é `7417ec6b322528ca08cd50a631ebb8183849332b`, integrado à base que já contém CBS e Bancos. Este fechamento documental não modifica fontes, testes ou configuração executável.

| Requisito | Critério e evidência | Estado |
|---|---|---|
| Entrada BNDES única e preservação dos perfis | `scripts/smoke-bndes-workspace.cjs`: catálogo, alternância de áreas e perfis, preenchimento preservado | Passou no CI final |
| Comparação coerente TFC × TFB | `test/finame-comparison.test.mjs`: mesmos parâmetros, data/faixa/liberação, ausência e zero; `test/finame-iof-ui.test.mjs`: 30 → 90 → 30 e enquadramento | Passou na suíte local e no CI final |
| Regressão geral | `npm test`: 1.388 testes, 0 falhas | Passou localmente e no CI final |
| Verificação estática | `npm run lint`: 0 erros; 5 avisos preexistentes em Calendario, Curves e SeriesHistory | Passou com avisos |
| Compilação | `npm run build`: concluída; aviso preexistente de tamanho de pacote | Passou localmente e no CI final |
| Responsividade das calculadoras | `scripts/smoke-calculator-layout.cjs`: 320/390/768/1024/1440 px, sem rolagem global, contraste, controles e exemplos calculados | 30/30 cenários passaram no CI final |
| Apresentação e acessibilidade | `scripts/smoke-bndes-workspace.cjs`: 320/390/768/1440 px, claro/escuro; configuração, cinco slides, comparação, apontador, fullscreen ou fallback, teclado/foco e erros | Passou no CI final |
| Regressões BNDES e demais calculadoras | `smoke-calculadora.cjs`, `smoke-bndes.cjs`, `smoke-bndes-profiles.cjs`, CI geral | Passou no CI final |
| Revisão especializada | Diretor de Arte e Simplificador revisaram o código; Diretor de Arte examinou capturas reais e solicitou correções de títulos, tabelas e instruções iniciais | Aprovada pelo Diretor de Arte sobre as capturas finais de 7417ec6 |
| Auditoria independente | Revisão separada sobre versão congelada e evidências vinculadas por hashes | Parecer independente vinculado ao SHA atual do PR; exigido antes da integração |
| Produção | Integração do PR, workflow Pages e teste no endereço publicado | Não realizada nesta etapa |

As primeiras rodadas revelaram problemas reais de contraste, herança de títulos, corte de tabela e foco de teclado; as correções mantêm as verificações de regressão. Ajustes de seletores acompanham a nova estrutura sem retirar verificações financeiras ou tributárias. O navegador local não iniciou neste ambiente; a conferência real ocorre em Chrome no GitHub Actions, com dados sintéticos identificados nos testes e capturas publicadas como artefatos de CI.

### Evidências da versão final

- [CI 42439115600](https://github.com/FernandoCastilho/painel-especialista/actions/runs/42439115600): `test-build`, `bndes-workspace` e `smoke` concluídos com sucesso. Suíte: 1.388 testes, zero falhas.
- [Capturas e relatórios BNDES](https://github.com/FernandoCastilho/painel-especialista/actions/runs/42439115600/artifacts/13600552761): central/apresentação 8/8; layout das calculadoras 30/30; perfis BNDES 10/10, todos passaram. Artefato SHA256 `fefd437154df1896deb6ebadbce5d81a1bc8c30c062464f0becac93a8f3c4650`.
- Os smokes gerais também passaram, incluindo preservação de CBS e Bancos, busca, fontes, temas, demais calculadoras, seleção temporal e matriz final.
- Capturas da apresentação cobrem configuração com ajustes expandidos, operação, comparação, fluxo e premissas. Foram corrigidos contraste, títulos herdados do cabeçalho, tabela cortada e foco ao trocar slides. A região da tabela mantém setas de rolagem e o player mantém os atalhos de slides.
- Revisão visual final do Diretor de Arte: aprovada em 320, 390, 768 e 1440 px, nos temas claro e escuro, para o texto normal. Configurações de texto grande e extra grande existem; a inspeção visual final das capturas foi feita no tamanho normal, sem alegar aprovação visual de todos os tamanhos.

### Operação e reversão

Esta alteração reutiliza o React/Vite, os coletores e o GitHub Pages existentes. Não cria banco, conta, autenticação, cobrança, serviço externo ou persistência de dados de cliente. A apresentação não envia os valores simulados. O histórico de commits e o PR preservam a base anterior; eventual reversão deve ocorrer por commit de reversão no mesmo repositório e pelo workflow Pages existente. A publicação só será declarada após confirmação do workflow e verificação do endereço de produção.

## Apresentação dentro do painel

Adicionado ao resultado válido do Finame Materiais um botão com ícone **Apresentar simulação**. Não gera PPTX. A configuração permite título, seleção de slides, texto normal/grande/extra grande e alternativa única ou comparação TFC × TFB quando válida.

O roteiro contém operação, condições e referências, resultado/comparação, fluxo ilustrativo e premissas. Resultado e premissas são obrigatórios. Cada resultado mantém o principal, prazo, carência, amortização, taxa final e exclusões; o rodapé preserva a natureza estimativa e os alertas de referência retida.

Os dados são copiados e congelados ao abrir a configuração, incluindo resultados, cronogramas, taxas, séries, datas, enquadramento, alertas e links das fontes oficiais. A apresentação não faz novas consultas nem grava título ou valores em armazenamento. Para novos dados é necessário fechar e abrir outra apresentação.

Navegação preparada: botões, setas, PageUp/PageDown, Home/End, espaço, Escape; tela cheia solicitada pelo usuário, com mensagem de indisponibilidade; retorno à configuração e restauração do foco. Apontador reaproveita a instância global, em encaixe dentro do host da apresentação. Primeiro Escape pode desligar o apontador conforme o comportamento global existente.

Testes adicionais em `test/bndes-presentation.test.mjs`: congelamento/cópia independente, bloqueios de resultado/IOF/referência, comparação elegível, slides obrigatórios e limites da navegação. O smoke de navegador preparado cobre abertura, navegação, comparação, fechamento e retorno do foco, com capturas em cada largura/tema. A execução final de navegador passou no GitHub Actions; consulte as evidências abaixo.

Revisões documentais do Diretor de Arte e do Simplificador executadas, com correções reconferidas. A implementação já foi enviada ao PR autorizado. As capturas finais foram examinadas e aprovadas pelo Diretor de Arte. A auditoria independente é registrada separadamente no fechamento da entrega; este arquivo, isoladamente, não comprova implantação.

Verificação local desta etapa: 1.388 testes passaram, sem falhas; lint sem erros e build concluído. A regra de fontes da interface recebeu exceção restrita ao bloco de referências do slide de premissas; as demais telas continuam com o catálogo centralizado.
