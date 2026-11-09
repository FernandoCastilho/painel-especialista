# Análise local de balanços

## Produto e escopo

Módulo `#balancos` do Painel do Especialista para comparar três exercícios calendário de uma mesma entidade, moeda, unidade e escopo. Integra o menu e a busca global. A entrada e o cálculo são locais; não há chamada a modelos de IA, OCR, leitura de PDF/imagem nem pesquisa automática de companhias abertas.

O fluxo é Dados → Gerar análise → Análise. Aceita preenchimento manual, CSV anual e JSON versão 1. O modelo JSON descarregado é a base dos três anos, 36 meses, contratos e referências. CSV usa códigos de contas na primeira coluna, três exercícios no cabeçalho, ponto e vírgula e vírgula decimal. Importação inválida não altera os dados existentes. Edição invalida o relatório anterior.

A interface apresenta indicadores, até cinco constatações, inferências opcionais identificadas como não conclusivas, perguntas prioritárias e detalhes expansíveis. Não gera rating, aprovação, limite, projeção ou diagnóstico causal. O setor selecionado adiciona perguntas documentais; não representa especialista setorial validado com documentos reais. Referências públicas são informadas e conferidas pelo usuário; não são metas nem médias setoriais.

## Dados e segurança

Dados ficam em `useState`, sem backend, localStorage ou sessionStorage. São descartados na saída da seção ou recarga. Exportação JSON é uma ação explícita do usuário. Testes usam somente dados sintéticos. Conteúdo importado é dado, renderizado como texto React; nunca HTML ou instrução executável.

Limites: 1 MB por arquivo, 200 contratos, 100 referências, exatamente três exercícios consecutivos e 12 posições mensais por ano. Contas fora do catálogo são rejeitadas, não descartadas silenciosamente. Catálogo e fórmulas ficam em `balanceAnalysis.js`; cada célula pode ter valor, estado, fonte e nota. Origem geral é por exercício, com origem específica opcional por célula. Correção do valor preserva a fonte e reclassifica explicitamente a célula como Informado. Respostas posteriores não são associadas automaticamente aos IDs de perguntas.

## Cálculos e limitações

- Ausente, ilegível, divergente e não comparável não são zero. Valores negativos de contas de natureza não negativa bloqueiam dependências. Lucro, lucro bruto, PL, IR/CSLL e fluxo operacional aceitam sinal.
- Crescimento percentual exige base anterior positiva e valor atual não negativo; demais casos mostram diferença absoluta. Diferenças de margens e taxas usam pontos percentuais.
- Dívida exige escopo declarado. Caixa informado não é deduzido sem valor elegível confirmado. EBITDA é lucro líquido + IR/CSLL + despesas financeiras − receitas financeiras + depreciação/amortização/exaustão no resultado; todos os componentes precisam existir. EBITDA não é caixa.
- Prazos usam média entre saldo inicial/final, dias informados e bases explicitamente compatíveis. PMR usa vendas a prazo; PMP usa compras a prazo, nunca CMV; PME usa custo correspondente. Ausência de abertura do primeiro ano não usa saldo final. Falta de saldo anterior não usa abertura de outro exercício.
- Mensal: soma parcial identificada, total anual apenas com 12 meses, média observada, variações entre anos e sequenciais inclusive dezembro/janeiro, participação anual, trimestres e semestres completos.
- Balanço, lucro bruto, faturamento e dívida têm resíduos explícitos, sem ajuste automático ou tolerância inventada. Um resíduo sem atribuição a uma conta não determina qual entrada está errada; permanece uma lacuna de conciliação. Contas marcadas divergentes bloqueiam os cálculos dependentes.
- Dívidas: contratos duplicados ficam fora dos totais até conciliação. Agrupamento por data/moeda, credor/modalidade/indexador; cronograma usa amortizações documentadas, não vencimento final. Faixas: vencidos, até12,13–24,25–36 e acima36 meses. Valores são unidades da moeda do contrato. Não converte moedas. Conciliação com balanço exige mesma moeda, data31/12 e confirmação de escopo completo; unidade do balanço é aplicada.
- Benchmark: diferença somente quando usuário confirma comparabilidade, fornece fonte, data de consulta, limitações, moeda/unidade/escopo e fórmula idêntica. O aplicativo não valida o conteúdo externo. Não há preenchimento por proxy ou média setorial presumida.
- Não calcula correlação estatística com três anos nem presume fluxo de caixa por variação contábil. Mantém DFC informada como entrada opcional.

## Experiência

Preserva os tokens do painel nos temas claro/escuro. Campos anuais têm tabela rolável no celular, rótulos persistentes e foco visível. Impressão/PDF é explicitamente da síntese; detalhes permanecem disponíveis no relatório JSON e na tela. Relatório não certifica documentos nem contém auditoria independente.

Direção visual e simplificação consultadas na implementação; aprovação visual depende das capturas em execução. Melhorias futuras: ingestão documental segura, pesquisa pública assistida, cobertura de todas as contas customizadas e histórico de respostas com IDs estáveis. Não estão simuladas como recursos disponíveis.

## Matriz de aceitação e operação

| Requisito | Evidência |
|---|---|
| Ausência, sinais, divergência, razões, prazos, EBITDA | `test/balance-analysis.test.mjs` |
| Meses, faixas de dívida, comparação de datas/unidades, benchmark | Mesmo teste, casos sintéticos |
| Navegação e busca | Catálogo único; testes de menu atualizados para Balanços |
| Entrada/relatório, importação atômica, metadados, privacidade, responsividade | `scripts/smoke-balance-analysis.cjs`, artefato CI `balance-analysis-design` |
| Regressão | `npm run lint`, `npm test`, `npm run build` e gates existentes do CI |

Release usa o fluxo GitHub Pages existente, sem relaxar gates. Revisar resultado dos testes e capturas antes da integração. Reversão: reverter a PR deste módulo mantendo commits concorrentes, executar gates e publicar pelo mesmo fluxo. Não há banco, migração ou estado persistido a restaurar.
