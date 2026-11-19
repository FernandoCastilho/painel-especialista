# Árvore de Crédito — tela (etapa 1, 18/11/2026)

Rota: `#calculadora/arvore-credito` (atalhos do terminal: `ARVORE`, `ARVOREDECREDITO`). **Fora do menu Calculadoras e da busca** (decisão de Fernando, 18/11/2026, como a tela Apresentar): abre só pelo endereço ou pelo atalho, para teste.

## O que faz

1. **Quem é o cliente:** CNPJ com consulta pública opcional (BrasilAPI), ou preenchimento manual de UF, município, CNAE, tipo societário, regime tributário e faturamento anual. O porte no BNDES sai do faturamento anual ou, se vazio, dos últimos meses da tabela.
2. **O que ele precisa:** necessidade (oito folhas confirmadas por Fernando e quatro propostas a revisar), finalidade, valor, prazo, se exporta ou importa, notas elegíveis ao Finame Materiais, notas validadas para a CPR, máquina credenciada (só na máquina nacional) e garantias disponíveis.
3. **Faturamento e endividamento (opcional):** a mesma tabela colada da calculadora Faturamento. Mostra total e média dos últimos 12 meses, meses fracos (abaixo de 80% da média) e fortes (acima de 120%), dívida e pedido em meses de faturamento e, se informada, a parte da dívida que vence em 12 meses.
4. **Possibilidades:** até três, na ordem combinada para a necessidade. As demais que servem ficam em "Outras opções, só para você"; as que não servem aparecem em "Saíram da folha", com o motivo. Cada possibilidade traz o que cobre, o que fica de fora, impostos, se a parcela é ajustável, cuidados do perfil, a base com fonte e data, e atalho para a calculadora do Painel.
5. **Visão para o cliente:** só as três possibilidades, sem outras opções, motivos de exclusão nem atalhos. Não há dado do banco na tela.

## Regras usadas

- Ordem das folhas, regra do giro no gap de caixa (só acima de 12 meses), parcela ajustável (4131, capital de giro, CPR e nota comercial), CPR fora para microempresa com motivo neutro na tela ("confirme se a instituição opera CPR com esse porte"), após parecer do Auditor de 18/11/2026 e giro do BNDES com aviso nos dividendos: decisões e relatos de Fernando, em `arvore-decisao-credito.md`, seção 10.
- Enquadramento e impostos: pesquisa de 18/11/2026, em `arvore-credito-regras-produtos.md`.
- Código: `cotacoes/src/arvoreCredito.js` (regras, folhas, leitura da tabela, CNPJ) e `cotacoes/src/ArvoreCredito.jsx` (tela).

**Sem conta financeira.** A tela não calcula taxa, CET, IOF nem projeção; só filtra, ordena, explica e soma os números colados. Nenhuma regra de cálculo das outras calculadoras foi alterada.

## Sigilo

**Consulta de CNPJ desligada na publicação** (decisão de Fernando, 18/11/2026, após parecer do Auditor): a tela pede os dados à mão e nenhum dado sai dela. O código da consulta continua pronto (`CONSULTA_CNPJ_ATIVA` em `arvoreCredito.js`) para ser ligado depois de confirmada a política do banco sobre consulta em serviço externo. Enquanto isso, a tela tem um botão que abre em outra aba o [Comprovante de Inscrição e de Situação Cadastral da Receita Federal](https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp): o especialista digita o CNPJ lá e copia os dados; o CNPJ vai só para a Receita (decisão de Fernando, 18/11/2026). Endereço confirmado por busca; a página não abriu neste ambiente. Quando ligada, valem os pontos abaixo.


- O CNPJ só sai da tela quando o especialista clica em consultar, e só para a BrasilAPI. CNPJ com dígito errado não é enviado.
- O CNPJ não entra no endereço da página nem fica guardado. Nada da tela é salvo.
- O serviço público fica sabendo qual CNPJ foi consultado. Confirmar a política do banco antes de publicar.

## Conferências

- `node --test test/arvore-credito.test.mjs`: 13 testes da tela (ordem das oito folhas, limite de três, motivos de exclusão, regime tributário, CPR e porte, exportação, debênture só S.A., aviso do giro BNDES, fundos regionais, tabela de faturamento, CNPJ, consulta com falhas, tela).
- `scripts/smoke-arvore-credito.cjs`: navegador em 390 e 1440 px, temas claro e escuro, CNPJ com resposta **simulada**, sem rolagem lateral, visão do cliente. Incluído no CI.
- `npm test` (todos os testes do Painel), `npm run build` e `npm run lint` (0 erros; avisos antigos em outros arquivos). Números atualizados em cada PR.

## Não conferido

- **Consulta real ao CNPJ:** o endereço foi liberado na rede da sessão, mas a ferramenta de segurança da sessão bloqueou a chamada de teste. Os nomes dos campos seguem o formato documentado da BrasilAPI; o campo de regime (Lucro Real ou Presumido) pode não vir. Testar com um CNPJ público antes de usar.
- **Uso direto do navegador:** não foi possível confirmar se a BrasilAPI aceita chamada direta do navegador do usuário (CORS) nem o limite de consultas.
- Lista de CNAEs que habilitam a CPR: leitura da lei, a conferir na tabela do IBGE.
- As quatro folhas propostas (alongar dívida, obra, garantia ao fornecedor, garantia de contrato) não foram revisadas por Fernando.

## Próximas etapas

- **Etapa 2:** números a partir da taxa digitada, com parcela ajustada aos meses fortes e fracos. Conta nova, com revisão independente.
- **Etapa 3:** imposto do NDF no Lucro Presumido em número, depois de validação de tributarista e autorização de Fernando.
- Revisão periódica das regras embutidas (data de conferência visível na tela).
